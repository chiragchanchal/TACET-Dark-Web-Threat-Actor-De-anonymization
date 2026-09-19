import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, LoaderCircle, TriangleAlert, ArrowRightLeft, BrainCircuit } from 'lucide-react';
import { api } from '../api.js';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { PageHeader } from '../components/page-header.jsx';
import { cn } from '../lib/utils.js';

const VERDICT = {
  LIKELY_SAME_ACTOR: { label: 'Likely same actor', cls: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300', bar: 'bg-cyan-400' },
  PROBABLE_LINK: { label: 'Probable link', cls: 'border-sky-500/35 bg-sky-500/10 text-sky-300', bar: 'bg-sky-400' },
  WEAK_LINK: { label: 'Weak link', cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300', bar: 'bg-yellow-400' },
  INSUFFICIENT: { label: 'Insufficient', cls: 'border-white/10 bg-white/[0.04] text-zinc-500', bar: 'bg-zinc-600' },
};

const KIND_TONE = {
  CRYPTO: 'border-amber-500/30 text-amber-300/90',
  PGP: 'border-rose-500/30 text-rose-300/90',
  TELEGRAM: 'border-sky-500/30 text-sky-300/90',
  EMAIL: 'border-purple-500/30 text-purple-300/90',
};

const WEIGHTS = [
  { label: 'Artifact reuse', pct: 42 },
  { label: 'Stylometry', pct: 36 },
  { label: 'Timezone rhythm', pct: 12 },
  { label: 'Forum proximity', pct: 10, note: 'reserved' },
];

function ComponentBar({ label, value, note }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="grid grid-cols-[150px_1fr_48px] items-center gap-3 py-1">
      <span className="text-[12px] text-zinc-400">
        {label}
        {note && <span className="ml-1.5 text-[10px] text-zinc-600">{note}</span>}
      </span>
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-right font-mono text-[11.5px] text-zinc-400">{pct}%</span>
    </div>
  );
}

export default function Compare() {
  const [actors, setActors] = useState([]);
  const [aId, setAId] = useState(null);
  const [bId, setBId] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(null);

  useEffect(() => {
    api('/actors')
      .then((d) => {
        const sorted = [...d].sort((x, y) => (y.attributionScore || 0) - (x.attributionScore || 0));
        setActors(sorted);
        if (sorted.length >= 2) {
          setAId(sorted[0].id);
          setBId(sorted[1].id);
        }
      })
      .catch((e) => setErr(e.message));
    api('/analysis/model').then(setModel).catch(() => {});
  }, []);

  const runCompare = () => {
    if (!aId || !bId || aId === bId) return;
    setLoading(true);
    setErr(null);
    api(`/analysis/compare?a=${encodeURIComponent(aId)}&b=${encodeURIComponent(bId)}`)
      .then(setResult)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (aId && bId && aId !== bId && actors.length >= 2) runCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, bId]);

  const actorById = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);
  const A = actorById.get(aId);
  const B = actorById.get(bId);
  const v = result ? (VERDICT[result.verdict] || VERDICT.INSUFFICIENT) : null;

  const selectCls =
    'h-9 w-full rounded-md border border-input bg-[#0d0d11] px-2.5 text-[13px] text-zinc-200 outline-none transition-colors hover:border-zinc-600 focus-visible:border-sky-500/70';

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Attribution compare"
        description="Weighted multi-signal model — artifact reuse 42% · stylometry 36% · timezone rhythm 12% · forum proximity 10% (reserved)."
      />

      {err && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      <Card className="mb-4 p-5">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Identity A</div>
            <select value={aId || ''} onChange={(e) => setAId(e.target.value)} className={selectCls}>
              {actors.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === bId}>
                  {a.handle} — {a.risk} · {a.attributionScore}%
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-center pb-1">
            <ArrowRightLeft className="h-4 w-4 text-zinc-600" />
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Identity B</div>
            <select value={bId || ''} onChange={(e) => setBId(e.target.value)} className={selectCls}>
              {actors.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === aId}>
                  {a.handle} — {a.risk} · {a.attributionScore}%
                </option>
              ))}
            </select>
          </div>
        </div>
        {aId === bId && aId && (
          <div className="mt-3 text-[12px] text-yellow-300/80">Pick two different identities to compare.</div>
        )}
      </Card>

      {loading && !result && (
        <div className="flex h-[30vh] items-center justify-center gap-3 text-zinc-500">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Scoring pair…
        </div>
      )}

      {result && v && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[15px] text-zinc-100">{result.a?.handle}</span>
                <GitCompareArrows className="h-4 w-4 text-zinc-600" />
                <span className="font-mono text-[15px] text-zinc-100">{result.b?.handle}</span>
              </div>
              <Badge className={v.cls}>{v.label}</Badge>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
              <div>
                <div className={cn('num font-mono text-4xl font-semibold tracking-tight', v.cls.split(' ').pop())}>
                  {Math.round(result.confidence || 0)}%
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">confidence</div>
              </div>
              <div>
                <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={cn('h-full rounded-full', v.bar)} style={{ width: `${Math.min(100, Math.max(0, result.confidence || 0))}%` }} />
                </div>
                <div className="mt-2 text-[12px] text-zinc-500">
                  Component split — artifact {Math.round((result.components?.artifact || 0) * 100)}% · stylometry{' '}
                  {Math.round((result.components?.style || 0) * 100)}% · timezone {Math.round((result.components?.timezone || 0) * 100)}%
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-border/60 pt-4">
              {WEIGHTS.map((w) => (
                <ComponentBar key={w.label} label={w.label} value={w.pct / 100} note={w.note} />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-zinc-100">Matching artifacts</div>
            {(result.artifactHits || []).length === 0 && (
              <div className="py-6 text-center text-[12.5px] text-zinc-600">No shared artifacts — similarity is below threshold.</div>
            )}
            <div className="flex flex-col gap-2">
              {(result.artifactHits || []).map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-border/60 bg-white/[0.02] px-3 py-2">
                  <span className={cn('rounded border px-1.5 py-px font-mono text-[10px]', KIND_TONE[h.kind] || 'border-white/10 text-zinc-400')}>
                    {h.kind}
                  </span>
                  <span className="truncate font-mono text-[12px] text-zinc-300">{h.value}</span>
                  <span className="num ml-auto font-mono text-[11px] text-zinc-500">{Math.round((h.weight || 0) * 100)}%</span>
                </div>
              ))}
            </div>
            {result.confidence < 35 && (
              <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-zinc-500">
                Below attribution threshold — treat as insufficient evidence.
              </div>
            )}
          </Card>
        </div>
      )}

      {model && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-zinc-500" />
            <div className="text-sm font-semibold text-zinc-100">Trained stylometry model</div>
            <span className="text-[11px] text-zinc-600">scikit-learn · offline training artifact</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 md:grid-cols-4">
            <ModelStat label="CV accuracy" value={`${(model.cvAccuracy * 100).toFixed(1)}%`} note={`± ${(model.cvAccuracyStd * 100).toFixed(1)}%  ·  5-fold`} />
            <ModelStat label="Held-out accuracy" value={`${(model.heldOutAccuracy * 100).toFixed(1)}%`} note={`macro-F1 ${(model.heldOutF1Macro * 100).toFixed(1)}%`} />
            <ModelStat label="Training corpus" value={model.nDocuments.toLocaleString()} note={`${model.nAuthors} authors`} />
            <ModelStat label="Features" value={model.nFeatures.toLocaleString()} note="char 3-5 + word 1-2 TF-IDF" />
          </div>
          <div className="mt-3 border-t border-border/50 pt-2.5 font-mono text-[11px] text-zinc-600">
            {model.method} · trained {new Date(model.trainedAt).toLocaleString()}
          </div>
        </Card>
      )}
    </div>
  );
}

function ModelStat({ label, value, note }) {
  return (
    <div className="py-1">
      <div className="num font-mono text-[18px] font-semibold text-zinc-100">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-zinc-600">{note}</div>}
    </div>
  );
}
