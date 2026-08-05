---

description: "Task list for EPIC-012 — Workflow & Tasks"
---

# Tasks: Workflow & Tasks

**Epic**: `EPIC-012` | **Module**: M-06 | **Tasks**: 16

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-06.1 · Task generation

- [ ] T096 [P] [US4] Unit tests asserting every task resolves back through its specification to a requirement in `backend/tests/unit/tasks/task-traceability.spec.ts`
- [ ] T100 [US4] Define `Task` model in `backend/prisma/schema.prisma` (unit test: T096)
- [ ] T101 [US4] Implement task generation through the engine contract with the approval gate in `backend/src/modules/tasks/generate-tasks.service.ts` (unit tests: T095 — **defined in EPIC-009**, T096)

## F-06.2 · Status and progress

- [ ] T101a [P] [US4] Unit tests for task status transitions and project progress aggregation in `backend/tests/unit/tasks/tasks.service.spec.ts`
- [ ] T102 [US4] Implement task status updates and project progress aggregation in `backend/src/modules/tasks/tasks.service.ts` (unit test: T101a)

## F-06.3 · Regeneration

- [ ] T097 [P] [US4] Unit tests asserting regeneration warns before replacing existing tasks in `backend/tests/unit/tasks/task-regeneration.spec.ts`
- [ ] T103 [US4] Implement regeneration warning flow in `backend/src/modules/tasks/task-regeneration.service.ts` (unit test: T097)

## F-06.4 · Task API

*FR-020 and US4 scenario 3. The controller was missing while its contract test existed — added by `/speckit-analyze` finding **G1**.*

- [ ] T098 [P] [US4] Contract tests for task endpoints in `backend/tests/contract/tasks.spec.ts`
- [ ] T098a [P] [US4] Unit tests for the tasks controller with a mocked service, covering route wiring, the approval gate refusal, status update, and cross-workspace not-found, in `backend/tests/unit/tasks/tasks.controller.spec.ts`
- [ ] T102a [US4] Implement tasks controller — generate, list, get, and status update — per `contracts/platform-api.md` in `backend/src/modules/tasks/tasks.controller.ts` (unit test: T098a; contract test: T098)

## F-06.5 · Task interface

- [ ] T103a [P] [US4] Component unit tests for the task list and progress view in `frontend/tests/unit/pages/Tasks.spec.tsx`
- [ ] T104 [P] [US4] Implement task list and progress view in `frontend/src/pages/Tasks.tsx` (unit test: T103a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/012-workflow-tasks/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T205 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/012-workflow-tasks/closure.md`
- [ ] T206 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/012-workflow-tasks/closure.md`
- [ ] T207 Triage `specs/012-workflow-tasks/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/012-workflow-tasks/closure.md`
- [ ] T208 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/012-workflow-tasks/closure.md`
