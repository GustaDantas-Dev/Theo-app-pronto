import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, Medication } from '../../types';
import { MED_COLORS } from '../../lib/utils';
import Modal from '../../components/Modal';
import { Plus, Edit2, Trash2, Clock, ClipboardList } from 'lucide-react';

interface Props {
  profile: Profile;
  onNavigate?: (page: string) => void;
}

const ICONS = ['💊','🔵','🟡','🔴','🟢','💉','🌟','🧴','🩺'];
const UNITS = ['comprimido','cápsula','ml','gotas','UI','sachê','ampola'];
const FREQS = ['Todo dia','Dias alternados','Segunda a sexta','Finais de semana','Quando necessário'];

export default function CarerMedications({ profile, onNavigate }: Props) {
  const [patients, setPatients] = useState<Profile[]>([]);
  const [selPatient, setSelPatient] = useState<string>('');
  const [meds, setMeds] = useState<Medication[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);

  const [name, setName]       = useState('');
  const [dosage, setDosage]   = useState('');
  const [unit, setUnit]       = useState('comprimido');
  const [icon, setIcon]       = useState('💊');
  const [freq, setFreq]       = useState('Todo dia');
  const [timesStr, setTimes]  = useState('');
  const [obs, setObs]         = useState('');
  const [saving, setSaving]   = useState(false);

  const loadPatients = useCallback(async () => {
    const { data: links } = await supabase.from('carer_patient_links').select('patient_id').eq('carer_id', profile.id);
    const ids = (links || []).map(l => l.patient_id);
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    setPatients(data || []);
    if (data && data.length > 0 && !selPatient) setSelPatient(data[0].id);
  }, [profile.id, selPatient]);

  const loadMeds = useCallback(async () => {
    if (!selPatient) return;
    const { data } = await supabase.from('medications').select('*').eq('user_id', selPatient).eq('active', true);
    setMeds(data || []);
  }, [selPatient]);

  useEffect(() => { loadPatients(); }, [loadPatients]);
  useEffect(() => { loadMeds(); }, [loadMeds]);

  function openNew() {
    setEditing(null);
    setName(''); setDosage(''); setUnit('comprimido'); setIcon('💊');
    setFreq('Todo dia'); setTimes(''); setObs('');
    setModalOpen(true);
  }

  function openEdit(m: Medication) {
    setEditing(m);
    setName(m.name); setDosage(m.dosage); setUnit(m.unit); setIcon(m.icon);
    setFreq(m.frequency); setTimes(m.times.join(', ')); setObs(m.observations);
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim() || !dosage.trim() || !selPatient) return;
    const times = timesStr.split(',').map(t => t.trim()).filter(Boolean);
    if (!times.length) return;
    setSaving(true);
    const payload = {
      user_id: selPatient, name: name.trim(), dosage: dosage.trim(),
      unit, icon, frequency: freq, times, observations: obs,
      active: true, color: MED_COLORS[meds.length % MED_COLORS.length],
      created_by: profile.id,
    };
    if (editing) {
      await supabase.from('medications').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('medications').insert(payload);
    }
    setSaving(false); setModalOpen(false); loadMeds();
  }

  async function deleteMed(m: Medication) {
    if (!confirm(`Excluir "${m.name}"?`)) return;
    await supabase.from('medications').update({ active: false }).eq('id', m.id);
    loadMeds();
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Medicamentos</h2>
        <div className="flex gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('register_medication')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0D3B66] text-white text-sm font-semibold rounded-full hover:bg-[#0a2e52] transition-all"
            >
              <ClipboardList size={16} /> Cadastro completo
            </button>
          )}
          {selPatient && (
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 transition-all">
              <Plus size={16} /> Rápido
            </button>
          )}
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-12 text-center text-stone-400">
          <p>Vincule pacientes primeiro</p>
        </div>
      ) : (
        <>
          {/* Patient selector */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {patients.map(p => (
              <button key={p.id} onClick={() => setSelPatient(p.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all
                  ${selPatient === p.id ? 'bg-teal-600 text-white border-teal-600' : 'border-stone-200 text-stone-600 hover:border-teal-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selPatient === p.id ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'}`}>
                  {p.avatar_initials}
                </div>
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {meds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-12 text-center">
              <div className="text-4xl mb-3">💊</div>
              <p className="text-stone-400">Nenhum medicamento cadastrado</p>
              <button onClick={openNew} className="mt-4 px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500">
                + Cadastrar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {meds.map(m => (
                <div key={m.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: m.color + '18' }}>
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900">{m.name}</p>
                    <p className="text-sm text-stone-500">{m.dosage} · {m.unit}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.times.map(t => (
                        <span key={t} className="flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                          <Clock size={10} /> {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(m)} className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:bg-teal-50 hover:text-teal-600 transition-all border border-stone-200">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteMed(m)} className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all border border-stone-200">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar medicamento' : 'Novo medicamento'}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-full">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 disabled:opacity-60 flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Salvar
          </button>
        </>}>
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" placeholder="Ex: Metformina" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Dosagem *</label>
              <input value={dosage} onChange={e => setDosage(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" placeholder="850mg" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Unidade</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all bg-white">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-xl text-xl transition-all ${icon === ic ? 'bg-teal-100 ring-2 ring-teal-400' : 'bg-stone-100 hover:bg-stone-200'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Horários *</label>
            <input value={timesStr} onChange={e => setTimes(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" placeholder="Ex: 08:00, 14:00, 20:00" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Frequência</label>
            <select value={freq} onChange={e => setFreq(e.target.value)} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all bg-white">
              {FREQS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Observações</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all resize-none" placeholder="Tomar com água..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
