import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientNav } from "@/components/ClientNav";
import { BackButton } from "@/components/BackButton";
import { SecuritySettings } from "@/components/SecuritySettings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings & Security | Jane Street" },
      {
        name: "description",
        content:
          "Manage your Jane Street account and turn on Google Authenticator two-factor security.",
      },
      { property: "og:title", content: "Account Settings & Security" },
      {
        property: "og:description",
        content: "Turn on Google Authenticator two-factor security for your case file.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  return (
    <div className="min-h-screen bg-background">
      <ClientNav
        name={profileQuery.data?.full_name ?? null}
        email={profileQuery.data?.email ?? null}
        showBack={false}
        minimal
      />

      <main className="mx-auto w-full max-w-xl overflow-x-hidden px-4 py-8">
        <BackButton className="-ml-2 mb-3" />
        <h1 className="text-2xl font-semibold">Settings &amp; security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Protect your case file with Google Authenticator.
        </p>

        <SecuritySettings currentEmail={profileQuery.data?.email ?? null} />
      </main>
    </div>
  );
}
