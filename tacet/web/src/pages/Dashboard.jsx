import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Activity, KeyRound, ShieldAlert, TrendingUp, ScrollText, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Donut } from '../components/ui/donut.jsx';
import { ScoreRing } from '../components/ui/score-ring.jsx';
import { Skeleton, SkeletonCards } from '../components/ui/skeleton.jsx';
import { EmptyState } from '../components/ui/empty-state.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { PageHeader } from '../components/page-header.jsx';
import { RiskBadge } from '../components/risk-badge.jsx';
import { cn } from '../lib/utils.js';

const LINK_LABEL = { CRYPTO: 'Wallet reuse', PGP: 'PGP key reuse', TELEGRAM: 'Telegram handle', EMAIL: 'Email reuse' };
const RISK_COLORS = { CRITICAL: '#f87171', HIGH: '#fb923c', MEDIUM: '#facc15', LOW: '#34d399' };

function Kpi({ label, value, note, accent }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-card/40 backdrop-blur-md px-4 py-3.5 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:border-white/10 group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className={cn('relative z-10 num font-mono text-[26px] font-bold leading-7 tracking-tight drop-shadow-sm', accent || 'text-zinc-100')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="relative z-10 mt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 group-hover:text-zinc-300 transition-colors">{label}</div>
      {note && <div className="relative z-10 mt-0.5 text-[11px] text-zinc-500">{note}</div>}
    </div>
  );
}

/** Real post-volume chart built from the corpus timestamps (SQL GROUP BY month). */
function Timeline({ data = [] }) {
  if (!data.length) return <EmptyState icon={TrendingUp} title="No dated posts yet" description="Ingest a dump with timestamps to plot corpus volume." />;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-[132px] items-end gap-1.5">
      {data.map((d) => (
        <div key={d.month} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
          <span className="num font-mono text-[10px] text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">{d.count}</span>
          <div
            className="w-full rounded-t-[3px] bg-gradient-to-t from-cyan-600/30 to-cyan-400/70 transition-all group-hover:from-cyan-500/50 group-hover:to-cyan-300"
            style={{ height: `${Math.max(3, (d.count / max) * 96)}px` }}
            title={`${d.month}: ${d.count} posts`}
          />
          <span className="num font-mono text-[9px] text-zinc-600">{d.month.slice(2)}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityItem({ e }) {
  const time = new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-medium text-zinc-200">{String(e.action).replace(/_/g, ' ')}</span>
          <span className="text-[11px] text-zinc-600">{e.actor}</span>
        </div>
        {e.detail && <div className="truncate text-[12px] text-zinc-500">{e.detail}</div>}
      </div>
      <span className="num shrink-0 font-mono text-[11px] text-zinc-600">{time}</span>
    </div>
  );
}

export default function Dashboard({ user }) {
  const [dash, setDash] = useState(null);
  const [actors, setActors] = useState([]);
  const [sanctions, setSanctions] = useState(null);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api('/dashboard').then(setDash).catch((e) => setErr(e.message));
    api('/actors').then((d) => setActors(Array.isArray(d) ? d : [])).catch(() => {});
    api('/sanctions/summary').then(setSanctions).catch(() => {});
  }, []);

  if (err) return <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>;
  if (!dash) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-64" />
        <SkeletonCards />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const s = dash.stats;
  const riskSegments = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    .map((k) => ({ label: k.charAt(0) + k.slice(1).toLowerCase(), value: dash.riskDistribution[k] || 0, color: RISK_COLORS[k] }))
    .filter((x) => x.value > 0);

  const forumSegments = (dash.forums || []).map((f) => ({ label: f.name, value: f.count }));

  const topActors = [...actors]
    .filter((a) => !a.benign)
    .sort((a, b) => (b.attributionScore || 0) - (a.attributionScore || 0))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Operations overview"
        description={`Welcome back, ${user?.name?.split(' ')[0]}. Corpus posture across ${dash.forums.map((f) => f.name).join(' · ')}.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => nav('/graph')}>
              Knowledge graph <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={() => nav('/compare')}>
              Compare identities <KeyRound className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Identities" value={s.actors} note={`${s.highRisk} high / critical`} accent="text-cyan-300" />
        <Kpi label="Corpus posts" value={s.posts} note={`${dash.timeline?.length || 0} active months`} />
        <Kpi label="Crypto addresses" value={s.cryptoAddresses} note={`${s.cryptoLinked} linked to identities`} accent="text-amber-300" />
        <Kpi label="Entity cross-links" value={s.crossLinks} note={`avg attribution ${s.avgAttribution}%`} />
        <Kpi
          label="OFAC designations"
          value={sanctions?.total ?? '—'}
          note={sanctions ? `${sanctions.entities} designated entities` : 'registry loading'}
          accent="text-rose-300"
        />
      </div>

      {/* 3D Cyber Threat Telemetry Banner */}
      <div className="mt-4 overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-black/70 to-purple-950/30 p-4 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-inner">
              <Sparkles className="h-5 w-5 animate-pulse text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-zinc-100">3D Threat Constellation Mode</span>
                <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 uppercase tracking-wider">WebGL Live</span>
              </div>
              <div className="text-[12px] text-zinc-400">
                Spatial 3D graph exploring {s.actors} threat actors, {s.cryptoAddresses} cryptocurrency addresses, and {s.crossLinks} cross-identity links in real time.
              </div>
            </div>
          </div>
          <Button size="sm" onClick={() => nav('/graph')} className="border border-cyan-400/40 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 hover:text-white shadow-md shadow-cyan-950/40">
            <Sparkles className="h-3.5 w-3.5 mr-1 text-cyan-300" /> Launch 3D Explorer
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Corpus volume over time</div>
              <div className="text-[12px] text-zinc-500">Posts per month, aggregated from stored timestamps</div>
            </div>
            <ScrollText className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="px-5 pb-5 pt-3">
            <Timeline data={dash.timeline || []} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-zinc-100">Risk posture</div>
            <Donut
              segments={riskSegments}
              size={116}
              thickness={13}
              centerValue={s.actors}
              centerLabel="identities"
            />
          </Card>
          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-zinc-100">Forum coverage</div>
            <Donut segments={forumSegments} size={116} thickness={13} centerValue={s.posts} centerLabel="posts" />
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Highest attribution identities</div>
              <div className="text-[12px] text-zinc-500">Weighted score across artifact, stylometry and timezone signals</div>
            </div>
            <Activity className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="px-5 pb-4 pt-2">
            {topActors.length === 0 && <EmptyState icon={KeyRound} title="No identities scored yet" />}
            <div className="space-y-2.5">
              {topActors.map((a) => (
                <button
                  key={a.id}
                  onClick={() => nav(`/actors/${a.id}`)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.015] px-3 py-2.5 text-left transition-all duration-300 hover:scale-[1.01] hover:border-cyan-500/30 hover:bg-cyan-500/[0.04] hover:shadow-lg hover:shadow-cyan-900/10"
                >
                  <ScoreRing value={a.attributionScore || 0} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] text-zinc-200">{a.handle}</span>
                    <span className="block text-[11px] text-zinc-600">
                      {a.postCount} posts · {a.cryptoCount} wallets · {a.pgpCount} PGP
                    </span>
                  </span>
                  <RiskBadge risk={a.risk} />
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Entity cross-links</div>
              <div className="text-[12px] text-zinc-500">Artifact reuse detected across identities</div>
            </div>
            <ShieldAlert className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="px-2 pb-2 pt-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Source</TableHead>
                  <TableHead>Link type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.recentLinks.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-10 text-center text-zinc-600">No cross-links recorded yet.</TableCell>
                  </TableRow>
                )}
                {dash.recentLinks.map((l, i) => (
                  <TableRow key={i} className="cursor-pointer" onClick={() => nav('/graph')}>
                    <TableCell className="font-medium text-zinc-200">{l.source}</TableCell>
                    <TableCell>
                      <span className="rounded border border-cyan-500/25 bg-cyan-500/[0.07] px-1.5 py-px text-[11px] text-cyan-300/90">
                        {LINK_LABEL[l.type] || l.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300">{l.target}</TableCell>
                    <TableCell className="num text-right font-mono text-zinc-400">{Math.round(l.weight * 100)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="mt-4 px-5 py-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-100">System activity</div>
          <button onClick={() => nav('/audit')} className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400">
            view full audit trail →
          </button>
        </div>
        <div className="divide-y divide-border/60">
          {dash.recentEvidence.map((e, i) => <ActivityItem key={i} e={e} />)}
          {dash.recentEvidence.length === 0 && <div className="py-6 text-center text-zinc-600">No events recorded.</div>}
        </div>
      </Card>
    </div>
  );
}
