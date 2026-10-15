import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ImageOff, X } from "lucide-react";
import { caseFileUrl, fetchCaseAttachments, type CaseAttachment } from "@/lib/cases";
import { Button } from "@/components/ui/button";

function ProofItem({
  attachment,
  onOpen,
}: {
  attachment: CaseAttachment;
  onOpen: (view: { url: string; caption: string }) => void;
}) {
  const isImage = (attachment.file_type || "").startsWith("image/");
  const { data: url, isLoading } = useQuery({
    queryKey: ["case-file", attachment.storage_path],
    queryFn: () => caseFileUrl(attachment.storage_path),
    staleTime: 1000 * 60 * 30,
  });

  const caption = attachment.caption || attachment.file_name || "Proof of funds recovery";

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-background">
      {isImage ? (
        isLoading || !url ? (
          <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
            {isLoading ? "Loading proof…" : <ImageOff className="h-5 w-5" aria-hidden="true" />}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpen({ url, caption })}
            className="block w-full"
            aria-label={`Open ${caption}`}
          >
            <img
              src={url}
              alt={caption}
              loading="lazy"
              className="max-h-[32rem] w-full bg-secondary object-contain"
            />
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={() => (url ? onOpen({ url, caption }) : undefined)}
          className="flex w-full items-center gap-2 px-4 py-4 text-left text-sm underline-offset-4 hover:underline"
        >
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{attachment.file_name || "Attachment"}</span>
        </button>
      )}
      <figcaption className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

/** Fullscreen in-site viewer so opening a photo never leaves the site. */
export function PhotoViewer({
  view,
  onClose,
}: {
  view: { url: string; caption: string };
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={view.caption}
      className="fixed inset-0 z-50 flex flex-col bg-foreground/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Cancel
        </Button>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={view.url}
          alt={view.caption}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      </div>
      <p className="mt-3 text-center text-xs leading-relaxed text-background">{view.caption}</p>
    </div>
  );
}

/** Full-width gallery of the proof uploaded to a case. */
export function CaseProof({ caseId }: { caseId: string }) {
  const [viewing, setViewing] = useState<{ url: string; caption: string } | null>(null);

  const query = useQuery({
    queryKey: ["case-attachments", caseId],
    queryFn: () => fetchCaseAttachments(caseId),
  });

  if (query.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading proof…</p>;
  }

  const items = query.data ?? [];
  if (items.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        No proof has been uploaded to this case yet. Our team adds screenshots here as your
        recovery progresses.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((attachment) => (
        <ProofItem key={attachment.id} attachment={attachment} onOpen={setViewing} />
      ))}
      {viewing ? <PhotoViewer view={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}
