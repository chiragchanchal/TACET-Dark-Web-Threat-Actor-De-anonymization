import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bitcoin, LoaderCircle, ExternalLink, Search, Copy, Check, ShieldAlert, X, RefreshCw, ShieldCheck } from 'lucide-react';
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
  SOL: 'text-violet-300 border-violet-500/30 bg-violet-500/[0.08]',
};

function Kpi({ label, value, note }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="num font-mono text-[22px] font-semibold tracking-tight text-zinc-100">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-zinc-600">{note}</div>}
    </div>
  );
}

export default function Crypto() {
  const [sum, setSum] = useState(null);
  const [addrs, setAddrs] = useState([]);
  const [chain, setChain] = useState('');
  const [q, setQ] = useState('');
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [chainInfo, setChainInfo] = useState({});
  const [loadingChain, setLoadingChain] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api('/crypto/summary').then(setSum).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (chain) params.set('chain', chain);
    if (q.trim()) params.set('q', q.trim());
    api(`/crypto/addresses?${params}`).then(setAddrs).catch(() => {});
  }, [chain, q]);

  const queryOnChain = async (address, c = 'BTC') => {
    setLoadingChain(true);
    try {
      const res = await api(`/crypto/chain/${c}/${address}?refresh=1`);
      setChainInfo((prev) => ({ ...prev, [address]: res }));
    } catch (e) {
      setChainInfo((prev) => ({ ...prev, [address]: { error: e.message } }));
    } finally {
      setLoadingChain(false);
    }
  };

  const copyText = (txt) => {
    navigator.clipboard?.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (err) return <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>;
  if (!sum) return (
    <div className="flex h-[50vh] items-center justify-center gap-3 text-zinc-500">
      <LoaderCircle className="h-5 w-5 animate-spin" /> Loading crypto intelligence…
    </div>
  );

  const chains = ['BTC', 'ETH', 'XMR', 'SOL'];

  return (
    <div>
      <PageHeader
        title="Crypto correlation"
        description="Addresses extracted from forum signatures and posts, clustered by shared ownership across identities."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total addresses" value={sum.total} />
        <Kpi label="Linked to identities" value={sum.linkedToActor} note={`${sum.actorsWithCrypto || 0} actors hold wallets`} />
        <Kpi label="Exchange clusters" value={sum.exchangeClusters?.length || 0} note="first-hop deposit leads" />
        <Kpi label="BTC" value={sum.counts?.BTC || 0} />
        <Kpi label="XMR" value={sum.counts?.XMR || 0} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 pt-4 pb-2">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Address registry</div>
              <div className="text-[12px] text-zinc-500">Structural checksum validation + actor links · Click any address to inspect</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter address or tag…"
                  className="h-7 w-48 pl-8 text-[12px]"
                />
              </div>
              <div className="flex overflow-hidden rounded-md border border-border">
                {[{ k: '', label: 'All' }, ...chains.map((c) => ({ k: c, label: c }))].map((o) => (
                  <button
                    key={o.k || 'all'}
                    onClick={() => setChain(o.k)}
                    className={cn(
                      'h-7 px-2.5 text-[11.5px] font-medium transition-colors',
                      chain === o.k ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.04]',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-2 pb-2 pt-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Address</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead className="text-right">Actors</TableHead>
                  <TableHead className="text-right">Posts</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Sanction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addrs.slice(0, 40).map((a) => (
                  <TableRow
                    key={a.chain + a.address}
                    onClick={() => {
                      setSelectedAddr(a);
                      if (a.chain === 'BTC' && !chainInfo[a.address]) queryOnChain(a.address, a.chain);
                    }}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selectedAddr?.address === a.address ? 'bg-cyan-500/[0.08]' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <TableCell className="max-w-[240px] truncate font-mono text-[11.5px] text-zinc-300">{a.address}</TableCell>
                    <TableCell>
                      <span className={cn('rounded border px-1.5 py-px font-mono text-[10.5px]', CHAIN_TONE[a.chain] || 'border-white/10 text-zinc-400')}>{a.chain}</span>
                    </TableCell>
                    <TableCell className="num text-right font-mono text-zinc-300">{a.actorCount || 0}</TableCell>
                    <TableCell className="num text-right font-mono text-zinc-500">{a.postCount || 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(a.tags || []).map((t, i) => (
                          <span key={i} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px text-[10px] text-zinc-500">{t.w || t.t}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.sanctioned ? (
                        <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-red-300">
                          OFAC SDN
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {addrs.length === 0 && (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-8 text-center text-zinc-600">No addresses matching filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className="space-y-4">
          {/* Interactive Address Inspector */}
          {selectedAddr ? (
            <Card className="p-5 border-cyan-500/30 shadow-lg shadow-cyan-950/20">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-amber-300" />
                  <span className="font-mono text-xs font-bold text-zinc-200">Address Inspector</span>
                </div>
                <button onClick={() => setSelectedAddr(null)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-zinc-500">Address</div>
                  <div className="font-mono text-[11.5px] text-zinc-200 break-all bg-black/40 p-2 rounded border border-white/5 mt-1">
                    {selectedAddr.address}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded border border-white/5 bg-white/[0.015] p-2">
                    <span className="text-zinc-500">Network:</span> <span className="font-mono font-bold text-zinc-200">{selectedAddr.chain}</span>
                  </div>
                  <div className="rounded border border-white/5 bg-white/[0.015] p-2">
                    <span className="text-zinc-500">Linked Actors:</span> <span className="font-mono font-bold text-zinc-200">{selectedAddr.actorCount || 0}</span>
                  </div>
                </div>

                {/* OFAC Sanctions Status */}
                <div className="rounded border border-white/5 bg-white/[0.015] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Sanctions Registry:</span>
                    {selectedAddr.sanctioned ? (
                      <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-red-400">
                        <ShieldAlert className="h-3.5 w-3.5" /> DESIGNATED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" /> Clean Check
                      </span>
                    )}
                  </div>
                  {selectedAddr.designation && (
                    <div className="mt-2 pt-2 border-t border-red-500/20 text-[11px] text-red-300 font-mono">
                      {selectedAddr.designation.entity} ({selectedAddr.designation.program})
                    </div>
                  )}
                </div>

                {/* Live Chain Data */}
                {selectedAddr.chain === 'BTC' && (
                  <div className="rounded border border-white/5 bg-white/[0.015] p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">On-Chain Activity:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-zinc-400 hover:text-zinc-200"
                        onClick={() => queryOnChain(selectedAddr.address, selectedAddr.chain)}
                        disabled={loadingChain}
                      >
                        <RefreshCw className={cn("h-3 w-3 mr-1", loadingChain && "animate-spin")} /> Query
                      </Button>
                    </div>
                    {chainInfo[selectedAddr.address] && (
                      <div className="mt-2 space-y-1 font-mono text-[11px] text-zinc-300">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Transactions:</span>
                          <span>{chainInfo[selectedAddr.address].txCount ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Total Received:</span>
                          <span>{chainInfo[selectedAddr.address].totalReceivedBtc != null ? `${chainInfo[selectedAddr.address].totalReceivedBtc} BTC` : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Current Balance:</span>
                          <span className="text-amber-300 font-bold">{chainInfo[selectedAddr.address].finalBalanceBtc != null ? `${chainInfo[selectedAddr.address].finalBalanceBtc} BTC` : '0 BTC'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[11px]"
                    onClick={() => copyText(selectedAddr.address)}
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-[11px] border border-cyan-500/30 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                    onClick={() => nav('/graph')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" /> View in 3D
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="mb-2 text-sm font-semibold text-zinc-100">Exchange-tagged clusters</div>
            <div className="text-[12px] text-zinc-500">Wallet addresses whose owning identity also references an exchange or cashout channel — first-hop leads for chain analysis.</div>
            <div className="mt-3 space-y-2">
              {(sum.exchangeClusters || []).slice(0, 6).map((c, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const found = addrs.find((a) => a.address === c.address) || { address: c.address, chain: c.chain, actorCount: (c.actorIds || []).length };
                    setSelectedAddr(found);
                    if (c.chain === 'BTC') queryOnChain(c.address, c.chain);
                  }}
                  className="cursor-pointer rounded-md border border-border/60 bg-white/[0.02] p-2.5 hover:border-cyan-500/30 transition-colors"
                >
                  <div className="truncate font-mono text-[11px] text-zinc-400">{c.address}</div>
                  <div className="mt-1 flex items-center justify-between text-[10.5px] text-zinc-500">
                    <span className="font-mono">{c.chain}</span>
                    <span className="rounded border border-orange-500/25 bg-orange-500/[0.06] px-1.5 py-px text-orange-300/80">{c.label?.w || 'exchange cluster'}</span>
                  </div>
                </div>
              ))}
              {!sum.exchangeClusters?.length && <div className="py-6 text-center text-[12px] text-zinc-600">No exchange clusters flagged.</div>}
            </div>
          </Card>
          <button
            onClick={() => nav('/graph')}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/[0.03]"
          >
            <span className="flex items-center gap-2.5 text-[13px] text-zinc-300">
              <Bitcoin className="h-4 w-4 text-amber-300" />
              View wallets in the 3D Constellation
            </span>
            <ExternalLink className="h-4 w-4 text-zinc-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
