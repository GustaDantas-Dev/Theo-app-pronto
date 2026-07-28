import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, FontSize } from '../../types';
import { initials } from '../../lib/utils';
import { ArrowLeft, LogOut } from 'lucide-react';

interface Props {
  profile: Profile;
  onUpdate: (p: Profile) => void;
  onBack?: () => void;
  onSignOut?: () => void;
}

export default function PatientSettings({ profile, onUpdate, onBack, onSignOut }: Props) {
  const [name, setName]       = useState(profile.name);
  const [phone, setPhone]     = useState(profile.phone);
  const [age, setAge]         = useState<string>(profile.age ? String(profile.age) : '');
  const [fontSize, setFont]   = useState<FontSize>(profile.font_size);
  const [darkMode, setDark]   = useState(profile.dark_mode);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  async function save() {
    setSaving(true);
    const updates = {
      name: name.trim(),
      phone,
      age: age ? parseInt(age) : null,
      font_size: fontSize,
      dark_mode: darkMode,
      avatar_initials: initials(name.trim()),
    };
    const { data } = await supabase.from('profiles').update(updates).eq('id', profile.id).select().maybeSingle();
    if (data) onUpdate(data as Profile);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const FONT_OPTIONS: { value: FontSize; label: string; desc: string }[] = [
    { value: 'normal', label: 'Normal', desc: 'Tamanho padrão' },
    { value: 'large',  label: 'Grande', desc: 'Mais fácil de ler' },
    { value: 'xlarge', label: 'Muito grande', desc: 'Máxima legibilidade' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3 mb-2">
        {onBack && (
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 transition-all text-stone-600">
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Meu Perfil</h2>
      </div>

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-teal-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {profile.avatar_initials}
        </div>
        <div>
          <p className="font-semibold text-stone-900 text-lg">{profile.name}</p>
          <p className="text-stone-400 text-sm capitalize">{profile.role === 'patient' ? 'Paciente' : profile.role === 'carer' ? 'Cuidador' : 'Admin'}</p>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h3 className="font-semibold text-stone-900">Informações pessoais</h3>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Nome completo</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Telefone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all"
              placeholder="(92) 99999-9999" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Idade</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all"
              placeholder="72" />
          </div>
        </div>
      </div>

      {/* Font size */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-3">Tamanho da fonte</h3>
        <div className="space-y-2">
          {FONT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFont(opt.value)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all
                ${fontSize === opt.value ? 'border-teal-500 bg-teal-50' : 'border-stone-200 hover:border-teal-200'}`}>
              <div className="text-left">
                <p className={`font-semibold ${fontSize === opt.value ? 'text-teal-700' : 'text-stone-700'}`}>{opt.label}</p>
                <p className="text-xs text-stone-400">{opt.desc}</p>
              </div>
              {fontSize === opt.value && <span className="text-teal-500">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Dark mode toggle */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-stone-900">Modo escuro</p>
            <p className="text-sm text-stone-400">Interface com fundo escuro</p>
          </div>
          <button onClick={() => setDark(!darkMode)}
            className={`w-12 h-6 rounded-full transition-all relative ${darkMode ? 'bg-teal-500' : 'bg-stone-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${darkMode ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm font-semibold">
          ✅ Perfil atualizado com sucesso!
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="w-full py-4 bg-teal-600 text-white font-semibold rounded-full hover:bg-teal-500 transition-all text-lg disabled:opacity-60 flex items-center justify-center gap-2">
        {saving && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        Salvar alterações
      </button>

      {onSignOut && (
        <button onClick={onSignOut}
          className="w-full py-4 bg-white text-[#FF5252] font-semibold rounded-full border-2 border-[#FF5252] hover:bg-[#FFF5F5] transition-all text-lg flex items-center justify-center gap-2">
          <LogOut size={20} />
          SAIR DA CONTA
        </button>
      )}
    </div>
  );
}
