import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Waypoints, ZoomIn, ZoomOut, Maximize2, Search, X, Copy, ExternalLink,
  RefreshCw, Crosshair, Sparkles, Check, Layers,
} from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { EmptyState } from '../components/ui/empty-state.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { Graph3D } from '../components/Graph3D.jsx';
import { RiskBadge } from '../components/risk-badge.jsx';
import { cn } from '../lib/utils.js';

const KIND = {
  actor: { color: '#22d3ee', label: 'Identity', r: 11 },
  crypto: { color: '#fbbf24', label: 'Wallet', r: 8 },
  pgp: { color: '#fb7185', label: 'PGP key', r: 7 },
  telegram: { color: '#38bdf8', label: 'Telegram', r: 7 },
  jabber: { color: '#38bdf8', label: 'Jabber', r: 6 },
  email: { color: '#c084fc', label: 'Email', r: 6 },
  url: { color: '#a1a1aa', label: 'Clearweb URL', r: 6 },
  onion: { color: '#f87171', label: 'Onion site', r: 6 },
  alias: { color: '#2dd4bf', label: 'Alias', r: 6 },
  forum: { color: '#a78bfa', label: 'Forum', r: 7 },
};
const ALL_KINDS = Object.keys(KIND);
const HEIGHT = 640;

/* ---------------- force-directed layout ---------------- */

function buildLayout(data, width, height) {
  const nodes = data.nodes.map((n) => ({ ...n }));
  const edges = data.edges || [];
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const N = nodes.length;
  if (!N) return { nodes, edges, pos: [], idx };

  // deterministic phyllotaxis initialisation keeps layouts reproducible
  const pos = new Array(N);
  const vel = new Array(N);
  const cx = width / 2;
  const cy = height / 2;
  const spread = Math.min(width, height) * 0.36;
  for (let i = 0; i < N; i++) {
    const a = i * 2.399963; // golden angle in radians
    const rad = spread * Math.sqrt((i + 0.5) / N);
    pos[i] = { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
    vel[i] = { x: 0, y: 0 };
  }

  const links = edges
    .map((e) => ({ s: idx.get(e.source), t: idx.get(e.target), w: e.weight ?? 0.5 }))
    .filter((l) => l.s !== undefined && l.t !== undefined);

  const REPULSION = 3400;
  const SPRING = 0.035;
  const IDEAL = 92;
  const CENTER_PULL = 0.0022;
  const DAMPING = 0.82;
  const TICKS = 300;

  for (let tick = 0; tick < TICKS; tick++) {
    const cooling = 1 - tick / TICKS;

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = pos[j].x - pos[i].x;
        let dy = pos[j].y - pos[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = ((i % 7) - 3) * 0.2; dy = ((j % 5) - 2) * 0.2; d2 = 0.36; }
        const d = Math.sqrt(d2);
        const f = (REPULSION / d2) * cooling;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vel[i].x -= fx; vel[i].y -= fy;
        vel[j].x += fx; vel[j].y += fy;
      }
    }

    for (const l of links) {
      const a = pos[l.s]; const b = pos[l.t];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const target = IDEAL * (1.35 - l.w * 0.55);
      const f = (d - target) * SPRING * (0.45 + l.w) * cooling;
      const fx = (dx / d) * f; const fy = (dy / d) * f;
      vel[l.s].x += fx; vel[l.s].y += fy;
      vel[l.t].x -= fx; vel[l.t].y -= fy;
    }

    for (let i = 0; i < N; i++) {
      vel[i].x += (cx - pos[i].x) * CENTER_PULL;
      vel[i].y += (cy - pos[i].y) * CENTER_PULL;
      vel[i].x *= DAMPING; vel[i].y *= DAMPING;
      const max = 12;
      pos[i].x += Math.max(-max, Math.min(max, vel[i].x));
      pos[i].y += Math.max(-max, Math.min(max, vel[i].y));
      pos[i].x = Math.max(30, Math.min(width - 30, pos[i].x));
      pos[i].y = Math.max(30, Math.min(height - 30, pos[i].y));
    }
  }

  return { nodes, edges, pos, idx };
}

export default function Graph() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [kinds, setKinds] = useState(() => new Set(['actor', 'crypto', 'pgp', 'telegram', 'email', 'url', 'alias', 'forum']));
  const [q, setQ] = useState('');
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('3d');
  const [copied, setCopied] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [moved, setMoved] = useState({});
  const [width, setWidth] = useState(980);
  const [, bump] = useState(0);

  const stageRef = useRef(null);
  const panRef = useRef(null);
  const dragRef = useRef(null);
  const nav = useNavigate();

  const load = useCallback(() => {
    api('/graph?minScore=0&limit=400')
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(Math.max(520, Math.round(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    const ql = q.trim().toLowerCase();
    let nodes = data.nodes.filter((n) => kinds.has(n.kind));
    if (ql) {
      nodes = nodes.filter((n) =>
        String(n.label).toLowerCase().includes(ql) ||
        String(n.address || n.keyId || n.handle || '').toLowerCase().includes(ql));
    }
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, edges: (data.edges || []).filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [data, kinds, q]);

  const layout = useMemo(() => (view ? buildLayout(view, width, HEIGHT) : null), [view, width]);

  const positions = useMemo(() => {
    if (!layout) return new Map();
    const m = new Map();
    layout.nodes.forEach((n, i) => m.set(n.id, moved[n.id] || layout.pos[i]));
    return m;
  }, [layout, moved]);

  const adjacency = useMemo(() => {
    const m = new Map();
    for (const e of view?.edges || []) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source).add(e.target);
      m.get(e.target).add(e.source);
    }
    return m;
  }, [view]);

  const focusId = hover || selected;
  const focusSet = useMemo(
    () => (focusId ? new Set([focusId, ...(adjacency.get(focusId) || [])]) : null),
    [focusId, adjacency],
  );

  const selectedNode = useMemo(
    () => (selected && layout ? layout.nodes.find((n) => n.id === selected) : null),
    [selected, layout],
  );

  const onWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => {
      const k = Math.max(0.25, Math.min(3.2, t.k * factor));
      const ratio = k / t.k;
      return { k, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
    });
  };

  const onStageDown = (e) => {
    if (e.target.closest('.g-node')) return;
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: transform.x, oy: transform.y };
    setSelected(null);
  };

  const onNodeDown = (node, e) => {
    e.stopPropagation();
    const start = positions.get(node.id) || { x: 0, y: 0 };
    dragRef.current = { id: node.id, startX: start.x, startY: start.y, mx: e.clientX, my: e.clientY };
    setSelected(node.id);
  };

  const onMove = (e) => {
    if (panRef.current) {
      const p = panRef.current;
      setTransform((t) => ({ ...t, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }));
      return;
    }
    if (dragRef.current) {
      const d = dragRef.current;
      const k = transform.k;
      setMoved((m) => ({
        ...m,
        [d.id]: { x: d.startX + (e.clientX - d.mx) / k, y: d.startY + (e.clientY - d.my) / k },
      }));
    }
  };

  const onUp = () => { panRef.current = null; dragRef.current = null; };

  const zoomBy = (factor) => setTransform((t) => {
    const k = Math.max(0.25, Math.min(3.2, t.k * factor));
    const cx = width / 2; const cy = HEIGHT / 2;
    const ratio = k / t.k;
    return { k, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
  });

  const resetView = () => { setTransform({ x: 0, y: 0, k: 1 }); setMoved({}); bump((v) => v + 1); };

  const toggleKind = (kind) => setKinds((s) => {
    const next = new Set(s);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    return next;
  });

  const kindCounts = useMemo(() => {
    const c = {};
    for (const n of data?.nodes || []) c[n.kind] = (c[n.kind] || 0) + 1;
    return c;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Knowledge graph"
        description={`Force-directed & 3D spatial evidence graph — ${data?.totalNodes ?? '…'} nodes, ${data?.totalEdges ?? '…'} links. Explore in 3D Constellation or switch to 2D topological layout.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5 backdrop-blur">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11.5px] font-semibold transition-all',
                  viewMode === '3d'
                    ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>3D Constellation</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('2d')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11.5px] font-semibold transition-all',
                  viewMode === '2d'
                    ? 'border border-white/20 bg-white/10 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Waypoints className="h-3.5 w-3.5 text-zinc-400" />
                <span>2D Network</span>
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Reload</Button>
            {viewMode === '2d' && (
              <Button variant="outline" size="sm" onClick={resetView}><Maximize2 className="h-3.5 w-3.5" /> Reset view</Button>
            )}
          </div>
        }
      />

      {err && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find node…" className="h-8 w-56 pl-8 text-[13px]" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {ALL_KINDS.filter((k) => kindCounts[k]).map((k) => {
            const on = kinds.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11.5px] font-medium transition-colors',
                  on ? 'border-white/15 bg-white/[0.06] text-zinc-200' : 'border-border text-zinc-600 hover:text-zinc-400',
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: on ? KIND[k].color : '#3f3f46' }} />
                {KIND[k].label}
                <span className="num font-mono text-[10px] text-zinc-600">{kindCounts[k]}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto num font-mono text-[11.5px] text-zinc-500">
          {view ? `${view.nodes.length} nodes · ${view.edges.length} edges` : '—'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {viewMode === '3d' ? (
          <div className="graph-canvas overflow-hidden rounded-lg border border-border bg-card">
            <Graph3D
              data={data}
              selectedId={selected}
              onSelectNode={setSelected}
              kinds={kinds}
              searchQuery={q}
              height={HEIGHT}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div
              className="graph-canvas relative cursor-grab active:cursor-grabbing"
              ref={stageRef}
              style={{ height: HEIGHT }}
              onMouseDown={onStageDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={onUp}
              onWheel={onWheel}
            >
              {!layout && (
                <div className="flex h-full items-center justify-center">
                  <Skeleton className="h-[380px] w-[60%] rounded-full opacity-30" />
                </div>
              )}
              {layout && view.nodes.length === 0 && (
                <EmptyState icon={Waypoints} title="No nodes match the filters" description="Enable a node type above, or clear the search box." />
              )}
              {layout && view.nodes.length > 0 && (
                <svg width={width} height={HEIGHT} className="block select-none">
                  <defs>
                    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation="3" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                    {layout.edges.map((e, i) => {
                      const a = positions.get(e.source); const b = positions.get(e.target);
                      if (!a || !b) return null;
                      const inFocus = focusSet ? (focusSet.has(e.source) && focusSet.has(e.target)) : false;
                      const dim = focusSet && !inFocus;
                      const strong = (e.weight ?? 0) > 0.75;
                      return (
                        <line
                          key={i}
                          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                          stroke={inFocus ? '#22d3ee' : strong ? '#2f5f6b' : '#2a2a33'}
                          strokeWidth={inFocus ? 1.9 : strong ? 1.4 : 1}
                          opacity={dim ? 0.1 : inFocus ? 0.95 : 0.6}
                        />
                      );
                    })}
                    {layout.nodes.map((n) => {
                      const p = positions.get(n.id);
                      if (!p) return null;
                      const meta = KIND[n.kind] || { color: '#71717a', r: 6 };
                      const isActor = n.kind === 'actor';
                      const r = isActor ? meta.r + Math.round((n.score || 0) * 8) : meta.r;
                      const dim = focusSet && !focusSet.has(n.id);
                      const isSel = selected === n.id;
                      return (
                        <g
                          key={n.id}
                          className="g-node cursor-pointer"
                          transform={`translate(${p.x},${p.y})`}
                          onMouseEnter={() => setHover(n.id)}
                          onMouseLeave={() => setHover(null)}
                          onMouseDown={(ev) => onNodeDown(n, ev)}
                        >
                          {(isSel || hover === n.id) && <circle r={r + 5} fill={meta.color} opacity={0.16} />}
                          <circle
                            r={r}
                            fill={meta.color}
                            opacity={dim ? 0.25 : 1}
                            stroke={isSel ? '#ffffff' : '#0a0a0c'}
                            strokeWidth={isSel ? 2 : 1.2}
                            filter={isSel ? 'url(#glow)' : undefined}
                          />
                          {(isActor || isSel) && (
                            <text
                              y={-r - 7}
                              textAnchor="middle"
                              className="pointer-events-none font-mono"
                              style={{ fontSize: 11, fill: dim ? '#3f3f46' : '#d4d4d8' }}
                            >
                              {n.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}

              <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-md border border-border bg-[#0d0d11]/90 backdrop-blur">
                <button onClick={() => zoomBy(1.25)} className="flex h-8 w-8 items-center justify-center text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100" title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button onClick={() => zoomBy(1 / 1.25)} className="flex h-8 w-8 items-center justify-center border-t border-border text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100" title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button onClick={resetView} className="flex h-8 w-8 items-center justify-center border-t border-border text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100" title="Fit to view">
                  <Crosshair className="h-4 w-4" />
                </button>
              </div>
              <div className="absolute bottom-3 right-3 rounded-md border border-border bg-[#0d0d11]/90 px-2 py-1 backdrop-blur">
                <span className="num font-mono text-[10.5px] text-zinc-500">{Math.round(transform.k * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-[12px] font-semibold text-zinc-200">Inspector</span>
              {selectedNode && (
                <button onClick={() => setSelected(null)} className="text-zinc-600 transition-colors hover:text-zinc-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {!selectedNode && (
              <EmptyState
                icon={Crosshair}
                title="Nothing selected"
                description="Click any node in 3D or 2D to inspect its attribution score, connections, and extracted intelligence."
              />
            )}
            {selectedNode && (
              <div className="space-y-3 p-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: (KIND[selectedNode.kind] || {}).color || '#71717a' }} />
                      <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{(KIND[selectedNode.kind] || {}).label || selectedNode.kind}</span>
                    </div>
                    {selectedNode.risk && <RiskBadge risk={selectedNode.risk} />}
                  </div>
                  <div className="break-all font-mono text-[13px] font-bold text-zinc-100">{selectedNode.label}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-border/60 py-3">
                  <div>
                    <div className="num font-mono text-[16px] text-cyan-300 font-bold">{Math.round((selectedNode.score || selectedNode.attributionScore || 0) * 100)}%</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Graph score</div>
                  </div>
                  <div>
                    <div className="num font-mono text-[16px] text-zinc-100 font-bold">{adjacency.get(selectedNode.id)?.size || 0}</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Connections</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {selectedNode.address && <Row k="Address" v={selectedNode.address} mono />}
                  {selectedNode.chain && <Row k="Chain" v={selectedNode.chain} />}
                  {selectedNode.keyId && <Row k="Key ID" v={selectedNode.keyId} mono />}
                  {selectedNode.handle && <Row k="Handle" v={selectedNode.handle} mono />}
                  {selectedNode.forum && <Row k="Forum" v={selectedNode.forum} />}
                  {selectedNode.aliases !== undefined && <Row k="Aliases" v={selectedNode.aliases} />}
                  {selectedNode.crypto !== undefined && <Row k="Wallets" v={selectedNode.crypto} />}
                  {selectedNode.pgp !== undefined && <Row k="PGP keys" v={selectedNode.pgp} />}
                  {selectedNode.url && <Row k="URL" v={selectedNode.url} mono />}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  {selectedNode.kind === 'actor' && (
                    <Button size="sm" className="h-7 gap-1.5 text-[11.5px]" onClick={() => nav(`/actors/${selectedNode.id.replace('actor:', '')}`)}>
                      <ExternalLink className="h-3 w-3" /> Open profile
                    </Button>
                  )}
                  {selectedNode.kind === 'crypto' && (
                    <Button size="sm" variant="secondary" className="h-7 gap-1.5 text-[11.5px]" onClick={() => nav(`/crypto`)}>
                      <ExternalLink className="h-3 w-3" /> Crypto ledger
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm" className="h-7 gap-1.5 text-[11.5px]"
                    onClick={() => {
                      const val = selectedNode.address || selectedNode.keyId || selectedNode.handle || selectedNode.label;
                      navigator.clipboard?.writeText(val);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy value'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-cyan-400" />
              <span className="text-[12px] font-semibold text-zinc-200">Reading the graph</span>
            </div>
            <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-zinc-500">
              <li><span className="text-zinc-300">Cyan</span> nodes are identities; node size scales with attribution score.</li>
              <li><span className="text-zinc-300">Amber</span> nodes are wallets, <span className="text-zinc-300">rose</span> are PGP keys, <span className="text-zinc-300">violet</span> are forums.</li>
              <li>A bright edge means two identities share a hard artifact (wallet, key, handle or email).</li>
              <li>Hover a node to illuminate its neighbourhood — unrelated nodes dim.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1 last:border-0">
      <span className="shrink-0 text-[10.5px] uppercase tracking-[0.08em] text-zinc-600">{k}</span>
      <span className={cn('truncate text-right text-[11.5px] text-zinc-300', mono && 'font-mono')} title={String(v)}>{String(v)}</span>
    </div>
  );
}
