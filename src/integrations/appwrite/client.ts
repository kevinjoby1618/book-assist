import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
} from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

if (!endpoint || !projectId) {
  throw new Error("Missing VITE_APPWRITE_ENDPOINT or VITE_APPWRITE_PROJECT_ID.");
}

export const client = new Client().setEndpoint(endpoint).setProject(projectId);
export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);

export const APPWRITE_DATABASE_ID = "book_assist_db";
export const STUDENT_FACES_BUCKET_ID = "student-faces";

type AppwriteUser = Awaited<ReturnType<Account["get"]>> & { id: string };

export async function getCurrentUser(): Promise<AppwriteUser> {
  const user = await account.get();
  return { ...user, id: user.$id };
}

function userPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function tableId(table: string) {
  if (!["books", "students", "transactions", "librarians"].includes(table)) {
    throw new Error(`Unknown Book Assist table: ${table}`);
  }
  return table;
}

function generatedCode(prefix: "B" | "S") {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `${prefix}-${part}`;
}

type Filter = { field: string; value: unknown };

class AppwriteQuery {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: Record<string, unknown> = {};
  private filters: Filter[] = [];
  private orderBy: { field: string; ascending: boolean } | null = null;
  private returning = false;

  constructor(private readonly table: string) {}

  select(_fields?: string) {
    this.returning = true;
    return this;
  }

  insert(data: Record<string, unknown>) {
    this.action = "insert";
    this.payload = data;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.action = "update";
    this.payload = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderBy = { field, ascending: options?.ascending !== false };
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error };
  }

  async single() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error };
  }

  then(resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const user = await getCurrentUser();
      const id = tableId(this.table);
      const ownerField = id === "librarians" ? "user_id" : "owner_id";
      const queries = [
        Query.equal(ownerField, user.$id),
        ...this.filters.map(({ field, value }) => Query.equal(field, value as string | number | boolean | string[])),
        ...(this.orderBy
          ? [this.orderBy.ascending ? Query.orderAsc(this.orderBy.field) : Query.orderDesc(this.orderBy.field)]
          : []),
        Query.limit(100),
      ];

      if (this.action === "select") {
        const result = await tablesDB.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: id, queries });
        const rows = result.rows.map((row: any) => {
          const mapped = { ...row };
          delete mapped.$databaseId;
          delete mapped.$tableId;
          if (id === "transactions") mapped.transaction_id = row.$id;
          return mapped;
        });
        return { data: rows, error: null };
      }

      if (this.action === "insert") {
        const data = { ...this.payload };
        if (id !== "librarians") {
          data.owner_id = user.$id;
          data.created_at = data.created_at ?? new Date().toISOString();
          if (id === "books" && !data.book_id) data.book_id = generatedCode("B");
          if (id === "students" && !data.student_id) data.student_id = generatedCode("S");
        }
        const row = await tablesDB.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: id,
          rowId: ID.unique(),
          data,
          permissions: userPermissions(user.$id),
        });
        return { data: this.returning ? [row] : null, error: null };
      }

      const result = await tablesDB.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: id, queries });
      const rows = result.rows as Array<{ $id: string }>;
      for (const row of rows) {
        if (this.action === "update") {
          await tablesDB.updateRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: id,
            rowId: row.$id,
            data: this.payload,
          });
        } else {
          await tablesDB.deleteRow({ databaseId: APPWRITE_DATABASE_ID, tableId: id, rowId: row.$id });
        }
      }
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}

function emitAuthChange(event: "SIGNED_IN" | "SIGNED_OUT", user?: AppwriteUser) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("book-assist-auth-change", { detail: { event, user } }));
  }
}

async function runBookTransaction(
  operation: "issue_book" | "return_book",
  args: { _book_id: string; _student_id: string },
) {
  try {
    const user = await getCurrentUser();
    const base = [
      Query.equal("owner_id", user.$id),
      Query.equal("book_id", args._book_id),
      Query.limit(1),
    ];
    const [bookResult, studentResult] = await Promise.all([
      tablesDB.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: "books", queries: base }),
      tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "students",
        queries: [Query.equal("owner_id", user.$id), Query.equal("student_id", args._student_id), Query.limit(1)],
      }),
    ]);
    const book = bookResult.rows[0] as any;
    const student = studentResult.rows[0] as any;
    if (!book) throw new Error("Book not found in this library.");
    if (!student) throw new Error("Student not found in this library.");

    if (operation === "issue_book") {
      if (book.availability !== "Available") throw new Error("This book is already issued.");
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);
      const tx = await tablesDB.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "transactions",
        rowId: ID.unique(),
        data: {
          owner_id: user.$id,
          book_id: book.book_id,
          book_title: book.title,
          student_id: student.student_id,
          student_name: student.name,
          issue_date: issueDate.toISOString(),
          due_date: dueDate.toISOString(),
          return_date: null,
          status: "Issued",
          created_at: issueDate.toISOString(),
        },
        permissions: userPermissions(user.$id),
      });
      try {
        await tablesDB.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: "books",
          rowId: book.$id,
          data: { availability: "Issued" },
        });
      } catch (error) {
        await tablesDB.deleteRow({ databaseId: APPWRITE_DATABASE_ID, tableId: "transactions", rowId: tx.$id });
        throw error;
      }
    } else {
      const txResult = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "transactions",
        queries: [
          Query.equal("owner_id", user.$id),
          Query.equal("book_id", args._book_id),
          Query.equal("student_id", args._student_id),
          Query.equal("status", "Issued"),
          Query.orderDesc("created_at"),
          Query.limit(1),
        ],
      });
      const tx = txResult.rows[0] as any;
      if (!tx) throw new Error("No active issue record was found for this student and book.");
      await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "transactions",
        rowId: tx.$id,
        data: { status: "Returned", return_date: new Date().toISOString() },
      });
      await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "books",
        rowId: book.$id,
        data: { availability: "Available" },
      });
    }
    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

// A small compatibility surface keeps the existing Book Assist screens intact while
// moving authentication, records, and book transactions to Appwrite.
export const supabase: any = {
  auth: {
    async getUser() {
      try {
        return { data: { user: await getCurrentUser() }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
    async getSession() {
      try {
        return { data: { session: { user: await getCurrentUser() } }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        await account.createEmailPasswordSession({ email, password });
        const user = await getCurrentUser();
        emitAuthChange("SIGNED_IN", user);
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
    async setSession(_session: unknown) {
      return { error: null };
    },
    async signOut() {
      try {
        await account.deleteSession({ sessionId: "current" });
        emitAuthChange("SIGNED_OUT");
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    onAuthStateChange(callback: (event: string, session: unknown) => void) {
      const listener = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        callback(detail.event, detail.user ? { user: detail.user } : null);
      };
      window.addEventListener("book-assist-auth-change", listener);
      return {
        data: {
          subscription: {
            unsubscribe() {
              window.removeEventListener("book-assist-auth-change", listener);
            },
          },
        },
      };
    },
  },
  from(table: string) {
    return new AppwriteQuery(table);
  },
  async rpc(name: "issue_book" | "return_book", args: { _book_id: string; _student_id: string }) {
    return runBookTransaction(name, args);
  },
};
