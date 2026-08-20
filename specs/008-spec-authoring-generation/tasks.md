---

description: "Task list for EPIC-008 — Specification Authoring & Generation"
---

# Tasks: Specification Authoring & Generation

**Epic**: `EPIC-008` | **Module**: M-04 | **Tasks**: 25

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0030**. The prior
> hold under decision D-10 (PMI-TASK-001 T-101/T-106) is discharged; resumption went through
> the Definition-of-Ready gate (EPIC-026 — stage `Ready`), not by declaration.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03, plus **`T828`–`T829`**
added 2026-08-20 by this Epic's `T190` convergence pass. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.1 · Specification data model

- [X] T073 [P] [US3] Unit tests asserting a generated specification links to every selected requirement and none is orphaned, in `backend/tests/unit/specifications/generation-links.spec.ts`
- [X] T077 [US3] Define `Specification` and `SpecificationVersion` models storing both raw and parsed content in `backend/prisma/schema.prisma` (unit test: T073)

## F-04.2 · Engine output parsing

*Unparseable and empty output are failures, never a stored specification.*

- [X] T075 [P] [US3] Unit tests for engine output parsing, treating unparseable and empty output as failures, in `backend/tests/unit/specifications/output-parser.spec.ts`
- [X] T079 [US3] Implement the engine output parser rejecting malformed and empty output in `backend/src/modules/specifications/output-parser.ts` (unit test: T075)

## F-04.3 · Generation orchestration

- [X] T074 [P] [US3] Unit tests asserting each failure reason is distinct and stores no partial artifact, in `backend/tests/unit/specifications/generation-failures.spec.ts`
- [X] T080 [US3] Implement specification generation orchestration invoking the engine through the contract in `backend/src/modules/specifications/generate-specification.service.ts` (unit tests: T073, T074)

## F-04.4 · Engine provenance stamping

- [X] T081a [P] [US3] Unit tests asserting engine name and version are stamped on every generated artifact and never left null, in `backend/tests/unit/specifications/engine-stamp.spec.ts`
- [X] T082 [US3] Implement engine and engine-version stamping on every generated artifact in `backend/src/modules/specifications/engine-stamp.ts` (unit test: T081a)

## F-04.5 · Generation job API

- [X] T076 [P] [US3] Contract tests for generation job endpoints returning 202 with a job in `backend/tests/contract/generation-jobs.spec.ts`
- [X] T082a [P] [US3] Unit tests for the specifications controller with a mocked service in `backend/tests/unit/specifications/specifications.controller.spec.ts`
- [X] T083 [US3] Implement generation job endpoints in `backend/src/modules/specifications/specifications.controller.ts` (unit test: T082a; contract test: T076)

## F-04.6 · Specification read surface

*FR-012. Added closing `/speckit-analyze` finding E1 (RAID I-02).*

- [X] T076a [P] [US3] Unit tests for specification list, detail, and edit — pagination, project scoping, and cross-workspace not-found — in `backend/tests/unit/specifications/specifications-read.spec.ts` (**FR-012**)
- [X] T076b [P] [US3] Contract tests for `GET /projects/{id}/specifications`, `GET /specifications/{id}`, and `PATCH /specifications/{id}` in `backend/tests/contract/specifications-read.spec.ts` (**FR-012**)
- [X] T083a [US3] Implement specification list, detail, and edit endpoints in `backend/src/modules/specifications/specifications.controller.ts` (**FR-012**; unit test: T076a; contract test: T076b)
- [X] T083b [US3] Implement the specification read service backing list, detail, and edit in `backend/src/modules/specifications/specifications-read.service.ts` (**FR-012**; unit test: T076a)
- [X] T083f [P] [US3] Unit tests for specification search — title and content matching, workspace and project scoping, and result ordering — in `backend/tests/unit/specifications/specification-search.spec.ts` (MPS Volume 2, advanced search and filtering)
- [X] T083g [US3] Implement specification search and filtering in `backend/src/modules/specifications/specification-search.service.ts` (MPS Volume 2; unit test: T083f)

## F-04.7 · Out-of-date detection

*FR-032 — flagged, never silently regenerated.*

- [X] T093a [P] [US3] Unit tests asserting a requirement change flags derived specifications out of date without altering their content, in `backend/tests/unit/specifications/out-of-date.spec.ts`
- [X] T094 [US3] Implement out-of-date flagging when a source requirement changes, without altering the specification, in `backend/src/modules/specifications/out-of-date.service.ts` (unit test: T093a)

*Added 2026-08-20 by `T190` convergence. `T094` flags derived specifications when told a requirement
changed — and nothing was telling it. EPIC-007 built the hash and recorded it as "the one function
in this epic with no user-visible behaviour"; without the signal below, `FR-032` has a consumer, a
detector, and no producer.*

- [X] T828 [P] [US3] Unit tests asserting a material requirement edit emits a content-change signal carrying both hashes, that a re-space or no-op emits nothing, and that the hook is optional, in `backend/tests/unit/requirements/content-change-signal.spec.ts` (**FR-032**)
- [X] T829 [US3] Implement the `onContentChanged` seam — a hook, not a call, so the requirement register never depends on the specification module — in `backend/src/modules/requirements/requirements.service.ts` (**FR-032**; unit test: T828)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/008-spec-authoring-generation/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T189 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/008-spec-authoring-generation/closure.md`
- [X] T190 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/008-spec-authoring-generation/closure.md`
- [X] T191 Triage `specs/008-spec-authoring-generation/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/008-spec-authoring-generation/closure.md`
- [X] T192 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/008-spec-authoring-generation/closure.md`

## Phase 1: Convergence

*Appended 2026-08-20 by `/speckit-converge EPIC-008`, after `Phase Z` closed. Phase Z is lettered,
so this is the first NUMBERED phase and sits below it; the closure record in
[closure.md](./closure.md) predates these findings and is not rewritten — Constitution IX reports
what was true when it was written.*

**Numbering**: IDs continue from `T837`, not from this file's `T829`. Task IDs are invariant and
cross-referenced BETWEEN epics, so they are unique repository-wide; `T830`–`T837` were allocated to
EPIC-001 and EPIC-005 on 2026-08-20 while this epic was being implemented.

*The header count at the top of this file still reads 25. It is deliberately not updated: converge
is append-only and may not rewrite an existing line. The true count is 34.*

### F1 · A generation job never reports that it is running — HIGH

*`applyTransition` permits `queued → running`, `findLive` treats `running` as joinable, and the API
contract documents both `state ∈ … running …` and `startedAt`. No code performs the transition, so
a job goes straight from `queued` to a terminal state and `startedAt` is always null. **US3 scenario
2** — "the user sees that the job is running and can continue using the rest of the platform" — is
the acceptance criterion this leaves unmet.*

- [X] T838 [P] [US3] Unit tests asserting a generation run moves the job `queued → running` with `startedAt` set **before** the engine is invoked, that the transition goes through `applyTransition` rather than a raw write, and that a run which never starts leaves `startedAt` null, in `backend/tests/unit/specifications/job-started.spec.ts` per US3/AC2 (partial)
- [X] T839 [US3] Mark the run started — transition to `running` and stamp `startedAt` through the ledger before `engine.generateSpecification` is called — in `backend/src/modules/specifications/generate-specification.service.ts` per US3/AC2 and `contracts/platform-api.md` (partial; unit test: T838)

### F2 · An unavailable engine is reported as a generic error — HIGH

*`submit()` lets `NoDefaultEngineError` and `EngineSelectionUnavailableError` escape. Neither is a
`PlatformError`, so `toErrorBody` renders `internal_error` / "An unexpected error occurred."
**US3 scenario 4** requires the opposite in as many words: the user is "told the engine is
unavailable rather than shown a generic error".*

- [X] T840 [P] [US3] Unit tests asserting a submission against a deployment with no registered engine, and against a project selecting an unregistered one, are both refused **naming the engine as unavailable** and never surface as `internal_error`, in `backend/tests/unit/specifications/engine-unavailable-refusal.spec.ts` per US3/AC4 (contradicts)
- [X] T841 [US3] Translate engine-resolution failure into a named platform refusal carrying `engine_unavailable`, adding the error code to `backend/src/core/errors.ts` and mapping it in `backend/src/modules/specifications/generate-specification.service.ts` per US3/AC4 and FR-018 (contradicts; unit test: T840) — **note**: `core/errors.ts` is EPIC-001's `T018`; this widens its taxonomy, as `T829` widened EPIC-007's register

### F3 · A submitted selection is never checked against the project or the workspace — HIGH

*`submit()` de-duplicates the ids, bounds their count, and passes them into `inputRefs` unchecked. It
never asks whether those requirements exist, belong to `projectId`, or belong to the acting
workspace. FR-002's universal rule — "every request resolves a workspace from the session; every
query is workspace-filtered" — is not applied to the one input this endpoint takes.*

- [X] T842 [P] [US3] Unit tests asserting a submission naming a requirement from another project, from another workspace, or one that does not exist is refused — with the workspace case indistinguishable from absence (FR-002, SC-004) — and that no job is created, in `backend/tests/unit/specifications/selection-validation.spec.ts` per FR-002 and US3/AC1 (missing)
- [X] T843 [US3] Validate the selected requirements are in-project and in-workspace **before** a job is created, through a narrow read port so the requirement register is not imported, in `backend/src/modules/specifications/generate-specification.service.ts` per FR-002, SC-004, US3/AC1 (missing; unit test: T842)

### F4 · `resultRef` is contract surface with nowhere to live — MEDIUM

*The job body in `contracts/platform-api.md` declares `resultRef`, and Quickstart **V4** step 4
("open the resulting specification") depends on it. It appears in no schema — not `schema.prisma`,
not `_shared/schema.sql`, not `data-model.md` — so it is null on every path, including the
Prisma-backed one.*

- [X] T844 [P] [US3] Unit tests asserting a succeeded generation job carries `resultRef` = the created specification id, that a failed, cancelled or timed-out job carries none, and that the schema declares the column, in `backend/tests/unit/specifications/job-result-ref.spec.ts` per `contracts/platform-api.md` and Quickstart V4 (missing)
- [X] T845 [US3] Add `resultRef` to `GenerationJob` in `backend/prisma/schema.prisma` with a migration, and populate it in the success commit in `backend/src/modules/specifications/specifications-read.service.ts`, per `contracts/platform-api.md` (missing; unit test: T844) — **note**: `GenerationJob` is EPIC-001's `T041`; the field is added by the epic that produces the artifact it points at

### F5 · The job ledger re-implements the liveness rule untested — MEDIUM

*`InMemoryGenerationJobLedger.findLive` is a second implementation of the queued/running rule that
`NullJobStore` and `PrismaJobStore` already implement. EPIC-001's `job-idempotency.spec.ts` proves
the rule for its own store, not for this one. `T648` named this exact shape: two implementations of
one requirement that agree, with no behavioural test that would catch them diverging.*

- [X] T846 [P] [US3] Unit tests for `InMemoryGenerationJobLedger` asserting a duplicate submission joins only a `queued` or `running` job, that a failed, cancelled or timed-out job is NOT joined so a retry starts a new run (US3/AC3), and that the ledger and `NullJobStore` agree on the same case, in `backend/tests/unit/specifications/job-ledger.spec.ts` per Constitution V (partial)
