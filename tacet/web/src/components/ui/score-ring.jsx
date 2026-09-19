import { cn } from '../../lib/utils.js';

const SIZES = { sm: 34, md: 46, lg: 64, xl: 84 };

/**
 * Circular attribution-score gauge.
 * tone: 'auto' colours by score band; otherwise pass an explicit tone key.
 */
export function ScoreRing({ value = 0, size = 'md', label, sub, className, thickness = 3.5 }) {
  const px = SIZES[size] || SIZES.md;
  const r = (px - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;

  const band =
    pct >= 75 ? { stroke: '#22d3ee', text: 'text-cyan-300' }
      : pct >= 55 ? { stroke: '#38bdf8', text: 'text-sky-300' }
        : pct >= 35 ? { stroke: '#facc15', text: 'text-yellow-300' }
          : { stroke: '#71717a', text: 'text-zinc-400' };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative shrink-0" style={{ width: px, height: px }}>
        <svg width={px} height={px} className="-rotate-90">
          <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={thickness} />
          <circle
            cx={px / 2} cy={px / 2} r={r} fill="none"
            stroke={band.stroke} strokeWidth={thickness} strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('num font-mono font-semibold leading-none', band.text, size === 'sm' ? 'text-[11px]' : size === 'xl' ? 'text-[19px]' : 'text-[13px]')}>
            {Math.round(pct)}
          </span>
          {size !== 'sm' && <span className="mt-0.5 text-[8px] leading-none text-zinc-600">%</span>}
        </div>
      </div>
      {(label || sub) && (
        <div className="min-w-0">
          {label && <div className="text-[12.5px] font-medium text-zinc-200">{label}</div>}
          {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
        </div>
      )}
    </div>
  );
}
