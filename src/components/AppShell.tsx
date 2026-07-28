import { useState } from 'react';
import type { Profile } from '../types';
import {
  LayoutDashboard, Pill, Clock, BarChart3, Users, Settings,
  LogOut, Bell, Menu, X, Calendar, Heart, UserCog, ShieldCheck
} from 'lucide-react';

interface Props {
  profile: Profile;
  currentPage: string;
  onNavigate: (page: string) => void;
  onSignOut: () => void;
  unreadCount: number;
  onToggleNotifs: () => void;
  children: React.ReactNode;
  pageTitle: string;
}

const patientNav = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Início' },
  { id: 'medications',  icon: Pill,            label: 'Remédios' },
  { id: 'history',      icon: Clock,           label: 'Histórico' },
  { id: 'health',       icon: Heart,           label: 'Saúde' },
  { id: 'settings',     icon: Settings,        label: 'Perfil' },
];

const carerNav = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'medications',  icon: Pill,            label: 'Medicamentos' },
  { id: 'patients',     icon: Users,           label: 'Pacientes' },
  { id: 'appointments', icon: Calendar,        label: 'Agenda' },
  { id: 'reports',      icon: BarChart3,       label: 'Relatórios' },
  { id: 'settings',     icon: Settings,        label: 'Configurações' },
];

const adminNav = [
  { id: 'dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'users',         icon: Users,           label: 'Usuários' },
  { id: 'system',        icon: ShieldCheck,     label: 'Sistema' },
  { id: 'admin_profile', icon: UserCog,         label: 'Meu Perfil' },
  { id: 'settings',      icon: Settings,        label: 'Configurações' },
];

function getNav(role: string) {
  if (role === 'admin')  return adminNav;
  if (role === 'carer')  return carerNav;
  return patientNav;
}

export default function AppShell({ profile, currentPage, onNavigate, onSignOut, unreadCount, onToggleNotifs, children, pageTitle }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = getNav(profile.role);

  const fontClass = profile.font_size === 'xlarge' ? 'text-xl' : profile.font_size === 'large' ? 'text-lg' : 'text-base';

  return (
    <div className={`min-h-screen flex bg-stone-100 ${fontClass} ${profile.dark_mode ? 'dark' : ''}`}>
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-teal-950 flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-6 py-7 border-b border-teal-800/60 flex items-center justify-between">
          <div>
            <div className="font-serif text-3xl font-bold text-white leading-none">THEO</div>
            <div className="text-teal-400 text-xs uppercase tracking-widest mt-1">Cuidador Virtual</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-teal-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button key={item.id}
                onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30'
                    : 'text-teal-200 hover:bg-teal-800/70 hover:text-white'
                  }`}>
                <Icon size={20} className="flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-teal-800/60">
          <button onClick={() => { onNavigate('settings'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-teal-800/70 transition-all">
            <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {profile.avatar_initials}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-white text-sm font-semibold truncate">{profile.name}</p>
              <p className="text-teal-400 text-xs capitalize">{profile.role === 'patient' ? 'Paciente' : profile.role === 'carer' ? 'Cuidador' : 'Administrador'}</p>
            </div>
          </button>
          <button onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-teal-300 hover:bg-teal-800/70 hover:text-white transition-all text-sm mt-1">
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-stone-200 px-4 sm:px-6 h-16 flex items-center gap-4 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-stone-500 hover:text-stone-800">
            <Menu size={22} />
          </button>
          <h1 className="font-serif text-xl font-semibold text-stone-900 flex-1 truncate">{pageTitle}</h1>
          <button onClick={onToggleNotifs} className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600 transition-all">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
