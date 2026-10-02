# Phase 0 — Research: Task Kanban with Governed Auto-Status

**Epic**: `EPIC-046` · **Date**: 2026-09-06 · **Spec**: [spec.md](./spec.md) (clarified 2026-09-06)

Thirteen decisions. Each states what was chosen, why, what lost, and which documentation was
consulted. No `NEEDS CLARIFICATION` remains: the five open questions were put to the requester on
2026-09-06 and all five recommendations accepted.

**Current-docs discipline**: this Epic adds **no new external runtime dependency** (`R-046-10`), so
no Context7 lookup was required for a new package. The pinned dependencies it builds on — NestJS 10,
Prisma 5.22, React 18, Vitest 2.1 — were resolved against current docs when they were adopted
(`D-03`, `D-04`, `D-05` in `specs/_shared/dependencies.md`) and are unchanged here; re-resolving them
would record nothing new. Each decision below therefore records **Docs consulted: none needed — no
new external dependency**, except where an internal contract document was the authority.

---

## R-046-1 — The grammar is the platform's, stated once, driven by configuration

**Decision.** The `tasks.md` grammar lives in the backend as one module,
`backend/src/modules/task-sync/task-grammar.ts`, exported as a pure function
`parseTasks(markdown, config)`. The identifier pattern, the accepted checkbox forms, the parallel
marker and the maximum description length come from configuration with stated defaults
(`^T\d+$`, `[ ]` / `[x]` / `[X]`, `[P]`, 500 characters). A line is *considered* only if it matches
the task-list-item opener `^- \[..\] `; everything else in the file is ignored and **not** reported.
A considered line that then fails the grammar is a **refused line** with a code.

**Rationale.** `packages/workspace-bundle/src/hook-sequences.ts` already says this in a comment on
`tickedTasks`: *"The identifier's SHAPE is the platform's policy (its governance configuration), not
the harness's — so no pattern for it is written here."* The harness was built to leave this decision
here, and `FR-KAN-002` requires it be configuration rather than a code path. Keeping it in the
platform also means a policy change is a deployment, not a re-provisioning of every workstation.

**The consequence, stated deliberately.** The hook's `tickedTasks` takes *the first token after a
ticked checkbox* and is deliberately more permissive than the platform's pattern. So a hook can emit
`progress-reported { taskId: 'foo' }` for a token this grammar rejects. That is not a defect: it is
exactly `FR-KAN-042`'s **unmatched progress report**, and the two rules meet without either side
needing to know the other's.

**Alternatives considered.** Put the grammar in `@pmi/workspace-bundle` so hook and platform share
one function — rejected, because the bundle's own comment declines the responsibility, and because a
grammar change would then require every provisioned directory to be re-provisioned before the board
agreed with the platform. Accept any token as an identifier — rejected: `FR-KAN-003` requires a
malformed line be *reported*, which is impossible if nothing is malformed.

**Docs consulted**: `governance/document-structure.md` `DS-1`, `DS-2`;
`packages/workspace-bundle/src/hook-sequences.ts` (`tickedTasks`). None needed externally.

---

## R-046-2 — One task entity, widened; not a second table

**Decision.** Extend the existing `tasks` table rather than introduce a parallel entity:
`+ epicId` (nullable FK), `+ taskKey` (the identifier from the file), `+ sourceLine`,
`+ sourceDigest`, `+ parallel`, `+ presentInLatestParse`, `+ statusSource`,
`+ lastParsedExecutionId`, `+ lastMovedAt`; `specificationId` becomes **nullable**; `TaskStatus`
gains `blocked`. Unique index `(epicId, taskKey)`.

**Rationale.** `Q1`, answered 2026-09-06: a synced task's home is its Epic and its link to a
specification is optional. One entity keeps the progress aggregation, the Rooms and the traceability
graph working on the rows the board shows, which is `PP-002` and `BR-0050`. PMI-DOC-007 §3 asks for
`epicId`, `sourceLine` and `sourceDigest` and asks for nothing else; the other columns are the
minimum the reconciliation rule needs to be a function rather than a guess.

**What widening costs, recorded.** `specificationId` is read in five places
(`tasks.service.ts`, `generate-tasks.service.ts`, `task-regeneration.service.ts`,
`tasks.store.prisma.ts`, the traceability link writer). Each must tolerate its absence, and the
architecture test that asserts task→specification traceability must state that the edge is written
**when a specification exists** — a synced task with no specification traces to its Epic instead.
That is the risk Assumption 6 records as accepted.

**Alternatives considered.** A parallel `synced_tasks` table — rejected: two meanings of *task* is
the drift the replan exists to remove, and every consumer would be written twice. A placeholder
`Specification` created on first task sync — rejected in the clarification round: it puts an empty
row in the specification list, which is a lie the specification list has no way to caveat.

**Docs consulted**: `backend/prisma/schema.prisma` (`Task`, `TaskStatus`, `Epic`);
`specs/_shared/platform-spec.md` `FR-020`, `FR-022`. None needed externally.

---

## R-046-3 — The sync record is a manifest, in EPIC-045's shape

**Decision.** Two tables: `task_syncs` (one row per sync — execution, project, epic, actor,
idempotency key, the `tasks.md` digest, the six counts, `outOfBandEdit`) and `task_sync_lines` (the
manifest — one row per *considered* line: line number, raw text, outcome
`parsed | refused | duplicate`, refusal code, `taskKey`, `changeKind`, `previousStatus`,
`newStatus`). The diff `FR-KAN-037` returns is rendered from the manifest at sync time and is
recoverable from it afterwards.

**Rationale.** `EPIC-045` proved this shape: content in one place, *what a given execution saw* in a
manifest beside it. It answers `FR-KAN-034` when nothing changed, which a diff computed later from
row state cannot — by then the rows have moved on. Storing the manifest is not storing a
redundant diff: the manifest is the observation, the diff is its summary.

**Alternatives considered.** Store the diff as a JSON blob — rejected: a blob and the rows can
disagree and nothing detects it. Recompute the diff on read — rejected: impossible once a later
sync or a proposal has changed the row.

**Docs consulted**: `specs/045-artifact-sync-markdown-viewer/data-model.md` §2, §3. None needed
externally.

---

## R-046-4 — Reconciliation is one pure function with a truth table

**Decision.** `reconcile(previous, parsed)` in `task-reconcile.ts` — no I/O, no clock, no store —
returns the new status, its source and any marker. It is the whole of `FR-KAN-020` to `FR-KAN-027`
and is tested as a table before anything calls it.

| Line in latest parse | Previous status | Previous source | → status | Marker |
|---|---|---|---|---|
| checked | any | any | `done` | `supersededByFile` when the previous status was `in_progress` or `blocked` from a proposal |
| unchecked | `done` | `parse` or `event` | `not_started` | — |
| unchecked | `done` | `proposal` | `not_started` | `supersededByFile` |
| unchecked | `in_progress` / `blocked` | `proposal` | unchanged | `aheadOfFile` |
| unchecked | `in_progress` / `blocked` | `parse` / `event` | `not_started` | *(unreachable by `FR-KAN-041`; asserted, not assumed)* |
| unchecked | `not_started` | any | `not_started` | — |
| absent from parse | any | any | unchanged | `notInLatestParse` |

**Rationale.** PMI-DOC-007 §10 says of this Epic: *"parser is small; the rules are the work."* A
truth table is the only form in which the rules can be reviewed by a person and mutated by a test.
`FR-KAN-021` fixes the direction — the file wins for the two states a checkbox can express — and
`FR-KAN-022` fixes what must survive: no proposal record is deleted or amended when the file
supersedes it.

**Alternatives considered.** Last-write-wins across both sides — rejected in the spec (Assumption 4):
it makes the board authoritative for a field PMI-DOC-007 §2.3 says it mirrors. Resolve conflicts by
prompting — rejected: `R-05` says conflicts are surfaced, never auto-resolved, and a prompt is a
resolution with extra steps.

**Docs consulted**: PMI-DOC-007 §2.3, §11 `R-05`. None needed externally.

---

## R-046-5 — Task proposals reuse EPIC-030's rules, not its specification-typed adjudicator

**Decision.** A `task_status_proposals` table and a `TaskProposalService` in this Epic's module.
It **imports** `@pmi/loop-contract`'s verdict vocabulary (`AdjudicationVerdict`, the refusal stages,
the verdict → state mapping) and reproduces `EPIC-037`'s proposal rules exactly: the proposal row is
the immutable *request* with **no verdict column** (`R-037-5`), the verdict is an event plus a
projection, `expectedCurrentStatus` gives optimistic concurrency, the proposer's identity is frozen
at proposal time. It does **not** call `PROPOSAL_ADJUDICATOR`.

**Rationale.** `AdjudicationProposal` in `packages/loop-contract/src/adjudication.ts` is hard-typed
to `specificationId` and `SpecificationStatus`. A task move is neither. Widening that interface is a
change to `EPIC-030`'s published contract and to every consumer of it, and assembling an adjudicator
over `EPIC-030`'s individual ports is precisely the bypass `FR-GEL-073` forbids — those ports are
deliberately unexported by `LoopModule`.

**How `FR-KAN-013` is satisfied, stated plainly.** The requirement says a proposal must be
adjudicated *through the existing adjudication contract*. This plan reads *contract* as its **rules
and vocabulary** — the verdict set, the separation-of-duties rule, the immutable-evidence rule, the
optimistic-concurrency rule — and not as its specification-typed TypeScript interface. This reading
is recorded here so `/speckit-analyze` can rule on it rather than discover it.

**Alternatives considered.** Widen `AdjudicationProposal` to a generic `(targetType, targetId,
status)` — the right long-term shape, but it is `EPIC-030`'s change to make and would put this
Epic's schedule behind a cross-Epic refactor of a `NON-NEGOTIABLE` governance seam. Recorded as the
follow-up. Map a task move onto a specification-lifecycle proposal — rejected: it lies to the
lifecycle machine about what is transitioning.

**Docs consulted**: `packages/loop-contract/src/adjudication.ts`;
`backend/src/modules/executions/status-proposal.service.ts`;
`specs/030-governed-engineering-loop/spec.md` `FR-GEL-063`–`FR-GEL-073`. None needed externally.

---

## R-046-6 — A permitted member's own move applies at once; policy may require an approver

**Decision.** The task adjudicator returns `applied` when the mover holds the project's move
permission and no policy requires approval; `approval_required` when
`projects.taskMoveRequiresApproval` is set; `inconsistent` when `expectedCurrentStatus` no longer
holds; `refused` when the principal lacks permission, or when an **agent** principal would be
approving its own proposal. One nullable boolean column on `projects`, defaulting to `false`.

**Rationale.** `Q4`, answered 2026-09-06. Constitution XII.6 forbids **AI** self-approval; it does
not require a second human for every card, and requiring one would make *"I have started this"* a
two-person ceremony. The proposal, its required reason and its verdict are recorded either way, so
the audit trail is identical — only the waiting differs. The policy column keeps the stricter
posture available as configuration (`PP-014`) rather than as a fork.

**Alternatives considered.** Always require a second person — rejected in the clarification round.
Never allow a policy to require one — rejected: it removes a control some projects will need and
cannot be added later without another migration.

**Docs consulted**: `.specify/memory/constitution.md` XII.6. None needed externally.

---

## R-046-7 — The board and progress are projections; one derivation serves every surface

**Decision.** `TaskBoardService` computes columns, card metadata, markers and the open-disagreement
list from rows and the latest manifest. Progress is derived on read by **extending
`TasksService.progressForProject`** — the same function gains a blocked count and an Epic-scoped
entry point — rather than adding a second aggregate beside it.

**Rationale.** `FR-KAN-056` requires every surface to show the same value from the same derivation;
the only way to hold that is to have one derivation. `EPIC-012`'s aggregate already exists, is
tested, and is what the project surfaces read; a second one would be `R-06`'s two-boards problem in
miniature.

**Alternatives considered.** A materialised `percentComplete` column refreshed on write — rejected by
`FR-KAN-056` and by `BR-0013` (health derived, not declared). A separate board aggregate —
rejected: two numbers that must agree and no mechanism making them.

**Docs consulted**: `backend/src/modules/tasks/tasks.service.ts`. None needed externally.

---

## R-046-8 — The tool goes live with the hook unchanged; the idempotency key is derived

**Decision.** `pmi.tasks.sync` moves from `RESERVED_TOOLS` to a live tool in
`packages/mcp-server/src/tools/tasks.ts`, accepting exactly what `runFinish` already sends —
`{ executionId, tasksMarkdown }`, with no idempotency key — and the platform derives
`tasks-sync:<executionId>:<sha256(tasksMarkdown)>`, unique on `(workspaceId, idempotencyKey)`.

**Rationale.** `FR-KAN-061`: the hook must not be edited, which is what reserving the tool was for.
`hook-sequences.ts` line 375 sends two arguments and no key, so the key must be derived or
idempotence is unreachable — the same reasoning and the same shape as `EPIC-045`'s `R-045-8`.
Deriving from the digest also makes a replay of an unchanged file return the stored answer, which is
`FR-KAN-026`.

**Alternatives considered.** Ask `EPIC-042` to send a key — rejected: it edits the hook. Key on the
execution alone — rejected: `implement` syncs the same execution twice with different content
(before and after), and both must be recorded.

**Docs consulted**: `packages/workspace-bundle/src/hook-sequences.ts` (`runFinish`);
`specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` §3. None needed externally.

---

## R-046-9 — Limits and the grammar are environment configuration with stated defaults

**Decision.** `PMI_TASKS_MAX_BYTES` (default 1 MiB), `PMI_TASKS_MAX_LINES` (default 1000),
`PMI_TASK_ID_PATTERN` (default `^T\d+$`), `PMI_TASK_DESCRIPTION_MAX` (default 500). Documented in the
root `.env.example`, `README.md` §Setup and `docs/operator-setup.md` — all three, held by one
conformance check.

**A limit already in place, checked rather than assumed.** `DEF-045-001` established
`PMI_ARTIFACT_SYNC_BODY_BYTES` (default 16 MiB) as the JSON body limit for the whole application. A
1 MiB `tasks.md` arrives well inside it, so no new body limit is needed — but the plan records the
check rather than leaving the next reader to rediscover the defect.

**Alternatives considered.** Hard-coded constants — rejected by `FR-KAN-002` and `PP-014`. A
per-project limit in the database — rejected as scope: no requirement asks for it, and an
environment variable is reversible.

**Docs consulted**: `specs/045-artifact-sync-markdown-viewer/closure.md` (`DEF-045-001`);
`backend/src/core/http-body.ts`. None needed externally.

---

## R-046-10 — No new runtime dependency; moves are accessible controls, not a drag library

**Decision.** The board ships with **no new package**. A card carries an explicit status control
(a labelled menu) and the columns accept native HTML5 drag events as an enhancement; both paths open
the same reason-required dialog and call the same route. `specs/_shared/dependencies.md` gains **no
new `D-` entry**, and the plan records that absence deliberately so a later reader does not assume
one was forgotten.

**Rationale.** A drag-and-drop library is the largest dependency this Epic could plausibly take, and
it would buy pointer ergonomics for a surface whose governing requirement is that every move opens a
dialog anyway (`FR-KAN-011`, a required reason). `BR-0193` and `FR-SHL-050`–`FR-SHL-053` require the
board be operable without a pointer, which a drag-only affordance cannot satisfy — so the accessible
control has to exist regardless, and once it exists the library is decoration.

**Alternatives considered.** `dnd-kit` or `react-beautiful-dnd` — rejected on the above; if the
requester later asks for pointer-first ergonomics it is an additive plan change with a `D-` entry,
not a rewrite. Hand-rolled pointer-event dragging — rejected: more code than the library, for the
same non-essential gain.

**Docs consulted**: none needed — no new external dependency (Context7 not required; the absence is
the decision).

---

## R-046-11 — Plan & Tasks finally gets an address

**Decision.** This Epic delivers the landing view for the `plan-and-tasks` area:
`/plan` (the project's Epics with their boards' summaries) and `/plan/epics/:epicId` (one Epic's
Kanban). `frontend/src/shell/areas.ts` moves the row from `declared-not-delivered` to delivered and
drops its note.

**Rationale.** `areas.ts` carries a standing debt written at `EPIC-036`'s analysis (`N1`,
2026-08-24): *"Tasks are reached through a specification. A project-level plan view is not built
yet,"* with the fix assigned to `EPIC-012` as `T441p`. PMI-DOC-007 §6 puts the Task Kanban in exactly
this area, so `EPIC-046` discharges the debt as a side effect of its own requirement rather than
leaving a second landing view to be built later.

**Recorded for `/speckit-analyze`.** `EPIC-012`'s `T441p` is **superseded** by this Epic, not
abandoned. The existing `/specifications/:id/tasks` view stays, unchanged, as the specification-scoped
list; it is a second view over the same rows, and `FR-KAN-017` is what keeps their write rules apart.

**Docs consulted**: `frontend/src/shell/areas.ts`; `frontend/src/shell/routes.tsx`;
PMI-DOC-006 §4.1. None needed externally.

---

## R-046-12 — Evidence: Tier 1 through the real hook, concurrency first; Tier 2 the M4 transcript

**Decision.** **Tier 1** drives the sync through the shipped `runFinish` sequence against a real
`pmi-studio` server (in-memory MCP transport) and the composed `AppModule`, and drives movement
through the shipped `runProgress` sequence — so the events the board reads are the events the hook
actually sends. The concurrent and replayed syncs are written **before** the service exists.
**Tier 2** is the `M4` transcript: a run that ticks five tasks, with the board observed reaching
five *Done* and the percentage rising, no manual move (`SC-KAN-003`).

**Rationale.** Constitution XI, and `EPIC-045`'s two branch defects. `DEF-045-002` was a race in a
step ordering that every non-concurrent test passed; writing the concurrent case first is the only
thing that catches it. Driving the real hook is what proved `FR-ART-046` and is what will prove
`FR-KAN-061` here.

**Alternatives considered.** Assert the tool's shape against a fixture client — rejected: it proves
the platform accepts what the *test* sends, not what the hook sends.

**Docs consulted**: `.specify/memory/constitution.md` XI;
`specs/045-artifact-sync-markdown-viewer/closure.md`. None needed externally.

---

## R-046-13 — The checks this Epic breaks, and the repairs it owes them

**Decision.** Making `pmi.tasks.sync` live and registering a fifteenth connector scope breaks six
existing assertions, each correctly. The repairs are planned as tasks, not discovered at implement
time:

| Check | What it asserts today | Repair |
|---|---|---|
| `backend/tests/architecture/connector-boundary.spec.ts` | *exactly the fourteen connector scopes of record* | Fifteen — EPIC-041 one, EPIC-043 ten, EPIC-042 two, EPIC-045 one, EPIC-046 one |
| `backend/tests/unit/connector/connector-scopes.spec.ts` | the same count | Same |
| `backend/tests/unit/connector/connector-auth.guard.spec.ts` | uses `tasks.sync` as its example of an **unregistered** scope | The example must move again — and **no reserved-but-unregistered scope remains**, so it becomes a synthetic name that will never be registered, with a comment saying why |
| `backend/tests/contract/mcp-tool-surface.spec.ts` | reserved rows are `['pmi.execution.sync', 'pmi.tasks.sync']` | One row: `pmi.execution.sync` |
| `packages/mcp-server/tests/artifacts-tool.spec.ts` | `RESERVED_SPECS` holds the same two | One |
| `backend/tests/integration/connector-reads.spec.ts` · `governance-api.spec.ts` | call `pmi.tasks.sync` to observe a reserved refusal | Call `pmi.execution.sync` — the last reserved tool |

**Rationale.** `EPIC-045`'s closure records that its own first full run failed three whole-project
checks for exactly this reason, and that each was right to. Planning the repairs converts a
mid-implement surprise into six ordinary tasks.

**Also owed**: `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` §3 gains a dated
note — `pmi.tasks.sync` live as of `EPIC-046`, **one** reserved tool remains, tool surface unchanged
at fifteen, hook unedited — matching the note `EPIC-045` added for `pmi.artifacts.sync`.

**Docs consulted**: the six test files named above;
`specs/045-artifact-sync-markdown-viewer/closure.md` §*Repairs this Epic made to checks it broke*.
None needed externally.
