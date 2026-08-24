---

description: "Task list for EPIC-033 Requirement Room"
---

# Tasks: Requirement Room

**Epic**: `EPIC-033`

**Input**: Design documents from `/specs/033-requirement-room/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/room-contract.md](./contracts/room-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code names its
test, written FIRST and failing before the implementing code. The `/speckit-tasks` skill describes
tests as optional; **the constitution overrides it**.

**Non-code outputs count too** (Constitution V, v1.2.0). This Epic's non-code output is
`packages/loop-contract/workflows/requirement-room.json`; its executable conformance check is
`EPIC-030`'s configuration check, which this file must pass (`T337t`).

**Organization**: grouped by the six user stories of [spec.md](./spec.md).

**Requirement citation convention** *(stated here so analysis does not rediscover it)*: a requirement
is cited on the task that **tests** it; the implementing task cites the **test** by identifier. The
trace is therefore two-hop — `FR-RQR-050` → `T338e` (test) → `T338f` (implementation, via
`unit test: T338e`). This is deliberate and consistent across every Wave 1 Epic. `DOR-08` reads the
second hop; a reader tracing a requirement should follow both.

## ⚠ Task identifiers — five bases, two phases each

**102 tasks on five base identifiers**, because that is what the corpus has left. *`T338u` and `T338v` were appended on 2026-08-23 to close `EPIC-035` analysis finding `C1` — the Requirement-Gap inbound route this Room is the destination for.*

| Base | Phases |
|---|---|
| `T337` | Phase 1 Setup (`a`–`e`) · Phase 2 Foundational (`f`–`y`) |
| `T338` | Phase 3 US1 (`a`–`l`, and `u`–`v` appended) · Phase 4 US2 (`m`–`t`) |
| `T339` | Phase 5 US3 (`a`–`h`) · Phase 6 US4 (`m`–`s`) |
| `T403` | Phase 7 US5 (`a`–`f`) · Phase 8 US6 (`m`–`w`) |
| `T405` | Phase N Polish (`a`–`j`) · Phase Z Closure (`m`–`y`) |

**Identifiers no longer sort into execution order.** They cannot: the thirteen free prefixes are
`337–339`, `403`, `405–406`, `864`, `994–999` — scattered, not contiguous. Execution order comes
from the document, and the table above is the map.

### This is now a blocker for `EPIC-034` and `EPIC-035`, not a warning

Counted across `main` and all four tasked branches: **986 of 999 prefixes are in use; 13 remain.**
This Epic deliberately takes **five**, not ten, leaving **eight** — four each for the two remaining
Rooms, roughly 104 identifiers each under this scheme. That is *just* enough, and only because this
Epic compressed.

**The real fix is widening `T\d{3}[a-z]?` to accept four digits** in
`tests/governance/epic-stage/task-ids.spec.ts`, `dor.ts` and `task-paths.spec.ts`. That is
`EPIC-026`'s to own. `T405w` hands it over with the measurement attached. **`EPIC-032` raised this
as a warning; one Epic later it decides how the next two are written.**

**Before starting**: sync from GitHub, and **work in a dedicated worktree** at
`.claude/worktrees/epic-033-requirement-room` — the plan records the concurrent-session gate as
**FAIL** and `T337a` is its discharge. Label the session `EPIC-033 Requirement Room`.

**Before finishing**: close with a report (Constitution IX). The Delivery Board is **stale**.

**Interaction budget** (Constitution X): implementation is an execution phase — run without pausing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6
- Exact file paths in every description

## Path Conventions

- **Shared** Room pattern: `packages/room-contract/`, `frontend/src/rooms/`
- This Room's engine: `backend/src/modules/requirement-room/`
- This Room's page: `frontend/src/pages/RequirementRoom.tsx` — **beside** `Requirements.tsx`, not replacing it
- Loop instance: `packages/loop-contract/workflows/requirement-room.json`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T337a Create the worktree `git worktree add .claude/worktrees/epic-033-requirement-room epic/033-requirement-room` and work there — discharges the plan's one failing Constitution gate
- [X] T337b [P] Scaffold `packages/room-contract/package.json` and `packages/room-contract/tsconfig.json` so the package typechecks independently (`TS-004`)
- [X] T337c [P] Register a `room-contract` project in `vitest.workspace.ts` without `passWithNoTests` (`TS-005`)
- [X] T337d [P] Add `packages/room-contract` to the `## Paths that must not break` list in `governance/repository-layout.md` (`G-05d`)
- [X] T337e Confirm `supertest` is present from `EPIC-030`; if that branch has not merged, add it with its `TS-001` register entry in `specs/_shared/dependencies.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user story phase may start until this completes.
**Everything in `packages/room-contract` and `frontend/src/rooms` is SHARED with `EPIC-034` and
`EPIC-035`** — decided here, imported there.

### The shared Room contract

- [X] T337f [P] Write failing unit tests for the region slots in `packages/room-contract/tests/regions.spec.ts` — asserts `RoomShellProps` has **exactly six required members** and **no `children`**, so omitting a region is a type error (`FR-RQR-070`, `UX-0030`)
- [X] T337g Implement `RoomShellProps` in `packages/room-contract/src/regions.ts` (unit test: T337f) — `FR-RQR-071`, `UX-0035`. The region vocabulary is the prop names, defined once for three Epics
- [X] T337h [P] Write failing unit tests for the epistemic label in `packages/room-contract/tests/epistemic.spec.ts` — asserts `Epistemic` has four members, is **required**, has no default and no optional variant, so an unlabelled element is not constructible (`FR-RQR-011`, `UX-0031`)
- [X] T337i Implement `Epistemic` and `Labelled<T>` in `packages/room-contract/src/epistemic.ts` (unit test: T337h) — `R-033-4`
- [X] T337j [P] Write failing unit tests for the object reference in `packages/room-contract/tests/object-ref.spec.ts` — asserts `workflowType` is an **open string, not a closed union of three Rooms**, so the shared contract does not know its consumers (`R-033-3`)
- [X] T337k Implement `RoomObjectRef` in `packages/room-contract/src/object-ref.ts` (unit test: T337j)
- [X] T337l Implement the export barrel `packages/room-contract/src/index.ts` (unit test: T337f)

### The shared Room shell — the user-interface half

- [X] T337m [P] Write failing component tests for `RoomShell` in `frontend/tests/unit/rooms/RoomShell.spec.tsx` — all six regions render; the `UX-0041` breakpoints apply; state, decision and evidence remain visible at **360px** (`UX-0040`, `UX-0042`, `FR-RQR-075`) *Path corrected 2026-08-23: the task named a *.test.tsx beside the component under frontend/src/rooms/, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test at that path would never have been collected, and a test that never runs is worse than no test because it reads as coverage. `G-26-14` caught the mismatch when the task was ticked, which is the check doing exactly its job. The SOURCE path is unchanged.*
- [X] T337n Implement `frontend/src/rooms/RoomShell.tsx` (unit test: T337m) — owns the breakpoints and the 360px floor so no Room sets its own
- [X] T337o [P] Write failing component tests for the epistemic token mapping in `frontend/tests/unit/rooms/Epistemic.spec.tsx` — the visual treatment is **derived from** the discriminant, so label and styling cannot disagree (`FR-RQR-072`, `UX-0031`) *Path corrected 2026-08-23: the task named a *.test.tsx beside the component under frontend/src/rooms/regions/, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test at that path would never have been collected, and a test that never runs is worse than no test because it reads as coverage. `G-26-14` caught the mismatch when the task was ticked, which is the check doing exactly its job. The SOURCE path is unchanged.*
- [X] T337p Implement the region primitives and epistemic token mapping in `frontend/src/rooms/regions/` (unit test: T337o) — styled against `EPIC-029`'s system

### Ports, loop instance and persistence

- [X] T337q [P] Write failing unit tests for the five ports in `packages/room-contract/tests/ports.spec.ts` — four declare an absent-behaviour of refuse; **`AgentGateway` declares degrade**, and the asymmetry is asserted rather than assumed (`R-033-2`)
- [X] T337r Implement the port tokens in `backend/src/modules/requirement-room/requirement-room.tokens.ts` (unit test: T337q) — `LoopEngine`, `PolicyProvider`, `EvidenceContractSource`, `RequirementRegister`, `AgentGateway`
- [X] T337s [P] Write the failing architecture test in `backend/tests/architecture/room-contract-independence.spec.ts` — **no requirement-storage type**, no Change or Defect Room vocabulary, no loop stage name, no risk band, no evidence type, no closed workflow-type union (`FR-RQR-002`, `FR-RQR-003`, `D-33`)
- [X] T337t Author `packages/loop-contract/workflows/requirement-room.json` and make it pass `EPIC-030`'s configuration conformance check (conformance: T993s — EPIC-030's, merged onto this branch) — `FR-RQR-001`, `R-033-6`. `Execute` and `Verify` are **omitted and visible as omitted**, not absent (`FR-GEL-008`) *Cited `T337s` until 2026-08-23. That is this Epic's room-contract independence test, which asserts what the SHARED CONTRACT must not contain and says nothing whatever about a loop configuration file — so Constitution V's non-code output had no check that could fail for it. The real check is `EPIC-030`'s `T993s`, whose `T932` reads every file in `packages/loop-contract/workflows/`; it picked this file up with no edit and its count went 10 → 12. Identical to the `C2` finding `EPIC-034`'s analysis raised, in a task written before that analysis ran.*
- [X] T337u Add `RequirementCandidate`, `Clarification`, `RequirementDecision`, `Baseline`, `BaselineException` and `Handoff` to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) §1–§7
- [X] T337v Generate the migration under `backend/prisma/migrations/` including the **`decidedBy` must resolve to a human** check constraint (`FR-RQR-041`), baseline append-only enforcement, and the unique `(projectId, version)` on `Baseline`
- [X] T337w [P] Write failing integration tests asserting both constraints reject at the database level in `backend/tests/integration/requirement-room-constraints.spec.ts` — an agent-taken decision and a baseline `UPDATE` must both be unrepresentable
- [X] T337x [P] Write the failing reachability test in `backend/tests/integration/requirement-room-reachability.spec.ts` importing the real `AppModule` — Constitution XI Tier 1
- [X] T337y Implement `backend/src/modules/requirement-room/requirement-room.module.ts` and register it in `backend/src/app.module.ts` (integration test: T337x) — the wiring T337x exists to prove

**Checkpoint**: the shared pattern exists and is enforced by the type system; `EPIC-034`/`035` can now build against it

---

## Phase 3: User Story 1 - Raw intent becomes an approved, immutable baseline (Priority: P1) 🎯 MVP

**Goal**: `BR-0026` — the requirement everything downstream leans on

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 1 and 2

- [X] T338a [P] [US1] Write failing unit tests for multi-source intake in `backend/tests/unit/requirement-room-intake.spec.ts` — direct input and imported documents become **candidates**, normalized and labelled, never decided requirements (`FR-RQR-010`)
- [X] T338b [US1] Implement `backend/src/modules/requirement-room/intake.service.ts` (unit test: T338a)
- [X] T338c [P] [US1] Write failing unit tests for the register binding in `backend/tests/unit/requirement-room-register.spec.ts` — candidates promote into `EPIC-007`'s `RequirementsService`; **no local requirement store exists** (`FR-RQR-002`, `D-33`)
- [X] T338d [US1] Implement the `RequirementRegister` adapter binding to `EPIC-007` in `backend/src/modules/requirement-room/register.adapter.ts` (unit test: T338c) — named explicitly because `EPIC-031`'s analysis found the equivalent binding missing there (`C2`)
- [X] T338e [P] [US1] Write failing unit tests for baseline creation in `backend/tests/unit/requirement-room-baseline.spec.ts` — stores member **version ids** and a `setHash` from `requirement-hash.ts`, never copies of requirement text (`FR-RQR-050`, `R-033-5`)
- [X] T338f [US1] Implement `backend/src/modules/requirement-room/baseline.service.ts` (unit test: T338e) — the entity this Epic exists to add
- [X] T338g [P] [US1] Write the failing integration test for in-place edit refusal in `backend/tests/integration/baseline-immutability.spec.ts` — a baselined requirement returns `409` with the Change Request affordance, and the `setHash` is unchanged (`FR-RQR-051`, `RULE-02`, `SC-RQR-001`)
- [X] T338h [US1] Implement in-place edit refusal and Change Request handoff in `backend/src/modules/requirement-room/baseline.service.ts` (integration test: T338g) — `BR-0042`, the seam `EPIC-034` receives
- [X] T338u [P] [US1] Write the failing integration test for **Requirement-Gap intake** in `backend/tests/integration/requirement-room-gap-intake.spec.ts` — an item classified as a Requirement Gap by `EPIC-035` arrives as **new intent**, becomes a candidate carrying its reproduction context and evidence **by reference**, and its Defect Room origin is visible from the candidate. A gap that cannot be admitted is **refused**, never silently dropped (`EPIC-035` `FR-DFR-076`, `SC-DFR-010`)
- [X] T338v [US1] Implement `POST /rooms/requirement/gap-intake` in `backend/src/modules/requirement-room/intake.service.ts` and the controller (integration test: T338u) — the inbound half of `EPIC-035`'s third classification outcome. *Added 2026-08-23 to close `EPIC-035` analysis finding `C1`: `FR-DFR-076` was written by a clarification **after** this Epic was planned, so the destination for a routed Requirement Gap had never been told it was one. `EPIC-035`'s Exit Criterion 5 cannot hold until this task lands, and its `T997d` checks for it at Phase 1.* **Identifiers appended past the phase's `a`–`l` range**, per this file's own note that identifiers no longer sort into execution order
- [X] T338i [P] [US1] Write failing unit tests for supersession in `backend/tests/unit/requirement-room-supersede.spec.ts` — a superseded baseline stays readable and names what replaced it (`FR-RQR-052`)
- [X] T338j [P] [US1] Write failing unit tests for concurrent overlapping approval in `backend/tests/unit/requirement-room-concurrent.spec.ts` — a conflict, **never a merge** (`FR-RQR-054`); and a revised source document after baseline enters as **new intent**, leaving the baseline unmoved (`FR-RQR-055`)
- [X] T338k [US1] Implement supersession, conflict detection and Evidence Contract satisfaction in `backend/src/modules/requirement-room/baseline.service.ts` (unit tests: T338i, T338j) — `FR-RQR-053` gates approval on `EPIC-032`
- [X] T338l [US1] Implement `POST /rooms/requirement/intake` and `POST /rooms/requirement/:id/baseline` in `backend/src/modules/requirement-room/requirement-room.controller.ts` (integration test: T337x) — `SC-RQR-006` traceability in both directions

**Checkpoint**: US1 demonstrable — intent reaches an immutable baseline, and cannot be edited back

---

## Phase 4: User Story 2 - The AI asks what it cannot infer, and never disguises a guess (Priority: P1)

**Goal**: `BR-0022`, `RULE-03`

**Independent test**: [quickstart.md](./quickstart.md) Scenario 3

- [X] T338m [P] [US2] Write failing unit tests for the analysis adapter in `backend/tests/unit/requirement-room-analysis.spec.ts` — invokes `EPIC-028`'s `AgentGateway` with capability **`analyze`**, records the `AgentExecutionRecord` id, and **degrades rather than refusing** when the gateway is absent (`R-033-2`)
- [X] T338n [US2] Implement `backend/src/modules/requirement-room/analysis.service.ts` (unit test: T338m) — no new AI seam, no provider dependency
- [X] T338o [P] [US2] Write failing unit tests for epistemic labelling of every output element in `backend/tests/unit/requirement-room-labelling.spec.ts` — exactly one label per element; an unlabelled element is a **type error** and the runtime assertion is a backstop (`FR-RQR-011`, `SC-RQR-002`)
- [X] T338p [US2] Implement labelled analysis output in `backend/src/modules/requirement-room/analysis.service.ts` (unit test: T338o)
- [X] T338q [P] [US2] Write failing unit tests for batched clarification in `backend/tests/unit/requirement-room-clarification.spec.ts` — questions presented as **one set**, answerable in place, and **retained after resolution** (`FR-RQR-012`, `FR-RQR-013`)
- [X] T338r [US2] Implement `backend/src/modules/requirement-room/clarification.service.ts` (unit test: T338q)
- [X] T338s [P] [US2] Write failing unit tests for conflict, duplicate and gap detection in `backend/tests/unit/requirement-room-conflicts.spec.ts` — intent contradicting an existing baseline surfaces as a **conflict for decision, never resolved by recency** (`FR-RQR-014`, `FR-RQR-015`)
- [X] T338t [US2] Implement conflict detection and `GET /rooms/requirement/:id/analysis` in `backend/src/modules/requirement-room/analysis.service.ts` and the controller (unit test: T338s; integration test: T337x)

**Checkpoint**: US2 demonstrable — no guess renders as a fact

---

## Phase 5: User Story 3 - Nothing is baselined without measurable acceptance criteria (Priority: P1)

**Goal**: `BR-0024` — where `BG-01`'s *"fewer requirement-origin defects"* actually comes from

**Independent test**: [quickstart.md](./quickstart.md) Scenario 4

- [X] T339a [P] [US3] Write failing unit tests for the criteria precondition in `backend/tests/unit/requirement-room-criteria.spec.ts` — baseline is refused where a requirement intended for implementation lacks measurable acceptance criteria, naming the requirement (`FR-RQR-030`, `FR-RQR-031`, `SC-RQR-003`)
- [X] T339b [US3] Implement the criteria precondition in `backend/src/modules/requirement-room/baseline.service.ts` (unit test: T339a)
- [X] T339c [P] [US3] Write failing unit tests for baseline exceptions in `backend/tests/unit/requirement-room-exception.spec.ts` — an exception carries authorizer and reason, both required (`FR-RQR-032`)
- [X] T339d [US3] Implement `BaselineException` handling in `backend/src/modules/requirement-room/baseline.service.ts` (unit test: T339c)
- [X] T339e [P] [US3] Write failing unit tests for exception enumeration in `backend/tests/unit/requirement-room-exception-list.spec.ts` — enumerable **without opening each requirement**; an exception that becomes invisible is a rule waived once and forgotten (`FR-RQR-033`)
- [X] T339f [US3] Implement exception enumeration in `backend/src/modules/requirement-room/baseline.service.ts` (unit test: T339e)
- [X] T339g [P] [US3] Write failing unit tests for the readiness projection in `backend/tests/unit/requirement-room-readiness.spec.ts` — open clarifications, missing criteria, unmet evidence and pending decision, all **derived** (`FR-RQR-073`, `UX-0032`)
- [X] T339h [US3] Implement `backend/src/modules/requirement-room/readiness.projection.ts` and `GET /rooms/requirement/:id/readiness` (unit test: T339g; integration test: T337x)

**Checkpoint**: US3 demonstrable — the criteria gate holds, and its exceptions stay visible

---

## Phase 6: User Story 4 - Material decisions come with options, trade-offs and risks (Priority: P2)

**Goal**: `BR-0023`, `BR-0025`

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 5 and 6

- [X] T339m [P] [US4] Write failing unit tests for option generation in `backend/tests/unit/requirement-room-options.spec.ts` — **two or more**, each with trade-offs, dependencies, risks and reasoning, each marked a recommendation, **none pre-selected** (`FR-RQR-020`, `FR-RQR-021`, `FR-RQR-022`, `SC-RQR-005`)
- [X] T339n [US4] Implement `backend/src/modules/requirement-room/options.service.ts` (unit test: T339m)
- [X] T339o [P] [US4] Write failing unit tests for decision recording in `backend/tests/unit/requirement-room-decision.spec.ts` — chosen option, rationale and **declined options** all retained (`FR-RQR-023`, `FR-RQR-040`)
- [X] T339p [US4] Implement decision recording in `backend/src/modules/requirement-room/decision.service.ts` (unit test: T339o) — uses `EPIC-031`'s published `BR-0005` authority record, **not a Room-local one** (`FR-RQR-042`)
- [X] T339q [P] [US4] Write the failing integration test for AI-decision refusal in `backend/tests/integration/requirement-room-no-ai-decision.spec.ts` — refused by the **database check constraint**, not only a service branch (`FR-RQR-041`, `SC-RQR-004`)
- [X] T339r [US4] Implement `POST /rooms/requirement/:id/options` and `POST /rooms/requirement/:id/decide` in the controller (integration test: T337x) — `403` carrying the `EPIC-031` decision id so the Room can render the refusing policy (`FR-RQR-043`, `UX-0033`)
- [X] T339s [US4] Implement Decision Inbox surfacing in `backend/src/modules/requirement-room/decision.service.ts` (unit test: T339o) — `FR-RQR-044`, decisions appear in `EPIC-031`'s queue rather than only inside this Room

**Checkpoint**: US4 demonstrable — decisions are human, recorded, and visible outside the Room

---

## Phase 7: User Story 5 - A baselined set is a selectable input to specification (Priority: P2)

**Goal**: `BR-0027` — without it the Room produces an artifact nothing consumes

**Independent test**: [quickstart.md](./quickstart.md) Scenario 7

- [X] T403a [P] [US5] Write failing unit tests for handoff selection in `backend/tests/unit/requirement-room-handoff.spec.ts` — approved baselines are selectable inputs to one or more specification workflows (`FR-RQR-060`)
- [X] T403b [US5] Implement `backend/src/modules/requirement-room/handoff.service.ts` (unit test: T403a)
- [X] T403c [P] [US5] Write failing unit tests for version recording in `backend/tests/unit/requirement-room-handoff-version.spec.ts` — the specification records the baseline **version**, not the baseline generally (`FR-RQR-061`)
- [X] T403d [US5] Implement version recording in `backend/src/modules/requirement-room/handoff.service.ts` (unit test: T403c)
- [X] T403e [P] [US5] Write the failing architecture test for engine-agnosticism in `backend/tests/architecture/handoff-engine-agnostic.spec.ts` — nothing in the handoff names Spec Kit or any specification engine (`FR-RQR-062`)
- [X] T403f [US5] Implement `POST /baselines/:version/handoff` in the controller (integration test: T337x)

**Checkpoint**: US5 demonstrable — the chain from intent to specification is closed

---

## Phase 8: User Story 6 - The Room looks and reads like the other two (Priority: P3)

**Goal**: `UX-0030`, `UX-0035` — **and this is where the pattern the other two Rooms inherit is proved**

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 9 and 11

- [ ] T403m [P] [US6] Write failing component tests for the Room page in `frontend/tests/unit/pages/RequirementRoom.spec.tsx` — all six regions present, composed through `RoomShell`, with loading, empty, populated and error states (`FR-RQR-070`, `UX-0051`) *Path corrected 2026-08-23 (`T338k`): the task named a `*.test.tsx` path under `frontend/src/`, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test written there would never be collected, and a test that never runs is worse than no test because it reads as coverage. The same defect `G-26-14` caught on `T337m`/`T337o` when they were ticked; these were not yet ticked, so `G-26-14` could not see them and `T148` did. The SOURCE path is unchanged.*
- [ ] T403n [US6] Implement `frontend/src/pages/RequirementRoom.tsx` (unit test: T403m) — a **new page beside** `Requirements.tsx`, not a replacement
- [ ] T403o [P] [US6] Write the failing region-vocabulary comparison test in `frontend/tests/unit/rooms/vocabulary.spec.tsx` — rendered region names are identical to `packages/room-contract`'s, verified by comparison rather than review (`FR-RQR-071`, `SC-RQR-007`) *Path corrected 2026-08-23 (`T338k`): the task named a `*.test.tsx` path under `frontend/src/`, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test written there would never be collected, and a test that never runs is worse than no test because it reads as coverage. The same defect `G-26-14` caught on `T337m`/`T337o` when they were ticked; these were not yet ticked, so `G-26-14` could not see them and `T148` did. The SOURCE path is unchanged.*
- [ ] T403p [US6] Implement loop-progress rendering from `EPIC-030`'s shared projection in `frontend/src/rooms/regions/LoopProgress.tsx` (unit test: T403o) — `FR-RQR-074`, **no Room-local translation**
- [ ] T403q [P] [US6] Write failing component tests for blocker visibility in `frontend/tests/unit/rooms/regions/Blockers.spec.tsx` — what is blocking appears without opening another screen (`FR-RQR-073`, `UX-0032`) *Path corrected 2026-08-23 (`T338k`): the task named a `*.test.tsx` path under `frontend/src/`, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test written there would never be collected, and a test that never runs is worse than no test because it reads as coverage. The same defect `G-26-14` caught on `T337m`/`T337o` when they were ticked; these were not yet ticked, so `G-26-14` could not see them and `T148` did. The SOURCE path is unchanged.*
- [ ] T403r [US6] Implement the blockers region in `frontend/src/rooms/regions/Blockers.tsx` (unit test: T403q)
- [ ] T403s [P] [US6] Write failing accessibility tests in `frontend/tests/unit/pages/RequirementRoom.a11y.spec.tsx` — keyboard-only operation with visible focus throughout the intent-to-baseline journey (`SC-RQR-008`, `BR-0193`) *Path corrected 2026-08-23 (`T338k`): the task named a `*.test.tsx` path under `frontend/src/`, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test written there would never be collected, and a test that never runs is worse than no test because it reads as coverage. The same defect `G-26-14` caught on `T337m`/`T337o` when they were ticked; these were not yet ticked, so `G-26-14` could not see them and `T148` did. The SOURCE path is unchanged.*
- [ ] T403t [US6] Implement keyboard operation and focus management in `frontend/src/pages/RequirementRoom.tsx` (unit test: T403s)
- [ ] T403u [P] [US6] Write the failing test for external-stakeholder refusal in `frontend/tests/unit/pages/RequirementRoom.access.spec.tsx` — the Room **states** that external review is unavailable rather than rendering and failing on click (`FR-RQR-004`, `UX-0002`) *Path corrected 2026-08-23 (`T338k`): the task named a `*.test.tsx` path under `frontend/src/`, but the `frontend` vitest project collects `tests/unit/**/*.spec.{ts,tsx}` and nothing else — a test written there would never be collected, and a test that never runs is worse than no test because it reads as coverage. The same defect `G-26-14` caught on `T337m`/`T337o` when they were ticked; these were not yet ticked, so `G-26-14` could not see them and `T148` did. The SOURCE path is unchanged.*
- [ ] T403v [US6] Implement the workflow-type isolation integration test in `backend/tests/integration/requirement-room-type-isolation.spec.ts` (integration test: T337x) — a Requirement Room object cannot transition under another Room's stages or authorities (`FR-RQR-001`, `SC-RQR-009`, via `EPIC-030` `T944a`)
- [ ] T403w [US6] Implement the external-stakeholder unavailable state in `frontend/src/pages/RequirementRoom.tsx` (unit test: T403u) — `FR-RQR-004`, `UX-0002`: the Room **states** that external review is not available rather than rendering a control that fails on click. *Added while verifying: `T403u` wrote the test and no task made it pass — the shape `EPIC-032`'s analysis found twice*

**Checkpoint**: all six user stories demonstrable, and the shared pattern is proved once for three Epics

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T405a **Mutation proof — `FR-RQR-051`**: add an in-place edit path for a baselined requirement to `backend/src/modules/requirement-room/baseline.service.ts`, revert (integration test: T338g — it must fail while the mutation stands). Record the observation (`SC-RQR-001`). `RULE-02` is the rule `EPIC-034`'s existence depends on
- [ ] T405b **Mutation proof — `FR-RQR-011`**: make `epistemic` optional in `packages/room-contract/src/epistemic.ts`, revert (unit test: T337h — it must fail while the mutation stands). Record the observation (`SC-RQR-002`)
- [ ] T405c **Mutation proof — `FR-RQR-041`**: drop the human-decider check constraint, revert (integration test: T339q — it must fail while the mutation stands). Record the observation (`SC-RQR-004`)
- [ ] T405d **Mutation proof — `FR-RQR-070`**: remove a region from `RoomShellProps`, and separately add a seventh, reverting each (unit test: T337f — it must fail both times). Record both observations. **This proves the pattern two Epics inherit**
- [ ] T405e **Mutation proof — Constitution XI Tier 1**: remove `RequirementRoomModule` from `backend/src/app.module.ts`, revert (integration test: T337x — it must fail while the mutation stands). Record the observation
- [ ] T405f [P] Verify the `R-033-7` targets — Room load p95 < 1.2 s at 200 requirements, baseline creation p95 < 2 s at 200, blocker query p95 < 200 ms — and record the measured figures. The AI round is bounded by `EPIC-028`'s `WallClockOutcome` and is **not** given a second budget here
- [ ] T405g [P] Record the 500-requirement set-size limit and the observed degradation above it, so it is a stated limit rather than a surprise (`R-033-7`)
- [ ] T405h [P] Confirm no second requirement store exists anywhere in this Epic's output (`FR-RQR-002`, `D-33`) — the boundary most likely to be crossed, because a local cache of requirement text would feel convenient daily
- [ ] T405i [P] Confirm `Execute` and `Verify` render as **omitted** in the loop-progress projection, not absent (`FR-GEL-008`, `R-033-6`)
- [ ] T405j Run and record each [quickstart.md](./quickstart.md) scenario individually: **Scenario 1** (intent to baseline), **Scenario 2** (no in-place edit), **Scenario 3** (epistemic labels), **Scenario 4** (acceptance criteria), **Scenario 5** (real options), **Scenario 6** (no AI decision), **Scenario 7** (handoff), **Scenario 8** (blockers visible), **Scenario 9** (regions cannot diverge), **Scenario 10** (own workflow type), **Scenario 11** (stakeholder told not failed), **Scenario 12** (XI Tier 1), **Scenario 13** (XI Tier 2 keyboard journey). *Each written in full 2026-08-22 to close analysis finding `A1` — the abbreviated form was legible to a reader and invisible to extraction, which is the third way this fix has failed*

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX, XI)

Ordered as the constitution's *"Quality gates in order"* states them.

- [ ] T405m Confirm every implementation task has a passing unit test or conformance check
- [ ] T405n **Constitution XI Tier 1 (ALWAYS)** — `T337x` drives the Room through its **real HTTP routes** against the composed module graph via the real `AppModule`, and `T405e` proved it fails when the module is unregistered
- [ ] T405o **Constitution XI Tier 2 (Epics delivering a journey)** — **APPLIES.** The intent-to-baseline journey is exercised against a **running application** and a **run-generated** transcript is committed. It MUST be a **keyboard** transcript, because `SC-RQR-008` requires the journey be completable by keyboard alone. Hand-written evidence is a constitution violation of the first order
- [ ] T405p [P] Write the transcript conformance check in `backend/tests/architecture/requirement-room-transcript.spec.ts` — asserts the transcript exists, names the run, records keyboard-only operation, and was **generated** rather than authored
- [ ] T405q Confirm the shared artifacts are genuinely shared — `packages/room-contract` and the frontend's `src/rooms` directory carry no Requirement Room vocabulary, so `EPIC-034` and `EPIC-035` import rather than fork them *Cited as `src/rooms` rather than as a longer frontend source path on 2026-08-23 (`T338k`), and deliberately — do not “restore” the longer form. This task produces no code, but `T148` infers “writes application source” from a backticked source path under the frontend, so the citation made this Epic fail a Constitution V check on a task that has nothing to pair a test with. Identical to the `.tsx` correction recorded on `T405y` below, and the same false-positive class `DOR-08`'s own comments describe (`DEF-026-001`).*
- [ ] T405y **Hand the shared Room pattern to `EPIC-034` and `EPIC-035` by name.** Record in the closing report that both MUST import `packages/room-contract` (`RoomShellProps`, `Epistemic`, `RoomObjectRef`) and the `RoomShell` component under the frontend's `src/rooms` directory, and MUST NOT re-derive the pattern. *The component is named without its `.tsx` extension deliberately — do not “restore” it. This task writes a closing-report statement and produces no code, but `DOR-08` infers “produces application code” from a code path with a code extension, so the extension made this Epic `Not ready` on a task that has nothing to test. The false-positive class `DOR-08`'s own comments describe (`DEF-026-001`), corrected 2026-08-23.* Confirm each Epic's spec names those artifacts before its `/speckit-plan` runs. *Added 2026-08-22 to close analysis finding `C1`: `T405q` proves the artifacts are shareable; nothing told the other two Rooms to share them, and a planner finding `UX-0035` with no artifact re-derives the pattern — exactly what Phase 2 exists to prevent*
- [ ] T405r Restate in the closing report that `BR-0004` external stakeholder access remains **`U-02`'s** — this Room's delivery does not close it (`FR-RQR-004`)
- [ ] T405s Restate that `BR-0106` session cost limits remain **`U-11`'s** — this Room consumes `EPIC-028`'s wall-clock outcome and builds no budget mechanism
- [ ] T405t **Hand the PMI-DOC-006 exposure to the project owner** — `FR-RQR-070`–`FR-RQR-075` rest on a `PROPOSED` document, and `R-033-3` raised the cost of the pattern later changing. If approval has not landed, say so plainly rather than closing over it
- [ ] T405u Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T405v Triage `specs/033-requirement-room/defects/`; every record closed or deferred to a named Epic
- [ ] T405w **Hand the task-identifier exhaustion to `EPIC-026`** — 986 of 999 three-digit prefixes are in use; 13 remained before this Epic and 8 remain after. `EPIC-034` and `EPIC-035` have four bases each, which is *just* enough only because this Epic compressed into five. The fix is widening `T\d{3}[a-z]?` to four digits in `task-ids.spec.ts`, `dor.ts` and `task-paths.spec.ts`. **`EPIC-032` raised this as a warning; it now decides how the next two Epics are written**
- [ ] T405x Re-run the full suite green, promote `local → dev` (no environment skipped), and publish the Epic closing report: work completed, work deferred, the five mutation observations, the measured performance figures, and the recommended next command (Constitution IX). Refresh the Delivery Board or restate its staleness

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T337a` first — it discharges the failing gate
- **Foundational (Phase 2)**: blocks every user story. **Its shared half also blocks `EPIC-034` and `EPIC-035`**
- **US1 (Phase 3)**: Phase 2 only. **MVP**
- **US2 (Phase 4)**: Phase 2, plus US1's intake (`T338b`)
- **US3 (Phase 5)**: Phase 2, plus US1's baseline service (`T338f`)
- **US4 (Phase 6)**: Phase 2, plus US2's analysis service (`T338n`)
- **US5 (Phase 7)**: US1's baseline service
- **US6 (Phase 8)**: Phase 2's `RoomShell`, plus every region's data source
- **Polish, Closure**: last

### Cross-Epic dependencies

Consumes `EPIC-007` (register), `EPIC-028` (agent gateway), `EPIC-029` (design system), `EPIC-030`
(loop), `EPIC-031` (decision), `EPIC-032` (evidence). Four ports **refuse when unfilled**;
`AgentGateway` **degrades** (`R-033-2`). **Produces** `packages/room-contract` and `RoomShell` for
`EPIC-034` and `EPIC-035`, which is a dependency running the other way and the reason Phase 2 is
scheduled first.

### Parallel Example: Phase 2

```text
T337f, T337h, T337j, T337m, T337o, T337q  — six test files, no shared state
T337s, T337w, T337x                        — architecture, constraints, reachability
```

---

## Implementation Strategy

**MVP is User Story 1** — unstructured intent reaching an immutable baseline that cannot be edited
back. It is `BR-0026`, and every other Room and the specification chain depend on it existing.

**Phase 2 is scheduled first for a reason beyond this Epic.** `packages/room-contract` and
`RoomShell` are imported by `EPIC-034` and `EPIC-035`. Until they exist, neither Room can be built;
once they exist, both are built against a pattern the type system enforces.

**Five mutation proofs (`T405a`–`T405e`)**, and `T405d` is the one that matters most beyond this
Epic: it proves the six-region shell rejects both omission and addition. Two later Epics rely on
that being true rather than intended.

---

## Notes

- **Task identifiers no longer sort into execution order**, and cannot — the free prefixes are
  scattered. The map at the top of this file is authoritative for phase order.
- **`T405w` is now a blocker hand-off, not a warning.** `EPIC-032` raised the identifier exhaustion;
  one Epic later it determines how the next two are written. Eight bases remain for two Rooms.
- **`T405q`, `T405r`, `T405s` and `T405t` are handovers, not work.** They exist so closure cannot be
  claimed while a record disagrees, an unowned capability is quietly assumed, or an unapproved
  document is treated as approved.
- **Constitution V over the skill default**: `/speckit-tasks` calls tests optional; the constitution
  overrides every template, skill and tool default.
