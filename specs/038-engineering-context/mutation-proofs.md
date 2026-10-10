# EPIC-038 — Mutation proofs

**Recorded**: 2026-10-08, at the moment of each observation (`T1296`). Each guard was removed, the
named test run against it, the result written down, and the guard restored and re-run green.

A guard that nobody has seen fail is a guard nobody knows is load-bearing. Each of these is the
kind that passes every test written against the correct implementation and fails silently in
production when it is wrong.

## T1289 — `FR-CTX-050`, `SC-CTX-003` · Epic Exit Criterion

| | |
|---|---|
| **Mutation** | `backend/src/modules/context/retrieval/vector.index.pg.ts`, `nearest()`: `WHERE "workspaceId" = $2` replaced by `WHERE ($2::text IS NOT NULL)` — the partition predicate removed, parameter numbering kept |
| **Test** | `backend/tests/integration/context-isolation.spec.ts` (`T1259`), against PostgreSQL + pgvector |
| **Observed** | **RED** — 1 failed, 9 passed. `T1259 · search ranks within one workspace partition › C's search returns only C's material, though D's is identical`: `expected [ 'rq_s1', 'rq_s1', 'rq_s2', 'rq_s2' ] to deeply equal [ 'rq_s1', 'rq_s2' ]` — workspace D's identical entries ranked in C's results |
| **Restored** | 10 passed |

Without the predicate the query scans every partition of the parent table. The boundary is the
predicate plus the partition key, and the test that proves it indexes the **same source ids** in
both workspaces — distinct ids would pass against a store that ignored the workspace entirely.

## T1290 — `FR-CTX-035`, `SC-CTX-004` · Epic Exit Criterion

| | |
|---|---|
| **Mutation** | `backend/src/modules/context/assembly.service.ts`: `continue;` inserted at the top of the over-budget branch, so over-budget candidates are dropped **without** an `ExclusionRecord` |
| **Test** | `backend/tests/unit/context-budget.spec.ts` (`T1240`), with the rest of the context unit suite |
| **Observed** | **RED** — 8 failed, 222 passed. Three in `T1240` (`and excludes the rest with reason budget`; `naming the limit and where it was reached`; `and every candidate is accounted for — items + exclusions = candidates`) and five in `T1241` (an essential item dropped by budget no longer refuses — the silent truncation also disarmed `FR-CTX-039`) |
| **Restored** | 17 passed in the two files |

The mutation also broke `FR-CTX-039`, which no one asked this proof to show: an essential item
dropped silently is never seen to have been dropped, so the refusal it should cause never happens.
Silent truncation is not one defect but the disabling of every rule that reads the exclusions.

## T1291 — `R-038-3` · not an Exit Criterion, recorded because it is the research's finding

| | |
|---|---|
| **Mutation** | `backend/src/modules/context/retrieval/search.service.ts`: `requested: this.options.limit` replaced by `requested: candidates.length` — the count that reveals a short read made to agree with whatever came back |
| **Test** | `backend/tests/integration/context-retrieval-shortfall.spec.ts` (`T1280`), against pgvector with a bounded iterative scan |
| **Observed** | **RED** — 2 failed, 4 passed. `with the scan bounded, retrieval returns fewer than requested — and says so`: `expected +0 to be 40`; `and the package carries requested and returned (T1281)`: `expected null to match object { requested: 40 }` — the shortfall vanished from the result and from the package |
| **Restored** | 6 passed |

In this run the bounded scan returned **0 of 40** for a workspace holding 60 matching entries —
the hostile fixture's crowd of 3,000 nearer rows from another workspace exhausted
`hnsw.max_scan_tuples = 200` before one of the requester's rows was reached. With the mutation, that
package would have read as *"nothing was relevant"*. That is the silent failure `R-038-3` names.
