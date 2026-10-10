# Tasks: Governed Learning

**Epic**: `EPIC-048` · **Branch**: `epic/048-governed-learning` · **Generated**: 2026-10-09

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/learning-api.md](./contracts/learning-api.md) ·
[contracts/learning-contract.md](./contracts/learning-contract.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T2300`–`T2421`, **122 tasks**, inside the block `T2300`–`T2499` reserved for this
Epic. `EPIC-039` holds `T2100`–`T2299`; `EPIC-047` stays below `T2100`. `T2420`–`T2421` were added by
the analysis remediation of 2026-10-09 (finding `C1`); `T2422`–`T2499` are left for convergence.
Identifiers are never renumbered once written (`G-26-15`).

**Analysis remediation (2026-10-09)**, applied before `/speckit-implement`: `I1` (T2350, T2358
amended), `C1` (`DEF-048-001`, T2420–T2421), `U1` (T2334, T2370), `C2` (T2415), `C3` (T2368), `C4`
(T2408), `V1` (T2383 folded into T2382), `V2` (T2410). See `analysis.md` *Remediation*.

**Tests are not optional here.** Constitution V: every implementation task names the test task that
must precede it and fail first. Every migration has an integration test that attempts the forbidden
write.

**Four dependencies are unmerged** (`EPIC-031`, `EPIC-032`, `EPIC-038`, `EPIC-047`). Phases 1–8
build against ports bound **refusing** (`R-048-20`). Route tests that need a decision, evidence,
context or an Expert override those ports with in-test bindings that record every call, set up
visibly in the test; the module default stays refusing. Phase 9 binds the real adapters. Every task
marked **⛔ BLOCKED** names what it waits for.

---

## Prerequisites owned by other Epics — no task IDs here

These are **not** this Epic's tasks. They are built through their owners' Spec Kit flow. Every task
that depends on one is marked **⛔ BLOCKED** and names it.

| Id | Owner | What must exist | Status on 2026-10-09 | Blocks |
|---|---|---|---|---|
| **`A-031-1`** | `EPIC-031` | `DecisionEngine.refuse({workspaceId, decisionId, by, reason})`, `POST /decisions/:id/refuse`, Reject control in the Inbox. A human may refuse; the requesting automation may refuse its own request | Not started. **Hard prerequisite, no workaround** (`R-048-5`) | T2390, T2391, T2405, T2414, T2415 |
| **`A-031-2`** | `EPIC-031` | Decision Inbox detail-renderer registry keyed by `objectRef.type` | Not started | T2384, T2385, T2415 |
| **`A-038-1`** | `EPIC-038` | `FR-CTX-015` admits `knowledge-entry` to the approved source set (spec text) | Not started | T2396, T2397, T2398, T2399 |
| **`A-047-1`** | `EPIC-047` | `FR-EXP-020` and its `CHECK` admit `memoryPolicy = governed-knowledge`. The tests, the quickstart Q2 and the frontend literal are updated | **Being built in `EPIC-047` now.** **Hard prerequisite, no workaround.** The spec's deferral clause for `FR-LRN-055`/`-056` is **not used** (`R-048-10`) | T2400, T2401, T2414 |
| **`A-047-2`** | `EPIC-047` | `ExpertProvenance.forExecution(workspaceId, executionId)` exported from `ExpertsModule` | Not started | T2400, T2401 |

**`A-038-2`** (the `knowledge-entry` source type, the sources-adapter and provenance branches, and
the `admission` port in `AssemblyPorts`) is **this Epic's work**: T2396–T2397. The other additive
edits are also this Epic's:
- `A-031-3`: T2390–T2391
- `A-032-1`: T2394–T2395
- `A-037-1`: T2320–T2321
- `A-037-2`: T2324–T2325
- `A-019-1`: T2316

### Required merge order

1. **`EPIC-032`**
2. **`EPIC-031`** + `A-031-1` + `A-031-2`
3. **`EPIC-038`** + `A-038-1`
4. **`EPIC-047`** + `A-047-1` + `A-047-2`
5. **`EPIC-048`**

Steps 1–3 may land in any order among themselves. Step 4 needs all three; step 5 needs step 4
(`R-048-21`).

---

## Phase 1: Setup

- [X] T2300 Confirm `specs/048-governed-learning/defects/README.md` (created by `/speckit-plan`) is tracked in git with the commit that carries these tasks — Constitution VI's sole defect intake, so `DOR-11` can read it — **Done**: both defect files tracked (`git ls-files`), committed with the Step 0 remediation.
- [X] T2301 [P] Write the failing reachability test `backend/tests/integration/learning-reachability.spec.ts` importing the real `AppModule` and calling `GET /learning/knowledge` — Constitution XI Tier 1; must fail before T2302 — **Done**: observed 3/3 red before T2302; no database — 401 vs 404 is the mount proof.
- [X] T2302 Create `backend/src/modules/learning/learning.module.ts` and register it in `backend/src/app.module.ts` in the same change (integration test: T2301) — `DEF-005-001` is what an unregistered module looks like — **Done**: module + `LearningService` + session `GET /learning/knowledge` (401 without a session; listing lands in T2371), registered after `ContextModule`; T2301 3/3 green.
- [X] T2303 [P] Write the failing test `packages/learning-contract/tests/package.spec.ts` asserting the package builds, exports `CANDIDATE_STATES`, and runs as its own `learning-contract` project in `vitest.workspace.ts` — **Done**: 4 assertions incl. a standalone `tsc --noEmit`; red before T2304.
- [X] T2304 Create `packages/learning-contract/` (`package.json`, `tsconfig.json`, `src/index.ts`) and add the `learning-contract` project to `vitest.workspace.ts` (test: T2303) — `R-048-2` — **Done**: package, tsconfig, `learning-contract` project in `vitest.workspace.ts` and `test:unit`; backend depends on it; T2303 4/4 green.

**Checkpoint**: a defect intake, a module the application builds, and a package with a test project.

---

## Phase 2: Foundational (blocking — no user story may start before this completes)

- [X] T2305 [P] Write failing unit tests `packages/learning-contract/tests/states.spec.ts`: — **Done**: `states.spec.ts` written red; 17 assertions incl. widening refused.
  - `CANDIDATE_STATES` is exactly the six of `FR-LRN-004`, with four terminal;
  - `APPROVER_KINDS` is exactly `human | policy` (no agent, `FR-LRN-027`);
  - `EVIDENCE_STATES` reserves `retired`;
  - there is no `unknown` member anywhere;
  - `isNarrowerOrEqual` holds for project ⊆ projects ⊆ workspace and refuses widening (`FR-LRN-028`)
- [X] T2306 Implement `packages/learning-contract/src/states.ts` and `packages/learning-contract/src/scope.ts` (unit test: T2305) — **Done**: `states.ts` (+ flag kinds, retrievability outcomes) and `scope.ts` (`parseScope`, `isNarrowerOrEqual`, `isStrictlyWider`, `scopeIncludesProject`); green.
- [X] T2307 [P] Write failing unit tests `packages/learning-contract/tests/submission.spec.ts`: — **Done**: `submission.spec.ts` written red; every missing element at once, never throws on 8 hostile inputs.
  - `parseSubmission` names **every** missing element of source, evidence, confidence and scope at once (`FR-LRN-010`);
  - it requires ≥ 1 citation, each with a sha256 digest (`FR-LRN-012`);
  - it requires `targetVersionId` for every kind but `new`;
  - `schemaVersion` must be `1`;
  - it never throws
- [X] T2308 Implement `packages/learning-contract/src/submission.ts` (unit test: T2307) — `LearningSubmissionV1`, `parseSubmission` — **Done**: `submission.ts`; citations keep only id + digest; green.
- [X] T2309 [P] Write failing unit tests `packages/learning-contract/tests/supply.spec.ts`: — **Done**: `supply.spec.ts` written red.
  - `AdmissionVerdict.reason` is a subset of `EPIC-038`'s exclusion reasons (`boundary | classification | stale | permission`);
  - `LEARNING_EVENT_KINDS` is exactly the six of `R-048-17`;
  - no event payload type carries statement text
- [X] T2310 Implement `packages/learning-contract/src/supply.ts` and `packages/learning-contract/src/events.ts` (unit test: T2309) — `KnowledgeSourceReader`, `KnowledgeAdmission` — **Done**: `supply.ts` (ports, reasons, detail prefixes, the unbound-admission verdict) and `events.ts` (`learningEventPayload` drops any statement); package 55/55 green.
- [X] T2311 [P] Write failing unit tests `backend/tests/unit/learning-ports.spec.ts`. Each of the eleven ports in `contracts/learning-contract.md` §5, bound refusing, does what its row says: — **Done**: red on the missing module, then 18/18.
  - `EvidenceReads`, `ExpertProvenance`, `LearningDecisions`, `KnowledgeIndex` throw `GovernanceSeamUnboundError` naming themselves;
  - `ReaderAccess` withholds;
  - `KnowledgeAdmission` absent excludes;
  - none answers permissively
- [X] T2312 Implement `backend/src/modules/learning/learning.tokens.ts` with the ports and their refusing bindings (unit test: T2311) — `R-048-20` — **Done**: `learning.tokens.ts`: the eleven ports, their descriptors, `refusingPorts()` and `unboundAdmission`; a twelfth, `Projects` (EPIC-006, on `main`), added for `FR-LRN-014`/`-046` — recorded as a deviation.
- [X] T2313 [P] Write failing unit tests `backend/tests/unit/learning-store.spec.ts`: — **Done**: red on the missing store; 14 assertions incl. a rolled-back transaction leaves nothing and the writer refuses when audit cannot be written.
  - workspace scoping on every read (`FR-LRN-008`);
  - candidates, citations, corroborations, transitions, terms, versions, status events, flags and retrievability are append-only;
  - the store interface given to services has **no** version-insert method;
  - only `KnowledgeWriter` has one;
  - current state and current version are the latest rows
- [X] T2314 Implement `backend/src/modules/learning/learning.store.ts` (interface + in-memory, unit tests only) and `backend/src/modules/learning/knowledge.writer.ts` (unit test: T2313) — `R-048-4` fence 1 — **Done**: `learning.store.ts` (records, `LearningStore` with no version insert, serialised in-memory store) and `knowledge.writer.ts` (`KnowledgeWriter.insertVersion`, audit-first in-memory writer); status events carry `candidateId` so a deprecation can satisfy the transitions guard — recorded in data-model; 14/14.
- [X] T2315 [P] Write the failing integration test `backend/tests/integration/learning-constraints.spec.ts`, using raw SQL around the services: — **Done**: observed 18 red before the migrations; 40/40 green after, incl. UPDATE/DELETE on all ten tables, the same-transaction `approved` rule, and approver ≠ source.
  - `UPDATE`/`DELETE` on each of the ten tables is rejected by `reject_mutation()`;
  - the transition after a terminal state is rejected;
  - `approved` without a version in the transaction is rejected;
  - review terms wider than the claim are rejected;
  - a candidate with no citation fails at commit;
  - a second candidate with the same `(workspaceId, idempotencyKey)` is rejected;
  - `approvedByKind = 'agent'` violates a `CHECK` (quickstart Q27, schema half)
- [X] T2316 Write `backend/prisma/migrations/<ts>_epic048_steering_subject/migration.sql` adding `learning_policy` to `SteeringSubject`, and the enum value in `backend/prisma/schema.prisma` (integration test: T2315) — `A-019-1`; its own migration because a new enum value cannot be used in the transaction that adds it — **Done**: `20261010090000_epic048_steering_subject` + the `SteeringSubject` value in `schema.prisma`.
- [X] T2317 Write `backend/prisma/migrations/<ts>_epic048_governed_learning/migration.sql` and the ten models in `backend/prisma/schema.prisma` (integration test: T2315). Per [data-model.md](./data-model.md) and plan *Prisma migration plan* items 2.1, 2.2 and 2.4–2.7, `reject_mutation()` is attached and never redefined. Items 2.3 (the decision foreign keys and the `knowledge_versions_require_decision` trigger) and 2.8 (the `EPIC-038` CHECK) are T2393, after merge. Never `prisma format` — **Done**: `20261010090100_epic048_governed_learning`: ten tables, CHECKs, four triggers, two views; the 038-independent source-exclusion half of item 2.3 brought forward; no `attestationId` column (data-model note); ten models without `@relation`, client regenerated; `universal-columns.spec.ts` lists the ten.
- [X] T2318 [P] Write failing integration tests `backend/tests/integration/learning-store-prisma.spec.ts` — the same behaviour as T2313 against PostgreSQL — **Done**: red on the missing adapter; 17 cases incl. audit committed in the writer's transaction, rollback on audit failure, supersession of a non-current version refused, and the source-exclusion trigger behind the adapter.
- [X] T2319 Implement `backend/src/modules/learning/learning.store.prisma.ts` (integration test: T2318) — **Done**: `learning.store.prisma.ts`: raw SQL over interactive transactions, LATERAL latest-row reads, advisory locks, keyset browse; `PrismaKnowledgeWriter` audits through the same transaction; 17/17 green.
- [X] T2320 [P] Write failing unit tests `backend/tests/unit/secret-rules.spec.ts`: — **Done**: 11 red, then green; parity with `looksLikeSecret` asserted on every sample.
  - `secretRuleMatching` returns the rule name for each pattern (`github-token`, `aws-access-key`, `private-key`, `jwt`, …) and `null` for clean text;
  - `looksLikeSecret` is unchanged for every existing case
- [X] T2321 Name each pattern and export `secretRuleMatching` from `backend/src/modules/executions/sanitisation.ts`; `looksLikeSecret` delegates (unit test: T2320) — `A-037-1`, `R-048-18` — **Done**: patterns named in `sanitisation.ts` (unchanged), `secretRuleMatching` + `SECRET_RULE_NAMES` exported, `looksLikeSecret` delegates; EPIC-037's executions unit suite still green (98/98 with T2320).
- [X] T2322 [P] Write failing unit tests `backend/tests/unit/learning-policy.spec.ts`: — **Done**: red on the missing module; 20 cases incl. nine malformed shapes refused, a retired or foreign policy is none, and the policy never reaches a constitution render.
  - a `learning_policy` steering document parses into categories, `lowRisk`, reuse and the three defaults (24 h, 30 d, 20);
  - a malformed document refuses;
  - no document means no categories, so every submission is refused naming the missing policy (`FR-LRN-003`);
  - `lowRisk` absent reads `false` (`FR-LRN-026`);
  - a new steering version is the policy change, with actor and instant (`FR-LRN-047`)
- [X] T2323 Implement `backend/src/modules/learning/learning-policy.ts` over `SteeringService` and admit subject `learning_policy` in `backend/src/modules/steering/steering.validation.ts` (unit test: T2322) — `R-048-3` — **Done**: `learning-policy.ts` (`parseLearningPolicy`, `LearningPolicy`, `LearningPolicyReader.require`, `steeringPolicySource`); `learning_policy` admitted in `steering.validation.ts` (EPIC-019's T234 updated to name it) and filtered out of `resolvedSteeringForProject` (EPIC-042) so configuration is never rendered as guidance; 110/110 across learning, steering and governance units.
- [X] T2324 [P] Write a failing unit test `packages/execution-registry-contract/tests/learning-event.spec.ts`: — **Done**: 4 red, then green.
  - `learning-candidate-recorded` is a content-class member of the union;
  - `isExecutionEventType` accepts it;
  - `classOf` is `content`;
  - it is permitted after a terminal lifecycle event
- [X] T2325 Add `learning-candidate-recorded` to `packages/execution-registry-contract/src/events.ts` and assert it in `backend/tests/integration/execution-parity.spec.ts` (unit test: T2324) — `A-037-2`. **The event count moves 29 → 30 on this branch and resolves to 31 on rebase after `EPIC-047` merges**; that conflict is expected and resolved by keeping both — **Done**: `learning-candidate-recorded` in `CONTENT_EVENTS`; T1024 now asserts 9 + 5 + 4 + 12 = 30; the parity spec records one after `completed` through the REST surface (5/5 green). Rebase onto EPIC-047 resolves to 31.

**Checkpoint**:
- types that cannot name an AI approver;
- ports that refuse;
- a store whose only knowledge insert is out of ordinary reach;
- an append-only schema;
- named secret rules;
- a policy source;
- the event type.

---

## Phase 3: User Story 1 — What an agent noticed is a candidate, not a fact (Priority: P1) 🎯 MVP

**Goal**: record observations as untrusted candidates from registered executions and people, bounded,
idempotent and screened, with every outcome an event on the execution — and no path into knowledge.

**Independent test**: quickstart Q1, Q2, Q4, Q5, Q7, Q26 — submission is recorded or refused with
reasons. A context assembly after it contains no candidate. No route writes knowledge.

- [X] T2326 [P] [US1] Write failing unit tests `backend/tests/unit/learning-submission-source.spec.ts`: — **Done**: 15 cases, red with the service absent; shared recording ports in `tests/helpers/learning-ports.ts`.
  - an unregistered execution is refused (`FR-LRN-005`);
  - a submission after the terminal event is accepted within 24 h as `late` and refused after (`FR-LRN-005`);
  - a person source names the user (`FR-LRN-006`);
  - the 21st submission for one execution is refused (`FR-LRN-007`);
  - another workspace's execution is refused and its candidates are invisible (`FR-LRN-008`);
  - a provisional execution records `proposed` and requests no decision (`FR-LRN-063`);
  - a retried `idempotencyKey` returns the original (`FR-LRN-061`)
- [X] T2327 [US1] Implement `backend/src/modules/learning/submission.service.ts` — intake, source checks, bound, idempotency and the `proposed` transition (unit test: T2326) — **Done**: `submission.service.ts`: parse → replay (a reused key with different content is `409`) → policy/category → project/source/grace/bound → scope/target → evidence → record under the subject lock → decision hook unless provisional; 15/15.
- [X] T2328 [P] [US1] Write failing unit tests `backend/tests/unit/learning-secret-screen.spec.ts`: — **Done**: 11 cases, red on the missing module; six fields, value never echoed, no row after, unbound → 503.
  - statement, subject, confidence basis and every free-text field are screened before any write;
  - a match is refused naming the rule and field, never the value;
  - **no** row exists afterwards (`FR-LRN-018`);
  - `SecretScreen` unbound refuses
- [X] T2329 [US1] Implement `backend/src/modules/learning/secret.screen.ts` and call it first in `submission.service.ts` (unit test: T2328) — **Done**: `secret.screen.ts` (every string leaf by path, over `secretRuleMatching`); called first in `submit`, before parsing; 26/26 with T2326.
- [X] T2330 [P] [US1] Write failing unit tests `backend/tests/unit/learning-execution-events.spec.ts`: — **Done**: 9 cases, 6 red first; `corroborated` is asserted with corroboration in T2342, where it is produced.
  - `submitted`, `late-submitted`, `refused`, `bound-exceeded` and `corroborated` are appended to the source execution through `Executions.appendEvent` with an idempotency key;
  - payloads carry no statement text;
  - a person-sourced candidate appends nothing (`FR-LRN-060`)
- [X] T2331 [US1] Implement event recording in `submission.service.ts` (unit test: T2330) — **Done**: `recordOutcome` (submitted / late-submitted, keyed per candidate, re-appended on replay) and best-effort `recordRefusal` (refused / bound-exceeded / memory-policy-refused, only for a registered execution); payloads through `learningEventPayload`; 35/35 across the three submission suites.
- [X] T2332 [P] [US1] Write the failing architecture test `backend/tests/architecture/learning-single-write-path.spec.ts`: — **Done**: 8 assertions over every backend source file; red on the missing `supply.ts` (and on an over-broad `insertVersion` match into EPIC-045's artifact store, scoped to code that can reach the writer).
  - only `materialiser.ts` imports `knowledge.writer.ts`;
  - no controller or job maps to a knowledge write;
  - `supply.ts` reads only knowledge versions, never candidates (`FR-LRN-001`, `FR-LRN-002`, `SC-LRN-001`; MP-1a's guard)
- [X] T2333 [US1] Implement the `KnowledgeSourceReader` half of `backend/src/modules/learning/supply.ts` over versions only (architecture test: T2332) — **Done**: `KnowledgeReader` over `KnowledgeReads` — a store narrowing with no candidate read; current / superseded / deprecated answered from status rows; 8/8.
- [X] T2334 [P] [US1] Write failing route tests `backend/tests/integration/learning-submission-route.spec.ts` against the composed module: — **Done**: 12 cases against `AppModule` + PostgreSQL + a real credential and execution; observed red (no ports token), then green. Q3 asserted with the default refusing binding before `EvidenceReads` is rebound to a recorder; Q26 wraps the real `Executions` port for one id (EPIC-037 cannot register a provisional execution on `main`). U1's `401`s here; its `404` for another workspace's candidate is asserted with the read route in T2344.
  - `POST /learning/candidates` (session);
  - `POST /projects/:projectId/learning/candidates` through `ConnectorAuthGuard` with scope `learning.submit`;
  - quickstart Q1, Q2, Q4, Q5, Q26;
  - `503` naming `EvidenceReads` while unbound (Q3);
  - identity fields in the body are ignored;
  - no session → `401`; a candidate of another workspace → `404` (analysis finding `U1`, spec Assumption 11)
- [X] T2335 [US1] Implement `backend/src/modules/learning/learning.controller.ts` (submission) and `backend/src/modules/learning/learning-connector.controller.ts`, registering scope `learning.submit` with `registerConnectorScope` (integration test: T2334) — **Done**: session + connector controllers (body identity stripped; `200`/`201` from the outcome), `main-ports.ts` (Executions, Principals, Audit, Projects over their owners' public services), module wiring with the four unmerged ports refusing; `learning.submit` registered — EPIC-041/043's scope tests now name sixteen; backend `tsc` clean.

**Checkpoint**: agents and people can submit; nothing they submit is, or can become, knowledge by
any route.

---

## Phase 4: User Story 2 — A candidate carries where it came from and how sure it is (Priority: P1)

**Goal**: full provenance — Expert source, cited evidence with live state, withholding, stated
confidence, claimed scope, corroboration and conflict.

**Independent test**: quickstart Q1, Q8, Q25 and the `GET /learning/candidates/:id` view — refuse a
candidate with no evidence; reconstruct a complete one's source, evidence, confidence and scope from
the record alone.

- [X] T2336 [P] [US2] Write failing unit tests `backend/tests/unit/learning-provenance.spec.ts`: — **Done**: 13 cases, 2 red first (provenance not recorded, unbound port not consulted).
  - an Expert execution records Expert, contract version id and number through `ExpertProvenance` (`FR-LRN-011`);
  - `ExpertProvenance` unbound refuses an Expert-sourced submission `503` and leaves people's submissions unaffected;
  - stated confidence is stored as given and never raised (`FR-LRN-013`);
  - claimed scope is stored as claimed, `projects` requires ≥ 2 projects of the workspace (`FR-LRN-014`, US2-5)
- [X] T2337 [US2] Implement provenance capture in `submission.service.ts` (unit test: T2336) — **Done**: `source()` asks `ExpertProvenance` for every execution-sourced submission — `503` naming it while unbound, so in the composed app every agent submission is refused until `A-047-2` (as `R-048-10` says); the T2334 route suite now asserts that `503` first and binds the port visibly; 100/100 learning units, 13/13 route.
- [X] T2338 [P] [US2] Write failing unit tests `backend/tests/unit/learning-memory-policy.spec.ts`: — **Done**: 7 cases, 5 red first; in-test `ExpertProvenance` (the real one is T2401).
  - an Expert whose contract version declares `none` is refused and `memory-policy-refused` is appended;
  - `governed-knowledge` is accepted;
  - nothing is stored per Expert (`FR-LRN-055`, `FR-LRN-056`, `SC-LRN-009`).
  These use an in-test `ExpertProvenance`. The real one is T2401, which waits on `A-047-1`/`A-047-2`
- [X] T2339 [US2] Implement the memory-policy check in `submission.service.ts` (unit test: T2338) — **Done**: only `governed-knowledge` contributes; `none` or any unrecognised value is refused `400` with `memory-policy-refused` on the execution; the store has no Expert-keyed state; 107/107 learning units.
- [X] T2340 [P] [US2] Write failing unit tests `backend/tests/unit/learning-evidence-view.spec.ts`: — **Done**: 10 cases, red on the missing module.
  - each citation is `verified`, `integrity-failed` (failed integrity **or** cited digest ≠ stored), `unresolvable`, or `withheld` for a reader `AccessControlEvidencePolicy` refuses;
  - withheld carries no id or digest, and `withheldEvidenceCount` is set (`FR-LRN-015`, `FR-LRN-016`, US2-3, US2-4);
  - eligibility reads the **unfiltered** state (`R-048-9`);
  - `retired` is never produced (`R-048-8`)
- [X] T2341 [US2] Implement `backend/src/modules/learning/evidence.view.ts` over `EvidenceReads` and `ReaderAccess` (unit test: T2340) — **Done**: `evidence.view.ts`: `unfiltered` (eligibility's view; `EvidenceReads` unbound reads `unresolvable`, never `verified`) and `forReader` (withheld = no id, no digest, counted; access asked of the attested target; `ReaderAccess` unbound withholds all); 117/117 learning units.
- [X] T2342 [P] [US2] Write failing unit tests `backend/tests/unit/learning-corroboration.spec.ts`: — **Done**: 10 cases, 8 red first; includes T2330's deferred `corroborated` event (on the corroborating execution) and a concurrent pair under the subject lock.
  - a submission whose `subjectKey` matches an open candidate attaches as a corroboration with its source and evidence, and creates no second candidate;
  - two concurrent submissions of one subject produce one candidate (advisory lock);
  - a subject matching a **current** approved entry without `supersede` is `conflicting` and names it (`FR-LRN-017`, `FR-LRN-036`);
  - corroboration never changes eligibility
- [X] T2343 [US2] Implement corroboration and conflict detection in `submission.service.ts` (unit test: T2342) — `R-048-15` — **Done**: corroboration inside the subject-locked transaction (same subject, kind and target; own idempotency replay); `findConflict` derives `FR-LRN-036` from the current version on the subject; 127/127 learning units.
- [X] T2344 [P] [US2] Write failing route tests `backend/tests/integration/learning-candidate-view-route.spec.ts`: — **Done**: 8 cases through `AppModule`; 6 red first. Q8 corroborates through the connector route; the default `ReaderAccess` withholds and a visible in-test grant reveals; supersedes side by side; conflict named; another workspace's session gets `404`, no session `401` (U1).
  - `GET /learning/candidates/:id` returns everything `FR-LRN-071` lists in one response, including corroborations and the side-by-side superseded entry;
  - `404` for another workspace;
  - Q8 through the real routes
- [X] T2345 [US2] Implement `GET /learning/candidates/:id` in `learning.controller.ts` (integration test: T2344) — **Done**: `candidate.view.ts` (`CandidateViewService`: evidence per reader incl. corroborations', source, conflict, target version, decision read from EPIC-031 or marked unavailable, open flags) and `GET /learning/candidates/:id`; eligibility joins the view once T2347 exists.

**Checkpoint**: a reviewer can trace any candidate without asking the agent's operator.

---

## Phase 5: User Story 3 — Knowledge is approved by policy or by a person, never by the agent that proposed it (Priority: P1)

**Goal**: the gate — eligibility, the `EPIC-031` request, the approver guard, the single materialiser,
review with narrowing, rejection, expiry, withdrawal and the approval attestation.

**Independent test**: quickstart Q6, Q9–Q18:
- a low-risk candidate is auto-approved with an explanation and an attestation;
- any other waits for a human;
- an AI's approval is never accepted.

Built against in-test `LearningDecisions` bindings. Tests that need `EPIC-031`'s real engine are
T2402 and T2405–T2407.

- [X] T2346 [P] [US3] Write failing unit tests `backend/tests/unit/learning-eligibility.spec.ts`. The automatic path is chosen only when **all** hold: — **Done**: 19 cases, red on the missing module; every condition alone fails it, all six named together, SC-LRN-008 over every category × kind.
  - the category exists and is declared `lowRisk: true`;
  - the scope is exactly the source project;
  - every citation is `verified`;
  - there is no conflict;
  - the kind is `new`;
  - the execution is governed.

  Each failing condition is named in `failedConditions`. With no category opted in, 100% route to review (`FR-LRN-022`, `FR-LRN-026`, `FR-LRN-034`, `SC-LRN-008`; MP-2's target)
- [X] T2347 [US3] Implement `backend/src/modules/learning/eligibility.ts` (unit test: T2346) — **Done**: `eligibility.ts` — pure `eligibilityOf`, six named conditions; a reconciled provisional execution counts as governed (`FR-LRN-063`).
- [X] T2348 [P] [US3] Write failing unit tests `backend/tests/unit/learning-decision-requester.spec.ts`. The `DecisionRequest`: — **Done**: 13 cases, red on the missing module.
  - targets `{type: 'learning-candidate', id}`;
  - uses `objectVersion = sha256(canonical core)`;
  - uses `actionType` `learning.approve.<category>` only on the automatic path, else `learning.review.<kind>`;
  - uses actor `{kind: 'automation', id: 'learning-intake'}`, `requestedBy` the submitter, `triggeredBy` the candidate;
  - carries `proposedClass` only when the submitter proposed one (`FR-LRN-023`).

  Outcomes:
  - `pending` → `pending-review`;
  - `refused` (incl. automation not permitted, medium without gates) → stays `proposed` with the explanation;
  - an unreachable engine → `proposed` with `decision-path-unavailable` and never approved (`FR-LRN-020`, `FR-LRN-021`, `FR-LRN-024`, `FR-LRN-030`)
- [X] T2349 [US3] Implement `backend/src/modules/learning/decision.requester.ts` and call it from `submission.service.ts` (unit test: T2348) — `R-048-5`, `R-048-12` — **Done**: `decision.requester.ts`: the `DecisionRequest` shape, `actionTypeFor`, outcomes (pending → pending-review; refused/exception → proposed with the explanation; unreachable or unbound → proposed `decision-path-unavailable`; auto-executed → handed to the resolution path), `attempts` = distinct decisions (I1); wired as the submission hook and as the candidate view's eligibility.
- [X] T2350 [P] [US3] Write failing unit tests `backend/tests/unit/learning-approver-guard.spec.ts`. — **Done**: 16 cases, red on the missing module; the verdicts. The I1 consequence of a refusal (back to `proposed`, flag, audit) is the materialiser's and is asserted in T2352.

  Accepted:
  - `approved` + `human` + `decidedBy` resolving to a `User` who is not an AI source identity;
  - `auto-executed` on a `learning.approve.*` request by `learning-intake`.

  **Not** accepted:
  - `approved` by `{kind: 'human', id: <agent principal>}`, as `EPIC-031`'s HTTP service records it;
  - approval by the candidate's own agent, Expert or corroborating agent;
  - `auto-executed` on any `learning.review.*` (flag `policy-auto-executed-review`);
  - `Principals` unbound.

  Each refusal transitions the candidate **back to `proposed`** with reason `decision-not-accepted` (or `policy-auto-executed-review`), raises a `knowledge_flags` row naming it, and writes an audit record — never leaving it in `pending-review` with a resolved decision (`FR-LRN-027`, `R-048-6` as amended for analysis finding `I1`; MP-3's target)
- [X] T2351 [US3] Implement `backend/src/modules/learning/approver.guard.ts` over `Principals` (unit test: T2350) — **Done**: `approver.guard.ts`: `ApproverGuard.judge` over `Principals` — a 'human' approval must resolve to a User and to none of the AI source identities (`aiSourceIdentities`: source agent, Expert, corroborating agents and Experts); `auto-executed` accepted only for `learning.approve.*` by `learning-intake`; `Principals` unbound refuses.
- [X] T2352 [P] [US3] Write failing unit tests `backend/tests/unit/learning-materialiser.spec.ts`: — **Done**: 20 cases, red on the missing module; includes I1 (back to `proposed`, flag, audit), closures, deprecation without a version, widening, and Audit-unbound writes nothing.
  - writes a version only on an accepted resolution;
  - writes version + `current` status + `approved` transition in one transaction;
  - uses review terms when they exist, else the proposed statement and claimed scope;
  - records both proposed and approved forms (`FR-LRN-028`);
  - takes classification from the terms, else the category default, else `undetermined`;
  - a supersession marks the predecessor `superseded` naming the successor in the same transaction;
  - every materialisation, supersession, deprecation and scope change writes an `EPIC-004` audit record through `Audit`, and `Audit` unbound refuses (`FR-LRN-031`, `FR-LRN-032`, `FR-LRN-038`, `FR-LRN-062`; MP-1b's target)
- [X] T2353 [US3] Implement `backend/src/modules/learning/materialiser.ts` — the only caller of `KnowledgeWriter` (unit test: T2352) — **Done**: `materialiser.ts`: `applyResolution` for every outcome; the guard's verdict gates `KnowledgeWriter.insertVersion` (the `if (!verdict.accepted)` line MP-1b removes); `target-not-current` on a lost race; post-commit hooks for attestation and reindex; the module injects `KNOWLEDGE_WRITER` into `Materialiser` alone (T2332 now asserts exactly that) and the requester hands auto-executed decisions to it; 195/195 learning units.
- [X] T2354 [P] [US3] Write failing unit tests `backend/tests/unit/learning-review.spec.ts`: — **Done**: 15 cases, red on the missing module; terms observed in the store at the moment `approve` is called.
  - approve writes terms **before** calling `approve`;
  - the scope must be ⊆ claimed (`400`);
  - reject requires a reason and calls `refuse` (`FR-LRN-029`);
  - a non-human principal or an AI source identity is refused `403` and audited, and the decision stays pending;
  - a human submitter's self-approval follows `EPIC-031`'s refusal (`FR-LRN-027`, `FR-LRN-028`)
- [X] T2355 [US3] Implement `backend/src/modules/learning/review.service.ts` (unit test: T2354) — **Done**: `review.service.ts`: 404 / 409 / human-reviewer gate (403 audited, decision left pending; `Principals` unbound 503) / reject needs a reason → `refuse` / approve writes terms (scope ⊆ claimed, identical retry reused) then `approve` → materialiser.
- [X] T2356 [P] [US3] Write failing unit tests `backend/tests/unit/learning-attestation.spec.ts`: — **Done**: 5 cases, red on the missing module.
  - every approval contributes `approval/v1` with `source.uri = 'pmi:learning'`, attached to the decision, attesting the entry and version, with the predicate body of `R-048-19`;
  - a contribution failure flags `attestation-missing` and does not roll back the version (`FR-LRN-025`)
- [X] T2357 [US3] Implement `backend/src/modules/learning/attestation.ts` and call it after materialisation (unit test: T2356) — **Done**: `attestation.ts`: `approvalAttestation` (post-commit hook; `approval/v1`, source `pmi:learning`, attached to the decision, attesting entry + version, the R-048-19 body and the version digest) flags `attestation-missing` on failure; `retryMissingAttestations` clears it with a new row; store gains `openFlags`; wired into the materialiser.
- [X] T2358 [P] [US3] Write failing job tests `backend/tests/integration/learning-resolve-job.spec.ts`, driven through the jobs runner: — **Done**: 10 cases through `LearningJobs.run` on the composed app + PostgreSQL, red first (no runner). Resolve: a human approval in 031's Inbox materialises; Q14 (an agent recorded as human) is refused, flagged, back to `proposed`; rejection closes; per-item failure is reported, not thrown. Request-pending: outage recovery without duplicate rows, reconciliation, the I1 re-request capped at three decisions, no retry of a policy refusal.
  - `learning.resolve-decisions` reads `resolutionOf` for `pending-review` candidates and materialises or rejects;
  - `learning.request-pending` requests decisions after reconciliation and after an outage (`R-048-7`, `FR-LRN-063`);
  - it requests a **new** decision for a candidate the approver guard returned to `proposed`, and stops after three decision attempts in all, leaving it `proposed` and flagged (`R-048-6` as amended for `I1`; `RK-5`)
- [X] T2359 [US3] Implement `learning.resolve-decisions` and `learning.request-pending` in `backend/src/modules/learning/learning.jobs.ts` (integration test: T2358) — **Done**: `learning.jobs.ts` (`LearningJobs.run` under `runWithLimits`; resolve-decisions, request-pending) and `learning.sweeps.ts` (the schedule — **off unless `PMI_LEARNING_SWEEPS=on`**, a recorded deviation; unit-tested); the requester no longer repeats an identical `proposed` row.
- [X] T2360 [P] [US3] Write failing job tests `backend/tests/integration/learning-expire-job.spec.ts`: — **Done**: 8 cases on the composed app, all red first: window respected, pending → `refuse(kind: expired)` then `expired`, proposed expires with no decision to close, unrefusable (A-031-1 absent) reported and left; withdraw by the submitter only (403 others / agent's candidate), 409 terminal, 404 other workspace, 401 no session; the transitions stay inspectable through the candidate view.
  - past the review window a candidate reads `expired`, not `rejected`;
  - it is refused through `LearningDecisions.refuse` with reason `expired`;
  - `POST /learning/candidates/:id/withdraw` reads `withdrawn`;
  - both are inspectable (`FR-LRN-030`, US1 Edge Case)
- [X] T2361 [US3] Implement `learning.expire` and the withdraw route in `learning.jobs.ts` and `learning.controller.ts` (integration test: T2360) — **Done**: `learning.expire` in `learning.jobs.ts` (window from the policy, default 30 d, `asOf` for the judged instant) and `ReviewService.withdraw` + `POST /learning/candidates/:id/withdraw`.
- [X] T2362 [P] [US3] Write failing route tests `backend/tests/integration/learning-review-route.spec.ts` against the composed module, with recording in-test `LearningDecisions`, `EvidenceReads` and `Principals`: — **Done**: 12 cases on the composed app, 7 red first: 503 naming LearningDecisions, Q6, Q9 (policy approval, attestation, explanation through the view), Q10, Q11 (policy edited through EPIC-019's PATCH; an auto-executed *review* is not accepted), Q12, Q13 (the credential's own principal → 403, audited), Q15 (both forms kept; `not-yet-retrievable`), Q16, Q17, 409 on a second decision; the review route answers neither the connector path nor a bearer credential.
  - quickstart Q6, Q9–Q17;
  - `503` naming `LearningDecisions` while unbound;
  - the review route is absent from the connector guard
- [X] T2363 [US3] Implement `POST /learning/candidates/:id/review` in `learning.controller.ts` (integration test: T2362) — **Done**: `POST /learning/candidates/:id/review` (session only, 200) → `ReviewService.review`, which now answers retrievability for an approval (`not-yet-retrievable — indexing not attempted` until T2377).

**Checkpoint**: the gate exists, and the only way through it is a decision that a human or explicit
policy took.

---

## Phase 6: User Story 4 — Approved knowledge keeps its history (Priority: P2)

**Goal**: supersession, deprecation and flags as human-reviewed, append-only history, readable in
order.

**Independent test**: quickstart Q19, Q20, Q29 (backend).

- [X] T2364 [P] [US4] Write failing unit tests `backend/tests/unit/learning-supersession.spec.ts`: — **Done**: 8 cases end to end (submission → requester → materialiser). **Green on first run, not observed red**: the behaviour had already landed with T2327 (`checkTarget`), T2347 (`kind-not-new`) and T2353 (status events) — recorded as a Constitution V deviation.
  - `supersede` and `deprecate` candidates always take `learning.review.*` (`FR-LRN-034`, US4-5);
  - an approved deprecation writes `deprecated` with reason, actor and instant and no new version (`FR-LRN-033`);
  - a target that is not the current version is refused `400`;
  - an approved version is never edited (`FR-LRN-031`)
- [X] T2365 [US4] Implement supersession and deprecation in `submission.service.ts` and `materialiser.ts` (unit test: T2364) — **Done**: no new code was needed — supersession, deprecation and the current-version check exist in `submission.service.ts` and `materialiser.ts`; this task's suite pins them through the full path.
- [X] T2366 [P] [US4] Write failing unit tests `backend/tests/unit/learning-knowledge-service.spec.ts`: — **Done**: 7 cases end to end, red on the missing module: ordered history incl. a deprecation and cleared flags, provenance incl. an Expert source and what it replaces, four filters, bad filters refused.
  - history lists every version, the candidate and decision behind each, every status event and flag in order (`FR-LRN-035`);
  - browse filters by project, scope, category and status (`FR-LRN-073`);
  - provenance answers *where from, who approved, what it replaces* from the record alone (`SC-LRN-006`);
  - nothing is deleted (`FR-LRN-039`)
- [X] T2367 [US4] Implement `backend/src/modules/learning/knowledge.service.ts` (unit test: T2366) — **Done**: `knowledge.service.ts`: `browse` (rows with status, retrievability, open flags), `entry` (current + provenance), `history` (versions with candidate, decision, status events, flags; events ordered by the approval that caused them).
- [ ] T2368 [P] [US4] Write failing job tests `backend/tests/integration/learning-flags-job.spec.ts`:
  - `learning.flags` raises `evidence-changed` when a cited item turns `integrity-failed` or `unresolvable`;
  - it raises `source-invalid` on `validation-failed`, `transition-refused`, `transition-inconsistent` or `execution-reconciliation-conflicted` (`R-048-17`);
  - a later row clears a flag;
  - an **open** candidate (`proposed`/`pending-review`) from an invalid source is flagged `source-invalid` too, so its reviewer sees it (spec Edge Case; analysis finding `C3`);
  - **status never changes** (`FR-LRN-037`)
- [ ] T2369 [US4] Implement `learning.flags` in `learning.jobs.ts` (integration test: T2368)
- [ ] T2370 [P] [US4] Write failing route tests `backend/tests/integration/learning-knowledge-route.spec.ts`:
  - `GET /learning/knowledge`, `/:entryId`, `/:entryId/history`;
  - there is **no** `PUT`, `PATCH` or `DELETE` under `/learning/knowledge` (`FR-LRN-031`, `FR-LRN-042`);
  - Q19 and Q29 through the real routes;
  - no session → `401`; another workspace's entry → `404` (analysis finding `U1`)
- [ ] T2371 [US4] Implement the knowledge routes in `learning.controller.ts` (integration test: T2370)

**Checkpoint**: knowledge changes without forgetting.

---

## Phase 7: User Story 5 — Knowledge travels only as far as policy lets it (Priority: P2)

**Goal**: admission by scope, classification, reuse policy and workspace; widening by decision;
retrievability recorded honestly.

**Independent test**: quickstart Q21–Q24, with in-test `KnowledgeAdmission` consumers until T2399.

- [ ] T2372 [P] [US5] Write failing unit tests `backend/tests/unit/learning-admission.spec.ts`. The verdict matrix of `R-048-11`:
  - project scope elsewhere → `boundary` with `scope:`;
  - classification not permitted → `classification`;
  - undetermined outside its origin → `classification`;
  - reuse policy disallows → `boundary` with `reuse-policy:`;
  - another workspace → `boundary` with `workspace:`;
  - superseded or deprecated → `stale`;
  - archived project → `boundary` with `archived:`;
  - an Expert declaring `none` → `permission` with `memory-policy:`.

  The batch for 200 candidates makes one store read (`FR-LRN-040`, `FR-LRN-041`, `FR-LRN-043`, `FR-LRN-044`, `FR-LRN-045`, `FR-LRN-046`, `FR-LRN-055`)
- [ ] T2373 [US5] Implement the `KnowledgeAdmission` half of `backend/src/modules/learning/supply.ts` (unit test: T2372)
- [ ] T2374 [P] [US5] Write failing unit tests `backend/tests/unit/learning-widen-scope.spec.ts`:
  - `widen-scope` must be wider than the current scope;
  - it always takes human review;
  - when approved it creates a new version and supersedes the old;
  - no other path changes scope (`FR-LRN-042`, US5-5)
- [ ] T2375 [US5] Implement scope widening in `submission.service.ts` and `materialiser.ts` (unit test: T2374)
- [ ] T2376 [P] [US5] Write failing unit tests `backend/tests/unit/learning-retrievability.spec.ts`:
  - every approval, supersession, deprecation and widening calls `KnowledgeIndex.reindex` with `knowledge-entry`, entry id and version id (`FR-LRN-051`);
  - `indexed`/`current` → `retrievable`;
  - `503` or `400` → `not-yet-retrievable` with the reason;
  - no attempt reads *not yet retrievable — indexing not attempted*, never retrievable (`FR-LRN-053`)
- [ ] T2377 [US5] Implement `backend/src/modules/learning/retrievability.ts` and the `learning.retrievability` job in `learning.jobs.ts` (unit test: T2376)

**Checkpoint**: every reuse decision is recorded where `EPIC-038` already shows exclusions.

---

## Phase 8: User Story 6 — A reviewer can work the queue and read the knowledge base (Priority: P3)

**Goal**: the candidate detail inside `EPIC-031`'s Decision Inbox and the knowledge browser inside
`EPIC-038`'s Context area — no new navigation area.

**Independent test**: quickstart Q28, Q29 (component level here; Tier 2 in T2415).

- [ ] T2378 [P] [US6] Write failing component tests `frontend/tests/unit/pages/LearningCandidateDetail.spec.tsx`:
  - statement, category, source session, evidence with state, confidence and basis, claimed scope, corroborations, conflict, all on one view (`FR-LRN-071`, `UX-0032`);
  - superseded entry and proposal side by side (`FR-LRN-072`);
  - agent-proposed vs approved content visually distinct (`FR-LRN-074`);
  - withheld evidence shown as a count;
  - approve with narrowing and editing, and reject with a reason;
  - readable at 360px (`FR-LRN-075`)
- [ ] T2379 [US6] Implement `frontend/src/pages/inbox-details/LearningCandidateDetail.tsx` and its calls in `frontend/src/services/api.ts` (unit test: T2378)
- [ ] T2380 [P] [US6] Write failing component tests `frontend/tests/unit/pages/KnowledgeBrowser.spec.tsx`:
  - filter by project, scope, category and status (`FR-LRN-073`);
  - current, superseded, deprecated and not-yet-retrievable are visually distinct (`FR-LRN-074`);
  - history readable in order;
  - the item is labelled *approved knowledge, not authoritative* (`FR-LRN-052`);
  - 360px
- [ ] T2381 [US6] Implement `frontend/src/pages/KnowledgeBrowser.tsx` and its calls in `frontend/src/services/api.ts` (unit test: T2380)
- [ ] T2382 [P] [US6] Write the failing architecture test `backend/tests/architecture/learning-no-new-area.spec.ts`:
  - `frontend/src/shell/areas.ts` has no entry owned by `EPIC-048`;
  - the `learning` module declares no workflow type (`FR-LRN-070`);
  - the two views live where the plan puts them (`pages/inbox-details/`, `pages/KnowledgeBrowser.tsx`) — the confirmation T2383 used to carry (analysis finding `V1`)
- [ ] T2383 [US6] **Folded into T2382** (analysis finding `V1`): it produced no code, and its PMI-DOC-006 §9 back-fill text moves to T2419, which writes it. Ticked when T2382 passes
- [ ] T2384 [P] [US6] ⛔ **BLOCKED on `EPIC-031` merge + `A-031-2`** — Write failing tests in `frontend/tests/unit/pages/DecisionInbox.spec.tsx`:
  - an entry whose `objectRef.type` is `learning-candidate` renders `LearningCandidateDetail`;
  - every other type renders the plain row unchanged
- [ ] T2385 [US6] ⛔ **BLOCKED on `EPIC-031` merge + `A-031-2`** — Register `LearningCandidateDetail` for `learning-candidate` in `EPIC-031`'s renderer registry (unit test: T2384)
- [ ] T2386 [P] [US6] ⛔ **BLOCKED on `EPIC-038` merge** — Write failing tests in `frontend/tests/unit/shell/routes.spec.tsx` and `frontend/tests/unit/pages/Context.spec.tsx`:
  - `/context/knowledge` resolves to one owner as a `SUB_VIEWS` entry;
  - the Context page links to it (`FR-LRN-070`, `UX-0003`)
- [ ] T2387 [US6] ⛔ **BLOCKED on `EPIC-038` merge** — Add `/context/knowledge` to `SUB_VIEWS` in `frontend/src/shell/routes.tsx` and the link in `frontend/src/pages/Context.tsx` (unit test: T2386)

**Checkpoint**: both views exist; T2385 and T2387 make them reachable once their hosts are on `main`.

---

## Phase 9: Dependency adapters — ⛔ **BLOCKED until `EPIC-032`, `EPIC-031`, `EPIC-038` and `EPIC-047` merge in the stated order, with their prerequisites**

- [ ] T2388 [P] ⛔ **BLOCKED on `EPIC-032` merge** — Write failing tests `backend/tests/unit/learning-adapter-attestations.spec.ts`:
  - `ApprovalAttestations` calls `EvidenceService.contribute` with the platform source and the body of `R-048-19`;
  - a fault flags rather than throwing into the approval
- [ ] T2389 ⛔ **BLOCKED on `EPIC-032` merge** — Implement `backend/src/modules/learning/adapters/attestations.adapter.ts` and bind it (unit test: T2388)
- [ ] T2390 [P] ⛔ **BLOCKED on `EPIC-031` merge + `A-031-1`** — Write failing tests `backend/tests/unit/learning-adapter-decisions.spec.ts`:
  - `decide`, `approve`, `refuse` and `resolutionOf` pass straight to `DecisionEngine`;
  - a test in `EPIC-031`'s suite asserts the `resolutionOf` export (`A-031-3`);
  - an architecture assertion checks that the request shape is `packages/decision-contract`'s `DecisionRequest`
- [ ] T2391 ⛔ **BLOCKED on `EPIC-031` merge + `A-031-1`** — Export `resolutionOf` from `DecisionEngine` (`A-031-3`), and implement `backend/src/modules/learning/adapters/decisions.adapter.ts` and bind it (unit test: T2390)
- [ ] T2392 [P] ⛔ **BLOCKED on `EPIC-031` and `EPIC-038` merge** — Write failing integration tests `backend/tests/integration/learning-knowledge-fences.spec.ts`:
  - inserting a version whose decision is `pending`, `refused`, another workspace's, or another candidate's is refused by `knowledge_versions_require_decision`;
  - a `human` version over an `automation`-kind row is refused;
  - an `approvedBy` equal to the candidate's source is refused;
  - a `context_reusable_authorisations` row for `knowledge-entry` violates the CHECK (Q24, Q27)
- [ ] T2393 ⛔ **BLOCKED on `EPIC-031` and `EPIC-038` merge** — Write `backend/prisma/migrations/<ts>_epic048_knowledge_fences/migration.sql`: the `decisionId`/`resolvingDecisionId` foreign keys to `policy_decisions`, the `knowledge_versions_require_decision` trigger, and `no_cross_workspace_knowledge` on `context_reusable_authorisations` — plan items 2.3 and 2.8 (integration test: T2392)
- [ ] T2394 [P] ⛔ **BLOCKED on `EPIC-032` merge** — Write failing tests:
  - in `EPIC-032`'s suite, `backend/tests/unit/evidence-resolve.spec.ts`: `resolve(workspaceId, ids)` returns `AttachedEvidence` + attested target per id and absent for another workspace;
  - `backend/tests/unit/learning-adapter-evidence.spec.ts`
- [ ] T2395 ⛔ **BLOCKED on `EPIC-032` merge** — Add `EvidenceService.resolve` in `backend/src/modules/evidence/evidence.service.ts` (`A-032-1`), and implement `backend/src/modules/learning/adapters/evidence.adapter.ts` with `ReaderAccess` over `AccessControlEvidencePolicy` (unit test: T2394)
- [ ] T2396 [P] ⛔ **BLOCKED on `EPIC-038` merge + `A-038-1`** — Write failing tests in `EPIC-038`'s suites:
  - `knowledge-entry` is in `APPROVED_SOURCE_TYPES`;
  - the sources adapter serves it through `KnowledgeSourceReader`;
  - provenance reads `current`/`superseded`;
  - `AssemblyPorts.admission` is consulted after `judgeBoundary` and before `access.mayRead`, and its verdicts become exclusions with existing reasons;
  - an absent admission port excludes knowledge with `permission` (`A-038-2`)
- [ ] T2397 ⛔ **BLOCKED on `EPIC-038` merge + `A-038-1`** — Make the `A-038-2` edits in `backend/src/modules/context/retrieval/index.service.ts`, `backend/src/modules/context/sources.adapter.ts`, `backend/src/modules/context/provenance.service.ts` and `backend/src/modules/context/assembly.service.ts` (unit tests: T2396) — this Epic's own work, not a prerequisite
- [ ] T2398 [P] ⛔ **BLOCKED on `EPIC-038` merge + `A-038-1`** — Write failing tests `backend/tests/unit/learning-adapter-context.spec.ts`:
  - `KnowledgeIndex` calls `IndexService.reindex`;
  - this Epic's reader and admission are bound into `ContextModule`;
  - a knowledge item's `inclusionReason` begins `approved knowledge —`;
  - a package assembled before a supersession still shows the version as supplied, with a drift note on inspection (`FR-LRN-050`, `FR-LRN-052`, `FR-LRN-054`)
- [ ] T2399 ⛔ **BLOCKED on `EPIC-038` merge + `A-038-1`** — Implement `backend/src/modules/learning/adapters/context.adapter.ts` and bind it (unit test: T2398)
- [ ] T2400 [P] ⛔ **BLOCKED on `EPIC-047` merge + `A-047-1` + `A-047-2`** — Write failing tests `backend/tests/unit/learning-adapter-experts.spec.ts`:
  - `ExpertProvenance` answers through `EPIC-047`'s export;
  - `governed-knowledge` is accepted and `none` refused against a **real** contract version row (proving the amended `CHECK`);
  - a non-Expert execution returns `null`
- [ ] T2401 ⛔ **BLOCKED on `EPIC-047` merge + `A-047-1` + `A-047-2`** — Implement `backend/src/modules/learning/adapters/experts.adapter.ts` and bind it (unit test: T2400)
- [ ] T2402 ⛔ **BLOCKED on all four merges and every prerequisite** — Write and pass the Constitution XI **Tier 1** suite `backend/tests/integration/learning-tier1.spec.ts`. It covers quickstart Q1–Q27 through the real routes, the connector route and the job runner, against the composed `AppModule` with **real** adapters, and in-test bindings only for the unowned embedding port

**Checkpoint**: nothing in the module refuses for want of a sibling.

---

## Phase 10: Polish & cross-cutting

- [ ] T2403 [P] Write the failing architecture test `backend/tests/architecture/learning-mutation-proofs.spec.ts` asserting `specs/048-governed-learning/mutation-proofs.md` records MP-1a, MP-1b, MP-2 and MP-3. Each entry has the mutation diff, the failing tests with counts, and a `cmp`-confirmed revert
- [ ] T2404 ⛔ **BLOCKED on T2393** — Record **MP-1a** (`SC-LRN-001`) in `specs/048-governed-learning/mutation-proofs.md`. Add a `POST /learning/knowledge` route calling `KnowledgeWriter.insertVersion` directly and observe all three fail:
  - T2332;
  - T2370's no-write-route assertion;
  - T2392's trigger.

  Then restore (architecture test: T2403)
- [ ] T2405 ⛔ **BLOCKED on `EPIC-031` merge + `A-031-1`** — Record **MP-1b** (`SC-LRN-001`). Remove the approver-guard verdict check from `materialiser.ts` and observe T2352 fail, and T2392's trigger still refuse a pending decision. Then restore (architecture test: T2403)
- [ ] T2406 ⛔ **BLOCKED on `EPIC-031` merge** — Record **MP-2** (`SC-LRN-003`). Remove the `lowRisk` term from `eligibility.ts` and observe T2346 and the Q11/Q12 cases of T2402 fail. They use the **real** `DecisionEngine` with deliberately permissive steering, so this Epic's check is the only fence. Then restore (architecture test: T2403)
- [ ] T2407 ⛔ **BLOCKED on `EPIC-031` merge** — Record **MP-3** (`FR-LRN-027`, `SC-LRN-003` second clause). Remove the principal-kind check from `approver.guard.ts` and observe T2350 and Q14 of T2402 fail. Q14 is an approval through the real `DecisionEngine.approve` by `{kind: 'human', id: <agent principal>}`. Then restore (architecture test: T2403)
- [ ] T2408 [P] Write the failing performance test `backend/tests/integration/learning-performance.spec.ts` for the `R-048-22` targets:
  - submission p95 < 400 ms;
  - candidate detail < 500 ms;
  - review → materialised < 600 ms;
  - admission < 25 ms at 200 candidates;
  - browser page < 1 s at 5,000 entries;
  - history < 300 ms at 50 versions;
  - one `learning.resolve-decisions` pass materialises an already-resolved decision in < 600 ms, so with the 30 s interval a decision taken in `EPIC-031`'s Inbox becomes knowledge in ≤ 60 s (analysis finding `C4`);
  - approval → `KnowledgeIndex.reindex` attempted < 5 s, measured against a recording in-test index (analysis finding `C4`)
- [ ] T2409 Make T2408 pass — the indexes on `(workspaceId, subjectKey)`, `(candidateId, seq DESC)` and `(entryId, version)`, and the batched admission read (performance test: T2408)
- [ ] T2410 [P] Write the failing conformance check `backend/tests/architecture/learning-docs.spec.ts`:
  - every `FR-LRN-0xx` in `spec.md` (62) is cited by at least one task in this file;
  - every `SC-LRN-00x` (9) by a quickstart scenario or task;
  - the plan's merge order and prerequisite list match this file's;
  - once `closure.md` exists (T2417), PMI-DOC-004 §6.12 names `EPIC-048` as owner of `BR-0114`–`BR-0118` and `ADR-0021` reads Decided — skipped, not passed, before then (analysis finding `V2`)
- [ ] T2411 Correct any drift T2410 reports in `specs/048-governed-learning/` (conformance check: T2410)
- [ ] T2412 [P] Write the conformance check `backend/tests/architecture/learning-steering-example.spec.ts` validating the example `learning_policy` document in `specs/048-governed-learning/examples/learning-policy.example.json` against `learning-policy.ts`
- [ ] T2413 Write `specs/048-governed-learning/examples/learning-policy.example.json` with categories, reuse and defaults, plus the matching `EPIC-031` classification-rule and tenant `automatedActions` examples quickstart's prerequisites name (conformance check: T2412) — `RK-9`

---

## Phase Z: Closure

- [ ] T2414 ⛔ **BLOCKED on Phase 9** — Run `/speckit-converge` for `EPIC-048` (Constitution IV). Every remainder is built or deferred to a named Epic. `DEFER-048-01` and the `PP-019` deferral to `EPIC-040` are restated. **`FR-LRN-055`/`-056` are not deferred**: if `A-047-1` has not landed, convergence fails rather than deferring
- [ ] T2415 ⛔ **BLOCKED on T2385, T2387 and Phase 9** — Write the failing conformance check `backend/tests/architecture/learning-transcript.spec.ts` and generate `docs/uat/EPIC-048-transcript.md` from a run of `e2e/tests/epic-048-learning.spec.ts` against a running stack. The run reaches **Decision Inbox** and **Context → Knowledge** through primary navigation, approves a superseding candidate narrowed at 360px, and reads its history (quickstart Q6, Q15, Q19, Q28, Q29). The run **times** one decision of a candidate with five evidence items, from opening the Inbox entry to the decision recorded, and asserts < 2 minutes (`SC-LRN-007`; analysis finding `C2`). This is Constitution XI **Tier 2**: generated by the run, never hand-written, known-red until it is (`RK-8`)
- [ ] T2416 Run the full test suite (`pnpm test`) **only when no other suite is running on the machine**, with `DOCKER_UNAVAILABLE` unset. Record the result and every known-red in the closing report; never report an unrun suite as passing (Constitution IX)
- [ ] T2417 Write the closing report `specs/048-governed-learning/closure.md`, then `pnpm register:update`:
  - **Work Completed** and **Work Deferred**:
    - `DEFER-048-01`;
    - `PP-019` → `EPIC-040`;
    - *retired* evidence unreachable (`RK-6`);
    - every entry *not yet retrievable* while no embedding provider exists (`R-048-13`);
    - Expert-sourced learning absent while `DEF-047-001` is open.
  - The follow-ups raised to `EPIC-031`: `learning.review.*` in `IRREDUCIBLY_HIGH`; `ActorRef` has no *agent*.
  - The recommended next command.
- [ ] T2418 Update the `EPIC-027` register row for Governed Learning from `UNOWNED` to `EPIC-048` in `specs/027-ai-native-amendment/register/capability-areas.md`, record `DEFER-048-01` against it, and run `pnpm register:build`
- [ ] T2419 Set the PMI-DOC-004 §6.12 owner annotations for `BR-0114`–`BR-0118` to `EPIC-048` in `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md`, move `adr/ADR-0021-governed-learning.md` from Open to Decided, and back-fill PMI-DOC-006 §9 with `EPIC-048` against the Decision Inbox and Context areas (the back-fill text T2383 used to draft is written here, analysis finding `V1`) — **requires the Project Owner's sign-off** (Constitution II), then refresh the Delivery Board (Constitution IX)

---

## Analysis remediation — `C1` (added 2026-10-09)

- [ ] T2420 [P] ⛔ **BLOCKED on `EPIC-039`'s `Embed` capability on `main`** — Write failing tests `backend/tests/unit/learning-authoritative-contradiction.spec.ts` (`DEF-048-001`, spec Edge Case *knowledge contradicts an approved specification or steering rule*):
  - a candidate semantically opposed to an approved specification or steering document of its workspace carries `contradictsAuthoritative` in `GET /learning/candidates/:id`, naming the item and version;
  - it is ineligible for automatic approval;
  - an unbound `Embed` reads *contradiction check unavailable*, never *no contradiction*
- [ ] T2421 ⛔ **BLOCKED on `EPIC-039`'s `Embed` capability on `main`** — Implement the check over `EPIC-038`'s retrieval of authoritative source types (no second index), surface it in the candidate view and `eligibility.ts`, and close `DEF-048-001` (unit test: T2420)

---

## Dependencies & execution order

- **Phase 1 → Phase 2 → stories.** Phase 2 blocks everything.
- **US1 (Phase 3) blocks US2–US6**: nothing is decided, versioned or supplied without a candidate.
- **US2 blocks US3**: eligibility reads evidence state, conflict and Expert provenance.
- **US3 blocks US4 and US5**: supersession, deprecation and widening are decisions, and supply reads
  approved versions.
- **US6** needs US2 (the candidate view) and US4 (history). T2384–T2387 need their host Epics.
- **Phase 9** needs the merges in the stated order. Within it:
  - T2388–T2389 and T2394–T2395 need `EPIC-032` only;
  - T2390–T2391 need `EPIC-031` + `A-031-1`;
  - T2392–T2393 need `EPIC-031` + `EPIC-038`;
  - T2396–T2399 need `EPIC-038` + `A-038-1`;
  - T2400–T2401 need `EPIC-047` + `A-047-1` + `A-047-2`;
  - T2402 needs all of them.
- **Phase 10** after the stories. T2404–T2407 after Phase 9.
- **Phase Z** last; T2419 needs the Project Owner.

## Blocked tasks (summary)

| Blocked on | Tasks |
|---|---|
| `EPIC-032` merge | T2388, T2389, T2394, T2395 |
| `EPIC-031` merge + `A-031-1` | T2390, T2391, T2405 |
| `EPIC-031` merge | T2406, T2407 |
| `EPIC-031` merge + `A-031-2` | T2384, T2385 |
| `EPIC-031` + `EPIC-038` merge | T2392, T2393 → T2404 |
| `EPIC-038` merge | T2386, T2387 |
| `EPIC-038` merge + `A-038-1` | T2396, T2397, T2398, T2399 |
| `EPIC-047` merge + `A-047-1` + `A-047-2` | T2400, T2401 |
| All four merges + prerequisites | T2402, T2414, T2415 |
| `EPIC-039` `Embed` on `main` | T2420, T2421 |

**27 tasks are blocked; 95 can start now.**

## Parallel opportunities

- **Phase 2**: every `[P]` test task can be written together. Then:
  - T2306, T2308 and T2310 can be implemented together (package files);
  - T2316 → T2317 run in sequence;
  - T2321 and T2323 are independent.
- **Phase 3**: T2326, T2328, T2330, T2332 and T2334 together. Then T2327 → T2329 → T2331, which all
  touch `submission.service.ts`, in sequence; T2333 and T2335 alongside.
- **Phase 5**: T2346, T2348, T2350, T2352, T2354 and T2356 together. The implementations touch
  different files except T2349 (calls into `submission.service.ts`).
- **Phase 9**: the `EPIC-032` pair, the `EPIC-031` pair, the `EPIC-038` pairs and the `EPIC-047` pair
  are independent of each other once their Epics are on `main`.

Implementation tasks touching `submission.service.ts` must run one after another: T2327, T2329,
T2331, T2337, T2339, T2343, T2349, T2365, T2375.

## Implementation strategy

**MVP = Phases 1–3 (T2300–T2335)**: the untrusted intake. Built alone, the platform **collects** what
agents learn while guaranteeing none of it is trusted. That is spec US1's stated MVP and the half of
`ADR-0021` that cannot be walked back. It needs no unmerged Epic except for evidence resolution:
- until `EPIC-032` merges, the composed application refuses every submission `503` on `EvidenceReads`;
- route tests prove the intake with a recording in-test binding.

Then:
- US2 and US3 complete the P1 gate;
- US4 and US5 are incremental;
- US6 is the screens.

Phase 9 lands as each sibling merges. Until then every route that needs a sibling refuses `503`, and
the integration suites assert that refusal.
