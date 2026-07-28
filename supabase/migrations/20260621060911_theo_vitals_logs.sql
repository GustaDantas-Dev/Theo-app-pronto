-- ── VITALS_LOGS ──────────────────────────────────────────────────────────────
-- Stores patient vital sign measurements (blood pressure, glucose, etc.)
CREATE TABLE IF NOT EXISTS vitals_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type           text NOT NULL DEFAULT 'blood_pressure'
                   CHECK (type IN ('blood_pressure','glucose','temperature','oxygen','heart_rate','weight','hydration')),
  systolic       int,
  diastolic      int,
  value          numeric,
  unit           text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vitals_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vitals" ON vitals_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_vitals" ON vitals_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_vitals" ON vitals_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_vitals" ON vitals_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "carers_select_linked_vitals" ON vitals_logs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = vitals_logs.user_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_vitals_logs_user ON vitals_logs(user_id, recorded_at DESC);
