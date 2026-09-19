// ---- TACET data layer: SQLite (node:sqlite) ----
// Real relational database: explicit schema, foreign keys, indexes, WAL.
// All reads and writes go through SQL. The audit log is a SHA-256 hash chain,
// and every post/address/artifact carries an evidence hash for integrity checks.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.resolve(__dirname, '../data');
export const DB_PATH = process.env.TACET_DB || path.join(dataDir, 'tacet.db');

let conn = null;

export function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

export function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const up = path.join(dataDir, 'uploads');
  if (!fs.existsSync(up)) fs.mkdirSync(up, { recursive: true });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'analyst',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  primary_handle TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'LOW',
  risk_score REAL NOT NULL DEFAULT 0,
  attribution_score REAL NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT,
  last_seen TEXT,
  case_note TEXT,
  benign INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  fingerprint TEXT,
  timezone_hist TEXT,
  inventory_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_actors_risk ON actors(risk);
CREATE INDEX IF NOT EXISTS idx_actors_score ON actors(attribution_score DESC);
CREATE INDEX IF NOT EXISTS idx_actors_handle ON actors(primary_handle);

CREATE TABLE IF NOT EXISTS actor_aliases (
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  PRIMARY KEY (actor_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_alias ON actor_aliases(alias);

CREATE TABLE IF NOT EXISTS actor_forums (
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  forum TEXT NOT NULL,
  PRIMARY KEY (actor_id, forum)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  forum TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  sig TEXT DEFAULT '',
  ts TEXT,
  sha256 TEXT NOT NULL,
  entities TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_forum ON posts(forum);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_ts ON posts(ts DESC);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  label TEXT,
  first_seen TEXT,
  last_seen TEXT,
  post_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT DEFAULT '[]',
  sha256 TEXT NOT NULL,
  UNIQUE (chain, address)
);
CREATE INDEX IF NOT EXISTS idx_addr_chain ON addresses(chain);

CREATE TABLE IF NOT EXISTS address_actors (
  address_id TEXT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  PRIMARY KEY (address_id, actor_id)
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  source_actor TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  target_actor TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  weight REAL NOT NULL,
  via TEXT,
  created_at TEXT,
  UNIQUE (source_actor, target_actor, type, via)
);
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_actor);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_actor);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT,
  created_by TEXT,
  updated_at TEXT,
  tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS case_actors (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  PRIMARY KEY (case_id, actor_id)
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  at TEXT,
  source_forum TEXT,
  format TEXT,
  posts_parsed INTEGER DEFAULT 0,
  authors_found INTEGER DEFAULT 0,
  extraction_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'complete',
  entities TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(id DESC);

CREATE TABLE IF NOT EXISTS chain_cache (
  id TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- Real OFAC-designated digital currency addresses (US Treasury SDN list)
CREATE TABLE IF NOT EXISTS sanctions (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  entity TEXT,
  program TEXT,
  ent_num TEXT,
  sdn_type TEXT,
  source TEXT,
  source_url TEXT,
  fetched_at TEXT,
  UNIQUE (chain, address)
);
CREATE INDEX IF NOT EXISTS idx_sanctions_addr ON sanctions(chain, address);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

export function openDb() {
  ensureDataDir();
  if (!conn) {
    conn = new DatabaseSync(DB_PATH);
    conn.exec('PRAGMA journal_mode = WAL;');
    conn.exec('PRAGMA foreign_keys = ON;');
    conn.exec(SCHEMA);
  }
  return conn;
}

export function closeDb() {
  if (conn) { conn.close(); conn = null; }
}

export function all(sql, params = []) { return openDb().prepare(sql).all(...params); }
export function get(sql, params = []) { return openDb().prepare(sql).get(...params); }
export function run(sql, params = []) { return openDb().prepare(sql).run(...params); }

export function tx(fn) {
  const c = openDb();
  c.exec('BEGIN');
  try {
    const out = fn(c);
    c.exec('COMMIT');
    return out;
  } catch (e) {
    c.exec('ROLLBACK');
    throw e;
  }
}

export function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function jsonParse(s, fallback) {
  if (s === null || s === undefined) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

// ------------------------------ audit chain ------------------------------

export function appendAudit(entry) {
  const at = new Date().toISOString();
  const last = get('SELECT hash FROM audit ORDER BY id DESC LIMIT 1');
  const prev = last ? last.hash : '';
  const payload = `${prev}|${at}|${entry.actor || 'system'}|${entry.action}|${entry.detail || ''}`;
  const hash = sha256(payload);
  run('INSERT INTO audit (at, actor, action, detail, hash, prev_hash) VALUES (?,?,?,?,?,?)',
    [at, entry.actor || 'system', entry.action, entry.detail || '', hash, prev]);
  return { at, hash, prev_hash: prev };
}

export function listAudit(limit = 100, action = null) {
  const rows = action
    ? all('SELECT * FROM audit WHERE action = ? ORDER BY id DESC LIMIT ?', [action, limit])
    : all('SELECT * FROM audit ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map((r) => ({ id: String(r.id), at: r.at, actor: r.actor, action: r.action, detail: r.detail, hash: r.hash, prev_hash: r.prev_hash }));
}

/** Recompute the whole SHA-256 chain; used to prove tamper-evidence. */
export function verifyAuditChain() {
  const rows = all('SELECT * FROM audit ORDER BY id ASC');
  let prev = '';
  for (const r of rows) {
    if (r.prev_hash !== prev) return { valid: false, brokenAt: r.id, reason: 'prev_hash mismatch' };
    const payload = `${r.prev_hash}|${r.at}|${r.actor}|${r.action}|${r.detail || ''}`;
    if (sha256(payload) !== r.hash) return { valid: false, brokenAt: r.id, reason: 'hash mismatch' };
    prev = r.hash;
  }
  return { valid: true, count: rows.length, head: prev };
}

// ------------------------------ actors ------------------------------

function hydrateActor(row) {
  if (!row) return null;
  const inv = jsonParse(row.inventory_json, {});
  return {
    id: row.id,
    primaryHandle: row.primary_handle,
    aliases: all('SELECT alias FROM actor_aliases WHERE actor_id = ?', [row.id]).map((r) => r.alias),
    forums: all('SELECT forum FROM actor_forums WHERE actor_id = ?', [row.id]).map((r) => r.forum),
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    risk: row.risk,
    riskScore: row.risk_score,
    attributionScore: row.attribution_score,
    postCount: row.post_count,
    fingerprint: jsonParse(row.fingerprint, null),
    crypto: inv.crypto || [],
    pgpKeys: inv.pgpKeys || [],
    telegrams: inv.telegrams || [],
    emails: inv.emails || [],
    urls: inv.urls || [],
    onions: inv.onions || [],
    jabbers: inv.jabbers || [],
    timezoneHistogram: jsonParse(row.timezone_hist, {}),
    caseNote: row.case_note,
    benign: !!row.benign,
    createdAt: row.created_at,
  };
}

export function listActors({ q: search, risk, forum, benign } = {}) {
  let sql = 'SELECT * FROM actors WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (primary_handle LIKE ? OR id IN (SELECT actor_id FROM actor_aliases WHERE alias LIKE ?))';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (risk) { sql += ' AND risk = ?'; params.push(risk); }
  if (forum) { sql += ' AND id IN (SELECT actor_id FROM actor_forums WHERE forum = ?)'; params.push(forum); }
  if (benign === 'false') sql += ' AND benign = 0';
  if (benign === 'true') sql += ' AND benign = 1';
  sql += ' ORDER BY attribution_score DESC';
  return all(sql, params).map(hydrateActor);
}

export function getActor(id) { return hydrateActor(get('SELECT * FROM actors WHERE id = ?', [id])); }
export function countActors() { return get('SELECT COUNT(*) c FROM actors').c; }

export function insertActor(a) {
  tx((c) => {
    c.prepare(`INSERT INTO actors (id, primary_handle, risk, risk_score, attribution_score, post_count, first_seen, last_seen, case_note, benign, created_at, fingerprint, timezone_hist, inventory_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(a.id, a.primaryHandle, a.risk || 'LOW', a.riskScore || 0, a.attributionScore || 0, a.postCount || 0,
        a.firstSeen || null, a.lastSeen || null, a.caseNote || null, a.benign ? 1 : 0,
        a.createdAt || new Date().toISOString(),
        a.fingerprint ? JSON.stringify(a.fingerprint) : null,
        JSON.stringify(a.timezoneHistogram || {}),
        JSON.stringify({
          crypto: a.crypto || [], pgpKeys: a.pgpKeys || [], telegrams: a.telegrams || [],
          emails: a.emails || [], urls: a.urls || [], onions: a.onions || [], jabbers: a.jabbers || [],
        }));
    const ia = c.prepare('INSERT OR IGNORE INTO actor_aliases (actor_id, alias) VALUES (?,?)');
    for (const al of a.aliases || []) ia.run(a.id, al);
    const ifo = c.prepare('INSERT OR IGNORE INTO actor_forums (actor_id, forum) VALUES (?,?)');
    for (const f of a.forums || []) ifo.run(a.id, f);
  });
}

export function updateActor(a) {
  run(`UPDATE actors SET primary_handle=?, risk=?, risk_score=?, attribution_score=?, post_count=?, first_seen=?, last_seen=?, case_note=?, benign=?, fingerprint=?, timezone_hist=?, inventory_json=? WHERE id=?`,
    [a.primaryHandle, a.risk, a.riskScore || 0, a.attributionScore || 0, a.postCount || 0,
      a.firstSeen || null, a.lastSeen || null, a.caseNote || null, a.benign ? 1 : 0,
      a.fingerprint ? JSON.stringify(a.fingerprint) : null,
      JSON.stringify(a.timezoneHistogram || {}),
      JSON.stringify({
        crypto: a.crypto || [], pgpKeys: a.pgpKeys || [], telegrams: a.telegrams || [],
        emails: a.emails || [], urls: a.urls || [], onions: a.onions || [], jabbers: a.jabbers || [],
      }),
      a.id]);
}

// ------------------------------ posts ------------------------------

export function insertPosts(posts) {
  tx((c) => {
    const ins = c.prepare(`INSERT OR REPLACE INTO posts (id, run_id, forum, author, author_id, title, content, sig, ts, sha256, entities) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of posts) {
      ins.run(p.id, p.runId || null, p.forum, p.author, p.authorId || null, p.title || '', p.content, p.sig || '',
        p.ts || null, p.sha256 || sha256(`${p.forum}|${p.author}|${p.content}`), p.entities ? JSON.stringify(p.entities) : null);
    }
  });
}

export function listPosts({ q: search, forum, author, actorId, limit = 50, offset = 0 } = {}) {
  let where = ' WHERE 1=1';
  const params = [];
  if (search) { where += ' AND (content LIKE ? OR title LIKE ? OR author LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (forum) { where += ' AND forum = ?'; params.push(forum); }
  if (author) { where += ' AND lower(author) = lower(?)'; params.push(author); }
  if (actorId) { where += ' AND author_id = ?'; params.push(actorId); }
  const total = get(`SELECT COUNT(*) c FROM posts${where}`, params).c;
  const rows = all(`SELECT * FROM posts${where} ORDER BY ts DESC LIMIT ? OFFSET ?`, [...params, Number(limit) || 50, Number(offset) || 0]);
  return { total, posts: rows.map(hydratePost) };
}

export function hydratePost(r) {
  return {
    id: r.id, runId: r.run_id, forum: r.forum, author: r.author, authorId: r.author_id,
    title: r.title, content: r.content, sig: r.sig, ts: r.ts, sha256: r.sha256,
    entities: jsonParse(r.entities, {}),
  };
}

export function getPost(id) {
  const r = get('SELECT * FROM posts WHERE id = ?', [id]);
  return r ? hydratePost(r) : null;
}

export function countPosts() { return get('SELECT COUNT(*) c FROM posts').c; }

export function postsForActor(actorId, limit = 200) {
  return all('SELECT * FROM posts WHERE author_id = ? ORDER BY ts DESC LIMIT ?', [actorId, limit]).map(hydratePost);
}

export function forumCounts() {
  return all('SELECT forum, COUNT(*) c FROM posts GROUP BY forum ORDER BY c DESC').map((r) => ({ name: r.forum, count: r.c }));
}

/** Real post volume over time (YYYY-MM buckets) for the dashboard timeline. */
export function postTimeline() {
  return all(`SELECT substr(ts, 1, 7) AS month, COUNT(*) c FROM posts
              WHERE ts IS NOT NULL AND ts != '' GROUP BY month ORDER BY month`)
    .map((r) => ({ month: r.month, count: r.c }));
}

// ------------------------------ addresses ------------------------------

export function upsertAddress(addr) {
  const existing = get('SELECT * FROM addresses WHERE chain = ? AND lower(address) = lower(?)', [addr.chain, addr.address]);
  if (existing) {
    run('UPDATE addresses SET last_seen = ?, post_count = post_count + ?, tags = ? WHERE id = ?',
      [addr.lastSeen || existing.last_seen, addr.postCount || 0, JSON.stringify(addr.tags || jsonParse(existing.tags, [])), existing.id]);
    return existing.id;
  }
  const id = addr.id || nextId('addr');
  run('INSERT INTO addresses (id, address, chain, label, first_seen, last_seen, post_count, tags, sha256) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, addr.address, addr.chain, addr.label || null, addr.firstSeen || null, addr.lastSeen || null,
      addr.postCount || 0, JSON.stringify(addr.tags || []), addr.sha256 || sha256(`${addr.chain}:${addr.address.toLowerCase()}`)]);
  return id;
}

export function linkAddressActor(addressId, actorId) {
  run('INSERT OR IGNORE INTO address_actors (address_id, actor_id) VALUES (?,?)', [addressId, actorId]);
}

export function listAddresses({ chain, q: search, limit = 200 } = {}) {
  let sql = `SELECT a.*, (SELECT COUNT(*) FROM address_actors aa WHERE aa.address_id = a.id) AS actor_count FROM addresses a WHERE 1=1`;
  const params = [];
  if (chain) { sql += ' AND a.chain = ?'; params.push(chain); }
  if (search) { sql += ' AND a.address LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY a.last_seen DESC LIMIT ?';
  params.push(limit);
  return all(sql, params).map((r) => ({
    id: r.id, address: r.address, chain: r.chain, label: r.label,
    firstSeen: r.first_seen, lastSeen: r.last_seen, postCount: r.post_count,
    tags: jsonParse(r.tags, []), sha256: r.sha256, actorCount: r.actor_count,
    actorIds: all('SELECT actor_id FROM address_actors WHERE address_id = ?', [r.id]).map((x) => x.actor_id),
  }));
}

export function getAddress(chain, address) {
  const r = get('SELECT * FROM addresses WHERE chain = ? AND lower(address) = lower(?)', [chain, address]);
  if (!r) return null;
  return {
    id: r.id, address: r.address, chain: r.chain, label: r.label,
    firstSeen: r.first_seen, lastSeen: r.last_seen, postCount: r.post_count,
    tags: jsonParse(r.tags, []), sha256: r.sha256,
    actorIds: all('SELECT actor_id FROM address_actors WHERE address_id = ?', [r.id]).map((x) => x.actor_id),
  };
}

export function addressesForActor(actorId) {
  return all(`SELECT a.* FROM addresses a JOIN address_actors aa ON aa.address_id = a.id WHERE aa.actor_id = ?`, [actorId])
    .map((r) => ({ address: r.address, chain: r.chain, label: r.label, firstSeen: r.first_seen, lastSeen: r.last_seen, postCount: r.post_count, tags: jsonParse(r.tags, []) }));
}

export function countAddresses() { return get('SELECT COUNT(*) c FROM addresses').c; }

// ------------------------------ links ------------------------------

export function insertLink(l) {
  run('INSERT OR IGNORE INTO links (id, source_actor, target_actor, type, weight, via, created_at) VALUES (?,?,?,?,?,?,?)',
    [l.id || nextId('lnk'), l.source, l.target, l.type, l.weight, l.via || null, l.createdAt || new Date().toISOString()]);
}

export function listLinks() {
  return all('SELECT * FROM links').map((r) => ({
    id: String(r.id), source: r.source_actor, target: r.target_actor,
    type: r.type, weight: r.weight, via: r.via, createdAt: r.created_at,
  }));
}

export function countLinks() { return get('SELECT COUNT(*) c FROM links').c; }

// ------------------------------ cases ------------------------------

function hydrateCase(row) {
  if (!row) return null;
  return {
    id: row.id, title: row.title, description: row.description, status: row.status,
    createdAt: row.created_at, createdBy: row.created_by, updatedAt: row.updated_at,
    tags: jsonParse(row.tags, []),
    actorIds: all('SELECT actor_id FROM case_actors WHERE case_id = ?', [row.id]).map((r) => r.actor_id),
  };
}

export function listCases({ status } = {}) {
  const rows = status
    ? all('SELECT * FROM cases WHERE status = ? ORDER BY updated_at DESC', [status])
    : all('SELECT * FROM cases ORDER BY updated_at DESC');
  return rows.map(hydrateCase);
}

export function getCase(id) { return hydrateCase(get('SELECT * FROM cases WHERE id = ?', [id])); }

export function insertCase(c) {
  tx((conn2) => {
    conn2.prepare('INSERT INTO cases (id, title, description, status, created_at, created_by, updated_at, tags) VALUES (?,?,?,?,?,?,?,?)')
      .run(c.id, c.title, c.description || '', c.status || 'open',
        c.createdAt || new Date().toISOString(), c.createdBy || 'system',
        c.updatedAt || new Date().toISOString(), JSON.stringify(c.tags || []));
    const rel = conn2.prepare('INSERT OR IGNORE INTO case_actors (case_id, actor_id) VALUES (?,?)');
    for (const aid of c.actorIds || []) rel.run(c.id, aid);
  });
}

export function updateCaseStatus(id, status) {
  return run('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);
}

export function countCases() { return get('SELECT COUNT(*) c FROM cases').c; }

// ------------------------------ ingest runs ------------------------------

export function insertRun(r) {
  run('INSERT INTO ingest_runs (id, at, source_forum, format, posts_parsed, authors_found, extraction_ms, status, entities) VALUES (?,?,?,?,?,?,?,?,?)',
    [r.id, r.at || new Date().toISOString(), r.sourceForum, r.format, r.postsParsed || 0, r.authorsFound || 0,
      r.extractionMs || 0, r.status || 'complete', JSON.stringify(r.entities || {})]);
}

export function listRuns(limit = 50) {
  return all('SELECT * FROM ingest_runs ORDER BY at DESC LIMIT ?', [limit]).map((r) => ({
    id: r.id, at: r.at, sourceForum: r.source_forum, format: r.format,
    postsParsed: r.posts_parsed, authorsFound: r.authors_found,
    extractionMs: r.extraction_ms, status: r.status, entities: jsonParse(r.entities, {}),
  }));
}

export function countRuns() { return get('SELECT COUNT(*) c FROM ingest_runs').c; }

// ------------------------------ chain cache ------------------------------

export function cacheChainData(chain, address, data) {
  run('INSERT OR REPLACE INTO chain_cache (id, chain, address, data, fetched_at) VALUES (?,?,?,?,?)',
    [`${chain}:${address.toLowerCase()}`, chain, address, JSON.stringify(data), new Date().toISOString()]);
}

export function getCachedChainData(chain, address, maxAgeMs = 6 * 3600 * 1000) {
  const r = get('SELECT * FROM chain_cache WHERE id = ?', [`${chain}:${address.toLowerCase()}`]);
  if (!r) return null;
  const age = Date.now() - new Date(r.fetched_at).getTime();
  if (age > maxAgeMs) return null;
  return { data: jsonParse(r.data, null), fetchedAt: r.fetched_at };
}

// ------------------------------ OFAC sanctions registry ------------------------------

export function upsertSanction(w) {
  run(`INSERT OR REPLACE INTO sanctions (id, address, chain, entity, program, ent_num, sdn_type, source, source_url, fetched_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [`${w.chain}:${String(w.address).toLowerCase()}`, w.address, w.chain, w.entity || null,
      w.program || null, w.entNum || null, w.sdnType || null, w.source || null,
      w.sourceUrl || null, w.fetchedAt || new Date().toISOString()]);
}

export function countSanctions() { return get('SELECT COUNT(*) c FROM sanctions').c; }

export function findSanction(chain, address) {
  return get('SELECT * FROM sanctions WHERE chain = ? AND lower(address) = lower(?)', [chain, address]) || null;
}

export function listSanctions({ chain, q: search, limit = 200 } = {}) {
  let sql = 'SELECT * FROM sanctions WHERE 1=1';
  const params = [];
  if (chain) { sql += ' AND chain = ?'; params.push(chain); }
  if (search) {
    sql += ' AND (address LIKE ? OR entity LIKE ? OR program LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY entity LIMIT ?';
  params.push(limit);
  return all(sql, params).map((r) => ({
    address: r.address, chain: r.chain, entity: r.entity, program: r.program,
    entNum: r.ent_num, sdnType: r.sdn_type, source: r.source, sourceUrl: r.source_url, fetchedAt: r.fetched_at,
  }));
}

export function sanctionStats() {
  const rows = all('SELECT chain, COUNT(*) c FROM sanctions GROUP BY chain ORDER BY c DESC');
  const byChain = {};
  for (const r of rows) byChain[r.chain] = r.c;
  const entities = get('SELECT COUNT(DISTINCT entity) c FROM sanctions').c;
  return { total: countSanctions(), entities, byChain };
}

// ------------------------------ meta / stats ------------------------------

export function setMeta(key, value) { run('INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)', [key, String(value)]); }
export function getMeta(key) { const r = get('SELECT value FROM meta WHERE key = ?', [key]); return r ? r.value : null; }

export function stats() {
  return {
    actors: countActors(), posts: countPosts(), addresses: countAddresses(),
    links: countLinks(), cases: countCases(), ingestRuns: countRuns(),
    audit: get('SELECT COUNT(*) c FROM audit').c,
    sanctions: countSanctions(),
  };
}

export function resetAll() {
  tx((c) => {
    c.exec(`DELETE FROM address_actors; DELETE FROM addresses; DELETE FROM posts; DELETE FROM actor_forums;
            DELETE FROM actor_aliases; DELETE FROM actors; DELETE FROM case_actors; DELETE FROM cases;
            DELETE FROM links; DELETE FROM ingest_runs; DELETE FROM audit; DELETE FROM chain_cache;`);
  });
}

// users (kept here so the whole data layer is one module)
export function findUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]) || null;
}
export function insertUser(u) {
  run('INSERT OR REPLACE INTO users (id, username, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)',
    [u.id, u.username, u.passwordHash, u.name, u.role, u.createdAt || new Date().toISOString()]);
}
export function countUsers() { return get('SELECT COUNT(*) c FROM users').c; }