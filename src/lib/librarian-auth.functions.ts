import { supabaseStore } from "@/integrations/supabase/client";

function createLibrarianCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return `L${String(value[0] % 1_000_000).padStart(6, "0")}`;
}

export async function signUpLibrarian(input: { data: { email: string; name: string; pin: string } }) {
  const email = input.data.email.trim().toLowerCase();
  const name = input.data.name.trim();
  const pin = input.data.pin;

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error("Please enter a valid email");
  if (!name || name.length > 100) throw new Error("Please enter a librarian name (up to 100 characters)");
  if (!/^\\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");

  // The code is generated before signup so it can be shown even when Supabase
  // requires email confirmation and therefore does not return a session.
  const code = createLibrarianCode();
  const { data, error } = await supabaseStore.auth.signUp({
    email,
    password: `lib-pin-${pin}`,
    options: { data: { name, librarian_code: code } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase did not return a new librarian account.");
  if (data.user.identities?.length === 0) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }

  if (data.session) {
    const { error: profileError } = await supabaseStore
      .from("librarians")
      .update({ name, email })
      .eq("user_id", data.user.id);
    if (profileError) throw profileError;
  }

  return { code, session: data.session, user: data.user };
}
