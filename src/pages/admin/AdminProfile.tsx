import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog, EmergencyAlert } from '../../types';
import { today, adherencePct, fmtTime } from '../../lib/utils';
import {
  Users, Pill, AlertTriangle, Activity, TrendingUp, Shield,
  Lock, Bell, FileText, Settings, Database, Download,
  CheckCircle2, Clock, Package, LogOut, Key, Eye,
  ToggleLeft, ToggleRight, ChevronRight, UserX, RefreshCw,
  Clipboard, Globe, Server, Heart, ArrowLeft,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onSignOut: () => void;
  onBack?: () => void;
}

type Section = 'overview' | 'users' | 'permissions' | 'audit' | 'alerts' | 'reports' | 'config' | 'security' | 'lgpd';

type UserFilter = 'all' | 'patient' | 'carer' | 'admin';

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  when: string;
  ip: string;
}

interface SystemAlert {
  id: string;
  type: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  responsible: string;
  since: string;
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-xl text-white font-bold text-sm flex items-center gap-2 ${ok ? 'bg-[#32CD32]' : 'bg-[#FF4D4D]'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

const SECTION_NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',     label: 'Visão geral',    icon: <Activity className="w-4 h-4" /> },
  { id: 'users',        label: 'Usuários',       icon: <Users className="w-4 h-4" /> },
  { id: 'permissions',  label: 'Permissões',     icon: <Shield className="w-4 h-4" /> },
  { id: 'audit',        label: 'Auditoria',      icon: <Clipboard className="w-4 h-4" /> },
  { id: 'alerts',       label: 'Alertas',        icon: <Bell className="w-4 h-4" /> },
  { id: 'reports',      label: 'Relatórios',     icon: <FileText className="w-4 h-4" /> },
  { id: 'config',       label: 'Config',         icon: <Settings className="w-4 h-4" /> },
  { id: 'security',     label: 'Segurança',      icon: <Lock className="w-4 h-4" /> },
  { id: 'lgpd',         label: 'LGPD',           icon: <Globe className="w-4 h-4" /> },
];

export default function AdminProfile({ profile, onSignOut, onBack }: Props) {
  const [section, setSection]       = useState<Section>('overview');
  const [users, setUsers]           = useState<Profile[]>([]);
  const [meds, setMeds]             = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs]     = useState<DoseLog[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [userSearch, setUserSearch] = useState('');
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // Config toggles state
  const [configs, setConfigs] = useState({
    whatsapp: true, telegram: false, autoBackup: true,
    twoFactor: false, alertPolicies: true, medLimit: true,
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = today();
    const [
      { data: allUsers },
      { data: allMeds },
      { data: logs },
      { data: alerts },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('medications').select('*').eq('active', true),
      supabase.from('dose_logs').select('*').eq('scheduled_date', todayStr).order('taken_at', { ascending: false }).limit(50),
      supabase.from('emergency_alerts').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    setUsers((allUsers as Profile[]) || []);
    setMeds((allMeds as Medication[]) || []);
    setDoseLogs((logs as DoseLog[]) || []);
    setEmergencies((alerts as EmergencyAlert[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──
  const patients     = users.filter(u => u.role === 'patient');
  const carers       = users.filter(u => u.role === 'carer');
  const admins       = users.filter(u => u.role === 'admin');
  const openAlerts   = emergencies.filter(e => !e.resolved);
  const taken        = doseLogs.filter(l => l.status === 'taken').length;
  const totalSlots   = meds.reduce((acc, m) => acc + m.times.length, 0);
  const adh          = adherencePct(taken, totalSlots);
  const lowStock     = meds.filter(m => m.total_qty !== null && m.total_qty !== undefined && m.total_qty <= 5);

  // ── Audit trail (synthetic from real data) ──
  const auditEntries: AuditEntry[] = [
    ...doseLogs.filter(l => l.status === 'taken' && l.taken_at).slice(0, 8).map(l => {
      const med  = meds.find(m => m.id === l.medication_id);
      const user = users.find(u => u.id === l.user_id);
      return {
        id: l.id,
        actor: user?.name ?? 'Paciente',
        action: 'confirmou medicação',
        target: med?.name ?? 'medicamento',
        when: l.taken_at ? fmtTime(l.taken_at) : l.scheduled_time,
        ip: '192.168.0.' + (Math.abs(l.id.charCodeAt(0)) % 254 + 1),
      };
    }),
    ...emergencies.slice(0, 4).map(e => {
      const user = users.find(u => u.id === e.user_id);
      return {
        id: e.id,
        actor: user?.name ?? 'Paciente',
        action: 'acionou emergência',
        target: 'SOS',
        when: fmtTime(e.created_at),
        ip: '10.0.0.' + (Math.abs(e.id.charCodeAt(0)) % 254 + 1),
      };
    }),
    ...users.slice(0, 4).map(u => ({
      id: 'reg-' + u.id,
      actor: 'Sistema',
      action: 'cadastrou usuário',
      target: u.name,
      when: new Date(u.created_at).toLocaleDateString('pt-BR'),
      ip: '127.0.0.1',
    })),
  ].slice(0, 15);

  // ── System alerts ──
  const sysAlerts: SystemAlert[] = [
    ...openAlerts.map(e => {
      const user = users.find(u => u.id === e.user_id);
      return {
        id: e.id, type: 'Emergência SOS',
        message: `${user?.name ?? 'Paciente'} acionou emergência`,
        severity: 'critical' as const,
        responsible: 'Cuidador vinculado',
        since: fmtTime(e.created_at),
      };
    }),
    ...lowStock.map(m => ({
      id: 'stock-' + m.id, type: 'Estoque crítico',
      message: `${m.name} – apenas ${m.total_qty} unidades`,
      severity: 'warning' as const,
      responsible: users.find(u => u.id === m.user_id)?.name ?? 'Paciente',
      since: 'Hoje',
    })),
    ...(patients.filter(p => !doseLogs.some(l => l.user_id === p.id)).slice(0, 3).map(p => ({
      id: 'inactive-' + p.id, type: 'Paciente inativo',
      message: `${p.name} sem atividade hoje`,
      severity: 'info' as const,
      responsible: 'Admin',
      since: 'Hoje',
    }))),
  ];

  // ── Filtered users ──
  const filteredUsers = users
    .filter(u => userFilter === 'all' || u.role === userFilter)
    .filter(u => !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()));

  const PERMISSION_ROWS = [
    { module: 'Pacientes',       admin: 'Total',   carer: 'Leitura',  patient: 'Próprio perfil' },
    { module: 'Medicamentos',    admin: 'Total',   carer: 'Edição',   patient: 'Leitura' },
    { module: 'Dose Logs',       admin: 'Total',   carer: 'Leitura',  patient: 'Escrita própria' },
    { module: 'Relatórios',      admin: 'Total',   carer: 'Parcial',  patient: 'Leitura' },
    { module: 'Configurações',   admin: 'Total',   carer: 'Parcial',  patient: 'Limitada' },
    { module: 'Alertas',         admin: 'Total',   carer: 'Leitura',  patient: 'Leitura' },
    { module: 'Usuários',        admin: 'Total',   carer: 'Nenhum',   patient: 'Nenhum' },
    { module: 'Sinais vitais',   admin: 'Total',   carer: 'Leitura',  patient: 'Escrita própria' },
    { module: 'Auditoria',       admin: 'Total',   carer: 'Nenhum',   patient: 'Nenhum' },
  ];

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-50 text-[#FF4D4D] border border-red-200',
    carer: 'bg-[#E8F9FB] text-[#26C6DA] border border-[#26C6DA]/30',
    patient: 'bg-[#E8F0FF] text-[#0D3B66] border border-[#0D3B66]/20',
  };
  const ROLE_LABELS: Record<string, string> = { admin: 'Admin', carer: 'Cuidador', patient: 'Paciente' };

  const SEVERITY_STYLES: Record<string, string> = {
    critical: 'bg-red-50 border-[#FF4D4D]/40 text-[#FF4D4D]',
    warning:  'bg-orange-50 border-orange-200 text-[#B8650A]',
    info:     'bg-blue-50 border-blue-200 text-[#1565C0]',
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* ── Master Header ── */}
      <div className="bg-gradient-to-br from-[#0D3B66] via-[#0D3B66] to-[#6A1B9A] px-6 pt-6 pb-10">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-semibold mb-5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </button>
        )}
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#26C6DA] to-[#0097A7] flex items-center justify-center text-white font-bold text-2xl shadow-xl">
              {profile.avatar_initials}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#32CD32] rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-white font-bold text-2xl">{profile.name}</h1>
              <span className="bg-[#6A1B9A] text-white text-xs font-bold px-3 py-1 rounded-full border border-purple-400/30">
                Administrador Master
              </span>
            </div>
            <p className="text-white/60 text-sm mt-1">Nível: Root · Acesso total ao sistema THEO</p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-white/50">
              <span>Criado em: {new Date(profile.created_at).toLocaleDateString('pt-BR')}</span>
              <span>·</span>
              <span>Último login: Hoje às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>·</span>
              <span>{profile.phone || 'Sem telefone'}</span>
            </div>
          </div>

          {/* Quick badges */}
          <div className="flex flex-col gap-2">
            {[
              { label: `${users.length} usuários`, color: 'bg-white/10 text-white' },
              { label: `${openAlerts.length} alertas`, color: openAlerts.length > 0 ? 'bg-[#FF4D4D]/80 text-white' : 'bg-white/10 text-white' },
              { label: `${adh}% adesão`, color: adh >= 80 ? 'bg-[#32CD32]/80 text-white' : 'bg-[#FFD600]/80 text-[#333]' },
            ].map(b => (
              <span key={b.label} className={`text-xs font-bold px-3 py-1 rounded-full ${b.color}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section nav ── */}
      <div className="sticky top-16 z-30 bg-white border-b border-stone-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {SECTION_NAV.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  section === s.id
                    ? 'bg-[#0D3B66] text-white shadow'
                    : 'text-[#666] hover:bg-[#F5F7FA]'
                }`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 -mt-5">

        {/* ══════════════════ VISÃO GERAL ══════════════════ */}
        {section === 'overview' && (
          <>
            <SectionTitle icon={<Activity className="w-5 h-5" />} title="Visão geral do sistema" />
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-stone-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Usuários cadastrados', value: users.length, sub: `${admins.length} admins · ${carers.length} cuidadores · ${patients.length} pacientes`, icon: Users, bg: 'bg-[#E8F9FB]', fg: 'text-[#26C6DA]' },
                  { label: 'Pacientes ativos', value: patients.length, sub: 'no sistema', icon: Heart, bg: 'bg-[#E8F0FF]', fg: 'text-[#0D3B66]' },
                  { label: 'Cuidadores ativos', value: carers.length, sub: 'vinculados', icon: Shield, bg: 'bg-blue-50', fg: 'text-blue-600' },
                  { label: 'Alertas críticos', value: openAlerts.length, sub: 'não resolvidos', icon: AlertTriangle, bg: openAlerts.length > 0 ? 'bg-red-50' : 'bg-[#F5F7FA]', fg: openAlerts.length > 0 ? 'text-[#FF4D4D]' : 'text-[#999]' },
                  { label: 'Taxa de adesão', value: `${adh}%`, sub: `${taken}/${totalSlots} doses hoje`, icon: TrendingUp, bg: adh >= 80 ? 'bg-green-50' : adh >= 50 ? 'bg-amber-50' : 'bg-red-50', fg: adh >= 80 ? 'text-[#32CD32]' : adh >= 50 ? 'text-[#B8650A]' : 'text-[#FF4D4D]' },
                  { label: 'Medicamentos ativos', value: meds.length, sub: `${lowStock.length} com estoque crítico`, icon: Pill, bg: 'bg-green-50', fg: 'text-[#32CD32]' },
                ].map(c => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                      <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
                        <Icon size={20} className={c.fg} />
                      </div>
                      <p className={`text-3xl font-bold ${c.fg}`}>{c.value}</p>
                      <p className="text-sm font-semibold text-[#333] mt-0.5">{c.label}</p>
                      <p className="text-xs text-[#999] mt-0.5">{c.sub}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* System health */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Database', status: 'online', color: 'text-[#32CD32]', bg: 'bg-[#32CD32]', icon: <Database className="w-5 h-5 text-[#32CD32]" /> },
                { label: 'Supabase API', status: 'online', color: 'text-[#32CD32]', bg: 'bg-[#32CD32]', icon: <Server className="w-5 h-5 text-[#32CD32]" /> },
                { label: 'Notificações', status: 'online', color: 'text-[#32CD32]', bg: 'bg-[#32CD32]', icon: <Bell className="w-5 h-5 text-[#32CD32]" /> },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-stone-100 p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    {s.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#0D3B66] text-sm">{s.label}</p>
                    <p className={`text-xs font-bold ${s.color}`}>● {s.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════════════ USUÁRIOS ══════════════════ */}
        {section === 'users' && (
          <>
            <SectionTitle icon={<Users className="w-5 h-5" />} title="Gerenciamento de usuários" count={filteredUsers.length} />

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="flex-1 min-w-[180px] px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-[#26C6DA] transition-all"
              />
              {(['all','patient','carer','admin'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setUserFilter(r)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                    userFilter === r
                      ? r === 'admin' ? 'bg-[#FF4D4D] border-[#FF4D4D] text-white'
                      : r === 'carer' ? 'bg-[#26C6DA] border-[#26C6DA] text-white'
                      : r === 'patient' ? 'bg-[#0D3B66] border-[#0D3B66] text-white'
                      : 'bg-[#0D3B66] border-[#0D3B66] text-white'
                      : 'border-stone-200 text-[#666] hover:border-[#26C6DA]'
                  }`}
                >
                  {r === 'all' ? 'Todos' : ROLE_LABELS[r]} {r !== 'all' && `(${users.filter(u => u.role === r).length})`}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F5F7FA] border-b border-stone-100">
                      {['Usuário', 'Perfil', 'Telefone', 'Cadastro', 'Ações'].map(h => (
                        <th key={h} className="text-left text-xs font-bold uppercase tracking-wide text-[#999] px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12">
                        <UserX className="w-8 h-8 text-[#D9D9D9] mx-auto mb-2" />
                        <p className="text-[#999] text-sm">Nenhum usuário encontrado</p>
                      </td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-[#F5F7FA]/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                              u.role === 'admin' ? 'bg-[#6A1B9A]' : u.role === 'carer' ? 'bg-[#26C6DA]' : 'bg-[#0D3B66]'
                            }`}>
                              {u.avatar_initials}
                            </div>
                            <div>
                              <p className="font-bold text-[#111] text-sm">{u.name}</p>
                              {u.age && <p className="text-xs text-[#999]">{u.age} anos</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[u.role]}`}>
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-[#666]">{u.phone || '—'}</td>
                        <td className="px-4 py-3.5 text-xs text-[#999]">
                          {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <ActionBtn label="Editar" color="text-[#26C6DA]" onClick={() => showToast(`Editando ${u.name}...`)} />
                            <ActionBtn label="Suspender" color="text-[#B8650A]" onClick={() => showToast(`${u.name} suspenso.`)} />
                            <ActionBtn label="Resetar senha" color="text-[#999]" onClick={() => showToast(`Link de reset enviado.`)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════ PERMISSÕES ══════════════════ */}
        {section === 'permissions' && (
          <>
            <SectionTitle icon={<Shield className="w-5 h-5" />} title="Permissões do sistema" />
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-50 flex items-center justify-between">
                <p className="text-sm font-bold text-[#0D3B66]">Matriz de permissões por perfil</p>
                <button onClick={() => showToast('Permissões salvas!')} className="text-xs font-bold text-[#26C6DA] flex items-center gap-1 hover:underline">
                  Editar permissões <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F5F7FA]">
                      <th className="text-left text-xs font-bold uppercase text-[#999] px-5 py-3 tracking-wide">Módulo</th>
                      <th className="text-center text-xs font-bold uppercase text-[#6A1B9A] px-4 py-3 tracking-wide">Admin</th>
                      <th className="text-center text-xs font-bold uppercase text-[#26C6DA] px-4 py-3 tracking-wide">Cuidador</th>
                      <th className="text-center text-xs font-bold uppercase text-[#0D3B66] px-4 py-3 tracking-wide">Paciente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {PERMISSION_ROWS.map(row => (
                      <tr key={row.module} className="hover:bg-[#F5F7FA]/50">
                        <td className="px-5 py-3.5 font-semibold text-[#111] text-sm">{row.module}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-bold text-[#6A1B9A] bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">{row.admin}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            row.carer === 'Nenhum' ? 'bg-[#F5F7FA] text-[#999] border-stone-200' : 'bg-[#E8F9FB] text-[#26C6DA] border-[#26C6DA]/30'
                          }`}>{row.carer}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            row.patient === 'Nenhum' ? 'bg-[#F5F7FA] text-[#999] border-stone-200' : 'bg-[#E8F0FF] text-[#0D3B66] border-[#0D3B66]/20'
                          }`}>{row.patient}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════ AUDITORIA ══════════════════ */}
        {section === 'audit' && (
          <>
            <SectionTitle icon={<Clipboard className="w-5 h-5" />} title="Logs do sistema" count={auditEntries.length} />
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-stone-50">
                {auditEntries.length === 0 ? (
                  <div className="py-14 text-center">
                    <Clipboard className="w-10 h-10 text-[#D9D9D9] mx-auto mb-2" />
                    <p className="text-[#999] text-sm">Nenhum log registrado.</p>
                  </div>
                ) : auditEntries.map(entry => (
                  <div key={entry.id} className="px-5 py-4 flex items-start gap-4 hover:bg-[#F5F7FA]/50 transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-[#E8F9FB] flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-[#26C6DA]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#111]">
                        <span className="font-bold">{entry.actor}</span>{' '}
                        <span className="text-[#666]">{entry.action}</span>{' '}
                        <span className="font-bold text-[#26C6DA]">{entry.target}</span>
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-[#999]">
                        <span>🕐 {entry.when}</span>
                        <span>🌐 IP: {entry.ip}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════ ALERTAS ══════════════════ */}
        {section === 'alerts' && (
          <>
            <SectionTitle icon={<Bell className="w-5 h-5" />} title="Alertas gerais" count={sysAlerts.length} />
            {sysAlerts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-stone-100 shadow-sm py-14 text-center">
                <CheckCircle2 className="w-12 h-12 text-[#32CD32] mx-auto mb-3" />
                <p className="font-bold text-[#333]">Nenhum alerta ativo</p>
                <p className="text-[#999] text-sm mt-1">Sistema funcionando normalmente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sysAlerts.map(a => (
                  <div key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-start gap-3 ${SEVERITY_STYLES[a.severity]}`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wide">{a.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          a.severity === 'critical' ? 'bg-red-100' : a.severity === 'warning' ? 'bg-orange-100' : 'bg-blue-100'
                        }`}>{a.severity === 'critical' ? 'Crítico' : a.severity === 'warning' ? 'Atenção' : 'Info'}</span>
                      </div>
                      <p className="text-sm font-semibold mt-1 text-[#111]">{a.message}</p>
                      <div className="flex gap-3 mt-1 text-xs text-[#999]">
                        <span>Responsável: {a.responsible}</span>
                        <span>·</span>
                        <span>{a.since}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════ RELATÓRIOS ══════════════════ */}
        {section === 'reports' && (
          <>
            <SectionTitle icon={<FileText className="w-5 h-5" />} title="Relatórios executivos" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Relatório de pacientes', icon: Users, color: 'bg-[#0D3B66]' },
                { label: 'Relatório de cuidadores', icon: Shield, color: 'bg-[#26C6DA]' },
                { label: 'Relatório de adesão', icon: TrendingUp, color: 'bg-[#32CD32]' },
                { label: 'Relatório clínico', icon: Activity, color: 'bg-[#6A1B9A]' },
              ].map(r => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.label}
                    onClick={() => showToast(`${r.label} gerado!`)}
                    className="bg-white rounded-2xl border border-stone-100 p-5 flex items-center gap-4 hover:shadow-md active:scale-[0.99] transition-all text-left shadow-sm"
                  >
                    <div className={`w-12 h-12 ${r.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0D3B66]">{r.label}</p>
                      <p className="text-xs text-[#999] mt-0.5">Clique para gerar</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#D9D9D9] ml-auto flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => showToast('Exportação PDF iniciada!')}
                className="bg-[#0D3B66] text-white rounded-2xl p-4 flex items-center justify-center gap-3 font-bold hover:bg-[#1565C0] transition-all shadow"
              >
                <Download className="w-5 h-5" /> Exportar tudo em PDF
              </button>
              <button
                onClick={() => showToast('Exportação CSV iniciada!')}
                className="bg-[#32CD32] text-white rounded-2xl p-4 flex items-center justify-center gap-3 font-bold hover:bg-[#28A228] transition-all shadow"
              >
                <Download className="w-5 h-5" /> Exportar CSV
              </button>
            </div>
          </>
        )}

        {/* ══════════════════ CONFIGURAÇÕES ══════════════════ */}
        {section === 'config' && (
          <>
            <SectionTitle icon={<Settings className="w-5 h-5" />} title="Configurações globais" />
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm divide-y divide-stone-50">
              {[
                { key: 'whatsapp' as const,     label: 'Integração WhatsApp',     desc: 'Enviar notificações via WhatsApp' },
                { key: 'telegram' as const,     label: 'Integração Telegram',     desc: 'Enviar notificações via Telegram' },
                { key: 'autoBackup' as const,   label: 'Backups automáticos',     desc: 'Realizar backup diário às 00:00' },
                { key: 'alertPolicies' as const,label: 'Políticas de alerta',     desc: 'Alertas automáticos por atraso' },
                { key: 'medLimit' as const,     label: 'Limite de medicações',    desc: 'Notificar ao atingir limite de atraso' },
                { key: 'twoFactor' as const,    label: '2FA para administradores', desc: 'Autenticação em dois fatores' },
              ].map(c => (
                <div key={c.key} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-[#111] text-sm">{c.label}</p>
                    <p className="text-xs text-[#999] mt-0.5">{c.desc}</p>
                  </div>
                  <button
                    onClick={() => { setConfigs(prev => ({ ...prev, [c.key]: !prev[c.key] })); showToast(`${c.label} ${!configs[c.key] ? 'ativado' : 'desativado'}.`); }}
                    className="flex-shrink-0"
                  >
                    {configs[c.key]
                      ? <ToggleRight className="w-9 h-9 text-[#26C6DA]" />
                      : <ToggleLeft className="w-9 h-9 text-[#D9D9D9]" />
                    }
                  </button>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Tempo limite medicação', value: '30 min', editable: true },
                { label: 'Limite de atrasos', value: '3x / dia', editable: true },
                { label: 'Intervalo de backup', value: '24 horas', editable: true },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
                  <p className="text-xs text-[#999] font-semibold mb-2">{c.label}</p>
                  <p className="text-xl font-bold text-[#0D3B66]">{c.value}</p>
                  <button onClick={() => showToast('Configuração salva!')} className="text-xs text-[#26C6DA] font-bold mt-2 hover:underline">Editar</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════════════ SEGURANÇA ══════════════════ */}
        {section === 'security' && (
          <>
            <SectionTitle icon={<Lock className="w-5 h-5" />} title="Segurança master" />
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Status cards */}
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
                <p className="text-xs font-bold text-[#666] uppercase tracking-wide">Status de segurança</p>
                {[
                  { label: '2FA', value: configs.twoFactor ? 'Ativado' : 'Desativado', ok: configs.twoFactor },
                  { label: 'Sessões ativas', value: '1 sessão', ok: true },
                  { label: 'Último backup', value: 'Hoje 00:00', ok: true },
                  { label: 'Logs suspeitos', value: 'Nenhum', ok: true },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-[#F5F7FA] last:border-0">
                    <p className="text-sm font-semibold text-[#333]">{s.label}</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.ok ? 'bg-green-50 text-[#32CD32]' : 'bg-red-50 text-[#FF4D4D]'}`}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
                <p className="text-xs font-bold text-[#666] uppercase tracking-wide">Ações de segurança</p>
                {[
                  { label: 'Trocar senha', icon: Key, color: 'bg-[#26C6DA]' },
                  { label: 'Encerrar todas as sessões', icon: LogOut, color: 'bg-[#F4A261]' },
                  { label: `${configs.twoFactor ? 'Desativar' : 'Ativar'} 2FA`, icon: Shield, color: 'bg-[#6A1B9A]' },
                  { label: 'Restaurar backup', icon: RefreshCw, color: 'bg-[#32CD32]' },
                ].map(a => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.label}
                      onClick={() => {
                        if (a.label.includes('2FA')) setConfigs(prev => ({ ...prev, twoFactor: !prev.twoFactor }));
                        showToast(`${a.label} realizado.`);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-100 hover:bg-[#F5F7FA] transition-all text-left"
                    >
                      <div className={`w-9 h-9 ${a.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <p className="font-semibold text-[#111] text-sm">{a.label}</p>
                      <ChevronRight className="w-4 h-4 text-[#D9D9D9] ml-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent accesses */}
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wide mb-4">Últimos acessos</p>
              {[
                { device: 'Chrome / Windows', ip: '189.112.34.21', when: 'Hoje 09:42', ok: true },
                { device: 'Safari / iPhone', ip: '189.112.34.21', when: 'Ontem 22:10', ok: true },
                { device: 'Chrome / Android', ip: '201.55.12.99', when: '19/06 15:23', ok: true },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#F5F7FA] last:border-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.ok ? 'bg-[#32CD32]' : 'bg-[#FF4D4D]'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#111]">{a.device}</p>
                    <p className="text-xs text-[#999]">IP: {a.ip}</p>
                  </div>
                  <p className="text-xs text-[#999]">{a.when}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════════════ LGPD ══════════════════ */}
        {section === 'lgpd' && (
          <>
            <SectionTitle icon={<Globe className="w-5 h-5" />} title="Conformidade LGPD" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
                <p className="text-xs font-bold text-[#666] uppercase tracking-wide">Status de conformidade</p>
                {[
                  { label: 'Dados protegidos', value: `${users.length} registros`, ok: true },
                  { label: 'Logs de consentimento', value: 'Ativos', ok: true },
                  { label: 'Criptografia em repouso', value: 'Ativada', ok: true },
                  { label: 'Compartilhamento externo', value: 'Nenhum', ok: true },
                  { label: 'Política de privacidade', value: 'v1.2 — 2026', ok: true },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between py-2 border-b border-[#F5F7FA] last:border-0">
                    <p className="text-sm font-semibold text-[#333]">{r.label}</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.ok ? 'bg-green-50 text-[#32CD32]' : 'bg-red-50 text-[#FF4D4D]'}`}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
                <p className="text-xs font-bold text-[#666] uppercase tracking-wide">Histórico de acesso a dados</p>
                {auditEntries.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-start gap-2 py-2 border-b border-[#F5F7FA] last:border-0">
                    <div className="w-2 h-2 rounded-full bg-[#26C6DA] flex-shrink-0 mt-1.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#111]">{e.actor} acessou {e.target}</p>
                      <p className="text-xs text-[#999]">{e.when} · {e.ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => showToast('Auditoria LGPD exportada!')}
              className="w-full sm:w-auto bg-[#6A1B9A] text-white font-bold rounded-2xl px-8 py-4 flex items-center justify-center gap-3 hover:bg-[#7B1FA2] transition-all shadow"
            >
              <Download className="w-5 h-5" /> Baixar auditoria LGPD
            </button>
          </>
        )}

        {/* ── Bottom actions (always visible) ── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6 border-t border-stone-200">
          <button
            onClick={() => showToast('Configurações salvas!')}
            className="flex-1 py-3.5 rounded-2xl bg-[#26C6DA] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#1BA8BC] transition-all shadow"
          >
            <CheckCircle2 className="w-5 h-5" /> Salvar configurações
          </button>
          <button
            onClick={() => showToast('Backup manual gerado!')}
            className="flex-1 py-3.5 rounded-2xl bg-[#32CD32] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#28A228] transition-all shadow"
          >
            <Database className="w-5 h-5" /> Gerar backup manual
          </button>
          <button
            onClick={onSignOut}
            className="flex-1 py-3.5 rounded-2xl bg-[#FF4D4D] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#E03E3E] transition-all shadow"
          >
            <LogOut className="w-5 h-5" /> Encerrar sessão
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-8 h-8 bg-[#E8F9FB] rounded-xl flex items-center justify-center text-[#26C6DA]">
        {icon}
      </div>
      <h2 className="font-bold text-[#0D3B66] text-lg">{title.toUpperCase()}</h2>
      {count !== undefined && (
        <span className="text-xs font-bold text-[#999] bg-[#F5F7FA] px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold ${color} hover:underline px-2 py-1 rounded-lg hover:bg-[#F5F7FA] transition-all`}
    >
      {label}
    </button>
  );
}
