-- Ensure profiles.role is never null: default, backfill, NOT NULL, and RLS for profile repair.

-- Default and backfill
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'parent';
UPDATE public.profiles SET role = 'parent' WHERE role IS NULL;

-- Enforce NOT NULL (idempotent if already NOT NULL)
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

-- Allow authenticated users to insert their own profile row (for server-side repair when missing)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
