import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog } from '../../types';
import { notifyCarersOfPatient, notifyAdmins } from '../../lib/alerts';
import { Mic, MicOff, Volume2, Clock, Pill } from 'lucide-react';

interface Props {
  profile: Profile;
  medication: Medication;
  scheduledTime: string;
  onSuccess: () => void;
  onSkip: () => void;
}

export default function MedicationConfirmation({ profile, medication, scheduledTime, onSuccess, onSkip }: Props) {
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function formatTime(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'DA TARDE' : 'DA MANHÃ';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${minutes} ${period}`;
  }

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    speak('Confirmando medicação. Muito bem!');

    try {
      const today = new Date().toISOString().split('T')[0];

      // Create dose log
      await supabase.from('dose_logs').insert({
        medication_id: medication.id,
        user_id: profile.id,
        scheduled_date: today,
        scheduled_time: scheduledTime,
        status: 'taken',
        taken_at: new Date().toISOString(),
      });

      // Notify carers + admin (critical meds also notify admin)
      await notifyCarersOfPatient(
        profile.id,
        profile.id,
        'med_taken',
        `✅ ${profile.name.split(' ')[0]} tomou ${medication.name}`,
        `${medication.dosage} ${medication.unit} — ${scheduledTime}`,
        'info',
      );
      if (medication.priority === 'critical' || medication.priority === 'high') {
        await notifyAdmins(
          profile.id,
          profile.id,
          'med_taken',
          `${profile.name.split(' ')[0]} tomou ${medication.name}`,
          `Medicamento ${medication.priority} confirmado às ${scheduledTime}`,
          'info',
        );
      }

      // Decrement quantity_remaining (dynamic stock tracking)
      const currentRemaining = medication.quantity_remaining ?? medication.total_qty;
      if (currentRemaining !== null && currentRemaining > 0) {
        const doseQty = medication.dose_qty ?? 1;
        const newRemaining = Math.max(0, currentRemaining - doseQty);
        await supabase.from('medications').update({
          quantity_remaining: newRemaining,
        }).eq('id', medication.id);

        if (newRemaining <= 5 && currentRemaining > 5) {
          await notifyCarersOfPatient(
            profile.id, profile.id,
            'stock_low',
            `⚠️ Estoque baixo: ${medication.name}`,
            `Restam apenas ${newRemaining} ${medication.unit}(s). Providencie reposição.`,
            'warning',
          );
        }
      }

      // Update medication stock if tracking
      if (medication.observations?.includes('comprimido')) {
        // Could add stock tracking here
      }

      setLoading(false);
      onSuccess();
    } catch (error) {
      console.error('Error confirming medication:', error);
      setLoading(false);
      speak('Erro ao confirmar. Tente novamente.');
    }
  }

  function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      speak('Reconhecimento de voz não disponível neste navegador.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(true);
    speak('Estou ouvindo. Diga sim tomei, ou nao tomei.');

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setListening(false);

      if (transcript.includes('sim') || transcript.includes('tomei')) {
        handleConfirm();
      } else if (transcript.includes('não') || transcript.includes('nao')) {
        speak('Entendido. Vou lembrar mais tarde.');
        onSkip();
      } else if (transcript.includes('lembre') || transcript.includes('lembra')) {
        speak('Certo, vou lembrar em 30 minutos.');
        onSkip();
      } else {
        speak('Não entendi. Por favor, toque no botão confirmar.');
      }
    };

    recognition.onerror = () => {
      setListening(false);
      speak('Não consegui ouvir. Toque no botão confirmar.');
    };

    recognition.start();
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-[#26C6DA] px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Clock className="w-10 h-10 text-white" />
          <span className="text-white text-3xl sm:text-4xl font-bold tracking-wide">
            {formatTime(currentTime)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 max-w-lg mx-auto -mt-4">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
          {/* Emoji */}
          <div className="text-center mb-6">
            <span className="text-7xl sm:text-8xl">🤔</span>
          </div>

          {/* Question */}
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0D3B66] text-center mb-6 leading-tight">
            VOCÊ TOMOU O REMÉDIO MESMO?
          </h1>

          {/* Medication Card */}
          <div className="bg-[#FFF5F5] border-2 border-[#FF5252]/30 rounded-2xl p-5 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Pill className="w-6 h-6 text-[#FF5252]" />
                <div>
                  <p className="text-xs text-[#0D3B66]/60 font-semibold uppercase tracking-wider">Medicamento</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#0D3B66]">{medication.name.toUpperCase()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl">💊</span>
                <div>
                  <p className="text-xs text-[#0D3B66]/60 font-semibold uppercase tracking-wider">Quantidade</p>
                  <p className="text-lg font-semibold text-[#0D3B66]">{medication.dosage} - 1 {medication.unit}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="text-xs text-[#0D3B66]/60 font-semibold uppercase tracking-wider">Horário previsto</p>
                  <p className="text-lg font-semibold text-[#0D3B66]">{scheduledTime}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-5 sm:py-6 bg-[#26C6DA] hover:bg-[#1BA8BC] text-white text-xl sm:text-2xl font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-3 mb-4"
          >
            {loading ? (
              <span className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="text-2xl">✓</span>
                CONFIRMAR MEDICAÇÃO
              </>
            )}
          </button>

          {/* Voice Button */}
          <button
            onClick={startVoiceRecognition}
            disabled={listening}
            className={`w-full py-4 sm:py-5 rounded-2xl text-lg sm:text-xl font-bold transition-all flex items-center justify-center gap-3 ${
              listening
                ? 'bg-[#FF9800] text-white animate-pulse'
                : 'bg-[#E3F8FD] text-[#26C6DA] hover:bg-[#D0F0F8]'
            }`}
          >
            {listening ? (
              <>
                <MicOff className="w-6 h-6" />
                OUVINDO...
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                RESPONDER POR VOZ
              </>
            )}
          </button>

          {/* Help text */}
          <p className="text-center text-sm text-[#0D3B66]/50 mt-4">
            Toque no botão ou diga "Sim, tomei"
          </p>
        </div>

        {/* Skip Button */}
        <button
          onClick={onSkip}
          className="w-full mt-4 py-4 bg-white text-[#FF9800] text-lg font-semibold rounded-2xl border-2 border-[#FF9800] hover:bg-[#FFF8F0] transition-all"
        >
          ME LEMBRE MAIS TARDE
        </button>
      </div>
    </div>
  );
}
