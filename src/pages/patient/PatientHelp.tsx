import { useState } from 'react';
import { Phone, HelpCircle, MessageCircle, Pill, Mic, AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react';
import type { Profile } from '../../types';
import { supabase } from '../../lib/supabase';
import { notifyCarersOfPatient, notifyAdmins } from '../../lib/alerts';

interface Props {
  profile: Profile;
  onBack: () => void;
}

type SosState = 'idle' | 'choosing' | 'sending' | 'sent' | 'error';

const SOS_REASONS = [
  'Emergência médica',
  'Dor intensa',
  'Queda ou acidente',
  'Dificuldade para respirar',
  'Tontura ou desmaio',
  'Outro motivo',
];

export default function PatientHelp({ profile, onBack }: Props) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [sosState, setSosState] = useState<SosState>('idle');
  const [selectedReason, setSelectedReason] = useState('');

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  }

  async function sendSOS() {
    if (sosState === 'sending') return;
    setSosState('sending');
    speak('Enviando pedido de socorro. Aguarde.');

    let lat: number | null = null;
    let lng: number | null = null;
    let address: string | null = null;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      // GPS unavailable — proceed without location
    }

    const { error } = await supabase.from('emergency_alerts').insert({
      user_id: profile.id,
      message: `SOS enviado por ${profile.name.split(' ')[0]}${selectedReason ? ': ' + selectedReason : ''}`,
      location_lat: lat,
      location_lng: lng,
      latitude: lat,
      longitude: lng,
      address,
      reason: selectedReason || null,
      urgency_level: 'high',
      resolved: false,
      acknowledged: false,
    });

    if (error) {
      setSosState('error');
      return;
    }

    await Promise.all([
      notifyCarersOfPatient(
        profile.id, profile.id,
        'sos_alert',
        `SOS: ${profile.name.split(' ')[0]} precisa de ajuda!`,
        selectedReason || 'Botão de emergência acionado',
        'critical',
      ),
      notifyAdmins(
        profile.id, profile.id,
        'sos_alert',
        `SOS: ${profile.name} acionou emergência`,
        `${selectedReason || 'Emergência acionada'}${lat ? ` — GPS: ${lat.toFixed(4)}, ${lng!.toFixed(4)}` : ''}`,
        'critical',
      ),
    ]);

    setSosState('sent');
    speak('Pedido de socorro enviado! Seu cuidador foi notificado.');
  }

  const helpItems = [
    {
      id: 'how-to',
      icon: HelpCircle,
      title: 'Como usar o THEO',
      content: 'O THEO é muito simples! Toque nos botões grandes para navegar. Use o botão do microfone para falar com o assistente.',
    },
    {
      id: 'meds',
      icon: Pill,
      title: 'Como confirmar medicamentos',
      content: 'Quando chegar a hora do remédio, aparecerá um aviso. Toque em CONFIRMAR MEDICAÇÃO ou diga "Sim, tomei" usando a voz.',
    },
    {
      id: 'voice',
      icon: Mic,
      title: 'Como falar com o assistente',
      content: 'Toque no botão azul "FALAR COM O THEO" e diga sua pergunta. Você pode perguntar sobre remédios, próximas medicações ou pedir ajuda.',
    },
    {
      id: 'emergency',
      icon: AlertTriangle,
      title: 'Em caso de emergência',
      content: 'Toque no botão vermelho "PEDIR AJUDA" para notificar seu cuidador. Se for uma emergência grave, ligue para 192 (SAMU).',
    },
  ];

  const emergencyContacts = [
    { name: 'SAMU', number: '192', subtitle: 'Serviço Móvel de Urgência' },
    { name: 'Bombeiros', number: '193', subtitle: 'Corpo de Bombeiros' },
    { name: 'Policia', number: '190', subtitle: 'Polícia Militar' },
    { name: 'Contato de Emergência', number: profile.emergency_contact || '(00) 00000-0000', subtitle: 'Cuidador/Familiar' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-[#26C6DA] px-5 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <HelpCircle className="w-8 h-8" />
            CENTRAL DE AJUDA
          </h1>
          <p className="text-white/80 mt-2">Tire suas dúvidas sobre o app</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* SOS Button */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {sosState === 'idle' && (
            <button
              onClick={() => setSosState('choosing')}
              className="w-full p-6 bg-[#FF5252] hover:bg-[#E53935] active:scale-[0.98] transition-all text-center"
            >
              <AlertTriangle className="w-12 h-12 text-white mx-auto mb-2" />
              <p className="text-white text-2xl font-bold">PEDIR AJUDA</p>
              <p className="text-white/80 text-sm mt-1">Notifica seu cuidador imediatamente</p>
            </button>
          )}

          {sosState === 'choosing' && (
            <div className="p-5">
              <p className="text-[#0D3B66] font-bold text-lg mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#FF5252]" />
                Qual o motivo?
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {SOS_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedReason(r)}
                    className={`p-3 rounded-xl text-sm font-semibold text-left border-2 transition-all ${
                      selectedReason === r
                        ? 'border-[#FF5252] bg-[#FF5252]/10 text-[#FF5252]'
                        : 'border-[#E0E0E0] text-[#0D3B66]/70 hover:border-[#FF5252]/50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSosState('idle'); setSelectedReason(''); }}
                  className="flex-1 py-3 rounded-xl border-2 border-[#E0E0E0] text-[#0D3B66] font-semibold text-sm hover:bg-[#F5F7FA] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendSOS}
                  className="flex-1 py-3 rounded-xl bg-[#FF5252] text-white font-bold text-sm hover:bg-[#E53935] transition-all flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  ENVIAR SOS
                </button>
              </div>
            </div>
          )}

          {sosState === 'sending' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-[#FF5252]/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-[#FF5252]" />
              </div>
              <p className="text-[#0D3B66] font-bold text-lg">Enviando pedido de ajuda...</p>
              <p className="text-[#0D3B66]/60 text-sm mt-1">Capturando localização GPS</p>
            </div>
          )}

          {sosState === 'sent' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-[#4CAF50]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-[#4CAF50]" />
              </div>
              <p className="text-[#0D3B66] font-bold text-lg">SOS enviado com sucesso!</p>
              <p className="text-[#0D3B66]/60 text-sm mt-1">Seu cuidador foi notificado</p>
              <button
                onClick={() => { setSosState('idle'); setSelectedReason(''); }}
                className="mt-4 px-6 py-2 bg-[#F5F7FA] rounded-xl text-[#0D3B66] font-semibold text-sm border border-[#E0E0E0]"
              >
                Fechar
              </button>
            </div>
          )}

          {sosState === 'error' && (
            <div className="p-6 text-center">
              <p className="text-[#FF5252] font-bold mb-2">Erro ao enviar SOS</p>
              <p className="text-[#0D3B66]/60 text-sm mb-3">Tente novamente ou ligue para 192</p>
              <button
                onClick={() => { setSosState('idle'); setSelectedReason(''); }}
                className="px-6 py-2 bg-[#FF5252] text-white rounded-xl font-semibold text-sm"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        {/* Help Items */}
        <div className="space-y-3">
          {helpItems.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
              <button
                onClick={() => {
                  setExpandedItem(expandedItem === item.id ? null : item.id);
                  if (expandedItem !== item.id) {
                    speak(item.content);
                  }
                }}
                className="w-full p-5 flex items-center gap-4 text-left hover:bg-[#F5F7FA] transition-all"
              >
                <div className="w-12 h-12 bg-[#26C6DA]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-[#26C6DA]" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-[#0D3B66]">{item.title}</p>
                  {expandedItem === item.id && (
                    <p className="text-[#0D3B66]/70 mt-2 text-base leading-relaxed">
                      {item.content}
                    </p>
                  )}
                </div>
                <span className={`text-2xl transition-transform ${expandedItem === item.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* Emergency Contacts */}
        <div className="bg-[#FF5252]/10 border-2 border-[#FF5252]/30 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-[#FF5252] mb-4 flex items-center gap-2">
            <Phone className="w-6 h-6" />
            TELEFONES DE EMERGÊNCIA
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {emergencyContacts.map((contact, idx) => (
              <button
                key={idx}
                onClick={() => speak(`Ligar para ${contact.name}: ${contact.number}`)}
                className="bg-white rounded-xl p-4 text-center hover:shadow-md transition-all"
              >
                <p className="text-sm text-[#0D3B66]/60">{contact.name}</p>
                <p className="text-2xl font-bold text-[#FF5252]">{contact.number}</p>
                <p className="text-xs text-[#0D3B66]/50">{contact.subtitle}</p>
              </button>
            ))}
          </div>
        </div>

        {/* More help */}
        <div className="bg-white rounded-2xl shadow-md p-6 text-center">
          <div className="w-20 h-20 bg-[#26C6DA]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-10 h-10 text-[#26C6DA]" />
          </div>
          <h3 className="text-xl font-bold text-[#0D3B66] mb-2">Precisa de mais ajuda?</h3>
          <p className="text-[#0D3B66]/60 mb-4">
            Peça para seu cuidador explicar o aplicativo ou entre em contato conosco.
          </p>
          <button
            onClick={() => speak('Suporte disponível pelo telefone 0800 123 4567')}
            className="px-6 py-3 bg-[#26C6DA] text-white font-semibold rounded-xl hover:bg-[#1BA8BC] transition-all"
          >
            FALAR COM SUPORTE
          </button>
        </div>

        <button
          onClick={onBack}
          className="w-full py-4 bg-white text-[#0D3B66] text-lg font-semibold rounded-xl border-2 border-[#E0E0E0] hover:bg-[#F5F7FA] transition-all"
        >
          VOLTAR AO INÍCIO
        </button>
      </div>
    </div>
  );
}
