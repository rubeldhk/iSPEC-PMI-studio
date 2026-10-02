# Implementation Plan: Epic Model and Spec Journey Board

**Epic**: `EPIC-044` · **Branch**: `epic/044-epic-model-journey-board` · **Date**: 2026-09-05

**Spec**: [spec.md](./spec.md) (clarified 2026-09-05) · **Research**: [research.md](./research.md)

**SRS References**: `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §2.2 (steps 2, 6), §3 (`Epic`,
`Requirement + epicId`, `Specification + epicId`, `EpicStage`), §4.1–4.2 (`pmi.project.context`,
`pmi.requirements.list`, `GET /v1/epics/{id}/stage`), §6 (Epic list and detail, Spec Journey
Board, specification list columns), §7 (`EPIC-044` brief), §8 (`M3`), §9.3 (`LR-03`, `LR-07`),
§10 (package extraction), §11 (`R-06`), §13 (the stage model reused) ·
`SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.2 (`BR-0041`), §6.16 (`BR-0050`),
§6.21 (`BR-0113`), §6.22 (`BR-0196`, `BR-0198`) · `SRS/PMI-DOC-004B` §5.2 (`O-2`, `O-7`)

**Input**: Feature specification from `specs/044-epic-model-journey-board/spec.md`

## Summary

The product has no Epic. `EPIC-043` returns an empty list labelled *unavailable until
`EPIC-044`*, `EPIC-042`'s first run registers nothing against the composed application, and the
only place an Epic's stage exists is this repository's governance register, derived from its own
`specs/` tree. This Epic adds the entity, binds requirements and specifications to it, and derives
each Epic's stage from the executions the hooks already write — never from a field a person sets.

The plan is four layers:

1. **The shared derivation** (`R-044-1`, `R-044-2`, `R-044-4`): `packages/epic-stage` — the
   configuration document, the contiguity rule, readiness, a file-tree evidence adapter (the
   register's) and an execution evidence adapter (the product's). The governance modules become
   re-export shims; the register is byte-identical before and after.
2. **The entity and its reads** (`R-044-3`, `R-044-5`, `R-044-6`, `R-044-7`, `R-044-8`): one
   table, two nullable columns, a new `epics/` module with owner-gated writes, decision
   reconciliation on read, the two stage reads, and the three connector reads switching source
   without changing shape.
3. **The screens** (`R-044-9`): the Epic list and detail in the Requirement Room, the Spec
   Journey Board in Specifications, two columns on the specification list.
4. **The evidence** (`R-044-11`, `R-044-12`): Tier 1 through the composed `AppModule` and a real
   `pmi-studio` server; Tier 2 the `M3` first-half transcript; the governance records this step
   writes.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (`ADR-0003`).

**Primary Dependencies**: NestJS 10, Prisma 5.22, React, Vitest 2.1, Playwright (unchanged).
**One new private workspace package**, `@pmi/epic-stage` 0.1.0, with **no runtime dependency**;
imported by `backend/` and by `tests/governance/`. No other package changes version.

**Storage**: PostgreSQL 16 via Prisma. **One new table** (`epics`, with a self-relation), **two
nullable columns** (`requirements.epicId`, `specifications.epicId`). Additive migration
`<ts>_epic044_epics`. The stage is a projection and has no table.

**Testing**: Vitest — `epic-stage` (a new project: configuration, contiguity rule, execution
evidence, readiness), `governance` (the 32 importing specs unchanged; `G-44-01` mirror check;
register byte-identity), `backend-unit` (Epic service, allocation, assignment rules, the stage
service over in-memory rows, decision reconciliation), `backend-contract` (`epics-api.md`),
`backend-integration` (Testcontainers: CRUD and grants; stage reads over executions registered
through a real `pmi-studio` server via the sequence harness; reconciliation; connector reads),
`architecture` (`durable-stores` gains `EPIC_STORE`; `engine-independence` still green — command
names come from the configuration; `connector-boundary` unchanged), `frontend` (Epic list and
detail, board, specification list columns; four states; filters), `e2e` (`M3` first half).

**Target Platform**: Linux server for the API and the package; the browser for the screens.

**Project Type**: web service (API + web) plus a shared library consumed by the repository's own
governance.

**Performance Goals**: the board read for a project with 50 Epics and 500 executions answers in
under **2 s** end to end; the derivation itself under **50 ms** (`SC-EPB-005`, `R-044-10`).

**Constraints**: a stage is never written (`FR-EPB-001`); one rule in one package (`FR-EPB-010`);
the register byte-identical (`FR-EPB-013`); `backend/src` names no toolkit (command names are
configuration); no new connector scope; no change to the hooks or the tool surface's shape.

**Scale/Scope**: Epics in the tens per project; executions in the hundreds per Epic over its life;
one board read per screen load.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** — the `ADR-0030` amendment is a governance record this command writes as `FR-EPB-070` directs; no application code is written at the plan step |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — PMI-DOC-007 is in `SRS/`; two requirements rest on provisional `LR-` identifiers with the `BR-` back-fill recorded under Assumptions |
| III | Epic → Feature → Task; `specs/044-epic-model-journey-board/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test; document outputs carry a conformance check | **PASS** — planned in `/speckit-tasks`; the configuration document is checked by `config.spec.ts` and `G-44-01`; four mutation observations are owed (`quickstart.md`) |
| VI | `specs/044-epic-model-journey-board/defects/` is the sole defect intake | **PASS** — created at the specify step, tracked in git |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — the package version is recorded by the register and stated by the board |
| VIII | Session labelled with the working Epic | **PASS** — branch `epic/044-epic-model-journey-board` |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-09-05, all recommendations accepted, no follow-up round |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1: every route through the composed `AppModule`, executions through a real MCP client and the sequence harness; Tier 2: the `M3` first-half transcript on the reference-local stack (`R-044-11`) |
| XII | Governed commands registered in PMI Studio before executing | **PASS in design, PARTIAL in practice** — this Epic *consumes* registrations; the commands that build it run in this repository, which is not a PMI-managed project (`EPIC-042` spec, out of scope), so they are not registered by hook. Recorded, as `EPIC-042`'s closure did |
| — | Repository synced from GitHub before work started | **PASS** — `origin/main` is behind local; nothing to integrate |
| — | No other Claude session active on this checkout | **PASS** |

**Post-Phase 1 re-check**: unchanged. The design raised two gate considerations and resolved both:
the configuration document must be readable by the platform in a container and by the register in
this repository (`R-044-2` — canonical in the package, mirrored under `governance/` with a
failing check); and the *Converged* rule must consume only what the hooks record (`R-044-4` — the
completion comment's fixed format, no new event).

## Project Structure

### Documentation (this feature)

```text
specs/044-epic-model-journey-board/
├── spec.md                          clarified 2026-09-05
├── plan.md                          ← this file
├── research.md                      R-044-1 … R-044-13
├── data-model.md                    epics · two columns · the configuration document · the EpicStage projection · decision processing
├── contracts/
│   ├── epics-api.md                 session routes · the reads whose content changes · refusals · tests
│   └── stage-derivation.md          the package: layout, exports, governance shims, conformance
├── quickstart.md                    12 scenarios, mutation targets
├── checklists/requirements.md
└── defects/                         Constitution VI intake
```

### Source Code (repository root)

```text
packages/epic-stage/                                    NEW (R-044-1, R-044-2) — contracts/stage-derivation.md §1
├── package.json · epic-stage.config.json · src/{index,config,derive,readiness,evidence-files,evidence-executions}.ts
└── tests/{config,derive,evidence-executions,readiness}.spec.ts

governance/epic-stage.config.json                       mirror of the package file (G-44-01)
tests/governance/epic-stage/derive.ts                   → re-export shim over the package
tests/governance/epic-stage/dor.ts                      keeps the twelve conditions; re-exports resolveReadiness/validateWaiver
tests/governance/epic-stage-config-mirror.spec.ts       G-44-01

backend/src/modules/epics/                              NEW module (R-044-5 … R-044-8)
├── epics.module.ts · epic-stores.module.ts · epics.tokens.ts
├── epic.store.ts                                       Prisma + in-memory; EPIC_STORE
├── epic.service.ts                                     create (number allocation) · edit · close · assign requirement/specification · reconcileDecisions · audit · owner gate
├── epic-stage.service.ts                               one query → bindExecutions → evidenceFromExecutions → deriveStageFromEvidence → resolveReadiness
└── epics.controller.ts                                 the session routes of contracts/epics-api.md §1

backend/src/modules/connector/project-context.service.ts   epics + grouping from the entity; epicSource 'epic.entity' (R-044-8)
backend/src/modules/connector/connector.module.ts           imports EpicStoresModule
backend/src/modules/governance/decomposition-plan.service.ts  unchanged shape; the entity's bundles arrive through ProjectContextService
backend/src/modules/requirements/requirements.service.ts    rows carry epicId/epicNumber/epicTitle
backend/src/modules/specifications/…                        rows carry the same; a generated specification bound by its execution
backend/prisma/schema.prisma · migrations/<ts>_epic044_epics/migration.sql
backend/src/app.module.ts                                   + EpicsModule

frontend/src/pages/EpicList.tsx · EpicDetail.tsx            Requirement Room routes (R-044-9)
frontend/src/pages/JourneyBoard.tsx                          Specifications route /specifications/board
frontend/src/pages/SpecificationList.tsx                     + Epic and Stage columns
frontend/src/shell/area-views.tsx · areas.ts                 the sub-routes inside two delivered areas
frontend/src/services/api.ts                                 + listEpics · createEpic · getEpic · updateEpic · closeEpic · assignRequirementEpic · assignSpecificationEpic · getEpicStage · getBoard
frontend/tests/unit/pages/{epic-list,epic-detail,journey-board}.spec.tsx · specification-list.spec.tsx (extended)

backend/tests/unit/epics/*.spec.ts
backend/tests/contract/epics-api.spec.ts
backend/tests/integration/{epics-api,epic-stages,decision-reconcile}.spec.ts · connector-reads.spec.ts (extended)
backend/tests/unit/core/universal-columns.spec.ts            + epics
backend/tests/architecture/durable-stores.spec.ts            + EPIC_STORE
e2e/tests/epic-044-m3.spec.ts                                the M3 first-half transcript (R-044-11)
vitest.workspace.ts · package.json                           + epic-stage project
governance/repository-layout.md                              + packages/epic-stage/ (at implement time)
adr/ADR-0030 (amended at this step) · specs/043-…/contracts/mcp-tool-surface.md (dated note on epicSource)
```

**Structure Decision**: Epics get their **own backend module** with a stores-only companion
(`R-044-7`), because three surfaces read them — the Requirement Room, the board and the connector —
and none should import another's controller; the derivation rule lives in a **package** neither
the backend nor the governance tests own, because the requirement is that they cannot disagree
(`R-06`), and a rule two consumers import is the only structure that makes disagreement impossible
rather than merely unlikely.

## Phase 0 — Research

[research.md](./research.md) resolves thirteen decisions: `R-044-1` what is extracted;
`R-044-2` one configuration file, mirrored; `R-044-3` executions bound by their input target;
`R-044-4` the evidence rules including *Implementing* and *Converged*; `R-044-5` the entity and
its number (Context7-verified self-relation); `R-044-6` decisions processed on read;
`R-044-7` the module pair; `R-044-8` routes and unchanged connector shape; `R-044-9` the
screens; `R-044-10` one query per board read; `R-044-11` Tier 1 and Tier 2; `R-044-12` the
governance records and repository checks; `R-044-13` numbers on the wire, names on the screen.

No `NEEDS CLARIFICATION` remains: the five judgement calls were confirmed on 2026-09-05.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — `epics`, the two columns, the configuration document, the
  `EpicStage` projection with its three rules, decision processing, the reads, audit actions.
- [contracts/epics-api.md](./contracts/epics-api.md) — nine session routes, five reads whose
  content changes, refusals, tests.
- [contracts/stage-derivation.md](./contracts/stage-derivation.md) — the package's layout,
  exports, the governance shims, conformance.
- [quickstart.md](./quickstart.md) — twelve scenarios and the mutation observations owed.

## Governance records written by this step (`R-044-12`)

- `adr/ADR-0030` — amendment 2026-09-05 (`FR-EPB-070`): the repository register and the product
  board share one stage derivation (`R-06`); Epic is a product entity; a stage is derived from
  executions and never written.
- `governance/repository-layout.md` — `packages/epic-stage/` is registered when the directory
  exists (first task of Phase 1), not now: the layout check requires a registered path to exist.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Gate XII PARTIAL — the commands producing this Epic run unregistered | This repository is not a PMI-managed project; the hooks run only in provisioned directories | Provisioning this repository as its own project is `EPIC-042`'s stated out-of-scope; the honest row is *recorded*, as `EPIC-042`'s closure did |
| A new workspace package | The rule must be importable by the backend at run time and by the governance tests, and must have one home | A copy in `backend/src` is the drift `R-06` names; leaving it in `tests/governance/` makes the platform import a test directory |
| Two copies of the configuration file | The platform runs where `governance/` does not exist; every existing reference names `governance/epic-stage.config.json` | A symlink is fragile on the reference workstation; a build-time copy fails silently; the mirror fails a test the moment it differs |
| The *Converged* rule reads a completion comment | The hooks record which files changed only there; no artifact store exists until `EPIC-045` | A new event changes the hooks (out of scope); parsing synced `tasks.md` needs `EPIC-045` |

## Related Documents

- `specs/026-epic-stage-register/` — the stage model, DOR and register this Epic extracts from
- `specs/042-pmi-spec-kit-extension/` — the first-run loop, the decision record, the hooks that
  bind executions to Epics
- `specs/043-pmi-integration-contract/` — the connector reads whose source this Epic replaces
- `specs/037-governed-execution-registry/contracts/execution-contract.md` — bindings, events,
  completion
- `adr/ADR-0030` (amended by this plan) · `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §3, §6, §7
