-- SECURITY DEFINER RPC: look up a player profile by exact email (id, email, role only).
-- Used by parents to link players by email without relaxing profiles RLS.
-- Revoke public, grant execute to authenticated only.

CREATE OR REPLACE FUNCTION public.find_player_profile_by_email(p_email text)
RETURNS TABLE (id uuid, email text, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.email, p.role
  FROM public.profiles p
  WHERE lower(p.email) = lower(p_email)
    AND lower(p.role) = 'player'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_player_profile_by_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_player_profile_by_email(text) TO authenticated;

-- Optional: index for fast lookup by normalized email
CREATE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles ((lower(email)));
