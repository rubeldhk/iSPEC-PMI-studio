---

description: "Task list for EPIC-006 — Project Management"
---

# Tasks: Project Management

**Epic**: `EPIC-006` | **Module**: M-02 | **Tasks**: 13

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-02.1 · Project data and service

- [ ] T049 [P] [US1] Unit tests for project creation validation and unique-name-within-workspace rule in `backend/tests/unit/projects/projects.service.spec.ts`
- [ ] T050 [P] [US1] Unit tests for archive preserving all content in `backend/tests/unit/projects/project-archive.spec.ts`
- [ ] T053 [US1] Define `Project` model with workspace, owner, status, and engine reference in `backend/prisma/schema.prisma` (unit test: T049)
- [ ] T054 [US1] Implement projects service with create, list, get, rename, archive in `backend/src/modules/projects/projects.service.ts` (unit tests: T049, T050)

## F-02.2 · Project API

- [ ] T051 [P] [US1] Contract tests for `/projects` endpoints in `backend/tests/contract/projects.spec.ts`
- [ ] T054a [P] [US1] Unit tests for the projects controller with a mocked service, covering route wiring and cross-workspace not-found, in `backend/tests/unit/projects/projects.controller.spec.ts`
- [ ] T055 [US1] Implement projects controller per `contracts/platform-api.md` in `backend/src/modules/projects/projects.controller.ts` (unit test: T054a; contract test: T051)

## F-02.3 · Project interface

- [ ] T055a [P] [US1] Component unit tests for the projects pages in `frontend/tests/unit/pages/Projects.spec.tsx`
- [ ] T056 [P] [US1] Implement project list and detail pages in `frontend/src/pages/Projects.tsx` (unit test: T055a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/006-project-management/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T181 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/006-project-management/closure.md`
- [ ] T182 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/006-project-management/closure.md`
- [ ] T183 Triage `specs/006-project-management/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/006-project-management/closure.md`
- [ ] T184 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/006-project-management/closure.md`
