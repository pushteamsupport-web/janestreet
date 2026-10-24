import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { EmailConfirmation } from "@/components/EmailConfirmation";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/verified")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirm Your Email | Jane Street" },
      {
        name: "description",
        content: "Confirm your Jane Street account using your email verification link.",
      },
      { property: "og:title", content: "Confirm Your Email | Jane Street" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Complete email-link verification for your Jane Street account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verified,
});

function Verified() {
  const navigate = useNavigate();
  const continueToAccount = useCallback(() => {
    void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [navigate]);

  return (
    <div className="surface-hero flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <EmailConfirmation
          onVerified={continueToAccount}
          onBack={() => navigate({ to: "/auth", search: { mode: "login" } })}
        />
      </main>
    </div>
  );
}
