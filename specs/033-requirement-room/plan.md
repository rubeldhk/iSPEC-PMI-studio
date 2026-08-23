# Implementation Plan: Requirement Room

**Branch**: `epic/033-requirement-room` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-033` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.3 (`BR-0022`–`BR-0027`), §7 (`RULE-02`, `RULE-03`); `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §6.1–§6.2 (`UX-0030`–`UX-0035`), §7 (`UX-0040`–`UX-0042`)

**Input**: Feature specification from `/specs/033-requirement-room/spec.md`

## Summary

Build the Requirement Room: the governed decision workflow that turns raw intent into a baselined
requirement set ready for specification. **A BUILD, not an enhancement** — `EPIC-027` Finding A,
confirmed 2026-08-22, and `ADR-0015` is the sizing authority.

The technical approach, from Phase 0: consume `EPIC-007`'s requirement register and add the one
thing it does not have — a **baseline of a set** (`R-033-1`, verified in code); run AI analysis
through `EPIC-028`'s existing `AgentGateway` `analyze` capability rather than a new seam
(`R-033-2`); and make the two Room-pattern rules **compile errors** rather than review comments — six
required named JSX props for `UX-0030`/`UX-0035` (`R-033-3`) and a required epistemic discriminant
for `UX-0031` (`R-033-4`).

**This is the first of three Rooms**, so `packages/room-contract` and `RoomShell` are shared
artifacts `EPIC-034` and `EPIC-035` import rather than re-derive.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS `^10.4.15`, Prisma `^5`, React 18. **No new runtime dependency** —
the AI seam is `EPIC-028`'s `AgentGateway`, the design system `EPIC-029`'s, the register
`EPIC-007`'s.

**Storage**: PostgreSQL via Prisma (`ADR-0003`). **6 new tables.** None duplicates `EPIC-007`'s
register; the baseline stores requirement **version ids**, never copies (`R-033-5`).

**Testing**: Vitest 2.1.8 — `backend-unit`, `backend-integration`, `architecture`, `frontend`, plus
a new `room-contract` project (`TS-004`).

**Target Platform**: Linux server + browser. **This Epic delivers a journey**, unlike `EPIC-030` and
`EPIC-032`.

**Project Type**: Shared contract package + backend module + frontend Room surface

**Performance Goals** *(resolved by `R-033-7`)*: Room load with six populated regions **p95 < 1.2 s**
at 200 requirements; baseline creation **p95 < 2 s** at 200; blocker query **p95 < 200 ms**; set size
designed for **500**, with degradation above that a recorded limit. The AI round is bounded by
`EPIC-028`'s `WallClockOutcome` and deliberately **not** given a second budget here.

**Constraints**: no second requirement store (`FR-RQR-002`, `D-33`); an unlabelled AI element is not
constructible; a Room cannot omit or invent a region; a baselined requirement cannot be edited in
place; no AI may take a requirement decision, enforced by a database check constraint; no interim
external-stakeholder path (`FR-RQR-004`).

**Scale/Scope**: **38 functional requirements across eight groups**, 9 success criteria, 6 user
stories, **6 new tables**, 8 HTTP routes, 5 ports, 1 shared contract package, 1 Room surface.

> **Counted from the artifacts.** `EPIC-030`'s analysis found this figure wrong in its own plan
> (`I1`) and `EPIC-031`'s first draft reproduced it. **This plan reproduced it a third time**: the
> table count read 5 against a data model defining 6, in the very paragraph claiming the figures were
> extracted. Corrected 2026-08-22 (analysis finding `I1`). The lesson recorded rather than the
> number quietly changed: a note claiming every figure was counted must be true of every figure, or
> it makes the wrong ones harder to spot.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — the only directly edited file is `.specify/templates/plan-template.md`, on the exempt list |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS, with a named risk** — every requirement traces to §6.3 or to PMI-DOC-006. PMI-DOC-006 is **`PROPOSED`**, and `BR-0191` is only a *SHOULD*, so `FR-RQR-070`–`075` rest partly on an unapproved document. Recorded in Assumptions with the project owner named, and argued at length in `R-033-9` |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-033` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code output is `packages/loop-contract/workflows/requirement-room.json`, checked by `EPIC-030`'s configuration conformance check, which this Epic's file must pass |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists, in the git index via `.gitkeep` |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local branch only |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — branch `epic/033-requirement-room` |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report, and the Delivery Board is refreshed (or declared stale) when displayed state changed | **PASS, with a declared staleness** — the board is **stale**: `EPIC-030` `Ready`, `EPIC-031`/`032` `Analyzed`, `EPIC-033` now `Planned`. This session cannot reach the artifact, so Constitution IX's fallback applies |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — nine questions across five Epics in one questionnaire; this run paused for nothing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph, not a hand-assembled one; a mocked collaborator does not satisfy this. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application is planned as closure evidence. An Epic with no user-facing capability records that, rather than omitting the row | **PASS** — Tier 1 planned (quickstart 12). **Tier 2 applies in full** (quickstart 13), and the transcript must be a **keyboard** transcript because `SC-RQR-008` requires the journey be completable by keyboard alone |
| — | Repository was synced from GitHub before this work started | **PASS** — `git fetch --all` this session; `main` level with `origin/main` |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **FAIL** — see Complexity Tracking |

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

> **Gate XI is present because this branch took it**, byte-identical from `epic/030`. `EPIC-034` and
> `EPIC-035` need the same step before their plan runs.

**Post-Phase-1 re-check (2026-08-22)**: re-evaluated after all four Phase 1 artifacts. **No gate
changed status.** Gate V strengthened: Phase 1 moved two Room-pattern rules out of review and into
the type system, where a test cannot forget them. Gate II's risk is unchanged and now argued in
`R-033-9` rather than left as a footnote.

## Project Structure

### Documentation (this feature)

```text
specs/033-requirement-room/
├── plan.md                   # This file
├── research.md               # Phase 0 — 9 decisions, Context7 IDs recorded
├── data-model.md             # Phase 1 — 5 tables, 1 embedded, 2 derived views
├── quickstart.md             # Phase 1 — 13 runnable scenarios
├── contracts/
│   └── room-contract.md      # Phase 1 — SHARED: six regions, epistemic label, 5 ports
├── checklists/requirements.md
├── defects/
└── tasks.md                  # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/room-contract/                # NEW — SHARED by EPIC-033/034/035
├── src/
│   ├── regions.ts                     # RoomShellProps — six required named slots
│   ├── epistemic.ts                   # Epistemic, Labelled<T> — required discriminant
│   ├── object-ref.ts                  # RoomObjectRef — workflowType is an open string
│   └── index.ts
├── tests/
└── package.json / tsconfig.json       # TS-004

packages/loop-contract/workflows/
└── requirement-room.json              # NEW — this Room's loop instance (R-033-6)

backend/src/modules/requirement-room/  # NEW
├── requirement-room.module.ts         # registered in app.module.ts — XI Tier 1 subject
├── requirement-room.controller.ts     # the 8 real entry points
├── intake.service.ts                  # multi-source → candidates
├── analysis.service.ts                # AgentGateway 'analyze' — R-033-2
├── clarification.service.ts
├── options.service.ts
├── baseline.service.ts                # the entity this Epic adds — R-033-5
├── handoff.service.ts
├── readiness.projection.ts            # derived — what is blocking
└── requirement-room.tokens.ts

frontend/src/rooms/
├── RoomShell.tsx                      # NEW — SHARED, six required named props
└── regions/                           # region primitives, epistemic token mapping

frontend/src/pages/
└── RequirementRoom.tsx                # NEW — distinct from the existing Requirements.tsx

backend/prisma/
├── schema.prisma                      # + RequirementCandidate, Clarification,
│                                      #   RequirementDecision, Baseline,
│                                      #   BaselineException, Handoff
└── migrations/

backend/tests/
├── integration/
│   ├── requirement-room-reachability.spec.ts   # XI Tier 1 — imports AppModule
│   ├── baseline-immutability.spec.ts           # FR-RQR-051
│   └── requirement-room-type-isolation.spec.ts # FR-RQR-001, via EPIC-030 T944a
└── architecture/
    └── room-contract-independence.spec.ts      # NO requirement-storage type
```

**Structure Decision** *(`R-033-1`, `R-033-3`)*: a **shared** `packages/room-contract` plus a
per-Room backend module and page. `RequirementRoom.tsx` is a **new page beside the existing
`Requirements.tsx`**, not a replacement — PMI-DOC-006 §4.1 lists *Requirement Room* and
*Specifications* as separate areas, and §9 assigns the existing Requirements screens to
`EPIC-006`–`011`. That separation is `D-33` expressed in the navigation.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution gate: "No other Claude session is active on this checkout" — FAIL** | Planning writes no application code; the isolation rule binds implementation. 10+ `claude.exe` processes, exclusivity unverifiable | **Discharge before `/speckit-implement`**: a worktree at `.claude/worktrees/epic-033-requirement-room`. `EPIC-030` proved the step — the gate then moves FAIL → PASS and `DOR-06` clears |
| **A seventh workspace package, and it is shared across three Epics** | `packages/room-contract` is imported by `EPIC-033`, `EPIC-034` and `EPIC-035` | Putting the Room pattern in this Epic's backend module was rejected: the other two Rooms would import from a Room, which is exactly the collapse `ADR-0018` decided against. A shared package is the only place three peers can depend on without depending on each other |
| **This Epic sets patterns two later Epics inherit** | `RoomShell`'s six props and the epistemic discriminant are decided here and imported there | Deferring the pattern until all three Rooms are specified was rejected: `EPIC-034` and `EPIC-035` are already clarified and reference `UX-0035`, so a pattern decided later would be a pattern two Epics had already planned against. **The cost is that changing it later touches three Epics** — which is why `R-033-9` argues for discharging the PMI-DOC-006 approval before `EPIC-034` plans |
| **Proceeding on a `PROPOSED` SRS document** | `FR-RQR-070`–`075` cite PMI-DOC-006, status `PROPOSED — REQUIRES PROJECT OWNER APPROVAL`; `BR-0191` is only a *SHOULD* | Waiting was rejected — it blocks Wave 1's largest Epic on an unscheduled act. The exposure is bounded and stated: `R-033-3` is reversible at the cost of one file *until* three Rooms compose it, which is the argument for approving PMI-DOC-006 before `EPIC-034` plans rather than after |
