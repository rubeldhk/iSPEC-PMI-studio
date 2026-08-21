# Epic Closure: EPIC-023 — Unattended Runs & Team Review

**Closed**: 2026-08-21 | **Session label**: `EPIC-023 Unattended Runs & Team Review` (Constitution VIII)

## T404 — SRS back-fill confirmation (Constitution II)

**CONFIRMED.** `SRS/PMI-DOC-004_Business_Requirement_Specification_v1.0.md` **BR-0061**
(approved 2026-08-20, scope ruling T-106) is the business source for `FR-RUN-001`–`FR-RUN-020`.
The debt recorded in spec.md ("no SRS source") was discharged before this epic was approved —
the approval gate, not merely the closure gate, was honoured. The prior D-10 hold is discharged
by PMI-DOC-004 v1.0.

## T411 — every implementation task has a passing unit test (Constitution V)

**CONFIRMED.** The pairing, as asserted on 2026-08-21 (all suites green:
`backend-unit` 957 tests / 126 files, `backend-contract`, `backend-integration`,
`architecture`, `frontend` — 0 failures):

| Implementation task | Unit test task | Test file |
|---|---|---|
| T343 models | T340, T341, T342 | `tests/unit/runs/{run-mode,recorded-question,provisional-marking}.spec.ts` |
| T344 run mode | T340 | `tests/unit/runs/run-mode.spec.ts` |
| T345 question deferral | T341 | `tests/unit/runs/recorded-question.spec.ts` |
| T346 provisional marking | T342 | `tests/unit/runs/provisional-marking.spec.ts` |
| T347 unrecoverable stop | T823 | `tests/unit/runs/unrecoverable-stop.spec.ts` |
| T417 runs controller | T415 / T416 | `tests/unit/runs/runs.controller.spec.ts` · `tests/contract/runs.spec.ts` |
| T350 override model | T349 | `tests/unit/runs/override-record.spec.ts` |
| T351 override-gated approval | T348, T349 | `tests/unit/runs/provisional-approval.spec.ts` |
| T357 session/answer models | T352, T353 | `tests/unit/review/{session,draft-answers}.spec.ts` |
| T358 session assembly | T352, T822 | `tests/unit/review/{session,session-completeness}.spec.ts` |
| T359 draft answers | T353 | `tests/unit/review/draft-answers.spec.ts` |
| T360 conflict detection | T354 | `tests/unit/review/conflict.spec.ts` |
| T361 atomic submission | T355, T824 | `tests/unit/review/{submission-gate,submission-atomicity}.spec.ts` |
| T362 submission authority | T356 | `tests/unit/review/submission-authority.spec.ts` |
| T363 permanent retention | T825 | `tests/unit/review/session-retention.spec.ts` |
| T365 review controller | T364a / T364, T804 | `tests/unit/review/review.controller.spec.ts` · `tests/contract/review.spec.ts` |
| T369/T370 re-run | T366, T367 | `tests/unit/review/{rerun,rerun-scope}.spec.ts` |
| T371 stale warning | T368 | `tests/unit/review/stale-answers.spec.ts` |
| T802/T803/T805 conflict resolution | T800, T801, T804 | `tests/unit/review/{conflict-resolution-authority,conflict-retention}.spec.ts` |
| T808/T809 stale re-raise | T806, T807 | `tests/unit/review/{stale-answer-reraise,stale-answer-nonblocking}.spec.ts` |
| T810 scale ceiling | — (integration) | `tests/integration/review-session-scale.spec.ts` (SC-017, 200 questions) |
| T398 review page | T397 | `frontend/tests/unit/pages/ReviewSession.spec.tsx` |

## T412 — convergence

Assessed 2026-08-21 against spec.md, plan.md and tasks.md in this session
(the `/speckit-converge` command was executed as an in-session convergence assessment):

- Every requirement owned (`FR-RUN-001`–`020`, `005a`–`c`, `008a`, `013a`, `015a`, `019a`) has an
  implementation site and a test citing it.
- Every scope row (F-02.1 … F-023.7, F-023.UI, F-023.Z) is built: run mode + runs API,
  override-gated approval, review sessions + review API, re-run, conflict-resolution
  authority, stale re-raise, the 200-question ceiling, and the review page.
- **No unbuilt work found.** No tasks were appended.

## T413 — defect triage

`specs/023-unattended-runs-review/defects/` contains no records (only `.gitkeep`).
**Nothing to triage; nothing deferred.**

## T414 — principle deltas and the closing report

The two deltas recorded in spec.md still hold, strengthened by implementation:

- **PP-003 Human-in-the-Loop** — an unattended run never decides: it records the question with
  options and a *marked provisional* answer (`question-recorder.service.ts`,
  `provisional.service.ts`); a human commits the batch atomically
  (`submission.service.ts`); approving provisional work requires an explicit, attributed
  override (`provisional-approval.service.ts`, append-only at the database).
- **PP-016 Explainable AI** — every deferred question records options considered, the suggested
  answer, and context sufficient for someone who did not start the run (enforced as a
  validation refusal, not a convention).

No deferrals were taken; no owner reassignment needed.

### Work completed

- 6 new tables (migration `20260821000000_epic023_runs_review`) with append-only/no-delete
  triggers for overrides, sessions, and answers.
- `backend/src/modules/runs/` — run mode + stop range, question deferral, provisional
  marking, override-gated approval, runs controller + module.
- `backend/src/modules/review/` — session assembly, draft answers, conflict
  detection/resolution, atomic submission, stale warnings + re-raise, re-run, review
  controller + module; error taxonomy extended with the contract's deliberate 403 and the
  422 `review_incomplete` refusal.
- `frontend/src/pages/ReviewSession.tsx` + API client methods.
- 22 backend test files + 1 frontend test file, all passing.

### Work deferred

None within this epic's scope. The `access_snapshot` column is written by EPIC-024 (T381),
exactly as the corrected build order (G-023.2) prescribes.

### Recommended next task

`/speckit-implement EPIC-024` — Artifact Access Control, which snapshots grants onto the
`Run` this epic defined.
