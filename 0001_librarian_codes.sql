CREATE TABLE public.librarians (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.librarians TO authenticated;
GRANT ALL ON public.librarians TO service_role;
ALTER TABLE public.librarians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own librarian code" ON public.librarians FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE SEQUENCE public.librarian_code_seq;
GRANT USAGE ON SEQUENCE public.librarian_code_seq TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_librarian() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.librarians(user_id, code, email)
  VALUES (NEW.id, 'L' || lpad(nextval('public.librarian_code_seq')::text, 3, '0'), coalesce(NEW.email, ''));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_librarian() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_librarian AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_librarian();

INSERT INTO public.librarians(user_id, code, email)
SELECT id, 'L' || lpad(nextval('public.librarian_code_seq')::text, 3, '0'), coalesce(email,'') FROM auth.users ORDER BY created_at;