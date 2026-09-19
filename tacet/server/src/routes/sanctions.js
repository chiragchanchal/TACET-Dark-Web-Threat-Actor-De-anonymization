// ---- real OFAC sanctions registry API ----
// Serves the US Treasury SDN digital-currency addresses that TACET loads into
// SQLite. These are real, publicly designated threat-actor wallets.

import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { listSanctions, sanctionStats, findSanction, listAddresses } from '../db.js';

export default function sanctionsRouter() {
  const r = Router();

  // Registry summary: totals per chain and distinct designated entities.
  r.get('/summary', requireAuth, (req, res) => {
    const s = sanctionStats();
    res.json({
      ...s,
      source: 'US Treasury OFAC Specially Designated Nationals (SDN) list',
      sourceUrl: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV',
    });
  });

  // Search the designated-address registry.
  r.get('/', requireAuth, (req, res) => {
    const { q, chain, limit = 200 } = req.query;
    res.json(listSanctions({ q, chain, limit: Math.min(Number(limit) || 200, 1000) }));
  });

  // Check whether a specific address is designated.
  r.get('/check/:chain/:address', requireAuth, (req, res) => {
    const hit = findSanction(req.params.chain, req.params.address);
    res.json({
      address: req.params.address,
      chain: req.params.chain,
      sanctioned: !!hit,
      designation: hit
        ? { entity: hit.entity, program: hit.program, entNum: hit.ent_num, sdnType: hit.sdn_type, source: hit.source, sourceUrl: hit.source_url }
        : null,
    });
  });

  // Cross-reference: which addresses observed in the corpus are designated?
  r.get('/matches', requireAuth, (req, res) => {
    const observed = listAddresses({ limit: 100000 });
    const matches = [];
    for (const a of observed) {
      const hit = findSanction(a.chain, a.address);
      if (hit) {
        matches.push({
          address: a.address,
          chain: a.chain,
          actorCount: a.actorIds.length,
          actorIds: a.actorIds,
          designation: { entity: hit.entity, program: hit.program, entNum: hit.ent_num, source: hit.source },
        });
      }
    }
    res.json({ observed: observed.length, matches: matches.length, results: matches });
  });

  return r;
}
