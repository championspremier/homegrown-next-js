-- Parent/player RLS on public.parent_player_relationships. Additive with admin.
-- Parents: select/insert/delete own rows. Players: select rows where player_id = self. Admins: full access.
-- Use (select auth.uid()) for linter. No UPDATE (rows immutable).

ALTER TABLE public.parent_player_relationships ENABLE ROW LEVEL SECURITY;

-- Replace admin-only policies with combined policies (one per action)
DROP POLICY IF EXISTS "Admins can select parent_player_relationships" ON public.parent_player_relationships;
DROP POLICY IF EXISTS "Admins can insert parent_player_relationships" ON public.parent_player_relationships;
DROP POLICY IF EXISTS "Admins can update parent_player_relationships" ON public.parent_player_relationships;
DROP POLICY IF EXISTS "Admins can delete parent_player_relationships" ON public.parent_player_relationships;

CREATE POLICY "Parent player relationships: select"
  ON public.parent_player_relationships FOR SELECT
  TO authenticated
  USING (
    parent_id = (SELECT auth.uid())
    OR player_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Parent player relationships: insert"
  ON public.parent_player_relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Parent player relationships: delete"
  ON public.parent_player_relationships FOR DELETE
  TO authenticated
  USING (
    parent_id = (SELECT auth.uid())
    OR public.is_admin()
  );
