import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FolderKanban, Download, LoaderCircle, TriangleAlert, ShieldCheck, Link2,
} from 'lucide-react';
import { api } from '../api.js';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { RiskBadge } from '../components/risk-badge.jsx';
import { PageHeader } from '../components/page-header.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table.jsx';
import { cn } from '../lib/utils.js';

const STATUS_TONE = {
  open: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  escalated: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  closed: 'border-white/10 bg-white/[0.04] text-zinc-500',
};

const LINK_TONE = {
  CRYPTO: 'border-amber-500/25 text-amber-300/90',
  PGP: 'border-rose-500/25 text-rose-300/90',
  TELEGRAM: 'border-sky-500/25 text-sky-300/90',
  EMAIL: 'border-purple-500/25 text-purple-300/90',
};

function shortAddr(v) {
  return v.length > 20 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v;
}

export default function CaseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setData(null);
    setErr(null);
    Promise.all([api(`/cases/${id}`), api(`/cases/${id}/report`)])
      .then(([c, report]) => setData({ case: c, report }))
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) {
    return (
      <div className="max-w-[1120px]">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => nav('/cases')}>
          <ArrowLeft className="h-4 w-4" /> Cases
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          <TriangleAlert className="h-4 w-4" /> {err}
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-[50vh] items-center justify-center gap-3 text-zinc-500">
        <LoaderCircle className="h-5 w-5 animate-spin" /> Loading case…
      </div>
    );
  }

  const c = data.case || {};
  const report = data.report || {};
  const chain = report.evidenceChain || {};
  const actors = c.actors || [];
  const tags = c.tags || [];

  const exportReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tacet-case-${c.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1120px]">
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => nav('/cases')}>
        <ArrowLeft className="h-4 w-4" /> Cases
      </Button>

      <PageHeader
        title={c.title || 'Case'}
        actions={
          <Button size="sm" onClick={exportReport}>
            <Download className="h-4 w-4" /> Export report
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-zinc-500">
        <Badge className={STATUS_TONE[c.status] || STATUS_TONE.open}>{c.status}</Badge>
        <span className="num font-mono">opened {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</span>
        <span className="num font-mono">by {c.createdBy || 'system'}</span>
        <span className="num font-mono">{actors.length} identities</span>
        {tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono text-[10px] text-zinc-500">{t}</span>
            ))}
          </span>
        )}
      </div>

      {c.description && (
        <p className="mb-6 max-w-[820px] text-[13px] leading-relaxed text-zinc-400">{c.description}</p>
      )}

      {/* linked identities */}
      <Card className="mb-4 p-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Linked identities</div>
        <div className="flex flex-wrap gap-2">
          {actors.length === 0 && <div className="text-[13px] text-zinc-600">No identities attached to this case.</div>}
          {actors.map((a) => (
            <Link
              key={a.id}
              to={`/actors/${a.id}`}
              className="flex items-center gap-2 rounded-md border border-border bg-[#121216] px-2.5 py-1.5 transition-colors hover:border-cyan-500/40"
            >
              <span className="font-mono text-[12px] text-zinc-200">{a.primaryHandle || a.handle}</span>
              <RiskBadge risk={a.risk} />
              <span className="num font-mono text-[11px] text-zinc-500">{a.attributionScore ?? a.score ?? 0}%</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* evidence chain */}
      <Card className="mb-4">
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <FolderKanban className="h-4 w-4 text-zinc-500" /> Evidence chain
          </div>
          <div className="text-[12px] text-zinc-500">
            Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'} by {report.generatedBy || 'system'}
          </div>
        </div>

        {chain.legalNote && (
          <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-3.5 py-3">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-cyan-400" />
            <p className="text-[12.5px] leading-relaxed text-zinc-400">{chain.legalNote}</p>
          </div>
        )}

        <div className="px-5 pb-5 pt-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Identity</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="max-w-[180px]">Wallets</TableHead>
                <TableHead>PGP</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(chain.artifacts || []).map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-[12px] text-zinc-200">{a.handle}</TableCell>
                  <TableCell><RiskBadge risk={a.risk} /></TableCell>
                  <TableCell className="num font-mono text-[12px] text-zinc-300">{a.attributionScore}%</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(a.crypto || []).slice(0, 2).map((w, j) => (
                        <span key={j} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono text-[10px] text-zinc-500" title={w.value}>
                          {w.chain}:{shortAddr(w.value)}
                        </span>
                      ))}
                      {(a.crypto || []).length > 2 && <span className="text-[10px] text-zinc-600">+{(a.crypto || []).length - 2}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(a.pgpKeys || []).map((k) => (
                      <span key={k} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono text-[10px] text-zinc-500">{k.length > 12 ? `${k.slice(0, 8)}…` : k}</span>
                    ))}
                  </TableCell>
                  <TableCell>
                    {(a.telegrams || []).map((h) => (
                      <span key={h} className="rounded border border-sky-500/25 bg-sky-500/[0.06] px-1.5 py-px font-mono text-[10px] text-sky-300/90">@{h}</span>
                    ))}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {(a.emails || []).map((e) => (
                      <span key={e} className="font-mono text-[10.5px] text-zinc-500">{e}</span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
              {!(chain.artifacts || []).length && (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="py-8 text-center text-zinc-600">No artifacts recorded for this case.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* cross-links */}
      <Card>
        <div className="flex items-center gap-2 px-5 pt-4 pb-1">
          <Link2 className="h-4 w-4 text-zinc-500" />
          <div className="text-sm font-semibold text-zinc-100">Cross-identity links</div>
          <span className="num font-mono text-[11px] text-zinc-600">{(chain.crossLinks || []).length}</span>
        </div>
        <div className="px-2 pb-2 pt-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Via</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(chain.crossLinks || []).map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-[12px] text-zinc-200">{l.source}</TableCell>
                  <TableCell>
                    <span className={cn('rounded border px-1.5 py-px font-mono text-[10px]', LINK_TONE[l.type] || 'border-white/10 text-zinc-400')}>{l.type}</span>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-zinc-200">{l.target}</TableCell>
                  <TableCell className="num text-right font-mono text-[12px] text-zinc-400">{Math.round((l.weight || 0) * 100)}%</TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-[10.5px] text-zinc-600">{l.via || '—'}</TableCell>
                </TableRow>
              ))}
              {!(chain.crossLinks || []).length && (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-8 text-center text-zinc-600">No cross-identity links registered.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
