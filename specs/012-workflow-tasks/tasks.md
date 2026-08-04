---

description: "Task list for EPIC-012 — Workflow & Tasks"
---

# Tasks: Workflow & Tasks

**Epic**: `EPIC-012` | **Module**: M-06 | **Tasks**: 10

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
- [ ] T101 [US4] Implement task generation through the engine contract with the approval gate in `backend/src/modules/tasks/generate-tasks.service.ts` (unit tests: T095, T096)

## F-06.2 · Status and progress

- [ ] T101a [P] [US4] Unit tests for task status transitions and project progress aggregation in `backend/tests/unit/tasks/tasks.service.spec.ts`
- [ ] T102 [US4] Implement task status updates and project progress aggregation in `backend/src/modules/tasks/tasks.service.ts` (unit test: T101a)

## F-06.3 · Regeneration

- [ ] T097 [P] [US4] Unit tests asserting regeneration warns before replacing existing tasks in `backend/tests/unit/tasks/task-regeneration.spec.ts`
- [ ] T103 [US4] Implement regeneration warning flow in `backend/src/modules/tasks/task-regeneration.service.ts` (unit test: T097)

## F-06.4 · Task API

- [ ] T098 [P] [US4] Contract tests for task endpoints in `backend/tests/contract/tasks.spec.ts`

## F-06.5 · Task interface

- [ ] T103a [P] [US4] Component unit tests for the task list and progress view in `frontend/tests/unit/pages/Tasks.spec.tsx`
- [ ] T104 [P] [US4] Implement task list and progress view in `frontend/src/pages/Tasks.tsx` (unit test: T103a)
