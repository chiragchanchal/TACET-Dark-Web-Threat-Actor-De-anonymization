// ---- live chain correlation ----
// Pulls real on-chain data for addresses found in the corpus and caches it in
// SQLite. Read-only public APIs; no wallets, keys or transactions are created.

import { cacheChainData, getCachedChainData } from '../db.js';

const TIMEOUT_MS = Number(process.env.TACET_CHAIN_TIMEOUT || 12000);
const USER_AGENT = 'TACET-SIH26151/1.0 (academic OSINT attribution research)';

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Live BTC address summary via blockchain.info (balance, tx count, activity). */
async function btcSummary(address) {
  const raw = await fetchJson(`https://blockchain.info/rawaddr/${encodeURIComponent(address)}?limit=0`);
  return {
    chain: 'BTC',
    address: raw.address || address,
    txCount: raw.n_tx ?? null,
    totalReceivedSat: raw.total_received ?? null,
    totalSentSat: raw.total_sent ?? null,
    finalBalanceSat: raw.final_balance ?? null,
    finalBalanceBtc: raw.final_balance != null ? raw.final_balance / 1e8 : null,
    totalReceivedBtc: raw.total_received != null ? raw.total_received / 1e8 : null,
    firstSeen: raw.first_tx ? new Date(raw.first_tx.time * 1000).toISOString() : null,
    lastSeen: raw.last_tx ? new Date(raw.last_tx.time * 1000).toISOString() : null,
    source: 'blockchain.info',
  };
}

export async function chainLookup(chain, address, { force = false } = {}) {
  const c = String(chain || 'BTC').toUpperCase();
  const cached = getCachedChainData(c, address);
  if (!force && cached) {
    return { ...cached.data, cached: true, fetchedAt: cached.fetchedAt };
  }

  let data;
  try {
    if (c === 'BTC') data = await btcSummary(address);
    else data = { chain: c, address, supported: false, note: `Live lookup not enabled for ${c} in this build.` };
  } catch (e) {
    // If previously cached, return it with offline fallback indicator
    if (cached) {
      return { ...cached.data, cached: true, offlineFallback: true, warning: e.message };
    }
    return { chain: c, address, error: e.message, live: false, source: 'offline-fallback' };
  }

  data.live = true;
  data.fetchedAt = new Date().toISOString();
  cacheChainData(c, address, data);
  return { ...data, cached: false };
}

/** Reference exchange rates for reporting (USD/INR). */
export async function marketTicker() {
  const cached = getCachedChainData('MARKET', 'btc-ticker', 30 * 60 * 1000);
  if (cached) return { ...cached.data, cached: true };
  try {
    const t = await fetchJson('https://blockchain.info/ticker');
    const data = { USD: t.USD?.last ?? null, INR: t.INR?.last ?? null, source: 'blockchain.info', at: new Date().toISOString() };
    cacheChainData('MARKET', 'btc-ticker', data);
    return { ...data, cached: false };
  } catch (e) {
    // Return realistic fallback rates so analytics never crash when offline
    return { USD: 89650, INR: 7510000, source: 'offline-estimate', at: new Date().toISOString(), fallback: true, error: e.message, live: false };
  }
}

/** Enrich a whole identity's wallet set with live chain data (bounded). */
export async function enrichWallets(wallets, maxLookups = 5) {
  const out = [];
  for (const w of wallets.slice(0, maxLookups)) {
    const live = await chainLookup(w.chain, w.address);
    out.push({ ...w, live: live.error ? null : live, liveError: live.error || null });
  }
  return out;
}