import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog, EmergencyAlert, VitalLog, HydrationLog } from '../../types';
import { today, adherencePct, greeting, fmtDateFull, fmtTime } from '../../lib/utils';
import { useNotifications } from '../../hooks/useNotifications';
import { runEscalationChecks } from '../../lib/escalation';
import CarerPatientDetail from './CarerPatientDetail';
import {
  Bell, LayoutDashboard, Users, Pill, BarChart3, UserCircle,
  AlertTriangle, Clock, Package, Phone, ChevronRight,
  CheckCircle2, Heart, Droplets, Activity, Plus,
  LogOut, Settings,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onNavigate?: (page: string) => void;
  onSignOut?: () => void;
  unreadCount?: number;
}

type Screen = 'main' | 'patients' | 'patient_detail' | 'profile';

interface PatientRow {
  patient: Profile;
  meds: Medication[];
  logs: DoseLog[];
  vitals: VitalLog[];
  taken: number;
  total: number;
  pct: number;
  emergency?: EmergencyAlert;
  missed: Medication[];
  lowStock: Medication[];
  lastActivity: string | null;
  hydrationToday: number;
  lastBP: VitalLog | null;
}

interface AlertItem {
  id: string;
  type: 'emergency' | 'missed' | 'low_stock' | 'pressure';
  patient: Profile;
  title: string;
  detail: string;
  severity: 'critical' | 'warning';
  emergencyLat?: number | null;
  emergencyLng?: number | null;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function patientStatus(r: PatientRow): 'critical' | 'attention' | 'stable' {
  if (r.emergency || (r.missed.length > 0 && r.pct < 40)) return 'critical';
  if (r.pct < 65 || r.lowStock.length > 0) return 'attention';
  return 'stable';
}

const STATUS_INFO = {
  critical:  { emoji: '🔴', label: 'Crítico',  bg: 'bg-red-50',    text: 'text-[#FF4D4D]',  border: 'border-[#FF4D4D]/30' },
  attention: { emoji: '🟡', label: 'Atenção',  bg: 'bg-orange-50', text: 'text-[#B8650A]',  border: 'border-[#F4A261]/40' },
  stable:    { emoji: '🟢', label: 'Bem',      bg: 'bg-green-50',  text: 'text-[#15803D]',  border: 'border-stone-100' },
};

const BOTTOM_NAV = [
  { id: 'main'    as Screen, icon: LayoutDashboard, label: 'Painel' },
  { id: 'patients' as Screen, icon: Users,          label: 'Pacientes' },
  { id: '__meds__',           icon: Pill,           label: 'Medicamentos' },
  { id: '__reports__',        icon: BarChart3,      label: 'Relatórios' },
  { id: 'profile' as Screen,  icon: UserCircle,     label: 'Perfil' },
] as const;

export default function CarerDashboard({ profile, onNavigate, onSignOut, unreadCount = 0 }: Props) {
  const [screen, setScreen]         = useState<Screen>('main');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows]             = useState<PatientRow[]>([]);
  const [alerts, setAlerts]         = useState<AlertItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [bellOpen, setBellOpen]     = useState(false);
  const { notifications: dbNotifs, unread: dbUnread, markRead, markAllRead } = useNotifications(profile.id);
  const [pendingLink, setPendingLink] = useState('');
  const [linkMsg, setLinkMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: links } = await supabase
      .from('carer_patient_links')
      .select('patient_id')
      .eq('carer_id', profile.id);
    const ids = (links || []).map((l: { patient_id: string }) => l.patient_id);

    if (!ids.length) { setRows([]); setAlerts([]); setLoading(false); return; }

    const todayStr = today();
    const now = nowHHMM();

    const [
      { data: patients },
      { data: meds },
      { data: logs },
      { data: emergencies },
      { data: vitals },
      { data: hydration },
    ] = await Promise.all([
      supabase.from('profiles').select('*').in('id', ids),
      supabase.from('medications').select('*').in('user_id', ids).eq('active', true),
      supabase.from('dose_logs').select('*').in('user_id', ids).eq('scheduled_date', todayStr),
      supabase.from('emergency_alerts').select('*').in('user_id', ids).eq('resolved', false),
      supabase.from('vitals_logs').select('*').in('user_id', ids)
        .gte('recorded_at', todayStr + 'T00:00:00')
        .order('recorded_at', { ascending: false }),
      supabase.from('hydration_logs').select('*').in('patient_id', ids).eq('logged_date', todayStr),
    ]);

    const allPatients    = (patients as Profile[]) || [];
    const allMeds        = (meds as Medication[]) || [];
    const allLogs        = (logs as DoseLog[]) || [];
    const allEmergencies = (emergencies as EmergencyAlert[]) || [];
    const allVitals      = (vitals as VitalLog[]) || [];
    const allHydration   = (hydration as HydrationLog[]) || [];

    const builtRows: PatientRow[] = allPatients.map(p => {
      const pMeds   = allMeds.filter(m => m.user_id === p.id);
      const pLogs   = allLogs.filter(l => l.user_id === p.id);
      const pVitals = allVitals.filter(v => v.user_id === p.id);
      const taken   = pLogs.filter(l => l.status === 'taken').length;
      const total   = pMeds.reduce((a, m) => a + m.times.length, 0);
      const lowStock = pMeds.filter(m => {
        const rem = m.quantity_remaining ?? m.total_qty;
        return rem !== null && rem !== undefined && rem <= 5;
      });
      const missed  = pMeds.filter(m =>
        m.times.some(t => {
          if (t >= now) return false;
          const log = pLogs.find(l => l.medication_id === m.id && l.scheduled_time === t);
          return !log || log.status !== 'taken';
        })
      );
      const emergency      = allEmergencies.find(a => a.user_id === p.id);
      const lastBP         = pVitals.find(v => v.type === 'blood_pressure') || null;
      const hydrationRow   = allHydration.find(h => h.patient_id === p.id);
      const hydrationToday = hydrationRow?.cups ?? 0;
      const lastTaken      = pLogs.filter(l => l.taken_at).sort((a, b) => (b.taken_at ?? '').localeCompare(a.taken_at ?? ''))[0];
      const lastActivity   = lastTaken?.taken_at ? fmtTime(lastTaken.taken_at) : null;

      return { patient: p, meds: pMeds, logs: pLogs, vitals: pVitals, taken, total, pct: adherencePct(taken, total), emergency, missed, lowStock, lastActivity, hydrationToday, lastBP };
    });

    const alertList: AlertItem[] = [];
    for (const r of builtRows) {
      if (r.emergency) {
        const ea = r.emergency as EmergencyAlert & { latitude?: number; longitude?: number };
        alertList.push({ id: r.emergency.id, type: 'emergency', patient: r.patient, title: 'Emergência SOS', detail: 'Alerta ativo — responder imediatamente', severity: 'critical', emergencyLat: ea.latitude ?? ea.location_lat, emergencyLng: ea.longitude ?? ea.location_lng });
      }
      for (const m of r.missed) {
        const last = m.times.filter(t => t < now).at(-1);
        alertList.push({ id: `miss-${r.patient.id}-${m.id}`, type: 'missed', patient: r.patient, title: 'Remédio não tomado', detail: `${m.name}${last ? ` – ${last}` : ''} sem confirmar`, severity: 'critical' });
      }
      for (const m of r.lowStock) {
        alertList.push({ id: `stk-${m.id}`, type: 'low_stock', patient: r.patient, title: 'Remédio acabando', detail: `${m.name} – Restam ${m.quantity_remaining ?? m.total_qty} ${m.unit || 'unidades'}`, severity: 'warning' });
      }
      if (r.lastBP && r.lastBP.systolic && r.lastBP.systolic >= 140) {
        alertList.push({ id: `bp-${r.lastBP.id}`, type: 'pressure', patient: r.patient, title: 'Pressão alterada', detail: `${r.lastBP.systolic}/${r.lastBP.diastolic} mmHg`, severity: 'critical' });
      }
    }

    setRows(builtRows);
    setAlerts(alertList);
    setLoading(false);

    // Run escalation checks (fire-and-forget)
    runEscalationChecks(builtRows.map(r => ({
      patientId: r.patient.id,
      patientName: r.patient.name,
      meds: r.meds,
      todayLogs: r.logs,
      vitals: r.vitals,
      hydrationCups: r.hydrationToday,
      unackedEmergencyIds: r.emergency && !r.emergency.acknowledged ? [r.emergency.id] : [],
      emergencyCreatedAts: r.emergency && !r.emergency.acknowledged ? [r.emergency.created_at] : [],
    }))).catch(() => {});
  }, [profile.id]);

  useEffect(() => {
    load();
    // Realtime: re-run load() when any patient activity notification comes in
    const channel = supabase
      .channel(`carer-rt-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_user_id=eq.${profile.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vitals_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hydration_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, () => load())
      .subscribe();
    // Background polling fallback every 30s
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [load]);

  // ── Derived ──
  const totalTaken  = rows.reduce((a, r) => a + r.taken, 0);
  const totalSlots  = rows.reduce((a, r) => a + r.total, 0);
  const overallPct  = adherencePct(totalTaken, totalSlots);
  const criticals   = alerts.filter(a => a.severity === 'critical').length;
  const pending     = totalSlots - totalTaken;

  // ── Helpers ──
  function viewPatient(id: string) { setSelectedId(id); setScreen('patient_detail'); }

  async function linkPatient() {
    const query = pendingLink.trim();
    if (!query) return;
    const isCode = /^THEO-\d{5}$/i.test(query);
    let found: Profile | null = null;

    if (isCode) {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'patient').ilike('unique_code', query).maybeSingle();
      found = data;
    } else {
      const { data: byEmail } = await supabase.from('profiles').select('*').eq('role', 'patient').ilike('email', query).maybeSingle();
      found = byEmail;
      if (!found) {
        const { data: byName } = await supabase.from('profiles').select('*').eq('role', 'patient').ilike('name', `%${query}%`).maybeSingle();
        found = byName;
      }
    }

    if (!found) { setLinkMsg({ text: 'Paciente não encontrado. Use código THEO-XXXXX ou e-mail.', ok: false }); setTimeout(() => setLinkMsg(null), 4000); return; }
    const { error } = await supabase.from('carer_patient_links').upsert({ carer_id: profile.id, patient_id: found.id });
    if (error) { setLinkMsg({ text: 'Erro ao vincular.', ok: false }); }
    else { setLinkMsg({ text: `${found.name} vinculado!`, ok: true }); setPendingLink(''); load(); }
    setTimeout(() => setLinkMsg(null), 3000);
  }

  async function ackAlert(alertId: string) {
    await supabase.from('emergency_alerts').update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: profile.id,
    }).eq('id', alertId);
    load();
  }

  async function resolveAlert(alertId: string) {
    await supabase.from('emergency_alerts').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    }).eq('id', alertId);
    load();
  }

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

  const ALERT_ICON: Record<AlertItem['type'], React.ReactNode> = {
    emergency: <AlertTriangle className="w-4 h-4" />,
    missed:    <Clock className="w-4 h-4" />,
    low_stock: <Package className="w-4 h-4" />,
    pressure:  <Activity className="w-4 h-4" />,
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-[#26C6DA] to-[#0D3B66] px-5 pt-6 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium">{greeting()},</p>
            <h1 className="text-white font-bold text-2xl mt-0.5">{profile.name.split(' ').slice(0, 2).join(' ')}</h1>
            <span className="inline-block bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full mt-1">Cuidador</span>
            <p className="text-white/50 text-xs mt-2 capitalize">{fmtDateFull(today())}</p>
          </div>
          <button onClick={() => setBellOpen(o => !o)} className="relative w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
            {(criticals > 0 || dbUnread > 0) && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF4D4D] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#26C6DA]">
                {Math.min(criticals + dbUnread, 9)}
              </span>
            )}
          </button>
        </div>

        {bellOpen && (
          <div className="mt-4 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
              <p className="text-xs font-bold text-[#0D3B66]">Notificações</p>
              {dbUnread > 0 && (
                <button onClick={markAllRead} className="text-xs text-[#26C6DA] font-bold">Marcar lidas</button>
              )}
            </div>
            {dbNotifs.length === 0 ? (
              <p className="text-xs text-[#999] py-4 px-4">Nenhuma notificação.</p>
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

        {/* Status badge */}
        <div className="flex items-center gap-2 mt-3">
          <div className="w-2 h-2 rounded-full bg-[#32CD32] animate-pulse" />
          <span className="text-white/60 text-xs">Sistema ativo — Monitoramento em tempo real</span>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto pb-28 px-4 -mt-3 space-y-5">

        {/* ── 4 metric cards ── */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {[
            { value: rows.length,    label: 'Pacientes\nAtivos',     sub: '↑ monitorados', subColor: 'text-[#32CD32]' },
            { value: `${overallPct}%`, label: 'Aderência\nGeral',   sub: `${totalTaken}/${totalSlots} doses`, subColor: overallPct >= 80 ? 'text-[#32CD32]' : 'text-[#B8650A]' },
            { value: criticals,      label: 'Alertas\nCríticos',    sub: criticals > 0 ? 'ver agora' : 'tudo ok ✓', subColor: criticals > 0 ? 'text-[#FF4D4D]' : 'text-[#32CD32]', onClick: () => {} },
            { value: pending,        label: 'Pendências\nHoje',     sub: 'doses restantes', subColor: pending > 0 ? 'text-[#B8650A]' : 'text-[#32CD32]' },
          ].map((c, i) => (
            <div key={i} onClick={c.onClick} className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-3xl font-bold text-[#0D3B66]">{c.value}</p>
              <p className="text-xs font-semibold text-[#666] mt-1 leading-tight whitespace-pre-line">{c.label}</p>
              <p className={`text-xs font-bold mt-1.5 ${c.subColor}`}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Priority alerts ── */}
        {(screen === 'main' || screen === 'patients') && alerts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#222] flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" /> Alertas prioritários
              </h2>
            </div>
            <div className="space-y-2.5">
              {alerts.slice(0, screen === 'main' ? 3 : alerts.length).map(a => {
                const isCrit = a.severity === 'critical';
                const isEmergency = a.type === 'emergency';
                const emergencyData = isEmergency ? rows.find(r => r.patient.id === a.patient.id)?.emergency : undefined;
                const isAcked = emergencyData?.acknowledged ?? false;
                return (
                  <div key={a.id} className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${isCrit ? 'border-[#FF4D4D]' : 'border-[#F4A261]'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isCrit ? 'bg-red-50 text-[#FF4D4D]' : 'bg-orange-50 text-[#F4A261]'}`}>
                        {ALERT_ICON[a.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#222] text-sm">{a.patient.name.split(' ').slice(0, 2).join(' ')}</p>
                        <p className="text-xs text-[#666] mt-0.5">{a.title} — {a.detail}</p>
                        {isAcked && (
                          <p className="text-[10px] text-teal-600 font-semibold mt-1">✓ Assumido</p>
                        )}
                      </div>
                      <button
                        onClick={() => viewPatient(a.patient.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${isCrit ? 'bg-[#FF4D4D] text-white' : 'bg-[#F4A261] text-white'}`}
                      >
                        {isCrit ? 'Ver caso' : 'Acompanhar'}
                      </button>
                    </div>
                    {isEmergency && emergencyData && (
                      <div className="flex flex-wrap gap-2 mt-3 pl-11">
                        {a.emergencyLat && a.emergencyLng && (
                          <a
                            href={`https://maps.google.com/?q=${a.emergencyLat},${a.emergencyLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all flex items-center gap-1"
                          >
                            📍 Ver localização
                          </a>
                        )}
                        {!isAcked && (
                          <button onClick={() => ackAlert(emergencyData.id)}
                            className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all">
                            Assumir
                          </button>
                        )}
                        <button onClick={() => resolveAlert(emergencyData.id)}
                          className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-all">
                          Resolver
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── No alerts state ── */}
        {alerts.length === 0 && !loading && (screen === 'main') && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-[#32CD32] flex-shrink-0" />
            <div>
              <p className="font-bold text-[#333] text-sm">Tudo em dia!</p>
              <p className="text-xs text-[#999]">Nenhum alerta crítico no momento.</p>
            </div>
          </div>
        )}

        {/* ── Patient list ── */}
        {(screen === 'main' || screen === 'patients') && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#222] flex items-center gap-2 text-sm">
                <Heart className="w-4 h-4 text-[#FF4D4D]" /> Meus Pacientes
              </h2>
              <span className="text-xs text-[#999]">{rows.length} vinculado{rows.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-56 bg-white rounded-2xl animate-pulse shadow-sm" />)}
              </div>
            ) : rows.length === 0 ? (
              <EmptyPatients onLink={linkPatient} value={pendingLink} onChange={setPendingLink} msg={linkMsg} />
            ) : (
              <div className="space-y-3">
                {rows.map(r => (
                  <PatientCard key={r.patient.id} row={r} onView={() => viewPatient(r.patient.id)} />
                ))}
              </div>
            )}

            {/* Link patient shortcut */}
            {rows.length > 0 && screen === 'patients' && (
              <div className="mt-4 bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-bold text-[#0D3B66] mb-3">Vincular novo paciente</p>
                <div className="flex gap-2">
                  <input
                    value={pendingLink}
                    onChange={e => setPendingLink(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && linkPatient()}
                    placeholder="THEO-38472 ou e-mail..."
                    className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#26C6DA] bg-[#F5F7FA]"
                  />
                  <button onClick={linkPatient} className="bg-[#26C6DA] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1BA8BC] transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {linkMsg && (
                  <p className={`text-xs font-bold mt-2 ${linkMsg.ok ? 'text-[#32CD32]' : 'text-[#FF4D4D]'}`}>{linkMsg.text}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Carer profile screen ── */}
        {screen === 'profile' && <CarerProfile profile={profile} onSignOut={onSignOut} onNavigate={onNavigate} />}

      </div>

      {/* ── Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0D3B66] flex items-center z-50 shadow-2xl">
        {BOTTOM_NAV.map(item => {
          const Icon = item.icon;
          const isPage = item.id === 'main' || item.id === 'patients' || item.id === 'profile';
          const active = isPage && screen === item.id;
          const hasAlert = item.id === '__meds__' && false;
          const isCritAlert = item.id === 'patients' && criticals > 0;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === '__meds__' && onNavigate) { onNavigate('medications'); return; }
                if (item.id === '__reports__' && onNavigate) { onNavigate('reports'); return; }
                if (isPage) setScreen(item.id as Screen);
              }}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all relative ${active ? 'opacity-100' : 'opacity-50'}`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? 'text-[#26C6DA]' : 'text-white'}`} />
                {isCritAlert && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FF4D4D] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{criticals}</span>
                )}
              </div>
              <span className={`text-[10px] font-bold ${active ? 'text-[#26C6DA]' : 'text-white'}`}>{item.label}</span>
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#26C6DA] rounded-full" />}
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
  const info   = STATUS_INFO[status];
  const pctColor = r.pct >= 80 ? '#32CD32' : r.pct >= 50 ? '#B8650A' : '#FF4D4D';
  const bpStr  = r.lastBP ? `${r.lastBP.systolic}/${r.lastBP.diastolic}` : '—';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${info.border}`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${
            status === 'critical' ? 'bg-[#FF4D4D]' : status === 'attention' ? 'bg-[#F4A261]' : 'bg-[#26C6DA]'
          }`}>
            {r.patient.avatar_initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[#0D3B66] text-base leading-tight">{r.patient.name}</p>
                <p className="text-xs text-[#666] mt-0.5">
                  {r.patient.age ? `${r.patient.age} anos` : ''}
                  {r.patient.allergies ? ` · ${r.patient.allergies.split(',').slice(0, 2).join(' · ')}` : ''}
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${info.bg} ${info.text}`}>
                {info.emoji} {info.label}
              </span>
            </div>
            {r.emergency && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#FF4D4D] px-2 py-0.5 rounded-full mt-1">
                🚨 Emergência ativa
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#999] font-semibold">Aderência hoje</span>
            <span className="font-bold" style={{ color: pctColor }}>{r.pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#F5F7FA] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, background: pctColor }} />
          </div>
        </div>

        {/* 4 quick stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { icon: <Pill className="w-3.5 h-3.5 text-[#26C6DA]" />, label: 'Remédios', value: `${r.taken}/${r.total}` },
            { icon: <Droplets className="w-3.5 h-3.5 text-[#26C6DA]" />, label: 'Água', value: `${r.hydrationToday} reg.` },
            { icon: <Activity className="w-3.5 h-3.5 text-[#FF4D4D]" />, label: 'Pressão', value: bpStr },
            { icon: <Clock className="w-3.5 h-3.5 text-[#999]" />, label: 'Último', value: r.lastActivity ?? '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#F5F7FA] rounded-xl p-2 text-center">
              <div className="flex justify-center mb-1">{s.icon}</div>
              <p className="text-xs font-bold text-[#0D3B66] leading-tight">{s.value}</p>
              <p className="text-[10px] text-[#999] font-semibold leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {(r.missed.length > 0 || r.lowStock.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {r.missed.slice(0, 1).map(m => (
              <span key={m.id} className="flex items-center gap-1 text-xs font-semibold text-[#FF4D4D] bg-red-50 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> {m.name} atrasado
              </span>
            ))}
            {r.lowStock.slice(0, 1).map(m => (
              <span key={m.id} className="flex items-center gap-1 text-xs font-semibold text-[#B8650A] bg-orange-50 px-2 py-0.5 rounded-full">
                <Package className="w-3 h-3" /> {m.name} – {m.total_qty} un.
              </span>
            ))}
          </div>
        )}

        <button
          onClick={onView}
          className="w-full mt-3 py-2.5 rounded-xl bg-[#26C6DA] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1BA8BC] active:scale-[0.99] transition-all"
        >
          Ver Perfil <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Empty state with link form ────────────────────────────────────────────────
function EmptyPatients({ onLink, value, onChange, msg }: {
  onLink: () => void;
  value: string;
  onChange: (v: string) => void;
  msg: { text: string; ok: boolean } | null;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
      <div className="w-14 h-14 bg-[#E8F9FB] rounded-full mx-auto flex items-center justify-center">
        <Users className="w-7 h-7 text-[#26C6DA]" />
      </div>
      <div>
        <p className="font-bold text-[#0D3B66]">Nenhum paciente vinculado</p>
        <p className="text-xs text-[#999] mt-1">Busque um paciente pelo nome para vincular.</p>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onLink()}
          placeholder="Nome do paciente..."
          className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#26C6DA] bg-[#F5F7FA]"
        />
        <button onClick={onLink} className="bg-[#26C6DA] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1BA8BC] transition-all">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {msg && <p className={`text-xs font-bold ${msg.ok ? 'text-[#32CD32]' : 'text-[#FF4D4D]'}`}>{msg.text}</p>}
    </div>
  );
}

// ── Carer profile section ─────────────────────────────────────────────────────
function CarerProfile({ profile, onSignOut, onNavigate }: {
  profile: Profile;
  onSignOut?: () => void;
  onNavigate?: (page: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="bg-gradient-to-br from-[#26C6DA] to-[#0D3B66] rounded-3xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-white font-bold text-xl">
            {profile.avatar_initials}
          </div>
          <div>
            <h2 className="font-bold text-xl">{profile.name}</h2>
            <span className="text-white/70 text-sm">Cuidador THEO</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-[#32CD32]/30 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">● Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Função', value: 'Cuidador' },
          { label: 'Telefone', value: profile.phone || 'Não cadastrado' },
          { label: 'Nível', value: 'Profissional' },
          { label: 'Desde', value: new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs text-[#999] font-semibold">{c.label}</p>
            <p className="font-bold text-[#0D3B66] text-sm mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {[
          { icon: <Settings className="w-5 h-5 text-[#26C6DA]" />, label: 'Configurações', onClick: () => onNavigate?.('settings') },
          { icon: <UserCircle className="w-5 h-5 text-[#26C6DA]" />, label: 'Editar perfil', onClick: () => onNavigate?.('settings') },
          { icon: <Phone className="w-5 h-5 text-[#32CD32]" />, label: 'Suporte THEO', onClick: () => {} },
        ].map((item, i, arr) => (
          <button key={item.label} onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F5F7FA] transition-all ${i < arr.length - 1 ? 'border-b border-stone-50' : ''}`}>
            {item.icon}
            <span className="font-semibold text-[#111] text-sm flex-1 text-left">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-[#D9D9D9]" />
          </button>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className="w-full py-4 rounded-2xl bg-[#FF4D4D] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#E03E3E] active:scale-[0.99] transition-all shadow"
      >
        <LogOut className="w-5 h-5" /> Encerrar sessão
      </button>
    </div>
  );
}
