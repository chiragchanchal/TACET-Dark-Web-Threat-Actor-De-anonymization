import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, TriangleAlert, UsersRound, CircleCheckBig } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import { RiskBadge } from '../components/risk-badge.jsx';
import { cn } from '../lib/utils.js';

const FIELD_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500';

export default function NewCase() {
  const nav = useNavigate();
  const [actors, setActors] = useState([]);
  const [actorsErr, setActorsErr] = useState(null);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/actors')
      .then((d) => setActors(Array.isArray(d) ? d : []))
      .catch((e) => setActorsErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actors;
    return actors.filter((a) => a.handle.toLowerCase().includes(q));
  }, [actors, query]);

  const tagList = useMemo(() => {
    const seen = new Set();
    return tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => {
        if (!t || seen.has(t)) return false;
        seen.add(t);
        return true;
      });
  }, [tagsText]);

  const titleValid = title.trim().length > 0;
  const showTitleHint = titleTouched && !titleValid;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setTitleTouched(true);
    if (!titleValid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api('/cases', {
        method: 'POST',
        body: { title: title.trim(), description, actorIds: [...selected], tags: tagList },
      });
      nav('/cases');
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => nav('/cases')} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Cases
      </Button>

      <PageHeader
        title="New case"
        description="Group fragmented identities around a shared-attribute investigation."
      />

      {err && (
        <div className="mt-5 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{err}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-6 max-w-[720px] space-y-5">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Case details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="newcase-title" className={cn('mb-1.5 block', FIELD_LABEL)}>
                Title
              </label>
              <Input
                id="newcase-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setTitleTouched(true);
                }}
                onBlur={() => setTitleTouched(true)}
                maxLength={160}
                placeholder="Objective, jurisdiction notes, key artifacts…"
                className="text-[13px]"
              />
              {showTitleHint && (
                <p className="mt-1.5 text-[12px] text-red-400">Case title is required.</p>
              )}
            </div>

            <div>
              <label htmlFor="newcase-desc" className={cn('mb-1.5 block', FIELD_LABEL)}>
                Description
              </label>
              <textarea
                id="newcase-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objective, jurisdiction notes, key artifacts…"
                className="min-h-[120px] w-full resize-y rounded-md border border-input bg-[#0b0b0e] p-3 text-[13px] leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-700 focus-visible:border-sky-500/60"
              />
            </div>

            <div>
              <label htmlFor="newcase-tags" className={cn('mb-1.5 block', FIELD_LABEL)}>
                Tags
              </label>
              <Input
                id="newcase-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="ransomware, wallet-cluster"
                className="text-[13px]"
              />
              <p className="mt-1.5 text-[12px] text-zinc-600">
                comma-separated, e.g. ransomware, wallet-cluster
              </p>
              {tagList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagList.map((t) => (
                    <span
                      key={t}
                      className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Attach identities</CardTitle>
            <span className="num font-mono text-[12px] text-zinc-500">
              {selected.size} selected
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {actorsErr ? (
              <p className="text-[13px] text-red-400">Failed to load identities: {actorsErr}</p>
            ) : actors.length === 0 ? (
              <p className="text-[13px] text-zinc-500">Loading identities…</p>
            ) : (
              <>
                <div className="relative">
                  <UsersRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by handle…"
                    className="h-9 pl-8 text-[13px]"
                  />
                </div>
                <div className="max-h-64 divide-y divide-border/50 overflow-y-auto rounded-md border border-border">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-zinc-500">
                      No identities match the filter.
                    </div>
                  ) : (
                    filtered.map((a) => {
                      const isSel = selected.has(a.id);
                      return (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => toggle(a.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                            isSel ? 'bg-cyan-500/[0.07]' : 'hover:bg-white/[0.03]',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                              isSel ? 'border-cyan-400 bg-cyan-400 text-zinc-950' : 'border-zinc-600',
                            )}
                          >
                            {isSel && <CircleCheckBig className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-200">
                            {a.handle}
                          </span>
                          <RiskBadge risk={a.risk} />
                          <span className="num w-10 shrink-0 text-right font-mono text-[11.5px] text-zinc-500">
                            {a.attributionScore ?? 0}%
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {selected.size === 0 && (
              <p className="text-[12px] text-zinc-600">
                No identities attached — you can add them later from the case view.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-1">
          <Button type="submit" disabled={!titleValid || busy}>
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              'Create case'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
