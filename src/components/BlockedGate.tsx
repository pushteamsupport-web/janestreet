import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { useAuth } from "@/hooks/useAuth";
import {
  ensureConversation,
  fetchMessages,
  markRead,
  sendChatMessage,
  type ChatMessage,
} from "@/lib/chat";

/**
 * Blocks every authenticated screen for suspended accounts.
 * The only thing a blocked client can still do is chat support to appeal.
 */
export function BlockedGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const blockedQuery = useQuery({
    queryKey: ["blocked-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("blocked, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { blocked: boolean; full_name: string } | null;
    },
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  // React instantly when an admin blocks or unblocks this account.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-block-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { blocked?: boolean };
          queryClient.setQueryData(["blocked-status", user.id], (prev: unknown) => ({
            ...(prev as object | null),
            blocked: Boolean(row.blocked),
          }));
          if (row.blocked) toast.error("Your account has been suspended by an administrator.");
          else toast.success("Your account has been restored.");
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  if (loading || (user && blockedQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (blockedQuery.data?.blocked) {
    return <BlockedScreen clientId={user!.id} />;
  }

  return <>{children}</>;
}

function BlockedScreen({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);

  const conversationQuery = useQuery({
    queryKey: ["conversation", clientId],
    queryFn: () => ensureConversation(clientId),
  });
  const conversationId = conversationQuery.data ?? null;

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`blocked-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (conversationId) void markRead(conversationId, "admin");
  }, [conversationId, messagesQuery.data]);

  const handleSend = useCallback(
    async (body: string, file: File | null) => {
      if (!conversationId) return;
      setSending(true);
      try {
        await sendChatMessage({
          conversationId,
          senderId: clientId,
          senderRole: "client",
          clientId,
          body,
          file,
        });
        await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Message could not be sent");
      } finally {
        setSending(false);
      }
    },
    [conversationId, clientId, queryClient],
  );

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth?mode=login";
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <h1 className="text-base font-semibold text-destructive">Account suspended</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                An administrator has restricted your account. You cannot view your dashboard, file
                or update cases until it is restored. Message support below to appeal — a member of
                the team will reply here.
              </p>
            </div>
          </div>
        </section>

        <section className="flex h-[26rem] min-h-0 flex-col rounded-2xl border border-border bg-card">
          <ChatThread
            messages={(messagesQuery.data ?? []) as ChatMessage[]}
            viewerRole="client"
            loading={messagesQuery.isLoading || conversationQuery.isLoading}
            sending={sending}
            onSend={handleSend}
            emptyHint="Send a message to support to request access again."
          />
        </section>

        <div>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
