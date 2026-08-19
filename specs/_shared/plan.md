# PMI Studio — Platform Implementation Plan


> ## ⚠️ This is the PLATFORM plan, not an epic plan
>
> **Rescoped 2026-08-03.** It was EPIC-001's plan when EPIC-001 was one 215-task epic. It now holds
> the technical context, stack decisions, and constitution posture that **all 15 epics** inherit.
>
> Per-epic plans are thin and live beside their tasks — for example
> [EPIC-001](../001-platform-foundation/plan.md), [EPIC-003](../003-specification-engine/plan.md),
> [EPIC-004](../004-workspace-tenancy-audit/plan.md). Each carries only what is specific to it.


**Scope**: platform-wide | **Date**: 2026-08-02 (rescoped 2026-08-03) | **Spec**: [platform-spec.md](./platform-spec.md)

**Applies to**: all 15 epics — see [../README.md](../README.md)

**SRS References** — governing documents first:

- `PMI-DOC-000_Product_Documentation_and_Specification_Standard_v1.0.docx` — §3 identifiers, §4
  document structure, §5 traceability, §9 ADRs *(this Epic does not yet conform — decisions D-1, D-2, D-4)*
- `PMI-DOC-003_Product_Principles_v1.0.docx` — PP-001 to PP-020, binding programme-wide by decision
  D-6; see the Principle Conformance register in [spec.md](./platform-spec.md)
- `PMI-DOC-001_Executive_Product_Vision.docx`, `PMI-DOC-002_Product_Charter.docx` — vision, scope,
  governance bodies, success measures
- `SRS/new/` **MPS Volumes 1–6 + module specs M01–M18** — authoritative for **product content**
  (decision D-12). Module taxonomy supersedes D-3; re-cut deferred to an MPS baseline (D-13)
- `PMI-TASK-001` + `PMI-PLAN-001` — authoritative for **execution sequencing**; PMI-PLAN-001's
  Execution Lanes independently validate the D-10 split
- `PMI_Studio_Module_Based_Requirements_and_Epics.docx` — module decomposition currently reflected
  in `tasks.md` (decision D-3, **superseded by the MPS, application deferred**)
- `PMI_Studio_Enterprise_Master_Blueprint.docx` — §Product Vision, §Core Principles, §High-Level
  Architecture, §Traceability Model, §Roadmap
- `PMI_Studio_Reference_Documents_for_SpecKit.docx` — §Specification Engine Contract, §Key
  Recommendations, §06 Specification Engine, §11 Security
- `PMI_Studio_Enterprise_Product_Backlog_v1.docx` — target scale; `raw study.docx` — engine independence

**Input**: [platform-spec.md](./platform-spec.md) — the platform product specification

## Summary

Deliver the PMI Studio Phase 1 slice: users capture requirements against a project, generate
specifications from them through a single engine contract with Spec Kit running behind an adapter,
approve those specifications through a versioned lifecycle, and generate tasks — with every artifact
traceable back to its originating requirements.

The defining technical finding of Phase 0 is that **Spec Kit is not a callable generation API**. The
`specify` CLI only scaffolds a project; the `/speckit-*` commands are prompt templates executed by an
AI coding agent. Generation therefore means orchestrating an AI agent inside a disposable sandbox,
not making a request to a service. That reframes the largest component of this Epic from "an
integration client" to "a sandboxed execution runtime", and it is why job cancellation, timeouts, and
the failure taxonomy in the spec are load-bearing rather than defensive. See
[research.md](./research.md) R-001 and R-006.

## Technical Context

All items below were unknowns in the specification, which deliberately deferred them. Each is
resolved in [research.md](./research.md); decisions marked ⚠ are the expensive-to-reverse ones.

**Language/Version**: TypeScript 5.x on Node.js 22 LTS ⚠ (R-002)

**Primary Dependencies**: NestJS (API, adapter registration via DI) · Prisma (data access,
migrations) · BullMQ + Valkey (generation jobs) · React + Vite (web) · Docker (engine sandbox) ·
OpenTelemetry + pino (observability) ⚠
(R-003, R-004, R-005, R-006)

**Storage**: PostgreSQL 16. Every table carries `workspace_id` from the first migration so Phase 3
multi-tenancy needs no data migration (R-004)

**Testing**: Vitest (unit — mandatory per Constitution V) · Supertest (API contract) ·
Testcontainers (integration against real PostgreSQL/Valkey) · Playwright (end-to-end) (R-010)

**Observability**: OpenTelemetry traces and metrics · structured JSON logs (pino) · one correlation
identifier spanning API → queue → worker → sandbox. Adopted by decision D-7 to satisfy PP-010
(R-011, `system-design.md` PC-3). Backend deliberately unchosen — the collector endpoint is
configuration, keeping application code vendor-neutral (PP-015)

**Target Platform**: Containerised web application. Hosting substrate deliberately not chosen —
no Phase 1 requirement depends on it (research.md, Deferred)

**Project Type**: Web application — API + worker + web front end + isolated engine adapter packages

**Performance Goals**: A project holds ≥500 specifications without degrading listing, search, or
traceability views (SC-009). 95% of generation requests complete or report a named failure within
their time limit (SC-011)

**Constraints**: Generation is long-running, non-deterministic, and untrusted — it must run in a
sandbox with hard resource and wall-clock caps and egress restricted to the AI provider (R-006).
Nothing outside the adapter layer may reference Spec Kit, enforced by a build-failing architecture
test (R-009)

**Scale/Scope**: 37 functional requirements (34 + FR-011a/b from D-14) · 8 user stories · 15 entities
· **215 tasks, of which 74 proceed and 141 are held** under decision D-10 · single-user surface on a
multi-tenant-ready data model

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | PASS |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | PASS |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | PASS |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | PASS |
| V | Every implementation task will carry a mandatory unit-test task, written to fail first | PASS |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | PASS |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | PASS |
| — | Repository was synced from GitHub before this work started | PASS — 0 commits behind `origin/main` |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | PASS — single session; not independently verifiable, asserted by the operator |
| — | **PMI-DOC-003 Principle Conformance register present, with every deferral argued and owned** (decision D-6) | PASS — 20/20 declared in [spec.md](./platform-spec.md); **4** deferrals after D-7 adopted PP-010, each with owner and discharging module |
| — | **Principle-derived design constraints honoured** (PC-1 service/transport separation, PC-2 cost containment) | PASS — recorded in `system-design.md`; PC-1 enforced by architecture test |

**Post-design re-check (after Phase 1)**: PASS. No gate weakened by the design. Two gates are
*strengthened* by it: Constitution V gains a real target because the fixture adapter (R-009) makes
engine-dependent logic unit-testable without invoking a live AI agent; Constitution II is preserved
because the traceability graph is a first-class entity rather than a report.

**Governance re-check (2026-08-03, after the MPS drop — 26 further documents)**: PASS.

- Nothing in the design conflicts with PMI-DOC-003. The register in [spec.md](./platform-spec.md) declares
  all twenty principles.
- **PP-010 is now satisfied, not deferred** — decision D-7 adopted observability as function F-00.5.
  Deferrals drop from five to four (PP-007, PP-013, PP-017, PP-019).
- Three deferrals carry design constraints this plan enforces: **PC-1** (service/transport
  separation, enforced by T142a), **PC-2** (cost containment in scope, optimisation deferred), and
  **PC-3** — now a design rather than an open question.
- **One SRS change invalidated built design**: M08's six-state lifecycle replaced the three-state
  model in FR-011, `data-model.md`, `schema.sql`, and four tasks (decision D-14). Corrected while
  M-04 is held, so no migration was required.
- Requirements arriving with the MPS that this Epic does **not** adopt are recorded in the
  MPS-Derived Requirements Adoption Register in [spec.md](./platform-spec.md) — 7 deferred, 2 partial, 4
  already satisfied, each with an owner and a destination.

Any FAIL blocks Phase 0. Record justified deviations in Complexity Tracking below.

## Project Structure

### Documentation (platform-wide, after the 2026-08-03 epic split)

```text
specs/
├── README.md                  # epic index and build order
├── srs-alignment.md           # conflicts C-01..C-17, decisions D-1..D-15
├── _shared/                   # THIS layer — one source of truth for all 15 epics
│   ├── platform-spec.md       #   36 FRs · 8 stories · 12 criteria · principle baseline
│   ├── plan.md                #   this file
│   ├── system-design.md · data-model.md · schema.sql
│   ├── contracts/             #   specification-engine.md · platform-api.md
│   ├── research.md · tech-stack.md · dependencies.md · raid-log.md
│   ├── quickstart.md
│   └── checklists/requirements.md
└── <epic>/                    # ONE PER EPIC
    ├── spec.md                #   requirements OWNED by this epic
    ├── plan.md                #   thin; references _shared/
    ├── tasks.md
    ├── checklists/requirements.md
    └── defects/               #   MANDATORY per-Epic (Constitution VI)
```

### Source Code (repository root)

```text
packages/
└── engine-contract/            # The ISpecificationEngine contract + shared types.
    └── src/                    # The ONLY thing backend/ may know about engines.

engine-adapters/
├── speckit/                    # SpecKitAdapter: sandbox orchestration, CLI + agent invocation,
│   ├── src/                    #   output parsing. The single place Spec Kit is named.
│   └── docker/                 # Engine image: specify CLI + AI agent CLI + git
└── fixture/                    # Minimal second engine. Proves the contract is engine-neutral
    └── src/                    #   (User Story 8) and backs the fast test suite.

backend/
├── src/
│   ├── modules/
│   │   ├── auth/               # Sessions, identity-provider boundary (R-008)
│   │   ├── workspaces/         # Tenancy boundary; workspace scoping guard
│   │   ├── projects/           # US1
│   │   ├── requirements/       # US2
│   │   ├── specifications/     # US3, US5, US6 — lifecycle, versions, validation
│   │   ├── tasks/              # US4
│   │   ├── traceability/       # US7 — links and coverage gaps
│   │   ├── engines/            # Adapter registry, capability checks, per-project selection
│   │   ├── jobs/               # Generation job lifecycle, cancel, timeout
│   │   ├── decisions/          # Architecture Decision Records (FR-034)
│   │   └── audit/              # FR-033
│   └── core/                   # Cross-cutting: errors, workspace context, failure taxonomy
├── prisma/                     # Schema + migrations
└── tests/
    ├── unit/                   # Mandatory per Constitution V
    ├── contract/               # API contract tests
    ├── integration/            # Testcontainers: real PostgreSQL + Redis
    └── architecture/           # FAILS THE BUILD if backend/ references Spec Kit (R-009)

worker/
├── src/                        # BullMQ consumer: claims job, runs engine, persists result
└── tests/unit/

frontend/
├── src/
│   ├── pages/                  # Projects, requirements, specification, review, traceability
│   ├── components/
│   └── services/
└── tests/

e2e/                            # Playwright: the full requirement → spec → task journey
```

**Structure Decision**: A pnpm workspace monorepo. The split is not cosmetic — it is the mechanism
that makes engine-independence enforceable. `backend/` depends on `packages/engine-contract` and
never on `engine-adapters/*`; adapters are supplied at composition time. `backend/tests/architecture`
fails the build if that boundary is crossed, which is how SC-008 ("a second engine with zero changes
outside the adapter layer") becomes a build-time guarantee instead of a claim that quietly decays.

## Complexity Tracking

> No Constitution Check violations. The entries below record deliberate complexity that a reviewer
> would otherwise challenge.

| Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------|------------|--------------------------------------|
| Container sandbox per generation job | Generation runs an AI agent that writes files and executes commands — untrusted by construction | A same-host subprocess gives no blast-radius containment and no reliable way to enforce the timeout in FR-025 or the clean-state guarantee in FR-027 |
| Four-package split (contract / two adapters / backend) | Makes the SRS's central architectural claim mechanically enforceable | A single package with folder conventions relies on review discipline; the boundary erodes silently and SC-008 becomes untestable |
| A second, deliberately useless engine adapter | User Story 8 and SC-008 cannot be tested with only one engine; also keeps the test suite fast and deterministic | Testing engine-independence against Spec Kit alone proves nothing about neutrality, and every test would invoke a live AI agent |
| Both raw and parsed engine output stored | An AI agent's output is prose against a template, not a guaranteed schema | Storing only the parsed form makes any future parser bug permanent data loss |

## Phase 1 Outputs

**Design**

- [system-design.md](./system-design.md) — component architecture, SRS layer mapping,
  **principle-derived constraints (PC-1 to PC-3)**, dependency rule, runtime topology, generation
  sequence flow, sandbox security design, extension seams
- [tech-stack.md](./tech-stack.md) — every technology choice with rationale, rejected alternatives,
  and change cost
- [dependencies.md](./dependencies.md) — third-party register: 32 components with purpose, expected
  licence, and risk
- [schema.sql](./schema.sql) — PostgreSQL DDL: 16 tables (15 entities plus one join table),
  15 enum types, constraints, indexes, and append-only triggers
- [raid-log.md](./raid-log.md) — 11 risks, 10 assumptions, 6 issues (4 closed), 11 dependencies
- [research.md](./research.md) — 12 decisions with alternatives; 4 flagged ⚠ as expensive to reverse
- [`adr/`](../../adr/) — ADR-0001 to ADR-0005, the programme's own decision record (D-11)

**Specification**

- [data-model.md](./data-model.md) — 15 entities (the spec's 13 plus RequirementVersion and
  LifecycleTransition, both required to satisfy FR-009 and FR-014), workspace scoping, lifecycle
  transitions, validation rules traced to requirements
- [contracts/specification-engine.md](./contracts/specification-engine.md) — the Phase 1 engine
  contract, its failure taxonomy, and the adapter registration rules
- [contracts/platform-api.md](./contracts/platform-api.md) — the platform's external API surface
- [quickstart.md](./quickstart.md) — runnable validation proving the end-to-end journey

## Open Governance Decisions

Tracked in [srs-alignment.md](../srs-alignment.md). Two are settled; the rest bear on this plan.

| | Decision | Status | Effect on this plan |
|---|---|---|---|
| D-3 | Authoritative module taxonomy | ✅ Decided | `tasks.md` re-cut onto the SRS catalog; task IDs unchanged |
| D-6 | Principles bind programme, not each Epic | ✅ Decided | Register in spec.md; **constraints PC-1 and PC-2 added to this design** |
| **D-10** | **Split delivery: build the engine, hold the product surface** | ✅ Decided | **74 of 211 tasks proceed; 137 held** pending `PMI-DOC-004` BRS and scope approval. Independently validated by PMI-PLAN-001's Execution Lanes. See RAID **D-K** |
| **D-7** | Observability (PP-010) into EPIC-001 | ✅ **Decided — adopted** | Function **F-00.5** (T157–T164); research R-011; design PC-3. Sits in the *proceeding* slice |
| **D-8** | API versioning (PP-012) | ✅ **Decided — adopted** | `/v1` prefix plus compatibility policy in `contracts/platform-api.md` |
| **D-11** | ADR repository | ✅ **Decided — created** | `adr/` with ADR-0001 to ADR-0005 |
| **D-12** | Document authority | ✅ **Decided — layered** | MPS = product content · PMI-DOC-000 = documentation standards · PMI-DOC-003 = principles · PMI-PLAN-001/TASK-001 = sequencing |
| **D-13** | Re-cut onto the 18-module MPS taxonomy | ✅ **Decided — wait** | MPS supersedes D-3, but all volumes are `Draft`. Re-cut once at baseline, folding in D-1 and D-9 |
| **D-14** | Six-state specification lifecycle | ✅ **Decided — adopted** | FR-011/011a/011b, `data-model.md`, `schema.sql`, T099/T099a/T099b/T106/T111 |
| D-1 + D-2 + D-9 | Typed identifiers; 9-level chain; task ID namespacing | 🟠 Open **by design** | **Execute as one pass** with the D-13 re-cut, so 211 tasks are touched once rather than four times |
| D-4, D-5 | 13-section template; convert `SRS/` to Markdown | 🟠 Open | D-4 back-fills spec sections; D-5 is its own Epic |

## Open Issues Blocking Implementation

`/speckit-analyze` found four issues, tracked in [raid-log.md](./raid-log.md). **Both blockers are
now closed.**

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| I-01 | 35 application-code tasks had no paired unit-test task — Constitution V (NON-NEGOTIABLE) | CRITICAL | ✅ **Closed** — 34 unit-test tasks added; 0 gaps across 197 tasks |
| I-02 | FR-012 (view, edit, list specifications) had zero task coverage | HIGH | ✅ **Closed** — 6 tasks added to Phase 5 |
| I-03 | SRS back-fill declared for FR-024/FR-025 but not gated in Epic Exit Criteria | HIGH | 🟠 Open |
| I-04 | SC-011 (95% completion or named failure within the time limit) is unmeasured | MEDIUM | 🟠 Open |

I-01 was closed **without** amending Constitution V — component tests satisfy "unit test" for UI,
and controllers now carry unit tests alongside their contract tests. Governance is unchanged.

I-03 and I-04 do not block implementation: I-03 gates Epic *exit*, and I-04 concerns a success
criterion measured after the system runs.

## What Happens Next

1. Resolve **I-01** and **I-02**; confirm or override the ⚠ decisions in
   [tech-stack.md](./tech-stack.md) — particularly **R-09**, the stack/team fit, which is cheap to
   change now and invalidates ~all 156 task paths later.
2. `/speckit-tasks` to regenerate the task list if the spec or constitution changes.
3. `/speckit-implement` to execute.
4. `/speckit-converge` as the Epic exit gate before any promotion out of `local`.
