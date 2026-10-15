import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Bell,
  CheckCircle2,
  ChevronLeft,

  CreditCard,
  Download,
  Folder,
  Headphones,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Paperclip,
  Search,
  Settings,
  Trash2,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/components/BrandMark";
import { ChatThread } from "@/components/chat/ChatThread";
import { CaseProof } from "@/components/CaseProof";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  deleteCaseAttachment,
  fetchCaseAttachments,
  uploadCaseAttachment,
} from "@/lib/cases";
import { fetchMessages, markRead, sendChatMessage, type ChatMessage } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console | Jane Street" },
      {
        name: "description",
        content: "Review client cases, publish recovery proof and answer support chats.",
      },
      { property: "og:title", content: "Admin Console" },
      { property: "og:description", content: "Manage Jane Street client cases and support chats." },
    ],
  }),
  component: AdminPage,
});

type CaseRow = {
  id: string;
  case_number: number | string | null;
  user_id: string;
  title: string;
  amount_lost: number;
  asset_type: string;
  wallet_address: string | null;
  transaction_reference: string | null;
  description: string;
  status: string;
  amount_recovered: number;
  admin_note: string;
  created_at: string;
  resolved_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  blocked: boolean;
};

function AdminPage() {
  const navigate = useNavigate();
  const { role, isAdmin, loading: roleLoading } = useRole();

  useEffect(() => {
    // Only bounce when we positively know this account is not an admin.
    if (!roleLoading && role !== null && role !== "admin") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [role, roleLoading, navigate]);

  const profilesQuery = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, blocked")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
    enabled: isAdmin,
  });

  const casesQuery = useQuery({
    queryKey: ["admin-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CaseRow[];
    },
    enabled: isAdmin,
  });

  const me = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
  });

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking your access…</p>
      </div>
    );
  }

  const cases = casesQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const recovered = cases.reduce((sum, item) => sum + Number(item.amount_recovered ?? 0), 0);

  return (
    <AdminShell
      name={me.data?.full_name ?? null}
      email={me.data?.email ?? null}
      cases={cases}
      profiles={profiles}
      recovered={recovered}
      casesLoading={casesQuery.isLoading}
    />
  );
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: User },
  { key: "cases", label: "All Cases", icon: Folder },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "support", label: "Support Tickets", icon: Headphones },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

function initialsOf(value: string | null) {
  if (!value) return "AD";
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AD";
}

function AdminShell({
  name,
  email,
  cases,
  profiles,
  recovered,
  casesLoading,
}: {
  name: string | null;
  email: string | null;
  cases: CaseRow[];
  profiles: ProfileRow[];
  recovered: number;
  casesLoading: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<NavKey>("dashboard");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openClientId, setOpenClientId] = useState<string | null>(null);


  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const assetTypes = useMemo(
    () => Array.from(new Set(cases.map((c) => c.asset_type).filter(Boolean))),
    [cases],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((item) => {
      const owner = profiles.find((p) => p.id === item.user_id);
      const matchQ =
        !q ||
        String(item.case_number ?? "").includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (owner?.full_name ?? "").toLowerCase().includes(q) ||
        (owner?.email ?? "").toLowerCase().includes(q);
      const matchType = typeFilter === "all" || item.asset_type === typeFilter;
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchQ && matchType && matchStatus;
    });
  }, [cases, profiles, search, typeFilter, statusFilter]);

  const filtersActive = search.trim() !== "" || typeFilter !== "all" || statusFilter !== "all";

  // Cases are grouped under the client that filed them. The admin opens a client
  // to reveal that client's case list.
  const clientGroups = useMemo(() => {
    const groups = profiles.map((profile) => ({
      id: profile.id,
      profile,
      cases: filtered.filter((item) => item.user_id === profile.id),
    }));

    const orphanCases = filtered.filter((item) => !profiles.some((p) => p.id === item.user_id));
    if (orphanCases.length > 0) {
      groups.push({
        id: "unknown",
        profile: {
          id: "unknown",
          full_name: "Unknown client",
          email: "—",
          phone: "",
          blocked: false,
        },
        cases: orphanCases,
      });
    }

    const visible = filtersActive ? groups.filter((group) => group.cases.length > 0) : groups;
    return visible.sort((a, b) => b.cases.length - a.cases.length);
  }, [filtered, profiles, filtersActive]);

  const openGroup = clientGroups.find((group) => group.id === openClientId) ?? null;

  useEffect(() => {
    setOpenClientId(null);
  }, [section]);


  function exportCsv() {
    const rows = [
      ["Case ID", "Client", "Type", "Amount lost", "Recovered", "Status"],
      ...filtered.map((item) => {
        const owner = profiles.find((p) => p.id === item.user_id);
        return [
          `CASE-${item.case_number ?? ""}`,
          owner?.full_name ?? "",
          item.asset_type,
          String(item.amount_lost),
          String(item.amount_recovered),
          CASE_STATUS_LABELS[item.status] ?? item.status,
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-cases.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-secondary">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark size="sm" className="min-w-0 [&>span:last-child]:truncate" />
            <span className="hidden text-xl font-display font-extrabold tracking-tight sm:inline">
              Admin
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <NotificationBell profiles={profiles} onOpenSupport={() => setSection("support")} />
            <button
              type="button"
              aria-label="Help"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex items-center gap-2 rounded-full p-0.5 hover:bg-secondary"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">
                    {initialsOf(name)}
                  </span>
                  <span className="hidden max-w-[10rem] truncate pr-2 text-sm font-semibold md:inline">
                    {name || email || "Admin User"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {name || "Admin User"}
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {email ?? ""}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSection("settings")}>
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    void handleSignOut();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-0 lg:gap-5 lg:p-5">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-56 shrink-0 flex-col justify-between rounded-2xl border border-sidebar-border bg-sidebar p-3 lg:flex">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  section === item.key
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
          <p className="px-3 pb-1 pt-6 text-[11px] text-muted-foreground">v2.4.1 · Jane Street</p>
        </aside>

        {/* Mobile nav */}
        <nav className="-mx-0 flex gap-2 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                section === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-5 lg:pl-[15.75rem]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h1 className="min-w-0 truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {section === "support"
              ? "Support Tickets"
              : section === "users"
                ? "Users"
                : section === "settings"
                  ? "Settings"
                  : openGroup
                    ? openGroup.profile.full_name || "Client cases"
                    : section === "payments"
                      ? "Payments by Client"
                      : "Clients & Cases"}

          </h1>
          <Button size="sm" className="shrink-0 gap-1.5" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>

        {(section === "dashboard" || section === "cases" || section === "payments") && (
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cases by ID, client name…"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[10rem]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Filter: All Types</SelectItem>
                {assetTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[11rem]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All Statuses</SelectItem>
                {CASE_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CASE_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {section !== "settings" && section !== "support" && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total Users" value={String(profiles.length)} tone="primary" />
            <Stat
              label="Pending Cases"
              value={String(cases.filter((c) => c.status !== "recovered").length)}
              tone="warning"
            />
            <Stat
              label="In Recovery"
              value={String(cases.filter((c) => c.status === "in_recovery").length)}
              tone="primary"
            />
            <Stat
              label="Total Recovered"
              value={`$${recovered.toLocaleString()}`}
              tone="success"
            />
          </div>
        )}

        {(section === "dashboard" || section === "cases" || section === "payments") &&
          (casesLoading ? (
            <p className="mt-5 text-sm text-muted-foreground">Loading cases…</p>
          ) : openGroup ? (
            <div className="mt-5 space-y-4">
              <ClientHeader group={openGroup} onBack={() => setOpenClientId(null)} />

              {openGroup.cases.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                  This client has no cases yet.
                </p>
              ) : section === "cases" ? (
                openGroup.cases.map((item) => (
                  <AdminCaseCard key={item.id} caseRow={item} owner={openGroup.profile} />
                ))
              ) : section === "payments" ? (
                <div className="rounded-2xl border border-border bg-card">
                  <ul className="divide-y divide-border">
                    {openGroup.cases.map((item) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            CASE-{item.case_number ?? "—"} · {item.asset_type}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-success">
                          ${Number(item.amount_recovered).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card">
                  {/* Table on wide screens */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Case ID</th>
                          <th className="px-4 py-2.5 font-semibold">Title</th>
                          <th className="px-4 py-2.5 font-semibold">Type</th>
                          <th className="px-4 py-2.5 font-semibold">Amount</th>
                          <th className="px-4 py-2.5 font-semibold">Filed</th>
                          <th className="px-4 py-2.5 font-semibold">Resolved</th>
                          <th className="px-4 py-2.5 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openGroup.cases.map((item) => (
                          <tr key={item.id} className="border-t border-border">
                            <td className="px-4 py-3 font-semibold text-primary">
                              CASE-{item.case_number ?? "—"}
                            </td>
                            <td className="max-w-[16rem] truncate px-4 py-3">{item.title}</td>
                            <td className="px-4 py-3">{item.asset_type}</td>
                            <td className="px-4 py-3 font-semibold">
                              ${Number(item.amount_lost).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {item.resolved_at
                                ? new Date(item.resolved_at).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={item.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards on mobile */}
                  <ul className="divide-y divide-border md:hidden">
                    {openGroup.cases.map((item) => (
                      <li key={item.id} className="grid gap-1.5 p-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                          <span className="truncate text-sm font-bold text-primary">
                            CASE-{item.case_number ?? "—"}
                          </span>
                          <StatusPill status={item.status} />
                        </div>
                        <p className="truncate text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.asset_type} · ${Number(item.amount_lost).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Filed {new Date(item.created_at).toLocaleDateString()} · Resolved{" "}
                          {item.resolved_at
                            ? new Date(item.resolved_at).toLocaleDateString()
                            : "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-border bg-card">
              <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
                {clientGroups.length} client{clientGroups.length === 1 ? "" : "s"} · {filtered.length}{" "}
                of {cases.length} cases. Tap a client to open their cases.
              </p>
              {clientGroups.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No clients match your filters.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {clientGroups.map((group) => (
                    <li key={group.id}>
                      <button
                        type="button"
                        onClick={() => setOpenClientId(group.id)}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-secondary"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">
                            {initialsOf(group.profile.full_name)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">
                                {group.profile.full_name || "Unnamed client"}
                              </span>
                              {group.profile.blocked && (
                                <span className="shrink-0 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                                  Blocked
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {group.profile.email}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold">
                            {group.cases.length} case{group.cases.length === 1 ? "" : "s"}
                          </span>
                          <span className="block text-xs text-success">
                            $
                            {group.cases
                              .reduce((sum, item) => sum + Number(item.amount_recovered ?? 0), 0)
                              .toLocaleString()}{" "}
                            recovered
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}


        {section === "users" && (
          <ul className="mt-5 space-y-2">
            {profiles.length === 0 && (
              <li className="text-sm text-muted-foreground">No clients yet.</li>
            )}
            {profiles.map((profile) => (
              <UserRow
                key={profile.id}
                profile={profile}
                onOpenCases={() => {
                  // Jump straight into this client's cases.
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setOpenClientId(profile.id);
                  setSection("cases");
                }}
              />
            ))}
          </ul>
        )}

        {section === "support" && (
          <div className="mt-5">
            <AdminChats profiles={profiles} />
          </div>
        )}

        {section === "settings" && (
          <p className="mt-5 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Account settings live on the Settings &amp; Security page.
          </p>
        )}
      </main>
    </div>
  );
}

function NotificationBell({
  profiles,
  onOpenSupport,
}: {
  profiles: ProfileRow[];
  onOpenSupport: () => void;
}) {
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ["admin-unread"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, body, created_at, conversations(client_id)")
        .eq("sender_role", "client")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        conversation_id: string;
        body: string;
        created_at: string;
        conversations: { client_id: string } | null;
      }>;
    },
    staleTime: 15_000,
  });

  const unread = unreadQuery.data ?? [];
  const count = unread.length;

  useEffect(() => {
    const channel = supabase
      .channel("admin-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { sender_role?: string; body?: string };
          if (row.sender_role !== "client") return;
          toast.message("New client message", { description: row.body || "Attachment received" });
          void queryClient.invalidateQueries({ queryKey: ["admin-unread"] });
        },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-unread"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
          className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          {count > 0 ? `${count} unread client message${count > 1 ? "s" : ""}` : "No new messages"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {unread.slice(0, 6).map((message) => {
          const owner = profiles.find((p) => p.id === message.conversations?.client_id);
          return (
            <DropdownMenuItem key={message.id} onSelect={onOpenSupport} className="flex-col items-start gap-0.5">
              <span className="w-full truncate text-xs font-semibold">
                {owner?.full_name || owner?.email || "Client"}
              </span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {message.body || "Sent an attachment"}
              </span>
            </DropdownMenuItem>
          );
        })}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenSupport}>Open support tickets</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClientHeader({
  group,
  onBack,
}: {
  group: { profile: ProfileRow; cases: CaseRow[] };
  onBack: () => void;
}) {
  const lost = group.cases.reduce((sum, item) => sum + Number(item.amount_lost ?? 0), 0);
  const recovered = group.cases.reduce(
    (sum, item) => sum + Number(item.amount_recovered ?? 0),
    0,
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onBack}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All clients
      </Button>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary">
          {initialsOf(group.profile.full_name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-extrabold tracking-tight">
            {group.profile.full_name || "Unnamed client"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {group.profile.email}
            {group.profile.phone ? ` · ${group.profile.phone}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {group.cases.length} case{group.cases.length === 1 ? "" : "s"} · $
        {lost.toLocaleString()} lost · ${recovered.toLocaleString()} recovered
      </p>
    </div>
  );
}

function UserRow({
  profile,
  onOpenCases,
}: {
  profile: ProfileRow;
  onOpenCases: () => void;
}) {

  const queryClient = useQueryClient();

  const toggleBlock = useMutation({
    mutationFn: async () => {
      const next = !profile.blocked;
      const { error } = await supabase
        .from("profiles")
        .update({ blocked: next })
        .eq("id", profile.id);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      toast.success(next ? "User blocked." : "User unblocked.");
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium">
          <button
            type="button"
            onClick={onOpenCases}
            aria-label={`Open cases for ${profile.full_name || profile.email || "client"}`}
            className="truncate rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {profile.full_name || "Unnamed client"}
          </button>
          {profile.blocked && (
            <span className="shrink-0 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
              Blocked
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {profile.email} · {profile.phone || "no phone"}
        </p>
      </div>
      <Button
        size="sm"
        variant={profile.blocked ? "outline" : "destructive"}
        className="shrink-0"
        onClick={() => toggleBlock.mutate()}
        disabled={toggleBlock.isPending}
      >
        {profile.blocked ? (
          <>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Unblock
          </>
        ) : (
          <>
            <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" /> Block
          </>
        )}
      </Button>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "recovered"
      ? "bg-success/15 text-success"
      : status === "in_recovery"
        ? "bg-accent text-accent-foreground"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {CASE_STATUS_LABELS[status] ?? status}
    </span>
  );
}


function AdminCaseCard({ caseRow, owner }: { caseRow: CaseRow; owner: ProfileRow | null }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState(caseRow.status);
  const [amount, setAmount] = useState(String(caseRow.amount_recovered ?? 0));
  const [note, setNote] = useState(caseRow.admin_note ?? "");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const attachmentsQuery = useQuery({
    queryKey: ["case-attachments", caseRow.id],
    queryFn: () => fetchCaseAttachments(caseRow.id),
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cases")
        .update({
          status,
          amount_recovered: Number(amount) || 0,
          admin_note: note,
        })
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Case updated. The client sees this straight away.");
      await queryClient.invalidateQueries({ queryKey: ["admin-cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelCase = useMutation({
    mutationFn: async (nextStatus: string) => {
      const { error } = await supabase
        .from("cases")
        .update({ status: nextStatus })
        .eq("id", caseRow.id);
      if (error) throw error;
      return nextStatus;
    },
    onSuccess: async (nextStatus) => {
      setStatus(nextStatus);
      toast.success(nextStatus === "cancelled" ? "Case cancelled." : "Case reopened.");
      await queryClient.invalidateQueries({ queryKey: ["admin-cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a screenshot first");
      if (!user) throw new Error("You are signed out");
      await uploadCaseAttachment({
        caseId: caseRow.id,
        adminId: user.id,
        file,
        caption: caption.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Payment proof uploaded.");
      setFile(null);
      setCaption("");
      await queryClient.invalidateQueries({ queryKey: ["case-attachments", caseRow.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteCaseAttachment,
    onSuccess: async () => {
      toast.success("Payment proof removed.");
      await queryClient.invalidateQueries({ queryKey: ["case-attachments", caseRow.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-elevated">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{caseRow.title}</h2>
          <p className="text-xs font-medium text-primary">Case #{caseRow.case_number ?? "—"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {owner?.full_name || "Unknown client"} · {owner?.email ?? "—"} · {caseRow.asset_type} ·
            ${Number(caseRow.amount_lost).toLocaleString()} lost
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Filed on{" "}
            {new Date(caseRow.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · Fully resolved{" "}
            {caseRow.resolved_at
              ? new Date(caseRow.resolved_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "— not yet resolved"}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
          {CASE_STATUS_LABELS[caseRow.status] ?? caseRow.status}
        </span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{caseRow.description}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-sm">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CASE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CASE_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Amount recovered (USD)</Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <Label className="mb-1.5 block text-sm">Note to the client</Label>
        <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save case update"}
        </Button>
        {caseRow.status === "cancelled" ? (
          <Button
            variant="outline"
            onClick={() => cancelCase.mutate("under_review")}
            disabled={cancelCase.isPending}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reopen case
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => cancelCase.mutate("cancelled")}
            disabled={cancelCase.isPending}
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {cancelCase.isPending ? "Working…" : "Cancel case"}
          </Button>
        )}
      </div>


      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">Payment proof</h3>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`proof-${caseRow.id}`}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Button asChild variant="outline" size="sm">
              <label htmlFor={`proof-${caseRow.id}`} className="cursor-pointer">
                <Paperclip className="mr-1.5 h-4 w-4" aria-hidden="true" /> Choose file
              </label>
            </Button>
            <span className="text-xs text-muted-foreground">{file?.name ?? "No file chosen"}</span>
          </div>
          <Input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Caption shown to the client, e.g. Payment sent to your bank account"
          />
          <Button size="sm" onClick={() => upload.mutate()} disabled={upload.isPending || !file}>
            {upload.isPending ? "Uploading…" : "Upload payment proof"}
          </Button>
        </div>

        <ul className="mt-4 space-y-2">
          {(attachmentsQuery.data ?? []).map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs"
            >
              <span className="min-w-0 flex-1 truncate">
                {attachment.caption || attachment.file_name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete payment proof"
                onClick={() => remove.mutate(attachment)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <CaseProof caseId={caseRow.id} />
        </div>
      </div>
    </section>
  );
}

function AdminChats({ profiles }: { profiles: ProfileRow[] }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const conversationsQuery = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, client_id, last_message_at")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const conversations = conversationsQuery.data ?? [];
  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null,
    [conversations, activeId],
  );

  const messagesQuery = useQuery({
    queryKey: ["messages", active?.id],
    queryFn: () => fetchMessages(active!.id),
    enabled: Boolean(active?.id),
  });

  useEffect(() => {
    if (!active?.id) return;
    const channel = supabase
      .channel(`admin-chat-${active.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${active.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", active.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active?.id, queryClient]);

  useEffect(() => {
    if (active?.id) void markRead(active.id, "client");
  }, [active?.id, messagesQuery.data]);

  const messages = (messagesQuery.data ?? []) as ChatMessage[];

  async function handleSend(body: string, file: File | null) {
    if (!active || !user) return;
    setSending(true);
    try {
      await sendChatMessage({
        conversationId: active.id,
        senderId: user.id,
        senderRole: "admin",
        clientId: active.client_id,
        body,
        file,
      });
      await queryClient.invalidateQueries({ queryKey: ["messages", active.id] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (conversationsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading conversations…</p>;
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Users className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">
          No client has started a chat yet. Threads appear here as soon as they do.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <ul className="space-y-1.5">
        {conversations.map((conversation) => {
          const owner = profiles.find((p) => p.id === conversation.client_id);
          const isActive = conversation.id === active?.id;
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => setActiveId(conversation.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  isActive ? "border-primary bg-secondary" : "border-border bg-card"
                }`}
              >
                <span className="block truncate font-medium">
                  {owner?.full_name || "Client"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {owner?.email ?? conversation.client_id}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex h-[28rem] min-h-0 flex-col rounded-xl border border-border bg-card">
        <ChatThread
          messages={messages}
          viewerRole="admin"
          loading={messagesQuery.isLoading}
          sending={sending}
          onSend={handleSend}
          emptyHint="No messages in this thread yet."
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: string;
  tone?: "primary" | "warning" | "success";
}) {
  const dot =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-accent text-primary";
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${dot}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
        </span>
        <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 truncate font-display text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
