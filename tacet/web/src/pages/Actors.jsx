import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ScanSearch } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { RiskBadge } from '../components/risk-badge.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card } from '../components/ui/card.jsx';
import { ScoreRing } from '../components/ui/score-ring.jsx';
import { SkeletonRows } from '../components/ui/skeleton.jsx';
import { EmptyState } from '../components/ui/empty-state.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { cn } from '../lib/utils.js';

const COLUMNS = [
  { key: 'handle', label: 'Handle', align: 'left', sortable: true },
  { key: 'risk', label: 'Risk', align: 'left', sortable: true },
  { key: 'postCount', label: 'Posts', align: 'right', sortable: true },
  { key: 'cryptoCount', label: 'Wallets', align: 'right', sortable: true },
  { key: 'pgpCount', label: 'PGP', align: 'right', sortable: true },
  { key: 'links', label: 'Links', align: 'right', sortable: true },
  { key: 'attributionScore', label: 'Attribution', align: 'right', sortable: true },
];

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function Actors() {
  const [actors, setActors] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [forum, setForum] = useState('');
  const [risk, setRisk] = useState('');
  const [sort, setSort] = useState({ key: 'attributionScore', dir: 'desc' });
  const nav = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams();
    if (forum) params.set('forum', forum);
    if (risk) params.set('risk', risk);
    params.set('benign', 'false');
    api(`/actors?${params}`)
      .then((d) => setActors(Array.isArray(d) ? d : []))
      .catch((e) => setErr(e.message));
  }, [forum, risk]);

  const rows = useMemo(() => {
    if (!actors) return [];
    const ql = q.trim().toLowerCase();
    const list = actors.filter((a) => !ql || a.handle.toLowerCase().includes(ql));
    const { key, dir } = sort;
    const sign = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (key === 'handle') return sign * a.handle.localeCompare(b.handle);
      if (key === 'risk') return sign * ((RISK_ORDER[a.risk] || 0) - (RISK_ORDER[b.risk] || 0));
      return sign * ((a[key] || 0) - (b[key] || 0));
    });
  }, [actors, q, sort]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'handle' ? 'asc' : 'desc' }));

  const selectCls = 'h-8 rounded-md border border-input bg-[#0d0d11] px-2.5 text-[13px] text-zinc-300 outline-none transition-colors hover:border-zinc-600 focus-visible:border-sky-500/70';

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (sort.key !== col.key) return <ArrowUpDown className="h-3 w-3 text-zinc-700" />;
    return sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-cyan-400" /> : <ArrowDown className="h-3 w-3 text-cyan-400" />;
  };

  return (
    <div>
      <PageHeader
        title="Identities"
        description="Fingerprinted forum identities with weighted attribution scores. Sort any column; click a row for the full profile."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by handle…" className="h-8 w-56 pl-8 text-[13px]" />
        </div>
        <select value={forum} onChange={(e) => setForum(e.target.value)} className={selectCls}>
          <option value="">All forums</option>
          <option value="breached">breached</option>
          <option value="dread">dread</option>
          <option value="exploit">exploit</option>
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className={selectCls}>
          <option value="">All risk levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <span className="num ml-auto font-mono text-[12px] text-zinc-500">{rows.length} identities</span>
      </div>

      {err && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>}

      <Card>
        {!actors && <div className="p-5"><SkeletonRows rows={8} /></div>}
        {actors && rows.length === 0 && (
          <EmptyState
            icon={ScanSearch}
            title="No identities match"
            description="Adjust the risk or forum filters, or clear the handle search."
          />
        )}
        {actors && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">Handle</TableHead>
                <TableHead>Forums</TableHead>
                {COLUMNS.slice(1).map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(col.align === 'right' && 'text-right', col.sortable && 'cursor-pointer select-none hover:text-zinc-300')}
                    onClick={() => col.sortable && toggleSort(col.key)}
                  >
                    <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                      {col.label}
                      <SortIcon col={col} />
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => nav(`/actors/${a.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <ScoreRing value={a.attributionScore || 0} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-100">{a.handle}</div>
                        <div className="text-[11px] text-zinc-600">{a.aliases} aliases</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.forums.slice(0, 2).map((f) => (
                        <span key={f} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono text-[10.5px] text-zinc-400">{f}</span>
                      ))}
                      {a.forums.length > 2 && <span className="text-[10.5px] text-zinc-600">+{a.forums.length - 2}</span>}
                    </div>
                  </TableCell>
                  <TableCell><RiskBadge risk={a.risk} /></TableCell>
                  <TableCell className="num text-right font-mono text-zinc-300">{a.postCount}</TableCell>
                  <TableCell className="num text-right font-mono text-zinc-300">{a.cryptoCount}</TableCell>
                  <TableCell className="num text-right font-mono text-zinc-300">{a.pgpCount}</TableCell>
                  <TableCell className="num text-right font-mono text-zinc-400">{a.links ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      'num font-mono font-medium',
                      a.attributionScore >= 75 ? 'text-cyan-300' : a.attributionScore >= 50 ? 'text-yellow-300' : 'text-zinc-400',
                    )}>
                      {a.attributionScore}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
