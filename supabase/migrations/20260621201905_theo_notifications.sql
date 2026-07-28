
-- ── notifications table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  to_user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patient_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type          text NOT NULL,
  -- 'med_taken' | 'medication_late' | 'high_pressure' | 'low_hydration'
  -- | 'inactive_patient' | 'stock_low' | 'new_medication' | 'med_edited'
  -- | 'carer_message' | 'admin_alert' | 'emergency'
  title         text NOT NULL,
  message       text,
  severity      text NOT NULL DEFAULT 'info',
  -- 'info' | 'warning' | 'critical'
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can read their own notifications
CREATE POLICY "read_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = to_user_id);

-- Any authenticated user can insert (cross-profile communication)
CREATE POLICY "insert_notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can mark their own notifications read
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- Users can delete their own notifications
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = to_user_id);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON notifications(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_patient  ON notifications(patient_id);

-- Enable Supabase Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
