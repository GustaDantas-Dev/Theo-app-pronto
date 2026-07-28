import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Medication, DoseLog, ScheduleItem, Profile } from '../../types';
import { today, greeting, fmtTime, adherencePct } from '../../lib/utils';
import RingChart from '../../components/RingChart';
import Modal from '../../components/Modal';
import { CheckCircle2, SkipForward, Clock, AlertTriangle, Siren } from 'lucide-react';

interface Props {
  profile: Profile;
  fontScale: string;
}

export default function PatientDashboard({ profile, fontScale }: Props) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [confirmItem, setConfirmItem] = useState<ScheduleItem | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencySent, setEmergencySent] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    const todayStr = today();
    const { data: meds } = await supabase
      .from('medications').select('*')
      .eq('user_id', profile.id).eq('active', true);
    const { data: dayLogs } = await supabase
      .from('dose_logs').select('*')
      .eq('user_id', profile.id).eq('scheduled_date', todayStr);
    setMedications(meds || []);
    setLogs(dayLogs || []);
  }, [profile.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const todayStr = today();
  const schedule: ScheduleItem[] = [];
  medications.forEach(med => {
    med.times.forEach(time => {
      const log = logs.find(l => l.medication_id === med.id && l.scheduled_time === time);
      const [h, m] = time.split(':').map(Number);
      const medDate = new Date(); medDate.setHours(h, m, 0, 0);
      let status: ScheduleItem['status'] = log?.status || (medDate < now ? 'missed' : 'upcoming');
      schedule.push({ medication: med, time, status, log });
    });
  });
  schedule.sort((a, b) => a.time.localeCompare(b.time));

  const taken   = schedule.filter(s => s.status === 'taken').length;
  const missed  = schedule.filter(s => s.status === 'missed').length;
  const total   = schedule.length;
  const pct     = adherencePct(taken, total);
  const nextDose = schedule.find(s => s.status === 'upcoming');

  async function confirmTaken() {
    if (!confirmItem) return;
    const { medication: med, time } = confirmItem;
    const existing = logs.find(l => l.medication_id === med.id && l.scheduled_time === time);
    if (existing) {
      await supabase.from('dose_logs').update({ status: 'taken', taken_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('dose_logs').insert({
        medication_id: med.id, user_id: profile.id,
        scheduled_date: todayStr, scheduled_time: time,
        status: 'taken', taken_at: new Date().toISOString(),
      });
    }
    setConfirmItem(null);
    loadData();
  }

  async function skipDose() {
    if (!confirmItem) return;
    const { medication: med, time } = confirmItem;
    const existing = logs.find(l => l.medication_id === med.id && l.scheduled_time === time);
    if (existing) {
      await supabase.from('dose_logs').update({ status: 'skipped' }).eq('id', existing.id);
    } else {
      await supabase.from('dose_logs').insert({
        medication_id: med.id, user_id: profile.id,
        scheduled_date: todayStr, scheduled_time: time, status: 'skipped',
      });
    }
    setConfirmItem(null);
    loadData();
  }

  async function sendEmergency() {
    await supabase.from('emergency_alerts').insert({
      user_id: profile.id,
      message: 'Preciso de ajuda! — Alerta acionado pelo idoso.',
    });
    setEmergencySent(true);
  }

  const btnSize = fontScale === 'xl' ? 'py-5 px-8 text-xl' : fontScale === 'lg' ? 'py-4 px-6 text-lg' : 'py-3 px-5 text-base';

  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      {/* Greeting */}
      <div className="bg-teal-900 rounded-2xl p-5 text-white">
        <p className="text-teal-300 text-sm font-medium uppercase tracking-wider">{dateStr}</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold mt-1">
          {greeting()}, {profile.name.split(' ')[0]}! 👋
        </h2>
        {nextDose ? (
          <p className="text-teal-200 mt-2 text-sm">
            Próximo remédio: <strong className="text-white">{nextDose.medication.name}</strong> às <strong className="text-white">{nextDose.time}</strong>
          </p>
        ) : total > 0 ? (
          <p className="text-teal-200 mt-2 text-sm">🎉 Todos os remédios de hoje foram tomados!</p>
        ) : (
          <p className="text-teal-200 mt-2 text-sm">Nenhum remédio programado para hoje.</p>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-5">
        <RingChart pct={pct} size={100} stroke={9} />
        <div className="flex-1">
          <h3 className="font-semibold text-stone-900 text-lg mb-3">Progresso do dia</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-xl bg-teal-50">
              <div className="font-serif text-2xl font-bold text-teal-600">{taken}</div>
              <div className="text-xs text-stone-500 mt-0.5">Tomados</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-red-50">
              <div className="font-serif text-2xl font-bold text-red-600">{missed}</div>
              <div className="text-xs text-stone-500 mt-0.5">Perdidos</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-amber-50">
              <div className="font-serif text-2xl font-bold text-amber-600">{total - taken - missed}</div>
              <div className="text-xs text-stone-500 mt-0.5">Restantes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Missed alerts */}
      {missed > 0 && (
        <div className="space-y-2">
          {schedule.filter(s => s.status === 'missed').map((s, i) => (
            <button key={i} onClick={() => setConfirmItem(s)}
              className="w-full flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-left hover:bg-red-100 transition-all">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">{s.medication.name} {s.medication.dosage}</p>
                <p className="text-sm text-red-600">Era para às {s.time} — Toque para confirmar agora</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Today's schedule */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-900 text-lg">Remédios de hoje</h3>
        </div>
        {schedule.length === 0 ? (
          <div className="py-12 text-center text-stone-400">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-medium">Nenhum remédio programado</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {schedule.map((s, i) => (
              <MedRow key={i} item={s} onTap={() => setConfirmItem(s)} btnSize={btnSize} />
            ))}
          </div>
        )}
      </div>

      {/* Emergency button */}
      <button onClick={() => { setEmergencyOpen(true); setEmergencySent(false); }}
        className="w-full py-5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-red-200 transition-all">
        <Siren size={28} />
        PEDIR AJUDA
      </button>

      {/* Confirm modal */}
      <Modal open={!!confirmItem} onClose={() => setConfirmItem(null)} title="Confirmar dose"
        footer={
          confirmItem?.status !== 'taken' ? <>
            <button onClick={skipDose} className="px-4 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-full hover:bg-stone-50 transition-all flex items-center gap-2">
              <SkipForward size={16} /> Pular
            </button>
            <button onClick={confirmTaken} className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 transition-all flex items-center gap-2">
              <CheckCircle2 size={16} /> Tomei agora ✅
            </button>
          </> : <button onClick={() => setConfirmItem(null)} className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full">Fechar</button>
        }>
        {confirmItem && (
          <div className="py-4 text-center">
            <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center text-5xl mx-auto mb-4">
              {confirmItem.medication.icon}
            </div>
            <h3 className="font-serif text-2xl font-semibold mb-1">{confirmItem.medication.name}</h3>
            <p className="text-stone-500">{confirmItem.medication.dosage} · {confirmItem.medication.unit} · {confirmItem.time}</p>
            {confirmItem.medication.observations && (
              <p className="text-sm text-stone-400 italic mt-2">{confirmItem.medication.observations}</p>
            )}
            {confirmItem.status === 'taken' && (
              <div className="mt-4 flex items-center gap-2 justify-center text-teal-600 bg-teal-50 rounded-xl p-3">
                <CheckCircle2 size={18} /> <span className="font-semibold">Dose já confirmada!</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Emergency modal */}
      <Modal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} title="Pedir Ajuda" size="sm">
        <div className="py-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Siren size={40} className="text-red-600" />
          </div>
          {emergencySent ? (
            <>
              <h3 className="font-serif text-xl font-semibold text-teal-700 mb-2">Alerta enviado!</h3>
              <p className="text-stone-500 text-sm">Seu cuidador foi notificado e virá te ajudar em breve.</p>
              <button onClick={() => setEmergencyOpen(false)}
                className="mt-4 w-full py-3 bg-teal-600 text-white font-semibold rounded-full">OK</button>
            </>
          ) : (
            <>
              <h3 className="font-serif text-xl font-semibold mb-2">Confirmar pedido de ajuda?</h3>
              <p className="text-stone-500 text-sm mb-4">Seu cuidador e familiares serão notificados imediatamente.</p>
              <button onClick={sendEmergency}
                className="w-full py-4 bg-red-600 text-white font-bold text-lg rounded-full hover:bg-red-700 transition-all mb-2">
                🚨 Enviar alerta agora
              </button>
              <button onClick={() => setEmergencyOpen(false)}
                className="w-full py-3 text-stone-500 text-sm">Cancelar</button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MedRow({ item, onTap, btnSize }: { item: ScheduleItem; onTap: () => void; btnSize: string }) {
  const { medication: med, time, status } = item;
  const statusColors = {
    taken:    'border-l-teal-500 bg-teal-50/40',
    missed:   'border-l-red-500 bg-red-50/30',
    skipped:  'border-l-stone-300',
    upcoming: 'border-l-stone-200',
    pending:  'border-l-amber-400',
  };
  const statusBadge = {
    taken:    <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">Tomado ✅</span>,
    missed:   <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Perdido ⚠️</span>,
    skipped:  <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">Pulado</span>,
    upcoming: <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={11} />Agendado</span>,
    pending:  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pendente</span>,
  };

  return (
    <div className={`flex items-center gap-3 px-5 py-4 border-l-4 cursor-pointer hover:bg-stone-50 transition-all ${statusColors[status] || ''}`}
      onClick={onTap}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: med.color + '18' }}>
        {med.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-900">{med.name}</p>
        <p className="text-sm text-stone-500">{med.dosage} · {med.unit}</p>
        <div className="flex items-center gap-1 text-stone-400 text-xs mt-1">
          <Clock size={11} /> {time}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {statusBadge[status]}
        {status !== 'taken' && status !== 'skipped' && (
          <button onClick={e => { e.stopPropagation(); onTap(); }}
            className={`bg-teal-600 text-white font-semibold rounded-full hover:bg-teal-500 transition-all ${btnSize}`}>
            Confirmar
          </button>
        )}
      </div>
    </div>
  );
}
