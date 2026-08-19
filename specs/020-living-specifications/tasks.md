---

description: "Task list for EPIC-020 — Living Specifications & Impact"
---

# Tasks: Living Specifications & Impact

**Epic**: `EPIC-020` | **Module**: M-04 | **Tasks**: 22

**Spec**: [spec.md](./spec.md) | **Parent design**: [../017-enhancement-model/](../017-enhancement-model/) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification and
> approved business scope. Split from EPIC-017 on 2026-08-04 (ruling **D-18**).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — allocated `T251`–`T272` at the split.

> ⚠️ **The dependency graph is built before living specifications, deliberately.** "What changed
> upstream" is a question about the dependency graph. Building currency detection first means
> inventing a second, weaker traversal and then deleting it.

---

## F-17.5 · Dependency graph

*Satisfies **FR-ENH-008**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*`DependencyEdge` is a **separate table** from `TraceabilityLink` (research **R-017-3**). Derivation
links are system-written, acyclic, and immutable; dependency edges are user-maintained, cyclic-checked,
and mutable. One table with a discriminator makes every query filter by kind.*

- [ ] T251 [P] [US3] Write failing unit tests asserting `DependencyEdge` refuses duplicates and self-edges, and that source and target must share a workspace, in `backend/tests/unit/dependencies/dependency-edge.spec.ts`
- [ ] T252 [US3] Define `DependencyEdge` model with `dependency_type` and indexes on **both** traversal directions in `backend/prisma/schema.prisma` (unit test: T251)
- [ ] T253 [P] [US3] Write failing unit tests for cycle detection as a pure function, covering direct, two-hop, and multi-hop cycles, in `backend/tests/unit/dependencies/cycle-detection.spec.ts`
- [ ] T254 [US3] Implement multi-hop cycle detection running on the path, not only the direct edge, in `backend/src/modules/dependencies/cycle-detector.ts` (unit test: T253)
- [ ] T255 [P] [US3] Write failing unit tests for the dependency service — create, list, delete — asserting a cycle-forming edge is refused before storage, in `backend/tests/unit/dependencies/dependencies.service.spec.ts`
- [ ] T256 [US3] Implement the dependency service in `backend/src/modules/dependencies/dependencies.service.ts` (unit tests: T253, T255)

## F-17.6 · Impact analysis

*Satisfies **FR-ENH-009**, **FR-ENH-010** and **FR-ENH-011**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*A recursive database query with a depth bound, not a materialised closure table (research
**R-017-5**). A closure table trades a trivial write path for write amplification on every edge
change — worth it at a scale this epic does not target.*

- [ ] T257 [P] [US3] Write failing unit tests for impact path construction as a pure function, asserting each affected artifact carries the path and distance by which it is affected, in `backend/tests/unit/dependencies/impact-path.spec.ts`
- [ ] T258 [US3] Implement impact path construction in `backend/src/modules/dependencies/impact-path.ts` (unit test: T257)
- [ ] T259 [P] [US3] Write failing unit tests asserting a truncated traversal returns `bounded = true` and never silently shortens the result, in `backend/tests/unit/dependencies/impact-bounded.spec.ts`
- [ ] T260 [US3] Implement the recursive impact query with a configured depth bound in `backend/src/modules/dependencies/impact.service.ts` (unit tests: T257, T259)
- [ ] T261 [P] [US3] Integration test running impact analysis against a real PostgreSQL via Testcontainers, asserting multi-hop dependents resolve and that a dependency on a retired or archived artifact is returned and marked, in `backend/tests/integration/impact-analysis.spec.ts`
- [ ] T262 [US3] Implement dependency and impact endpoints per `contracts/platform-api.md` in `backend/src/modules/dependencies/dependencies.controller.ts` (unit test: T255; integration test: T261)

## F-17.4 · Living specification currency

*Extends FR-032 rather than duplicating it. The platform already flags a specification out of date
when a **source requirement** changes; `currency_status` generalises that trigger to any upstream
artifact. Satisfies **FR-ENH-006** and **FR-ENH-007** (`T687`); the FR-032 reference above
is the platform behaviour this extends, not a requirement this Epic owns. **One field, wider trigger** — two independent staleness flags would disagree.*

- [ ] T263 [P] [US2] Write failing unit tests asserting a change to any upstream artifact marks the specification `stale` with `stale_reason` naming what changed, and that FR-032's existing requirement-change trigger continues to work through the same field, in `backend/tests/unit/specifications/currency.spec.ts`
- [ ] T264 [US2] Add `currency_status`, `stale_reason`, `reconciled_at/by` to `Specification` in `backend/prisma/schema.prisma` (unit test: T263)
- [ ] T265 [US2] Implement currency detection driven by the dependency graph in `backend/src/modules/specifications/currency.service.ts` (unit tests: T263; depends on T256)
- [ ] T266 [P] [US2] Write failing unit tests asserting reconciliation clears the mark with attribution, and that a **baselined** specification is reconciled by forking a new `draft` rather than by alteration, in `backend/tests/unit/specifications/reconciliation.spec.ts`
- [ ] T267 [US2] Implement reconciliation preserving baseline immutability (FR-011a) in `backend/src/modules/specifications/reconciliation.service.ts` (unit test: T266)
- [ ] T268 [P] [US2] Component unit tests asserting staleness renders **on the specification itself**, not only in a report, in `frontend/tests/unit/components/StalenessBanner.spec.tsx`

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/020-living-specifications/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T269 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/020-living-specifications/closure.md`
- [ ] T270 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/020-living-specifications/closure.md`
- [ ] T271 Triage `specs/020-living-specifications/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/020-living-specifications/closure.md`
- [ ] T272 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/020-living-specifications/closure.md`

---

## Dependencies & Execution Order

**Within this epic**: F-17.5 → F-17.6, and F-17.5 → F-17.4. The dependency graph is the prerequisite
for both impact analysis and currency detection.

**Blocked by**: EPIC-019 (organization tier), EPIC-008 (specifications to mark stale), EPIC-009
(baseline semantics for reconciliation).
**Blocks**: nothing. No other epic in the family depends on this one.

**Parallel opportunities**: T251/T253/T255 together; T257/T259/T261 together; T263/T266/T268 together.
Tasks touching `schema.prisma` (T252, T264) must not run in parallel.

**Frontend note**: T268 has no paired implementation task in this epic — the staleness banner is a
component of the specification view built in **EPIC-010 T084**. T268 extends that component's test
suite. This is a deliberate cross-epic reference of the kind the README convention permits.

## Independent test criteria

Change an upstream artifact, confirm the derived specification is marked stale with the change named,
reconcile it, and confirm the mark clears. Separately: create A → B → C → D dependencies, request
impact for A, and confirm B, C, and D return with paths. Quickstart **V17-4**, **V17-5**, **V17-6**.

## Notes

- `SC-ENH-003` (impact results at 500 specifications) is measured by an integration performance test,
  not by a unit test. It belongs with EPIC-015's scale suite, not here.
- A truncated impact result that does not announce itself reads as completeness — T259 exists
  specifically to prevent that.
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks (Constitution VI).
- Every command run ends with a closing report (Constitution IX).
