---

description: "Task list for EPIC-009 — Specification Lifecycle & Versioning"
---

# Tasks: Specification Lifecycle & Versioning

**Epic**: `EPIC-009` | **Module**: M-04 | **Tasks**: 28

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.8 · Lifecycle state machine

*T099 ships the minimal machine for M-06 (task generation needs `approved`); T111 completes it.*

- [X] T095 [P] [US4] Unit tests asserting task generation is refused unless the specification is approved in `backend/tests/unit/tasks/task-generation-gate.spec.ts`
- [X] T099 [US4] Implement the lifecycle state machine with the six states from SRS M08 §8 — `draft → review → approved → baselined → implemented → archived` — and transition guards in `backend/src/modules/specifications/lifecycle.machine.ts` (unit test: T095)
- [X] T099a [P] [US5] Unit tests asserting a baselined specification is immutable — editing forks a new version in `draft` and the baseline stays retrievable unchanged — and that archiving retains traceability links, in `backend/tests/unit/specifications/baseline-archive.spec.ts`
- [X] T099b [US5] Implement baseline immutability and archive behaviour in `backend/src/modules/specifications/baseline.service.ts` (FR-011a, FR-011b; unit test: T099a)
- [X] T106 [P] [US5] Unit tests covering all eight permitted transitions of the M08 six-state lifecycle and asserting every other transition is refused naming the permitted set, in `backend/tests/unit/specifications/lifecycle-guard.spec.ts`
- [X] T109 [US5] Define `LifecycleTransition` model in `backend/prisma/schema.prisma` (unit test: T106)
- [X] T111 [US5] Extend the lifecycle machine to record actor and time on every transition in `backend/src/modules/specifications/lifecycle.machine.ts` (unit test: T106)

## F-04.9 · Versioning and comparison

*Satisfies **FR-013** and **FR-015**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T105 [P] [US5] Unit tests asserting each meaningful change creates a version and prior versions stay unaltered in `backend/tests/unit/specifications/versioning.spec.ts`
- [X] T107 [P] [US5] Unit tests for version comparison output in `backend/tests/unit/specifications/version-diff.spec.ts`
- [X] T110 [US5] Implement append-only version creation on meaningful change in `backend/src/modules/specifications/version.service.ts` (unit test: T105)

### Database-level immutability *(added 2026-08-08)*

*The shared design mandates immutability **at the database**: `../_shared/schema.sql` attaches a
`BEFORE UPDATE OR DELETE` trigger to this table. The service-layer task above delivers only the code
half — which a bug or a direct query bypasses. Same gap found in EPIC-004 (analysis finding **C1**)
and closed there by `T454`, which creates the shared `reject_mutation()` function this trigger
attaches to.*

- [X] T459 [P] [US5] Write failing integration test asserting `UPDATE` and `DELETE` against `specification_versions` are rejected **by the database** — raw SQL against a real PostgreSQL via Testcontainers (**FR-013**, **SC-007**: any prior version retrievable *unchanged*), in `backend/tests/integration/specification-version-immutability.spec.ts`
- [X] T460 [US5] Attach the `specification_versions_immutable` `BEFORE UPDATE OR DELETE` trigger to the shared `reject_mutation()` function, per `../_shared/schema.sql`, in `backend/prisma/migrations/` (**FR-013**, **SC-007**; integration test: T459; **depends on EPIC-004 T454**, which creates the function — do not redefine it)
- [X] T112 [US5] Implement version comparison in `backend/src/modules/specifications/version-diff.service.ts` (unit test: T107)

## F-04.10 · Lifecycle, versioning and validation APIs

*Satisfies **FR-011**, **FR-013**, **FR-015** and **FR-023**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

- [X] T108 [P] [US5] Contract tests covering all six lifecycle transition endpoints — `submit-for-review`, `reject`, `approve`, `baseline`, `mark-implemented`, `archive` — plus version endpoints, in `backend/tests/contract/specification-lifecycle.spec.ts`
- [X] T112a [P] [US5] Unit tests for lifecycle and version endpoints with a mocked service in `backend/tests/unit/specifications/lifecycle.controller.spec.ts`
- [X] T113 [US5] Implement the six lifecycle transition endpoints (`submit-for-review`, `reject`, `approve`, `baseline`, `mark-implemented`, `archive`) and the version endpoints per `contracts/platform-api.md` in `backend/src/modules/specifications/specifications.controller.ts` (unit test: T112a; contract test: T108)
- [X] T117 [P] [US6] Unit tests asserting every finding carries a location, and a finding without one is malformed output, in `backend/tests/unit/specifications/validation-findings.spec.ts`
- [X] T118 [P] [US6] Unit tests asserting outstanding findings are surfaced before approval proceeds in `backend/tests/unit/specifications/approval-findings.spec.ts`
- [X] T119 [P] [US6] Contract tests for validation endpoints in `backend/tests/contract/validation.spec.ts`
- [X] T120 [US6] Define `ValidationFinding` model bound to a specification version in `backend/prisma/schema.prisma` (unit test: T117)
- [X] T121 [US6] Implement validation orchestration through the engine contract in `backend/src/modules/specifications/validate-specification.service.ts` (unit test: T117)
- [X] T122 [US6] Implement the approval path surfacing outstanding findings in `backend/src/modules/specifications/approval.service.ts` (unit test: T118)
- [X] T122a [P] [US6] Unit tests for validation endpoints with a mocked service in `backend/tests/unit/specifications/validation.controller.spec.ts`
- [X] T123 [US6] Implement validation endpoints in `backend/src/modules/specifications/specifications.controller.ts` (unit test: T122a; contract test: T119)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/009-spec-lifecycle-versioning/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T193 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/009-spec-lifecycle-versioning/closure.md`
- [X] T194 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/009-spec-lifecycle-versioning/closure.md`
- [X] T195 Triage `specs/009-spec-lifecycle-versioning/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/009-spec-lifecycle-versioning/closure.md`
- [X] T196 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/009-spec-lifecycle-versioning/closure.md`
