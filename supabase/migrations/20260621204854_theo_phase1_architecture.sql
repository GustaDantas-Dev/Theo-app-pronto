
-- ══════════════════════════════════════════════════════════════
-- THEO — FASE 1: Correções Críticas de Arquitetura
-- ══════════════════════════════════════════════════════════════

-- ── 1. Fortalecer tabela PROFILES ────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unique_code text,
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email       text;

-- Copiar email de auth.users para profiles
UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND p.email IS NULL;

-- Função geradora de código THEO-XXXXX
CREATE OR REPLACE FUNCTION generate_theo_code()
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  code text;
  taken boolean;
BEGIN
  LOOP
    code := 'THEO-' || LPAD((FLOOR(RANDOM() * 99999) + 1)::text, 5, '0');
    SELECT EXISTS(SELECT 1 FROM profiles WHERE unique_code = code) INTO taken;
    EXIT WHEN NOT taken;
  END LOOP;
  RETURN code;
END;
$$;

-- Popular unique_code para perfis existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE unique_code IS NULL LOOP
    UPDATE profiles SET unique_code = generate_theo_code() WHERE id = r.id;
  END LOOP;
END $$;

-- Garantir unicidade (sem IF NOT EXISTS - compatível)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_profiles_unique_code'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT uq_profiles_unique_code UNIQUE (unique_code);
  END IF;
END $$;

-- Trigger: auto-preencher unique_code e email ao criar perfil
CREATE OR REPLACE FUNCTION trg_profile_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.unique_code IS NULL THEN
    NEW.unique_code := generate_theo_code();
  END IF;
  IF NEW.email IS NULL THEN
    NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_defaults ON profiles;
CREATE TRIGGER set_profile_defaults
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_profile_defaults();

-- Políticas de leitura de perfis
DROP POLICY IF EXISTS "find_patient_for_linking" ON profiles;
CREATE POLICY "find_patient_for_linking" ON profiles
  FOR SELECT TO authenticated
  USING (role = 'patient');

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'));

-- ── 2. HYDRATION_LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hydration_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cups        integer NOT NULL DEFAULT 0,
  amount_ml   integer NOT NULL DEFAULT 0,
  goal_daily  integer NOT NULL DEFAULT 2000,
  logged_date date    NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id, logged_date)
);

ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_hydration_select" ON hydration_logs FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "own_hydration_insert" ON hydration_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "own_hydration_update" ON hydration_logs FOR UPDATE TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "own_hydration_delete" ON hydration_logs FOR DELETE TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "carer_hydration_read" ON hydration_logs FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM carer_patient_links WHERE carer_id = auth.uid() AND patient_id = hydration_logs.patient_id));
CREATE POLICY "admin_hydration_read" ON hydration_logs FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_hydration_patient_date ON hydration_logs(patient_id, logged_date DESC);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hydration_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. MEAL_LOGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_type   text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  status      text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','skipped','late')),
  notes       text NOT NULL DEFAULT '',
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_meals_select" ON meal_logs FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "own_meals_insert" ON meal_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "own_meals_update" ON meal_logs FOR UPDATE TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "own_meals_delete" ON meal_logs FOR DELETE TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "carer_meals_read" ON meal_logs FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM carer_patient_links WHERE carer_id = auth.uid() AND patient_id = meal_logs.patient_id));
CREATE POLICY "admin_meals_read" ON meal_logs FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_meal_patient_date ON meal_logs(patient_id, logged_date DESC);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE meal_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Estoque dinâmico em MEDICATIONS ────────────────────────
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS quantity_remaining integer,
  ADD COLUMN IF NOT EXISTS expected_end_date  date;

UPDATE medications
  SET quantity_remaining = total_qty
  WHERE quantity_remaining IS NULL AND total_qty IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_init_med_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quantity_remaining IS NULL AND NEW.total_qty IS NOT NULL THEN
    NEW.quantity_remaining := NEW.total_qty;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS init_med_stock ON medications;
CREATE TRIGGER init_med_stock
  BEFORE INSERT ON medications
  FOR EACH ROW EXECUTE FUNCTION trg_init_med_stock();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE medications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. ACK/Resolve em EMERGENCY_ALERTS ───────────────────────
ALTER TABLE emergency_alerts
  ADD COLUMN IF NOT EXISTS acknowledged     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at  timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by      uuid REFERENCES profiles(id) ON DELETE SET NULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE emergency_alerts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
