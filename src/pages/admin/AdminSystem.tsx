import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getSettings, saveSettings, type SystemSettings } from '../../lib/systemSettings';
import type { EmergencyAlert, Profile } from '../../types';
import { CheckCircle2, AlertTriangle, Server, Database, Activity, Save, Settings2 } from 'lucide-react';

interface AlertWithPatient extends EmergencyAlert {
  patient?: Profile;
  latitude?: number | null;
  longitude?: number | null;
  reason?: string | null;
  urgency_level?: string;
}

function useAdminProfile() {
  const [adminId, setAdminId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAdminId(data.user.id);
    });
  }, []);
  return adminId;
}

export default function AdminSystem() {
  const adminId = useAdminProfile();
  const [alerts, setAlerts] = useState<AlertWithPatient[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadAlerts() {
    setAlertsLoading(true);
    const { data: a } = await supabase.from('emergency_alerts').select('*').order('created_at', { ascending: false }).limit(20);
    if (a && a.length) {
      const ids = [...new Set(a.map((x: EmergencyAlert) => x.user_id))];
      const { data: p } = await supabase.from('profiles').select('*').in('id', ids);
      setAlerts(a.map((x: EmergencyAlert) => ({ ...x, patient: p?.find((u: Profile) => u.id === x.user_id) })));
    } else setAlerts([]);
    setAlertsLoading(false);
  }

  async function loadSettings() {
    setSettingsLoading(true);
    setSettings(await getSettings());
    setSettingsLoading(false);
  }

  useEffect(() => {
    loadAlerts();
    loadSettings();
  }, []);

  async function resolve(id: string) {
    await supabase.from('emergency_alerts').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
    }).eq('id', id);
    loadAlerts();
  }

  async function handleSave() {
    if (!settings || !adminId || saving) return;
    setSaving(true);
    await saveSettings(settings, adminId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updateField<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  }

  const systemStatus = [
    { name: 'Banco de dados', icon: Database },
    { name: 'API Supabase', icon: Server },
    { name: 'Notificações', icon: Activity },
  ];

  const settingsFields: { key: keyof SystemSettings; label: string; unit: string; min: number; max: number }[] = [
    { key: 'medication_delay_limit_minutes', label: 'Atraso tolerado no medicamento', unit: 'min', min: 5, max: 120 },
    { key: 'hydration_goal_daily', label: 'Meta diária de hidratação', unit: 'ml', min: 500, max: 5000 },
    { key: 'pressure_high_systolic', label: 'Pressão sistólica alta', unit: 'mmHg', min: 120, max: 200 },
    { key: 'pressure_high_diastolic', label: 'Pressão diastólica alta', unit: 'mmHg', min: 80, max: 130 },
    { key: 'inactivity_limit_hours', label: 'Limite de inatividade', unit: 'h', min: 1, max: 72 },
    { key: 'critical_alert_timeout_hours', label: 'Timeout de alerta crítico sem resposta', unit: 'h', min: 1, max: 24 },
    { key: 'stock_warning_limit', label: 'Aviso de estoque baixo', unit: 'un.', min: 1, max: 30 },
    { key: 'stock_critical_limit', label: 'Estoque crítico', unit: 'un.', min: 1, max: 10 },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="font-serif text-2xl font-semibold text-stone-900">Sistema</h2>

      {/* Status */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">Status dos serviços</h3>
        <div className="space-y-2">
          {systemStatus.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-stone-400" />
                  <span className="text-sm font-medium text-stone-700">{s.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-green-600">Online</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-stone-900 flex items-center gap-2">
            <Settings2 size={18} className="text-teal-600" />
            Configurações do Sistema
          </h3>
          {settings?.updated_at && (
            <span className="text-xs text-stone-400">
              Atualizado: {new Date(settings.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {settingsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />)}
          </div>
        ) : settings ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {settingsFields.map(f => (
                <div key={f.key} className="bg-stone-50 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wider">
                    {f.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      value={settings[f.key] as number}
                      onChange={e => updateField(f.key, parseInt(e.target.value) as SystemSettings[typeof f.key])}
                      className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:border-teal-400 transition-colors"
                    />
                    <span className="text-xs text-stone-400 font-medium w-10 text-right">{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-teal-600 text-white hover:bg-teal-500'
              } disabled:opacity-50`}
            >
              {saved ? (
                <><CheckCircle2 size={16} /> Configurações salvas!</>
              ) : (
                <><Save size={16} /> {saving ? 'Salvando…' : 'Salvar configurações'}</>
              )}
            </button>
          </>
        ) : null}
      </div>

      {/* Emergency log */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">Log de emergências</h3>
          <span className="text-xs text-stone-400">
            {alerts.filter(a => !a.resolved).length} não resolvida{alerts.filter(a => !a.resolved).length !== 1 ? 's' : ''}
          </span>
        </div>
        {alertsLoading ? (
          <div className="py-8 text-center text-stone-400 text-sm">Carregando...</div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 size={32} className="mx-auto text-teal-400 mb-2" />
            <p className="text-stone-400">Nenhum alerta registrado</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {alerts.map(a => (
              <div key={a.id} className={`px-5 py-4 flex items-start gap-3 ${!a.resolved ? 'bg-red-50/50' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.resolved ? 'bg-green-100' : 'bg-red-100'}`}>
                  {a.resolved ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertTriangle size={16} className="text-red-600" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-stone-800 text-sm">{a.patient?.name || 'Usuário desconhecido'}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{a.message}</p>
                  {a.reason && <p className="text-xs text-stone-400 mt-0.5">Motivo: {a.reason}</p>}
                  {a.latitude && a.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
                    >
                      Ver localização no mapa
                    </a>
                  )}
                  <p className="text-xs text-stone-400 mt-1">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                  {a.urgency_level && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                      a.urgency_level === 'critical' ? 'bg-red-100 text-red-700' :
                      a.urgency_level === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {a.urgency_level === 'critical' ? 'Crítico' : a.urgency_level === 'high' ? 'Alto' : a.urgency_level}
                    </span>
                  )}
                </div>
                {!a.resolved && (
                  <button
                    onClick={() => resolve(a.id)}
                    className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-full hover:bg-teal-500 transition-all flex-shrink-0"
                  >
                    Resolver
                  </button>
                )}
                {a.resolved && (
                  <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">Resolvido</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
