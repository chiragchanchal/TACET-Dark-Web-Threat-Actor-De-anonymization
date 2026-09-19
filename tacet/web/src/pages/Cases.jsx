import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, ArrowRight, LoaderCircle, Plus } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { RiskBadge } from '../components/risk-badge.jsx';

const STATUS_TONE = {
  open: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  escalated: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  closed: 'border-white/10 bg-white/[0.04] text-zinc-500',
};

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api('/cases').then(setCases).catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <PageHeader
        title="Cases"
        description="Investigations tying fragmented identities to shared artifacts and evidence chains."
        actions={
          <Button size="sm" onClick={() => nav('/cases/new')}>
            <Plus className="h-4 w-4" /> New case
          </Button>
        }
      />

      {err && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>}
      {!cases.length && !err && (
        <div className="flex h-[40vh] items-center justify-center gap-3 text-zinc-500">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Loading cases…
        </div>
      )}

      <div className="space-y-3">
        {cases.map((c) => (
          <Card key={c.id} className="cursor-pointer overflow-hidden transition-colors hover:border-zinc-600">
            <button onClick={() => nav(`/cases/${c.id}`)} className="block w-full text-left">
              <div className="px-5 pt-4 pb-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <FolderKanban className="h-4 w-4 text-zinc-500" />
                  <span className="text-[14.5px] font-semibold text-zinc-100">{c.title}</span>
                  <Badge className={STATUS_TONE[c.status] || STATUS_TONE.open}>{c.status}</Badge>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{c.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/60 px-5 py-2.5">
                <span className="num font-mono text-[11px] text-zinc-500">
                  opened {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                </span>
                <span className="num font-mono text-[11px] text-zinc-500">by {c.createdBy || 'system'}</span>
                <span className="num font-mono text-[11px] text-zinc-500">{c.actorIds?.length || 0} identities</span>
                <span className="flex flex-wrap gap-1">
                  {c.tags?.map((t) => (
                    <span key={t} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono text-[10px] text-zinc-500">{t}</span>
                  ))}
                </span>
                <span className="ml-auto flex items-center gap-1 text-[12px] text-zinc-500">
                  Open case <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
            {(c.actors || []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-white/[0.015] px-5 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Identities</span>
                {(c.actors || []).map((a) => (
                  <button
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); nav(`/actors/${a.id}`); }}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 transition-colors hover:border-cyan-500/40"
                  >
                    <span className="font-mono text-[11.5px] text-zinc-200">{a.handle}</span>
                    <RiskBadge risk={a.risk} />
                    <span className="num font-mono text-[10.5px] text-zinc-500">{a.score ?? 0}%</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}