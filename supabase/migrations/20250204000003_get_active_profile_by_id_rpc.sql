-- SECURITY DEFINER: return profile row for p_id only when it's self or linked (so layouts can load active profile without relaxing RLS).

CREATE OR REPLACE FUNCTION public.get_active_profile_by_id(p_id uuid)
RETURNS TABLE (id uuid, email text, full_name text, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name, p.role
  FROM public.profiles p
  WHERE p.id = p_id
    AND (
      p.id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.parent_player_relationships r
        WHERE (r.parent_id = auth.uid() AND r.player_id = p.id)
           OR (r.player_id = auth.uid() AND r.parent_id = p.id)
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_active_profile_by_id(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_active_profile_by_id(uuid) TO authenticated;
