# Quickstart: Engineering Context

**Epic**: `EPIC-038` · **Validates**: [spec.md](./spec.md) · **Contract**:
[contracts/context-api.md](./contracts/context-api.md)

Fourteen scenarios. Each is run and recorded **individually** at `/speckit-implement`'s polish
phase — a combined run reports one number, and one number cannot say which scenario passed.

## Prerequisites

```bash
pnpm install
docker compose up -d postgres
pnpm --filter backend prisma migrate deploy
```

The PostgreSQL image **must carry the `pgvector` extension at ≥ 0.8.0** (`R-038-2` — the release
that added iterative index scans). A stock `postgres:16-alpine` will fail the migration, and that
failure is the correct outcome rather than something to work around.

```bash
pnpm test
```

---

### Scenario 1 — A package is assembled from all six inputs

`FR-CTX-030`–`FR-CTX-032`. Assemble against an objective with a role, permissions, classifications,
relevance and a budget. **Expect**: `201`, and the stored row records the objective, actor, role and
budget it was assembled under.

### Scenario 2 — An item the actor may not read is excluded, and the exclusion is recorded

`FR-CTX-033`. **Expect**: the item is absent from `items`, present in `exclusions` with
`reason = 'permission'`. The negative half matters more than the positive: check the exclusion
exists, not merely that the item is missing.

### Scenario 3 — An unclassifiable source is excluded, not admitted

`FR-CTX-034`. Offer a candidate whose `sourceType` has no `SourceClass`. **Expect**: excluded with
`reason = 'classification'`, and the package still assembles.

### Scenario 4 — A bounded package names what it dropped

`FR-CTX-035`. Set a budget smaller than the candidate set. **Expect**: `201`, `exclusions` carrying
`reason = 'budget'` for each dropped item. **Zero silent truncation** — the count of candidates
must equal items + exclusions.

### Scenario 5 — An excluded essential item refuses the whole assembly

`FR-CTX-038`, `FR-CTX-039`. Mark a source essential and set a budget that cannot fit it.
**Expect**: `400` naming the item and the reason, and a `ContextPackage` row with
`state = 'refused'`.

### Scenario 6 — A superseded item says so, and names its successor

`FR-CTX-042`, `FR-CTX-043`. Include material from a superseded baseline. **Expect**:
`authoritativeStatus = 'superseded'` with `supersededBy` populated.

### Scenario 7 — An unresolvable status reads *undetermined*, never *current*

`FR-CTX-044`. **Expect**: `authoritativeStatus = 'undetermined'` with a reason. The database CHECK
refuses the row without one — exercise it by going around the service with raw SQL, as
`EPIC-035`'s `T998i` does.

### Scenario 8 — Nothing crosses a workspace boundary

`FR-CTX-050`. Two workspaces, overlapping material, assemble for one. **Expect**: zero items from
the other. Then repeat **with the partition removed** to confirm the test can fail — an isolation
test that has never been seen to fail proves the fixture, not the boundary.

### Scenario 9 — An authorised reusable source crosses, and says it did

`FR-CTX-051`, `FR-CTX-052`. **Expect**: included, `crossBoundary = true`, `authorisationRef`
naming the authorisation.

### Scenario 10 — A reusable source with no authorisation does not cross

`FR-CTX-053`. Remove the authorisation row and repeat Scenario 9. **Expect**: excluded with
`reason = 'boundary'`. The absence of a prohibition is not a permission.

### Scenario 11 — A short retrieval is reported, not absorbed

`R-038-2`, `R-038-3`. Index enough material that a restrictive filter under `hnsw.ef_search`
returns fewer candidates than requested. **Expect**: the package carries a retrieval shortfall with
`requested` and `returned`.

**This is the scenario most worth writing carefully.** It is the one that fails silently in every
other design, and reproducing it requires enough rows that the approximate scan actually bites — a
fixture of ten items will pass whatever the implementation does.

### Scenario 12 — A changed source is stale until re-indexed, and re-indexing is incremental

`FR-CTX-016`–`FR-CTX-018`. Change a source's version. **Expect**: `GET /context/index/health`
reports one stale entry; retrieval marks it stale rather than ranking it as current; re-indexing
that one source clears it **without touching the other entries' `indexedAt`**.

### Scenario 13 — Inspection shows what was supplied, not what would be assembled now

`FR-CTX-063`. Assemble, then change the underlying sources, then inspect. **Expect**: the original
items, with a drift note. If the inspected package changes when the sources change, the
implementation is re-assembling and the requirement is defeated.

### Scenario 14 — Constitution XI Tier 2: the journey, keyboard-only

Carry one objective through **assemble → inspect → follow an exclusion to its reason**, against a
running application, using only a keyboard with focus visible at every step. Commit a
**run-generated** transcript.

**Hand-written evidence is a constitution violation of the first order.** `EPIC-035` recorded why
this matters: its own Tier 2 transcript is still outstanding, and the conformance check fails red
rather than being satisfied by an authored file.

**Note the dependency before planning this run**: `EmbeddingPort` has no owner in the programme
(`FR-CTX-013`), so assembly returns `503` until one is bound. Scenarios 1–13 are runnable against a
fixture embedding; **Scenario 14 is not runnable end to end until an embedding provider exists**,
and that must be stated in the closing report rather than worked around.
