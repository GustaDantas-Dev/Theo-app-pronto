import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication, DoseLog } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import {
  Mic,
  MicOff,
  Pill,
  Bell,
  User,
  Clock,
  Droplets,
  Calendar,
  Home,
  Heart,
  HelpCircle,
  Volume2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Props {
  profile: Profile;
  onNavigate: (page: string) => void;
  onMedicationConfirm: (med: Medication, time: string) => void;
}

export default function PatientHome({ profile, onNavigate, onMedicationConfirm }: Props) {
  const [listening, setListening] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<DoseLog[]>([]);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const { notifications, unread, markRead, markAllRead } = useNotifications(profile.id);

  const loadMedications = useCallback(async () => {
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', profile.id)
      .eq('active', true)
      .order('created_at');
    if (data) setMedications(data);
  }, [profile.id]);

  const loadTodayLogs = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('dose_logs')
      .select('*')
      .eq('user_id', profile.id)
      .eq('scheduled_date', today);
    if (data) setTodayLogs(data);
  }, [profile.id]);

  useEffect(() => {
    loadMedications();
    loadTodayLogs();
    // Realtime refresh when medications or dose_logs change (carer added med, etc.)
    const channel = supabase
      .channel(`patient-home-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medications', filter: `user_id=eq.${profile.id}` }, () => loadMedications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_logs', filter: `user_id=eq.${profile.id}` }, () => loadTodayLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMedications, loadTodayLogs, profile.id]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  function getGreeting(): string {
    const hour = currentTime.getHours();
    if (hour < 12) return 'BOM DIA';
    if (hour < 18) return 'BOA TARDE';
    return 'BOA NOITE';
  }

  function formatDate(): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    return currentTime.toLocaleDateString('pt-BR', options).toUpperCase();
  }

  function getTakenCount(): number {
    return todayLogs.filter(l => l.status === 'taken').length;
  }

  function getTotalScheduled(): number {
    let total = 0;
    medications.forEach(med => {
      total += med.times.length;
    });
    return Math.max(total, 1);
  }

  function getProgress(): number {
    const total = getTotalScheduled();
    const taken = getTakenCount();
    return Math.round((taken / total) * 100);
  }

  function getNextMedication(): { med: Medication; time: string } | null {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();

    for (const med of medications) {
      for (const time of med.times) {
        const [h, m] = time.split(':').map(Number);
        const medMinutes = h * 60 + m;
        if (medMinutes > now) {
          const alreadyTaken = todayLogs.some(
            l => l.medication_id === med.id && l.scheduled_time === time && l.status === 'taken'
          );
          if (!alreadyTaken) {
            return { med, time };
          }
        }
      }
    }
    return null;
  }

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }

  function startVoiceAssistant() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      speak('Reconhecimento de voz não disponível. Use os botões na tela.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(true);
    setShowVoiceModal(true);
    speak('Olá! Sou o Theo. Como posso ajudar?');

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setListening(false);

      if (transcript.includes('remédio') || transcript.includes('remedio') || transcript.includes('medicação')) {
        const next = getNextMedication();
        if (next) {
          speak(`Seu próximo remédio é ${next.med.name}, às ${next.time}. Deseja confirmar?`);
          setTimeout(() => onMedicationConfirm(next.med, next.time), 2000);
        } else {
          speak('Você já tomou todos os remédios de hoje. Parabéns!');
        }
      } else if (transcript.includes('próximo') || transcript.includes('proximo') || transcript.includes('quando')) {
        const next = getNextMedication();
        if (next) {
          speak(`Sua próxima medicação é ${next.med.name} às ${next.time}.`);
        } else {
          speak('Não há mais medicações para hoje.');
        }
      } else if (transcript.includes('todos') || transcript.includes('terminei')) {
        const taken = getTakenCount();
        const total = getTotalScheduled();
        if (taken >= total) {
          speak('Parabéns! Você tomou todos os remédios de hoje!');
        } else {
          speak(`Você tomou ${taken} de ${total} remédios hoje.`);
        }
      } else if (transcript.includes('cuidador') || transcript.includes('ajuda')) {
        speak('Vou notificar seu cuidador. Ele entrará em contato em breve.');
        // Could trigger notification here
      } else if (transcript.includes('mal') || transcript.includes('dor')) {
        speak('Entendo. Vou alertar seu cuidador imediatamente. Se for uma emergência, ligue para 192.');
        // Could trigger emergency alert here
      } else {
        speak('Não entendi. Posso ajudar com seus remédios, consultas ou falar com seu cuidador.');
      }

      setTimeout(() => setShowVoiceModal(false), 3000);
    };

    recognition.onerror = () => {
      setListening(false);
      speak('Não consegui ouvir. Use os botões na tela.');
      setShowVoiceModal(false);
    };

    recognition.start();
  }

  const menuItems = [
    { icon: Pill,     label: 'Medicamentos', color: '#26C6DA', page: 'medications' },
    { icon: Bell,     label: 'Lembretes',    color: '#FF9800', page: 'reminders' },
    { icon: User,     label: 'Meu Perfil',   color: '#9C27B0', page: 'profile' },
    { icon: Clock,    label: 'Histórico',    color: '#4CAF50', page: 'history' },
    { icon: Droplets, label: 'Hidratação',   color: '#2196F3', page: 'hydration' },
    { icon: Calendar, label: 'Agenda',       color: '#E91E63', page: 'appointments' },
    { icon: Heart,    label: 'Minha Saúde',  color: '#FF5252', page: 'health_monitor' },
  ];

  const bottomNav = [
    { icon: Home, label: 'Início', page: 'home', active: true },
    { icon: Pill, label: 'Remédios', page: 'medications', active: false },
    { icon: Heart, label: 'Saúde', page: 'health_monitor', active: false },
    { icon: HelpCircle, label: 'Ajuda', page: 'help', active: false },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="bg-[#26C6DA] px-5 sm:px-6 py-6 sm:py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-lg">{getGreeting()},</p>
              <h1 className="text-white text-2xl sm:text-3xl font-bold">
                {profile.name.split(' ')[0].toUpperCase()} 👋
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Notifications bell */}
              <button
                onClick={() => setShowNotifs(v => !v)}
                className="relative w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <Bell className="w-6 h-6 text-white" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF4D4D] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#26C6DA]">
                    {Math.min(unread, 9)}
                  </span>
                )}
              </button>
              <button
                onClick={() => speak(`Olá ${profile.name.split(' ')[0]}, tudo bem?`)}
                className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <Volume2 className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
          <p className="text-white/90 text-sm sm:text-base">{formatDate()}</p>

          {/* Notification dropdown */}
          {showNotifs && (
            <div className="mt-3 bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
                <p className="text-sm font-bold text-[#0D3B66]">Mensagens do Cuidador</p>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-[#26C6DA] font-bold">Marcar lidas</button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-[#999] py-4 px-4 text-center">Nenhuma mensagem nova.</p>
              ) : notifications.slice(0, 6).map(n => (
                <button key={n.id} onClick={() => markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-50 last:border-0 ${!n.read ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.read && <div className="w-2 h-2 rounded-full bg-[#26C6DA] mt-1.5 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-bold text-[#0D3B66]">{n.title}</p>
                      {n.message && <p className="text-xs text-[#666] mt-0.5">{n.message}</p>}
                      <p className="text-[10px] text-[#ccc] mt-0.5">{new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 -mt-4 space-y-4">
        {/* Daily Status Card */}
        <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-6 border-l-4 border-[#4CAF50]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#C8F7C5] rounded-full flex items-center justify-center">
              <span className="text-2xl">
                {getProgress() >= 100 ? '😊' : getProgress() >= 50 ? '🙂' : '😐'}
              </span>
            </div>
            <div>
              <p className="text-xl font-bold text-[#0D3B66]">
                {getProgress() >= 100 ? 'TUDO BEM HOJE!' : getProgress() >= 50 ? 'QUASE LÁ!' : 'VAMOS COMEÇAR!'}
              </p>
              <p className="text-[#0D3B66]/60">
                {getTakenCount()} DE {getTotalScheduled()} REMÉDIOS TOMADOS
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-[#F5F7FA] rounded-full h-4 overflow-hidden">
            <div
              className="bg-[#4CAF50] h-full rounded-full transition-all duration-500"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
          <p className="text-right text-sm font-semibold text-[#4CAF50] mt-1">{getProgress()}%</p>
        </div>

        {/* Voice Assistant Button */}
        <button
          onClick={startVoiceAssistant}
          disabled={listening}
          className={`w-full py-6 sm:py-8 rounded-3xl shadow-lg transition-all flex items-center justify-center gap-4 ${
            listening
              ? 'bg-[#FF9800] animate-pulse'
              : 'bg-[#26C6DA] hover:bg-[#1BA8BC]'
          }`}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${listening ? 'bg-white/30' : 'bg-white/20'}`}>
            {listening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
          </div>
          <div className="text-left">
            <p className="text-white text-2xl sm:text-3xl font-bold">
              {listening ? 'OUVINDO...' : 'FALAR COM O THEO'}
            </p>
            <p className="text-white/80 text-sm">Toque e fale sua dúvida</p>
          </div>
        </button>

        {/* Next Medication Alert */}
        {getNextMedication() && (
          <div
            onClick={() => {
              const next = getNextMedication();
              if (next) onMedicationConfirm(next.med, next.time);
            }}
            className="bg-[#FFF5F5] border-2 border-[#FF5252]/30 rounded-3xl p-5 cursor-pointer hover:bg-[#FFEEEE] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#FF5252]/20 rounded-full flex items-center justify-center">
                <Pill className="w-7 h-7 text-[#FF5252]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#FF5252] font-bold uppercase tracking-wider">PRÓXIMO REMÉDIO</p>
                <p className="text-xl font-bold text-[#0D3B66]">{getNextMedication()?.med.name}</p>
                <p className="text-lg text-[#FF5252] font-semibold">{getNextMedication()?.time}</p>
              </div>
              <div className="text-3xl">→</div>
            </div>
            <p className="text-center text-sm text-[#FF5252]/70 mt-3">Toque para confirmar</p>
          </div>
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(item.page)}
              className="bg-white rounded-3xl shadow-md p-4 sm:p-5 flex flex-col items-center gap-3 hover:shadow-lg transition-all group"
            >
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                style={{ backgroundColor: item.color + '20' }}
              >
                <item.icon className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: item.color }} />
              </div>
              <p className="text-sm sm:text-base font-semibold text-[#0D3B66] text-center leading-tight">
                {item.label}
              </p>
            </button>
          ))}
        </div>

        {/* Emergency Button */}
        <button
          onClick={() => {
            speak('Emergência ativada! Seu cuidador será notificado.');
            // Could trigger emergency alert
          }}
          className="w-full py-5 bg-[#FF5252] hover:bg-[#E04040] text-white text-xl font-bold rounded-3xl shadow-lg transition-all flex items-center justify-center gap-3"
        >
          <AlertCircle className="w-7 h-7" />
          PEDIR AJUDA
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0E0E0] shadow-lg z-40">
        <div className="max-w-lg mx-auto flex justify-around py-3">
          {bottomNav.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(item.page)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                item.active ? 'bg-[#26C6DA]/10' : 'hover:bg-[#F5F7FA]'
              }`}
            >
              <item.icon
                className={`w-6 h-6 ${item.active ? 'text-[#26C6DA]' : 'text-[#0D3B66]/50'}`}
              />
              <p className={`text-xs font-semibold ${item.active ? 'text-[#26C6DA]' : 'text-[#0D3B66]/50'}`}>
                {item.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center">
            <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${listening ? 'bg-[#26C6DA] animate-pulse' : 'bg-[#26C6DA]/20'}`}>
              {listening ? (
                <MicOff className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-[#26C6DA]" />
              )}
            </div>
            <h3 className="text-2xl font-bold text-[#0D3B66] mb-2">
              {listening ? 'ESTOU OUVINDO...' : 'ASSISTENTE THEO'}
            </h3>
            <p className="text-[#0D3B66]/60 mb-6">
              {listening ? 'Fale sua dúvida ou pedido' : 'Processando sua solicitação...'}
            </p>
            <button
              onClick={() => setShowVoiceModal(false)}
              className="px-6 py-3 bg-[#F5F7FA] text-[#0D3B66] font-semibold rounded-xl hover:bg-[#E0E0E0] transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
