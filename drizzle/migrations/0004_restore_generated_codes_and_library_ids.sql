-- Keep this migration in source control alongside the live Supabase migration.
CREATE OR REPLACE FUNCTION public.handle_new_librarian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_code text;
BEGIN
  assigned_code := CASE
    WHEN coalesce(NEW.raw_user_meta_data ->> 'librarian_code', '') ~ '^L[0-9]{6}$'
      THEN NEW.raw_user_meta_data ->> 'librarian_code'
    ELSE 'L' || lpad(nextval('public.librarian_code_seq')::text, 3, '0')
  END;

  INSERT INTO public.librarians(user_id, code, email, name)
  VALUES (
    NEW.id,
    assigned_code,
    coalesce(NEW.email, ''),
    coalesce(nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'name', '')), ''), 'Librarian')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = coalesce(nullif(EXCLUDED.name, ''), public.librarians.name);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_librarian() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS books_assign_code ON public.books;
CREATE TRIGGER books_assign_code BEFORE INSERT ON public.books
FOR EACH ROW EXECUTE FUNCTION public.assign_book_code();

DROP TRIGGER IF EXISTS students_assign_code ON public.students;
CREATE TRIGGER students_assign_code BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.assign_student_code();

INSERT INTO public.librarians (user_id, code, email, name)
SELECT u.id,
       'L' || lpad(nextval('public.librarian_code_seq')::text, 3, '0'),
       coalesce(u.email, ''),
       coalesce(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''), 'Librarian')
FROM auth.users u
LEFT JOIN public.librarians l ON l.user_id = u.id
WHERE l.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
