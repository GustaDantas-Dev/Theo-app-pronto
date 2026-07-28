import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile, VitalLog } from '../../types';
import { ArrowLeft, Clock } from 'lucide-react';

interface Props {
  profile: Profile;
  onBack: () => void;
}

type Filter = '7d' | '30d' | '90d';
type BPClass = 'normal' | 'elevated' | 'high' | 'low';

function classifyBP(sys: number, dia: number): BPClass {
  if (sys <= 90 || dia <= 60)  return 'low';
  if (sys < 130 && dia < 85)  return 'normal';
  if (sys < 140 && dia < 90)  return 'elevated';
  return 'high';
}

const CLASS_LABEL: Record<BPClass, string>  = { normal: 'Normal', elevated: 'Atenção', high: 'Alto', low: 'Baixa' };
const CLASS_EMOJI: Record<BPClass, string>  = { normal: '😊', elevated: '😐', high: '😵', low: '💧' };
const CLASS_TEXT:  Record<BPClass, string>  = { normal: 'text-[#1a6b1a]', elevated: 'text-[#7a5000]', high: 'text-[#7a0000]', low: 'text-[#003d7a]' };
const CLASS_BG:    Record<BPClass, string>  = { normal: 'bg-[#DFFFE0]', elevated: 'bg-[#FFF9C4]', high: 'bg-[#FFEDED]', low: 'bg-[#E8F4FF]' };
const CLASS_BORDER:Record<BPClass, string>  = { normal: 'border-[#32CD32]', elevated: 'border-[#FFD600]', high: 'border-[#FF3B30]', low: 'border-[#4DA6FF]' };

const PT_DAY = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return PT_DAY[d.getDay()];
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function speak(text: string) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = 0.85;
    speechSynthesis.speak(u);
  }
}

const FILTER_OPTS: { value: Filter; label: string }[] = [
  { value: '7d',  label: 'SEMANA'  },
  { value: '30d', label: '30 DIAS' },
  { value: '90d', label: '3 MESES' },
];

export default function PressureHistory({ profile, onBack }: Props) {
  const [filter, setFilter]       = useState<Filter>('7d');
  const [logs, setLogs]           = useState<VitalLog[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const cutoffDays: Record<Filter, number> = { '7d': 7, '30d': 30, '90d': 90 };

  const load = useCallback(async () => {
    setLoading(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cutoffDays[filter]);
    const { data } = await supabase
      .from('vitals_logs')
      .select('*')
      .eq('user_id', profile.id)
      .eq('type', 'blood_pressure')
      .gte('recorded_at', cutoff.toISOString())
      .order('recorded_at', { ascending: false });
    setLogs((data as VitalLog[]) || []);
    setLoading(false);
  }, [profile.id, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Group logs by calendar date ──
  const byDate: Record<string, VitalLog[]> = {};
  logs.forEach(l => {
    const d = isoDate(new Date(l.recorded_at));
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });

  // ── Summary: worst classification per day ──
  function worstClass(dayLogs: VitalLog[]): BPClass {
    const order: BPClass[] = ['high', 'low', 'elevated', 'normal'];
    for (const c of order) {
      if (dayLogs.some(l => {
        const cls = classifyBP(l.systolic ?? 0, l.diastolic ?? 0);
        return cls === c;
      })) return c;
    }
    return 'normal';
  }

  const days = Object.keys(byDate).sort().reverse();

  // ── Summary counters ──
  let goodDays = 0, warnDays = 0, badDays = 0;
  days.forEach(d => {
    const w = worstClass(byDate[d]);
    if (w === 'normal') goodDays++;
    else if (w === 'elevated') warnDays++;
    else badDays++;
  });

  // ── Week strip: last 7 days ──
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    weekDates.push(isoDate(d));
  }

  // ── Today's logs ──
  const todayStr = isoDate(new Date());
  const todayLogs = (byDate[todayStr] || []).slice().sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  function handleDayClick(date: string) {
    const label = dayLabel(date);
    setSelectedDay(prev => prev === date ? null : date);
    const dayLogs = byDate[date];
    if (dayLogs) {
      const w = worstClass(dayLogs);
      speak(`${label}. ${dayLogs.length} medição${dayLogs.length !== 1 ? 'ões' : ''}. Classificação: ${CLASS_LABEL[w]}.`);
    } else {
      speak(`${label}. Sem medições.`);
    }
  }

  const selectedLogs = selectedDay
    ? (byDate[selectedDay] || []).slice().sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
    : [];

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">

      {/* ── Header ── */}
      <div className="bg-[#26C6DA] px-4 pt-5 pb-8">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-2xl sm:text-3xl leading-tight">
              HISTÓRICO<br />MINHA PRESSÃO
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">

        {/* ── Summary card ── */}
        <div className="bg-white rounded-3xl shadow-md overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-stone-100">
            {/* Good */}
            <div className="py-5 flex flex-col items-center gap-1">
              <span className="text-3xl">😊</span>
              <span className="text-3xl font-bold text-[#32CD32]">{goodDays}</span>
              <span className="text-xs font-bold text-[#32CD32] uppercase tracking-wide">Dias Bons</span>
            </div>
            {/* Warn */}
            <div className="py-5 flex flex-col items-center gap-1">
              <span className="text-3xl">😐</span>
              <span className="text-3xl font-bold text-[#FFD600]">{warnDays}</span>
              <span className="text-xs font-bold text-[#b09000] uppercase tracking-wide">Dias OK</span>
            </div>
            {/* Bad */}
            <div className="py-5 flex flex-col items-center gap-1">
              <span className="text-3xl">😵</span>
              <span className="text-3xl font-bold text-[#FF3B30]">{badDays}</span>
              <span className="text-xs font-bold text-[#FF3B30] uppercase tracking-wide">Dias Ruins</span>
            </div>
          </div>
        </div>

        {/* ── Filter ── */}
        <div className="bg-white rounded-3xl shadow-md p-3 flex gap-2">
          {FILTER_OPTS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                filter === f.value
                  ? 'bg-[#26C6DA] text-white shadow'
                  : 'text-[#666] hover:bg-[#F5F7FA]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Legend ── */}
        <div className="flex items-center justify-center gap-4 px-2">
          <span className="flex items-center gap-1.5 text-xs text-[#666] font-semibold">
            <span className="w-3 h-3 rounded-full bg-[#32CD32] inline-block" /> NORMAL
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#666] font-semibold">
            <span className="w-3 h-3 rounded-full bg-[#FFD600] inline-block" /> ATENÇÃO
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#666] font-semibold">
            <span className="w-3 h-3 rounded-full bg-[#FF3B30] inline-block" /> ALTO
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#666] font-semibold">
            <span className="w-3 h-3 rounded-full bg-[#4DA6FF] inline-block" /> BAIXA
          </span>
        </div>

        {/* ── Week strip ── */}
        <div className="bg-white rounded-3xl shadow-md p-5">
          <p className="text-[#26C6DA] font-bold text-sm mb-4 uppercase tracking-wide">
            ESTA SEMANA — TOQUE NUM DIA
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map(date => {
              const dayLogs = byDate[date];
              const cls = dayLogs ? worstClass(dayLogs) : null;
              const isToday = date === todayStr;
              const isSelected = selectedDay === date;

              const bgMap: Record<BPClass, string> = {
                normal:   'bg-[#DFFFE0] border-[#32CD32]',
                elevated: 'bg-[#FFF9C4] border-[#FFD600]',
                high:     'bg-[#FFEDED] border-[#FF3B30]',
                low:      'bg-[#E8F4FF] border-[#4DA6FF]',
              };

              return (
                <button
                  key={date}
                  onClick={() => handleDayClick(date)}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-2xl border-2 transition-all active:scale-95
                    ${cls ? bgMap[cls] : 'bg-[#F5F7FA] border-stone-200'}
                    ${isSelected ? 'ring-2 ring-[#0D3B66] ring-offset-1' : ''}
                    ${isToday ? 'ring-2 ring-[#26C6DA] ring-offset-1' : ''}
                  `}
                  aria-label={`${dayLabel(date)} ${fmtDateShort(date)}`}
                >
                  <span className="text-xl leading-none">{cls ? CLASS_EMOJI[cls] : '—'}</span>
                  <span className="text-[10px] font-bold text-[#0D3B66] uppercase">{dayLabel(date)}</span>
                  <span className="text-[9px] text-[#999]">{fmtDateShort(date)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected day detail ── */}
        {selectedDay && (
          <div className={`rounded-3xl border-2 p-5 shadow-md ${selectedLogs.length > 0 ? 'bg-white' : 'bg-[#F5F7FA]'}`}
            style={{ borderColor: selectedLogs.length > 0 ? '#26C6DA' : '#ddd' }}>
            <p className="text-[#0D3B66] font-bold text-base mb-3 uppercase tracking-wide">
              {dayLabel(selectedDay)} — {fmtDateShort(selectedDay)}
            </p>
            {selectedLogs.length === 0 ? (
              <p className="text-[#999] text-sm text-center py-4">Sem medições neste dia.</p>
            ) : (
              <div className="space-y-2">
                {selectedLogs.map(log => {
                  const cls = classifyBP(log.systolic ?? 0, log.diastolic ?? 0);
                  return (
                    <div key={log.id}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${CLASS_BG[cls]} ${CLASS_BORDER[cls]}`}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#999]" />
                        <span className="text-sm font-bold text-[#0D3B66]">{fmtTime(log.recorded_at)}</span>
                      </div>
                      <span className="text-xl font-bold text-[#111]">
                        {log.systolic}/{log.diastolic}
                      </span>
                      <span className={`text-sm font-bold flex items-center gap-1 ${CLASS_TEXT[cls]}`}>
                        {CLASS_EMOJI[cls]} {CLASS_LABEL[cls]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Today's log ── */}
        <div className="bg-white rounded-3xl shadow-md p-5">
          <p className="text-[#26C6DA] font-bold text-sm mb-4 uppercase tracking-wide">
            HOJE — MEDIÇÕES DO DIA
          </p>
          {loading ? (
            <div className="flex justify-center py-6">
              <span className="w-8 h-8 border-4 border-[#26C6DA]/30 border-t-[#26C6DA] rounded-full animate-spin" />
            </div>
          ) : todayLogs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-[#999] font-semibold text-sm">Nenhuma medição hoje</p>
              <p className="text-[#bbb] text-xs mt-1">Registre sua pressão!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayLogs.map(log => {
                const cls = classifyBP(log.systolic ?? 0, log.diastolic ?? 0);
                return (
                  <div key={log.id}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${CLASS_BG[cls]} ${CLASS_BORDER[cls]}`}>
                    <div className="flex items-center gap-1.5 w-14">
                      <Clock className="w-4 h-4 text-[#999]" />
                      <span className="text-sm font-bold text-[#0D3B66]">{fmtTime(log.recorded_at)}</span>
                    </div>
                    <span className="text-2xl font-bold text-[#111] flex-1 text-center">
                      {log.systolic}/{log.diastolic}
                    </span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${CLASS_TEXT[cls]}`}>
                      {CLASS_EMOJI[cls]} {CLASS_LABEL[cls]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Full history list ── */}
        {days.length > 0 && (
          <div className="bg-white rounded-3xl shadow-md p-5">
            <p className="text-[#26C6DA] font-bold text-sm mb-4 uppercase tracking-wide">
              HISTÓRICO COMPLETO
            </p>
            <div className="space-y-3">
              {days.map(date => {
                const dayLogs = byDate[date];
                const cls = worstClass(dayLogs);
                const isOpen = selectedDay === date;
                return (
                  <div key={date}>
                    <button
                      onClick={() => handleDayClick(date)}
                      className={`w-full flex items-center justify-between rounded-2xl border-2 px-4 py-3 transition-all active:scale-[0.99] ${CLASS_BG[cls]} ${CLASS_BORDER[cls]}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{CLASS_EMOJI[cls]}</span>
                        <div className="text-left">
                          <p className="text-sm font-bold text-[#0D3B66]">
                            {dayLabel(date)} · {fmtDateShort(date)}
                          </p>
                          <p className="text-xs text-[#999]">{dayLogs.length} medição{dayLogs.length !== 1 ? 'ões' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${CLASS_BG[cls]} ${CLASS_TEXT[cls]} border ${CLASS_BORDER[cls]}`}>
                          {CLASS_LABEL[cls]}
                        </span>
                        <span className="text-[#26C6DA] text-lg">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-1 ml-2 space-y-1.5">
                        {dayLogs
                          .slice()
                          .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
                          .map(log => {
                            const lCls = classifyBP(log.systolic ?? 0, log.diastolic ?? 0);
                            return (
                              <div key={log.id}
                                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${CLASS_BG[lCls]} ${CLASS_BORDER[lCls]}`}>
                                <span className="text-sm font-bold text-[#0D3B66] w-14">{fmtTime(log.recorded_at)}</span>
                                <span className="text-lg font-bold text-[#111]">{log.systolic}/{log.diastolic}</span>
                                <span className={`text-xs font-bold flex items-center gap-1 ${CLASS_TEXT[lCls]}`}>
                                  {CLASS_EMOJI[lCls]} {CLASS_LABEL[lCls]}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="bg-white rounded-3xl shadow-md p-10 text-center">
            <p className="text-5xl mb-3">📊</p>
            <p className="text-[#0D3B66] font-bold text-lg mb-1">Nenhuma medição ainda</p>
            <p className="text-[#999] text-sm">Registre sua pressão para ver o histórico aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
