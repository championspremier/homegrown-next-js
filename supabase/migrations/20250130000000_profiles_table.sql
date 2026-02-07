-- Create profiles table (required before trigger + RLS migration).
-- id matches auth.users.id; role defaults to 'parent'.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'player', 'coach', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
