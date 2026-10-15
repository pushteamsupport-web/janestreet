import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { MailCheck, ShieldCheck } from "lucide-react";
import { fetchMyRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { PasswordInput } from "@/components/PasswordInput";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_CODES, signInSchema, signUpSchema } from "@/lib/validation";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Login or Create Account | Jane Street" },
      {
        name: "description",
        content:
          "Sign in to your Jane Street account or create a verified account to file a case.",
      },
      { property: "og:title", content: "Login or Create Account" },
      {
        property: "og:description",
        content: "Secure access to your Jane Street case file.",
      },
    ],
  }),
  component: AuthPage,
});

type Errors = Record<string, string>;

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [challengeFactorId, setChallengeFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);


  /** Sends the signed-in user to their home screen: admins land on the admin console. */
  const goHome = useCallback(async () => {
    const role = await fetchMyRole().catch(() => null);
    navigate({ to: role === "admin" ? "/admin" : "/dashboard", replace: true });
  }, [navigate]);

  /**
   * After a correct password we ask for the six-digit Authenticator code whenever the
   * account has two-factor turned on. Only then do we let the session into the app.
   */
  const continueAfterPassword = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      await goHome();
      return;
    }
    if (data.nextLevel === "aal2" && data.nextLevel !== data.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = (factors?.totp ?? []).find((item) => item.status === "verified");
      if (factor) {
        setOtp("");
        setChallengeFactorId(factor.id);
        return;
      }
    }
    await goHome();
  }, [goHome]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void continueAfterPassword();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeFactorId) return;
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      setErrors({ otp: "Enter the six-digit code from your Authenticator app" });
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: challengeFactorId,
      code,
    });
    setBusy(false);
    if (error) {
      setErrors({ otp: "That code was not accepted. Codes change every 30 seconds — try again." });
      return;
    }
    setChallengeFactorId(null);
    await goHome();
  }

  async function cancelChallenge() {
    await supabase.auth.signOut();
    setChallengeFactorId(null);
    setOtp("");
    setErrors({});
  }

  function switchMode(next: "login" | "signup") {
    setErrors({});
    setPendingEmail(null);
    navigate({ to: "/auth", search: { mode: next }, replace: true });
  }

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse({
      fullName,
      countryCode,
      phone,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    if (!acceptedTerms) {
      setErrors({ terms: "Please accept the terms to continue" });
      return;
    }
    setErrors({});

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/verified`,
        data: {
          full_name: parsed.data.fullName,
          phone: `${parsed.data.countryCode}${parsed.data.phone}`,
        },
      },
    });
    setBusy(false);

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already")) {
        setErrors({ email: "An account with this email already exists" });
      } else if (message.includes("rate limit")) {
        setErrors({
          email: "Too many verification emails were requested. Please wait a few minutes, then try once.",
        });
      } else if (message.includes("weak") || message.includes("pwned")) {
        setErrors({
          password: "This password has been found in known data breaches. Please choose another.",
        });
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Email confirmation is disabled: a session comes back immediately, so go
    // straight into the app. The "verify your email" screen only shows if the
    // backend ever re-enables confirmation.
    if (data.session) {
      await goHome();
      return;
    }
    setPendingEmail(parsed.data.email);
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in could not be started. Please try again.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    await continueAfterPassword();
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);

    if (error) {
      if (error.message.toLowerCase().includes("not confirmed")) {
        toast.error("Please verify your email first. Check your inbox for the link.");
      } else {
        setErrors({ password: "Invalid email or password" });
      }
      return;
    }
    await continueAfterPassword();
  }

  return (
    <div className="surface-hero flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        {challengeFactorId ? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
            <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">Enter your six-digit code</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Open your Authenticator app and type the current six-digit code for Jane Street. The
              code changes every 30 seconds.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleVerifyCode} noValidate>
              <Field label="Six-digit code" error={errors["otp"]}>
                <Input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  autoFocus
                  aria-label="Six-digit code"
                  className="text-center text-lg tracking-[0.4em]"
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Checking…" : "Verify and continue"}
              </Button>
            </form>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => void cancelChallenge()}>
              Use a different account
            </Button>
          </div>
        ) : pendingEmail ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center shadow-elevated">
            <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">Verify your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We sent a verification link to <strong>{pendingEmail}</strong>. Tap the link in
              that email and you will be taken straight into your account.
            </p>
            <Button
              variant="ghost"
              className="mt-5"
              onClick={() => switchMode("login")}
            >
              Back to login
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated">
            <h1 className="text-center text-2xl font-bold">
              {isSignup ? "Create Your Free Account" : "Welcome Back"}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {isSignup
                ? "Start your case in minutes. It's free — you only pay 15% after a completed recovery."
                : "Log in to check your case progress."}
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={isSignup ? handleSignup : handleLogin}
              noValidate
            >

              {isSignup && (
                <>
                  <Field label="Full name" error={errors["fullName"]}>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your legal name"
                      autoComplete="name"
                    />
                  </Field>

                  <div>
                    <Label className="mb-1.5 block text-sm">Phone number</Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="flex-1"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="8012345678"
                        autoComplete="tel-national"
                      />
                    </div>
                    {(errors["phone"] || errors["countryCode"]) && (
                      <p className="mt-1.5 text-xs text-destructive">
                        {errors["phone"] ?? errors["countryCode"]}
                      </p>
                    )}
                  </div>
                </>
              )}

              <Field label="Email address" error={errors["email"]}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </Field>

              <Field label="Password" error={errors["password"]}>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </Field>

              {isSignup && (
                <Field label="Confirm password" error={errors["confirmPassword"]}>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                </Field>
              )}

              {isSignup && (
                <div>
                  <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span>
                      I agree to the Terms of Service and Privacy Policy, and to the 15% fee
                      charged only after a completed recovery.
                    </span>
                  </label>
                  {errors["terms"] && (
                    <p className="mt-1.5 text-xs text-destructive">{errors["terms"]}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base font-semibold"
                disabled={busy}
              >
                {busy ? "Please wait…" : isSignup ? "Start Your Case — It's Free" : "Log In"}
              </Button>
            </form>

            <div className="mt-5">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-4 h-12 w-full text-base font-semibold"
                disabled={busy}
                onClick={handleGoogle}
              >
                Continue with Google
              </Button>
            </div>

            {!isSignup && (
              <div className="mt-4 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}


            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "login" : "signup")}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {isSignup ? "Login" : "Create account"}
              </button>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
