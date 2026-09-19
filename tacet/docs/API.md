# TACET API Reference

Base URL: `http://localhost:4000/api`
All data-bearing endpoints require `Authorization: Bearer <token>` obtained from `/api/auth/login`.

Credentials:

| Role | Username | Password | Scope |
|---|---|---|---|
| Analyst | `analyst` | `tac3t-demo` | read + analysis + case creation |
| Admin | `admin` | `tac3t-admin` | everything incl. ingest reset, case status changes |

Storage is **SQLite** (`server/data/tacet.db`) via `node:sqlite`, with foreign keys, indexes and
WAL enabled. Every post and address row carries a **SHA-256** evidence hash; the audit table is a
cryptographic hash chain.

---

## Auth

### POST `/api/auth/login`
Body: `{ "username": "analyst", "password": "tac3t-demo" }` → `{ token, user }`
Passwords are PBKDF2-SHA256 (210k iterations); tokens are HMAC-signed with a 12 h TTL.

### GET `/api/auth/verify`
Header bearer token → `{ valid, user }`

---

## Health

### GET `/api/health` *(no auth)*
```json
{
  "ok": true,
  "database": "sqlite",
  "engine": "node:sqlite",
  "actors": 10, "posts": 72, "addresses": 15, "links": 2,
  "ingestionRuns": 0, "cases": 1, "auditEntries": 2,
  "auditChainValid": true
}
```

---

## Dashboard

### GET `/api/dashboard`
Operational KPIs, forum coverage (SQL `GROUP BY`), risk distribution, crypto summary, and a live
activity feed drawn from the audit chain.

---

## Actors

### GET `/api/actors`
Query: `q`, `risk`, `forum`, `sort=score|-score`, `benign=true|false`.
SQL-filtered identity rows: handle, alias count, forums, risk, post count, wallet/PGP counts,
link count, attribution score.

### GET `/api/actors/:id`
Full profile: aliases, forums, fingerprint, crypto/PGP/telegram/jabber/email/URL artifacts,
timezone histogram, posts (each with its evidence hash), and top attribution candidates.

### POST `/api/actors`
Body: `{ primaryHandle, aliases?, forums?, risk?, notes? }` → created identity.

### POST `/api/actors/:id/fingerprint`
Recomputes the stylometric fingerprint from that identity's stored posts and persists it.

---

## Posts

### GET `/api/posts`
Query: `q`, `forum`, `author`, `actorId`, `limit` (≤200), `offset`.
Returns `{ total, offset, limit, posts[] }`; total is a SQL `COUNT(*)` over the same predicate.

### GET `/api/posts/:id`
Full post including extracted entities and `sha256` evidence hash.

---

## Graph

### GET `/api/graph`
Query: `kind=actor|crypto|pgp|telegram|…`, `q`, `minScore`, `limit`.
Returns `{ nodes, edges, revision, totalNodes, totalEdges }`. Identity↔identity evidence links
appear as `SHARED_CRYPTO` / `SHARED_PGP` / `SHARED_TELEGRAM` / `SHARED_EMAIL` edges carrying the
shared artifact in `via`.

### GET `/api/graph/actor/:actorId`
Ego network: the identity node plus everything directly connected.

---

## Crypto

### GET `/api/crypto/summary`
Chain counts, linked totals, shared-wallet count, exchange-tagged clusters.

### GET `/api/crypto/addresses`
Query: `q`, `chain`, `limit`. Registry rows include actor links, tags and the evidence `sha256`.

### GET `/api/crypto/cluster?address=&chain=`
Wallet cluster walk: `found`, `actorCount`, `walletClusterSize`, `addressesInCluster`, and
structural validity (BTC Base58Check / bech32 heuristic).

### GET `/api/crypto/chain/:chain/:address`
**Live** on-chain lookup (blockchain.info), cached in `chain_cache` for 6 h.
Add `?refresh=1` to bypass the cache.
```json
{
  "chain": "BTC", "address": "1A1zP1eP…",
  "txCount": 65776, "finalBalanceBtc": 107.47967707,
  "totalReceivedBtc": 107.47967707,
  "source": "blockchain.info", "live": true, "cached": false
}
```

### GET `/api/crypto/market`
Live BTC reference rates (USD / INR), 30-minute cache.

### GET `/api/crypto/actor/:actorId`
Identity's wallets, clearweb URLs and Telegram handles.

### GET `/api/crypto/actor/:actorId/live`
The same wallets enriched with live chain data (max 5 addresses per call).

---

## Analysis

### GET `/api/analysis/model`
Provenance and metrics of the trained stylometry model (`server/model/metrics.json`):
`method`, `cvAccuracy`, `cvAccuracyStd`, `heldOutAccuracy`, `heldOutF1Macro`, `nDocuments`,
`nAuthors`, `nFeatures`, `trainedAt`, and per-author precision/recall/F1.
Returns 404 if no model has been trained (`python ml/train.py`).

### GET `/api/analysis/compare?a=<actorId>&b=<actorId>`
Weighted attribution between two identities: `confidence` (0–99), `components`
(`artifact` / `style` / `timezone`), artifact hits with values, and `verdict`
(`LIKELY_SAME_ACTOR` ≥75 / `PROBABLE_LINK` ≥55 / `WEAK_LINK` ≥35 / `INSUFFICIENT`).

### GET `/api/analysis/attribution/:actorId`
Top-10 candidates across the corpus with full component breakdown.

### POST `/api/analysis/cluster`
Body: `{ threshold? }`. Union-find stylometric clustering over fingerprinted identities;
returns `actorsConsidered`, `pairs`, `clusterCount`, `edges`, `clusters`.

---

## Ingest

### GET `/api/ingest/runs`
Ingestion history from the `ingest_runs` table: forum, format, posts parsed, authors found,
extraction time, entity tallies.

### POST `/api/ingest/upload`
Accepts raw text, JSON (`{ "text" }` / `{ "posts": […] }` / `{ "content" }`).
Header `X-Forum: breached|dread|exploit`. Auto-detects JSON / CSV / BBCode / plain formats.

Runs the full pipeline — parse → entity extraction → fingerprint → **identity resolution** →
wallet registry → cross-identity linking — and returns:
```json
{
  "runId": "run_…", "posts": 2, "authors": 1,
  "newActors": 1, "newActorHandles": ["smoke_xyz"],
  "newLinks": 0, "format": "json",
  "entities": { "crypto": 0, "pgp": 1, "telegrams": 1, "emails": 0, "urls": 0 }
}
```
Re-ingesting a known handle **extends** that identity (`newActors: 0`) rather than duplicating it.

### POST `/api/ingest/seed` *(admin)*
Resets the database and regenerates the deterministic corpus. Returns row counts + `stats`.

---

## Cases

### GET `/api/cases` *(query `status=open|closed|escalated`)*
### POST `/api/cases`
Body: `{ title, description?, actorIds?, tags? }` — `actorIds` are validated against existing identities.
### GET `/api/cases/:id`
### POST `/api/cases/:id/status` *(admin)*
Body: `{ status: "open"|"closed"|"escalated" }`
### GET `/api/cases/:id/report`
Evidence-chain export: case metadata, per-identity artifacts, weighted cross-links and the
IT Act §65B / Bharatiya Sakshya Adhiniyam 2023 / NIST SP 800-86 preservation note.

---

## Sanctions (real OFAC data)

Loaded at boot from the US Treasury SDN list into the `sanctions` table (373 designated
addresses, 87 designated entities, 16 chains).

### GET `/api/sanctions/summary`
Totals per chain, distinct designated entities, and the authoritative source URL.

### GET `/api/sanctions?q=&chain=&limit=`
Search the designated-address registry by address, entity or programme.

### GET `/api/sanctions/check/:chain/:address`
```json
{
  "address": "35KAdTa2vqnJzitF2xiUzZn1Gmcas2Y465",
  "chain": "BTC",
  "sanctioned": true,
  "designation": {
    "entity": "HYDRA MARKET", "program": "CYBER2", "entNum": "36216",
    "source": "US Treasury OFAC SDN list"
  }
}
```

### GET `/api/sanctions/matches`
Cross-references every address observed in the corpus against the sanctions registry and
returns the overlapping designations (the screening workflow).

---

## Audit

### GET `/api/audit?limit=&action=`
Audit trail (newest first). Each entry: `at`, `actor`, `action`, `detail`, `hash`, `prev_hash`.

### GET `/api/audit/verify`
Recomputes the entire SHA-256 chain server-side:
```json
{ "valid": true, "count": 2, "head": "5efa6de7c8b11901…" }
```
Returns `{ valid: false, brokenAt, reason }` if any row was tampered with.
