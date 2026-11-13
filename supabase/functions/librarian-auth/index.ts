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
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !publicKey) return new Response(JSON.stringify({ error: "Authentication service is not configured" }), { status: 500, headers });

  let body: { code?: string; pin?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers }); }

  const code = body.code?.trim().toUpperCase() ?? "";
  const pin = body.pin ?? "";
  if (!/^L\d{3,6}$/.test(code) || !/^\d{4}$/.test(pin)) return new Response(JSON.stringify({ error: "Invalid librarian code or PIN" }), { status: 401, headers });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: librarian, error: lookupError } = await admin.from("librarians").select("email").eq("code", code).maybeSingle();
  if (lookupError || !librarian?.email) return new Response(JSON.stringify({ error: "Invalid librarian code or PIN" }), { status: 401, headers });

  const { data, error } = await auth.auth.signInWithPassword({ email: librarian.email, password: "lib-pin-" + pin });
  if (error || !data.session) return new Response(JSON.stringify({ error: "Invalid librarian code or PIN" }), { status: 401, headers });
  return new Response(JSON.stringify({ session: data.session }), { status: 200, headers });
});