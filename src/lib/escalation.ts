import { supabase } from './supabase';
import { notifyCarersOfPatient, notifyAdmins } from './alerts';
import { getSettings } from './systemSettings';
import type { Medication, DoseLog, VitalLog } from '../types';

interface PatientData {
  patientId: string;
  patientName: string;
  meds: Medication[];
  todayLogs: DoseLog[];
  vitals: VitalLog[];
  hydrationCups: number;
  unackedEmergencyIds: string[];
  emergencyCreatedAts: string[];
}

async function alreadySent(patientId: string, type: string, withinHours = 4): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('patient_id', patientId)
    .eq('type', type)
    .gte('created_at', since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function runEscalationChecks(patients: PatientData[]) {
  const settings = await getSettings();
  const now = nowHHMM();

  for (const p of patients) {
    // Rule 1: 3+ missed meds today
    const missed = p.meds.filter(m => m.times.some(t => {
      if (t >= now) return false;
      const log = p.todayLogs.find(l => l.medication_id === m.id && l.scheduled_time === t);
      return !log || log.status !== 'taken';
    }));
    if (missed.length >= 3 && !(await alreadySent(p.patientId, 'medication_escalated'))) {
      await notifyCarersOfPatient(
        p.patientId, null, 'medication_escalated',
        `ESCALONADO: ${p.patientName.split(' ')[0]} — ${missed.length} remédios perdidos`,
        missed.map(m => m.name).join(', '),
        'critical',
      );
      await notifyAdmins(
        null, p.patientId, 'medication_escalated',
        `Escalonamento: ${p.patientName} — ${missed.length} medicamentos perdidos`,
        `Cuidador não respondeu. Intervenção necessária.`,
        'critical',
      );
    }

    // Rule 2: 2+ high BP readings today
    const highBPs = p.vitals.filter(v =>
      v.type === 'blood_pressure' &&
      ((v.systolic ?? 0) >= settings.pressure_high_systolic || (v.diastolic ?? 0) >= settings.pressure_high_diastolic),
    );
    if (highBPs.length >= 2 && !(await alreadySent(p.patientId, 'bp_escalated'))) {
      await notifyCarersOfPatient(
        p.patientId, null, 'bp_escalated',
        `ESCALONADO: Pressão alta repetida — ${p.patientName.split(' ')[0]}`,
        `${highBPs.length} registros hoje acima do limite.`,
        'critical',
      );
      await notifyAdmins(
        null, p.patientId, 'bp_escalated',
        `Escalonamento: Pressão de ${p.patientName}`,
        `${highBPs.length} leituras acima de ${settings.pressure_high_systolic}/${settings.pressure_high_diastolic} mmHg hoje.`,
        'critical',
      );
    }

    // Rule 3: hydration < 30% of goal
    const goalMl = settings.hydration_goal_daily;
    const currentMl = p.hydrationCups * 250;
    if (currentMl > 0 && currentMl < goalMl * 0.3 && !(await alreadySent(p.patientId, 'low_hydration', 8))) {
      await notifyCarersOfPatient(
        p.patientId, null, 'low_hydration',
        `Hidratação baixa: ${p.patientName.split(' ')[0]}`,
        `${currentMl}ml de ${goalMl}ml (${Math.round((currentMl / goalMl) * 100)}%). Meta longe de ser atingida.`,
        'warning',
      );
    }

    // Rule 4: stock at critical limit
    const criticalStock = p.meds.filter(m => {
      const remaining = m.quantity_remaining ?? m.total_qty;
      return remaining !== null && remaining <= settings.stock_critical_limit;
    });
    for (const m of criticalStock) {
      const type = `stock_critical_${m.id}`;
      if (!(await alreadySent(p.patientId, type, 24))) {
        await notifyCarersOfPatient(
          p.patientId, null, type,
          `CRITICO: Estoque quase zerado — ${m.name}`,
          `Apenas ${m.quantity_remaining ?? m.total_qty} unidades restantes. Reponha urgente.`,
          'critical',
        );
      }
    }

    // Rule 5: unACKed emergency alerts older than timeout
    const timeoutMs = settings.critical_alert_timeout_hours * 3600 * 1000;
    for (let i = 0; i < p.unackedEmergencyIds.length; i++) {
      const createdAt = p.emergencyCreatedAts[i];
      if (!createdAt) continue;
      const age = Date.now() - new Date(createdAt).getTime();
      if (age > timeoutMs && !(await alreadySent(p.patientId, `sos_escalated_${p.unackedEmergencyIds[i]}`, 24))) {
        await notifyAdmins(
          null, p.patientId,
          `sos_escalated_${p.unackedEmergencyIds[i]}`,
          `SOS SEM RESPOSTA: ${p.patientName}`,
          `Alerta de emergência sem reconhecimento há mais de ${settings.critical_alert_timeout_hours}h.`,
          'critical',
        );
      }
    }
  }
}
