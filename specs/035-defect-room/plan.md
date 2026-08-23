# Implementation Plan: Defect Room

**Branch**: `epic/035-defect-room` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-035` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.6 (`BR-0051`–`BR-0058`), §6.15 (`BR-0080`, `BR-0144`); [`adr/ADR-0016-tdd-defect-execution-policy.md`](../../adr/ADR-0016-tdd-defect-execution-policy.md); `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §6.1–§6.2 (`UX-0030`–`UX-0035`)

**Input**: Feature specification from `/specs/035-defect-room/spec.md`

## Summary

Build the Defect Room: test-first defect remediation per Epic, with governed routes to the Change
Room and the Requirement Room. **A BUILD, not an enhancement** — `EPIC-027` Finding A found zero
occurrences of an existing one across all 27 other Epic specifications.

The technical approach, from Phase 0, is mostly about **what is not there**. Three of this Epic's
named collaborators do not exist as callable surfaces, and each was found by reading rather than
reasoning:

- **`BR-0080` has no callable owner** (`R-035-1`). `EPIC-015` owns it and delivered programme
  validation — its own specification says it owns *"None directly"* and *"no user-facing behaviour
  originates here."* So `FR-DFR-062`'s *"request test execution from `EPIC-015`"* names an Epic, not
  a surface. This Room defines the port, builds nothing behind it, and **refuses** when it is
  absent, because *"we could not run the tests"* must never resolve to *"the tests passed."*
- **`GenerateTasksService` is this Wave's second trap** (`R-035-2`). It is named for `FR-DFR-050` and
  derives tasks from **specification text** through an engine, stamping that engine's name on every
  row. Import-banned alongside `TaskRegenerationService`, which `EPIC-034` banned for its own
  reasons.
- **The Requirement Gap destination has not been told it is one** (`R-035-4`). `EPIC-034` receives
  transfers explicitly; `EPIC-033` has no inbound route for a routed gap and never mentions
  `EPIC-035` as a source. `FR-DFR-076` was added by a clarification *after* `EPIC-033` was planned.

What the Room does own is small and sharp: three classification outcomes with three destinations as a
**total `Record`** so an unrouted outcome does not compile (`R-035-5`), a failing test as a
precondition guarded at three levels (`R-035-8`), and no edge in the loop from a passing reproduction
test to a classification (`R-035-6`).

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS `^10.4.15`, Prisma `^5`, React 18. **No new runtime dependency**
(`R-035-12`) — every load-bearing choice concerns an existing in-repository service or a sibling
Epic's contract.

**Storage**: PostgreSQL via Prisma (`ADR-0003`). **8 new tables.** None stores requirement text,
specification text, evidence payloads or test output — baselines by version reference, evidence by
reference into `EPIC-032`, tasks by id into `EPIC-012`.

**Testing**: Vitest 2.1.8 — `backend-unit`, `backend-integration`, `architecture`, `frontend`. **No
new vitest project**: this Epic publishes no package.

**Target Platform**: Linux server + browser. **This Epic delivers a journey.**

**Project Type**: Backend module + Room surface, composing `EPIC-033`'s shared package

**Performance Goals** *(resolved by `R-035-9`)*: triage classification **p95 < 1.5 s** excluding
model time; reproduction evidence write **p95 < 800 ms** excluding the `EPIC-032` call; escape and
origin aggregation over 5,000 closed defects **p95 < 2 s**; Room load **p95 < 1.2 s** — the same
figure `EPIC-033` set and `EPIC-034` adopted, because it is the same shell; close-path evaluation
**p95 < 300 ms** **excluding the test run**, which this Epic cannot influence (`R-035-1`).

**Constraints**: no test runner, executor, scheduler or CI adapter (`FR-DFR-062`); **no import of
`GenerateTasksService` or `TaskRegenerationService`**, asserted as an import ban; no region
vocabulary of this Room's own; no Room-local attachment or access-check path; three classification
outcomes enforced by a total `Record` over the outcome union; a failing test enforced by type, by
loop configuration **and** by a database `CHECK`; `TestExecution` and `RequirementIntake` **refuse**
rather than degrade.

**Scale/Scope**: **47 functional requirements across ten groups**, 12 success criteria, **8 user
stories**, **16 exit criteria**, 8 new tables, 13 HTTP routes, 9 ports, 18 quickstart scenarios, 0 new
packages.

> **Four of these figures moved on 2026-08-23**, from the analysis remediation and not from a
> miscount: `FR-DFR-064` was added to close `A1`, `User Story 8` to close `I1`, and two mutation
> proofs became exit criteria to close `L1`. Re-extracted after the edits.

> **Every figure above was extracted by script from the artifacts**, and this note claims nothing
> wider than that. `EPIC-030` stated a wrong count, `EPIC-031` reproduced it, `EPIC-033` reproduced
> it *inside a paragraph claiming the figures were counted*, and `EPIC-034` broke the run by
> re-deriving each one. Requirements, success criteria, user stories and exit criteria were counted
> from [spec.md](./spec.md); tables from [data-model.md](./data-model.md); routes and ports from
> [contracts/defect-contract.md](./contracts/defect-contract.md); scenarios from
> [quickstart.md](./quickstart.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — the only directly edited file is `.specify/templates/plan-template.md`, on the exempt list, brought byte-identical from `epic/030` |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS, with the same named risk the other two Rooms carry** — `FR-DFR-072` and `FR-DFR-090`–`095` cite PMI-DOC-006, status `PROPOSED`. `UX-0034` is the only `UX-` requirement written specifically for this Room, so the exposure is slightly sharper here than for `EPIC-034`, and the back-fill owner is named in Assumptions |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-035` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code output is `packages/loop-contract/workflows/defect-room.json`, checked by `EPIC-030`'s configuration conformance check, **`T931`**, whose `T932` reads every file in that directory. *The identifier is named here rather than described, because `EPIC-034`'s analysis finding `C2` was exactly that citation drifting to a local architecture test* |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists, in the git index via `.gitkeep`. **This is the repository's own Constitution VI folder and is not what this Epic builds**; the product capability and the programme convention share a word and nothing else |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local branch only |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — branch `epic/035-defect-room` |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report, and the Delivery Board is refreshed (or declared stale) when displayed state changed | **PASS, with a declared staleness** — the board is **stale**: `EPIC-030` `Ready`, `EPIC-031`–`034` `Analyzed`, `EPIC-035` now `Planned`. This session cannot reach the artifact, so Constitution IX's fallback applies |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — nine questions across five Epics in one questionnaire; this run paused for nothing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph, not a hand-assembled one; a mocked collaborator does not satisfy this. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application is planned as closure evidence. An Epic with no user-facing capability records that, rather than omitting the row | **PASS** — Tier 1 planned (quickstart 17). **Tier 2 applies in full** (`R-035-10`, quickstart 18), and `SC-DFR-009`'s keyboard-only journey is exercised **inside** that run rather than as a second pass that could disagree with it |
| — | Repository was synced from GitHub before this work started | **PASS** — `git fetch --all` this session |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **PASS** — **discharged 2026-08-23**. Implementation runs in the dedicated worktree `.claude/worktrees/epic-035-defect-room`, created this date; the primary checkout returned to `main`. Discharged by **isolation, not exclusivity** — the reading `EPIC-029` recorded on 2026-08-21 and `EPIC-030` on 2026-08-22. See Complexity Tracking |

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

> **Gate XI is present because this branch took it**, byte-identical from `epic/030`
> (blob `c955a77`, matching `epic/034`). **This is the last Wave 1 Epic that needed the step** — the
> constitution's overdue v1.5.0 template propagation is now carried on five branches and still not
> recorded by `/speckit-constitution`, which remains outstanding and is not this Epic's to close.

**Post-Phase-1 re-check (2026-08-23)**: re-evaluated after all four Phase 1 artifacts. **No gate
changed status.** Gate V strengthened: Phase 1 moved three guarantees into the type system — a total
`Record` over the classification outcomes, a `DefectTest` whose `firstObservedFailingAt` is
non-optional, and a `FixAcceptance` union whose accepted branch cannot be constructed without one.
Gate XI strengthened: quickstart 17 now includes its own inversion, and quickstart 18 folds the
keyboard journey into the transcript run.

**Post-discharge re-check (2026-08-23)**: the concurrent-session gate moved **FAIL → PASS**
when the worktree `.claude/worktrees/epic-035-defect-room` was created and the primary checkout returned to
`main`. **It is the only status that changed.** `DOR-06` reads the leading word of each status
cell and now finds no `FAIL`, so this plan no longer holds the Epic out of `Ready`.

The gate was never asserted to pass. It was **discharged**, and the difference matters: this
checkout still shows 10+ `claude.exe` processes and exclusivity is still unverifiable. What
changed is that this Epic's implementation no longer shares a working tree with anything else —
which is what the rule protects, and the only part of it this session could establish.

## Project Structure

### Documentation (this feature)

```text
specs/035-defect-room/
├── plan.md                    # This file
├── research.md                # Phase 0 — 12 decisions, three found by reading
├── data-model.md              # Phase 1 — 8 tables, 2 derived views, 0 stored payloads
├── quickstart.md              # Phase 1 — 18 runnable scenarios
├── contracts/
│   └── defect-contract.md     # Phase 1 — this Room's surface; imports EPIC-033's pattern
├── checklists/requirements.md
├── defects/
└── tasks.md                   # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/loop-contract/workflows/
└── defect-room.json                    # NEW — this Room's loop instance, a distinct workflow type.
                                        #   NO edge from a passing reproduction run to a
                                        #   classification (R-035-6)

backend/src/modules/defect-room/        # NEW
├── defect-room.module.ts               # registered in app.module.ts — XI Tier 1 subject
├── defect-room.controller.ts           # the 13 real entry points
├── intake.service.ts                   # six origins; held-for-triage when unlinkable
├── triage.service.ts                   # three outcomes, three destinations, total
├── reproduction.service.ts             # evidence THROUGH EPIC-032 — no local attachment path
├── defect-test.service.ts              # the failing test as a precondition
├── evidence-check.service.ts           # the three paths from a passing run
├── repair.service.ts                   # EPIC-012 tasks; NEVER GenerateTasksService
├── verification.service.ts             # requests runs; owns no runner
├── routing.service.ts                  # transfer to EPIC-034, gap to EPIC-033, decline, return
├── analytics.service.ts                # aggregation + the completeness note (FR-DFR-083)
├── classification.types.ts             # CLASSIFICATION_OUTCOMES, DESTINATIONS
└── defect-room.tokens.ts               # the 9 ports

frontend/src/pages/
├── DefectRoom.tsx                      # NEW — composes EPIC-033's RoomShell, derives nothing
└── DefectRoom.test.tsx                 # the six regions, epistemic labels, 360px floor

backend/prisma/
├── schema.prisma                       # + DefectRecord, Classification, Reproduction, DefectTest,
│                                       #   EvidenceCheck, RepairLink, Routing, EscapeRecord
└── migrations/                         # two hand-edited CHECK constraints (R-035-8)

backend/tests/
├── unit/
│   ├── defect-room-classification-type.spec.ts   # the total Record over three outcomes
│   ├── defect-room-test-first.types.spec.ts      # firstObservedFailingAt is non-optional
│   └── … 23 further per-service unit specs, named in tasks.md
├── integration/
│   ├── defect-room-reachability.spec.ts     # XI Tier 1 — imports AppModule
│   ├── defect-room-constraints.spec.ts      # both CHECKs reject — and notice if a later
│   │                                        #   migration drops them (R-035-8)
│   ├── defect-room-test-first.spec.ts       # FR-DFR-041, SC-DFR-001
│   ├── defect-room-regression-scope.spec.ts # FR-DFR-061 — not bounded by the defect's Epic
│   ├── defect-room-transfer.spec.ts         # BR-0057, jointly with EPIC-034
│   ├── defect-room-gap-routing.spec.ts      # FR-DFR-076 — refuses until EPIC-033 has a route
│   └── defect-room-type-isolation.spec.ts   # SC-DFR-011 — via EPIC-030 T944a
└── architecture/
    ├── defect-room-independence.spec.ts     # no runner, no banned imports, no region vocabulary,
    │                                        #   no local attachment path
    └── defect-room-transcript.spec.ts       # XI Tier 2 — the transcript was generated
```

**Structure Decision**: backend module plus a Room page, **composing** `EPIC-033`'s shared package.
This Epic publishes **no package**. Two service names state what they are *not*:
`verification.service.ts` requests runs and owns no runner, and `repair.service.ts` creates
`EPIC-012` tasks and holds the defect link on this Room's side because `TaskRecord` has nowhere to
put it (`R-035-3`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution gate: "No other Claude session is active on this checkout" — was FAIL, ✅ discharged 2026-08-23** | Planning writes no application code; the isolation rule binds implementation. 10+ `claude.exe` processes, exclusivity unverifiable | **Discharge before `/speckit-implement`**: a worktree at `.claude/worktrees/epic-035-defect-room`. `EPIC-030` proved the step; the gate then moves FAIL → PASS and `DOR-06` clears |
| **A required collaborator has no implementation anywhere in the programme** | `FR-DFR-062` requires test execution to be requested from `EPIC-015`; `EPIC-015` owns `BR-0080` and built programme validation, not a callable surface (`R-035-1`) | Building a runner here was rejected by `FR-DFR-002` and by the plain words of `FR-DFR-062` — it would be *"a second test runner"* in the sentence forbidding one. Accepting a human declaration was rejected by `BR-0144` and `FR-DFR-063`. Reading CI directly was rejected as the bespoke per-tool path `EPIC-032`'s `AttestationSource` already refuses. **The cost is that verification and closure refuse until an owner exists**, which is the honest failing state and is stated rather than hidden |
| **An outbound route whose destination does not implement it** | `FR-DFR-076` routes a Requirement Gap to `EPIC-033` as new intent; `EPIC-033` has no inbound route and does not name this Epic as a source (`R-035-4`) | Routing gaps to the Change Room was rejected by `FR-DFR-076` in terms — there is no baseline to change, and that absence *is* the gap. Creating the requirement here was rejected by `FR-DFR-002`. **The cost is that gap routing refuses until `EPIC-033` gains a route**, and the item stays visibly unrouted rather than marked routed to somewhere that never received it. Recorded as a cross-Epic handover, the same shape as `EPIC-033`'s own `C1` |
| **A repair task must claim an engine produced it** | `TaskRecord.engineName` and `engineVersion` are non-optional and `FR-DFR-051` forbids a Room-local task model, so a human-authored repair task has no truthful value for either (`R-035-3`) | Extending `TaskRecord` was rejected: that model is `EPIC-012`'s and its provenance is `BR-0151`, `U-12`, unowned — changing it here crosses `FR-DFR-002`. Encoding the defect id in `description` was rejected: a link only a regular expression can follow is not traceability. **The cost is a documented sentinel, asserted by test so it cannot drift into looking like a real engine name**, and a handover naming `BR-0151` in the closing report |
| **81 task identifiers for seven user stories and eleven phases** | 996 of 999 three-digit prefixes are in use; `T997`–`T999` remain (`R-035-11`) | Reusing suffixes under another Epic's prefix would pass `G-26-15` and break what the suffix means — `EPIC-029` records it as *"keeps a later addition adjacent to what it pairs with."* Widening the regex is `EPIC-026`'s, and `EPIC-034`'s `T995y` already states the two fixes it must choose between. **The cost is that phases share bases and Polish confirmations consolidate; test-and-implementation pairing does not compress**, because `DOR-08` and Constitution V both read it |
