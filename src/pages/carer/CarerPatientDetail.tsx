import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog, VitalLog } from '../../types';
import { today, adherencePct, fmtTime } from '../../lib/utils';
import {
  ArrowLeft, Clock, CheckCircle2, AlertTriangle, Pill,
  Droplets, Phone, Heart, Activity, Package,
  User, Calendar, ChevronRight,
} from 'lucide-react';

interface Props {
  profile: Profile;
  patientId: string;
  onBack: () => void;
}

type Tab = 'idoso' | 'cuidador' | 'clinico';

interface TimelineEvent {
  id: string;
  time: string;
  label: string;
  detail: string;
  color: string;
  icon: React.ReactNode;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayStatus(pct: number, takenToday: number, totalSlots: number): { emoji: string; label: string; detail: string; color: string } {
  if (totalSlots === 0) return { emoji: '😐', label: 'Sem dados', detail: 'Nenhum medicamento cadastrado.', color: '#999' };
  if (pct >= 80) return { emoji: '😊', label: 'Bom dia', detail: 'Paciente em dia com as medicações.', color: '#32CD32' };
  if (pct >= 50) return { emoji: '😐', label: 'Dia regular', detail: 'Alguns medicamentos pendentes.', color: '#FFD600' };
  return { emoji: '😟', label: 'Dia preocupante', detail: 'Pouca interação com o app hoje.', color: '#FF4D4D' };
}

export default function CarerPatientDetail({ profile, patientId, onBack }: Props) {
  const [patient, setPatient]     = useState<Profile | null>(null);
  const [meds, setMeds]           = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<DoseLog[]>([]);
  const [vitals, setVitals]       = useState<VitalLog[]>([]);
  const [tab, setTab]             = useState<Tab>('idoso');
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = today();

    const [
      { data: pat },
      { data: medsData },
      { data: logsData },
      { data: vitalsData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', patientId).maybeSingle(),
      supabase.from('medications').select('*').eq('user_id', patientId).eq('active', true).order('created_at'),
      supabase.from('dose_logs').select('*').eq('user_id', patientId).eq('scheduled_date', todayStr),
      supabase.from('vitals_logs').select('*').eq('user_id', patientId)
        .gte('recorded_at', todayStr + 'T00:00:00')
        .order('recorded_at', { ascending: false })
        .limit(20),
    ]);

    setPatient(pat as Profile | null);
    setMeds((medsData as Medication[]) || []);
    setTodayLogs((logsData as DoseLog[]) || []);
    setVitals((vitalsData as VitalLog[]) || []);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="h-32 bg-stone-100 rounded-3xl animate-pulse" />
        <div className="h-20 bg-stone-100 rounded-3xl animate-pulse" />
        <div className="h-48 bg-stone-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-[#999]">Paciente não encontrado.</p>
        <button onClick={onBack} className="mt-4 text-[#26C6DA] font-bold">← Voltar</button>
      </div>
    );
  }

  // ── Derived values ──
  const now       = nowHHMM();
  const taken     = todayLogs.filter(l => l.status === 'taken').length;
  const totalSlots = meds.reduce((acc, m) => acc + m.times.length, 0);
  const pct       = adherencePct(taken, totalSlots);
  const status    = dayStatus(pct, taken, totalSlots);

  const missedCount = meds.reduce((acc, m) => {
    const missed = m.times.filter(t => {
      if (t >= now) return false;
      const log = todayLogs.find(l => l.medication_id === m.id && l.scheduled_time === t);
      return !log || log.status !== 'taken';
    }).length;
    return acc + missed;
  }, 0);

  const lastVital   = vitals.find(v => v.type === 'blood_pressure');
  const hydration   = vitals.filter(v => v.type === 'hydration');
  const hydTotal    = hydration.reduce((acc, v) => acc + (v.value ?? 0), 0);

  const lastActivity = (() => {
    if (todayLogs.length) {
      const sorted = [...todayLogs].sort((a, b) => (b.taken_at ?? '').localeCompare(a.taken_at ?? ''));
      return sorted[0].taken_at ? fmtTime(sorted[0].taken_at) : null;
    }
    return null;
  })();

  // ── Timeline ──
  const timeline: TimelineEvent[] = [];

  for (const m of meds) {
    for (const t of m.times) {
      const log = todayLogs.find(l => l.medication_id === m.id && l.scheduled_time === t);
      if (log?.status === 'taken') {
        timeline.push({
          id: log.id,
          time: t,
          label: `${m.name} tomado`,
          detail: `${m.dosage} ${m.unit} confirmado`,
          color: '#32CD32',
          icon: <CheckCircle2 className="w-4 h-4 text-[#32CD32]" />,
        });
      } else if (t < now) {
        timeline.push({
          id: `late-${m.id}-${t}`,
          time: t,
          label: `${m.name} não confirmado`,
          detail: `${m.dosage} ${m.unit} — atrasado`,
          color: '#FF4D4D',
          icon: <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" />,
        });
      }
    }
  }

  for (const v of vitals) {
    const timeStr = new Date(v.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (v.type === 'blood_pressure') {
      timeline.push({
        id: v.id,
        time: timeStr,
        label: `Pressão registrada: ${v.systolic}/${v.diastolic} mmHg`,
        detail: v.classification || '',
        color: '#26C6DA',
        icon: <Heart className="w-4 h-4 text-[#26C6DA]" />,
      });
    } else if (v.type === 'hydration') {
      timeline.push({
        id: v.id,
        time: timeStr,
        label: `Hidratação: ${v.value} ${v.unit}`,
        detail: 'Registro de água',
        color: '#26C6DA',
        icon: <Droplets className="w-4 h-4 text-[#26C6DA]" />,
      });
    }
  }

  timeline.sort((a, b) => a.time.localeCompare(b.time));

  const TABS: { id: Tab; label: string }[] = [
    { id: 'idoso',    label: 'Idoso' },
    { id: 'cuidador', label: 'Cuidador' },
    { id: 'clinico',  label: 'Clínico' },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-6">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-[#0D3B66] to-[#1565C0] px-5 pt-5 pb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold mb-5 transition-all"
        >
          <ArrowLeft className="w-5 h-5" /> Voltar ao painel
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg">
            {patient.avatar_initials}
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">{patient.name}</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {patient.age ? `${patient.age} anos` : 'Idade não informada'}
              {patient.allergies ? ` · ${patient.allergies}` : ''}
            </p>
            <p className="text-white/50 text-xs mt-1">Cuidador: {profile.name}</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-5">

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl shadow-md p-1.5 grid grid-cols-3 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === t.id ? 'bg-[#0D3B66] text-white shadow' : 'text-[#666] hover:bg-[#F5F7FA]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════ ABA IDOSO ════════ */}
        {tab === 'idoso' && (
          <>
            {/* Day status */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-3">Resumo de hoje no app do idoso</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#F5F7FA] flex items-center justify-center text-3xl flex-shrink-0">
                  {status.emoji}
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ color: status.color }}>{status.label}</p>
                  <p className="text-[#666] text-sm mt-0.5">{status.detail}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-[#666]">Adesão hoje</span>
                  <span className="font-bold" style={{ color: status.color }}>{pct}%</span>
                </div>
                <div className="w-full h-3 bg-[#F5F7FA] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: status.color }}
                  />
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: <Pill className="w-5 h-5 text-[#26C6DA]" />,
                  bg: 'bg-[#E8F9FB]',
                  value: `${taken}/${totalSlots}`,
                  label: 'Remédios tomados',
                  sub: missedCount > 0 ? `${missedCount} atrasado(s)` : 'Em dia',
                  subColor: missedCount > 0 ? 'text-[#FF4D4D]' : 'text-[#32CD32]',
                },
                {
                  icon: <Droplets className="w-5 h-5 text-[#26C6DA]" />,
                  bg: 'bg-[#E8F9FB]',
                  value: `${hydTotal}ml`,
                  label: 'Água hoje',
                  sub: hydration.length > 0 ? `${hydration.length} registro(s)` : 'Sem registros',
                  subColor: hydTotal >= 1500 ? 'text-[#32CD32]' : 'text-[#B8650A]',
                },
                {
                  icon: <Heart className="w-5 h-5 text-[#FF4D4D]" />,
                  bg: 'bg-red-50',
                  value: lastVital ? `${lastVital.systolic}/${lastVital.diastolic}` : '—',
                  label: 'Última pressão',
                  sub: lastVital?.classification || 'Sem registro',
                  subColor: 'text-[#666]',
                },
                {
                  icon: <Clock className="w-5 h-5 text-[#F4A261]" />,
                  bg: 'bg-orange-50',
                  value: lastActivity ?? '—',
                  label: 'Último acesso',
                  sub: lastActivity ? 'Registrado hoje' : 'Sem atividade',
                  subColor: lastActivity ? 'text-[#32CD32]' : 'text-[#FF4D4D]',
                },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-2xl shadow-md p-4">
                  <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mb-2`}>
                    {item.icon}
                  </div>
                  <p className="text-xl font-bold text-[#0D3B66]">{item.value}</p>
                  <p className="text-xs text-[#666] font-semibold leading-tight">{item.label}</p>
                  <p className={`text-xs font-bold mt-1 ${item.subColor}`}>{item.sub}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-4">Linha do tempo de hoje</p>
              {timeline.length === 0 ? (
                <p className="text-[#999] text-sm text-center py-4">Nenhum evento registrado ainda.</p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, i) => (
                    <div key={event.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ background: event.color + '22', border: `2px solid ${event.color}44` }}
                        >
                          {event.icon}
                        </div>
                        {i < timeline.length - 1 && (
                          <div className="w-0.5 h-6 bg-[#F0F0F0] my-1" />
                        )}
                      </div>
                      <div className="pb-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#26C6DA]">{event.time}</span>
                          <p className="text-sm font-semibold text-[#111]">{event.label}</p>
                        </div>
                        {event.detail && (
                          <p className="text-xs text-[#999] mt-0.5">{event.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <button className="w-full py-4 rounded-3xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all"
              style={{ background: 'linear-gradient(135deg, #F4A261, #E76F51)' }}>
              <Phone className="w-5 h-5" />
              ACIONAR CUIDADO VINCULADO
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* ════════ ABA CUIDADOR ════════ */}
        {tab === 'cuidador' && (
          <>
            <div className="bg-white rounded-3xl shadow-md p-5 space-y-4">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide">Dados do paciente</p>
              <div className="space-y-3">
                {[
                  { icon: <User className="w-4 h-4 text-[#26C6DA]" />, label: 'Nome completo', value: patient.name },
                  { icon: <Calendar className="w-4 h-4 text-[#26C6DA]" />, label: 'Idade', value: patient.age ? `${patient.age} anos` : '—' },
                  { icon: <Phone className="w-4 h-4 text-[#26C6DA]" />, label: 'Telefone', value: patient.phone || '—' },
                  { icon: <Heart className="w-4 h-4 text-[#FF4D4D]" />, label: 'Contato emergência', value: patient.emergency_contact || '—' },
                  { icon: <Activity className="w-4 h-4 text-[#F4A261]" />, label: 'Alergias', value: patient.allergies || 'Nenhuma informada' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 py-2 border-b border-[#F5F7FA] last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
                      {row.icon}
                    </div>
                    <div>
                      <p className="text-xs text-[#999] font-semibold">{row.label}</p>
                      <p className="text-sm font-bold text-[#111]">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-3">Cuidador responsável</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#26C6DA] flex items-center justify-center text-white font-bold flex-shrink-0">
                  {profile.avatar_initials}
                </div>
                <div>
                  <p className="font-bold text-[#0D3B66]">{profile.name}</p>
                  <p className="text-xs text-[#26C6DA] font-semibold">Cuidador · THEO</p>
                  <p className="text-xs text-[#999]">{profile.phone || 'Telefone não informado'}</p>
                </div>
              </div>
            </div>

            {/* Medications list */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-3">Medicamentos cadastrados ({meds.length})</p>
              {meds.length === 0 ? (
                <p className="text-[#999] text-sm">Nenhum medicamento.</p>
              ) : (
                <div className="space-y-2.5">
                  {meds.map(m => {
                    const medTaken = todayLogs.filter(l => l.medication_id === m.id && l.status === 'taken').length;
                    return (
                      <div key={m.id} className="flex items-center gap-3 bg-[#F5F7FA] rounded-2xl p-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{ background: m.color + '22' }}>
                          {m.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#0D3B66] text-sm">{m.name}</p>
                          <p className="text-xs text-[#666]">{m.dosage} {m.unit} · {m.frequency}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#26C6DA]">{medTaken}/{m.times.length}</p>
                          <p className="text-xs text-[#999]">hoje</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════ ABA CLÍNICO ════════ */}
        {tab === 'clinico' && (
          <>
            {/* Latest vitals */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-4">Sinais vitais — registros de hoje</p>
              {vitals.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="w-10 h-10 text-[#D9D9D9] mx-auto mb-2" />
                  <p className="text-[#999] text-sm">Nenhum sinal vital registrado hoje.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vitals.slice(0, 8).map(v => {
                    const typeLabels: Record<string, string> = {
                      blood_pressure: '🫀 Pressão arterial',
                      glucose: '🩸 Glicose',
                      temperature: '🌡️ Temperatura',
                      oxygen: '💨 Oxigênio',
                      heart_rate: '❤️ Freq. cardíaca',
                      weight: '⚖️ Peso',
                      hydration: '💧 Hidratação',
                    };
                    const valueStr = v.type === 'blood_pressure'
                      ? `${v.systolic}/${v.diastolic} mmHg`
                      : `${v.value ?? '—'} ${v.unit}`;
                    return (
                      <div key={v.id} className="flex items-center justify-between bg-[#F5F7FA] rounded-2xl p-3">
                        <div>
                          <p className="text-sm font-bold text-[#0D3B66]">{typeLabels[v.type] ?? v.type}</p>
                          <p className="text-xs text-[#999]">{fmtTime(v.recorded_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-[#26C6DA]">{valueStr}</p>
                          {v.classification && (
                            <p className="text-xs text-[#666]">{v.classification}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clinical profile */}
            <div className="bg-white rounded-3xl shadow-md p-5 space-y-3">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide">Perfil clínico</p>
              {[
                { label: 'Tipo sanguíneo', value: patient.blood_type || '—' },
                { label: 'Peso', value: patient.weight_kg ? `${patient.weight_kg} kg` : '—' },
                { label: 'Altura', value: patient.height_cm ? `${patient.height_cm} cm` : '—' },
                { label: 'Alergias', value: patient.allergies || 'Nenhuma informada' },
                { label: 'Medicamentos em uso', value: patient.medications_in_use || `${meds.length} cadastrado(s) no THEO` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-[#F5F7FA] last:border-0">
                  <p className="text-sm text-[#666] font-semibold">{row.label}</p>
                  <p className="text-sm font-bold text-[#0D3B66]">{row.value}</p>
                </div>
              ))}
            </div>

            {/* Adherence history */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-3">Adesão medicamentosa hoje</p>
              {meds.length === 0 ? (
                <div className="flex items-center gap-3 py-4">
                  <Package className="w-8 h-8 text-[#D9D9D9]" />
                  <p className="text-[#999] text-sm">Nenhum medicamento cadastrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {meds.map(m => {
                    const medTaken = todayLogs.filter(l => l.medication_id === m.id && l.status === 'taken').length;
                    const medPct = adherencePct(medTaken, m.times.length);
                    const c = medPct >= 80 ? '#32CD32' : medPct >= 50 ? '#B8650A' : '#FF4D4D';
                    return (
                      <div key={m.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold text-[#0D3B66]">{m.name}</span>
                          <span className="font-bold" style={{ color: c }}>{medTaken}/{m.times.length} doses</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#F5F7FA] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${medPct}%`, background: c }} />
                        </div>
                        {m.total_qty !== null && m.total_qty !== undefined && m.total_qty <= 5 && (
                          <p className="text-xs text-[#B8650A] font-semibold mt-1">⚠ Apenas {m.total_qty} unidades restantes</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
