import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Jane Street" },
      { name: "description", content: "How Jane Street handles your personal information." },
      { property: "og:title", content: "Privacy Policy | Jane Street" },
      { property: "og:description", content: "How Jane Street handles your personal information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage slug="privacy" />,
});
