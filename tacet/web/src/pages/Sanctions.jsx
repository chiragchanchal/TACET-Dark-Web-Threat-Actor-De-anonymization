import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, LoaderCircle, Search, Radio, RefreshCw, ExternalLink, Crosshair } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Card } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import { Button } from '../components/ui/button.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { cn } from '../lib/utils.js';

const CHAIN_TONE = {
  BTC: 'text-amber-300 border-amber-500/30 bg-amber-500/[0.08]',
  ETH: 'text-sky-300 border-sky-500/30 bg-sky-500/[0.08]',
  XMR: 'text-rose-300 border-rose-500/30 bg-rose-500/[0.08]',
  TRX: 'text-red-300 border-red-500/30 bg-red-500/[0.08]',
  USDT: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.08]',
};

// Programme codes as published by OFAC.
const PROGRAM_LABEL = {
  CYBER2: 'Cyber-related sanctions',
  CYBER4: 'Cyber-related sanctions',
  'RUSSIA-EO14024': 'Russia (EO 14024)',
  'DPRK3': 'North Korea',
  'NPWMD': 'WMD proliferation',
  'SDNTK': 'Narcotics / trafficking',
  IRGC: 'Iran (IRGC)',
  IFSR: 'Iran financial',
  'ILLICIT-DRUGS-EO14059': 'Illicit drugs',
  'ELECTION-EO13': 'Election interference',
};

function Kpi({ label, value, note, tone }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className={cn('num font-mono text-[22px] font-semibold tracking-tight', tone || 'text-zinc-100')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-zinc-600">{note}</div>}
    </div>
  );
}

function LiveResult({ data, error, busy }) {
  if (busy) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-zinc-500">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Querying public chain API…
      </div>
    );
  }
  if (error) return <div className="text-[12px] text-red-300/90">{error}</div>;
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
      <div>
        <div className="num font-mono text-[15px] text-zinc-100">{data.txCount != null ? data.txCount.toLocaleString() : '—'}</div>
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Transactions</div>
      </div>
      <div>
        <div className="num font-mono text-[15px] text-zinc-100">{data.totalReceivedBtc != null ? `${data.totalReceivedBtc.toLocaleString()} BTC` : '—'}</div>
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Total received</div>
      </div>
      <div>
        <div className="num font-mono text-[15px] text-zinc-100">{data.finalBalanceBtc != null ? `${data.finalBalanceBtc} BTC` : '—'}</div>
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Current balance</div>
      </div>
      <div>
        <div className="num font-mono text-[12px] text-zinc-300">{data.source || '—'}</div>
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Source {data.cached ? '(cached)' : '(live)'}</div>
      </div>
    </div>
  );
}

export default function Sanctions() {
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState([]);
  const [matches, setMatches] = useState(null);
  const [q, setQ] = useState('');
  const [chain, setChain] = useState('BTC');
  const [err, setErr] = useState(null);
  const [liveBusy, setLiveBusy] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [liveErr, setLiveErr] = useState({});

  useEffect(() => {
    api('/sanctions/summary').then(setSummary).catch((e) => setErr(e.message));
    api('/sanctions/matches').then(setMatches).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('chain', chain);
    if (q) params.set('q', q);
    params.set('limit', '300');
    api(`/sanctions?${params}`).then(setList).catch((e) => setErr(e.message));
  }, [q, chain]);

  const entities = useMemo(() => {
    const map = new Map();
    for (const row of list) {
      const key = row.entity || '—';
      if (!map.has(key)) map.set(key, { entity: key, program: row.program, addresses: [] });
      map.get(key).addresses.push(row.address);
    }
    return [...map.values()];
  }, [list]);

  const lookup = async (row) => {
    setLiveBusy(row.address);
    setLiveErr((s) => ({ ...s, [row.address]: null }));
    try {
      const d = await api(`/crypto/chain/${row.chain}/${encodeURIComponent(row.address)}`);
      setLiveData((s) => ({ ...s, [row.address]: d }));
    } catch (e) {
      setLiveErr((s) => ({ ...s, [row.address]: e.message }));
    } finally {
      setLiveBusy(null);
    }
  };

  if (err) return <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>;

  return (
    <div className="max-w-[1180px]">
      <PageHeader
        title="Sanctions registry"
        description="Real designated threat-actor wallets from the US Treasury OFAC SDN list, cross-referenced against the corpus and enriched with live on-chain data."
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Designated addresses" value={summary.total} note="real OFAC designations" tone="text-rose-300" />
          <Kpi label="Designated entities" value={summary.entities} note="named actors & services" />
          <Kpi label="Chains covered" value={Object.keys(summary.byChain || {}).length} note="BTC, ETH, TRX, XMR…" />
          <Kpi
            label="Corpus overlap"
            value={matches ? matches.matches : '—'}
            note={matches ? `of ${matches.observed} observed addresses` : 'cross-referencing…'}
            tone={matches && matches.matches > 0 ? 'text-amber-300' : undefined}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entity, program or address…"
            className="h-8 w-80 pl-8 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap overflow-hidden rounded-md border border-border">
          {['BTC', 'ETH', 'TRX', 'USDT', 'XMR', 'LTC'].map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={cn(
                'h-8 px-3 font-mono text-[12px] font-medium transition-colors',
                chain === c ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.04]',
              )}
            >
              {c}
              {summary?.byChain?.[c] ? <span className="ml-1 text-zinc-600">{summary.byChain[c]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <div className="text-sm font-semibold text-zinc-100">Designated {chain} addresses</div>
            <span className="num font-mono text-[11px] text-zinc-600">{list.length} shown · {entities.length} entities</span>
          </div>
          <a
            href={summary?.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11.5px] text-zinc-500 hover:text-zinc-300"
          >
            OFAC SDN source <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="px-2 pb-3 pt-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Designated entity</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Chain</TableHead>
                <TableHead className="text-right">Live chain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.slice(0, 60).map((row) => (
                <TableRow key={row.chain + row.address}>
                  <TableCell className="max-w-[220px] truncate text-[12.5px] font-medium text-zinc-200" title={row.entity}>
                    {row.entity}
                  </TableCell>
                  <TableCell>
                    <span className="rounded border border-rose-500/25 bg-rose-500/[0.06] px-1.5 py-px text-[10.5px] text-rose-300/90">
                      {PROGRAM_LABEL[row.program] || row.program || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate font-mono text-[11px] text-zinc-400" title={row.address}>
                    {row.address}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('rounded border px-1.5 py-px font-mono text-[10.5px]', CHAIN_TONE[row.chain] || 'border-white/10 text-zinc-400')}>
                      {row.chain}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.chain === 'BTC' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-[11.5px]"
                        onClick={() => lookup(row)}
                        disabled={liveBusy === row.address}
                      >
                        {liveBusy === row.address ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}
                        Query
                      </Button>
                    ) : (
                      <span className="text-[11px] text-zinc-600">BTC only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-10 text-center text-zinc-600">No designations match.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* live lookup results */}
      {Object.keys(liveData).length > 0 && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400" />
            <div className="text-sm font-semibold text-zinc-100">Live on-chain activity</div>
            <span className="text-[11px] text-zinc-600">real blockchain data for designated wallets</span>
          </div>
          <div className="space-y-4">
            {Object.entries(liveData).map(([address, data]) => (
              <div key={address} className="rounded-md border border-border/60 bg-white/[0.02] p-3">
                <div className="mb-2 truncate font-mono text-[11.5px] text-zinc-300">{address}</div>
                <LiveResult data={data} busy={false} />
              </div>
            ))}
            {Object.entries(liveErr).filter(([, v]) => v).map(([address, message]) => (
              <div key={address} className="rounded-md border border-red-500/25 bg-red-500/[0.05] p-3">
                <div className="mb-1 truncate font-mono text-[11.5px] text-zinc-400">{address}</div>
                <div className="text-[12px] text-red-300/90">{message}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* corpus overlap */}
      {matches && (
        <Card className="mt-4 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-zinc-500" />
            <div className="text-sm font-semibold text-zinc-100">Corpus ↔ sanctions cross-reference</div>
          </div>
          {matches.matches === 0 ? (
            <p className="text-[12.5px] text-zinc-500">
              None of the {matches.observed} addresses observed in the current corpus appear on the sanctions list.
              This is the expected result for a demonstration corpus — ingest a real dump to exercise the matcher.
            </p>
          ) : (
            <div className="space-y-2">
              {matches.results.map((m) => (
                <div key={m.chain + m.address} className="rounded-md border border-amber-500/25 bg-amber-500/[0.04] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-amber-500/30 px-1.5 py-px text-[10.5px] text-amber-300">DESIGNATED</span>
                    <span className="font-mono text-[12px] text-zinc-200">{m.address}</span>
                    <span className="text-[11.5px] text-zinc-400">{m.designation?.entity}</span>
                    <span className="ml-auto num font-mono text-[11px] text-zinc-500">{m.actorCount} identity link(s)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
