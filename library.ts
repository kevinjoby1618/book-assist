import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const studentsQuery = queryOptions({
  queryKey: ["students"],
  queryFn: async () => {
    const { data, error } = await supabase.from("students").select("student_id, name, class, section, face_image, created_at").order("student_id");
    if (error) throw error;
    return data;
  },
});

export const booksQuery = queryOptions({
  queryKey: ["books"],
  queryFn: async () => {
    const { data, error } = await supabase.from("books").select("*").order("book_id");
    if (error) throw error;
    return data;
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export function isOverdue(t: { status: string; due_date: string }) {
  return t.status === "Issued" && new Date(t.due_date) < new Date(new Date().toDateString());
}
