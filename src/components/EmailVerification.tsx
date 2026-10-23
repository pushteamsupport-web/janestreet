import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailOnlySchema } from "@/lib/validation";

export function EmailVerification({
  email: initialEmail = "",
  onVerified,
  onBack,
}: {
  email?: string;
  onVerified: () => Promise<void> | void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(initialEmail ? 60 : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function validatedEmail() {
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return null;
    }
    return parsed.data.email;
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    const address = validatedEmail();
    if (!address) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: address,
        token: code,
        type: "signup",
      });
      if (verifyError || !data.session) {
        setError("That code is invalid or expired. Try again or request a new code.");
        return;
      }
      await onVerified();
    } catch {
      setError("We couldn’t check your code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || cooldown > 0) return;
    setError("");
    setNotice("");
    const address = validatedEmail();
    if (!address) return;
    setBusy(true);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email: address });
      if (resendError) {
        setError("We couldn’t send another code. Please wait a minute and try again.");
        return;
      }
      setCode("");
      setCooldown(60);
      setNotice("A new code was requested. Check your inbox and spam folder.");
    } catch {
      setError("We couldn’t send another code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
      <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-center text-xl font-semibold">Verify your email</h1>
      <p className="mt-2 break-words text-center text-sm leading-relaxed text-muted-foreground">
        {initialEmail ? <>Enter the six-digit code sent to <strong>{initialEmail}</strong>.</> : "Enter your email address and the six-digit verification code."}
      </p>
      <form className="mt-6 space-y-4" onSubmit={verify} noValidate>
        {!initialEmail && (
          <div>
            <Label htmlFor="verification-email" className="mb-1.5 block">Email address</Label>
            <Input id="verification-email" type="email" autoComplete="email" value={email} disabled={busy}
              onChange={(event) => setEmail(event.target.value)} />
          </div>
        )}
        <div>
          <Label htmlFor="email-verification-code" className="mb-1.5 block">Six-digit email code</Label>
          <Input id="email-verification-code" value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
            disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? "verification-error" : undefined}
            className="h-12 text-center text-lg" />
        </div>
        {error && <p id="verification-error" role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Verify and continue"}</Button>
      </form>
      <Button variant="outline" className="mt-3 w-full" disabled={busy || cooldown > 0} onClick={() => void resend()}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </Button>
      <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={onBack}>Back to login</Button>
    </div>
  );
}
