---

description: "Task list for EPIC-010 — Specification Interface"
---

# Tasks: Specification Interface

**Epic**: `EPIC-010` | **Module**: M-04 | **Tasks**: 14

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
