import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headset, ChevronDown, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  ensureConversation,
  fetchMessages,
  markRead,
  notifyIncoming,
  requestNotificationPermission,
  sendChatMessage,
  type ChatMessage,
} from "@/lib/chat";

/** Live WhatsApp support line — tapping the WhatsApp icon opens this chat. */
const WHATSAPP_LINK = "https://wa.me/13069127461";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.52 3.76 1.42 5.32L2 22l4.98-1.58a9.8 9.8 0 0 0 5.06 1.4h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2Zm5.72 13.96c-.24.68-1.4 1.32-1.94 1.36-.5.04-.98.22-3.32-.7-2.8-1.1-4.56-3.96-4.7-4.14-.14-.18-1.12-1.5-1.12-2.86 0-1.36.72-2.02.98-2.3.24-.26.54-.32.72-.32h.52c.16 0 .4-.06.62.48.24.56.8 1.94.88 2.08.08.14.12.3.02.48-.1.18-.16.3-.3.46-.14.16-.3.36-.44.48-.14.14-.3.3-.12.58.18.3.78 1.28 1.68 2.08 1.16 1.02 2.14 1.34 2.44 1.48.3.14.48.12.66-.08.18-.2.76-.88.96-1.18.2-.3.4-.24.66-.14.26.1 1.64.78 1.92.92.28.14.46.2.54.32.08.12.08.68-.16 1.36Z" />
    </svg>
  );
}

/** Fixed bottom-right customer-service bar for clients. */
export function ChatWidget() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const clientId = user?.id ?? null;

  // Support name on shift, rotating every 2 hours.
  const supportAgent = useMemo(() => {
    const names = ["Daniel Reyes", "Amelia Hart", "Marcus Bell"];
    const slot = Math.floor(Date.now() / (1000 * 60 * 60 * 2));
    return names[slot % names.length]!;
  }, []);

  const conversationQuery = useQuery({
    queryKey: ["conversation", clientId],
    queryFn: () => ensureConversation(clientId!),
    enabled: Boolean(clientId) && !isAdmin,
  });
  const conversationId = conversationQuery.data ?? null;

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: Boolean(conversationId),
  });

  const messages = useMemo<ChatMessage[]>(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const unread = messages.filter((m) => m.sender_role === "admin" && !m.read_at).length;

  // Realtime: new support replies arrive instantly, with a chime.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-client-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage | undefined;
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          if (payload.eventType === "INSERT" && row?.sender_role === "admin") {
            notifyIncoming(
              "Jane Street support",
              row.body || row.attachment_name || "New message",
            );
            if (!openRef.current) {
              toast.message("New message from Jane Street support");
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Mark support messages read while the panel is open.
  useEffect(() => {
    if (!open || !conversationId || unread === 0) return;
    void markRead(conversationId, "admin").then(() =>
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
    );
  }, [open, conversationId, unread, queryClient]);

  const handleSend = useCallback(
    async (body: string, file: File | null) => {
      if (!conversationId || !clientId) return;
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

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("open-support-chat", openChat);
    return () => window.removeEventListener("open-support-chat", openChat);
  }, []);

  // Hidden inside the admin panel — admins use the inbox instead.
  if (pathname.startsWith("/admin") || isAdmin) return null;

  const signedOut = !loading && !user;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 print:hidden sm:bottom-24">
      {open ? (
        <div className="flex h-[min(70vh,30rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Headset className="h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold leading-none">Customer service</p>
                <p className="mt-1 text-[0.68rem] text-muted-foreground">
                  {supportAgent} is on shift
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-md p-1 hover:bg-secondary"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {signedOut ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                Log in to chat with the Jane Street support team.
              </p>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "login" }}>
                  Log in
                </Link>
              </Button>
            </div>
          ) : (
            <ChatThread
              messages={messages}
              viewerRole="client"
              loading={conversationQuery.isLoading || messagesQuery.isLoading}
              sending={sending}
              onSend={handleSend}
              emptyHint="Send us a message — a real person replies here, day or night."
            />
          )}
        </div>
      ) : null}

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elevated transition-transform hover:scale-[1.05]"
      >
        <WhatsAppIcon className="h-6 w-6" />
      </a>

      <button
        type="button"
        onClick={() => {
          requestNotificationPermission();
          setOpen((value) => !value);
        }}
        aria-label={open ? "Close customer service chat" : "Open customer service chat"}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:scale-[1.05]"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        )}
        {!open && unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.68rem] font-bold text-destructive-foreground">
            {unread}
          </span>
        ) : null}
      </button>


    </div>
  );
}
