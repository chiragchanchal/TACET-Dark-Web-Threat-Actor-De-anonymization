import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { listActors, getActor } from '../db.js';
import { clusterByStyle } from '../services/stylometry.js';
import { attributionBetween, attributionCandidates } from '../services/attribution.js';
import { modelInfo } from '../services/ml.js';

export default function analysisRouter() {
  const r = Router();

  // Trained stylometry model metadata (real cross-validated metrics).
  r.get('/model', requireAuth, (req, res) => {
    const info = modelInfo();
    if (!info) return res.status(404).json({ error: 'No trained model found. Run: python ml/train.py' });
    res.json(info);
  });

  // Stylometric clustering across every fingerprinted identity.
  r.post('/cluster', requireAuth, (req, res) => {
    const actors = listActors().filter((a) => a.fingerprint);
    const threshold = req.body?.threshold ? Number(req.body.threshold) : undefined;
    const result = clusterByStyle(actors, { threshold });
    res.json({
      actorsConsidered: actors.length,
      pairs: result.edges.length,
      clusterCount: result.clusters.length,
      edges: result.edges,
      clusters: result.clusters,
    });
  });

  r.get('/compare', requireAuth, (req, res) => {
    const { a: idA, b: idB } = req.query;
    if (!idA || !idB) return res.status(400).json({ error: 'a and b query params required (actor ids)' });
    const actorA = getActor(idA);
    const actorB = getActor(idB);
    if (!actorA || !actorB) return res.status(404).json({ error: 'Actor not found' });
    res.json({
      a: { handle: actorA.primaryHandle, id: actorA.id },
      b: { handle: actorB.primaryHandle, id: actorB.id },
      ...attributionBetween(actorA, actorB),
    });
  });

  r.get('/attribution/:actorId', requireAuth, (req, res) => {
    const actor = getActor(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    res.json({ target: { handle: actor.primaryHandle, id: actor.id }, candidates: attributionCandidates(actor, 10) });
  });

  return r;
}