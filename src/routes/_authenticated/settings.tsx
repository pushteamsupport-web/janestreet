import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Lock, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientNav } from "@/components/ClientNav";
import { BackButton } from "@/components/BackButton";
import { PasswordInput } from "@/components/PasswordInput";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings & Security | Jane Street" },
      {
        name: "description",
        content:
          "Manage your Jane Street account and turn on Google Authenticator two-factor security.",
      },
      { property: "og:title", content: "Account Settings & Security" },
      {
        property: "og:description",
        content: "Turn on Google Authenticator two-factor security for your case file.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type Factor = { id: string; status: string; friendly_name?: string | null };

function SettingsPage() {
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

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

  const factorsQuery = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return (data.totp ?? []) as Factor[];
    },
  });

  const verified = (factorsQuery.data ?? []).filter((f) => f.status === "verified");

  async function startEnrolment() {
    setBusy(true);
    // Clean up any half-finished enrolment so the user never hits "factor already exists".
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) {
      if (factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not start setup");
      return;
    }
    setCode("");
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnrolment(event: React.FormEvent) {
    event.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("That code was not accepted. Check your Authenticator app and try again.");
      return;
    }
    toast.success("Two-factor security is on. You will be asked for a code at every new login.");
    setEnrolling(null);
    setCode("");
    await queryClient.invalidateQueries({ queryKey: ["mfa-factors"] });
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor security removed.");
    await queryClient.invalidateQueries({ queryKey: ["mfa-factors"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientNav
        name={profileQuery.data?.full_name ?? null}
        email={profileQuery.data?.email ?? null}
        showBack={false}
        minimal
      />

      <main className="mx-auto w-full max-w-xl overflow-x-hidden px-4 py-8">
        <BackButton className="-ml-2 mb-3" />
        <h1 className="text-2xl font-semibold">Settings &amp; security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Protect your case file with Google Authenticator.
        </p>

        <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-elevated">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Two-factor authentication (Authenticator app)</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Once this is on, every fresh login — and every new device — has to enter the
                six-digit code from your Google Authenticator app.
              </p>

              {factorsQuery.isLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">Checking your security…</p>
              ) : verified.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Authenticator is
                    active
                  </p>
                  {verified.map((factor) => (
                    <div
                      key={factor.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate">{factor.friendly_name || "Authenticator app"}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void removeFactor(factor.id)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : enrolling ? (
                <form onSubmit={confirmEnrolment} className="mt-4 space-y-4">
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. Open Google Authenticator on your phone.</li>
                    <li>2. Tap the plus button and scan this code.</li>
                    <li>3. Type the six-digit code it shows below.</li>
                  </ol>
                  <img
                    src={enrolling.qr}
                    alt="Scan this QR code with Google Authenticator"
                    className="h-44 w-44 rounded-lg border border-border bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Can&apos;t scan? Enter this key manually:{" "}
                    <code className="inline-block max-w-full break-all rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                      {enrolling.secret}
                    </code>
                  </p>
                  <div>
                    <Label className="mb-1.5 block text-sm">Six-digit code</Label>
                    <Input
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className="max-w-40 tracking-[0.35em]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy || code.length !== 6}>
                      Turn on two-factor
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setEnrolling(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button className="mt-4" disabled={busy} onClick={() => void startEnrolment()}>
                  <KeyRound className="mr-1.5 h-4 w-4" aria-hidden="true" /> Set up Google
                  Authenticator
                </Button>
              )}
            </div>
          </div>
        </section>

        <AccountForms currentEmail={profileQuery.data?.email ?? null} />
      </main>
    </div>
  );
}

function AccountForms({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    const next = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setEmailBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail("");
    toast.success("Check your new inbox — we sent a link to confirm the change.");
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Those passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    const { error } = await supabase.auth.updateUser({
      password,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    setPasswordBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    toast.success("Password updated.");
  }

  return (
    <>
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-elevated">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Change your email</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Currently {currentEmail || "—"}. We email a confirmation link to the new address.
            </p>
            <form onSubmit={changeEmail} className="mt-4 space-y-3">
              <div>
                <Label className="mb-1.5 block text-sm">New email address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="max-w-sm"
                />
              </div>
              <Button type="submit" disabled={emailBusy || !email.trim()}>
                {emailBusy ? "Sending…" : "Update email"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-elevated">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Change your password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose something at least 8 characters long that you do not use anywhere else.
            </p>
            <form onSubmit={changePassword} className="mt-4 space-y-3">
              <div>
                <Label className="mb-1.5 block text-sm">Current password</Label>
                <PasswordInput
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                  className="max-w-sm"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">New password</Label>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  className="max-w-sm"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Confirm new password</Label>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  className="max-w-sm"
                />
              </div>
              <Button type="submit" disabled={passwordBusy || !password || !confirm}>
                {passwordBusy ? "Saving…" : "Update password"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
