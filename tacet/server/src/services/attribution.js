// ---- weighted attribution engine ----
// Combines hard artifact matches, stylometric similarity, timezone
// histogram overlap and forum proximity into a single attribution score.

import { listActors } from '../db.js';
import { fingerprintSimilarity } from './stylometry.js';
import { config } from '../config.js';

const W = config.attributionWeights;

function timeHist(actor) {
  const hist = actor.timezoneHistogram || {};
  const total = Object.values(hist).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const k in hist) out[k] = hist[k] / total;
  return out;
}

function overlap(a, b) {
  let s = 0;
  for (const k in a) if (b[k]) s += Math.min(a[k], b[k]);
  return s;
}

/** Coerce any stored artifact (string or {value}) to a lowercase string. */
function norm(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.toLowerCase();
  if (typeof v === 'object') return String(v.value ?? v.address ?? v.keyId ?? '').toLowerCase();
  return String(v).toLowerCase();
}

export function artifactScore(a, b) {
  let hits = 0; const details = [];
  const push = (kind, value, weight) => { hits += weight; details.push({ kind, value, weight }); };
  // crypto address reuse
  const addrsA = new Set((a.crypto || []).map((x) => norm(x.chain ? `${x.chain}:${x.value}` : x)));
  const addrsB = new Set((b.crypto || []).map((x) => norm(x.chain ? `${x.chain}:${x.value}` : x)));
  for (const k of addrsA) if (addrsB.has(k)) push('CRYPTO', k.split(':').slice(1).join(':'), 1);
  // pgp key reuse
  const pgpA = new Set((a.pgpKeys || []).map(norm).filter(Boolean));
  const pgpB = new Set((b.pgpKeys || []).map(norm).filter(Boolean));
  for (const k of pgpA) if (pgpB.has(k)) push('PGP', k, 1);
  // telegram/jabber handle reuse
  for (const kind of ['telegrams', 'jabbers']) {
    const sA = new Set((a[kind] || []).map(norm).filter(Boolean));
    const sB = new Set((b[kind] || []).map(norm).filter(Boolean));
    for (const k of sA) if (sB.has(k)) push(kind.slice(0, -1).toUpperCase(), k, 1);
  }
  // email
  const eA = new Set((a.emails || []).map(norm).filter(Boolean));
  const eB = new Set((b.emails || []).map(norm).filter(Boolean));
  for (const k of eA) if (eB.has(k)) push('EMAIL', k, 0.9);
  return { score: Math.min(1, hits), hits: details.length, details };
}

export function styleScore(a, b) {
  return fingerprintSimilarity(a.fingerprint, b.fingerprint);
}

export function tzScore(a, b) {
  return overlap(timeHist(a), timeHist(b));
}

/** Compute a full attribution analysis between two actor identities. */
export function attributionBetween(a, b) {
  const artifacts = artifactScore(a, b);
  const style = styleScore(a, b);
  const tz = tzScore(a, b);

  const raw = W.artifact * artifacts.score + W.style * style + W.timezone * tz;
  // evidence-count dampening: only style alone → lower confidence
  const evidenceCount = artifacts.hits + (style > 0.6 ? 1 : 0);
  const confidence = evidenceCount ? raw * Math.min(1, 0.55 + 0.15 * evidenceCount) : raw * 0.35;
  const confidencePct = clamp(confidence * 100, 0, 99);

  return {
    confidence: confidencePct,
    components: {
      artifact: +artifacts.score.toFixed(3),
      style: +style.toFixed(3),
      timezone: +tz.toFixed(3),
    },
    artifactHits: artifacts.details,
    verdict: classify(confidencePct),
  };
}

export function comparePairs(actorA, actorB) {
  return attributionBetween(actorA, actorB);
}

export function classify(confidence) {
  if (confidence >= 75) return 'LIKELY_SAME_ACTOR';
  if (confidence >= 55) return 'PROBABLE_LINK';
  if (confidence >= 35) return 'WEAK_LINK';
  return 'INSUFFICIENT';
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

/** Re-score every candidate pair for one actor vs the whole corpus (top-k). */
export function attributionCandidates(actor, limit = 12) {
  const out = [];
  for (const other of listActors()) {
    if (other.id === actor.id) continue;
    out.push({ actorId: other.id, handle: other.primaryHandle, forum: other.forums?.[0], ...attributionBetween(actor, other) });
  }
  return out.sort((x, y) => y.confidence - x.confidence).slice(0, limit);
}
