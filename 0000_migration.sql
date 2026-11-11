CREATE TABLE public.books (
  book_id text NOT NULL, owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL, author text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '',
  availability text NOT NULL DEFAULT 'Available', created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, book_id));
CREATE TABLE public.students (
  student_id text NOT NULL, owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, class text NOT NULL DEFAULT '', section text NOT NULL DEFAULT '',
  face_image text, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, student_id));
CREATE TABLE public.transactions (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(),
  book_id text NOT NULL, book_title text NOT NULL, student_id text NOT NULL, student_name text NOT NULL,
  issue_date date NOT NULL DEFAULT current_date, due_date date NOT NULL DEFAULT current_date + 14,
  return_date date, status text NOT NULL DEFAULT 'Issued', created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.books, public.students, public.transactions TO authenticated;
GRANT ALL ON public.books, public.students, public.transactions TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own books" ON public.books FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own students" ON public.students FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own transactions" ON public.transactions FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.assign_library_id() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF TG_TABLE_NAME = 'books' THEN
    IF coalesce(NEW.book_id,'') = '' THEN
      PERFORM pg_advisory_xact_lock(hashtext('books' || NEW.owner_id::text));
      SELECT coalesce(max(substring(book_id from 3)::int),0)+1 INTO n FROM books WHERE owner_id = NEW.owner_id AND book_id ~ '^BK[0-9]+$';
      NEW.book_id := 'BK' || lpad(n::text,4,'0');
    END IF;
  ELSE
    IF coalesce(NEW.student_id,'') = '' THEN
      PERFORM pg_advisory_xact_lock(hashtext('students' || NEW.owner_id::text));
      SELECT coalesce(max(substring(student_id from 2)::int),0)+1 INTO n FROM students WHERE owner_id = NEW.owner_id AND student_id ~ '^S[0-9]+$';
      NEW.student_id := 'S' || lpad(n::text,4,'0');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER books_id BEFORE INSERT ON public.books FOR EACH ROW EXECUTE FUNCTION public.assign_library_id();
CREATE TRIGGER students_id BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.assign_library_id();
REVOKE EXECUTE ON FUNCTION public.assign_library_id() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_book(_book_id text, _student_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b books; s students; tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO b FROM books WHERE owner_id = uid AND book_id = _book_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Book not found'; END IF;
  SELECT * INTO s FROM students WHERE owner_id = uid AND student_id = _student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF b.availability <> 'Available' THEN RAISE EXCEPTION 'This book is already issued'; END IF;
  UPDATE books SET availability = 'Issued' WHERE owner_id = uid AND book_id = _book_id;
  INSERT INTO transactions(owner_id, book_id, book_title, student_id, student_name)
    VALUES (uid, b.book_id, b.title, s.student_id, s.name) RETURNING transaction_id INTO tid;
  RETURN tid::text;
END $$;

CREATE OR REPLACE FUNCTION public.return_book(_book_id text, _student_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT transaction_id INTO tid FROM transactions
    WHERE owner_id = uid AND book_id = _book_id AND student_id = _student_id AND status = 'Issued'
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF tid IS NULL THEN RAISE EXCEPTION 'This student has not borrowed this book'; END IF;
  UPDATE transactions SET status = 'Returned', return_date = current_date WHERE transaction_id = tid;
  UPDATE books SET availability = 'Available' WHERE owner_id = uid AND book_id = _book_id;
  RETURN tid::text;
END $$;
REVOKE EXECUTE ON FUNCTION public.issue_book(text,text), public.return_book(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_book(text,text), public.return_book(text,text) TO authenticated;