// ---- deterministic demo corpus generator ----
// Builds a realistic synthetic Breached/Dread/Exploit corpus with
// planted cross-forum links: wallet reuse, PGP key reuse, handle reuse,
// stylistic twins, exchange references and clearweb bridges.
// Fully synthetic — no real actor data.

import {
  resetAll, insertActor, insertPosts, upsertAddress, linkAddressActor, insertLink,
  insertCase, appendAudit, nextId, ensureDataDir, sha256,
} from './db.js';
import { extractEntities } from './services/entities.js';
import { fingerprint } from './services/stylometry.js';
import { seedUsers } from './auth.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

// ---- REAL OFAC-designated threat-actor addresses ----
// Loaded from the US Treasury SDN list (ml/corpus-ofac/sanctioned_wallets_valid.json).
// Every address below is a genuine, publicly verifiable government designation
// (HYDRA Market, Blender.io, Garantex, SUEX OTC, Trickbot-linked individuals, …).
const OFAC_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ml/corpus-ofac/sanctioned_wallets_valid.json');
function loadOfac() {
  if (!fs.existsSync(OFAC_FILE)) return [];
  try {
    const rows = JSON.parse(fs.readFileSync(OFAC_FILE, 'utf8'));
    return rows.filter((w) => w.address && w.chain);
  } catch {
    return [];
  }
}

// deterministic PRNG (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FORUMS = ['breached', 'dread', 'exploit'];

// Genuine Base58Check (mainnet P2PKH) address generator — keeps demo wallets
// structurally valid so the crypto cluster view behaves credibly.
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function sha256d(buf) {
  return crypto.createHash('sha256').update(crypto.createHash('sha256').update(buf).digest()).digest();
}
function base58check(payload) {
  const bytes = Buffer.concat([payload, sha256d(payload).slice(0, 4)]);
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58[digits[i]];
  return out;
}
function makeLegacyAddress(n) {
  const h = crypto.createHash('sha256').update(`tacet-demo-wallet-${n}`).digest();
  return base58check(Buffer.concat([Buffer.from([0x00]), h.subarray(0, 20)]));
}

// Shared infrastructure between *different* actors, planted so the
// attribution engine has real cross-actor evidence (wallet reuse).
const SHARED_WALLETS = [
  { a: 'RansomLord', b: 'cartel_ops', chain: 'BTC', address: makeLegacyAddress(1) },
  { a: 'dumps4u', b: 'CVV-Team', chain: 'BTC', address: makeLegacyAddress(2) },
];

// persona corpus: each persona = one human author with N forum identities
const PERSONAS = [
  {
    id: 'p_ransomlord', name: 'RansomLord', style: 'loud',
    identities: [
      { forum: 'breached', handle: 'RansomLord', tone: 'shouty' },
      { forum: 'dread', handle: 'r1p_qu33n', tone: 'technical' },
      { forum: 'exploit', handle: 'RL-Operations', tone: 'salesy' },
    ],
    pgp: ['2A7B9F3C1E6D4A08'], btc: [makeLegacyAddress(10)], xmr: ['42x9kQm3vLpR8wZtN7cXyB2hJ6fD4sA1gE5uI0oP9qW7nM3vC8xK2jH6fG4dS1aQ9wE3rT5yU7iO0pL2mN8bV4cX6zZ1kA9jH3fD5gS7hJ2kW4mQ6nE8rT0yU1i'],
    telegram: ['rl_intel_desk'], emails: ['rl-ops@onionmail.org'], urls: ['https://github.com/rl-ops-tools'],
    risk: 'CRITICAL', caseNote: 'Ransomware affiliate ops lead — cross-links three market handles to one wallet cluster.',
  },
  {
    id: 'p_cartelops', name: 'cartel_ops', style: 'terse',
    identities: [
      { forum: 'breached', handle: 'cartel_ops', tone: 'terse' },
      { forum: 'exploit', handle: 'c-op', tone: 'terse' },
    ],
    pgp: ['C4D9E07A6B2F8C11'], btc: [makeLegacyAddress(11)], emails: ['co@cock.li'],
    telegram: ['cartel_ops_sec'], risk: 'CRITICAL',
  },
  {
    id: 'p_dumpseller', name: 'dumps4u', style: 'salesy',
    identities: [
      { forum: 'breached', handle: 'dumps4u', tone: 'salesy' },
      { forum: 'dread', handle: 'dumpz_king', tone: 'salesy' },
    ],
    pgp: ['9F3E81C4A0D7B25E'], btc: [makeLegacyAddress(12)], xmr: ['48d4uQm3vLpR8wZtN7cXyB2hJ6fD4sA1gE5uI0oP9qW7nM3vC8xK2jH6fG4dS1aQ9wE3rT5yU7iO0pL2mN8bV4cX6zZ1kA9jH3fD5gS7hJ2kW4mQ6nE8rT0yU1i'],
    telegram: ['dumps4u_support'], emails: ['sales@thesecure.biz'], urls: ['https://t.me/dumps4u_support'],
    risk: 'HIGH',
  },
  {
    id: 'p_otp_farm', name: 'OTP-Farm', style: 'technical',
    identities: [
      { forum: 'dread', handle: 'otp_farmer', tone: 'technical' },
      { forum: 'breached', handle: '0tp_F4rm', tone: 'technical' },
    ],
    pgp: ['B1E5A0C8D3F79261'], btc: [makeLegacyAddress(13)], telegram: ['otp_farm_bot'],
    risk: 'HIGH',
  },
  {
    id: 'p_mule', name: 'mule_runner', style: 'terse',
    identities: [{ forum: 'breached', handle: 'mule_runner', tone: 'terse' }],
    pgp: ['7D2F9C4A1B8E6305'], btc: [makeLegacyAddress(14)], risk: 'MEDIUM',
  },
  {
    id: 'p_leak_negotiator', name: 'Exfil-Negotiator', style: 'polite',
    identities: [{ forum: 'exploit', handle: 'Exfil-Negotiator', tone: 'polite' }],
    pgp: ['A8C41F7D0B2E9653'], btc: [makeLegacyAddress(15)], emails: ['negotiate@xmpp.jp'], risk: 'MEDIUM',
  },
  {
    id: 'p_crypto_ml', name: 'satoshi_mixer', style: 'terse',
    identities: [{ forum: 'dread', handle: 'satoshi_mixer', tone: 'terse' }],
    btc: [makeLegacyAddress(16)], xmr: ['4mix3rQm3vLpR8wZtN7cXyB2hJ6fD4sA1gE5uI0oP9qW7nM3vC8xK2jH6fG4dS1aQ9wE3rT5yU7iO0pL2mN8bV4cX6zZ1kA9jH3fD5gS7hJ2kW4mQ6nE8rT0yU1i'], risk: 'HIGH',
  },
  {
    id: 'p_rep_trader', name: 'trusted_escrow', style: 'polite',
    identities: [{ forum: 'dread', handle: 'trusted_escrow', tone: 'polite' }],
    emails: ['escrow@jabber.org'], btc: [makeLegacyAddress(17)], risk: 'LOW',
  },
  {
    id: 'p_carding_net', name: 'CVV-Team', style: 'salesy',
    identities: [{ forum: 'breached', handle: 'CVV-Team', tone: 'salesy' }, { forum: 'exploit', handle: 'cvv_bazaar', tone: 'salesy' }],
    pgp: ['E6B29D1F0A7C4385'], btc: [makeLegacyAddress(18)], telegram: ['cvv_bazaar_chat'], risk: 'HIGH',
  },
  {
    id: 'p_security_researcher', name: 'white_hat_watcher', style: 'academic',
    identities: [{ forum: 'dread', handle: 'watchdog_research', tone: 'academic' }],
    emails: ['research@protonmail.com'], urls: ['https://github.com/dfir-notebooks'], btc: [makeLegacyAddress(19)], risk: 'LOW', benign: true,
  },
];

const SNIPPETS = {
  shouty: [
    'FULL ACCESS TO THE CORE PANEL IS UP FOR GRABS. DO NOT SLEEP ON THIS ONE.',
    'PM ME ON TELEGRAM ONLY. NO NEWBIES. NO REPS. NO EXCUSES.',
    'CLIENT DB 2025 FRESH HIT, 900K ROWS, VERIFIED AT 92 PERCENT LIVE.',
    'THE LAST GUY WHO SCAMMED IN HERE GOT DOXXED. WE DO NOT FORGET.',
  ],
  technical: [
    'using the newer build the token validation is handled server-side, bypass via the session param on the mobile endpoint',
    'the wallet sweep script batches UTXOs under 0.001 to keep fees flat, then consolidates on the second hop',
    'if you chain the proxy with a tor exit the fingerprinting window drops to about 4 minutes per session',
    'decryption routine is standard AES-256-GCM, nonce is prefixed, key derived with argon2id default params',
  ],
  salesy: [
    'Fresh stock every 48 hours, replacement guarantee on dead bins, instant delivery after payment.',
    'Bulk buyers get a dedicated operator channel and priority resupply. Volume pricing on request.',
    'Every order includes a PGP-signed receipt so you know it wasn\u2019t touched in transit.',
    'Check my feedback thread — 300+ confirmed transactions since last summer, zero chargebacks.',
  ],
  terse: [
    'hit me on jabber. escrow only.',
    'price firm. no lowballs. split halves.',
    'check sig. same key since 2021.',
    'sent. confirm and delete thread.',
  ],
  polite: [
    'Thank you for the introduction. I will review the documentation and revert within the day.',
    'I would appreciate confirmation that the escrow terms are agreeable before we proceed further.',
    'Noted with thanks — I will keep this thread updated as the matter progresses.',
    'If it is not too much trouble, could we move further discussion to a private channel?',
  ],
  academic: [
    'Our monitoring notes that the infrastructure pattern here resembles the 2023 takedown family.',
    'This appears to be a coordinated cluster; the certificate reuse is statistically improbable by chance.',
    'I publish sanitized indicators on my public repository for defenders — attribution remains speculative.',
    'The timezone histogram suggests primary activity between 18:00–23:00 UTC, consistent with prior reports.',
  ],
};

const TOPICS = [
  'database dump', 'access broker', 'ransom deployment', 'carding stock', 'crypto tumbler', 'escrow terms',
  'infrastructure', 'phishing kit', 'zero-day listing', 'money movement', 'market feedback', 'opsec review',
  'bulletproof hosting', 'identity docs', 'exchange cashout', 'bulk SMS', 'credential stuffing', 'domain panels',
];

function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

function makePost(r, persona, identity, idx) {
  const tone = persona.style;
  const base = pick(r, SNIPPETS[tone] || SNIPPETS.technical);
  const topic = pick(r, TOPICS);
  let content = base;
  if (r() < 0.35) content = `${topic}: ${base}`;
  if (r() < 0.3) content += `\n\n${pick(r, ['DM for sample pack.', 'Escrow via trusted mods only.', 'Posting history speaks for itself.', 'References available on request.'])}`;

  // signature line: sometimes wallet / pgp / telegram refs
  let sig = '';
  const sigChoices = [];
  if (persona.btc && r() < 0.8) sigChoices.push(`${persona.btc}`);
  if (persona.xmr && r() < 0.5) sigChoices.push(`XMR: ${persona.xmr}`);
  if (persona.pgp && r() < 0.55) sigChoices.push(`PGP: 0x${persona.pgp[0]}`);
  if (persona.telegram && r() < 0.65) sigChoices.push(`TG: @${persona.telegram[0]}`);
  if (persona.emails && r() < 0.35) sigChoices.push(`${persona.emails[0]}`);
  sig = sigChoices.join('  |  ');

  return {
    id: nextId('post'),
    forum: identity.forum,
    author: identity.handle,
    title: idx === 0 ? topic : '',
    content,
    sig,
    ts: isoTime(r, persona.id, idx),
    runId: 'seed',
  };
}

function isoTime(r, seed, idx) {
  const base = Date.UTC(2025, Math.floor(r() * 11), 1 + Math.floor(r() * 27));
  // keep same persona in same hour-band to form a timezone histogram
  const hourBias = (seed.charCodeAt(2) + idx * 7) % 24;
  const d = new Date(base + hourBias * 3600e3 + idx * 3600e3 * 7);
  return d.toISOString();
}

/** Rebuild the actor store from the seed corpus (used by seed.js / reset). */
export function seedDemo() {
  ensureDataDir();
  resetAll();
  const actors = [];
  const addresses = [];
  const links = [];
  const r = rng(0x7AC3E7);
  seedUsers();

  const posts = [];
  for (const persona of PERSONAS) {
    const perPosts = [];
    for (const identity of persona.identities) {
      const n = 3 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const p = makePost(r, persona, identity, i);
        posts.push(p);
        perPosts.push(p);
      }
    }
    persona._posts = perPosts;
  }

  // ---- build actors with aggregated entity profile ----
  for (const persona of PERSONAS) {
    const corpus = persona._posts;
    const fp = fingerprint(corpus);
    const actorId = nextId('actor');

    const aliases = persona.identities.map((i) => i.handle);
    const forums = [...new Set(persona.identities.map((i) => i.forum))];
    const crypto = [];
    const addCrypto = (chain, value, weight) => { if (value) crypto.push({ chain, value, weight, firstSeen: corpus[0]?.ts }); };
    if (persona.btc) addCrypto('BTC', persona.btc[0], 0.9);
    if (persona.xmr) addCrypto('XMR', persona.xmr[0], 0.7);

    // PGP block could be a "subkey" style fingerprint: keep full 16 hex
    const pgpKeys = persona.pgp || [];

    // gather unique handles/urls/emails
    const telegrams = [...new Set(persona.telegram || [])];
    const emails = [...new Set(persona.emails || [])];
    const urls = [...new Set(persona.urls || [])];
    const onions = [];
    const jabbers = [];

    // timezone histogram from posts
    const tzHist = {};
    for (const p of corpus) {
      const h = new Date(p.ts).getUTCHours();
      tzHist[String(h).padStart(2, '0')] = (tzHist[String(h).padStart(2, '0')] || 0) + 1;
    }

    const firstTs = corpus.reduce((a, p) => (a && a <= p.ts ? a : p.ts), null);
    const lastTs = corpus.reduce((a, p) => (a && a >= p.ts ? a : p.ts), null);

    const riskRank = { CRITICAL: 0.96, HIGH: 0.82, MEDIUM: 0.6, LOW: 0.34 };
    const risk = persona.risk || 'MEDIUM';

    const actor = {
      id: actorId,
      primaryHandle: aliases[0],
      aliases,
      forums,
      firstSeen: firstTs || new Date().toISOString(),
      lastSeen: lastTs || new Date().toISOString(),
      risk,
      riskScore: riskRank[risk] ?? 0.5,
      attributionScore: 0, // filled by scoring pass
      postCount: corpus.length,
      fingerprint: fp ? { ...fp, corpusShingles: fp.corpusShingles.slice(0, 250) } : null,
      crypto, pgpKeys, telegrams, emails, urls, onions, jabbers,
      timezoneHistogram: tzHist,
      caseNote: persona.caseNote || null,
      benign: !!persona.benign,
      createdAt: new Date().toISOString(),
    };

    // assign post authorId
    for (const p of corpus) p.authorId = actorId;
    actors.push(actor);
  }

  // plant shared wallet reuse between distinct actor pairs
  for (const s of SHARED_WALLETS) {
    const A = actors.find((x) => x.primaryHandle === s.a);
    const B = actors.find((x) => x.primaryHandle === s.b);
    if (!A || !B) continue;
    const w = { chain: s.chain, value: s.address, weight: 0.85, firstSeen: A.firstSeen };
    for (const actor of [A, B]) {
      if (!actor.crypto.some((c) => c.chain === w.chain && c.value.toLowerCase() === w.value.toLowerCase())) {
        actor.crypto.push(w);
      }
    }
  }

  // ---- REAL OFAC SDN registry as a first-class corpus object ----
  // Not a forum identity: a government-designation watchlist. Every wallet it
  // holds is a real US Treasury designation, verifiable at the SDN source.
  const ofacRows = loadOfac();
  if (ofacRows.length > 0) {
    const registry = {
      id: nextId('actor'),
      primaryHandle: 'OFAC-SDN-Registry',
      aliases: ['US-Treasury-SDN', 'sanctions-registry'],
      forums: ['ofac-sdn'],
      firstSeen: ofacRows[0].fetchedAt || new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      risk: 'CRITICAL',
      riskScore: 0.96,
      attributionScore: 0,
      postCount: 0,
      fingerprint: null,
      crypto: ofacRows.map((w) => ({ chain: w.chain, value: w.address, weight: 1.0, firstSeen: w.fetchedAt, entity: w.entity, program: w.program })),
      pgpKeys: [], telegrams: [], emails: [], urls: [], onions: [], jabbers: [],
      timezoneHistogram: {},
      caseNote: `Real OFAC SDN digital-currency designations: ${ofacRows.length} sanctioned addresses across ${new Set(ofacRows.map((w) => w.chain)).size} chains (HYDRA Market, Blender.io, Garantex, SUEX OTC, …). Source: US Treasury SDN list.`,
      benign: true,
      createdAt: new Date().toISOString(),
    };
    actors.push(registry);
    appendAudit({
      actor: 'seed',
      action: 'SANCTIONS_REGISTRY_SEEDED',
      detail: `Imported ${ofacRows.length} real OFAC-designated addresses as the watchlist layer`,
    });
  }

  // ---- populate crypto address registry + actor links ----
  for (const actor of actors) {
    for (const w of actor.crypto || []) {
      let rec = addresses.find((a) => a.chain === w.chain && a.address.toLowerCase() === w.value.toLowerCase());
      if (!rec) {
        rec = { address: w.value, chain: w.chain, label: null, tags: [], firstSeen: actor.firstSeen, lastSeen: actor.lastSeen, postCount: 0, actorIds: [] };
        addresses.push(rec);
      }
      if (!rec.actorIds.includes(actor.id)) rec.actorIds.push(actor.id);
      rec.postCount += actor.postCount;
      rec.lastSeen = rec.lastSeen > actor.lastSeen ? rec.lastSeen : actor.lastSeen;
      rec.tags = rec.tags || [];
      // mark exchange-like reference for the persona wallet clusters
      const lower = `${actor.primaryHandle} ${actor.caseNote || ''}`.toLowerCase();
      if (/binance|kraken|coinbase|exchange|okx|cashout|mixer/i.test(lower)) {
        const platform = /binance/i.test(lower) ? 'binance' : /kraken/i.test(lower) ? 'kraken' : /coinbase/i.test(lower) ? 'coinbase' : /okx/i.test(lower) ? 'okx' : 'exchange-cluster';
        if (!rec.tags.some((t) => t.t === 'exchange')) rec.tags.push({ t: 'exchange', c: 0.85, w: platform });
      }
    }
  }

  // ---- cross-actor links from entity reuse (used for graph edges + attribution scoring) ----
  const byType = new Map();
  const addLink = (a, b, type, weight, via) => {
    const key = [a, b, type, via].sort().join('|');
    if (byType.has(key)) return;
    byType.set(key, true);
    links.push({ source: a, target: b, type, weight, via });
  };

  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const A = actors[i]; const B = actors[j];
      const aC = new Set((A.crypto || []).map((x) => `${x.chain}:${x.value.toLowerCase()}`));
      const bC = new Set((B.crypto || []).map((x) => `${x.chain}:${x.value.toLowerCase()}`));
      for (const k of aC) if (bC.has(k)) addLink(A.id, B.id, 'CRYPTO', 0.9, k);
      const aP = new Set((A.pgpKeys || []).map((x) => x.toLowerCase()));
      const bP = new Set((B.pgpKeys || []).map((x) => x.toLowerCase()));
      for (const k of aP) if (bP.has(k)) addLink(A.id, B.id, 'PGP', 0.95, k);
      const aT = new Set((A.telegrams || []).map((x) => x.toLowerCase()));
      const bT = new Set((B.telegrams || []).map((x) => x.toLowerCase()));
      for (const k of aT) if (bT.has(k)) addLink(A.id, B.id, 'TELEGRAM', 0.9, k);
      const aE = new Set((A.emails || []).map((x) => x.toLowerCase()));
      const bE = new Set((B.emails || []).map((x) => x.toLowerCase()));
      for (const k of aE) if (bE.has(k)) addLink(A.id, B.id, 'EMAIL', 0.85, k);
    }
  }

  // ---- compute attribution score per actor (pairwise evidence) ----
  for (const actor of actors) {
    const hits = [];
    for (const l of links) {
      if (l.source === actor.id) hits.push(l);
      else if (l.target === actor.id) hits.push(l);
    }
    // stylistic similarity contribution (placeholder — exact scoring pass reuses attribution engine in routes)
    const linkScore = Math.min(1, hits.length * 0.3);
    const tzPeak = Math.max(...Object.values(actor.timezoneHistogram || { 0: 1 }));
    const tzScore = Math.min(1, tzPeak / Math.max(actor.postCount, 1) * 1.4);
    const fpConsistency = actor.fingerprint ? Math.min(1, actor.fingerprint.docCount / 8) : 0;
    actor.attributionScore = Math.min(99, Math.round(100 * Math.min(1, 0.45 * linkScore + 0.35 * Math.min(1, fpConsistency) + 0.2 * tzScore)));
    actor._linkCount = hits.length;
  }

  // ---- persist everything through SQL (FK order: actors -> posts -> addresses -> links -> cases) ----
  for (const actor of actors) insertActor(actor);
  insertPosts(posts.map((p) => ({
    ...p,
    sha256: sha256(`${p.forum}|${p.author}|${p.content}|${p.ts}`),
  })));
  for (const rec of addresses) {
    const addressId = upsertAddress({
      address: rec.address, chain: rec.chain, label: rec.label, firstSeen: rec.firstSeen,
      lastSeen: rec.lastSeen, postCount: rec.postCount, tags: rec.tags,
    });
    for (const actorId of rec.actorIds) linkAddressActor(addressId, actorId);
  }
  for (const l of links) insertLink(l);

  const caseObj = {
    id: nextId('case'),
    title: 'Case 2026-001 — RansomLord wallet & identity cluster',
    description: 'Correlate RansomLord market handles across Breached/Dread/Exploit with BTC/XMR wallet reuse and PGP key 2A7B…08. Objective: identify clearweb bridge and exchange cluster.',
    status: 'open',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    actorIds: actors.filter((a) => ['RansomLord', 'r1p_qu33n', 'RL-Operations', 'cartel_ops', 'c-op'].includes(a.primaryHandle)).map((a) => a.id),
    tags: ['wallet-cluster', 'ransomware', 'critical'],
    updatedAt: new Date().toISOString(),
  };
  insertCase(caseObj);

  appendAudit({
    actor: 'seed',
    action: 'SEED_CORPUS',
    detail: `Seeded ${actors.length} actors, ${posts.length} posts, ${addresses.length} addresses, ${links.length} cross-links`,
  });

  console.log(`Seeded TACET database: ${actors.length} actors · ${posts.length} posts · ${addresses.length} addresses · ${links.length} entity links · 1 case`);
  return { actors: actors.length, posts: posts.length, addresses: addresses.length, links: links.length };
}

// export extraction re-used by routes
export { extractEntities };

// Run directly: `npm run seed` in server/ (or `node src/seed.js`)
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  seedDemo();
  console.log('TACET demo corpus seeded successfully.');
}
