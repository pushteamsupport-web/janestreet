import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailOnlySchema } from "@/lib/validation";

export function EmailVerification({
  email: initialEmail = "",
  onBack,
}: {
  email?: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
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

  async function resend() {
    if (busy || cooldown > 0) return;
    setError("");
    setNotice("");
    const address = validatedEmail();
    if (!address) return;
    setBusy(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: `${window.location.origin}/verified` },
      });
      if (resendError) {
        setError("We couldn’t send another link. Please wait a minute and try again.");
        return;
      }
      setCooldown(60);
      setNotice("A new verification link was requested. Check your inbox and spam folder.");
    } catch {
      setError("We couldn’t send another link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
      <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-center text-xl font-semibold">Check your email</h1>
      <p className="mt-2 break-words text-center text-sm leading-relaxed text-muted-foreground">
        {initialEmail ? <>Click the verification link sent to <strong>{initialEmail}</strong> to confirm your account. Check your spam folder too.</> : "Enter your email address to request a new verification link."}
      </p>
      <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void resend(); }} noValidate>
        {!initialEmail && (
          <div>
            <Label htmlFor="verification-email" className="mb-1.5 block">Email address</Label>
            <Input id="verification-email" type="email" autoComplete="email" value={email} disabled={busy}
              onChange={(event) => setEmail(event.target.value)} />
          </div>
        )}
        {error && <p id="verification-error" role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <Button type="submit" variant="outline" className="w-full" disabled={busy || cooldown > 0}>
          {busy ? "Sending…" : cooldown > 0 ? `Resend link in ${cooldown}s` : "Resend verification link"}
        </Button>
      </form>
      <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={onBack}>Back to login</Button>
    </div>
  );
}