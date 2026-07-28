import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Appointment } from '../../types';
import Modal from '../../components/Modal';
import { Plus, Trash2, Calendar, MapPin } from 'lucide-react';

interface Props { profile: Profile; }

const TYPE_LABELS: Record<string, string> = {
  consultation: '🩺 Consulta',
  exam: '🔬 Exame',
  other: '📌 Outro',
};

export default function CarerAppointments({ profile }: Props) {
  const [patients, setPatients] = useState<Profile[]>([]);
  const [selPatient, setSelPatient] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle]       = useState('');
  const [type, setType]         = useState<'consultation'|'exam'|'other'>('consultation');
  const [date, setDate]         = useState('');
  const [time, setTime]         = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);

  const loadPatients = useCallback(async () => {
    const { data: links } = await supabase.from('carer_patient_links').select('patient_id').eq('carer_id', profile.id);
    const ids = (links || []).map(l => l.patient_id);
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    setPatients(data || []);
    if (data && data.length > 0 && !selPatient) setSelPatient(data[0].id);
  }, [profile.id, selPatient]);

  const loadApps = useCallback(async () => {
    if (!selPatient) return;
    const { data } = await supabase.from('appointments').select('*')
      .eq('user_id', selPatient).order('scheduled_at');
    setAppointments(data || []);
  }, [selPatient]);

  useEffect(() => { loadPatients(); }, [loadPatients]);
  useEffect(() => { loadApps(); }, [loadApps]);

  async function save() {
    if (!title.trim() || !date || !time || !selPatient) return;
    setSaving(true);
    await supabase.from('appointments').insert({
      user_id: selPatient, title: title.trim(), type,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      location, notes, created_by: profile.id,
    });
    setSaving(false); setModalOpen(false);
    setTitle(''); setDate(''); setTime(''); setLocation(''); setNotes('');
    loadApps();
  }

  async function deleteApp(id: string) {
    if (!confirm('Excluir compromisso?')) return;
    await supabase.from('appointments').delete().eq('id', id);
    loadApps();
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Agenda</h2>
        {selPatient && (
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 transition-all">
            <Plus size={16} /> Novo
          </button>
        )}
      </div>

      {patients.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {patients.map(p => (
            <button key={p.id} onClick={() => setSelPatient(p.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all
                ${selPatient === p.id ? 'bg-teal-600 text-white border-teal-600' : 'border-stone-200 text-stone-600 hover:border-teal-300'}`}>
              {p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {appointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-12 text-center text-stone-400">
          <div className="text-4xl mb-3">📅</div>
          <p>Nenhum compromisso agendado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => {
            const d = new Date(a.scheduled_at);
            const past = d < new Date();
            return (
              <div key={a.id} className={`bg-white rounded-2xl border ${past ? 'border-stone-200 opacity-60' : 'border-stone-200'} p-4 flex items-start gap-4`}>
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-teal-600 uppercase">{d.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  <span className="font-serif text-lg font-bold text-teal-800 leading-none">{d.getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-900">{a.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {TYPE_LABELS[a.type]} · {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {a.location && <p className="flex items-center gap-1 text-xs text-stone-400 mt-1"><MapPin size={11} />{a.location}</p>}
                  {a.notes && <p className="text-xs text-stone-400 mt-1 italic">{a.notes}</p>}
                </div>
                <button onClick={() => deleteApp(a.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-300 hover:bg-red-50 hover:text-red-500 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo compromisso"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-full">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 disabled:opacity-60 flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Salvar
          </button>
        </>}>
        <div className="space-y-4 pb-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" placeholder="Ex: Cardiologista" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['consultation','exam','other'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition-all ${type === t ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-stone-200 text-stone-500 hover:border-teal-200'}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Data *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Hora *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Local</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" placeholder="Clínica / Endereço" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
