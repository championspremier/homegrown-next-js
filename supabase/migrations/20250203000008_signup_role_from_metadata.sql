-- Set profile role from signup metadata. Only allow 'parent' or 'player'; default 'parent'.
-- ON CONFLICT still updates email only (do not overwrite role).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_meta text := NULLIF(TRIM(new.raw_user_meta_data->>'role'), '');
  role_val text := 'parent';
BEGIN
  IF LOWER(role_meta) = 'player' THEN
    role_val := 'player';
  ELSE
    role_val := 'parent';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    role_val
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
  RETURN new;
END;
$$;
