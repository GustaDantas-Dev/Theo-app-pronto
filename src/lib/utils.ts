export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function fmtDateFull(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function adherencePct(taken: number, total: number): number {
  if (!total) return 0;
  return Math.round((taken / total) * 100);
}

export function adherenceColor(pct: number): string {
  if (pct >= 80) return '#15803D';
  if (pct >= 50) return '#B8650A';
  return '#DC2626';
}

export const MED_COLORS = [
  '#0D5245', '#1A5FA8', '#B8650A', '#C0392B',
  '#15803D', '#7E3F8F', '#1565C0', '#827717',
];
