import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ScanSearch, Waypoints, ScrollText, Bitcoin,
  FolderKanban, Upload, LogOut, ShieldCheck, GitCompareArrows, FileClock, Scale, ShieldAlert, Search as SearchIcon,
} from 'lucide-react';
import { getUser, clearAuth } from './api.js';
import { cn } from './lib/utils.js';
import { CommandPalette } from './components/command-palette.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Actors from './pages/Actors.jsx';
import ActorDetail from './pages/ActorDetail.jsx';
import GraphPage from './pages/Graph.jsx';
import Posts from './pages/Posts.jsx';
import Crypto from './pages/Crypto.jsx';
import Ingest from './pages/Ingest.jsx';
import Cases from './pages/Cases.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import NewCase from './pages/NewCase.jsx';
import Compare from './pages/Compare.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Compliance from './pages/Compliance.jsx';
import Sanctions from './pages/Sanctions.jsx';
import Login from './pages/Login.jsx';

const NAV_GROUPS = [
  {
    label: 'Intelligence',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/actors', label: 'Identities', icon: ScanSearch },
      { to: '/graph', label: 'Knowledge graph', icon: Waypoints },
      { to: '/posts', label: 'Post triage', icon: ScrollText },
      { to: '/crypto', label: 'Crypto correlation', icon: Bitcoin },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { to: '/compare', label: 'Attribution compare', icon: GitCompareArrows },
      { to: '/cases', label: 'Cases', icon: FolderKanban },
      { to: '/ingest', label: 'Data ingestion', icon: Upload },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/sanctions', label: 'Sanctions registry', icon: ShieldAlert },
      { to: '/audit', label: 'Audit log', icon: FileClock },
      { to: '/compliance', label: 'Legal framework', icon: Scale },
    ],
  },
];

function Sidebar({ user, onLogout }) {
  const nav = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K command palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside className="relative flex w-[228px] shrink-0 flex-col border-r border-white/[0.05] bg-black/30 backdrop-blur-xl">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.05] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded border border-cyan-500/35 bg-cyan-500/[0.08]">
          <svg className="h-4 w-4 text-cyan-400" viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="15" width="70" height="18" />
            <path d="M 15 41 L 56 41 A 29 29 0 0 1 85 70 L 85 90 L 67 90 L 67 70 A 11 11 0 0 0 56 59 L 33 59 A 18 18 0 0 1 15 41 Z" />
          </svg>
        </div>
        <div className="leading-none">
          <div className="font-mono text-[13px] font-bold tracking-[0.22em] text-zinc-100">TACET</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-zinc-500">Threat attribution</div>
        </div>
      </div>

      <div className="px-2.5 pt-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-white/[0.02] px-2.5 text-[12px] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border bg-white/[0.03] px-1 font-mono text-[9.5px] text-zinc-600">⌘K</kbd>
        </button>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <div className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              {group.label}
            </div>
            <div className="space-y-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-300 overflow-hidden',
                      isActive
                        ? 'text-cyan-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-cyan-500/10 before:to-transparent before:border-l-2 before:border-cyan-400'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn("h-4 w-4 relative z-10 transition-colors", isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-cyan-500")} />
                      <span className="relative z-10">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.05] px-3 py-3 bg-white/[0.01]">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[11px] font-semibold text-zinc-200">
            {(user?.name || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12.5px] font-medium text-zinc-200">{user?.name}</div>
            <div className="text-[11px] capitalize text-zinc-500">{user?.role}</div>
          </div>
          <button
            title="Sign out"
            onClick={() => { clearAuth(); onLogout(); nav('/login'); }}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-400" />
      </div>
    );
  }

  if (!user && location.pathname !== '/login') return <Navigate to="/login" replace />;

  if (user) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={user} onLogout={() => setUser(null)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="content-in mx-auto w-full max-w-[1280px] px-8 py-7">
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/actors" element={<Actors />} />
              <Route path="/actors/:id" element={<ActorDetail />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/crypto" element={<Crypto />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/cases/new" element={<NewCase />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/ingest" element={<Ingest />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/sanctions" element={<Sanctions />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    );
  }

  return <Login onLogin={setUser} />;
}
