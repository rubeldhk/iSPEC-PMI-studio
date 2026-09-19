---

description: "Task list for EPIC-007 — Requirement Intelligence"
---

# Tasks: Requirement Intelligence

**Epic**: `EPIC-007` | **Module**: M-03 | **Tasks**: 24

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (BR-0020, BR-0021; scope
> ruling T-106). The prior hold (decision D-10) is discharged; posture authority is
> [spec.md](./spec.md).


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-03.1 · Requirement data model

- [X] T059 [P] [US2] Unit tests for requirement validation, refusing an empty description and naming the field, in `backend/tests/unit/requirements/requirements.service.spec.ts`
- [X] T062 [P] [US2] Unit tests for filtering and sorting by type, priority, and status in `backend/tests/unit/requirements/requirement-filters.spec.ts`
- [X] T064 [US2] Define `Requirement` and `RequirementVersion` models with indexes on type, priority, and status in `backend/prisma/schema.prisma` (unit tests: T059, T062)

## F-03.2 · Validation rules

- [X] T065 [US2] Implement requirement validation rules in `backend/src/modules/requirements/requirement.validation.ts` (unit test: T059)

## F-03.3 · Requirement register service

- [X] T066 [US2] Implement requirements service with create, edit, list, filter in `backend/src/modules/requirements/requirements.service.ts` (unit tests: T059, T062)

## F-03.4 · Edit history

- [X] T060 [P] [US2] Unit tests asserting an edit appends a version and prior text stays retrievable, in `backend/tests/unit/requirements/requirement-versions.spec.ts`
- [X] T067 [US2] Implement append-only version history on edit in `backend/src/modules/requirements/requirement-version.service.ts` (unit test: T060)

### Database-level immutability *(added 2026-08-08)*

*The shared design mandates immutability **at the database**: `../_shared/schema.sql` attaches a
`BEFORE UPDATE OR DELETE` trigger to this table. The service-layer task above delivers only the code
half — which a bug or a direct query bypasses. Same gap found in EPIC-004 (analysis finding **C1**)
and closed there by `T454`, which creates the shared `reject_mutation()` function this trigger
attaches to.*

- [X] T457 [P] [US2] Write failing integration test asserting `UPDATE` and `DELETE` against `requirement_versions` are rejected **by the database** — issued as raw SQL against a real PostgreSQL via Testcontainers, since a mocked repository cannot fail this (**FR-009**, and FR-013's "prior versions retrievable and unaltered"), in `backend/tests/integration/requirement-version-immutability.spec.ts`
- [X] T458 [US2] Attach the `requirement_versions_immutable` `BEFORE UPDATE OR DELETE` trigger to the shared `reject_mutation()` function, per `../_shared/schema.sql`, in `backend/prisma/migrations/` (**FR-009**; integration test: T457; **depends on EPIC-004 T454**, which creates the function — do not redefine it)

## F-03.5 · Retirement

*FR-006 — retired requirements are marked, never deleted, so derived artifacts stay traceable.*

- [X] T061 [P] [US2] Unit tests asserting retire marks rather than deletes, and derived artifacts stay traceable, in `backend/tests/unit/requirements/requirement-retire.spec.ts`
- [X] T068 [US2] Implement retire behaviour preserving traceability in `backend/src/modules/requirements/requirement-retire.service.ts` (unit test: T061)

## F-03.6 · Change detection

*Feeds out-of-date flagging in F-04.7.*

- [X] T068a [P] [US2] Unit tests asserting the content hash changes on material edits and is stable for incidental ones, in `backend/tests/unit/requirements/requirement-hash.spec.ts`
- [X] T069 [US2] Implement content hashing for later out-of-date detection in `backend/src/modules/requirements/requirement-hash.ts` (unit test: T068a)

## F-03.7 · Requirement API

- [X] T063 [P] [US2] Contract tests for `/requirements` endpoints in `backend/tests/contract/requirements.spec.ts`
- [X] T069a [P] [US2] Unit tests for the requirements controller with a mocked service in `backend/tests/unit/requirements/requirements.controller.spec.ts`
- [X] T070 [US2] Implement requirements controller in `backend/src/modules/requirements/requirements.controller.ts` (unit test: T069a; contract test: T063)

## F-03.8 · Requirement interface

- [X] T070a [P] [US2] Component unit tests for the requirement register page covering filter behaviour in `frontend/tests/unit/pages/Requirements.spec.tsx`
- [X] T071 [P] [US2] Implement requirement register page with filters in `frontend/src/pages/Requirements.tsx` (unit test: T070a)
- [X] T071a [P] [US2] Component unit tests for the requirement editor covering empty-description refusal and history rendering in `frontend/tests/unit/components/RequirementEditor.spec.tsx`
- [X] T072 [P] [US2] Implement requirement editor and version history view in `frontend/src/components/RequirementEditor.tsx` (unit test: T071a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/007-requirement-intelligence/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T185 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/007-requirement-intelligence/closure.md`
- [X] T186 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/007-requirement-intelligence/closure.md`
- [X] T187 Triage `specs/007-requirement-intelligence/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/007-requirement-intelligence/closure.md`
- [X] T188 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/007-requirement-intelligence/closure.md`
