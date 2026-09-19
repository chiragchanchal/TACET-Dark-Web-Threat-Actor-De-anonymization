import { cn } from '../../lib/utils.js';

const DEFAULT_COLORS = ['#f87171', '#fb923c', '#facc15', '#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#22d3ee'];

/** Donut chart with inline legend. segments: [{ label, value, color? }] */
export function Donut({ segments = [], size = 132, thickness = 14, centerLabel, centerValue, className }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
          {total > 0 && segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                style={{ transition: 'stroke-dasharray 600ms ease, stroke-dashoffset 600ms ease' }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {(centerValue !== undefined || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && <span className="num font-mono text-[19px] font-semibold leading-none text-zinc-100">{centerValue}</span>}
            {centerLabel && <span className="mt-1 text-[9px] uppercase tracking-[0.12em] text-zinc-500">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-400">{s.label}</span>
            <span className="num font-mono text-[12px] text-zinc-300">{s.value}</span>
            <span className="num w-9 text-right font-mono text-[11px] text-zinc-600">
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
        {segments.length === 0 && <div className="text-[12px] text-zinc-600">No data.</div>}
      </div>
    </div>
  );
}
