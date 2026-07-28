import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import type { Profile } from './types';
import ProfessionalLogin from './pages/auth/ProfessionalLogin';
import RegisterPage from './pages/auth/RegisterPage';
import AppShell from './components/AppShell';

// Patient pages
import PatientDashboard from './pages/patient/PatientDashboard';
import PatientMedications from './pages/patient/PatientMedications';
import PatientHistory from './pages/patient/PatientHistory';
import PatientHealth from './pages/patient/PatientHealth';
import PatientSettings from './pages/patient/PatientSettings';
import PatientHome from './pages/patient/PatientHome';
import PatientHelp from './pages/patient/PatientHelp';
import HydrationTracker from './pages/patient/HydrationTracker';
import MedicationConfirmation from './pages/patient/MedicationConfirmation';
import SuccessConfirmation from './pages/patient/SuccessConfirmation';
import HealthMonitor from './pages/patient/HealthMonitor';
import PressureHistory from './pages/patient/PressureHistory';
import PatientProfile from './pages/patient/PatientProfile';
import type { Medication } from './types';

// Carer pages
import CarerDashboard from './pages/carer/CarerDashboard';
import CarerMedications from './pages/carer/CarerMedications';
import CarerPatients from './pages/carer/CarerPatients';
import CarerAppointments from './pages/carer/CarerAppointments';
import CarerReports from './pages/carer/CarerReports';
import RegisterMedication from './pages/carer/RegisterMedication';
import CarerPatientDetail from './pages/carer/CarerPatientDetail';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSystem from './pages/admin/AdminSystem';
import AdminProfile from './pages/admin/AdminProfile';

// Shared
import SettingsPage from './pages/SettingsPage';

// ── Notification ──────────────────────────────────────────────────────────────
interface Notif { id: string; text: string; type: string; time: Date; read: boolean; }

function NotifPanel({ notifs, onMarkRead, onMarkAll, onClose }: {
  notifs: Notif[];
  onMarkRead: (id: string) => void;
  onMarkAll: () => void;
  onClose: () => void;
}) {
  const icons: Record<string, string> = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
  return (
    <div className="fixed top-16 right-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 z-[150] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
        <span className="font-semibold text-stone-900">Notificações</span>
        <div className="flex items-center gap-2">
          <button onClick={onMarkAll} className="text-xs text-teal-600 font-medium hover:underline">Marcar lidas</button>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 ml-2">✕</button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifs.length === 0 ? (
          <div className="py-10 text-center text-stone-400 text-sm">Nenhuma notificação</div>
        ) : notifs.slice(0, 20).map(n => (
          <div key={n.id} onClick={() => onMarkRead(n.id)}
            className={`flex gap-3 px-5 py-3.5 border-b border-stone-100 cursor-pointer hover:bg-teal-50 transition-colors ${!n.read ? 'bg-teal-50/50' : ''}`}>
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-teal-400'}`} />
            <div className="flex-1">
              <p className="text-sm text-stone-800">{icons[n.type] || 'ℹ️'} {n.text}</p>
              <p className="text-xs text-stone-400 mt-0.5">{n.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Seed demo users ────────────────────────────────────────────────────────────
async function seedDemoUsers() {
  const demoAccounts = [
    { email: 'joao@theo.com', pass: 'Theo@2025', name: 'João da Silva', role: 'patient', phone: '(92) 98765-4321', age: 72 },
    { email: 'carla@theo.com', pass: 'Theo@2025', name: 'Carla Mendes', role: 'carer',   phone: '(92) 99001-2233', age: 38 },
    { email: 'gustavo.fmm98@gmail.com', pass: 'Lim@2019', name: 'Admin THEO', role: 'admin', phone: '', age: null },
  ];

  for (const acc of demoAccounts) {
    const { data: existing } = await supabase.from('profiles').select('id').limit(1);
    if (existing && existing.length > 0) continue; // already seeded

    const { data, error } = await supabase.auth.signUp({ email: acc.email, password: acc.pass });
    if (!error && data.user) {
      const ini = acc.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
      await supabase.from('profiles').insert({
        id: data.user.id,
        name: acc.name,
        role: acc.role,
        phone: acc.phone,
        age: acc.age,
        avatar_initials: ini,
      });
    }
  }
}

// ── Admin simple shell (for admin sub-pages without sidebar) ──────────────────
function AdminSimpleShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-gradient-to-r from-[#1DA1F2] to-[#0D3B66] px-5 pt-5 pb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold mb-3 transition-all">
          <span className="text-lg">←</span> Voltar
        </button>
        <h1 className="text-white font-bold text-xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

// ── Carer simple shell (for carer sub-pages without sidebar) ──────────────────
function CarerSimpleShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-gradient-to-r from-[#26C6DA] to-[#0D3B66] px-5 pt-5 pb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold mb-3 transition-all">
          <span className="text-lg">←</span> Voltar
        </button>
        <h1 className="text-white font-bold text-xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { profile: rawProfile, loading, signOut, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState('dashboard');
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [patientMode, setPatientMode] = useState<'home' | 'confirm' | 'success'>('home');
  const [selectedMedication, setSelectedMedication] = useState<{ med: Medication; time: string } | null>(null);
  const [selectedCarerPatientId, setSelectedCarerPatientId] = useState<string | null>(null);

  useEffect(() => { seedDemoUsers(); }, []);

  useEffect(() => {
    setProfile(rawProfile);
  }, [rawProfile]);

  function addNotif(text: string, type = 'info') {
    const n: Notif = { id: Math.random().toString(36), text, type, time: new Date(), read: false };
    setNotifs(prev => [n, ...prev].slice(0, 50));
  }

  useEffect(() => {
    if (profile) {
      addNotif(`Bem-vindo(a), ${profile.name.split(' ')[0]}!`, 'success');
      setPage('dashboard');
    }
  }, [!!profile]);

  function handleUpdate(updated: Profile) {
    setProfile(updated);
    refreshProfile(updated);
  }

  const unread = notifs.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-center">
          <div className="font-serif text-4xl font-bold text-teal-800 mb-3">THEO</div>
          <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    if (showRegister) {
      return <RegisterPage onBack={() => setShowRegister(false)} onComplete={(p) => setProfile(p)} />;
    }
    return <ProfessionalLogin onRegister={() => setShowRegister(true)} />;
  }

  if (profile.status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Conta Suspensa</h2>
          <p className="text-stone-500 text-sm mb-6">
            Sua conta foi temporariamente suspensa pelo administrador.
            Entre em contato para mais informações.
          </p>
          <button
            onClick={signOut}
            className="w-full py-3 bg-stone-800 text-white font-semibold rounded-xl hover:bg-stone-700 transition-all"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const fontScale = profile.font_size === 'xlarge' ? 'xl' : profile.font_size === 'large' ? 'lg' : '';

  const PAGE_TITLES: Record<string, string> = {
    dashboard:    profile.role === 'patient' ? 'Início' : profile.role === 'admin' ? 'Painel Admin' : 'Dashboard',
    medications:  'Medicamentos',
    history:      'Histórico',
    health:       'Saúde',
    patients:     'Pacientes',
    appointments: 'Agenda',
    reports:      'Relatórios',
    users:        'Usuários',
    system:       'Sistema',
    settings:     'Configurações',
    admin_profile: 'Perfil Master',
    home:         'Início',
    help:         'Ajuda',
    hydration:    'Hidratação',
    reminders:    'Lembretes',
    profile:      'Perfil',
  };

  function handleMedicationConfirm(med: Medication, time: string) {
    setSelectedMedication({ med, time });
    setPatientMode('confirm');
  }

  function handleMedicationSuccess() {
    setPatientMode('success');
  }

  function handleBackToHome() {
    setPatientMode('home');
    setSelectedMedication(null);
    setPage('home');
  }

  function renderPage() {
    // Special patient mode for elderly-friendly interface
    if (profile!.role === 'patient') {
      // Check if using elderly-friendly mode
      if (patientMode === 'confirm' && selectedMedication) {
        return (
          <MedicationConfirmation
            profile={profile!}
            medication={selectedMedication.med}
            scheduledTime={selectedMedication.time}
            onSuccess={handleMedicationSuccess}
            onSkip={handleBackToHome}
          />
        );
      }
      if (patientMode === 'success' && selectedMedication) {
        return (
          <SuccessConfirmation
            medication={selectedMedication.med}
            takenTime={selectedMedication.time}
            onGoHome={handleBackToHome}
          />
        );
      }

      switch (page) {
        case 'home':
        case 'dashboard':
          return (
            <PatientHome
              profile={profile!}
              onNavigate={setPage}
              onMedicationConfirm={handleMedicationConfirm}
            />
          );
        case 'medications':
          return <PatientMedications profile={profile!} onBack={() => setPage('home')} onNavigate={setPage} />;
        case 'history':
          return <PatientHistory profile={profile!} onBack={() => setPage('home')} />;
        case 'health':
          return <PatientHealth profile={profile!} onBack={() => setPage('home')} />;
        case 'settings':
          return <PatientSettings profile={profile!} onUpdate={handleUpdate} onBack={() => setPage('home')} onSignOut={signOut} />;
        case 'help':
          return <PatientHelp profile={profile!} onBack={() => setPage('home')} />;
        case 'hydration':
          return <HydrationTracker profile={profile!} onBack={() => setPage('home')} />;
        case 'health_monitor':
          return <HealthMonitor profile={profile!} onBack={() => setPage('home')} onViewHistory={() => setPage('pressure_history')} />;
        case 'pressure_history':
          return <PressureHistory profile={profile!} onBack={() => setPage('health_monitor')} />;
        case 'profile':
          return <PatientProfile profile={profile!} onUpdate={handleUpdate} onBack={() => setPage('home')} onNavigate={setPage} onSignOut={signOut} />;
        default:
          return (
            <PatientHome
              profile={profile!}
              onNavigate={setPage}
              onMedicationConfirm={handleMedicationConfirm}
            />
          );
      }
    }
    if (profile!.role === 'carer') {
      switch (page) {
        case 'dashboard':    return <CarerDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />;
        case 'medications':  return <CarerSimpleShell title="Medicamentos" onBack={() => setPage('dashboard')}><CarerMedications profile={profile!} onNavigate={setPage} /></CarerSimpleShell>;
        case 'patients':     return <CarerSimpleShell title="Pacientes" onBack={() => setPage('dashboard')}><CarerPatients profile={profile!} /></CarerSimpleShell>;
        case 'appointments': return <CarerSimpleShell title="Agenda" onBack={() => setPage('dashboard')}><CarerAppointments profile={profile!} /></CarerSimpleShell>;
        case 'reports':      return <CarerSimpleShell title="Relatórios" onBack={() => setPage('dashboard')}><CarerReports profile={profile!} /></CarerSimpleShell>;
        case 'settings':     return <CarerSimpleShell title="Configurações" onBack={() => setPage('dashboard')}><SettingsPage profile={profile!} onUpdate={handleUpdate} /></CarerSimpleShell>;
        case 'register_medication': return <CarerSimpleShell title="Registrar Medicamento" onBack={() => setPage('medications')}><RegisterMedication profile={profile!} onBack={() => setPage('medications')} /></CarerSimpleShell>;
        case 'carer_patient_detail': return selectedCarerPatientId
          ? <CarerPatientDetail profile={profile!} patientId={selectedCarerPatientId} onBack={() => setPage('dashboard')} />
          : <CarerDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />;
        default:             return <CarerDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />;
      }
    }
    if (profile!.role === 'admin') {
      switch (page) {
        case 'dashboard': return <AdminDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />;
        case 'users':     return <AdminSimpleShell title="Usuários" onBack={() => setPage('dashboard')}><AdminUsers profile={profile!} /></AdminSimpleShell>;
        case 'system':    return <AdminSimpleShell title="Sistema" onBack={() => setPage('dashboard')}><AdminSystem /></AdminSimpleShell>;
        case 'admin_profile': return <AdminProfile profile={profile!} onSignOut={signOut} onBack={() => setPage('dashboard')} />;
        case 'settings':  return <AdminSimpleShell title="Configurações" onBack={() => setPage('dashboard')}><SettingsPage profile={profile!} onUpdate={handleUpdate} /></AdminSimpleShell>;
        case 'admin_patient_detail': return selectedCarerPatientId
          ? <AdminDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />
          : <AdminDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />;
        default:          return <AdminDashboard profile={profile!} onNavigate={setPage} onSignOut={signOut} unreadCount={unread} />;
      }
    }
    return null;
  }

  // For patient role, don't use AppShell - use custom elderly-friendly interface
  if (profile.role === 'patient') {
    return (
      <div className="relative">
        {renderPage()}
        {notifOpen && (
          <NotifPanel
            notifs={notifs}
            onMarkRead={id => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onMarkAll={() => setNotifs(prev => prev.map(n => ({ ...n, read: true })))}
            onClose={() => setNotifOpen(false)}
          />
        )}
      </div>
    );
  }

  // Admin: custom mobile-first interface without AppShell sidebar
  if (profile.role === 'admin') {
    return (
      <div className="relative">
        {renderPage()}
        {notifOpen && (
          <NotifPanel
            notifs={notifs}
            onMarkRead={id => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onMarkAll={() => setNotifs(prev => prev.map(n => ({ ...n, read: true })))}
            onClose={() => setNotifOpen(false)}
          />
        )}
      </div>
    );
  }

  // Carer: custom mobile-first interface without AppShell sidebar
  if (profile.role === 'carer') {
    return (
      <div className="relative">
        {renderPage()}
        {notifOpen && (
          <NotifPanel
            notifs={notifs}
            onMarkRead={id => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onMarkAll={() => setNotifs(prev => prev.map(n => ({ ...n, read: true })))}
            onClose={() => setNotifOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <AppShell
        profile={profile}
        currentPage={page}
        onNavigate={setPage}
        onSignOut={signOut}
        unreadCount={unread}
        onToggleNotifs={() => setNotifOpen(o => !o)}
        pageTitle={PAGE_TITLES[page] || 'THEO'}
      >
        {renderPage()}
      </AppShell>

      {notifOpen && (
        <NotifPanel
          notifs={notifs}
          onMarkRead={id => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
          onMarkAll={() => setNotifs(prev => prev.map(n => ({ ...n, read: true })))}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </div>
  );
}
