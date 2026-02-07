-- SECURITY DEFINER RPC: return linked profiles for the authenticated user (either direction).
-- Used so parents/players can see linked accounts without relaxing profiles RLS.
-- Minimal fields: id, email, full_name, role.

CREATE OR REPLACE FUNCTION public.get_linked_profiles()
RETURNS TABLE (id uuid, email text, full_name text, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid)
  SELECT p.id, p.email, p.full_name, p.role
  FROM me
  JOIN public.parent_player_relationships r
    ON (r.parent_id = me.uid OR r.player_id = me.uid)
  JOIN public.profiles p
    ON (p.id = CASE WHEN r.parent_id = me.uid THEN r.player_id ELSE r.parent_id END)
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_linked_profiles() FROM public;
GRANT EXECUTE ON FUNCTION public.get_linked_profiles() TO authenticated;
