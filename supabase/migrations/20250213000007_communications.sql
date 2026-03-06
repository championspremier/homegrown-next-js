-- communications table for Communication Timeline in Users Edit Modal
CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES profiles(id),
  contact_id uuid REFERENCES profiles(id),
  author_id uuid REFERENCES profiles(id),
  type text NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'note', 'plan_change', 'offer', 'rating', 'notification')),
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communications_player_id ON communications(player_id);
CREATE INDEX IF NOT EXISTS idx_communications_created_at ON communications(created_at DESC);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communications_admin" ON communications FOR ALL
  USING ((select auth.uid()) IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'program_admin')
  ));
