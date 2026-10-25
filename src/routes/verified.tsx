import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { EmailVerification } from "@/components/EmailVerification";
import { BrandMark } from "@/components/BrandMark";
import { useCallback } from "react";

export const Route = createFileRoute("/verified")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirm Your Email | Jane Street" },
      {
        name: "description",
        content: "Confirm your Jane Street account using the verification link in your email.",
      },
      { property: "og:title", content: "Confirm Your Email | Jane Street" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Verify your Jane Street email using your secure confirmation link.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verified,
});

function Verified() {
  const navigate = useNavigate();
  const onVerified = useCallback(() => navigate({ to: "/auth", search: { mode: "login" }, replace: true }), [navigate]);

  return (
    <div className="surface-hero flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <EmailVerification
          onVerified={onVerified}
          onBack={() => navigate({ to: "/auth", search: { mode: "login" } })}
        />
      </main>
    </div>
  );
}
