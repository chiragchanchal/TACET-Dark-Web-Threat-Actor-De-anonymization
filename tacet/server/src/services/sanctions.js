// ---- real OFAC sanctions registry loader ----
// Loads the US Treasury SDN digital-currency addresses (fetched by
// ml/fetch_ofac.py, normalized by ml/normalize_ofac.py) into SQLite.
// These are REAL government-designated threat-actor wallets: HYDRA Market,
// Blender.io, Garantex, SuEX OTC, Trickbot-linked individuals, etc.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertSanction, countSanctions } from '../db.js';
import { appendAudit } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, '../../ml/corpus-ofac/sanctioned_wallets_valid.json');

let loaded = false;

export function loadSanctions() {
  if (loaded) return { loaded: true, alreadyLoaded: true };
  if (!fs.existsSync(SOURCE)) {
    console.warn('  [sanctions] OFAC list missing — run: python ml/fetch_ofac.py && python ml/normalize_ofac.py');
    return { loaded: false, error: 'OFAC source file not found' };
  }
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  } catch (e) {
    console.warn('  [sanctions] failed to parse OFAC list:', e.message);
    return { loaded: false, error: e.message };
  }
  let inserted = 0;
  for (const w of rows) {
    upsertSanction(w);
    inserted += 1;
  }
  const total = countSanctions();
  appendAudit({ actor: 'system', action: 'SANCTIONS_LOADED', detail: `${inserted} OFAC-designated addresses (${total} total in registry)` });
  loaded = true;
  console.log(`  Sanctions registry: ${total} real OFAC-designated addresses loaded`);
  return { loaded: true, inserted, total };
}

export function sanctionsReady() {
  return loaded;
}
