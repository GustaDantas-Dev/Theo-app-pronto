/*
  # THEO — Extend profiles with registration fields
  
  Adds patient-specific and carer-specific fields to the profiles table.
  All columns are nullable to remain backward-compatible.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cpf              text,
  ADD COLUMN IF NOT EXISTS birth_date       date,
  ADD COLUMN IF NOT EXISTS blood_type       text,
  ADD COLUMN IF NOT EXISTS weight_kg        numeric(5,1),
  ADD COLUMN IF NOT EXISTS height_cm        numeric(5,1),
  ADD COLUMN IF NOT EXISTS allergies        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS medications_in_use text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS kinship          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profession       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS patient_count    int;
