import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { MED_COLORS } from '../../lib/utils';
import { notifyUser, notifyAdmins } from '../../lib/alerts';
import {
  ArrowLeft, Plus, X, Clock, Pill,
  AlertCircle, CheckCircle2, ChevronDown,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onBack: () => void;
}

const ICONS = ['💊','🔵','🟡','🔴','🟢','💉','🌟','🧴','🩺','🫀','🧬','⚕️'];
const UNITS = ['comprimido','cápsula','ml','gotas','UI','sachê','ampola','mg','g'];
const FREQS = [
  'Todos os dias',
  'A cada 8 horas',
  'A cada 12 horas',
  'A cada 24 horas',
  'Somente manhã',
  'Somente tarde',
  'Somente noite',
  'Dias alternados',
  'Segunda a sexta',
  'Personalizado',
];

type Priority = 'low' | 'medium' | 'high' | 'critical';

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low:      { label: 'Baixa',    color: 'text-[#666]',    bg: 'bg-[#F5F7FA]', border: 'border-[#D9D9D9]', dot: 'bg-[#999]' },
  medium:   { label: 'Média',    color: 'text-[#B8650A]', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-400' },
  high:     { label: 'Alta',     color: 'text-[#c0392b]', bg: 'bg-red-50',    border: 'border-red-300',    dot: 'bg-red-500' },
  critical: { label: 'Crítica',  color: 'text-white',     bg: 'bg-[#FF4D4D]', border: 'border-[#FF4D4D]',  dot: 'bg-white' },
};

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function fmtDateBR(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function RegisterMedication({ profile, onBack }: Props) {
  // ── Patient state ──
  const [patients, setPatients]       = useState<Profile[]>([]);
  const [selPatient, setSelPatient]   = useState('');
  const [medCount, setMedCount]       = useState(0);

  // ── Form state ──
  const [icon, setIcon]               = useState('💊');
  const [name, setName]               = useState('');
  const [dosage, setDosage]           = useState('');
  const [unit, setUnit]               = useState('comprimido');
  const [doseQty, setDoseQty]         = useState(1);
  const [times, setTimes]             = useState<string[]>(['08:00']);
  const [freq, setFreq]               = useState('Todos os dias');
  const [customFreq, setCustomFreq]   = useState('');
  const [startDate, setStartDate]     = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate]         = useState('');
  const [endManual, setEndManual]     = useState(false);
  const [totalQty, setTotalQty]       = useState('');
  const [obs, setObs]                 = useState('');
  const [priority, setPriority]       = useState<Priority>('medium');

  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  // ── Load patients ──
  const loadPatients = useCallback(async () => {
    const { data: links } = await supabase
      .from('carer_patient_links').select('patient_id').eq('carer_id', profile.id);
    const ids = (links || []).map(l => l.patient_id);
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    const list = (data || []) as Profile[];
    setPatients(list);
    if (list.length && !selPatient) setSelPatient(list[0].id);
  }, [profile.id, selPatient]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Load existing med count for color cycling
  useEffect(() => {
    if (!selPatient) return;
    supabase.from('medications').select('id', { count: 'exact', head: true })
      .eq('user_id', selPatient).eq('active', true)
      .then(({ count }) => setMedCount(count || 0));
  }, [selPatient]);

  // Auto-calculate end date
  useEffect(() => {
    if (endManual || !startDate || !totalQty || times.length === 0) return;
    const qty = parseInt(totalQty);
    const dQty = doseQty || 1;
    if (!qty || !dQty) return;
    const dosesPerDay = times.length;
    const unitsPerDay = dosesPerDay * dQty;
    const days = Math.ceil(qty / unitsPerDay);
    setEndDate(addDaysToDate(startDate, days - 1));
  }, [startDate, totalQty, times.length, doseQty, endManual]);

  // ── Times management ──
  function addTime() {
    setTimes(prev => [...prev, '08:00']);
  }

  function updateTime(idx: number, val: string) {
    setTimes(prev => prev.map((t, i) => i === idx ? val : t));
  }

  function removeTime(idx: number) {
    if (times.length <= 1) return;
    setTimes(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Validation ──
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!selPatient) e.patient = 'Selecione um paciente.';
    if (!name.trim()) e.name = 'Nome é obrigatório.';
    if (!dosage.trim()) e.dosage = 'Dosagem é obrigatória.';
    if (times.some(t => !t)) e.times = 'Preencha todos os horários.';
    if (times.length === 0) e.times = 'Adicione pelo menos um horário.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save ──
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const finalFreq = freq === 'Personalizado' ? customFreq.trim() || 'Personalizado' : freq;
    const payload = {
      user_id:      selPatient,
      name:         name.trim(),
      dosage:       dosage.trim(),
      unit,
      icon,
      color:        MED_COLORS[medCount % MED_COLORS.length],
      frequency:    finalFreq,
      times:        times.filter(Boolean),
      observations: obs.trim(),
      start_date:   startDate || null,
      end_date:     endDate || null,
      active:       true,
      created_by:   profile.id,
      dose_qty:     doseQty,
      total_qty:    totalQty ? parseInt(totalQty) : null,
      priority,
    };

    const { error } = await supabase.from('medications').insert(payload);
    setSaving(false);

    if (!error) {
      // Notify patient that a new medication was added
      await notifyUser(
        selPatient, profile.id, selPatient,
        'new_medication',
        `💊 Novo medicamento: ${name}`,
        `${dosage} ${unit} — ${times.join(', ')}. Cadastrado por ${profile.name.split(' ')[0]}.`,
        'info',
      );
      // Notify admins of any critical medications
      if (priority === 'critical' || priority === 'high') {
        await notifyAdmins(
          profile.id, selPatient,
          'new_medication',
          `${profile.name.split(' ')[0]} cadastrou ${name}`,
          `Medicamento ${priority} para paciente.`, 'warning',
        );
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onBack();
      }, 2000);
    }
  }

  // ── Estimated end ──
  const estDays = (() => {
    if (!totalQty || times.length === 0) return null;
    const qty = parseInt(totalQty); const dq = doseQty || 1;
    if (!qty || !dq) return null;
    return Math.ceil(qty / (times.length * dq));
  })();

  const summaryFreq = freq === 'Personalizado' ? (customFreq || 'Personalizado') : freq;

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">

      {/* ── Header ── */}
      <div className="bg-[#0D3B66] px-4 pt-5 pb-8 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-0.5 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-xl sm:text-2xl leading-tight">
              CADASTRAR MEDICAMENTO
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Preencha as informações da medicação do paciente
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4">

        {/* ── Patient selector ── */}
        {patients.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-[#0D3B66] font-bold mb-1">Nenhum paciente vinculado</p>
            <p className="text-[#666] text-sm">Vincule um paciente antes de cadastrar medicamentos.</p>
          </div>
        ) : (
          <>
            {/* Patient tabs */}
            <div className="bg-white rounded-2xl shadow-md p-4">
              <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-3">Paciente</p>
              <div className="flex flex-wrap gap-2">
                {patients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelPatient(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selPatient === p.id
                        ? 'bg-[#0D3B66] text-white border-[#0D3B66]'
                        : 'border-[#D9D9D9] text-[#333] hover:border-[#26C6DA]'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      selPatient === p.id ? 'bg-white/20 text-white' : 'bg-[#26C6DA]/20 text-[#0D3B66]'
                    }`}>
                      {p.avatar_initials}
                    </div>
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
              {errors.patient && <p className="text-[#FF4D4D] text-xs mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.patient}</p>}
            </div>

            {/* ── Main form card ── */}
            <div className="bg-white rounded-2xl shadow-md p-5 sm:p-6 space-y-6">

              {/* Icon picker */}
              <div>
                <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-3">Ícone</p>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`w-11 h-11 rounded-xl text-2xl transition-all ${
                        icon === ic
                          ? 'bg-[#26C6DA]/20 ring-2 ring-[#26C6DA]'
                          : 'bg-[#F5F7FA] hover:bg-[#E8F9FB]'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">
                  Nome do Medicamento <span className="text-[#FF4D4D]">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={`w-full px-4 py-3.5 border-2 rounded-xl text-[#111] text-base focus:outline-none transition-all ${
                    errors.name ? 'border-[#FF4D4D]' : 'border-[#D9D9D9] focus:border-[#26C6DA]'
                  }`}
                  placeholder="Ex: Losartana"
                />
                {errors.name && <p className="text-[#FF4D4D] text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
              </div>

              {/* Dosage + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">
                    Dosagem <span className="text-[#FF4D4D]">*</span>
                  </label>
                  <input
                    value={dosage}
                    onChange={e => setDosage(e.target.value)}
                    className={`w-full px-4 py-3.5 border-2 rounded-xl text-[#111] focus:outline-none transition-all ${
                      errors.dosage ? 'border-[#FF4D4D]' : 'border-[#D9D9D9] focus:border-[#26C6DA]'
                    }`}
                    placeholder="Ex: 50mg"
                  />
                  {errors.dosage && <p className="text-[#FF4D4D] text-xs mt-1">{errors.dosage}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Unidade</label>
                  <div className="relative">
                    <select
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      className="w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all bg-white appearance-none"
                    >
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Dose quantity */}
              <div>
                <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">
                  Quantidade por Dose
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDoseQty(q => Math.max(1, q - 1))}
                    className="w-11 h-11 rounded-xl bg-[#F5F7FA] border-2 border-[#D9D9D9] text-[#0D3B66] text-xl font-bold hover:border-[#26C6DA] transition-all"
                  >−</button>
                  <span className="text-2xl font-bold text-[#111] w-8 text-center">{doseQty}</span>
                  <button
                    onClick={() => setDoseQty(q => q + 1)}
                    className="w-11 h-11 rounded-xl bg-[#F5F7FA] border-2 border-[#D9D9D9] text-[#0D3B66] text-xl font-bold hover:border-[#26C6DA] transition-all"
                  >+</button>
                  <span className="text-sm text-[#666]">{unit}(s) por dose</span>
                </div>
              </div>

              {/* Times */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#666] uppercase tracking-wider">
                    Horários <span className="text-[#FF4D4D]">*</span>
                  </label>
                  <span className="text-xs text-[#26C6DA] font-semibold">{times.length} horário{times.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {times.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 border-2 border-[#D9D9D9] focus-within:border-[#26C6DA] rounded-xl px-3 py-2 transition-all">
                        <Clock className="w-4 h-4 text-[#999] flex-shrink-0" />
                        <input
                          type="time"
                          value={t}
                          onChange={e => updateTime(i, e.target.value)}
                          className="flex-1 text-[#111] text-base font-semibold focus:outline-none bg-transparent"
                        />
                      </div>
                      {times.length > 1 && (
                        <button
                          onClick={() => removeTime(i)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl text-[#FF4D4D] hover:bg-red-50 transition-all border border-[#D9D9D9]"
                          aria-label="Remover horário"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.times && <p className="text-[#FF4D4D] text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.times}</p>}
                <button
                  onClick={addTime}
                  className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#26C6DA] hover:text-[#1BA8BC] transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-[#26C6DA]/10 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  Adicionar horário
                </button>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Frequência</label>
                <div className="relative">
                  <select
                    value={freq}
                    onChange={e => setFreq(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all bg-white appearance-none"
                  >
                    {FREQS.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                </div>
                {freq === 'Personalizado' && (
                  <input
                    value={customFreq}
                    onChange={e => setCustomFreq(e.target.value)}
                    className="mt-2 w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all"
                    placeholder="Descreva a frequência..."
                  />
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Início do Tratamento</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setEndManual(false); }}
                    className="w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">
                    Fim da Cartela
                    {!endManual && endDate && (
                      <span className="ml-1 text-[#26C6DA] normal-case font-normal">(auto)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); setEndManual(true); }}
                    className="w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all"
                  />
                </div>
              </div>

              {/* Total quantity */}
              <div>
                <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">
                  Quantidade Total da Cartela
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalQty}
                  onChange={e => { setTotalQty(e.target.value); setEndManual(false); }}
                  className="w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all"
                  placeholder="Ex: 30"
                />
                {estDays && (
                  <p className="text-xs text-[#26C6DA] mt-1.5 font-semibold">
                    ≈ {estDays} dia{estDays !== 1 ? 's' : ''} de tratamento com {times.length} dose{times.length !== 1 ? 's' : ''}/dia
                  </p>
                )}
              </div>

              {/* Observations */}
              <div>
                <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Observações ao Tomar</label>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3.5 border-2 border-[#D9D9D9] rounded-xl text-[#111] focus:outline-none focus:border-[#26C6DA] transition-all resize-none"
                  placeholder="Ex: Tomar após o café da manhã. Não tomar em jejum. Evitar leite."
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-[#666] uppercase tracking-wider mb-3">Prioridade</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setPriority(key)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                        priority === key
                          ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-[#0D3B66]/20`
                          : 'bg-white border-[#D9D9D9] hover:border-[#26C6DA]'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priority === key ? cfg.dot : 'bg-[#D9D9D9]'}`} />
                      <span className={`text-sm font-bold ${priority === key ? cfg.color : 'text-[#666]'}`}>{cfg.label}</span>
                    </button>
                  ))}
                </div>
                {priority === 'critical' && (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-[#FF4D4D] flex-shrink-0" />
                    <p className="text-xs text-[#c0392b] font-semibold">Prioridade crítica gera alertas mais fortes para o paciente e cuidador.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Summary card ── */}
            <div className="bg-[#0D3B66] rounded-2xl shadow-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="w-5 h-5 text-[#26C6DA]" />
                <p className="text-white font-bold text-sm uppercase tracking-wide">Resumo da Prescrição</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Medicamento', value: name || '—' },
                  { label: 'Dose', value: dosage ? `${doseQty}x ${dosage} (${unit})` : '—' },
                  {
                    label: 'Horários',
                    value: times.filter(Boolean).join(' / ') || '—',
                  },
                  { label: 'Frequência', value: summaryFreq },
                  { label: 'Duração', value: estDays ? `${estDays} dias` : '—' },
                  {
                    label: 'Início',
                    value: startDate ? fmtDateBR(startDate) : '—',
                  },
                  {
                    label: 'Fim estimado',
                    value: endDate ? fmtDateBR(endDate) : '—',
                  },
                  { label: 'Prioridade', value: PRIORITY_CONFIG[priority].label },
                ].map(row => (
                  <div key={row.label} className="flex items-start justify-between gap-2">
                    <span className="text-white/50 text-sm flex-shrink-0">{row.label}:</span>
                    <span className="text-white text-sm font-semibold text-right">{row.value}</span>
                  </div>
                ))}
                {obs && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-white/50 text-xs mb-1">Observações:</p>
                    <p className="text-white/80 text-xs leading-relaxed">{obs}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Success state ── */}
            {saved && (
              <div className="flex items-center gap-3 bg-[#DFFFE0] border-2 border-[#32CD32] rounded-2xl px-5 py-4">
                <CheckCircle2 className="w-6 h-6 text-[#32CD32] flex-shrink-0" />
                <div>
                  <p className="text-[#1a6b1a] font-bold">Medicamento cadastrado com sucesso!</p>
                  <p className="text-[#1a6b1a]/70 text-sm">Redirecionando para a lista...</p>
                </div>
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-4 rounded-2xl border-2 border-[#D9D9D9] bg-white text-[#666] text-base font-semibold hover:border-[#0D3B66] hover:text-[#0D3B66] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex-[2] py-4 rounded-2xl bg-[#26C6DA] hover:bg-[#1BA8BC] active:scale-[0.99] text-white text-base font-bold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-60"
              >
                {saving ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    SALVAR MEDICAMENTO
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
