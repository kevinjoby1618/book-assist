import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookCheck, BookOpen, ExternalLink, ScanLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { booksQuery, isOverdue, studentsQuery, transactionsQuery } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Book Assist" }, { name: "description", content: "Library overview." }, { property: "og:title", content: "Dashboard — Book Assist" }, { property: "og:description", content: "Library overview." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [librarianName, setLibrarianName] = useState("");
  useEffect(() => {
    supabase.from("librarians").select("name").maybeSingle().then(({ data }) => {
      const name = data?.name?.trim() ?? "";
      setLibrarianName(name);
    });
  }, []);
  const books = useQuery(booksQuery).data ?? [];
  const students = useQuery(studentsQuery).data ?? [];
  const tx = useQuery(transactionsQuery).data ?? [];
  const issued = books.filter((b) => b.availability === "Issued").length;
  const overdue = tx.filter(isOverdue).length;
  function openLibrarianDesk() {
    const popup = window.open("/desk", "book-assist-librarian-desk", "popup=yes,width=1100,height=760,resizable=yes");
    popup?.focus();
  }
  const stats = [
    { label: "Books", value: books.length, icon: BookOpen },
    { label: "Issued now", value: issued, icon: BookCheck },
    { label: "Students", value: students.length, icon: Users },
    { label: "Overdue", value: overdue, icon: AlertTriangle },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col justify-between gap-6 rounded-2xl bg-hero p-8 text-foreground md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary md:text-4xl">{librarianName ? `Welcome, ${librarianName}!` : "Good to see you at the desk."}</h1>
          <p className="mt-2 text-muted-foreground">Start a scan: the student shows their face, then the book.</p>
        </div>
        <div className="flex flex-wrap gap-3"><Button size="lg" onClick={openLibrarianDesk}><ExternalLink className="mr-2 h-5 w-5" /> Open librarian desk</Button><Button asChild size="lg" variant="secondary"><Link to="/scan"><ScanLine className="mr-2 h-5 w-5" /> Start scanning</Link></Button></div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-card p-5 shadow-card">
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 font-display text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent activity</h2>
          <Link to="/transactions" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {tx.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet.</p> : (
          <ul className="divide-y">
            {tx.slice(0, 6).map((t) => (
              <li key={t.transaction_id} className="flex items-center justify-between py-3 text-sm">
                <span><b>{t.student_name}</b> · {t.book_title}</span>
                <span className={t.status === "Returned" ? "text-success" : isOverdue(t) ? "text-destructive" : "text-accent-foreground"}>
                  {isOverdue(t) ? "Overdue" : t.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
