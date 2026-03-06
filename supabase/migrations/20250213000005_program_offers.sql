-- program_offers table for Offer Spot flow (programs with requires_approval = true)
-- Run this migration in Supabase to enable the Offer Spot feature.

-- Ensure programs has requires_approval column (Champions Premier = true, others = false)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS program_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES profiles(id),
  program_id uuid REFERENCES programs(id),
  plan_id uuid REFERENCES plans(id),
  offered_by uuid REFERENCES profiles(id),
  personal_message text,
  expires_at date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE program_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_offers_admin" ON program_offers FOR ALL
  USING ((select auth.uid()) IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'program_admin')
  ));

CREATE POLICY "program_offers_player_select" ON program_offers FOR SELECT
  USING ((select auth.uid()) = player_id);
