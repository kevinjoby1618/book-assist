import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ScanFace, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signUpLibrarian } from "@/lib/librarian-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Book Assist — Sign in" },
      { name: "description", content: "Show your face, show the book. Book Assist handles issue and return automatically." },
      { property: "og:title", content: "Book Assist — Sign in" },
      { property: "og:description", content: "Face and book recognition for school libraries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [code, setCode] = useState("");
  const [librarianName, setLibrarianName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = code.trim();
    if (!/^\d{4}$/.test(pin)) { toast.error("PIN must be exactly 4 digits"); return; }
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: id.toLowerCase(), password: `lib-pin-${pin}` });
        if (error) throw new Error("Wrong email or PIN");
        navigate({ to: "/dashboard" });
      } else {
        const res = await signUpLibrarian({ data: { email: id, name: librarianName.trim(), pin } });
        setNewCode(res.code ?? "");
        
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (newCode !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <h2 className="text-3xl font-bold">Account created</h2>
          <p className="text-muted-foreground">Your librarian code is</p>
          <p className="font-mono text-5xl font-bold text-accent">{newCode || "—"}</p>
          <p className="text-sm text-muted-foreground">Write it down for your records. Sign in with your email and PIN.</p>
          <Button className="w-full" onClick={() => { setNewCode(null); setMode("in"); setCode(code.trim()); setPin(""); }}>Go to sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-hero p-12 text-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-6 w-6" /> Book Assist</div>
        <div>
          <h1 className="text-5xl font-bold leading-tight">Show your face.<br />Show the book.<br /><span className="text-accent">Done.</span></h1>
          <div className="mt-10 space-y-4 text-muted-foreground">
            <p className="flex items-center gap-3"><ScanFace className="h-5 w-5 text-accent" /> Recognises students by face</p>
            <p className="flex items-center gap-3"><ScanLine className="h-5 w-5 text-accent" /> Reads book covers automatically</p>
            <p className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-accent" /> Records every issue and return</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">For librarians and school staff</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-3xl font-bold">{mode === "in" ? "Librarian sign in" : "Create librarian account"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "in" ? "Enter your email address and your 4-digit PIN." : "Enter your email and choose a 4-digit PIN. You'll get a librarian code."}</p>
          </div>
          {mode === "up" && <div className="space-y-2"><Label htmlFor="librarianName">Librarian name</Label><Input id="librarianName" required autoComplete="name" placeholder="Your full name" value={librarianName} onChange={(e) => setLibrarianName(e.target.value)} /></div>}
          <div className="space-y-2"><Label htmlFor="code">{mode === "in" ? "Email" : "Email"}</Label><Input id="code" type="email" required autoComplete="username" placeholder="Email address" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pin">PIN</Label><Input id="pin" type="password" inputMode="numeric" required maxLength={4} pattern="\d{4}" placeholder="••••" className="tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
          <Button variant="link" type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-muted-foreground hover:text-foreground">
            {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
