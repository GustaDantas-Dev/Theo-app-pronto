import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User, Heart, Shield, AlertCircle } from 'lucide-react';

interface Props {
  onBack: () => void;
  onComplete: (profile: any) => void;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const KINSHIP_OPTIONS = ['Filho(a)', 'Neto(a)', 'Conjuge', 'Irmao(a)', 'Pai/Mae', 'Outro'];

export default function RegisterPage({ onBack, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<'patient' | 'carer'>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Common fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Patient-specific
  const [bloodType, setBloodType] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicationsInUse, setMedicationsInUse] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Carer-specific
  const [kinship, setKinship] = useState('');
  const [profession, setProfession] = useState('');
  const [patientCount, setPatientCount] = useState('1');

  function formatCpf(value: string) {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  }

  function formatPhone(value: string) {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 2) return `(${nums}`;
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
  }

  function getInitials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function calculateAge(birthDate: string): number | null {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  }

  async function handleRegister() {
    setError('');

    if (step === 1) {
      if (!name.trim() || !email.trim() || !cpf.trim() || !birthDate || !phone.trim() || !password) {
        setError('Preencha todos os campos obrigatorios.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas nao coincidem.');
        return;
      }
      if (role === 'patient') {
        setStep(2);
      } else {
        setStep(2);
      }
      return;
    }

    // Step 2 - Final registration
    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuario');

      const userId = authData.user.id;
      const profileData = {
        id: userId,
        name: name.trim(),
        role,
        phone: phone.trim(),
        age: calculateAge(birthDate),
        avatar_initials: getInitials(name),
        dark_mode: false,
        font_size: 'normal' as const,
        cpf: cpf.replace(/\D/g, ''),
        birth_date: birthDate,
        blood_type: role === 'patient' ? bloodType || null : null,
        weight_kg: role === 'patient' && weight ? parseFloat(weight) : null,
        height_cm: role === 'patient' && height ? parseFloat(height) : null,
        allergies: role === 'patient' ? allergies.trim() : '',
        medications_in_use: role === 'patient' ? medicationsInUse.trim() : '',
        emergency_contact: role === 'patient' ? emergencyContact.trim() : '',
        kinship: role === 'carer' ? kinship.trim() : '',
        profession: role === 'carer' ? profession.trim() : '',
        patient_count: role === 'carer' ? parseInt(patientCount) || 1 : null,
      };

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .maybeSingle();

      if (profileError) throw profileError;
      if (profile) onComplete(profile);

    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#002855] to-[#001a3d] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px]">
        {/* Header */}
        <div className="text-center mb-6">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Voltar ao login
          </button>
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-14 flex items-center justify-center">
              <Shield viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="#D6B36D"/>
                <path d="M10 12l2 2 4-4" stroke="#002855" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </Shield>
            </div>
            <div className="text-left">
              <h1 className="font-poppins text-3xl font-bold text-white tracking-tight">SaudeTheo</h1>
              <p className="text-white/60 text-xs tracking-wide">CUIDANDO DE QUEM VOCÊ AMA</p>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full transition-all ${step === 1 ? 'bg-[#1EA0E8] w-8' : 'bg-white/30'}`} />
          <div className={`w-3 h-3 rounded-full transition-all ${step === 2 ? 'bg-[#1EA0E8] w-8' : 'bg-white/30'}`} />
        </div>

        {/* Form card */}
        <div className="bg-white rounded-[35px] shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <h2 className="font-poppins text-xl font-bold text-[#002855] text-center mb-6">
              {step === 1 ? 'Criar sua conta' : role === 'patient' ? 'Dados de saude' : 'Dados profissionais'}
            </h2>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm mb-4">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Step 1: Common fields */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Role selection */}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setRole('patient')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${role === 'patient' ? 'bg-[#1EA0E8] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    <User size={18} /> Paciente
                  </button>
                  <button type="button" onClick={() => setRole('carer')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${role === 'carer' ? 'bg-[#1EA0E8] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    <Heart size={18} /> Cuidador
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Nome completo</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="Digite seu nome" />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="seu@email.com" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">CPF</label>
                    <input value={cpf} onChange={e => setCpf(formatCpf(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                      placeholder="000.000.000-00" maxLength={14} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Data nasc.</label>
                    <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Telefone</label>
                  <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="(00) 00000-0000" maxLength={15} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Senha</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                      placeholder="Min. 6 caracteres" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Confirmar</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                      placeholder="Repita a senha" />
                  </div>
                </div>

                <button onClick={handleRegister}
                  className="w-full py-4 bg-[#1EA0E8] hover:bg-[#1789d0] text-white font-bold rounded-full transition-all text-lg">
                  Continuar
                </button>
              </div>
            )}

            {/* Step 2: Patient fields */}
            {step === 2 && role === 'patient' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Tipo sang.</label>
                    <select value={bloodType} onChange={e => setBloodType(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all bg-white">
                      <option value="">-</option>
                      {BLOOD_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Peso (kg)</label>
                    <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                      placeholder="70" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Altura (cm)</label>
                    <input type="number" value={height} onChange={e => setHeight(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                      placeholder="170" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Alergias</label>
                  <input value={allergies} onChange={e => setAllergies(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="Ex: Penicilina, Dipirona..." />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Medicamentos em uso</label>
                  <textarea value={medicationsInUse} onChange={e => setMedicationsInUse(e.target.value)} rows={2}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all resize-none"
                    placeholder="Liste os medicamentos que utiliza atualmente..." />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Contato emergencia</label>
                  <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="Nome e telefone para emergencias" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-3.5 border-2 border-stone-200 text-stone-600 font-semibold rounded-full hover:bg-stone-50 transition-all">
                    Voltar
                  </button>
                  <button onClick={handleRegister} disabled={loading}
                    className="flex-1 py-3.5 bg-[#1EA0E8] hover:bg-[#1789d0] text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Criar conta
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Carer fields */}
            {step === 2 && role === 'carer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Grau de parentesco</label>
                  <select value={kinship} onChange={e => setKinship(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all bg-white">
                    <option value="">Selecione...</option>
                    {KINSHIP_OPTIONS.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Profissao</label>
                  <input value={profession} onChange={e => setProfession(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="Sua profissao" />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Quantos pacientes cuida?</label>
                  <input type="number" value={patientCount} onChange={e => setPatientCount(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#1EA0E8] transition-all"
                    placeholder="1" min="1" max="10" />
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800">
                  <p className="font-semibold mb-1">Proximo passo</p>
                  <p className="text-teal-700">Apos criar sua conta, voce podera adicionar os pacientes que cuida e comecar a monitorar seus medicamentos.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-3.5 border-2 border-stone-200 text-stone-600 font-semibold rounded-full hover:bg-stone-50 transition-all">
                    Voltar
                  </button>
                  <button onClick={handleRegister} disabled={loading}
                    className="flex-1 py-3.5 bg-[#1EA0E8] hover:bg-[#1789d0] text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Criar conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Ao criar uma conta, voce concorda com nossos termos de uso e politica de privacidade.
        </p>
      </div>
    </div>
  );
}
