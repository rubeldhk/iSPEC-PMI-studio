# Contract: Engineering Context API

**Epic**: `EPIC-038` · **Feeds**: [plan.md](./plan.md) · **Model**: [data-model.md](./data-model.md)

Every capability is callable without the screen (`PP-007`). The screen consumes exactly these
routes and adds nothing of its own.

**Refusal convention**, inherited from the sibling Epics: `400` for a stated refusal a caller can
act on, `404` for a resource in another workspace (absent rather than forbidden — `FR-002`), `409`
for a conflict with retained state, `503` for a capability that exists and is not currently
answerable. **No route degrades**: where this Epic cannot do its job it says so.

---

## `POST /context/packages`

Assemble a package. `FR-CTX-030`–`FR-CTX-039`.

**Body**: `objective`, `projectId`, `budgetTokens`, `budgetCost`, optional
`essentialSources[]` (`FR-CTX-038`), optional `includeLiveState`.

Actor and permissions come from the session and are **not readable from the body** — the pattern
`EPIC-035` uses so a caller cannot assemble a package in another actor's name.

| Outcome | Status | Why |
|---|---|---|
| Assembled | `201` | Carries items, exclusions and any retrieval shortfall |
| Index unavailable or never built | `503` | `FR-CTX-012` — an unranked package is a different thing, not a degraded one |
| Budget admits nothing | `400` | `FR-CTX-037` |
| An **essential** item was excluded | `400` | `FR-CTX-039` — names the item and the reason |
| No source class is configured for a candidate | included as an **exclusion**, not an error | `FR-CTX-034` — unclassified is excluded, and the package still assembles |

The refusals write a `ContextPackage` row with `state = 'refused'` (`FR-CTX-065`). A refusal that
left no trace would make *"no context was assembled"* and *"assembly was never attempted"*
indistinguishable.

---

## `GET /context/packages/:id`

Inspect one package **as supplied**. `FR-CTX-060`, `FR-CTX-063`.

Returns the retained items, their provenance, **the exclusions**, and a drift note where a source
has moved since. It does **not** re-rank, re-filter or re-resolve anything: re-assembly at read
time answers *"what would it see now"*, which is not what a reviewer is asking.

`404` for another workspace's package.

---

## `GET /context/packages?executionId=`

List packages for an execution. `FR-CTX-062`.

`executionId` is required rather than optional. A workspace-wide listing would answer a question
nobody asked and would become the thing people page through instead of the audit path.

---

## `POST /context/index/reindex`

Re-index changed sources. `FR-CTX-018`, `R-038-6`.

**Body**: `sourceType`, `sourceId`, `sourceVersion`.

Incremental by construction — the route names one source. There is deliberately **no rebuild-all
route**: `R-038-6` records that a corpus rebuild is an operation nobody runs, which is how an index
becomes permanently stale in practice.

| Outcome | Status |
|---|---|
| Indexed, or already current at that version | `200` |
| Source class not `indexable` | `400` — naming the class |
| Embedding capability unbound | `503` — `FR-CTX-013`'s port has no owner in the programme |

---

## `GET /context/index/health`

What the index knows about itself. `FR-CTX-012`, `FR-CTX-017`.

Returns entry count, the live `embeddingModelId`, and **the number of stale entries**. Stale count
is the point: an index that is 40% stale is not a broken index and is not a healthy one, and the
only way anybody finds out is if something reports it.

---

## `GET /context/sources`

The approved source set and its classes. `FR-CTX-015`, `FR-CTX-036`.

Lists each `SourceClass` and whether it is indexable, so *"why is my document never retrieved"* is
answerable without reading configuration files.

---

## Ports this Epic declares

Named here because a contract that hides its dependencies describes a system that cannot fail.

| Port | Filled by | When absent |
|---|---|---|
| `EmbeddingPort` | **unowned** — no provider exists in the programme | **refuse** (`503`). `FR-CTX-013`; assembly and re-indexing both stop |
| `AccessPolicy` | `EPIC-024` | **refuse**. `FR-CTX-054`, `R-038-7` — with no adjudicator every candidate would be included, which is the leak |
| `ExecutionProjections` | `EPIC-037` | **degrade** — execution history drops out of the corpus and the package **records that it did** (`FR-CTX-015`) |
| `LiveStateReader` | the systems that hold it | **degrade** — `FR-CTX-022` requires *unavailable with a reason*, distinguishable from *read and empty* |
| `ArtifactSource` | `EPIC-033`, `EPIC-032` | **refuse** — with no governed documents there is no corpus |

**Two degrade and three refuse**, and the split is the argument. Live state and execution history
are *additions* to a package: missing them makes it smaller, and the package says so. An embedding
model, an access adjudicator or the document corpus are *preconditions*: missing any of them makes
the package wrong rather than smaller, and a wrong package is one nobody can tell is wrong.
