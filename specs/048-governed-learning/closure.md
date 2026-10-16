# EPIC-048 Governed Learning — closing report

**Date**: 2026-10-16 · **Branch**: `epic/048-governed-learning` (draft PR #13), merged with
`origin/main` on 2026-10-11 (`EPIC-031`, `-032`, `-038`, `-047` all on `main`) · **Stage**:
implemented; **not** promotable — six tasks remain open, each for a reason below, and no `dev`
environment exists.

**Tasks**: 141 of 147 done (`T2300`–`T2421` and the convergence phase `T2670`–`T2694`). Open:
`T2415` (Tier 2 run), `T2416` (whole-repository suite), `T2420`–`T2421` (`EPIC-039`'s `Embed`),
`T2679`–`T2680` (the Project Owner's choice on `DEF-048-003`).

## Work completed

| Phase | Tasks | Delivered |
|---|---|---|
| 1 Setup | `T2300`–`T2304` | Defect intake; `LearningModule` registered in `app.module.ts` in the change that created it; `packages/learning-contract` |
| 2 Foundational | `T2305`–`T2325` | States, scope algebra, the submission contract, supply ports and event payloads; twelve ports bound **refusing** (`R-048-20`); in-memory and PostgreSQL stores; migrations `20261010090000_epic048_steering_subject` (`A-019-1`) and `20261010090100_epic048_governed_learning` (ten append-only tables, CHECKs, the transitions guard, approver-not-source); `A-037-1`/`A-037-2` |
| 3 US1 Untrusted intake | `T2326`–`T2335` | Submission through a person's session and through `ConnectorAuthGuard` (`learning.submit`); every missing element named at once; secrets refused before anything is stored; idempotent replay; events on the source execution; a candidate is never a context source |
| 4 US2 Provenance | `T2336`–`T2345` | Evidence resolved through `EPIC-032` and shown **per reader** (withheld items counted, never shown); confidence and basis; Expert provenance; corroboration under a subject lock; conflict with approved knowledge |
| 5 US3 The gate | `T2346`–`T2363` | Eligibility (explicitly low-risk category **and** source-project scope **and** verified evidence **and** no conflict **and** `kind: new` **and** governed); every decision an `EPIC-031` `DecisionRequest`; the approver guard (a human who is none of the candidate's AI source identities); the materialiser as the only writer; `approval/v1` attestations; the sweeps |
| 6 US4 History | `T2364`–`T2371` | Supersession, deprecation, history in order, nothing deleted; knowledge routes are read-only |
| 7 US5 Reuse | `T2372`–`T2377` | Admission by scope, classification and reuse policy; `widen-scope` only by a decision; retrievability recorded honestly |
| 8 US6 Screens | `T2378`–`T2387` | The candidate detail inside the Decision Inbox (`A-031-2` renderer); the knowledge browser at `/context/knowledge`, linked from Context |
| 9 Dependency adapters | `T2388`–`T2402` | Real adapters over `EPIC-032` (`A-032-1` `resolve`), `EPIC-031` (`A-031-3` `resolutionOf`), `EPIC-038` (`A-038-2`), `EPIC-047` (`A-047-1`/`-2`); the decision fences `20261010090200_epic048_knowledge_fences`; the **Tier 1 suite** |
| 10 Polish | `T2403`–`T2413` | The four mutation proofs, **complete** (`mutation-proofs.md`); `R-048-22` performance targets; the docs conformance check; the steering examples |
| Z Closure | `T2414`, `T2417`–`T2419` | Convergence; this report; the `EPIC-027` register row, PMI-DOC-004 §6.12, `ADR-0021` Decided, PMI-DOC-006 §9 |
| 11 Convergence | `T2670`–`T2678`, `T2681`–`T2694` | Sweeps on in the shipped stack; the approver trigger refuses AI sources, not a person's own approval (`20261011100000`); an entry's provenance evidence per reader; `source-invalid` blocks automatic approval and is shown; `DEF-048-003` recorded; `widen-scope` approvals must still widen; reviewer text screened for secrets; corroboration replays compared whole (`20261011100200`); the per-execution bound holds under concurrency; status-event decisions fenced (`20261011100100`); age, corroboration evidence and workspace narrowing on the detail; the withdraw contract corrected |

### What the work of 2026-10-11 → 2026-10-16 found by running it

- **Every learning decision needs `EPIC-031`'s tenant policy to cover `learning.*`** — not only the
  automatic path: every request is automated, and `EPIC-031` refuses an automated action its policy
  does not list (`FR-DPE-030`). Without it a candidate stays `proposed`, reason
  `decision-refused-by-policy` — never approved, so safe, but the quickstart said `pending-review`.
  Quickstart prerequisites and Q12 corrected (`T2402`).
- **Q24 has no exclusion to read**: another workspace's retrieval cannot reach an entry indexed in
  its own workspace's partition, so the admission's `boundary`/`workspace:` verdict is a second,
  unit-tested fence. Quickstart corrected.
- **Two suites wrote versions naming decisions nobody recorded** — red the moment the
  `T2393` trigger existed; they now record the `EPIC-031` rows first (`learning-decisions-db.ts`).
- **The person's own approval was refused by the database** although `FR-LRN-027` excludes only AI
  sources (`T2672`–`T2673`).
- **Concurrency broke the per-execution bound**: 24 concurrent submissions from one execution were
  all recorded against a bound of 20 (`T2687`–`T2688`).

## Decisions taken during implementation

- **T2392/T2393 migration timestamps.** `20261010090000`, `…090100` and `…090200` predate
  `20261010120000_epic047_execution_identity`, already on `main`. A fresh database applies every
  migration in name order (every integration harness does, and all pass). **On an existing database
  that already has `20261010120000`, `prisma migrate deploy` applies these three out of name order** —
  they touch only this Epic's tables, `steering`'s enum and `context_reusable_authorisations`, none of
  which `…120000` touches. The three new ones (`20261011100000`–`…100200`) sort after everything on
  `main`.
- **Tier 1 in-test bindings** are limited to three gaps no Epic owns: the embedding provider (from
  Q20 on; Q15 asserts the composed refusal), Q3's unbound `EvidenceReads` (the scenario *is* the
  unbound port), and Q26's provisional execution (`EPIC-037` cannot register one, `FR-PIC-034`).
- **MP-1a's third observer** was taken through the same writer instance the mutated route holds,
  because the route's JSON dates never reached SQL; recorded as such in `mutation-proofs.md`.
- **`T2419`'s SRS edit** (PMI-DOC-004 §6.12 owner annotations, `ADR-0021` Decided, PMI-DOC-006 §9
  back-fill) was made **on the Project Owner's instruction of 2026-10-11** — "finish EPIC-039 and
  EPIC-048 and merge their PRs" — taken as the sign-off Constitution II requires.
- **Corroboration digest** is nullable (`learning_corroborations` is append-only, so earlier rows
  cannot be back-filled); a replay of such a row is still compared on its statement.

## Tests — measured, 2026-10-16 (final run, on the head this report is committed with)

Run one suite at a time on a machine shared with another agent; the whole-repository `pnpm test`
was **not** run (`T2416`, below). Nothing here is reported from an earlier run.

| Suite | Result |
|---|---|
| `pnpm -r typecheck` | clean, every package |
| `pnpm lint` | **0 errors**, 7 warnings (none in this Epic's files). The first run of 2026-10-14 found 6 errors in this Epic's `inbox-details/learning.css` (literal visual values, three token names that do not exist) — fixed |
| `pnpm test:unit` | **689 files, 6516 passed** |
| `pnpm test:arch:gated` | **39 files, 419 passed** |
| `pnpm test:governance:gated` | **77 files, 1127 passed** |
| `pnpm test:known-red` | the six declared known-reds — `T884`, `T999u`, `T1992`, `T1294`, `T792` and this Epic's **`T2415`** — all still red, as declared |
| Learning integration, `--no-file-parallelism`, 12 files (all but performance) | **191 passed** — Tier 1 34, constraints 41, fences 19, store 17, submission route 14, review route 12, knowledge route 12, resolve job 11, reachability 10, view route 8, expire job 8, flags job 5 |
| `learning-performance.spec.ts`, alone | first final run **6/7**: history@50 p95 328.8 ms against 300 (it had swung 161–922 ms with machine load: three sequential reads per version). Fixed — each version's facts are now read concurrently — then **7/7 twice**: submit 113.9 / 96.5 ms, detail 56.0 ms, review→materialised 82.5 ms (reindex ≤ 71.8 ms after), resolve sweep 33.4 ms, **history@50 119.1 and 129.0 ms**, browser@5,000 182.7 ms, admission@200 16.1 ms |
| Integration suites of the Epics this one edited (`context-*` but performance, `decision-`, `evidence-`, `experts-reachability`), `--no-file-parallelism` | **13 files, 183 passed, 3 skipped** (`context-relevance`, skipped by its own gate) |
| `learning-docs.spec.ts` with `closure.md` present | **9/9** — its owner-annotation case, skipped until today, was red on first run (it read §6.12's numbering note instead of each requirement's own line) and was corrected |
| Mutation proofs | MP-1a, MP-1b, MP-2, MP-3 complete — `mutation-proofs.md` |
| `pnpm register:update` | ran the governance project in write mode: 1130 passed, 2 failed — both `T884`, the declared known-red the ungated project includes. `governance/epic-stage-register.md` was already current and is unchanged; its derived row for `EPIC-048` reads *Analyzed · stalled · Not ready* (the same as `EPIC-047`), consistent with six open tasks |

## Work not done, and why

| Item | Why | What closes it |
|---|---|---|
| **`T2415` — the Tier 2 transcript** | The check (`learning-transcript.spec.ts`) and the harness (`e2e/tests/epic-048-learning.spec.ts`) exist; the run needs the reference-local stack, a seeded user's password, and a person's timed decision (`SC-LRN-007`). Typing the transcript would be fabrication. Declared known-red `T2415` (`governance/known-red.json`, README, `test:arch:gated`) | A person runs the harness against the stack |
| **`T2416` — whole-repository suite** | Out of bounds: another agent shares the machine and runs Testcontainers suites. Every suite was run on its own instead (table above) | Run `pnpm test` on an otherwise idle machine |
| **`T2420`–`T2421`, `DEF-048-001`** — contradiction with authoritative content | Waits for `EPIC-039`'s `Embed` capability on `main`. The safety half holds today: knowledge never overrides authoritative content; the reporting half does not exist | After `EPIC-039` merges: `/speckit-implement EPIC-048 for T2420–T2421` |
| **`T2679`–`T2680`, `DEF-048-003`** — memory policy unchecked on Expert dispatch | `EPIC-047`'s dispatch assembles without an `executionId` and before the session row exists, so `FR-LRN-055`'s check has nothing to ask. Latent while `EmbeddingPort` is unowned. Every fix crosses another Epic | **The Project Owner chooses** option A (recommended: dispatch writes the session, then assembles with `executionId`), B or C in the defect record |
| **Promotion `local → dev`** | No `dev` environment exists | — |
| **Delivery Board** | Not refreshed by this session (it does not own the board artifact). **Stale**: `EPIC-048` is 141/147, Implemented-not-promotable; `DEF-048-002` closed; `DEF-048-003` opened; `T2415` known-red added | The parent session refreshes it |

### Work deferred (restated)

- **`DEFER-048-01`** — reuse of approved knowledge **across workspaces** (the remainder of
  `BR-0118`). No owning Epic. Until one registers knowledge entries as `EPIC-038` reusable sources,
  no entry crosses a workspace: `no_cross_workspace_knowledge` refuses the authorisation row.
  Recorded against Governed Learning in the `EPIC-027` register.
- **`PP-019` → `EPIC-040`** — measuring whether approved knowledge improves outcomes.
- ***Retired* evidence is unreachable** (`RK-6`): `EPIC-032` exposes no retirement, so no citation
  can read `retired`.
- **Every entry is *not yet retrievable*** while no embedding provider exists (`R-048-13`); the
  sweep (`learning.retrievability`) retries each, and the Tier 1 suite shows indexing works the day
  one is bound.
- **Expert-sourced learning** works through the provenance read (`A-047-2`); `DEF-047-001` is
  resolved on `main`. Its supply side has `DEF-048-003`, above.

## Follow-ups raised to other Epics (`T2694`)

None of these appears in the owning Epic's own artifacts; each is recorded here so it is not lost.

| To | Follow-up | Source |
|---|---|---|
| `EPIC-031` | Put `learning.review.*` in `IRREDUCIBLY_HIGH`, so no tenant classification can make a human review auto-execute. Today this Epic's approver guard refuses an auto-executed review (`policy-auto-executed-review`), which is safe but returns the candidate to `proposed` rather than leaving it pending | `RK-5` |
| `EPIC-031` | `ActorRef` has no *agent* kind: an agent's approval through the Inbox is recorded `human` (Q14). This Epic's guard resolves the principal's kind and refuses it; the record itself still says `human` | `RK-4`, `R-048-6` |
| `EPIC-031` | Decide whether knowledge supersession belongs in `FR-DPE-012`'s non-configurable high band (today it is `learning.review.supersede`, high by this Epic's request and the example rule, not by `EPIC-031`) | spec *Follow-ups on acceptance* |
| `EPIC-019` | A steering edit (including a `learning_policy` change) writes no `EPIC-004` audit row | `R-048-3` |
| `EPIC-047` | `DEF-048-003`'s option A changes the dispatch order | `DEF-048-003` |

## Recommended next command

After `EPIC-039` merges to `main`: `/speckit-implement EPIC-048 for T2420–T2421`. After the Project
Owner chooses a fix for `DEF-048-003`: `/speckit-implement EPIC-048 for T2679–T2680`.
