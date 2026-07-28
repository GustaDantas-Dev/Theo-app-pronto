import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { DoseLog, Medication, Profile } from '../../types';
import { fmtDateFull, adherencePct } from '../../lib/utils';
import { ArrowLeft } from 'lucide-react';

interface Props { profile: Profile; onBack?: () => void; }

export default function PatientHistory({ profile, onBack }: Props) {
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);

  const load = useCallback(async () => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.from('dose_logs').select('*').eq('user_id', profile.id).gte('scheduled_date', cutoffStr).order('scheduled_date', { ascending: false }).order('scheduled_time'),
      supabase.from('medications').select('*').eq('user_id', profile.id),
    ]);
    setLogs(l || []); setMeds(m || []);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const byDate: Record<string, DoseLog[]> = {};
  logs.forEach(l => {
    if (!byDate[l.scheduled_date]) byDate[l.scheduled_date] = [];
    byDate[l.scheduled_date].push(l);
  });

  const getMed = (id: string) => meds.find(m => m.id === id);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        {onBack && (
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 transition-all text-stone-600">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h2 className="font-serif text-2xl font-semibold text-stone-900">Histórico</h2>
          <p className="text-stone-400 text-sm">Últimos 14 dias</p>
        </div>
      </div>

      {Object.keys(byDate).length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 text-center text-stone-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium">Nenhum histórico ainda</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byDate).map(([date, dayLogs]) => {
            const taken = dayLogs.filter(l => l.status === 'taken').length;
            const pct = adherencePct(taken, dayLogs.length);
            const barColor = pct >= 80 ? 'bg-teal-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
            return (
              <div key={date} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <span className="font-semibold text-stone-700 text-sm capitalize">{fmtDateFull(date)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-stone-500">{pct}%</span>
                  </div>
                </div>
                <div className="divide-y divide-stone-100">
                  {dayLogs.map(log => {
                    const med = getMed(log.medication_id);
                    const icon = log.status === 'taken' ? '✅' : log.status === 'missed' ? '❌' : '⏭️';
                    const dotColor = log.status === 'taken' ? 'bg-teal-100' : log.status === 'missed' ? 'bg-red-100' : 'bg-stone-100';
                    return (
                      <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                        <div className={`w-8 h-8 rounded-full ${dotColor} flex items-center justify-center text-sm flex-shrink-0`}>{icon}</div>
                        <div className="flex-1">
                          <p className="font-medium text-stone-800 text-sm">{med?.name || 'Desconhecido'} {med?.dosage}</p>
                          <p className="text-xs text-stone-400">{log.scheduled_time}{log.taken_at ? ` · Tomado às ${new Date(log.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          log.status === 'taken' ? 'bg-teal-100 text-teal-700' :
                          log.status === 'missed' ? 'bg-red-100 text-red-700' :
                          'bg-stone-100 text-stone-500'
                        }`}>
                          {log.status === 'taken' ? 'Tomado' : log.status === 'missed' ? 'Esquecido' : 'Pulado'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
