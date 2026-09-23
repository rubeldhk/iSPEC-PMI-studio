# Tasks: Task Kanban with Governed Auto-Status

**Epic**: `EPIC-046` · **Module**: Delivery (M-05) + Integration (M-09) · **Branch**:
`epic/046-task-kanban-governed-status` *(owed — see Delivery posture)* · **Generated**: 2026-09-06

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/tasks-api.md](./contracts/tasks-api.md) ·
[contracts/board-contract.md](./contracts/board-contract.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T1686`–`T1779`, **94 tasks** (`T1772`–`T1779` appended by the analysis
remediation of 2026-09-06).

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**.
> The corpus maximum before this Epic is `T1685` (`EPIC-045`, appended by its analysis remediation),
> so allocation starts at `T1686`, contiguous, with no suffix letters (`R-026-9`). The closure phase
> is pre-allocated (`T1765`–`T1771`), as `EPIC-041`'s analysis finding `I3` established; the eight
> remediation tasks follow it and execute in the phases their note names.
>
> **On the count.** 94 tasks exceeds the product's 50-task decomposition ceiling (`D-4`), which binds
> **PMI-managed projects** through their `DecompositionPolicy` — not this repository, whose
> constitution sets no ceiling. `EPIC-044` ran to 71 tasks and `EPIC-045` to 66. The count is what it
> is because Constitution V pairs a failing test with every implementation task, and because this
> Epic owes six repairs to checks it breaks (`R-046-13`) on top of its own scope.

**Delivery posture**: ▶ **PROCEEDING** — sixth and last Epic of the local-first replan (`D-7`), the
whole of milestone `M4`. Depends on `EPIC-041` to `EPIC-045`. The hooks are **not changed**
(`FR-KAN-061`): the shipped `speckit.pmi.finish` already calls the tool this Epic makes live, and
`speckit.pmi.progress` already sends the events it reads.

> **Branch.** `epic/046-task-kanban-governed-status`, cut 2026-09-06 by the analysis remediation
> (`D1`). It was owed because no `before_specify` hook is registered in this repository, so the
> specify step created none. Constitution VIII is satisfied.

**Session label**: `EPIC-046 Task Kanban with Governed Auto-Status` (Constitution VIII).

**Test statement** (Constitution V): every implementation task names the failing-first test task
that precedes it. This Epic's **document** outputs — `.env.example`, README §Setup, the operator
guide, the `EPIC-043` tool-surface note, the layout registrations, the `areas.ts` row — pair with the
existing conformance checks (`readme-conformance.spec.ts`, `mcp-tool-surface.spec.ts`, the layout
check, `areas.spec.ts`). **Seven** checks are mutation-tested at closure
([quickstart.md](./quickstart.md)), and the sync is **proved concurrent before the service exists**
(`T1698`, the `DEF-045-002` lesson). Whether a conformance check blocks CI: **blocks**, for every
check in this Epic.

**Feature map** (`F-046.n`, Constitution III): F-046.1 Setup — schema, store, the fifteenth scope,
the broken-check repairs (Phase 1) · F-046.2 Foundational — the grammar, the reconciliation rule,
validation, the sync service, the tool live (Phase 2) · F-046.3 The Epic's tasks become rows and
nothing is lost (US1) · F-046.4 Cards move while implement runs (US2) · F-046.5 Percent complete per
Epic and project (US3) · F-046.6 A move is a proposal with a reason (US4) · F-046.7 Disagreement is
surfaced, not hidden (US5) · F-046.8 Polish · F-046.Z Closure.

> **Phase order and priority.** `US1`, `US2` and `US3` are all `P1`. `US1` is built first because
> nothing moves and nothing counts until `tasks.md` becomes rows. `US4` and `US5` are `P2` and are
> built last among the stories, in that order, because `US5`'s end-to-end supersession case needs a
> proposal to supersede. The **reconciliation function handles a proposal-set status from Phase 2**,
> unit-tested as a table against fabricated inputs, so `US5` exercises it rather than introducing it.

---

## Phase 1: Setup — F-046.1

**Purpose**: the tables exist and a store binds to them; the fifteenth connector scope exists; the
four checks that break at this layer are repaired; the module directory is registered.

- [X] T1686 [P] Write the failing integration test `backend/tests/integration/task-sync-schema.spec.ts` (Testcontainers) — tables `task_syncs` (unique `(workspaceId, idempotencyKey)`, nullable `epicId` FK `epics`, FK `executions`, the four count columns and the four diff columns, `outOfBandEdit`), `task_sync_lines` (unique `(syncId, lineNumber)`, CHECK on `outcome`, `changeKind` and `refusalCode`), `task_status_proposals` (unique `(workspaceId, idempotencyKey)`, CHECK on both status columns, **no verdict column**); `tasks` gains `epicId`, `taskKey`, `sourceLine`, `sourceDigest`, `parallel`, `presentInLatestParse`, `statusSource`, `lastParsedExecutionId`, `lastMovedAt`, `lastMovedBy` with a **partial** unique index on `(epicId, taskKey)`; `tasks.specificationId` is **nullable**; `TaskStatus` has a fourth value `blocked`; `projects.taskMoveRequiresApproval` defaults false; the migration is additive but for the one documented widening (data-model.md §1–§6)
- [X] T1687 Add `TaskSync`, `TaskSyncLine`, `TaskStatusProposal`, the ten `Task` columns, the `Task.specificationId` widening, `TaskStatus.blocked` and `Project.taskMoveRequiresApproval` to `backend/prisma/schema.prisma`; write `backend/prisma/migrations/20260907090000_epic046_task_sync/migration.sql` (integration test: T1686)
- [X] T1688 [P] Extend `backend/tests/architecture/durable-stores.spec.ts` with a failing entry — `task-sync/task-sync.module.ts` binds `TASK_SYNC_STORE` to `PrismaTaskSyncStore` under `DATABASE_URL` and to `InMemoryTaskSyncStore` otherwise, with `DATABASE_URL` readable in the factory body (the `T1330` lesson: no `configured()` helper hiding the seam)
- [X] T1689 [P] Write failing unit tests `backend/tests/unit/task-sync/task-sync.store.spec.ts` — `recordSync` refuses a second sync with the same `(workspaceId, idempotencyKey)` by returning the stored one; `upsertTask` returns the existing row for a repeated `(epicId, taskKey)` **including when the two calls run concurrently**; the in-memory store throws a `P2002`-shaped error on both unique indexes exactly as the database does and the Prisma store reads the existing row back on that error; `markAbsent` sets `presentInLatestParse = false` and **no method deletes a task row**; `recordProposal` exposes no update method (data-model.md §12)
- [X] T1690 Create `backend/src/modules/task-sync/task-sync.tokens.ts` and `backend/src/modules/task-sync/task-sync.store.ts` (`TaskSyncStore` interface; `InMemoryTaskSyncStore` enforcing both unique indexes; `PrismaTaskSyncStore` with unique-violation read-back through the existing `isUniqueViolation` helper, and the manifest written in one transaction) (unit test: T1689; architecture test: T1688)
- [X] T1691 [P] Extend `backend/tests/architecture/connector-boundary.spec.ts` and `backend/tests/unit/connector/connector-scopes.spec.ts` with failing expectations — the scope registry lists **fifteen** scopes including `tasks.sync` (EPIC-041 one, EPIC-043 ten, EPIC-042 two, EPIC-045 one, EPIC-046 one)
- [X] T1692 Register `tasks.sync` in `backend/src/modules/connector/connector-scope.ts` with the comment that it is a **write** scope with no read beside it (`FR-KAN-071`) (architecture test: T1691)
- [X] T1693 Repair `backend/tests/unit/connector/connector-auth.guard.spec.ts` — its example of an **unregistered** scope is `tasks.sync`, which `T1692` has just made permanent; move the example to a synthetic name (`never.registered`) and add the comment that **no reserved-but-unregistered scope remains**, so the next Epic cannot repeat the move (`R-046-13`)
- [X] T1694 [P] Write the failing governance conformance check in `tests/governance/dependency-register.spec.ts` (extend) — `specs/_shared/dependencies.md` gains **no new `D-` entry** for this Epic, and `frontend/package.json` contains **no** drag-and-drop package (`dnd-kit`, `react-beautiful-dnd`, `react-dnd`); the absence is the recorded decision (`R-046-10`)
- [X] T1695 Register `backend/src/modules/task-sync/` in `governance/repository-layout.md` once `T1690` created it (conformance: `tests/governance/layout.spec.ts`; dependency check: T1694)

**Checkpoint**: tables, a durable store, the fifteenth scope and four repaired checks exist; nothing
parses yet.

---

## Phase 2: Foundational — F-046.2 (blocking — the grammar, the rules, the sync service, the tool live)

**Purpose**: the two pure modules that are *the work* (`PMI-DOC-007` §10), the service that uses
them, the connector route, and the reserved tool made live with the hook untouched. **The concurrent
and replayed syncs are written before the service exists**; `DEF-045-002` was a race every
non-concurrent test passed.

- [X] T1696 [P] Write the failing unit test `backend/tests/unit/task-sync/task-grammar.spec.ts` with its fixture corpus under `backend/tests/fixtures/task-grammar/` — **accepted**: `- [ ] T1620 Description with a path`, `- [X] T1620 …`, `- [x] T1620 …`, `- [ ] T1620 [P] …`; **ignored without report**: headings, prose, table rows, nested bullets, a `(unit test: T0nn)` cross-reference inside a description, `* [ ] T1 …` (not a `-` bullet); **not inferred**: an unchecked line under a heading called *Done* stays `not_started`, and ordering, section and prose never set a status (`FR-KAN-004`); **refused with a code**: missing identifier, `Txyz`, missing description, a description over the limit, a duplicate identifier within one file, a description containing `pmi_ct_…` / `Bearer …` / `sk-…`; and `linesConsidered = parsed + refused + duplicates` for every fixture (`FR-KAN-001` to `FR-KAN-008`, `SC-KAN-001`, `SC-KAN-002`)
- [X] T1697 Create `backend/src/modules/task-sync/task-grammar.ts` — `parseTasks(markdown, config)`, pure, no I/O and no clock; the identifier pattern, checkbox forms, parallel marker and description limit read from `config` with the defaults of `R-046-9` (unit test: T1696)
- [X] T1698 [P] Write the failing unit test `backend/tests/unit/task-sync/task-reconcile.spec.ts` as a **table**, one case per row of data-model.md's `R-046-4` truth table, including the row marked unreachable by `FR-KAN-041` (asserted, not assumed), plus the absent-from-parse case producing `notInLatestParse` and no status change
- [X] T1699 Create `backend/src/modules/task-sync/task-reconcile.ts` — `reconcile(previous, parsed)` returning `{ status, statusSource, marker }`, pure (unit test: T1698)
- [X] T1700 [P] Write the failing unit test `backend/tests/unit/task-sync/task-validation.spec.ts` — the nine refusal codes of data-model.md §7; a file over `PMI_TASKS_MAX_BYTES`, over `PMI_TASKS_MAX_LINES`, or not UTF-8 refuses the **whole** sync; a bad line refuses **one** line; the credential shapes reuse `EPIC-043`'s patterns; and the derived idempotency key is exactly `tasks-sync:<executionId>:<sha256(tasksMarkdown)>` (`FR-KAN-039`, `FR-KAN-073`, `R-046-8`)
- [X] T1701 Create `backend/src/modules/task-sync/task-validation.ts` — limits from the environment with stated defaults, the code vocabulary as a closed union, the derived key (unit test: T1700)
- [X] T1702 [P] Write the failing integration test `backend/tests/integration/task-sync.spec.ts` (Testcontainers, the composed `AppModule`, a real `pmi-studio` server over an in-memory MCP transport, the **shipped** `runFinish` from `@pmi/workspace-bundle`) — **the concurrency cases first**: two simultaneous syncs of one Epic both answer `201` and leave one row per `(epicId, taskKey)`; a replayed sync of the same execution and digest returns the stored manifest and creates nothing; then a first sync of a real `tasks.md` stores every parsed line with its source line and digest
- [X] T1703 [P] Write the failing unit test `backend/tests/unit/task-sync/task-sync.service.spec.ts` — the step order of data-model.md §9: an unknown execution, another project's, or a command that is neither `tasks` nor `implement` refuses by name; the Epic comes from the execution's **input binding** through `@pmi/epic-stage`'s `bindExecutions` and never from a path; no Epic yields an **unbound** sync; a task with no specification is stored against its Epic alone (`FR-KAN-030`, `Q1`); the manifest counts equal the parse's; `outOfBandEdit` is false on a first sync
- [X] T1704 Create `backend/src/modules/task-sync/task-sync.service.ts` implementing data-model.md §9 step by step, with the ordering note observed — any step that can violate a unique index runs before the sync row is finalised and is insert-and-read-back, never check-then-insert (unit test: T1703; integration test: T1702)
- [X] T1705 [P] Write the failing contract test `backend/tests/contract/tasks-api.spec.ts` — `POST /v1/projects/:projectId/tasks/sync` accepts `{ contractVersion?, executionId, tasksMarkdown }` behind `ConnectorAuthGuard` with scope `tasks.sync`, answers `201` with the response shape of contracts/tasks-api.md §1, and the **diff is printable without interpreting prose** (every entry a key and a value, never a sentence)
- [X] T1706 Create `backend/src/modules/task-sync/tasks-sync.controller.ts` — the connector route with `@ConnectorScope('tasks.sync')` (contract test: T1705)
- [X] T1707 Create `backend/src/modules/task-sync/task-sync.module.ts` and add `TaskSyncModule` to `backend/src/app.module.ts` after `ArtifactsModule`; import `AgentsModule` **for the guard's `TrustedPrincipalFactory`**, with the reason in a comment — `@UseGuards(ConnectorAuthGuard)` instantiates the guard in the consuming module's injector, and `EPIC-045`'s closure records that omitting it aborts the process with no message (integration test: T1702)
- [X] T1708 [P] Write the failing test `packages/mcp-server/tests/tasks-tool.spec.ts` — `pmi.tasks.sync` is a **live** tool whose arguments are validated and translated to the REST operation, whose refusals carry `structuredContent`, and whose absence from `RESERVED_SPECS` leaves exactly **one** reserved tool (`pmi.execution.sync`); extend `packages/mcp-server/tests/artifacts-tool.spec.ts`'s `RESERVED_SPECS` assertion to that one
- [X] T1709 Create `packages/mcp-server/src/tools/tasks.ts`, remove `pmi.tasks.sync` from `packages/mcp-server/src/tools/reserved.ts` (updating its header comment: **one** row remains), and register `TASK_TOOLS` as live in `packages/mcp-server/src/server.ts` (test: T1708)
- [X] T1710 Repair the three reserved-tool assertions this Epic breaks (`R-046-13`) — `backend/tests/contract/mcp-tool-surface.spec.ts` expects reserved rows `['pmi.execution.sync']`; `backend/tests/integration/connector-reads.spec.ts` and `backend/tests/integration/governance-api.spec.ts` observe the reserved refusal through `pmi.execution.sync` instead of `pmi.tasks.sync`
- [X] T1711 [P] Write the failing integration cases in `backend/tests/integration/task-sync.spec.ts` — a whole-file refusal (over the size limit, over the line limit, not UTF-8) leaves **no rows**; a sync for an execution bound to no Epic is stored unbound; the connector credential of another project is refused **as absence**, and so is a read or write crossing a workspace boundary (`FR-KAN-074` — two different guards); a line whose description carries a credential shape is refused, not stored, and named in a `system` comment on the execution (`FR-KAN-032`, `FR-KAN-039`, `FR-KAN-070`, `FR-KAN-073`; implementation: T1778)

**Checkpoint**: the real hook's task sync succeeds against the composed application, the concurrent
case is green, and `pmi.tasks.sync` is live. Nothing is displayed yet.

---

## Phase 3: User Story 1 — The Epic's tasks become rows, and nothing is silently lost (P1) — F-046.3

**Goal**: every task line of a synced `tasks.md` is a card; every rejected line is listed with its
number and reason; the two counts account for every task-list item in the file.

**Independent test**: run `/speckit-tasks` for one Epic against a local stack and open its board —
each `- [ ]` line is a card in *Not started*, each `- [X]` line in *Done*, a deliberately malformed
line appears in *Lines not parsed* with its number, and the header states parsed / not parsed /
total considered.

- [X] T1712 [P] [US1] Write the failing unit test `backend/tests/unit/task-sync/task-board.service.spec.ts` — the board projection returns the four columns with every row in exactly one; the latest-parse header (execution, command, digest, time) and the four counts; the refused lines of that parse; and it loads **no** `tasks.md` content to do it (data-model.md §8)
- [X] T1713 [US1] Create `backend/src/modules/task-sync/task-board.service.ts` — columns, card metadata, the latest-parse header, the refused lines (unit test: T1712)
- [X] T1714 [P] [US1] Extend `backend/tests/contract/tasks-api.spec.ts` with a failing expectation — `GET /v1/epics/:epicId/tasks` is a **session** route for project members, returns the board shape, and is **not** reachable with a connector credential, nor unauthenticated (`FR-KAN-063`, `FR-KAN-071`, `FR-KAN-075`)
- [X] T1715 [US1] Create `backend/src/modules/task-sync/task-board.controller.ts` with the board read (contract test: T1714)
- [X] T1716 [P] [US1] Write the failing frontend unit test `frontend/tests/unit/pages/task-board.spec.tsx` — four columns in the order of contracts/board-contract.md §3; a card shows identifier, description, `[P]` marker, source line and what last moved it; the refused-lines list shows line number, text and reason; the header shows the counts; the **two empty states are distinguished** (*no `tasks.md` synced yet*, naming `/speckit-tasks`, versus *the synced `tasks.md` contains no task lines*, with the digest); loading, error and partial each stated in words; the five filters of §6
- [X] T1717 [US1] Create `frontend/src/pages/TaskBoard.tsx` (unit test: T1716)
- [X] T1718 [P] [US1] Write the failing frontend unit test `frontend/tests/unit/services/api.spec.ts` (extend) — `getEpicTasks` calls `GET /v1/epics/:id/tasks` and surfaces a failure as a stated error rather than an empty board
- [X] T1719 [US1] Add `getEpicTasks` to `frontend/src/services/api.ts` and route `/plan/epics/:epicId` in `frontend/src/shell/routes.tsx` and `frontend/src/shell/area-views.tsx` (unit test: T1718)
- [X] T1720 [P] [US1] Extend `backend/tests/integration/task-sync.spec.ts` with the story's end-to-end case — a `tasks.md` containing headings, prose, a table row, a nested bullet, a `(unit test: T0nn)` cross-reference, one malformed line and one duplicate identifier: every task line becomes a row, the malformed line and the duplicate are reported with their numbers, nothing else is reported, and the counts sum (`SC-KAN-001`)
- [X] T1721 [P] [US1] Write the failing frontend unit test `frontend/tests/unit/pages/journey-board.spec.tsx` (extend) — an Epic card links to that Epic's task board, and an Epic with no synced `tasks.md` says so rather than linking to an empty page
- [X] T1722 [US1] Add the *Open tasks* link to `frontend/src/pages/JourneyBoard.tsx` (unit test: T1721)

**Checkpoint**: a stakeholder without a checkout can see the Epic's tasks and what the parse could
not read. Nothing moves by itself yet.

---

## Phase 4: User Story 2 — I watch cards move while `/speckit-implement` runs (P1) — F-046.4

**Goal**: `progress-reported` events move cards to *Done* with no human action; an event naming an
unknown identifier creates nothing and is listed.

**Independent test**: register an `implement` execution for an Epic whose tasks are synced, append
three `progress-reported` events through the shipped `runProgress`, then complete it — the three
cards are in *Done* attributed to their events, the percentage has risen, and no card was moved by a
person.

- [X] T1723 [P] [US2] Write the failing unit test `backend/tests/unit/task-sync/task-event.spec.ts` — a `progress-reported` event whose `payload.taskId` matches `(epicId, taskKey)` of the execution's Epic sets `status = done`, `statusSource = 'event'` and `lastMovedAt` to the event's time; a repeat changes nothing; an unmatched identifier creates **no** row and is retained as an unmatched report, matched later if that identifier is parsed; **no** event ever produces `in_progress` or `blocked` (`FR-KAN-040` to `FR-KAN-043`, `FR-KAN-047`)
- [X] T1724 [US2] Implement event application in `backend/src/modules/task-sync/task-sync.service.ts` and wire the execution-event listener in `backend/src/modules/task-sync/task-sync.module.ts`, replay-safe (unit test: T1723)
- [X] T1725 [P] [US2] Write the failing integration test `backend/tests/integration/task-progress.spec.ts` (Testcontainers, composed `AppModule`, real `pmi-studio` server, the **shipped** `runProgress` from `@pmi/workspace-bundle`) — three ticked tasks produce three events and three Done cards; a fourth event naming a token the platform's grammar rejects creates nothing and appears as unmatched (the deliberate consequence recorded in `R-046-1`); a repeated event is idempotent
- [X] T1726 [US2] Make `T1725` pass in `backend/src/modules/task-sync/task-event.service.ts` and `backend/src/modules/task-sync/task-sync.service.ts`; where the platform's answer shape is what changes, change the platform — `packages/workspace-bundle/src/hook-sequences.ts` is **not edited** (`FR-KAN-061`) (integration test: T1725)
- [X] T1727 [P] [US2] Extend `backend/tests/contract/tasks-api.spec.ts` with a failing expectation — the board read carries the Epic's latest execution, its outcome and, for `implement`, the count of tasks still unchecked in the file it synced; a terminal outcome **never** moves a card (`FR-KAN-044`, `FR-KAN-045`)
- [X] T1728 [US2] Extend `backend/src/modules/task-sync/task-board.service.ts` with the outcome and remaining count (contract test: T1727)
- [X] T1729 [P] [US2] Extend `frontend/tests/unit/pages/task-board.spec.tsx` with failing expectations — the header states the run's outcome and remaining count, lists unmatched progress reports, and states in words that movement is **observed on sync and on event, not pushed live** while no in-flight hook exists (`FR-KAN-046`, `R-07`; implementation: T1779)

**Checkpoint**: milestone `M4`'s mechanism works — the board moves itself.

---

## Phase 5: User Story 3 — Percent complete, per Epic and per project (P1) — F-046.5

**Goal**: one derivation, one number, shown identically on the board, the `/plan` landing and the
project surface.

**Independent test**: two Epics — 4 of 10 done and 5 of 5 done — read 40% and 100%, the project reads
60%, and the same three figures appear on every surface that shows them.

- [X] T1730 [P] [US3] Write the failing unit test `backend/tests/unit/tasks/tasks.service.spec.ts` (extend) — the progress aggregate gains a `blocked` count and an **Epic-scoped** entry point; rows with `presentInLatestParse = false` are excluded from the denominator; an empty Epic or project reads `0` and never `NaN`; engine-generated tasks with no Epic are counted in the project figure (`FR-KAN-055` to `FR-KAN-058`)
- [X] T1731 [US3] Extend `backend/src/modules/tasks/tasks.service.ts` and add `backend/src/modules/task-sync/task-progress.port.ts` so the board reaches **that** aggregate and defines no second derivation (unit test: T1730)
- [X] T1732 [P] [US3] Extend `backend/tests/contract/tasks-api.spec.ts` with failing expectations — `GET /v1/epics/:epicId/tasks/progress` and `GET /v1/projects/:projectId/tasks/progress` return the six figures and the whole-number percentage, as session routes
- [X] T1733 [US3] Add both progress routes to `backend/src/modules/task-sync/task-board.controller.ts` (contract test: T1732)
- [X] T1734 [P] [US3] Write the failing frontend unit test `frontend/tests/unit/pages/plan-landing.spec.tsx` — `/plan` lists the project's Epics with each board's summary and percentage, states the four states, filters the table, and links each row to `/plan/epics/:epicId`; the exclusion of *not in the latest parse* rows is stated where progress is shown
- [X] T1735 [US3] Create `frontend/src/pages/PlanLanding.tsx`, add `getEpicTaskProgress` and `getProjectTaskProgress` to `frontend/src/services/api.ts`, and route `/plan` in `frontend/src/shell/routes.tsx` and `frontend/src/shell/area-views.tsx` (unit test: T1734)
- [X] T1736 [P] [US3] Write the failing frontend unit test `frontend/tests/unit/shell/areas.spec.ts` (extend) — the `plan-and-tasks` row is **delivered**, has a reachable path with no route parameter, and carries no `declared-not-delivered` note
- [X] T1737 [US3] Update the `plan-and-tasks` row in `frontend/src/shell/areas.ts` — status delivered, the `N1` note removed, with a comment recording that `EPIC-012`'s `T441p` is **superseded, not abandoned** (`R-046-11`) (unit test: T1736)

**Checkpoint**: the Plan & Tasks area has its first address, and one number is shown everywhere.

---

## Phase 6: User Story 4 — I move a card, and PMI records a proposal with my reason (P2) — F-046.6

**Goal**: a permitted member's move applies at once and is recorded as a proposal with a reason and a
verdict; a policy may require an approver; **nothing writes `tasks.md`**.

**Independent test**: move one card to *In progress* with a reason — the card moves, the proposal,
event and verdict exist, and the Epic's directory is byte-identical before and after.

- [X] T1738 [P] [US4] Write the failing unit test `backend/tests/unit/task-sync/task-proposal.spec.ts` — the six verdicts of contracts/tasks-api.md §4: `applied` for a permitted member with no policy; `approval_required` under `projects.taskMoveRequiresApproval`; `inconsistent` when `expectedCurrentStatus` no longer holds; `refused` without the move permission; `refused` when an **agent** principal would approve its own proposal (Constitution XII.6); and a missing or empty reason refused **before a proposal row exists**
- [X] T1739 [P] [US4] Write the failing unit test `backend/tests/unit/task-sync/task-proposal-record.spec.ts` — the proposal row is written once and **never updated**; it has no verdict column; the verdict is an appended event plus a projection folded from events, in `EPIC-037`'s shape; the proposer's identity is frozen at proposal time; the idempotency key is derived as `contracts/tasks-api.md` §4 states and a resubmitted identical move returns the original verdict and creates no second row (`R-046-5`, `R-037-5`)
- [X] T1740 [US4] Create `backend/src/modules/task-sync/task-proposal.service.ts` — importing `@pmi/loop-contract`'s verdict vocabulary and reproducing `EPIC-030`'s rules **without** calling `PROPOSAL_ADJUDICATOR`, with the reading of `FR-KAN-013` from `R-046-5` stated in the file header (unit tests: T1738, T1739)
- [X] T1741 [P] [US4] Extend `backend/tests/contract/tasks-api.spec.ts` with failing expectations — `POST /v1/tasks/:taskId/status-proposals` takes `{ expectedCurrentStatus, requestedStatus, reason }`, returns the verdict in one round trip, appends `status-transition-proposed` to the task's `lastParsedExecutionId`, and is a session route no connector credential may call; `GET /v1/tasks/:taskId/status-proposals` returns the requests with their folded verdicts
- [X] T1742 [US4] Add both proposal routes to `backend/src/modules/task-sync/task-board.controller.ts` (contract test: T1741)
- [X] T1743 [P] [US4] Write the failing integration test `backend/tests/integration/task-proposal.spec.ts` — **the byte-comparison**: capture a digest of every file under the Epic's directory, run a full board session including a move and its verdict, and assert the directory is byte-identical afterwards (`SC-KAN-004`); plus a policy requiring an approver leaving the card in place; two simultaneous moves of one card both recorded with at most one applied; a connector credential refused when it attempts to adjudicate or apply
- [X] T1744 [US4] Make `T1743` pass in `backend/src/modules/task-sync/task-proposal.service.ts` and `backend/src/modules/task-sync/task-board.controller.ts` — the policy branch, the optimistic-concurrency check on `expectedCurrentStatus`, and the connector refusal on both the proposal and the apply path (integration test: T1743)
- [X] T1745 [P] [US4] Write the failing unit test `backend/tests/unit/tasks/tasks.controller.spec.ts` (extend) — `PATCH /tasks/:id/status` **refuses a synced task** (one carrying a `sourceLine` and `sourceDigest`), naming the proposal route in its message, and still accepts an engine-generated task (`FR-KAN-017`, the `Q3` answer)
- [X] T1746 [US4] Implement the refusal in `backend/src/modules/tasks/tasks.controller.ts`, and update `frontend/src/pages/Tasks.tsx` so its `<select>` is disabled for a synced task with the reason stated (unit test: T1745)
- [X] T1747 [P] [US4] Write the failing frontend unit test `frontend/tests/unit/pages/task-move-dialog.spec.tsx` — the dialog **requires a reason** and refuses submission without one; it states in words that the project directory is authoritative and that this move is a proposal about the record, not an edit of the file; there is **no** edit, upload, rename or delete control anywhere on the surface; a member without the move permission sees the board read-only with the reason stated and no move control; a card with an open proposal shows the requested status, requester and time and stays in its column; a card whose proposal was refused or found inconsistent stays where it was and shows the verdict and its stage (`FR-KAN-015`)
- [X] T1748 [US4] Create `frontend/src/components/TaskMoveDialog.tsx`, wire the status control and the native HTML5 drag handler in `frontend/src/pages/TaskBoard.tsx` to the same dialog and route, and add `proposeTaskStatus` to `frontend/src/services/api.ts` — **no drag-and-drop package** (`R-046-10`) (unit test: T1747)

**Checkpoint**: the board is writable in the only way the source-of-truth boundary permits.

---

## Phase 7: User Story 5 — The board surfaces disagreement rather than hiding it (P2) — F-046.7

**Goal**: every disagreement between the file and the board is shown with both sides, both digests
and the rule that decided it; no proposal record is ever deleted or amended.

**Independent test**: sync; move a card to *In progress* by proposal; re-sync unchanged — the card
stays, marked *ahead of the file*. Hand-tick that line and re-sync — the card is *Done*, marked
*superseded by the file*, and the proposal row still exists.

- [X] T1749 [P] [US5] Write the failing unit test `backend/tests/unit/task-sync/out-of-band.spec.ts` — a sync whose digest differs from the previous sync's, with no governed execution of that Epic completed between them, sets `outOfBandEdit`; the content is still accepted, because the file is authoritative (`FR-KAN-023`, `R-05`)
- [X] T1750 [US5] Implement `outOfBandEdit` detection in `backend/src/modules/task-sync/task-sync.service.ts` (unit test: T1749)
- [X] T1751 [P] [US5] Write the failing unit test `backend/tests/unit/task-sync/disagreements.spec.ts` — the projection returns tasks ahead of the file, tasks not in the latest parse, unmatched progress reports, the latest parse's refused lines, `outOfBandEdit`, and a **digest-agreement finding** when the latest parse's `tasksDigest` differs from the `tasks.md` artifact version of the same execution; the finding is reported and **never repaired** (`FR-KAN-024`, `FR-KAN-036`)
- [X] T1752 [US5] Implement the disagreements projection in `backend/src/modules/task-sync/task-board.service.ts` and add `GET /v1/epics/:epicId/tasks/disagreements` to `backend/src/modules/task-sync/task-board.controller.ts` (unit test: T1751)
- [X] T1753 [P] [US5] Write the failing integration test `backend/tests/integration/task-reconciliation.spec.ts` — the supersession sequence end to end: sync, propose *In progress*, re-sync unchanged (card stays, *ahead of the file*), hand-tick and re-sync (card *Done*, *superseded by the file*, the proposal row **still present and unamended**); a task removed from the file stays, marked *not in the latest parse*, and leaves the progress denominator; a description changed under the same identifier keeps the row and its history and appears in the diff with both texts (`FR-KAN-021`, `FR-KAN-022`, `FR-KAN-025`, `FR-KAN-031`)
- [X] T1754 [US5] Make `T1753` pass in `backend/src/modules/task-sync/task-sync.service.ts` (the `reconcile` call site and the description-change diff entry) and `backend/src/modules/task-sync/task-sync.store.ts` (`markAbsent`, which sets the flag and deletes nothing) (integration test: T1753)
- [X] T1755 [P] [US5] Write the failing frontend unit test `frontend/tests/unit/pages/task-board.spec.tsx` (extend) — the markers render as words beside their cards (*ahead of the file*, *not in the latest parse*, *superseded by the file*); the header's disagreement list is countable and names the execution and digest each entry relates to; the rule that decided an outcome is named on the surface (`FR-KAN-020`)
- [X] T1756 [US5] Implement the markers and the disagreement list in `frontend/src/pages/TaskBoard.tsx` (unit test: T1755)

**Checkpoint**: the board is trustworthy — it says what it does not know.

---

## Phase 8: Polish & Cross-Cutting — F-046.8

- [X] T1757 [P] Write the failing `M4` harness `e2e/tests/epic-046-m4.spec.ts` (Playwright; the run writes its transcript under `docs/uat/`, naming the stack — the transcript itself is `T1767`'s) — a governed `tasks` then `implement` on the reference-local stack through the real `pmi-studio` server over stdio and the shipped hook sequences; a signed-in member with no checkout watches the Epic's board reach five *Done* and the percentage rise, with **zero** manual moves (`SC-KAN-003`); the transcript also records the board's list time for an Epic of 100 tasks and the parse time for a 1 MiB `tasks.md` (`SC-KAN-007`)
- [X] T1758 [P] Extend `packages/workspace-bundle/tests/first-run.spec.ts` with a failing expectation — against a stub answering the live shape `{ syncId, epicId, counts, diff, refusedLines }`, `runFinish` completes, the digests still travel on the completion's output binding, and its lines carry **no** new sync line (the finish prompt specifies none); against the old `not_available_until` refusal it still prints the one information line. `packages/workspace-bundle/src/hook-sequences.ts` and `packages/workspace-bundle/extension/commands/{finish,progress}.md` are **not edited** (`FR-KAN-061`); if the expectation fails, the platform's answer shape is what changes
- [X] T1759 Update `README.md` §Setup (a subsection *The task board (EPIC-046)*: what is parsed, the grammar and where its settings live, that a manual move is a proposal and never edits the file, where to read the board) and `docs/operator-setup.md` (an `EPIC-046` paragraph: the migration and its one widening, the four settings, the derived idempotency key, that a 1 MiB `tasks.md` sits inside `PMI_ARTIFACT_SYNC_BODY_BYTES`, what a refused line looks like on the timeline), and add the four settings to the root `.env.example` (conformance: `tests/governance/readme-conformance.spec.ts`)
- [X] T1760 [P] Write the failing conformance extension in `backend/tests/contract/mcp-tool-surface.spec.ts` — the contract document's §3 lists exactly **one** reserved tool and carries a dated note naming `EPIC-046` for `pmi.tasks.sync`; the server's live tools include it, the surface is unchanged at fifteen, and **no other refusal code changes meaning** — the codes of `contracts/mcp-tool-surface.md` §4 are asserted unchanged (`FR-KAN-064`)
- [X] T1761 Add the dated note to `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` §3 — `pmi.tasks.sync` live as of `EPIC-046`, one reserved tool remains, the surface unchanged at fifteen, the hook unedited (conformance: T1760)
- [X] T1762 [P] Run `backend/tests/architecture/engine-independence.spec.ts` and `agent-independence.spec.ts` against the new module; if either names a provider through a test fixture string, move the string to a fixture file — the production code must already be clean, since a synced task's `engineName`/`engineVersion` come from the execution's agent identity snapshot and never from a literal (architecture tests: existing scans)
- [X] T1763 Register `frontend/src/pages/TaskBoard.tsx`, `frontend/src/pages/PlanLanding.tsx`, `frontend/src/components/TaskMoveDialog.tsx` and `backend/tests/fixtures/task-grammar/` in `governance/repository-layout.md` (conformance: `tests/governance/layout.spec.ts`)
- [X] T1764 Fill `specs/046-task-kanban-governed-status/quickstart.md` §Results — the board list and parse timings, the transcript path or its absence, the counts

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, V, VI, VII, IX, XI, XII) — F-046.Z

- [X] T1765 Confirm every implementation task in `specs/046-task-kanban-governed-status/tasks.md` has a passing unit test or conformance check, by running the whole-project suites (`pnpm test:unit && pnpm test:contract && pnpm test:integration && pnpm test:arch && pnpm test:governance`) and recording the counts in `specs/046-task-kanban-governed-status/closure.md`
- [X] T1766 **Constitution XI Tier 1 (ALWAYS)** — `T1702`, `T1725`, `T1743` and `T1753` drive the sync and the movement through the **shipped** `runFinish` and `runProgress` and a real `pmi-studio` server against the composed `AppModule` in `backend/src/app.module.ts`, and the board through its routes (integration tests: T1702, T1725, T1743, T1753); prove by inversion — remove `TaskSyncModule` from `backend/src/app.module.ts` and observe `T1702` red (the hook's task sync answers `404` and the board reads vanish) — and record it in `specs/046-task-kanban-governed-status/closure.md`
- [ ] T1767 **Constitution XI Tier 2** — run `e2e/tests/epic-046-m4.spec.ts` against the reference-local stack and commit the run-generated transcript under `docs/uat/` (`EPIC-046-m4-transcript.md`) naming the stack (`SC-KAN-003`)
- [X] T1768 **Seven mutation observations recorded** in `specs/046-task-kanban-governed-status/closure.md`, each observed failing: loosening `PMI_TASK_ID_PATTERN` fails `T1696`; accepting an arbitrary checkbox form fails `T1696`; removing the partial unique index on `(epicId, taskKey)` fails `T1689`/`T1702`; a write to `tasks.md` in the proposal path fails `T1743`; last-write-wins in `task-reconcile.ts` fails `T1698`/`T1753`; agent self-approval fails `T1738`; counting *not in the latest parse* rows in the denominator fails `T1730` (quickstart.md §Mutation observations)
- [X] T1769 **Constitution XII** — record in `specs/046-task-kanban-governed-status/closure.md` that the commands producing this Epic ran **unregistered by hook** (this repository is not a PMI-managed project); that the `M4` transcript's executions are registered by `speckit.pmi.begin` and their tasks synced by `speckit.pmi.finish`; and that **no connector applies a status** — a connector may sync and propose, never approve (`FR-KAN-071`)
- [ ] T1770 Run `/speckit-converge`; append any remaining work to `specs/046-task-kanban-governed-status/tasks.md`; triage `specs/046-task-kanban-governed-status/defects/` leaving no open record; regenerate `governance/epic-stage-register.md` with `pnpm register:update` (twice); re-run `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:arch && pnpm test:governance`; then promote `local → dev` (no environment skipped) **only on an instruction naming the environment**
- [X] T1771 **Records** — confirm `specs/_shared/dependencies.md` gained **no** entry and `frontend/package.json` carries no drag-and-drop package (`R-046-10`); `governance/repository-layout.md` registers the module, the three frontend files and the fixture corpus; `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` carries the dated note; the shell area registry shows **Plan & Tasks** delivered with `T441p` recorded as superseded; and the milestone table of `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §8 has `M4` reached — record all five in `specs/046-task-kanban-governed-status/closure.md`
- [X] T1772 [P] [US2] Write the failing test `backend/tests/unit/task-sync/board-staleness.spec.ts` — the staleness projection (data-model.md §8) reports the latest parse's `syncedAt` against the Epic's latest execution's time and marks the board stale when the parse is older; a provisional execution contributes **no** sync row, so an Epic whose only recent run was provisional reads stale rather than empty; nothing is guessed or partially parsed from a provisional run (`FR-KAN-048`)
- [X] T1773 [US2] Implement the staleness projection in `backend/src/modules/task-sync/task-board.service.ts` and state it in the board header in `frontend/src/pages/TaskBoard.tsx`, naming both times (unit test: T1772)
- [X] T1774 [P] Write the failing unit test `backend/tests/unit/task-sync/task-audit.spec.ts` — the four actions of data-model.md §11 are recorded through the audit port: `create task_sync` with execution, digest, counts, diff summary and refusal codes; `update task` with from, to, source and the cause id; `create task_status_proposal` with task, from, to, whether a reason was present and the proposer type; `update task_status_proposal` with the verdict and whether it was immediate. No audit row is updatable (`FR-KAN-072`, `PP-010`)
- [X] T1775 Wire the audit port in `backend/src/modules/task-sync/task-sync.service.ts` and `backend/src/modules/task-sync/task-proposal.service.ts`, reusing the `SyncAuditPort` shape `EPIC-045` established in `backend/src/modules/artifacts/artifact-sync.service.ts` (unit test: T1774)
- [X] T1776 [P] Extend `backend/tests/unit/task-sync/task-grammar.spec.ts` and its corpus under `backend/tests/fixtures/task-grammar/` with a failing case — a description naming one or more repository paths yields those paths on the row; a description naming none yields an empty list and is **not** a refusal (`FR-KAN-005`, `DS-1`)
- [X] T1777 Add `sourcePaths` to `backend/prisma/schema.prisma`, to the migration written at `T1687`, to `backend/src/modules/task-sync/task-grammar.ts`, and to the card in `frontend/src/pages/TaskBoard.tsx` (unit test: T1776)
- [X] T1778 Make `T1711`'s cases pass in `backend/src/modules/task-sync/task-sync.service.ts` and `backend/src/modules/task-sync/task-validation.ts` — the whole-file refusal path that writes no rows, the unbound branch, the cross-project and cross-workspace absence, and the credential-shape refusal reported in a `system` comment (integration test: T1711)
- [X] T1779 [US2] Implement the header additions in `frontend/src/pages/TaskBoard.tsx` — the run's outcome and remaining count, the unmatched progress reports, and the *observed, not pushed live* statement (unit test: T1729)

> `T1772`–`T1779` were appended on 2026-09-06 by the `/speckit-analyze` remediation (findings `C1`,
> `C2`, `C3`, `D2`); identifiers are never renumbered (`DS-2`), so they sit after `T1771` rather than
> among the phases they belong to. **They execute in their phases, not last**: `T1774`/`T1775`,
> `T1776`/`T1777` and `T1778` in **Phase 2** (`T1778` immediately after `T1711`); `T1772`/`T1773` and
> `T1779` in **Phase 4**. `T1777` amends the migration `T1687` writes, so it runs before that
> migration is applied to any environment beyond `local`.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3**: strict. The tables and the store (Phase 1) are what the sync
  (Phase 2) writes; the concurrent integration test `T1702` is written in Phase 2 **before**
  `T1704`–`T1707` and stays red until the module is composed, so the race is proved absent rather
  than assumed (`DEF-045-002`'s lesson).
- **Phase 3 (US1)** is the first screen and needs `T1713` and `T1715`. **Phase 4 (US2)** extends the
  service and the same page. **Phase 5 (US3)** touches a different service (`EPIC-012`'s aggregate)
  and a different page, so its backend half may run in parallel with Phase 4.
- **Phase 6 (US4)** needs `T1690` (the proposal store) and `T1715` (the controller it extends).
  **Phase 7 (US5)** needs Phase 6, because its end-to-end supersession case needs a proposal to
  supersede — the reconciliation rule itself exists from `T1699` and is unit-tested there.
- Within a phase, every `[P]` test task may run before or alongside its neighbours; each
  implementation task waits for its named test and for the file-sharing task before it
  (`T1704` → `T1706` → `T1707`; `T1713` → `T1728` → `T1752`; `T1717` → `T1729` → `T1756`;
  `T1715` → `T1733` → `T1742` → `T1752`).

### Cross-Epic dependencies

| This Epic needs | From | State |
|---|---|---|
| the connector guard, the scope registry, the refusal vocabulary, the reserved tool's schema, the `pmi-studio` server | `EPIC-043` | delivered |
| `speckit.pmi.finish` calling `pmi.tasks.sync` with `{ executionId, tasksMarkdown }`; `speckit.pmi.progress` and `tickedTasks`; `runFinish` and `runProgress`; the offline postures | `EPIC-042` | delivered; **unchanged here** |
| Epics, `bindExecutions`, the board's unbound group, the Epic detail and the Spec Journey Board | `EPIC-044` | delivered |
| the manifest shape, the derived idempotency key, `isUniqueViolation`, the `tasks.md` artifact version this Epic's digest is cross-checked against, the `AgentsModule`-for-the-guard lesson | `EPIC-045` | delivered |
| execution records, input bindings, agent identity snapshots, `ExecutionCommentService` with the `system` type, the `progress-reported` and `status-transition-proposed` vocabulary | `EPIC-037` | delivered |
| the verdict vocabulary and the proposal rules (**rules reused, interface not widened** — `R-046-5`) | `EPIC-030` | delivered |
| the `Task` entity, `PrismaTaskStore` (wired by `EPIC-041` `T1325`) and the project progress aggregate | `EPIC-012`, `EPIC-041` | delivered; widened here |
| a generic `(targetType, targetId, status)` adjudication proposal | `EPIC-030` | **follow-up**, recorded in `R-046-5`; not needed to deliver this Epic |

### Parallel Example: Phase 2

```text
T1696 · T1698 · T1700 · T1702 · T1703 · T1705 · T1708 · T1711 · T1774 · T1776   (ten failing tests, different files)
then T1697 → T1699 → T1701 → T1704 → T1706 → T1707 → T1709 → T1710 → T1775 → T1777 → T1778
```

### Parallel Example: Phase 6

```text
T1738 · T1739 · T1741 · T1743 · T1745 · T1747   (six failing tests, different files)
then T1740 → T1742 → T1744 → T1746 → T1748
```

## Implementation Strategy

1. **Cut the branch**, then **Phases 1–2** and commit after `T1711`: the real hook's task sync
   succeeds against the composed application, the concurrent and replayed cases are green, and
   `pmi.tasks.sync` is live — the one proof that must come before any screen.
2. **US1** (Phase 3) and stop to demonstrate a stakeholder reading an Epic's tasks, including the
   lines the parse refused. This is the MVP: a board that is honest before it is clever.
3. **US2** (Phase 4) — the moment the product moves by itself. **US3**'s backend half (Phase 5) can
   run alongside it, since it touches a different service.
4. **US4** (Phase 6), then **US5** (Phase 7), in that order: the supersession case needs something to
   supersede.
5. **Polish and closure.** The `M4` transcript is the last thing written, because it is the only
   thing here that a person, not a test, will read first.

## Phase 9: Convergence

> **Appended 2026-09-06 by `/speckit-converge`.** Seven findings from assessing the code against
> `spec.md`, `plan.md` and `tasks.md`. No existing task was renumbered, reordered or rewritten, and
> nothing above this line was touched. `T1767` and `T1770` are already tracked in Phase Z and are
> **not** repeated here — convergence appends work that no task yet covers.
>
> No constitution violation was found: 15 principles checked against the module, the migration and
> the screens.

- [X] T1780 [US3] Serve `GET /v1/projects/:projectId/progress` from the ONE derivation — make `backend/src/modules/tasks/tasks.service.ts` `progressForProject` delegate to `TaskProgressService.forProject` through a port rather than counting `listForSpecifications` itself, add the `blocked` bucket to `ProjectProgress`, and extend `backend/tests/unit/tasks/tasks.service.spec.ts` so a project whose figures differ between `/tasks` and `/plan` fails, per `FR-KAN-056`, `SC-KAN-009` and the plan's `tasks.service.ts` touch-point (contradicts)
- [X] T1781 [US3] Wire `LegacyTaskSource` into the `TaskProgressService` factory in `backend/src/modules/task-sync/task-sync.module.ts` — the port is declared in `task-progress.port.ts` and the factory's own comment says it is not connected, so a project holding `EPIC-012` tasks with no Epic reads them as absent from its percentage, per `FR-KAN-057` (partial) (unit test: `backend/tests/unit/task-sync/task-progress.spec.ts`)
- [X] T1782 [US4] Show a task's outstanding proposal ON THE CARD in `frontend/src/pages/TaskBoard.tsx` — the requested status, the requester, the reason and the time for one awaiting approval, and the verdict with its stage for one refused or inconsistent — reading `GET /v1/tasks/:taskId/status-proposals`, which exists and no screen calls; today the verdict is stated only inside `TaskMoveDialog.tsx` and vanishes when it closes, per `FR-KAN-014`, `FR-KAN-015` and `contracts/tasks-api.md` §4 (partial) (unit tests: `backend/tests/unit/task-sync/proposal-state.spec.ts`, `backend/tests/unit/task-sync/task-proposal-record.spec.ts`, `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1783 [P] [US1] Add the task→Epic traceability edge in `backend/src/modules/traceability/link-writer.service.ts` — `epic` is not in `TRACE_ARTIFACT_TYPES` and no `{ sourceType: 'task', targetType: 'epic' }` pair exists, so a synced task whose Epic has no specification resolves back to nothing, per the plan's `link-writer.service.ts` touch-point (*task→specification when one exists; task→Epic otherwise*) (missing) (unit tests: `backend/tests/unit/traceability/task-to-epic.spec.ts`, `backend/tests/unit/traceability/link-constraints.spec.ts`)
- [X] T1784 [P] [US1] Link the Epic detail to its board in `frontend/src/pages/EpicDetail.tsx` — the board is reachable from the Spec Journey Board's card and from the Plan & Tasks landing, and from the Epic itself it is not, per `FR-KAN-050` (partial) (unit test: `frontend/tests/unit/pages/epic-detail.spec.tsx`)
- [X] T1785 [P] [US5] Add an *ahead of the file* filter to `frontend/src/pages/TaskBoard.tsx` beside the two it has — free text, parallel-safe and not-in-latest-parse are filterable and the fourth named axis is not, per `FR-KAN-053` (partial) (unit test: `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1786 [P] [US1] State the PARTIAL state in words in `frontend/src/pages/TaskBoard.tsx` — when the disagreements read fails the section silently disappears and the reader is told nothing, so three of the four states of `FR-SHL-060` are stated and the fourth is only handled, per `FR-KAN-059` (partial) (unit test: `frontend/tests/unit/pages/task-board.spec.tsx`)

## Phase 10: Convergence

> **Appended 2026-09-06 by the second convergence pass.** Five findings, all from reading the
> **contract documents** against the screens — which is where the first pass was thinnest: it
> checked that requirements were *referenced* and that services existed, and did not walk
> `contracts/board-contract.md` §3–§7 clause by clause against `TaskBoard.tsx`. Four of the five
> are things that document already specifies and no code does.
>
> No existing task was renumbered, reordered or rewritten. `T1767` and `T1770` remain tracked in
> Phase Z and are not repeated. No constitution violation was found: 15 principles checked.

- [X] T1787 [US3] Show the Epic's progress ON THE BOARD in `frontend/src/pages/TaskBoard.tsx` — total, done, in progress, not started, blocked and a whole-number percentage, read through `getEpicTaskProgress` and stating the *not in the latest parse* exclusion; today the board shows no percentage at all and `contracts/board-contract.md` §5 names it as one of the three surfaces that must, per `FR-KAN-055`, `FR-KAN-058` and `SC-KAN-009` (missing) (unit test: `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1788 [US5] State the supersession on the card in `backend/src/modules/task-sync/task-board.service.ts` and `frontend/src/pages/TaskBoard.tsx` — when the file supersedes an applied proposal the task must say so, **naming the proposal, the verdict and the superseding digest**; the marker is computed in `task-reconcile.ts` and stored on the manifest line, and no card, board read or screen surfaces it, so the *superseded by the file* marker `contracts/board-contract.md` §3 lists is rendered nowhere, per `FR-KAN-022` (partial) (unit tests: `backend/tests/unit/task-sync/supersession.spec.ts`, `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1789 [US4] Render the board read-only for a member without the move permission in `frontend/src/pages/TaskBoard.tsx`, carrying the permission on the board read from `backend/src/modules/task-sync/task-board.controller.ts` — the status control is shown to everyone and a member without the permission learns so only after submitting a proposal and reading a `refused` verdict, where `contracts/board-contract.md` §4 and the spec's own edge case require **no move control at all** and the reason stated, per `FR-KAN-018` and `BR-0003` (partial) (unit tests: `backend/tests/unit/task-sync/move-permission.spec.ts`, `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1790 [P] [US4] Add native HTML5 drag onto a column in `frontend/src/pages/TaskBoard.tsx` as the enhancement beside the keyboard-operable status control, opening the same dialog — `contracts/board-contract.md` §4 specifies **two affordances, one path** and only the control exists; no package is added, which is what `R-046-10` forbade (missing) (unit test: `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1791 [P] [US1] Show *no path named* on a card whose description names no repository path in `frontend/src/pages/TaskBoard.tsx` — an empty `sourcePaths` renders nothing at all, and `contracts/board-contract.md` §3 names the empty rendering explicitly so a reader can tell *no paths* from *not shown*, per `FR-KAN-054` (partial) (unit test: `frontend/tests/unit/pages/task-board.spec.tsx`)

## Phase 11: Convergence

> **Appended 2026-09-06 by the third convergence pass.** Three findings, from walking
> `contracts/tasks-api.md` §1–§2, `data-model.md` §12's eight invariants, `quickstart.md`'s
> twenty-five scenarios and the five user stories' acceptance scenarios — the artifacts the
> first two passes did not read clause by clause. The board contract, walked in Phase 10, yielded
> nothing new.
>
> No existing task was renumbered, reordered or rewritten. `T1767` and `T1770` remain tracked in
> Phase Z. No constitution violation was found: 15 principles checked.

- [X] T1792 [US4] Add the second-person adjudication route in `backend/src/modules/task-sync/task-board.controller.ts` and `backend/src/modules/task-sync/task-proposal.service.ts`, and the control on the card in `frontend/src/pages/TaskBoard.tsx` — `approval_required` is today a **terminal** verdict with no path onward, so a project that sets `projects.taskMoveRequiresApproval` does not gate a move, it **freezes the card permanently**; the approver must be someone other than the proposer (Constitution XII.6 generalised) and the second verdict is an event like the first, per `US4` scenario 3 (*moves only when a second person's verdict applies it*), `quickstart.md` scenario 9, `FR-KAN-013` and `FR-KAN-014` (missing) (unit tests: `backend/tests/unit/task-sync/second-person.spec.ts`, `frontend/tests/unit/pages/task-board.spec.tsx`)
- [X] T1793 [US1] Surface the unbound task syncs in `backend/src/modules/task-sync/task-board.controller.ts` and `frontend/src/pages/JourneyBoard.tsx` beside `EPIC-045`'s unbound artifacts group — `TaskSyncStore.unboundSyncs` exists on both stores and **no production code calls it**, so an execution bound to no Epic stores its tasks correctly (`T1711` proves it) and they are listed on no screen, per `quickstart.md` scenario 18 (*tasks stored unbound and listed with the board's unbound group*) and `FR-KAN-032` (missing) (unit tests: `backend/tests/unit/task-sync/unbound-tasks.spec.ts`, `frontend/tests/unit/pages/journey-board.spec.tsx`)
- [X] T1794 [P] **Justified, not removed** — `findProposal` on `TaskSyncStore` in `backend/src/modules/task-sync/task-sync.store.ts` and `backend/src/modules/task-sync/task-sync.store.prisma.ts` — it was referenced by no production code and by no test; `T1792`, implemented in the same pass, needed exactly that read, so the finding resolved by the method acquiring a caller rather than by deletion, and a test now pins that caller; `findSync` and `findTaskByKey` are used by tests and stay, per the store interface this Epic introduced (unrequested) (unit test: `backend/tests/unit/task-sync/task-sync.store.spec.ts`)

## Phase 12: Convergence

> **Appended 2026-09-06 while attempting `T1767`.** One finding, and it is not a gap in this Epic's
> code — it is the reason `T1767` had never been runnable, and it predates this Epic by four.

- [X] T1795 Make the Playwright harnesses collectable in `e2e/package.json` (`"type": "module"`) and derive `REPO` the ESM way in `e2e/tests/epic-042-m2.spec.ts`, `epic-043-m1.spec.ts`, `epic-044-m3.spec.ts`, `epic-045-m3.spec.ts` and `epic-046-m4.spec.ts` — every harness importing `@pmi/workspace-bundle` failed to collect with *exports is not defined*, because Playwright compiled these ESM specs as CommonJS while the package resolves to raw ESM TypeScript; **zero** of the four milestone transcripts from `M2` onward could ever have been produced, per `R-046-12` (Tier 2 through the shipped hooks) and `T1767` (missing) (verified: `npx playwright test --list` reports 19 tests in 7 files, up from 0 in the four affected harnesses; all five typecheck)
