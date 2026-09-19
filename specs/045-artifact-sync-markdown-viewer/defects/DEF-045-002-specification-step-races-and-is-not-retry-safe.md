# DEF-045-002 — the specification-by-sync step raced and was not retry-safe

**Epic**: `EPIC-045` | **Raised**: 2026-09-05 | **Status**: CLOSED 2026-09-05

**Originating task**: `T1634` / `T1636` (the sync service and the specification port) · found in
the branch review, reproduced against the composed application
**Severity**: HIGH — two first syncs of one Epic's `spec.md` arriving together answered `500` and
`201`; the loser's sync row was already committed, so its retry replayed the key and the content it
carried never reached the specification

## Expected

`FR-ART-006`: a sync is idempotent under retry and under concurrency. `FR-ART-030`, `FR-ART-031`:
the first sync of an Epic's `spec.md` creates its specification; later syncs append a version only
when the content changed. Both hold whatever the order of arrival.

## Actual

Step 7 (the specification) ran **after** the sync row was recorded and had no handling for the
unique index on `(epicId, sourcePath)` nor for `(specificationId, versionNumber)`. Two concurrent
first syncs both found no specification; the second `createFromSync` hit the unique index and the
raw error escaped as `500`. Because the sync row existed, the hook's retry replayed the stored
answer and returned before step 7, so the specification was never created for that content. The
in-memory port tolerated the duplicate, so the unit suite could not see the race — the shape
`DEF-044-003` recorded, one module over. A second subtlety: the specification tables are written
with raw SQL, so their violations arrive as Prisma `P2010` wrapping PostgreSQL `23505`, not as the
`P2002` the store's helper recognised.

## Resolution

- The specification step runs **before** the sync row is recorded: a failure leaves no row, and
  the retry redoes the work with every version already stored and simply `reused`.
- `syncSpecification` inserts and reads back on the unique violation, then appends — both
  concurrent syncs succeed and both contents become versions (one specification, two versions).
- `appendVersionIfChanged` retries a `versionNumber` collision up to three times after re-reading
  the head.
- `isUniqueViolation` recognises `P2002`, `P2010`+`23505` and bare `23505`, matching a column name
  against the index name in the message.
- `InMemorySpecificationSyncPort.createFromSync` enforces the `(epicId, sourcePath)` index with a
  `P2002`-shaped error, so unit tests see the race.
- Alongside (review finding 4): a caller-supplied idempotency key reused with a different execution
  or manifest is refused `409 conflict / idempotency_conflict` instead of returning another
  request's answer; a replay must be the same request.
- Tests: `review-fixes.spec.ts` (unit: the race over the in-memory port, the port's index, the key
  conflict, the content read's fan-out); `artifact-sync.spec.ts` (integration: two simultaneous
  first syncs → `201`/`201`, one specification, two versions; a reused key → `409`).

## Lesson

A write that runs after the idempotency mark is written is a write a retry can never repeat. Put
the mark last, and let the database's unique index — not a prior read — decide who created what.
