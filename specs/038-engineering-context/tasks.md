# Tasks: Engineering Context

**Epic**: `EPIC-038` · **Branch**: `038-engineering-context` · **Generated**: 2026-08-31

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/context-api.md](./contracts/context-api.md) ·
[quickstart.md](./quickstart.md)

**Task ID range**: `T1220`–`T1305`, **86 tasks**.

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**,
> not per Epic (`DEF-028-014`). The corpus maximum before this Epic is `T1219` (`EPIC-034`), and
> four-digit identifiers have been in use by fourteen Epics since `T1000`. Allocation therefore
> starts at `T1220` and no suffix letters are used: the adjacency the suffix carried is no longer
> available past `T999z`, so the ranges below are contiguous instead.

**Tests are not optional here.** Constitution V requires every implementation task to carry a unit
test written to fail first, so each implementation task names the test task that must precede it.

---

## Phase 1: Setup

- [ ] T1220 Create `specs/038-engineering-context/defects/` with a `.gitkeep` — Constitution VI's sole defect intake for this Epic, in place before any code so an intake exists when the first defect is found rather than after
- [ ] T1221 Add the `pgvector` extension to the development and CI PostgreSQL images, pinned **≥ 0.8.0** in `docker-compose.yml` and the Testcontainers image used by `backend-integration` — `R-038-2`: 0.8.0 is the release that added iterative index scans, and a lower version fails `FR-CTX-012` silently rather than loudly
- [ ] T1222 [P] Write the failing conformance check for the extension floor in `backend/tests/architecture/context-pgvector-floor.spec.ts` — asserts the compose file and the test harness both pin ≥ 0.8.0, so the two cannot drift and a local database cannot be older than CI's
- [ ] T1223 Create `backend/src/modules/context/` with `context.module.ts` exporting an empty module, and register it in `backend/src/app.module.ts` — registered in the same commit it is created, because `DEF-005-001` is what an unregistered module looks like and this repository has now recorded that class eight times
- [ ] T1224 [P] Write the failing reachability test in `backend/tests/integration/context-reachability.spec.ts` importing the real `AppModule` — Constitution XI Tier 1, and it must fail before T1223 lands

**Checkpoint**: the Epic has somewhere to file defects, a database that can hold a vector, and a module the application actually builds.

---

## Phase 2: Foundational (blocking — no user story may start before this completes)

- [ ] T1225 [P] Write failing unit tests for the package types in `backend/tests/unit/context-package-types.spec.ts` — `authoritativeStatus` is a **required** union with no default, its `superseded` arm cannot exist without `supersededBy`, and its `undetermined` arm cannot exist without a reason (`FR-CTX-042`, `FR-CTX-043`, `FR-CTX-044`)
- [ ] T1226 Implement `backend/src/modules/context/package.types.ts` (unit test: T1225) — `ContextPackage`, `PackageItem`, `ExclusionRecord`; **no content field on any of them**, because an item is a reference (`FR-CTX-041`) and a copy here would put material under this Epic's access rules rather than the artifact's
- [ ] T1227 [P] Write failing unit tests for the exclusion vocabulary in `backend/tests/unit/context-exclusion-types.spec.ts` — five reasons (`permission`, `classification`, `budget`, `boundary`, `stale`), required, no default; a reason taken by omission is an exclusion nobody can explain
- [ ] T1228 [P] Write failing unit tests for `RetrievalOutcome` in `backend/tests/unit/context-retrieval-outcome.spec.ts` — `requested` and `returned` are both required, so a caller **cannot obtain candidates without also obtaining the counts** (`R-038-3`). This is the type that makes a short read impossible to ignore
- [ ] T1229 Implement `backend/src/modules/context/retrieval/outcome.types.ts` (unit tests: T1227, T1228)
- [ ] T1230 [P] Write the failing integration test for the database constraints in `backend/tests/integration/context-constraints.spec.ts` — exercised by going **around** the services with raw SQL: a refused package must carry a reason, a superseded item must name its successor, an undetermined item must give a reason, a cross-boundary item must name its authorisation
- [ ] T1231 Write `backend/prisma/migrations/<ts>_epic038_context/migration.sql` (integration test: T1230) — six tables per [data-model.md](./data-model.md), hand-written `CHECK` constraints, and `IndexEntry` **partitioned by `workspaceId`** with its `vector` column and HNSW index (`R-038-2`)
- [ ] T1232 [P] Write the failing integration test for partitioning in `backend/tests/integration/context-partitioning.spec.ts` — asserts `IndexEntry` is partitioned and that a query for one workspace does not scan another's partition. **`R-038-8` in `EPIC-035`'s sense**: prove the mechanism, not just the outcome, because a `WHERE` clause produces the same visible result while failing under `ef_search`
- [ ] T1233 [P] Write failing unit tests for the ports in `backend/tests/unit/context-ports.spec.ts` — five ports, **three refuse and two degrade**, and each declares which; the split is the contract's argument and a test that only counted them would miss it
- [ ] T1234 Implement `backend/src/modules/context/context.tokens.ts` (unit test: T1233) — `EmbeddingPort` (**unowned**), `AccessPolicy` (`EPIC-024`), `ArtifactSource` (`EPIC-033`/`EPIC-032`) refuse; `ExecutionProjections` (`EPIC-037`) and `LiveStateReader` degrade
- [ ] T1235 Implement `backend/src/modules/context/context.store.ts` and `context.store.prisma.ts` — **PostgreSQL-backed from the first commit** (`T1178`'s lesson): a context package lost on restart is the record of what an AI session was shown, and losing it looks exactly like nothing having been shown
- [ ] T1236 [P] Write the failing architecture test in `backend/tests/architecture/context-independence.spec.ts` — this module stores no source payload (no column or field named `content`, `body`, `payload`, `text`), imports no access-control module of its own (`FR-CTX-054`), and names no embedding vendor (`FR-CTX-013`)

**Checkpoint**: the guarantees exist as types and constraints before any behaviour depends on them.

---

## Phase 3: User Story 1 — A governed AI session is given a package somebody can account for (P1) 🎯 MVP

**Goal**: `BR-0093` — assembly from the six inputs, with every absence recorded.

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 1–5.

- [ ] T1237 [P] [US1] Write failing unit tests for assembly inputs in `backend/tests/unit/context-assembly.spec.ts` — the objective, actor, role, permissions, classification, relevance and budget are all consulted and recorded (`FR-CTX-030`, `FR-CTX-031`, `FR-CTX-032`)
- [ ] T1238 [P] [US1] Write failing unit tests for permission exclusion in `backend/tests/unit/context-permission-exclusion.spec.ts` — an unreadable item is excluded **and an `ExclusionRecord` written** (`FR-CTX-033`); assert the record exists, not merely that the item is absent
- [ ] T1239 [P] [US1] Write failing unit tests for the unclassified default in `backend/tests/unit/context-classification.spec.ts` — a source type with no `SourceClass` is **excluded**, never admitted (`FR-CTX-034`); `FR-GEL-062`'s rule that a default which permits is invisible
- [ ] T1240 [P] [US1] Write failing unit tests for the budget in `backend/tests/unit/context-budget.spec.ts` — a bounded package names what it dropped, candidates equal items plus exclusions, and a budget admitting nothing **refuses** rather than returning an empty package (`FR-CTX-035`, `FR-CTX-037`)
- [ ] T1241 [P] [US1] Write failing unit tests for essential items in `backend/tests/unit/context-essential.spec.ts` — an excluded essential item refuses the assembly, naming the item and the reason (`FR-CTX-038`, `FR-CTX-039`), and the refusal is a stored row rather than only an error
- [ ] T1242 [US1] Implement `backend/src/modules/context/assembly.service.ts` (unit tests: T1237–T1241) — every check runs **before** anything is written, so a refused assembly leaves no half-formed package
- [ ] T1243 [US1] Implement `POST /context/packages` in `backend/src/modules/context/context.controller.ts` (integration test: T1224) — actor and permissions come from the session and are stripped from the body, so a caller cannot assemble in another actor's name
- [ ] T1244 [P] [US1] Write the failing integration test for the route in `backend/tests/integration/context-assembly-route.spec.ts` against PostgreSQL — the five outcomes in [contracts/context-api.md](./contracts/context-api.md), including `503` when the index is unavailable
- [ ] T1245 [P] [US1] Write failing unit tests for `SourceClass` configuration in `backend/tests/unit/context-source-class.spec.ts` — classes are configuration (`FR-CTX-036`, `PP-014`), and an absent class is not a permissive default
- [ ] T1246 [US1] Implement `GET /context/sources` (unit test: T1245) — so *"why is my document never retrieved"* is answerable without reading configuration files

**Checkpoint**: US1 demonstrable — a package assembles, and every candidate that did not make it says why.

---

## Phase 4: User Story 2 — Every item says where it came from and whether it is still true (P1)

**Goal**: `BR-0094` — provenance, and the status that must never read *current* by default.

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 6 and 7.

- [ ] T1247 [P] [US2] Write failing unit tests for source references in `backend/tests/unit/context-provenance.spec.ts` — every item names its source and version, and **no item carries content** (`FR-CTX-040`, `FR-CTX-041`)
- [ ] T1248 [P] [US2] Write failing unit tests for superseded material in `backend/tests/unit/context-superseded.spec.ts` — a superseded item is marked and names its successor (`FR-CTX-043`); a superseded requirement quoted as current is worse than one not quoted at all
- [ ] T1249 [P] [US2] Write failing unit tests for undetermined status in `backend/tests/unit/context-undetermined.spec.ts` — an unresolvable status reads *undetermined with a reason*, and there is **no code path that produces `current` without a resolved version** (`FR-CTX-044`)
- [ ] T1250 [US2] Implement `backend/src/modules/context/provenance.service.ts` (unit tests: T1247–T1249) — reads baseline status through `ArtifactSource`; a reader that throws **propagates** rather than degrading to *undetermined*, because *"I could not look"* and *"nobody has decided"* are different facts (`EPIC-035`'s `T998`, one Epic over)
- [ ] T1251 [P] [US2] Write the failing integration test for provenance at the database in `backend/tests/integration/context-provenance-constraints.spec.ts` — the CHECK refuses a superseded row with no successor and an undetermined row with no reason, exercised with raw SQL
- [ ] T1252 [US2] Implement provenance resolution for execution-history items in `provenance.service.ts` — `EPIC-037` records carry their own version; an execution's provenance is the projection it was read from (`R-038-8`)

**Checkpoint**: US2 demonstrable — nothing in a package claims to be current without something having said so.

---

## Phase 5: User Story 3 — Context does not cross a boundary it was not authorised to cross (P1)

**Goal**: `BR-0095` — the one failure in this Epic that cannot be walked back.

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 8–10.

- [ ] T1253 [P] [US3] Write failing unit tests for the boundary in `backend/tests/unit/context-isolation.spec.ts` — no item from another workspace, with a control proving the fixture contains one (an isolation test over a corpus with nothing to leak proves the fixture)
- [ ] T1254 [P] [US3] Write failing unit tests for authorised crossing in `backend/tests/unit/context-reusable-source.spec.ts` — an authorised reusable source is included, marked `crossBoundary` and names its authorisation (`FR-CTX-051`, `FR-CTX-052`); an unauthorised one is excluded, because the absence of a prohibition is not a permission (`FR-CTX-053`)
- [ ] T1255 [P] [US3] Write failing unit tests for direction in `backend/tests/unit/context-authorisation-direction.spec.ts` — an authorisation from A to B does **not** permit B to read A's material; a symmetric reading would grant a permission nobody stated
- [ ] T1256 [US3] Implement `backend/src/modules/context/isolation.ts` (unit tests: T1253–T1255)
- [ ] T1257 [P] [US3] Write failing unit tests for the scoping/authorisation split in `backend/tests/unit/context-scoping-is-not-authorisation.spec.ts` — with the workspace partition satisfied and `AccessPolicy` refusing, the item is **still excluded** (`R-038-7`). The test that catches the cheap conflation: a system treating the partition as the permission passes every other isolation test in this phase
- [ ] T1258 [US3] Bind `AccessPolicy` to `EPIC-024` in `context.module.ts` (unit test: T1257) — adjudication is `EPIC-024`'s and this Epic implements no second model (`FR-CTX-054`)
- [ ] T1259 [P] [US3] Write the failing integration test for boundary enforcement in `backend/tests/integration/context-isolation.spec.ts` — two workspaces, overlapping material, against PostgreSQL with the real partitioned table
- [ ] T1260 [P] [US3] Write the failing integration test for `ReusableKnowledgeAuthorisation` constraints in `backend/tests/integration/context-authorisation-constraints.spec.ts` — a `crossBoundary` item with no `authorisationRef` is refused by the database, not only by the service

**Checkpoint**: US3 demonstrable — and the partition alone does not grant anything.

---

## Phase 6: User Story 4 — A reviewer can see what the model was actually given (P2)

**Goal**: `BR-0096` — as supplied, never re-assembled.

**Independent test**: [quickstart.md](./quickstart.md) Scenario 13.

- [ ] T1261 [P] [US4] Write failing unit tests for retained inspection in `backend/tests/unit/context-inspection.spec.ts` — change the sources after assembly and confirm the inspected package **does not change** (`FR-CTX-063`). If it changes, the implementation is re-assembling and the requirement is defeated
- [ ] T1262 [P] [US4] Write failing unit tests for drift notes in `backend/tests/unit/context-drift.spec.ts` — where a source has moved since, the retained item is shown **and** the drift is stated; where a source no longer resolves, that is stated too
- [ ] T1263 [P] [US4] Write failing unit tests for refused-package inspection in `backend/tests/unit/context-refusal-inspection.spec.ts` — a refusal is inspectable with its reason (`FR-CTX-065`); a session that ran without context is a fact, not a blank
- [ ] T1264 [US4] Implement `backend/src/modules/context/inspection.service.ts` (unit tests: T1261–T1263) — reads only stored rows; it has **no access to the assembler**, so re-assembly is not merely forbidden but unavailable
- [ ] T1265 [US4] Implement `GET /context/packages/:id` and `GET /context/packages?executionId=` (integration test: T1224) — `executionId` required rather than optional, so a workspace-wide listing does not become the thing people page through instead of the audit path
- [ ] T1266 [P] [US4] Write failing unit tests for execution binding in `backend/tests/unit/context-execution-binding.spec.ts` — a package binds to the execution it fed, and *consequential* is read from `EPIC-037`'s registration rather than decided here (`FR-CTX-061`, `FR-CTX-062`)
- [ ] T1267 [P] [US4] Write failing unit tests for retention in `backend/tests/unit/context-retention.spec.ts` — a package is retained as long as its execution and no longer (`FR-CTX-066`, `R-038-9`), by cascade rather than a policy of its own
- [ ] T1268 [P] [US4] Write failing component tests for the inspection screen in `frontend/tests/unit/pages/Context.spec.tsx` — lists packages, opens one, shows items **and exclusions** (`FR-CTX-071`); ranked material is visually distinct from recorded fact (`FR-CTX-072`); what excluded an item is visible without opening another screen (`FR-CTX-073`); state, provenance and exclusions survive 360px (`FR-CTX-074`)
- [ ] T1269 [US4] Implement `frontend/src/pages/Context.tsx` (component test: T1268) — registered as an **application area** in `frontend/src/shell/areas.ts` and `routes.tsx`, **not** a Room: it declares no workflow type and imports no `RoomShell` (`FR-CTX-070`, `R-038-11`)
- [ ] T1270 [P] [US4] Write the failing architecture test in `backend/tests/architecture/context-not-a-room.spec.ts` — no workflow type named `context` exists in `packages/loop-contract/workflows/`, and `Context.tsx` imports no `RoomShell`. The absence is asserted, because an absence nobody checks is one somebody adds later by analogy

**Checkpoint**: US4 demonstrable — and inspecting a package twice, either side of a source change, gives the same answer.

---

## Phase 7: User Story 5 — Approved sources can be found by meaning (P2)

**Goal**: `BR-0091` — the retrieval this Epic builds. **The bulk of the engineering.**

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 11 and 12.

- [ ] T1271 [P] [US5] Write failing unit tests for the embedding boundary in `backend/tests/unit/context-embedding-port.spec.ts` — no vendor, model name or API shape appears in the data model (`FR-CTX-013`), and an unbound port **refuses** rather than returning a zero vector
- [ ] T1272 [US5] Implement `backend/src/modules/context/retrieval/embedding.port.ts` (unit test: T1271) — declares the capability and implements nothing; **unowned in the programme**, and named as such in the closing report
- [ ] T1273 [P] [US5] Write failing unit tests for model consistency in `backend/tests/unit/context-model-consistency.spec.ts` — entries record their `embeddingModelId` and `dimension`, and a query **refuses to rank across models** (`R-038-4`). Two models of the same dimension produce incomparable spaces and the database computes distances across them without erroring: mixed entries do not fail, they rank nonsense
- [ ] T1274 [P] [US5] Write failing unit tests for the approved source set in `backend/tests/unit/context-approved-sources.spec.ts` — governed documents and execution history only; source code and imported documents are never candidates (`FR-CTX-015`), enforced at assembly and not trusted from the ranker
- [ ] T1275 [P] [US5] Write failing unit tests for staleness in `backend/tests/unit/context-staleness.spec.ts` — staleness is `entry.sourceVersion ≠ source.currentVersion` and **never a timestamp comparison** (`FR-CTX-017`, `R-038-5`); a stale entry is marked, never ranked as current
- [ ] T1276 [US5] Implement `backend/src/modules/context/retrieval/index.service.ts` (unit tests: T1273–T1275) — build, version and stale-mark entries
- [ ] T1277 [P] [US5] Write failing unit tests for incremental re-indexing in `backend/tests/unit/context-reindex.spec.ts` — one changed source re-embeds one entry and **leaves every other entry's `indexedAt` untouched** (`FR-CTX-018`, `R-038-6`)
- [ ] T1278 [US5] Implement `POST /context/index/reindex` and `GET /context/index/health` (unit test: T1277) — health reports the stale count, because an index that is 40% stale is neither broken nor healthy and nobody finds out unless something says so. **No rebuild-all route exists**: `R-038-6` records that a corpus rebuild is an operation nobody runs
- [ ] T1279 [US5] Implement `backend/src/modules/context/retrieval/search.service.ts` (unit tests: T1273, T1274) — ranks within one workspace partition, with `hnsw.iterative_scan` enabled (`R-038-2`)
- [ ] T1280 [P] [US5] **Write the failing integration test for the short-read finding** in `backend/tests/integration/context-retrieval-shortfall.spec.ts` — index enough material that a restrictive filter under `hnsw.ef_search` returns fewer candidates than requested, and assert the package carries a **retrieval shortfall** with `requested` and `returned` (`R-038-3`). *The most important test in the Epic: it is the failure that is silent in every other design, and a fixture of ten items will pass whatever the implementation does — the fixture must be large enough that the approximate scan actually bites*
- [ ] T1281 [US5] Implement shortfall recording in `assembly.service.ts` (integration test: T1280) — a short read is written onto the package, never absorbed; an unknown set and an empty set must not behave alike
- [ ] T1282 [P] [US5] Write the failing integration test for ranking quality in `backend/tests/integration/context-relevance.spec.ts` — an objective whose wording matches no source verbatim still retrieves the semantically nearest material, which is the whole of `BR-0091` and the only test that would fail if embeddings were replaced by keyword matching

**Checkpoint**: US5 demonstrable — and a retrieval that came back short says so.

---

## Phase 8: User Story 6 — Live engineering state can be part of the picture (P3)

**Goal**: `BR-0092`.

**Independent test**: [quickstart.md](./quickstart.md) — live-state scenarios within Scenario 1.

- [ ] T1283 [P] [US6] Write failing unit tests for live state in `backend/tests/unit/context-live-state.spec.ts` — each element carries the instant it was read (`FR-CTX-021`)
- [ ] T1284 [P] [US6] Write failing unit tests for unavailability in `backend/tests/unit/context-live-state-absent.spec.ts` — *unavailable with a reason* is distinguishable from *read and empty* (`FR-CTX-022`); this is the degrade case, and the two states looking alike is the whole reason the port degrades rather than refusing
- [ ] T1285 [P] [US6] Write failing unit tests for live-state permissions in `backend/tests/unit/context-live-state-permissions.spec.ts` — an element the actor may not see is absent **and its exclusion recorded** (`FR-CTX-023`)
- [ ] T1286 [US6] Implement live-state collection in `backend/src/modules/context/assembly.service.ts` (unit tests: T1283–T1285) through `LiveStateReader`, which degrades
- [ ] T1287 [P] [US6] Write failing unit tests for execution-history inclusion in `backend/tests/unit/context-execution-history.spec.ts` — read through `EPIC-037`'s **projections**, never its event stream (`R-038-8`); with the port unbound, history drops out and **the package records that it did**
- [ ] T1288 [US6] Bind `ExecutionProjections` in `context.module.ts` (unit test: T1287), degrading when `EPIC-037` is unavailable

**Checkpoint**: all six user stories demonstrable.

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T1289 **Mutation proof — `FR-CTX-050`**: remove the workspace partition predicate from `search.service.ts`, revert (integration test: T1259 must fail while the mutation stands). Record the observation in `specs/038-engineering-context/mutation-proofs.md`. **`SC-CTX-003`, and an Epic Exit Criterion** — the one failure here that cannot be walked back
- [ ] T1290 **Mutation proof — `FR-CTX-035`**: introduce silent truncation in `assembly.service.ts` — drop candidates over budget without writing `ExclusionRecord` rows — and revert (unit test: T1240 must fail). Record the observation. **`SC-CTX-004`, and an Epic Exit Criterion**: a package that quietly dropped material is the failure a reader cannot detect from the package itself
- [ ] T1291 **Mutation proof — `R-038-3`**: make `search.service.ts` return its candidate list without the `requested`/`returned` counts, revert (integration test: T1280 must fail). Not an Exit Criterion, and recorded because the short read is the defect this Epic's research exists to have found
- [ ] T1292 [P] Verify the `R-038-10` targets — retrieval over 50,000 entries p95 < 800 ms; assembly p95 < 2.5 s; incremental re-index p95 < 5 s; screen load p95 < 1.2 s — in `backend/tests/integration/context-performance.spec.ts`, and **record the measured figures with what each excludes**. `EPIC-035`'s `T999o` found that three of four figures excluded storage latency nobody had granted; state the exclusions in the output rather than in a comment
- [ ] T1293 [P] **Consolidated boundary confirmations** in `backend/tests/architecture/context-boundaries.spec.ts`: no source payload is stored in this Epic's tables; no second access model exists (`FR-CTX-054`); the screen-load figure matches the three Rooms' since it is the same shell; **no workflow type is declared**; and this Epic published no package
- [ ] T1294 [P] Write the transcript conformance check in `backend/tests/architecture/context-transcript.spec.ts` — asserts the Tier 2 transcript exists, names its run, covers the journey's steps, records keyboard-only navigation and was **generated** rather than authored. It will fail until T1301 runs, and the failure is the record that the obligation is owed
- [ ] T1295 Run and record each [quickstart.md](./quickstart.md) scenario **individually** in `specs/038-engineering-context/quickstart-results.md` — Scenarios 1–13 against a fixture embedding, and **Scenario 14 stated as not runnable** until an embedding provider exists
- [ ] T1296 [P] Write `specs/038-engineering-context/mutation-proofs.md` recording all three observations from T1289–T1291 at the moment of observation, not assembled afterwards

**Checkpoint**: the two Exit Criteria mutation proofs are recorded, and the figures are measured rather than asserted.

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI)

- [ ] T1297 Confirm every implementation task has a passing unit test or conformance check
- [ ] T1298 **Constitution XI Tier 1 (ALWAYS)** — T1224 drives the module through its real HTTP routes against the composed `AppModule`, and T1289 proved a guard fails when removed
- [ ] T1299 **Demonstrate assembly, provenance, isolation and inspection end to end** against PostgreSQL — the four P1/P2 stories in one run, because each has passed alone and the failure this catches is the one where they disagree
- [ ] T1300 Verify the **five ports** behave as declared — three refuse, two degrade — and that each refusal names the Epic that owes the binding
- [ ] T1301 **Constitution XI Tier 2** — the assemble → inspect → follow-an-exclusion journey against a running application, keyboard-only with focus visible, and a **run-generated** transcript committed. **Blocked**: `EmbeddingPort` has no owner in the programme, so assembly returns `503` and the journey cannot complete. Record it as outstanding rather than authoring evidence — hand-written evidence is a constitution violation of the first order
- [ ] T1302 **Restate the unowned dependencies in the closing report**: (a) **the embedding provider** — `FR-CTX-013`'s port has no owner anywhere in the programme, which is why assembly refuses and why T1301 is blocked; (b) **`BR-0163` context-quality feedback** is `U-19` and unowned, so this Epic's delivery must not be read as having closed the feedback loop; (c) **Constitution XII registration** — `EPIC-037` builds the registry and had not shipped when this Epic ran, so the commands producing these artifacts are unregistered
- [ ] T1303 Run `/speckit-converge`; append any remaining work; triage `specs/038-engineering-context/defects/` leaving no open record; re-run the full suite (`pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`)
- [ ] T1304 Regenerate `governance/epic-stage-register.md` and confirm this Epic's derived stage matches its evidence
- [ ] T1305 Promote `local → dev` (no environment skipped) and publish the closing report: work completed, work deferred, the three mutation observations, the measured performance figures, and the recommended next command (Constitution IX). **Promotion needs explicit authorisation naming the environment**, as `EPIC-035`'s closure recorded

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T1221` is a hard prerequisite — without `pgvector` ≥ 0.8.0 the migration in `T1231` cannot apply
- **Foundational (Phase 2)**: blocks every user story. `T1231`'s partitioning is what `R-038-2` rests on
- **US1 (Phase 3)**: Phase 2 only. **MVP** — assembles against a stubbed retrieval that refuses, exactly as `FR-CTX-012` requires
- **US2 (Phase 4)**: Phase 2's types; independent of US1
- **US3 (Phase 5)**: Phase 2's partitioning and `EPIC-024`
- **US4 (Phase 6)**: US1 (there must be a package to inspect) and `EPIC-036`'s shell
- **US5 (Phase 7)**: Phase 2, and `T1279` needs `T1231`'s HNSW index. **Priority P2 but the largest phase** — the clarification moved retrieval into scope, and it is where the engineering is
- **US6 (Phase 8)**: Phase 2; `EPIC-037` for the history half
- **Polish, Closure**: last

### Cross-Epic dependencies

**Consumes and does not rebuild**: `EPIC-024` access adjudication, `EPIC-032` attestation shape,
`EPIC-033`/`EPIC-032` artifact sources, `EPIC-036` application shell, `EPIC-037` execution
registration and history projections.
**Refuses rather than degrades against**: `EmbeddingPort` (no owner), `AccessPolicy`,
`ArtifactSource`.
**Degrades against**: `ExecutionProjections`, `LiveStateReader`.

### Parallel Example: Phase 2

```text
T1225, T1227, T1228, T1230, T1232, T1233, T1236   — seven test files, no shared source
T1226, T1229, T1231, T1234, T1235                  — their implementations, in order
```

---

## Implementation Strategy

**MVP is User Story 1** — a package assembled from the six inputs with every exclusion recorded.
It is the MVP because every other story is a property *of* the package: without assembly there is
nothing to give provenance to, isolate, or inspect.

**Phase 2 is where three guarantees stop being prose**: an `ExclusionRecord` table so an empty
package and a filtered one are distinguishable, an `authoritativeStatus` union with no default so
*undetermined* cannot read as *current*, and a `RetrievalOutcome` carrying both counts so a caller
cannot take candidates without taking the evidence of how many were asked for.

**The riskiest task is T1280**, and it is worth naming as such. It is the only test that catches
the failure `R-038-2` uncovered — a filtered approximate scan silently returning fewer candidates
than requested — and it is the easiest test in the Epic to write in a way that passes for the wrong
reason. A small fixture will pass against any implementation. It must be large enough that the
scan actually bites.
