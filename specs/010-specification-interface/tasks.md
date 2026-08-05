---

description: "Task list for EPIC-010 — Specification Interface"
---

# Tasks: Specification Interface

**Epic**: `EPIC-010` | **Module**: M-04 | **Tasks**: 19

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.11 · Specification interface

- [ ] T083c [P] [US3] Component unit tests for the specification list page in `frontend/tests/unit/pages/SpecificationList.spec.tsx` (**FR-012**)
- [ ] T083d [P] [US3] Implement specification list page in `frontend/src/pages/SpecificationList.tsx` (**FR-012**; unit test: T083c)
- [ ] T083e [P] [US3] Component unit tests for the specification detail view in `frontend/tests/unit/pages/Specification.spec.tsx`
- [ ] T084 [P] [US3] Implement specification view showing engine, version, and out-of-date state in `frontend/src/pages/Specification.tsx` (unit test: T083e)
- [ ] T084a [P] [US3] Component unit tests asserting the job progress indicator polls without blocking interaction in `frontend/tests/unit/components/JobProgress.spec.tsx`
- [ ] T085 [P] [US3] Implement job progress indicator that does not block the rest of the UI in `frontend/src/components/JobProgress.tsx` (unit test: T084a)
- [ ] T113a [P] [US5] Component unit tests for the version history view in `frontend/tests/unit/components/VersionHistory.spec.tsx`
- [ ] T114 [P] [US5] Implement version history view in `frontend/src/components/VersionHistory.tsx` (unit test: T113a)
- [ ] T114a [P] [US5] Component unit tests for the version comparison view in `frontend/tests/unit/components/VersionDiff.spec.tsx`
- [ ] T115 [P] [US5] Implement version comparison view in `frontend/src/components/VersionDiff.tsx` (unit test: T114a)
- [ ] T115a [P] [US5] Component unit tests asserting invalid transitions are not offered and the permitted set is shown in `frontend/tests/unit/components/LifecycleControls.spec.tsx`
- [ ] T116 [P] [US5] Implement lifecycle transition controls in `frontend/src/components/LifecycleControls.tsx` (unit test: T115a)
- [ ] T123a [P] [US6] Component unit tests asserting each finding renders its location and severity in `frontend/tests/unit/components/ValidationFindings.spec.tsx`
- [ ] T124 [P] [US6] Implement findings panel in `frontend/src/components/ValidationFindings.tsx` (unit test: T123a)

## F-04.18 · SC-001 journey measurement

*This epic **owns** SC-001 but had no task measuring it — the only timing run was T153, inside held EPIC-014. Added by `/speckit-analyze` finding **G2**.*

- [ ] T124a [P] [US3] Measure the SC-001 journey — sign-in to holding a generated specification linked to its requirements — asserting completion in under 15 minutes with no external help, in `e2e/tests/sc-001-journey.spec.ts`

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/010-specification-interface/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T197 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/010-specification-interface/closure.md`
- [ ] T198 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/010-specification-interface/closure.md`
- [ ] T199 Triage `specs/010-specification-interface/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/010-specification-interface/closure.md`
- [ ] T200 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/010-specification-interface/closure.md`
