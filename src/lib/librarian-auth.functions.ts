import { supabaseStore } from "@/integrations/supabase/client";

export async function signUpLibrarian(input: { data: { email: string; name: string; pin: string } }) {
  const email = input.data.email.trim().toLowerCase();
  const name = input.data.name.trim();
  const pin = input.data.pin;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email");
  if (!name || name.length > 100) throw new Error("Please enter a librarian name (up to 100 characters)");
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");

  const { data, error } = await supabaseStore.auth.signUp({
    email,
    password: `lib-pin-${pin}`,
    options: { data: { name } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase did not return a new librarian account.");

  let code = "";
  if (data.session) {
    const { error: profileError } = await supabaseStore
      .from("librarians")
      .update({ name, email })
      .eq("user_id", data.user.id);
    if (profileError) throw profileError;

    const { data: profile, error: lookupError } = await supabaseStore
      .from("librarians")
      .select("code")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    code = profile?.code ?? "";
  }

  return { code, session: data.session, user: data.user };
}
