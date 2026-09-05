# Tasks: Epic Model and Spec Journey Board

**Epic**: `EPIC-044` · **Module**: Requirements (M-03) + Specifications (M-04) · **Branch**:
`epic/044-epic-model-journey-board` · **Generated**: 2026-09-05

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/epics-api.md](./contracts/epics-api.md) ·
[contracts/stage-derivation.md](./contracts/stage-derivation.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T1549`–`T1613`, **65 tasks** (`T1612`, `T1613` appended by the analysis
remediation).

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**.
> The corpus maximum before this Epic is `T1548` (`EPIC-042` Phase 10), so allocation starts at
> `T1549`, contiguous, with no suffix letters (`R-026-9`). The closure phase is pre-allocated
> (`T1605`–`T1611`), as `EPIC-041`'s analysis finding `I3` established.

**Delivery posture**: ▶ **PROCEEDING** — fourth Epic of the local-first replan (`D-7`), the first
half of milestone `M3`. Depends on `EPIC-043` and `EPIC-042` (both complete on their branches;
this branch is cut from `EPIC-042`'s). Readiness conditions for customer projects are **out of
scope** (PMI-DOC-007 §7, *later*): this Epic delivers the place and the rule with an empty
condition set (Assumption 1, confirmed).

**Session label**: `EPIC-044 Epic Model and Spec Journey Board` (Constitution VIII).

**Test statement** (Constitution V): every implementation task names the failing-first test task
that precedes it. This Epic's one **document** output — the stage configuration, canonical in the
package and mirrored under `governance/` — pairs with executable conformance checks
(`packages/epic-stage/tests/config.spec.ts`, `G-44-01`). The extraction is proved by the
register's **byte identity** and by 32 governance specs passing unchanged. Two checks are
**mutation-tested** at closure (`SC-EPB-001`, `SC-EPB-006`) and one is **inverted**
(`SC-EPB-002`). Whether a conformance check blocks CI: **blocks**, for every check in this Epic.

**Feature map** (`F-044.n`, Constitution III): F-044.1 Setup — the package project, the
configuration, the schema (Phase 1) · F-044.2 Foundational — the extraction, the Epic module, the
stage service, decision reconciliation (Phase 2) · F-044.3 Epics group my requirements (US1) ·
F-044.4 The board (US2) · F-044.5 Stage and readiness are different claims (US3) · F-044.6 The
first run over real Epics (US4) · F-044.7 Specification list columns (US5) · F-044.8 Polish ·
F-044.Z Closure.

---

## Phase 1: Setup — F-044.1

**Purpose**: the package exists as a tested project; the configuration document has one home
and one verified mirror; the schema exists so every story can build on it.

- [X] T1549 [P] Write the failing governance conformance check `tests/governance/epic-stage-package.spec.ts` — `vitest.workspace.ts` and the root `package.json` `test:unit` list an `epic-stage` project rooted at `packages/epic-stage/tests/`; `tests/governance/vitest-projects.spec.ts` maps it; `packages/epic-stage/package.json` is `@pmi/epic-stage` `0.1.0`, private, with **no** `dependencies`; `governance/repository-layout.md` registers `packages/epic-stage/`
- [X] T1550 Create `packages/epic-stage/package.json`, `packages/epic-stage/tsconfig.json` and `packages/epic-stage/src/index.ts`; add the `epic-stage` project to `vitest.workspace.ts` and the root `package.json`; register `packages/epic-stage/` in `governance/repository-layout.md` (conformance: `tests/governance/epic-stage-package.spec.ts` T1549)
- [X] T1551 [P] Write failing tests `packages/epic-stage/tests/config.spec.ts` — `loadStageConfig()` reads the package's own file; the seven `stages` each carry `reachedBy` (`specify`, `clarify`, `checklist`, `plan`, `tasks`, `analyze`, and `null` for `Ready`); `productStages` holds `Implementing` (order 8, `reachedBy: implement`, next `/speckit-converge`) and `Converged` (order 9, `reachedBy: converge`, next `—`); `readinessProfiles` is `{ repository: 'dor', customer: 'none' }`; `productProfile()` returns nine definitions by order; `packageVersion()` equals the manifest's version
- [X] T1552 [P] Write the failing governance check `tests/governance/epic-stage-config-mirror.spec.ts` (`G-44-01`) — `governance/epic-stage.config.json` is byte-identical to `packages/epic-stage/epic-stage.config.json`, and `tests/governance/epic-stage/config.spec.ts` (`G-26-01`, seven stages) still passes against the mirror
- [X] T1553 Move the configuration to `packages/epic-stage/epic-stage.config.json` with `reachedBy`, `productStages` and `readinessProfiles` (data-model.md §3); write the identical mirror to `governance/epic-stage.config.json`; implement `packages/epic-stage/src/config.ts` — `loadStageConfig`, `productProfile`, `packageVersion` (unit test: T1551; conformance: `tests/governance/epic-stage-config-mirror.spec.ts` T1552)
- [X] T1554 [P] Write the failing integration test `backend/tests/integration/epics-schema.spec.ts` (Testcontainers) — table `epics` with unique `(projectId, number)`, unique `(decisionCommentId, splitSuffix)`, CHECK `status IN (active, split, closed)`, self-referencing `parentEpicId`, indexes `(workspaceId)`, `(projectId, status)`, `(parentEpicId)`; nullable `requirements.epicId` and `specifications.epicId` with `(projectId, epicId)` indexes; and extend `backend/tests/unit/core/universal-columns.spec.ts` with `epics` in the expected set
- [X] T1555 Add `Epic` (with the `parent`/`children` self-relation, `R-044-5`) and the two nullable columns to `backend/prisma/schema.prisma`; write `backend/prisma/migrations/20260905120000_epic044_epics/migration.sql` (additive) (integration test: T1554)
- [X] T1556 [P] Extend `backend/tests/architecture/durable-stores.spec.ts` with a failing entry — `epics/epic-stores.module.ts` binds `EPIC_STORE` to `PrismaEpicStore` under `DATABASE_URL` and to `InMemoryEpicStore` otherwise
- [X] T1557 Create `backend/src/modules/epics/epics.tokens.ts`, `backend/src/modules/epics/epic.store.ts` (the record, `PrismaEpicStore` with `max(number) + 1` allocation inside the transaction and one retry on the unique conflict, `InMemoryEpicStore`) and `backend/src/modules/epics/epic-stores.module.ts` (architecture test: T1556)

**Checkpoint**: the package is a tested project; one configuration file with a verified mirror;
the schema exists.

---

## Phase 2: Foundational — F-044.2 (blocking — the extraction, the Epic module, the stage service, reconciliation)

**Purpose**: everything every story rests on. The register must import the package before the
product does; the entity must exist before the screens; the stage must derive before the board.

- [X] T1558 [P] Write failing tests `packages/epic-stage/tests/derive.spec.ts` — `deriveStageFromEvidence` over hand-built evidence maps: the highest contiguous stage; evidence above a gap listed in `outOfOrder` and never counted; `Ready` skipped; `nextReaches` with an Epic kind (`—` for a parent design at `Planned`); no evidence → `stage: null` with the first stage's `next`; identical results to `tests/governance/epic-stage/fixtures.ts`
- [X] T1559 [P] Write failing tests `packages/epic-stage/tests/readiness.spec.ts` — `resolveReadiness` unchanged: `parent-design` → `n/a`; no failures → `Ready`; a covering waiver → `Ready (waived)`; an expired waiver blocks; `validateWaiver` cases from `tests/governance/epic-stage/waivers.spec.ts`
- [X] T1560 Implement `packages/epic-stage/src/derive.ts`, `packages/epic-stage/src/readiness.ts` and `packages/epic-stage/src/evidence-files.ts` — moved from `tests/governance/epic-stage/derive.ts` and `tests/governance/epic-stage/dor.ts`, pure given a root — and export them from `packages/epic-stage/src/index.ts` (unit tests: T1558, T1559)
- [X] T1561 Turn `tests/governance/epic-stage/derive.ts` and the readiness half of `tests/governance/epic-stage/dor.ts` into re-export shims over `@pmi/epic-stage` (`contracts/stage-derivation.md` §3); run the governance project and confirm the 32 importing specs pass unchanged; run `pnpm register:update` and confirm `governance/epic-stage-register.md` is byte-identical (conformance: `tests/governance/epic-stage/register.spec.ts`) — `SC-EPB-002`
- [X] T1562 [P] Write failing tests `packages/epic-stage/tests/evidence-executions.spec.ts` — every rule of data-model.md §4: a `completed` execution reaches its `reachedBy` stage; `partially-completed` counts for `implement` only; `failed`, `cancelled`, `timed-out` count for nothing; `Implementing` while the latest `implement` is `registered`, `started`, `blocked` or `partially-completed`; `Converged` when the latest `converge` completed with a comment naming `tasks.md` neither as changed nor as new and no `implement` registered after it; `bindExecutions` resolves a numeric `targetId` by number and `7a` through the parent's number and `splitSuffix`; anything else is `unbound`; `last` and `running`; the same rows in a shuffled arrival order yield identical `evidence`, `last` and `running` (`FR-EPB-009`, analysis `C2`); 500 generated rows derive in under 50 ms — the two `SC-EPB-001` mutation targets marked in comments
- [X] T1563 Implement `packages/epic-stage/src/evidence-executions.ts` — `evidenceFromExecutions`, `bindExecutions` — and export them (unit test: T1562)
- [X] T1564 [P] Write failing unit tests `backend/tests/unit/epics/epic.service.spec.ts` — `create` allocates `max + 1`, derives the slug (`kebab-case`, ASCII, ≤ 40), validates the title (1–120); `edit` keeps the number and follows the title with the slug; `close` sets `closedAt` and refuses `epic_not_active` on a split or closed Epic; `assignRequirement` moves between Epics, refuses on split/closed, audits before/after; `assignSpecification`; every write through `OwnerGate` (`owner_grant_required` without it); another project's Epic → `not_found`
- [X] T1565 Implement `backend/src/modules/epics/epic.service.ts` with `OwnerGate` and `AuditService` (unit test: T1564)
- [X] T1566 [P] Write failing unit tests `backend/tests/unit/epics/epic-stage.service.spec.ts` — over in-memory execution rows: the `BoardRead` shape of data-model.md §4; `Not started` with `/speckit-specify`; `missing` predecessors named; the `customer` profile's readiness note; `unbound`; `packageVersion`; `derivedFrom: 'executions'`; closed and split Epics with `next: null`
- [X] T1567 Implement `backend/src/modules/epics/epic-stage.service.ts` — an `ExecutionEvidenceReader` port (Prisma: **one** statement over `executions` ⋈ input `execution_target_bindings` ⋈ latest lifecycle event ⋈ completion comment; in-memory for tests) feeding `bindExecutions` → `evidenceFromExecutions` → `deriveStageFromEvidence` → `resolveReadiness` (unit test: T1566) — `R-044-10`
- [X] T1568 [P] Write failing unit tests `backend/tests/unit/epics/decision-reconcile.spec.ts` — a `confirmed` decision creates children in suffix order with the next free numbers, the recorded slug (suffixed by the number on collision), the recorded requirements moved by reference, `parentEpicId`, `splitSuffix`, `decisionCommentId`, and marks the parent `split` with `lastDecisionCommentId`; `edited` likewise with the person's children; `rejected` records the id and creates nothing; an invalid body yields the finding *decision unreadable* and creates nothing; a second pass creates nothing — the `SC-EPB-006` mutation target marked
- [X] T1569 Implement `reconcileDecisions(projectId)` in `backend/src/modules/epics/epic.service.ts` over `ExecutionCommentService`'s read (comments of type `decomposition-decision` on the project's executions) and `validateDecompositionDecision` from `@pmi/workspace-bundle` (unit test: T1568) — `R-044-6`
- [X] T1570 [P] Write the failing contract test `backend/tests/contract/epics-api.spec.ts` — the nine routes of `contracts/epics-api.md` §1 on `EpicsController` metadata, `OwnerGate` on every write, the refusal codes of §3, the `BoardRead` shape
- [X] T1571 Implement `backend/src/modules/epics/epics.controller.ts` and `backend/src/modules/epics/epics.module.ts` (imports `EpicStoresModule`, `ExecutionsModule`, `AuditModule`, the grant and project services `OwnerGate` needs), and register `EpicsModule` in `backend/src/app.module.ts` (contract test: T1570)

**Checkpoint**: the register runs on the package; Epics can be created, assigned and staged
through the services; the routes exist.

---

## Phase 3: User Story 1 — Epics group my requirements (P1) 🎯 MVP — F-044.3

**Goal**: an owner creates Epics and assigns requirements; unassigned requirements are visible;
the connector reads return the entity.

**Independent Test**: spec.md `US1` — three Epics, four assignments, one *unassigned* group, the
same grouping through `pmi.project.context` and `pmi.requirements.list`.

- [X] T1572 [P] [US1] Write the failing integration test `backend/tests/integration/epics-api.spec.ts` against the composed `AppModule` — create three Epics → numbers 1, 2, 3; two parallel creates receive distinct numbers; a closed Epic keeps its number and the next is 4; assign, move and unassign a requirement; assignment to a closed Epic → `409 epic_not_active`; the list shows counts and the requirement list shows `epicId`/`epicNumber`/`epicTitle` or null; a member without the grant reads everything and is refused every write with `403 owner_grant_required`; audit rows for every write
- [X] T1573 [US1] Wire `EpicsModule`'s Prisma providers so T1572 passes, and extend `backend/src/modules/requirements/requirements.service.ts` so listed requirements carry `epicId`, `epicNumber`, `epicTitle` (integration test: T1572)
- [X] T1574 [P] [US1] Extend `backend/tests/integration/connector-reads.spec.ts` with failing expectations — `pmi.project.context` lists the entity's active and split Epics with `epicSource: 'epic.entity'`; `pmi.requirements.list?groupBy=epic` returns one group per Epic in number order plus `unassigned`; another project's credential receives no Epic
- [X] T1575 [US1] Give `backend/src/modules/connector/project-context.service.ts` an `epics` port bound from `EpicStoresModule` (imported by `backend/src/modules/connector/connector.module.ts`), widen `epicSource` to `'unavailable-until-EPIC-044' | 'epic.entity'`, and add the dated `epicSource` note to `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` (integration test: T1574) — `R-044-8`
- [X] T1576 [P] [US1] Write failing frontend tests `frontend/tests/unit/pages/epic-list.spec.tsx` — `/requirement-room/epics` renders the Epic list: a filtered table with number, title, status, requirement count and stage; a create form (title, description); the *unassigned* group with its count; a writer without the grant sees disabled forms and why; loading, empty, error and partial states
- [X] T1577 [US1] Implement `frontend/src/pages/EpicList.tsx`; add `listEpics`, `createEpic`, `getEpic`, `updateEpic`, `closeEpic`, `assignRequirementEpic`, `assignSpecificationEpic`, `getEpicStage`, `getBoard` and the `Epic`, `EpicStage`, `BoardRead` types to `frontend/src/services/api.ts`; register the route in `frontend/src/shell/area-views.tsx` (unit test: T1576)
- [X] T1578 [P] [US1] Write failing frontend tests `frontend/tests/unit/pages/epic-detail.spec.tsx` — `/requirement-room/epics/:id` shows description with edit, the Epic's requirements with unassign and an assign control over the project's unassigned requirements, its specifications, its stage card with last and next command, a link to the project's executions timeline, parent and children, decisions; a closed Epic offers no assignment; four states
- [X] T1579 [US1] Implement `frontend/src/pages/EpicDetail.tsx` and its route in `frontend/src/shell/area-views.tsx` (unit test: T1578)
- [X] T1580 [P] [US1] Extend `frontend/tests/unit/pages/requirements.spec.tsx` with a failing expectation — each requirement row shows *Epic 2 · Review* or *unassigned*, and the Epic column filters
- [X] T1581 [US1] Show the Epic on requirement rows in `frontend/src/pages/Requirements.tsx` from the extended list response (unit test: T1580)

**Checkpoint**: Scenario 3, 4 and 5 of `quickstart.md` hold; the entity is the source of the
connector's Epic list.

---

## Phase 4: User Story 2 — I see every Epic's stage on the board (P1) — F-044.4

**Goal**: the Spec Journey Board in the Specifications area, derived from executions.

**Independent Test**: spec.md `US2` — three Epics, two `specify` and one `plan` through the
harness; *Not started* / *Specified* / *Planned* with last and next.

- [X] T1582 [P] [US2] Write the failing integration test `backend/tests/integration/epic-stages.spec.ts` — Epics of the composed application; executions registered and completed through a real `pmi-studio` server via `runBegin`/`runFinish` (`@pmi/workspace-bundle`) with numeric `targetId`s; `GET /v1/projects/{id}/epics/stages` shows *Not started* / *Specified* / *Planned* with last and next; `GET /v1/epics/{id}/stage` agrees; a `failed` `plan` after a completed `clarify` stays *Clarified* and shows the failure as last; an unfinished `implement` shows *Implementing* with `running`; a `converge` whose comment names `tasks.md` leaves the stage, one that does not moves to *Converged*, a later `implement` returns to *Implementing*; a registration with `targetId` `99` is listed `unbound`; a queued provisional record moves nothing (`SC-EPB-007`); 50 Epics and 500 executions answer in under 2 s
- [X] T1583 [US2] Implement the Prisma `ExecutionEvidenceReader` (one statement) in `backend/src/modules/epics/epic-stage.service.ts` and wire the two stage routes so T1582 passes (integration test: T1582)
- [X] T1584 [P] [US2] Write failing frontend tests `frontend/tests/unit/pages/journey-board.spec.tsx` — `/specifications/board` renders *Not started* and the nine profile columns in order; cards show number, title, stage, last command with outcome and time as a timeline link, the next command or why there is none, *closed* / *split into …* / *running since …*; the *unbound executions* group; filters by title and by stage; loading, empty, error and partial states; after a completed execution the board re-renders the moved card on reload and offers no manual refresh control (`FR-EPB-048`, analysis `U1`); the footer *derived from executions · epic-stage v<version>*
- [X] T1585 [US2] Implement `frontend/src/pages/JourneyBoard.tsx` and its route inside the Specifications area in `frontend/src/shell/area-views.tsx` (unit test: T1584)
- [X] T1586 [P] [US2] Extend `frontend/tests/unit/shell/area-reachability.spec.tsx` with failing expectations — `/requirement-room/epics`, `/requirement-room/epics/:id` and `/specifications/board` resolve inside their delivered areas, and the `T442t` route table in `specs/036-application-shell/` documents the three lines
- [X] T1587 [US2] Register the three sub-routes in `frontend/src/shell/areas.ts` / `frontend/src/shell/area-views.tsx` and add the three `T442t` route lines with a dated `EPIC-044` note to the `EPIC-036` documents (unit test: T1586)

**Checkpoint**: Scenarios 6, 7, 8 and 10 hold.

---

## Phase 5: User Story 3 — Reaching a stage and being ready are different claims (P2) — F-044.5

**Goal**: the readiness verdict beside the stage, with the empty customer condition set shown
as such; the repository's own readiness unchanged.

**Independent Test**: spec.md `US3` — an Epic at *Analyzed* reads *Ready — no readiness
conditions configured*; the register's DOR results are byte-identical.

- [X] T1588 [P] [US3] Extend `packages/epic-stage/tests/readiness.spec.ts` and `backend/tests/unit/epics/epic-stage.service.spec.ts` with failing expectations — at *Analyzed* or higher under the `customer` profile the verdict is `Ready` with the note *no readiness conditions configured* and next `/speckit-implement`; below *Analyzed* the verdict is `n/a`; the `repository` profile's fixtures are unchanged
- [X] T1589 [US3] Implement the readiness layering in `backend/src/modules/epics/epic-stage.service.ts`, and the verdict, the note and the sentence naming where conditions will be configured on the card in `frontend/src/pages/JourneyBoard.tsx` and the stage card in `frontend/src/pages/EpicDetail.tsx`; no control marks an Epic ready (unit test: T1588)
- [X] T1590 [US3] Record in `specs/044-epic-model-journey-board/quickstart.md` §Results the register's digest before and after the extraction and the count of governance specs that passed unchanged (conformance: `tests/governance/epic-stage/register.spec.ts`)

---

## Phase 6: User Story 4 — The first run runs over my real Epics (P2) — F-044.6

**Goal**: the decompose read returns the entity's bundles; a recorded split creates child Epics
once; children's executions resolve to them.

**Independent Test**: spec.md `US4` — three Epics through the harness, one confirmed split, five
Epics on the board with the parent *split*.

- [X] T1591 [P] [US4] Extend `backend/tests/integration/decomposition-read.spec.ts` with failing expectations — with Epics and assigned requirements, `GET /v1/projects/me/decomposition` returns the entity's bundles (retired requirements excluded), unassigned requirements separately and `epicSource: 'epic.entity'`; `runFirstRun` over the composed application registers **one `specify` execution per Epic** (replacing the *registers nothing* assertion `EPIC-042` recorded)
- [X] T1592 [US4] Route `DecompositionPlanService` (`backend/src/modules/governance/decomposition-plan.service.ts`) through the entity-backed `requirementsByEpic` with no shape change, so T1591 passes (integration test: T1591)
- [X] T1593 [P] [US4] Write the failing integration test `backend/tests/integration/decision-reconcile.spec.ts` — `runFirstRun` with a confirmed split through the real server records the `decomposition-decision` comment; the next Epic-list read creates two children with the next free numbers, the recorded slugs, the moved requirements, the parent link and the parent marked `split`; a second read creates nothing; executions bound as `7a` and `7b` resolve to the children on the board; a rejected decision creates nothing (`SC-EPB-006`)
- [X] T1594 [US4] Wire `reconcileDecisions` into the list, board and stage reads in `backend/src/modules/epics/epics.controller.ts` and the suffix binding in `backend/src/modules/epics/epic-stage.service.ts` so T1593 passes (integration test: T1593)
- [X] T1595 [P] [US4] Extend `frontend/tests/unit/pages/epic-detail.spec.tsx` and `frontend/tests/unit/pages/journey-board.spec.tsx` with failing expectations — a split parent shows *split into 8, 9*, its decision and who decided; a child shows its parent and suffix; the parent's card says *split into …*
- [X] T1596 [US4] Implement the split and child presentation in `frontend/src/pages/EpicDetail.tsx` and `frontend/src/pages/JourneyBoard.tsx` (unit test: T1595)

---

## Phase 7: User Story 5 — The specification list tells me which Epic and which stage (P3) — F-044.7

- [X] T1597 [P] [US5] Write failing unit tests `backend/tests/unit/specifications/specification-epic.spec.ts` — listed specifications carry `epicId`, `epicNumber`, `epicTitle` (null when unbound); a specification created by an execution bound to Epic 2 is bound to Epic 2; `PUT /v1/specifications/{sid}/epic` assigns and unassigns under the owner gate
- [X] T1598 [US5] Implement the specification binding — the list projection in the specifications module, the binding on creation from the execution's target, and the route in `backend/src/modules/epics/epics.controller.ts` (unit test: T1597)
- [X] T1599 [P] [US5] Extend `frontend/tests/unit/pages/SpecificationList.spec.tsx` with failing expectations — **Epic** and **Stage** columns, both filterable; *no Epic* with an empty stage for an unbound specification; an owner assigns it from the row
- [X] T1600 [US5] Implement the two columns in `frontend/src/pages/SpecificationList.tsx` from the extended list response and the board read (unit test: T1599)

---

## Phase 8: Polish & Cross-Cutting — F-044.8

- [X] T1601 Update `README.md` §Setup and `docs/operator-setup.md` — Epics and assignment, the Spec Journey Board, stages derived from executions, the shared derivation package and its mirror (conformance: `tests/governance/readme-conformance.spec.ts`)
- [X] T1602 Write the failing Tier 2 harness `e2e/tests/epic-044-m3.spec.ts` — Playwright creates three Epics and assigns requirements in the Requirement Room; the sequence harness (`@pmi/workspace-bundle` `runFirstRun`) runs a first run through a real `pmi-studio` server over stdio with one confirmed split; Playwright opens the board and asserts every Epic at *Specified* with `/speckit-clarify` next, the children present and the parent *split*; writes the transcript record under `docs/uat/` (`EPIC-044-m3-transcript.md`, produced by the `T1607` run) naming the stack
- [X] T1603 Fill `specs/044-epic-model-journey-board/quickstart.md` §Results — the board read and derivation timings, the register byte-identity, the transcript path
- [X] T1604 Confirm `backend/tests/contract/mcp-tool-surface.spec.ts` is green against the amended `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` and that `backend/tests/architecture/connector-boundary.spec.ts` still lists thirteen scopes (conformance: `backend/tests/contract/mcp-tool-surface.spec.ts`)

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI, XII) — F-044.Z

- [X] T1605 Confirm every implementation task in `specs/044-epic-model-journey-board/tasks.md` has a passing unit test or conformance check, by running the whole-project suites (`pnpm test:unit && pnpm test:contract && pnpm test:integration && pnpm test:arch && pnpm test:governance`) and recording the counts in `specs/044-epic-model-journey-board/closure.md`
- [X] T1606 **Constitution XI Tier 1 (ALWAYS)** — `T1572`, `T1574`, `T1582`, `T1591` and `T1593` drive the Epic routes, the connector reads and the stage reads against the composed `AppModule` in `backend/src/app.module.ts`, with executions through a real `pmi-studio` server (integration tests: T1572, T1582, T1593); prove by inversion — remove `EpicsModule` from `backend/src/app.module.ts` and observe `T1572` and `T1582` red — and record it in `specs/044-epic-model-journey-board/closure.md`
- [ ] T1607 **Constitution XI Tier 2** — run `e2e/tests/epic-044-m3.spec.ts` against the reference-local stack and commit the run-generated transcript under `docs/uat/` (`EPIC-044-m3-transcript.md`) naming the stack (`SC-EPB-003`)
- [X] T1608 **Two mutation observations and one inversion recorded** in `specs/044-epic-model-journey-board/closure.md`: `T1562` fails when a `failed` execution counts as completed and when a gap is ignored (`SC-EPB-001`); `T1568` fails when reconciliation ignores `decisionCommentId` (`SC-EPB-006`); the register drift check fails when the governance shim carries a local rule that skips `Checklisted` (`SC-EPB-002`, inversion)
- [X] T1609 **Constitution XII** — record in `specs/044-epic-model-journey-board/closure.md` that the commands producing this Epic ran **unregistered by hook** (this repository is not a PMI-managed project) and that the `M3` transcript's executions are registered by `speckit.pmi.begin` against real Epics — the first run over the composed application that registers anything
- [ ] T1610 Run `/speckit-converge`; append any remaining work to `specs/044-epic-model-journey-board/tasks.md`; triage `specs/044-epic-model-journey-board/defects/` leaving no open record; regenerate `governance/epic-stage-register.md` with `pnpm register:update` (twice); re-run `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:arch && pnpm test:governance`; then promote `local → dev` (no environment skipped) **only on an instruction naming the environment**
- [X] T1611 **ADRs and records** — confirm `adr/ADR-0030-local-first-execution-and-integration-contract.md` carries its 2026-09-05 `EPIC-044` amendment (`FR-EPB-070`), `governance/repository-layout.md` registers `packages/epic-stage/`, and `governance/epic-stage.config.json` is the verified mirror; record all three in `specs/044-epic-model-journey-board/closure.md`
- [X] T1612 [US3] After `T1561`'s byte-identity proof is recorded, extend `tests/governance/epic-stage/render.spec.ts` with a failing expectation — the register's footer names the derivation package version (*derived by `@pmi/epic-stage` v<version>*) read from `packageVersion()` — then add the footer line in `tests/governance/epic-stage/render.ts`, regenerate `governance/epic-stage-register.md` with `pnpm register:update` and record this second regeneration in `specs/044-epic-model-journey-board/closure.md` as the one intended change after the extraction (unit test: T1612) per FR-EPB-012 (analysis `I1`)
- [X] T1613 [P] Write the failing architecture check `backend/tests/architecture/epic-stage-boundary.spec.ts` — every file under `packages/epic-stage/src/` imports only `node:` modules and sibling files (nothing from `backend/`, `tests/`, `engine-adapters/` or a toolkit package); no file under `backend/src/modules/epics/` contains a governed command name as a string literal (`specify`, `clarify`, `checklist`, `plan`, `tasks`, `analyze`, `implement`, `converge` come from the configuration) — then keep both boundaries clean (check: T1613) per FR-EPB-014 (analysis `C1`)

> `T1612` and `T1613` were appended on 2026-09-05 by the `/speckit-analyze` remediation (findings `I1`, `C1`); identifiers are never renumbered, so they sit after `T1611`. `T1612` executes in Phase 5 after `T1590`; `T1613` executes in Phase 2 alongside `T1558`.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3**: strict. The package project and the configuration (Phase 1)
  are what the extraction (Phase 2) moves into; the store and the schema are what the service
  needs; the register must be proved byte-identical (`T1561`) **before** the product imports the
  package, so a later disagreement is the product's, never the register's.
- **Phase 3 (US1)** is the MVP: Epics, assignment, the connector reads. **Phase 4 (US2)** needs
  `T1567` and `T1571`; **Phase 5 (US3)** extends Phase 4's service and screens; **Phase 6 (US4)**
  needs `T1569` and `T1583` and is the first run's re-proof; **Phase 7 (US5)** needs `T1583` for
  the stage column and can run in parallel with Phases 5–6.
- Within a phase, every `[P]` test task may run before or alongside its neighbours; each
  implementation task waits for its named test and for the file-sharing task before it
  (`T1567` → `T1583` → `T1589` → `T1594`; `T1577` → `T1579` → `T1596`; `T1585` → `T1589` → `T1596`).

### Cross-Epic dependencies

| This Epic needs | From | State |
|---|---|---|
| the stage configuration, `deriveStage`, `resolveReadiness`, the register and its 32 specs | `EPIC-026` | delivered; extracted here |
| the connector reads, `pmi.health`, the execution tools, the tool-surface contract | `EPIC-043` | delivered on `epic/043-pmi-integration-contract` |
| the first-run loop, the `decomposition-decision` record, the finish hook's comment format, the sequence harness, `OwnerGate` | `EPIC-042` | delivered on `epic/042-pmi-spec-kit-extension`, this branch's base |
| execution registrations with input target bindings and lifecycle events | `EPIC-037` | delivered |
| the Requirement Room and its requirement rows | `EPIC-033` | delivered |
| readiness conditions for customer projects | later Epic | out of scope; an empty set here |

### Parallel Example: Phase 2

```text
T1558 · T1559 · T1562 · T1564 · T1566 · T1568 · T1570   (seven failing tests, different files)
then T1560 → T1561 → T1563 → T1565 → T1567 → T1569 → T1571
```

### Parallel Example: Phase 3

```text
T1572 · T1574 · T1576 · T1578 · T1580   (five failing tests)
then T1573 → T1575 → T1577 → T1579 → T1581
```

## Implementation Strategy

1. **Phases 1–2 first** and commit after `T1561`: the register runs on the package and is
   byte-identical — the one proof that cannot be produced later.
2. **US1 next** — the entity, assignment and the connector reads — and stop to demonstrate
   Scenario 5 through a real server: the platform now has Epics to decompose into.
3. **US2** — the board — then **US3** on top of it.
4. **US4** re-proves `EPIC-042`'s first run against real Epics; it is the milestone's half.
5. **US5, polish and closure**: the transcript is the last thing written, because it is the only
   thing here that a person, not a test, will read first.
