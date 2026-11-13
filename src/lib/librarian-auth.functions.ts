import { supabaseStore } from "@/integrations/supabase/client";

export async function signUpLibrarian(input: { data: { email: string; name: string; pin: string } }) {
  const email = input.data.email.trim().toLowerCase();
  const name = input.data.name.trim();
  const pin = input.data.pin;

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error("Please enter a valid email");
  if (!name || name.length > 100) throw new Error("Please enter a librarian name (up to 100 characters)");
  if (!/^\\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");

  const { data, error } = await supabaseStore.functions.invoke("librarian-auth", {
    body: { action: "signup", email, name, pin },
  });
  if (error || !data?.session || !data?.code) {
    throw new Error(data?.error ?? error?.message ?? "Could not create your librarian account");
  }

  const { error: sessionError } = await supabaseStore.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw sessionError;

  return { code: data.code, session: true };
}

export async function signInLibrarian(input: { data: { code: string; pin: string } }) {
  const code = input.data.code.trim().toUpperCase();
  const pin = input.data.pin;
  if (!/^L\\d{6}$/.test(code)) throw new Error("Enter your 7-character librarian code");
  if (!/^\\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");

  const { data, error } = await supabaseStore.functions.invoke("librarian-auth", {
    body: { action: "login", code, pin },
  });
  if (error || !data?.session) {
    throw new Error(data?.error ?? "Invalid librarian code or PIN");
  }

  const { error: sessionError } = await supabaseStore.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw sessionError;
}