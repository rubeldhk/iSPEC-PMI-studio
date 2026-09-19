---

description: "Task list for EPIC-019 — Steering Engine"
---

# Tasks: Steering Engine

**Epic**: `EPIC-019` | **Module**: M-01 / M-04 | **Tasks**: 27

**Spec**: [spec.md](./spec.md) | **Parent design**: [../017-enhancement-model/](../017-enhancement-model/) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (APPROVED; scope ruling T-106,
> BR-0070). Split from EPIC-017 on 2026-08-04 (ruling **D-18**).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — allocated `T225`–`T250` at the split, plus `T246a` added 2026-08-09 to
close the steering/prompt architecture-test gap (sub-lettered so no existing ID moves).
Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

> ⚠️ **F-17.1 must land before any other epic in the EPIC-017 family.** It adds a tenancy scope above
> workspace. That is a column while no workspace rows exist and a data migration afterwards
> (research **R-017-1**).

---

## F-17.1 · Steering scopes and hierarchy

*Satisfies **FR-ENH-001** and **FR-ENH-005**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*The organization tier. `organization_id` goes on `workspaces` **only** — every artifact reaches its
organization by one join, and a second denormalised tenancy column is a second thing to get wrong in
a security boundary (R-017-1).*

- [X] T225 [P] [US1] Write failing unit tests asserting a workspace belongs to exactly one organization, that deleting an organization with workspaces is refused, and that organization is reachable from any artifact by one join, in `backend/tests/unit/steering/organization.spec.ts`
- [X] T226 [US1] Define `Organization` model and add required `organization_id` to `Workspace` in `backend/prisma/schema.prisma` (unit test: T225)
- [X] T227 [US1] Add the organization migration in `backend/prisma/migrations/` — no other table gains a tenancy column (unit test: T225)
- [X] T228 [P] [US1] Write failing unit tests for four-scope path validation — `organization → workspace → project → product`, each scope resolving to a parent in the level above — in `backend/tests/unit/steering/scope.spec.ts`
- [X] T229 [US1] Define `SteeringScope` model with `scope_type` and `scope_ref` in `backend/prisma/schema.prisma` (unit test: T228)
- [X] T230 [US1] Implement scope path resolution and parent validation in `backend/src/modules/steering/scope-resolver.ts` (unit test: T228)

## F-17.2 · Steering content, versioning and API

- [X] T231 [P] [US1] Write failing unit tests asserting a meaningful change creates a new version, prior versions stay retrievable, and retire marks rather than deletes, in `backend/tests/unit/steering/steering-document.spec.ts`
- [X] T232 [US1] Define `SteeringDocument` model with `subject`, `scope_id`, `content`, `version`, `status`, and a unique `(subject, scope_id, version)` constraint in `backend/prisma/schema.prisma` (unit test: T231)
- [X] T233 [US1] Implement the steering service — create, edit, version, retire, with append-only edit history (**FR-ENH-003**) — in `backend/src/modules/steering/steering.service.ts` (unit test: T231)
- [X] T234 [P] [US1] Write failing unit tests asserting the ten subjects of FR-ENH-002 are accepted and any other subject is refused by name, in `backend/tests/unit/steering/steering-subjects.spec.ts`
- [X] T235 [US1] Implement subject validation for the ten named subjects in `backend/src/modules/steering/steering.validation.ts` (unit test: T234)
- [X] T236 [P] [US1] Contract tests for `/steering` endpoints against `contracts/platform-api.md` in `backend/tests/contract/steering.spec.ts`
- [X] T237 [P] [US1] Write failing unit tests for the steering controller with a mocked service, covering route wiring and cross-workspace not-found, in `backend/tests/unit/steering/steering.controller.spec.ts`
- [X] T238 [US1] Implement the steering controller in `backend/src/modules/steering/steering.controller.ts` (unit test: T237; contract test: T236)

## F-17.3 · Steering application, provenance and engine contract

*Satisfies **FR-ENH-004**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*Resolution is a pure function — which is what makes SC-ENH-001 testable without generating anything.
Provenance is stamped at generation time, never recomputed: recomputing returns **current** steering,
not the steering that applied.*

- [X] T239 [P] [US1] Write failing unit tests for steering resolution as a pure function — narrower scope wins, the override is recorded naming both winner and loser, and the resolved set is ordered broadest to narrowest — in `backend/tests/unit/steering/steering-resolution.spec.ts`
- [X] T240 [US1] Implement steering resolution and override records in `backend/src/modules/steering/steering-resolver.ts` (unit test: T239)
- [X] T241 [P] [US1] Write failing unit tests asserting a `SteeringApplication` row is written for **every** generation — with an empty set when no steering is in scope, never a missing row — in `backend/tests/unit/steering/steering-application.spec.ts`
- [X] T242 [US1] Define `SteeringApplication` model and implement provenance stamping at generation time in `backend/src/modules/steering/steering-application.service.ts` (unit test: T241)
- [X] T243 [P] [US1] Write failing unit tests for the `SteeringInput[]` contract shape, asserting plain data only and broadest-to-narrowest ordering, in `packages/engine-contract/tests/unit/steering-input.spec.ts`
- [X] T244 [US1] Add the optional `steering` field to `GenerateSpecificationInput` per `../017-enhancement-model/contracts/steering-contract.md` in `packages/engine-contract/src/index.ts` (unit test: T243)
- [X] T245 [US1] Extend the shared conformance suite with cases **C-14** (absent steering is byte-identical to baseline), **C-15** (structured steering consumed with no platform-side formatting), and **C-16** (a steering violation returns a finding, not a failure) in `packages/engine-contract/tests/conformance/engine-conformance.suite.ts`
- [X] T246 [US1] Extend the fixture adapter to consume steering and to inject a steering violation on demand, in `engine-adapters/fixture/src/fixture.adapter.ts` (conformance: T245)
- [X] T246a [US1] Extend the architecture test to fail the build if `backend/src/**` assembles steering into prompt text — assert no steering field is template-interpolated, string-concatenated, or joined into a natural-language instruction, and that steering leaves `backend/` only as structured `SteeringInput[]` — in `backend/tests/architecture/engine-independence.spec.ts` (**R-017-2**, PP-006). The existing `T047`/`T142` checks match engine *names* and cannot detect a prompt built from steering without naming one

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/019-steering-engine/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T247 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/019-steering-engine/closure.md`
- [X] T248 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/019-steering-engine/closure.md`
- [X] T249 Triage `specs/019-steering-engine/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/019-steering-engine/closure.md`
- [X] T250 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/019-steering-engine/closure.md`

---

## Dependencies & Execution Order

**Within this epic**: F-17.1 → F-17.2 → F-17.3. Scopes must exist before documents can be bound to
them, and documents before they can be resolved and applied.

**Blocks**: EPIC-020, EPIC-021, and EPIC-022 all inherit the organization tier from T226/T227.
**Blocked by**: EPIC-004 (tenancy), EPIC-008 (generation, for provenance stamping).

**Parallel opportunities**: all `[P]` test tasks within a function can run together — T225/T228,
T231/T234/T236/T237, T239/T241/T243. Implementation tasks touching `schema.prisma` (T226, T229, T232,
T242) must not run in parallel with each other.

## Independent test criteria

Record steering content constraining one standard, generate a specification and confirm the output
honours it and records its provenance; retire the steering content, regenerate, and confirm the
difference. Quickstart **V17-1**, **V17-2**, and **V17-3** in
[../017-enhancement-model/quickstart.md](../017-enhancement-model/quickstart.md).

## Notes

- Steering is **additive**: an empty `steering` field must leave every existing conformance case
  passing unchanged (contract rule S4). T245 asserts it.
- `backend/` must never format steering into a prompt — that is engine-specific and regresses PP-006.
  **`T246a` is the backstop.** `T047`/`T142` are *not* sufficient here: they match engine names and
  adapter imports, and a prompt assembled from steering text names no engine, so it passes them.
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks, not direct
  patches (Constitution VI).
- Every command run ends with a closing report: what was done + recommended next task (Constitution IX).
