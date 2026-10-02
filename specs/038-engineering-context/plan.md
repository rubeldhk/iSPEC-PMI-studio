# Implementation Plan: Engineering Context

**Epic**: `EPIC-038` · **Branch**: `038-engineering-context` · **Date**: 2026-08-31

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## Summary

A Context Package is assembled before a governed AI session, from an objective, an actor's
permissions, the security classification of each candidate, semantic relevance and a cost budget.
Every item says where it came from and whether it is still authoritative; nothing crosses a tenant
boundary without a named authorisation; and a reviewer can later see **what was actually supplied**,
not what would be assembled now.

The 2026-08-31 clarification decided this Epic **builds** retrieval rather than integrating it, so
indexing, embedding, ranking, staleness and incremental re-indexing are in scope and are the bulk
of the engineering. The design puts the index in PostgreSQL via `pgvector`, **partitioned by
workspace**, because the documented behaviour of a filtered approximate scan — filtering applied
*after* the index scan — would otherwise silently return fewer candidates than asked for
(`R-038-2`). That is this Epic's own failure mode one layer down, and the plan treats it as the
central risk rather than a tuning detail.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS 10, Prisma 5.22, **`pgvector` ≥ 0.8.0** (the version that added
iterative index scans — `R-038-2`). Consumes `EPIC-024` (access), `EPIC-032` (attestation shape),
`EPIC-036` (application shell), `EPIC-037` (execution registration and history projections).

**Storage**: PostgreSQL 16 via Prisma (`ADR-0003`). **6 new tables**, one of them
**partitioned by workspace** and carrying a `vector` column. No table stores requirement,
specification or evidence *payload* — items are references (`FR-CTX-041`), and the only content
this Epic stores is the embedding it computed.

**Testing**: Vitest 2.1 — `backend-unit`, `backend-integration`, `architecture`, `frontend`.
Integration tests use Testcontainers with a PostgreSQL image **carrying the `pgvector` extension**,
gated by `DOCKER_UNAVAILABLE=1` as the sibling Epics are.

**Target Platform**: Linux server + browser. **This Epic delivers a journey** (assemble → inspect),
so Constitution XI Tier 2 applies.

**Project Type**: Backend module + one application-shell **area** (`R-038-11`) — deliberately not a
Room, and declaring no workflow type.

**Performance Goals**: retrieval over 50,000 entries p95 < 800 ms; assembly p95 < 2.5 s; incremental
re-index p95 < 5 s; screen load p95 < 1.2 s. Full table and the reasoning for each exclusion:
`R-038-10`.

**Constraints**: the workspace boundary is enforced by **partition**, not by a `WHERE` clause on a
global index (`R-038-2`); authorisation is `EPIC-024`'s and is a **separate** check from workspace
scoping (`R-038-7`); one embedding model is live at a time and a model change is a re-index
(`R-038-4`).

**Scale/Scope**: 50,000 indexed entries as the design point (`R-038-10`), six functional groups,
one screen, one Tier 2 journey.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — `BR-0091`–`BR-0096`; the five screen requirements are marked as deriving from the shell pattern |
| III | Epic → Feature → Task; `specs/038-engineering-context/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test | **PASS** — planned in `/speckit-tasks` |
| VI | `specs/038-engineering-context/defects/` is the sole defect intake | **PASS** — created in Setup |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — and promotion needs explicit authorisation, as `EPIC-035`'s closure recorded |
| VIII | Session labelled with the working Epic | **PASS** |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-08-31; one follow-up round used to disambiguate a single-letter reply |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1 through the real HTTP routes; Tier 2 applies and is planned |
| XII | Governed commands registered in PMI Studio before executing | **PARTIAL** — see Complexity Tracking |
| — | Repository synced from GitHub before work started | **PASS** |
| — | No other Claude session active on this checkout | **PASS** |

**Post-Phase 1 re-check**: unchanged. The design added no gate risk — the one structural decision
that could have (a separate vector store) was rejected in `R-038-1` partly on Gate II and
`FR-CTX-054` grounds.

## Project Structure

### Documentation (this feature)

```
specs/038-engineering-context/
├── spec.md
├── plan.md              ← this file
├── research.md          R-038-1 … R-038-11
├── data-model.md        6 tables, 1 partitioned
├── contracts/
│   └── context-api.md   the callable surface
├── quickstart.md        validation scenarios
├── checklists/
│   └── requirements.md
└── defects/             Constitution VI intake (created in Setup)
```

### Source Code (repository root)

```
backend/src/modules/context/
├── context.module.ts            composition; ports bound or refusing
├── context.tokens.ts            the ports, and what each absence does
├── package.types.ts             ContextPackage, PackageItem, ExclusionRecord
├── assembly.service.ts          FR-CTX-030…039 — the six inputs, and the refusals
├── provenance.service.ts        FR-CTX-040…044 — source, version, authoritative status
├── isolation.ts                 FR-CTX-050…054 — the boundary, and why scoping ≠ authorisation
├── retrieval/
│   ├── index.service.ts         FR-CTX-016…018 — build, version, staleness, incremental
│   ├── search.service.ts        FR-CTX-010…014 — ranking, shortfall reporting
│   └── embedding.port.ts        FR-CTX-013 — the model boundary
├── inspection.service.ts        FR-CTX-060…066 — as supplied, never re-assembled
├── context.controller.ts        the routes in contracts/context-api.md
├── context.store.ts             interface + in-memory (unit tests only)
└── context.store.prisma.ts      the PostgreSQL adapter, from the first commit

backend/prisma/migrations/
└── <ts>_epic038_context/        6 tables; hand-written partitioning and vector DDL

frontend/src/pages/Context.tsx   the inspection screen — an area, not a Room
```

## Phase 0 — Research

Complete: [research.md](./research.md), eleven decisions, every external one grounded in Context7
(`/pgvector/pgvector`, version floor **0.8.0**).

The one that reshaped the plan is `R-038-2`. pgvector's documentation states that filtering with an
approximate index is applied **after** the scan, bounded by `hnsw.ef_search` (default 40) — so a
workspace predicate, which is restrictive by construction in a multi-tenant corpus, silently yields
fewer candidates than requested. A retrieval layer that quietly returns eight of forty produces a
package that **names no exclusions because the material never arrived**, which is `FR-CTX-035`'s
prohibition defeated from below. Hence partitioning plus iterative scans, and `R-038-3`'s rule that
a short read is recorded rather than accepted.

## Phase 1 — Design & Contracts

Complete: [data-model.md](./data-model.md), [contracts/context-api.md](./contracts/context-api.md),
[quickstart.md](./quickstart.md).

**Three shapes carry the guarantees**, in the pattern `EPIC-035` established of making the failure
unrepresentable rather than merely forbidden:

| Guarantee | The shape |
|---|---|
| An absent item is never invisible | `ExclusionRecord` is a table, not a log line. An empty package and a filtered one are distinguishable by construction |
| *Undetermined* never reads as *current* | `authoritativeStatus` is a required union whose `current` arm exists only alongside a resolved source version |
| A short retrieval is a finding | `RetrievalOutcome` carries `requested` and `returned`; the assembler cannot obtain candidates without also obtaining the counts |

## Complexity Tracking

| Item | Why it is here | Disposition |
|---|---|---|
| **Gate XII is PARTIAL** | Constitution XII requires governed commands to be registered in PMI Studio before they execute. `EPIC-037` builds that registry and is itself only specified. The commands producing this Epic's artifacts are therefore unregistered | Recorded, not waived. It is the same programme-level gap `EPIC-035` carried, and it closes when `EPIC-037` ships |
| **This Epic builds retrieval** | Overturns the default that every comparable dependency follows: a port with no implementation. It is the largest scope decision in the Epic | Taken deliberately on 2026-08-31 with the alternative stated. `PP-018` moved Deferred → Partial as a direct consequence |
| **A partitioned table** | The only partitioned table in the repository, and partitioning is hard to reverse | Justified by `R-038-2`: the alternative silently under-returns, and silence is the failure this Epic exists to prevent |
| **`pgvector` is a new extension** | Adds an extension requirement to every environment and to CI | Accepted: `R-038-1` rejected the alternative (a second datastore) on isolation and duplication grounds, which are worse problems |
| **The embedding provider is unowned** | `FR-CTX-013` keeps the model behind a boundary; nothing in the programme provides one | Carried to the closing report as a named unowned dependency, in the shape `EPIC-035` used for `BR-0080` |
