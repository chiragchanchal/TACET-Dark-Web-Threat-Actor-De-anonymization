import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { listAddresses, listActors, getActor, countActors, findSanction } from '../db.js';
import { clusterForAddress, summarize, actorWallets } from '../services/crypto.js';
import { validateBtc } from '../services/entities.js';
import { chainLookup, marketTicker } from '../services/chain.js';
import { listSanctions, sanctionStats } from '../db.js';

export default function cryptoRouter() {
  const r = Router();

  r.get('/summary', requireAuth, (req, res) => {
    const sum = summarize();
    const actors = listActors();
    const registry = listAddresses({ limit: 100000 });
    const exchange = registry.filter((a) => (a.tags || []).some((t) => t.t === 'exchange'));
    const shared = registry.filter((a) => a.actorIds.length > 1);
    // how many corpus addresses are actually OFAC-designated?
    let sanctionedHits = 0;
    const sanctionedEntities = new Set();
    for (const a of registry) {
      const hit = findSanction(a.chain, a.address);
      if (hit) { sanctionedHits += 1; sanctionedEntities.add(hit.entity); }
    }
    res.json({
      ...sum,
      actorsWithCrypto: actors.filter((a) => a.crypto?.length).length,
      exchangeClusters: exchange.map((a) => ({
        address: a.address, chain: a.chain, actorIds: a.actorIds,
        label: a.tags?.find((t) => t.t === 'exchange'),
      })),
      sharedWalletCount: shared.length,
      sanctions: { ...sanctionStats(), sanctionedHits, sanctionedEntities: [...sanctionedEntities] },
    });
  });

  r.get('/addresses', requireAuth, (req, res) => {
    const { q, chain, limit = 200 } = req.query;
    const list = listAddresses({ q, chain, limit: Math.min(Number(limit) || 200, 500) });
    res.json(list.map((a) => {
      const hit = findSanction(a.chain, a.address);
      return {
        address: a.address, chain: a.chain, actorCount: a.actorIds.length, postCount: a.postCount,
        firstSeen: a.firstSeen, lastSeen: a.lastSeen, tags: a.tags || [], actors: a.actorIds,
        sha256: a.sha256,
        sanctioned: !!hit,
        designation: hit ? { entity: hit.entity, program: hit.program, entNum: hit.ent_num } : null,
      };
    }));
  });

  r.get('/cluster', requireAuth, (req, res) => {
    const { address, chain = 'BTC' } = req.query;
    if (!address) return res.status(400).json({ error: 'address query param required' });
    const structurallyValid = String(chain).toUpperCase() === 'BTC' ? validateBtc(address) : true;
    const cluster = clusterForAddress(address, chain);
    res.json({ ...cluster, structurallyValid });
  });

  // Live on-chain data for one address (cached in SQLite for 6h).
  r.get('/chain/:chain/:address', requireAuth, async (req, res, next) => {
    try {
      const { chain, address } = req.params;
      const force = req.query.refresh === '1';
      const data = await chainLookup(chain, address, { force });
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  r.get('/market', requireAuth, async (req, res, next) => {
    try {
      res.json(await marketTicker());
    } catch (e) {
      next(e);
    }
  });

  r.get('/actor/:actorId', requireAuth, async (req, res) => {
    const actor = getActor(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    const wallets = actorWallets(actor.id);
    res.json({
      actorId: actor.id,
      handle: actor.primaryHandle,
      wallets,
      urls: actor.urls || [],
      telegram: actor.telegrams || [],
    });
  });

  // Identity's wallets enriched with live chain data + sanctions flag.
  r.get('/actor/:actorId/live', requireAuth, async (req, res) => {
    const actor = getActor(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    const wallets = actorWallets(actor.id);
    const enriched = [];
    for (const w of wallets.slice(0, 5)) {
      const hit = findSanction(w.chain, w.address);
      const live = w.chain.toUpperCase() === 'BTC' ? await chainLookup(w.chain, w.address) : { chain: w.chain, address: w.address, supported: false };
      enriched.push({
        ...w,
        live,
        sanctioned: !!hit,
        designation: hit ? { entity: hit.entity, program: hit.program, entNum: hit.ent_num } : null,
      });
    }
    res.json({ actorId: actor.id, handle: actor.primaryHandle, count: enriched.length, wallets: enriched });
  });

  return r;
}