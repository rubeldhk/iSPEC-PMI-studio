# Implementation Plan: Change Room

**Branch**: `epic/034-change-room` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-034` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.5 (`BR-0042`–`BR-0048`), §7 (`RULE-02`); `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §6.1–§6.2 (`UX-0030`–`UX-0035`)

**Input**: Feature specification from `/specs/034-change-room/spec.md`

## Summary

Build the Change Room: governed change control over an approved baseline during implementation.
**A BUILD, not an enhancement** — the accepted amendment says *"maintain and enhance the existing
Change Room"* and `EPIC-027` Finding A found zero occurrences of one.

The technical approach, from Phase 0, is mostly about **what already exists**. `EPIC-020`'s
`ImpactService` is built and closed, and carries a settled `DEFAULT_IMPACT_DEPTH = 25` — so this Room
composes traversals rather than owning a graph (`R-034-1`). `EPIC-033`'s `packages/room-contract` is
imported unchanged, which is what keeps `UX-0035` a compile error rather than a convention
(`R-034-3`).

And one thing that exists is a **trap**: `TaskRegenerationService` is named exactly for `FR-CHR-062`
and **replaces** a task list, which would satisfy the requirement's wording while violating the
`BR-0154` it cites. This Room records a re-plan obligation and never calls it (`R-034-2`).

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS `^10.4.15`, Prisma `^5`, React 18. **No new runtime dependency, and
no new library decision** — every load-bearing choice concerns an existing in-repository service.

**Storage**: PostgreSQL via Prisma (`ADR-0003`). **6 new tables.** None holds requirement text, and
none holds an impact graph — `ImpactView` is a snapshot of a traversal `EPIC-020` performed.

**Testing**: Vitest 2.1.8 — `backend-unit`, `backend-integration`, `architecture`, `frontend`. **No
new vitest project**: this Epic publishes no package.

**Target Platform**: Linux server + browser. **This Epic delivers a journey.**

**Project Type**: Backend module + Room surface, composing `EPIC-033`'s shared package

**Performance Goals** *(resolved by `R-034-8`)*: impact view assembly **p95 < 3 s** at depth 25 over
a 500-artifact project; traversal depth **25**, adopted from `DEFAULT_IMPACT_DEPTH` rather than
invented; baseline delta **p95 < 500 ms** at 200 members; Room load **p95 < 1.2 s** — deliberately
the same figure `EPIC-033` set, because it is the same shell; closure evaluation **p95 < 200 ms**
excluding the `EPIC-032` Contract call.

**Constraints**: no second impact traversal (`FR-CHR-031`); no region vocabulary of this Room's own;
**no import of `TaskRegenerationService`**, asserted as an import ban; all eight impact areas always
present with `unknown` as a member state; two-or-more options enforced by a minimum-length tuple; six
trade-off dimensions enforced by a `Record`; baseline change human-approved by database constraint as
well as by policy.

**Scale/Scope**: **41 functional requirements across eight groups**, 10 success criteria, 6 user
stories, 6 new tables, 9 HTTP routes, 6 ports, 0 new packages.

> **Every figure above was extracted, and this note is narrower than the one it replaces.**
> `EPIC-030` stated a wrong count, `EPIC-031` reproduced it, and `EPIC-033` reproduced it *inside a
> paragraph claiming the figures were counted* — which is worse than not claiming it. So: tables,
> routes and ports here were counted by script from
> [data-model.md](./data-model.md) and [contracts/change-contract.md](./contracts/change-contract.md),
> and requirements from `spec.md`. If a figure is not in that list, it is not covered by this note.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — the only directly edited file is `.specify/templates/plan-template.md`, on the exempt list |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS, with the same named risk `EPIC-033` carries** — `FR-CHR-080`–`085` cite PMI-DOC-006, status `PROPOSED`, and `BR-0191` is only a *SHOULD*. This Epic **inherits** the pattern rather than setting it, so the exposure is `EPIC-033`'s decision and this Epic's dependency |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-034` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code output is `packages/loop-contract/workflows/change-room.json`, checked by `EPIC-030`'s configuration conformance check |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists, in the git index via `.gitkeep` |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local branch only |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — branch `epic/034-change-room` |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report, and the Delivery Board is refreshed (or declared stale) when displayed state changed | **PASS, with a declared staleness** — the board is **stale**: `EPIC-030` `Ready`, `EPIC-031`–`033` `Analyzed`, `EPIC-034` now `Planned`. This session cannot reach the artifact, so Constitution IX's fallback applies |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — nine questions across five Epics in one questionnaire; this run paused for nothing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph, not a hand-assembled one; a mocked collaborator does not satisfy this. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application is planned as closure evidence. An Epic with no user-facing capability records that, rather than omitting the row | **PASS** — Tier 1 planned (quickstart 13). **Tier 2 applies in full** (`R-034-9`, quickstart 14), covering the whole request-to-re-baseline chain |
| — | Repository was synced from GitHub before this work started | **PASS** — `git fetch --all` this session; `main` level with `origin/main` |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **FAIL** — see Complexity Tracking |

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

> **Gate XI is present because this branch took it**, byte-identical from `epic/030`. `EPIC-035`
> needs the same step before its plan run — the last Wave 1 Epic that will.

**Post-Phase-1 re-check (2026-08-22)**: re-evaluated after all four Phase 1 artifacts. **No gate
changed status.** Gate V strengthened: Phase 1 moved four guarantees into the type system — an
eight-member `Record` for impact areas, a minimum-length tuple for options, a six-member `Record` for
trade-offs, and an import ban for `TaskRegenerationService`. Each is a check that cannot be forgotten
because there is nothing to remember.

## Project Structure

### Documentation (this feature)

```text
specs/034-change-room/
├── plan.md                    # This file
├── research.md                # Phase 0 — 9 decisions, two changed by reading code
├── data-model.md              # Phase 1 — 6 tables, 2 embedded, 2 derived views
├── quickstart.md              # Phase 1 — 14 runnable scenarios
├── contracts/
│   └── change-contract.md     # Phase 1 — this Room's surface; imports EPIC-033's pattern
├── checklists/requirements.md
├── defects/
└── tasks.md                   # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/loop-contract/workflows/
└── change-room.json                    # NEW — this Room's loop instance, a distinct workflow type

backend/src/modules/change-room/        # NEW
├── change-room.module.ts               # registered in app.module.ts — XI Tier 1 subject
├── change-room.controller.ts           # the 9 real entry points
├── intake.service.ts                   # requests, and Defect Room transfer reception
├── impact.composer.ts                  # COMPOSES ImpactService + ChainTraversalService — no traversal
├── options.service.ts                  # two or more, six dimensions
├── decision.service.ts                 # via EPIC-031; human-approved by DB constraint too
├── rebase.service.ts                   # explicit rebase + re-decision test (R-034-5)
├── delta.service.ts                    # set diff over member version ids (R-034-4)
├── replan.recorder.ts                  # records an obligation; NEVER calls TaskRegenerationService
├── closure.service.ts                  # gated on EPIC-032
└── change-room.tokens.ts

frontend/src/pages/
└── ChangeRoom.tsx                      # NEW — composes EPIC-033's RoomShell, derives nothing

backend/prisma/
├── schema.prisma                       # + ChangeRequest, ImpactView, ChangeDecision,
│                                       #   BaselineDelta, RePlanObligation, ChangeClosure
└── migrations/

backend/tests/
├── integration/
│   ├── change-room-reachability.spec.ts     # XI Tier 1 — imports AppModule
│   ├── change-room-baseline-gate.spec.ts    # FR-CHR-011, RULE-02
│   ├── change-room-replan-safety.spec.ts    # FR-CHR-065 — no completed task destroyed
│   └── change-room-transfer.spec.ts         # BR-0057, jointly with EPIC-035
└── architecture/
    └── change-room-independence.spec.ts     # no region vocabulary, no second traversal,
                                             #   NO TaskRegenerationService import
```

**Structure Decision**: backend module plus a Room page, **composing** `EPIC-033`'s shared package.
This Epic publishes **no package** — the Room pattern is `EPIC-033`'s, and a second one would make
its compile-time `UX-0035` guarantee decorative. `impact.composer.ts` and `replan.recorder.ts` are
named for what they *are*: a composer that owns no graph, and a recorder that performs no re-plan.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution gate: "No other Claude session is active on this checkout" — FAIL** | Planning writes no application code; the isolation rule binds implementation. 10+ `claude.exe` processes, exclusivity unverifiable | **Discharge before `/speckit-implement`**: a worktree at `.claude/worktrees/epic-034-change-room`. `EPIC-030` proved the step; the gate then moves FAIL → PASS and `DOR-06` clears |
| **A requirement is satisfied by *recording* rather than *doing*** | `FR-CHR-062` requires downstream work be updated; this Epic records a `RePlanObligation` and executes nothing | Calling `TaskRegenerationService.regenerate()` was rejected and **banned by architecture test**: it replaces the task list, so it would satisfy `FR-CHR-062`'s wording, pass its tests, and destroy the completed-work history `BR-0154` protects. Building a non-destructive merge here was also rejected — that *is* `BR-0154`, it belongs to `U-12`, and building it would cross `FR-CHR-002`. **The cost is a requirement that is only half-dischargeable until `U-12` is declared**, which is stated rather than hidden |
| **Two impact areas can be permanently `unknown`** | `BR-0073` (architecture violation) and parts of operational effects are `U-17`'s and unowned | Omitting those areas was rejected by `FR-CHR-032` — an absent row and a clean row look identical. Reporting them as `not-impacted` was rejected as a false negative: it would claim a check ran. `unknown` with a stated reason is the honest third state, and Constitution IX's rule — a check that has not run must not be reported as passing — is what makes it required rather than merely available |
| **Depending on `EPIC-033` Phase 2 before it is built** | `packages/room-contract` and `RoomShell` are imported, not derived | Deriving a Change Room shell was rejected: `UX-0035` forbids divergence, and `EPIC-033` made the six regions required named props specifically so divergence cannot compile. **The cost is a hard build-order dependency**, recorded in this Epic's Assumptions on 2026-08-22 after `EPIC-033`'s analysis finding `C1` observed that neither Room named the artifact it must import |
