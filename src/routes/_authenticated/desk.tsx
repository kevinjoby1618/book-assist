import { createFileRoute } from "@tanstack/react-router";
import { BookDown, BookPlus, LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/desk")({
  head: () => ({
    meta: [
      { title: "Librarian Desk — Book Assist" },
      { name: "description", content: "Choose whether to issue or return a library book." },
    ],
  }),
  component: LibrarianDesk,
});

function LibrarianDesk() {
  function start(mode: "issue" | "return") {
    window.location.assign(`/scan?desk=1&mode=${mode}`);
  }

  function closeDesk() {
    window.close();
    if (!window.closed) window.location.assign("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center gap-8">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LibraryBig className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-bold">Librarian Desk</h1>
        <p className="mt-2 text-muted-foreground">Choose the book transaction you want to process.</p>
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
        <Button variant="ghost" onClick={closeDesk}>Close desk</Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Available only while signed in as a librarian.</p>
    </main>
  );
}
