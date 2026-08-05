---

description: "Task list for EPIC-002 — Unattended Runs, Team Review, Access Control & External Storage"
---

# Tasks: Unattended Runs with Team Review, Artifact Access Control & External Storage Integration

**Epic**: `EPIC-002` | **Tasks**: 87

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification and
> approved business scope (PMI-TASK-001 T-101, T-106). This epic extends the product surface, which
> is the held half. Held is not cancelled — these tasks await an input, not more design.

**Additionally blocked by** its own dependencies: **EPIC-008** (generation, which unattended runs
drive) and **EPIC-009** (the lifecycle that provisional approval overrides). It sits in **Wave 8**.

**Session label**: `EPIC-002 Team Review & Storage` (Constitution VIII).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a paired
unit-test task, written to fail first.

**⚠️ SRS back-fill owed before approval**: two of the three capability areas here — unattended runs
(FR-001–FR-020) and third-party storage (FR-029–FR-040) — have **no SRS source**, re-verified against
the MPS drop. Constitution II requires the back-fill before this epic is approved.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

---

# F-02.1 · Unattended run mode

*FR-001 to FR-008. The run never pauses: it records the question, applies a **marked provisional**
answer, and carries on to a user-selected stop point.*

- [ ] T340 [P] [US1] Unit tests asserting an unattended run completes without pausing and stops at the user-selected range, in `backend/tests/unit/runs/run-mode.spec.ts`
- [ ] T341 [P] [US1] Unit tests asserting every deferred question records its options and the engine's suggested answer, in `backend/tests/unit/runs/recorded-question.spec.ts`
- [ ] T342 [P] [US1] Unit tests asserting every artifact derived from a provisional answer is marked, and names the governing question, in `backend/tests/unit/runs/provisional-marking.spec.ts`
- [ ] T343 [US1] Define `Run`, `RecordedQuestion` and `ProvisionalMarking` models in `backend/prisma/schema.prisma` (unit tests: T340, T341, T342)
- [ ] T344 [US1] Implement run mode selection and the stop-point range in `backend/src/modules/runs/run-mode.service.ts` (FR-001, FR-002, FR-008a; unit test: T340)
- [ ] T345 [US1] Implement question deferral with suggested answers in `backend/src/modules/runs/question-recorder.service.ts` (FR-003, FR-004, FR-007; unit test: T341)
- [ ] T346 [US1] Implement provisional marking and its clearing rule in `backend/src/modules/runs/provisional.service.ts` (FR-005, FR-017; unit test: T342)
- [ ] T347 [US1] Implement the unrecoverable-stop path preserving all completed work in `backend/src/modules/runs/run-mode.service.ts` (FR-008; unit test: T340)

### Runs API *(added 2026-08-05 — closes part of **G-02.4**)*

- [ ] T415 [P] [US1] Write failing unit tests for the runs controller with mocked services, asserting `reached_stop_point` is returned as a **success** state and that cross-workspace access is absent rather than forbidden, in `backend/tests/unit/runs/runs.controller.spec.ts`
- [ ] T416 [P] [US1] Contract tests for run endpoints — start, list, get, cancel, continue — against `contracts/platform-api-epic-002.md` in `backend/tests/contract/runs.spec.ts`
- [ ] T417 [US1] Implement the runs controller in `backend/src/modules/runs/runs.controller.ts` (unit test: T415; contract test: T416)

---

# F-02.2 · Provisional approval override

*FR-005a to FR-005c. Clarified as **warn and require explicit override** — approval is permitted, but
the approver sees every provisional item and the override is recorded. This is the epic's strongest
expression of **PP-003 Human-in-the-Loop**.*

- [ ] T348 [P] [US1] Unit tests asserting approval of a provisional specification shows every provisional item and refuses without explicit acceptance, in `backend/tests/unit/runs/provisional-approval.spec.ts`
- [ ] T349 [P] [US1] Unit tests asserting the override records approver, time and the specific items accepted, in `backend/tests/unit/runs/override-record.spec.ts`
- [ ] T350 [US1] Define `ProvisionalApprovalOverride` model in `backend/prisma/schema.prisma` (unit test: T349)
- [ ] T351 [US1] Implement the override-gated approval path in `backend/src/modules/runs/provisional-approval.service.ts` (FR-005a, FR-005b, FR-005c; unit tests: T348, T349)

---

# F-02.3 · Team review and answer submission

*FR-009 to FR-020. The point of the epic: one collective decision session instead of a stop-start
process. Conflict detection blocks submission — two people answering differently is a disagreement to
resolve, not a race to win.*

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

---

# F-02.4 · Re-run with submitted answers

*FR-016 to FR-019. Closes the loop — without it the answers are just notes.*

- [ ] T366 [P] [US3] Unit tests asserting a re-run applies submitted answers in place of provisional ones and clears their markings, in `backend/tests/unit/review/rerun.spec.ts`
- [ ] T367 [P] [US3] Unit tests asserting unchanged answers do not needlessly repeat work, and that new questions open a NEW session rather than reopening a submitted one, in `backend/tests/unit/review/rerun-scope.spec.ts`
- [ ] T368 [P] [US3] Unit tests asserting a re-run warns which answers may be stale after the underlying work changed, in `backend/tests/unit/review/stale-answers.spec.ts`
- [ ] T369 [US3] Implement answer application and provisional clearing in `backend/src/modules/review/rerun.service.ts` (FR-016, FR-017; unit test: T366)
- [ ] T370 [US3] Implement new-session-on-new-questions and work reuse in `backend/src/modules/review/rerun.service.ts` (FR-018; unit test: T367)
- [ ] T371 [US3] Implement stale-answer warning in `backend/src/modules/review/stale-answers.service.ts` (FR-019; unit test: T368)

---

# F-02.5 · Artifact access control

*FR-021 to FR-028. Clarified as **per-user grants only** — roles, groups, inheritance and SSO remain
Phase 3. Extends EPIC-004's tenancy rather than replacing it.*

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

### Access API and integration coverage *(added 2026-08-05 — closes part of **G-02.4** and **G-02.5**)*

- [ ] T418 [P] [US4] Write failing unit tests for the access controller with mocked services, asserting a grant request on an artifact the caller cannot edit returns **absence, not forbidden**, in `backend/tests/unit/access/access.controller.spec.ts`
- [ ] T419 [P] [US4] Contract tests for grant, revoke and access-attempt endpoints against `contracts/platform-api-epic-002.md` in `backend/tests/contract/access.spec.ts`
- [ ] T420 [US4] Implement the access controller in `backend/src/modules/access/access.controller.ts` (unit test: T418; contract test: T419)
- [ ] T427 [P] [US4] Integration test against a **real** PostgreSQL via Testcontainers asserting an ungranted artifact is **absent from listings** and returns 404 directly, and that the refusal is recorded in the same transaction — a mocked repository passes while the real query leaks (SC-007) — in `backend/tests/integration/access-enforcement.spec.ts`
- [ ] T428 [P] [US4] Integration test asserting the last-editor invariant holds under **concurrent** revocation, enforced inside the revoke transaction rather than by a pre-check (FR-027, SC-008), in `backend/tests/integration/last-editor.spec.ts`

---

# F-02.6 · External storage integration

*FR-029 to FR-040. **One-way publish, permanently** (ADR-0004). Providers sit behind one boundary and
are interchangeable — the same adapter pattern ADR-0001 applies to engines.*

- [ ] T382 [P] [US5] Unit tests asserting a connection reports healthy, needs-reauthorisation and unavailable as distinct states, in `backend/tests/unit/storage/connection.spec.ts`
- [ ] T383 [P] [US5] Unit tests asserting a provider missing a required capability is refused, naming it, in `backend/tests/unit/storage/capability-refusal.spec.ts`
- [ ] T384 [P] [US6] Unit tests asserting every publish failure reports a distinct named reason — unavailable, expired, quota, size, destination missing, in `backend/tests/unit/storage/publish-failures.spec.ts`
- [ ] T385 [P] [US6] Unit tests asserting artifacts the publisher cannot access are excluded and the exclusion reported, in `backend/tests/unit/storage/publish-access.spec.ts`
- [ ] T386 [P] [US6] Unit tests asserting republish states what will be added, replaced or left alone BEFORE changing anything, in `backend/tests/unit/storage/republish.spec.ts`
- [ ] T387 [P] [US7] Unit tests asserting provider switching loses no platform artifact and no publish history, in `backend/tests/unit/storage/provider-switch.spec.ts`
- [ ] T388 [US5] Define `StorageConnection`, `PublishRecord` and `PublishedFileReference` models in `backend/prisma/schema.prisma` (unit tests: T382, T387)
- [ ] T389 [US5] Define the storage provider contract in `packages/storage-contract/src/index.ts` — one boundary, interchangeable providers (FR-030, FR-039; unit test: T383)
- [ ] T390 [US5] Implement connection lifecycle and health reporting in `backend/src/modules/storage/connection.service.ts` (FR-029, FR-031; unit test: T382)
- [ ] T391 [US6] Implement the publish pipeline with per-project organisation in `backend/src/modules/storage/publish.service.ts` (FR-032, FR-034; unit test: T384)
- [ ] T392 [US6] Implement access-aware exclusion during publish in `backend/src/modules/storage/publish.service.ts` (FR-033; unit test: T385)
- [ ] T393 [US6] Implement the publish failure taxonomy in `backend/src/modules/storage/publish-failures.ts` (FR-035; unit test: T384)
- [ ] T394 [US6] Implement republish preview and concurrent-publish prevention in `backend/src/modules/storage/republish.service.ts` (FR-036, FR-040; unit test: T386)
- [ ] T395 [US7] Implement provider switching and disconnection with artifact preservation in `backend/src/modules/storage/provider-switch.service.ts` (FR-037, FR-038; unit test: T387)
- [ ] T396 [P] [US5] Implement a fixture storage provider with injectable failures, mirroring the engine fixture pattern, in `packages/storage-adapters/fixture/src/index.ts` (unit tests: T382, T384)

### Storage API, conformance and independence *(added 2026-08-05 — closes part of **G-02.4**, **G-02.5**, and the contract's conformance suite)*

- [ ] T421 [P] [US5] Write failing unit tests for the storage connections controller with mocked services, asserting an unreachable provider reports `unavailable` and never `healthy`, in `backend/tests/unit/storage/connections.controller.spec.ts`
- [ ] T422 [P] [US5] Contract tests for connection endpoints against `contracts/platform-api-epic-002.md` in `backend/tests/contract/storage-connections.spec.ts`
- [ ] T423 [US5] Implement the storage connections controller in `backend/src/modules/storage/connections.controller.ts` (unit test: T421; contract test: T422)
- [ ] T424 [P] [US6] Write failing unit tests for the publish controller, asserting the republish preview is computed **before any write** and that a second concurrent publish returns 409, in `backend/tests/unit/storage/publish.controller.spec.ts`
- [ ] T425 [P] [US6] Contract tests for publish and preview endpoints, asserting every failure carries a reason from the closed taxonomy with no `unknown` member, in `backend/tests/contract/publish.spec.ts`
- [ ] T426 [US6] Implement the publish controller in `backend/src/modules/storage/publish.controller.ts` (unit test: T424; contract test: T425)
- [ ] T429 [P] [US6] Integration test asserting two concurrent publishes of one project are **prevented** by an advisory lock on `project_id`, not queued (FR-040), in `backend/tests/integration/publish-concurrency.spec.ts`
- [ ] T430 [US5] Implement the shared storage conformance suite — the 8 cases SC-01 to SC-08 from `contracts/storage-provider-contract.md` — in `packages/storage-contract/tests/conformance/storage-conformance.suite.ts`
- [ ] T431 [US5] Run the conformance suite against the fixture provider in `packages/storage-adapters/fixture/tests/conformance.spec.ts` (suite: T430)
- [ ] T432 [US7] Implement the architecture test failing the build if `backend/src/**` names any storage provider SDK, package, or provider string — the guarantee behind SC-011, mirroring T047 for engines — in `backend/tests/architecture/storage-independence.spec.ts`

---

# F-02.7 · Interface

- [ ] T397 [P] [US2] Component unit tests for the review session view — questions, options, suggested answers, conflicts — in `frontend/tests/unit/pages/ReviewSession.spec.tsx`
- [ ] T398 [P] [US2] Implement the review session page in `frontend/src/pages/ReviewSession.tsx` (unit test: T397)
- [ ] T399 [P] [US4] Component unit tests for access grant management in `frontend/tests/unit/components/AccessGrants.spec.tsx`
- [ ] T400 [P] [US4] Implement the access grant control in `frontend/src/components/AccessGrants.tsx` (unit test: T399)
- [ ] T401 [P] [US5] Component unit tests for storage connection and publish status in `frontend/tests/unit/pages/StorageConnections.spec.tsx`
- [ ] T402 [P] [US5] Implement the storage connections page in `frontend/src/pages/StorageConnections.tsx` (unit test: T401)

---

## Dependencies

| Depends on | For |
|---|---|
| EPIC-001 | Job orchestration, failure taxonomy, observability |
| EPIC-004 | Tenancy and audit, which access grants extend |
| EPIC-008 | Generation, which unattended runs drive |
| EPIC-009 | The lifecycle that provisional approval overrides |

**Wave 8.** Nothing here can start until EPIC-009 completes — and the whole chain waits on the BRS.

## Build order

```text
F-02.1 run mode ──► F-02.2 provisional approval ──► F-02.3 review ──► F-02.4 re-run
F-02.5 access control   (independent)
F-02.6 storage          (independent)
                         └──► F-02.7 interface ──► Phase Z closure
```

F-02.5 and F-02.6 are independent of the run/review chain and of each other — three developers could
work in parallel once the epic unfreezes.

## Notes

- **PP-003 and PP-016 are strongest here**: an unattended run never *decides*. It records a question
  with its options and a marked provisional answer, and a human commits the batch.
- **One-way publish is permanent** (ADR-0004), not a staged simplification. Import-back is excluded.
- **The SRS back-fill (T404) gates approval**, not merely closure.

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Deduplicated 2026-08-05: an `F-02.8 · Epic closure` section duplicated this block and wrote to a
different file. `T403`, `T405`, and `T406` were removed as exact duplicates of `T411`–`T413`; **`T404`
survived** and sits below, because the SRS back-fill gate exists nowhere else.*

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/002-team-review-access-storage/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T404 **Confirm the SRS back-fill is complete** for unattended runs (FR-001–FR-020) and third-party storage (FR-029–FR-040), neither of which has an SRS source (Constitution II) — this epic must not be approved without it; record in `specs/002-team-review-access-storage/closure.md`
- [ ] T411 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/002-team-review-access-storage/closure.md`
- [ ] T412 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/002-team-review-access-storage/closure.md`
- [ ] T413 Triage `specs/002-team-review-access-storage/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/002-team-review-access-storage/closure.md`
- [ ] T414 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/002-team-review-access-storage/closure.md`
