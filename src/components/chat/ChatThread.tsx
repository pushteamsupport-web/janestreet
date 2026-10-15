import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal, X, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTime, signedUrl, type ChatMessage } from "@/lib/chat";
import { PhotoViewer } from "@/components/CaseProof";

function Attachment({ message }: { message: ChatMessage }) {
  const path = message.attachment_path!;
  const isImage = (message.attachment_type ?? "").startsWith("image/");
  const [viewing, setViewing] = useState(false);
  const { data: url } = useQuery({
    queryKey: ["chat-file", path],
    queryFn: () => signedUrl(path),
    staleTime: 1000 * 60 * 30,
  });

  if (!url) {
    return <p className="mt-1.5 text-xs opacity-70">Loading attachment…</p>;
  }
  const label = message.attachment_name ?? "Shared image";
  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setViewing(true)}
          className="mt-1.5 block"
          aria-label={`Open ${label}`}
        >
          <img
            src={url}
            alt={label}
            loading="lazy"
            className="max-h-52 w-auto rounded-lg border border-border/40 object-cover"
          />
        </button>
        {viewing ? (
          <PhotoViewer view={{ url, caption: label }} onClose={() => setViewing(false)} />
        ) : null}
      </>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2.5 py-2 text-xs underline-offset-2 hover:underline"
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{message.attachment_name ?? "Attachment"}</span>
    </a>
  );
}

export function ChatThread({
  messages,
  viewerRole,
  loading,
  sending,
  onSend,
  emptyHint,
  disabled,
}: {
  messages: ChatMessage[];
  viewerRole: "admin" | "client";
  loading?: boolean;
  sending?: boolean;
  onSend: (body: string, file: File | null) => Promise<void> | void;
  emptyHint?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body && !file) return;
    setText("");
    const attached = file;
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    await onSend(body, attached);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {emptyHint ?? "Send a message and our team will reply here."}
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_role === viewerRole;
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {message.body ? (
                    <p className="whitespace-pre-wrap break-words leading-snug">{message.body}</p>
                  ) : null}
                  {message.attachment_path ? <Attachment message={message} /> : null}
                  <span className="mt-1 block text-[0.62rem] opacity-70">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-border bg-card px-3 py-2.5">
        {file ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a file or photo"
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </Button>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(event as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder="Type your message…"
            disabled={disabled}
            aria-label="Message"
            className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={disabled || sending || (!text.trim() && !file)}
            aria-label="Send message"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}
