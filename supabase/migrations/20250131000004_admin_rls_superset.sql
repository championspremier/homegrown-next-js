-- Admin RLS superset: add SELECT/INSERT/UPDATE/DELETE policies for admins on core tables.
-- Uses existing public.is_admin(). Additive only; does not remove or loosen existing policies.
-- Only applies to tables that exist; skips missing tables so the migration never fails.

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'parent_player_relationships',
    'coach_availability',
    'individual_session_types',
    'individual_session_bookings',
    'sessions',
    'session_reservations',
    'solo_sessions',
    'solo_session_videos',
    'player_solo_session_bookings',
    'player_curriculum_progress',
    'quiz_questions',
    'quiz_assignments',
    'skill_thumbnails',
    'notifications',
    'coach_messages',
    'session_types',
    'group_reservations',
    'group_sessions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Skipping missing table: %', tbl;
    ELSE
      EXECUTE format('DROP POLICY IF EXISTS "Admins can select %s" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "Admins can select %s" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', tbl, tbl);

      EXECUTE format('DROP POLICY IF EXISTS "Admins can insert %s" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "Admins can insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', tbl, tbl);

      EXECUTE format('DROP POLICY IF EXISTS "Admins can update %s" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "Admins can update %s" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', tbl, tbl);

      EXECUTE format('DROP POLICY IF EXISTS "Admins can delete %s" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "Admins can delete %s" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', tbl, tbl);
    END IF;
  END LOOP;
END $$;
