import { useEffect, useState } from 'react';
import { Home, Pill, Clock, Package } from 'lucide-react';
import type { Medication } from '../../types';

interface Props {
  medication: Medication;
  takenTime: string;
  remainingStock?: number;
  nextMedication?: { name: string; time: string } | null;
  onGoHome: () => void;
}

function Confetti() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([]);

  useEffect(() => {
    const colors = ['#26C6DA', '#4CAF50', '#FF9800', '#FF5252', '#0D3B66'];
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            animationDelay: `${p.delay}s`,
            width: '10px',
            height: '10px',
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

export default function SuccessConfirmation({ medication, takenTime, remainingStock = 8, nextMedication, onGoHome }: Props) {
  const [showCheck, setShowCheck] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setShowCheck(true), 300);
    const timer2 = setTimeout(() => setShowContent(true), 800);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  }

  useEffect(() => {
    speak('Muito bem! Medicação registrada com sucesso.');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#C8F7C5] to-[#F5F7FA] flex flex-col items-center justify-center p-4 sm:p-6">
      <Confetti />

      {/* Success Animation */}
      <div className="relative mb-8">
        <div className={`transition-all duration-500 ${showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <div className="w-32 h-32 sm:w-40 sm:h-40 bg-[#4CAF50] rounded-full flex items-center justify-center shadow-2xl">
            <svg className="w-16 h-16 sm:w-20 sm:h-20 text-white animate-check" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw"
              />
            </svg>
          </div>
        </div>

        {/* Sparkles */}
        {showCheck && (
          <>
            <span className="absolute -top-2 -right-2 text-3xl animate-bounce">✨</span>
            <span className="absolute -bottom-2 -left-2 text-2xl animate-bounce delay-100">🎉</span>
            <span className="absolute top-1/2 -right-6 text-2xl animate-bounce delay-200">🎊</span>
          </>
        )}
      </div>

      {/* Main Message */}
      <div className={`text-center transition-all duration-700 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#4CAF50] mb-2">MUITO BEM!</h1>
        <p className="text-lg sm:text-xl text-[#0D3B66]/70 mb-8">Sua medicação foi registrada</p>
      </div>

      {/* Medication Card */}
      <div className={`w-full max-w-md transition-all duration-700 delay-200 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-[#26C6DA]/20 rounded-full flex items-center justify-center">
              <Pill className="w-7 h-7 text-[#26C6DA]" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-[#0D3B66]">{medication.name.toUpperCase()}</p>
              <p className="text-sm text-[#0D3B66]/60">{medication.dosage}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#4CAF50]" />
              <div>
                <p className="text-xs text-[#0D3B66]/60 uppercase tracking-wider">Horário</p>
                <p className="text-lg font-semibold text-[#0D3B66]">{takenTime} DE HOJE</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#FF9800]" />
              <div>
                <p className="text-xs text-[#0D3B66]/60 uppercase tracking-wider">Estoque</p>
                <p className="text-lg font-semibold text-[#0D3B66]">{remainingStock} COMPRIMIDOS</p>
              </div>
            </div>
          </div>
        </div>

        {/* Next Medication */}
        {nextMedication && (
          <div className="bg-[#FFF8F0] border-2 border-[#FF9800]/30 rounded-3xl p-5 mb-6">
            <p className="text-xs text-[#FF9800] font-bold uppercase tracking-wider mb-2">PRÓXIMA MEDICAÇÃO</p>
            <p className="text-xl font-bold text-[#0D3B66]">{nextMedication.name}</p>
            <p className="text-lg text-[#FF9800] font-semibold">{nextMedication.time}</p>
          </div>
        )}

        {/* Go Home Button */}
        <button
          onClick={onGoHome}
          className="w-full py-5 sm:py-6 bg-[#26C6DA] hover:bg-[#1BA8BC] text-white text-xl sm:text-2xl font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
        >
          <Home className="w-7 h-7" />
          VOLTAR AO INÍCIO
        </button>
      </div>

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-draw {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: draw 0.6s ease-out forwards;
        }
        @keyframes check {
          0% {
            transform: scale(0.8);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-check {
          animation: check 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
