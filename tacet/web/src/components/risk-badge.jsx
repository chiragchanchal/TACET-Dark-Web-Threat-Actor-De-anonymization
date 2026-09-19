import { Badge } from './ui/badge.jsx';
import { cn } from '../lib/utils.js';

const TONES = {
  CRITICAL: 'border-red-500/30 bg-red-500/10 text-red-400',
  HIGH: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  MEDIUM: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  LOW: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

export function RiskBadge({ risk, className }) {
  return (
    <Badge variant="neutral" className={cn(TONES[risk] || '', className)}>
      {risk || '—'}
    </Badge>
  );
}

export function riskTone(risk) {
  return TONES[risk] || '';
}
