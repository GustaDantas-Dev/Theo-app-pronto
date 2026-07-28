import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { HealthLog, Profile } from '../../types';
import { ArrowLeft } from 'lucide-react';

interface Props { profile: Profile; onBack?: () => void; }

const MOODS = [
  { value: 'great', emoji: '😊', label: 'Bem' },
  { value: 'ok',    emoji: '😐', label: 'Normal' },
  { value: 'bad',   emoji: '😢', label: 'Mal' },
] as const;

const SYMPTOMS = ['Dor de cabeça','Tontura','Náusea','Cansaço','Dor no peito','Falta de ar','Dor nas pernas','Outro'];

export default function PatientHealth({ profile, onBack }: Props) {
  const [mood, setMood] = useState<'great'|'ok'|'bad'>('ok');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('health_logs').select('*')
      .eq('user_id', profile.id).order('logged_at', { ascending: false }).limit(14);
    setLogs(data || []);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  function toggleSymptom(s: string) {
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function saveLog() {
    setSaving(true);
    await supabase.from('health_logs').insert({
      user_id: profile.id,
      mood,
      symptoms: selectedSymptoms.join(', '),
      notes,
    });
    setSaving(false); setSaved(true);
    setNotes(''); setSelectedSymptoms([]);
    setTimeout(() => setSaved(false), 3000);
    load();
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 transition-all text-stone-600">
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Como você está?</h2>
      </div>

      {/* Mood picker */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-4">Humor hoje</h3>
        <div className="grid grid-cols-3 gap-3">
          {MOODS.map(m => (
            <button key={m.value} onClick={() => setMood(m.value)}
              className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all
                ${mood === m.value ? 'border-teal-500 bg-teal-50 scale-[1.02]' : 'border-stone-200 hover:border-teal-200'}`}>
              <span className="text-4xl">{m.emoji}</span>
              <span className={`font-semibold text-sm ${mood === m.value ? 'text-teal-700' : 'text-stone-500'}`}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Symptoms */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-3">Sintomas (opcional)</h3>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map(s => (
            <button key={s} onClick={() => toggleSymptom(s)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all
                ${selectedSymptoms.includes(s) ? 'bg-teal-100 border-teal-400 text-teal-700 font-semibold' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-3">Observações</h3>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-all resize-none text-sm"
          placeholder="Escreva como está se sentindo..." />
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm font-semibold">
          ✅ Registro salvo com sucesso!
        </div>
      )}

      <button onClick={saveLog} disabled={saving}
        className="w-full py-4 bg-teal-600 text-white font-semibold rounded-full hover:bg-teal-500 transition-all text-lg disabled:opacity-60 flex items-center justify-center gap-2">
        {saving && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        Salvar registro
      </button>

      {/* Past logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="font-semibold text-stone-900">Histórico recente</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {logs.slice(0, 7).map(log => {
              const m = MOODS.find(x => x.value === log.mood);
              return (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-2xl">{m?.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-stone-700">{m?.label}</p>
                    {log.symptoms && <p className="text-xs text-stone-400 mt-0.5">{log.symptoms}</p>}
                    {log.notes && <p className="text-xs text-stone-500 mt-0.5 italic">"{log.notes}"</p>}
                    <p className="text-xs text-stone-300 mt-1">{new Date(log.logged_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
