import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, HydrationLog } from '../../types';
import { notifyCarersOfPatient } from '../../lib/alerts';
import { Droplets, Plus, Minus, Target } from 'lucide-react';

interface Props {
  profile: Profile;
  onBack: () => void;
}

const GLASS_ML  = 250;
const DAILY_GOAL = 2000;

function todayISO() { return new Date().toISOString().split('T')[0]; }

export default function HydrationTracker({ profile, onBack }: Props) {
  const [glasses, setGlasses] = useState(0);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('hydration_logs')
      .select('*')
      .eq('patient_id', profile.id)
      .eq('logged_date', todayISO())
      .maybeSingle();
    setGlasses((data as HydrationLog | null)?.cups ?? 0);
  }, [profile.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`hydration-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'hydration_logs',
        filter: `patient_id=eq.${profile.id}`,
      }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, profile.id]);

  async function updateGlasses(newCount: number) {
    if (saving) return;
    setSaving(true);
    const prevGlasses = glasses;
    const amountMl = newCount * GLASS_ML;
    await supabase.from('hydration_logs').upsert(
      {
        patient_id:  profile.id,
        cups:        newCount,
        amount_ml:   amountMl,
        goal_daily:  DAILY_GOAL,
        logged_date: todayISO(),
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'patient_id,logged_date' },
    );
    setGlasses(newCount);
    setSaving(false);

    // Notify carer when goal is reached
    if (newCount * GLASS_ML >= DAILY_GOAL && prevGlasses * GLASS_ML < DAILY_GOAL) {
      await notifyCarersOfPatient(
        profile.id, profile.id,
        'hydration_goal',
        `💧 ${profile.name.split(' ')[0]} atingiu a meta de hidratação!`,
        `${newCount} copos (${amountMl}ml) — meta diária cumprida.`,
        'info',
      );
    }
  }

  function addGlass()    { if (glasses < 12) updateGlasses(glasses + 1); }
  function removeGlass() { if (glasses > 0)  updateGlasses(glasses - 1); }

  function getPercentage() { return Math.min(100, Math.round((glasses * GLASS_ML / DAILY_GOAL) * 100)); }

  function getMessage(): string {
    const p = getPercentage();
    if (p >= 100) return 'Parabéns! Meta alcançada!';
    if (p >= 75)  return 'Quase lá!';
    if (p >= 50)  return 'Bom progresso!';
    if (p >= 25)  return 'Continue bebendo água!';
    return 'Comece a beber água!';
  }

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 0.9;
      speechSynthesis.speak(u);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-[#2196F3] px-5 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Droplets className="w-8 h-8" />
            HIDRATAÇÃO
          </h1>
          <p className="text-white/80 mt-2">Controle seu consumo de água</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Progress Card */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <div className="relative w-40 h-40 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" stroke="#E3F2FD" strokeWidth="12" fill="none" />
                <circle cx="60" cy="60" r="52" stroke="#2196F3" strokeWidth="12" fill="none"
                  strokeDasharray={`${getPercentage() * 3.27} 327`} strokeLinecap="round"
                  className="transition-all duration-500" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-[#0D3B66]">{glasses}</span>
                <span className="text-sm text-[#0D3B66]/60">copos</span>
              </div>
            </div>
            <p className={`text-xl font-semibold ${getPercentage() >= 100 ? 'text-[#4CAF50]' : 'text-[#2196F3]'}`}>
              {getMessage()}
            </p>
            <p className="text-[#0D3B66]/60 mt-1">{glasses * GLASS_ML}ml de {DAILY_GOAL}ml</p>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-6">
            <button onClick={() => { removeGlass(); speak('Removido um copo'); }}
              disabled={glasses === 0 || saving}
              className="w-16 h-16 rounded-full bg-[#FF5252]/20 flex items-center justify-center hover:bg-[#FF5252]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <Minus className="w-8 h-8 text-[#FF5252]" />
            </button>
            <div className="w-20 h-20 rounded-full bg-[#2196F3] flex items-center justify-center shadow-lg">
              <Droplets className="w-10 h-10 text-white" />
            </div>
            <button onClick={() => { addGlass(); speak('Adicionado um copo de água'); }}
              disabled={glasses >= 12 || saving}
              className="w-16 h-16 rounded-full bg-[#4CAF50]/20 flex items-center justify-center hover:bg-[#4CAF50]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <Plus className="w-8 h-8 text-[#4CAF50]" />
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#E3F2FD] rounded-2xl p-4 text-center">
            <Target className="w-8 h-8 text-[#2196F3] mx-auto mb-2" />
            <p className="text-xs text-[#0D3B66]/60">META DIÁRIA</p>
            <p className="text-xl font-bold text-[#0D3B66]">{DAILY_GOAL}ml</p>
          </div>
          <div className="bg-[#C8F7C5] rounded-2xl p-4 text-center">
            <span className="text-3xl">💧</span>
            <p className="text-xs text-[#0D3B66]/60">RESTAM</p>
            <p className="text-xl font-bold text-[#0D3B66]">
              {Math.max(0, Math.ceil((DAILY_GOAL - glasses * GLASS_ML) / GLASS_ML))} copos
            </p>
          </div>
        </div>

        {/* Glass visual representation */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-6">
          <p className="text-sm font-semibold text-[#0D3B66]/60 mb-3 uppercase tracking-wider">Copos de hoje</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: Math.max(glasses, 8) }).map((_, i) => (
              <div key={i} className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${i < glasses ? 'bg-[#2196F3] text-white' : 'bg-[#E0E0E0] text-[#BDBDBD]'}`}>
                💧
              </div>
            ))}
          </div>
        </div>

        <button onClick={onBack}
          className="w-full py-4 bg-[#2196F3] text-white text-lg font-semibold rounded-2xl hover:bg-[#1976D2] transition-all">
          VOLTAR AO INÍCIO
        </button>
      </div>
    </div>
  );
}
