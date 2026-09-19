# TACET System Architecture

## 1. Design goals

TACET answers SIH26151 ("Dark Web Threat Actor De-Anonymization") under the
Blockchain & Cybersecurity theme with an **application-layer attribution** product:

1. **Zero Tor exploitation** — analysis runs on offline dumps only (air-gapped-friendly, OPSEC-safe).
2. **Multiple weak signals, one weighted answer** — stylometry alone is defeatable;
   combining crypto/PGP/handle artifacts, timezone histograms, and forum proximity yields
   decision-grade attribution.
3. **Auditable by construction** — every analysis event is written to a hash-chained audit log,
   with case evidence export modeled on NIST SP 800-86 / IT Act §65B.
4. **Deployable in 15 minutes** — no heavy model or external graph service required for the demo;
   the design scales to microservices + Celery + Neo4j in production.

## 2. Component map

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Web (React + Vite)         │  REST  │  Server (Node/Express)       │
│  Dashboard / Actors /       │───────▶│  routes/*                    │
│  Graph / Crypto / Cases     │  JSON  │                              │
└─────────────────────────────┘        │  ┌────────────────────────┐  │
                                        │  │ services:              │  │
                                        │  │  ingest (parsers+pipeline)
                                        │  │  entities (extractors) │  │
                                        │  │  nlp (feature math)    │  │
                                        │  │  stylometry (fingerprint/cluster)
                                        │  │  crypto (cluster walk) │  │
                                        │  │  attribution (weights) │  │
                                        │  │  graph (KG builder)    │  │
                                        │  └────────────────────────┘  │
                                        │  auth (HMAC sessions) · db   │
                                        │  (atomic JSON store)          │
                                        └──────────────────────────────┘
```

## 3. Pipeline (data → intelligence)

**Ingest** (`services/ingest.js`)
Raw dump → format sniffing (JSON / CSV / BBCode / plain) → normalization into
`{ forum, author, title, content, sig, ts }`.

**Extract** (`services/entities.js`, `services/nlp.js`)
Per post + signature:
- Crypto addresses (BTC legacy/bech32, ETH, XMR; SOL with context)
- PGP key IDs / fingerprints
- Telegram handles, Jabber/XMPP JIDs, emails
- Clearweb URLs (platform-classified: GitHub, Telegram, X, Reddit…), onion links, aliases
- Timezone histogram per author from UTC posting hours

**Fingerprint** (`services/stylometry.js`, trained by `ml/train.py`)
Two layers:
1. **Runtime feature profile** — per corpus: lexical metrics (word/sentence length distributions,
   TTR, hapax ratio, punctuation habits, function-word histograms, capitalization rate) plus
   4–5 char-shingle profiles. Cosine over a bounded numeric vector fused with shingle-Jaccard
   yields pairwise similarity; union-find clusters fragmented identities at a configurable threshold.
2. **Trained authorship model** — offline `scikit-learn` pipeline over a labelled corpus:
   TF-IDF of **char 3–5 grams + word 1–2 grams** (12,529 features) into multinomial
   **LogisticRegression**, evaluated with stratified 5-fold cross-validation. Artifacts
   (classifier, both vectorizers, vocabulary, per-author discriminative features, metrics) are
   written to `server/model/` and surfaced at `GET /api/analysis/model`. The scoring layer is
   model-agnostic, so a RoBERTa embedding adapter drops in behind the same contract.

**Correlate** (`services/crypto.js`, `services/chain.js`)
Shared wallet → identity links held in SQL; wallet-cluster breadth-first walk (depth ≤ 3) finds
groups of identities holding the same addresses; exchange tags (Binance/Kraken/Coinbase/…) mark
first-hop deposit clusters. BTC structural validation via Base58Check + bech32 heuristics.
**Live chain enrichment** queries blockchain.info for real balance, transaction count and activity
windows, cached in the `chain_cache` table (6 h TTL) so repeat lookups stay offline-fast.

**Score** (`services/attribution.js`)
Weighted combination per identity pair:

| Component | Weight | Signal |
|---|---|---|
| Artifact reuse | 0.42 | same crypto / PGP / handle / email |
| Stylometry | 0.36 | fingerprint similarity |
| Timezone | 0.12 | posting-hour histogram overlap |
| Proximity | 0.10 | co-posted threads (reserved) |

Evidence-count dampening raises confidence when multiple independent signals agree;
verdicts map to `LIKELY_SAME_ACTOR ≥ 75`, `PROBABLE_LINK ≥ 55`, `WEAK_LINK ≥ 35`.

**Graph** (`services/graph.js`)
Nodes = actors, forums, wallets, PGP keys, handles, emails, URLs, onions.
Weighted edges = `HOLDS / SIGNS_WITH / CONTACTS / USES_ALIAS / POSTED_URL / ACTIVE_ON`.
Each node carries a composite score (degree + risk + attribution), and the browser renders the
result as an interactive SVG knowledge graph.

## 4. Storage & sessions

- `server/data/store.json` — single-file JSON store, atomically replaced on write.
  Keeps the demo dependency-free and makes full snapshots trivially portable.
- Passwords: PBKDF2-SHA256 (210k iterations), no plaintext.
- Sessions: HMAC-signed bearer tokens (`sha256`, 12 h TTL) — no server session state.
- Audit: each entry includes `at`, `hash` (FNV-1a over previous content), actor, action, detail.

## 5. Scaling to production (microservices)

The demo runs in one process; the SIH submission architecture replaces pieces:

| Concern | Demo | Production target |
|---|---|---|
| Ingest parallelism | inline pipeline | Celery/Redis worker pool (`50k posts/s`), S3 dump staging |
| Graph | in-memory builder | Neo4j partitions, Cypher traversal, graph ML (node2vec) |
| Stylometry | statistical engine | RoBERTa sentence embeddings + contrastive head |
| Chain correlation | forum-level clusters | Blockchair/OXT UTXO clustering, exchange APIs |
| Storage | JSON store | PostgreSQL + object storage + evidence hash-chain |
| Frontend scale | single-page app | same SPA behind CDN + WebSocket pushes |

`docker-compose.yml` + `Dockerfile` run the current build as a container; Neo4j and worker
compose profiles can be added without touching application code boundaries.

## 6. Security, ethics, evidence

- **No Tor interaction** — only public dumps; ingestion can run fully air-gapped.
- **Data provenance is explicit** — the train set is the real 20 Newsgroups corpus (authors
  anonymized handles, headers/quotes stripped), wallets come from the real US Treasury OFAC
  SDN list, and on-chain activity is pulled live from blockchain.info. The *forum personas*
  in the seeded corpus are fictional so the tool never asserts anything about a real person;
  every real-world input is from an authoritative, verifiable source.
- **Evidence export** (`GET /api/cases/:id/report`) reminds the operator to preserve the
  original dump image, hash artifacts, and certify per IT Act §65B / Bharatiya Sakshya
  Adhiniyam 2023 following NIST SP 800-86 — matching the PDF's research foundations.
