---

description: "Task list for EPIC-007 — Requirement Intelligence"
---

# Tasks: Requirement Intelligence

**Epic**: `EPIC-007` | **Module**: M-03 | **Tasks**: 18

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-03.1 · Requirement data model

- [ ] T059 [P] [US2] Unit tests for requirement validation, refusing an empty description and naming the field, in `backend/tests/unit/requirements/requirements.service.spec.ts`
- [ ] T062 [P] [US2] Unit tests for filtering and sorting by type, priority, and status in `backend/tests/unit/requirements/requirement-filters.spec.ts`
- [ ] T064 [US2] Define `Requirement` and `RequirementVersion` models with indexes on type, priority, and status in `backend/prisma/schema.prisma` (unit tests: T059, T062)

## F-03.2 · Validation rules

- [ ] T065 [US2] Implement requirement validation rules in `backend/src/modules/requirements/requirement.validation.ts` (unit test: T059)

## F-03.3 · Requirement register service

- [ ] T066 [US2] Implement requirements service with create, edit, list, filter in `backend/src/modules/requirements/requirements.service.ts` (unit tests: T059, T062)

## F-03.4 · Edit history

- [ ] T060 [P] [US2] Unit tests asserting an edit appends a version and prior text stays retrievable, in `backend/tests/unit/requirements/requirement-versions.spec.ts`
- [ ] T067 [US2] Implement append-only version history on edit in `backend/src/modules/requirements/requirement-version.service.ts` (unit test: T060)

## F-03.5 · Retirement

*FR-006 — retired requirements are marked, never deleted, so derived artifacts stay traceable.*

- [ ] T061 [P] [US2] Unit tests asserting retire marks rather than deletes, and derived artifacts stay traceable, in `backend/tests/unit/requirements/requirement-retire.spec.ts`
- [ ] T068 [US2] Implement retire behaviour preserving traceability in `backend/src/modules/requirements/requirement-retire.service.ts` (unit test: T061)

## F-03.6 · Change detection

*Feeds out-of-date flagging in F-04.7.*

- [ ] T068a [P] [US2] Unit tests asserting the content hash changes on material edits and is stable for incidental ones, in `backend/tests/unit/requirements/requirement-hash.spec.ts`
- [ ] T069 [US2] Implement content hashing for later out-of-date detection in `backend/src/modules/requirements/requirement-hash.ts` (unit test: T068a)

## F-03.7 · Requirement API

- [ ] T063 [P] [US2] Contract tests for `/requirements` endpoints in `backend/tests/contract/requirements.spec.ts`
- [ ] T069a [P] [US2] Unit tests for the requirements controller with a mocked service in `backend/tests/unit/requirements/requirements.controller.spec.ts`
- [ ] T070 [US2] Implement requirements controller in `backend/src/modules/requirements/requirements.controller.ts` (unit test: T069a; contract test: T063)

## F-03.8 · Requirement interface

- [ ] T070a [P] [US2] Component unit tests for the requirement register page covering filter behaviour in `frontend/tests/unit/pages/Requirements.spec.tsx`
- [ ] T071 [P] [US2] Implement requirement register page with filters in `frontend/src/pages/Requirements.tsx` (unit test: T070a)
- [ ] T071a [P] [US2] Component unit tests for the requirement editor covering empty-description refusal and history rendering in `frontend/tests/unit/components/RequirementEditor.spec.tsx`
- [ ] T072 [P] [US2] Implement requirement editor and version history view in `frontend/src/components/RequirementEditor.tsx` (unit test: T071a)
