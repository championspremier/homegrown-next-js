-- Allow players to complete the same solo session on different days.
-- Session completions: one per session per day (can redo tomorrow).
-- Video watches (tactical reels): one per video ever.

-- Remove the old unique constraint that prevents any re-completion
ALTER TABLE public.player_curriculum_progress
  DROP CONSTRAINT IF EXISTS player_curriculum_progress_player_id_session_id_video_id_key;

-- Daily uniqueness for session completions (video_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_curriculum_progress_daily_unique
  ON public.player_curriculum_progress (player_id, session_id, (completed_at::date))
  WHERE video_id IS NULL;

-- Per-video uniqueness for tactical reel watches (video_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_curriculum_progress_video_unique
  ON public.player_curriculum_progress (player_id, video_id)
  WHERE video_id IS NOT NULL;
