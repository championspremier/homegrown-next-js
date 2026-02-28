-- Player-level RLS policies for session completion and points tracking.
-- Players can SELECT and INSERT their own rows. No UPDATE or DELETE.

-- ═══════════════════════════════════════════
--  player_curriculum_progress
-- ═══════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.player_curriculum_progress') IS NOT NULL THEN
    -- Enable RLS if not already
    EXECUTE 'ALTER TABLE public.player_curriculum_progress ENABLE ROW LEVEL SECURITY';

    -- SELECT own rows
    DROP POLICY IF EXISTS "Players can select own progress" ON public.player_curriculum_progress;
    CREATE POLICY "Players can select own progress"
      ON public.player_curriculum_progress
      FOR SELECT TO authenticated
      USING (player_id = auth.uid());

    -- INSERT own rows
    DROP POLICY IF EXISTS "Players can insert own progress" ON public.player_curriculum_progress;
    CREATE POLICY "Players can insert own progress"
      ON public.player_curriculum_progress
      FOR INSERT TO authenticated
      WITH CHECK (player_id = auth.uid());
  ELSE
    RAISE NOTICE 'Skipping missing table: player_curriculum_progress';
  END IF;
END $$;

-- ═══════════════════════════════════════════
--  points_transactions
-- ═══════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.points_transactions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY';

    -- SELECT own rows
    DROP POLICY IF EXISTS "Players can select own points" ON public.points_transactions;
    CREATE POLICY "Players can select own points"
      ON public.points_transactions
      FOR SELECT TO authenticated
      USING (player_id = auth.uid());

    -- INSERT own rows
    DROP POLICY IF EXISTS "Players can insert own points" ON public.points_transactions;
    CREATE POLICY "Players can insert own points"
      ON public.points_transactions
      FOR INSERT TO authenticated
      WITH CHECK (player_id = auth.uid());
  ELSE
    RAISE NOTICE 'Skipping missing table: points_transactions';
  END IF;
END $$;
