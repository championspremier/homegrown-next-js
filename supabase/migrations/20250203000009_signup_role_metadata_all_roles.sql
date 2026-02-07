-- Set profile role from signup metadata. Allow parent/player/coach/admin; unknown or empty → 'parent'.
-- ON CONFLICT still updates email only (do not overwrite role).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_meta text := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'role', '')));
  role_val text := 'parent';
BEGIN
  IF role_meta IN ('parent', 'player', 'coach', 'admin') THEN
    role_val := role_meta;
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
