import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | Jane Street" },
      { name: "description", content: "The terms for using Jane Street fraud recovery support." },
      { property: "og:title", content: "Terms of Service | Jane Street" },
      { property: "og:description", content: "The terms for using Jane Street fraud recovery support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage slug="terms" />,
});
