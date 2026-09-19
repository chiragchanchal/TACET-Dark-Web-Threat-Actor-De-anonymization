# TACET — Full submission plan (SIH 2026 / PS SIH26151, Team KRMU159)

Companion to `docs/ppt/TACET_SIH26151_Idea_Submission.pptx`. Everything below is
grounded in what is already built and verified in this repository — this is the
plan you execute, not a wish list.

---

## 1. Where the project stands (verified in-repo)

| Capability | Status | Evidence |
|---|---|---|
| Full-stack app (React + Node + SQLite) | Working | `npm start` → http://localhost:4000 |
| SQLite schema (13 tables, FK, indexes, WAL) | Done | `server/src/db.js` |
| Real stylometry model (20 Newsgroups, 20 real authors) | Trained | 86.2% CV ±0.8% · 82.8% held-out · MF1 0.79 · 89,401 features |
| Real OFAC sanctions registry | Done | 373 designated addrs · 87 entities · 16 chains |
| Live on-chain lookups | Done | HYDRA wallet: 1,459 txs · 13,519 BTC, via blockchain.info |
| Evidence: SHA-256 per post/address + hash-chained audit + verifier | Done | `/api/audit/verify` reports `valid: true` |
| Ingest pipeline (JSON/CSV/BBCode/plain) | Done | creates AND extends identities; `newActors`/`newLinks` proven |
| Weighted attribution + verdicts | Done | RansomLord↔cartel_ops 60.2% · dumps4u↔CVV-Team 63.2% |
| Knowledge graph (force-directed: zoom/pan/drag/filter/inspector) | Done | `qa/audit.mjs` verifies zoom + inspector |
| Command palette, sortable tables, real dashboard charts | Done | Ctrl+K · column sort · SQL GROUP-BY-month timeline |
| QA suites | Green | 53/53 API · 83/83 UI · 0 console errors |
| SIH template deck | Built | `docs/ppt/` — 8 slides, 6 per template + 2 appendix |

**Demo logins:** `admin / tac3t-admin` (full) · `analyst / tac3t-demo` (read/analyse).

---

## 2. The one thing that stays clearly labelled (read this first)

The forum **personas and posts** (`RansomLord`, `dumps4u`, …) are **fictional**.
That is deliberate: the tool must never assert anything about a real person, and
no victim data is republished. Every *real* input comes from an authoritative
source — the US Treasury OFAC list (wallets), 20 Newsgroups (training corpus),
blockchain.info (live chain data). The ingest pipeline is format-driven, so a
**lawful real dump replaces the demo corpus with zero code change**.

**Never tell a judge the demo personas are real threat actors.** State, before
they ask: *"The personas are invented for a reproducible, safe demo — everything
that touches the real world comes from the OFAC list, a real corpus, and the
live chain. Point a real dump at the ingest endpoint and it works unchanged."*
That phrasing has already been drafted into `docs/judge-prep.md`.

---

## 3. What to do now (pre-submission, ~2–3 days)

### Day 1 — data refresh & final freeze
```bash
cd tacet
python -m pip install -r server/ml/requirements.txt
python server/ml/fetch_ofac.py && python server/ml/normalize_ofac.py   # refresh OFAC
python server/ml/fetch_20news.py && python server/ml/train.py          # refresh model
node scripts/smoke.mjs                                                 # expect 53/53
node qa/audit.mjs                                                      # expect 83/83
python docs/ppt/make_deck.py                                           # rebuild deck
```
If the model numbers move after refresh, **edit `make_deck.py` to the new
values** — do not hand-edit the PPT, regenerate it and re-run
`python docs/ppt/verify_deck.py`.
- Commit the `model/` artifacts (classifier, vocab, metrics) so the deck's
  claimed metrics always match what ships.

### Day 2 — presentation materials
- Open the deck in PowerPoint and **export it to PDF as well** (File → Export →
  Create PDF/XPS) so the venue can present it even if PPTX rendering breaks.
- Re-read `docs/judge-prep.md` and `docs/demo-script.md` — both were rewritten to
  match the real (not demo) capabilities. Rehearse the 8-minute script twice.
- Prepare the live-demo machine: verify `npm start`, warm the chain cache by
  clicking **Fetch on-chain** / **Query** once per demo wallet **before** judges
  arrive (lookups are then instant offline for 6 h).

### Day 3 — risk pass
- Kill and restart the server; confirm the bootstrap message lists the OFAC
  sanction count (373) and the audit chain verifies.
- Turn off the network: page loads, ingest upload, and *cached* chain lookups
  must still render. This is your "air-gapped" proof, show it if you can.
- Test on the venue projector resolution (the app is responsive; set the browser
  to ~100 % zoom).

---

## 4. Division of labour (4–5 members)

| Role | Responsibilities |
|---|---|
| **Presenter / TL** | Owns the demo script, the 8-min clock, and the opening/closing narrative. |
| **Backend / Data engineer** | Owns `server/` — is ready to restart, reseed (`POST /api/ingest/seed`), and re-run smoke/audit live. |
| **ML / Evidence** | Owns `server/ml/` — can retrain the model live and explain CV vs held-out, why we stripped headers/quotes, and the macro-F1 number. |
| **Frontend / UX** | Owns `web/` — knows the command palette, graph gestures, sortable tables; drives the live graph and sanctions queries. |
| **Q&A / Legal** | Prepared on the ethics + evidence answers in `judge-prep.md` (IT Act §65B, BSA 2023, NIST 800-86, "is this real data?"). |

If you have only 4 people, merge Legal into the Presenter and Frontend into the
Backend member.

---

## 5. The judging rubric — where you will (and won't) score

| Rubric dimension | Your leverage | Where it is proven |
|---|---|---|
| Problem alignment (SIH26151) | 4 pillars ↔ 4 screens | Slide 2 (Solution) + live app |
| Working prototype | 53/53 + 83/83 + live on-chain + live ingest | Appendix B |
| Innovation / depth | No-Tor, application-layer; hard-artefact > style; real OFAC watchlist | Slide 2 (Innovation) + sanctions page |
| Impact / usability | 14 days → <15 min; unified workspace; §65B-ready reports | Slide 5 (Impact) + case report |
| Feasibility / scalability | Working single-process today; documented path to workers + Neo4j | Slide 4 (Feasibility) |
| Presentation & Q&A | Rehearsed 8-min script + honesty framing | `demo-script.md`, `judge-prep.md` |

---

## 6. Honest gaps (say them in the room, don't be forced to)

- **The stylometry model is scikit-learn, not a transformer.** The runtime
  scoring layer is model-agnostic; a RoBERTa embedding adapter slots in behind
  the same fingerprint contract. Know this distinction, state it.
- **UTXO clustering is roadmap, not claimed.** On-chain data is public balance /
  tx lookups. We demonstrate screening against OFAC, not a full-node cluster.
- **"50k posts/sec" is an aspiration**, not this build. Claim throughput honestly.
- **Personas are fictional** — see §2.

---

## 7. Deliverables checklist

- [ ] `docs/ppt/TACET_SIH26151_Idea_Submission.pptx` (8 slides) — generated ✓
- [ ] Same deck exported to PDF
- [ ] `server/model/*` committed so metrics match the deck
- [ ] OFAC + 20 Newsgroups corpora refreshed; `metrics.json` reflects the deck
- [ ] Smoke 53/53 + audit 83/83 green immediately before submission
- [ ] Server restart from cold boot verified; chain cache warm
- [ ] Team rehearsed on `demo-script.md`; each member owns a slide + a Q&A line

---

## 8. Quick reference

| Command | Purpose |
|---|---|
| `npm start` (from `tacet/`) | run app on :4000 |
| `node scripts/smoke.mjs` | 53-check API suite |
| `node qa/audit.mjs` | 83-check UI suite |
| `python docs/ppt/make_deck.py` | rebuild the PPTX |
| `python docs/ppt/verify_deck.py` | validate the PPTX contents/geometry |
| `POST /api/ingest/seed` (admin) | restore deterministic corpus |
