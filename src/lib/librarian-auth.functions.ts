import { ID, Permission, Role } from "appwrite";
import { account, tablesDB, APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client";

export async function signUpLibrarian(input: { data: { email: string; name: string; pin: string } }) {
  const email = input.data.email.trim().toLowerCase();
  const name = input.data.name.trim();
  const pin = input.data.pin;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email");
  if (!name || name.length > 100) throw new Error("Please enter a librarian name (up to 100 characters)");
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");
  const user = await account.create({ userId: ID.unique(), email, password: `lib-pin-${pin}`, name });
  await account.createEmailPasswordSession({ email, password: `lib-pin-${pin}` });
  const code = `L${Math.floor(100000 + Math.random() * 900000)}`;
  await tablesDB.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: "librarians",
    rowId: user.$id,
    data: { user_id: user.$id, email, name, code },
    permissions: [Permission.read(Role.user(user.$id)), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))],
  });
  return { code, session: { user } };
}

export async function signInWithLibrarianCode() {
  throw new Error("Sign in with your email address and PIN. The librarian code is for identification.");
}
