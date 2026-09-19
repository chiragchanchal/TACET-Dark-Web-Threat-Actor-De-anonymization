// ---- crypto correlation engine ----
// Cross-chain address → identity → clearweb correlation. Clusters are computed
// over the address registry persisted in SQLite; live chain data is attached by
// services/chain.js (blockchain.info) and cached in the chain_cache table.

import { listAddresses, addressesForActor } from '../db.js';

const KNOWN_EXCHANGE_MARKERS = [
  'binance', 'kraken', 'coinbase', 'okx', 'bybit', 'huobi', 'kucoin',
  'gate.io', 'blockchain.com', 'bitfinex', 'crypto.com', 'changelly',
  'fixedfloat', 'sideshift',
];

export function addressKey(chain, address) {
  return `${chain}:${String(address).toLowerCase()}`;
}

export function detectExchange(value) {
  const lower = String(value || '').toLowerCase();
  return KNOWN_EXCHANGE_MARKERS.find((k) => lower.includes(k)) || null;
}

export function labelAddress(address, chain, actorName, sourceHint) {
  const lower = `${actorName || ''} ${sourceHint || ''}`.toLowerCase();
  const known = detectExchange(lower);
  if (known) return { t: 'exchange', c: 0.85, w: known };
  if (/ref|signature|wallet|donate/i.test(lower)) return { t: 'personal', c: 0.55, w: 'signature reuse' };
  return { t: 'unknown', c: 0.3, w: 'forum mention' };
}

/**
 * Breadth-first wallet cluster walk over the address→actor registry.
 * Two addresses join the same cluster when they share at least one actor,
 * mirroring common-input-ownership style heuristics at the identity layer.
 */
export function clusterForAddress(address, chain) {
  const registry = listAddresses({ limit: 100000 });
  const byKey = new Map(registry.map((a) => [addressKey(a.chain, a.address), a]));
  const startKey = addressKey(chain, address);
  const seen = new Set();
  const actors = new Set();

  const visit = (key, depth) => {
    if (depth > 3 || seen.has(key)) return;
    seen.add(key);
    const rec = byKey.get(key);
    if (!rec) return;
    rec.actorIds.forEach((id) => actors.add(id));
    for (const other of registry) {
      const otherKey = addressKey(other.chain, other.address);
      if (otherKey === key) continue;
      if (other.actorIds.some((id) => rec.actorIds.includes(id))) visit(otherKey, depth + 1);
    }
  };

  visit(startKey, 0);

  return {
    address,
    chain,
    found: byKey.has(startKey),
    actorCount: actors.size,
    actorIds: Array.from(actors),
    walletClusterSize: seen.size,
    addressesInCluster: Array.from(seen).map((k) => k.split(':').slice(1).join(':')),
  };
}

/** Wallets held by one identity. */
export function actorWallets(actorId) {
  return addressesForActor(actorId).map((a) => ({
    address: a.address, chain: a.chain, label: a.label,
    firstSeen: a.firstSeen, lastSeen: a.lastSeen, postCount: a.postCount,
  }));
}

export function summarize() {
  const registry = listAddresses({ limit: 100000 });
  const counts = { BTC: 0, ETH: 0, XMR: 0, SOL: 0, total: 0 };
  for (const a of registry) {
    counts[a.chain] = (counts[a.chain] || 0) + 1;
    counts.total += 1;
  }
  const linked = registry.filter((a) => a.actorIds.length > 1 || (a.tags || []).some((t) => t.c >= 0.55)).length;
  return {
    counts,
    total: counts.total,
    linkedToActor: registry.filter((a) => a.actorIds.length).length,
    exchangeLinked: linked,
    sharedWallets: registry.filter((a) => a.actorIds.length > 1).length,
  };
}