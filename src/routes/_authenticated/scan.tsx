import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Loader2, RotateCcw, ScanFace, ScanLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Camera, type CameraHandle } from "@/components/Camera";
import { Button } from "@/components/ui/button";
import { recognizeBook } from "@/lib/book-recognition";
import { matchFace } from "@/lib/face-recognition";
import { studentsQuery } from "@/lib/library";
import { supabaseStore } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Issue / Return — Book Assist" }, { name: "description", content: "Scan face and book to issue or return." }, { property: "og:title", content: "Issue / Return — Book Assist" }, { property: "og:description", content: "Scan face and book." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ScanPage,
});

type Student = { student_id: string; name: string; class: string; section: string };
type Book = { book_id: string; title: string; author: string; category: string; availability: string };
type Step = "face" | "book" | "confirm" | "done";

function ScanPage() {
  const qc = useQueryClient();
  const { data: registeredStudents, isLoading: studentsLoading } = useQuery(studentsQuery);
  const cam = useRef<CameraHandle>(null);
  const deskWindow = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("desk") === "1";
  const requestedMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "return" ? "return" : "issue";
  const [mode, setMode] = useState<"issue" | "return">(requestedMode);
  const [step, setStep] = useState<Step>("face");
  const [status, setStatus] = useState("Look at the camera");
  const [student, setStudent] = useState<Student | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const pendingMatch = useRef<string | null>(null);

  // Automatic scanning loop for face & book steps
  useEffect(() => {
    if ((step !== "face" && step !== "book") || (step === "face" && studentsLoading)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled) return;
      const image = cam.current?.capture(step === "face" ? 384 : 640);
      if (image) {
        try {
          if (step === "face") {
            const r = await matchFace(image, registeredStudents ?? []);
            if (cancelled) return;
            if (r.status === "match") {
              if (pendingMatch.current === r.student.student_id) {
                pendingMatch.current = null;
                setStudent(r.student); setStep("book"); setStatus("Now show the book cover"); return;
              }
              pendingMatch.current = r.student.student_id;
              setStatus("Hold still — verifying identity");
            } else pendingMatch.current = null;
            if (r.status !== "match") setStatus(r.status === "no_face" ? "No face detected — look at the camera" : r.status === "multiple" ? "Only one person should be in view" : r.status === "no_registered" ? "No students have registered faces yet" : "No confident match — try better lighting or re-register the photo");
          } else {
            const r = await recognizeBook(image);
            if (cancelled) return;
            if (r.status === "match") { setBook(r.book); setStep("confirm"); return; }
            setStatus(r.status === "no_book" ? "Hold the book cover up to the camera" : `Read "${r.detected?.title ?? "?"}" — not found in catalogue`);
          }
        } catch (e) {
          setStatus(step === "face" ? "Face scan unavailable — reload and try again" : (e as Error).message);
        }
      }
      timer = setTimeout(tick, 1500);
    };
    timer = setTimeout(tick, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [step, registeredStudents, studentsLoading]);

  function reset() {
    pendingMatch.current = null;
    setStep("face"); setStudent(null); setBook(null); setResult(null); setStatus("Look at the camera");
  }

  async function confirm() {
    if (!student || !book) return;
    setBusy(true);
    const { error } = await supabaseStore.rpc(mode === "issue" ? "issue_book" : "return_book", { _student_id: student.student_id, _book_id: book.book_id });
    setBusy(false);
    qc.invalidateQueries();
    if (error) { setResult({ ok: false, msg: error.message }); toast.error(error.message); }
    else {
      const msg = mode === "issue" ? `"${book.title}" issued to ${student.name}` : `"${book.title}" returned by ${student.name}`;
      setResult({ ok: true, msg }); toast.success(msg);
    }
    setStep("done");
  }

  const steps = [
    { key: "face", label: "Recognise student", icon: ScanFace },
    { key: "book", label: "Recognise book", icon: ScanLine },
    { key: "confirm", label: "Confirm", icon: Check },
  ];
  const idx = step === "done" ? 3 : steps.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{mode === "issue" ? "Issue a book" : "Return a book"}</h1>
        {deskWindow ? (
          <Button variant="outline" onClick={() => window.location.assign("/desk")}>Back to student desk</Button>
        ) : (
          <div className="flex rounded-lg border border-border bg-secondary p-1">
            {(["issue", "return"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "ghost"} onClick={() => { setMode(m); reset(); }}
                className="capitalize">{m}</Button>
            ))}
          </div>
        )}
      </div>

      <ol className="grid grid-cols-3 gap-2">
        {steps.map((s, i) => (
          <li key={s.key} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            i < idx ? "border-success/40 bg-success/10 text-success" : i === idx ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {i < idx ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            <span className="hidden sm:inline">Step {i + 1} ·</span> {s.label}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Camera ref={cam} scanning={step === "face" || step === "book"} mirrored={step !== "book"} />
          {(step === "face" || step === "book") && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {status}</p>
          )}
        </div>
        <div className="space-y-4">
          <InfoCard title="Student" empty="Waiting for face…">
            {student && <><p className="font-display text-xl font-bold">{student.name}</p><p className="text-sm text-muted-foreground">ID {student.student_id} · Class {student.class} {student.section}</p></>}
          </InfoCard>
          <InfoCard title="Book" empty="Waiting for book…">
            {book && <><p className="font-display text-xl font-bold">{book.title}</p><p className="text-sm text-muted-foreground">{book.author} · {book.book_id}</p>
              <p className={cn("mt-1 text-xs font-semibold", book.availability === "Available" ? "text-success" : "text-destructive")}>{book.availability}</p></>}
          </InfoCard>

          {step === "confirm" && (
            <div className="space-y-2 rounded-xl border-2 border-accent bg-card p-4">
              <p className="text-sm font-medium">Is this the correct book?</p>
              {mode === "issue" && book?.availability !== "Available" && <p className="text-sm text-destructive">This book is already issued.</p>}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={confirm} disabled={busy || (mode === "issue" && book?.availability !== "Available")}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${mode}`}
                </Button>
                <Button variant="outline" onClick={() => { setBook(null); setStep("book"); setStatus("Show the book again"); }}>Rescan</Button>
              </div>
            </div>
          )}
          {step === "done" && result && (
            <div className={cn("rounded-xl p-4", result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              <p className="flex items-center gap-2 font-medium">{result.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{result.msg}</p>
            </div>
          )}
          {step !== "face" && <Button variant="ghost" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Start over</Button>}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children || <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}
