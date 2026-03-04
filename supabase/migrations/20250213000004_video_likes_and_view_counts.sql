-- Add like_count and view_count columns to solo_session_videos
ALTER TABLE solo_session_videos
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Create video_likes table
CREATE TABLE IF NOT EXISTS video_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES solo_session_videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, video_id)
);

ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own likes"
  ON video_likes FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players can insert their own likes"
  ON video_likes FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can delete their own likes"
  ON video_likes FOR DELETE
  USING (auth.uid() = player_id);

-- RPC: increment_video_view — atomically bumps view_count by 1
CREATE OR REPLACE FUNCTION increment_video_view(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE solo_session_videos
  SET view_count = view_count + 1
  WHERE id = p_video_id;
END;
$$;

-- RPC: toggle_video_like — inserts or deletes a like, updates like_count, returns new liked state
CREATE OR REPLACE FUNCTION toggle_video_like(p_player_id uuid, p_video_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM video_likes WHERE player_id = p_player_id AND video_id = p_video_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM video_likes WHERE player_id = p_player_id AND video_id = p_video_id;
    UPDATE solo_session_videos SET like_count = GREATEST(like_count - 1, 0) WHERE id = p_video_id;
    RETURN false;
  ELSE
    INSERT INTO video_likes (player_id, video_id) VALUES (p_player_id, p_video_id);
    UPDATE solo_session_videos SET like_count = like_count + 1 WHERE id = p_video_id;
    RETURN true;
  END IF;
END;
$$;
