import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { EmailVerification } from "@/components/EmailVerification";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/verified")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verify Email Code | Jane Street" },
      {
        name: "description",
        content: "Enter your six-digit email code to verify your Jane Street account.",
      },
      { property: "og:title", content: "Verify Email Code | Jane Street" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Verify your Jane Street email with a six-digit code.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verified,
});

function Verified() {
  const navigate = useNavigate();

  return (
    <div className="surface-hero flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <EmailVerification
          onVerified={() => navigate({ to: "/auth", search: { mode: "login" }, replace: true })}
          onBack={() => navigate({ to: "/auth", search: { mode: "login" } })}
        />
      </main>
    </div>
  );
}
