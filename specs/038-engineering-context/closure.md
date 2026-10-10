# EPIC-038 — Engineering Context: Epic closing report

**Tasks**: `T1220`–`T1309` · **Session**: 2026-10-08 · **Constitution IX**

**Status**: `Implemented` — **every implementable task complete; the open tasks are each named under
*Work not done*, with the reason and the owner.** Worked in the dedicated worktree
`.claude/worktrees/epic-038-engineering-context`, branched from `main` at `22d51db`.

## What the Epic delivered

A Context Package is assembled for a stated objective, under an actor's permissions and a budget,
from candidates ranked by meaning; every candidate becomes **either an item or an exclusion with a
reason**, and the package is retained exactly as supplied and inspectable through its own screen.

| Phase | Tasks | What it established |
|---|---|---|
| 1–2 Setup, Foundational | `T1220`–`T1236`, `T1309` | pgvector ≥ 0.8.0; six tables, one partitioned by workspace; CHECKs that refuse what the services refuse; the five ports; the module registered |
| 3 US1 — MVP | `T1237`–`T1246`, `T1306`, `T1307` | Assembly: permission, classification, budget, essential-item refusal, inclusion reasons; `POST /context/packages`, `GET /context/sources` |
| 4 US2 | `T1247`–`T1252` | Provenance: current / superseded-with-successor / undetermined-with-reason |
| 5 US3 | `T1253`–`T1260` | Isolation: the boundary refuses by default; one-way named authorisations; `AccessPolicy` bound to `EPIC-024`; a crossing must cite a **real** authorisation — composite foreign key, enforced by the database |
| 6 US4 | `T1261`–`T1270` | Inspection with no access to an assembler; drift stated, never applied; refusals inspectable; binding to the execution fed, with retention by cascade; the **Context** screen as an application area, not a Room |
| 7 US5 | `T1271`–`T1281`, `T1308` | Retrieval built here: the embedding port (unowned), the index (incremental, version-staleness, no rebuild-all), pgvector search inside a workspace partition with bounded iterative scans; the short read recorded on the package |
| 8 US6 | `T1283`–`T1288` | Live state and execution history — the two ports that degrade, each recording *unavailable with a reason* |
| N Polish | `T1289`–`T1296` | Three mutation proofs; measured performance; boundary confirmations; the Tier 2 conformance check (red, registered); quickstart results |
| Z Closure | `T1297`–`T1304` | This report; the end-to-end run; the five ports verified |
| 9 Convergence | `T1801`–`T1806` | The cost half of the budget enforced; budget policy (retrieval limit, per-candidate estimate, price) moved from constants into `context_budget_policies`, refusing where none is configured; the execution-binding seam proven against PostgreSQL, with the caller recorded against `EPIC-037` |
| 10 Convergence | `T1807`–`T1812` | **The project boundary**: index entries and candidates carry their owning project, another project's material inside the same workspace is excluded as `boundary` unless a named project-to-project authorisation permits it, and the route refuses a blank or foreign `projectId`. **Current versions and text** of requirements and specifications read through their own modules, so staleness, index health and drift notes are real in the running application |
| 11 Convergence | `T1813`–`T1816` | Two spec edge cases: a corpus **stale throughout refuses** (a stored refusal with its stale exclusions) rather than assembling an empty package; and inspection reads `EPIC-037`'s lifecycle, so a package prepared for an execution that **never ran** says nothing consumed it — verified through the composed application |
| 12 Convergence | `T1817`–`T1833` | Found by an **independent audit**: an essential source retrieval never returned now refuses; refusals made before ranking (no index, no budget policy, no such project — the `503` every deployment answers) are stored rows naming no model; a version-reader outage refuses instead of ranking stale material as current, and unknown staleness is counted on the package; a budget that admitted no eligible candidate refuses whatever else was excluded; authorised sources in other workspaces are ranked in their owners' partitions; execution history enters the corpus through `EPIC-037`'s projections; a package assembled ahead of its execution can be bound once (`POST /context/packages/:id/execution`); boundedness is stated on the result and the screen |
| 13 Convergence | `T1834`–`T1845` | From a **second independent audit**: every refusal returns the id of the row that records it, and the screen opens a package by id; an unanswerable index is a `503`, as the contract says, not a `502`; drift and history are read in the workspace that **owns** the source; an all-stale eligible set refuses whatever else was excluded; budgets are validated before anything is read; the configuration write path is decided and recorded (`DEF-038-007`); the contract documents the bind route and `executionId` |
| 14 Convergence | `T1846`–`T1855` | From a **third independent audit**: a named `executionId` must be registered **in the requester's workspace** (the foreign key to `executions(id)` knows no workspace, so a package could be bound to another tenant's execution); the request body is typed and range-checked, never coerced; an index read fault is a `503`; execution history is judged only after boundary and permission, and a project-scoped grant can no longer also cross workspaces; an entry whose vector was never attached is not `current` |
| 15 Convergence | `T1856`–`T1863` | From a **fourth independent audit** (no regressions found): execution history carries its **project** — `EPIC-037`'s public snapshot gained an additive `projectId`, so one project's history no longer enters another's package as workspace-wide material, and a snapshot silent on the project is refused; `objective`, `projectId` and `executionId` are type-checked, never coerced; the screen labels a project crossing as one and gives each open package its own element ids; each item records the classification it was admitted under |
| 16 Convergence | `T1864`–`T1869` | From a **fifth independent audit** (no regressions, no HIGH findings): execution history is all in or all out when `EPIC-037`'s reader fails partway, so a package saying history dropped out contains none; a crossing is classified by the workspace that **owns** it and recorded with that classification; the `201` carries the assembled items and exclusions, as the contract states |
| 17 Convergence | `T1870`–`T1873` | From a **sixth independent audit** — one finding a regression from `T1865`, reproduced: assembly is now **two-pass**. Every check about the material runs first, execution history's availability is settled, and only then is the budget applied, so history that drops out never holds budget another candidate needed. A failing history version read at search now degrades (unknown staleness, left to the history judge) instead of refusing the whole index as a `503` |
| 18 Convergence | `T1874`–`T1879` | From a **seventh independent audit**, all reproduced: the budget pass charges **essential material first**, so assembly refuses only when the budget cannot fit an essential item, never because more relevant items spent it first (items are still presented in ranked order). An outage in a per-candidate port (`classify`, the authorisation lookup, `mayRead`) is now **recorded as a refused package** and rethrown as itself, as a retrieval outage already was. Execution history the history judge verified is no longer counted in `stalenessUnknown`. `T1241`'s fixture and `T1300`'s no-row assertion encoded the old behaviour and were corrected |

## The three mutation observations

Recorded at the moment of observation in [mutation-proofs.md](./mutation-proofs.md).

| Task | Mutation | Observed |
|---|---|---|
| `T1289` (Exit Criterion) | the workspace predicate removed from the pgvector search | `T1259` **red**: another workspace's identical entries ranked in the results. Reverted, green |
| `T1290` (Exit Criterion) | over-budget candidates dropped without an exclusion row | `T1240` **red** (3) — and `T1241` (5): silent truncation also disarmed the essential-item refusal. Reverted, green |
| `T1291` | search reports `requested = returned` | `T1280` **red** (2): the shortfall vanished from result and package. Reverted, green |

## Measured performance (`T1292`, `R-038-10`)

PostgreSQL 16 + pgvector in Testcontainers, developer machine, 50,000 entries in one workspace
partition, p95 of 30 (`backend/tests/integration/context-performance.spec.ts`):

| Target | p95 | Excludes |
|---|---|---|
| Retrieval, < 800 ms | **33.2 ms** | the embedding provider — none exists; the fixture answers in microseconds |
| Assembly, < 2.5 s | **325.7 ms** | the embedding provider; access adjudication (a fixture that permits) |
| Incremental re-index, < 5 s | **20.8 ms** | the embedding provider; reading the source document (a fixture) |
| Screen load, < 1.2 s | **not measured** | a browser figure; nothing here measures it |

After Phase 12 the same suite measured assembly at **560 ms**. Re-measured after Phase 13: retrieval
**34 ms**, assembly **241 ms**, re-index **20 ms**. The 560 ms reading was run-to-run variance on the
development machine, not a regression — recorded here because it was reported before it was understood.

The re-index figure was **1,563 ms** on the first run: `reindex` loaded every entry in the workspace
to find one. A keyed `indexEntryFor` replaced it. Every figure excludes the provider's round trip,
which is the dominant cost once one exists.

## Quickstart

Each scenario run separately and recorded in [quickstart-results.md](./quickstart-results.md):
Scenarios 1–13 **pass** at the service layer against a fixture embedding and real PostgreSQL where
they touch it; **Scenario 14 is not runnable** (below).

## The unowned dependencies (`T1302`)

Restated because this Epic's delivery must not be read as having closed them:

1. **The embedding provider.** `FR-CTX-013`'s `EmbeddingPort` has **no owner anywhere in the
   programme** (`R-038-1`). Retrieval, indexing and assembly are built and tested against a fixture;
   in every deployment `POST /context/packages` and `POST /context/index/reindex` answer **`503`
   naming the seam**. That refusal is the correct behaviour, not a gap in this Epic — and it is why
   `T1301` is blocked and `SC-CTX-006` is unverifiable.
2. **`BR-0163` context-quality feedback** is `U-19` and unowned. Nothing here closes the loop from
   a session's outcome back to what its package contained.
3. **Constitution XII registration.** `EPIC-037` builds the registry; this Epic **reads** it
   (`T1266`, `T1288`), but the commands that produced these artifacts were not registered.

## Defects

| Record | Status | Summary |
|---|---|---|
| [DEF-038-001](./defects/DEF-038-001-governed-types-by-convention.md) | DEFERRED → `EPIC-024` | Requirements, baselines, decisions and execution history carry no grant model, so for them permission is workspace membership |
| [DEF-038-002](./defects/DEF-038-002-consequentiality-not-registered.md) | DEFERRED → `EPIC-037` | The registration records no consequentiality; inspection reports it `undetermined` |
| [DEF-038-003](./defects/DEF-038-003-no-baseline-status-reader.md) | DEFERRED → `EPIC-033` | No reader answers a version's authoritative status; `ProvenanceService` was built and never called — **now called**, and in the deployment every item is `undetermined` naming `EPIC-033` |
| [DEF-038-005](./defects/DEF-038-005-no-actor-role.md) | DEFERRED → `EPIC-024` | The platform has no actor role; packages record `'unspecified'` (`FR-CTX-031`) |
| [DEF-038-006](./defects/DEF-038-006-baselines-and-decisions-not-served.md) | DEFERRED → `EPIC-033`, decisions owner | Baselines and decisions have no read of one version's text, so they cannot enter the corpus (`FR-CTX-015`) |
| [DEF-038-007](./defects/DEF-038-007-no-configuration-write-path.md) | DEFERRED → `EPIC-024` | Source classes, budget policies and authorisations have no write path; routes are withheld until an administration role exists, because today any member could authorise a crossing |
| [DEF-038-004](./defects/DEF-038-004-no-caller-before-execution.md) | DEFERRED → `EPIC-037` | `FR-CTX-030` has no caller: AI runs outside the platform and registers with `EPIC-037`, whose contract would have to ask for a package. The seam is built and proven (`T1805`) |

None is open: each is deferred to the Epic that owns the missing capability.

## Work not done

| Task | Why |
|---|---|
| `T1282` | Ranking **by meaning** needs a real provider; the fixture is deliberately not semantic. The test is written and runs when `CONTEXT_EMBEDDING_MODULE` names one; without it, it is **skipped, not passed** |
| `T1301` | Constitution XI Tier 2 — assembly answers `503` in every deployment, so the journey's first step refuses. `context-transcript.spec.ts` (`T1294`) stands red, registered in `governance/known-red.json`. No transcript was authored |
| `T1305` | Promotion `local → dev` needs explicit authorisation naming the environment |

## Notes for the next reader

- **`T1231` promised an HNSW index in the migration.** It could not be: the `embedding` column is
  dimensionless, because no provider fixes a dimension. `PgVectorIndex.prepare` creates a partial
  expression index per dimension on first use, and a partition per workspace before its first row.
- **`FR-CTX-050`'s project half was found by the second convergence pass**, not the first. The
  boundary built in Phase 5 was the workspace alone; every isolation test passed because every test
  put the two sides in different workspaces. `T1807` puts them in one.
- **`EPIC-037`'s `ExecutionSnapshot` gained an optional `projectId`** (`T1857`) — an additive change to
  another Epic's contract package, asserted in its own `execution-parity` suite. Optional, so no
  existing producer or consumer changed shape.
- **The shell area counts changed** (`context` promoted to delivered: 7 / 2 / 9 / 0). `EPIC-031`'s
  branch promotes `decision-inbox` the same way; whichever merges second must recount.
- **`T1280` sets `enable_sort = off` for its test database.** At fixture size the planner rightly
  takes the exact path and nothing is short; at production size it takes the HNSW scan, which is the
  path under test. The test asserts the plan it measured.

## Budget policy is now required configuration

Since `T1804`, a workspace with no row in `context_budget_policies` **refuses** assembly with a `400`
naming `FR-CTX-036`. No seed or operator route creates one yet; a deployment must insert it. That is
the requirement working as written — budget numbers are configuration — and it is stated here so
nobody mistakes the refusal for a fault.

## Amendment A-038-1 — 2026-10-09

`FR-CTX-015` now admits `knowledge-entry` (approved knowledge, `EPIC-048` Governed Learning) to the
closed approved source set; approved by the Project Owner in chat on 2026-10-09. Tasks
`T2520`–`T2527` (`T2528`–`T2539` reserved, unused).

- **Admitted** by the type system (`ApprovedSourceType`, `APPROVED_SOURCE_TYPES`,
  `KNOWLEDGE_ENTRY_SOURCE_TYPE` in `retrieval/index.service.ts`) and by configuration: a workspace
  that registers an indexable `knowledge-entry` source class can index one; without that class it is
  refused as before (`FR-CTX-034`).
- **Nothing produces one yet.** The sources adapter serves no knowledge entry, so re-indexing one in
  the running application indexes nothing; and assembly excludes any `knowledge-entry` candidate as
  `permission`, detail *admission port unbound*, after the boundary and before the access check —
  the position `EPIC-048`'s `KnowledgeAdmission` will take. This fail-closed branch is the one piece
  of `A-038-2`'s behaviour built here, because without it a ranker could supply a knowledge entry
  nobody had judged. The port itself, and the adapter and provenance branches, remain `A-038-2`.
- **Unchanged**: assembly for every other class. The only visible difference elsewhere is the wording
  of the out-of-set refusal, which now names knowledge entries.
- **Verified**: typecheck clean; lint clean on the four changed source and test files; context unit
  tests 68 files, 351 tests passing (7 new); the 12 context integration specs, run one file at a
  time against PostgreSQL: 138 passed, 3 skipped (`context-relevance`, `T1282`, provider-gated as before).

## Recommended next command

`/speckit-converge EPIC-038` — to confirm nothing further remains. The three open tasks
(`T1282`, `T1301`, `T1305`) wait on an embedding provider and on an authorised promotion.
