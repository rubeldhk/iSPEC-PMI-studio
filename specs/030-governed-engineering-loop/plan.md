# Implementation Plan: Governed Engineering Loop

**Branch**: `epic/030-governed-engineering-loop` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-030` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.7 (`BR-0064`, `BR-0065`, `BR-0060`, `BR-0069`), §6.18 (`BR-0111`), §5, §7 (`RULE-11`); `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §6.1–§6.2 (`UX-0030`, `UX-0035`)

**Input**: Feature specification from `/specs/030-governed-engineering-loop/spec.md`

## Summary

Build the one workflow abstraction every governed engineering workflow in PMI Studio is an instance
of — `Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome` — as a contract
package plus a backend engine, so that three Rooms are configurations rather than three engines.

The technical approach, from Phase 0: a **`packages/loop-contract`** package holding the stage
vocabulary and the five ports this Epic declares but does not fill; a **`backend/src/modules/loop`**
engine that writes only append-only transitions; **optimistic concurrency** on a version column so a
race refuses rather than blocks (`R-030-1`); and **one database transaction spanning the transition
and its audit record**, so `FR-GEL-041`'s fail-closed guarantee is enforced by atomicity rather than
by a check somebody remembers (`R-030-2`).

Loop instance configurations are repository-resident JSON with an executable conformance check,
which is how a non-code output satisfies Constitution V.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (repository `engines`)

**Primary Dependencies**: NestJS `^10.4.15` (`@nestjs/core`), Prisma `^5` (`@prisma/client`) — both
already in `backend/package.json`. **One new dev dependency**: `supertest` + `@types/supertest`,
which requires a `TS-001` entry in [`specs/_shared/dependencies.md`](../_shared/dependencies.md)
before it lands. Verified absent, not assumed.

**Storage**: PostgreSQL via Prisma (`ADR-0003`). Four new tables, one new migration under
`backend/prisma/migrations/` (currently 16).

**Testing**: Vitest 2.1.8. Projects touched: `backend-unit`, `backend-integration`, `architecture`,
and a new `loop-contract` project for the contract package (`TS-004` — every workspace package
typechecks and tests independently).

**Target Platform**: Linux server (backend service)

**Project Type**: Workspace package + backend module — the established
`packages/<x>-contract` + `backend/src/modules/<x>` split used three times already.

**Performance Goals** *(resolved by `R-030-6`; the spec deferred these here under `PP-018`)*:
loop transition overhead **p95 < 50 ms** excluding stage handlers; end-to-end transition including
the audit write **p95 < 150 ms**; progress projection **p95 < 100 ms**; **≥ 50 transitions/second**
sustained per workspace.

**Constraints**: transitions are append-only and never pruned; every transition is workspace-scoped
(`BR-0001`); no Room vocabulary may appear in the contract package (`FR-GEL-061`, asserted by an
architecture test); the Decide seam refuses when unfilled (`FR-GEL-062`).

**Scale/Scope**: **30 functional requirements across seven groups**, 11 success criteria, **3 new
tables**, 5 HTTP routes, 5 ports. Three downstream Epics (`EPIC-033`–`035`) and two sibling substrate
Epics (`EPIC-031`, `EPIC-032`) consume this contract.

> **Corrected 2026-08-22** (analysis finding `I1`). This read *"16 functional requirements across
> five groups"* and *"4 new tables"*. The first counted only the opening requirement group — the
> Epic is roughly twice the size that figure implied, which is the difference between a medium Epic
> and a large one at estimation time. The second counted `GateOutcome`, which
> [data-model.md](./data-model.md) §5 embeds in `LoopTransition` rather than giving its own table.
> Both were found by extracting identifiers rather than by reading, and both are the `G-36`
> count-defect class PMI-DOC-004 §0.3 closed and `G-BRS-01` now guards.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — the two files edited directly this session, `.specify/templates/plan-template.md` and `governance/repository-layout.md`, are both on Constitution I's exempt list |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS** — with one recorded exception: `BR-0065`'s ownership moved here on 2026-08-22 and the PMI-DOC-004 §6.7 edit is outstanding. Recorded in Assumptions with the project owner named; the SRS wins until it lands |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-030`, `specs/030-governed-engineering-loop/` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria, `spec.md` |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — loop configuration files are the non-code output and carry the `backend/tests/architecture/` conformance check of `R-030-4`; four mutation checks are Epic Exit Criteria |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists and is carried in the git index via `.gitkeep` (`G-26-13`) |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local branch only; nothing pushed |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — branch `epic/030-governed-engineering-loop` matches `specs/030-governed-engineering-loop` |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report, and the Delivery Board is refreshed (or declared stale) when displayed state changed | **PASS, with a declared staleness** — the board is **stale**: six Epics declared (`EPIC-030`–`035`) and `EPIC-030` moved `Specified → Checklisted → Planned`. This session cannot reach the artifact, so Constitution IX's stated fallback applies and the delta is named here and in the closing report |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — `/speckit-clarify` asked five questions in one batch; this plan run has paused for nothing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph, not a hand-assembled one; a mocked collaborator does not satisfy this. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application is planned as closure evidence. An Epic with no user-facing capability records that, rather than omitting the row | **PASS** — Tier 1 planned in `R-030-8` and `quickstart.md` Scenario 10, importing the real `AppModule`. **Tier 2 not applicable**: this Epic delivers no user-facing journey, recorded rather than omitted |
| — | Repository was synced from GitHub before this work started | **PASS** — `git fetch --all` run this session; `main` is level with `origin/main`, 0 ahead / 0 behind |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **PASS** — **discharged 2026-08-22**. Implementation runs in the dedicated worktree `.claude/worktrees/epic-030-governed-engineering-loop`, created this date; the primary checkout returned to `main`. Discharged by isolation, not by exclusivity — the same reading `EPIC-029` recorded on 2026-08-21. See Complexity Tracking |

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

> **Gate XI added to the template by this run.** The v1.5.0 Sync Impact Report in
> `.specify/memory/constitution.md` carries the follow-up: *"propagate XI into the two templates
> flagged above **before the next `/speckit-plan` or `/speckit-tasks` run**."* This is that run, so
> the row was added to `.specify/templates/plan-template.md` first — `.specify/**` is exempt under
> Constitution I. **The `tasks-template.md` half remains outstanding** and is due before
> `/speckit-tasks`.

**Post-Phase-1 re-check (2026-08-22)**: re-evaluated after `research.md`, `data-model.md`,
`contracts/` and `quickstart.md`. **No gate changed status.** Gate V strengthened rather than
weakened — Phase 1 turned three of the four mutation checks into concrete quickstart scenarios
(4, 7, 9) with the inversion each must survive.

**Post-remediation re-check (2026-08-22, later the same day)**: the concurrent-session gate moved
**FAIL → PASS** when the worktree was created. It is the only status that changed. `DOR-06` — which
reads the leading word of each status cell — now finds no FAIL, so this plan no longer holds the
Epic out of `Ready`. Gate V additionally gained `T944a`/`T944b` from analysis finding `C1`, closing
the one requirement that had no task.

## Project Structure

### Documentation (this feature)

```text
specs/030-governed-engineering-loop/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — 8 decisions, Context7 library IDs recorded
├── data-model.md        # Phase 1 output — 5 entities, 2 derived views
├── quickstart.md        # Phase 1 output — 10 runnable validation scenarios
├── contracts/
│   └── loop-contract.md # Phase 1 output — stage vocabulary, 5 ports, HTTP surface
├── checklists/
│   └── requirements.md  # Spec quality checklist, 16/16
├── defects/             # MANDATORY per-Epic defect records (Constitution VI)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/loop-contract/           # NEW — the vendor-neutral surface (R-030-3)
├── src/
│   ├── stages.ts                 # LOOP_STAGES — the one vocabulary (FR-GEL-002)
│   ├── ports.ts                  # StageHandler, PolicyProvider, EvidenceProvider,
│   │                             #   GateProvider, AuditSink
│   ├── types.ts                  # TransitionResult, LoopProgress, GateOutcome
│   └── index.ts
├── workflows/                    # Programme-defined workflow types (FR-GEL-009)
│   └── *.json
├── tests/
├── package.json
└── tsconfig.json                 # TS-004 — typechecks independently

backend/src/modules/loop/         # NEW — the engine
├── loop.module.ts                # registered in app.module.ts — the XI Tier 1 subject
├── loop.controller.ts            # the 5 real entry points
├── loop.service.ts               # transition, history, progress, exceptions
├── loop-config.loader.ts         # refuses a bad configuration at load (FR-GEL-007)
└── loop.tokens.ts                # port injection tokens

backend/prisma/
├── schema.prisma                 # + LoopInstanceConfiguration, LoopObject,
│                                 #   LoopTransition
└── migrations/                   # + 1 migration (17th)

backend/tests/
├── integration/
│   ├── loop-reachability.spec.ts # XI Tier 1 — imports AppModule (R-030-8)
│   ├── loop-fail-closed.spec.ts  # FR-GEL-041
│   └── loop-concurrency.spec.ts  # FR-GEL-015
└── architecture/
    ├── loop-independence.spec.ts # FR-GEL-061 — no Room vocabulary
    └── loop-config-conformance.spec.ts  # Constitution V, non-code output
```

**Structure Decision**: the `packages/<x>-contract` + `backend/src/modules/<x>` split already used
by `engine-contract`, `agent-contract` and `execution-contract`. Chosen because `FR-GEL-061` — *no
Room-specific vocabulary* — needs a package boundary an architecture test can assert, and because
three Room Epics need something to depend on that is not the engine. `R-030-3` records the two
alternatives rejected.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution gate: "No other Claude session is active on this checkout" — was FAIL, ✅ discharged 2026-08-22** | Planning writes no application code, and the isolation rule's own rationale is that *"two concurrent agents editing one checkout corrupts task state, produces interleaved partial edits, and breaks convergence accounting"* — which binds implementation, not specification. This checkout showed 10+ `claude.exe` processes, and three source files were observed reverting to their committed state mid-session without any command of this session's causing it. Exclusivity could not be asserted, so it was recorded as FAIL rather than assumed | Asserting the gate passes was rejected as unverifiable. **Discharged by isolation, not exclusivity**: the worktree `.claude/worktrees/epic-030-governed-engineering-loop` was created on 2026-08-22 and the primary checkout returned to `main`. This is the `EPIC-029` reading verbatim — its plan failed this identical row on 2026-08-21 and was discharged the same way. The gate row above now reads PASS |
| **Interim approval gate for `FR-GEL-016`** (`R-030-7`) | `FR-GEL-016` requires authorized human approval for a configuration change, but `EPIC-031`'s policy engine does not exist. The interim is a reviewed, attributed commit recorded as `approvedBy`/`approvalRef`; the loop refuses to load a configuration lacking them | Waiting for `EPIC-031` was rejected — it makes this Epic un-implementable until another Epic ships, the sequencing `ADR-0018` warns about. Shipping without the gate was rejected — a configuration changeable without approval is a route around every approval it defines. **This interim is a debt, not an end state**, and `EPIC-031` must replace it; the swap only ever tightens, because `FR-GEL-016` makes the band non-lowerable |
| **A fifth workspace package** | `packages/loop-contract` is the fifth `*-contract` package | A shared `packages/contracts` barrel was rejected: it would couple the loop's release cadence to the engine and agent contracts, and `TS-004` requires each package to typecheck independently |
