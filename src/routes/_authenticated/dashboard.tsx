import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  FileText,
  FolderOpen,
  Home,
  Hourglass,
  PartyPopper,
  ShieldPlus,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ClientNav } from "@/components/ClientNav";
import { CaseProof } from "@/components/CaseProof";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CASE_STATUS_LABELS, MAX_CASE_PROOF_FILES, uploadCaseProofFiles } from "@/lib/cases";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { caseSchema } from "@/lib/validation";

const searchSchema = z.object({
  tab: z.enum(["cases", "new", "profile"]).default("cases"),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your Case Dashboard | Jane Street" },
      {
        name: "description",
        content: "Track your recovery cases and update your details in one secure place.",
      },
      { property: "og:title", content: "Your Case Dashboard" },
      {
        property: "og:description",
        content: "Track your recovery cases in one secure place.",
      },
    ],
  }),
  component: Dashboard,
});

const ASSET_TYPES = ["Bitcoin (BTC)", "Ethereum (ETH)", "USDT", "Bank transfer", "Other"] as const;

const STATUS_LABELS = CASE_STATUS_LABELS;

type CaseItem = {
  id: string;
  case_number: number | string | null;
  title: string;
  asset_type: string;
  amount_lost: number;
  amount_recovered: number;
  status: string;
  description: string;
  admin_note: string;
  created_at: string;
};

function money(value: number | string | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Dashboard() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assetType, setAssetType] = useState<string>("Bitcoin (BTC)");
  const [proofFiles, setProofFiles] = useState<File[]>([]);

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

  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createCase = useMutation({
    mutationFn: async (values: {
      title: string;
      amountLost: number;
      assetType: string;
      description: string;
      files: File[];
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("You are signed out");
      const { data: created, error } = await supabase
        .from("cases")
        .insert({
          user_id: auth.user.id,
          title: values.title,
          amount_lost: values.amountLost,
          asset_type: values.assetType,
          description: values.description,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (values.files.length > 0 && created) {
        await uploadCaseProofFiles({
          caseId: created.id,
          userId: auth.user.id,
          files: values.files,
        });
      }
    },
    onSuccess: () => {
      toast.success("Case submitted. Our team will review it shortly.");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      navigate({ to: "/dashboard", search: { tab: "cases" }, replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleCreateCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = caseSchema.safeParse({
      title: form.get("title"),
      amountLost: form.get("amountLost"),
      assetType: form.get("assetType"),
      description: form.get("description"),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    createCase.mutate({
      title: parsed.data.title,
      amountLost: parsed.data.amountLost,
      assetType: parsed.data.assetType,
      description: parsed.data.description,
      files: proofFiles,
    });
    setProofFiles([]);
    event.currentTarget.reset();
  }

  const cases = (casesQuery.data ?? []) as CaseItem[];
  const recoveredCases = cases.filter((c) => c.status === "recovered");
  const totals = {
    active: cases.filter((c) => c.status !== "closed").length,
    review: cases.filter((c) => c.status === "under_review").length,
    recovery: cases.filter((c) => c.status === "investigating").length,
    recovered: cases.reduce((sum, c) => sum + Number(c.amount_recovered ?? 0), 0),
  };

  const firstName = (profileQuery.data?.full_name ?? "").split(" ")[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <ClientNav
        name={profileQuery.data?.full_name ?? null}
        email={profileQuery.data?.email ?? null}
        showBack={false}
      />

      <main className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome{firstName ? `, ${firstName}` : ""}
          </h1>
          <BadgeCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Here’s your case overview for today</p>

        {recoveredCases.length > 0 ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/40 bg-secondary p-4">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-relaxed">
              Congratulations — your recovery is complete. Open the case below to see the proof from
              our recovery team.
            </p>
          </div>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(next) =>
            navigate({
              to: "/dashboard",
              search: { tab: next as "cases" | "new" | "profile" },
              replace: true,
            })
          }
          className="mt-5"
        >
          <TabsContent value="cases" className="mt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={FileText} label="Active cases" value={String(totals.active)} />
              <Stat icon={Hourglass} label="Under review" value={String(totals.review)} />
              <Stat icon={ShieldPlus} label="In recovery" value={String(totals.recovery)} />
              <Stat icon={BadgeCheck} label="Total recovered" value={money(totals.recovered)} />
            </div>

            <div className="mt-7 flex items-center justify-between">
              <h2 className="text-xl font-bold">Your cases</h2>
              <Link
                to="/dashboard"
                search={{ tab: "new" }}
                className="flex items-center gap-1 text-sm font-medium text-primary"
              >
                File a case <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-3">
              {casesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading your cases…</p>
              ) : cases.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center">
                  <FolderOpen className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No cases yet. File your first case to get started.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cases.map((item) => (
                    <CaseCard key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-0">
            <form
              onSubmit={handleCreateCase}
              className="space-y-4 rounded-xl border border-border bg-card p-5"
            >
              <div>
                <Label className="mb-1.5 block text-sm">Case title</Label>
                <Input name="title" placeholder="e.g. Investment platform fraud" />
                {errors["title"] && (
                  <p className="mt-1.5 text-xs text-destructive">{errors["title"]}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-sm">Amount lost (USD)</Label>
                  <Input name="amountLost" type="number" min="0" step="any" placeholder="5000" />
                  {errors["amountLost"] && (
                    <p className="mt-1.5 text-xs text-destructive">{errors["amountLost"]}</p>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Asset type</Label>
                  <Select name="assetType" value={assetType} onValueChange={setAssetType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">
                  Upload proof (up to {MAX_CASE_PROOF_FILES} photos)
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? []);
                    if (picked.length > MAX_CASE_PROOF_FILES) {
                      toast.error(`You can upload up to ${MAX_CASE_PROOF_FILES} photos`);
                    }
                    setProofFiles(picked.slice(0, MAX_CASE_PROOF_FILES));
                  }}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {proofFiles.length > 0
                    ? `${proofFiles.length} photo${proofFiles.length === 1 ? "" : "s"} selected`
                    : "One photo is fine — add more if you have them."}
                </p>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">What happened?</Label>
                <Textarea
                  name="description"
                  rows={5}
                  placeholder="Describe how the funds were lost, dates, platforms and any contact details of the parties involved."
                />
                {errors["description"] && (
                  <p className="mt-1.5 text-xs text-destructive">{errors["description"]}</p>
                )}
              </div>
              <Button type="submit" disabled={createCase.isPending}>
                {createCase.isPending ? "Submitting…" : "Submit case"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
              <Row label="Full name" value={profileQuery.data?.full_name || "—"} />
              <Row label="Email" value={profileQuery.data?.email || "—"} />
              <Row label="Phone" value={profileQuery.data?.phone || "—"} />
            </div>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/settings">Settings &amp; security</Link>
            </Button>
          </TabsContent>
        </Tabs>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-2">
          <BottomItem
            icon={Home}
            label="Home"
            active={tab === "cases"}
            onClick={() => navigate({ to: "/dashboard", search: { tab: "cases" } })}
          />
          <BottomItem
            icon={FileText}
            label="File case"
            active={tab === "new"}
            onClick={() => navigate({ to: "/dashboard", search: { tab: "new" } })}
          />
          <BottomItem
            icon={User}
            label="Profile"
            active={tab === "profile"}
            onClick={() => navigate({ to: "/dashboard", search: { tab: "profile" } })}
          />
        </div>
      </nav>
    </div>
  );
}

function BottomItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-16 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Home;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elevated">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CaseCard({ item }: { item: CaseItem }) {
  const isRecovered = item.status === "recovered";
  const toRecover = Number(item.amount_recovered ?? 0);

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
      <Link
        to="/cases/$caseId"
        params={{ caseId: item.id }}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary">
          <CreditCard className="h-6 w-6 text-primary" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-bold">{item.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.asset_type} ·{" "}
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </span>
        <span
          className={
            isRecovered
              ? "shrink-0 rounded-2xl bg-success px-3 py-1.5 text-center text-xs font-semibold leading-tight text-success-foreground"
              : "shrink-0 rounded-2xl bg-secondary px-3 py-1.5 text-center text-xs font-semibold leading-tight text-secondary-foreground"
          }
        >
          <span className="block">{STATUS_LABELS[item.status] ?? item.status}</span>
          <span className="block text-sm font-bold">
            {toRecover > 0 ? money(toRecover) : money(item.amount_lost)}
          </span>
        </span>
      </Link>
    </li>
  );
}

