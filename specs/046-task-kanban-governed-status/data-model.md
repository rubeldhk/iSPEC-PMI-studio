# Data Model — Task Kanban with Governed Auto-Status

**Epic**: `EPIC-046` · **Date**: 2026-09-06 · **Research**: [research.md](./research.md)

Two new tables, one widened table, one new column on `projects`, one enum value. The migration is
additive apart from a single **widening** (`tasks.specificationId` becomes nullable), which is
called out in §2 because it is the only change that touches existing rows' constraints.

Migration: `backend/prisma/migrations/<ts>_epic046_task_sync/migration.sql`.

---

## §1 · `TaskStatus` gains `blocked` (`R-046-2`, `FR-KAN-051`)

```text
enum TaskStatus { not_started  in_progress  done  blocked }
```

Postgres `ALTER TYPE … ADD VALUE 'blocked'`. Existing rows are untouched. `blocked` is reachable
**only** through an applied proposal (`FR-KAN-041`); no parse and no event ever produces it, and the
reconciliation table of `R-046-4` has no row that does.

---

## §2 · `tasks` — widened, not replaced (`R-046-2`)

| Column | Type | Notes |
|---|---|---|
| `epicId` | `String?` | FK `epics`. Null for an engine-generated task and for an unbound sync (`FR-KAN-032`) |
| `specificationId` | `String?` | **Widened from NOT NULL.** Null while the Epic has no specification (`FR-KAN-030`, `Q1`) |
| `taskKey` | `String?` | The identifier as written in the file — `T1620`. Null for engine-generated tasks |
| `sourceLine` | `Int?` | 1-based line number in the `tasks.md` it was last parsed from |
| `sourceDigest` | `String?` | SHA-256 of that `tasks.md` (`FR-KAN-035`) |
| `parallel` | `Boolean @default(false)` | The `[P]` marker |
| `sourcePaths` | `String[] @default([])` | Repository paths named in the description (`DS-1`, `FR-KAN-005`); empty when the description names none — a fact worth seeing, not an error |
| `presentInLatestParse` | `Boolean @default(true)` | False once a later parse of the same Epic omits the key (`FR-KAN-025`) |
| `statusSource` | `String @default("engine")` | `parse` \| `event` \| `proposal` \| `engine` — TEXT + CHECK. The input the reconciliation function needs |
| `lastParsedExecutionId` | `String?` | FK `executions`. The execution whose sync last saw this key; also the execution a proposal's event is appended to (`FR-KAN-012`) |
| `lastMovedAt` | `DateTime?` | When the status last changed, whatever moved it (`FR-KAN-054`) |
| `lastMovedBy` | `String?` | Actor id for a proposal; null for a parse or an event |

**Indexes.** Unique `(epicId, taskKey)` — the identity of `R-046-2` and `FR-KAN-031`; it is a
*partial* unique index (`WHERE epicId IS NOT NULL AND taskKey IS NOT NULL`) so engine-generated rows
are unaffected. Plus `(epicId, status)` for the board and `(workspaceId, epicId)` for tenancy. The
existing `(specificationId, status)` index stays.

**Why widening is safe.** No existing row has a null `specificationId`; every current reader keeps
working on current rows. The five readers named in `R-046-2` gain a null branch, and the traceability
link writer writes the task→specification edge **when a specification exists** and the task→Epic edge
otherwise.

`engineName` / `engineVersion` on a synced row record the **agent** that produced the file, read from
the execution's agent identity snapshot — not a fabricated engine (`BR-0035`, `FR-KAN-034`).

---

## §3 · `task_syncs` — one row per sync (`R-046-3`, `FR-KAN-034`)

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id` | |
| `workspaceId` · `projectId` | `String` | Tenancy (`FR-KAN-074`); `projectId` from the execution |
| `epicId` | `String?` | Null for an unbound sync (`FR-KAN-032`) |
| `executionId` | `String` | FK `executions` (`FR-KAN-030`) |
| `actorId` | `String?` | The connector principal |
| `idempotencyKey` | `String` | Derived: `tasks-sync:<executionId>:<digest>` (`R-046-8`) |
| `tasksDigest` | `String` | SHA-256 of the markdown parsed (`FR-KAN-035`, `FR-KAN-036`) |
| `linesConsidered` · `parsed` · `refused` · `duplicates` | `Int` | The counts of `FR-KAN-006` |
| `added` · `changed` · `unchanged` · `disappeared` | `Int` | The diff summary of `FR-KAN-037` |
| `outOfBandEdit` | `Boolean @default(false)` | The digest differed from the previous sync's with no governed command between (`FR-KAN-023`) |
| `syncedAt` | `DateTime @default(now())` | |

Unique `(workspaceId, idempotencyKey)` — the arbiter of `FR-KAN-038`, as `EPIC-045` proved. Index
`(epicId, syncedAt DESC)` for *the latest parse*.

---

## §4 · `task_sync_lines` — the manifest (`R-046-3`)

One row per **considered** line. Lines the file contains that are not task-list items are neither
stored nor counted (`FR-KAN-001`).

| Column | Type | Notes |
|---|---|---|
| `syncId` | `String` | FK `task_syncs`, cascade |
| `lineNumber` | `Int` | |
| `rawText` | `String` | Truncated to the description limit; what `FR-KAN-003` shows |
| `outcome` | `String` | `parsed` \| `refused` \| `duplicate` — TEXT + CHECK |
| `refusalCode` | `String?` | One of §6; null when `outcome = 'parsed'` |
| `taskKey` | `String?` | Null when unparseable |
| `changeKind` | `String?` | `added` \| `description-changed` \| `checkbox-changed` \| `unchanged` — TEXT + CHECK |
| `previousStatus` · `newStatus` | `String?` | What the reconciliation function decided |
| `marker` | `String?` | `aheadOfFile` \| `supersededByFile` — the disagreement it surfaced |

Unique `(syncId, lineNumber)`. A *disappeared* task has no line, so it is recorded on the sync's
`disappeared` count and found by the `presentInLatestParse` flag on the row.

---

## §5 · `task_status_proposals` — the immutable request (`R-046-5`)

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id` | |
| `workspaceId` · `taskId` | `String` | |
| `expectedCurrentStatus` · `requestedStatus` | `String` | TEXT + CHECK over the four statuses |
| `reason` | `String` | **Required**, non-empty (`FR-KAN-011`) |
| `proposerId` · `proposerType` | `String` | `user` \| `agent` \| `service`; identity frozen at proposal time |
| `executionId` | `String?` | The execution the `status-transition-proposed` event was appended to |
| `eventId` | `String?` | That event |
| `idempotencyKey` | `String` | Unique with `workspaceId`; **derived**, see [contracts/tasks-api.md](./contracts/tasks-api.md) §4 |
| `proposedAt` | `DateTime` | |

**No verdict column** — `R-037-5`'s rule, restated: a mutable verdict field becomes the audit
authority the first time somebody reads it instead of the event stream. The verdict is an event and
a projection (§7).

---

## §6 · `projects.taskMoveRequiresApproval` (`R-046-6`)

`Boolean @default(false)`. When true, an adjudication that would otherwise be `applied` returns
`approval_required` and the card waits (`FR-KAN-013`, `US4` scenario 3).

---

## §7 · Refusal codes (closed vocabulary, `FR-KAN-003`, `FR-KAN-039`)

Per line: `malformed_identifier` · `identifier_not_matched` · `missing_description` ·
`description_too_long` · `duplicate_identifier` · `credential_in_description`.
Whole file: `file_too_large` · `too_many_task_lines` · `not_utf8_text`.

A whole-file code refuses the sync (`FR-KAN-039`, Assumption 8); a per-line code refuses one line and
the rest are stored (`FR-KAN-003`).

---

## §8 · Projections (never stored)

| Projection | Definition |
|---|---|
| **Latest parse** | The `task_syncs` row with the greatest `syncedAt` for the Epic |
| **Board column** | `task.status` — one of four; every row is in exactly one (`FR-KAN-051`) |
| **Progress** | Counts over rows where `presentInLatestParse`, plus a whole-number percentage; 0 for an empty set (`FR-KAN-055` to `FR-KAN-058`) |
| **Open disagreements** | Rows marked `aheadOfFile`; rows with `presentInLatestParse = false`; unmatched progress reports; the latest sync's refused lines; `outOfBandEdit` (`FR-KAN-024`) |
| **Unmatched progress report** | A `progress-reported` event whose `payload.taskId` matches no `(epicId, taskKey)` of the execution's Epic (`FR-KAN-042`) |
| **Board staleness** | Latest parse's `syncedAt` compared with the Epic's latest execution's time (`FR-KAN-048`) |
| **Proposal state** | Folded from the proposal's events, as `EPIC-037` folds an execution (`R-046-5`) |
| **Digest agreement** | The latest parse's `tasksDigest` against the `tasks.md` artifact version of the same execution; a difference is a finding, never a repair (`FR-KAN-036`) |

---

## §9 · The sync, step by step (`task-sync.service.ts`)

1. Resolve the execution by `(workspaceId, executionId)`. Unknown, another project's, or a command
   that is neither `tasks` nor `implement` → refuse by name (`FR-KAN-033`).
2. Derive the idempotency key from the execution and the markdown digest. Insert the `task_syncs`
   row; on unique violation, read the stored one back and return its manifest (`FR-KAN-038`).
3. Whole-file validation — size, line count, UTF-8 (`FR-KAN-039`). A failure refuses the sync and
   leaves no rows.
4. Resolve the Epic from the execution's **input binding** with `@pmi/epic-stage`'s `bindExecutions`
   — never from a path (`FR-KAN-030`). No Epic → unbound (`FR-KAN-032`).
5. Parse with `parseTasks` (`R-046-1`). Per considered line: grammar, credential shapes, duplicate
   check within the file (first wins).
6. Load the Epic's existing rows by `taskKey`. For each parsed key run `reconcile` (`R-046-4`);
   upsert the row on `(epicId, taskKey)`, reading back on unique violation.
7. Mark every row of the Epic whose key is absent from this parse `presentInLatestParse = false`
   (`FR-KAN-025`). Delete nothing.
8. Write the `task_sync_lines` manifest and the counts; set `outOfBandEdit` when the previous sync's
   digest differs and no governed execution of this Epic completed between them (`FR-KAN-023`).
9. One `system` comment on the execution naming the counts and any refused lines, so the developer
   sees it on the timeline (`EPIC-045`'s pattern).
10. Audit; return the diff (`FR-KAN-037`).

**Ordering note, from `DEF-045-002`.** Any step that can violate a unique index runs *before* the
sync row is finalised and is insert-and-read-back, never check-then-insert. Two simultaneous syncs of
one Epic must both answer `201`.

---

## §10 · Applying an event and applying a proposal

**`progress-reported`** (`FR-KAN-040`): match `payload.taskId` to `(epicId, taskKey)` of the
execution's Epic. Hit → `status = done`, `statusSource = 'event'`, `lastMovedAt` = the event's time;
idempotent. Miss → nothing is created; it surfaces as an unmatched report (`FR-KAN-042`).

**An applied proposal** (`FR-KAN-013`): `status = requestedStatus`, `statusSource = 'proposal'`,
`lastMovedBy` = the proposer. A later parse may supersede it, and §8's marker says so.

---

## §11 · Audit actions (`FR-KAN-072`)

| Action | Target | Detail |
|---|---|---|
| `create` | `task_sync` | execution, digest, counts, diff summary, refused codes |
| `update` | `task` | from, to, source, cause id (sync, event or proposal) |
| `create` | `task_status_proposal` | task, from, to, reason present, proposer type |
| `update` | `task_status_proposal` | verdict, whether immediate |

---

## §12 · Invariants the tests hold

1. No route, tool or screen writes a file in the project directory (`FR-KAN-010`, `SC-KAN-004`).
2. One row per `(epicId, taskKey)`, under retry and under concurrency (`SC-KAN-006`).
3. No task row is ever deleted by a sync (`FR-KAN-025`).
4. `blocked` and `in_progress` are unreachable except through an applied proposal (`FR-KAN-041`).
5. A proposal row is never updated after insert; its verdict lives in events (`R-046-5`).
6. `linesConsidered = parsed + refused + duplicates` for every sync (`SC-KAN-001`).
7. Progress excludes rows with `presentInLatestParse = false` (`FR-KAN-058`).
8. A cross-project or cross-workspace sync or read refuses as absence (`FR-KAN-070`, `FR-KAN-074`).
