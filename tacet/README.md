# TACET — Dark Web Threat Actor De-Anonymization
**Smart India Hackathon 2026 · PS ID SIH26151 · Theme: Blockchain & Cybersecurity**
**Team ID:** KRMU159 · **Team Name:** Tacet

TACET is an OSINT attribution platform that de-anonymizes dark web threat actors **without touching the Tor routing layer**. It operates on offline forum dumps and public OSINT data to:

- build **deep stylometric fingerprints** (model-agnostic scoring layer with a deterministic feature engine for offline demos; a RoBERTa embedding adapter slots in behind the same fingerprint contract) to link authorship across forums,
- **correlate cryptocurrency addresses** across chains (BTC/ETH/XMR) with clearweb exchange clusters and known actor wallets,
- extract **PGP key IDs, Jabber/Telegram handles, emails, aliases and timezone histograms** from posts and signatures,
- assemble everything into an **interactive, weighted knowledge graph** with a normalized attribution score per identity,
- cut analyst triage time from ~14 days of manual pivoting to under 15 minutes per case.

## Data provenance — what is real and what is demonstration data

This matters more than any feature claim, so it is stated plainly.

**Real, downloaded from authoritative sources, verifiable:**

| Data | Source | Volume |
|---|---|---|
| Stylometry training corpus | 20 Newsgroups (real Usenet posts by real authors) | 751 documents, 20 real authors |
| Designated threat-actor wallets | US Treasury OFAC SDN list | 373 addresses, 87 designated entities, 16 chains |
| On-chain wallet activity | blockchain.info public API (live, cached 6 h) | real balances / tx counts |
| BTC address validation | Base58Check + bech32 implemented in-repo | — |

Named examples present in the sanctions registry: **HYDRA MARKET** (OFAC #36216, programme
CYBER2 — 1,459 real transactions, 13,519 BTC of real flow), **BLENDER.IO**, **GARANTEX**,
**SUEX OTC**, **CHATEX**, plus Trickbot-linked and DPRK-linked individuals.

Fetchers (re-runnable, they re-download the live lists):

```bash
python server/ml/fetch_20news.py     # real multi-author corpus
python server/ml/fetch_ofac.py       # real OFAC SDN digital-currency designations
python server/ml/normalize_ofac.py   # chain normalisation + Base58Check validation
python server/ml/train.py            # trains + writes server/model/ artifacts
```

**Demonstration data (synthetic, clearly labelled):** the forum handles and forum posts in the
seeded corpus (`RansomLord`, `dumps4u`, …) are **fictional**. They exist so the correlation,
graph and case workflows can be demonstrated without republishing real victim data or asserting
anything about a real person. The ingest pipeline is format-driven and accepts real
JSON / CSV / BBCode dumps — `POST /api/ingest/upload` — so real data replaces the demo corpus
without code changes.

> ⚠️ **Ethical & legal note:** TACET only analyzes publicly available, already-dumped forum data and OSINT. It never exploits Tor relays, performs no live network attacks, and is designed for lawful cyber-crime investigation, CERT-In / NTRO / LEU workflows under the IT Act (Sec. 65B) and Bharatiya Sakshya Adhiniyam 2023 evidence rules.

---

## Repository layout

```
tacet/
├── server/                  # Node.js + Express REST API (no native deps)
│   ├── ml/
│   │   ├── train.py             # scikit-learn authorship model trainer
│   │   └── requirements.txt     # Python training stack
│   ├── model/                   # trained artifacts (classifier, vocab, metrics)
│   ├── src/
│   │   ├── index.js         # Express bootstrap (opens SQLite, seeds on first boot)
│   │   ├── seed.js          # Deterministic corpus generator → writes through SQL
│   │   ├── db.js            # SQLite layer: schema, FK, indexes, SHA-256 hash chain
│   │   ├── auth.js          # PBKDF2 passwords + HMAC session tokens
│   │   ├── services/
│   │   │   ├── nlp.js           # tokenizer + linguistic feature math
│   │   │   ├── stylometry.js    # author fingerprints + similarity + clustering
│   │   │   ├── ml.js            # bridges trained model artifacts into the API
│   │   │   ├── entities.js      # regex extractors (crypto/PGP/handles/URLs)
│   │   │   ├── crypto.js        # address validators + cluster walker
│   │   │   ├── chain.js         # live blockchain.info lookups (cached)
│   │   │   ├── attribution.js   # weighted attribution scoring
│   │   │   ├── graph.js         # knowledge graph builder
│   │   │   └── ingest.js        # dump parsers + identity-resolution pipeline
│   │   └── routes/          # actors / posts / graph / crypto / ingest / cases / audit / dashboard / analysis / auth
│   └── data/                # tacet.db auto-created on first boot
├── web/                     # React (Vite) frontend
│   └── src/
│       ├── api.js           # fetch wrapper
│       ├── App.jsx          # routes + shell
│       ├── components/      # shadcn-style UI primitives
│       └── pages/           # 14 pages (dashboard → compliance)
├── qa/                      # headless screenshot + layout audit harness
└── docs/                    # API, architecture, demo script, judge prep
```

---

## Quick start (demo)

```bash
# 1. Install dependencies (root)
npm run setup

# 2. Build the web bundle (once)
npm run build

# 3. Start API + static frontend
npm start
# → API  http://localhost:4000/api
# → App  http://localhost:4000

# Demo login
# analyst / tac3t-demo    (read + analyze)
# admin   / tac3t-admin   (full access incl. ingest & cases)
```

The **SQLite database** (`server/data/tacet.db`) is created and seeded automatically on first boot.

### Train the stylometry model (once, then it's shipped as an artifact)

```bash
python -m pip install -r server/ml/requirements.txt
python server/ml/train.py
# writes server/model/{classifier.joblib, word_vectorizer.joblib, char_vectorizer.joblib,
#                     metrics.json, vocab.json, feature_profiles.json}
```

`metrics.json` carries the real cross-validated scores reported in the UI at
`GET /api/analysis/model`. Re-run training any time to refresh the artifact.

Development mode with hot reload:

```bash
npm --prefix server run dev     # API on :4000
npm --prefix web run dev        # Vite on :5173 → proxy /api to :4000
```

---

## Stack (what actually runs)

| Layer | Implementation |
|---|---|
| Database | **SQLite** via `node:sqlite` — 13 tables, foreign keys, indexes, WAL (`server/src/db.js`) |
| Integrity | **SHA-256** evidence hash on every post and address; **hash-chained audit log** with a verification endpoint |
| Stylometry (ML) | **scikit-learn** authored model: char 3–5 + word 1–2 TF-IDF → LogisticRegression, 5-fold cross-validated (`server/ml/train.py`) |
| Chain data | **Live** blockchain.info lookups (balance, tx count, activity) cached in `chain_cache` (`server/src/services/chain.js`) |
| Evidence | Case evidence-chain export with IT Act §65B / BSA 2023 / NIST SP 800-86 language |
| API | Node.js + Express (`server/src/routes/`) |
| UI | React 18 + Vite + Tailwind v4 + shadcn-style primitives, lucide icons |

---

## Feature map (against the problem statement)

| Problem-statement pillar | Where it lives |
|---|---|
| Application-layer attribution, offline ingestion | `server/src/services/ingest.js` (JSON/CSV/BBCode/plain parsers), `/api/ingest/upload` |
| Deep stylometry fingerprinting | **Trained model** in `server/ml/train.py` + runtime features in `services/stylometry.js` / `nlp.js`; `/api/analysis/model`, `/api/analysis/compare` |
| Cross-chain transaction correlation | `services/entities.js` (validated BTC/ETH/XMR extraction), `services/crypto.js` (cluster walk), `services/chain.js` (**live** on-chain data) |
| Dynamic knowledge graph + weighted score | `services/graph.js` (identity↔identity `SHARED_*` edges) + `services/attribution.js`; `/api/graph` |
| Aliases / PGP / Jabber / Telegram / timezone histograms | `entities.js` extraction → normalised into SQL tables, surfaced on identity profiles |
| Auditable evidence trail | SHA-256 per-artifact hashes + hash-chained `/api/audit` with `/api/audit/verify` |
| Case management & compliance export | `/api/cases`, `/api/cases/:id/report`; UI "Legal framework" page |

---

## API surface (summary)

| Method & path | Purpose |
|---|---|
| `POST /api/auth/login` | Session token (PBKDF2-hashed users, HMAC-signed bearer tokens) |
| `GET /api/health` | DB engine, row counts, **audit-chain validity** |
| `GET /api/dashboard` | KPIs, forum breakdown, risk posture, activity feed |
| `GET /api/actors` / `GET /api/actors/:id` | Identity list (SQL-filtered) + full profile with candidates |
| `POST /api/actors/:id/fingerprint` | Recompute stylometric fingerprint from stored posts |
| `GET /api/posts` | SQL-backed search over the corpus (each post carries its evidence hash) |
| `GET /api/graph` / `GET /api/graph/actor/:id` | Knowledge graph + ego network |
| `GET /api/crypto/addresses` , `/cluster` | Address registry + wallet cluster walk |
| `GET /api/crypto/chain/:chain/:address` | **Live** on-chain lookup (cached) |
| `GET /api/crypto/actor/:id/live` | Identity's wallets enriched with live chain data |
| `GET /api/analysis/model` | Real trained-model provenance and CV metrics |
| `GET /api/analysis/compare?a=&b=` | Weighted attribution between two identities |
| `GET /api/sanctions` , `/summary` , `/check/:chain/:address` , `/matches` | Real OFAC-designated address registry + corpus screening |
| `POST /api/ingest/upload` | Parse → extract → fingerprint → **create/extend identities** → link |
| `GET /api/cases/:id/report` | Evidence-chain export |
| `GET /api/audit` , `GET /api/audit/verify` | Audit trail + cryptographic integrity check |

Schema-level detail in [docs/API.md](docs/API.md); authoritative definitions in `server/src/routes/`.

---

## Docker (optional)

```bash
docker compose up --build
# http://localhost:4000
```

---

## Docs

- `docs/architecture.md` — system design, microservices, scaling to Celery workers + Neo4j.
- `docs/demo-script.md` — 8-minute SIH demo walkthrough.
- `docs/judge-prep.md` — honest win-probability assessment, weaknesses, judge Q&A prep.

## UI foundation & QA

- The interface is built on **shadcn/ui design tokens** (the same component
  ecosystem 21st.dev distributes) with **Tailwind CSS v4** and **lucide-react**
  icons — copied into `web/src/components/ui/` so there is zero runtime UI library.
  Dark zinc theme, restrained cyan accent, mono-font data numerals.
- **Visualisation primitives are hand-rolled SVG** (no chart dependency):
  `score-ring.jsx` (attribution gauges), `donut.jsx` (risk / forum composition),
  `sparkline.jsx`, `skeleton.jsx` (loading), `empty-state.jsx`.
- **Knowledge graph** is a real force-directed simulation (repulsion + spring +
  damping, ~300 ticks) with scroll-zoom, drag-to-pan, draggable nodes,
  neighbourhood highlighting, node-type filtering and an inspector panel.
- **Command palette** (`⌘K` / `Ctrl+K`) jumps to any page or identity.
- Tables are sortable; the dashboard timeline is a genuine SQL `GROUP BY month`
  aggregation of stored post timestamps — no invented chart data.
- `qa/screenshot.mjs` captures every page headlessly (system Edge) into
  `qa/shots/`; `qa/audit.mjs` runs the **83-check** layout/interaction suite;
  `scripts/smoke.mjs` runs the **53-check** end-to-end API suite.

## License
Internal build for SIH 2026. Third-party data is used under its own terms: the OFAC SDN list is
public-domain US government data; the 20 Newsgroups corpus is distributed for research use.
The fictional forum personas are original to this repository.
