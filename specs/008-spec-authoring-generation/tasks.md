---

description: "Task list for EPIC-008 — Specification Authoring & Generation"
---

# Tasks: Specification Authoring & Generation

**Epic**: `EPIC-008` | **Module**: M-04 | **Tasks**: 19

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.1 · Specification data model

- [ ] T073 [P] [US3] Unit tests asserting a generated specification links to every selected requirement and none is orphaned, in `backend/tests/unit/specifications/generation-links.spec.ts`
- [ ] T077 [US3] Define `Specification` and `SpecificationVersion` models storing both raw and parsed content in `backend/prisma/schema.prisma` (unit test: T073)

## F-04.2 · Engine output parsing

*Unparseable and empty output are failures, never a stored specification.*

- [ ] T075 [P] [US3] Unit tests for engine output parsing, treating unparseable and empty output as failures, in `backend/tests/unit/specifications/output-parser.spec.ts`
- [ ] T079 [US3] Implement the engine output parser rejecting malformed and empty output in `backend/src/modules/specifications/output-parser.ts` (unit test: T075)

## F-04.3 · Generation orchestration

- [ ] T074 [P] [US3] Unit tests asserting each failure reason is distinct and stores no partial artifact, in `backend/tests/unit/specifications/generation-failures.spec.ts`
- [ ] T080 [US3] Implement specification generation orchestration invoking the engine through the contract in `backend/src/modules/specifications/generate-specification.service.ts` (unit tests: T073, T074)

## F-04.4 · Engine provenance stamping

- [ ] T081a [P] [US3] Unit tests asserting engine name and version are stamped on every generated artifact and never left null, in `backend/tests/unit/specifications/engine-stamp.spec.ts`
- [ ] T082 [US3] Implement engine and engine-version stamping on every generated artifact in `backend/src/modules/specifications/engine-stamp.ts` (unit test: T081a)

## F-04.5 · Generation job API

- [ ] T076 [P] [US3] Contract tests for generation job endpoints returning 202 with a job in `backend/tests/contract/generation-jobs.spec.ts`
- [ ] T082a [P] [US3] Unit tests for the specifications controller with a mocked service in `backend/tests/unit/specifications/specifications.controller.spec.ts`
- [ ] T083 [US3] Implement generation job endpoints in `backend/src/modules/specifications/specifications.controller.ts` (unit test: T082a; contract test: T076)

## F-04.6 · Specification read surface

*FR-012. Added closing `/speckit-analyze` finding E1 (RAID I-02).*

- [ ] T076a [P] [US3] Unit tests for specification list, detail, and edit — pagination, project scoping, and cross-workspace not-found — in `backend/tests/unit/specifications/specifications-read.spec.ts` (**FR-012**)
- [ ] T076b [P] [US3] Contract tests for `GET /projects/{id}/specifications`, `GET /specifications/{id}`, and `PATCH /specifications/{id}` in `backend/tests/contract/specifications-read.spec.ts` (**FR-012**)
- [ ] T083a [US3] Implement specification list, detail, and edit endpoints in `backend/src/modules/specifications/specifications.controller.ts` (**FR-012**; unit test: T076a; contract test: T076b)
- [ ] T083b [US3] Implement the specification read service backing list, detail, and edit in `backend/src/modules/specifications/specifications-read.service.ts` (**FR-012**; unit test: T076a)
- [ ] T083f [P] [US3] Unit tests for specification search — title and content matching, workspace and project scoping, and result ordering — in `backend/tests/unit/specifications/specification-search.spec.ts` (MPS Volume 2, advanced search and filtering)
- [ ] T083g [US3] Implement specification search and filtering in `backend/src/modules/specifications/specification-search.service.ts` (MPS Volume 2; unit test: T083f)

## F-04.7 · Out-of-date detection

*FR-032 — flagged, never silently regenerated.*

- [ ] T093a [P] [US3] Unit tests asserting a requirement change flags derived specifications out of date without altering their content, in `backend/tests/unit/specifications/out-of-date.spec.ts`
- [ ] T094 [US3] Implement out-of-date flagging when a source requirement changes, without altering the specification, in `backend/src/modules/specifications/out-of-date.service.ts` (unit test: T093a)
