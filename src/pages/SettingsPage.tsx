import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, FontSize } from '../types';
import { initials } from '../lib/utils';

interface Props {
  profile: Profile;
  onUpdate: (p: Profile) => void;
}

export default function SettingsPage({ profile, onUpdate }: Props) {
  const [name, setName]         = useState(profile.name);
  const [phone, setPhone]       = useState(profile.phone);
  const [age, setAge]           = useState<string>(profile.age ? String(profile.age) : '');
  const [fontSize, setFont]     = useState<FontSize>(profile.font_size);
  const [darkMode, setDark]     = useState(profile.dark_mode);
  const [currPass, setCurr]     = useState('');
  const [newPass, setNew]       = useState('');
  const [confPass, setConf]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [passMsg, setPassMsg]   = useState('');
  const [passErr, setPassErr]   = useState(false);

  async function saveProfile() {
    setSaving(true);
    const updates = {
      name: name.trim(), phone, age: age ? parseInt(age) : null,
      font_size: fontSize, dark_mode: darkMode,
      avatar_initials: initials(name.trim()),
    };
    const { data } = await supabase.from('profiles').update(updates).eq('id', profile.id).select().maybeSingle();
    if (data) onUpdate(data as Profile);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function changePassword() {
    setPassMsg(''); setPassErr(false);
    if (newPass.length < 6) { setPassMsg('Senha deve ter ao menos 6 caracteres.'); setPassErr(true); return; }
    if (newPass !== confPass) { setPassMsg('As senhas não coincidem.'); setPassErr(true); return; }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { setPassMsg(error.message); setPassErr(true); }
    else { setPassMsg('Senha alterada com sucesso! 🔒'); setCurr(''); setNew(''); setConf(''); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <h2 className="font-serif text-2xl font-semibold text-stone-900">Configurações</h2>

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-teal-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {profile.avatar_initials}
        </div>
        <div>
          <p className="font-semibold text-stone-900 text-lg">{profile.name}</p>
          <p className="text-stone-400 text-sm capitalize">{profile.role === 'patient' ? 'Paciente' : profile.role === 'carer' ? 'Cuidador' : 'Administrador'}</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h3 className="font-semibold text-stone-900">Dados pessoais</h3>
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
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all" />
          </div>
        </div>

        {/* Font size - only for patients */}
        {profile.role === 'patient' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Tamanho da fonte</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'normal', l: 'Normal' },
                { v: 'large',  l: 'Grande' },
                { v: 'xlarge', l: 'Muito grande' },
              ] as { v: FontSize; l: string }[]).map(o => (
                <button key={o.v} onClick={() => setFont(o.v)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                    ${fontSize === o.v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-stone-200 text-stone-500 hover:border-teal-200'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dark mode */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="font-medium text-stone-800">Modo escuro</p>
            <p className="text-xs text-stone-400">Interface com fundo escuro</p>
          </div>
          <button onClick={() => setDark(!darkMode)}
            className={`w-12 h-6 rounded-full transition-all relative ${darkMode ? 'bg-teal-500' : 'bg-stone-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${darkMode ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        {saved && <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2">✅ Perfil salvo!</div>}
        <button onClick={saveProfile} disabled={saving}
          className="w-full py-3 bg-teal-600 text-white font-semibold rounded-full hover:bg-teal-500 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Salvar alterações
        </button>
      </div>

      {/* Password change */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <h3 className="font-semibold text-stone-900">Alterar senha</h3>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Nova senha</label>
          <input type="password" value={newPass} onChange={e => setNew(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all"
            placeholder="Mín. 6 caracteres" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Confirmar nova senha</label>
          <input type="password" value={confPass} onChange={e => setConf(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all"
            placeholder="Repita a senha" />
        </div>
        {passMsg && (
          <div className={`text-sm px-4 py-2 rounded-xl border ${passErr ? 'text-red-700 bg-red-50 border-red-200' : 'text-teal-700 bg-teal-50 border-teal-200'}`}>
            {passMsg}
          </div>
        )}
        <button onClick={changePassword}
          className="w-full py-3 border-2 border-stone-200 text-stone-700 font-semibold rounded-full hover:bg-stone-50 transition-all">
          Alterar senha
        </button>
      </div>
    </div>
  );
}
