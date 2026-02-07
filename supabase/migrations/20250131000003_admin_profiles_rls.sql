-- Allow admins to list all profiles and update any profile's role (for role management).
-- Assumes public.profiles exists with role column.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Admins can select all profiles (for /admin/users list)
DROP POLICY IF EXISTS "Admins can select all profiles" ON public.profiles;
CREATE POLICY "Admins can select all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update any profile (server action restricts to role column only)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
