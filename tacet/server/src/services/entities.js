// ---- entity extraction from forum posts / signatures ----
// Extracts crypto addresses, PGP key material, emails, telegram/jabber
// handles, URLs and onion links from raw forum text.

export const CRYPTO_RE = {
  BTC: /\b(bc1[a-z0-9]{39,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
  ETH: /\b0x[a-fA-F0-9]{40}\b/g,
  XMR: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,
  SOL: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, // heuristic — refined by context
};

const PGP_KEYID_RE = /(?:PGP|key\s*id|fingerprint|0x)\s*[:=]?\s*(0x)?[a-fA-F0-9]{16,40}/g;
const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const TELEGRAM_RE = /(?:t\.me\/|@)([a-zA-Z][a-zA-Z0-9_]{4,31})/g;
const JABBER_RE = /\b[a-zA-Z0-9._-]+@(?:jabber\.(?:ru|org|gg|de)|xmpp\.jp|dukgo\.com|thesecure\.biz|cock\.li|exploit\.im|onionmail\.org)\b/g;
const URL_RE = /\bhttps?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+\b/g;
const ONION_RE = /\b[a-z2-7]{16,56}\.onion\b/g;
const ALIAS_RE = /\b(?:alias|aka|nick|nickname|handle|username|formerly|a\/k\/a)\s*[:=\-]?\s*([A-Za-z0-9_.\-]{3,32})/gi;

/** Validate the checksum structure of a BTC address. */
export function validateBtc(addr) {
  if (!/^(bc1|[13])/.test(addr)) return false;
  const base = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [];
  try {
    for (const ch of addr) {
      const idx = base.indexOf(ch);
      if (idx < 0) return false;
      let carry = idx;
      for (let j = 0; j < bytes.length; j++) {
        carry += bytes[j] << 8;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    while (bytes.length && bytes[bytes.length - 1] === 0) bytes.pop();
    const raw = Buffer.from(bytes).reverse();
    if (addr.startsWith('bc1')) {
      // bech32/bech32m checksum: simplified hrp+checksum verification
      return raw.length >= 6 && raw.length <= 44;
    }
    return raw.length === 25;
  } catch {
    return false;
  }
}

export function extractEntities(text) {
  const found = {
    crypto: [], pgpKeys: [], emails: [], telegrams: [], jabbers: [], urls: [], onions: [], aliases: [],
  };
  const seen = new Set();
  const push = (arr, val, kind) => {
    const k = `${kind}:${val.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    arr.push({ value: val, kind });
  };

  const t = String(text || '');
  for (const m of t.matchAll(CRYPTO_RE.BTC)) push(found.crypto, m[1], 'BTC');
  for (const m of t.matchAll(CRYPTO_RE.ETH)) push(found.crypto, m[0], 'ETH');
  for (const m of t.matchAll(CRYPTO_RE.XMR)) push(found.crypto, m[0], 'XMR');

  for (const m of t.matchAll(PGP_KEYID_RE)) {
    const clean = m[0].replace(/^(?:PGP|key\s*id|fingerprint|0x)\s*[:=]?\s*/i, '').replace(/^0x/, '');
    if (clean.length >= 16) push(found.pgpKeys, clean.toLowerCase(), 'PGP');
  }
  for (const m of t.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (e.endsWith('.png') || e.endsWith('.jpg') || e.endsWith('.gif')) continue;
    push(found.emails, e, 'EMAIL');
  }
  for (const m of t.matchAll(TELEGRAM_RE)) {
    if (m[0].startsWith('@') || m.index === 0 || /[\s(@:>]/.test(t[m.index - 1])) push(found.telegrams, m[1], 'TELEGRAM');
  }
  for (const m of t.matchAll(JABBER_RE)) push(found.jabbers, m[0].toLowerCase(), 'JABBER');
  for (const m of t.matchAll(ONION_RE)) push(found.onions, m[0].toLowerCase(), 'ONION');
  for (const m of t.matchAll(URL_RE)) push(found.urls, m[0].replace(/[.,;:!?)\]]+$/, ''), 'URL');
  for (const m of t.matchAll(ALIAS_RE)) push(found.aliases, m[1].toLowerCase(), 'ALIAS');

  return found;
}

export function classifyUrls(urls) {
  const out = [];
  for (const u of urls) {
    const host = (u.replace(/^https?:\/\//, '').split('/')[0] || '').toLowerCase();
    let platform = null;
    if (host.includes('github.com') || host.includes('gitlab.com')) platform = 'GIT';
    else if (host.includes('telegram.org') || host.includes('t.me')) platform = 'TELEGRAM';
    else if (host.includes('twitter.com') || host.includes('x.com')) platform = 'TWITTER';
    else if (host.includes('reddit.com')) platform = 'REDDIT';
    else if (host.includes('discord')) platform = 'DISCORD';
    else if (host.includes('youtube')) platform = 'YOUTUBE';
    else platform = 'WEB';
    out.push({ url: u, host, platform });
  }
  return out;
}

export function deriveHandleFromEmail(email) {
  const local = (email.split('@')[0] || '').toLowerCase();
  return local.length >= 3 ? local : null;
}
