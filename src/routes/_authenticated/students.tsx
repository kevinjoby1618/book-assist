import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera as CamIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { appwriteStore } from "@/integrations/appwrite/client";
import { studentsQuery } from "@/lib/library";
import { Camera, type CameraHandle } from "@/components/Camera";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { validateFacePhoto } from "@/lib/face-recognition";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — Book Assist" }, { name: "description", content: "Register students and their faces." }, { property: "og:title", content: "Students — Book Assist" }, { property: "og:description", content: "Student records." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const students = useQuery(studentsQuery).data ?? [];
  const [q, setQ] = useState("");
  const [faceFor, setFaceFor] = useState<string | null>(null);
  const list = students.filter((s) => `${s.student_id} ${s.name} ${s.class} ${s.section}`.toLowerCase().includes(q.toLowerCase()));

  async function remove(id: string) {
    if (!confirm("Delete this student and their history?")) return;
    const { error } = await appwriteStore.from("students").delete().eq("student_id", id);
    if (error) toast.error(error.message); else { toast.success("Student deleted"); qc.invalidateQueries(); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Students</h1>
        <AddStudent onDone={(id) => { qc.invalidateQueries(); setFaceFor(id); }} />
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <div key={s.student_id} className="flex items-center gap-4 rounded-xl bg-card p-4 shadow-card">
            {s.face_image ? <img src={s.face_image} alt={s.name} className="h-16 w-16 rounded-full object-cover" /> :
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">No face</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">ID {s.student_id} · {s.class} {s.section}</p>
              <Button variant="link" size="sm" onClick={() => setFaceFor(s.student_id)} className="mt-1 h-auto p-0 text-xs">
                {s.face_image ? "Re-register face" : "Register face"}
              </Button>
            </div>
            <EditStudent student={s} onDone={() => qc.invalidateQueries()} />
            <Button variant="ghost" size="icon" onClick={() => remove(s.student_id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete student"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No students found.</p>}
      </div>
      <FaceDialog studentId={faceFor} onClose={() => setFaceFor(null)} onSaved={() => qc.invalidateQueries()} />
    </div>
  );
}


function EditStudent({ student, onDone }: { student: { student_id: string; name: string; class: string; section: string }; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: student.name, class: student.class, section: student.section });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await appwriteStore.from("students").update({ name: f.name.trim(), class: f.class.trim(), section: f.section.trim() }).eq("student_id", student.student_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Student details updated"); setOpen(false); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setF({ name: student.name, class: student.class, section: student.section }); }}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Edit student"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit student · {student.student_id}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.toUpperCase() })} /></div>
          <div className="space-y-1"><Label>Class</Label><Input required value={f.class} onChange={(e) => setF({ ...f, class: e.target.value.toUpperCase() })} /></div>
          <div className="space-y-1"><Label>Section</Label><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value.toUpperCase() })} /></div>
          <Button type="submit" className="w-full">Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddStudent({ onDone }: { onDone: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", class: "", section: "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await appwriteStore.from("students").insert({ ...f, student_id: "" }).select("student_id").single();
    if (error || !data) { toast.error(error?.message ?? "Could not save"); return; }
    toast.success(`Student registered as ${data.student_id} — now capture their face`);
    setOpen(false); onDone(data.student_id); setF({ name: "", class: "", section: "" });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Register student</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register student</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <p className="text-xs text-muted-foreground">The student code is created automatically.</p>
          <div className="space-y-1">
            <Label htmlFor="student-name">Name</Label>
            <Input id="student-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Input
              aria-label="Class"
              list="student-classes"
              placeholder="Class"
              required
              value={f.class}
              onChange={(e) => setF({ ...f, class: e.target.value.toUpperCase() })}
            />
            <datalist id="student-classes">
              {["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","Kindergarten"].map((grade) => <option key={grade} value={grade} />)}
            </datalist>
          </div>
          <div>
            <Input
              aria-label="Section"
              list="student-sections"
              placeholder="Section"
              value={f.section}
              onChange={(e) => setF({ ...f, section: e.target.value.toUpperCase() })}
            />
            <datalist id="student-sections">
              {["A","B"].map((section) => <option key={section} value={section} />)}
            </datalist>
          </div>
          <Button type="submit" className="w-full">Save & capture face</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FaceDialog({ studentId, onClose, onSaved }: { studentId: string | null; onClose: () => void; onSaved: () => void }) {
  const cam = useRef<CameraHandle>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!shot || !studentId) return;
    setBusy(true);
    const { error } = await appwriteStore.from("students").update({ face_image: shot }).eq("student_id", studentId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Face registered"); setShot(null); onSaved(); onClose();
  }
  async function capture() {
    const image = cam.current?.capture(640);
    if (!image) { toast.error("Camera is not ready. Please try again."); return; }
    setBusy(true);
    try {
      const result = await validateFacePhoto(image);
      if (result === "none") toast.error("No clear face found. Face the camera in good light and try again.");
      else if (result === "multiple") toast.error("Only one person should be in the photo.");
      else setShot(image);
    } catch { toast.error("Could not check the photo. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={!!studentId} onOpenChange={(o) => { if (!o) { setShot(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Face registration · {studentId}</DialogTitle></DialogHeader>
        {shot ? <img src={shot} alt="Captured face" className="aspect-[4/3] w-full rounded-xl object-cover -scale-x-100" /> : studentId && <Camera ref={cam} />}
        <p className="text-sm text-muted-foreground">Face the camera in good light, looking straight ahead.</p>
        <div className="flex gap-2">
          {shot ? <>
            <Button className="flex-1" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save face"}</Button>
            <Button variant="outline" onClick={() => setShot(null)}>Retake</Button>
          </> : <Button className="flex-1" onClick={capture} disabled={busy}><CamIcon className="mr-2 h-4 w-4" /> {busy ? "Checking…" : "Capture"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
