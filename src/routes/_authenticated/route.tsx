import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { History, LayoutDashboard, LogOut, ScanLine, Users, Library, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AppShell,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Issue / Return", icon: ScanLine },
  { to: "/students", label: "Students", icon: Users },
  { to: "/books", label: "Books", icon: Library },
  { to: "/transactions", label: "Logs", icon: History },
  { to: "/account", label: "Account", icon: Settings },
] as const;

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useRouterState({ select: (state) => state.location });
  const deskWindow = location.pathname === "/desk" || new URLSearchParams(location.searchStr).get("desk") === "1";

  async function signOut() {
    await supabase.auth.signOut();
    // Prevent cached records from one librarian being displayed after another signs in.
    queryClient.clear();
    navigate({ to: "/" });
  }

  if (deskWindow) return <main className="min-h-screen p-5 md:p-8"><Outlet /></main>;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-5 font-display text-lg font-bold text-sidebar-primary">
          <img src="/book-assist-icon.svg" alt="Book Assist logo" className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_12px_rgba(0,229,195,0.28)]" width={48} height={48} />
          <span>Book Assist</span>
        </div>
        <MyCode />
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {nav.map((n) => (
            <Link key={n.to} to={n.to}
              className="flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/95 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "border border-sidebar-primary/40 bg-sidebar-accent text-sidebar-primary" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" onClick={signOut}
          className="mt-auto hidden items-center justify-start gap-3 rounded-none px-6 py-6 text-sm text-sidebar-foreground/95 hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </aside>
      <main className="flex-1 p-5 md:p-10"><Outlet /></main>
    </div>
  );
}

function MyCode() {
  const [profile, setProfile] = useState<{ name: string; code: string } | null>(null);
  useEffect(() => {
    supabase.from("librarians").select("name, code").maybeSingle().then(({ data }) => {
      if (data) setProfile({ name: data.name?.trim() ?? "", code: data.code });
    });
  }, []);
  if (!profile) return null;
  return (
    <div className="mx-3 mb-3 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-3">
      {profile.name && <p className="truncate text-sm font-semibold text-sidebar-foreground" title={profile.name}>{profile.name}</p>}
      <p className="mt-1 text-xs text-sidebar-foreground/70">
        Librarian code: <span className="font-mono font-semibold text-sidebar-primary">{profile.code}</span>
      </p>
    </div>
  );
}
