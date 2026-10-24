import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/hooks/useRole";

export function ClientNav({
  name,
  email,
  showBack = true,
  minimal = false,
}: {
  name?: string | null;
  email?: string | null;
  showBack?: boolean;
  /** Hides the Dashboard link and account menu — for focused sub-pages. */
  minimal?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const initials = (name || email || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-1">
          {showBack ? <BackButton /> : null}
          <Link to="/" className="flex items-center">
            <BrandMark />
          </Link>
        </div>

        {minimal ? null : (
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          {isAdmin ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">Admin panel</Link>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open account menu"
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {name || "Your account"}
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/dashboard" search={{ tab: "profile" }}>
                  <User className="mr-2 h-4 w-4" aria-hidden="true" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" /> Settings & security
                </Link>
              </DropdownMenuItem>
              {isAdmin ? (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" /> Admin panel
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        )}
      </div>
    </header>
  );
}
