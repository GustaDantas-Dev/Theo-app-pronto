import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { initials } from '../../lib/utils';

type AuthView = 'login' | 'register' | 'forgot';
type RegRole = 'patient' | 'carer' | 'admin';

const ADMIN_EMAIL = 'gustavo.fmm98@gmail.com';
const ADMIN_PASS = 'Lim@2019';

export default function LoginPage() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-end p-12 relative overflow-hidden bg-teal-950">
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 20% 20%, rgba(13,82,69,0.8) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(8,61,52,0.9) 0%, transparent 45%)' }}
        />
        <div className="relative z-10">
          <div className="text-white font-serif text-8xl font-bold leading-none mb-4">THEO</div>
          <p className="text-teal-200 text-xl leading-relaxed max-w-sm mb-8">
            Seu cuidador virtual inteligente de medicamentos. Cuide com carinho, organize com tecnologia.
          </p>
          <div className="flex flex-wrap gap-3">
            {['💊 Lembretes automáticos', '📊 Histórico completo', '👨‍👩‍👧 Família conectada', '🔔 Alertas em tempo real'].map(t => (
              <span key={t} className="px-4 py-2 rounded-full text-sm text-teal-200 border border-teal-700 bg-white/5 backdrop-blur-sm">{t}</span>
            ))}
          </div>
          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="text-teal-400 text-xs uppercase tracking-widest mb-1">MVP 2025 · Versão 1.0</p>
            <p className="text-white/30 text-xs">Tecnologia · Humanização · Eficiência · Organização</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-stone-50">
        <div className="w-full max-w-sm">
          {view === 'login'   && <LoginForm onSwitch={setView} />}
          {view === 'register' && <RegisterForm onSwitch={setView} />}
          {view === 'forgot'  && <ForgotForm onSwitch={setView} />}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (err) setError('Email ou senha incorretos.');
    setLoading(false);
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 mb-2">Bem-vindo de volta</h1>
        <p className="text-stone-500">Entre com suas credenciais para acessar o THEO</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-900 bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            placeholder="seu@email.com" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Senha</label>
          <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-900 bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            placeholder="Sua senha" />
        </div>
        <div className="text-right">
          <button type="button" onClick={() => onSwitch('forgot')} className="text-sm text-teal-600 font-medium hover:underline">
            Esqueci minha senha
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-full transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Entrar no THEO →
        </button>
      </form>

      <div className="mt-5 p-4 bg-teal-50 rounded-xl border border-teal-100">
        <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">Contas de demonstração</p>
        <div className="space-y-1.5 text-xs text-stone-600">
          <p>👴 Paciente: <code className="bg-white px-1.5 py-0.5 rounded">joao@theo.com</code> · <code className="bg-white px-1.5 py-0.5 rounded">Theo@2025</code></p>
          <p>🧑‍⚕️ Cuidador: <code className="bg-white px-1.5 py-0.5 rounded">carla@theo.com</code> · mesma senha</p>
          <p>⚙️ Admin: <code className="bg-white px-1.5 py-0.5 rounded">{ADMIN_EMAIL}</code></p>
        </div>
      </div>

      <p className="text-center text-sm text-stone-500 mt-6">
        Não tem conta?{' '}
        <button onClick={() => onSwitch('register')} className="text-teal-600 font-semibold hover:underline">Criar conta gratuita</button>
      </p>
    </>
  );
}

const ROLES: { value: RegRole; label: string; icon: string }[] = [
  { value: 'patient', label: 'Paciente', icon: '👴' },
  { value: 'carer',   label: 'Cuidador', icon: '🧑‍⚕️' },
  { value: 'admin',   label: 'Admin',    icon: '⚙️' },
];

function RegisterForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [role, setRole] = useState<RegRole>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pass !== confirm) { setError('As senhas não coincidem.'); return; }
    if (pass.length < 6) { setError('Senha deve ter ao menos 6 caracteres.'); return; }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password: pass });
    if (err || !data.user) { setError(err?.message || 'Erro ao criar conta.'); setLoading(false); return; }
    await supabase.from('profiles').insert({
      id: data.user.id,
      name: name.trim(),
      role,
      avatar_initials: initials(name.trim()),
    });
    setLoading(false);
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 mb-2">Criar conta</h1>
        <p className="text-stone-500">Comece a cuidar da saúde com o THEO</p>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Seu perfil</p>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(r => (
            <button key={r.value} type="button" onClick={() => setRole(r.value)}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                role === r.value ? 'border-teal-500 bg-teal-50' : 'border-stone-200 bg-white hover:border-teal-200'
              }`}>
              <span className="text-2xl">{r.icon}</span>
              <span className={`text-xs font-semibold ${role === r.value ? 'text-teal-700' : 'text-stone-500'}`}>{r.label}</span>
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Nome completo</label>
          <input required value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            placeholder="Seu nome completo" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            placeholder="seu@email.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Senha</label>
            <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl bg-white focus:outline-none focus:border-teal-400 transition-all"
              placeholder="Mín. 6 car." />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Confirmar</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl bg-white focus:outline-none focus:border-teal-400 transition-all"
              placeholder="Repita" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-full transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
          {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Criar conta →
        </button>
      </form>
      <p className="text-center text-sm text-stone-500 mt-6">
        Já tem conta?{' '}
        <button onClick={() => onSwitch('login')} className="text-teal-600 font-semibold hover:underline">Entrar</button>
      </p>
    </>
  );
}

function ForgotForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(email.trim());
    setSent(true);
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-stone-900 mb-2">Recuperar senha</h1>
        <p className="text-stone-500">Informe seu email para receber as instruções</p>
      </div>
      {sent ? (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-700">
          ✅ Se este email estiver cadastrado, você receberá as instruções em breve.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Email cadastrado</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
              placeholder="seu@email.com" />
          </div>
          <button type="submit"
            className="w-full py-3.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-full transition-all">
            Enviar instruções →
          </button>
        </form>
      )}
      <p className="text-center text-sm text-stone-500 mt-6">
        <button onClick={() => onSwitch('login')} className="text-teal-600 font-semibold hover:underline">← Voltar para o login</button>
      </p>
    </>
  );
}
