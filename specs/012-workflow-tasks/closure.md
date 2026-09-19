# Closure record: EPIC-012 Workflow Tasks

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-010 EPIC-012`, executed in the
isolated worktree branch `epic/009-011-016-lifecycle-wave` (concurrent-session rule) · **Released
by**: PMI-DOC-004 v1.0.

## `T205` — every implementation task has a passing unit test (Constitution V)

**12 of 12 implementation tasks complete**, written red-first (the four backend spec files failed
collection before any service existed; `Tasks.spec.tsx` failed before `Tasks.tsx` existed).

| Implementation task | Paired test | Result |
|---|---|---|
| T100 `Task` model + migration `20260820150000_epic012_tasks` | T096 + `schema-constraints`/`universal-columns` (16 tables) | pass |
| T101 generation through the engine contract, behind the FR-020 gate | T096 `task-traceability.spec.ts` (every task resolves spec → requirement) + T095 gate (EPIC-009) | pass |
| T102 status updates + project progress aggregation | T101a `tasks.service.spec.ts` (incl. 0-task project → 0%, never NaN) | pass |
| T103 regeneration warns before replacing; failed run keeps the old list | T097 `task-regeneration.spec.ts` | pass |
| T102a tasks controller (generate 202, list, patch, progress) | T098a `tasks.controller.spec.ts` + **T098 contract (7)** | pass |
| T104 task list + progress view, per-task status control | T103a `Tasks.spec.tsx` (3) | pass |

28 backend unit tests across the 4 tasks spec files; suites at closure as recorded in the
EPIC-010 closure (same run).

## Design notes that will matter later

- **The approval gate runs twice on purpose**: `ComposedTasksApi.submitGeneration` checks
  `assertTaskGenerationPermitted` *before* enqueueing the job, and `GenerateTasksService`
  checks again at execution — a spec that loses approval between submit and run is refused.
- **Regeneration is engine-first**: existing tasks are replaced only after the engine returns a
  successful result; a failed run never destroys the current task list. Old traceability links
  remain as audit trail; new tasks get new links in the same act as their creation.
- **Progress is a server aggregate** (`progressForProject`), read by the UI, never recomputed
  client-side — every member sees the same number.
- **Boot regression found and fixed in this run**: `GENERATION_JOBS_SERVICE` was not in
  `SpecificationsModule`'s exports, so `TasksModule`'s `TASKS_API` factory crashed Nest
  bootstrap (worker death hid the error; surfaced with `abortOnError: false`). Export added;
  `controller-composition.spec.ts` (which enumerates controllers, now including
  `TasksController`) guards it.

## `T206` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**
Deferrals: Prisma-backed `TaskStore` lands with the platform composition root — owner
**EPIC-014 F-11.2** (the `Task` model and migration are already in place); worker-side execution
of `generate_tasks` jobs rides the generation worker seam (same owner as `generate_specification`
execution).

## `T207` — defect triage

`specs/012-workflow-tasks/defects/` contains no records. **0 open.**

## `T208` — closing report

**Work completed**: `backend/src/modules/tasks/` (generate-tasks.service, tasks.service,
task-regeneration.service, tasks.controller, tasks.module), the `Task` model + `TaskStatus` enum
+ migration, `AppModule` registration, the `GENERATION_JOBS_SERVICE` export fix, 4 backend unit
spec files + 1 contract spec, `frontend/src/pages/Tasks.tsx` + `Tasks.spec.tsx`, and the api
client's task/progress methods. **Deferred with owners**: Prisma `TaskStore` + worker execution →
EPIC-014 F-11.2 / generation worker seam.

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T205)
- [x] Convergence reports no unbuilt work in scope (T206)
- [x] `defects/` contains no open records (T207)
- [x] Principle deltas hold; deferrals have valid owners (T208)
- [x] Closure recorded — **EPIC-012 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-015` — QA & validation; it owns the conditions EPIC-010 left open and
is the natural next stage gate.
