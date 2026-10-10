# EPIC-038 — Quickstart results

**Run**: 2026-10-08, each scenario separately (`T1295`), against Testcontainers PostgreSQL
`pgvector/pgvector:pg16` (pgvector ≥ 0.8.0) where the scenario touches the database.

## What "against a fixture embedding" means here

No embedding provider exists in the programme (`R-038-1`), so `POST /context/packages` answers
`503` in every deployment. Scenarios 1–13 therefore run at the **service** layer, with the
assembly, index and search services wired to a deterministic letter-bag fixture embedding
(`backend/tests/helpers/context-retrieval-fixtures.ts`) and — for 7, 8, 9–10 and 11 — the real
PostgreSQL tables, constraints and partitions. The HTTP status codes the quickstart names for
Scenarios 1, 4 and 5 (`201`, `400`) are the service results that the controller would map; they were
**not observed over HTTP**, because the route refuses first. What *was* observed over HTTP is the
refusal itself (`503` naming `EmbeddingPort`), the inspection routes and the index routes —
`backend/tests/integration/context-assembly-route.spec.ts`.

| # | Scenario | Run | Result |
|---|---|---|---|
| 1 | A package is assembled from all six inputs | `tests/unit/context-assembly.spec.ts` | **9 passed** — service layer; `201` not observed over HTTP |
| 2 | An unreadable item is excluded, and the exclusion recorded | `tests/unit/context-permission-exclusion.spec.ts` | **6 passed** |
| 3 | An unclassifiable source is excluded, not admitted | `tests/unit/context-classification.spec.ts` | **8 passed** |
| 4 | A bounded package names what it dropped | `tests/unit/context-budget.spec.ts` | **8 passed** — items + exclusions = candidates; mutation `T1290` turned it red |
| 5 | An excluded essential item refuses the assembly | `tests/unit/context-essential.spec.ts` | **9 passed** — refused row stored; `400` not observed over HTTP |
| 6 | A superseded item names its successor | `tests/unit/context-superseded.spec.ts` | **5 passed** |
| 7 | Unresolvable reads *undetermined*, never *current* | `tests/unit/context-undetermined.spec.ts` + `tests/integration/context-constraints.spec.ts` | **28 passed** — the CHECK refuses the row around the service |
| 8 | Nothing crosses a workspace boundary | `tests/integration/context-isolation.spec.ts` | **10 passed** — and **seen to fail** with the partition predicate removed (`T1289`) |
| 9–10 | An authorised source crosses and says so; an unauthorised one does not | `tests/unit/context-reusable-source.spec.ts`, `context-authorisation-direction.spec.ts`, `tests/integration/context-authorisation-constraints.spec.ts` | **22 passed** — the database refuses a crossing citing a missing, misdirected or mismatched authorisation |
| 11 | A short retrieval is reported, not absorbed | `tests/integration/context-retrieval-shortfall.spec.ts` | **6 passed** — 3,060 rows; the bounded scan returned fewer than 40 of 60 available, and the package carries both counts. Mutation `T1291` turned it red |
| 12 | A changed source is stale until re-indexed; re-indexing is incremental | `tests/unit/context-staleness.spec.ts`, `context-reindex.spec.ts` | **13 passed** — service layer with a fixture version reader; in the deployment no reader is bound, so `GET /context/index/health` reports the stale count as unknown (`null`) |
| 13 | Inspection shows what was supplied | `tests/unit/context-inspection.spec.ts`, `context-drift.spec.ts` | **9 passed** |
| 14 | Constitution XI Tier 2: the journey, keyboard-only | — | **NOT RUNNABLE.** The journey's first step, assembly, answers `503` because `EmbeddingPort` has no owner. No transcript was written in its place; `backend/tests/architecture/context-transcript.spec.ts` (`T1294`) stands red and is registered in `governance/known-red.json`. `SC-CTX-006` is unverified |

## Not run

- **`T1282`, ranking by meaning** (`tests/integration/context-relevance.spec.ts`): skipped, not
  passed. It needs a real embedding provider (`CONTEXT_EMBEDDING_MODULE`), and the fixture is
  deliberately not semantic — a pass against it would prove nothing about `BR-0091`.
- **Screen load p95** (`R-038-10`): a browser figure, not measured by `T1292`.
