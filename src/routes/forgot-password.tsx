import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailOnlySchema } from "@/lib/validation";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Your Password | Jane Street" },
      {
        name: "description",
        content:
          "Request a secure password reset link for your Jane Street account.",
      },
      { property: "og:title", content: "Reset Your Password" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Request a secure password reset link by email.",
      },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setBusy(false);
    if (resetError) {
      toast.error(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="surface-hero flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          {sent ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, a password reset link is on
                its way.
              </p>
              <Button asChild variant="ghost" className="mt-5">
                <Link to="/auth" search={{ mode: "login" }}>
                  Back to login
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Forgot your password?</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your email and we'll send you a secure link to set a new password.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <Label className="mb-1.5 block text-sm">Email address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                  {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
