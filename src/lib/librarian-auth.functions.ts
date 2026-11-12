import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const pinOk = (pin: unknown) => typeof pin === "string" && /^\d{4}$/.test(pin);

// Creates the account and returns the librarian code assigned by the database trigger.
export const signUpLibrarian = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; name: string; pin: string; redirectTo: string }) => {
    const email = String(d.email ?? "").trim().toLowerCase();
    const name = String(d.name ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email");
    if (!name || name.length > 100) throw new Error("Please enter a librarian name (up to 100 characters)");
    if (!pinOk(d.pin)) throw new Error("PIN must be exactly 4 digits");
    return { email, name, pin: d.pin, redirectTo: String(d.redirectTo ?? "") };
  })
  .handler(async ({ data }) => {
    const client = publicClient();
    const { data: res, error } = await client.auth.signUp({
      email: data.email,
      password: `lib-pin-${data.pin}`,
      ...(data.redirectTo ? { options: { emailRedirectTo: data.redirectTo } } : {}),
    });
    if (error) throw new Error(error.message.includes("registered") ? "That email is already registered" : error.message);
    const user = res.user;
    if (!user || (user.identities?.length ?? 0) === 0) throw new Error("That email is already registered");

    // Email confirmation must be disabled for this flow to receive a session immediately.
    // The RLS policy permits the signed-in user to read only their own librarian code.
    if (!res.session) {
      throw new Error("Account created, but no session was returned. In Supabase, turn off Confirm email and try again.");
    }
    const { error: sessionError } = await client.auth.setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    });
    if (sessionError) throw new Error("Account created, but could not establish a session. Please sign in.");

    const { error: nameError } = await client
      .from("librarians")
      .update({ name: data.name })
      .eq("user_id", user.id);
    if (nameError) throw new Error("Account created, but the librarian name could not be saved. Please sign in and contact support if it persists.");

    const { data: row, error: lookupError } = await client
      .from("librarians")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) throw new Error("Account created, but the librarian code could not be loaded. Please try signing in.");
    if (!row?.code) throw new Error("Account created, but the librarian code has not been assigned. Please contact support.");

    return {
      code: row.code,
      session: { access_token: res.session.access_token, refresh_token: res.session.refresh_token },
    };
  });

// Signs in with a librarian code (e.g. L001) and PIN. The email is never sent to the browser.
export const signInWithLibrarianCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; pin: string }) => {
    const code = String(d.code ?? "").trim().toUpperCase();
    if (!/^L\d{3,}$/.test(code)) throw new Error("Wrong code or PIN");
    if (!pinOk(d.pin)) throw new Error("Wrong code or PIN");
    return { code, pin: d.pin };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: lookupError } = await supabaseAdmin.from("librarians").select("email").eq("code", data.code).maybeSingle();
    if (lookupError || !row?.email) throw new Error("Wrong code or PIN");
    const { data: res, error } = await publicClient().auth.signInWithPassword({ email: row.email, password: `lib-pin-${data.pin}` });
    if (error || !res.session) {
      throw new Error("Wrong code or PIN");
    }
    return { access_token: res.session.access_token, refresh_token: res.session.refresh_token };
  });


// Deletes only the currently authenticated librarian's account.
export const deleteLibrarianAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => {
    const accessToken = String(d.accessToken ?? "").trim();
    if (!accessToken || accessToken.length > 8192) throw new Error("Please sign in again before deleting your account.");
    return { accessToken };
  })
  .handler(async ({ data }) => {
    const client = publicClient();
    const { data: authData, error: authError } = await client.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (error) throw new Error("Could not delete your account. Please contact support.");
    return { success: true };
  });
