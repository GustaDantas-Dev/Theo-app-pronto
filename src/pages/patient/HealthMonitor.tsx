import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, VitalLog, BloodPressureClassification } from '../../types';
import { notifyCarersOfPatient, notifyAdmins } from '../../lib/alerts';
import { ArrowLeft, Save, Heart, Clock, TrendingUp, TrendingDown, Minus, History } from 'lucide-react';

interface Props {
  profile: Profile;
  onBack: () => void;
  onViewHistory?: () => void;
}

function classifyBP(sys: number, dia: number): BloodPressureClassification {
  if (sys <= 90 || dia <= 60) return 'low';
  if (sys < 130 && dia < 85) return 'normal';
  if (sys < 140 && dia < 90) return 'elevated';
  return 'high';
}

const BP_CONFIG: Record<BloodPressureClassification, {
  bg: string; border: string; text: string; emoji: string;
  title: string; message: string; icon: typeof TrendingUp;
}> = {
  normal: {
    bg: '#DFFFE0', border: '#32CD32', text: '#1a6b1a',
    emoji: '😊', title: 'PRESSÃO NORMAL',
    message: 'ESTÁ ÓTIMO! CONTINUE ASSIM.',
    icon: Minus,
  },
  elevated: {
    bg: '#FFF3E0', border: '#F4A261', text: '#7a3f00',
    emoji: '⚠️', title: 'PRESSÃO LEVEMENTE ALTA',
    message: 'FIQUE ATENTO. DESCANSE UM POUCO.',
    icon: TrendingUp,
  },
  high: {
    bg: '#FFEDED', border: '#FF4D4D', text: '#7a0000',
    emoji: '🚨', title: 'PRESSÃO ALTA!',
    message: 'AVISE SEU CUIDADOR AGORA.',
    icon: TrendingUp,
  },
  low: {
    bg: '#E8F4FF', border: '#4DA6FF', text: '#003d7a',
    emoji: '💧', title: 'PRESSÃO BAIXA',
    message: 'DESCANSE E HIDRATE-SE.',
    icon: TrendingDown,
  },
};

function speak(text: string) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }
}

function ValueControl({
  label, value, onChange, min, max,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-[#555] uppercase tracking-wider mb-3">{label}</p>
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-[#26C6DA] p-2 gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#26C6DA] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 hover:bg-[#1BA8BC] active:scale-95 transition-all shadow"
          aria-label={`Diminuir ${label}`}
        >
          −
        </button>

        <span className="text-5xl sm:text-6xl font-bold text-[#111] flex-1 text-center tabular-nums">
          {value}
        </span>

        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#26C6DA] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 hover:bg-[#1BA8BC] active:scale-95 transition-all shadow"
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function HealthMonitor({ profile, onBack, onViewHistory }: Props) {
  const [systolic, setSystolic]   = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [history, setHistory]     = useState<VitalLog[]>([]);

  const classification = classifyBP(systolic, diastolic);
  const config = BP_CONFIG[classification];

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('vitals_logs')
      .select('*')
      .eq('user_id', profile.id)
      .eq('type', 'blood_pressure')
      .order('recorded_at', { ascending: false })
      .limit(5);
    if (data) setHistory(data as VitalLog[]);
  }, [profile.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Read classification aloud when it changes to high or low
  useEffect(() => {
    if (classification === 'high') {
      speak('Atenção! Pressão alta detectada. Avise seu cuidador.');
    } else if (classification === 'low') {
      speak('Pressão baixa detectada. Descanse e beba água.');
    }
  }, [classification]);

  async function handleSave() {
    setSaving(true);
    speak('Salvando sua medição.');

    const classLabel =
      classification === 'normal'   ? 'Normal' :
      classification === 'elevated' ? 'Levemente Alta' :
      classification === 'high'     ? 'Alta' : 'Baixa';

    const { error } = await supabase.from('vitals_logs').insert({
      user_id: profile.id,
      type: 'blood_pressure',
      systolic,
      diastolic,
      classification: classLabel,
      notes: '',
    });

    if (!error) {
      // Notify carers of the reading
      const firstName = profile.name.split(' ')[0];
      if (classification === 'high') {
        const msg = `Pressão ${systolic}/${diastolic} mmHg registrada.`;
        await notifyCarersOfPatient(
          profile.id, profile.id,
          'high_pressure',
          `🩺 ${firstName} — Pressão ALTA`,
          msg, 'critical',
        );
        await notifyAdmins(profile.id, profile.id, 'high_pressure', `${firstName} — Pressão Alta`, msg, 'critical');
      } else if (classification === 'low') {
        await notifyCarersOfPatient(
          profile.id, profile.id,
          'low_pressure',
          `🩺 ${firstName} — Pressão Baixa`,
          `Pressão ${systolic}/${diastolic} mmHg registrada.`, 'warning',
        );
      } else {
        await notifyCarersOfPatient(
          profile.id, profile.id,
          'bp_normal',
          `✅ ${firstName} — Pressão registrada`,
          `${systolic}/${diastolic} mmHg — ${classLabel}`, 'info',
        );
      }

      // If BP is abnormal, also create an emergency alert visible to carers
      if (classification === 'high' || classification === 'low') {
        const alertMsg =
          classification === 'high'
            ? `${firstName} registrou pressão alta (${systolic}/${diastolic}).`
            : `${firstName} registrou pressão baixa (${systolic}/${diastolic}).`;
        await supabase.from('emergency_alerts').insert({ user_id: profile.id, message: alertMsg });
      }

      setSaved(true);
      speak(`Medição salva com sucesso. Pressão ${classLabel}.`);
      loadHistory();

      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

      setTimeout(() => setSaved(false), 4000);
    }

    setSaving(false);
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const classColors: Record<string, string> = {
    Normal:         'bg-[#DFFFE0] text-[#1a6b1a]',
    'Levemente Alta': 'bg-[#FFF3E0] text-[#7a3f00]',
    Alta:           'bg-[#FFEDED] text-[#7a0000]',
    Baixa:          'bg-[#E8F4FF] text-[#003d7a]',
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-8">
      {/* ── Header ── */}
      <div className="bg-[#26C6DA] px-4 pt-5 pb-8">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-2xl sm:text-3xl leading-tight">
              REGISTRAR<br />MINHA SAÚDE
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {/* ── Main card ── */}
        <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-7">
          {/* Type badge */}
          <div className="inline-flex items-center gap-2 bg-orange-100 rounded-2xl px-4 py-2 mb-6">
            <Heart className="w-5 h-5 text-orange-700" />
            <span className="text-orange-900 font-bold text-lg tracking-wide">PRESSÃO</span>
          </div>

          {/* Controls */}
          <ValueControl
            label="PRESSÃO MÁXIMA"
            value={systolic}
            onChange={setSystolic}
            min={70}
            max={250}
          />
          <ValueControl
            label="PRESSÃO MÍNIMA"
            value={diastolic}
            onChange={setDiastolic}
            min={40}
            max={180}
          />

          {/* Classification card */}
          <div
            className="rounded-3xl border-2 p-5 mt-2 transition-all duration-500"
            style={{ backgroundColor: config.bg, borderColor: config.border }}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-4xl">{config.emoji}</span>
              <div>
                <p className="text-xl font-bold leading-tight" style={{ color: config.text }}>
                  {config.title}
                </p>
                <p className="text-3xl font-bold mt-0.5" style={{ color: config.text }}>
                  {systolic} POR {diastolic}
                </p>
              </div>
            </div>
            <p className="font-semibold text-base mt-2" style={{ color: config.text }}>
              {config.message}
            </p>
          </div>
        </div>

        {/* ── Save button ── */}
        {saved ? (
          <div className="w-full py-5 rounded-2xl bg-[#DFFFE0] border-2 border-[#32CD32] flex items-center justify-center gap-3 text-[#1a6b1a] text-xl font-bold">
            ✅ MEDIÇÃO SALVA COM SUCESSO!
          </div>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-5 sm:py-6 rounded-2xl bg-[#26C6DA] hover:bg-[#1BA8BC] active:scale-[0.98] text-white text-xl sm:text-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all disabled:opacity-60"
          >
            {saving ? (
              <span className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-7 h-7" />
                SALVAR MEDIÇÃO
              </>
            )}
          </button>
        )}

        {/* ── History ── */}
        {history.length > 0 && (
          <div className="bg-white rounded-3xl shadow-md p-5">
            <h2 className="text-lg font-bold text-[#0D3B66] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#26C6DA]" />
              ÚLTIMAS MEDIÇÕES
            </h2>
            <div className="space-y-3">
              {history.map(log => (
                <div key={log.id} className="flex items-center justify-between bg-[#F5F7FA] rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-2xl font-bold text-[#0D3B66]">
                      {log.systolic}/{log.diastolic}
                    </p>
                    <p className="text-xs text-[#0D3B66]/50 mt-0.5">{formatTime(log.recorded_at)}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${classColors[log.classification] ?? 'bg-stone-100 text-stone-500'}`}>
                    {log.classification}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── History link button ── */}
        {onViewHistory && (
          <button
            onClick={onViewHistory}
            className="w-full py-4 sm:py-5 rounded-2xl bg-[#0D3B66] hover:bg-[#0a2e52] active:scale-[0.98] text-white text-lg sm:text-xl font-bold flex items-center justify-center gap-3 shadow transition-all"
          >
            <History className="w-6 h-6" />
            VER HISTÓRICO
          </button>
        )}

        {/* ── Tip ── */}
        <div className="bg-[#E8F4FF] rounded-3xl p-5 border border-[#4DA6FF]/30">
          <p className="text-sm font-semibold text-[#003d7a] mb-1">💡 DICA</p>
          <p className="text-sm text-[#003d7a]/80 leading-relaxed">
            Meça sua pressão sempre sentado, com o braço apoiado. Repita se necessário e informe seu cuidador sobre valores alterados.
          </p>
        </div>
      </div>
    </div>
  );
}
