---

description: "Task list for EPIC-034 Change Room"
---

# Tasks: Change Room

**Epic**: `EPIC-034`

**Input**: Design documents from `/specs/034-change-room/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/change-contract.md](./contracts/change-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code names its
test, written FIRST and failing before the implementing code. The `/speckit-tasks` skill describes
tests as optional; **the constitution overrides it**.

**Requirement citation convention** *(stated so analysis does not rediscover it — `EPIC-033` `U1`)*:
a requirement is cited on the task that **tests** it; the implementing task cites the **test** by
identifier. The trace is two-hop, deliberate, and consistent across every Wave 1 Epic.

**Non-code outputs count too** (Constitution V, v1.2.0). This Epic's non-code output is
`packages/loop-contract/workflows/change-room.json`; its executable conformance check is
`EPIC-030`'s `T993s`, whose `T932` reads **every** file in that directory. `T406v` authors this
Epic's file and must cite `T993s` — not a local architecture test, which would check a different
thing entirely *(corrected 2026-08-23, analysis finding `C2`)*.

**Organization**: grouped by the six user stories of [spec.md](./spec.md).

## ⚠ Task identifiers — four bases

**99 tasks on four base identifiers.** Re-derived against `G-26-15`'s own regex across every
branch: **992 of 999 prefixes are in use and 7 were free** — `406`, `994`–`999`. This Epic takes
four and leaves **three** for `EPIC-035`, the last Wave 1 Epic.

> An earlier count in this session said 8 free and included `864`. It is not free:
> `epic/017-enhancement-model:specs/011-traceability/tasks.md` declares `- [X] T864`. The count was
> taken from prose as well as checklist lines; `G-26-15` reads **only** lines matching
> `^\s*- \[[xX ]\]\s*(T\d{3}[a-z]?)\b`, so that is the regex this Epic's allocation was re-derived
> with. Recorded rather than quietly corrected — a numbering scheme this close to its ceiling cannot
> afford a counting method that disagrees with the check.

| Base | Phases |
|---|---|
| `T406` | Phase 1 Setup (`a`–`e`) · Phase 2 Foundational (`f`–`w`) |
| `T996` | Phase 3 US1 (`a`–`i`) · Phase 4 US2 (`j`–`q`) · Phase 5 US3 (`r`–`x`) |
| `T994` | Phase 6 US4 (`a`–`i`) · Phase 7 US5 (`j`–`q`) · Phase 8 US6 (`r`–`z`) |
| `T995` | Phase N Polish (`a`–`l`) · Phase Z Closure (`m`–`z`) |

**Identifiers do not sort into execution order.** The table above is the map, and the bases are not
contiguous — `T406` is a hole low in the corpus, the rest are its last three. Three phases share a
base where two would not fit.

**`EPIC-035` has three bases — 81 identifiers — and its spec carries seven user stories.** Its two
sibling Rooms needed 100 and 99 tasks for six. `T995y` carries the hand-off to `EPIC-026`;
`EPIC-032` raised it as a warning and `EPIC-033` as a blocker, **and here it stops being a warning**:
this is the first Epic that had to split three phases onto one base, and the next one does not fit at
all.

**Before starting**: sync from GitHub, and **work in a dedicated worktree** at
`.claude/worktrees/epic-034-change-room` — the plan records the concurrent-session gate as **FAIL**
and `T406a` is its discharge. Label the session `EPIC-034 Change Room`.

**⚠ Hard prerequisite**: **`EPIC-033` Phase 2 must be built.** This Room imports
`packages/room-contract` and `frontend/src/rooms/RoomShell.tsx` and derives nothing (`R-034-3`).

**Before finishing**: close with a report (Constitution IX). The Delivery Board is **stale**.

**Interaction budget** (Constitution X): implementation is an execution phase — run without pausing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6
- Exact file paths in every description

## Path Conventions

- Imported, never derived: `packages/room-contract/`, `frontend/src/rooms/RoomShell.tsx`
- This Room's engine: `backend/src/modules/change-room/`
- This Room's page: `frontend/src/pages/ChangeRoom.tsx`
- Loop instance: `packages/loop-contract/workflows/change-room.json`

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T406a Create the worktree `git worktree add .claude/worktrees/epic-034-change-room epic/034-change-room` and work there — discharges the plan's one failing Constitution gate
- [ ] T406b Confirm `EPIC-033` Phase 2 is built and `packages/room-contract` resolves — this Epic **imports** `RoomShellProps`, `Epistemic`, `Labelled<T>` and `RoomObjectRef` and derives none of them (`R-034-3`). If it is not built, stop: `UX-0035`'s compile-time guarantee depends on one shell, not two
- [ ] T406c [P] Add `backend/src/modules/change-room` to the `## Paths that must not break` list in `governance/repository-layout.md` — `G-05d` is the conformance check that reads that list, and this task produces no application code of its own
- [ ] T406d [P] Confirm `supertest` is present from `EPIC-030`; if that branch has not merged, add it with its `TS-001` register entry in `specs/_shared/dependencies.md`
- [ ] T406e Confirm `EPIC-020`'s `ImpactService` and `EPIC-011`'s `ChainTraversalService` resolve, and record the observed `DEFAULT_IMPACT_DEPTH` — this Epic **adopts** it rather than configuring its own (`R-034-1`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user story phase may start until this completes

### The types that carry the guarantees

- [ ] T406f [P] Write failing unit tests for the impact view shape in `backend/tests/unit/change-room-impact-type.spec.ts` — asserts `ImpactView` is a **`Record` over all eight areas**, so an area cannot be omitted, and that `unknownReason` is **required when `state` is `unknown`** (`FR-CHR-030`, `FR-CHR-032`)
- [ ] T406g Implement `ImpactView`, `ImpactArea` and `IMPACT_AREAS` in `backend/src/modules/change-room/impact.types.ts` (unit test: T406f) — an absent row and a clean row must not look alike
- [ ] T406h [P] Write failing unit tests for the option types in `backend/tests/unit/change-room-option-type.spec.ts` — asserts `ChangeOptions` is a **minimum-length tuple of two**, so one option is a compile error, and `tradeOffs` is a **`Record` over all six dimensions** so security cannot be skipped (`FR-CHR-040`, `FR-CHR-041`)
- [ ] T406i Implement `ChangeOption`, `ChangeOptions` and `TRADEOFF_DIMENSIONS` in `backend/src/modules/change-room/option.types.ts` (unit test: T406h)
- [ ] T406j [P] Write failing unit tests for the re-plan obligation type in `backend/tests/unit/change-room-replan-type.spec.ts` — asserts `RePlanObligation` has **no execute path**, and that its `state` names `U-12` as the discharging owner (`FR-CHR-062`, `R-034-2`)
- [ ] T406k Implement `RePlanObligation` in `backend/src/modules/change-room/replan.types.ts` (unit test: T406j)

### The two boundaries an architecture test must hold

- [ ] T406l [P] Write the failing architecture test in `backend/tests/architecture/change-room-independence.spec.ts` — asserts **no region vocabulary of this Room's own**, **no second impact traversal**, **no import of `TaskRegenerationService`**, no requirement text, and no Defect Room vocabulary (`FR-CHR-002`, `FR-CHR-031`, `R-034-2`)
- [ ] T406m Make `backend/src/modules/change-room/` satisfy the independence test (conformance: T406l) — the import ban is the load-bearing clause; a boundary that depends on remembering is not a boundary

### Composing what exists

- [ ] T406n [P] Write failing unit tests for the impact composer in `backend/tests/unit/change-room-impact-composer.spec.ts` — composes `ImpactService` and `ChainTraversalService`, records the adopted `traversalDepth`, and maps an unreachable traversal to **`unknown` rather than refusing** (`FR-CHR-030`, `FR-CHR-031`, `R-034-1`)
- [ ] T406o Implement `backend/src/modules/change-room/impact.composer.ts` (unit test: T406n) — a composer that owns no graph
- [ ] T406p [P] Write failing unit tests for the port tokens in `backend/tests/unit/change-room-ports.spec.ts` — five ports refuse when absent; **`ImpactSource` degrades to `unknown`**, and the asymmetry is asserted rather than assumed (`FR-CHR-032`)
- [ ] T406q Implement `backend/src/modules/change-room/change-room.tokens.ts` (unit test: T406p) — `LoopEngine`, `PolicyProvider`, `EvidenceContractSource`, `BaselineReader`, `ImpactSource`, `TransferIntake`

### Persistence, loop instance and wiring

- [ ] T406r Add `ChangeRequest`, `ImpactView`, `ChangeDecision`, `BaselineDelta`, `RePlanObligation` and `ChangeClosure` to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) §1–§8 (integration test: T406t)
- [ ] T406s Generate the migration under `backend/prisma/migrations/` including **`targetBaselineVersion NOT NULL`** (a change with no baseline is not a change), the **`decidedBy` must resolve to a human** check constraint, and `unknownReason NOT NULL` when an area is `unknown` (integration test: T406t)
- [ ] T406t [P] Write failing integration tests asserting all three constraints reject at the database level in `backend/tests/integration/change-room-constraints.spec.ts` — the human-decider constraint is the belt beside `EPIC-031`'s policy braces, so the fence holds even if a caller bypasses the policy engine
- [ ] T406u [P] Write the failing reachability test in `backend/tests/integration/change-room-reachability.spec.ts` importing the real `AppModule` — Constitution XI Tier 1
- [ ] T406v Author `packages/loop-contract/workflows/change-room.json` and make it pass `EPIC-030`'s configuration conformance check (conformance: T993s — on `epic/030`; integration test: T994z) — `FR-CHR-001`, a **distinct workflow type**, with unused stages visible as omitted (`FR-GEL-008`). **This file is what `T994z` proves**: type isolation is a property of the configuration and of `EPIC-030`'s `T944b` resolution, not of new code here. **Cross-Epic dependency**: `T993s` is `EPIC-030`'s failing-first check and its `T932` already reads every file under `packages/loop-contract/workflows/`, so no new check is needed here — but this task cannot be discharged until `epic/030` merges. *Cited `T406l` until 2026-08-23 (analysis finding `C2`): that is this Epic's independence architecture test, which asserts vocabulary and import bans and nothing whatever about the workflow file, so Constitution V's non-code output had no check that could fail for it*
- [ ] T406w Implement `backend/src/modules/change-room/change-room.module.ts` and register it in `backend/src/app.module.ts` (integration test: T406u) — the wiring T406u exists to prove

**Checkpoint**: the guarantees are types, the boundaries are asserted, and nothing is traversed twice

---

## Phase 3: User Story 1 - No approved baseline changes without passing through this Room (Priority: P1) 🎯 MVP

**Goal**: `RULE-02` — the rule that makes every baseline worth having

**Independent test**: [quickstart.md](./quickstart.md) Scenario 1

- [ ] T996a [P] [US1] Write failing unit tests for change intake in `backend/tests/unit/change-room-intake.spec.ts` — a proposed modification is recordable only as a Change Request **linked to a baseline**, carrying requested outcome, reason, urgency, requester and unresolved questions (`FR-CHR-010`, `FR-CHR-020`)
- [ ] T996b [US1] Implement `backend/src/modules/change-room/intake.service.ts` (unit test: T996a)
- [ ] T996c [P] [US1] Write failing unit tests for urgency handling in `backend/tests/unit/change-room-urgency.spec.ts` — urgency is a **recorded attribute and never a gate bypass**; a skipped gate resolves to a recorded exception or a violation, never a pass (`FR-CHR-021`, `ADR-0025` constraint 2)
- [ ] T996d [US1] Implement urgency recording in `backend/src/modules/change-room/intake.service.ts` (unit test: T996c)
- [ ] T996e [P] [US1] Write the failing integration test for the baseline gate in `backend/tests/integration/change-room-baseline-gate.spec.ts` — no implementation-changing request bypasses traceable change control once the baseline is approved (`FR-CHR-011`, `SC-CHR-001`, `RULE-02`)
- [ ] T996f [US1] Implement the baseline gate and the `EPIC-033` in-place-edit handoff in `backend/src/modules/change-room/intake.service.ts` (integration test: T996e) — this Room is where `FR-RQR-051`'s refusal leads
- [ ] T996g [P] [US1] Write failing unit tests for clarification and withdrawal in `backend/tests/unit/change-room-clarification.spec.ts` — questions presented as one set and answerable in place; a **withdrawn** request and its analysis are both retained (`FR-CHR-022`, `FR-CHR-023`)
- [ ] T996h [US1] Implement clarification and withdrawal in `backend/src/modules/change-room/intake.service.ts` (unit test: T996g)
- [ ] T996i [US1] Implement `POST /rooms/change/requests` in `backend/src/modules/change-room/change-room.controller.ts` (integration test: T406u)

**Checkpoint**: US1 demonstrable — `RULE-02` has a destination

---

## Phase 4: User Story 2 - The blast radius is visible before the decision (Priority: P1)

**Goal**: `BR-0044` — a change decided without its impact view is decided on the part somebody thought of

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 2 and 3

- [ ] T996j [P] [US2] Write failing unit tests for the eight-area view in `backend/tests/unit/change-room-impact-areas.spec.ts` — requirements, specifications, architecture, tasks, code, tests, release scope and operational effects, **all eight always present** (`FR-CHR-030`)
- [ ] T996k [US2] Implement eight-area assembly in `backend/src/modules/change-room/impact.composer.ts` (unit test: T996j)
- [ ] T996l [P] [US2] Write failing unit tests for unknown areas in `backend/tests/unit/change-room-impact-unknown.spec.ts` — an undeterminable area is `unknown` with a **stated reason**, never omitted and never `not-impacted` (`FR-CHR-032`, `SC-CHR-002`)
- [ ] T996m [US2] Implement unknown-area handling in `backend/src/modules/change-room/impact.composer.ts` (unit test: T996l)
- [ ] T996n [P] [US2] Write failing unit tests for architecture-decision surfacing in `backend/tests/unit/change-room-architecture-impact.spec.ts` — touched governed decisions are surfaced, and the view **states that the violation check has not run** rather than showing a clean panel (`FR-CHR-033`, `FR-CHR-034`, `BR-0073` is `U-17`)
- [ ] T996o [US2] Implement architecture-decision surfacing in `backend/src/modules/change-room/impact.composer.ts` (unit test: T996n) — Constitution IX's rule applied to a screen
- [ ] T996p [P] [US2] Write failing unit tests for view retention in `backend/tests/unit/change-room-impact-retention.spec.ts` — the view is retained with the change so a decision can later be read against what was known (`FR-CHR-035`)
- [ ] T996q [US2] Implement `GET /rooms/change/requests/:id/impact` and view retention in the controller and `backend/src/modules/change-room/impact.composer.ts` (unit test: T996p; integration test: T406u)

**Checkpoint**: US2 demonstrable — nothing undeterminable renders as clean

---

## Phase 5: User Story 3 - Options carry all six dimensions (Priority: P2)

**Goal**: `BR-0045` — presenting a change on schedule alone is how security becomes a discovery

**Independent test**: [quickstart.md](./quickstart.md) Scenario 4

- [ ] T996r [P] [US3] Write failing unit tests for option generation in `backend/tests/unit/change-room-options.spec.ts` — two or more **for every Change Request, with no materiality threshold** (`FR-CHR-040` as resolved in spec.md), each carrying all six trade-off dimensions or explicitly `not-applicable`, each labelled `recommendation`, none pre-selected (`FR-CHR-040`, `FR-CHR-041`, `FR-CHR-042`)
- [ ] T996s [US3] Implement `backend/src/modules/change-room/options.service.ts` (unit test: T996r) — invokes `EPIC-028`'s `AgentGateway` with capability `analyze`, degrading rather than refusing when absent, as `EPIC-033` established
- [ ] T996t [P] [US3] Write failing unit tests for decision retention in `backend/tests/unit/change-room-declined-options.spec.ts` — the chosen option, its rationale and the **options declined** are all retained (`FR-CHR-043`)
- [ ] T996u [US3] Implement declined-option retention in `backend/src/modules/change-room/decision.service.ts` (unit test: T996t)
- [ ] T996v [P] [US3] Write failing component tests for the options region in `frontend/tests/unit/pages/ChangeRoom.options.spec.tsx` — options render as recommendations, visually distinct from recorded fact and human decision (`FR-CHR-082`, `UX-0031`) *Path corrected 2026-08-23: the task named a `*.test.tsx` path under `frontend/src/`, which the `frontend` vitest project never collects — it takes `tests/unit/**/*.spec.{ts,tsx}` and nothing else, so a test written there would never run, and a test that never runs is worse than no test because it reads as coverage. Surfaced by `T148` when every branch reached `main`. The SOURCE path is unchanged.*
- [ ] T996w [US3] Implement the options region in `frontend/src/pages/ChangeRoom.tsx` (unit test: T996v) — using `EPIC-033`'s epistemic token mapping, not a local one
- [ ] T996x [US3] Implement `POST /rooms/change/requests/:id/options` in the controller (integration test: T406u)

**Checkpoint**: US3 demonstrable — six dimensions, every time

---

## Phase 6: User Story 4 - An approved change re-baselines, and the old baseline stays readable (Priority: P1)

**Goal**: `BR-0047` — the half of change control usually skipped

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 6, 7 and 8

- [ ] T994a [P] [US4] Write failing unit tests for the decision path in `backend/tests/unit/change-room-decision.spec.ts` — a material change receives an authorized **human** decision before implementation affects a baseline, evaluated through `EPIC-031` using the published `BR-0005` record (`FR-CHR-050`, `FR-CHR-052`)
- [ ] T994b [US4] Implement `backend/src/modules/change-room/decision.service.ts` (unit test: T994a; integration test: T994c) — surfaces in the Decision Inbox (`FR-CHR-053`)
- [ ] T994c [P] [US4] Write the failing integration test for the high-band fence in `backend/tests/integration/change-room-high-band.spec.ts` — baseline change stays human-approved under every tenant policy, **and** an agent-taken decision is refused by the database constraint (`FR-CHR-051`, `SC-CHR-003`)
- [ ] T994d [P] [US4] Write failing unit tests for re-baselining in `backend/tests/unit/change-room-rebaseline.spec.ts` — new versions of every affected artifact; the prior baseline **byte-identical** and naming its successor (`FR-CHR-060`, `FR-CHR-061`, `SC-CHR-004`)
- [ ] T994e [US4] Implement re-baselining in `backend/src/modules/change-room/rebase.service.ts` (unit test: T994d)
- [ ] T994f [P] [US4] Write failing unit tests for the baseline delta in `backend/tests/unit/change-room-delta.spec.ts` — a **set diff over member version ids** (added, removed, version-changed), never a text diff (`FR-CHR-063`, `R-034-4`)
- [ ] T994g [US4] Implement `backend/src/modules/change-room/delta.service.ts` and `GET …/delta` (unit test: T994f; integration test: T406u)
- [ ] T994h [P] [US4] Write failing unit tests for explicit rebase and re-decision in `backend/tests/unit/change-room-rebase.spec.ts` — a change targeting a superseded baseline is rebased **as a recorded act** and **re-decided when the rebase changes its impact view**, compared against the retained snapshot (`FR-CHR-013`, `FR-CHR-054`, `SC-CHR-009`, `R-034-5`)
- [ ] T994i [US4] Implement explicit rebase and the re-decision test in `backend/src/modules/change-room/rebase.service.ts` (unit test: T994h) — `EPIC-030`'s first-commit-wins is deliberately not inherited

**Checkpoint**: US4 demonstrable — the baseline moves, and the old one is untouched

---

## Phase 7: User Story 5 - Closure says what changed, why, what proves it (Priority: P2)

**Goal**: `BR-0048` — four questions an auditor asks, answerable without reconstruction

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 7 and 9

- [ ] T994j [P] [US5] Write failing unit tests for the re-plan recorder in `backend/tests/unit/change-room-replan.spec.ts` — an approved change **records** a `RePlanObligation` naming what must change and why, and **executes nothing** (`FR-CHR-062`, `R-034-2`)
- [ ] T994k [US5] Implement `backend/src/modules/change-room/replan.recorder.ts` (unit test: T994j) — a recorder that performs no re-plan
- [ ] T994l [P] [US5] Write the failing integration test for re-plan safety in `backend/tests/integration/change-room-replan-safety.spec.ts` — apply a change affecting a specification with completed tasks and assert **no task is replaced and no completed task loses its state** (`FR-CHR-065`, `SC-CHR-007`)
- [ ] T994m [P] [US5] Write failing unit tests for change traceability in `backend/tests/unit/change-room-traceability.spec.ts` — specification, task and test changes arising from an approved change are traceable to that change (`FR-CHR-064`)
- [ ] T994n [US5] Implement change traceability links via `EPIC-011`'s `LinkWriterService` in `backend/src/modules/change-room/replan.recorder.ts` (unit test: T994m) — no second link store
- [ ] T994o [P] [US5] Write failing unit tests for closure in `backend/tests/unit/change-room-closure.spec.ts` — all four `BR-0048` questions answerable from the record alone; closure refused while the Evidence Contract is unmet; a completion declaration does not substitute for the evidence (`FR-CHR-070`, `FR-CHR-071`, `FR-CHR-072`, `FR-CHR-073`, `SC-CHR-005`, `SC-CHR-006`)
- [ ] T994p [US5] Implement `backend/src/modules/change-room/closure.service.ts` (unit test: T994o)
- [ ] T994q [US5] Implement `POST …/decide`, `POST …/rebase`, `POST …/apply` and `POST …/close` in the controller (integration test: T406u) — `403` carrying the `EPIC-031` decision id, `409` carrying the rebase affordance

**Checkpoint**: US5 demonstrable — and nothing completed was destroyed getting there

---

## Phase 8: User Story 6 - The Room reads like the other two (Priority: P3)

**Goal**: `UX-0030`, `UX-0035` — inherited, not invented

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 11 and 12

- [ ] T994r [P] [US6] Write failing component tests for the Room page in `frontend/tests/unit/pages/ChangeRoom.spec.tsx` — six regions composed through the **imported** `RoomShell`, with loading, empty, populated and error states (`FR-CHR-080`, `UX-0051`) *Path corrected 2026-08-23: the task named a `*.test.tsx` path under `frontend/src/`, which the `frontend` vitest project never collects — it takes `tests/unit/**/*.spec.{ts,tsx}` and nothing else, so a test written there would never run, and a test that never runs is worse than no test because it reads as coverage. Surfaced by `T148` when every branch reached `main`. The SOURCE path is unchanged.*
- [ ] T994s [US6] Implement `frontend/src/pages/ChangeRoom.tsx` (unit test: T994r; component test: T994t) — imports `EPIC-033`'s shell; **derives no region vocabulary**
- [ ] T994t [P] [US6] Write the failing region-vocabulary comparison test in `frontend/tests/unit/pages/ChangeRoom.vocabulary.spec.tsx` — region names identical to `packages/room-contract` and to `EPIC-033`'s, verified by comparison rather than review (`FR-CHR-081`, `SC-CHR-008`) *Path corrected 2026-08-23: the task named a `*.test.tsx` path under `frontend/src/`, which the `frontend` vitest project never collects — it takes `tests/unit/**/*.spec.{ts,tsx}` and nothing else, so a test written there would never run, and a test that never runs is worse than no test because it reads as coverage. Surfaced by `T148` when every branch reached `main`. The SOURCE path is unchanged.*
- [ ] T994u [P] [US6] Write failing component tests for blockers and policy refusal in `frontend/tests/unit/pages/ChangeRoom.blockers.spec.tsx` — what is blocking is visible without opening another screen, and a policy-refused action shows the refusing policy (`FR-CHR-083`, `FR-CHR-084`, `UX-0032`, `UX-0033`) *Path corrected 2026-08-23: the task named a `*.test.tsx` path under `frontend/src/`, which the `frontend` vitest project never collects — it takes `tests/unit/**/*.spec.{ts,tsx}` and nothing else, so a test written there would never run, and a test that never runs is worse than no test because it reads as coverage. Surfaced by `T148` when every branch reached `main`. The SOURCE path is unchanged.*
- [ ] T994v [US6] Implement the blockers, refusal and narrow-viewport regions in `frontend/src/pages/ChangeRoom.tsx` (unit test: T994u; component test: T994w)
- [ ] T994w [P] [US6] Write failing component tests for the 360px floor in `frontend/tests/unit/pages/ChangeRoom.viewport.spec.tsx` — state, decision and evidence remain visible at 360px, using the **imported** shell's breakpoints (`FR-CHR-085`, `UX-0040`, `UX-0042`) *Path corrected 2026-08-23: the task named a `*.test.tsx` path under `frontend/src/`, which the `frontend` vitest project never collects — it takes `tests/unit/**/*.spec.{ts,tsx}` and nothing else, so a test written there would never run, and a test that never runs is worse than no test because it reads as coverage. Surfaced by `T148` when every branch reached `main`. The SOURCE path is unchanged.*
- [ ] T994x [P] [US6] Write the failing transfer integration test in `backend/tests/integration/change-room-transfer.spec.ts` — a Defect Room transfer arrives with context and evidence preserved **by reference** and origin visible; a refused transfer **returns** with the refusal attached (`FR-CHR-012`, `BR-0057`, `R-034-6`)
- [ ] T994y [US6] Implement `POST …/transfer-intake` and the return path in `backend/src/modules/change-room/intake.service.ts` (integration test: T994x) — exercised jointly with `EPIC-035` `FR-DFR-074`
- [ ] T994z [P] [US6] Write the failing integration test for workflow-type isolation in `backend/tests/integration/change-room-type-isolation.spec.ts` — a Change Room object cannot transition under another Room's stages or authorities (`FR-CHR-001`, `SC-CHR-010`, via `EPIC-030` `T944a`). *Reworded 2026-08-23 (analysis finding `U1`): it read as an implementation task and cited `T406u`, the reachability test, as its pair — a citation that proves nothing about type isolation. A test-authoring task has no test partner to cite*

**Checkpoint**: all six user stories demonstrable

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T995a **Mutation proof — `FR-CHR-011`**: add a path that changes an approved baseline without a decided Change Request to `backend/src/modules/change-room/intake.service.ts`, revert (integration test: T996e — it must fail while the mutation stands). Record the observation (`SC-CHR-001`). This is `RULE-02` made mechanical
- [ ] T995b **Mutation proof — `FR-CHR-032`**: make an undeterminable impact area render as absent rather than `unknown` in `backend/src/modules/change-room/impact.composer.ts`, revert (unit test: T996l — it must fail while the mutation stands). Record the observation (`SC-CHR-002`)
- [ ] T995c **Mutation proof — `FR-CHR-062`**: import and call `TaskRegenerationService.regenerate()` from `backend/src/modules/change-room/replan.recorder.ts`, revert (architecture test: T406l **and** integration test: T994l — both must fail while the mutation stands). Record both observations. **This is the trap `R-034-2` exists to prevent, and the only way to know the ban holds is to try it**
- [ ] T995d **Mutation proof — Constitution XI Tier 1**: remove `ChangeRoomModule` from `backend/src/app.module.ts`, revert (integration test: T406u — it must fail while the mutation stands). Record the observation
- [ ] T995l **Mutation proof — `FR-CHR-054`**: make `backend/src/modules/change-room/rebase.service.ts` silently retarget a change onto the newer baseline instead of recording the rebase and re-deciding, revert (unit test: T994h — it must fail while the mutation stands). Record the observation (`SC-CHR-009`). **This is the one the spec singles out**: an approval that referred to a different impact view, different trade-offs and a different baseline, applied anyway. *Added 2026-08-23 to close analysis finding `C1` — the spec made this a condition of completion and no task discharged it. Placed with the other mutation proofs rather than in letter order, per this file's own note that identifiers do not sort into execution order*
- [ ] T995e [P] Verify the `R-034-8` targets — impact view p95 < 3 s at depth 25 over a 500-artifact project, baseline delta p95 < 500 ms at 200 members, Room load p95 < 1.2 s, closure p95 < 200 ms excluding the `EPIC-032` call — and record the measured figures
- [ ] T995f [P] Confirm the Room-load figure matches `EPIC-033`'s measured figure; a shared shell with two different results is two shells
- [ ] T995g [P] Confirm the recorded `traversalDepth` is `DEFAULT_IMPACT_DEPTH` and not a local constant (`R-034-1`)
- [ ] T995h [P] Confirm no requirement text is stored anywhere in this Epic's output — baselines are held by version id, as `EPIC-033` holds them
- [ ] T995i [P] Confirm unused loop stages render as **omitted** in the progress projection, not absent (`FR-GEL-008`)
- [ ] T995j [P] Confirm the impact composer performs **no traversal of its own** (`FR-CHR-031`), by architecture test rather than by reading
- [ ] T995k Run and record each [quickstart.md](./quickstart.md) scenario individually: **Scenario 1** (baseline gate), **Scenario 2** (eight areas, unknown included), **Scenario 3** (composed not rebuilt), **Scenario 4** (six dimensions), **Scenario 5** (human-approved under every policy), **Scenario 6** (re-baseline, old untouched), **Scenario 7** (re-plan recorded, nothing destroyed), **Scenario 8** (explicit rebase and re-decision), **Scenario 9** (closure answers four questions), **Scenario 10** (urgency is not a bypass), **Scenario 11** (transfer arrives whole and can return), **Scenario 12** (cannot diverge from siblings), **Scenario 13** (XI Tier 1), **Scenario 14** (XI Tier 2 journey)

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX, XI)

Ordered as the constitution's *"Quality gates in order"* states them.

- [ ] T995m Confirm every implementation task has a passing unit test or conformance check
- [ ] T995n **Constitution XI Tier 1 (ALWAYS)** — `T406u` drives the Room through its **real HTTP routes** against the composed module graph via the real `AppModule`, and `T995d` proved it fails when the module is unregistered
- [ ] T995o **Constitution XI Tier 2 (Epics delivering a journey)** — **APPLIES.** The request → impact → decision → re-baseline journey is exercised against a **running application** and a **run-generated** transcript is committed. It must cover the **whole chain**: the failure mode is a Room whose regions each work and whose flow does not. Hand-written evidence is a constitution violation of the first order
- [ ] T995p [P] Write the transcript conformance check in `backend/tests/architecture/change-room-transcript.spec.ts` — asserts the transcript exists, names the run, covers all four stages, and was **generated** rather than authored
- [ ] T995q Confirm this Epic published **no package** and derived **no region vocabulary** — the Room pattern is `EPIC-033`'s, and a second one would make its compile-time `UX-0035` guarantee decorative
- [ ] T995r Restate in the closing report that **`BR-0154` re-plan remains `U-12`'s**. This Epic records the obligation and executes nothing; `FR-CHR-062` is **half-dischargeable by design** until `U-12` is declared, and saying so is the difference between a known gap and a silent one
- [ ] T995s Restate that **`BR-0073` architecture-violation flagging remains `U-17`'s** — the impact area carries `unknown` with a reason, and this Room's delivery does not close it
- [ ] T995t Restate that **`BR-0083` rationale queries remain `U-17`'s** — this Room retains the *why* of each change; it does not answer queries over it
- [ ] T995u Confirm the `EPIC-035` transfer path was exercised end to end from both sides, jointly with that Epic (`FR-CHR-012`, `FR-DFR-074`)
- [ ] T995v Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T995w Triage `specs/034-change-room/defects/`; every record closed or deferred to a named Epic
- [ ] T995x Re-run the full suite green — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`
- [ ] T995y **Hand the task-identifier exhaustion to `EPIC-026` as a blocker on `EPIC-035`, not a warning.** 992 of 999 prefixes are in use; **three remain** after this Epic — 81 identifiers — against a seven-user-story spec whose two sibling Rooms needed 100 and 98 for six. State precisely what is exhausted: **the identifier space is not** (`G-26-15` requires unique *identifiers*, and `T864a`–`T864z` are unused), **the prefix-block convention is**. Reusing suffixes under someone else's prefix would pass the check and break what the suffix means — `EPIC-029` records it as *"keeps a later addition adjacent to what it pairs with"*. So the fix is one of two, and `EPIC-026` must choose: widen `T\d{3}[a-z]?` to four digits in `task-ids.spec.ts`, `dor.ts` and `task-paths.spec.ts`, or retire the adjacency meaning of the suffix and say so where the convention is written down
- [ ] T995z Promote `local → dev` (no environment skipped) and publish the Epic closing report: work completed, work deferred, the four mutation observations, the measured performance figures, and the recommended next command (Constitution IX). Refresh the Delivery Board or restate its staleness

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T406a` first. **`T406b` is a hard stop** — if `EPIC-033` Phase 2 is not built, this Epic cannot proceed without violating `UX-0035`
- **Foundational (Phase 2)**: blocks every user story
- **US1 (Phase 3)**: Phase 2 only. **MVP**
- **US2 (Phase 4)**: Phase 2's impact composer (`T406o`)
- **US3 (Phase 5)**: Phase 2's option types (`T406i`)
- **US4 (Phase 6)**: US1's intake and US2's retained impact view
- **US5 (Phase 7)**: US4's rebase service
- **US6 (Phase 8)**: `EPIC-033`'s `RoomShell`, plus every region's data source
- **Polish, Closure**: last

### Cross-Epic dependencies

**Consumes and does not rebuild**: `EPIC-020` `ImpactService`, `EPIC-011` `ChainTraversalService` and
`LinkWriterService`, `EPIC-033` `room-contract`/`RoomShell` and its baselines, `EPIC-030` loop,
`EPIC-031` decision, `EPIC-032` evidence, `EPIC-028` agent gateway.
**Explicitly does NOT consume**: `EPIC-012` `TaskRegenerationService` — import-banned (`R-034-2`).
**Paired with `EPIC-035`** on the `BR-0057` transfer, specified from both sides in one Wave.

### Parallel Example: Phase 2

```text
T406f, T406h, T406j, T406l, T406n, T406p   — six test files
T406t, T406u                                — constraints and reachability
```

---

## Implementation Strategy

**MVP is User Story 1** — no approved baseline changes except through this Room. `EPIC-033` refuses
the in-place edit; this Room is where the refusal leads, and without it `RULE-02` is a dead end.

**Phase 2 is where the guarantees stop being prose.** Four of this Epic's hardest rules become
types: an eight-member `Record` so an impact area cannot be omitted, a minimum-length tuple so one
option cannot be offered, a six-member `Record` so security cannot be skipped, and an import ban so
the destructive re-plan cannot be called.

**`T995c` is the mutation proof that matters most.** It deliberately imports and calls
`TaskRegenerationService.regenerate()` and requires **two** checks to fail — the architecture test
and the re-plan safety test. The ban is only known to hold if someone tries it.

---

## Notes

- **`T995r` is not an admission of incompleteness; it is the design.** `FR-CHR-062` is
  half-dischargeable until `U-12` exists, because the alternative — calling a service that replaces
  the task list — would satisfy the requirement's wording and violate the `BR-0154` it cites.
  Recording the obligation is the correct behaviour, and saying so in the closing report is what
  keeps it a known gap rather than a silent one.
- **Three of the four closure restatements are handovers**, not work. They exist so closure cannot be
  claimed while an unowned capability is quietly assumed.
- **`T995y` escalates the identifier exhaustion a third time, and this time it is a blocker.** It is
  the first Epic where the shortage changed the document rather than just its identifiers — three
  phases share one base — and the next Epic does not fit at all. The task states which of the two
  available fixes `EPIC-026` must choose, because "we ran out of numbers" is not actionable and
  "widen the regex" quietly assumes the answer.
- **Two citations pointed at the wrong check** (`C2`, `U1`), and both survived the pre-commit
  verification, because that verification asked whether a citation *exists* — not whether the thing
  it names could fail for the stated reason. That is exactly what `T995a`–`T995d` and `T995l` do one
  level down. A pairing detector that only counts citations will keep passing a task list that names
  the wrong test.
- **Constitution V over the skill default**: `/speckit-tasks` calls tests optional; the constitution
  overrides every template, skill and tool default.
