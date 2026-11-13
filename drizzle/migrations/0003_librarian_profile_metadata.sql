CREATE OR REPLACE FUNCTION public.handle_new_librarian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.librarians(user_id, code, email, name)
  VALUES (
    NEW.id,
    'L' || lpad(nextval('public.librarian_code_seq')::text, 3, '0'),
    coalesce(NEW.email, ''),
    nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'name', '')), '')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = coalesce(EXCLUDED.name, public.librarians.name);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_librarian() FROM PUBLIC, anon, authenticated;
