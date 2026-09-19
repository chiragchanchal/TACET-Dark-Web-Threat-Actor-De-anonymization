import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  nextId, listActors, getActor, insertActor, updateActor, postsForActor, listLinks, appendAudit,
} from '../db.js';
import { fingerprint } from '../services/stylometry.js';
import { attributionCandidates } from '../services/attribution.js';

export default function actorsRouter() {
  const r = Router();

  r.get('/', requireAuth, (req, res) => {
    const { q, risk, forum, sort, benign } = req.query;
    const list = listActors({ q, risk, forum, benign });

    // link counts straight from the links table (real relational query)
    const linkCounts = new Map();
    for (const l of listLinks()) {
      linkCounts.set(l.source, (linkCounts.get(l.source) || 0) + 1);
      linkCounts.set(l.target, (linkCounts.get(l.target) || 0) + 1);
    }

    if ((sort || '-score') === 'score') list.reverse();

    res.json(list.map((a) => ({
      id: a.id,
      handle: a.primaryHandle,
      aliases: a.aliases?.length || 0,
      forums: a.forums || [],
      firstSeen: a.firstSeen,
      risk: a.risk,
      attributionScore: Math.round(a.attributionScore || 0),
      postCount: a.postCount,
      cryptoCount: a.crypto?.length || 0,
      pgpCount: a.pgpKeys?.length || 0,
      links: linkCounts.get(a.id) || 0,
      benign: !!a.benign,
    })));
  });

  r.get('/:id', requireAuth, (req, res) => {
    const actor = getActor(req.params.id);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });

    const posts = postsForActor(actor.id).map((p) => ({
      id: p.id, forum: p.forum, author: p.author, title: p.title,
      content: p.content?.slice(0, 500), sig: p.sig, ts: p.ts, sha256: p.sha256, entities: p.entities,
    }));
    const candidates = attributionCandidates(actor, 8);

    // trim the fingerprint vector for transport (keep stats + shingles)
    let fp = actor.fingerprint;
    if (fp) fp = { ...fp, vector: (fp.vector || []).slice(0, 6).concat('…') };

    res.json({ ...actor, attributionScore: Math.round(actor.attributionScore || 0), posts, candidates, fingerprint: fp });
  });

  r.post('/', requireAuth, (req, res) => {
    const { primaryHandle, aliases, forums, risk, notes } = req.body || {};
    if (!primaryHandle) return res.status(400).json({ error: 'primaryHandle required' });

    const actor = {
      id: nextId('actor'),
      primaryHandle,
      aliases: aliases || [],
      forums: forums || [],
      risk: risk || 'MEDIUM',
      riskScore: { LOW: 0.34, MEDIUM: 0.6, HIGH: 0.82, CRITICAL: 0.96 }[risk] ?? 0.5,
      attributionScore: 0,
      postCount: 0,
      crypto: [], pgpKeys: [], telegrams: [], emails: [], urls: [], onions: [], jabbers: [],
      timezoneHistogram: {},
      fingerprint: null,
      benign: false,
      caseNote: notes || null,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    insertActor(actor);
    appendAudit({ actor: req.user.username, action: 'ACTOR_CREATED', detail: `Identity ${primaryHandle}` });
    res.status(201).json(actor);
  });

  // Recompute the stylometric fingerprint from the identity's stored posts.
  r.post('/:id/fingerprint', requireAuth, (req, res) => {
    const actor = getActor(req.params.id);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    const posts = postsForActor(actor.id);
    const fp = fingerprint(posts);
    if (fp) {
      actor.fingerprint = { ...fp, corpusShingles: fp.corpusShingles.slice(0, 250) };
      actor.postCount = posts.length;
      updateActor(actor);
      appendAudit({ actor: req.user.username, action: 'FINGERPRINT_RECOMPUTED', detail: `${actor.primaryHandle}: ${posts.length} docs` });
    }
    res.json({ ok: true, docs: posts.length, hasFingerprint: !!fp });
  });

  return r;
}