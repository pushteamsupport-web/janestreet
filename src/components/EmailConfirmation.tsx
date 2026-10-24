import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function EmailConfirmation({ onVerified, onBack }: {
  onVerified: () => void;
  onBack: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function confirm() {
      try {
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.slice(1));
        if (query.has("error") || hash.has("error")) {
          if (active) setFailed(true);
          return;
        }
        const code = query.get("code");
        // Standard confirmation links are processed by Cloud Auth during client
        // initialization. PKCE links require exchanging the returned code.
        const result = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.getSession();
        if (!active) return;
        if (result.error || !result.data.session) {
          setFailed(true);
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        onVerified();
      } catch {
        if (active) setFailed(true);
      }
    }
    void confirm();
    return () => { active = false; };
  }, [onVerified]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center shadow-elevated">
      <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">{failed ? "Verification link unavailable" : "Confirming your email…"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground" role={failed ? "alert" : "status"}>
        {failed ? "This link is invalid, expired, or already used. Sign in if you have already confirmed your email, or request a new link." : "Please wait while we confirm your account."}
      </p>
      {failed && <Button className="mt-6 w-full" onClick={onBack}>Back to login</Button>}
    </div>
  );
}