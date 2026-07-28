export type Role = 'patient' | 'carer' | 'admin';
export type FontSize = 'normal' | 'large' | 'xlarge';
export type DoseStatus = 'taken' | 'missed' | 'skipped';
export type Mood = 'great' | 'ok' | 'bad';
export type AppointmentType = 'consultation' | 'exam' | 'other';
export type VitalType = 'blood_pressure' | 'glucose' | 'temperature' | 'oxygen' | 'heart_rate' | 'weight' | 'hydration';
export type BloodPressureClassification = 'normal' | 'elevated' | 'high' | 'low';

export interface Profile {
  id: string;
  name: string;
  role: Role;
  phone: string;
  age: number | null;
  avatar_initials: string;
  dark_mode: boolean;
  font_size: FontSize;
  created_at: string;
  // Phase 1: hierarchy & identity
  unique_code?: string | null;
  status?: string;
  admin_id?: string | null;
  email?: string | null;
  // Extended medical
  cpf?: string | null;
  birth_date?: string | null;
  blood_type?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  allergies?: string;
  medications_in_use?: string;
  emergency_contact?: string;
  kinship?: string;
  profession?: string;
  patient_count?: number | null;
}

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  unit: string;
  icon: string;
  color: string;
  frequency: string;
  times: string[];
  observations: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_at: string;
  created_by: string | null;
  dose_qty: number;
  total_qty: number | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  // Phase 1: dynamic stock
  quantity_remaining: number | null;
  expected_end_date: string | null;
}

export interface DoseLog {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: DoseStatus;
  taken_at: string | null;
  created_at: string;
}

export interface HealthLog {
  id: string;
  user_id: string;
  mood: Mood;
  symptoms: string;
  notes: string;
  logged_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  type: AppointmentType;
  scheduled_at: string;
  location: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface EmergencyAlert {
  id: string;
  user_id: string;
  message: string;
  location_lat: number | null;
  location_lng: number | null;
  resolved: boolean;
  created_at: string;
  // Phase 1: ACK/resolve audit trail
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ScheduleItem {
  medication: Medication;
  time: string;
  status: DoseStatus | 'upcoming' | 'pending';
  log?: DoseLog;
}

export interface VitalLog {
  id: string;
  user_id: string;
  type: VitalType;
  systolic: number | null;
  diastolic: number | null;
  value: number | null;
  unit: string;
  classification: string;
  notes: string;
  recorded_at: string;
}

export interface HydrationLog {
  id: string;
  patient_id: string;
  cups: number;
  amount_ml: number;
  goal_daily: number;
  logged_date: string;
  created_at: string;
  updated_at: string;
}

export interface MealLog {
  id: string;
  patient_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  status: 'completed' | 'skipped' | 'late';
  notes: string;
  logged_date: string;
  created_at: string;
}
