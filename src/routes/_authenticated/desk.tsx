import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookDown, BookPlus, LibraryBig, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appwriteStore } from "@/integrations/appwrite/client";

export const Route = createFileRoute("/_authenticated/desk")({
  head: () => ({
    meta: [
      { title: "Student Desk — Book Assist" },
      { name: "description", content: "Choose whether to issue or return a library book." },
    ],
  }),
  component: StudentDesk,
});

function StudentDesk() {
  const [showClose, setShowClose] = useState(false);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  function start(mode: "issue" | "return") {
    window.location.assign(`/scan?desk=1&mode=${mode}`);
  }

  async function closeDesk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter the librarian's 4-digit PIN.");
      return;
    }
    setChecking(true);
    const { data } = await appwriteStore.auth.getUser();
    if (!data.user?.email) {
      setChecking(false);
      toast.error("Librarian session not found. Ask the librarian to sign in again.");
      return;
    }
    const { error } = await appwriteStore.auth.signInWithPassword({
      email: data.user.email,
      password: `lib-pin-${pin}`,
    });
    setChecking(false);
    if (error) {
      toast.error("Incorrect librarian PIN. The student desk is still open.");
      setPin("");
      return;
    }
    window.close();
    setShowClose(false);
    setPin("");
    toast.success("PIN verified. You can close this student window.");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center gap-8">
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
            <LockKeyhole className="mr-2 h-4 w-4" /> Librarian: close student desk
          </Button>
        ) : (
          <form onSubmit={closeDesk} className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-4">
            <p className="text-center font-semibold">Librarian verification</p>
            <p className="text-center text-sm text-muted-foreground">Enter your 4-digit PIN to close this window.</p>
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit librarian PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={checking || pin.length !== 4}>
                {checking ? "Verifying…" : "Verify & close"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowClose(false); setPin(""); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">This window is for student issue and return transactions. Only a librarian with the PIN can use the in-app close control.</p>
    </main>
  );
}
