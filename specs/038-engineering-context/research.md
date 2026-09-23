# Phase 0 Research: Engineering Context

**Epic**: `EPIC-038` · **Session**: 2026-08-31 · **Feeds**: [plan.md](./plan.md)

The clarification of 2026-08-31 decided that this Epic **builds** semantic retrieval rather than
integrating one. Everything below follows from that: eight of these eleven decisions would not
exist under the alternative.

---

## R-038-1 — The index lives in PostgreSQL, not in a separate vector database

**Decision**: store embeddings in the existing PostgreSQL instance using `pgvector`. No new
datastore is introduced.

**Rationale**. Three reasons, in order of weight.

**The isolation predicate must be evaluated in the same query as the similarity search.**
`FR-CTX-050` is the requirement this Epic cannot get wrong, and a separate vector service means the
workspace filter is applied either before the search (by pre-partitioning the query) or after it
(by discarding results) — in a different process, against a different copy of the authorisation
facts. `EPIC-032` already refuses to read around artifact access for exactly this reason, and
`FR-CTX-054` forbids a second access model.

**A separate store is a second copy of the corpus.** Every governed document and execution record
would exist in PostgreSQL and again in the vector store, with no transaction spanning them. The
staleness problem `FR-CTX-017` already has to solve would acquire a second, invisible form: an
entry that is current in one store and gone from the other.

**It is the datastore this repository already runs.** `ADR-0003` puts persistence in PostgreSQL
through Prisma, and every Epic to date has followed it.

**Alternatives considered.** *A dedicated vector database* — rejected on the three grounds above;
the operational argument for one (scale) is answered by `R-038-10`'s measured targets, and can be
revisited if they are missed. *Full-text search instead of embeddings* — rejected: `BR-0091` says
**semantic** retrieval, and lexical search answers a different question.

**Docs consulted**: Context7 `/pgvector/pgvector` — *index types and filtering by a tenant column*.
`/pgvector/pgvector-node` is recorded for the Prisma binding when implementation needs it.

---

## R-038-2 — The workspace filter is a partition, not a `WHERE` clause bolted onto an ANN scan

**Decision**: partition the embedding table by workspace. Enable iterative index scans. Do **not**
rely on a plain `WHERE workspaceId = $1` against a single global HNSW index.

**Rationale — and this is the finding that most changed the design.** pgvector's own documentation
states that with an approximate index, **filtering is applied *after* the index scan**:

> *"Approximate indexes like HNSW are suitable when filter conditions match a high percentage of
> rows. Filtering is applied after the index scan, so if a condition is restrictive, iterative index
> scans can be enabled."*

and, under troubleshooting *"why are there less results after adding an HNSW index"*, that results
are bounded by `hnsw.ef_search` (default **40**) and reduced further by filtering conditions.

**A workspace filter is the restrictive case, by construction.** In a multi-tenant corpus each
workspace is a small fraction of the whole, so the top-`ef_search` neighbours of a query are mostly
other workspaces' rows — discarded after the scan, leaving **fewer candidates than asked for, with
nothing saying so**.

That is this Epic's own failure mode arriving one layer below where it was specified. `FR-CTX-035`
forbids a package that silently drops material; a retrieval layer that silently returns eight
candidates instead of forty produces exactly that, and the package looks complete because it names
no exclusions — there were none to name, the material never reached the assembler.

The documentation gives both remedies, and this Epic takes both:

| Remedy | Where it applies |
|---|---|
| **Partitioning by the filter column** — recommended *"if the dataset requires filtering by many different values"* | Workspaces are many by definition |
| **`hnsw.iterative_scan`** — *"automatically scans more of the index until the requested number of results is found"* | Belt beside the braces, for filters inside a workspace (source class, classification) |

**Alternatives considered.** *Partial indexes per workspace* — the documentation recommends these
when filtering by *a few* distinct values; a tenant column is the opposite case, and one index per
workspace does not survive growth. *Over-fetching and post-filtering in the application* — rejected:
it is the behaviour above, moved somewhere it is harder to see, and it makes the isolation boundary
an application concern rather than a storage one.

**Docs consulted**: Context7 `/pgvector/pgvector` — *filtering with HNSW, partial indexes vs
partitioning*; *iterative index scans and why a filtered query returns fewer rows than the limit*
(iterative scans shipped in 0.8.0, 2024-10-30 — so the version floor is **pgvector ≥ 0.8.0**).

---

## R-038-3 — A short result set is a finding, never an answer

**Decision**: retrieval reports the number of candidates it was asked for and the number it
returned. Where it returns fewer, assembly records a **retrieval shortfall** on the package.

**Rationale**. `R-038-2` reduces the frequency of short reads; it cannot eliminate them, because
`ef_search`, dead tuples and unindexed zero vectors all bound a scan. So the shortfall must be
*visible* rather than merely rare.

This is `FR-DFR-064`'s rule from `EPIC-035`, one Epic over: **an unknown set and an empty set must
not behave alike.** "These are the ten most relevant items" and "these are the eight the index
happened to surface" are different claims, and only one of them is what the reader assumes.

**Alternatives considered**. *Retry with a larger `ef_search` until the count is met* — rejected as
the sole mechanism: it hides the condition rather than reporting it, and an unbounded retry is a
latency cliff. It is a reasonable *addition* under `R-038-10`'s budget, with the shortfall still
recorded when the retry does not close the gap.

**Docs consulted**: as `R-038-2`.

---

## R-038-4 — One embedding model per index, and a model change is a re-index

**Decision**: every index entry records the **model identifier** and **dimension** that produced
it. One model is active at a time. Changing the model is an explicit re-index, never a
configuration flip.

**Rationale**. `FR-CTX-013` requires the embedding model to sit behind a boundary. The concrete
consequence is sharper than that wording suggests: a `vector` column has a **fixed dimension**, so
two models of different dimensions cannot share one — and two models of the *same* dimension are
worse, because they produce incomparable spaces that the database will happily compute distances
across. Mixed entries do not error. They rank nonsense.

Recording the model on the entry makes the mixture detectable; refusing to query across models
makes it impossible.

**Alternatives considered.** *A dimension-agnostic column* — pgvector has no such type. *Multiple
live models with a model predicate on every query* — rejected for this Epic: it doubles the index
and the only use case (comparing model quality) is not a requirement here.

**Docs consulted**: Context7 `/pgvector/pgvector` — *vector column dimensions and index types*.

---

## R-038-5 — Staleness is decided by source version, never by timestamp

**Decision**: an index entry stores the **version** of the source it was built from.
`FR-CTX-017`'s staleness is `entry.sourceVersion ≠ source.currentVersion`.

**Rationale**. A timestamp comparison answers *"which is newer"*, which is not the question. Clock
skew, a re-save with no content change, and a backfill all move a timestamp without changing
meaning; a corrected document restored from history changes meaning without moving one forward.
This programme already versions every governed artifact (`PP-012`), so the honest comparison is
available for free.

**Alternatives considered.** *Content hashing* — a reasonable second signal, and rejected as the
primary one because it cannot distinguish *"unchanged"* from *"changed back"*, which matters when
the intervening version is what somebody cited.

**Docs consulted**: none needed — internal to this repository's versioning.

---

## R-038-6 — Re-indexing is incremental, keyed on the version that changed

**Decision**: `FR-CTX-018` is satisfied by re-embedding only entries whose source version moved.

**Rationale**. A corpus rebuild is an operation nobody runs, which means it is an operation that
does not happen, which means the index is permanently stale in practice. The cost of embedding is
per-item and the change set is small; making the cheap path the only path is what keeps it current.

**Docs consulted**: none needed.

---

## R-038-7 — Workspace scoping is not authorisation, and this Epic must not confuse them

**Decision**: the partition predicate (`R-038-2`) bounds *which rows exist for this query*.
Authorisation — whether **this actor** may read **this item** — is adjudicated by `EPIC-024` on
every candidate, after retrieval and before inclusion.

**Rationale**. They look like the same check and are not. Workspace scoping is a property of the
data; authorisation is a property of the actor. A system that treats the partition as the
permission grants every member of a workspace everything in it, which is precisely the flavour of
mistake that produces a leak nobody notices, because the boundary it *does* enforce is visibly
working.

`FR-CTX-054` states the rule; this decision records why the cheap conflation is available and must
be refused.

**Alternatives considered.** *Filter by permission in the SQL predicate* — rejected: it would put a
copy of `EPIC-024`'s model into this Epic's queries, and `FR-CTX-054` exists to prevent exactly
that.

**Docs consulted**: none needed.

---

## R-038-8 — Execution history is read through projections, not the event stream

**Decision**: `FR-CTX-015`'s execution-history half is indexed from `EPIC-037`'s **current-state
projections**, not by subscribing to its immutable event stream.

**Rationale**. `EPIC-037` makes events authoritative and projections rebuildable. Indexing the
event stream would make this Epic a second consumer that must replay and interpret event semantics
it does not own — and every vocabulary change there would silently change what is retrievable here.
Projections are the surface `EPIC-037` offers for reading current state, and a rebuilt projection
simply reindexes.

**Alternatives considered.** *Index the event stream directly* — rejected above. *Do not index
execution history at all* — rejected by the clarification: `EPIC-037` deferred context retrieval
over execution history to this Epic, and dropping it would orphan that deferral.

**Docs consulted**: none needed — internal to `EPIC-037`'s specification.

---

## R-038-9 — Retention is inherited, not configured

**Decision**: a Context Package is retained exactly as long as the execution it fed
(`FR-CTX-066`), by deletion cascade from the execution record rather than by its own policy.

**Rationale**. Two retention policies over one audit trail produce a window in which the execution
is inspectable and its context is gone — the state `BR-0096` exists to prevent. Inheriting means
the two cannot drift, and there is no second policy to configure wrongly.

**Alternatives considered.** *Independent retention* — rejected above. *Never delete* — rejected:
packages embed material whose own retention the platform does not control.

**Docs consulted**: none needed.

---

## R-038-10 — Performance targets (`PP-018`, now this Epic's)

The 2026-08-31 clarification moved `PP-018` from Deferred to Partial. These are the figures.

| Operation | Target | Excluding |
|---|---|---|
| Retrieval over 50,000 indexed entries | **p95 < 800 ms** | embedding the query |
| Package assembly, retrieval included | **p95 < 2.5 s** | the embedding call |
| Embedding one source item | **p95 < 1.5 s** | — measured, not bounded by this Epic |
| Incremental re-index of one changed source | **p95 < 5 s** | — |
| Inspection screen load | **p95 < 1.2 s** | the figure `EPIC-033` set and `EPIC-034` and `EPIC-035` adopted, because it is the same shell |

**Why 50,000**: the governed-document corpus of this repository is in the low thousands; execution
history (`R-038-8`) is what grows, and 50,000 is roughly a year of it at the current rate. The
number is stated so it can be wrong and revised, rather than left as *"scales well"*.

The embedding call is excluded from the two package targets for the reason `EPIC-035` excluded
model time from triage: it is a provider's latency, and quoting it as this Epic's would describe
something this Epic cannot influence.

**Docs consulted**: none needed — targets, not techniques.

---

## R-038-11 — The screen is an application area, not a Room

**Decision**: Context is an area registered in `EPIC-036`'s application shell. It declares **no
workflow type**, and does not consume `EPIC-033`'s `RoomShell`.

**Rationale**. `FR-CTX-070`, clarified 2026-08-31. The three Rooms exist because requirements,
changes and defects each move through states a person decides on, with stages, gates and
authorities. A Context Package is assembled, used and inspected; there is no decision in its life,
so a workflow type would introduce stages nobody needs and gates nobody asked for.

**Alternatives considered.** *A fourth Room* — rejected above. *A panel inside `EPIC-037`'s
execution view* — rejected by the clarification: PMI-DOC-006 §4.1 names Context as an application
**area**, and burying it inside another Epic's screen would leave the area undeclared again, which
is the condition the 2026-08-25 ownership declaration was written to end.

**Docs consulted**: none needed.

---

## Summary of external dependencies

| Dependency | Context7 library ID | Version floor | Consulted for |
|---|---|---|---|
| pgvector | `/pgvector/pgvector` | **≥ 0.8.0** (iterative scans) | `R-038-1`, `R-038-2`, `R-038-3`, `R-038-4` |
| pgvector Node/Prisma binding | `/pgvector/pgvector-node` | — | recorded for implementation; not yet queried |

Context7 was available for this session and every external decision above is grounded in it. No
decision is marked *unverified against current docs*.
