-- Enable RLS and add admin-only policies on core tables. Additive, idempotent.
-- Uses existing public.is_admin(). No coach/parent/player policies. No profiles changes.

-- 1. coach_availability
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select coach_availability" ON public.coach_availability;
CREATE POLICY "Admins can select coach_availability" ON public.coach_availability
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert coach_availability" ON public.coach_availability;
CREATE POLICY "Admins can insert coach_availability" ON public.coach_availability
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update coach_availability" ON public.coach_availability;
CREATE POLICY "Admins can update coach_availability" ON public.coach_availability
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete coach_availability" ON public.coach_availability;
CREATE POLICY "Admins can delete coach_availability" ON public.coach_availability
  FOR DELETE TO authenticated USING (public.is_admin());

-- 2. sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select sessions" ON public.sessions;
CREATE POLICY "Admins can select sessions" ON public.sessions
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert sessions" ON public.sessions;
CREATE POLICY "Admins can insert sessions" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update sessions" ON public.sessions;
CREATE POLICY "Admins can update sessions" ON public.sessions
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete sessions" ON public.sessions;
CREATE POLICY "Admins can delete sessions" ON public.sessions
  FOR DELETE TO authenticated USING (public.is_admin());

-- 3. session_reservations
ALTER TABLE public.session_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select session_reservations" ON public.session_reservations;
CREATE POLICY "Admins can select session_reservations" ON public.session_reservations
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert session_reservations" ON public.session_reservations;
CREATE POLICY "Admins can insert session_reservations" ON public.session_reservations
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update session_reservations" ON public.session_reservations;
CREATE POLICY "Admins can update session_reservations" ON public.session_reservations
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete session_reservations" ON public.session_reservations;
CREATE POLICY "Admins can delete session_reservations" ON public.session_reservations
  FOR DELETE TO authenticated USING (public.is_admin());

-- 4. parent_player_relationships
ALTER TABLE public.parent_player_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select parent_player_relationships" ON public.parent_player_relationships;
CREATE POLICY "Admins can select parent_player_relationships" ON public.parent_player_relationships
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert parent_player_relationships" ON public.parent_player_relationships;
CREATE POLICY "Admins can insert parent_player_relationships" ON public.parent_player_relationships
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update parent_player_relationships" ON public.parent_player_relationships;
CREATE POLICY "Admins can update parent_player_relationships" ON public.parent_player_relationships
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete parent_player_relationships" ON public.parent_player_relationships;
CREATE POLICY "Admins can delete parent_player_relationships" ON public.parent_player_relationships
  FOR DELETE TO authenticated USING (public.is_admin());
