# TACET — Cross-question study guide (SIH26151)

Written to be studied, not skimmed. Questions are ordered by how much damage they
can do, not by likelihood. Every answer below is **true of the build you are
submitting** — do not upgrade any claim in the room.

Three rules before you start:

1. **Admit gaps before you are caught.** A known limit stated calmly reads as
   competence. The same limit extracted from you under questioning reads as a bluff.
2. **Never claim a real person is a criminal.** The personas are invented. If you
   imply otherwise, one follow-up ("show me the source post") ends your run.
3. **Say "lead", never "identification".** The system produces weighted leads for
   a human to pursue. It does not name a human being.

---

# TIER 1 — Questions that can end your run

## Q1. "Where did you get the dark web data? Show me the dumps."

**Why they ask.** The most common killer. They are testing whether you broke the
law or invented evidence.

**Say this.**
> "We don't ship real dark web dumps, and we deliberately won't claim to. The
> forum personas and posts in this build are **fictional** — written so we never
> republish victim data and never assert anything about a real person. Everything
> that touches the real world comes from an authoritative source: 373
> OFAC-designated wallets from the US Treasury SDN list, a real multi-author
> corpus from 20 Newsgroups, and live chain data from blockchain.info. The ingest
> pipeline is format-driven — JSON, CSV, BBCode, plain text — so an agency points
> it at a lawfully obtained dump and it works unchanged."

**If pressed — "so you have no dark web data at all?"**
> "Correct, and that's a deliberate design decision, not a shortfall. Handling
> real dumps requires an authorization we don't have and shouldn't have as
> students. What we built and verified is the *analysis* layer that sits on top of
> a dump."

## Q2. "Is this legal? Aren't you de-anonymizing people without consent?"

**Say this.**
> "The tool never touches the Tor network, never performs live collection, and
> never acts on anyone. It analyses data an authorized agency already holds. In
> India that sits under the IT Act and the DPDP Act, and our case reports carry
> the §65B / Bharatiya Sakshya Adhiniyam 2023 preservation language and the NIST
> SP 800-86 workflow. Access is role-gated and every action lands in a
> tamper-evident audit log. But I'd be clear: any de-anonymization capability
> requires legal authorization to use — we built the capability, the authority
> stays with the agency."

**Do not say** "it's fine because it's public data." Dark web dumps frequently
contain breached personal data. That answer invites a follow-up you cannot win.

## Q3. "This could be used to stalk or harass innocent people. What stops that?"

**Say this.**
> "Nothing in the code stops a determined misuser — that's true of every forensic
> tool. What we control is access and accountability: role-based access, a
> hash-chained audit log where every action is recorded, outputs framed as
> confidence-tiered leads rather than verdicts, and no automated action of any
> kind. Deployment is on an agency's own infrastructure, so data never leaves
> their control. Governance has to be organizational; we made the technical layer
> auditable so that governance is checkable."

## Q4. "What happens if your system is wrong and someone gets accused?"

**Say this.**
> "That's the risk we designed around. A score is never presented as proof — it's
> a tier: above 75% 'likely same actor', above 55% 'probable link', above 35%
> 'weak', below that 'insufficient'. The analyst sees the component breakdown:
> which wallet, which PGP key, which handle was reused, separated from the
> stylistic signal. Human review is mandatory before anything operational, and the
> evidence chain is exportable precisely so a finding can be challenged. We
> produce a pivot for an investigator, not an accusation."

---

# TIER 2 — The scientific attack on stylometry

## Q5. "You trained on 20 Newsgroups. Dark web posts are short, slangy and mixed-language. Your 86% doesn't transfer."

**Why they ask.** The sharpest technical question you will get. It is correct, and
conceding it cleanly is your strongest move.

**Say this.**
> "You're right, and I won't claim it transfers. 86.2% cross-validated is a
> benchmark on a real labeled corpus — 751 documents, 20 real authors, with
> headers, quoted replies and signature blocks stripped — not a claim about dark
> web accuracy. Accuracy falls with shorter texts and more authors. That's a large
> part of why style carries only 36% of the weight and hard artefacts carry 42%.
> In deployment you'd re-train on in-domain labeled data, which an agency has and
> we don't."

This shows you understand domain shift and that you built the architecture so the
model can be swapped. A judge pushing here is usually fishing for overclaiming.

## Q6. "Stylometry is junk science. Authors change style deliberately."

**Say this.**
> "Style alone is weak — we agree, and the system is built that way. Adversarial
> stylometry is well documented: paraphrasing, translation hops and LLM rewriting
> all degrade it. That's exactly why a reused wallet or PGP key, which cannot be
> paraphrased, dominates the score. Style is a supporting signal that helps
> cluster identities when artefacts are thin, never a standalone finding."

## Q7. "Is your model actually trained, or hard-coded?"

**Show, then say.**
> "Open the compare screen — the panel reads the real training artifact: 86.2%
> cross-validated accuracy with ±0.8 standard deviation over five folds, 82.8%
> held-out, macro-F1 0.79, 89,401 TF-IDF features across 751 documents and 20
> authors. Re-run `python server/ml/train.py` and it retrains."

**Follow-up they may spring — "your first run got 99%, why is it 86%?"** You have a
genuinely strong answer:
> "Our first run hit 99.4% and we threw it out. The message headers were still in
> the text, so the model was reading the author's own `From:` line instead of
> writing style. We stripped headers, quoted replies and signatures, and the
> honest number was 86%. Shipping the 99% would have been a leak, not a result."

This is the best story in your deck. Anyone who has trained a model knows that
leak; telling it unprompted marks you as someone who understands the work.

## Q8. "Why not use RoBERTa, as the problem statement asks?"

**Say this.**
> "The stated approach is RoBERTa; we implemented the capability with a different
> model and we're upfront about it. Three reasons: TF-IDF plus logistic regression
> is deterministic, runs offline with no external API, is cheap at corpus scale,
> and is explainable — we can show the exact features driving a decision, which
> matters when output supports an investigation. An LLM would be non-deterministic
> and would require sending sensitive data to a third party. The scoring layer is
> model-agnostic: the fingerprint contract is isolated, so a RoBERTa embedding
> adapter is a phase-two swap, not a rewrite."

**Do not say** "we implemented RoBERTa." You didn't. That collapses in one
follow-up about which checkpoint, tokenizer and fine-tuning set you used.

## Q9. "Your UI says forum proximity is 10% of the score. Is it implemented?"

**Why they ask.** A sharp judge reading the config will find `proximity: 0.10`
defined but not included in the score sum. It is disclosed as "reserved" in the
interface, but they may test whether you know your own code.

**Say this — do not bluff.**
> "It's defined but not yet computed, and we label it 'reserved' in the interface
> rather than hiding it. The effective weights today are artefact 42, style 36 and
> timezone 12 — summing to 0.90, so normalised that's roughly 47/40/13. Proximity
> would measure co-posting in the same threads and reply chains, which needs
> thread-linkage metadata that our current parsers don't yet reconstruct. It's a
> straightforward addition once thread structure is parsed, and leaving it visible
> as unimplemented is more honest than quietly removing the row."

**If you have time before the event, implement it** — it removes a
self-inflicted wound and the question disappears. See the note at the end of
this document.

## Q10. "Only 20 authors? That's a toy."

**Say this.**
> "Twenty is what the corpus supports at a minimum of six documents each — you
> need multiple samples per author for a stable fingerprint. Scaling to hundreds
> is a data problem, not an architecture problem: the pipeline and fingerprint
> store are author-count agnostic. We also chose a real labeled corpus over our
> own generated one, because training on generated text is circular — the model
> would learn our templates, not human style."

---

# TIER 3 — Crypto and blockchain

## Q11. "Do you actually do blockchain analysis?"

**Say this.**
> "We do three real things and one thing by hand. Real: we extract and
> structurally validate addresses with Base58Check and bech32; we cluster
> addresses appearing under identities that share an owner; and we screen every
> observed address against 373 OFAC designations while pulling live balances and
> transaction counts from the public chain. What we do **not** do is UTXO graph
> analysis — change-address heuristics, peeling chains, full input-output
> clustering against a node. That's the documented next step."

**Why honesty matters.** "Cross-chain transaction correlation" is in the problem
statement. Claim full chain analysis and they'll ask about change-address
detection. This framing earns credit for what you built plus a credible roadmap.

## Q12. "Show me it works on a real wallet."

Have this loaded:
> "This is HYDRA Market's designated wallet, OFAC entry 36216 under programme
> CYBER2. Live lookup returns 1,459 transactions and 13,519 BTC of total received
> flow. The sanctions-check endpoint round-trips the designation."

## Q13. "What about mixers and chain-hopping?"

**Say this.**
> "Mixers defeat naive clustering and we don't claim to break them. Our practical
> angle is the ends of the pipe: first-hop and exit-hop exchange deposit clusters,
> plus signature reuse across forums, which links identities even when money
> movement is obfuscated. Blender.io is on our designation list precisely because
> it's the mixer layer."

## Q14. "Is your sanctions list current?"

**Say this.**
> "It's pulled from the Treasury's official SDN export, and every record carries
> its fetch timestamp and source URL. Freshness depends on the operator re-running
> the fetcher — a one-line command. We don't hide that it's a snapshot."

---

# TIER 4 — Evidence, forensics and integrity

## Q15. "How do I know your evidence wasn't tampered with?"

**Say this — and know the limit.**
> "Every post and address stores a SHA-256 hash, and the audit log is a hash
> chain: each entry commits the previous entry's hash, recomputed server-side in
> one click. That makes tampering **detectable**, not impossible. The honest
> caveat: an attacker with the database file could recompute the whole chain from
> scratch, so real assurance needs the chain head anchored externally — signed,
> timestamped or published. That's a scoped implementation step."

**Do not say** "it's immutable." Nothing local is immutable. "Tamper-evident, and
here's what would make it tamper-proof" is far stronger.

## Q16. "Is your output admissible in court?"

**Say this.**
> "No, not by itself — and no investigative tool's output is. Admissibility turns
> on certification and chain of custody for the underlying electronic record under
> §65B. What we do is make that easier: preserve per-artifact hashes, maintain an
> auditable operational trail, and state the preservation requirement in the case
> report so the analyst doesn't lose the record on a procedural point."

## Q17. "Do you verify PGP signatures cryptographically?"

**Say this.**
> "No. We extract key IDs and fingerprints as identifying artifacts and look for
> reuse across identities — that's the linkage signal. Verifying a signature needs
> the public key and the signed payload, a separate capability."

---

# TIER 5 — Architecture and scale

## Q18. "The problem statement claims 50,000 posts per second. Do you do that?"

**Say this.**
> "No, and we won't claim it. This is a single Node process with SQLite — honest
> throughput is thousands of posts per second on ingest, not fifty thousand. The
> service boundaries are drawn so the pipeline can move to a worker pool with
> partitioned graph storage; that's the scale-out path, documented in the
> architecture rather than claimed in the demo."

## Q19. "The problem statement says Neo4j. Where is it?"

**Say this.**
> "We didn't take a Neo4j dependency, for a specific reason: the tool must run
> air-gapped on an agency workstation with no external services, so the graph is
> built and traversed in-process and rendered as an interactive force-directed
> canvas. The graph model — typed nodes, weighted edges, ego-network traversal —
> is the same one you'd load into Neo4j. At corpus scale where traversal cost
> dominates, Neo4j or a partitioned store is the right swap."

## Q20. "How far does this scale?"

**Say this.**
> "Two honest limits. The graph layout is a force simulation that's fine to a few
> hundred nodes and not to millions — a rendering concern, not a data one. And
> SQLite is a real relational database with indexes and foreign keys, which
> handles far more than our corpus but isn't a distributed store. Both have a
> named migration path."

## Q21. "Why SQLite and not PostgreSQL?"

**Say this.**
> "Deployment reality. An air-gapped forensic workstation has no database server,
> and a single-file database with foreign keys, indexes and WAL is exactly right
> for that setting — it also makes the evidence store one copyable artifact.
> PostgreSQL is the right answer for multi-analyst deployment, and the data layer
> is isolated enough to swap."

---

# TIER 6 — Competition and positioning

## Q22. "Maltego, Palantir, DarkOwl, Intel471 exist. Why build this?"

**Do not say** "nothing like this exists." It isn't true and it's checkable.

**Say this.**
> "Commercial platforms are more mature and we won't pretend otherwise. Three
> differences matter for this use case. First, deployment: they're cloud or
> licence-heavy, and an intelligence unit often cannot send seized data to a third
> party — ours runs air-gapped on their own hardware. Second, cost: a self-hosted
> open stack removes the subscription. Third, and the actual technical point,
> we're not doing collection — the commercial platforms are strongest at
> collection and monitoring. We're doing fusion over data you already hold:
> stylometry plus artefact reuse plus sanctions screening, with an auditable
> evidence trail."

## Q23. "What's genuinely novel here? These techniques are all known."

**Say this.**
> "The individual techniques are known and we're not claiming to have invented
> them. Our contribution is the fusion and the framing. The specific insight is
> weighting: because stylometry is adversarially rewritable and artefacts are not,
> artefact reuse carries 42% against style's 36% — most stylometry-first designs
> get this backwards. Second, we made the whole pipeline produce tamper-evident
> evidence as a first-class output rather than a logging afterthought. Third, no
> Tor interaction at all — the entire class of legal risk in the problem statement
> is designed out rather than mitigated."

## Q24. "How is this better than an analyst just using search?"

**Say this.**
> "For one handle, search is fine. The problem statement's own framing is
> fragmentation: the same human under r1p_qu33n on one forum and RL-Operations on
> another. Search cannot tell you those are one person. That's the join we
> automate, and doing it manually across three forums, wallets, PGP keys and
> handle variants is where the weeks go."

---

# TIER 7 — Team, process and integrity

## Q25. "Did you use AI to build this?"

**Answer honestly.** Being caught hiding it is far worse than the fact itself.
> "Yes — we used AI coding assistance, as most teams now do. What we own and can
> explain line by line is the architecture, the model choice and validation, the
> scoring design, and the evidence model. Ask us about any file."

Then be able to actually answer. Do not name a vendor you didn't use.

## Q26. "What is the single biggest weakness of your solution?"

**Have this ready — it is a classic and a gift if you answer it well.**
> "In-domain training data. The stylometry model is validated on a real corpus,
> but not on dark web text, and I can't tell you today what its accuracy would be
> on short, slangy, code-switched forum posts. That's the number that would decide
> how much weight the stylistic signal deserves in production, and it needs
> labelled in-domain data an agency has. Everything else we can measure."

## Q27. "What would you do with three more months?"

> "Three things in priority order. One: anchor the audit chain externally so
> integrity doesn't depend on the operator's own machine. Two: add UTXO graph
> analysis — change-address heuristics and peeling-chain detection — to move from
> address screening to real chain correlation. Three: swap the classical model for
> a transformer embedding path behind the existing fingerprint contract, and
> re-validate on in-domain data."

## Q28. "How do you divide work between team members?"

Have each member claim a concrete area, and make sure each can be questioned on
it: backend and data layer, ML and validation, frontend and visualisation, and
legal/evidence framing. If one member answers everything, the jury concludes the
others didn't build it.

---

# RED LINES — never say these

| Never say | Why it ends badly |
|---|---|
| "We scraped Breached/Dread/Exploit." | Invites "show me", and admits unlawful collection. |
| "RansomLord is a real threat actor we identified." | Defamation; one follow-up destroys you. |
| "We implemented RoBERTa." | You didn't; the follow-up is unanswerable. |
| "It's fully immutable / tamper-proof." | Locally false; the chain-head caveat is your friend. |
| "50,000 posts per second." | Not measured; invites a benchmark you'll lose. |
| "We do full blockchain analysis." | You do screening and identity clustering, not UTXO analysis. |
| "Nothing like this exists." | Checkably false, and it insults informed judges. |
| "Our accuracy on dark web data is 86%." | The 86% is out-of-domain; say so first. |

---

# The four sentences worth memorising

If you remember nothing else:

1. **On data:** "The personas are fictional so we never assert anything about a
   real person; wallets, training corpus and chain data are all from authoritative
   sources, and the ingest pipeline takes a real lawful dump unchanged."
2. **On the model:** "86% is a benchmark on a real labeled corpus, not a dark web
   accuracy claim — that's why style is 36% and hard artefacts are 42%."
3. **On integrity:** "Hash-chained and tamper-evident; anchoring the chain head
   externally is what would make it tamper-proof."
4. **On impact:** "We produce a confidence-tiered lead for a human investigator,
   never an accusation."

---

# Live-demo failure drills

| If this breaks | Do this | Say this |
|---|---|---|
| On-chain query times out | Load a previously queried wallet (cached 6 h) | "That's the cached record; the live call needs venue network." |
| Server won't start | Restart, then `POST /api/ingest/seed` | "Corpus is deterministic — one call restores it." |
| Graph looks tangled | Click **Reset view**, then toggle node types | "The filter bar scopes the view." |
| A number on the deck looks off | Trust the app, not the slide | "The live app is the source of truth; the deck was generated from it." |
| Judge asks for a file you can't find | `docs/` index | Keep `PLAN.md` open in a tab as your map. |

---

# Optional pre-event fix: close the proximity gap

Q9 is the one question in this document that exists because of a gap in the code
rather than a limit of the approach. It's also the cheapest to remove.

The scoring function sums three weights (0.42 + 0.36 + 0.12 = 0.90) while the
config declares a fourth, `proximity: 0.10`, marked "reserved". Implementing it
means:

1. **Capture thread structure at ingest.** Forum dumps carry thread and parent-post
   identifiers, but the current parsers flatten them away. Add `threadId` and
   `parentId` to the normalised post record.
2. **Compute proximity per identity pair.** Co-participation: threads both
   identities posted in, weighted by how few others were in the thread (two
   handles alone in a thread is stronger evidence than two handles among fifty).
3. **Add the term to the score** in `services/attribution.js`, then re-measure the
   two known pairs and update `make_deck.py` if the numbers move.

Once done, Q9 becomes a strength rather than an admission, and the interface can
drop the word "reserved". If you can't get to it, the answer in Q9 is honest and
survivable — but implement this first, before any cosmetic polish.

