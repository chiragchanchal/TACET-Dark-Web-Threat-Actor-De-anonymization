// ---- deep stylometry engine ----
// Builds per-author fingerprints from posts, compares authors via
// char-shingle + lexical metrics (cosine over the numeric vector + a
// shingle Jaccard boost), and clusters fragmented identities.

import { profile, vectorize, cosine, charShingles } from './nlp.js';
import { config } from '../config.js';

/** Compute the stylometric fingerprint for one author corpus. */
export function fingerprint(posts) {
  const docs = posts.filter((p) => p.content && p.content.trim().length > 30);
  if (!docs.length) return null;

  // whole-corpus profile dominates; shingle-level variance adds robustness
  const corpusText = docs.map((d) => d.content).join('\n');
  const corpusProf = profile(corpusText);
  const vectors = docs.slice(0, 80).map((d) => vectorize(profile(d.content)));
  const sum = new Array(vectors[0].length).fill(0);
  for (const v of vectors) for (let i = 0; i < v.length; i++) sum[i] += v[i] / vectors.length;
  const vector = sum;

  const corpusShingles = charShingles(corpusText, 5);

  return {
    vector,
    corpusShingles: Array.from(corpusShingles.entries()).slice(0, 250),
    profile: corpusProf,
    docCount: docs.length,
    createdAt: new Date().toISOString(),
  };
}

export function fingerprintSimilarity(a, b) {
  if (!a || !b) return 0;
  const vecSim = cosine(a.vector, b.vector);
  // shingle overlap (Jaccard) between the two corpora
  const ma = new Map(a.corpusShingles || []);
  const mb = new Map(b.corpusShingles || []);
  let inter = 0;
  for (const [k] of ma) if (mb.has(k)) inter += Math.min(ma.get(k), mb.get(k));
  const union = ma.size + mb.size - inter;
  const jac = union ? inter / union : 0;
  // combined: weighted — vector similarity is primary, shingle boosts agreement
  return Math.min(1, vecSim * 0.8 + jac * 0.4);
}

/**
 * Cluster actors into identity groups by pairwise fingerprint similarity.
 * Uses union-find over a similarity graph with a configurable threshold.
 * Returns [{ actorA, actorB, similarity, link }] plus merged group labels.
 */
export function clusterByStyle(actors, { threshold = config.stylometry.clusterThreshold } = {}) {
  const ids = actors.map((a) => a.id);
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => parent.set(find(a), find(b));

  const edges = [];
  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i];
      const b = actors[j];
      if (!a.fingerprint || !b.fingerprint) continue;
      const sim = fingerprintSimilarity(a.fingerprint, b.fingerprint);
      if (sim >= threshold) {
        edges.push({ actorId: a.id, otherId: b.id, similarity: sim });
        union(a.id, b.id);
      }
    }
  }

  const groups = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }

  const result = { edges, clusters: Array.from(groups.values()).filter((g) => g.length > 1) };
  return result;
}
