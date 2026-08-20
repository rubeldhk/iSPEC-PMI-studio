# Closure record: EPIC-008 Specification Authoring & Generation

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-008` (Constitution VIII label) ·
**Released by**: PMI-DOC-004 v1.0 (**BR-0030**), scope ruling T-106, 2026-08-20 · **Stage**: `Ready`
in [`governance/epic-stage-register.md`](../../governance/epic-stage-register.md), next action
`/speckit-implement` — the resumption went through the Definition-of-Ready gate, not by declaration.

**Constitution VIII lapse, recorded rather than hidden**: the working branch is
`epic/017-enhancement-model`, which names a different epic. `G-08` passes because it checks the
*format* of a branch name; `G-10` (`branch-epic-correspondence.spec.ts`, decision `D-39`) exists
precisely to name this mismatch, and does. Constitution VIII is deliberately SHOULD, not MUST. The
branch was not switched mid-run because the tree already carried EPIC-005/006/007/013 work
committed on it.

**Concurrent session, recorded because the Constitution Check asks**: `HEAD` moved from `8508a87`
to `8a6f5c5` **during** this run — another session committed `DEF-005-001` / `DEF-001-004`
remediation tasks (`T830`–`T837`) and regenerated the stage register, and
`.claude/worktrees/epic-009-011-016/` shows a worktree open on three further epics. No file this
Epic touched was touched there; `T828`/`T829` do not collide with `T830`–`T837`; the full suite was
re-run against the new base and passes. The one visible collision was `governance/epic-stage-register.md`:
both sessions regenerate it, so its rows flipped between runs. It was regenerated last from this
tree and `G-26-03`/`G-26-04` agree with it as recorded here — but a reader who finds it disagreeing
should run `pnpm register:update` rather than assume this Epic left it stale. The plan's
*"Cannot assert — no other session on this checkout"* row is therefore now a **known FALSE**, not
an unknown.

The consumer of everything the preceding epics closed: projects as the container, requirements as
the input, the engine contract as the producer, the content hash as the staleness signal, and
EPIC-001's job layer as the asynchrony.

## `T189` — every implementation task has a passing unit test (Constitution V)

**25 of 25 tasks complete; tests observed RED first.** Nine test files were written before any
`specifications/*` source existed and run to import-failure red:

```text
Test Files  9 failed (9) · Tests  no tests
Error: Failed to load url ../../../src/modules/specifications/output-parser.js …
```

| Implementation task | Paired test | Result |
|---|---|---|
| T077 `Specification` + `SpecificationVersion` models + migration | T073 `generation-links.spec.ts` schema block (9) | pass |
| T079 engine output parser | T075 `output-parser.spec.ts` (22) | pass |
| T080 generation orchestration | T073 (17) + T074 `generation-failures.spec.ts` (24) | pass |
| T082 engine provenance stamping | T081a `engine-stamp.spec.ts` (18) | pass |
| T083 generation job endpoints | T082a `specifications.controller.spec.ts` (18); contract T076 `generation-jobs.spec.ts` (14) | pass |
| T083a specification list/detail/edit endpoints | T082a; contract T076b `specifications-read.spec.ts` (13) | pass |
| T083b specification read service | T076a `specifications-read.spec.ts` (26) | pass |
| T083g specification search and filtering | T083f `specification-search.spec.ts` (18) | pass |
| T094 out-of-date flagging | T093a `out-of-date.spec.ts` (13) | pass |
| T829 requirement content-change seam | T828 `content-change-signal.spec.ts` (7) | pass |

**Ten implementation tasks, ten paired tests, zero gaps.** Final run — every Vitest project,
integration included. Run **per project group** rather than as one `pnpm test`: the concurrent
session noted above was starting its own Testcontainers and rewriting the stage register mid-run,
so a single combined run reported failures that belonged to the tree moving, not to the tree being
wrong.

```text
backend-unit + backend-contract + architecture + frontend + worker-unit
Test Files   65 passed (65)  · Tests   624 passed (624)

engine-contract + observability + adapters + contracts + scripts
Test Files   34 passed (34)  · Tests   501 passed (501)

governance
Test Files   59 passed (59)  · Tests   767 passed (767)

backend-integration  (real PostgreSQL 16, every migration)
Test Files    7 passed (7)   · Tests    54 passed (54)
```

**165 files, 1,946 tests, zero failures.** `tsc --noEmit` clean; `eslint .` reports 0 errors
(6 pre-existing warnings, none in this Epic's files); `prisma validate` passes.

### The migration ran against a real database — not merely written

`backend/tests/integration/requirement-version-immutability.spec.ts` applies **every** migration in
`prisma migrate deploy` order to PostgreSQL 16 via Testcontainers (Docker 28.3.3). It now applies
`20260820000300_epic008_specifications` too, and passes:

```text
pnpm test:integration
Test Files  6 passed (6) · Tests  49 passed (49)
```

So the two tables, four CHECK constraints, six indexes and the deferred self-referential foreign key
are executable SQL, not plausible SQL. `prisma validate` also passes.

## `T190` — convergence

Performed within this run per the `speckit-converge` method. **One gap found, appended as
`T828`/`T829`, and completed inside this run.** Remaining findings are seams with named owners.

- **F1 — `FR-032` had a detector and no producer.** `OutOfDateService` (`T094`) flags every
  specification derived from a changed requirement. Nothing told it a requirement had changed.
  EPIC-007's own closure predicted the shape of this — *"nothing consumes it yet — that is EPIC-008
  F-04.7 by design"* — but the seam it needed ran in the other direction. Closed by `T828`/`T829`:
  `RequirementsService` now emits `onContentChanged` with **both** hashes, as a hook rather than a
  call, so the requirement register still does not depend on the specification module. The binding
  of hook to service is composition-root work, exactly as `onRefused` is.
- **F2 — the traceability link writer is EPIC-011's, and its absence is fatal rather than silent.**
  `PrismaSpecificationStore.commitGeneration` throws `TraceabilityUnavailableError` when no link
  delegate is supplied. A store that quietly dropped links would manufacture the orphan `SC-002`
  forbids. The in-memory store writes them, so `T073` verifies the invariant today.
- **F3 — composition seam**, identical to the sibling epics: `SPECIFICATION_STORE` and
  `GENERATION_JOB_LEDGER` default to in-memory; the Prisma store is built and exported. Owner
  EPIC-014 F-11.2.
- **F4 — the worker's consumer is still EPIC-001's stub.** `worker/src/generation.consumer.ts`
  (`T046`) writes through an untyped `tx.write({ kind: … })` persistence port. `T080`'s
  `GenerateSpecificationService.run()` is the typed orchestration that stub anticipated, and both
  now exist. Pointing the consumer at it is composition-root work — owner EPIC-014 F-11.2.
- **F5 — scope held.** `GET /specifications/{id}/versions`, the six lifecycle transitions and the
  validation endpoints are EPIC-009 (`T113`, `T123`); `T110` generalises version creation into
  `version.service.ts`, and the `specification_versions_immutable` trigger is EPIC-009 `T460` with
  its own integration test. This epic implements the `FR-012` edit path and nothing beyond it. The
  frontend is EPIC-010. None of these were built here.
- **F6 — `DEF-004-001` is partly discharged incidentally.** `specifications` carries `createdById`
  and `updatedById`, the first tables in the schema to honour the design DDL's `created_by` /
  `updated_by` convention. The defect stays open for the six tables that predate them; it is
  EPIC-004's, not reassigned here.

**Definition of done**: 25 tasks complete with every unit test passing; a failed, cancelled or
timed-out job leaves no artifact (`T074`, eight reasons × three store assertions); every generated
specification links to ≥1 originating requirement (`T073`); **Quickstart V4 and V5 have not run
end-to-end** — composed runtime — deferred to EPIC-014 F-11.2 with V1/V2/V3/V12.

## `T191` — defect triage

`specs/008-spec-authoring-generation/defects/` holds **one** record, raised by this run.

| Record | Severity | Outcome |
|---|---|---|
| [`DEF-008-001`](./defects/DEF-008-001-no-persistence-failure-reason.md) — the failure taxonomy has no reason for "the artifact could not be stored" | LOW | **CLOSED — DEFERRED to EPIC-003**, which owns `@pmi/engine-contract` and the `FR-026` taxonomy |

The deferral is argued in the record: adding a member touches the contract enum, the message
`Record` (a compile error until updated — by design), the `JobFailureReason` Prisma enum and a
migration, and `platform-api.md` states that a new `job_failure_reason` member *"must be documented
in this contract before release"*. Nothing is unsafe today — `SC-006` holds on that path; what is
wrong is the label, not the behaviour.

**0 open.** The record is closed on the deferral decision — the disposition `DEF-004-001` took and
the one `DOR-11` recognises, so the stage register reads `Ready` rather than punishing the epic for
writing the finding down.

## `T192` — closing report

### Work Completed

- **`backend/prisma/schema.prisma`** + migration `20260820000300_epic008_specifications` —
  `SpecLifecycleState` enum, `specifications` and `specification_versions`, both raw and parsed
  content (R-007), engine provenance that is neither null nor blank (`specifications_engine_identified`),
  non-empty content and title CHECKs, `versionNumber >= 1`, the `(projectId, lifecycleState)` listing
  index, and the deferred self-referential `currentVersionId` foreign key. Executed against
  PostgreSQL 16.
- **`backend/src/modules/specifications/output-parser.ts`** (`T079`) — empty and malformed output are
  distinct named failures; `contentRaw` is kept verbatim; the message never echoes engine output
  (R-011, rule E9).
- **`backend/src/modules/specifications/engine-stamp.ts`** (`T082`) — refuses rather than defaults.
  There is no placeholder engine name, which is what makes `FR-022` checkable.
- **`backend/src/modules/specifications/generate-specification.service.ts`** (`T080`) — `submit()`
  for the API side and `run()` for the worker side. Pre-flight refusals before the engine is touched
  (rule E7, RAID R-02); `runWithLimits` reused for cancellation and timeout, so a cost overrun is not
  reported as a user action; one `commitGeneration` call carrying specification, version, links and
  the job's terminal state; every failure path routed through one `terminal()` that writes the state
  and nothing else. Also `InMemoryGenerationJobLedger`, which satisfies EPIC-001's `JobStore` and this
  epic's read surface from one set of rows.
- **`backend/src/modules/specifications/specifications-read.service.ts`** (`T083b`) — the module's
  record types, its persistence port with no delete on it, the in-memory store, and
  `PrismaSpecificationStore`. Edit appends a version on a content change and appends nothing on a
  rename or a no-op; the out-of-date flag is never cleared by an edit.
- **`backend/src/modules/specifications/specification-search.service.ts`** (`T083g`) — scoped, then
  matched, then ranked; title outranks content; a third sort key so a paged result set cannot reorder
  between pages; an unknown `lifecycleState` is refused rather than ignored.
- **`backend/src/modules/specifications/out-of-date.service.ts`** (`T094`) — flags, and holds no
  engine at all. `OutOfDateService.length === 1` is asserted, so there is no seam through which a
  future change could make flagging trigger a run.
- **`backend/src/modules/specifications/specifications.controller.ts`** (`T083`, `T083a`) — the four
  job routes and the three specification routes, 202 on submission and on cancellation, the contract's
  job body, scope stripped from every PATCH body.
- **`backend/src/modules/specifications/specifications.module.ts`** + registration in
  `app.module.ts` — wired in the same commit as the services, rather than waiting for convergence to
  find the capability unreachable as it did for engines (`T462`) and jobs (`T651`).
- **`backend/src/modules/requirements/requirements.service.ts`** (`T829`) — the `onContentChanged`
  seam, added by convergence.
- Existing suites updated for the two new tables: `universal-columns.spec.ts` (table set, and
  `specification_versions` timestamps its rows as *authored*) and `schema-constraints.spec.ts`
  (tenant-scoped model list).

### Not verified

- **Quickstart V4 and V5** end-to-end — composed runtime; owner EPIC-014 F-11.2.
- **No real HTTP request has reached `/v1/specifications` or `/v1/jobs`.** Every layer below is
  verified, including the migration against a real PostgreSQL, but the composed request path is the
  same seam every product-surface epic has left open.
- **No real engine has generated a specification through this path.** The engine is resolved through
  the contract and stubbed in tests; the nightly real-engine run (research R-010) is EPIC-014's.

### Deferred (owners per D-6)

| Item | Owner | Awaiting |
|---|---|---|
| Composition root: `SPECIFICATION_STORE` / `GENERATION_JOB_LEDGER` → Prisma; `onRefused` → audit; `onContentChanged` → `OutOfDateService`; traceability link delegate | EPIC-014 F-11.2 | first composed environment |
| Point `worker/src/generation.consumer.ts` at `GenerateSpecificationService.run()` | EPIC-014 F-11.2 | same |
| Quickstart V4, V5 | EPIC-014 F-11.2 | same |
| `TraceabilityLink` model and link writer | EPIC-011 `T078`, `T081` | by design — `T073` verifies the invariant through the port |
| Lifecycle transitions, `/versions` endpoints, `version.service.ts`, the `specification_versions_immutable` trigger | EPIC-009 `T099`, `T110`, `T113`, `T460` | by design |
| Specification interface (list, editor, generation UI) | EPIC-010 | by design |
| A failure reason for a persistence failure | EPIC-003 | `DEF-008-001` (closed here, owned there) |
| Retirement of a requirement as a staleness signal (distinct from an edit) | EPIC-009 / EPIC-020 | not a `FR-032` content change; recorded, not assumed |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (`T189`) — 10 of 10, red observed first
- [x] Convergence reports no unbuilt work in scope (`T190`) — one gap found, appended as `T828`/`T829`, completed
- [x] `defects/` contains no open defect record (`T191`) — `DEF-008-001` closed on deferral to EPIC-003
- [x] Principle deltas hold (none declared); deferrals have valid owners (`T192`)
- [x] Closure recorded — this document; **EPIC-008 is CLOSED and release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` — EPIC-014 F-11.2's, not this epic's

### Recommended Next Task

**`/speckit-implement EPIC-009`** — Specification Lifecycle & Versioning. It is the direct
continuation: the six-state machine this epic stores a state for but does not move, the version
endpoints its `PATCH` already feeds, `version.service.ts` generalising the append this epic
implements for `FR-012`, and `T460`'s `specification_versions_immutable` trigger — the database half
of the append-only guarantee `specification_versions` currently keeps in code alone.

---

## Correction — 2026-08-20, after `/speckit-converge EPIC-008`

**Everything above `T192` was written against an incomplete intent inventory, and its `T190` claim
was wrong.** This section is appended rather than folded in: Constitution IX reports what was true
when a report was written, and quietly editing a closing report to agree with a later finding
destroys the only evidence that the gate failed.

### What the closing report got wrong

`T190` recorded *"convergence reports no unbuilt work in scope"* and this epic was declared CLOSED
and release-eligible. A subsequent `/speckit-converge EPIC-008` found **five** gaps, three of them
HIGH.

The cause was method, not luck. The convergence performed inside the implement run assessed against
the four requirements this epic's `spec.md` lists as owned — and **never read US3's acceptance
scenarios**, which live in [`../_shared/platform-spec.md`](../_shared/platform-spec.md) and are
inherited here under Constitution II rather than restated. Three of the five findings trace directly
to scenarios that were never read:

| Finding | Source not read | What it cost |
|---|---|---|
| F1 | US3/AC2 — *"the user sees that the job is running"* | Nothing moved a job `queued → running`; `startedAt` was always null, and `findLive`'s `running` branch was dead code |
| F2 | US3/AC4 — *"told the engine is unavailable rather than shown a generic error"* | `submit()` let engine-resolution failures reach `toErrorBody` as `internal_error` / "An unexpected error occurred." |
| F3 | FR-002's universal rule, applied to the endpoint's one input | A submission could name another workspace's requirement ids unchecked |

F2 is the sharpest of the three, because the reasoning was recorded at the time: the implement run's
own working note read *"a deployment fault → `internal_error` (500). Reasonable."* The acceptance
criterion says the opposite in as many words. A defensible-sounding conclusion was reached instead
of the criterion being checked.

### What is now true

`T838`–`T846` are complete — **34 of 34 tasks**, ten new tests, red observed first on four of the
five files. `T846` could not fail on arrival, because F5's gap *was* the missing test rather than
broken behaviour; it was mutation-checked instead (removing the ledger's liveness rule fails 6 of
its 11 cases), per Constitution V's "a check that cannot fail is decoration".

```text
backend-unit + backend-contract + architecture   62 files ·  618 tests
packages + frontend + worker-unit                44 files ·  576 tests
governance                                       59 files ·  767 tests
backend-integration (real PostgreSQL 16)          8 files ·   58 tests
                                                 ---------------------
                                                173 files · 2,019 tests · 0 failures
```

`tsc --noEmit` clean, `eslint` clean, `prisma validate` passes, and both EPIC-008 migrations —
`…000300_epic008_specifications` and `…000400_epic008_job_result_ref` — executed against
PostgreSQL 16 in migration order.

### Changes reaching outside this epic's files

Each is a widening, not a rewrite, and each carries its own test:

| File | Owner | Change |
|---|---|---|
| `backend/src/core/errors.ts` | EPIC-001 `T018` | `engine_unavailable` added to `ErrorCode`, mapped to **422** — not 503, which the contract's status table does not list. The code carries the meaning; inventing an undocumented status is the mistake `DEF-008-001` records |
| `backend/prisma/schema.prisma` | EPIC-001 `T041` | `GenerationJob.resultRef`, nullable, no foreign key — `resultRef` is polymorphic across the three `JobKind` members |
| `backend/src/modules/requirements/requirements.service.ts` | EPIC-007 `T066` | unchanged this pass; the `onContentChanged` seam was `T829`'s |

### What this changes about the epic's status

The **release-eligible** claim in `T192` is withdrawn and re-made here on the corrected basis: with
`T838`–`T846` complete, EPIC-008 is release-eligible again. Platform promotion remains EPIC-014
F-11.2's, unchanged.

### The lesson, recorded so the next epic does not repeat it

**An epic that inherits its user stories must read them.** Every epic under `_shared/` states its
owned requirements and inherits the scenarios; assessing against the owned list alone will pass a
convergence gate that should fail. EPIC-009 (US5, US6), EPIC-011 and EPIC-012 all inherit the same
way, and the session working them from `.claude/worktrees/epic-009-011-016/` is exposed to exactly
this trap.
