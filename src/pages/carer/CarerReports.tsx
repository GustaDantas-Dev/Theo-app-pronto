import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog } from '../../types';
import { adherencePct } from '../../lib/utils';
import RingChart from '../../components/RingChart';

interface Props { profile: Profile; }

export default function CarerReports({ profile }: Props) {
  const [patients, setPatients] = useState<Profile[]>([]);
  const [selPatient, setSelPatient] = useState<string>('');
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);

  const loadPatients = useCallback(async () => {
    const { data: links } = await supabase.from('carer_patient_links').select('patient_id').eq('carer_id', profile.id);
    const ids = (links || []).map(l => l.patient_id);
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    setPatients(data || []);
    if (data && data.length > 0 && !selPatient) setSelPatient(data[0].id);
  }, [profile.id, selPatient]);

  const loadData = useCallback(async () => {
    if (!selPatient) return;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', selPatient).eq('active', true),
      supabase.from('dose_logs').select('*').eq('user_id', selPatient).gte('scheduled_date', cutoff.toISOString().split('T')[0]),
    ]);
    setMeds(m || []); setLogs(l || []);
  }, [selPatient]);

  useEffect(() => { loadPatients(); }, [loadPatients]);
  useEffect(() => { loadData(); }, [loadData]);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const taken  = logs.filter(l => l.status === 'taken').length;
  const missed = logs.filter(l => l.status === 'missed').length;
  const total  = logs.length;
  const pct7   = adherencePct(taken, total);

  const dayData = last7.map(date => {
    const dayLogs = logs.filter(l => l.scheduled_date === date);
    const t = dayLogs.filter(l => l.status === 'taken').length;
    const p = adherencePct(t, dayLogs.length);
    const d = new Date(date + 'T12:00:00');
    return { label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }), pct: p, taken: t, total: dayLogs.length };
  });

  const medData = meds.map(med => {
    const medLogs = logs.filter(l => l.medication_id === med.id);
    const t = medLogs.filter(l => l.status === 'taken').length;
    const p = adherencePct(t, medLogs.length);
    return { med, pct: p };
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="font-serif text-2xl font-semibold text-stone-900">Relatórios</h2>

      {patients.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {patients.map(p => (
            <button key={p.id} onClick={() => setSelPatient(p.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all
                ${selPatient === p.id ? 'bg-teal-600 text-white border-teal-600' : 'border-stone-200 text-stone-600 hover:border-teal-300'}`}>
              {p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Adesão 7 dias', value: `${pct7}%`, color: pct7 >= 80 ? 'text-teal-600' : pct7 >= 50 ? 'text-amber-600' : 'text-red-600' },
          { label: 'Doses tomadas', value: taken, color: 'text-green-600' },
          { label: 'Doses perdidas', value: missed, color: 'text-red-600' },
          { label: 'Medicamentos', value: meds.length, color: 'text-teal-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <div className={`font-serif text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Ring */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col items-center gap-3">
          <h3 className="font-semibold text-stone-900 self-start">Adesão geral — 7 dias</h3>
          <RingChart pct={pct7} size={140} />
        </div>

        {/* By medication */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4">Por medicamento</h3>
          <div className="space-y-3">
            {medData.map(({ med, pct }) => (
              <div key={med.id} className="flex items-center gap-3">
                <span className="text-lg">{med.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-700 truncate">{med.name}</p>
                  <div className="h-1.5 bg-stone-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct >= 80 ? '#15803D' : pct >= 50 ? '#B8650A' : '#DC2626' }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-stone-500 w-10 text-right">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily chart */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">Adesão diária</h3>
        <div className="space-y-2.5">
          {dayData.map(d => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="text-xs text-stone-500 w-20 flex-shrink-0 capitalize">{d.label}</span>
              <div className="flex-1 h-2.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${d.pct}%`, background: d.pct >= 80 ? '#15803D' : d.pct >= 50 ? '#B8650A' : d.total === 0 ? '#d6d3d1' : '#DC2626' }} />
              </div>
              <span className="text-xs font-semibold text-stone-500 w-10 text-right">{d.total > 0 ? `${d.pct}%` : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
