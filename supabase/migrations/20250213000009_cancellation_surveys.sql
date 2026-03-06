-- Cancellation surveys: capture feedback before plan cancellation
CREATE TABLE IF NOT EXISTS cancellation_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES profiles(id),
  plan_id uuid REFERENCES plans(id),
  subscription_id uuid REFERENCES plan_subscriptions(id),
  primary_reason text NOT NULL,
  additional_feedback text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cancellation_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancellation_surveys_insert" ON cancellation_surveys FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "cancellation_surveys_admin_select" ON cancellation_surveys FOR SELECT
  USING ((SELECT auth.uid()) IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'program_admin')
  ));
