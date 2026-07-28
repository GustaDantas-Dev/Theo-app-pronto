
-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  patient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit_logs" ON audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- system_settings (singleton)
CREATE TABLE IF NOT EXISTS system_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  medication_delay_limit_minutes integer NOT NULL DEFAULT 30,
  hydration_goal_daily integer NOT NULL DEFAULT 2000,
  pressure_high_systolic integer NOT NULL DEFAULT 140,
  pressure_high_diastolic integer NOT NULL DEFAULT 90,
  inactivity_limit_hours integer NOT NULL DEFAULT 24,
  critical_alert_timeout_hours integer NOT NULL DEFAULT 2,
  stock_warning_limit integer NOT NULL DEFAULT 5,
  stock_critical_limit integer NOT NULL DEFAULT 3,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_settings" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_update_settings" ON system_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_insert_settings" ON system_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- seed default row
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- expand emergency_alerts
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS urgency_level text NOT NULL DEFAULT 'high';
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS response_time_minutes integer;

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
