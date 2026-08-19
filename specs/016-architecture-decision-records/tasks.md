---

description: "Task list for EPIC-016 — Architecture Decision Records"
---

# Tasks: Architecture Decision Records

**Epic**: `EPIC-016` | **Module**: M-13 | **Tasks**: 12

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

**Regenerated 2026-08-04** to close the three gaps recorded in [plan.md](./plan.md): **G-16.1** —
`T143` covered model, service, and endpoints in one task targeting a *directory*; it is now split
three ways with a test each. **G-16.2** — four specified endpoints had no contract test. **G-16.3** —
FR-034 had no quickstart scenario. No existing task ID was reused or renumbered.

---

## F-13.2 · Architecture Decision Records

*Satisfies **FR-034**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*SRS PMI-DOC-000 §9 and the Product Charter both mandate ADRs from day one. Entity, tables, enum, and
all four endpoints are already specified in [`../_shared/`](../_shared/) — this epic implements them
and adds no design.*

### Model

- [ ] T144 [P] Write failing unit tests for the ADR model — required `context`, `decision`, `consequences`; `UNIQUE (project_id, reference)` so two projects may each hold `ADR-0001`; `adr_status` defaulting to `proposed` — in `backend/tests/unit/decisions/adr-model.spec.ts`
- [ ] T143 Define the `ArchitectureDecisionRecord` model and the `adr_specification_links` join table per `../_shared/schema.sql` in `backend/prisma/schema.prisma` (unit test: T144)

### Service

- [ ] T144a [P] Write failing unit tests for the ADR service — creation, status change `proposed → accepted → superseded`, a superseded record staying readable rather than removed, and linking/unlinking affected specifications — in `backend/tests/unit/decisions/decisions.service.spec.ts`
- [ ] T143a Implement the ADR service with create, list, update, status change, and specification linking in `backend/src/modules/decisions/decisions.service.ts` (unit test: T144a)

### API

- [ ] T144b [P] Write failing unit tests for the ADR controller with a mocked service, covering route wiring and cross-workspace access returning **not-found, never forbidden**, in `backend/tests/unit/decisions/decisions.controller.spec.ts`
- [ ] T144c [P] Contract tests for the four ADR endpoints — `GET` and `POST /projects/{id}/decisions`, `PATCH /decisions/{id}`, `POST /decisions/{id}/links` — against `../_shared/contracts/platform-api.md` in `backend/tests/contract/decisions.spec.ts`
- [ ] T143b Implement the ADR controller exposing those four endpoints in `backend/src/modules/decisions/decisions.controller.ts` (unit test: T144b; contract test: T144c)

### Validation

- [ ] T143c Add quickstart scenario **V14 — Architecture Decision Records (FR-034)** to `specs/_shared/quickstart.md`: create an ADR against a project, move it `proposed → accepted → superseded`, link it to a specification, and confirm the superseded record is still readable

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/016-architecture-decision-records/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T221 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/016-architecture-decision-records/closure.md`
- [ ] T222 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/016-architecture-decision-records/closure.md`
- [ ] T223 Triage `specs/016-architecture-decision-records/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/016-architecture-decision-records/closure.md`
- [ ] T224 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/016-architecture-decision-records/closure.md`

---

## Dependencies & Execution Order

**Within this epic**: model → service → API. `T143c` may run at any point; it writes a validation
scenario, not code.

**Blocked by**:

- **EPIC-006** — `architecture_decision_records.project_id` is a required foreign key to `projects`
- **EPIC-008** — `adr_specification_links` references `specifications`

Both are held. This epic is not blocked on design; it is blocked on tables that do not exist yet.

**Blocks**: nothing.

**Parallel opportunities**: `T144` first, alone; then `T144a`; then `T144b` and `T144c` together.
The implementation tasks are sequential — `T143` touches `schema.prisma`, and `T143a`/`T143b` build
on each other.

## Independent test criteria

Create an ADR against a project, move it `proposed → accepted → superseded`, link it to the
specifications it affects, and confirm the superseded record remains readable. Confirm a second
project can hold its own `ADR-0001` without collision, and that cross-workspace access returns 404.

This is quickstart **V14**, which `T143c` writes.

## Notes

- ⚠️ **Cross-epic ripple, handled**: EPIC-014 `T153` executed quickstart **V1–V12** as the release
  gate. Adding V14 without updating it would have left FR-034 shipping unexercised — which was gap
  **G-16.3** exactly. `T153` now reads `V1–V12 **and V14**`.
- **An ADR reference is unique per project, not globally.** Two projects may each hold `ADR-0001`.
  That is correct, and it collides in *format* with the programme's own records in
  [`adr/`](../../adr/), which are unrelated. Anything reporting or exporting ADRs must make clear
  which population it shows — a defect here reads as a confusing report rather than an error, so it
  survives review.
- **Status is not a lifecycle.** `proposed → accepted → superseded` is a three-value enum with no
  transition guards and no attribution table — deliberately unlike EPIC-009's six-state specification
  lifecycle. Do not reuse `LifecycleTransition` here.
- **Superseding is a status, not a deletion.** A superseded ADR stays readable, consistent with
  retired requirements (FR-006) and archived specifications (FR-011b).
- `T144` is listed before `T143` — correct execution order, inverted IDs. This is the only place in
  375 tasks where a test's ID exceeds the implementation it covers (finding **I6**). Left as-is
  because invariant IDs are the stronger convention; renumber at the D-1/D-9 pass if ever.
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks, not direct
  patches (Constitution VI).
- Every command run ends with a closing report: what was done + recommended next task
  (Constitution IX).
