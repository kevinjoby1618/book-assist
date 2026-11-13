import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookDown, BookPlus, LibraryBig, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseStore } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/desk")({
  head: () => ({
    meta: [
      { title: "Student Desk — Book Assist" },
      { name: "description", content: "Choose whether to issue or return a library book." },
    ],
  }),
  component: StudentDesk,
});

const DESK_LOCK_KEY = "book-assist-student-desk-lock";

function StudentDesk() {
  const navigate = useNavigate();
  const [showClose, setShowClose] = useState(false);
  const [librarianCode, setLibrarianCode] = useState("");
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  function start(mode: "issue" | "return") {
    navigate({ to: "/scan", search: { desk: "1", mode } });
  }

  async function closeDesk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = librarianCode.trim().toUpperCase();
    if (!/^L\d{3,6}$/.test(code) || !/^\d{4}$/.test(pin)) {
      toast.error("Enter a valid librarian code and 4-digit PIN.");
      return;
    }

    setChecking(true);
    const { data, error } = await supabaseStore.functions.invoke("librarian-auth", {
      body: { code, pin },
    });
    if (error || !data?.session) {
      setChecking(false);
      toast.error(data?.error || "Incorrect librarian code or PIN. The student desk is still open.");
      setPin("");
      return;
    }

    const { error: sessionError } = await supabaseStore.auth.setSession(data.session);
    setChecking(false);
    if (sessionError) {
      toast.error("Could not restore the librarian session. Please try again.");
      return;
    }

    // Restore the authenticated librarian shell only after code + PIN verification.
    window.sessionStorage.removeItem(DESK_LOCK_KEY);
    setShowClose(false);
    setLibrarianCode("");
    setPin("");
    navigate({ to: "/dashboard", replace: true });
    toast.success("Librarian verified. Dashboard and sidebar restored.");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col justify-center gap-8">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LibraryBig className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-bold">Student Desk</h1>
        <p className="mt-2 text-muted-foreground">Choose what you need to do with your library book.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Button className="h-36 flex-col gap-3 text-lg" onClick={() => start("issue")}>
          <BookPlus className="h-8 w-8" />
          Issue Book
        </Button>
        <Button className="h-36 flex-col gap-3 text-lg" variant="secondary" onClick={() => start("return")}>
          <BookDown className="h-8 w-8" />
          Return Book
        </Button>
      </div>
      <div className="flex justify-center">
        {!showClose ? (
          <Button variant="ghost" onClick={() => setShowClose(true)}>
            <LockKeyhole className="mr-2 h-4 w-4" /> Librarian: unlock dashboard
          </Button>
        ) : (
          <form onSubmit={closeDesk} className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-4">
            <p className="text-center font-semibold">Librarian verification</p>
            <p className="text-center text-sm text-muted-foreground">Enter your librarian code and 4-digit PIN to restore the dashboard and sidebar.</p>
            <Input
              autoFocus
              autoComplete="off"
              placeholder="Librarian code (e.g. L1234)"
              value={librarianCode}
              onChange={(event) => setLibrarianCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))}
            />
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit librarian PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={checking || !/^L\d{3,6}$/.test(librarianCode.trim().toUpperCase()) || pin.length !== 4}>
                {checking ? "Verifying…" : "Verify & restore"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowClose(false); setLibrarianCode(""); setPin(""); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Librarian tools stay locked while the student desk is open. Enter the librarian code and PIN to restore the librarian dashboard.</p>
    </main>
  );
}