-- Remove the superseded ID trigger so each insert has one deterministic code generator.
DROP TRIGGER IF EXISTS books_id ON public.books;
DROP TRIGGER IF EXISTS students_id ON public.students;

-- Give pre-migration accounts a usable display name without changing supplied names.
UPDATE public.librarians
SET name = 'Librarian'
WHERE name IS NULL OR btrim(name) = '';

-- Ensure every existing auth user has a librarian profile.
INSERT INTO public.librarians (user_id, code, email, name)
SELECT u.id,
       'L' || lpad(nextval('public.librarian_code_seq')::text, 3, '0'),
       coalesce(u.email, ''),
       coalesce(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''), 'Librarian')
FROM auth.users u
LEFT JOIN public.librarians l ON l.user_id = u.id
WHERE l.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
