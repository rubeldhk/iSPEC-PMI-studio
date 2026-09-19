# Closure record: EPIC-006 Project Management

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-005 EPIC-006 EPIC-007` (Constitution
VIII label; branch `main`, stated here) · **Released by**: PMI-DOC-004 v1.0 (**BR-0010**), scope
ruling T-106, 2026-08-20.

## `T181` — every implementation task has a passing unit test (Constitution V)

**9 of 9 tasks complete; tests observed RED first** (3 files, import-failure red, exit 1, before
`projects.service.ts` existed).

| Implementation task | Paired test | Result |
|---|---|---|
| T053 `Project` model + migration | T049 via `schema-constraints.spec.ts` + `universal-columns.spec.ts` (updated below) | pass |
| T054 projects service | T049 `projects.service.spec.ts` (10) + T050 `project-archive.spec.ts` (5) | pass |
| T055 projects controller | T054a `projects.controller.spec.ts` (6) | pass |
| T056 projects pages | T055a `Projects.spec.tsx` (6) | pass |
| — contract | T051 `projects.spec.ts` (12) | pass |

**The stub guards were deliberately inverted.** `schema-constraints.spec.ts` asserted since T011a
that the Project stub had NOT grown ("must not grow before EPIC-006 owns it"). Ownership arrived;
the same file now asserts the behavioural fields ARE present (`status`, `archivedAt`,
`description`, `engineName`) — the guard did its job and retired into its inverse.
`universal-columns.spec.ts`'s table set gained the two EPIC-007 tables in the same pass.

**The migration executed against a real database.** `20260820000100_epic006_project_ownership`
applied to PostgreSQL 16 (Testcontainers) as part of the T457 run — the enum, five columns, two
CHECK constraints, and the status index are applied DDL, not asserted text.

## `T182` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**
Findings:

- **F1 — EPIC-004's deferral "wire the tenancy guard into the first resource-fetch endpoint
  (owner: EPIC-006 T054)" is DISCHARGED.** `ProjectsService.get` fetches by id and passes the row
  through `assertSameWorkspace` with the `onRefused` hook and `targetType: 'project'` — absence
  and cross-workspace produce one identical opaque 404, and the refusal is recordable (FR-002,
  FR-033). `assertSameWorkspace` now has its first production caller.
- **F2 — engine selection reads through the promised port.** `engines.module.ts` has said since
  T035 that "storing a selection is EPIC-006's... this implementation is replaced there."
  `ProjectEngineSelection` implements `ProjectEngineSelectionPort` off the project record
  (`engineName`, null = inherit — the resolver's existing contract). The composition-root swap of
  `PROJECT_ENGINE_SELECTION` rides the same seam as every store (owner: EPIC-014 F-11.2).
  One recorded divergence from `data-model.md`: the design table says `engine_id` ref, required;
  built as `engineName String?` because the registry keys engines by NAME, `GenerationJob` carries
  `engineName`, and the resolver port returns a name-or-null. The design DDL is design-level
  (T012a convention); divergence recorded here rather than silently.
- **F3 — audit-in-transaction for project mutations is not composed** — same platform seam as
  every persistence adapter; the `onRefused` hook and `AuditService` both exist, the wiring is the
  composition root's. Owner: EPIC-014 F-11.2.

**Definition of done**: archiving preserves all content — T050 asserts field-by-field survival AND
that the store exposes no destructive operation at all; **Quickstart V1 has not run end-to-end**
(needs the composed runtime) — its assertions are covered at the service and contract layers;
the scenario itself is deferred to EPIC-014 F-11.2 with V2/V12, same as EPIC-004 recorded.

## `T183` — defect triage

`specs/006-project-management/defects/` contains no records (only `.gitkeep`). **0 open.**

## `T184` — closing report

### Work Completed

- `backend/prisma/schema.prisma` — Project ownership taken: `ProjectStatus` enum, `description`,
  `status`, `engineName`, `archivedAt`, `updatedAt`, `@@index([workspaceId, status])`; migration
  `20260820000100_epic006_project_ownership` (executed, see T181).
- `backend/src/modules/projects/` — `projects.service.ts` (create/list/get/rename/archive; unique
  name per workspace; archive as status, idempotent; tenancy guard wired; Prisma + in-memory
  stores with **no delete operation on the port**), `projects.controller.ts` (`/projects` per
  contract; 401 vs opaque 404 kept distinct), `projects.module.ts` (+`ProjectEngineSelection`).
- `frontend/src/pages/Projects.tsx` — list, create, detail, rename, archive; archived is a visible
  state with content still on screen.
- Guard-test handover: `schema-constraints.spec.ts`, `universal-columns.spec.ts` (see T181).

### Not verified

- Quickstart **V1** end-to-end (composed runtime required) — deferred, owner EPIC-014 F-11.2.
- No real HTTP request has hit `/v1/projects` — same composition seam; all layers below verified.

### Deferred (owners per D-6)

| Item | Owner | Awaiting |
|---|---|---|
| Composition-root swap: `PROJECT_STORE` → Prisma, `PROJECT_ENGINE_SELECTION` → `ProjectEngineSelection`, `onRefused` → audit | EPIC-014 F-11.2 | first composed environment |
| Quickstart V1 | EPIC-014 F-11.2 | same |
| SC-004 co-ownership marker (2026-08-03 analysis D1) | unchanged — documentation observation | next spec-template pass |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T181)
- [x] Convergence reports no unbuilt work in scope (T182) — EPIC-004's F2 deferral discharged here
- [x] `defects/` contains no open records (T183)
- [x] Principle deltas hold (none declared); deferrals have valid owners (T184)
- [x] Closure recorded — this document; **EPIC-006 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-008` (after EPIC-007's closure in this session) — authoring consumes
projects as its container and EPIC-007's requirements as its input.
