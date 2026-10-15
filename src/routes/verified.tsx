import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/verified")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Email Verified | Jane Street" },
      {
        name: "description",
        content: "Your Jane Street email is verified — continue to your case dashboard.",
      },
      { property: "og:title", content: "Email Verified | Jane Street" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Your email is verified. Continue to your case dashboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verified,
});

function Verified() {
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      navigate({ to: "/dashboard", replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    const timer = setTimeout(() => {
      if (!done) setTimedOut(true);
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div className="surface-hero flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-elevated">
          <h1 className="text-xl font-semibold">
            {timedOut ? "Almost there" : "Verifying your email…"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {timedOut
              ? "Your email is confirmed. Please log in to open your dashboard."
              : "One moment — we're opening your dashboard."}
          </p>
          {timedOut && (
            <Button asChild className="mt-5">
              <Link to="/auth" search={{ mode: "login" }}>
                Login
              </Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
