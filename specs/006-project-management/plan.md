# Implementation Plan: Project Management

**Epic**: `EPIC-006` | **Module**: M-02 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ▶ **PROCEEDING** (released 2026-08-20 by PMI-DOC-004 v1.0; see [spec.md](./spec.md))

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

Projects as the container every other artifact belongs to: create, view, rename, archive, with
content preserved intact through archival.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-02.1 Project data and service | 4 | `Project` model, create/list/get/rename/archive |
| F-02.2 Project API | 3 | `/projects` endpoints |
| F-02.3 Project interface | 2 | List and detail pages |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**`Project` is the join point for most of the platform.** `GenerationJob`, `Requirement`,
`Specification`, `Task`, and `ArchitectureDecisionRecord` all carry `project_id`. Its absence is why
EPIC-001 needed either a stub table or deferred job persistence — the D-10 seam recorded in
[srs-alignment.md](../srs-alignment.md).

**Archival preserves content** (`T050`). Archive is a status, never a delete — the same treatment
retired requirements and superseded ADRs get.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-001 and FR-003 cite the Enterprise Modules section via [platform-spec](../_shared/platform-spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 3 functions, 13 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 4 implementation tasks, 4 paired tests |
| VI | `specs/006-project-management/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

**No gaps.** This is the cleanest task list of the eleven: model (`T053`), service (`T054`),
controller (`T055`), interface (`T056`), each with a paired unit test, plus contract tests (`T051`).
It is the pattern the other epics are measured against — EPIC-012's missing controller and EPIC-016's
three-layers-in-one-task were both found by comparison with this shape.

One observation, not a gap: `SC-004` (workspace isolation) is listed as owned here **and** by
EPIC-004. Success criteria carry no co-ownership marker, unlike requirements — recorded as **D1** in
the 2026-08-03 analysis and unchanged.

## Build order

```text
F-02.1  T049/T050 tests ──► T053 model ──► T054 service
F-02.2  T051 contract + T054a unit ──► T055 controller
F-02.3  T055a tests ──► T056 pages
```

## Design notes specific to this epic

**Unique project name within a workspace** (`T049`), not globally. Two workspaces may each hold a
project called "Platform" and that is correct — the tenancy boundary is the namespace.

**Cross-workspace access returns 404, not 403** (`T054a`), matching EPIC-004's disclosure rule.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 13 tasks complete, every unit test passing (Constitution V)
- [ ] Archiving a project preserves all its content and traceability
- [ ] Quickstart **V1** (workspace and project) passes
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
