import { useEffect, useState } from 'react';
import { Upload, LoaderCircle, ShieldCheck, CheckCircle2, TriangleAlert } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Card } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { cn } from '../lib/utils.js';

export default function Ingest() {
  const [text, setText] = useState('');
  const [forum, setForum] = useState('dread');
  const [result, setResult] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/ingest/runs').then(setRuns).catch(() => {});
  }, []);

  const run = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const data = await api('/ingest/upload', {
        method: 'POST',
        headers: { 'X-Forum': forum },
        body: { text, forum },
      });
      setResult(data);
      api('/ingest/runs').then(setRuns).catch(() => {});
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (f) => (f || 'json').toUpperCase();

  return (
    <div>
      <PageHeader
        title="Data ingestion"
        description="Offline pipeline — parse forum dump formats, extract entities, and fold them into the corpus and graph."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <div className="px-5 pt-4 pb-1">
            <div className="text-sm font-semibold text-zinc-100">Raw dump</div>
            <div className="text-[12px] text-zinc-500">Auto-detects JSON, CSV, BBCode or plain text · signed by forum</div>
          </div>
          <form onSubmit={run} className="px-5 pb-5 pt-2">
            <div className="mb-3 flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">Forum source</label>
              <div className="flex overflow-hidden rounded-md border border-border">
                {['breached', 'dread', 'exploit'].map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setForum(f)}
                    className={cn(
                      'h-7 px-3 font-mono text-[11.5px] font-medium transition-colors',
                      forum === f ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.04]',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              spellCheck={false}
              placeholder={'Paste raw forum dump here…\n\nExample (JSON):\n[{"forum":"dread","author":"x","content":"…","signature":"PGP: 0x…","timestamp":"…"}, …]'}
              className="min-h-[280px] w-full resize-y rounded-md border border-input bg-[#0b0b0e] p-3 font-mono text-[12px] leading-relaxed text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus-visible:border-sky-500/60"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button type="submit" disabled={!text.trim() || loading}>
                {loading ? <LoaderCircle className="animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Processing…' : 'Ingest & analyze'}
              </Button>
              {err && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-red-300">
                  <TriangleAlert className="h-3.5 w-3.5" /> {err}
                </span>
              )}
            </div>
          </form>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card className="p-5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div>
                <div className="text-sm font-semibold text-zinc-100">Air-gapped safe</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                  No Tor interaction. Parsing runs on dumped data only, so ingestion can happen on an isolated machine before analysis.
                </div>
              </div>
            </div>
          </Card>

          {result && (
            <Card className="border-cyan-500/25 p-5">
              <div className="mb-2 flex items-center gap-2 text-cyan-300">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-semibold">Ingestion complete</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Detail k="Posts parsed" v={result.posts} />
                <Detail k="Authors found" v={result.authors} />
                <Detail k="Format" v={fmt(result.format)} mono />
                <Detail k="Crypto" v={result.entities?.crypto ?? 0} />
                <Detail k="PGP keys" v={result.entities?.pgp ?? 0} />
                <Detail k="Telegram" v={result.entities?.telegrams ?? 0} />
              </div>
              <div className="mt-2 font-mono text-[10.5px] text-zinc-600">{result.runId}</div>
            </Card>
          )}

          <Card>
            <div className="px-5 pt-4 pb-1">
              <div className="text-sm font-semibold text-zinc-100">Ingest history</div>
              <div className="text-[12px] text-zinc-500">{runs.length} runs</div>
            </div>
            <div className="px-3 pb-3 pt-1">
              {runs.length === 0 && <div className="py-6 text-center text-[12px] text-zinc-600">No ingestion runs yet.</div>}
              {runs.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/[0.02]">
                  <span className="font-mono text-[11px] text-zinc-500">{new Date(r.at).toLocaleDateString()}</span>
                  <span className="font-mono text-[11px] uppercase text-zinc-400">{r.sourceForum}</span>
                  <span className="num font-mono text-[11px] text-zinc-400">{r.postsParsed} posts</span>
                  <span className="ml-auto font-mono text-[10.5px] text-zinc-600">{fmt(r.format)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ k, v, mono }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/40 py-1">
      <span className="text-[11.5px] uppercase tracking-[0.08em] text-zinc-500">{k}</span>
      <span className={cn('num text-[13px] font-medium text-zinc-200', mono && 'font-mono')}>{v}</span>
    </div>
  );
}
