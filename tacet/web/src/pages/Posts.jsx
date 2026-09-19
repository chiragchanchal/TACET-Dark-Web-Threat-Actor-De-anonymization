import { useEffect, useState } from 'react';
import { Search, ScrollText, Hash } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card } from '../components/ui/card.jsx';
import { cn } from '../lib/utils.js';

const FORUM_TONES = {
  breached: 'text-orange-300 border-orange-500/25 bg-orange-500/[0.07]',
  dread: 'text-violet-300 border-violet-500/25 bg-violet-500/[0.07]',
  exploit: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/[0.07]',
};

function ForumTag({ forum }) {
  return <span className={cn('rounded border px-1.5 py-px font-mono text-[10px] uppercase', FORUM_TONES[forum] || 'border-white/10 text-zinc-400')}>{forum}</span>;
}

function entityChips(p) {
  const out = [];
  for (const c of p.entities?.crypto || []) out.push({ t: `${c.kind} addr`, c: 'text-amber-300 border-amber-500/25 bg-amber-500/[0.06]', k: c.kind });
  for (const g of p.entities?.pgpKeys || []) out.push({ t: 'PGP key', c: 'text-rose-300 border-rose-500/25 bg-rose-500/[0.06]', k: g });
  for (const t of p.entities?.telegrams || []) out.push({ t: `TG @${t}`, c: 'text-sky-300 border-sky-500/25 bg-sky-500/[0.06]', k: t });
  for (const e of p.entities?.emails || []) out.push({ t: e, c: 'text-purple-300 border-purple-500/25 bg-purple-500/[0.06]', k: e });
  for (const u of p.entities?.urls || []) out.push({ t: 'link', c: 'text-zinc-300 border-white/10 bg-white/[0.03]', k: u });
  return out.slice(0, 6);
}

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [forum, setForum] = useState('');
  const [err, setErr] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (forum) params.set('forum', forum);
    params.set('limit', '60');
    api(`/posts?${params}`)
      .then((d) => { setPosts(d.posts || []); setTotal(d.total || 0); })
      .catch((e) => setErr(e.message));
  }, [q, forum]);

  return (
    <div>
      <PageHeader
        title="Post triage"
        description="Search the normalized corpus and inspect extracted entities per message."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search content or author…" className="h-8 w-72 pl-8 text-[13px]" />
        </div>
        <div className="flex overflow-hidden rounded-md border border-border">
          {[{ k: '', label: `All (${total})` }, { k: 'breached', label: 'Breached' }, { k: 'dread', label: 'Dread' }, { k: 'exploit', label: 'Exploit' }].map((o) => (
            <button
              key={o.k || 'all'}
              onClick={() => setForum(o.k)}
              className={cn(
                'h-8 px-3 text-[12px] font-medium transition-colors',
                forum === o.k ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</div>}

      <div className="space-y-2.5">
        {posts.map((p) => {
          const chips = entityChips(p);
          return (
            <Card key={p.id} className="px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2.5 text-[11px] text-zinc-500">
                <ForumTag forum={p.forum} />
                <span className="font-mono text-zinc-400">{p.author}</span>
                <span className="num font-mono">{p.ts ? new Date(p.ts).toLocaleString() : '—'}</span>
                {p.title && (
                  <span className="flex items-center gap-1 truncate font-medium text-zinc-300">
                    <ScrollText className="h-3 w-3 shrink-0" /> {p.title}
                  </span>
                )}
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">{p.content}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {chips.length > 0 && <Hash className="h-3 w-3 text-zinc-600" />}
                {chips.map((c, i) => (
                  <span key={i} className={cn('rounded border px-1.5 py-px font-mono text-[10.5px]', c.c)}>{c.t}</span>
                ))}
                {p.sig && <span className="ml-auto truncate font-mono text-[10.5px] text-zinc-600">{p.sig}</span>}
              </div>
            </Card>
          );
        })}
        {!posts.length && !err && (
          <div className="rounded-lg border border-border bg-card py-12 text-center text-[13px] text-zinc-600">No posts match.</div>
        )}
      </div>
    </div>
  );
}
