import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import Modal from '../../components/Modal';
import { Plus, Trash2, Search, Hash } from 'lucide-react';

interface Props { profile: Profile; }

export default function CarerPatients({ profile }: Props) {
  const [patients, setPatients] = useState<Profile[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [found, setFound] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: links } = await supabase.from('carer_patient_links')
      .select('patient_id').eq('carer_id', profile.id);
    const ids = (links || []).map(l => l.patient_id);
    if (!ids.length) { setPatients([]); return; }
    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    setPatients(data || []);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  async function searchPatient() {
    const query = searchInput.trim();
    if (!query) return;
    setSearching(true); setFound(null); setMsg('');

    const isCode = /^THEO-\d{5}$/i.test(query);
    let data: Profile[] | null = null;

    if (isCode) {
      // Search by unique_code (exact, case-insensitive)
      const res = await supabase.from('profiles').select('*')
        .eq('role', 'patient').ilike('unique_code', query).limit(1);
      data = res.data;
    } else {
      // Search by email (exact)
      const byEmail = await supabase.from('profiles').select('*')
        .eq('role', 'patient').ilike('email', query).limit(1);
      data = byEmail.data;
      // Fallback: search by name if email returns nothing
      if (!data?.length) {
        const byName = await supabase.from('profiles').select('*')
          .eq('role', 'patient').ilike('name', `%${query}%`).limit(1);
        data = byName.data;
      }
    }

    if (data && data.length > 0) setFound(data[0]);
    else setMsg('Nenhum paciente encontrado. Use o código THEO-XXXXX ou e-mail do paciente.');
    setSearching(false);
  }

  async function link() {
    if (!found) return;
    setLinking(true);
    const { error } = await supabase.from('carer_patient_links')
      .upsert({ carer_id: profile.id, patient_id: found.id });
    setLinking(false);
    if (error) { setMsg('Erro ao vincular.'); return; }
    setAddOpen(false); setSearchInput(''); setFound(null);
    load();
  }

  async function unlink(patientId: string) {
    if (!confirm('Remover vínculo com este paciente?')) return;
    await supabase.from('carer_patient_links').delete()
      .eq('carer_id', profile.id).eq('patient_id', patientId);
    load();
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-stone-900">Meus Pacientes</h2>
          <p className="text-stone-400 text-sm mt-0.5">{patients.length} paciente{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 transition-all">
          <Plus size={16} /> Vincular paciente
        </button>
      </div>

      {patients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="font-semibold text-stone-700 text-lg mb-2">Nenhum paciente ainda</h3>
          <p className="text-stone-400 text-sm mb-5">Vincule pacientes pelo código THEO ou e-mail</p>
          <button onClick={() => setAddOpen(true)} className="px-6 py-2.5 bg-teal-600 text-white font-semibold rounded-full hover:bg-teal-500 transition-all">
            + Vincular primeiro paciente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-teal-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                {p.avatar_initials}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-stone-900">{p.name}</p>
                <p className="text-sm text-stone-400">{p.age ? `${p.age} anos` : 'Idade não informada'} · {p.phone || 'Sem telefone'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">Paciente</span>
                  {p.unique_code && (
                    <span className="text-xs text-stone-400 font-mono flex items-center gap-0.5">
                      <Hash size={10} />{p.unique_code}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => unlink(p.id)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all border border-stone-200">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setFound(null); setSearchInput(''); setMsg(''); }}
        title="Vincular paciente"
        footer={found ? <>
          <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-full">Cancelar</button>
          <button onClick={link} disabled={linking} className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-full hover:bg-teal-500 disabled:opacity-60">
            Vincular
          </button>
        </> : undefined}>
        <div className="py-4 space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
            <p className="text-xs font-bold text-teal-800 mb-1">Como vincular?</p>
            <p className="text-xs text-teal-700">Use o <strong>código THEO</strong> (ex: THEO-38472) ou o <strong>e-mail</strong> do paciente. O paciente encontra seu código em Perfil → Meus Dados.</p>
          </div>
          <div className="flex gap-2">
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPatient()}
              className="flex-1 px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all font-mono text-sm"
              placeholder="THEO-38472 ou email@exemplo.com" />
            <button onClick={searchPatient} disabled={searching}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-500 transition-all disabled:opacity-60">
              <Search size={18} />
            </button>
          </div>
          {msg && <p className="text-sm text-stone-500">{msg}</p>}
          {found && (
            <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                {found.avatar_initials}
              </div>
              <div>
                <p className="font-semibold text-teal-900">{found.name}</p>
                <p className="text-xs text-teal-600">{found.age ? `${found.age} anos` : 'Sem idade'}</p>
                {found.unique_code && <p className="text-xs font-mono text-teal-500">{found.unique_code}</p>}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
