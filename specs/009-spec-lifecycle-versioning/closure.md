# Closure record: EPIC-009 Specification Lifecycle & Versioning

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-009` (Constitution VIII label) ·
**Released by**: PMI-DOC-004 v1.0, scope ruling T-106, 2026-08-20.

**Delivered by two sessions, in two stages, and this record covers both.**

| Stage | Where | What |
|---|---|---|
| 1 | `epic/009-011-016-lifecycle-wave`, commit `cd81d70` | "Everything EPIC-008 does not gate" — the machine, baseline, versioning, diff, validation, approval, and their tests |
| 2 | this line, after integration | Everything that references `specifications` / `specification_versions` — both models, the immutability trigger, and every endpoint |

The staging was deliberate on the other session's part, and correct: stage 1 built what could be
built without EPIC-008's tables, and stopped. Stage 2 began only after the two lines were merged.

**Concurrency, recorded rather than hidden**: this Epic was worked by two sessions at once. Before
writing a line of stage 2, this session checked `git worktree list`, found
`epic/009-011-016-lifecycle-wave` already carrying `lifecycle.machine.ts`, `baseline.service.ts`,
`version.service.ts`, `version-diff.service.ts`, `approval.service.ts` and
`validate-specification.service.ts` **with their tests**, and stopped to ask rather than write a
second implementation of 28 tasks across the same ten files. Integration, not duplication, was the
instruction that followed.

## `T193` — every implementation task has a passing unit test (Constitution V)

**30 of 30 tasks complete** (28 planned + `T855`/`T856` from `T194`).

| Implementation task | Paired test | Stage | Result |
|---|---|---|---|
| T099 + T111 lifecycle machine, actor and time | T106 `lifecycle-guard.spec.ts` | 1 | pass |
| T099b baseline immutability + archive | T099a `baseline-archive.spec.ts` | 1 | pass |
| T110 append-only version creation | T105 `versioning.spec.ts` | 1 | pass |
| T112 version comparison | T107 `version-diff.spec.ts` | 1 | pass |
| T121 validation orchestration | T117 `validation-findings.spec.ts` | 1 | pass |
| T122 approval surfacing findings | T118 `approval-findings.spec.ts` | 1 | pass |
| — task-generation gate (FR-020) | T095 `task-generation-gate.spec.ts` | 1 | pass |
| **T109** `LifecycleTransition` model + migration | T106, extended | 2 | pass |
| **T120** `ValidationFinding` model + migration | T117, extended | 2 | pass |
| **T460** `specification_versions_immutable` trigger | **T459, EXECUTED — see below** | 2 | pass |
| **T113** six transitions + version endpoints | T112a `lifecycle.controller.spec.ts`; contract T108 `specification-lifecycle.spec.ts` | 2 | pass |
| **T123** validation endpoints | T122a `validation.controller.spec.ts`; contract T119 `validation.spec.ts` | 2 | pass |
| **T856** baselined edit forks | T855 `baseline-edit-fork.spec.ts` | 2 | pass |

Stage 2's five test files were observed RED before their implementation: 17 failures on the
lifecycle pair, 9 on the validation pair, 3 on the fork.

```text
backend-unit + backend-contract + architecture   85 files ·  821 tests
backend-integration (real PostgreSQL 16)          9 files ·   65 tests
```

### `T459` ran against a real database — not merely written

The task was specified as "write failing integration test"; this session went further, as EPIC-007
did for `T457`, because a Docker daemon is reachable. Every migration applied in
`prisma migrate deploy` order to PostgreSQL 16 via Testcontainers. Observed red first — the raw
`UPDATE` succeeded, which was the defect — then green:

| Case | Result |
|---|---|
| migrations applied; probe version row held | pass |
| raw `UPDATE` rejected by the database | pass |
| raw `DELETE` rejected by the database | pass |
| prior content retrievable and UNALTERED after both (SC-007) | pass |
| `INSERT` still permitted — append-only, not read-only | pass |
| attached to the SHARED `reject_mutation()`, exactly one definition of it | pass |
| the version CHECK constraints still hold | pass |

`reject_mutation()` was **attached to, not redefined** — the trigger migration contains no
`CREATE FUNCTION`, and the test asserts `pg_proc` holds exactly one.

## `T194` — convergence

Performed within this run. **One gap found, appended as `T855`/`T856`, and completed.**

- **F1 — a baselined specification did not fork on edit.** `BaselineService.editBaselined`
  implements FR-011a and `T099a` tests it; nothing reached it. `PATCH /specifications/{id}`
  (EPIC-008 `T083a`) appended a version without consulting the lifecycle state, so the one state
  where editing must behave differently behaved like every other. Closed by `T856`: a content edit
  to a baselined specification now forks a version born in `draft` and moves the specification
  there, leaving the baseline retrievable unchanged. It writes **no** transition row — `baselined →
  draft` is not a permitted edge, and recording one would put an impossible move in the table the
  new CHECK constraint guards.

  This was found by reading **US5 scenario 2 against the edit path** rather than against the
  service. It is the same class of miss that EPIC-008's first closure made, caught this time
  because the scenarios were read first.

- **F2 — the seven acceptance scenarios are covered.** US5/1 transitions recorded with who and when
  (`T108`); US5/2 edit creates a version, prior retrievable (`T855`, `T105`, and the trigger);
  US5/3 comparison (`T108` diff); US5/4 `approved → draft` refused naming the permitted set
  (`T108`); US6/1 every finding carries a location (`T119`); US6/2 a clean specification reports an
  empty list rather than an error (`T119`); US6/3 outstanding findings surfaced before approval
  proceeds (`T108`, `T112a`).

- **F3 — the two-layer lifecycle rule is now pinned.** `T106` could previously assert only the code
  half, because the CHECK constraint lived in the design DDL and in no migration. It now compares
  the migration's eight `fromState/toState` pairs against `PERMITTED_TRANSITIONS` and fails if they
  diverge.

- **F4 — composition seams**, with owners: `TRANSITION_RECORDER` and `OUTSTANDING_FINDINGS` default
  to in-memory and empty; the worker path for a `validate_specification` job is not wired. All
  EPIC-014 F-11.2, the same seam every epic has left open.

**Definition of done**: 30 tasks complete with every unit test passing; the lifecycle refuses
everything outside its eight edges; versions are immutable at the database; **Quickstart V6/V7 have
not run end-to-end** — composed runtime — deferred to EPIC-014 F-11.2.

## `T195` — defect triage

`specs/009-spec-lifecycle-versioning/defects/` contains no records (only `.gitkeep`). **0 open.**

Integration did surface two defects belonging to other epics, both fixed in the merge commit rather
than deferred, because both were breaking the combined tree:

- `TraceabilityController` and `DecisionsController` still injected by class type, which is
  undefined under esbuild/tsx (`DEF-001-005`). The other session's own `T847` guard caught them —
  it could not before, because the guard landed on one line and the controllers on the other.
- `universal-columns.spec.ts` expected ten tables on each branch and twelve exist.

## `T196` — closing report

### Work Completed (stage 2 — stage 1 is `cd81d70`)

- **`backend/prisma/schema.prisma`** + `20260820100100_epic009_lifecycle_findings` — `LifecycleTransition`
  and `ValidationFinding` with `FindingSeverity`, the eight-edge `lifecycle_permitted_transition`
  CHECK, the FR-023 location CHECK, and the `lifecycle_transitions_immutable` trigger.
- **`20260820100000_epic009_spec_version_immutable`** (`T460`) — the trigger SC-007 needs.
- **`backend/src/modules/specifications/lifecycle.service.ts`** (`T113`) — the seam between the pure
  machine and the stored specification. All six transitions take ONE path; a refused transition
  writes neither state nor history.
- **`specifications.controller.ts`** — the six transition routes, `/versions`,
  `/versions/{a}/diff/{b}`, `/findings`, and `POST /jobs/validate` (202 with a job).
- **`generate-specification.service.ts`** — `submitValidation`, scoped through the same store the
  read surface uses so a foreign specification is indistinguishable from an absent one.
- **`specifications-read.service.ts`** — `lifecycleState` on the update path, and the FR-011a fork.
- **`specifications.module.ts`** — recorder, machine, approval service and lifecycle service wired.

### Not verified

- **Quickstart V6 and V7** end-to-end — composed runtime; owner EPIC-014 F-11.2.
- **No real engine has validated a specification.** The job is submitted and the findings surface is
  built; the worker consumer for `validate_specification` is EPIC-014's wiring.
- **No real HTTP request has reached `/v1/specifications/{id}/approve`** — same seam as every
  product-surface epic.

### Deferred (owners per D-6)

| Item | Owner | Awaiting |
|---|---|---|
| Bind `TRANSITION_RECORDER` → `lifecycle_transitions`, `OUTSTANDING_FINDINGS` → `validation_findings` | EPIC-014 F-11.2 | first composed environment |
| Worker consumer for `validate_specification` jobs | EPIC-014 F-11.2 | same |
| Quickstart V6, V7 | EPIC-014 F-11.2 | same |
| A failure reason for a persistence failure | EPIC-003 | `DEF-008-001` |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (`T193`) — 13 of 13, red observed first on stage 2
- [x] Convergence reports no unbuilt work in scope (`T194`) — one gap found, appended as `T855`/`T856`, completed
- [x] `defects/` contains no open defect record (`T195`)
- [x] Principle deltas hold; deferrals have valid owners (`T196`)
- [x] Closure recorded — this document; **EPIC-009 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's, not this Epic's

### Recommended Next Task

**`/speckit-implement EPIC-010`** — Specification Interface. Every capability this Epic and EPIC-008
built is now reachable only by a caller that speaks TypeScript: the lifecycle has six endpoints and
no buttons, validation has findings and nowhere to show them. EPIC-010 is also uncontested — nothing
else is touching `frontend/`.

**Before that**, note that EPIC-011 and EPIC-016 arrived in the same merge as stage 1 and their task
lists are still unmarked. `/speckit-converge EPIC-011` would establish what of it is actually done.
