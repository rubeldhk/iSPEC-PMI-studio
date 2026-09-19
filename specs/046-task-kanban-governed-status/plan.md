# Implementation Plan: Task Kanban with Governed Auto-Status

**Epic**: `EPIC-046` · **Branch**: `epic/046-task-kanban-governed-status` · **Date**: 2026-09-06

**Spec**: [spec.md](./spec.md) (clarified 2026-09-06) · **Research**: [research.md](./research.md)

**SRS References**: `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §2.2 (step 8), §2.3
(source-of-truth boundaries — task status authoritative in the checkboxes *as observed*), §3 (`Task`:
`epicId`, `sourceLine`, `sourceDigest`), §4.1–4.2 (`pmi.tasks.sync`,
`POST /v1/projects/{id}/tasks/sync`), §5.2 (hook map: `after_tasks`, `after_implement`,
`speckit.pmi.progress`), §6 (Task Kanban in Plan & Tasks, `O-10`), §7 (`EPIC-046` brief), §8 (`M4`),
§9.3 (`LR-10`), §10, §11 (`R-05`, `R-07`), §12 (`D-5`) · `SRS/PMI-DOC-004B` §1–§2 (`O-10`) ·
`SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` `BR-0003`, `BR-0013`, `BR-0035`,
`BR-0050`, `BR-0193`, `RULE-10` · `SRS/PMI-DOC-005`, `SRS/PMI-DOC-006` §4.1 ·
`governance/document-structure.md` `DS-1`, `DS-2`

**Input**: Feature specification from `specs/046-task-kanban-governed-status/spec.md`

## Summary

Since `EPIC-042` the finish hook has called `pmi.tasks.sync` after `/speckit-tasks` and
`/speckit-implement`, and `speckit.pmi.progress` has appended one `progress-reported { taskId }`
event per newly ticked task — and the platform has answered *not available until `EPIC-046`*, so the
markdown is discarded and the events land on an execution nobody joins to a task. `EPIC-045` made
`tasks.md` **readable**; this Epic makes it **workable**.

The plan is four layers:

1. **The parse and the sync** (`R-046-1`, `R-046-2`, `R-046-3`, `R-046-8`, `R-046-9`): a grammar the
   platform owns and configuration drives; the existing `tasks` table widened rather than a second
   entity beside it; a manifest per sync in `EPIC-045`'s proven shape; the reserved tool made live
   with the hook untouched and the idempotency key derived from the execution and the digest.
2. **The rules** (`R-046-4`): reconciliation as one pure function with a truth table — the file wins
   for the two states a checkbox can express, a proposal-set status survives only while the file is
   silent, nothing parsed is ever deleted, and every disagreement is surfaced rather than resolved.
   PMI-DOC-007 §10 says of this Epic that *the rules are the work*; this is that.
3. **The governed move** (`R-046-5`, `R-046-6`): a task-status proposal with a required reason, its
   own immutable request row and its verdict in events — reusing `EPIC-030`'s rules and verdict
   vocabulary without widening its specification-typed adjudicator. A permitted member's own move
   applies at once; a project policy may still require an approver; an agent never self-approves.
4. **The surfaces and the evidence** (`R-046-7`, `R-046-10`, `R-046-11`, `R-046-12`, `R-046-13`): the
   Kanban and, at last, an address for the Plan & Tasks area; progress derived once and shown
   everywhere; no new runtime dependency; Tier 1 through the shipped hook with the concurrent case
   written first, Tier 2 the `M4` transcript; and the six existing checks this Epic breaks, repaired
   as planned tasks rather than discovered at implement time.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (`ADR-0003`).

**Primary Dependencies**: NestJS 10, Prisma 5.22, React 18, Vitest 2.1, Playwright — **all
unchanged**. This Epic adds **no new runtime dependency** (`R-046-10`): the board's moves are
accessible status controls with native HTML5 drag as an enhancement, not a drag-and-drop library, so
`specs/_shared/dependencies.md` gains no `D-` entry. The absence is recorded deliberately.

**Storage**: PostgreSQL 16 via Prisma. **Three new tables** (`task_syncs`, `task_sync_lines`,
`task_status_proposals`), **one enum value** (`TaskStatus.blocked`), **one new column on `projects`**
(`taskMoveRequiresApproval`), and **`tasks` widened** with eleven nullable columns — the ten of
PMI-DOC-007 §3 and this Epic's design plus `sourcePaths` (`C3`) — plus one widening,
`specificationId` becomes nullable (`Q1`). Additive migration `<ts>_epic046_task_sync`; the widening
is the only change touching an existing constraint and is called out in
[data-model.md](./data-model.md) §2.

**Testing**: Vitest — `backend-unit` (the grammar corpus, the reconciliation truth table, the six
verdicts, the derived key), `backend-contract` (`tasks-api.md`; `mcp-tool-surface` with **one**
reserved row), `backend-integration` (Testcontainers: the sync through the shipped `runFinish` and a
real `pmi-studio` server against the composed `AppModule`; **two simultaneous syncs and a replay
written first**; movement through the shipped `runProgress`; the proposal path; supersession;
unbound; cross-project absence), `architecture` (`connector-boundary` at fifteen scopes;
`durable-stores` gains `TASK_SYNC_STORE`), `mcp-server` (the live tool's translation), `frontend`
(the board, the `/plan` landing, the move dialog, the area row), `governance` (layout registration),
`e2e` (the `M4` transcript).

**Target Platform**: Linux server for the API; the browser for the board.

**Project Type**: web service (API + web) plus one MCP tool made live.

**Performance Goals**: an Epic of 100 tasks with 20 syncs lists in under **2 s**; progress derives in
under **1 s**; a 1 MiB `tasks.md` parses in under **2 s** (`SC-KAN-007`).

**Constraints**: nothing writes a file in the project directory (`FR-KAN-010`, proved by
byte-comparison and mutation); the Epic comes from the execution's binding, never a path
(`FR-KAN-030`); the hook is unchanged (`FR-KAN-061`); `in_progress` and `blocked` are unreachable
except through an applied proposal (`FR-KAN-041`); the sync is idempotent under concurrency before it
is anything else (`FR-KAN-038`); no new top-level refusal code (`FR-KAN-066`); one progress
derivation for every surface (`FR-KAN-056`).

**Scale/Scope**: tens of Epics per project; 20–100 tasks per Epic; two syncs per Epic per governed
`tasks`/`implement` run; proposals in the low tens per Epic over its life.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** — this step writes plan artifacts only; no application code |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — PMI-DOC-007 is in `SRS/`; one requirement rests on the provisional `LR-10` with the `BR-` back-fill recorded under Assumptions |
| III | Epic → Feature → Task; `specs/046-task-kanban-governed-status/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test; document outputs carry a conformance check | **PASS** — planned in `/speckit-tasks`; the grammar corpus is a repository fixture; **seven** mutation observations are owed ([quickstart.md](./quickstart.md)) |
| VI | `specs/046-task-kanban-governed-status/defects/` is the sole defect intake | **PASS** — created at this step |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — the migration is additive but for one documented widening; the tool's move from reserved to live is one release |
| VIII | Session labelled with the working Epic | **PASS** — branch `epic/046-task-kanban-governed-status`, cut 2026-09-06 by the analysis remediation (`D1`). It was owed because no `before_specify` hook is registered in this repository, so the specify step created none |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-09-06, all recommendations accepted, no follow-up round |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1: the sync through the shipped `runFinish` and movement through the shipped `runProgress`, against a real `pmi-studio` server and the composed `AppModule`; the board through its routes. Tier 2: the `M4` transcript on the reference-local stack (`R-046-12`) |
| XII | Governed commands registered in PMI Studio before executing | **PASS in design, PARTIAL in practice** — this Epic *consumes* executions and binds tasks to them, and its proposal path is proposal-then-adjudication with no connector application (`FR-KAN-071`); the commands that build it run in this repository, which is not a PMI-managed project, so they are not registered by hook. Recorded, as `EPIC-042`, `EPIC-044` and `EPIC-045` did |
| — | Repository was synced from GitHub before this work started | **PASS** — `HEAD..origin/main` is 0; local is 329 ahead, nothing to integrate |
| — | No other Claude session active on this checkout | **PASS** |

One gate (XII) is PARTIAL and is recorded in Complexity Tracking; gate VIII was PARTIAL at planning
and was closed on 2026-09-06 when the branch was cut. No gate FAILs; Phase 0 proceeded.

**Post-Phase 1 re-check**: unchanged, with three design considerations raised and resolved.
(1) `EPIC-030`'s `AdjudicationProposal` is hard-typed to a specification, so gate XII's *adjudicated
by the platform, never applied by a connector* is satisfied by reusing the contract's **rules and
verdict vocabulary** rather than its interface — stated openly in `R-046-5` so `/speckit-analyze`
rules on it rather than discovering it. (2) The task entity's link to a specification is widened to
nullable, which touches five existing readers and the traceability edge; the cost is enumerated in
`R-046-2` rather than left to implement time. (3) The sync is a write inside a hook's completion path
and must be idempotent under concurrency before it is anything else — the partial unique index is the
arbiter and the concurrent test is written first (`DEF-045-002`'s lesson).

## Project Structure

### Documentation (this feature)

```text
specs/046-task-kanban-governed-status/
├── spec.md                          clarified 2026-09-06
├── plan.md                          ← this file
├── research.md                      R-046-1 … R-046-13
├── data-model.md                    three tables · one widening · one enum value · one column · projections · the sync step by step · audit · invariants
├── contracts/
│   ├── tasks-api.md                 the connector operation · refusals · session routes · the proposal operation · what changes elsewhere · tests
│   └── board-contract.md            where · the header · columns and cards · moving · progress · filters · four states · tests
├── quickstart.md                    23 scenarios, seven mutation observations owed
├── checklists/requirements.md
└── defects/                         Constitution VI intake
```

### Source Code (repository root)

```text
backend/src/modules/task-sync/                          NEW module (R-046-1 … R-046-6)
├── task-sync.module.ts · task-sync.tokens.ts           TASK_SYNC_STORE; imports Connector, EpicStores, Executions, Tasks, Agents, Audit, Projects
├── task-grammar.ts                                     parseTasks(markdown, config) — pure; the DS-1 grammar; configuration-driven (R-046-1)
├── task-reconcile.ts                                   reconcile(previous, parsed) — pure; the truth table (R-046-4)
├── task-validation.ts                                  the nine refusal codes; UTF-8; size; line count; credential shapes
├── task-sync.store.ts                                  syncs · manifest · task upserts; Prisma (unique-violation read-back) + in-memory (same index)
├── task-sync.service.ts                                data-model.md §9 — execution lookup, Epic resolution, parse, reconcile, manifest, comment, audit
├── task-board.service.ts                               columns · markers · disagreements · staleness (R-046-7)
├── task-proposal.service.ts                            the request row, the event, the six verdicts (R-046-5, R-046-6)
├── task-progress.port.ts                               reaches EPIC-012's aggregate; no second derivation (R-046-7)
├── tasks-sync.controller.ts                            POST projects/:projectId/tasks/sync — ConnectorAuthGuard, scope tasks.sync
└── task-board.controller.ts                            the five session routes + POST /tasks/:id/status-proposals

backend/src/modules/tasks/tasks.service.ts               + blocked count; Epic-scoped progress entry point (R-046-7)
backend/src/modules/tasks/generate-tasks.service.ts      TaskRecord gains the new fields; specificationId nullable
backend/src/modules/tasks/tasks.store.prisma.ts          null-safe specification; upsert by (epicId, taskKey)
backend/src/modules/tasks/tasks.controller.ts            PATCH status refuses a SYNCED task, naming the proposal route (FR-KAN-017)
backend/src/modules/traceability/link-writer.service.ts  task→specification when one exists; task→Epic otherwise
backend/src/modules/connector/connector-scope.ts         + tasks.sync  (the fifteenth)
backend/prisma/schema.prisma · migrations/<ts>_epic046_task_sync/migration.sql
backend/src/app.module.ts                                + TaskSyncModule (after ArtifactsModule)
.env.example · README.md §Setup · docs/operator-setup.md PMI_TASKS_MAX_BYTES, PMI_TASKS_MAX_LINES, PMI_TASK_ID_PATTERN, PMI_TASK_DESCRIPTION_MAX

packages/mcp-server/src/tools/tasks.ts                   NEW — the live pmi.tasks.sync (R-046-8)
packages/mcp-server/src/tools/reserved.ts                − pmi.tasks.sync; ONE reserved tool remains
packages/mcp-server/src/server.ts                        registers TASK_TOOLS as live

frontend/src/pages/TaskBoard.tsx                         NEW — header · four columns · cards · markers · filters · states
frontend/src/pages/PlanLanding.tsx                       NEW — /plan, the area's first address (R-046-11)
frontend/src/components/TaskMoveDialog.tsx               NEW — required reason; the authoritative-file statement
frontend/src/shell/areas.ts                              plan-and-tasks → delivered; the N1 note removed
frontend/src/shell/routes.tsx · area-views.tsx           /plan · /plan/epics/:epicId
frontend/src/pages/JourneyBoard.tsx                      the card links to the Epic's board
frontend/src/services/api.ts                             + getEpicTasks · getEpicTaskProgress · getProjectTaskProgress · getDisagreements · proposeTaskStatus

backend/tests/unit/task-sync/*.spec.ts                   grammar corpus · reconciliation table · verdicts · derived key
backend/tests/contract/tasks-api.spec.ts · mcp-tool-surface.spec.ts (reserved rows: ONE)
backend/tests/integration/task-sync.spec.ts              the shipped runFinish; concurrent + replayed syncs FIRST
backend/tests/integration/task-proposal.spec.ts          the six verdicts; the byte-comparison of the Epic directory
backend/tests/architecture/connector-boundary.spec.ts    fifteen scopes
backend/tests/architecture/durable-stores.spec.ts        + TASK_SYNC_STORE
backend/tests/unit/connector/connector-auth.guard.spec.ts  the unregistered-scope example moves off tasks.sync (R-046-13)
backend/tests/integration/{connector-reads,governance-api}.spec.ts  reserved example → pmi.execution.sync
packages/mcp-server/tests/{artifacts-tool,tasks-tool}.spec.ts
frontend/tests/unit/pages/{task-board,plan-landing,task-move-dialog}.spec.tsx · shell/areas.spec.ts
e2e/tests/epic-046-m4.spec.ts                            the M4 transcript (R-046-12)
specs/043-…/contracts/mcp-tool-surface.md                dated note: pmi.tasks.sync live as of EPIC-046
governance/repository-layout.md                          + backend/src/modules/task-sync/ · the three frontend files (at implement time)
```

**Structure Decision**: task sync gets its **own backend module** because four things read or write
these rows — the connector's sync, the board, the proposal path and the execution event listener —
and the module must depend on Epics, executions and tasks without any of them depending back. It
reaches `EPIC-012`'s progress aggregate through a **narrow port** rather than reimplementing it, so
`FR-KAN-056`'s *one derivation* is structural rather than a convention. The **grammar and the
reconciliation rule are pure modules with no I/O**, because they are the two things that must be
testable as tables and mutable by a test — which is what `PMI-DOC-007` §10 means by *the rules are
the work*.

## Phase 0 — Research

[research.md](./research.md) resolves thirteen decisions: `R-046-1` the grammar is the platform's,
configuration-driven; `R-046-2` one task entity widened, not a second; `R-046-3` the sync record is a
manifest in `EPIC-045`'s shape; `R-046-4` reconciliation as one pure function with a truth table;
`R-046-5` task proposals reuse `EPIC-030`'s rules, not its specification-typed adjudicator;
`R-046-6` a permitted member's own move applies at once, policy may require an approver; `R-046-7`
the board and progress are projections with one derivation; `R-046-8` the tool live with a derived
idempotency key and the hook unchanged; `R-046-9` limits and the grammar as environment
configuration; `R-046-10` no new runtime dependency, and why; `R-046-11` Plan & Tasks gets its first
address; `R-046-12` Tier 1 through the shipped hook and Tier 2 the `M4` transcript; `R-046-13` the
six checks this Epic breaks and the repairs it owes them.

No `NEEDS CLARIFICATION` remains: the five questions were answered on 2026-09-06.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — `task_syncs`, `task_sync_lines`, `task_status_proposals`, the
  `tasks` widening, `TaskStatus.blocked`, `projects.taskMoveRequiresApproval`, the refusal
  vocabulary, eight projections, the sync step by step, audit actions, eight invariants.
- [contracts/tasks-api.md](./contracts/tasks-api.md) — the connector operation and its diff shape,
  the refusal table, five session reads plus the proposal route, the verdict table, what changes
  elsewhere, the tests that hold it.
- [contracts/board-contract.md](./contracts/board-contract.md) — where the board lives, the header,
  the columns and cards, the two move affordances and the one path, progress, filters, the four
  states, the tests.
- [quickstart.md](./quickstart.md) — twenty-five scenarios and the seven mutation observations owed
  at closure.

**Amended 2026-09-06 by the `/speckit-analyze` remediation** ([analysis.md](./analysis.md)): the
requester ruled on `F1` — *contract* in `FR-KAN-013` means `EPIC-030`'s **rules and verdict
vocabulary**, confirming `R-046-5` — and on `C3` — the repository paths a task description names are
**captured**, adding `sourcePaths` to `data-model.md` §2 and the card in `contracts/board-contract.md`
§3. Eight tasks were appended (`T1772`–`T1779`), taking the Epic to **94**; the two zero-coverage
requirements `FR-KAN-048` and `FR-KAN-072` now have tasks, and `T1711`/`T1729` were split so no task
merges red with green.

## Governance records written or owed by this step (`R-046-13`)

- `specs/_shared/dependencies.md` — **no entry**, deliberately. `R-046-10` records the rejected
  drag-and-drop dependency and why, so a later reader does not assume one was forgotten.
- `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` §3 — a dated note at implement
  time: `pmi.tasks.sync` live as of `EPIC-046`, **one** reserved tool remains, the surface unchanged
  at fifteen, the hook unedited.
- `governance/repository-layout.md` — the module and the three frontend files are registered when the
  directories exist (first tasks of their phases), not now: the layout check requires a registered
  path to exist.
- `frontend/src/shell/areas.ts` — `plan-and-tasks` moves to delivered; `EPIC-012`'s `T441p` is
  **superseded**, not abandoned (`R-046-11`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Gate XII PARTIAL — the commands producing this Epic run unregistered | This repository is not a PMI-managed project; the hooks run only in provisioned directories | Provisioning this repository as its own project is `EPIC-042`'s stated out-of-scope; the honest row is *recorded*, as before |
| `tasks.specificationId` widened to nullable | `Q1`: a synced task's home is its Epic, and an Epic's `tasks.md` can sync before any `spec.md` has | A placeholder specification puts an empty row in the specification list; refusing the sync makes an adopted directory unusable. Both were put to the requester and rejected |
| A task-local adjudicator beside `EPIC-030`'s | `AdjudicationProposal` is hard-typed to `specificationId` and `SpecificationStatus`; assembling one over `EPIC-030`'s unexported ports is the bypass `FR-GEL-073` forbids | Widening `EPIC-030`'s published contract to a generic target is the right long-term shape but is that Epic's change and would put this one behind a refactor of a `NON-NEGOTIABLE` seam. Recorded as the follow-up |
| Three tables where the replan sketched none | PMI-DOC-007 §3 asks only for three columns on `Task`; but *what a given execution saw* cannot be answered from row state once a later sync has moved on | Row state alone loses every unchanged sync, which is exactly `FR-KAN-034`. The manifest is the smallest addition that answers it |
| Ten nullable columns on `tasks` | The reconciliation rule needs the previous status **and its source**; the board needs the line, the digest and what last moved the card | Fewer columns means inferring the source from context — a guess, in the one Epic whose purpose is to stop guessing |

## Related Documents

- `specs/045-artifact-sync-markdown-viewer/` — the manifest shape, the derived idempotency key, the
  Epic-from-binding rule, `DEF-045-001` and `DEF-045-002` and their lessons
- `specs/044-epic-model-journey-board/` — Epics, binding resolution, the unbound group
- `specs/042-pmi-spec-kit-extension/` — `runFinish`, `runProgress`, `tickedTasks`, the offline
  postures
- `specs/043-pmi-integration-contract/` — the connector guard, the scopes, the reserved tool
- `specs/037-governed-execution-registry/contracts/` — the event vocabulary, the proposal rules
- `specs/030-governed-engineering-loop/` — the adjudication contract this Epic reuses the rules of
- `specs/012-workflow-tasks/` · `specs/_shared/platform-spec.md` — the task entity and its aggregate
- `adr/ADR-0030` · `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §2.3, §3, §4, §6, §7
