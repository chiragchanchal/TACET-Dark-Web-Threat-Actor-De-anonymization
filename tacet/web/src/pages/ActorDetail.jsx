import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, KeyRound, Mail, Globe, ScrollText, Clock, Waypoints, TriangleAlert, LoaderCircle, Radio, RefreshCw, ExternalLink,
} from 'lucide-react';
import { api } from '../api.js';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { RiskBadge, riskTone } from '../components/risk-badge.jsx';
import { cn } from '../lib/utils.js';

const VERDICT = {
  LIKELY_SAME_ACTOR: { label: 'Likely same actor', cls: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
  PROBABLE_LINK: { label: 'Probable link', cls: 'border-sky-500/35 bg-sky-500/10 text-sky-300' },
  WEAK_LINK: { label: 'Weak link', cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' },
  INSUFFICIENT: { label: 'Insufficient', cls: 'border-white/10 bg-white/[0.04] text-zinc-500' },
};

function FingerprintBar({ label, value, max, format }) {
  const v = value ?? 0;
  const pct = Math.min(100, Math.round((v / max) * 100));
  return (
    <div className="grid grid-cols-[168px_1fr_56px] items-center gap-3 py-1">
      <span className="text-[12px] text-zinc-400">{label}</span>
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-zinc-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-right font-mono text-[11.5px] text-zinc-400">{format ? format(v) : v}</span>
    </div>
  );
}

function TZHist({ hist }) {
  const values = Object.values(hist || {});
  const max = Math.max(...values, 1);
  const hours = Object.keys(hist || {});
  return (
    <div className="flex h-[88px] items-end gap-px">
      {Object.entries(hist || {}).map(([h, c]) => (
        <div key={h} className="group flex-1" title={`${h}:00 UTC — ${c} posts`}>
          <div className="mx-px rounded-t-sm bg-sky-500/60 transition-colors group-hover:bg-sky-400/80" style={{ height: `${(c / max) * 100}%` }} />
        </div>
      ))}
      {hours.length === 0 && <div className="flex h-full items-center text-[12px] text-zinc-600">No activity recorded.</div>}
    </div>
  );
}

function artifactRows(actor) {
  const rows = [];
  const push = (icon, key, items, render) => { if (items?.length) rows.push({ icon, key, items, render }); };
  push(KeyRound, 'Wallets', actor.crypto, (w) => <>{w.chain} <span className="text-zinc-500">{w.value}</span></>);
  push(KeyRound, 'PGP keys', actor.pgpKeys, (k) => <span className="text-zinc-300">{k.toUpperCase()}</span>);
  push(Globe, 'Telegram', actor.telegrams, (h) => <span className="text-zinc-300">@{h}</span>);
  push(Mail, 'Jabber / XMPP', actor.jabbers, (h) => <span className="text-zinc-300">{h}</span>);
  push(Mail, 'Email', actor.emails, (e) => <span className="text-zinc-300">{e}</span>);
  push(Globe, 'Clearweb', actor.urls, (u) => (
    <a href={u} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-1">
      {u} <ExternalLink className="h-3 w-3" />
    </a>
  ));
  return rows;
}

export default function ActorDetail() {
  const { id } = useParams();
  const [actor, setActor] = useState(null);
  const [err, setErr] = useState(null);
  const [live, setLive] = useState(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    setActor(null);
    setLive(null);
    api(`/actors/${id}`).then(setActor).catch((e) => setErr(e.message));
  }, [id]);

  const loadLive = async () => {
    setLiveBusy(true);
    try {
      const d = await api(`/crypto/actor/${id}/live`);
      setLive(d.wallets || []);
    } catch (e) {
      setLive([{ liveError: e.message }]);
    } finally {
      setLiveBusy(false);
    }
  };

  if (err) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => nav('/actors')}>
          <ArrowLeft className="h-4 w-4" /> Identities
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          <TriangleAlert className="h-4 w-4" /> {err}
        </div>
      </div>
    );
  }
  if (!actor) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-zinc-500">
        <LoaderCircle className="h-5 w-5 animate-spin" /> Loading profile…
      </div>
    );
  }

  const fp = actor.fingerprint?.profile;
  const rows = artifactRows(actor);
  const tzPeak = actor.timezoneHistogram ? Math.max(...Object.values(actor.timezoneHistogram)) : 0;
  const forumLine = (actor.forums || []).join(' · ');

  return (
    <div className="max-w-[1120px]">
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => nav('/actors')}>
        <ArrowLeft className="h-4 w-4" /> Identities
      </Button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-zinc-100">{actor.primaryHandle}</h1>
            <RiskBadge risk={actor.risk} />
            {actor.benign && <Badge variant="neutral">defender / monitoring</Badge>}
          </div>
          <div className="text-[12.5px] text-zinc-500">
            First seen {new Date(actor.firstSeen).toLocaleDateString()} · {actor.postCount} posts · {forumLine}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
          <div className="text-right">
            <div className="num font-mono text-xl font-semibold text-cyan-300">{actor.attributionScore}%</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Attribution score</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav('/graph')}>
            <Waypoints className="h-3.5 w-3.5" /> Graph
          </Button>
        </div>
      </div>

      {actor.caseNote && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-zinc-400">
          <span className="mt-px text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Case note</span>
          {actor.caseNote}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* left column: artifacts */}
        <Card className="xl:col-span-2">
          <div className="px-5 pt-4 pb-1">
            <div className="text-sm font-semibold text-zinc-100">Hard artifacts</div>
            <div className="text-[12px] text-zinc-500">Reusable identifiers extracted from corpus</div>
          </div>
          <div className="space-y-4 px-5 pb-5 pt-2">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Aliases</div>
              <div className="flex flex-wrap gap-1.5">
                {actor.aliases.map((a) => (
                  <span key={a} className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[12px] text-zinc-300">{a}</span>
                ))}
              </div>
            </div>
            {rows.map((r) => (
              <div key={r.key}>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                  <r.icon className="h-3 w-3" /> {r.key}
                </div>
                <div className="space-y-1">
                  {r.items.map((it, i) => (
                    <div key={i} className="truncate rounded border border-border/60 bg-white/[0.02] px-2 py-1 font-mono text-[11.5px]">
                      {r.render(it)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="py-6 text-center text-zinc-600">No reusable artifacts recorded.</div>}

            {(actor.crypto || []).length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    <Radio className="h-3 w-3" /> Live chain data
                  </div>
                  <Button variant="outline" size="sm" onClick={loadLive} disabled={liveBusy} className="h-7 gap-1.5 text-[11.5px]">
                    <RefreshCw className={`h-3 w-3 ${liveBusy ? 'animate-spin' : ''}`} />
                    {liveBusy ? 'Querying…' : 'Fetch on-chain'}
                  </Button>
                </div>
                {!live && <div className="text-[11.5px] text-zinc-600">Query public chain APIs for real balances and activity for this identity's wallets.</div>}
                {live && live.map((w, i) => (
                  <div key={i} className="mb-1.5 rounded border border-border/60 bg-white/[0.02] px-2 py-1.5">
                    {w.liveError || w.live?.error ? (
                      <div className="text-[11.5px] text-red-300/80">{w.liveError || w.live?.error}</div>
                    ) : (
                      <>
                        <div className="truncate font-mono text-[11px] text-zinc-400">{w.chain} {w.address}</div>
                        {w.live?.supported === false || w.live?.note ? (
                          <div className="text-[11px] text-zinc-600">{w.live.note}</div>
                        ) : (
                          <div className="mt-1 grid grid-cols-3 gap-2">
                            <LiveStat label="Balance" value={w.live?.finalBalanceBtc != null ? `${w.live.finalBalanceBtc} BTC` : '—'} />
                            <LiveStat label="Tx count" value={w.live?.txCount != null ? w.live.txCount.toLocaleString() : '—'} />
                            <LiveStat label="Received" value={w.live?.totalReceivedBtc != null ? `${w.live.totalReceivedBtc} BTC` : '—'} />
                          </div>
                        )}
                        {w.live?.source && (
                          <div className="mt-1 font-mono text-[10px] text-zinc-600">
                            {w.live.source} · {w.live.cached ? 'cached' : 'live'} · {w.live.fetchedAt ? new Date(w.live.fetchedAt).toLocaleTimeString() : ''}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* right column: fingerprint + behavior */}
        <div className="space-y-4 xl:col-span-3">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-100">Stylometric fingerprint</div>
                <div className="text-[12px] text-zinc-500">
                  {actor.fingerprint?.docCount || 0} documents · ≥ 30 chars
                </div>
              </div>
              <ScrollText className="h-4 w-4 text-zinc-600" />
            </div>
            {fp ? (
              <div>
                <FingerprintBar label="Avg word length" value={fp.avgWordLen} max={12} format={(v) => v.toFixed(2)} />
                <FingerprintBar label="Avg sentence length" value={fp.avgSentLen} max={120} format={(v) => v.toFixed(1)} />
                <FingerprintBar label="Lexical diversity (TTR)" value={fp.ttr} max={1} format={(v) => v.toFixed(3)} />
                <FingerprintBar label="Hapax ratio" value={fp.hapax} max={1} format={(v) => v.toFixed(3)} />
                <FingerprintBar label="Punctuation density" value={fp.puncRate} max={40} format={(v) => v.toFixed(2)} />
                <FingerprintBar label="Uppercase density" value={fp.capsRate * 100} max={5} format={(v) => v.toFixed(2) + '%'} />
                <FingerprintBar label="4-gram shingle types" value={fp.topWords?.length || 0} max={260} />
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-600">Corpus too small to fingerprint.</div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-600" />
              <div className="text-sm font-semibold text-zinc-100">Posting rhythm</div>
              <span className="text-[11px] text-zinc-600">UTC hour histogram · peak {tzPeak} posts</span>
            </div>
            <TZHist hist={actor.timezoneHistogram} />
          </Card>
        </div>
      </div>

      {/* attribution candidates */}
      <Card className="mt-4">
        <div className="px-5 pt-4 pb-1">
          <div className="text-sm font-semibold text-zinc-100">Attribution candidates</div>
          <div className="text-[12px] text-zinc-500">Weighted evidence across the corpus — artifact · stylometry · timezone</div>
        </div>
        <div className="px-2 pb-2 pt-1">
          <div className="space-y-px">
            {(actor.candidates || []).map((c) => {
              const v = VERDICT[c.verdict] || { label: c.verdict, cls: 'border-white/10 bg-white/[0.04] text-zinc-500' };
              return (
                <Link
                  key={c.actorId}
                  to={`/actors/${c.actorId}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="w-28 truncate font-mono text-[13px] text-zinc-200">{c.handle}</span>
                  <span className="num font-mono text-[13px] text-zinc-400">{c.forum}</span>
                  <span className={cn('num ml-auto rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[12px]', scoreColor(c.confidence))}>
                    {Math.round(c.confidence)}%
                  </span>
                  <div className="hidden w-36 text-right md:block">
                    <span className="num font-mono text-[11px] text-zinc-600">
                      A {c.components.artifact} · S {c.components.style} · T {c.components.timezone}
                    </span>
                  </div>
                  <Badge className={v.cls}>{v.label}</Badge>
                </Link>
              );
            })}
            {!actor.candidates?.length && <div className="py-8 text-center text-zinc-600">No candidates above threshold.</div>}
          </div>
        </div>
      </Card>

      {/* post corpus */}
      <Card className="mt-4">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Post corpus</div>
            <div className="text-[12px] text-zinc-500">{actor.posts?.length || 0} posts</div>
          </div>
          <ScrollText className="h-4 w-4 text-zinc-600" />
        </div>
        <div className="flex flex-col gap-3 px-5 pb-5 pt-2">
          {actor.posts?.slice(0, 8).map((p) => (
            <div key={p.id} className="rounded-md border border-border/60 bg-white/[0.015] p-3.5">
              <div className="mb-1.5 flex items-center gap-2.5 text-[11px] text-zinc-500">
                <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono uppercase text-zinc-400">{p.forum}</span>
                <span className="num font-mono">{new Date(p.ts).toLocaleString()}</span>
                {p.title && <span className="font-medium text-zinc-300">{p.title}</span>}
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{p.content}</p>
              {p.sig && <div className="mt-2 border-t border-dashed border-white/[0.07] pt-2 font-mono text-[11px] text-zinc-600">{p.sig}</div>}
            </div>
          ))}
          {!actor.posts?.length && <div className="py-6 text-center text-zinc-600">No posts in the corpus for this identity.</div>}
        </div>
      </Card>
    </div>
  );
}

function scoreColor(conf) {
  return conf >= 75 ? 'text-cyan-300' : conf >= 50 ? 'text-yellow-300' : 'text-zinc-500';
}

function LiveStat({ label, value }) {
  return (
    <div>
      <div className="num truncate font-mono text-[11.5px] text-zinc-200">{value}</div>
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-zinc-600">{label}</div>
    </div>
  );
}
