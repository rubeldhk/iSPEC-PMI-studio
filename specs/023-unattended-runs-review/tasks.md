---

description: "Task list for EPIC-023 — Unattended Runs & Team Review"
---

# Tasks: Unattended Runs & Team Review

**Epic**: `EPIC-023` | **Module**: M-06 Workflow & Tasks | **Tasks**: 43

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/) — requirements, clarifications, SRS traceability and the principle register live there
**Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` and approved business scope. Held is not cancelled — these tasks await an input, not more design.

**Requirements owned**: FR-001 – FR-020, FR-005a – FR-005c, FR-008a, FR-015a

**Session label**: `EPIC-023 Unattended Runs & Team Review` (Constitution VIII).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a paired unit-test task, written to fail first.

**⚠️ SRS back-fill owed before approval**: this capability has **no SRS source**, re-verified against the MPS drop. Constitution II requires the back-fill before this epic is approved — it gates *approval*, not merely closure.

**Task IDs are invariant** — unchanged by the D-19 split of EPIC-002. A `(unit test: T0nn)` reference may point at a task in a sibling epic; that is expected.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

## F-02.1 · Unattended run mode

*FR-001 to FR-008. The run never pauses: it records the question, applies a **marked provisional**

- [ ] T340 [P] [US1] Unit tests asserting an unattended run completes without pausing and stops at the user-selected range, in `backend/tests/unit/runs/run-mode.spec.ts`
- [ ] T341 [P] [US1] Unit tests asserting every deferred question records its options and the engine's suggested answer, in `backend/tests/unit/runs/recorded-question.spec.ts`
- [ ] T342 [P] [US1] Unit tests asserting every artifact derived from a provisional answer is marked, and names the governing question, in `backend/tests/unit/runs/provisional-marking.spec.ts`
- [ ] T343 [US1] Define `Run`, `RecordedQuestion` and `ProvisionalMarking` models in `backend/prisma/schema.prisma` (unit tests: T340, T341, T342)
- [ ] T344 [US1] Implement run mode selection and the stop-point range in `backend/src/modules/runs/run-mode.service.ts` (FR-001, FR-002, FR-008a; unit test: T340)
- [ ] T345 [US1] Implement question deferral with suggested answers in `backend/src/modules/runs/question-recorder.service.ts` (FR-003, FR-004, FR-007; unit test: T341)
- [ ] T346 [US1] Implement provisional marking and its clearing rule in `backend/src/modules/runs/provisional.service.ts` (FR-005, FR-017; unit test: T342)
- [ ] T347 [US1] Implement the unrecoverable-stop path preserving all completed work in `backend/src/modules/runs/run-mode.service.ts` (FR-008; unit test: T340)
- [ ] T415 [P] [US1] Write failing unit tests for the runs controller with mocked services, asserting `reached_stop_point` is returned as a **success** state and that cross-workspace access is absent rather than forbidden, in `backend/tests/unit/runs/runs.controller.spec.ts`
- [ ] T416 [P] [US1] Contract tests for run endpoints — start, list, get, cancel, continue — against `contracts/platform-api-epic-002.md` in `backend/tests/contract/runs.spec.ts`
- [ ] T417 [US1] Implement the runs controller in `backend/src/modules/runs/runs.controller.ts` (unit test: T415; contract test: T416)

## F-02.2 · Provisional approval override

- [ ] T348 [P] [US1] Unit tests asserting approval of a provisional specification shows every provisional item and refuses without explicit acceptance, in `backend/tests/unit/runs/provisional-approval.spec.ts`
- [ ] T349 [P] [US1] Unit tests asserting the override records approver, time and the specific items accepted, in `backend/tests/unit/runs/override-record.spec.ts`
- [ ] T350 [US1] Define `ProvisionalApprovalOverride` model in `backend/prisma/schema.prisma` (unit test: T349)
- [ ] T351 [US1] Implement the override-gated approval path in `backend/src/modules/runs/provisional-approval.service.ts` (FR-005a, FR-005b, FR-005c; unit tests: T348, T349)

## F-02.3 · Team review and answer submission

- [ ] T352 [P] [US2] Unit tests asserting a review session groups every question from one run, in `backend/tests/unit/review/session.spec.ts`
- [ ] T353 [P] [US2] Unit tests asserting draft answers save without committing, and record who answered and when, in `backend/tests/unit/review/draft-answers.spec.ts`
- [ ] T354 [P] [US2] Unit tests asserting conflicting answers are surfaced and block submission until resolved, in `backend/tests/unit/review/conflict.spec.ts`
- [ ] T355 [P] [US2] Unit tests asserting submission is refused with unanswered questions, naming them, in `backend/tests/unit/review/submission-gate.spec.ts`
- [ ] T356 [P] [US2] Unit tests asserting only the project owner or the run's initiator may submit, in `backend/tests/unit/review/submission-authority.spec.ts`
- [ ] T357 [US2] Define `ReviewSession` and `Answer` models in `backend/prisma/schema.prisma` (unit tests: T352, T353)
- [ ] T358 [US2] Implement review session assembly in `backend/src/modules/review/review-session.service.ts` (FR-006, FR-009; unit test: T352)
- [ ] T359 [US2] Implement draft answers with attribution and notes in `backend/src/modules/review/answer.service.ts` (FR-010, FR-011, FR-012; unit test: T353)
- [ ] T360 [US2] Implement conflict detection and resolution gating in `backend/src/modules/review/conflict.service.ts` (FR-013; unit test: T354)
- [ ] T361 [US2] Implement atomic batch submission with the completeness gate in `backend/src/modules/review/submission.service.ts` (FR-014, FR-015; unit test: T355)
- [ ] T362 [US2] Implement submission authority restricted to owner or initiator in `backend/src/modules/review/submission.service.ts` (FR-015a; unit test: T356)
- [ ] T363 [US2] Implement permanent retention of submitted sessions in `backend/src/modules/review/review-session.service.ts` (FR-020; unit test: T352)
- [ ] T364 [P] [US2] Contract tests for review session endpoints in `backend/tests/contract/review.spec.ts`
- [ ] T364a [P] [US2] Write failing unit tests for the review controller with a mocked service, covering route wiring, 422 on unanswered questions, 409 on unresolved conflict, 403 on submission by neither owner nor initiator, and cross-workspace absence, in `backend/tests/unit/review/review.controller.spec.ts`
- [ ] T365 [US2] Implement review session endpoints in `backend/src/modules/review/review.controller.ts` (unit test: T364a; contract test: T364)

## F-02.4 · Re-run with submitted answers

*FR-016 to FR-019. Closes the loop — without it the answers are just notes.*

- [ ] T366 [P] [US3] Unit tests asserting a re-run applies submitted answers in place of provisional ones and clears their markings, in `backend/tests/unit/review/rerun.spec.ts`
- [ ] T367 [P] [US3] Unit tests asserting unchanged answers do not needlessly repeat work, and that new questions open a NEW session rather than reopening a submitted one, in `backend/tests/unit/review/rerun-scope.spec.ts`
- [ ] T368 [P] [US3] Unit tests asserting a re-run warns which answers may be stale after the underlying work changed, in `backend/tests/unit/review/stale-answers.spec.ts`
- [ ] T369 [US3] Implement answer application and provisional clearing in `backend/src/modules/review/rerun.service.ts` (FR-016, FR-017; unit test: T366)
- [ ] T370 [US3] Implement new-session-on-new-questions and work reuse in `backend/src/modules/review/rerun.service.ts` (FR-018; unit test: T367)
- [ ] T371 [US3] Implement stale-answer warning in `backend/src/modules/review/stale-answers.service.ts` (FR-019; unit test: T368)

## F-023.UI · Interface

- [ ] T397 [P] [US2] Component unit tests for the review session view — questions, options, suggested answers, conflicts — in `frontend/tests/unit/pages/ReviewSession.spec.tsx`
- [ ] T398 [P] [US2] Implement the review session page in `frontend/src/pages/ReviewSession.tsx` (unit test: T397)

## F-023.Z · Epic closure

- [ ] T404 **Confirm the SRS back-fill is complete** for unattended runs (FR-001–FR-020), which has no SRS source (Constitution II) — this epic must not be approved without it; record in `specs/023-unattended-runs-review/closure.md`
- [ ] T411 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/023-unattended-runs-review/closure.md`
- [ ] T412 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/023-unattended-runs-review/closure.md`
- [ ] T413 Triage `specs/023-unattended-runs-review/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/023-unattended-runs-review/closure.md`
- [ ] T414 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/023-unattended-runs-review/closure.md`

---

## Depends on

- EPIC-001 — job orchestration, failure taxonomy, observability
- EPIC-008 — generation, which unattended runs drive
- EPIC-009 — the lifecycle that provisional approval overrides

## User stories owned

- US1 — start an unattended run
- US2 — review as a team and submit
- US3 — re-run with answers
