import { supabase } from "@/integrations/supabase/client";

export const CASE_BUCKET = "case-attachments";
export const MAX_CASE_FILE_BYTES = 15 * 1024 * 1024;

export const CASE_STATUS_LABELS: Record<string, string> = {
  under_review: "Under review",
  investigating: "Investigating",
  recovered: "Fully recovered",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const CASE_STATUSES = ["under_review", "investigating", "recovered", "closed"] as const;

export type CaseAttachment = {
  id: string;
  case_id: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  caption: string;
  uploaded_by: string;
  created_at: string;
};

export async function fetchCaseAttachments(caseId: string): Promise<CaseAttachment[]> {
  const { data, error } = await supabase
    .from("case_attachments")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaseAttachment[];
}

export async function caseFileUrl(path: string) {
  const { data, error } = await supabase.storage.from(CASE_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadCaseAttachment(input: {
  caseId: string;
  adminId: string;
  file: File;
  caption: string;
}) {
  if (input.file.size > MAX_CASE_FILE_BYTES) {
    throw new Error("Files must be 15 MB or smaller");
  }
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${input.caseId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(CASE_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("case_attachments").insert({
    case_id: input.caseId,
    storage_path: path,
    file_name: input.file.name,
    file_type: input.file.type || "application/octet-stream",
    caption: input.caption,
    uploaded_by: input.adminId,
  });
  if (error) throw error;
}

export async function deleteCaseAttachment(attachment: CaseAttachment) {
  const { error } = await supabase.from("case_attachments").delete().eq("id", attachment.id);
  if (error) throw error;
  await supabase.storage.from(CASE_BUCKET).remove([attachment.storage_path]);
}

export const MAX_CASE_PROOF_FILES = 10;

export type CaseEvent = {
  id: string;
  case_id: string;
  status: string;
  note: string;
  created_at: string;
};

export async function fetchCaseEvents(caseId: string): Promise<CaseEvent[]> {
  const { data, error } = await supabase
    .from("case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaseEvent[];
}

/** Client-side upload of the proof photos attached while filing a case. */
export async function uploadCaseProofFiles(input: {
  caseId: string;
  userId: string;
  files: File[];
}) {
  const files = input.files.slice(0, MAX_CASE_PROOF_FILES);
  for (const file of files) {
    if (file.size > MAX_CASE_FILE_BYTES) {
      throw new Error(`${file.name} is larger than 15 MB`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${input.caseId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(CASE_BUCKET)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error } = await supabase.from("case_attachments").insert({
      case_id: input.caseId,
      storage_path: path,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      caption: "Uploaded by you",
      uploaded_by: input.userId,
    });
    if (error) throw error;
  }
}
