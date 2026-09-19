# EPIC-046 — Task Kanban with Governed Auto-Status: Epic closing report

**Task**: `T1765`–`T1771` (this record; the Tier 2 run `T1767` and the converge-and-promote pass
`T1770` are **not** performed — see *Work not done*) · **Session**: 2026-09-06 · **Constitution IX**

**Status**: `Implemented` — 108 of 110 tasks complete; **two open, each named below with its reason**.
Every implementation task carries a unit test, contract test, integration test, architecture test or
conformance check observed failing before its implementation and passing after (Constitution V).

Fifteen of those tasks came from **three convergence passes** — `T1780`–`T1786` (Phase 9),
`T1787`–`T1791` (Phase 10) and `T1792`–`T1794` (Phase 11) — all appended after the first closing
report and implemented in the same session. What they found is in *Found on the way* below,
including **one claim this report made and had to withdraw**, **one permission that was never
actually being checked**, and **one verdict with no successor**.

## What the Epic delivered — milestone M4

Since `EPIC-042` the finish hook of every governed `tasks` and `implement` run has called
`pmi.tasks.sync` and the platform has answered *not available until EPIC-046*. This Epic makes the
tool **live**, gives the parsed tasks a home, a board and a percentage, and gates every manual move
behind an adjudicated proposal that writes no file — **without editing the hook**, which is what
reserving the tool was for.

| Phase | Tasks | What it established |
|---|---|---|
| 1 Setup | `T1686`–`T1695` | Three tables, one project column and one widening (`tasks`, plus `blocked` on `TaskStatus`), all additive; the store whose partial unique index on `(epicId, taskKey)` is the arbiter; the fifteenth connector scope |
| 2 Foundational | `T1696`–`T1711`, `T1774`–`T1778` | The pure grammar and the pure reconciliation function; nine refusal codes; the sync service step by step; the connector route behind `EPIC-043`'s guard; `pmi.tasks.sync` live, `RESERVED_TOOLS` down to one; the audit port over all four actions of data-model §11 |
| 3 US1 | `T1712`–`T1722` | The board projection — four columns, the latest-parse header, the counts identity, the refused lines; the session routes; the screen |
| 4 US2 | `T1723`–`T1729`, `T1772`, `T1773` | Movement from `progress-reported` events, replay-safe by construction; unmatched reports listed and never invented; the staleness note when the parse is behind the Epic's latest run |
| 5 US3 | `T1730`–`T1737` | The one progress derivation, `presentInLatestParse = false` excluded from the denominator; the Epic and project figures; Plan & Tasks promoted to delivered and the `EPIC-036` counts cascaded |
| 6 US4 | `T1738`–`T1748` | The proposal: six verdicts, an immutable row, an agent that may propose and never approve (Constitution XII.6), `EPIC-012`'s direct edit refused for a synced task |
| 7 US5 | `T1749`–`T1756` | Disagreement surfaced rather than resolved: ahead-of-file, not-in-latest-parse, unmatched progress, refused lines, the out-of-band edit and the digest cross-check |
| 8 Polish | `T1757`–`T1764` | The `M4` harness (authored); the hook proved unedited against the live shape; README §Setup, the operator guide and `.env.example`; the tool-surface note; the layout records |
| Z Closure | `T1765`, `T1766`, `T1768`, `T1769`, `T1771` | This report, the counts, the inversion, the mutation observations, the Constitution XII record, the records |
| 9 Convergence | `T1780`–`T1786` | Seven gaps `/speckit-converge` found and this pass closed — one derivation for progress, the legacy source wired, the outstanding proposal on the card, the task→Epic traceability edge, the board reachable from the Epic, the fourth filter, the partial state stated |
| 10 Convergence | `T1787`–`T1791` | Five more, all from walking the contract documents clause by clause against the screens — progress on the board, the supersession statement, read-only without the move permission, native drag, *no path named* |
| 11 Convergence | `T1792`–`T1794` | Three, from the quickstart scenarios and the acceptance criteria — the second person's verdict, the unbound task syncs, and one dead read that a higher-priority task gave a purpose |
| 12 Convergence | `T1795` | The Playwright harnesses made collectable — found while attempting `T1767`, and four Epics old |

## What it deliberately did not do

- **Nothing writes to the project directory** (`FR-KAN-010`, `SC-KAN-004`). No route, tool or screen
  edits `tasks.md`; `tasks-api.spec.ts` reads **every file** in the module and refuses `node:fs`,
  `writeFile`, `appendFile`, `mkdir`, `rmSync` and `unlink` in any of them, and
  `task-proposal.spec.ts` byte-compares every file under the Epic's directory across a board session
  that includes a proposal. The directory scan replaced a three-file list that a mutation walked
  straight past — see §The mutation observations, #4.
- **No task row is ever deleted by a sync** (`FR-KAN-025`). A task the latest parse no longer
  contains is kept, marked, and excluded from the denominator.
- **A disagreement is surfaced, never resolved quietly** (`FR-KAN-020`). The file wins the moment it
  speaks; the proposal record survives unamended, which is the whole point — a board that reconciled
  by deleting the losing record would look tidier and would have destroyed the only evidence that a
  person ever said something different.
- **No drag-and-drop package was added** (`R-046-10`). `specs/_shared/dependencies.md` gained no
  entry and `frontend/package.json` carries none.
- **The hook is unchanged** (`FR-KAN-061`). `T1758` asserts it: the arguments are still
  `{ executionId, tasksMarkdown }`, the digests still travel on the completion, and the finish
  sequence prints **no** new line, because the prompt specifies none.

## One deliberate divergence from the spec's wording

`spec.md` §Edge Cases reads a wrong bullet or wrong spacing (`* [ ]`, `-  [ ]`) as something to
**refuse**. The grammar **ignores** it instead, and `task-grammar.ts` says so in place.

The reason is the refusal vocabulary. All nine codes concern what comes *after* the checkbox —
the identifier, the description, a duplicate, a credential shape. A tenth code for *this line is
not a task line at all* would be a contract change (`FR-KAN-066` closes the vocabulary), and it
would refuse every prose bullet in every `tasks.md` ever written. A line that is not a task line is
not a task line that failed; it is prose. Recorded here rather than smoothed over, because the two
documents disagree and a reader deserves to know which one the code follows.

## Found on the way

| Finding | What was true | What is true now |
|---|---|---|
| The progress reconciliation ran **before** the sync row was written | An Epic's executions are found THROUGH `task_syncs`, so a reconciliation that ran first could not see the events of the very run performing it. The cards moved — but were attributed to `parse`, not to the `implement` events that reported them, which is a different and weaker claim | Step 8b runs after `recordSync`, with the ordering and its reason recorded in the code. Caught by `T1725`, which asserts *what moved it* and not only *where it ended up* |
| The credential redaction leaked through the answer | The manifest row redacted a credential-bearing line, and `SyncAnswer.refusedLines` still quoted it — and that answer travels over MCP into the agent's transcript | One `safeText(line)` helper, used by both paths. Caught by `T1711`, which is the test that exists to catch it |
| `TaskRecord.specificationId` had to widen to nullable | A task's home is its Epic (`Q1`), so a task synced before any `spec.md` has no specification. `EPIC-012`'s reader assumed one | Nullable, with one null branch in `listForSpecifications`. Exactly the cost `R-046-2` recorded as accepted |
| A generated Prisma client older than the schema | The schema changed in Phase 1, but only the typed-client path reads it; the raw-SQL store did not notice. It surfaced as a bare `500` with nothing logged | `npx prisma generate`. Recorded because the symptom names nothing and the cause is invisible |
| `T012a` — three tables without `createdAt` | The universal-columns rule applies to every table, and `syncedAt`/`proposedAt` are not it | All three carry `createdAt`, in the migration, the schema and the schema test, and are registered in `universal-columns.spec.ts` |
| `FR-ESK-025` — the grammar wrote the identifier shape itself | `/^T\d+$/` as a literal would have made this module the **seventh** site of a shape that is defined once | Composed from `@pmi/epic-stage`'s `loadStageConfig()`, overridable by `PMI_TASK_ID_PATTERN`. `task-id-format.spec.ts` caught it and was right to |
| `G-26-14` ×2 — a ticked task naming a path that does not exist | `T1708` and `T1739` each named a file whose content I had folded into a neighbour | The files exist. The rule is that a ticked task names a real path, not that the task text bends to what was built |
| `validation_failed` is `400`, not `422` | `FR-KAN-066` adds no top-level code, so a specific code rides in `details` | Corrected in the service and both tests |
| **This report claimed *one derivation, three surfaces* and it was two** (`/speckit-converge` `F1`) | `TasksService.progressForProject` still counted `listForSpecifications` itself, while `TaskProgressService` counted the Epics' rows. `/tasks` rendered one and `/plan` the other, so a project could show two different percentages and nothing said so. `task-progress.port.ts` had established the **direction** and the old aggregate was never redirected through it — the structural claim was written before it was true | `T1780`: `progressForProject` delegates through a required `ProjectProgressSource`, `ProjectProgress` gains `blocked`, and the port is required rather than optional — an optional port with a local fallback is the second derivation, agreeing in the unit suite and disagreeing in production |
| `LegacyTaskSource` was declared and never connected (`F2`) | `T1731`'s factory comment said so outright: *their absence understates nothing for a project whose tasks all came from a sync* — true, and not every project. A project holding `EPIC-012` tasks with no Epic read them as absent from its own percentage (`FR-KAN-057`) | `T1781`: `PrismaLegacyTaskReader` reads the specification-scoped rows that have no Epic, wired in the module. It reads the `tasks` table directly, as the four other readers in that file read `executions`, `epics`, `execution_events` and `artifact_syncs` — one-way, no cycle |
| A proposal awaiting approval was invisible the moment the dialog closed (`F3`) | The verdict was returned in one HTTP response and persisted **nowhere a projection could find it**. `data-model.md` §5 forbids a verdict column and §8 folds the state from the proposal's events — but no verdict event was ever appended, so no screen could have shown it however hard it tried. Most of `SC-KAN-005`'s user-facing half | `T1782`: adjudication appends the verdict as a second event in `EPIC-037`'s own vocabulary (`VERDICT_EVENTS`, keyed off `refusalEventFor`); `proposal-state.ts` folds the pair; the card states the requested status, the requester, the reason, the time and the verdict — in words and by name. `FR-KAN-012` is untouched: `status-transition-proposed` still carries no verdict |
| The plan's *task→Epic otherwise* was never built (`F4`) | `epic` was not a traceability artifact type at all, so a task parsed from an Epic whose `spec.md` had not synced resolved back to **nothing** — `SC-003` quietly failing for exactly the tasks this Epic introduced | `T1783`: `epic` joins `NON_CHAIN_ARTIFACT_TYPES` beside `change` and `defect` — in the type, out of the sequence, never a source; `linkTasksToEpic` writes the edge alongside any specification edge; the sync calls it and swallows failures, because a link is derived and the parse is the fact |
| The board was unreachable from the Epic (`F5`) | Reachable from the Journey Board's card and the Plan landing; the Epic detail — the one screen a reader is already on — had no route to it (`FR-KAN-050`) | `T1784`: a **Tasks** section on the Epic detail, stating which side is authoritative, and rendering nothing at all when the host has not routed the board |
| **The move permission was never resolved** (second pass, found while reading the route for `F3`) | `task-board.controller.ts` passed **`canMove: true` as a literal** to every proposal. `TaskProposalService` checks that flag carefully and refuses without it — and nothing ever set it to anything but `true`, so **any project member could move any card whatever their grant** (`BR-0003`). The board compounded it by showing the control to everyone | `T1789`: `OwnerGate.mayMove` — the same rule `requireOwner` enforces, asked as a question rather than thrown and audited, because a permission check on every board load is not a refusal. The board read carries `canMove`; the proposal route resolves it; the screen renders read-only and says why, with no control at all |
| The board showed **no progress at all** (second pass) | `contracts/board-contract.md` §5 names three surfaces that must show the same figure; `/plan` and `/tasks` did and the board — the one screen actually about this Epic's tasks — did not. The first pass verified `getEpicTaskProgress` existed in the API client and never checked that a screen calls it (`FR-KAN-055`) | `T1787`: its own read beside the board, so a slow or failed count neither delays nor blanks the cards, and a failure reads as **partial** rather than as an error |
| *superseded by the file* was computed and rendered nowhere (second pass) | `task-reconcile.ts` produced the marker, the sync stored it on the manifest line, and that is where it stopped. `FR-KAN-022` asks the task to name **the proposal, the verdict and the superseding digest**; nothing named any of them. The integration suite proved the easy half — the record survives — and the half a person can see was never built | `T1788`: `latestAppliedProposal` is the other half of `T1782`'s fold, and the two are exhaustive over a task's adjudicated proposals; the board reads the latest parse's manifest for the marker and the card states all three facts, plus that the record is kept |
| **`approval_required` was a verdict with no successor** (third pass) | It was returned, recorded, evented and shown on the card — and **nothing could answer it**. A project that set `projects.taskMoveRequiresApproval` did not gate a move; it froze the card permanently. Every artifact describes the waiting state correctly, which is why three passes over the requirements missed it: only `US4` scenario 3 and `quickstart.md` scenario 9 say what ends it | `T1792`: `adjudicatePending` — a full adjudication, not a rubber stamp. Never the proposer (that is the whole content of *requires an approver*), never an agent (XII.6 on the approving side), never without the move permission (approving a move is making it), never on a card that has since moved, never on a proposal not actually waiting. The second verdict is another event; the proposal row stays untouched. `POST /v1/status-proposals/:id/adjudication`, and the control on the card |
| Unbound task syncs were stored, correct and invisible (third pass) | `TaskSyncStore.unboundSyncs` was on both stores, exercised by two tests, and called by **no production code**. Every other read in the module is scoped to an Epic, and these belong to none — which is exactly how they stayed invisible (`FR-KAN-032`, `quickstart.md` sc. 18) | `T1793`: `unbound(workspaceId, projectId)` — per project, because there is no Epic to hang it on — `GET /v1/projects/:id/tasks/unbound`, and the Spec Journey Board's unbound group now names what each stranded run parsed, beside `EPIC-045`'s files |
| A dead read, resolved by use rather than deletion (third pass) | `findProposal` was called by no production code and no test — neither a seam nor a proof | `T1794`: **not removed.** `T1792`, higher priority in the same pass, needed exactly that read. A test now pins the caller, so if the adjudication route ever goes the method has to be justified afresh. Recorded rather than quietly dropped, because *converge flagged it and the fix was to use it* is a different outcome from *converge was wrong* |
| Three of `FR-KAN-053`'s four filter axes (`F6`), and three of `FR-KAN-059`'s four states (`F7`) | *Ahead of the file* had no control, and the partial state was handled and never **said** — a failed disagreements read made the section vanish and left a board that looked complete | `T1785` and `T1786`: the fourth filter, and a partial-state note naming which part could not be read while the rest stands |

## Constitution XI Tier 1 — proved by inversion (`T1766`)

`T1702`, `T1725`, `T1743` and `T1753` drive the sync and the movement through the **shipped**
`runBegin`/`runFinish` pair and a real `pmi-studio` server (in-memory MCP transport) against the
composed `AppModule`, and the board through its routes. Forty-one scenarios across five files,
including two simultaneous syncs, a replayed key, and a propose → re-sync → supersede sequence.

**The inversion did not go as `T1766` predicted, and the difference is the finding.** Three
observations, all on 2026-09-06, each with the source restored afterwards:

1. **`TaskSyncModule` removed from `backend/src/app.module.ts` alone → all 18 tests GREEN.**
   `TasksModule` imports `TaskSyncModule` too (`T1746`, for the `SyncedTaskGuard`), so the module
   still reaches the composition root by a second path. The `app.module.ts` entry is real
   registration, but on its own it is **not load-bearing** — which is worth knowing before someone
   deletes it believing a test would say so.
2. **Removed from both `app.module.ts` and `tasks.module.ts` → the composition root ABORTS.** No
   assertion runs; vitest reports *Worker exited unexpectedly* and 18 tests not executed.
   `NestFactory`'s `abortOnError` defaults to true, so a missing provider kills the process rather
   than failing a test — `EPIC-045` recorded the same failure mode, and it looks exactly like a
   flake.
3. **The controllers removed from `TaskSyncModule` (`controllers: []`), the module otherwise
   composed → 7 assertions RED, with the predicted shape.** `POST /v1/projects/{id}/tasks/sync`
   answers **`404`** where `201` was expected; the whole-file refusal answers `404` instead of
   `400`; and the board read returns nothing, so every card assertion fails on `undefined`.

Observation 3 is the one `T1766` was reaching for: the routes are what the hook and the board
actually depend on, and with them gone the suite fails on the platform's answers rather than on a
crash. All three are recorded because observations 1 and 2 say something true that the predicted
one would have hidden.

## The mutation observations (`T1768`)

Seven applied on **2026-09-06**, each to the working tree, with the named test run and the source
restored afterwards. **Five failed as `quickstart.md` predicted. Two did not**, and both differences
are recorded rather than smoothed over — they say something true about where each guarantee actually
lives.

| # | Proof | The mutation | The test did not survive it |
|---|---|---|---|
| 1 | `SC-KAN-002` | `PMI_TASK_ID_PATTERN=.*` — any token is an identifier | **RED, 4 of 35** in `task-grammar.spec.ts`: prose and a table row are now *considered*, the ordinary-word line is no longer refused, and the corpus counts move off 8/4/1 |
| 2 | `SC-KAN-002` | `CONSIDERED` loosened to `/^\s*[-*+]\s+\[(.)\]\s*(.*)$/` — any bullet, any box | **RED, 6 of 35**: five lines the grammar must *ignore* become considered, and the counts identity moves |
| 3 | `SC-KAN-006` | the partial unique index on `(epicId, taskKey)` made non-unique | **RED, 2** — `T1686` (the schema test reads the live index and no longer finds it unique) and `T1702` (*exactly one row per identifier*: two rows where one was expected). Three concurrent syncs still answered `201`, which is the point: the arbiter is the index, not the application |
| 4 | `SC-KAN-004` | a filesystem write added to the applied-proposal path | **GREEN, then RED.** The scan as written read three hand-picked files and **missed it**; `task-proposal.service.ts` — the one file where such a mistake would most naturally be made — was not among them. The check now reads the module **directory**, and the same mutation is RED: *task-proposal.service.ts must not reach for node:fs*. The integration byte-comparison could never have caught this one either, and that is the deeper answer: the proposal service has **no path to write to**, which is what makes `SC-KAN-004` structural rather than vigilant |
| 5 | `SC-KAN-002` | `task-reconcile.ts` returns last-write-wins for an unchecked line | **RED, 3 of 25** in `task-reconcile.spec.ts`: `in_progress` and `blocked` set by proposal are silently reset to `not_started`, and `aheadOfFile` is never marked — the disagreement disappears instead of being surfaced |
| 6 | Constitution XII.6 | the agent-principal guard removed from `adjudicate` | **RED, 1 of 17** in `task-proposal.spec.ts`: an agent's own proposal is `applied`. One assertion, and it is the only thing between *an agent may propose* and *an agent may decide* |
| 7 | `SC-KAN-009` | `presentInLatestParse === false` rows counted in the denominator | **RED, 1 of 12** in `task-progress.spec.ts`: a task the latest parse no longer contains is back in the percentage |

**What #4 changed.** The mutation found a real gap and the check was widened in place: `T1706`'s
contract suite now reads every `.ts` file under `backend/src/modules/task-sync/` and refuses
`node:fs`, `from 'fs'`, `writeFile`, `appendFile`, `mkdir`, `rmSync` and `unlink` in any of them,
with an anti-vacuity floor so an empty directory cannot pass silently. A file added to the module
tomorrow is covered by a check nobody has to remember to extend.

## Constitution XII — execution registration (`T1769`)

The commands that produced this Epic ran **unregistered by hook**. This repository is not a
PMI-managed project: it has no `.pmi/project.json`, so `speckit.pmi.begin` refuses
`not_provisioned` and no execution row exists for the `specify`, `clarify`, `plan`, `tasks`,
`analyze` or `implement` that built it. Recorded here as `EPIC-042`, `EPIC-044` and `EPIC-045`
recorded it, not waived.

What *is* registered is the evidence. Every execution inside the five integration suites — and
inside `e2e/tests/epic-046-m4.spec.ts` when it is run — is registered by `speckit.pmi.begin`
through a real `pmi-studio` server, and its `tasks.md` is parsed by the sync `speckit.pmi.finish`
calls. Those parses are **the first task rows a governed command has ever left in PMI Studio**:
before this Epic the tool answered *not available until EPIC-046* and the platform held nothing
about a task the agent had written down.

**No connector applies a status** (`FR-KAN-071`, Constitution XII.6). A connector credential holds
`tasks.sync` — a write scope with no read beside it — and the six board and proposal routes are
session routes. An agent principal may *propose* a status transition, and the proposal row is
written; the verdict is `refused` with the reason that an agent may never approve its own. The
separation is asserted, not assumed: `T1738` and `task-proposal.spec.ts` both hold it.

## The counts (`T1765`)

Whole-project suites, **2026-09-06**, after the last change and with every mutation restored:

| Suite | Files | Tests | Result |
|---|---|---|---|
| `backend-unit` + `backend-contract` + `architecture` + `mcp-server` + `workspace-bundle` + `epic-stage` | 395 | 3 973 passed, 5 skipped | **1 failed** — `T999u`, pre-existing (below) |
| `frontend` | 96 | 1 086 passed | **green** |
| `governance` | 77 | 1 080 passed | **2 failed** — `T884`, pre-existing (below) |
| `backend-integration` (this Epic's five files) | 5 | 41 passed | **green**, 127 s |
| `pnpm -r typecheck` (backend and frontend) | — | — | **green** |
| `eslint` over every file this Epic added | — | — | **green** |

**This Epic's own tests**: 213 backend unit across 14 files in `tests/unit/task-sync/`, plus
`tests/unit/tasks/task-proposal-gate.spec.ts`; 34 contract across `tasks-api.spec.ts` and
`mcp-tool-surface.spec.ts`; 41 integration across five files; 17 `mcp-server`; 6
`workspace-bundle` (`T1758`); and 74 frontend across `task-board`, `plan-landing`,
`task-move-dialog` and `shell/areas`. Extensions to `universal-columns`, `durable-stores`,
`connector-scopes`, `engine-independence`, `agent-independence`, `layout`, `readme-conformance`
and `task-paths` besides.

> **These counts predate Phase 9.** They were taken on the first closing pass; `T1780`–`T1786`
> landed after them and the suites were re-run — see *After the convergence pass* below.

**Two failures are pre-existing and untouched by this Epic**, confirmed against `git log` — neither
file nor its subject was modified here:

- `T999u` (`architecture`) — `specs/035-defect-room/tier2-transcript.md` has never been committed;
  `EPIC-035` left it, as its own closure records.
- `T884` ×2 (`governance`) — `docs/accessibility/EPIC-029-manual-pass.md` does not exist; only the
  `.DRAFT.md` beside it does, since `EPIC-029`.

### After the convergence pass (`T1780`–`T1786`)

Re-run **2026-09-06** with every Phase 9 change in place:

| Suite | Files | Tests | Result |
|---|---|---|---|
| `backend-unit` + `backend-contract` + `architecture` + `mcp-server` + `workspace-bundle` + `epic-stage` + `governance` | 474 | 5 082 passed, 5 skipped | **3 failed** — `T999u` and `T884` ×2, both pre-existing |
| `frontend` | 96 | 1 102 passed | **green** |
| `backend-integration` (this Epic's five files) | 5 | 41 passed | **green** |
| `pnpm -r typecheck` · `eslint` over every file Phase 9 touched | — | — | **green** |

`SC-KAN-004`'s byte-comparison is inside those 41: the verdict event and the new
traceability write put nothing in the project directory.

**Two failures Phase 9 caused, both caught by checks that were right:**

- `engine-independence.spec.ts` went red on two code comments naming the convergence command.
  A toolkit must not be named in this codebase even in prose (`FR-017`, `ADR-0001`) — the same
  lesson `T1724` learned about the progress hook. Reworded.
- `T148`'s pairing check went red on six Phase 9 tasks whose text named the source and not the
  test (Constitution V). Five had tests already and now name them; `T1781` genuinely had none —
  the port's *wiring* was untested, which is the half that was broken — so a source scan was
  written that fails on the line that would reintroduce the bug.

### After the second convergence pass (`T1787`–`T1791`)

Re-run **2026-09-06**:

| Suite | Files | Tests | Result |
|---|---|---|---|
| `backend-unit` + `backend-contract` + `architecture` + `mcp-server` + `workspace-bundle` + `epic-stage` + `governance` | 476 | 5 096 passed, 5 skipped | **3 failed** — `T999u` and `T884` ×2, both pre-existing |
| `frontend` | 96 | 1 118 passed | **green** |
| `backend-integration` (`task-sync`, `task-proposal`, `task-reconciliation`) | 3 | 30 passed | **green** |
| `pnpm -r typecheck` · `eslint` over every file Phase 10 touched | — | — | **green** |

**A measurement mistake worth recording.** The integration suites first reported five timeouts at
exactly 5 000 ms, which looked like the new permission and traceability queries had made the sync
slow. They had not: running `vitest` from `backend/` bypasses `vitest.workspace.ts`, so the
project's `testTimeout: 120_000` never applied and the default did. Run through
`--project backend-integration` the same three files pass in full. The failure was in how it was
measured, and a slower-looking sync is exactly the conclusion that would have been drawn from the
first number.

**Why the two passes found different things.** The first walked requirements and services; the
second walked the **contract documents** clause by clause against the screens. Four of the second
pass's five findings are things `contracts/board-contract.md` already specified and no code did —
which says the first pass's method, not the codebase, was what needed correcting.

### After the third convergence pass (`T1792`–`T1794`)

Re-run **2026-09-06**:

| Suite | Files | Tests | Result |
|---|---|---|---|
| `backend-unit` + `backend-contract` + `architecture` + `mcp-server` + `workspace-bundle` + `epic-stage` + `governance` | 478 | 5 119 passed, 5 skipped | **3 failed** — `T999u` and `T884` ×2, both pre-existing |
| `frontend` | 96 | 1 126 passed | **green** |
| `backend-integration` (`task-sync`, `task-proposal`, `task-reconciliation`) | 3 | 30 passed | **green** |
| `pnpm -r typecheck` · `eslint` over every file Phase 11 touched | — | — | **green** |

**Two contract assertions this phase broke, both right to fire.** `T1714` counted **one** `@Post`
on the board controller and `T1792` added a second; `T1732` counted **four** membership checks and
`T1793` added a fifth. Both are now updated — and the `@Post` assertion was changed from a *count*
to an *enumeration*, so a third write has to be named before it can exist rather than merely
raising a number. Counting is what let the first one nearly pass unnoticed.

**Two failures that were neither pre-existing nor real.** `T149a`'s two seed-idempotence tests
timed out at 5 000 ms in one full run, passed 11/11 in isolation, and passed again in the clean
re-run above: a container test in the unit project, under load, with no long timeout. Recorded because the same shape — a timeout read as a
regression — already cost this Epic one wrong conclusion about the integration suites, and the
answer both times was to re-run the thing on its own before believing it.

### `T1767` — why it had never been runnable (`T1795`)

Attempting the `M4` transcript did not fail on the stack, the credentials or the harness's logic. It
failed on **collection**: `npx playwright test --list` reported *0 tests in 0 files* with
`ReferenceError: exports is not defined`.

`@pmi/workspace-bundle` is `"type": "module"` and resolves to raw TypeScript; `e2e/package.json`
declared no type, so Playwright compiled every spec as CommonJS and the import of the shipped hooks
could not load. **Four harnesses import it** — `epic-042-m2`, `epic-044-m3`, `epic-045-m3` and this
Epic's `epic-046-m4`. None of them has ever been collectable, which means **no milestone transcript
from `M2` onward could have been produced by this harness setup**, and `EPIC-045`'s own closure
recording its Tier 2 as *authored, not yet measured* had a cause nobody had found.

The fix is two lines of infrastructure: `"type": "module"` in `e2e/package.json`, and `REPO`
derived from `import.meta.url` rather than the CommonJS `__dirname` in the five harnesses that use
it. `npx playwright test --list` now reports **19 tests in 7 files**, and all five typecheck.

**What still blocks `T1767`**: the sign-in password for the seeded `dev@pmi.local`.
`SEED_USER_PASSWORD` has no default — deliberately, so an unset password fails loudly rather than
creating a predictable account — and it is not in `.env`. That is a credential, not an engineering
problem, and it is the requester's to supply.

## Work not done, and why

- **`T1767` — the Constitution XI Tier 2 transcript.** `e2e/tests/epic-046-m4.spec.ts` is authored,
  typechecks and — since `T1795` — **collects**; it has **not been run against a stack**, so
  `docs/uat/EPIC-046-m4-transcript.md` does not exist. The reference-local stack is up (`pmi-app`
  serves UI and API on port 3000, not 5173), and the one remaining input is the seeded user's
  password. M4 is therefore *authored, not yet measured* — `SC-KAN-003`'s end-to-end claim and
  both halves of `SC-KAN-007`'s two-second budget are unmeasured. `SC-KAN-003`'s substance is
  nonetheless proved by `task-progress.spec.ts`, which moves three cards through the shipped hooks
  with no call to a move route anywhere in the test.
- **`T1770` — the converge pass and the promotion.** `/speckit-converge` is the requester's command
  to run, and the promotion `local → dev` is explicitly gated on *an instruction naming the
  environment*, which has not been given. No environment was promoted and none was skipped.

## Records (`T1771`)

| Record | State |
|---|---|
| `specs/_shared/dependencies.md` | **No entry gained.** No runtime dependency was added by this Epic |
| `frontend/package.json` | **No drag-and-drop package** (`R-046-10`). The move is a form, not a drag |
| `governance/repository-layout.md` | Registers `backend/src/modules/task-sync/`, the three frontend files (`TaskBoard.tsx`, `PlanLanding.tsx`, `TaskMoveDialog.tsx`) and `backend/tests/fixtures/task-grammar/` |
| `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md` §3 | Carries the dated `EPIC-046` note: `pmi.tasks.sync` live, **one** reserved tool remains, the surface unchanged at fifteen, the hook unedited |
| `frontend/src/shell/areas.ts` | **Plan & Tasks** delivered; `EPIC-012`'s `T441p` recorded as superseded in `R-046-11`; `EPIC-036`'s counts cascaded 5→6 delivered, 11→10 owed, across six documents and two test files |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §8 | **Not yet updated.** `M4` is *authored, not yet measured* until `T1767` runs; marking it reached on the strength of an unrun harness is the one thing `EPIC-044`'s `T1607` rule forbids |
