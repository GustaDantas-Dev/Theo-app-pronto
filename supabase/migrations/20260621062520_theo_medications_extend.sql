-- Add extra fields to medications for full prescription management
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS dose_qty    int     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_qty   int,
  ADD COLUMN IF NOT EXISTS priority    text    NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical'));
