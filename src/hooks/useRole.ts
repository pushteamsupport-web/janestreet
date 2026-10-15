import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client";

export async function fetchMyRole(): Promise<AppRole | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);
  if (error) throw error;
  const roles = (data ?? []).map((row) => row.role as AppRole);
  return roles.includes("admin") ? "admin" : (roles[0] ?? "client");
}

export function useRole() {
  const query = useQuery({
    queryKey: ["my-role"],
    queryFn: fetchMyRole,
    staleTime: 1000 * 60 * 5,
  });
  return { role: query.data ?? null, isAdmin: query.data === "admin", loading: query.isLoading };
}
