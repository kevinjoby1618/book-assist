-- Each librarian has an independent student/book code namespace.
-- Existing records and IDs are preserved.
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_pkey;
ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (owner_id, student_id);

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_pkey;
ALTER TABLE public.books ADD CONSTRAINT books_pkey PRIMARY KEY (owner_id, book_id);

CREATE OR REPLACE FUNCTION public.assign_student_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_number bigint;
BEGIN
  IF new.owner_id IS NULL THEN
    new.owner_id := auth.uid();
  END IF;
  IF new.owner_id IS NULL THEN
    RAISE EXCEPTION 'A librarian account is required to register a student';
  END IF;

  IF new.student_id IS NULL OR btrim(new.student_id) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('students:' || new.owner_id::text)::bigint);
    SELECT COALESCE(MAX(substring(student_id from 2)::bigint), 0) + 1
      INTO next_number
      FROM public.students
      WHERE owner_id = new.owner_id AND student_id ~ '^S[0-9]+$';
    new.student_id := 'S' || lpad(next_number::text, 3, '0');
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_book_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_number bigint;
BEGIN
  IF new.owner_id IS NULL THEN
    new.owner_id := auth.uid();
  END IF;
  IF new.owner_id IS NULL THEN
    RAISE EXCEPTION 'A librarian account is required to register a book';
  END IF;

  IF new.book_id IS NULL OR btrim(new.book_id) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('books:' || new.owner_id::text)::bigint);
    SELECT COALESCE(MAX(substring(book_id from 2)::bigint), 0) + 1
      INTO next_number
      FROM public.books
      WHERE owner_id = new.owner_id AND book_id ~ '^B[0-9]+$';
    new.book_id := 'B' || lpad(next_number::text, 3, '0');
  END IF;
  RETURN new;
END;
$function$;
