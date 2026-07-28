import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog, EmergencyAlert, VitalLog } from '../../types';
import { today, adherencePct, greeting, fmtDateFull, fmtTime } from '../../lib/utils';
import { useNotifications } from '../../hooks/useNotifications';
import CarerPatientDetail from '../carer/CarerPatientDetail';
import {
  Bell, LayoutDashboard, Users, AlertTriangle, BarChart3,
  ChevronRight, Clock, Package, Phone, CheckCircle2,
  Heart, Droplets, Pill, ArrowLeft, Activity,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onNavigate?: (page: string) => void;
  onSignOut?: () => void;
  unreadCount?: number;
}

type Screen = 'main' | 'patients' | 'alerts' | 'reports' | 'patient_detail';

interface PatientRow {
  patient: Profile;
  carer: Profile | null;
  meds: Medication[];
  todayLogs: DoseLog[];
  vitals: VitalLog[];
  taken: number;
  total: number;
  pct: number;
  emergency?: EmergencyAlert;
  missedMeds: Medication[];
  lowStockMeds: Medication[];
  interactionsToday: number;
}

interface AlertItem {
  id: string;
  type: 'emergency' | 'missed' | 'low_stock' | 'pressure';
  patientName: string;
  patientId: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning';
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function patientStatus(r: PatientRow): 'critical' | 'attention' | 'stable' {
  if (r.emergency || (r.missedMeds.length > 0 && r.pct < 40)) return 'critical';
  if (r.pct < 65 || r.lowStockMeds.length > 0) return 'attention';
  return 'stable';
}

const STATUS_STYLES = {
  critical:  { badge: 'bg-[#FF4D4D] text-white',             border: 'border-[#FF4D4D]/30' },
  attention: { badge: 'bg-[#F4A261] text-white',             border: 'border-[#F4A261]/40' },
  stable:    { badge: 'bg-[#32CD32] text-white',             border: 'border-stone-100' },
};
const STATUS_LABELS = { critical: 'Crítico', attention: 'Atenção', stable: 'Estável' };

const ALERT_ICON_STYLES = {
  emergency: 'text-[#FF4D4D] bg-red-50',
  missed:    'text-[#FF4D4D] bg-red-50',
  pressure:  'text-[#FF4D4D] bg-red-50',
  low_stock: 'text-[#F4A261] bg-orange-50',
};

// ── Bottom nav ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'main'     as Screen, icon: LayoutDashboard, label: 'Painel' },
  { id: 'patients' as Screen, icon: Users,           label: 'Pacientes' },
  { id: 'alerts'   as Screen, icon: AlertTriangle,   label: 'Alertas' },
  { id: 'reports'  as Screen, icon: BarChart3,       label: 'Relatórios' },
];

export default function AdminDashboard({ profile, onNavigate, onSignOut, unreadCount = 0 }: Props) {
  const [screen, setScreen]         = useState<Screen>('main');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows]             = useState<PatientRow[]>([]);
  const [alerts, setAlerts]         = useState<AlertItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [bellOpen, setBellOpen]     = useState(false);
  const [suspendedCount, setSuspendedCount] = useState(0);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const { notifications: dbNotifs, unread: dbUnread, markRead, markAllRead } = useNotifications(profile.id);

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = today();
    const now = nowHHMM();

    const [
      { data: allProfiles },
      { data: allMeds },
      { data: allLogs },
      { data: allEmergencies },
      { data: allVitals },
      { data: allLinks },
    ] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('medications').select('*').eq('active', true),
      supabase.from('dose_logs').select('*').eq('scheduled_date', todayStr),
      supabase.from('emergency_alerts').select('*').eq('resolved', false),
      supabase.from('vitals_logs').select('*')
        .gte('recorded_at', todayStr + 'T00:00:00')
        .order('recorded_at', { ascending: false }),
      supabase.from('carer_patient_links').select('*'),
    ]);

    const profiles   = (allProfiles as Profile[]) || [];
    const meds       = (allMeds as Medication[]) || [];
    const logs       = (allLogs as DoseLog[]) || [];
    const emergencies = (allEmergencies as EmergencyAlert[]) || [];
    const vitals     = (allVitals as VitalLog[]) || [];
    const links      = (allLinks as { carer_id: string; patient_id: string }[]) || [];

    const patients = profiles.filter(p => p.role === 'patient');

    const builtRows: PatientRow[] = patients.map(p => {
      const pMeds  = meds.filter(m => m.user_id === p.id);
      const pLogs  = logs.filter(l => l.user_id === p.id);
      const pVitals = vitals.filter(v => v.user_id === p.id);
      const taken  = pLogs.filter(l => l.status === 'taken').length;
      const total  = pMeds.reduce((acc, m) => acc + m.times.length, 0);
      const lowStock = pMeds.filter(m => m.total_qty !== null && m.total_qty !== undefined && m.total_qty <= 5);
      const missed = pMeds.filter(m => m.times.some(t => {
        if (t >= now) return false;
        const log = pLogs.find(l => l.medication_id === m.id && l.scheduled_time === t);
        return !log || log.status !== 'taken';
      }));
      const emergency = emergencies.find(a => a.user_id === p.id);
      const link      = links.find(l => l.patient_id === p.id);
      const carer     = link ? profiles.find(pr => pr.id === link.carer_id) || null : null;
      const interactionsToday = pLogs.filter(l => l.status === 'taken').length + pVitals.length;

      return {
        patient: p, carer, meds: pMeds, todayLogs: pLogs, vitals: pVitals,
        taken, total, pct: adherencePct(taken, total),
        emergency, missedMeds: missed, lowStockMeds: lowStock, interactionsToday,
      };
    });

    // Build alert list
    const alertList: AlertItem[] = [];
    for (const r of builtRows) {
      if (r.emergency) {
        alertList.push({ id: r.emergency.id, type: 'emergency', patientName: r.patient.name, patientId: r.patient.id, title: 'Emergência SOS', detail: `Acionado às ${fmtTime(r.emergency.created_at)}`, severity: 'critical' });
      }
      for (const m of r.missedMeds) {
        const last = m.times.filter(t => t < now).at(-1);
        alertList.push({ id: `miss-${r.patient.id}-${m.id}`, type: 'missed', patientName: r.patient.name, patientId: r.patient.id, title: 'Remédio não tomado', detail: `${m.name} ${last ? `– passou das ${last}` : ''}`, severity: 'critical' });
      }
      for (const m of r.lowStockMeds) {
        alertList.push({ id: `stk-${m.id}`, type: 'low_stock', patientName: r.patient.name, patientId: r.patient.id, title: 'Remédio acabando', detail: `${m.name} – ${m.total_qty} comprimidos restando`, severity: 'warning' });
      }
      const highBP = r.vitals.find(v => v.type === 'blood_pressure' && v.systolic && v.systolic >= 140);
      if (highBP) {
        alertList.push({ id: `bp-${highBP.id}`, type: 'pressure', patientName: r.patient.name, patientId: r.patient.id, title: 'Pressão alta', detail: `${highBP.systolic}/${highBP.diastolic} mmHg`, severity: 'critical' });
      }
    }

    setRows(builtRows);
    setAlerts(alertList);
    setLoading(false);

    // Extra counts for new metric cards
    const [{ count: susp }, { count: escal }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).ilike('type', '%escalated%').eq('read', false),
    ]);
    setSuspendedCount(susp ?? 0);
    setEscalatedCount(escal ?? 0);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-rt-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_user_id=eq.${profile.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vitals_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, () => load())
      .subscribe();
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [load]);

  // ── Derived ──
  const totalTaken = rows.reduce((a, r) => a + r.taken, 0);
  const totalDoses = rows.reduce((a, r) => a + r.total, 0);
  const overallPct = adherencePct(totalTaken, totalDoses);
  const criticals  = alerts.filter(a => a.severity === 'critical').length;
  const sosAtivos  = rows.filter(r => r.emergency).length;

  function viewPatient(id: string) { setSelectedId(id); setScreen('patient_detail'); }

  // ── Patient Detail screen ──
  if (screen === 'patient_detail' && selectedId) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        <CarerPatientDetail
          profile={profile}
          patientId={selectedId}
          onBack={() => { setSelectedId(null); setScreen('patients'); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">

      {/* ── Blue header ── */}
      <div className="bg-gradient-to-br from-[#1DA1F2] to-[#0D3B66] pt-safe px-5 pt-5 pb-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium">{greeting()},</p>
            <h1 className="text-white font-bold text-2xl mt-0.5">{profile.name.split(' ').slice(0, 2).join(' ')}</h1>
            <p className="text-white/50 text-xs mt-1 capitalize">{fmtDateFull(today())}</p>
          </div>
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center"
          >
            <Bell className="w-6 h-6 text-white" />
            {(criticals > 0 || dbUnread > 0) && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF4D4D] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#1DA1F2]">
                {Math.min(criticals + dbUnread, 9)}
              </span>
            )}
          </button>
        </div>

        {bellOpen && (
          <div className="mt-4 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
              <p className="text-xs font-bold text-[#0D3B66]">Notificações do sistema</p>
              {dbUnread > 0 && (
                <button onClick={markAllRead} className="text-xs text-[#1DA1F2] font-bold">Marcar lidas</button>
              )}
            </div>
            {dbNotifs.length === 0 ? (
              <p className="text-xs text-[#999] py-4 px-4">Nenhuma notificação ativa.</p>
            ) : dbNotifs.slice(0, 6).map(n => {
              const isWarn = n.severity === 'critical' || n.severity === 'warning';
              return (
                <button key={n.id} onClick={() => { markRead(n.id); n.patient_id && viewPatient(n.patient_id); setBellOpen(false); }}
                  className={`w-full text-left px-4 py-3 border-b border-stone-50 last:border-0 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                  <p className={`text-xs font-bold ${isWarn ? 'text-[#FF4D4D]' : 'text-[#111]'}`}>{n.title}</p>
                  {n.message && <p className="text-xs text-[#999] mt-0.5">{n.message}</p>}
                  <p className="text-[10px] text-[#ccc] mt-0.5">{new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 -mt-3 space-y-5">

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            {
              value: rows.length,
              label: 'Pacientes\nAtivos',
              sub: '↑ +1 mês',
              subColor: 'text-[#32CD32]',
            },
            {
              value: `${overallPct}%`,
              label: 'Aderência\nGeral',
              sub: '↑ +4%',
              subColor: 'text-[#32CD32]',
            },
            {
              value: criticals,
              label: 'Alertas\nCríticos',
              sub: 'ver agora',
              subColor: 'text-[#FF4D4D]',
              onClick: () => setScreen('alerts'),
            },
            {
              value: sosAtivos,
              label: 'SOS\nAtivos',
              sub: sosAtivos > 0 ? 'responder' : 'sem SOS',
              subColor: sosAtivos > 0 ? 'text-[#FF4D4D]' : 'text-[#32CD32]',
              onClick: sosAtivos > 0 ? () => setScreen('alerts') : undefined,
            },
            {
              value: suspendedCount,
              label: 'Usuários\nSuspensos',
              sub: suspendedCount > 0 ? 'ver usuários' : 'nenhum',
              subColor: suspendedCount > 0 ? 'text-[#F4A261]' : 'text-[#32CD32]',
              onClick: suspendedCount > 0 ? () => setScreen('patients') : undefined,
            },
            {
              value: escalatedCount,
              label: 'Alertas\nEscalonados',
              sub: escalatedCount > 0 ? 'não lidos' : 'tudo ok',
              subColor: escalatedCount > 0 ? 'text-[#FF4D4D]' : 'text-[#32CD32]',
            },
          ].map((c, i) => (
            <button
              key={i}
              onClick={c.onClick}
              className="bg-white rounded-2xl shadow-sm p-4 text-left active:scale-[0.98] transition-all"
            >
              <p className="text-3xl font-bold text-[#0D3B66]">{c.value}</p>
              <p className="text-xs font-semibold text-[#666] mt-1 leading-tight whitespace-pre-line">{c.label}</p>
              <p className={`text-xs font-bold mt-1.5 ${c.subColor}`}>{c.sub}</p>
            </button>
          ))}
        </div>

        {/* ── Critical Alerts section ── */}
        {(screen === 'main' || screen === 'alerts') && alerts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#222] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#FF4D4D]" />
                Alertas Críticos
              </h2>
              {screen === 'main' && (
                <button onClick={() => setScreen('alerts')} className="text-[#1DA1F2] text-xs font-bold flex items-center gap-1">
                  Ver todos <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              {(screen === 'main' ? alerts.slice(0, 3) : alerts).map(a => (
                <button
                  key={a.id}
                  onClick={() => viewPatient(a.patientId)}
                  className={`w-full bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3 text-left border-l-4 active:scale-[0.99] transition-all ${
                    a.severity === 'critical' ? 'border-[#FF4D4D]' : 'border-[#F4A261]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ALERT_ICON_STYLES[a.type]}`}>
                    {a.type === 'low_stock'
                      ? <Package className="w-4 h-4" />
                      : a.type === 'pressure'
                        ? <Activity className="w-4 h-4" />
                        : <AlertTriangle className="w-4 h-4" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#222] text-sm">
                      {a.patientName.split(' ').slice(0, 2).join(' ')} – {a.title}
                    </p>
                    <p className="text-xs text-[#666] mt-0.5">{a.detail}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── No alerts state ── */}
        {screen === 'alerts' && alerts.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm py-14 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#32CD32] mx-auto mb-3" />
            <p className="font-bold text-[#333]">Nenhum alerta ativo</p>
            <p className="text-[#999] text-sm mt-1">Todos os pacientes estão em dia.</p>
          </div>
        )}

        {/* ── Patients section ── */}
        {(screen === 'main' || screen === 'patients') && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#222] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1DA1F2]" />
                Pacientes e Vínculos
              </h2>
              {screen === 'main' && (
                <button onClick={() => setScreen('patients')} className="text-[#1DA1F2] text-xs font-bold flex items-center gap-1">
                  Filtrar <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-44 bg-white rounded-2xl animate-pulse shadow-sm" />)}
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-14 text-center">
                <Users className="w-12 h-12 text-[#D9D9D9] mx-auto mb-3" />
                <p className="font-bold text-[#333]">Nenhum paciente cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map(r => <PatientCard key={r.patient.id} row={r} onView={() => viewPatient(r.patient.id)} />)}
              </div>
            )}
          </section>
        )}

        {/* ── Reports screen ── */}
        {screen === 'reports' && (
          <section className="space-y-4">
            <h2 className="font-bold text-[#222] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#1DA1F2]" />
              Relatórios
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Relatório de Pacientes',   icon: Users,          bg: 'bg-[#0D3B66]' },
                { label: 'Relatório de Cuidadores',  icon: Heart,          bg: 'bg-[#1DA1F2]' },
                { label: 'Relatório de Adesão',      icon: Activity,       bg: 'bg-[#32CD32]' },
                { label: 'Relatório Clínico',        icon: Pill,           bg: 'bg-[#F4A261]' },
              ].map(r => {
                const Icon = r.icon;
                return (
                  <button key={r.label} className={`${r.bg} rounded-2xl p-4 text-left flex flex-col gap-3 active:scale-[0.98] transition-all shadow`}>
                    <Icon className="w-7 h-7 text-white" />
                    <p className="text-white font-bold text-sm leading-tight">{r.label}</p>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {['Exportar PDF', 'Exportar CSV'].map(label => (
                <button key={label} className="w-full bg-white rounded-2xl shadow-sm py-4 font-bold text-[#0D3B66] flex items-center justify-center gap-2 active:scale-[0.99] transition-all border border-stone-100">
                  <BarChart3 className="w-5 h-5 text-[#1DA1F2]" />
                  {label}
                </button>
              ))}
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('admin_profile')}
                className="w-full bg-gradient-to-r from-[#0D3B66] to-[#6A1B9A] rounded-2xl p-4 text-white font-bold flex items-center justify-between"
              >
                <span>Perfil Administrador Master</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </section>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0D3B66] flex items-center safe-bottom z-50 shadow-2xl">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = screen === item.id || (screen === 'patient_detail' && item.id === 'patients');
          const hasAlert = item.id === 'alerts' && criticals > 0;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all relative ${active ? 'opacity-100' : 'opacity-50'}`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 ${active ? 'text-[#26C6DA]' : 'text-white'}`} />
                {hasAlert && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FF4D4D] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {criticals}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold ${active ? 'text-[#26C6DA]' : 'text-white'}`}>
                {item.label}
              </span>
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#26C6DA] rounded-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Patient Card ──────────────────────────────────────────────────────────────
function PatientCard({ row: r, onView }: { row: PatientRow; onView: () => void }) {
  const status = patientStatus(r);
  const styles = STATUS_STYLES[status];
  const pctColor = r.pct >= 80 ? '#32CD32' : r.pct >= 50 ? '#B8650A' : '#FF4D4D';
  const lastBP = r.vitals.find(v => v.type === 'blood_pressure');

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${styles.border}`}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Avatar stack */}
          <div className="relative flex-shrink-0">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
              status === 'critical' ? 'bg-[#FF4D4D]' : status === 'attention' ? 'bg-[#F4A261]' : 'bg-[#1DA1F2]'
            }`}>
              {r.patient.avatar_initials}
            </div>
            {r.carer && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#26C6DA] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white">
                {r.carer.avatar_initials.slice(0, 2)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[#222] text-base leading-tight">{r.patient.name}</p>
                <p className="text-xs text-[#666] mt-0.5">
                  {r.patient.age ? `${r.patient.age} anos` : ''}
                  {r.patient.allergies ? ` – ${r.patient.allergies.split(',').slice(0, 2).join(' – ')}` : ''}
                </p>
                {r.carer && (
                  <p className="text-xs text-[#999] mt-0.5">Cuidador: {r.carer.name.split(' ').slice(0, 2).join(' ')}</p>
                )}
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${styles.badge}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="w-full h-1.5 bg-[#F5F7FA] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, background: pctColor }} />
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: pctColor }} />
            <span className="text-xs font-bold text-[#222]">Adesão: <span style={{ color: pctColor }}>{r.pct}%</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-3 h-3 text-[#FF4D4D]" />
            <span className="text-xs text-[#666] font-semibold">
              {lastBP ? `${lastBP.systolic}/${lastBP.diastolic}` : 'Sem reg.'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[#1DA1F2]" />
            <span className="text-xs text-[#666] font-semibold">{r.interactionsToday} hoje</span>
          </div>
        </div>

        {/* Warnings */}
        {(r.missedMeds.length > 0 || r.lowStockMeds.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {r.missedMeds.slice(0, 1).map(m => (
              <span key={m.id} className="flex items-center gap-1 text-xs font-semibold text-[#FF4D4D] bg-red-50 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> {m.name} atrasado
              </span>
            ))}
            {r.lowStockMeds.slice(0, 1).map(m => (
              <span key={m.id} className="flex items-center gap-1 text-xs font-semibold text-[#B8650A] bg-orange-50 px-2 py-0.5 rounded-full">
                <Package className="w-3 h-3" /> {m.name} – {m.total_qty} un.
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onView}
          className="w-full mt-3 py-2.5 rounded-xl bg-[#1DA1F2] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#0D8FE0] active:scale-[0.99] transition-all"
        >
          Ver Perfil <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
