import { supabase } from './supabase';

export interface SystemSettings {
  medication_delay_limit_minutes: number;
  hydration_goal_daily: number;
  pressure_high_systolic: number;
  pressure_high_diastolic: number;
  inactivity_limit_hours: number;
  critical_alert_timeout_hours: number;
  stock_warning_limit: number;
  stock_critical_limit: number;
  updated_by: string | null;
  updated_at: string;
}

const DEFAULTS: SystemSettings = {
  medication_delay_limit_minutes: 30,
  hydration_goal_daily: 2000,
  pressure_high_systolic: 140,
  pressure_high_diastolic: 90,
  inactivity_limit_hours: 24,
  critical_alert_timeout_hours: 2,
  stock_warning_limit: 5,
  stock_critical_limit: 3,
  updated_by: null,
  updated_at: new Date().toISOString(),
};

export async function getSettings(): Promise<SystemSettings> {
  const { data } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle();
  return data ? (data as SystemSettings) : DEFAULTS;
}

export async function saveSettings(
  settings: Omit<SystemSettings, 'updated_by' | 'updated_at'>,
  updatedBy: string,
): Promise<void> {
  await supabase.from('system_settings').upsert(
    { id: 1, ...settings, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
}
