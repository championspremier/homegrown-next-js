-- Optimize public.profiles RLS: single policy per action, (select auth.uid()) to avoid initplan warnings.
-- Same behavior: users select/update own; admins select/update all; insert own or admin. Idempotent.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing separate user + admin policies
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can select all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Single SELECT policy: own row or admin
CREATE POLICY "Profiles: select own or admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_admin()
  );

-- Single UPDATE policy: own row or admin
CREATE POLICY "Profiles: update own or admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR public.is_admin()
  );

-- Single INSERT policy: own row or admin (keeps profile repair + admin create if needed)
CREATE POLICY "Profiles: insert own or admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    OR public.is_admin()
  );
