import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseStore } from "@/integrations/supabase/client";
import { booksQuery } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/books")({
  head: () => ({ meta: [{ title: "Books — Book Assist" }, { name: "description", content: "Book catalogue and availability." }, { property: "og:title", content: "Books — Book Assist" }, { property: "og:description", content: "Book records." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BooksPage,
});

function BooksPage() {
  const qc = useQueryClient();
  const books = useQuery(booksQuery).data ?? [];
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"All" | "Available" | "Issued">("All");
  const list = books.filter((b) => (filter === "All" || b.availability === filter) &&
    `${b.book_id} ${b.title} ${b.author} ${b.category}`.toLowerCase().includes(q.toLowerCase()));

  async function remove(id: string) {
    if (!confirm("Delete this book?")) return;
    const { error } = await supabaseStore.from("books").delete().eq("book_id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Books</h1>
        <AddBook onDone={() => qc.invalidateQueries()} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search title, author, category" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex rounded-lg bg-secondary p-1">
          {(["All", "Available", "Issued"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)}>{f}</Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground"><tr>
            <th className="p-3">ID</th><th className="p-3">Title</th><th className="p-3">Author</th><th className="p-3">Category</th><th className="p-3">Status</th><th />
          </tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.book_id} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs">{b.book_id}</td>
                <td className="p-3 font-medium">{b.title}</td>
                <td className="p-3">{b.author}</td>
                <td className="p-3">{b.category}</td>
                <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", b.availability === "Available" ? "bg-success/15 text-success" : "bg-accent/25 text-accent-foreground")}>{b.availability}</span></td>
                <td className="p-3 text-right whitespace-nowrap"><EditBook book={{ ...b, availability: b.availability === "Issued" ? "Issued" : "Available" }} onDone={() => qc.invalidateQueries()} /><Button variant="ghost" size="icon" onClick={() => remove(b.book_id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete book"><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-sm text-muted-foreground">No books found.</p>}
      </div>
    </div>
  );
}


function EditBook({ book, onDone }: { book: { book_id: string; title: string; author: string; category: string; availability: "Available" | "Issued" }; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: book.title, author: book.author, category: book.category, availability: book.availability });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabaseStore.from("books").update({ title: f.title.trim(), author: f.author.trim(), category: f.category.trim(), availability: f.availability }).eq("book_id", book.book_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Book details updated"); setOpen(false); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setF({ title: book.title, author: book.author, category: book.category, availability: book.availability }); }}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Edit book"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit book · {book.book_id}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          {(["title", "author", "category"] as const).map((key) => <div key={key} className="space-y-1"><Label className="capitalize">{key}</Label><Input required={key !== "category"} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></div>)}
          <div className="space-y-1"><Label>Status</Label><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value as "Available" | "Issued" })}><option value="Available">Available</option><option value="Issued">Issued</option></select></div>
          <Button type="submit" className="w-full">Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddBook({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", author: "", category: "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabaseStore.from("books").insert({ ...f, book_id: "" }).select("book_id").single();
    if (error || !data) { toast.error(error?.message ?? "Could not save"); return; }
    toast.success(`Book added as ${data.book_id}`); setOpen(false); onDone(); setF({ title: "", author: "", category: "" });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add book</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add book</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <p className="text-xs text-muted-foreground">The book code is created automatically.</p>
          {(["title", "author", "category"] as const).map((k) => (
            <div key={k} className="space-y-1"><Label className="capitalize">{k}</Label>
              <Input required={k !== "category"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          <Button type="submit" className="w-full">Save book</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
