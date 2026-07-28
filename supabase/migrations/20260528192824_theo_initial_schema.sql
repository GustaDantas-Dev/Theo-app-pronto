/*
  # THEO — Initial Schema

  Creates all tables for the THEO medication assistant:
  profiles, carer_patient_links, medications, dose_logs,
  health_logs, appointments, emergency_alerts.
  RLS enabled on all tables with appropriate policies.
*/

-- ── PROFILES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name            text NOT NULL DEFAULT '',
  role            text NOT NULL DEFAULT 'patient' CHECK (role IN ('patient','carer','admin')),
  phone           text NOT NULL DEFAULT '',
  age             int,
  avatar_initials text NOT NULL DEFAULT '',
  dark_mode       bool NOT NULL DEFAULT false,
  font_size       text NOT NULL DEFAULT 'normal' CHECK (font_size IN ('normal','large','xlarge')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ── CARER_PATIENT_LINKS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carer_patient_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carer_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(carer_id, patient_id)
);

ALTER TABLE carer_patient_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Links visible to participants"
  ON carer_patient_links FOR SELECT TO authenticated
  USING (carer_id = auth.uid() OR patient_id = auth.uid());

CREATE POLICY "Carers can insert links"
  ON carer_patient_links FOR INSERT TO authenticated
  WITH CHECK (carer_id = auth.uid());

CREATE POLICY "Carers can delete own links"
  ON carer_patient_links FOR DELETE TO authenticated
  USING (carer_id = auth.uid());

-- Carers can view linked patient profiles
CREATE POLICY "Carers can view linked patients"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = profiles.id
    )
  );

-- ── MEDICATIONS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  dosage       text NOT NULL DEFAULT '',
  unit         text NOT NULL DEFAULT 'comprimido',
  icon         text NOT NULL DEFAULT '💊',
  color        text NOT NULL DEFAULT '#0D5245',
  frequency    text NOT NULL DEFAULT 'Todo dia',
  times        text[] NOT NULL DEFAULT '{}',
  observations text NOT NULL DEFAULT '',
  start_date   date,
  end_date     date,
  active       bool NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES profiles(id)
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Carers can view linked patient medications"
  ON medications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = medications.user_id
    )
  );

CREATE POLICY "Carers can insert medications for linked patients"
  ON medications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = medications.user_id
    )
  );

CREATE POLICY "Carers can update linked patient medications"
  ON medications FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = medications.user_id
    )
  );

-- ── DOSE_LOGS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dose_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id  uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL,
  status         text NOT NULL DEFAULT 'missed' CHECK (status IN ('taken','missed','skipped')),
  taken_at       timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dose_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dose logs"
  ON dose_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own dose logs"
  ON dose_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own dose logs"
  ON dose_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Carers can view linked patient dose logs"
  ON dose_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = dose_logs.user_id
    )
  );

-- ── HEALTH_LOGS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_logs (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mood      text NOT NULL CHECK (mood IN ('great','ok','bad')),
  symptoms  text NOT NULL DEFAULT '',
  notes     text NOT NULL DEFAULT '',
  logged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health logs"
  ON health_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own health logs"
  ON health_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Carers can view linked patient health logs"
  ON health_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = health_logs.user_id
    )
  );

-- ── APPOINTMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL,
  type         text NOT NULL DEFAULT 'consultation' CHECK (type IN ('consultation','exam','other')),
  scheduled_at timestamptz NOT NULL,
  location     text NOT NULL DEFAULT '',
  notes        text NOT NULL DEFAULT '',
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appointments"
  ON appointments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own appointments"
  ON appointments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users can update own appointments"
  ON appointments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users can delete own appointments"
  ON appointments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Carers can view linked patient appointments"
  ON appointments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = appointments.user_id
    )
  );

-- ── EMERGENCY_ALERTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message      text NOT NULL DEFAULT 'Preciso de ajuda!',
  location_lat float8,
  location_lng float8,
  resolved     bool NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emergency alerts"
  ON emergency_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own emergency alerts"
  ON emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Carers can view linked patient emergency alerts"
  ON emergency_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = emergency_alerts.user_id
    )
  );

CREATE POLICY "Carers can resolve emergency alerts"
  ON emergency_alerts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carer_patient_links
      WHERE carer_id = auth.uid() AND patient_id = emergency_alerts.user_id
    )
  );

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_dose_logs_user_date ON dose_logs(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dose_logs_medication ON dose_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_user ON health_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_links_carer ON carer_patient_links(carer_id);
CREATE INDEX IF NOT EXISTS idx_links_patient ON carer_patient_links(patient_id);
