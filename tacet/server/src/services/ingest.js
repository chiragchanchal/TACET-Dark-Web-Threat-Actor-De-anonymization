// ---- ingest pipeline ----
// Parses raw forum dump formats (JSON/CSV, per-forum layouts) into
// normalized posts, then applies extraction → fingerprint → cluster.

import fs from 'node:fs';
import path from 'node:path';
import {
  dataDir, nextId, sha256, insertPosts, insertActor, updateActor, insertRun, insertLink,
  listActors, listLinks, upsertAddress, linkAddressActor, appendAudit,
} from '../db.js';
import { extractEntities } from './entities.js';
import { fingerprint } from './stylometry.js';
import { detectExchange } from './crypto.js';

// ---------- format parsers (normalize to {forum, author, title, content, sig, ts}) ----------

export function detectFormat(fileName, text) {
  const name = fileName.toLowerCase();
  const first = text.trim().slice(0, 400);
  if (name.endsWith('.json') || first.startsWith('[') || first.startsWith('{')) return 'json';
  if (name.endsWith('.csv')) return 'csv';
  if (/\[quote|\[b\]|\[url|board=/.test(text)) return 'breached-html';
  if (/^\*\*|^#|^##|\[.*\]\(/.test(first)) return 'dread-md';
  if (/====|\|.*\|/m.test(first)) return 'plain';
  return 'plain';
}

export function parseJsonImport(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : (data.posts || data.messages || []);
  return arr.map((p, i) => ({
    forum: p.forum || 'unknown', author: p.author || p.user || `anon_${i}`,
    title: p.title || '', content: p.content || p.body || p.message || '',
    sig: p.signature || p.sig || '', ts: p.ts || p.timestamp || p.date || null,
  })).filter((p) => p.content && p.content.trim());
}

export function parseCsvImport(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const [header, ...rows] = lines;
  const cols = header.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const idx = (name) => cols.findIndex((c) => c.toLowerCase().includes(name));
  const iForum = idx('forum'), iAuth = idx('author') >= 0 ? idx('author') : idx('user'),
    iTitle = idx('title'), iBody = idx('body') >= 0 ? idx('body') : idx('content') >= 0 ? idx('content') : idx('message'),
    iSig = idx('sig'), iTs = idx('ts') >= 0 ? idx('ts') : idx('timestamp') >= 0 ? idx('timestamp') : idx('date');
  const unquote = (v = '') => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
  return rows.map((r) => {
    // naive CSV split respecting quotes
    const cells = [];
    let cur = '', inQ = false;
    for (const ch of r) {
      if (ch === '"') inQ = !inQ;
      if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return {
      forum: cells[iForum] || 'unknown', author: cells[iAuth] || 'anon',
      title: cells[iTitle] || '', content: cells[iBody] || '',
      sig: cells[iSig] || '', ts: cells[iTs] || null,
    };
  }).filter((p) => p.content.trim());
}

export function parsePlainText(text) {
  // posts separated by a marker line "--- POST ---" or forum blocks
  const out = [];
  const blocks = text.split(/^=+\s*POST\s*=+\s*$/m);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i].trim();
    if (!b) continue;
    const forumMatch = b.match(/^FORUM:\s*(.+)$/m);
    const authorMatch = b.match(/^AUTHOR:\s*(.+)$/m);
    const sigMatch = b.match(/^SIG:\s*(.+)$/m);
    const body = b.replace(/^(FORUM|AUTHOR|SIG|TITLE):.*$/gm, '').trim();
    if (!body) continue;
    out.push({
      forum: forumMatch?.[1].trim() || 'unknown', author: authorMatch?.[1].trim() || 'anon',
      title: '', content: body, sig: sigMatch?.[1].trim() || '',
      ts: null,
    });
  }
  if (!out.length) {
    // fallback: treat each non-empty line-section as a post (crude)
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    for (let i = 0; i < lines.length; i += 1) {
      out.push({ forum: 'unknown', author: 'anon', title: '', content: lines[i].trim(), sig: '', ts: null });
    }
  }
  return out;
}

export function parseBreachedHtml(text) {
  // BBCode-flavored dump: [quote]author[/quote] body ... [sig]...[/sig]
  const out = [];
  const re = /\[quote\]([^\]]*?)\[\/quote\]\s*([\s\S]*?)(?=\[quote\]|\[end\]|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const author = m[1].trim() || 'anon';
    const full = m[2];
    const sigMatch = full.match(/\[sig\]([\s\S]*?)\[\/sig\]/);
    const titleMatch = full.match(/\[title\]([\s\S]*?)\[\/title\]/);
    const content = full.replace(/\[sig\][\s\S]*?\[\/sig\]/g, '').replace(/\[title\][\s\S]*?\[\/title\]/g, '').trim();
    if (content) out.push({ forum: 'breached', author, title: titleMatch?.[1] || '', content, sig: sigMatch?.[1] || '', ts: null });
  }
  return out.length ? out : [{ forum: 'breached', author: 'anon', title: '', content: text.slice(0, 2000), sig: '', ts: null }];
}

// ---------- pipeline ----------

export function parseDump(fileName, text) {
  const fmt = detectFormat(fileName, text);
  switch (fmt) {
    case 'json': return { posts: parseJsonImport(text), format: 'json' };
    case 'csv': return { posts: parseCsvImport(text), format: 'csv' };
    case 'breached-html': return { posts: parseBreachedHtml(text), format: 'breached-bbcode' };
    default: return { posts: parsePlainText(text), format: 'plain' };
  }
}

/**
 * Run the full ingest pipeline over parsed posts:
 * normalize → entity extraction → fingerprint → cluster → persist.
 */
export function runPipeline(posts, opts = {}) {
  const sourceForum = opts.sourceForum || 'breached';
  const runId = opts.runId || nextId('run');
  const t0 = Date.now();

  const normalized = posts.map((p) => ({
    id: nextId('post'),
    runId,
    forum: p.forum || sourceForum,
    author: p.author || 'anon',
    title: p.title || '',
    content: p.content,
    sig: p.sig || '',
    ts: p.ts || new Date().toISOString(),
  }));

  // extract entities + record an evidence hash per post
  for (const p of normalized) {
    const allText = `${p.content}\n${p.sig}`;
    p.entities = extractEntities(allText);
    p.sha256 = sha256(`${p.forum}|${p.author}|${p.content}|${p.ts}`);
  }

  // group posts by author handle per forum
  const authorMap = new Map();
  for (const p of normalized) {
    const k = `${p.forum}::${p.author.toLowerCase()}`;
    if (!authorMap.has(k)) authorMap.set(k, { author: p.author, forum: p.forum, posts: [] });
    authorMap.get(k).posts.push(p);
  }

  // ---- identity resolution: extend a known handle, or open a new identity ----
  const known = new Map();
  for (const a of listActors()) {
    for (const h of [a.primaryHandle, ...(a.aliases || [])]) known.set(String(h).toLowerCase(), a);
  }

  const newActors = [];
  const involved = new Map();

  for (const [, g] of authorMap) {
    let actor = known.get(g.author.toLowerCase());
    if (actor) {
      actor.postCount += g.posts.length;
      const ts = g.posts.map((p) => p.ts).sort();
      if (ts[ts.length - 1] > (actor.lastSeen || '')) actor.lastSeen = ts[ts.length - 1];
      if (!actor.forums.includes(g.forum)) actor.forums.push(g.forum);
      updateActor(actor);
    } else {
      const fp = fingerprint(g.posts);
      const crypto = [];
      const pgpKeys = new Set(), telegrams = new Set(), emails = new Set(), urls = new Set(), onions = new Set(), jabbers = new Set();
      const tzHist = {};
      const seenCrypto = new Set();
      for (const p of g.posts) {
        const hour = String(new Date(p.ts).getUTCHours()).padStart(2, '0');
        tzHist[hour] = (tzHist[hour] || 0) + 1;
        // entities are {value, kind} records — unwrap to plain values
        for (const c of p.entities.crypto) {
          const key = `${c.kind}:${String(c.value).toLowerCase()}`;
          if (seenCrypto.has(key)) continue;
          seenCrypto.add(key);
          crypto.push({ chain: c.kind, value: c.value, weight: 0.8, firstSeen: p.ts });
        }
        for (const x of p.entities.pgpKeys) pgpKeys.add(String(x.value).toLowerCase());
        for (const x of p.entities.telegrams) telegrams.add(String(x.value));
        for (const x of p.entities.emails) emails.add(String(x.value).toLowerCase());
        for (const x of p.entities.urls) urls.add(String(x.value));
        for (const x of p.entities.onions) onions.add(String(x.value));
        for (const x of p.entities.jabbers) jabbers.add(String(x.value).toLowerCase());
      }
      const ts = g.posts.map((p) => p.ts).sort();
      actor = {
        id: nextId('actor'),
        primaryHandle: g.author,
        aliases: [g.author],
        forums: [g.forum],
        firstSeen: ts[0],
        lastSeen: ts[ts.length - 1],
        risk: 'MEDIUM',
        riskScore: 0.6,
        attributionScore: 0,
        postCount: g.posts.length,
        fingerprint: fp,
        crypto,
        pgpKeys: [...pgpKeys],
        telegrams: [...telegrams],
        emails: [...emails],
        urls: [...urls],
        onions: [...onions],
        jabbers: [...jabbers],
        timezoneHistogram: tzHist,
        caseNote: null,
        benign: false,
        createdAt: new Date().toISOString(),
      };
      insertActor(actor);
      newActors.push(actor);
      known.set(g.author.toLowerCase(), actor);
    }
    involved.set(actor.id, actor);
    for (const p of g.posts) p.authorId = actor.id;
  }

  insertPosts(normalized);

  // ---- wallet registry + identity links ----
  for (const actor of involved.values()) {
    for (const w of actor.crypto || []) {
      const tags = [];
      const exch = detectExchange(`${actor.primaryHandle} ${w.value}`);
      if (exch) tags.push({ t: 'exchange', c: 0.85, w: exch });
      const addressId = upsertAddress({
        address: w.value, chain: w.chain, firstSeen: actor.firstSeen,
        lastSeen: actor.lastSeen, postCount: actor.postCount, tags,
      });
      linkAddressActor(addressId, actor.id);
    }
  }

  // ---- cross-identity links against the existing corpus ----
  const involvedIds = new Set(involved.keys());
  const others = listActors().filter((a) => !involvedIds.has(a.id));
  const dedupe = new Set(listLinks().map((l) => `${l.source}|${l.target}|${l.type}|${l.via}`));
  let newLinks = 0;
  const pairs = [['crypto', 'CRYPTO', 0.9, (x) => `${x.chain}:${String(x.value).toLowerCase()}`],
    ['pgpKeys', 'PGP', 0.95, (x) => String(x).toLowerCase()],
    ['telegrams', 'TELEGRAM', 0.9, (x) => String(x).toLowerCase()],
    ['emails', 'EMAIL', 0.85, (x) => String(x).toLowerCase()]];

  for (const a of involved.values()) {
    for (const b of others) {
      for (const [field, type, weight, norm] of pairs) {
        const setA = new Set((a[field] || []).map(norm));
        for (const item of b[field] || []) {
          const v = norm(item);
          if (!setA.has(v)) continue;
          const key = `${a.id}|${b.id}|${type}|${v}`;
          if (dedupe.has(key)) continue;
          dedupe.add(key);
          insertLink({ source: a.id, target: b.id, type, weight, via: v });
          newLinks += 1;
        }
      }
    }
  }

  const entities = {
    crypto: normalized.reduce((a, p) => a + p.entities.crypto.length, 0),
    pgp: normalized.reduce((a, p) => a + p.entities.pgpKeys.length, 0),
    telegrams: normalized.reduce((a, p) => a + p.entities.telegrams.length, 0),
    emails: normalized.reduce((a, p) => a + p.entities.emails.length, 0),
    urls: normalized.reduce((a, p) => a + p.entities.urls.length, 0),
  };

  insertRun({
    id: runId,
    at: new Date().toISOString(),
    sourceForum,
    format: opts.format || 'json',
    postsParsed: normalized.length,
    authorsFound: authorMap.size,
    extractionMs: Date.now() - t0,
    status: 'complete',
    entities,
  });

  appendAudit({
    actor: opts.user || 'system',
    action: 'INGEST_COMPLETE',
    detail: `${normalized.length} posts · ${newActors.length} new identities · ${newLinks} cross-links · run ${runId}`,
  });

  return {
    runId,
    posts: normalized.length,
    authors: authorMap.size,
    newActors: newActors.length,
    newActorHandles: newActors.map((a) => a.primaryHandle),
    newLinks,
    entities,
    ms: Date.now() - t0,
  };
}

export function saveUpload(buffer, fileName) {
  const dir = path.join(dataDir, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safe = path.basename(fileName).replace(/[^\w.\-]/g, '_');
  const filePath = path.join(dir, `${Date.now()}_${safe}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function ingestPath(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
