#!/usr/bin/env node
// TACET end-to-end smoke test — exercises every public API endpoint.
// Run with: node scripts/smoke.mjs
const BASE = process.env.TACET_URL || 'http://127.0.0.1:4000/api';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

async function req(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// --- auth ---
const login = await req('/auth/login', { method: 'POST', body: { username: 'admin', password: 'tac3t-admin' } });
check('login works', login.status === 200 && !!login.json?.token, `status ${login.status}`);
const token = login.json?.token;

const badLogin = await req('/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } });
check('rejects bad credentials', badLogin.status === 401);

const noAuth = await req('/actors');
check('rejects unauthenticated request', noAuth.status === 401);

// --- health / database ---
const health = await req('/health');
check('health reports sqlite', health.status === 200 && health.json.database === 'sqlite', JSON.stringify(health.json));
check('health reports valid audit chain', health.json?.auditChainValid === true);
check('database has actors+posts', health.json?.actors > 0 && health.json?.posts > 0);

// --- dashboard ---
const dash = await req('/dashboard', { token });
check('dashboard stats', dash.status === 200 && dash.json.stats?.actors > 0);
check('dashboard forum breakdown', (dash.json?.forums || []).length > 0);
check('dashboard activity feed', (dash.json?.recentEvidence || []).length > 0);

// --- actors ---
const actors = await req('/actors', { token });
check('actors list', actors.status === 200 && actors.json.length > 0);
const actorId = actors.json[0].id;
const detail = await req(`/actors/${actorId}`, { token });
check('actor detail', detail.status === 200 && !!detail.json.primaryHandle);
check('actor detail has posts', Array.isArray(detail.json?.posts) && detail.json.posts.length > 0);
check('actor detail has candidates', Array.isArray(detail.json?.candidates));
check('actor posts carry evidence hash', detail.json?.posts?.[0]?.sha256?.length === 64);

const filtered = await req('/actors?risk=CRITICAL', { token });
check('actor risk filter', filtered.status === 200 && filtered.json.every((a) => a.risk === 'CRITICAL'));

const byForum = await req('/actors?forum=dread', { token });
check('actor forum filter', byForum.status === 200 && byForum.json.every((a) => a.forums.includes('dread')));

// --- graph ---
const graph = await req('/graph', { token });
check('graph nodes', graph.status === 200 && graph.json.nodes.length > 0);
check('graph edges', graph.json?.edges?.length > 0, `edges=${graph.json?.edges?.length}`);
check('graph includes identities', graph.json?.nodes?.some((n) => n.kind === 'actor'));
check('graph has identity-identity links', graph.json?.edges?.some((e) => String(e.relation).startsWith('SHARED_')));
const ego = await req(`/graph/actor/${actorId}`, { token });
check('ego graph centred', ego.status === 200 && ego.json.center?.id === `actor:${actorId}`);

// --- crypto ---
const crypto = await req('/crypto/summary', { token });
check('crypto summary', crypto.status === 200 && crypto.json.total > 0);
const addrs = await req('/crypto/addresses?chain=BTC', { token });
check('crypto BTC addresses', addrs.status === 200 && addrs.json.length > 0);
check('address carries evidence hash', addrs.json?.[0]?.sha256?.length === 64);
if (addrs.json.length) {
  const a0 = addrs.json[0];
  const cluster = await req(`/crypto/cluster?address=${encodeURIComponent(a0.address)}&chain=BTC`, { token });
  check('wallet cluster walk', cluster.status === 200 && cluster.json.found === true, JSON.stringify(cluster.json));
}
const market = await req('/crypto/market', { token });
check('live BTC market rate', market.status === 200 && (market.json.USD > 0 || !!market.json.error), JSON.stringify(market.json));

// --- real OFAC sanctions registry ---
const san = await req('/sanctions/summary', { token });
check('sanctions summary', san.status === 200 && san.json.total > 0, JSON.stringify(san.json));
check('sanctions includes real entities', san.json?.entities > 10);
const sanList = await req('/sanctions?chain=BTC&limit=20', { token });
check('sanctions list returns BTC rows', sanList.status === 200 && sanList.json.length > 0);
const hydra = sanList.json.find((s) => String(s.entity).toUpperCase().includes('HYDRA'));
if (hydra) {
  const chk = await req(`/sanctions/check/BTC/${hydra.address}`, { token });
  const okSn = chk.status === 200 && chk.json.sanctioned === true && chk.json.designation?.entity === hydra.entity;
  check('real HYDRA wallet verifies as sanctioned', okSn, JSON.stringify(chk.json));
} else {
  // fall back to checking any returned designation round-trips
  const chk = await req(`/sanctions/check/BTC/${sanList.json[0].address}`, { token });
  check('designated address verifies via check route', chk.json?.sanctioned === true);
}
const matches = await req('/sanctions/matches', { token });
check('sanctions matches endpoint works', matches.status === 200 && typeof matches.json.matches === 'number');

// --- analysis ---
const model = await req('/analysis/model', { token });
check('trained model reported', model.status === 200 && model.json.cvAccuracy > 0, JSON.stringify(model.json));
check('model metrics are real numbers', model.json?.nFeatures > 1000 && model.json?.nAuthors >= 10, JSON.stringify({ a: model.json?.nAuthors, f: model.json?.nFeatures }));
check('model reports real corpus provenance', /Newsgroups|real/i.test(model.json?.corpus || ''), model.json?.corpus);
if (actors.json.length > 1) {
  const cmp = await req(`/analysis/compare?a=${actorId}&b=${actors.json[1].id}`, { token });
  check('attribution compare', cmp.status === 200 && typeof cmp.json.confidence === 'number');
  check('compare has component split', cmp.json?.components?.artifact !== undefined);
}
const attrib = await req(`/analysis/attribution/${actorId}`, { token });
check('attribution candidates', attrib.status === 200 && Array.isArray(attrib.json.candidates));

// --- posts ---
const posts = await req('/posts?limit=10', { token });
check('posts list', posts.status === 200 && posts.json.posts?.length > 0);
check('posts total counted via SQL', posts.json?.total >= posts.json?.posts?.length);
const search = await req('/posts?q=escrow&limit=5', { token });
check('post search', search.status === 200);
const one = await req(`/posts/${posts.json.posts[0].id}`, { token });
check('single post with hash', one.status === 200 && one.json.sha256?.length === 64);

// --- cases ---
const cases = await req('/cases', { token });
check('cases list', cases.status === 200 && cases.json.length > 0);
if (cases.json.length) {
  const cid = cases.json[0].id;
  const c = await req(`/cases/${cid}`, { token });
  check('case detail with actors', c.status === 200 && Array.isArray(c.json.actors));
  const report = await req(`/cases/${cid}/report`, { token });
  check('case report legal note', report.status === 200 && report.json.evidenceChain?.legalNote?.length > 20);
  check('case report artifacts', Array.isArray(report.json?.evidenceChain?.artifacts));
}

// --- audit + cryptographic chain ---
const audit = await req('/audit', { token });
check('audit entries', audit.status === 200 && audit.json.length > 0);
const verify = await req('/audit/verify', { token });
check('audit hash chain verifies', verify.status === 200 && verify.json.valid === true, JSON.stringify(verify.json));

// --- ingest (real pipeline: parse -> extract -> fingerprint -> cluster -> links) ---
const uniq = `smoke_${Date.now().toString(36)}`;
const ingest = await req('/ingest/upload', {
  method: 'POST', token,
  headers: { 'X-Forum': 'exploit' },
  body: {
    text: JSON.stringify([
      { forum: 'exploit', author: uniq, content: 'hit me on jabber, escrow only, same key since 2021, price firm no lowballs.', signature: 'PGP: 0xDEADBEEF12345678', timestamp: '2025-08-01T10:00:00Z' },
      { forum: 'exploit', author: uniq, content: 'still available, one unit left, sent confirm and delete thread.', signature: 'TG: @smoke_desk', timestamp: '2025-08-02T11:00:00Z' },
    ]),
  },
});
check('ingest parses dump', ingest.status === 201 && ingest.json.posts === 2, `status ${ingest.status}`);
check('ingest extracts PGP', ingest.json?.entities?.pgp >= 1, JSON.stringify(ingest.json?.entities));
check('ingest opened new identity', ingest.json?.newActors >= 1, `newActors=${ingest.json?.newActors}`);

// re-ingesting the same handle must EXTEND the identity, not duplicate it
const ingest2 = await req('/ingest/upload', {
  method: 'POST', token,
  headers: { 'X-Forum': 'exploit' },
  body: {
    text: JSON.stringify([
      { forum: 'exploit', author: uniq, content: 'deal closed, leave feedback, price firm.', signature: '', timestamp: '2025-08-03T12:00:00Z' },
    ]),
  },
});
check('re-ingest extends known identity', ingest2.status === 201 && ingest2.json.newActors === 0, JSON.stringify({ newActors: ingest2.json?.newActors }));

const runs = await req('/ingest/runs', { token });
check('ingest run persisted to DB', runs.status === 200 && runs.json.length > 0);

// audit chain still valid after all writes
const verify2 = await req('/audit/verify', { token });
check('audit chain still valid after writes', verify2.json?.valid === true, JSON.stringify(verify2.json));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
