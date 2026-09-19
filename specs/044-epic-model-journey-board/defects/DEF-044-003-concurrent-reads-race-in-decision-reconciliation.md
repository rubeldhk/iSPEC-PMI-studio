# DEF-044-003 — concurrent reads race in decision reconciliation and answer 500

**Epic**: `EPIC-044` | **Raised**: 2026-09-05 | **Status**: CLOSED 2026-09-05

**Originating task**: `T1569` / `T1594` (reconciliation on read) · found in the branch review after the
second convergence pass
**Severity**: HIGH — the first screen load after a confirmed split fails in part: every screen fires
the Epic list and the board together, and one of the two answered `500 internal_error`

## Expected

`FR-EPB-026` / `FR-EPB-064`: a recorded decomposition decision is processed once, on the next read,
whatever the order or number of readers; `SC-EPB-006` promises exactly the recorded number of
children and zero duplicates. A read never fails because another read is in flight.

## Actual

Every list, board, stage and detail read runs `reconcileDecisions` first. Two reads arriving
together both see the decision as unprocessed; the second one's child insert hits the unique index
`(decisionCommentId, splitSuffix)`, the store's single retry (meant for the number race) re-inserts
and hits it again, and the raw `P2002` escapes the controller as an internal error. Reproduced
against the composed application with three simultaneous requests after a confirmed split:

```
RACE statuses: list 200, board 500, list2 500
board {"error":{"code":"internal_error","message":"An unexpected error occurred."}}
```

The frontend triggers exactly this: `EpicList.tsx`, `JourneyBoard.tsx` and `SpecificationList.tsx`
each call `listEpics` and `getBoard` in one `Promise.allSettled`. The sequential integration test
(`T1593`) could not see it. Two smaller faults were found in the same path:

- the split's audit rows named the **reader** who triggered reconciliation as the actor
  (`ctx.userId ?? body.decidedBy`, and the controller always supplies `ctx.userId`), so the person
  who decided never appeared (`FR-EPB-028`);
- reconciliation ran before the project check, and `GET /v1/epics/{eid}` accepted a `projectId`
  query the contract does not define and used it as the reconciliation scope.

## Resolution

- `reconcileDecisions` is **idempotent per child and resumable**: a decision counts as processed
  only when its parent carries it as `lastDecisionCommentId` (set last); a child insert that hits
  the unique index is read back with `findByDecision` and processing continues with it, so a
  concurrent pass — or a pass interrupted after some children — converges to the same rows. The
  project check runs first. The split's audit actor is the recorded `decidedBy`; the reader is
  recorded in the detail as `readBy`.
- `InMemoryEpicStore` enforces the same unique index as the database (`P2002`-shaped error), so
  the unit tests see the race the integration test sees.
- `PrismaEpicStore.create` retries the **number** race up to five times and gives up with a
  `ConflictError` (`epic_number_contended`) rather than a raw driver error; a violation of any other
  unique index is rethrown at once for the caller to handle.
- `GET /v1/epics/{eid}` no longer reads a `projectId` query.
- Tests: `decision-reconcile.spec.ts` (unit) gains the concurrent passes, the resumed pass and the
  actor assertion; the integration `T1593` read is now three simultaneous requests;
  `epic.store.spec.ts` covers the retry and the give-up.

## Lesson

Reconciliation on read is a write hidden inside every read; the screens read in parallel by design,
so the write must be idempotent under concurrency, not merely under repetition. The sequential
"second read creates nothing" test proved repetition and was taken for concurrency. The
`DEF-005-001` lesson in another form: the path the product actually takes (two parallel reads) was
not the path any test took.
