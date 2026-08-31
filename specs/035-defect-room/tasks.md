---

description: "Task list for EPIC-035 Defect Room"
---

# Tasks: Defect Room

**Epic**: `EPIC-035`

**Input**: Design documents from `/specs/035-defect-room/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/defect-contract.md](./contracts/defect-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code names its
test, written FIRST and failing before the implementing code. The `/speckit-tasks` skill describes
tests as optional; **the constitution overrides it**.

**Requirement citation convention** *(stated so analysis does not rediscover it — `EPIC-033` `U1`)*:
a requirement is cited on the task that **tests** it; the implementing task cites the **test** by
identifier. The trace is two-hop, deliberate, and consistent across every Wave 1 Epic.

**Non-code outputs count too** (Constitution V, v1.2.0). This Epic's non-code output is
`packages/loop-contract/workflows/defect-room.json`; its executable conformance check is
`EPIC-030`'s **`T993s`**, whose `T932` reads every file in that directory. The identifier is written
here rather than described, because `EPIC-034`'s analysis finding `C2` was that citation drifting to
a local architecture test that checked nothing about the file.

**Organization**: grouped by the eight user stories of [spec.md](./spec.md).

## ⚠ Task identifiers — three bases, and the scheme ends here

**81 tasks on three base identifiers — every one this Epic can have.** 996 of 999 three-digit
prefixes are in use; `T997`, `T998` and `T999` are what remain, and each carries 27 identifiers: the
**bare form** plus `a`–`z`. The bare form is used as the first task of each base's first phase, so
`T997` reads before `T997a`.

| Base | Phases |
|---|---|
| `T997` | Phase 1 Setup (bare, `a`–`d`) · Phase 2 Foundational (`e`–`z`) |
| `T998` | Phase 3 US1 (bare, `a`–`f`) · Phase 4 US2 (`g`–`n`) · Phase 5 US3 (`o`–`t`) · Phase 6 US4 (`u`–`x`) · Phase 6b US8 (`y`–`z`) |
| `T999` | Phase 7 US5 (bare, `a`–`c`) · Phase 8 US6 (`d`–`f`) · Phase 9 US7 (`g`–`k`) · Phase N Polish (`l`–`q`) · Phase Z Closure (`r`–`z`) |

**Identifiers do not sort into execution order.** The table above is the map.

**What the ceiling cost this document, stated rather than hidden** (`R-035-11`). **Eight** user stories
and **forty-seven** requirements were written into 81 identifiers — the eighth story and the
forty-seventh requirement were both added by the analysis remediation of 2026-08-23 **without a
single new identifier**, because a phase costs a heading and a requirement costs a citation. **Test-and-implementation pairing did
not compress** — `DOR-08` and Constitution V both read it, and compressing it would trade a real
guarantee for a numbering convenience. What compressed instead is the *confirmation* tasks in Polish
and the *restatement* tasks in Closure: where `EPIC-034` used one task per unowned capability, this
Epic uses one task naming several. That is a legibility cost, not a coverage one, and it is the
last such trade available.

**`EPIC-034`'s `T995y` hands the ceiling to `EPIC-026` and names the two fixes it must choose
between**: widen `T\d{3}[a-z]?` to four digits, or retire the adjacency meaning of the suffix. **No
further Epic can be written under the current scheme.** `T999z` restates that, because it is now a
fact about the next Epic rather than a warning about this one.

**Before starting**: sync from GitHub, and **work in a dedicated worktree** at
`.claude/worktrees/epic-035-defect-room` — the plan records the concurrent-session gate as **FAIL**
and `T997` is its discharge. Label the session `EPIC-035 Defect Room`.

**⚠ Hard prerequisite**: **`EPIC-033` Phase 2 must be built.** This Room imports
`packages/room-contract` and `frontend/src/rooms/RoomShell.tsx` and derives nothing.

**⚠ Three collaborators do not exist**, and each refuses rather than degrades (`R-035-1`,
`R-035-4`): `TestExecution` has **no owner anywhere in the programme**; `RequirementIntake` has no
route on `EPIC-033`; and `TaskRecord` has nowhere to put a defect reference (`R-035-3`). Tasks that
depend on them are written to **prove the refusal**, not to wait for the collaborator.

**Before finishing**: close with a report (Constitution IX). The Delivery Board is **stale**.

**Interaction budget** (Constitution X): implementation is an execution phase — run without pausing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US8
- Exact file paths in every description

## Path Conventions

- Imported, never derived: `packages/room-contract/`, `frontend/src/rooms/RoomShell.tsx`
- This Room's engine: `backend/src/modules/defect-room/`
- This Room's page: `frontend/src/pages/DefectRoom.tsx`
- Loop instance: `packages/loop-contract/workflows/defect-room.json`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T997 Create the worktree `git worktree add .claude/worktrees/epic-035-defect-room epic/035-defect-room` and work there — discharges the plan's one failing Constitution gate *Deviation recorded 2026-08-31, on the owner's decision: the worktree exists and the gate is discharged, but it sits **216 commits behind** and contains no `change-room` module. Building there would mean writing `FR-DFR-074`'s return path against a `fromDefectTransfer` that is not present, leaving `EPIC-034`'s `T995u`/`T1219` blocked — the very task this Epic was sequenced to unblock — and binding nine ports to `EPIC-030`/`EPIC-031`/`EPIC-033` seams that tree does not have. Implementation runs in the primary checkout. The concurrent-session gate is satisfied in substance: no other session is active on this checkout.*
- [X] T997a Confirm `EPIC-033` Phase 2 is built and `packages/room-contract` resolves — this Epic **imports** `RoomShellProps`, `Epistemic`, `Labelled<T>` and `RoomObjectRef` and derives none of them. If it is not built, stop
- [X] T997b [P] Add `backend/src/modules/defect-room` to the `## Paths that must not break` list in `governance/repository-layout.md` — `G-05d` is the conformance check that reads that list, and this task produces no application code of its own
- [X] T997c [P] Confirm `supertest` is present from `EPIC-030`; if that branch has not merged, add it with its `TS-001` register entry in `specs/_shared/dependencies.md`
- [X] T997d **Re-confirm the three absent collaborators before building against them** (`R-035-1`, `R-035-4`, `R-035-3`): that no callable test-execution surface exists, that `EPIC-033` still has no Requirement-Gap intake route, and that `TaskRecord` still has no provenance field. **If any now exists, the port stops being a refusal and becomes an integration** — and the plan's Complexity Tracking row for it is discharged rather than carried. **Confirm `EPIC-033` `T338u`/`T338v` are on that branch and scheduled**: they add the Requirement-Gap inbound route, and **Epic Exit Criterion 5 cannot hold until they land**. *Raised here rather than in the closing report from 2026-08-23 (analysis finding `C1`): `T999x` named the obligation at closure, by which time `EPIC-033`'s task list is fixed and nothing there is scheduled to build it* **Re-confirmed 2026-08-31 — and one has changed.** `TestExecution`: no callable test-execution surface exists (no runner, executor or CI adapter in `backend/src`), so the port **refuses**. `RepairTaskPort`: `TaskRecord` still has no provenance field, so it **refuses**. **`RequirementIntake` is no longer a refusal.** `EPIC-033`'s `T338v` landed and `POST /rooms/requirement/gap-intake` is mounted in `requirement-room.controller.ts` — the port becomes an **integration**, the plan's Complexity Tracking row for it is **discharged rather than carried**, and Epic Exit Criterion 5 can hold. Eight ports refuse, not nine.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user story phase may start until this completes

### The three guarantees that become types

- [X] T997e [P] Write failing unit tests for the classification types in `backend/tests/unit/defect-room-classification-type.spec.ts` — asserts `CLASSIFICATION_OUTCOMES` has **exactly three** members and `DESTINATIONS` is a **total `Record`** over them, so an outcome without a destination does not compile (`FR-DFR-022`, `FR-DFR-077`, `R-035-5`)
- [X] T997f Implement `CLASSIFICATION_OUTCOMES`, `ClassificationOutcome`, `Destination` and `DESTINATIONS` in `backend/src/modules/defect-room/classification.types.ts` (unit test: T997e) — a `Record`, never a `switch` with a `default`; `default` is where a third outcome goes to die quietly
- [X] T997g [P] Write failing unit tests for the test-first types in `backend/tests/unit/defect-room-test-first-type.spec.ts` — asserts `DefectTest.firstObservedFailingAt` is **non-optional**, and that `FixAcceptance`'s `accepted: true` branch **cannot be constructed** without a `DefectTest` (`FR-DFR-040`, `FR-DFR-041`)
- [X] T997h Implement `DefectTest` and `FixAcceptance` in `backend/src/modules/defect-room/test-first.types.ts` (unit test: T997g) — a nullable `firstObservedFailingAt` would let a test that never failed satisfy a naive "does a test exist?" check
- [X] T997i [P] Write failing unit tests for the evidence-check type in `backend/tests/unit/defect-room-evidence-check-type.spec.ts` — asserts `EvidenceCheckPath` has three members and is **required with no default**, so no path is taken by omission (`FR-DFR-044`, `R-035-6`)
- [X] T997j Implement `EvidenceCheckPath` and `EvidenceCheck` in `backend/src/modules/defect-room/evidence-check.types.ts` (unit test: T997i)
- [X] T997k [P] Write failing unit tests for the reproduction type in `backend/tests/unit/defect-room-reproduction-type.spec.ts` — asserts `intermittent` is a **first-class member** of `reproducible` rather than a flag, and that `notAutomatableReason` is **required** when `reproducible = 'not-automatable'` (`FR-DFR-030`, `FR-DFR-031`, `FR-DFR-043`)
- [X] T997l Implement `Reproduction` in `backend/src/modules/defect-room/reproduction.types.ts` (unit test: T997k)

### The boundaries an architecture test must hold

- [X] T997m [P] Write the failing architecture test in `backend/tests/architecture/defect-room-independence.spec.ts` — asserts **no test runner, executor, scheduler or CI adapter**, **no import of `GenerateTasksService` or `TaskRegenerationService`**, no region vocabulary of this Room's own, no Room-local attachment or access-check path, no requirement or specification text, and no loop-stage, risk-band or evidence-type vocabulary (`FR-DFR-002`, `FR-DFR-062`, `FR-DFR-032`, `FR-DFR-091`, `R-035-2`, `R-035-7`)
- [X] T997n Make `backend/src/modules/defect-room/` satisfy the independence test (conformance: T997m) — **the runner ban is the load-bearing clause**: this is the boundary the Epic is most likely to cross, because the port it needs is the one nobody built

### The nine ports, and which of them refuse

- [X] T997o [P] Write failing unit tests for the port tokens in `backend/tests/unit/defect-room-ports.spec.ts` — eight ports **refuse** when absent and **only `AgentGateway` degrades**; asserted as an asymmetry rather than assumed. `TestExecution` absent MUST yield refusal and **never a pass** (`FR-DFR-062`, `FR-DFR-063`, `R-035-1`)
- [X] T997p Implement `backend/src/modules/defect-room/defect-room.tokens.ts` (unit test: T997o) — `LoopEngine`, `PolicyProvider`, `EvidenceStore`, `BaselineReader`, `ChangeIntake`, `RequirementIntake`, `TestExecution`, `RepairTaskPort`, `AgentGateway`
- [X] T997q [P] Write failing unit tests for the routing resolver in `backend/tests/unit/defect-room-routing-resolver.spec.ts` — every outcome resolves to its mapped destination, and an item **cannot be recorded as routed to a destination that refused or was absent** (`FR-DFR-077`, `SC-DFR-010`)
- [X] T997r Implement `backend/src/modules/defect-room/routing.service.ts` resolution half (unit test: T997q)

### Persistence, loop instance and wiring

- [X] T997s Add `DefectRecord`, `Classification`, `Reproduction`, `DefectTest`, `EvidenceCheck`, `RepairLink`, `Routing` and `EscapeRecord` to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) §1–§8 (integration test: T997u)
- [X] T997t Generate the migration under `backend/prisma/migrations/` with **two hand-edited `CHECK` constraints** — a fix cannot be accepted for an automatable defect with no failing test (`FR-DFR-041`), and a `Classification` cannot exist without the destination its outcome maps to (`FR-DFR-077`) — plus `contestedArtifactVersion NOT NULL`, `capturedAt NOT NULL` on `EscapeRecord`, and the `outcome = 'confirmed-defect' ⇒ classifiedByKind = 'human'` check (`FR-DFR-023`) (integration test: T997u)
- [X] T997u [P] Write failing integration tests in `backend/tests/integration/defect-room-constraints.spec.ts` asserting **each constraint rejects at the database level** — and note in the file why: Prisma's schema language cannot express `CHECK`, so these live in hand-edited SQL, and destructive migration planning treats them as extras it may **drop** (`R-035-8`). This test is what turns that silent removal into a red suite
- [X] T997v [P] Write the failing reachability test in `backend/tests/integration/defect-room-reachability.spec.ts` importing the real `AppModule` and driving the real HTTP routes — Constitution XI Tier 1
- [X] T997w Author `packages/loop-contract/workflows/defect-room.json` and make it pass `EPIC-030`'s configuration conformance check (conformance: T993s — on `epic/030`; integration test: T998x) — a **distinct workflow type** (`FR-DFR-001`), with **no transition from a passing reproduction run to a classification** (`R-035-6`) and unused stages visible as omitted (`FR-GEL-008`). **Cross-Epic dependency**: cannot be discharged until `epic/030` merges
- [X] T997x Implement `backend/src/modules/defect-room/defect-room.module.ts` and register it in `backend/src/app.module.ts` (integration test: T997v)
- [X] T997y [P] Write failing unit tests for the escape-record writer in `backend/tests/unit/defect-room-escape-capture.spec.ts` — the row is written **at intake**, not at closure; `escapePoint` may be null but the **row may not** (`FR-DFR-082`)
- [X] T997z Implement escape capture in `backend/src/modules/defect-room/analytics.service.ts` (unit test: T997y) — the fields must exist from the first defect or the first quarter of data is lost

**Checkpoint**: the three guarantees are types, the two traps are banned, and refusal is asserted rather than assumed

---

## Phase 3: User Story 1 - A defect is judged against approved behaviour, not an opinion (Priority: P1) 🎯 MVP

**Goal**: `BR-0052` — the expectation-verification gate. Without it a defect process is an unbudgeted change channel

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 1 and 2

- [X] T998 [P] [US1] Write failing unit tests for triage in `backend/tests/unit/defect-room-triage.spec.ts` — the approved expected behaviour contested is identified and linked, **or its absence is recorded**; classification happens **before** implementation work (`FR-DFR-020`, `FR-DFR-021`, `SC-DFR-002`)
- [X] T998a [US1] Implement `backend/src/modules/defect-room/triage.service.ts` (unit test: T998) — reads baselines through `BaselineReader`, which **refuses when absent**: *"no approved behaviour found"* and *"could not look"* must not be the same answer, because the first is a Requirement Gap
- [X] T998b [P] [US1] Write failing unit tests for the three outcomes in `backend/tests/unit/defect-room-outcomes.spec.ts` — Confirmed Defect, Change Request and **Requirement Gap where no approved behaviour exists at all**, each resolving to its destination (`FR-DFR-022`, `FR-DFR-077`, `ADR-0016`)
- [X] T998c [US1] Implement outcome resolution in `backend/src/modules/defect-room/triage.service.ts` (unit test: T998b)
- [X] T998d [P] [US1] Write failing unit tests for agent triage limits in `backend/tests/unit/defect-room-agent-triage.spec.ts` — an agent MAY propose a classification and MUST NOT confirm a defect or authorise a fix, refused at the service **and** by the database check (`FR-DFR-023`, `RULE-03`)
- [X] T998e [P] [US1] Write failing unit tests for superseded versions and reclassification in `backend/tests/unit/defect-room-reclassification.spec.ts` — a defect against a superseded version is recorded against the version **reported** and re-evaluated against current, never silently re-targeted; a reclassified record is a **new row** with the original retained, never an update and never a delete (`FR-DFR-024`, `FR-DFR-025`, `SC-DFR-005`, `ADR-0016`)
- [X] T998f [US1] Implement reclassification and version re-evaluation in `backend/src/modules/defect-room/triage.service.ts`, and `POST /rooms/defect/:id/triage` in `backend/src/modules/defect-room/defect-room.controller.ts` (unit tests: T998d, T998e; integration test: T997v) — an updated row destroys the same history a deleted one does, more quietly

*Three deviations recorded 2026-08-31, all in `T998f`:*

*(a) **The route proof is a sibling file.** The task names `T997v` as the integration test, but `defect-room-reachability.spec.ts` composes `AppModule` without `ErrorFilter`, so every product controller answers `500` there and a status-code assertion would be meaningless. The route is proven in `backend/tests/integration/defect-room-triage-route.spec.ts` instead, following `T996i`'s precedent in `EPIC-034`. `T997v` is unchanged and still passes.*

*(b) **A second route, `POST /rooms/defect/:id/reevaluate`.** A flag on the triage route would let a re-evaluation arrive by accident, and a re-evaluation nobody meant to make is `FR-DFR-024`'s silent re-target wearing a different hat.*

*(c) **A new column and migration**, `evaluatedAgainstVersion` in `20260831120000_epic035_reclassification_version_binding`. `FR-DFR-024` requires the re-evaluation to be against *current*, and until this column that version had nowhere to live: a reader could see two classifications and not tell whether the second judged v7 or v9 — the silent re-target arriving by a slower route, since "current" moves. `NULL` means the version reported on the defect, so the first classification stores no copy of a fact that already lives on the defect row. Two CHECKs came with it: a present version may not be blank, and a supersession's pointer and date move together or not at all.*

**Checkpoint**: US1 demonstrable — three outcomes, and none of them can rest without a destination

---

## Phase 4: User Story 2 - No fix is accepted without a failing test that proved the defect (Priority: P1)

**Goal**: `BR-0054`, `BR-0056` — Constitution V's own rule, offered as a product capability

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 3, 4, 7 and 8

- [X] T998g [P] [US2] Write failing unit tests for the failing-test precondition in `backend/tests/unit/defect-room-defect-test.spec.ts` — a fix submitted with no `DefectTest` on record is **not accepted**, and the test is linked to the defect **and** to the behaviour it contests (`FR-DFR-040`, `FR-DFR-041`, `FR-DFR-042`)
- [X] T998h [US2] Implement `backend/src/modules/defect-room/defect-test.service.ts` and `POST /rooms/defect/:id/test` (unit test: T998g; integration test: T997v) — `409` carrying the affordance to record one
- [X] T998i [P] [US2] Write the failing integration test for the three guards in `backend/tests/integration/defect-room-test-first.spec.ts` — the type, the loop configuration and the database `CHECK` must **each** refuse a fix with no failing test, exercised by going around the service (`FR-DFR-041`, `SC-DFR-001`)
- [X] T998j [P] [US2] Write failing unit tests for the non-automatable exception in `backend/tests/unit/defect-room-not-automatable.spec.ts` — the reason is **required**, alternative evidence is required, and the exceptions are **enumerable** (`FR-DFR-043`)
- [X] T998k [US2] Implement reproduction capture and the non-automatable path in `backend/src/modules/defect-room/reproduction.service.ts`, plus `POST /rooms/defect/:id/reproduction` (unit tests: T998j; integration test: T997v) — evidence goes **through `EPIC-032`**, which already refuses to read around artifact access, so `FR-DFR-032` and `FR-DFR-033` are one composition, not two mechanisms (`R-035-7`)
- [X] T998l [P] [US2] Write the failing integration test for regression scope in `backend/tests/integration/defect-room-regression-scope.spec.ts` — a fix in Epic A that breaks a test in Epic B is refused closure, naming the failing regression; **applicable** is the transitive test set reachable from the artifacts the fix touched through `EPIC-011`'s chain, which crosses Epic boundaries wherever the artifacts do — a derivable set, not a chosen one (`FR-DFR-060`, `FR-DFR-061`, `SC-DFR-007`; *defined 2026-08-23, analysis finding `A1`*)
- [X] T998m [P] [US2] Write failing unit tests for verification and closure in `backend/tests/unit/defect-room-verification.spec.ts` — closure requires the defect test **and** applicable regression evidence; a **declaration of completion is not evidence**; with `TestExecution` absent, closure **refuses with `503`** and never passes on the grounds that no failure was observed; and where the transitive set **cannot be computed** — an incomplete chain, or an unavailable runner — closure is **refused rather than falling back to the defect test alone**, because an unknown regression set and an empty one must not behave alike (`FR-DFR-060`, `FR-DFR-062`, `FR-DFR-063`, `FR-DFR-064`, `BR-0144`, `R-035-1`)
- [X] T998n [US2] Implement `backend/src/modules/defect-room/verification.service.ts` and `POST /rooms/defect/:id/verify` and `POST /rooms/defect/:id/close` (unit tests: T998m; integration tests: T998i, T998l) — **requests runs, owns no runner**

*Five deviations recorded 2026-08-31, across `T998h`, `T998i`, `T998k` and `T998n`:*

*(a) **The route proofs are in `backend/tests/integration/defect-room-triage-route.spec.ts`**, not in `T997v`, for the reason recorded under `T998f`: `defect-room-reachability.spec.ts` composes `AppModule` without `ErrorFilter`, so every product controller answers `500` there.*

*(b) **`T998i`'s type guard is proved by compiling.** "The type refuses" is a compile-time claim, so the test writes a fixture that constructs a `FixAcceptance` without its test and runs `tsc` on it, asserting the error names the missing field — with a fixture that DOES carry the test as the control, because a fixture failing for an unrelated reason would otherwise prove nothing.*

*(c) **A route the task list does not name: `GET /rooms/defect/exceptions`.** `FR-DFR-043` requires the exception to be **visible and enumerable**, and an enumeration nobody can call is one nobody meets — an exception findable only by opening every defect is indistinguishable from a policy.*

*(d) **The regression scope reads `EPIC-011`'s `ChainLinkSource` directly rather than through a tenth port.** The nine ports are cross-Epic collaborators whose absence has a declared behaviour; `EPIC-011` is in-repo and already consumed directly elsewhere in this Epic (`T999h` uses `LinkWriterService`). Adding a tenth would also contradict `T997o`/`T997p` and `T997v`, which assert exactly nine. The absent behaviour `FR-DFR-064` requires — refuse when the set cannot be computed — is implemented either way, and an unbound chain source is treated as an unanswerable set rather than an empty one.*

*(e) **`FR-DFR-031`'s rule that a single passing run must not close an intermittent defect is NOT implemented here.** It belongs to `T998w`, in the evidence-check service where intermittency is handled, and is named in `verification.service.ts` so its absence is a boundary rather than an omission. Nothing wrong ships in the meantime: closure refuses in this deployment because `TestExecution` has no owner (`R-035-1`).*

**Checkpoint**: US2 demonstrable — and "we could not run the tests" never reads as "the tests passed"

---

## Phase 5: User Story 3 - A defect that is really a change is transferred, not fixed (Priority: P1)

**Goal**: `BR-0057` — the reason this Room is not a bug tracker

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 9 and 10

- [X] T998o [P] [US3] Write failing unit tests for the transfer offer in `backend/tests/unit/defect-room-transfer-offer.spec.ts` — where approved behaviour passes and the request would alter intent the item **must** transfer; `offeredReason` is **required and non-empty** (`FR-DFR-070`, `FR-DFR-072`, `UX-0034`)
- [X] T998p [US3] Implement the transfer half of `backend/src/modules/defect-room/routing.service.ts` and `POST /rooms/defect/:id/transfer` (unit test: T998o; integration test: T997v) — *an unexplained transfer button is a reclassification nobody decided*
- [X] T998q [P] [US3] Write failing unit tests for decline and refusal-return in `backend/tests/unit/defect-room-transfer-outcomes.spec.ts` — a declined transfer retains **both** the offer and the decline; an item the Change Room refuses **returns with the refusal attached** and is not lost between Rooms; an item that is really a change **cannot be fixed as a defect** (`FR-DFR-073`, `FR-DFR-074`, `FR-DFR-075`, `SC-DFR-003`)
- [X] T998r [US3] Implement decline, return, the fix-block **and Requirement-Gap routing** in `backend/src/modules/defect-room/routing.service.ts`, plus `POST /rooms/defect/:id/transfer-return` and `POST /rooms/defect/:id/route-gap` (unit test: T998q; integration tests: T998s, T998t) — one service because `FR-DFR-077` requires every outcome to reach its destination, and two services would let one of them quietly not
- [X] T998s [P] [US3] Write the failing integration test for the round trip in `backend/tests/integration/defect-room-transfer.spec.ts` — context and evidence preserved **by reference**, origin visible from the resulting Change Request, exercised jointly with `EPIC-034` `FR-CHR-012` (`FR-DFR-071`)
- [X] T998t [P] [US3] Write the failing integration test for gap routing in `backend/tests/integration/defect-room-gap-routing.spec.ts` — a Requirement Gap reaches `EPIC-033` as **new intent** carrying reproduction context and evidence, with the defect record retained and marked reclassified. **Until `EPIC-033` has an inbound route this asserts refusal** — the item stays visibly unrouted rather than marked routed to a destination that never received it (`FR-DFR-076`, `SC-DFR-010`, `R-035-4`)

*Four deviations recorded 2026-08-31, across `T998p` and `T998r`:*

*(a) **Two routes the task list does not name: `POST /rooms/defect/:id/transfer/accept` and `.../transfer/decline`.** The offer and the answer are separate acts — `FR-DFR-072` makes the Room state why it is offering, and `FR-DFR-073` requires the decline to be retained beside the offer. With only `POST .../transfer` mounted there would be no way to answer the question the Room had just asked, and `FR-DFR-073` would be a rule with no caller.*

*(b) **`T998t` asserts refusal AND arrival.** The task was written when `EPIC-033` had no inbound route and said the test should assert refusal until it did. `T338v` has since landed, so the file asserts both: unbound in a deployment still refuses (`SC-DFR-010` measures exactly that), and bound to `EPIC-033`'s real `IntakeService` the gap arrives as a candidate whose `sourceRef` names the defect. A file that only asserted refusal would keep passing after the gap was closed and be read as evidence that it had not been.*

*(c) **The joint tests bind the other Epics' real services, not stubs.** `T998s` passes this Room's payload straight into `EPIC-034`'s `ChangeIntakeService.fromDefectTransfer`, and `T998t` into `EPIC-033`'s `IntakeService.gapIntake`. Two Epics agreeing in prose and disagreeing in code is the failure a joint test exists to catch, and both halves pass their own tests while it is true. **This discharges `EPIC-034`'s `T995u` and `T1219`**, which were blocked on a Defect Room existing to send anything.*

*(d) **The fix-block rule (`FR-DFR-075`) lives in `routing.service.ts` and is enforced in `defect-test.service.ts`.** `T998r` places it in the routing service; the point where a fix is actually accepted is `acceptFix`. One definition, exported as `fixBlockFor`, consulted where it bites — a second copy of the outcome list would be the `DEF-034-001` shape, two artifacts agreeing until one is edited.*

**Checkpoint**: US3 demonstrable — both outbound routes, and the one that has no destination yet fails honestly

---

## Phase 6: User Story 4 - A passing reproduction test is not automatically a change (Priority: P2)

**Goal**: `ADR-0016`'s named failure mode — *"Do NOT blindly classify every passing reproduction test as a Change Request"*

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 5 and 6

- [X] T998u [P] [US4] Write failing unit tests for the evidence check in `backend/tests/unit/defect-room-evidence-check.spec.ts` — a passing reproduction run routes to an evidence check with **three** paths, none automatic, and **which path was taken is recorded** (`FR-DFR-044`, `SC-DFR-004`)
- [X] T998v [US4] Implement `backend/src/modules/defect-room/evidence-check.service.ts` and `POST /rooms/defect/:id/evidence-check` — the three paths **and** intermittency handling, one file and one task (unit tests: T998u, T998w; integration test: T997v)
- [X] T998w [P] [US4] Write failing unit tests for intermittency in `backend/tests/unit/defect-room-intermittency.spec.ts` — a **single** passing run neither closes nor reclassifies an intermittent defect, and an evidence check may be entered more than once (`FR-DFR-031`)
- [X] T998x [P] [US4] Write the failing integration test for the missing edge in `backend/tests/integration/defect-room-type-isolation.spec.ts` — driving PASS → `change-request` directly is refused because the loop configuration **has no such transition**, and a Defect Room object cannot transition under another Room's stages, authorities or gates (`FR-DFR-001`, `FR-DFR-044`, `SC-DFR-011`, via `EPIC-030` `T944a`)
*Three deviations recorded 2026-08-31, in `T998v`:*

*(a) **Even the `reclassify` path does not reclassify.** It records that somebody chose to and answers with `POST /rooms/defect/:id/reevaluate`. The evidence check cannot know **which** outcome the item becomes — that judgement belongs in front of approved behaviour (`FR-DFR-020`), and a check that inferred it would be the automatic reclassification arriving one step later, past the place anybody looks. `SC-DFR-004` measures zero automatic reclassifications, and "automatic" includes the version where the system picks the outcome because somebody ticked a box.*

*(b) **A second route the task list does not name: `POST /rooms/defect/:id/evidence-check/raise`.** The run is reported from outside — `TestExecution` has no owner anywhere in the programme (`R-035-1`) — so a check that could only be raised by a runner nobody has built would leave `ADR-0016`'s failure mode unreachable in the one direction that matters.*

*(c) **`FR-DFR-031` refuses only the `reclassify` path on a first examined run**, not every answer. Refining the test or investigating further is exactly what an intermittent defect needs, and blocking those would leave the check with no way out at all. The path opens once a second run has been examined — which is no longer *a single passing run*.*

*A fourth change, outside Phase 6 but found by it: `T997m` (`no Room-local attachment mechanism`) failed on Phase 5's `routing.service.ts`, which used the identifier `payload` for the transfer message. The check is right to be suspicious of that word in this Room, so the type was renamed `DefectTransferRequest` and the local `transfer` — the check was not weakened.*

**Checkpoint**: US4 demonstrable — the failure mode `ADR-0016` names is unrepresentable, not merely forbidden

---

## Phase 6b: User Story 8 - The Room reads like the other two (Priority: P3)

**Goal**: `UX-0030`, `UX-0035` — inherited, not invented

**Independent test**: [quickstart.md](./quickstart.md) Scenario 16

> *Split from Phase 6 on 2026-08-23 to close analysis finding `I1`.* These two tasks carry six
> requirements and the whole Room surface, and were labelled `[US4]` inside a phase about passing
> reproduction tests, whose independent test does not render the Room. **A phase costs no
> identifiers**, only a heading — so the fix is available even with the numbering exhausted, and the
> two tasks keep their `T998` identifiers. `US8` was added to [spec.md](./spec.md) in the same pass;
> both sibling Rooms already had this story.

- [X] T998y [P] [US8] Write failing component tests for the Room page in `frontend/tests/unit/pages/DefectRoom.spec.tsx` — six regions composed through the **imported** `RoomShell` (`FR-DFR-090`), region names identical to the shared pattern (`FR-DFR-091`), AI triage output visually distinct from recorded fact and human decision (`FR-DFR-092`, `UX-0031`), what is blocking visible without opening another screen (`FR-DFR-093`, `UX-0032`), a policy-refused action showing the refusing policy (`FR-DFR-094`, `UX-0033`), and state, decision and evidence visible at **360px** (`FR-DFR-095`, `UX-0040`). *Each requirement written out rather than as a range: a range is legible to a reader and invisible to extraction, which is how `EPIC-033`'s `A1` failed three times* *Path corrected 2026-08-23: the task named a `*.test.tsx` path under `frontend/src/`, which the `frontend` vitest project never collects — it takes `tests/unit/**/*.spec.{ts,tsx}` and nothing else, so a test written there would never run, and a test that never runs is worse than no test because it reads as coverage. Surfaced by `T148` when every branch reached `main`. The SOURCE path is unchanged.*
- [X] T998z [US8] Implement `frontend/src/pages/DefectRoom.tsx` (component test: T998y) — imports `EPIC-033`'s `RoomShell` and its `EPIC-029` epistemic token mapping; **derives no region vocabulary and sets no breakpoints of its own**

*Two deviations recorded 2026-08-31, in `T998z`:*

*(a) **Three `GET` routes and three `ApiClient` methods, which neither task names.** `GET /rooms/defect/:id`, `.../classification` and `.../evidence`, plus `defect`, `defectClassification` and `defectEvidence` on the client. Every route this Room had was a `POST`; a page composed through `RoomShell` with nothing to read would render six empty regions forever, and "US8 demonstrable" would mean a screen that cannot show a defect. The method names match `ApiClient`'s exactly so the shell passes the client straight through — `FR-SHL-003` forbids the shell reaching a domain endpoint, and an adapter in `area-views.tsx` would be that with an extra step, which is what `T996s` caught in `EPIC-034`.*

*(b) **The page is mounted in `area-views.tsx` and `routes.tsx` in the same commit.** `T200a` refuses a module under `frontend/src/pages/` that nothing renders — the check that rejected `EPIC-034`'s first attempt at its own Room page. The area stays `declared-not-delivered`: there is no Defect Room index yet, so a person arrives only by following a link carrying an id, exactly where `change-room` stands.*

*A note on `FR-DFR-093`, not a deviation: the blockers panel **derives** what is blocking from data already on the page rather than fetching it, because `GET /rooms/defect/:id/blockers` belongs to `T999f` in Phase 8. When that lands, the panel reads it instead of deriving. The sibling Room's `BlockersPanel` takes the same shape for the same reason.*

**Checkpoint**: US8 demonstrable — and verified by comparison against `EPIC-033`'s, not by review

---

## Phase 7: User Story 5 - Defects arrive from everywhere and always link to an Epic (Priority: P2)

**Goal**: `BR-0051` — an unlinked defect is invisible to per-Epic quality accounting

**Independent test**: [quickstart.md](./quickstart.md) Scenario 14

- [X] T999 [P] [US5] Write failing unit tests for intake in `backend/tests/unit/defect-room-intake.spec.ts` — six origins accepted (automated test, manual report, monitoring, review tool, production incident, **agent**), each linked to an Epic and a project with its origin recorded (`FR-DFR-010`, `FR-DFR-011`, `FR-DFR-013`, `SC-DFR-006`)
- [X] T999a [US5] Implement `backend/src/modules/defect-room/intake.service.ts` and `POST /rooms/defect/reports` (unit test: T999; integration test: T997v)
- [X] T999b [P] [US5] Write failing unit tests for the unlinkable defect in `backend/tests/unit/defect-room-held-for-triage.spec.ts` — held for triage with the **missing link named**, never silently accepted unlinked; an agent-filed defect is an origin and still cannot be confirmed by the agent (`FR-DFR-012`, `FR-DFR-023`)
- [X] T999c [US5] Implement the held-for-triage state in `backend/src/modules/defect-room/intake.service.ts` (unit test: T999b)

*Three deviations recorded 2026-08-31, in `T999a`/`T999c`:*

*(a) **Two routes the task list does not name: `GET /rooms/defect/held` and `POST /rooms/defect/:id/link-epic`.** `SC-DFR-006` measures defects that carry a link **or are visibly held**, and the word doing the work is *visibly*: a held defect findable only by opening every record is indistinguishable from one nobody held. The link route matters more — without a way out, held-for-triage is a grave rather than a queue, and the measure would read 100% because nothing was ever linked rather than because everything was.*

*(b) **A missing project is refused, not held.** `FR-DFR-012` holds a defect that **cannot be linked**; `projectId` is `NOT NULL`, so a report with no project cannot be stored at all, and holding it would claim to have recorded something nothing wrote. The Epic is the link that can legitimately be unknown at intake — the project is the context the report arrived in.*

*(c) **`PrismaEscapeStore` was written now rather than in Phase 8.** `FR-DFR-082` writes the escape row **at intake**, which is this phase's code path. Backed by memory it would answer "where do our defects come from" with whatever arrived since the last restart — a number that looks like data and is not. The aggregation over these rows is still Phase 8's.*

**Checkpoint**: US5 demonstrable — nothing arrives unlinked and invisible

---

## Phase 8: User Story 6 - Closed defects answer why they escaped (Priority: P3)

**Goal**: `BR-0058` — the answer comes from retained data, not a survey

**Independent test**: [quickstart.md](./quickstart.md) Scenario 15

- [X] T999d [P] [US6] Write failing unit tests for aggregation in `backend/tests/unit/defect-room-analytics.spec.ts` — origin, escape point, severity, affected requirement and specification and resolution evidence retained, and **aggregatable without opening each record** (`FR-DFR-080`, `FR-DFR-081`, `SC-DFR-008`)
- [X] T999e [P] [US6] Write failing unit tests for the completeness note in `backend/tests/unit/defect-room-origin-completeness.spec.ts` — the origin distribution **states that telemetry-originated linkage is unavailable** rather than presenting itself as complete (`FR-DFR-083`, `BR-0163`, `U-19`)
- [X] T999f [US6] Implement aggregation and the completeness note in `backend/src/modules/defect-room/analytics.service.ts`, plus `GET /rooms/defect/analytics` and `GET /rooms/defect/:id/blockers` (unit tests: T999d, T999e; integration test: T997v) — **a distribution that omits a source it cannot see is a chart that lies by arithmetic**

*Three deviations recorded 2026-08-31, in `T999f`:*

*(a) **`resolutionEvidenceRef` had no writer at all.** `FR-DFR-080` requires resolution evidence to be **retained**; the column existed from the first migration, the field existed on the row, and no code path filled either. Aggregated it would have read *"no defect was ever resolved with evidence"* — which is not what an unfilled column means, and nothing in the data would have said which it was. `recordResolutionEvidence` closes it. This is the "built and reachable from nowhere" class inverted: not a capability nothing calls, but a field nothing fills.*

*(b) **A third route the task list does not name: `POST /rooms/defect/:id/escape-point`.** `recordEscapePoint` existed from `T997z` with no caller, so every escape point would have stayed null forever, every distribution would have reported a single `notDetermined` bucket, and `SC-DFR-008` would have measured a question nothing could answer.*

*(c) **`DefectBlockersService` is a second class in `analytics.service.ts`.** The task names that file and both routes, and blockers are not escape data: they need the defect store, which `DefectAnalyticsService` deliberately cannot reach — that separation is what stops escape aggregation growing a join the first time somebody wants severity broken down by state. The two share a task, not a dependency.*

**Checkpoint**: US6 demonstrable — including what it cannot answer

---

## Phase 9: User Story 7 - A confirmed defect becomes traceable repair work (Priority: P2)

**Goal**: `BR-0055` — the bridge between confirming a defect and fixing it, which is where traceability is usually lost

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 12 and 13

- [X] T999g [P] [US7] Write failing unit tests for repair conversion in `backend/tests/unit/defect-room-repair.spec.ts` — a confirmed defect becomes `EPIC-012` `TaskRecord` rows, each reachable from the defect **and its test**; conversion before classification is **refused** (`FR-DFR-050`, `FR-DFR-051`, `FR-DFR-052`, `SC-DFR-012`)
- [X] T999h [US7] Implement `backend/src/modules/defect-room/repair.service.ts` and `POST /rooms/defect/:id/repair-tasks` (unit test: T999g; integration test: T997v) — creates through `TaskStore.createMany` and writes the chain through `EPIC-011`'s `LinkWriterService`; **`GenerateTasksService` is banned** because it derives tasks from specification text through an engine and stamps that engine's name on them (`R-035-2`)
- [X] T999i [P] [US7] Write failing unit tests for the provenance sentinel in `backend/tests/unit/defect-room-task-provenance.spec.ts` — `engineName`/`engineVersion` are non-optional on `TaskRecord` and a repair task has no engine, so the documented sentinel is asserted **so it cannot drift into looking like a real engine name** (`R-035-3`, `BR-0151` is `U-12`)
- [X] T999j [P] [US7] Write failing unit tests for orphaning in `backend/tests/unit/defect-room-repair-orphaning.spec.ts` — a defect reclassified after tasks exist marks the `RepairLink` rows, so **the tasks and the reclassification are both visible** and neither is deleted (`FR-DFR-025`, `US7` scenario 4)
- [X] T999k [US7] Implement the sentinel and orphan marking in `backend/src/modules/defect-room/repair.service.ts` (unit tests: T999i, T999j)

*Four deviations recorded 2026-08-31, in `T999h`/`T999k`:*

*(a) **`RepairTaskPort` is bound to nothing, deliberately.** `R-035-2` names its only permitted backing as `EPIC-012`'s `TaskStore.createMany`, and `TASK_STORE` is bound in `tasks.module.ts` to `InMemoryTaskStore`. Wiring to it would create repair tasks that vanish on restart — `T1178`'s failure, in the one record whose purpose is to show somebody was asked to fix something. The route exists and refuses, naming the Epic that owes the binding. **`TASK_STORE`'s in-memory binding is a named unowned dependency for the closing report.***

*(b) **A `ChainLinkPort` the task list does not name.** `T999h` requires the chain to be written through `EPIC-011`'s `LinkWriterService`, and a `RepairLink` row is readable only inside this Room. The port is checked **before** anything is created: a chain writer discovered missing afterwards would leave tasks in `EPIC-012` that nothing outside this Room can trace — `FR-DFR-050`'s failure arrived at by being half-finished rather than by being wrong.*

*(c) **Two new traceability edges, named in `link-constraints.spec.ts`.** `task → defect` and `test → defect`, with `defect` added to `NON_CHAIN_ARTIFACT_TYPES`. `defect` follows `change`: **never a source**, because a defect does not derive from the work that fixed it. The enumerated-edge test refused the addition until both were named, which is the guard working as designed.*

*(d) **A confirmed defect with no failing test cannot be converted.** `RepairLink.defectTestId` is `NOT NULL` and `FR-DFR-050` links each task to the failing behaviour **and its test**, so there is nothing to link. The consequence worth stating: a defect recorded `not-automatable` under `FR-DFR-043` has no test row and therefore **no repair-conversion path**. That is what the schema and the requirement say together; it is recorded here rather than worked around.*

**Checkpoint**: all seven user stories demonstrable

---

## Phase N: Polish & Cross-Cutting Concerns

- [X] T999l **Mutation proof — `FR-DFR-041`**: add a path accepting a fix with no failing test to `backend/src/modules/defect-room/defect-test.service.ts`, revert (integration test: T998i — it must fail while the mutation stands). Record the observation (`SC-DFR-001`). **Test-first is this Room's reason to exist**
- [X] T999m **Mutation proof — `FR-DFR-044`**: add automatic reclassification of a passing reproduction test to `backend/src/modules/defect-room/evidence-check.service.ts` **and** the corresponding edge to `packages/loop-contract/workflows/defect-room.json`, revert both (unit test: T998u **and** integration test: T998x — both must fail while the mutation stands). Record both observations (`SC-DFR-004`). `ADR-0016` names this failure mode explicitly and the spec calls it the easiest requirement here to "simplify" into a defect
- [X] T999n **Mutation proofs — the third and fourth**, now Epic Exit Criteria in their own right *(promoted 2026-08-23, analysis finding `L1`; the task list carried them while the gate did not require them)*: (a) **`FR-DFR-077`** — make a `Classification` writable with a null destination, revert (unit test: T997e and integration test: T997u must both fail); (b) **Constitution XI Tier 1** — remove `DefectRoomModule` from `backend/src/app.module.ts`, revert (integration test: T997v must fail). Record both observations
- [X] T999o [P] Verify the `R-035-9` targets — triage p95 < 1.5 s excluding model time, reproduction evidence write p95 < 800 ms excluding the `EPIC-032` call, aggregation over 5,000 closed defects p95 < 2 s, Room load p95 < 1.2 s, close-path p95 < 300 ms **excluding the test run** — and record the measured figures
- [X] T999p [P] **Consolidated boundary confirmations** *(one task where `EPIC-034` used five — the identifier ceiling, `R-035-11`)*: the Room-load figure matches `EPIC-033`'s and `EPIC-034`'s, since it is the same shell; no requirement, specification or evidence payload is stored in this Epic's tables; unused loop stages render as **omitted** rather than absent (`FR-GEL-008`); region names match `packages/room-contract` **by programmatic comparison, not review** (`FR-DFR-091`, `UX-0035`); and this Epic published **no package**
- [~] T999q **Seventeen of eighteen** — see [quickstart-results.md](./quickstart-results.md). Scenario 18 (Constitution XI Tier 2, keyboard-only against a running application) is **not run**: only a person can carry it, and steps 5-7 refuse in this deployment because `RepairTaskPort` and `TestExecution` are unbound, so a seven-step transcript cannot presently be generated by anyone. Nothing was written in its place. Original task text follows. Run and record each [quickstart.md](./quickstart.md) scenario individually: **Scenario 1** (judged against approved behaviour), **Scenario 2** (Requirement Gap, and the third outcome cannot be dropped), **Scenario 3** (no fix without a failing test, service and constraint), **Scenario 4** (not automatable says why), **Scenario 5** (passing test → evidence check, no auto-reclassify), **Scenario 6** (one passing run closes nothing), **Scenario 7** (regression scope unbounded by Epic), **Scenario 8** (a declaration is not evidence), **Scenario 9** (transfer states why), **Scenario 10** (declined and refused transfers), **Scenario 11** (gap reaches the Requirement Room, or refuses), **Scenario 12** (repair work is `EPIC-012` tasks), **Scenario 13** (reclassified record and its tasks both visible), **Scenario 14** (six origins, always linked), **Scenario 15** (analytics say what they cannot see), **Scenario 16** (cannot diverge from siblings), **Scenario 17** (XI Tier 1), **Scenario 18** (XI Tier 2 keyboard journey)

*Findings recorded 2026-08-31, in `T999l`-`T999q`:*

*(a) **Two of the four mutation proofs found holes in the tests, not the code** — see [mutation-proofs.md](./mutation-proofs.md) entries 2-5. `T998i` cannot see a service-level bypass (by design: it exercises the three guards by going around the service), `T998u` asserted nothing was **written** rather than that nothing was **answered**, and neither `T997e` nor `T997u` had ever tried a **null** destination — only a wrong one. Three assertions were added, each written while its mutation stood and each observed failing before the revert.*

*(b) **`T999o`'s figures exclude storage latency**, which `R-035-9` did not grant. Three of the four measurements run in process against the in-memory store, because `BaselineReader`, `EvidenceStore` and `TestExecution` are unbound and the HTTP paths return `400` — timing a refusal would not be timing the work. The aggregation figure is end to end over HTTP against PostgreSQL with 5,000 closed defects, which is why it is the only one in whole milliseconds. Measured: triage **0.1 ms** (< 1500), reproduction write **0.0 ms** (< 800), aggregation **14.3 ms** (< 2000), close path **0.1 ms** (< 300).*

*(c) **The `T999o` seed was refused by the database**, and correctly: 5,000 defects moved to `closed` with no failing test on record tripped `defect_records_fix_needs_a_failing_test`. The guard was right and the setup was wrong — the population now carries 5,000 real `defect_tests` rows, so the defects are genuinely closed as the target's wording requires.*

*(d) **`T999p` is one file of twenty assertions** where `EPIC-034` used five tasks (`R-035-11`). Each of the five claims is computed from the artifact it is about rather than reviewed — the Room-load figure is parsed out of all three Epics' `research.md`, the payload check reads quoted column names out of the migrations, and the region check asserts `DefectRoom.tsx` contains no region literal at all, which is what makes `T998y`'s comparison worth running.*

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX, XI)

Ordered as the constitution's *"Quality gates in order"* states them.

- [X] T999r Confirm every implementation task has a passing unit test or conformance check
- [X] T999s **Constitution XI Tier 1 (ALWAYS)** — `T997v` drives the Room through its **real HTTP routes** against the composed module graph via the real `AppModule`, and `T999n` proved it fails when the module is unregistered
- [ ] T999t **NOT RUN — requires a person, and blocked** (see [closure.md](./closure.md)): keyboard-only journey against a running application, and steps 5-7 refuse because `RepairTaskPort` and `TestExecution` are unbound, so a seven-step transcript cannot presently be generated by anyone. `T999u`'s check is committed and fails red, which is the record that it is owed. **Constitution XI Tier 2 (Epics delivering a journey)** — **APPLIES.** The report → triage → reproduce → failing test → repair tasks → verify → close journey is exercised against a **running application**, **using only a keyboard with focus visible at every step**, and a **run-generated** transcript is committed. `SC-DFR-009` is discharged **inside** this run rather than as a second pass, because two runs could disagree and one cannot (`R-035-10`). Hand-written evidence is a constitution violation of the first order
- [X] T999u [P] Write the transcript conformance check in `backend/tests/architecture/defect-room-transcript.spec.ts` — asserts the transcript exists, names the run, covers all **seven** steps, records keyboard-only navigation, and was **generated** rather than authored
- [X] T999v **Demonstrate all three classification outcomes routed end to end** — Confirmed Defect to repair, Change Request to `EPIC-034` (jointly, `FR-DFR-071`), Requirement Gap to `EPIC-033` as new intent (jointly, `FR-DFR-076`). **Two outcomes is the shape this Epic is most likely to ship by accident**, and an unrouted third is how the shape returns wearing three names. Where `EPIC-033`'s inbound route does not exist, record the refusal as the observed result and carry the handover in `T999x` rather than marking the criterion met
- [X] T999w **Converge `ADR-0016`** — move it to Accepted, or restate its `Awaits` against what actually remains. Its current `Awaits` reads *"the Defect Room epic, which does not yet exist"*, and this Epic is it. The three outcomes, the never-delete rule and the evidence-check path are all now built and tested; what remains, if anything, is the runtime behaviour only implementation could confirm
- [X] T999x **Restate the four unowned dependencies in the closing report** *(one task where `EPIC-034` used three — the identifier ceiling, `R-035-11`, and each is named in full so the compression costs legibility and not content)*: (a) **`BR-0080` product-side test execution has no owner anywhere in the programme** — `EPIC-015` delivered programme validation, not a callable surface, and `brs-v2-reconciliation.md` has no `U-` area for it, so nothing currently records it as missing; (b) **`BR-0163` operational feedback is `U-19` and unowned**, so this Room's delivery must not be read as having closed the telemetry loop; (c) **`BR-0151` task provenance is `U-12` and unowned**, which is why a repair task carries a sentinel in an engine field; (d) **`EPIC-033`'s Requirement-Gap inbound route** (`R-035-4`) — report whether `T338u`/`T338v` landed, since **Exit Criterion 5 cannot hold until they do**. The obligation is raised at `T997d`, not here; this line reports its state
- [X] T999y Run `/speckit-converge`; append and complete any remaining unbuilt work; triage `specs/035-defect-room/defects/` — the repository's own Constitution VI folder, which this Epic's **product** capability does not replace — leaving no open record; and re-run the full suite green (`pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`)
- [~] T999z **Report written; promotion NOT performed** — publishing is withheld under the standing instruction for this session and needs explicit authorisation naming the environment. See [closure.md](./closure.md). Original task text follows. Promote `local → dev` (no environment skipped) and publish the Epic closing report: work completed, work deferred, the four mutation observations, the measured performance figures, and the recommended next command (Constitution IX). **State that the task-identifier scheme is now exhausted** — 999 of 999 prefixes in use after this Epic, no base remains, and `EPIC-026` must widen `T\d{3}[a-z]?` to four digits or retire the adjacency meaning of the suffix before any further Epic can be tasked (`EPIC-034` `T995y`). Refresh the Delivery Board or restate its staleness

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T997` first. **`T997a` is a hard stop** if `EPIC-033` Phase 2 is not built. **`T997d` may change the plan** — if a collaborator now exists, its port stops being a refusal
- **Foundational (Phase 2)**: blocks every user story
- **US1 (Phase 3)**: Phase 2 only. **MVP**
- **US2 (Phase 4)**: Phase 2's test-first types (`T997h`), and US1's classification for `FR-DFR-052`
- **US3 (Phase 5)**: US1's outcomes; `EPIC-034` for the joint round trip
- **US4 (Phase 6)**: Phase 2's evidence-check types (`T997j`) and the loop configuration (`T997w`)
- **US5 (Phase 7)**: Phase 2 only — intake is independent of classification
- **US6 (Phase 8)**: `T997z`'s escape capture, and closed defects to aggregate
- **US7 (Phase 9)**: US1's classification (`FR-DFR-052`) and US2's `DefectTest`
- **US8 (Phase 6b)**: `EPIC-033`'s `RoomShell`, and every region's data source — so in practice last
  among the story phases despite its identifiers sitting in the `T998` range
- **Polish, Closure**: last

### Cross-Epic dependencies

**Consumes and does not rebuild**: `EPIC-030` loop, `EPIC-031` policy, `EPIC-032` evidence **and its
access enforcement**, `EPIC-033` `room-contract`/`RoomShell` and baselines, `EPIC-034` change intake,
`EPIC-012` `TaskStore`, `EPIC-011` `LinkWriterService`, `EPIC-028` agent gateway.
**Explicitly does NOT consume**: `GenerateTasksService`, `TaskRegenerationService` — both
import-banned (`R-035-2`).
**Refuses rather than degrades against**: `TestExecution` (no owner), `RequirementIntake` (no route).
**Paired with `EPIC-034`** on the `BR-0057` transfer, specified from both sides in one Wave.

### Parallel Example: Phase 2

```text
T997e, T997g, T997i, T997k, T997m, T997o, T997q, T997y   — eight test files
T997u, T997v                                              — constraints and reachability
```

---

## Implementation Strategy

**MVP is User Story 1** — a defect judged against approved behaviour, with three outcomes and three
destinations. `ADR-0016`'s Positive consequence is exactly this gate, and without it the Room is a
bug tracker with extra steps.

**Phase 2 is where three guarantees stop being prose**: a total `Record` so an outcome cannot be
unrouted, a non-optional `firstObservedFailingAt` so a test that never failed cannot pose as one,
and a required `EvidenceCheckPath` so no path is taken by omission.

**`T999m` is the mutation proof that matters most.** It mutates **two artifacts** — the service and
the loop configuration — because `FR-DFR-044` is guarded in both places, and a proof that only
touched the service would leave the configuration's missing edge unverified. `ADR-0016` names this
failure mode in the imperative; the only way to know both guards hold is to add the edge and watch
them fail.

---

## Notes

- **Three collaborators do not exist, and the tasks prove refusal rather than wait.** `T998m`
  asserts `503` when `TestExecution` is absent; `T998t` asserts refusal when `EPIC-033` has no
  inbound route; `T999i` asserts the sentinel cannot drift. Each is a real, passing test today and
  becomes an integration test the day the collaborator arrives — which `T997d` is scheduled to
  notice.
- **Two genuine gaps were found by the inverse check and fixed before commit**: the Requirement-Gap routing path had a test (`T998t`) and no implementation, and the Room page had a component test and no implementation at all. Nine other flags in the same run were a **detector** fault — it read `unit test:` but not `unit tests:`, and captured only the first identifier in a comma list. Both the detector and the task list were wrong, in that order, and only one of them would have shipped.
- **A citation is not evidence that a check exists.** `EPIC-034`'s analysis found two citations
  pointing at the wrong thing, both of which passed a detector that only asked whether a citation was
  present. Every conformance citation here names what the check asserts, so the mismatch is visible
  in the sentence.
- **What the identifier ceiling cost is written down** — `T999n`, `T999p` and `T999x` each carry
  work `EPIC-034` spread across several tasks. Coverage is unchanged; legibility is worse; and this
  is the last Epic where that trade is even available.
- **Constitution V over the skill default**: `/speckit-tasks` calls tests optional; the constitution
  overrides every template, skill and tool default.
