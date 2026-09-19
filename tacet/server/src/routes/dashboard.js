import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { listActors, listLinks, forumCounts, stats, listAudit, postTimeline } from '../db.js';
import { summarize as cryptoSummary } from '../services/crypto.js';

export default function dashboardRouter() {
  const r = Router();

  r.get('/', requireAuth, (req, res) => {
    const actors = listActors();
    const links = listLinks();
    const s = stats();

    const riskDist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of actors) if (riskDist[a.risk] !== undefined) riskDist[a.risk] += 1;

    const cSum = cryptoSummary();
    const byId = new Map(actors.map((a) => [a.id, a.primaryHandle]));

    const recentLinks = links.slice(-10).map((l) => ({
      id: l.id,
      source: byId.get(l.source) || l.source,
      target: byId.get(l.target) || l.target,
      type: l.type,
      weight: l.weight,
      via: l.via,
    }));

    res.json({
      stats: {
        actors: s.actors,
        posts: s.posts,
        cryptoAddresses: cSum.total,
        cryptoLinked: cSum.linkedToActor,
        sharedWallets: cSum.sharedWallets,
        cases: s.cases,
        ingestRuns: s.ingestRuns,
        crossLinks: s.links,
        auditEntries: s.audit,
        avgAttribution: actors.length
          ? +(actors.reduce((acc, a) => acc + (a.attributionScore || 0), 0) / actors.length).toFixed(1)
          : 0,
        highRisk: riskDist.CRITICAL + riskDist.HIGH,
      },
      forums: forumCounts(),
      timeline: postTimeline(),
      riskDistribution: riskDist,
      crypto: cSum,
      recentEvidence: listAudit(15).map((h) => ({
        at: h.at,
        action: h.action,
        actor: h.actor || 'system',
        detail: h.detail || '',
        hash: h.hash,
      })),
      recentLinks,
    });
  });

  return r;
}