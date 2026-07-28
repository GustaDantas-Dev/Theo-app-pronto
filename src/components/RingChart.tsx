interface Props {
  pct: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export default function RingChart({ pct, size = 120, stroke = 10, label = 'Adesão' }: Props) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 80 ? '#15803D' : pct >= 50 ? '#B8650A' : '#DC2626';
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e7e5e4" strokeWidth={stroke} />
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-bold text-stone-900">{pct}%</span>
          <span className="text-xs text-stone-400 font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
}
