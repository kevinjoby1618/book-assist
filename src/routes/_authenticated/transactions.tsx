import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { isOverdue, transactionsQuery } from "@/lib/library";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Logs — Book Assist" }, { name: "description", content: "Library activity log for book issue and return transactions." }, { property: "og:title", content: "History — Book Assist" }, { property: "og:description", content: "Library activity log." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TxPage,
});

function TxPage() {
  const tx = useQuery(transactionsQuery).data ?? [];
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const list = tx
    .filter((t) => `${t.student_id} ${t.student_name} ${t.book_id} ${t.book_title} ${t.status}`.toLowerCase().includes(q.toLowerCase()))
    .filter((t) => {
      if (statusFilter === "All statuses") return true;
      if (statusFilter === "Overdue") return t.status !== "Returned" && isOverdue(t);
      return t.status === statusFilter;
    })
    .sort((a, b) => {
      const rank = (t: (typeof tx)[number]) => t.status === "Returned" ? 2 : isOverdue(t) ? 0 : 1;
      return rank(a) - rank(b);
    });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track book issues, returns, and overdue records.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total records</p>
          <p className="mt-1 text-2xl font-semibold">{tx.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Currently issued</p>
          <p className="mt-1 text-2xl font-semibold">{tx.filter((t) => t.status === "Issued").length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Returned</p>
          <p className="mt-1 text-2xl font-semibold">{tx.filter((t) => t.status === "Returned").length}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search student, book, ID, or status" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Filter by status</span>
          <select
            className="h-10 min-w-40 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All statuses</option>
            <option>Overdue</option>
            <option>Issued</option>
            <option>Returned</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground"><tr>
            <th className="p-3">Transaction</th><th className="p-3">Student</th><th className="p-3">Book</th><th className="p-3">Issued</th><th className="p-3">Due</th><th className="p-3">Returned</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {list.map((t) => {
              const od = isOverdue(t);
              return (
                <tr key={t.transaction_id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{t.transaction_id.slice(0, 8)}</td>
                  <td className="p-3">{t.student_name} <span className="text-xs text-muted-foreground">({t.student_id})</span></td>
                  <td className="p-3">{t.book_title} <span className="text-xs text-muted-foreground">({t.book_id})</span></td>
                  <td className="p-3">{t.issue_date}</td>
                  <td className="p-3">{t.due_date}</td>
                  <td className="p-3">{t.return_date ?? "—"}</td>
                  <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                    t.status === "Returned" ? "bg-success/15 text-success" : od ? "bg-destructive/15 text-destructive" : "bg-accent/25 text-accent-foreground")}>{od ? "Overdue" : t.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-sm text-muted-foreground">No log records match your search and status filter.</p>}
      </div>
    </div>
  );
}
