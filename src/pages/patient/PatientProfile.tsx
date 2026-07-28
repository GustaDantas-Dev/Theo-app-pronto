import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, VitalLog, FontSize } from '../../types';
import { initials } from '../../lib/utils';
import {
  ArrowLeft, Phone, Heart, Droplets, Thermometer,
  Activity, Shield, Bell, Volume2, Vibrate, Edit3,
  ChevronRight, CheckCircle2, AlertCircle, LogOut,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onUpdate: (p: Profile) => void;
  onBack: () => void;
  onNavigate?: (page: string) => void;
  onSignOut?: () => void;
}

type Tab = 'overview' | 'medical' | 'vitals' | 'accessibility';

function SwitchToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${on ? 'bg-[#26C6DA]' : 'bg-[#D9D9D9]'}`}
      aria-checked={on}
      role="switch"
    >
      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all ${on ? 'left-7' : 'left-0.5'}`} />
    </button>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F5F7FA] last:border-0">
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#999] uppercase tracking-wider">{label}</p>
        <p className="text-base font-semibold text-[#111] mt-0.5 leading-snug">{value}</p>
      </div>
    </div>
  );
}

export default function PatientProfile({ profile, onUpdate, onBack, onNavigate, onSignOut }: Props) {
  const [tab, setTab]             = useState<Tab>('overview');
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  // Vitals
  const [lastBP, setLastBP]       = useState<VitalLog | null>(null);
  const [hydrationToday, setHydrationToday] = useState(0);

  // Adherence stats
  const [takenToday, setTakenToday]   = useState(0);
  const [totalToday, setTotalToday]   = useState(0);
  const [streakDays, setStreakDays]   = useState(0);

  // Editable fields
  const [name, setName]               = useState(profile.name);
  const [phone, setPhone]             = useState(profile.phone);
  const [age, setAge]                 = useState(profile.age ? String(profile.age) : '');
  const [birthDate, setBirthDate]     = useState(profile.birth_date || '');
  const [bloodType, setBloodType]     = useState(profile.blood_type || '');
  const [weightKg, setWeightKg]       = useState(profile.weight_kg ? String(profile.weight_kg) : '');
  const [heightCm, setHeightCm]       = useState(profile.height_cm ? String(profile.height_cm) : '');
  const [allergies, setAllergies]     = useState(profile.allergies || '');
  const [medsInUse, setMedsInUse]     = useState(profile.medications_in_use || '');
  const [emergencyContact, setEmContact] = useState(profile.emergency_contact || '');
  const [kinship, setKinship]         = useState(profile.kinship || '');

  // Accessibility prefs (stored in profile fields via dark_mode + font_size)
  const [fontSize, setFontSize]       = useState<FontSize>(profile.font_size);
  const [darkMode, setDarkMode]       = useState(profile.dark_mode);
  const [voiceOn, setVoiceOn]         = useState(false);
  const [vibrationOn, setVibrationOn] = useState(true);

  const loadVitals = useCallback(async () => {
    // Last BP
    const { data: bpData } = await supabase
      .from('vitals_logs')
      .select('*')
      .eq('user_id', profile.id)
      .eq('type', 'blood_pressure')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastBP(bpData as VitalLog | null);

    // Hydration today
    const today = new Date().toISOString().split('T')[0];
    const { data: hydData } = await supabase
      .from('vitals_logs')
      .select('value')
      .eq('user_id', profile.id)
      .eq('type', 'hydration')
      .gte('recorded_at', today + 'T00:00:00')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hydData) setHydrationToday((hydData as { value: number }).value || 0);
  }, [profile.id]);

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: logs } = await supabase
      .from('dose_logs')
      .select('status')
      .eq('user_id', profile.id)
      .eq('scheduled_date', today);
    const allLogs = logs || [];
    setTakenToday(allLogs.filter(l => l.status === 'taken').length);
    setTotalToday(allLogs.length);

    // Simple streak: count consecutive days with at least 1 taken dose
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const { data: dl } = await supabase
        .from('dose_logs').select('status')
        .eq('user_id', profile.id).eq('scheduled_date', ds).eq('status', 'taken').limit(1);
      if (dl && dl.length > 0) streak++;
      else if (i > 0) break;
    }
    setStreakDays(streak);
  }, [profile.id]);

  useEffect(() => {
    loadVitals();
    loadStats();
  }, [loadVitals, loadStats]);

  async function handleSave() {
    setSaving(true);
    const updates = {
      name: name.trim(),
      phone,
      age: age ? parseInt(age) : null,
      birth_date: birthDate || null,
      blood_type: bloodType || null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      height_cm: heightCm ? parseFloat(heightCm) : null,
      allergies,
      medications_in_use: medsInUse,
      emergency_contact: emergencyContact,
      kinship,
      font_size: fontSize,
      dark_mode: darkMode,
      avatar_initials: initials(name.trim()),
    };
    const { data } = await supabase
      .from('profiles').update(updates).eq('id', profile.id).select().maybeSingle();
    if (data) onUpdate(data as Profile);
    setSaving(false); setSaved(true); setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  }

  function fmtDateBR(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  const adherencePct = totalToday > 0 ? Math.round((takenToday / totalToday) * 100) : 0;

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: 'overview',      label: 'Perfil',     emoji: '👤' },
    { id: 'medical',       label: 'Saúde',      emoji: '🩺' },
    { id: 'vitals',        label: 'Sinais',      emoji: '❤️' },
    { id: 'accessibility', label: 'Acesso',      emoji: '♿' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">

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
          <div className="flex-1">
            <h1 className="text-white font-bold text-2xl leading-tight">MEU PERFIL</h1>
            <p className="text-white/70 text-sm mt-0.5">Carteira digital de saúde</p>
          </div>
          <button
            onClick={() => setEditing(e => !e)}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
            aria-label={editing ? 'Cancelar edição' : 'Editar perfil'}
          >
            <Edit3 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4 -mt-6">

        {/* ── Avatar card ── */}
        <div className="bg-white rounded-3xl shadow-md p-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[#0D3B66] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg ring-4 ring-white">
            {profile.avatar_initials}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-lg font-bold text-[#111] border-b-2 border-[#26C6DA] pb-1 focus:outline-none bg-transparent"
              />
            ) : (
              <p className="text-xl font-bold text-[#111] leading-tight">{profile.name}</p>
            )}
            <p className="text-[#26C6DA] font-semibold text-sm mt-0.5">Paciente</p>
            {profile.age && <p className="text-[#666] text-sm">{profile.age} anos</p>}
          </div>
          {saved && (
            <div className="flex items-center gap-1 text-[#32CD32] text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" /> Salvo!
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-white rounded-2xl shadow-md p-2 grid grid-cols-4 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl transition-all text-xs font-bold ${
                tab === t.id
                  ? 'bg-[#26C6DA] text-white shadow'
                  : 'text-[#666] hover:bg-[#F5F7FA]'
              }`}
            >
              <span className="text-lg">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─────────── TAB: OVERVIEW ─────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Personal info */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-[#0D3B66] font-bold text-sm uppercase tracking-wide mb-3">
                Informações Pessoais
              </p>
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#666] mb-1">TELEFONE</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm"
                        placeholder="(92) 99999-9999" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#666] mb-1">IDADE</label>
                      <input type="number" value={age} onChange={e => setAge(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm"
                        placeholder="72" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#666] mb-1">NASCIMENTO</label>
                      <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#666] mb-1">TIPO SANGUÍNEO</label>
                      <select value={bloodType} onChange={e => setBloodType(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm bg-white">
                        <option value="">—</option>
                        {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => (
                          <option key={bt}>{bt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#666] mb-1">PESO (kg)</label>
                      <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm"
                        placeholder="68" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#666] mb-1">ALTURA (cm)</label>
                      <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm"
                        placeholder="158" />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <InfoRow icon="📱" label="Telefone" value={profile.phone} />
                  <InfoRow icon="🎂" label="Nascimento" value={fmtDateBR(profile.birth_date || '')} />
                  <InfoRow icon="🩸" label="Tipo sanguíneo" value={profile.blood_type || ''} />
                  <InfoRow icon="⚖️" label="Peso" value={profile.weight_kg ? `${profile.weight_kg} kg` : ''} />
                  <InfoRow icon="📏" label="Altura" value={profile.height_cm ? `${profile.height_cm} cm` : ''} />
                  {!profile.birth_date && !profile.blood_type && !profile.weight_kg && (
                    <div className="flex items-center gap-2 py-3 text-[#F4A261]">
                      <AlertCircle className="w-4 h-4" />
                      <p className="text-sm font-semibold">Toque em ✏️ para completar seu perfil</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Emergency contact */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-[#0D3B66] font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#FF4D4D]" /> Contatos de Emergência
              </p>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#666] mb-1">NOME DO CONTATO</label>
                    <input value={emergencyContact} onChange={e => setEmContact(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm"
                      placeholder="Ex: Carlos Silva" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#666] mb-1">PARENTESCO / CARGO</label>
                    <input value={kinship} onChange={e => setKinship(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm"
                      placeholder="Ex: Filho / Cuidador" />
                  </div>
                </div>
              ) : (
                <>
                  {profile.emergency_contact ? (
                    <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-bold text-[#111]">{profile.emergency_contact}</p>
                          {profile.kinship && (
                            <p className="text-sm text-[#666] mt-0.5">{profile.kinship}</p>
                          )}
                        </div>
                        {profile.phone && (
                          <a
                            href={`tel:${profile.phone}`}
                            className="flex items-center gap-1.5 bg-[#32CD32] text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-[#28a428] transition-all"
                          >
                            <Phone className="w-4 h-4" /> Ligar
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#999] text-sm py-2">Nenhum contato cadastrado.</p>
                  )}
                </>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-[#0D3B66] font-bold text-sm uppercase tracking-wide mb-4">
                Minha Rotina Hoje
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[#E8F9FB] rounded-2xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#26C6DA]">{takenToday}</p>
                  <p className="text-xs text-[#666] font-semibold leading-tight">de {totalToday} tomados</p>
                </div>
                <div className={`rounded-2xl p-3 text-center ${adherencePct >= 80 ? 'bg-[#DFFFE0]' : adherencePct >= 50 ? 'bg-orange-50' : 'bg-red-50'}`}>
                  <p className={`text-2xl font-bold ${adherencePct >= 80 ? 'text-[#32CD32]' : adherencePct >= 50 ? 'text-orange-500' : 'text-[#FF4D4D]'}`}>
                    {adherencePct}%
                  </p>
                  <p className="text-xs text-[#666] font-semibold">adesão</p>
                </div>
                <div className="bg-[#FFF9C4] rounded-2xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#B8650A]">{streakDays}</p>
                  <p className="text-xs text-[#666] font-semibold">dias seguidos</p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('history')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#F5F7FA] rounded-2xl text-[#0D3B66] font-semibold text-sm hover:bg-[#E8F9FB] transition-all"
                >
                  Ver histórico completo
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─────────── TAB: MEDICAL ─────────── */}
        {tab === 'medical' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow-md p-5">
              <p className="text-[#0D3B66] font-bold text-sm uppercase tracking-wide mb-3">
                Minhas Informações Médicas
              </p>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#666] mb-1">ALERGIAS</label>
                    <textarea value={allergies} onChange={e => setAllergies(e.target.value)} rows={2}
                      className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm resize-none"
                      placeholder="Ex: Alergia a dipirona, penicilina..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#666] mb-1">MEDICAMENTOS EM USO</label>
                    <textarea value={medsInUse} onChange={e => setMedsInUse(e.target.value)} rows={2}
                      className="w-full px-3 py-2.5 border-2 border-[#D9D9D9] rounded-xl focus:outline-none focus:border-[#26C6DA] text-sm resize-none"
                      placeholder="Ex: Losartana 50mg, Metformina..." />
                  </div>
                </div>
              ) : (
                <div>
                  {profile.allergies ? (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-[#FF4D4D]" />
                        <p className="text-xs font-bold text-[#FF4D4D] uppercase tracking-wide">Alergias</p>
                      </div>
                      <p className="text-sm text-[#c0392b] font-semibold leading-relaxed">{profile.allergies}</p>
                    </div>
                  ) : null}
                  {profile.medications_in_use ? (
                    <div className="bg-[#E8F9FB] border border-[#26C6DA]/20 rounded-2xl p-4">
                      <p className="text-xs font-bold text-[#26C6DA] uppercase tracking-wide mb-1">Medicamentos em uso</p>
                      <p className="text-sm text-[#0D3B66] font-medium leading-relaxed">{profile.medications_in_use}</p>
                    </div>
                  ) : null}
                  {!profile.allergies && !profile.medications_in_use && (
                    <p className="text-[#999] text-sm py-2">Nenhuma informação médica cadastrada ainda.</p>
                  )}
                </div>
              )}
            </div>

            {onNavigate && (
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => onNavigate('health_monitor')}
                  className="flex items-center justify-between bg-white rounded-2xl shadow-md p-4 text-left hover:bg-[#F5F7FA] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#FFEDED] flex items-center justify-center">
                      <Heart className="w-6 h-6 text-[#FF4D4D]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0D3B66]">Registrar Pressão</p>
                      <p className="text-xs text-[#999]">Medir e registrar pressão arterial</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#ccc]" />
                </button>
                <button
                  onClick={() => onNavigate('pressure_history')}
                  className="flex items-center justify-between bg-white rounded-2xl shadow-md p-4 text-left hover:bg-[#F5F7FA] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#DFFFE0] flex items-center justify-center">
                      <Activity className="w-6 h-6 text-[#32CD32]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0D3B66]">Histórico de Pressão</p>
                      <p className="text-xs text-[#999]">Ver gráficos e tendências</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#ccc]" />
                </button>
                <button
                  onClick={() => onNavigate('hydration')}
                  className="flex items-center justify-between bg-white rounded-2xl shadow-md p-4 text-left hover:bg-[#F5F7FA] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#E8F4FF] flex items-center justify-center">
                      <Droplets className="w-6 h-6 text-[#4DA6FF]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0D3B66]">Hidratação</p>
                      <p className="text-xs text-[#999]">Controlar ingestão de água</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#ccc]" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─────────── TAB: VITALS ─────────── */}
        {tab === 'vitals' && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#999] uppercase tracking-wider px-1">Últimos Registros</p>

            {/* BP */}
            <div className={`bg-white rounded-3xl shadow-md p-5 border-l-4 ${lastBP ? 'border-[#FF4D4D]' : 'border-[#D9D9D9]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-[#FF4D4D]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#999] uppercase">Pressão Arterial</p>
                    {lastBP ? (
                      <p className="text-2xl font-bold text-[#111]">{lastBP.systolic}/{lastBP.diastolic}</p>
                    ) : (
                      <p className="text-base font-semibold text-[#999]">Não registrado</p>
                    )}
                  </div>
                </div>
                {lastBP && (
                  <span className="text-xs text-[#999]">
                    {new Date(lastBP.recorded_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            {/* Hydration */}
            <div className="bg-white rounded-3xl shadow-md p-5 border-l-4 border-[#4DA6FF]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F4FF] flex items-center justify-center">
                  <Droplets className="w-6 h-6 text-[#4DA6FF]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#999] uppercase">Hidratação Hoje</p>
                  <p className="text-2xl font-bold text-[#111]">
                    {hydrationToday > 0 ? `${hydrationToday} copos` : 'Não registrado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Temp placeholder */}
            <div className="bg-white rounded-3xl shadow-md p-5 border-l-4 border-[#F4A261] opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <Thermometer className="w-6 h-6 text-[#F4A261]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#999] uppercase">Temperatura</p>
                  <p className="text-base font-semibold text-[#999]">Em breve</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-md p-5 border-l-4 border-[#32CD32] opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#DFFFE0] flex items-center justify-center">
                  <Activity className="w-6 h-6 text-[#32CD32]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#999] uppercase">Batimentos</p>
                  <p className="text-base font-semibold text-[#999]">Em breve</p>
                </div>
              </div>
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate('health_monitor')}
                className="w-full py-4 rounded-2xl bg-[#26C6DA] text-white font-bold text-base flex items-center justify-center gap-2 shadow hover:bg-[#1BA8BC] transition-all"
              >
                <Heart className="w-5 h-5" /> Registrar nova medição
              </button>
            )}
          </div>
        )}

        {/* ─────────── TAB: ACCESSIBILITY ─────────── */}
        {tab === 'accessibility' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow-md p-5 space-y-4">
              <p className="text-[#0D3B66] font-bold text-sm uppercase tracking-wide mb-2">
                Configurações de Acessibilidade
              </p>

              {/* Font size */}
              <div>
                <p className="text-sm font-bold text-[#333] mb-3">Tamanho da Fonte</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal','large','xlarge'] as FontSize[]).map(fs => (
                    <button
                      key={fs}
                      onClick={() => setFontSize(fs)}
                      className={`py-3 rounded-xl border-2 font-bold transition-all text-sm ${
                        fontSize === fs
                          ? 'bg-[#26C6DA] text-white border-[#26C6DA]'
                          : 'border-[#D9D9D9] text-[#666]'
                      }`}
                    >
                      {fs === 'normal' ? 'Normal' : fs === 'large' ? 'Grande' : 'Máximo'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              {[
                {
                  icon: <Bell className="w-5 h-5 text-[#0D3B66]" />,
                  label: 'Modo Escuro',
                  desc: 'Interface com fundo escuro',
                  on: darkMode,
                  toggle: () => setDarkMode(v => !v),
                },
                {
                  icon: <Volume2 className="w-5 h-5 text-[#26C6DA]" />,
                  label: 'Leitura por Voz',
                  desc: 'Narrar informações importantes',
                  on: voiceOn,
                  toggle: () => setVoiceOn(v => !v),
                },
                {
                  icon: <Vibrate className="w-5 h-5 text-[#F4A261]" />,
                  label: 'Vibração',
                  desc: 'Vibrar ao confirmar ações',
                  on: vibrationOn,
                  toggle: () => setVibrationOn(v => !v),
                },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-4 py-3 border-t border-[#F5F7FA]">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#111]">{item.label}</p>
                    <p className="text-xs text-[#999]">{item.desc}</p>
                  </div>
                  <SwitchToggle on={item.on} onToggle={item.toggle} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Edit save/cancel buttons ── */}
        {editing && (
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-4 rounded-2xl border-2 border-[#D9D9D9] text-[#666] font-bold hover:border-[#0D3B66] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] py-4 rounded-2xl bg-[#26C6DA] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#1BA8BC] transition-all disabled:opacity-60 shadow-lg"
            >
              {saving
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle2 className="w-5 h-5" /> SALVAR PERFIL</>}
            </button>
          </div>
        )}

        {/* ── Accessibility save ── */}
        {tab === 'accessibility' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-[#0D3B66] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#0a2e52] transition-all disabled:opacity-60 shadow-lg"
          >
            {saving
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'SALVAR CONFIGURAÇÕES'}
          </button>
        )}

        {/* ── Sign out ── */}
        {onSignOut && (
          <div className="bg-white rounded-3xl shadow-md p-5">
            <p className="text-[#0D3B66] font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-[#FF4D4D]" /> Sessão
            </p>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#0D3B66] flex items-center justify-center text-white font-bold flex-shrink-0">
                {profile.avatar_initials}
              </div>
              <div>
                <p className="font-bold text-[#111]">{profile.name}</p>
                <p className="text-sm text-[#26C6DA] font-semibold">Paciente · THEO</p>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="w-full py-4 rounded-2xl border-2 border-[#FF4D4D] text-[#FF4D4D] font-bold text-base flex items-center justify-center gap-2 hover:bg-red-50 active:scale-[0.99] transition-all"
            >
              <LogOut className="w-5 h-5" /> SAIR DA CONTA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
