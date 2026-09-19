# Judge preparation — will TACET win SIH?

Honest working document for the team. SIH judging rewards **working demos, clear
security value, and credible team delivery** — it is a national-level hackathon
with ~1,500 teams per theme round, so "wins" are decided by judged categories,
not by the product alone.

## What SIH judges score (Smart India Hackathon official rubric)

| Dimension | Weight-ish | TACET position |
|---|---|---|
| Problem understanding & alignment to the statement | High | Strong — four pillars of SIH26151 each map to a working screen |
| Solution novelty / technical depth | High | Strong story (multi-signal attribution, no Tor exploitation); depth is demo-level, not research-level |
| Working prototype & demo flow | Very high | Ready: seeded corpus, graph, attribution, ingest all run live |
| Practical impact & usability for the stakeholder (NTRO / CERT-In / police) | High | Credible, but needs one clear "who uses this and when" moment |
| Innovation & future scope | Medium | Good roadmap (RoBERTa, Celery, Neo4j, UTXO clustering) |
| Team presentation & Q&A | High | Depends on you — prep below |

## Strengths to lead with

1. **Ethical architecture is the differentiator.** Most dark-web teams demo scrapers
   or Tor exploits. TACET's "air-gapped, application-layer only" stance answers the
   safety question before judges ask it, and matches the PDF's compliance framing
   (IT Act §65B, BSA 2023, NIST SP 800-86).
2. **The story is concrete.** RansomLord = r1p_qu33n = RL-Operations, proven by a
   shared payout wallet + PGP key + style fingerprint. Judges remember one clean
   narrative better than a dozen features.
3. **The storage layer is real.** SQLite with foreign keys and indexes
   (`server/data/tacet.db`), a SHA-256 evidence hash on every post and address,
   and a **cryptographically hash-chained audit log** with a one-click
   verification screen (`/audit` → Verify chain).
4. **The stylometry model is genuinely trained — on real human writing.** An offline
   scikit-learn pipeline (char 3–5 + word 1–2 TF-IDF → LogisticRegression) is trained
   on the **20 Newsgroups corpus**: 751 real messages by 20 real authors, with RFC-822
   headers, quoted replies and signature blocks stripped so the model learns style
   rather than metadata. **86.2% cross-validated accuracy (± 0.8%), 82.8% held-out,
   macro-F1 0.79**, shown live on the compare screen from `metrics.json`.
5. **The sanctions layer is real government data.** 373 OFAC-designated addresses
   across 87 designated entities and 16 chains, loaded from the US Treasury SDN list
   into SQLite and surfaced on the **Sanctions registry** page. Named actors include
   **HYDRA MARKET, BLENDER.IO, GARANTEX, SUEX OTC, CHATEX**, plus Trickbot- and
   DPRK-linked individuals — each verifiable at the Treasury source link in the UI.
6. **Chain data is live.** Query any designated wallet and TACET returns real
   on-chain history. HYDRA Market's wallet shows **1,459 real transactions and
   13,519 BTC of real flow** — a judge can watch the network call happen.
7. **Time-to-value metric** ("14 days → under 15 minutes") is memorable if shown
   as a real demo action, not a slide claim.

## Honest limits — be ready to say these yourself

1. **The forum handles and forum posts are fictional demonstration data.** State it
   before a judge finds it. Frame: "The personas are invented so we don't republish
   victim data or assert anything about a real person. Everything that touches the
   real world does so from an authoritative source — the OFAC SDN list for wallets,
   blockchain.info for on-chain activity, a real 20-Newsgroups corpus for the model.
   The ingest pipeline is format-driven, so a lawful real dump replaces the demo
   corpus with no code change."
   **Never** claim the seeded personas are real threat actors — that is the one claim
   that would end your run.
2. **The trained model is scikit-learn, not a transformer.** The PDF promises
   transformer-based NLP. Answer: "The scoring layer is model-agnostic — this build
   ships a real, cross-validated classical model (89k TF-IDF features, 86% CV on 20
   real authors), and a RoBERTa embedding adapter drops in behind the same fingerprint
   contract." Knowing the difference between the two reads as competence.
3. **Attribution scores are realistic, not inflated.** 59–63% confidence between
   the planted pairs is honest. If judges ask "what would you need for 90%+?",
   answer: multiple independent artifact families + exchange deposit data +
   longer corpora.
4. **On-chain data is public lookups only.** We read balances/tx counts via
   blockchain.info; we do not do UTXO clustering against a full node. That is a
   documented roadmap step, not a claim.
5. **Single-process deployment.** SQLite is a real database, but the production
   map (Postgres + Neo4j + Celery workers) remains future scope — say so
   without being asked to.

## Demo discipline (8 minutes)

- 0:00–0:45 Problem: fragmented identity, manual pivot takes days, Tor exploitation is illegal/risky.
- 0:45–2:30 RansomLord profile: three handles, wallet + PGP + timezone histogram + **Fetch on-chain** (live balance).
- 2:30–4:00 Graph: shared wallets and the two probable links (59.5%, 63.2%).
- 4:00–5:30 Compare screen: trained-model metrics (86% CV on real 20-Newsgroups authors) + live pair scoring; then ingest `server/data/sample-dump.json` → new entities appear in Posts.
- 5:30–6:45 **Sanctions registry** (`/sanctions`): 373 real OFAC-designated addresses; query **HYDRA Market's** wallet live — 1,459 transactions, 13,519 BTC. Then Case 2026-001 evidence chain incl. §65B preservation note; **Audit log → Verify chain** (SHA-256 integrity).
- 6:45–8:00 Impact, limits, roadmap. Practice the Q&A below.

## Likely judge questions

| Question | Answer direction |
|---|---|
| "Isn't this just scraping forums?" | Collection is commodity; the value is *fragmented-identity resolution* — weighting independent signals (artifact reuse dominates) to prove two handles are one human. |
| "How do you handle adversaries using LLMs to rewrite style?" | Style is 36% of the score and adversarially rewritable; hard artifacts (wallet/PGP/handle/timezone) dominate and are not rewritable by paraphrasing. |
| "Legal basis?" | Public dumped data + OSINT; zero Tor routing; evidence report templates carry §65B / BSA 2023 / NIST SP 800-86 language. |
| "Why Node for the API but Python for ML?" | Deliberate split: Node keeps the API and ingestion dependency-free and fast to deploy; Python owns offline training where the scientific stack lives. Both sides meet at a file contract (`server/model/`), so either can be replaced independently. |
| "Is the model actually trained, or hard-coded?" | Show `/compare` → *Trained stylometry model* panel: CV accuracy with standard deviation, held-out accuracy, macro-F1, 89k features, 20 real authors, plus training timestamp. Re-run `python server/ml/train.py` to reproduce it live. |
| "Is that real data?" | Yes, and we will tell you which parts. Training corpus: 20 Newsgroups (real authors, headers/quotes stripped). Wallets: 373 real US-Treasury-designated addresses (HYDRA, Blender, Garantex, SUEX, Chatex…). Chain data: live blockchain.info. The forum personas are fictional so we don't assert anything about real people — and the ingest pipeline accepts lawful real dumps unchanged. |
| "Where does the chain data come from?" | Live `blockchain.info` read-only lookups for balance/tx count/activity, cached in SQLite for 6 h. No wallets created, no transactions signed, no Tor. |
| "How do you know the evidence wasn't tampered with?" | Every post and address stores a SHA-256 hash, and the audit log is itself a hash chain — `/audit` → **Verify chain** recomputes it server-side and reports valid/broken. |
| "Scale to 50k posts/sec?" | Not in this build. Roadmap: Celery/Redis worker pool + Neo4j partitioning + GPU embedding workers; the architecture doc maps each service. Claim what runs, not the fantasy. |
| "Live demo crashed or data changed?" | Corpus is deterministic and reseedable in one click (`POST /api/ingest/seed`); run `node scripts/smoke.mjs` (53 checks) as a ~10-second pre-demo check. |

## Verdict

**Can this build win?** As a judged prototype, yes — it is complete, coherent,
safe-by-design, and demo-ready, which already clears most SIH teams. Winning
finals will come from (a) nailing the 8-minute demo, (b) being the team that
candidly explains its evidence model and limits, and (c) one memorable metric.
Weakest remaining risk is presentation polish, not code.
