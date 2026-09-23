# Data Model: Engineering Context

**Epic**: `EPIC-038` · **Feeds**: [plan.md](./plan.md) · **Decisions**: [research.md](./research.md)

## 0. The one structural idea

**An absence must be as visible as a presence.**

Every table below exists to keep some *not-there* legible: material excluded, a version that could
not be resolved, a retrieval that came back short. A model without them is smaller and answers the
question *"what is in this package?"* — which is not the question anybody asks a year later. They
ask *"why isn't the thing I expected in it?"*, and only these rows can answer.

---

## 1. `ContextPackage`

| Field | Notes |
|---|---|
| `id`, `workspaceId`, `projectId` | |
| `executionId` | `FR-CTX-062` — the execution this fed. Nullable **only** while assembly is in flight |
| `objective` | `FR-CTX-032` — what it was assembled for, in the requester's words |
| `actorId`, `actorRole` | the permissions the package was filtered against |
| `budgetTokens`, `budgetCost` | `FR-CTX-031` — the budget it was assembled under |
| `state` | `assembled` \| `refused` |
| `refusalReason` | `FR-CTX-065` — required when `state = 'refused'`, CHECKed |
| `embeddingModelId` | `R-038-4` — which model ranked this package's candidates |
| `assembledAt` | |

**Retained, never recomputed** (`FR-CTX-063`). `EPIC-034`'s retained impact view is the same shape
for the same reason: *"what did this decision see"* and *"what would it see now"* are different
questions, and re-assembly answers the second while appearing to answer the first.

**Retention is inherited** (`FR-CTX-066`, `R-038-9`): the row is deleted with the execution it fed,
by cascade rather than by a policy of its own. Two policies over one audit trail produce a window
where the execution is inspectable and its context is gone.

A **refused** package is a row, not an absence. `FR-CTX-065` requires the refusal to be
inspectable, and a session that ran without context is a fact somebody needs to see.

---

## 2. `PackageItem`

| Field | Notes |
|---|---|
| `id`, `packageId` | |
| `sourceType`, `sourceId` | `FR-CTX-040` — the reference |
| `sourceVersion` | the version included |
| `authoritativeStatus` | `current` \| `superseded` \| `undetermined` — **required** |
| `supersededBy` | required when `superseded`, CHECKed |
| `undeterminedReason` | required when `undetermined`, CHECKed |
| `inclusionReason` | `FR-CTX-064` — the objective term or rule that selected it (`PP-016`) |
| `relevanceScore` | `FR-CTX-014` |
| `crossBoundary` | `FR-CTX-052` — true only for an authorised reusable source |
| `authorisationRef` | required when `crossBoundary`, CHECKed |

**No content column.** `FR-CTX-041`: an item points at its source. A copy here would be a second
source that can disagree, and would put material under this Epic's access rules rather than the
artifact's — `EPIC-035`'s `T997m` bans the same thing one Room over, and for the same reason.

**`authoritativeStatus` has no default.** `FR-CTX-044` forbids *undetermined* reading as *current*,
and a default is how it would: the column would fill with `current` for every item whose status
nobody resolved.

---

## 3. `ExclusionRecord` — **the load-bearing table**

| Field | Notes |
|---|---|
| `id`, `packageId` | |
| `sourceType`, `sourceId` | what was considered |
| `reason` | `permission` \| `classification` \| `budget` \| `boundary` \| `stale` — required |
| `detail` | the specific rule or limit, in words |
| `wasEssential` | `FR-CTX-038` — whether the excluded item was marked essential |

Without this table an empty package and a heavily filtered one are the same row with no children,
and the only honest answer to *"why is the security policy not in here?"* is *"nobody knows"*.

`wasEssential` is on the exclusion rather than only on the candidate, because `FR-CTX-039`'s
refusal must be explainable **after** the fact: the package refused, and this is the item that
caused it.

---

## 4. `SourceClass`

| Field | Notes |
|---|---|
| `id`, `workspaceId` | |
| `sourceType` | which class of approved source |
| `securityClassification` | what `FR-CTX-034` reads |
| `indexable` | whether it enters the corpus at all (`FR-CTX-015`) |

Configuration, per `PP-014` and `FR-CTX-036`. A source type absent from this table is **not
classified**, and `FR-CTX-034` excludes it — the absence of a class is not a permissive default.

---

## 5. `ReusableKnowledgeAuthorisation`

| Field | Notes |
|---|---|
| `id`, `sourceType`, `sourceId` | the one source authorised to cross |
| `fromWorkspaceId`, `toWorkspaceId` | the boundary it may cross, in one direction |
| `authorisedBy`, `authorisedAt`, `rationale` | who decided, and why |

`FR-CTX-051`–`FR-CTX-053`. Directional deliberately: *A may read B's handbook* does not imply the
reverse, and a symmetric row would grant a permission nobody stated.

**No row means no crossing.** `FR-CTX-053` — the absence of a prohibition is not a permission.

---

## 6. `IndexEntry` — **partitioned by workspace**

| Field | Notes |
|---|---|
| `id`, `workspaceId` | **the partition key** (`R-038-2`) |
| `sourceType`, `sourceId` | what is indexed |
| `sourceVersion` | `FR-CTX-016`, `R-038-5` — staleness is a version comparison, never a timestamp |
| `embeddingModelId`, `dimension` | `R-038-4` — mixed models rank nonsense without erroring |
| `embedding` | the `vector` column |
| `indexedAt` | |

**Partitioned, not filtered.** pgvector applies a `WHERE` clause **after** an approximate index
scan, bounded by `hnsw.ef_search`, so a workspace predicate against one global index silently
returns fewer candidates than requested (`R-038-2`). Partitioning makes the boundary a property of
where the row lives rather than of what the query remembered to say.

**`embeddingModelId` is on the row, not in configuration alone.** Two models of the same dimension
produce incomparable spaces and the database computes distances across them happily. Recording the
model makes a mixture detectable; refusing to query across models makes it impossible.

---

## 7. Derived, not stored

- **`RetrievalOutcome`** — `requested` and `returned` counts, carried with the candidate list and
  written onto the package as a shortfall when they differ (`R-038-3`). Not a table: it describes
  one retrieval, and the package records the consequence.
- **Staleness** — computed as `entry.sourceVersion ≠ source.currentVersion`. A stored `isStale`
  flag would be a second place the answer lives, and the two would disagree the first time a source
  moved without the flag being swept.

---

## 8. What this Epic deliberately does not model

| Not modelled | Whose it is |
|---|---|
| Requirement, specification and evidence **content** | `EPIC-033`, `EPIC-032` — items are references (`FR-CTX-041`) |
| Access rules and role adjudication | `EPIC-024` (`FR-CTX-054`, `R-038-7`) |
| The execution lifecycle and its events | `EPIC-037` — read through projections (`R-038-8`) |
| The embedding model, its API and its versions | **unowned** — behind `embedding.port.ts` (`FR-CTX-013`) |
| Live engineering state itself | the systems that hold it; read through a port (`FR-CTX-020`–`FR-CTX-023`) |
| Context-quality feedback | `BR-0163`, `U-19`, **unowned** |

---

## Counts

**6 tables** — `ContextPackage`, `PackageItem`, `ExclusionRecord`, `SourceClass`,
`ReusableKnowledgeAuthorisation`, `IndexEntry` (partitioned). **2 derived values** (§7).
**0 stored source payloads.** One `vector` column, in one table.
