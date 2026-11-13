import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookDown, BookPlus, LibraryBig, LockKeyhole, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { booksQuery } from "@/lib/library";
import { cn } from "@/lib/utils";
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
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const { data: books = [], isLoading: booksLoading, error: booksError } = useQuery(booksQuery);
  const matchingBooks = books.filter((book) =>
    (book.title + " " + book.author + " " + book.category + " " + (book.shelf_name ?? ""))
      .toLowerCase().includes(bookSearch.trim().toLowerCase())
  );

  function start(mode: "issue" | "return") {
    // Use a full route navigation so the scan page always receives its student mode
    // and selected action, even if the client router has stale search state.
    window.location.assign(`/scan?desk=1&mode=${mode}`);
  }

  async function closeDesk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter the librarian's 4-digit PIN.");
      return;
    }

    setChecking(true);
    const { data: { user }, error: userError } = await supabaseStore.auth.getUser();
    if (userError || !user?.email) {
      setChecking(false);
      toast.error("Librarian session not found. Please sign in again.");
      return;
    }

    const { error } = await supabaseStore.auth.signInWithPassword({
      email: user.email,
      password: "lib-pin-" + pin,
    });
    setChecking(false);
    if (error) {
      toast.error("Incorrect librarian PIN. The student desk is still open.");
      setPin("");
      return;
    }

    // Restore librarian pages only after the PIN is verified.
    window.sessionStorage.removeItem(DESK_LOCK_KEY);
    setShowClose(false);
    setPin("");
    navigate({ to: "/dashboard", replace: true });
    toast.success("PIN verified. Librarian dashboard and sidebar restored.");
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
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-xl font-bold">Find a book</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search by book title, author, category, or shelf code.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Try The Alchemist, Paulo Coelho, Fiction, A01…" value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} aria-label="Search books by title, author, category, or shelf" />
        </div>
        {booksLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading books…</p>
        ) : booksError ? (
          <p className="py-4 text-sm text-destructive">Could not load the book catalogue. Please try again.</p>
        ) : matchingBooks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{bookSearch ? "No books match your search." : "No books have been added yet."}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matchingBooks.map((book) => (
              <article key={book.book_id} className="min-w-0 rounded-xl border bg-background p-4">
                <h3 className="font-semibold leading-snug">{book.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Author: {book.author}</p>
                {book.category && <p className="mt-1 text-xs text-muted-foreground">Category: {book.category}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", book.availability === "Available" ? "bg-success/15 text-success" : "bg-accent/25 text-accent-foreground")}>{book.availability}</span>
                  <span className="text-sm font-semibold">Shelf {book.shelf_name?.trim() || "Not assigned"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="flex justify-center">
        {!showClose ? (
          <Button variant="ghost" onClick={() => setShowClose(true)}>
            <LockKeyhole className="mr-2 h-4 w-4" /> Librarian: unlock dashboard
          </Button>
        ) : (
          <form onSubmit={closeDesk} className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-4">
            <p className="text-center font-semibold">Librarian verification</p>
            <p className="text-center text-sm text-muted-foreground">Enter your 4-digit PIN to restore the librarian dashboard and sidebar.</p>
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              placeholder="4-digit librarian PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={checking || pin.length !== 4}>
                {checking ? "Verifying…" : "Verify PIN & restore"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowClose(false); setPin(""); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Only Issue Book and Return Book are available to students. Librarian tools remain locked until the librarian enters their PIN.</p>
    </main>
  );
}