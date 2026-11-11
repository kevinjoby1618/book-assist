ALTER TABLE public.librarians ADD COLUMN IF NOT EXISTS name text;
GRANT SELECT ON public.librarians TO authenticated;
GRANT UPDATE (name) ON public.librarians TO authenticated;
GRANT ALL ON public.librarians TO service_role;
CREATE POLICY "update own librarian name" ON public.librarians FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);