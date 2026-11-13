import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response(JSON.stringify({ error: "Authentication service is not configured" }), { status: 500, headers });

  let body: { email?: string; name?: string; pin?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers }); }

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const pin = body.pin ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 100 || !/^\d{4}$/.test(pin)) {
    return new Response(JSON.stringify({ error: "Enter a valid email, name, and 4-digit PIN" }), { status: 400, headers });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let code = "";
  for (let i = 0; i < 5; i++) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    const candidate = "L" + String(value[0] % 1_000_000).padStart(6, "0");
    const { data } = await admin.from("librarians").select("code").eq("code", candidate).maybeSingle();
    if (!data) { code = candidate; break; }
  }
  if (!code) return new Response(JSON.stringify({ error: "Could not generate a librarian code. Try again." }), { status: 503, headers });

  const { error } = await admin.auth.admin.createUser({
    email,
    password: "lib-pin-" + pin,
    email_confirm: true,
    user_metadata: { name, librarian_code: code },
  });
  if (error) {
    console.error("Librarian account creation failed", error.message);
    return new Response(JSON.stringify({ error: "Could not create this account. Check the email address or try another." }), { status: 400, headers });
  }

  return new Response(JSON.stringify({ code }), { status: 200, headers });
});