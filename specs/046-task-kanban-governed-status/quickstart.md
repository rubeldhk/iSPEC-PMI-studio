# Quickstart — Validating EPIC-046

**Epic**: `EPIC-046` Task Kanban with Governed Auto-Status · **Date**: 2026-09-06

This is the run guide, not the implementation. Contracts live in
[contracts/](./contracts/); the schema in [data-model.md](./data-model.md);
the decisions in [research.md](./research.md).

## Prerequisites

- Node ≥ 22, Docker running (Testcontainers), `DATABASE_URL` set for the integration suites.
- `EPIC-041` to `EPIC-045` merged: a provisioned project directory, a connector token in
  `PMI_STUDIO_TOKEN`, Epics with executions, and `tasks.md` already syncing as an artifact version.
- The four settings of `R-046-9` present in `.env` (or left at their defaults):
  `PMI_TASKS_MAX_BYTES`, `PMI_TASKS_MAX_LINES`, `PMI_TASK_ID_PATTERN`, `PMI_TASK_DESCRIPTION_MAX`.

## Scenarios

Each names the requirement it proves and the suite that runs it.

| # | Scenario | Proves | Suite |
|---|---|---|---|
| 1 | Run `/speckit-tasks` for an Epic; every task line becomes a card, every rejected line appears in the refused-lines list, and the two counts sum to every task-list item in the file | `FR-KAN-001`, `FR-KAN-003`, `SC-KAN-001` | integration + frontend |
| 2 | A file containing a heading, prose, a table row, a nested bullet and a `(unit test: T0nn)` cross-reference produces no task and no refusal | `FR-KAN-001`, `US1` sc. 2 | unit (grammar corpus) |
| 3 | Two lines declaring `T1701`: the first stored, the second reported with both line numbers, the sync succeeds | `FR-KAN-007`, `US1` sc. 4 | unit + integration |
| 4 | Sync the same `tasks.md` twice; the second creates no change, returns an empty diff, and is recorded | `FR-KAN-026`, `FR-KAN-038` | integration |
| 5 | **Two simultaneous syncs of one Epic** — both answer `201`, one row per identifier | `SC-KAN-006` | integration (**written first**) |
| 6 | Append `progress-reported` for three identifiers through the shipped `runProgress`; the three cards are Done, attributed to the events; a fourth event naming an unknown identifier creates nothing and is listed as unmatched | `FR-KAN-040`, `FR-KAN-042`, `SC-KAN-003` | integration |
| 7 | Repeat one `progress-reported`; the card is Done once and nothing else changes | `FR-KAN-043` | integration |
| 8 | Move a card to *In progress* with a reason as a permitted member; the card moves at once, the proposal, event and verdict exist, and the Epic's directory is **byte-identical** before and after | `FR-KAN-010` to `FR-KAN-013`, `SC-KAN-004` | integration |
| 9 | Set `taskMoveRequiresApproval`; the same move leaves the card in place, stating requester, reason and time, until a second person's verdict applies it | `FR-KAN-013`, `US4` sc. 3 | integration |
| 10 | Submit a move without a reason → refused before a proposal exists. Submit two moves for one card at once → both recorded, at most one applied | `FR-KAN-011`, `FR-KAN-016` | integration |
| 11 | A connector credential attempts to adjudicate or apply a status → refused; the same credential syncs successfully | `FR-KAN-071`, `US4` sc. 6 | integration |
| 12 | Move a card to *In progress*; re-sync an unchanged file → the card stays, marked *ahead of the file*. Hand-tick that line and re-sync → the card is Done, marked *superseded by the file*, and the proposal row still exists | `FR-KAN-021`, `FR-KAN-022`, `US5` sc. 1–2 | integration |
| 13 | Remove a task from `tasks.md` and re-sync → the row stays, marked *not in the latest parse*, and is excluded from the percentage with the exclusion stated | `FR-KAN-025`, `FR-KAN-058` | integration + frontend |
| 14 | Change a description under the same identifier → the row keeps its identifier and history; the diff lists a description change with both texts | `FR-KAN-031`, `US5` sc. 4 | integration |
| 15 | Two Epics: 4/10 and 5/5 done → 40%, 100%, project 60%, identical on the board, the `/plan` landing and the project surface | `FR-KAN-056`, `SC-KAN-009` | integration + frontend |
| 16 | A `tasks.md` over the size limit, and one over the line limit → the whole sync refused with the code and **no rows written** | `FR-KAN-039` | integration |
| 17 | A task description containing `pmi_ct_…` → the line refused, not stored, visible on the execution | `FR-KAN-073` | integration |
| 18 | An execution bound to no Epic → tasks stored unbound and listed with the board's unbound group | `FR-KAN-032` | integration |
| 19 | A provisional run → no task sync happens at all; the board states its parse is older than the Epic's latest execution | `FR-KAN-048` | integration |
| 20 | The connector credential of another project syncs → refused as absence | `FR-KAN-070` | integration |
| 21 | An Epic whose `tasks.md` synced before any `spec.md` → tasks exist with no specification; a later `spec.md` sync attaches to the same rows without creating new ones | `FR-KAN-030`, `Q1` | integration |
| 22 | The board's four states, both empty states distinguished, and every filter | `FR-KAN-053`, `FR-KAN-059` | frontend |
| 23 | The `M4` transcript: a run ticking five tasks, five cards reaching Done, the percentage rising, zero manual moves | `SC-KAN-003` | e2e (Tier 2) |
| 24 | A description naming repository paths yields those paths on the card; one naming none yields an empty list and **no** refusal | `FR-KAN-005` | unit + frontend |
| 25 | A sync, a status change, a proposal and a verdict each leave an immutable audit row with the fields of data-model.md §11 | `FR-KAN-072` | unit + integration |

## Running the checks

```bash
npm run test:unit -w backend -- task-sync
```

```bash
npm run test:contract -w backend -- tasks-api mcp-tool-surface
```

```bash
npm run test:integration -w backend -- task-sync task-proposal
```

```bash
npm run test:architecture -w backend
```

```bash
npm run test -w frontend -- task-board plan-landing task-move-dialog areas
```

```bash
npm run test:e2e -- epic-046-m4
```

## Mutation observations owed at closure (Constitution V, `SC-KAN-002`, `-004`, `-006`)

Each must be **observed** failing, and the observation recorded in `closure.md` with its date:

1. Loosen `PMI_TASK_ID_PATTERN` to accept any token → the grammar corpus fails.
2. Accept an arbitrary checkbox form → the corpus fails.
3. Remove the partial unique index on `(epicId, taskKey)` → the concurrent-sync test fails.
4. Introduce a write to `tasks.md` in the proposal path → the byte-comparison test fails.
5. Let the reconciliation function pick last-write-wins → the *ahead of the file* and *superseded by
   the file* cases fail.
6. Allow an agent principal to approve its own proposal → the separation-of-duties test fails.
7. Include *not in the latest parse* rows in the progress denominator → `SC-KAN-009` fails.

## Results

**Run on 2026-09-06** on the implementation machine (Windows 11, Node 22, PostgreSQL 16 in
Testcontainers). Every figure below is a run that happened; nothing here is projected.

| Check | Files | Tests | Outcome |
|---|---|---|---|
| `backend/tests/unit/task-sync/` | 14 | 213 | pass |
| `backend/tests/unit/task-sync/` + `backend/tests/unit/tasks/` | 20 | 246 | pass |
| `backend/tests/contract/{tasks-api,mcp-tool-surface}.spec.ts` | 2 | 34 | pass |
| `backend/tests/integration/` (the five EPIC-046 suites) | 5 | 41 | pass, 127 s wall |
| `frontend` — `task-board`, `plan-landing`, `task-move-dialog`, `shell/areas` | 4 | 74 | pass |
| `packages/mcp-server/tests/tasks-tool.spec.ts` | 1 | 17 | pass |
| `packages/workspace-bundle` (including `T1758`) | 8 | 97 | pass |
| backend `tests/unit/ tests/contract/ tests/architecture/`, whole | 375 | 3757 | pass |

Two failures exist in the repository and **neither is this Epic's**: `EPIC-035`'s Tier 2 transcript
(`defect-room-transcript.spec.ts`, `specs/035-defect-room/tier2-transcript.md` uncommitted) and
`EPIC-029`'s accessibility record (`docs/accessibility/EPIC-029-manual-pass.md`). Both predate this
Epic's branch and are recorded here so the counts above are read against a known baseline.

**The counts identity of `SC-KAN-001`** holds in every one of the runs above:
`linesConsidered = parsed + refused + duplicates`, asserted per sync in
`backend/tests/integration/task-sync.spec.ts` rather than sampled.

**`SC-KAN-003` — the board moves itself — is proved by integration, not yet by transcript.**
`backend/tests/integration/task-progress.spec.ts` drives the **shipped** `runBegin`/`runFinish`
pair against a real `pmi-studio` server and the composed `AppModule`: an `implement` run that ticks
three of four task lines moves exactly three cards to *Done*, each attributed to `event`, with no
call to a move route anywhere in the test. The end-to-end version of the same claim — a signed-in
member with no checkout watching five cards move — is authored as `e2e/tests/epic-046-m4.spec.ts`
and **has not been run against a stack**, so M4 is *authored, not yet measured*.

**`SC-KAN-004` — no file is written** — is proved by byte-comparison, not by inspection:
`backend/tests/integration/task-proposal.spec.ts` fingerprints every file under the Epic's
directory before and after a board session that includes a proposal and requires the two sets to be
identical. `backend/tests/contract/tasks-api.spec.ts` additionally reads the module's own source
and refuses `node:fs`, `writeFile` and `mkdir` anywhere in it, so the guarantee does not depend
on a test remembering to look.

**`SC-KAN-007` — the two-second budget — is NOT measured here.** The board's list time for an Epic
of 100 tasks and the parse time for a 1 MiB `tasks.md` are recorded by
`e2e/tests/epic-046-m4.spec.ts` into `docs/uat/EPIC-046-m4-transcript.md`, which is `T1767`'s
output and does not yet exist. Reporting a number for it from a unit run would be measuring a
different thing and calling it the same one.

## Counts

**2026-09-06.** 25 scenarios authored; the 20 that do not need a running stack are covered by the
suites in §Results and pass. Seven mutations applied and observed — five failed as predicted, two
did not, and both differences are recorded in `closure.md` §The mutation observations rather than
smoothed over. 92 of 94 tasks complete; the two open are `T1767` (the Tier 2 run against a stack)
and `T1770` (the converge pass and the promotion), each named in `closure.md` §Work not done.
