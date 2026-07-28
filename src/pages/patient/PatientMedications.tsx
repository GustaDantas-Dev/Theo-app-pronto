import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Medication, DoseLog, Profile } from '../../types';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  X, Pill, Calendar,
  Package, FileText, History,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

type Filter = 'all' | 'pending' | 'taken' | 'late';

interface MedWithStatus extends Medication {
  todayLogs: DoseLog[];
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function today() { return new Date().toISOString().split('T')[0]; }

function timeStatus(time: string, log: DoseLog | undefined): 'taken' | 'late' | 'pending' {
  if (log?.status === 'taken') return 'taken';
  const now = nowHHMM();
  return time < now ? 'late' : 'pending';
}

function overallStatus(med: MedWithStatus): 'taken' | 'late' | 'pending' {
  const statuses = med.times.map(t => {
    const log = med.todayLogs.find(l => l.scheduled_time === t);
    return timeStatus(t, log);
  });
  if (statuses.every(s => s === 'taken')) return 'taken';
  if (statuses.some(s => s === 'late')) return 'late';
  return 'pending';
}

function StatusBadge({ status }: { status: 'taken' | 'late' | 'pending' }) {
  if (status === 'taken') return (
    <span className="flex items-center gap-1 bg-[#DFFFE0] text-[#1B8A1B] text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
      <span className="w-2 h-2 rounded-full bg-[#32CD32]" /> TOMADO
    </span>
  );
  if (status === 'late') return (
    <span className="flex items-center gap-1 bg-red-50 text-[#c0392b] text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
      <span className="w-2 h-2 rounded-full bg-[#FF4D4D]" /> ATRASADO
    </span>
  );
  return (
    <span className="flex items-center gap-1 bg-yellow-50 text-[#B8650A] text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
      <span className="w-2 h-2 rounded-full bg-[#FFD600]" /> PENDENTE
    </span>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ med, logs, onClose }: { med: MedWithStatus; logs: DoseLog[]; onClose: () => void }) {
  const recentLogs = [...logs]
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
    .slice(0, 14);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0D3B66] rounded-t-3xl sm:rounded-t-3xl px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Detalhes</p>
            <p className="text-white font-bold text-xl">{med.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#E8F9FB] rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-[#26C6DA]">{med.dosage}</p>
              <p className="text-xs text-[#666] font-semibold mt-0.5">Dosagem</p>
            </div>
            <div className="bg-[#F5F7FA] rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-[#0D3B66]">{med.dose_qty ?? 1}</p>
              <p className="text-xs text-[#666] font-semibold mt-0.5">Por dose</p>
            </div>
            <div className="bg-[#F5F7FA] rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-[#0D3B66]">{(med.quantity_remaining ?? med.total_qty) ?? '—'}</p>
              <p className="text-xs text-[#666] font-semibold mt-0.5">Restantes</p>
            </div>
          </div>

          <div className="bg-[#F5F7FA] rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#26C6DA]" />
              <p className="text-sm text-[#333]">
                <span className="font-bold">Início:</span>{' '}
                {med.start_date ? new Date(med.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#F4A261]" />
              <p className="text-sm text-[#333]">
                <span className="font-bold">Fim da cartela:</span>{' '}
                {med.end_date ? new Date(med.end_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          </div>

          {med.observations && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-[#26C6DA]" />
                <p className="text-xs font-bold text-[#26C6DA] uppercase tracking-wide">Observações médicas</p>
              </div>
              <p className="text-sm text-[#333] leading-relaxed">{med.observations}</p>
            </div>
          )}

          {(() => { const rem = med.quantity_remaining ?? med.total_qty; return rem !== null && rem !== undefined && rem <= 5; })() && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
              <Package className="w-5 h-5 text-[#F4A261] flex-shrink-0" />
              <p className="text-sm font-bold text-[#B8650A]">
                ⚠ Restam apenas {(med.quantity_remaining ?? med.total_qty)} {med.unit}(s) — providencie reposição!
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-[#666]" />
              <p className="text-sm font-bold text-[#333] uppercase tracking-wide">Histórico recente</p>
            </div>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-[#999] py-2">Nenhum registro ainda.</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between bg-[#F5F7FA] rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-[#111]">
                        {new Date(log.scheduled_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-[#999]">{log.scheduled_time}</p>
                    </div>
                    {log.status === 'taken'
                      ? <span className="text-xs font-bold text-[#32CD32] bg-[#DFFFE0] px-2.5 py-1 rounded-full">TOMADO</span>
                      : log.status === 'missed'
                      ? <span className="text-xs font-bold text-[#FF4D4D] bg-red-50 px-2.5 py-1 rounded-full">PERDIDO</span>
                      : <span className="text-xs font-bold text-[#B8650A] bg-yellow-50 px-2.5 py-1 rounded-full">PULADO</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Medication Card ───────────────────────────────────────────────────────────
function MedCard({
  med,
  onConfirm,
  onDetails,
  confirming,
}: {
  med: MedWithStatus;
  onConfirm: (medId: string, time: string) => void;
  onDetails: () => void;
  confirming: string | null;
}) {
  const status = overallStatus(med);
  const pendingTimes = med.times.filter(t => {
    const log = med.todayLogs.find(l => l.scheduled_time === t);
    return timeStatus(t, log) !== 'taken';
  });

  const borderColor =
    status === 'taken' ? 'border-[#32CD32]' :
    status === 'late'  ? 'border-[#FF4D4D]' :
    'border-[#26C6DA]';

  return (
    <div className={`bg-white rounded-3xl shadow-md border-l-4 ${borderColor} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
              style={{ background: med.color + '22', border: `2px solid ${med.color}44` }}
            >
              {med.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0D3B66] text-lg leading-tight">{med.name.toUpperCase()}</p>
              <p className="text-[#26C6DA] font-semibold text-sm">{med.dosage} {med.unit}</p>
              {med.dose_qty > 1 && (
                <p className="text-[#666] text-xs mt-0.5">{med.dose_qty} unidades por dose</p>
              )}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Times */}
        <div className="flex flex-wrap gap-2 mt-4">
          {med.times.map(t => {
            const log = med.todayLogs.find(l => l.scheduled_time === t);
            const ts = timeStatus(t, log);
            return (
              <div
                key={t}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${
                  ts === 'taken'
                    ? 'bg-[#DFFFE0] border-[#32CD32] text-[#1B8A1B]'
                    : ts === 'late'
                    ? 'bg-red-50 border-[#FF4D4D] text-[#c0392b]'
                    : 'bg-yellow-50 border-[#FFD600] text-[#B8650A]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {t}
                {ts === 'taken' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {ts === 'late' && <AlertTriangle className="w-3.5 h-3.5" />}
              </div>
            );
          })}
        </div>

        <p className="text-[#999] text-xs mt-2">{med.frequency}</p>
        {med.observations && (
          <p className="text-[#666] text-sm mt-2 italic line-clamp-2">"{med.observations}"</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {status === 'taken' ? (
            <div className="flex-1 py-3.5 rounded-2xl bg-[#DFFFE0] text-[#1B8A1B] font-bold text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> TUDO TOMADO
            </div>
          ) : (
            <button
              onClick={() => onConfirm(med.id, pendingTimes[0])}
              disabled={confirming === med.id + pendingTimes[0]}
              className="flex-1 py-3.5 rounded-2xl bg-[#26C6DA] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1BA8BC] active:scale-[0.98] transition-all disabled:opacity-60 shadow"
            >
              {confirming === med.id + pendingTimes[0]
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle2 className="w-5 h-5" /> CONFIRMAR TOMADA</>}
            </button>
          )}
          <button
            onClick={onDetails}
            className="px-4 py-3.5 rounded-2xl border-2 border-[#26C6DA] text-[#26C6DA] font-bold text-sm hover:bg-[#E8F9FB] transition-all whitespace-nowrap"
          >
            VER DETALHES
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PatientMedications({ profile, onBack, onNavigate }: Props) {
  const [meds, setMeds]             = useState<MedWithStatus[]>([]);
  const [allLogs, setAllLogs]       = useState<DoseLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<Filter>('all');
  const [detailMed, setDetailMed]   = useState<MedWithStatus | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const todayStr = today();

    const [{ data: medsData }, { data: logsData }] = await Promise.all([
      supabase
        .from('medications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('active', true)
        .order('created_at'),
      supabase
        .from('dose_logs')
        .select('*')
        .eq('user_id', profile.id)
        .eq('scheduled_date', todayStr),
    ]);

    const logs = (logsData as DoseLog[]) || [];
    setAllLogs(logs);
    const withStatus: MedWithStatus[] = ((medsData as Medication[]) || []).map(m => ({
      ...m,
      todayLogs: logs.filter(l => l.medication_id === m.id),
    }));
    setMeds(withStatus);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleConfirm(medId: string, time: string) {
    const key = medId + time;
    setConfirming(key);
    const todayStr = today();

    const { data: existing } = await supabase
      .from('dose_logs')
      .select('id')
      .eq('user_id', profile.id)
      .eq('medication_id', medId)
      .eq('scheduled_date', todayStr)
      .eq('scheduled_time', time)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('dose_logs')
        .update({ status: 'taken', taken_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('dose_logs').insert({
        user_id: profile.id,
        medication_id: medId,
        scheduled_date: todayStr,
        scheduled_time: time,
        status: 'taken',
        taken_at: new Date().toISOString(),
      });
    }

    const med = meds.find(m => m.id === medId);
    const currentRemaining = med?.quantity_remaining ?? med?.total_qty ?? null;
    if (currentRemaining !== null && currentRemaining > 0) {
      const doseQty = med?.dose_qty ?? 1;
      const newRemaining = Math.max(0, currentRemaining - doseQty);
      await supabase.from('medications').update({ quantity_remaining: newRemaining }).eq('id', medId);
    }

    setConfirming(null);
    await loadData();
  }

  // ── Derived values ──
  const takenCount = meds.reduce((acc, m) => acc + m.todayLogs.filter(l => l.status === 'taken').length, 0);
  const totalSlots = meds.reduce((acc, m) => acc + m.times.length, 0);
  const lateCount  = meds.filter(m => overallStatus(m) === 'late').length;
  const pct        = totalSlots > 0 ? Math.round((takenCount / totalSlots) * 100) : 0;

  const nextMed = (() => {
    const now = nowHHMM();
    const candidates: { med: MedWithStatus; time: string }[] = [];
    for (const m of meds) {
      for (const t of m.times) {
        const log = m.todayLogs.find(l => l.scheduled_time === t);
        if (!log || log.status !== 'taken') candidates.push({ med: m, time: t });
      }
    }
    candidates.sort((a, b) => a.time.localeCompare(b.time));
    return candidates.find(c => c.time >= now) ?? candidates[0] ?? null;
  })();

  const filteredMeds = meds.filter(m => {
    const s = overallStatus(m);
    if (filter === 'all') return true;
    if (filter === 'taken') return s === 'taken';
    if (filter === 'late') return s === 'late';
    if (filter === 'pending') return s === 'pending';
    return true;
  });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',     label: 'TODOS' },
    { id: 'pending', label: 'PENDENTES' },
    { id: 'taken',   label: 'TOMADOS' },
    { id: 'late',    label: 'ATRASADOS' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-28">

      {/* ── Header ── */}
      <div className="bg-[#26C6DA] px-4 pt-5 pb-10">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-2xl leading-tight">MEUS MEDICAMENTOS</h1>
            <p className="text-white/70 text-sm mt-0.5 capitalize">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4 -mt-6">

        {/* ── Summary card ── */}
        <div className="bg-white rounded-3xl shadow-md p-5">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#E8F9FB] flex items-center justify-center mx-auto mb-1.5">
                <Pill className="w-6 h-6 text-[#26C6DA]" />
              </div>
              <p className="text-2xl font-bold text-[#0D3B66]">{meds.length}</p>
              <p className="text-xs text-[#666] font-semibold leading-tight">Total</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#DFFFE0] flex items-center justify-center mx-auto mb-1.5">
                <CheckCircle2 className="w-6 h-6 text-[#32CD32]" />
              </div>
              <p className="text-2xl font-bold text-[#0D3B66]">{takenCount}</p>
              <p className="text-xs text-[#666] font-semibold leading-tight">Tomados</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center mx-auto mb-1.5">
                <Clock className="w-6 h-6 text-[#FFD600]" />
              </div>
              <p className="text-2xl font-bold text-[#0D3B66]">{nextMed ? nextMed.time : '—'}</p>
              <p className="text-xs text-[#666] font-semibold leading-tight">Próximo</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs font-bold text-[#333]">Progresso do dia</p>
              <p className="text-xs font-bold text-[#26C6DA]">{takenCount} de {totalSlots} doses</p>
            </div>
            <div className="w-full h-4 bg-[#F5F7FA] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  pct === 100 ? 'bg-[#32CD32]' : pct >= 50 ? 'bg-[#26C6DA]' : 'bg-[#FFD600]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-right text-xs font-bold mt-1 text-[#26C6DA]">{pct}% concluído</p>
          </div>
        </div>

        {/* ── Late alert ── */}
        {lateCount > 0 && (
          <div className="bg-[#FF4D4D] rounded-3xl p-4 flex items-center gap-3 shadow-md">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                🚨 {lateCount === 1 ? 'VOCÊ TEM UMA MEDICAÇÃO ATRASADA' : `VOCÊ TEM ${lateCount} MEDICAÇÕES ATRASADAS`}
              </p>
              <p className="text-white/80 text-xs mt-0.5">
                {meds.filter(m => overallStatus(m) === 'late').map(m => m.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* ── Next med highlight ── */}
        {nextMed && (
          <div className="bg-[#0D3B66] rounded-3xl p-5 shadow-md">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wide mb-3">Próxima medicação</p>
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: nextMed.med.color + '33' }}
              >
                {nextMed.med.icon}
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-xl">{nextMed.med.name.toUpperCase()}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-[#26C6DA]" />
                  <p className="text-[#26C6DA] font-bold text-lg">{nextMed.time}</p>
                </div>
                {nextMed.med.observations && (
                  <p className="text-white/60 text-xs mt-1 italic line-clamp-1">{nextMed.med.observations}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stock alerts ── */}
        {meds
          .filter(m => { const rem = m.quantity_remaining ?? m.total_qty; return rem !== null && rem !== undefined && rem <= 5; })
          .map(m => (
            <div key={m.id + '-stock'} className="bg-orange-50 border-2 border-orange-200 rounded-3xl px-5 py-4 flex items-center gap-3">
              <Package className="w-5 h-5 text-[#F4A261] flex-shrink-0" />
              <p className="text-sm font-bold text-[#B8650A]">
                ⚠ <strong>{m.name}</strong> — restam apenas {m.quantity_remaining ?? m.total_qty} {m.unit}(s)
              </p>
            </div>
          ))}

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-2xl shadow-md p-2 grid grid-cols-4 gap-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                filter === f.id
                  ? f.id === 'late'    ? 'bg-[#FF4D4D] text-white shadow'
                  : f.id === 'taken'   ? 'bg-[#32CD32] text-white shadow'
                  : f.id === 'pending' ? 'bg-[#FFD600] text-[#333] shadow'
                  : 'bg-[#26C6DA] text-white shadow'
                  : 'text-[#666] hover:bg-[#F5F7FA]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-10 h-10 border-4 border-[#26C6DA]/20 border-t-[#26C6DA] rounded-full animate-spin" />
          </div>
        ) : filteredMeds.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-md p-8 text-center">
            <Pill className="w-12 h-12 text-[#D9D9D9] mx-auto mb-3" />
            <p className="text-[#333] font-bold text-lg">Nenhum medicamento</p>
            <p className="text-[#999] text-sm mt-1">
              {filter === 'all'
                ? 'Nenhum medicamento cadastrado ainda.'
                : `Nenhum medicamento ${filter === 'taken' ? 'tomado' : filter === 'late' ? 'atrasado' : 'pendente'} agora.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeds.map(med => (
              <MedCard
                key={med.id}
                med={med}
                onConfirm={handleConfirm}
                onDetails={() => setDetailMed(med)}
                confirming={confirming}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      {onNavigate && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#F0F0F0] shadow-xl z-40">
          <div className="max-w-lg mx-auto grid grid-cols-4">
            {[
              { icon: '🏠', label: 'Início', page: 'home', active: false },
              { icon: '💊', label: 'Remédios', page: 'medications', active: true },
              { icon: '❤️', label: 'Saúde', page: 'health_monitor', active: false },
              { icon: '👤', label: 'Perfil', page: 'profile', active: false },
            ].map(item => (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-bold transition-all ${
                  item.active ? 'text-[#26C6DA]' : 'text-[#999] hover:text-[#0D3B66]'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
                {item.active && <span className="w-1.5 h-1.5 rounded-full bg-[#26C6DA]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {detailMed && (
        <DetailModal
          med={detailMed}
          logs={allLogs.filter(l => l.medication_id === detailMed.id)}
          onClose={() => setDetailMed(null)}
        />
      )}
    </div>
  );
}
