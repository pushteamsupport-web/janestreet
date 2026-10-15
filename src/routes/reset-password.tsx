import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { PasswordInput } from "@/components/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newPasswordSchema } from "@/lib/validation";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a New Password | Jane Street" },
      {
        name: "description",
        content: "Choose a new password for your Jane Street account.",
      },
      { property: "og:title", content: "Set a New Password" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Choose a new password for your account.",
      },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/dashboard", replace: true });
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
          <h1 className="text-xl font-semibold">Set a new password</h1>
          {ready ? (
            <>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Choose a strong password you haven't used before.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <Label className="mb-1.5 block text-sm">New password</Label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                  />
                  {errors["password"] && (
                    <p className="mt-1.5 text-xs text-destructive">{errors["password"]}</p>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Confirm new password</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                  {errors["confirmPassword"] && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {errors["confirmPassword"]}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Updating…" : "Update password"}
                </Button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              This page only works from the reset link we email you. Open that link, or{" "}
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                request a new one
              </Link>
              .
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
