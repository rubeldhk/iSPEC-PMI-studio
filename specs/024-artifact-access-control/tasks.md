---

description: "Task list for EPIC-024 — Artifact Access Control"
---

# Tasks: Artifact Access Control

**Epic**: `EPIC-024` | **Module**: M-13 Security & Governance | **Tasks**: 21

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/) — requirements, clarifications, SRS traceability and the principle register live there
**Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` and approved business scope. Held is not cancelled — these tasks await an input, not more design.

**Requirements owned**: FR-021 – FR-028

**Session label**: `EPIC-024 Artifact Access Control` (Constitution VIII).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the D-19 split of EPIC-002. A `(unit test: T0nn)` reference may point at a task in a sibling epic; that is expected.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

## F-02.5 · Artifact access control

- [ ] T372 [P] [US4] Unit tests asserting read and edit grants permit exactly their level and no more, in `backend/tests/unit/access/grants.spec.ts`
- [ ] T373 [P] [US4] Unit tests asserting an ungranted artifact is HIDDEN from listings, not shown as inaccessible, and that the refusal is recorded, in `backend/tests/unit/access/refusal.spec.ts`
- [ ] T374 [P] [US4] Unit tests asserting a derived artifact is at least as restricted as its source, in `backend/tests/unit/access/inheritance.spec.ts`
- [ ] T375 [P] [US4] Unit tests asserting no artifact can reach a state with no user holding edit access, in `backend/tests/unit/access/last-editor.spec.ts`
- [ ] T376 [US4] Define `AccessGrant` and `AccessAttemptRecord` models in `backend/prisma/schema.prisma` (unit tests: T372, T373)
- [ ] T377 [US4] Implement grant and revoke in `backend/src/modules/access/access-grant.service.ts` (FR-021, FR-022, FR-026; unit test: T372)
- [ ] T378 [US4] Implement the enforcement path — refuse, hide, record — in `backend/src/modules/access/access-enforcement.service.ts` (FR-023, FR-024; unit test: T373)
- [ ] T379 [US4] Implement derived-artifact restriction inheritance in `backend/src/modules/access/access-inheritance.service.ts` (FR-025; unit test: T374)
- [ ] T380 [US4] Implement the last-editor guarantee in `backend/src/modules/access/access-grant.service.ts` (FR-027; unit test: T375)
- [ ] T381 [US4] Implement run-time access snapshotting so a long run cannot half-apply a permission change in `backend/src/modules/access/access-snapshot.service.ts` (FR-028; unit test: T372)
- [ ] T418 [P] [US4] Write failing unit tests for the access controller with mocked services, asserting a grant request on an artifact the caller cannot edit returns **absence, not forbidden**, in `backend/tests/unit/access/access.controller.spec.ts`
- [ ] T419 [P] [US4] Contract tests for grant, revoke and access-attempt endpoints against `contracts/platform-api-epic-002.md` in `backend/tests/contract/access.spec.ts`
- [ ] T420 [US4] Implement the access controller in `backend/src/modules/access/access.controller.ts` (unit test: T418; contract test: T419)
- [ ] T427 [P] [US4] Integration test against a **real** PostgreSQL via Testcontainers asserting an ungranted artifact is **absent from listings** and returns 404 directly, and that the refusal is recorded in the same transaction — a mocked repository passes while the real query leaks (SC-007) — in `backend/tests/integration/access-enforcement.spec.ts`
- [ ] T428 [P] [US4] Integration test asserting the last-editor invariant holds under **concurrent** revocation, enforced inside the revoke transaction rather than by a pre-check (FR-027, SC-008), in `backend/tests/integration/last-editor.spec.ts`

## F-024.UI · Interface

- [ ] T399 [P] [US4] Component unit tests for access grant management in `frontend/tests/unit/components/AccessGrants.spec.tsx`
- [ ] T400 [P] [US4] Implement the access grant control in `frontend/src/components/AccessGrants.tsx` (unit test: T399)

## F-024.Z · Epic closure

- [ ] T435 Confirm every implementation task in this epic has a passing unit test (Constitution V); record in `specs/024-artifact-access-control/closure.md`
- [ ] T436 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/024-artifact-access-control/closure.md`
- [ ] T437 Triage `specs/024-artifact-access-control/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/024-artifact-access-control/closure.md`
- [ ] T438 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the closing report in `specs/024-artifact-access-control/closure.md`

---

## Depends on

- EPIC-004 — tenancy and audit, which these grants extend
- EPIC-008 — artifacts to grant access on

## User stories owned

- US4 — control who can see and change each artifact
