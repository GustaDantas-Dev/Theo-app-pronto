import { supabase } from './supabase';

type Severity = 'info' | 'warning' | 'critical';

interface NotifPayload {
  from_user_id: string | null;
  to_user_id: string;
  patient_id: string | null;
  type: string;
  title: string;
  message: string;
  severity: Severity;
}

async function insertNotifications(rows: NotifPayload[]) {
  if (!rows.length) return;
  await supabase.from('notifications').insert(rows);
}

export async function notifyCarersOfPatient(
  patientId: string,
  fromUserId: string | null,
  type: string,
  title: string,
  message: string,
  severity: Severity = 'info',
) {
  const { data: links } = await supabase
    .from('carer_patient_links')
    .select('carer_id')
    .eq('patient_id', patientId);
  if (!links?.length) return;
  await insertNotifications(
    links.map((l: { carer_id: string }) => ({
      from_user_id: fromUserId,
      to_user_id: l.carer_id,
      patient_id: patientId,
      type, title, message, severity,
    })),
  );
}

export async function notifyAdmins(
  fromUserId: string | null,
  patientId: string | null,
  type: string,
  title: string,
  message: string,
  severity: Severity = 'warning',
) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (!admins?.length) return;
  await insertNotifications(
    admins.map((a: { id: string }) => ({
      from_user_id: fromUserId,
      to_user_id: a.id,
      patient_id: patientId,
      type, title, message, severity,
    })),
  );
}

export async function notifyUser(
  toUserId: string,
  fromUserId: string | null,
  patientId: string | null,
  type: string,
  title: string,
  message: string,
  severity: Severity = 'info',
) {
  await insertNotifications([{
    from_user_id: fromUserId,
    to_user_id: toUserId,
    patient_id: patientId,
    type, title, message, severity,
  }]);
}
