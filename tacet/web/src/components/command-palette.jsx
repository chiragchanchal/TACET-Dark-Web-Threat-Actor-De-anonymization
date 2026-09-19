import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CornerDownLeft, LayoutDashboard, ScanSearch, Waypoints, ScrollText,
  Bitcoin, GitCompareArrows, FolderKanban, Upload, ShieldAlert, FileClock, Scale,
} from 'lucide-react';
import { api } from '../api.js';
import { cn } from '../lib/utils.js';

const COMMANDS = [
  { id: 'nav-overview', label: 'Go to Overview', group: 'Navigate', icon: LayoutDashboard, to: '/' },
  { id: 'nav-actors', label: 'Go to Identities', group: 'Navigate', icon: ScanSearch, to: '/actors' },
  { id: 'nav-graph', label: 'Go to Knowledge graph', group: 'Navigate', icon: Waypoints, to: '/graph' },
  { id: 'nav-posts', label: 'Go to Post triage', group: 'Navigate', icon: ScrollText, to: '/posts' },
  { id: 'nav-crypto', label: 'Go to Crypto correlation', group: 'Navigate', icon: Bitcoin, to: '/crypto' },
  { id: 'nav-compare', label: 'Compare two identities', group: 'Analyse', icon: GitCompareArrows, to: '/compare' },
  { id: 'nav-cases', label: 'Go to Cases', group: 'Analyse', icon: FolderKanban, to: '/cases' },
  { id: 'nav-newcase', label: 'Create a new case', group: 'Analyse', icon: FolderKanban, to: '/cases/new' },
  { id: 'nav-ingest', label: 'Ingest a forum dump', group: 'Analyse', icon: Upload, to: '/ingest' },
  { id: 'nav-sanctions', label: 'Go to Sanctions registry', group: 'Compliance', icon: ShieldAlert, to: '/sanctions' },
  { id: 'nav-audit', label: 'Go to Audit log', group: 'Compliance', icon: FileClock, to: '/audit' },
  { id: 'nav-compliance', label: 'Go to Legal framework', group: 'Compliance', icon: Scale, to: '/compliance' },
];

export function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [actors, setActors] = useState([]);
  const inputRef = useRef(null);
  const nav = useNavigate();

  // lazily load identities the first time the palette opens
  useEffect(() => {
    if (!open || actors.length) return;
    api('/actors')
      .then((d) => setActors(Array.isArray(d) ? d.slice(0, 60) : []))
      .catch(() => {});
  }, [open, actors.length]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const cmds = COMMANDS.filter((c) => !ql || c.label.toLowerCase().includes(ql));
    const ids = ql
      ? actors
        .filter((a) => a.handle.toLowerCase().includes(ql))
        .slice(0, 6)
        .map((a) => ({
          id: `actor-${a.id}`,
          label: a.handle,
          hint: `${a.risk} · ${a.attributionScore}%`,
          group: 'Identities',
          icon: ScanSearch,
          to: `/actors/${a.id}`,
        }))
      : [];
    return [...ids, ...cmds];
  }, [q, actors]);

  useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[active]) { e.preventDefault(); nav(results[active].to); onClose(); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, active, nav, onClose]);

  if (!open) return null;

  let lastGroup = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-[#101014] shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search pages and identities…"
            className="h-12 flex-1 bg-transparent text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded border border-border bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-zinc-600">No matches.</div>}
          {results.map((r, i) => {
            const showGroup = r.group !== lastGroup;
            lastGroup = r.group;
            const Icon = r.icon;
            return (
              <div key={r.id}>
                {showGroup && (
                  <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{r.group}</div>
                )}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => { nav(r.to); onClose(); }}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                    i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">{r.label}</span>
                  {r.hint && <span className="num shrink-0 font-mono text-[11px] text-zinc-500">{r.hint}</span>}
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10.5px] text-zinc-600">
          <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 font-mono">↵</kbd> open</span>
        </div>
      </div>
    </div>
  );
}
