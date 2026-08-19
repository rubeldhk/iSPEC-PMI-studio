---

description: "Task list for EPIC-011 — Traceability"
---

# Tasks: Traceability

**Epic**: `EPIC-011` | **Module**: M-04 | **Tasks**: 19

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

*Satisfies **FR-029**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*Catalog epic: Specification Management → **Traceability**. Absorbed from the former M-07.*

- [ ] T077a [P] [US3] Unit tests asserting `TraceabilityLink` permits only the two Phase 1 edge types and rejects duplicates, in `backend/tests/unit/traceability/link-constraints.spec.ts`
- [ ] T078 [US3] Define `TraceabilityLink` model with indexes on both traversal directions in `backend/prisma/schema.prisma` (unit test: T077a)
- [ ] T081 [US3] Implement traceability link creation on successful generation in `backend/src/modules/traceability/link-writer.service.ts` (unit test: T073 — **defined in EPIC-008**)

## F-04.13 · Bidirectional traversal

*Satisfies **FR-030**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [ ] T125 [P] [US7] Unit tests for forward traversal from a requirement to all derived artifacts in `backend/tests/unit/traceability/forward-trace.spec.ts`
- [ ] T126 [P] [US7] Unit tests for reverse traversal from a task to originating requirements in `backend/tests/unit/traceability/reverse-trace.spec.ts`
- [ ] T130 [US7] Implement forward and reverse traversal in `backend/src/modules/traceability/traceability.service.ts` (unit tests: T125, T126)

## F-04.14 · Retired-requirement flagging

*Satisfies **FR-029**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [ ] T127 [P] [US7] Unit tests asserting links from retired requirements are returned and flagged, never omitted, in `backend/tests/unit/traceability/retired-links.spec.ts`
- [ ] T131 [US7] Implement retired-requirement flagging on returned links in `backend/src/modules/traceability/retired-flag.ts` (unit test: T127)

## F-04.15 · Coverage reporting

*Satisfies **FR-031**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [ ] T128 [P] [US7] Unit tests for coverage gap detection in `backend/tests/unit/traceability/coverage.spec.ts`
- [ ] T132 [US7] Implement coverage gap reporting in `backend/src/modules/traceability/coverage.service.ts` (unit test: T128)

## F-04.16 · Traceability API

*Satisfies **FR-029**, **FR-030** and **FR-031**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [ ] T129 [P] [US7] Contract tests for trace and coverage endpoints in `backend/tests/contract/traceability.spec.ts`
- [ ] T132a [P] [US7] Unit tests for trace and coverage endpoints with a mocked service in `backend/tests/unit/traceability/traceability.controller.spec.ts`
- [ ] T133 [US7] Implement trace and coverage endpoints in `backend/src/modules/traceability/traceability.controller.ts` (unit test: T132a; contract test: T129)

## F-04.17 · Traceability interface

*Satisfies **FR-029**, **FR-030** and **FR-031**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [ ] T133a [P] [US7] Component unit tests asserting both traversal directions render and retired links are flagged in `frontend/tests/unit/pages/Traceability.spec.tsx`
- [ ] T134 [P] [US7] Implement traceability and coverage views in `frontend/src/pages/Traceability.tsx` (unit test: T133a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/011-traceability/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T201 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/011-traceability/closure.md`
- [ ] T202 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/011-traceability/closure.md`
- [ ] T203 Triage `specs/011-traceability/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/011-traceability/closure.md`
- [ ] T204 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/011-traceability/closure.md`
