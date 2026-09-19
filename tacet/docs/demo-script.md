# TACET — 8-Minute SIH Demo Walkthrough

Telling the story of **SIH26151 — Dark Web Threat Actor De-Anonymization**.
One narrative thread throughout: *RansomLord is the same human across Breached,
Dread, and Exploit — and we can prove it from offline dumps alone.*

---

## Setup before the judges arrive (2 minutes, silent)

```bash
cd tacet
npm run setup          # if not already installed
python -m pip install -r server/ml/requirements.txt
python server/ml/train.py     # trains + writes server/model/ (once)
npm run build
npm start              # http://localhost:4000
```

Open http://localhost:4000, log in as **admin / tac3t-admin**.
Have the sample dump ready: `server/data/sample-dump.json`.
Before they walk in, run `node scripts/smoke.mjs` (expect `47 passed, 0 failed`) and
`POST /api/ingest/seed` once to restore the deterministic corpus.

**Confirm the real pieces are live before you present:**
- `GET /api/health` → `"database":"sqlite"`, `"auditChainValid":true`
- `GET /api/analysis/model` → real `cvAccuracy` / `nFeatures` (not 404)
- Identity profile → **Fetch on-chain** returns a balance (needs internet at the venue)

**Navigation map** — sidebar is grouped: *Intelligence* — Overview, Identities,
Knowledge graph, Post triage, Crypto correlation · *Analysis* — Attribution compare,
Cases, Data ingestion · *Administration* — Audit log, Legal framework.

**Judge-facing extras** (in the sidebar under Analysis/Administration):
- **Attribution compare** (`/compare`) — pick any two identities; the tool runs the
  weighted scorer live and shows confidence, component split (A/S/T) and matching artifacts.
- **Audit log** (`/audit`) — hash-chained evidence trail with search; mention it when
  discussing preservation.
- **Legal framework** (`/compliance`) — one screen that speaks to the IT Act §65B /
  BSA 2023 / NIST SP 800-86 basis and the air-gapped/no-Tor boundaries; anchor the
  "ethics" judge question here.

---

## 1. Problem framing (0:00–0:45) — Dashboard

Open **Dashboard** (default page).

> "Dark web threat actors fragment their identity across Breached, Dread and
> Exploit. A manual OSINT pivot takes analysts ~14 days. TACET ingests the same
> public dumps offline — zero Tor interaction — and turns them into a weighted
> attribution graph in under 15 minutes."

Point at KPIs: `Tracked identities`, `Corpus posts`, `Crypto addresses`,
`Entity cross-links`, `High/critical risk`.

## 2. Identity fragmentation (0:45–1:45) — Actors

Navigate **Actors → RansomLord**.

> "One threat actor, three handles: RansomLord on Breached, r1p_qu33n on Dread,
> RL-Operations on Exploit. TACET links them because their *style* doesn't change
> when the handle does."

Show the **Stylometric fingerprint** panel — vocabulary, sentence length,
punctuation habits. Then scroll to **Timezone histogram**:
> "He only posts between ~19:00–23:00 UTC. Patterns like this survive handle
> changes."

## 3. Crypto correlation (1:45–3:00) — Actor detail → crypto / Crypto page

Scroll to **Hard artifacts** on RansomLord's profile.

> "Each identity signs posts with the same wallets. That is a hard artifact —
> stylometry can be faked, a reused private key can't."

Switch to **Crypto Intel**:
> "We group wallets by ownership and flag exchange clusters, so a BTC deposit at
> Binance becomes a first-hop lead for law enforcement."

Then the live moment judges remember — back on the identity profile, click
**Fetch on-chain** under *Live chain data*:
> "That is a real network call. This wallet's balance, transaction count and
> activity window come straight from the public chain, cached in our database for
> six hours. We correlate on-chain facts with forum behaviour — we never touch
> wallets or sign anything."

(If the venue Wi-Fi fails, the cached value still renders and is labelled `cached`.)

## 4. The knowledge graph (3:00–4:30) — Graph

Open **Knowledge Graph**.

> "Every alias, wallet, PGP key, and Telegram handle becomes a node; every reuse
> becomes a weighted edge. This is the whole case in one canvas."

Highlight the RansomLord constellation: 3 handles → shared wallets → PGP key →
`rl_intel_desk` Telegram → GitHub repo (clearweb bridge).

## 5. Attribution scoring (4:30–5:30) — Compare + actor candidates

Open **Attribution compare** (`/compare`): Identity A = `RansomLord`, Identity B =
`cartel_ops` — the pair scores live on screen.

> "The verdict is computed by a model we actually trained: 12,529 TF-IDF
> character and word features, cross-validated to [read the real number from the
> panel]. Same payout wallet, same PGP circulation — the score reflects that."

Scroll to the **Trained stylometry model** card and point at `CV accuracy`,
`Held-out accuracy` and `Features`. Then back on RansomLord's profile, show
**Attribution candidates**:

> "cartel_ops scores 59.5% — they share a payout wallet. dumps4u and CVV-Team
> score 63.2% for the same reason. Each score shows its component split:
> artifact / style / timezone."

Explain verdict ladder briefly (LIKELY_SAME_ACTOR ≥ 75, PROBABLE ≥ 55).

## 6. Live ingestion (5:30–6:45) — Ingest

Open **Ingestion**, select forum *dread* or *exploit*, paste the contents of
`server/data/sample-dump.json`, click **Ingest & Analyze**.

> "This is the air-gapped ingestion path. Raw dump in — entities out. New posts
> now join the corpus and its graph."

Return to **Posts** and search `zeroday_peddler` — show extracted PGP/Telegram.
Then check **Actors** for the new identities that appeared.

## 7. Real sanctions registry (5:30–6:30) — Sanctions

Open **Sanctions registry** (`/sanctions`).

> "These are not made up — 373 real US-Treasury-designated addresses, 87 named
> entities, pulled from the OFAC SDN list. HYDRA Market. Blender.io. Garantex.
> SuEX OTC."

Click **Query** on a BTC row and watch the live chain response:

> "That's a real network call to the public chain — for HYDRA Market it returns
> 1,459 real transactions and 13,519 BTC of flow. A sanctioned darknet market's
> real on-chain history, verifiable at the OFAC source link in the corner."

## 8. Case, evidence & integrity (6:30–7:30) — Cases + Audit

Open **Cases**, click the case card → **Case 2026-001 — RansomLord wallet & identity cluster**.

> "Everything we just proved is preserved as an evidence chain: linked identities,
> their reusable artifacts, the cross-identity links with weights, and a report that
> documents the IT Act §65B / Bharatiya Sakshya Adhiniyam preservation note for
> admissibility."

Click **Export report** to download the JSON evidence chain (or open
`GET /api/cases/:id/report` in a browser tab).

Then open **Audit log** (`/audit`) and click **Verify chain**:

> "Every ingestion, case action and reseed is appended to a SHA-256 hash chain —
> each entry carries the previous hash. One click recomputes the whole chain
> server-side. If anyone edits a row, verification fails. That is tamper-evidence,
> not just a log file."

Finally click **New case** to show an analyst can open a fresh investigation and
attach identities in seconds.

## 9. Close (7:30–8:00)

If a judge raises legal or ethical scope, end on **Legal framework** (`/compliance`):
operational boundaries, attribution limits and verdict tiers, evidence preservation,
and the Indian legal basis are all stated on one screen — then close with:

> "TACET: no Tor exploitation, application-layer attribution only — stylometry,
> cross-chain correlation, and a weighted knowledge graph that turns 14 days of
> manual pivoting into a 15-minute graph. Built for NTRO, CERT-In and cyber
> crime units — and open source end to end."

---

## Judge FAQ cheat sheet

| Question | Answer |
|---|---|
| How is this different from scraping forums? | Focus is *correlation*: fragmented identity resolution via weighted multi-signal scoring, not collection. |
| Can authors evade stylometry? | Yes — which is why artifact reuse dominates the score (0.42) and style is only one input. |
| Is the ML real? | Yes — trained on the real 20 Newsgroups corpus (751 messages, 20 real authors, headers/quotes/signatures stripped): 86.2% CV accuracy ± 0.8%, 82.8% held-out. Reproduce with `python server/ml/train.py`. |
| Where does on-chain data come from? | Live blockchain.info read-only lookups (balance, tx count, activity), cached 6 h in SQLite. |
| Are the wallets real? | Yes — 373 real US-Treasury OFAC-designated addresses across 87 entities from the SDN list (HYDRA, Blender, Garantex, SuEX, Chatex). HYDRA's wallet shows 1,459 real transactions / 13,519 BTC. |
| How is evidence integrity proven? | SHA-256 per post/address plus a hash-chained audit log with a server-side verifier (`/audit` → Verify chain). |
| Legal basis? | Public dumps + OSINT only; report template cites IT Act §65B / BSA 2023 / NIST SP 800-86. |
| Why are the forum personas fictional? | So the tool never asserts anything about a real person, and no victim data is republished. Real inputs come from authoritative sources; the parsers accept real JSON/CSV/BBCode dumps unchanged. |
| Scales? | Single process on SQLite today; architecture doc maps each service to Celery workers + Neo4j + transformer embeddings. |
