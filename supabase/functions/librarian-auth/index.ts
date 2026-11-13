import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function makeCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return "L" + String(value[0] % 1_000_000).padStart(6, "0");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !publicKey) return reply({ error: "Authentication service is not configured" }, 500);

  let body: { action?: string; email?: string; name?: string; pin?: string; code?: string };
  try { body = await req.json(); } catch { return reply({ error: "Invalid request" }, 400); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "signup") {
    const email = body.email?.trim().toLowerCase() ?? "";
    const name = body.name?.trim() ?? "";
    const pin = body.pin ?? "";
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !name || name.length > 100 || !/^\\d{4}$/.test(pin)) {
      return reply({ error: "Enter a valid email, name, and 4-digit PIN" }, 400);
    }

    let code = "";
    for (let i = 0; i < 5; i++) {
      const candidate = makeCode();
      const { data } = await admin.from("librarians").select("code").eq("code", candidate).maybeSingle();
      if (!data) { code = candidate; break; }
    }
    if (!code) return reply({ error: "Could not generate a librarian code. Try again." }, 503);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: "lib-pin-" + pin,
      email_confirm: true,
      user_metadata: { name, librarian_code: code },
    });
    if (createError || !created.user) {
      console.error("Librarian account creation failed", createError?.message);
      return reply({ error: "Could not create this account. Check the email address or try another." }, 400);
    }

    const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({
      email,
      password: "lib-pin-" + pin,
    });
    if (signInError || !signedIn.session) {
      console.error("New librarian sign-in failed", signInError?.message);
      return reply({ error: "Account created. Please sign in with your librarian code and PIN." }, 500);
    }
    return reply({ code, session: signedIn.session });
  }

  if (body.action === "login") {
    const code = body.code?.trim().toUpperCase() ?? "";
    const pin = body.pin ?? "";
    if (!/^L\\d{6}$/.test(code) || !/^\\d{4}$/.test(pin)) return reply({ error: "Invalid librarian code or PIN" }, 401);

    const { data: librarian, error: lookupError } = await admin.from("librarians").select("email").eq("code", code).maybeSingle();
    if (lookupError || !librarian?.email) return reply({ error: "Invalid librarian code or PIN" }, 401);

    const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({
      email: librarian.email,
      password: "lib-pin-" + pin,
    });
    if (signInError || !signedIn.session) return reply({ error: "Invalid librarian code or PIN" }, 401);
    return reply({ session: signedIn.session });
  }

  return reply({ error: "Unknown action" }, 400);
});