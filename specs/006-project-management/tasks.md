---

description: "Task list for EPIC-006 — Project Management"
---

# Tasks: Project Management

**Epic**: `EPIC-006` | **Module**: M-02 | **Tasks**: 9

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
