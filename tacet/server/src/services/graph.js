// ---- knowledge graph builder ----
// Nodes: identities, forums, crypto addresses, PGP keys, handles, emails,
// clearweb URLs and onion references. Edges are weighted evidence links,
// including identity↔identity links read from the links table.

import { listActors, listLinks, getMeta, setMeta } from '../db.js';

export function buildGraph() {
  const actors = listActors();
  const links = listLinks();
  const nodes = new Map();
  const edges = [];

  const addNode = (id, kind, label, meta = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind, label, ...meta, degree: 0, score: 0 });
    else Object.assign(nodes.get(id), meta);
  };
  const addEdge = (from, to, relation, weight, meta = {}) => {
    edges.push({ source: from, target: to, relation, weight: +Number(weight).toFixed(3), ...meta });
  };

  for (const actor of actors) {
    const aId = `actor:${actor.id}`;
    addNode(aId, 'actor', actor.primaryHandle, {
      forum: actor.forums?.[0],
      risk: actor.risk,
      riskScore: actor.riskScore ?? 0,
      attrScore: (actor.attributionScore ?? 0) / 100,
      score: 0,
      aliases: actor.aliases?.length || 0,
      crypto: actor.crypto?.length || 0,
      pgp: actor.pgpKeys?.length || 0,
    });

    for (const f of actor.forums || []) addEdge(aId, `forum:${f}`, 'ACTIVE_ON', 0.5, { ts: actor.firstSeen });

    for (const al of actor.aliases || []) {
      addNode(`alias:${al.toLowerCase()}`, 'alias', al, { actorId: actor.id });
      addEdge(aId, `alias:${al.toLowerCase()}`, 'USES_ALIAS', 0.7);
    }
    for (const w of actor.crypto || []) {
      const nId = `crypto:${w.chain}:${String(w.value).toLowerCase()}`;
      addNode(nId, 'crypto', `${w.chain} ${String(w.value).slice(0, 10)}…`, { chain: w.chain, address: w.value });
      addEdge(aId, nId, 'HOLDS', w.weight ?? 0.85);
    }
    for (const k of actor.pgpKeys || []) {
      addNode(`pgp:${String(k).toLowerCase()}`, 'pgp', `PGP ${String(k).toUpperCase().slice(0, 16)}`, { keyId: k });
      addEdge(aId, `pgp:${String(k).toLowerCase()}`, 'SIGNS_WITH', 0.9);
    }
    for (const h of actor.telegrams || []) {
      addNode(`telegram:${String(h).toLowerCase()}`, 'telegram', `@${h}`, { handle: h });
      addEdge(aId, `telegram:${String(h).toLowerCase()}`, 'CONTACTS', 0.8);
    }
    for (const h of actor.jabbers || []) {
      addNode(`jabber:${String(h).toLowerCase()}`, 'jabber', h, { handle: h });
      addEdge(aId, `jabber:${String(h).toLowerCase()}`, 'CONTACTS', 0.8);
    }
    for (const e of actor.emails || []) {
      addNode(`email:${String(e).toLowerCase()}`, 'email', e, { address: e });
      addEdge(aId, `email:${String(e).toLowerCase()}`, 'USES_EMAIL', 0.85);
    }
    for (const u of actor.urls || []) {
      addNode(`url:${u}`, 'url', u, { url: u });
      addEdge(aId, `url:${u}`, 'POSTED_URL', 0.4);
    }
    for (const o of actor.onions || []) {
      addNode(`onion:${o}`, 'onion', o, { onion: o });
      addEdge(aId, `onion:${o}`, 'TALKS_ABOUT', 0.5);
    }
  }

  // forum nodes for any forum seen
  const forums = new Set();
  for (const a of actors) for (const f of a.forums || []) forums.add(f);
  for (const f of forums) addNode(`forum:${f}`, 'forum', f);

  // identity↔identity evidence links
  for (const l of links) {
    const s = `actor:${l.source}`;
    const t = `actor:${l.target}`;
    if (nodes.has(s) && nodes.has(t)) {
      addEdge(s, t, `SHARED_${l.type}`, l.weight, { via: l.via, linkType: l.type });
    }
  }

  for (const e of edges) {
    const s = nodes.get(e.source); if (s) s.degree += 1;
    const t = nodes.get(e.target); if (t) t.degree += 1;
  }
  for (const [, n] of nodes) {
    n.score = Math.min(1, 0.35 * n.degree / (Math.max(n.degree, 1) + 3) + (n.riskScore ?? 0) * 0.3 + (n.attrScore ?? 0) * 0.35);
  }

  const revision = Number(getMeta('graph_revision') || 0) + 1;
  setMeta('graph_revision', revision);

  return { nodes: Array.from(nodes.values()), edges, revision };
}