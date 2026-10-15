import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ClientNav } from "@/components/ClientNav";
import { BackButton } from "@/components/BackButton";
import { CaseProof } from "@/components/CaseProof";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CASE_STATUS_LABELS } from "@/lib/cases";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case Details | Jane Street" },
      {
        name: "description",
        content: "View the full details, progress and recovery proof for your case.",
      },
      { property: "og:title", content: "Case Details | Jane Street" },
      {
        property: "og:description",
        content: "View the full details, progress and recovery proof for your case.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaseDetail,
});

function money(value: number | string | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CaseDetail() {
  const { caseId } = Route.useParams();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const item = caseQuery.data;
  const isRecovered = item?.status === "recovered";
  const toRecover = Number(item?.amount_recovered ?? 0);

  return (
    <div className="min-h-screen bg-background pb-16">
      <ClientNav
        name={profileQuery.data?.full_name ?? null}
        email={profileQuery.data?.email ?? null}
        showBack={false}
        minimal
      />

      <main className="mx-auto max-w-3xl px-5 py-6">
        <BackButton className="-ml-2 mb-3" />

        {caseQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading case…</p>
        ) : !item ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              This case could not be found. It may have been removed.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard" search={{ tab: "cases" }}>
                Back to dashboard
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary">
                <CreditCard className="h-6 w-6 text-primary" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight">{item.title}</h1>
                <p className="truncate text-xs text-muted-foreground">
                  {item.asset_type} ·{" "}
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-elevated">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">Amount you filed</p>
                  <p className="mt-1 text-lg font-bold text-primary">{money(item.amount_lost)}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">
                    {isRecovered ? "Amount recovered" : "Amount to recover"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-primary">
                    {toRecover > 0 ? money(toRecover) : "Pending"}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>

              <div className="space-y-2 text-sm">
                <Row label="Status" value={CASE_STATUS_LABELS[item.status] ?? item.status} />
                <Row label="Case number" value={`#${item.case_number ?? "—"}`} />
                <Row label="Filed on" value={new Date(item.created_at).toLocaleDateString()} />
                <Row
                  label="Fully resolved on"
                  value={
                    item.resolved_at
                      ? new Date(item.resolved_at).toLocaleDateString()
                      : "Not resolved yet"
                  }
                />
              </div>

              {item.admin_note ? (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    NOTE
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{item.admin_note}</p>
                </div>
              ) : null}

              <div>
                <h2 className="text-sm font-semibold">Case progress</h2>
                <div className="mt-3">
                  <CaseTimeline caseId={item.id} status={item.status} />
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold">PROOF OF FUNDS RECOVERY</h2>
                <div className="mt-3">
                  <CaseProof caseId={item.id} />
                </div>
              </div>
            </div>

            <Button asChild variant="outline" className="mt-5">
              <Link to="/dashboard" search={{ tab: "cases" }}>
                Back to your cases
              </Link>
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
