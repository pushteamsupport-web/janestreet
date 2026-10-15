import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type LegalSlug = "privacy" | "terms";

export const LEGAL_DEFAULT_TITLES: Record<LegalSlug, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

export function legalPageQuery(slug: LegalSlug) {
  return {
    queryKey: ["legal-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("slug, title, body, updated_at")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const { data, isLoading } = useQuery(legalPageQuery(slug));
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-5 py-3">
          <BackButton />
          <Link to="/" className="flex items-center">
            <BrandMark />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <h1 className="text-2xl font-semibold">{data?.title || LEGAL_DEFAULT_TITLES[slug]}</h1>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {data?.body || "Welcome"}
          </div>
        )}
      </main>
    </div>
  );
}

export function LegalEditor({ slug }: { slug: LegalSlug }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(legalPageQuery(slug));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setBody(data.body);
    }
  }, [data]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("legal_pages")
      .update({ title: title.trim() || LEGAL_DEFAULT_TITLES[slug], body, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${LEGAL_DEFAULT_TITLES[slug]} saved.`);
    await queryClient.invalidateQueries({ queryKey: ["legal-page", slug] });
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-elevated">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{LEGAL_DEFAULT_TITLES[slug]} page</h2>
        <Link to={slug === "privacy" ? "/privacy" : "/terms"} className="text-xs text-primary underline">
          View page
        </Link>
      </div>
      <div>
        <Label className="mb-1.5 block text-sm">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label className="mb-1.5 block text-sm">Text</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
