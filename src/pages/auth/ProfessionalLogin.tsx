import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type AccessType = 'admin' | 'carer' | 'patient';

interface Props {
  onRegister: () => void;
}

/* ── Shield SVG ────────────────────────────────────────────────────────────── */
function ShieldIcon({ size = 52 }: { size?: number }) {
  const h = Math.round(size * 58 / 52);
  return (
    <svg width={size} height={h} viewBox="0 0 52 58" fill="none">
      <path d="M26 2L4 11.5V27C4 40.5 13.5 52.5 26 57C38.5 52.5 48 40.5 48 27V11.5L26 2Z"
        fill="white" stroke="white" strokeWidth="0.5" />
      <rect x="21.5" y="24" width="9" height="4" rx="1.5" fill="#1EA0E8" />
      <rect x="24" y="18.5" width="4" height="15" rx="1.5" fill="#1EA0E8" />
    </svg>
  );
}

/* ── Forgot Password Modal ─────────────────────────────────────────────────── */
function ForgotModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rx.test(email.trim())) { setError('E-mail inválido.'); return; }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    setSent(true);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '28px', width: '100%', maxWidth: '380px',
        border: '3px solid #1EA0E8', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        padding: '32px 28px 28px', position: 'relative',
        fontFamily: "'Poppins', 'Outfit', system-ui, sans-serif",
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#8A8A8A', display: 'flex', padding: '4px',
            borderRadius: '8px',
          }}
        >
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#1565D8', marginBottom: '6px' }}>
          Recuperar senha
        </h3>
        <p style={{ fontSize: '14px', color: '#8A8A8A', marginBottom: '24px' }}>
          Informe seu e-mail para receber as instruções de recuperação.
        </p>

        {sent ? (
          <div style={{
            padding: '16px', background: '#F0FDF4', border: '1.5px solid #86EFAC',
            borderRadius: '14px', textAlign: 'center', color: '#16A34A',
            fontSize: '14px', marginBottom: '20px',
          }}>
            ✓ E-mail de recuperação enviado com sucesso!<br />
            <span style={{ fontSize: '12px', color: '#4ADE80' }}>Verifique sua caixa de entrada.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: '#1565D8', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '8px',
              }}>
                E-mail cadastrado
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                style={{
                  width: '100%', height: '56px', border: '2px solid #1EA0E8',
                  borderRadius: '16px', padding: '0 18px', fontSize: '15px',
                  outline: 'none', boxSizing: 'border-box', color: '#2c2c2c',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1565D8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(21,101,216,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#1EA0E8'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            {error && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', fontSize: '13px', color: '#DC2626' }}>
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', height: '56px', background: '#1EA0E8', color: 'white',
                fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '28px',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(30,160,232,0.35)',
                transition: 'all 0.18s ease',
              }}
            >
              {loading && <span style={{ width: '18px', height: '18px', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
              Enviar recuperação
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          style={{ width: '100%', marginTop: '14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#8A8A8A', fontFamily: 'inherit', textDecoration: 'underline' }}
        >
          Voltar para o login
        </button>
      </div>
    </div>
  );
}

/* ── Main Login Component ──────────────────────────────────────────────────── */
export default function ProfessionalLogin({ onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [access, setAccess] = useState<AccessType>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Informe o e-mail profissional.'); return; }
    const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rx.test(email.trim())) { setError('E-mail inválido. Verifique o formato.'); return; }
    if (!pass) { setError('Informe a senha.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setLoading(false);
    if (err) setError('Credenciais incorretas. Verifique e-mail e senha.');
  }

  return (
    <div style={{ fontFamily: "'Poppins', 'Outfit', system-ui, sans-serif" }} className="min-h-screen w-full flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col overflow-hidden">

        {/* Blue background */}
        <div className="absolute inset-0 bg-[#1EA0E8]" />

        {/* White section with arch */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white"
          style={{ height: '67%', borderRadius: '50% 50% 0 0 / 52px 52px 0 0' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col min-h-screen">

          {/* Header */}
          <div className="flex flex-col items-center pt-10 pb-4 px-6">
            <div className="flex items-center gap-3 mb-1">
              <ShieldIcon />
              <div>
                <h1 className="text-white leading-tight" style={{ fontSize: '36px', fontWeight: 600 }}>
                  SaúdeTheo
                </h1>
                <p className="text-white" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.18em' }}>
                  GESTAO DE SAUDE
                </p>
              </div>
            </div>
            <p className="text-white text-center mt-4 max-w-[280px]" style={{ fontSize: '17px', fontWeight: 500, lineHeight: 1.4 }}>
              Acesso seguro para pacientes e profissionais
            </p>
          </div>

          {/* Card + footer */}
          <div className="flex-1 flex flex-col px-5 pt-8 pb-6 overflow-y-auto">

            {/* Card */}
            <div style={{
              background: 'white', border: '3px solid #1EA0E8', borderRadius: '35px',
              boxShadow: '0 8px 25px rgba(0,0,0,0.08)', padding: '28px 24px 24px',
            }}>
              <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#1565D8', marginBottom: '4px' }}>
                Bem-vindo de volta
              </h2>
              <p style={{ fontSize: '15px', color: '#8A8A8A', marginBottom: '22px' }}>
                Entre com suas credenciais de acesso
              </p>

              <form onSubmit={handleLogin} noValidate>
                {/* Email */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1565D8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    E-mail
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Digite seu e-mail" autoComplete="email"
                    style={{ width: '100%', height: '60px', border: '2px solid #1EA0E8', borderRadius: '18px', padding: '0 20px', fontSize: '15px', color: '#2c2c2c', background: 'white', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#1565D8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(21,101,216,0.12)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#1EA0E8'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1565D8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)}
                      placeholder="Digite sua senha" autoComplete="current-password"
                      style={{ width: '100%', height: '60px', border: '2px solid #1EA0E8', borderRadius: '18px', padding: '0 52px 0 20px', fontSize: '15px', color: '#2c2c2c', background: 'white', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#1565D8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(21,101,216,0.12)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#1EA0E8'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A8A', display: 'flex' }}
                      aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', fontSize: '13px', color: '#DC2626' }}>
                    {error}
                  </div>
                )}

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#D1D5DB' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#A5A5A5', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>TIPO DE ACESSO</span>
                  <div style={{ flex: 1, height: '1px', background: '#D1D5DB' }} />
                </div>

                {/* Access type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                  {([
                    { value: 'admin' as AccessType, label: 'ADM' },
                    { value: 'carer' as AccessType, label: 'Cuidador' },
                  ]).map(btn => (
                    <button key={btn.value} type="button" onClick={() => setAccess(btn.value)}
                      style={{
                        height: '55px', borderRadius: '20px', border: 'none',
                        fontSize: '17px', fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.18s ease', fontFamily: 'inherit',
                        background: access === btn.value ? '#1565D8' : '#8EB6F7',
                        color: access === btn.value ? '#FFFFFF' : '#1565D8',
                        boxShadow: access === btn.value ? '0 4px 14px rgba(21,101,216,0.35)' : 'none',
                      }}
                    >{btn.label}</button>
                  ))}
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <button type="button" onClick={() => setAccess('patient')}
                    style={{
                      width: '100%', height: '55px', borderRadius: '20px', border: 'none',
                      fontSize: '17px', fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.18s ease', fontFamily: 'inherit',
                      background: access === 'patient' ? '#1DA1F2' : '#8FD3FF',
                      color: access === 'patient' ? '#FFFFFF' : '#1DA1F2',
                      boxShadow: access === 'patient' ? '0 4px 14px rgba(29,161,242,0.35)' : 'none',
                    }}
                  >PACIENTE</button>
                </div>

                {/* ENTRAR */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                  <button type="submit" disabled={loading}
                    style={{
                      width: '80%', height: '65px', background: '#1EA0E8', color: '#FFFFFF',
                      fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em',
                      border: 'none', borderRadius: '35px', cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1, transition: 'all 0.18s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      fontFamily: 'inherit', boxShadow: '0 4px 18px rgba(30,160,232,0.4)',
                    }}
                  >
                    {loading && <span style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
                    ENTRAR
                  </button>
                </div>

                {/* Forgot */}
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <button type="button" onClick={() => setForgotOpen(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#8A8A8A', textDecoration: 'underline', fontFamily: 'inherit' }}
                  >
                    Esqueceu a sua senha?
                  </button>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: '#E5E7EB', marginBottom: '18px' }} />

                {/* Não tem conta */}
                <p style={{ textAlign: 'center', fontSize: '14px', color: '#8A8A8A', marginBottom: '12px' }}>
                  Não possui uma conta ainda?
                </p>

                {/* CRIAR CONTA */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button type="button" onClick={onRegister}
                    style={{
                      width: '80%', height: '65px',
                      background: 'white', color: '#1DA1F2',
                      fontSize: '18px', fontWeight: 700, letterSpacing: '0.06em',
                      border: '2.5px solid #1DA1F2', borderRadius: '35px',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit',
                      boxShadow: '0 2px 12px rgba(29,161,242,0.15)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#EBF8FF';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(29,161,242,0.25)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = '0 2px 12px rgba(29,161,242,0.15)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    CRIAR CONTA
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <p style={{ fontSize: '13px', color: '#8A8A8A', textAlign: 'center' }}>Dados protegidos conforme a LGPD</p>
              <p style={{ fontSize: '13px', color: '#8A8A8A', textAlign: 'center' }}>Acesso monitorado e registrado</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '8px 20px', border: '2px solid #1565D8', borderRadius: '999px' }}>
                <ShieldIcon size={18} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1565D8' }}>Conexão segura - SSL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot modal */}
      {forgotOpen && <ForgotModal onClose={() => setForgotOpen(false)} />}
    </div>
  );
}
