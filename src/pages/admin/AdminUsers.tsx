import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { Search, UserX, ArrowLeftRight, Ban, CheckCircle2, X } from 'lucide-react';

interface Props { profile: Profile; }

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  carer:   'bg-blue-100 text-blue-700',
  patient: 'bg-teal-100 text-teal-700',
};
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', carer: 'Cuidador', patient: 'Paciente',
};
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  inactive:  'bg-stone-100 text-stone-500',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', suspended: 'Suspenso', inactive: 'Inativo',
};

async function insertAuditLog(
  actorId: string,
  action: string,
  patientId: string | null,
  targetId: string | null,
  oldValue: string | null,
  newValue: string | null,
  metadata?: Record<string, unknown>,
) {
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', actorId).maybeSingle();
  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    actor_role: actor?.role ?? 'admin',
    action,
    patient_id: patientId,
    target_id: targetId,
    old_value: oldValue,
    new_value: newValue,
    metadata: metadata ?? null,
  });
}

interface TransferModalProps {
  patient: Profile;
  currentCarer: Profile | null;
  carers: Profile[];
  actorId: string;
  onClose: () => void;
  onDone: () => void;
}

function TransferModal({ patient, currentCarer, carers, actorId, onClose, onDone }: TransferModalProps) {
  const [selectedCarerId, setSelectedCarerId] = useState('');
  const [saving, setSaving] = useState(false);

  const availableCarers = carers.filter(c => c.id !== currentCarer?.id);

  async function confirm() {
    if (!selectedCarerId || saving) return;
    setSaving(true);

    if (currentCarer) {
      await supabase.from('carer_patient_links')
        .delete()
        .eq('patient_id', patient.id)
        .eq('carer_id', currentCarer.id);
    }
    await supabase.from('carer_patient_links').insert({
      carer_id: selectedCarerId,
      patient_id: patient.id,
    });
    await insertAuditLog(
      actorId,
      'patient_transfer',
      patient.id,
      selectedCarerId,
      currentCarer?.id ?? null,
      selectedCarerId,
      {
        patient_name: patient.name,
        old_carer_name: currentCarer?.name ?? null,
        new_carer_id: selectedCarerId,
      },
    );

    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-900 text-lg">Transferir Paciente</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-stone-600 mb-1">Paciente</p>
        <p className="font-semibold text-stone-900 mb-4">{patient.name}</p>

        {currentCarer && (
          <div className="bg-stone-50 rounded-xl px-4 py-3 mb-4 text-sm text-stone-600">
            Cuidador atual: <span className="font-semibold text-stone-800">{currentCarer.name}</span>
          </div>
        )}

        <p className="text-sm text-stone-600 mb-2">Novo cuidador</p>
        {availableCarers.length === 0 ? (
          <p className="text-sm text-stone-400 italic mb-4">Nenhum outro cuidador disponível.</p>
        ) : (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {availableCarers.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCarerId(c.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  selectedCarerId === c.id ? 'border-teal-500 bg-teal-50' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {c.avatar_initials}
                </div>
                <div>
                  <p className="font-semibold text-stone-900 text-sm">{c.name}</p>
                  {c.patient_count !== undefined && (
                    <p className="text-xs text-stone-400">{c.patient_count ?? 0} paciente(s)</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-all">
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!selectedCarerId || saving}
            className="flex-1 py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Transferindo…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers({ profile }: Props) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [links, setLinks] = useState<{ carer_id: string; patient_id: string }[]>([]);
  const [filter, setFilter] = useState<'all' | 'patient' | 'carer' | 'admin'>('all');
  const [q, setQ] = useState('');
  const [transferPatient, setTransferPatient] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: u }, { data: l }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('carer_patient_links').select('*'),
    ]);
    setUsers(u || []);
    setLinks(l || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = users
    .filter(u => filter === 'all' || u.role === filter)
    .filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()) || u.unique_code?.toLowerCase().includes(q.toLowerCase()));

  function getCarerForPatient(patientId: string): Profile | null {
    const link = links.find(l => l.patient_id === patientId);
    return link ? users.find(u => u.id === link.carer_id) ?? null : null;
  }

  async function toggleSuspend(u: Profile) {
    if (actionLoading) return;
    setActionLoading(u.id);
    const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
    await supabase.from('profiles').update({ status: newStatus }).eq('id', u.id);
    await insertAuditLog(
      profile.id,
      newStatus === 'suspended' ? 'user_suspended' : 'user_reactivated',
      u.role === 'patient' ? u.id : null,
      u.id,
      u.status ?? 'active',
      newStatus,
      { user_name: u.name, user_role: u.role },
    );
    setActionLoading(null);
    load();
  }

  const carers = users.filter(u => u.role === 'carer');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-stone-900">Usuários</h2>
          <p className="text-stone-400 text-sm mt-0.5">{displayed.length} usuário{displayed.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-white border border-stone-200 rounded-full px-4 py-2">
          <Search size={16} className="text-stone-400 flex-shrink-0" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-stone-700 placeholder-stone-400"
            placeholder="Nome, e-mail ou código THEO..."
          />
        </div>
        {(['all', 'patient', 'carer', 'admin'] as const).map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all
              ${filter === r ? 'bg-teal-600 text-white border-teal-600' : 'border-stone-200 text-stone-500 hover:border-teal-300'}`}
          >
            {r === 'all' ? 'Todos' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="text-left text-xs font-bold uppercase tracking-wider text-stone-400 px-5 py-3">Usuário</th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-stone-400 px-5 py-3">Perfil</th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-stone-400 px-5 py-3">Status</th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-stone-400 px-5 py-3 hidden sm:table-cell">Código</th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-stone-400 px-5 py-3 hidden md:table-cell">Cadastro</th>
                <th className="text-right text-xs font-bold uppercase tracking-wider text-stone-400 px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {displayed.map(u => {
                const status = u.status ?? 'active';
                const isSelf = u.id === profile.id;
                const carer = u.role === 'patient' ? getCarerForPatient(u.id) : null;
                return (
                  <tr key={u.id} className={`hover:bg-stone-50 transition-colors ${status === 'suspended' ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                          status === 'suspended' ? 'bg-stone-400' : 'bg-teal-600'
                        }`}>
                          {u.avatar_initials}
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900 text-sm">{u.name}</p>
                          <p className="text-xs text-stone-400">{u.email || (u.age ? `${u.age} anos` : '—')}</p>
                          {u.role === 'patient' && carer && (
                            <p className="text-xs text-stone-400">Cuidador: {carer.name.split(' ')[0]}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? STATUS_COLORS['inactive']}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {u.unique_code ? (
                        <code className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-mono">{u.unique_code}</code>
                      ) : <span className="text-xs text-stone-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-stone-400 hidden md:table-cell">
                      {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {u.role === 'patient' && (
                          <button
                            onClick={() => setTransferPatient(u)}
                            title="Transferir paciente"
                            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all"
                          >
                            <ArrowLeftRight size={14} />
                          </button>
                        )}
                        {!isSelf && u.role !== 'admin' && (
                          <button
                            onClick={() => toggleSuspend(u)}
                            disabled={actionLoading === u.id}
                            title={status === 'suspended' ? 'Reativar conta' : 'Suspender conta'}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${
                              status === 'suspended'
                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                : 'bg-red-50 text-red-500 hover:bg-red-100'
                            }`}
                          >
                            {status === 'suspended'
                              ? <CheckCircle2 size={14} />
                              : <Ban size={14} />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-stone-400">
                    <UserX size={32} className="mx-auto mb-2 opacity-30" />
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {transferPatient && (
        <TransferModal
          patient={transferPatient}
          currentCarer={getCarerForPatient(transferPatient.id)}
          carers={carers}
          actorId={profile.id}
          onClose={() => setTransferPatient(null)}
          onDone={() => { setTransferPatient(null); load(); }}
        />
      )}
    </div>
  );
}
