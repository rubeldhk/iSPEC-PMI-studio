---

description: "Task list for EPIC-023 — Unattended Runs & Team Review"
---

# Tasks: Unattended Runs & Team Review

**Epic**: `EPIC-023` | **Module**: M-06 Workflow & Tasks | **Tasks**: 58

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/) — requirements, clarifications, SRS traceability and the principle register live there
**Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` and approved business scope. Held is not cancelled — these tasks await an input, not more design.

**Requirements owned**: FR-RUN-001 – FR-RUN-020, FR-RUN-005a – FR-RUN-005c, FR-RUN-008a, **FR-RUN-013a**, FR-RUN-015a, **FR-RUN-019a**

**Added 2026-08-19**: `T800`–`T810` for **FR-RUN-013a** (who resolves a conflict) and **FR-RUN-019a** (a stale answer is asked again, not applied), plus the review-session half of the new scale ceiling **SC-017**. Both requirements came from the parent's third clarification session; neither existed when the original 43 were written.

**Session label**: `EPIC-023 Unattended Runs & Team Review` (Constitution VIII).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a paired unit-test task, written to fail first.

**⚠️ SRS back-fill owed before approval**: this capability has **no SRS source**, re-verified against the MPS drop. Constitution II requires the back-fill before this epic is approved — it gates *approval*, not merely closure.

**Task IDs are invariant** — unchanged by the D-19 split of EPIC-002. A `(unit test: T0nn)` reference may point at a task in a sibling epic; that is expected.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

## F-02.1 · Unattended run mode

*FR-RUN-001 to FR-RUN-008. The run never pauses: it records the question, applies a **marked provisional**

- [ ] T340 [P] [US1] Unit tests asserting an unattended run completes without pausing and stops at the user-selected range, in `backend/tests/unit/runs/run-mode.spec.ts`
- [ ] T341 [P] [US1] Unit tests asserting every deferred question records its options, the engine's suggested answer, and **enough context for someone who did not start the run to understand what is being asked** (FR-RUN-003, **FR-RUN-007**), and that the run then proceeds using that suggested answer as a *provisional* answer rather than a decision (**FR-RUN-004**), in `backend/tests/unit/runs/recorded-question.spec.ts`
- [ ] T342 [P] [US1] Unit tests asserting every artifact derived from a provisional answer is marked, names the governing question, and loses the marking once that question is answered (**SC-004**), in `backend/tests/unit/runs/provisional-marking.spec.ts`
- [ ] T343 [US1] Define `Run`, `RecordedQuestion` and `ProvisionalMarking` models in `backend/prisma/schema.prisma` (unit tests: T340, T341, T342)
- [ ] T344 [US1] Implement run mode selection and the stop-point range in `backend/src/modules/runs/run-mode.service.ts` (FR-RUN-001, FR-RUN-002, FR-RUN-008a; unit test: T340)
- [ ] T345 [US1] Implement question deferral with suggested answers in `backend/src/modules/runs/question-recorder.service.ts` (FR-RUN-003, FR-RUN-004, FR-RUN-007; unit test: T341)
- [ ] T346 [US1] Implement provisional marking and its clearing rule in `backend/src/modules/runs/provisional.service.ts` (FR-RUN-005, FR-RUN-017, **SC-004**; unit test: T342)
- [ ] T823 [P] [US1] Unit tests asserting a run meeting a condition it cannot proceed past **stops, preserves every piece of completed work, and records the reason** — distinct from `reached_stop_point`, which is a success state (**FR-RUN-008**), in `backend/tests/unit/runs/unrecoverable-stop.spec.ts`
- [ ] T347 [US1] Implement the unrecoverable-stop path preserving all completed work in `backend/src/modules/runs/run-mode.service.ts` (FR-RUN-008; unit test: T823)
- [ ] T415 [P] [US1] Write failing unit tests for the runs controller with mocked services, asserting `reached_stop_point` is returned as a **success** state and that cross-workspace access is absent rather than forbidden, in `backend/tests/unit/runs/runs.controller.spec.ts`
- [ ] T416 [P] [US1] Contract tests for run endpoints — start, list, get, cancel, continue — against `contracts/platform-api-epic-002.md` in `backend/tests/contract/runs.spec.ts`
- [ ] T417 [US1] Implement the runs controller in `backend/src/modules/runs/runs.controller.ts` (unit test: T415; contract test: T416)

## F-02.2 · Provisional approval override

- [ ] T348 [P] [US1] Unit tests asserting approval of a provisional specification shows every provisional item and refuses without explicit acceptance, so zero such specifications are approved without an override (**SC-005a**), in `backend/tests/unit/runs/provisional-approval.spec.ts`
- [ ] T349 [P] [US1] Unit tests asserting the override records approver, time and the specific items accepted, making every override attributable (**SC-005a**), in `backend/tests/unit/runs/override-record.spec.ts`
- [ ] T350 [US1] Define `ProvisionalApprovalOverride` model in `backend/prisma/schema.prisma` (unit test: T349)
- [ ] T351 [US1] Implement the override-gated approval path in `backend/src/modules/runs/provisional-approval.service.ts` (FR-RUN-005a, FR-RUN-005b, FR-RUN-005c; unit tests: T348, T349)

## F-02.3 · Team review and answer submission

- [ ] T352 [P] [US2] Unit tests asserting a review session groups every question from one run, in `backend/tests/unit/review/session.spec.ts`
- [ ] T822 [P] [US2] Unit tests asserting every question a run raises lands in **exactly one** review session — none lost, none duplicated across a run's sessions, and a re-run's new questions never re-enter a submitted one (**SC-002**, FR-RUN-018), in `backend/tests/unit/review/session-completeness.spec.ts`
- [ ] T353 [P] [US2] Unit tests asserting draft answers save without committing, that a reviewer may take the suggested answer or write their own **and attach a note to either** (**FR-RUN-010**), and that who answered and when is recorded, so every submitted answer is permanently attributable to a person and a time (**SC-006**), in `backend/tests/unit/review/draft-answers.spec.ts`
- [ ] T354 [P] [US2] Unit tests asserting conflicting answers are surfaced and block submission until resolved, so zero sessions submit with an unresolved conflict (**SC-005**), in `backend/tests/unit/review/conflict.spec.ts`
- [ ] T355 [P] [US2] Unit tests asserting submission is refused with unanswered questions, naming them, so zero sessions submit incomplete (**SC-005**), in `backend/tests/unit/review/submission-gate.spec.ts`
- [ ] T356 [P] [US2] Unit tests asserting only the project owner or the run's initiator may submit, in `backend/tests/unit/review/submission-authority.spec.ts`
- [ ] T357 [US2] Define `ReviewSession` and `Answer` models in `backend/prisma/schema.prisma` (unit tests: T352, T353)
- [ ] T358 [US2] Implement review session assembly in `backend/src/modules/review/review-session.service.ts` (FR-RUN-006, FR-RUN-009; unit test: T352)
- [ ] T359 [US2] Implement draft answers with attribution and notes in `backend/src/modules/review/answer.service.ts` (FR-RUN-010, FR-RUN-011, FR-RUN-012; unit test: T353)
- [ ] T360 [US2] Implement conflict detection and resolution gating in `backend/src/modules/review/conflict.service.ts` (FR-RUN-013; unit test: T354)
- [ ] T824 [P] [US2] Unit tests asserting submission commits **every answer as one unit — all or none** — and that the session is closed to further edits once committed, so a partial submission cannot exist (**FR-RUN-015**), in `backend/tests/unit/review/submission-atomicity.spec.ts`
- [ ] T361 [US2] Implement atomic batch submission with the completeness gate in `backend/src/modules/review/submission.service.ts` (FR-RUN-014, FR-RUN-015; unit tests: T355, T824)
- [ ] T362 [US2] Implement submission authority restricted to owner or initiator in `backend/src/modules/review/submission.service.ts` (FR-RUN-015a; unit test: T356)
- [ ] T825 [P] [US2] Unit tests asserting a submitted session is retained **permanently** with every answer, author, time and note intact, and can be neither edited nor deleted afterwards (**FR-RUN-020**, **SC-006**), in `backend/tests/unit/review/session-retention.spec.ts`
- [ ] T363 [US2] Implement permanent retention of submitted sessions in `backend/src/modules/review/review-session.service.ts` (FR-RUN-020, **SC-006**; unit test: T825)
- [ ] T364 [P] [US2] Contract tests for review session endpoints in `backend/tests/contract/review.spec.ts`
- [ ] T364a [P] [US2] Write failing unit tests for the review controller with a mocked service, covering route wiring, 422 on unanswered questions, 409 on unresolved conflict, 403 on submission by neither owner nor initiator, and cross-workspace absence, in `backend/tests/unit/review/review.controller.spec.ts`
- [ ] T365 [US2] Implement review session endpoints in `backend/src/modules/review/review.controller.ts` (unit test: T364a; contract test: T364)

## F-02.4 · Re-run with submitted answers

*FR-RUN-016 to FR-RUN-019. Closes the loop — without it the answers are just notes.*

- [ ] T366 [P] [US3] Unit tests asserting a re-run applies submitted answers in place of provisional ones and clears their markings, in `backend/tests/unit/review/rerun.spec.ts`
- [ ] T367 [P] [US3] Unit tests asserting unchanged answers do not needlessly repeat work, and that new questions open a NEW session rather than reopening a submitted one, in `backend/tests/unit/review/rerun-scope.spec.ts`
- [ ] T368 [P] [US3] Unit tests asserting a re-run warns which answers may be stale after the underlying work changed, in `backend/tests/unit/review/stale-answers.spec.ts`
- [ ] T369 [US3] Implement answer application and provisional clearing in `backend/src/modules/review/rerun.service.ts` (FR-RUN-016, FR-RUN-017; unit test: T366)
- [ ] T370 [US3] Implement new-session-on-new-questions and work reuse in `backend/src/modules/review/rerun.service.ts` (FR-RUN-018; unit test: T367)
- [ ] T371 [US3] Implement stale-answer warning in `backend/src/modules/review/stale-answers.service.ts` (FR-RUN-019; unit test: T368)

## F-023.5 · Conflict resolution authority

*FR-RUN-013a, SC-015. `T360` detects a conflict and blocks submission; it never says who clears it.
Resolution is restricted to the same two roles FR-RUN-015a already trusts with submission, and the
answer that loses is **kept** — the record has to show that the disagreement happened.*

- [ ] T800 [P] [US2] Unit tests asserting only the project owner or the run's initiator may resolve a conflict, that anyone else is refused with a stated reason, and that answering and noting stay open to every user with access, in `backend/tests/unit/review/conflict-resolution-authority.spec.ts`
- [ ] T801 [P] [US2] Unit tests asserting every competing answer remains retrievable with its author and time after resolution, and that selecting a winner does not delete the answers not chosen (SC-015), in `backend/tests/unit/review/conflict-retention.spec.ts`
- [ ] T802 [US2] Extend the `Answer` model with `selectedAsWinner`, `conflictResolvedBy` and `conflictResolvedAt` in `backend/prisma/schema.prisma` (unit tests: T800, T801) — extends `T357`
- [ ] T803 [US2] Implement resolution authority and winner selection in `backend/src/modules/review/conflict.service.ts` (FR-RUN-013a; unit tests: T800, T801) — extends `T360`, which detects the conflict and gates submission but does not resolve it
- [ ] T804 [P] [US2] Contract test for the conflict-resolution endpoint against `../002-team-review-access-storage/contracts/platform-api-epic-002.md` in `backend/tests/contract/review.spec.ts`
- [ ] T805 [US2] Expose conflict resolution on the review controller, returning **403** when the caller is neither the project owner nor the run's initiator, in `backend/src/modules/review/review.controller.ts` (unit test: T800; contract test: T804)

## F-023.6 · Stale answers are asked again, not applied

*FR-RUN-019a, SC-016. `T371` warns which answers may be stale and stops there — the run then applies
them anyway, which is the failure this epic exists to prevent. A stale answer is now re-raised as a
fresh question in the new session, and the re-run proceeds provisionally rather than blocking, so
**SC-001** still holds.*

- [ ] T806 [P] [US3] Unit tests asserting every stale answer's governing question reappears as a new question in the re-run's review session and that the stale answer is **not** applied, while answers not identified as stale still are (SC-016), in `backend/tests/unit/review/stale-answer-reraise.spec.ts`
- [ ] T807 [P] [US3] Unit tests asserting a re-run carrying stale answers completes **without blocking or waiting for input**, proceeds under FR-RUN-004 with a provisional answer, and marks the artifacts it produces provisional under FR-RUN-005 — SC-001 must survive this change, in `backend/tests/unit/review/stale-answer-nonblocking.spec.ts`
- [ ] T808 [US3] Implement re-raise of each stale answer's question into the new review session in `backend/src/modules/review/stale-answers.service.ts` (FR-RUN-019a; unit test: T806) — supersedes the apply-anyway behaviour behind `T371`, whose warning half remains FR-RUN-019
- [ ] T809 [US3] Wire the re-raise into re-run execution so non-stale answers still apply and the run never stops for a stale one, in `backend/src/modules/review/rerun.service.ts` (FR-RUN-019a; unit test: T807) — extends `T370`

## F-023.7 · Review session scale ceiling

*SC-017. PP-018 carried "review sessions at scale untested" through three validations because no
number existed to test against. The parent's session of 2026-08-19 set one.*

- [ ] T810 [P] [US2] Integration test asserting a review session of **200 questions** opens, accepts answers across multiple participants, detects a conflict, and submits without failure or degradation (SC-017), in `backend/tests/integration/review-session-scale.spec.ts`

## F-023.UI · Interface

- [ ] T397 [P] [US2] Component unit tests for the review session view — questions, options, suggested answers, conflicts — and asserting a 20-question session is answerable and submittable **without navigating away from the review** (**SC-003**), in `frontend/tests/unit/pages/ReviewSession.spec.tsx`
- [ ] T398 [P] [US2] Implement the review session page in `frontend/src/pages/ReviewSession.tsx` (unit test: T397)

## F-023.Z · Epic closure

- [ ] T404 **Confirm the SRS back-fill is complete** for unattended runs (FR-RUN-001–FR-RUN-020), which has no SRS source (Constitution II) — this epic must not be approved without it; record in `specs/023-unattended-runs-review/closure.md`
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
