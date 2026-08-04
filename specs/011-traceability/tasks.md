---

description: "Task list for EPIC-011 — Traceability"
---

# Tasks: Traceability

**Epic**: `EPIC-011` | **Module**: M-04 | **Tasks**: 15

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.12 · Traceability link model and writing

*Catalog epic: Specification Management → **Traceability**. Absorbed from the former M-07.*

- [ ] T077a [P] [US3] Unit tests asserting `TraceabilityLink` permits only the two Phase 1 edge types and rejects duplicates, in `backend/tests/unit/traceability/link-constraints.spec.ts`
- [ ] T078 [US3] Define `TraceabilityLink` model with indexes on both traversal directions in `backend/prisma/schema.prisma` (unit test: T077a)
- [ ] T081 [US3] Implement traceability link creation on successful generation in `backend/src/modules/traceability/link-writer.service.ts` (unit test: T073)

## F-04.13 · Bidirectional traversal

- [ ] T125 [P] [US7] Unit tests for forward traversal from a requirement to all derived artifacts in `backend/tests/unit/traceability/forward-trace.spec.ts`
- [ ] T126 [P] [US7] Unit tests for reverse traversal from a task to originating requirements in `backend/tests/unit/traceability/reverse-trace.spec.ts`
- [ ] T130 [US7] Implement forward and reverse traversal in `backend/src/modules/traceability/traceability.service.ts` (unit tests: T125, T126)

## F-04.14 · Retired-requirement flagging

- [ ] T127 [P] [US7] Unit tests asserting links from retired requirements are returned and flagged, never omitted, in `backend/tests/unit/traceability/retired-links.spec.ts`
- [ ] T131 [US7] Implement retired-requirement flagging on returned links in `backend/src/modules/traceability/retired-flag.ts` (unit test: T127)

## F-04.15 · Coverage reporting

- [ ] T128 [P] [US7] Unit tests for coverage gap detection in `backend/tests/unit/traceability/coverage.spec.ts`
- [ ] T132 [US7] Implement coverage gap reporting in `backend/src/modules/traceability/coverage.service.ts` (unit test: T128)

## F-04.16 · Traceability API

- [ ] T129 [P] [US7] Contract tests for trace and coverage endpoints in `backend/tests/contract/traceability.spec.ts`
- [ ] T132a [P] [US7] Unit tests for trace and coverage endpoints with a mocked service in `backend/tests/unit/traceability/traceability.controller.spec.ts`
- [ ] T133 [US7] Implement trace and coverage endpoints in `backend/src/modules/traceability/traceability.controller.ts` (unit test: T132a; contract test: T129)

## F-04.17 · Traceability interface

- [ ] T133a [P] [US7] Component unit tests asserting both traversal directions render and retired links are flagged in `frontend/tests/unit/pages/Traceability.spec.tsx`
- [ ] T134 [P] [US7] Implement traceability and coverage views in `frontend/src/pages/Traceability.tsx` (unit test: T133a)
