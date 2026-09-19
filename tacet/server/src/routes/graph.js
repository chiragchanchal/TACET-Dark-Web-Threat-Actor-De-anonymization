import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getActor } from '../db.js';
import { buildGraph } from '../services/graph.js';

export default function graphRouter() {
  const r = Router();

  r.get('/', requireAuth, (req, res) => {
    const graph = buildGraph();
    const { kind, q, minScore = 0, limit = 250 } = req.query;

    let nodes = graph.nodes;
    let edges = graph.edges;
    if (kind) { const kinds = String(kind).split(','); nodes = nodes.filter((n) => kinds.includes(n.kind)); }
    if (q) { const lq = q.toLowerCase(); nodes = nodes.filter((n) => n.label?.toLowerCase().includes(lq)); }
    if (Number(minScore)) nodes = nodes.filter((n) => n.score >= Number(minScore));

    const nSet = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nSet.has(e.source) && nSet.has(e.target));

    const max = Number(limit) || 250;
    if (nodes.length > max) nodes = nodes.slice(0, max);

    res.json({
      nodes: nodes.slice(0, max),
      edges: edges.slice(0, max * 3),
      revision: graph.revision,
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
    });
  });

  // Ego network for one identity (its node plus everything directly connected).
  r.get('/actor/:actorId', requireAuth, (req, res) => {
    const actor = getActor(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });

    const graph = buildGraph();
    const nodeId = `actor:${actor.id}`;
    const nSet = new Set([nodeId]);
    for (const e of graph.edges) {
      if (e.source !== nodeId && e.target !== nodeId) continue;
      nSet.add(e.source);
      nSet.add(e.target);
    }

    res.json({
      center: graph.nodes.find((n) => n.id === nodeId),
      nodes: graph.nodes.filter((n) => nSet.has(n.id)),
      edges: graph.edges.filter((e) => nSet.has(e.source) && nSet.has(e.target)),
    });
  });

  return r;
}