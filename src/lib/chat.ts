import { supabase } from "@/integrations/supabase/client";

export const CHAT_BUCKET = "chat-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "admin" | "client";
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  read_at: string | null;
  created_at: string;
};

/** Returns the caller's conversation, creating it on first use. */
export async function ensureConversation(clientId: string): Promise<string> {
  const { data: existing, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  const { data, error: insertError } = await supabase
    .from("conversations")
    .insert({ client_id: clientId })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return data.id;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function uploadAttachment(clientId: string, file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Files must be 10 MB or smaller");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${clientId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type || "application/octet-stream" };
}

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function sendChatMessage(input: {
  conversationId: string;
  senderId: string;
  senderRole: "admin" | "client";
  clientId: string;
  body: string;
  file?: File | null;
}): Promise<ChatMessage> {
  let attachment: { path: string; name: string; type: string } | null = null;
  if (input.file) attachment = await uploadAttachment(input.clientId, input.file);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      sender_role: input.senderRole,
      body: input.body,
      attachment_path: attachment?.path ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function markRead(conversationId: string, senderRole: "admin" | "client") {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_role", senderRole)
    .is("read_at", null);
  if (error) throw error;
}

let audioCtx: AudioContext | null = null;

/** Short two-tone chime used to announce an incoming message. */
export function playNotificationSound() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    [
      { freq: 880, at: 0 },
      { freq: 1170, at: 0.16 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.22, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.3);
    });
  } catch {
    /* audio is best-effort */
  }
}

export function notifyIncoming(title: string, body: string) {
  playNotificationSound();
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
}

export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") void Notification.requestPermission();
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
