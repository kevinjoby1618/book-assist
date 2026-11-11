import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { deleteLibrarianAccount } from "@/lib/librarian-auth.functions";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Book Assist" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/" }); return; }
      const { data, error } = await supabase
        .from("librarians")
        .select("name, email, code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) toast.error("Could not load your librarian profile");
      setName(data?.name ?? "");
      setEmail(data?.email ?? user.email ?? "");
      setCode(data?.code ?? "");
      setLoading(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, [navigate]);

  async function saveName() {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 100) {
      toast.error("Enter a name up to 100 characters");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again");
      const { error } = await supabase.from("librarians").update({ name: cleanName }).eq("user_id", user.id);
      if (error) throw error;
      setName(cleanName);
      toast.success("Your name has been updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your name");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  }

  async function deleteAccount() {
    const confirmed = window.confirm("Delete your Book Assist account permanently? This action cannot be undone.");
    if (!confirmed) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again");
      await deleteLibrarianAccount({ data: { accessToken: session.access_token } });
      await supabase.auth.signOut();
      toast.success("Your account has been deleted");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Account</h1>
        <p className="mt-2 text-muted-foreground">Manage your librarian profile and account access.</p>
      </div>

      <section className="space-y-5 rounded-xl bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <UserRound className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Librarian profile</h2>
            <p className="text-sm text-muted-foreground">Your name appears in your dashboard greeting.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Librarian name</Label>
            <Input id="account-name" value={name} maxLength={100} placeholder="Enter your full name" onChange={(e) => setName(e.target.value)} disabled={loading || saving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-code">Librarian code</Label>
            <Input id="account-code" value={code} readOnly placeholder="Assigned automatically" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" value={email} readOnly />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveName} disabled={loading || saving || !name.trim()}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save name"}</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-card p-6 shadow-card">
        <div>
          <h2 className="text-lg font-semibold">Session</h2>
          <p className="text-sm text-muted-foreground">Sign out of Book Assist on this device.</p>
        </div>
        <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
      </section>

      <section className="space-y-4 rounded-xl border border-destructive/40 bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold text-destructive">Delete account</h2>
          <p className="text-sm text-muted-foreground">Permanently delete your librarian login and profile. This cannot be undone.</p>
        </div>
        <Button variant="destructive" onClick={deleteAccount} disabled={deleting}><Trash2 className="mr-2 h-4 w-4" />{deleting ? "Deleting…" : "Delete my account"}</Button>
      </section>
    </div>
  );
}
