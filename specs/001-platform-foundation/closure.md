# Closing Report: EPIC-001 Platform Foundation

**Session**: `EPIC-001 Platform Foundation` · **Branch**: `epic/003-specification-engine` ·
**Date**: 2026-08-17

Written against [`governance/closing-report.md`](../../governance/closing-report.md). Tasks
`T165`–`T168` are discharged by the sections below.

> **Constitution VIII deviation, stated up front**: this session ran on
> `epic/003-specification-engine` while working EPIC-001. The branch was not switched at the start
> and the work was already under way when it was noticed. `G-08` passed throughout, because it
> verifies the *format* of a branch name and not that the name matches the epic being worked — the
> same limitation EPIC-018's closure recorded, now occurring for the fourth time. **This is the case
> `D-39` exists to close**, and it is the strongest available argument for taking that decision.

## Work Completed

**47 of 47 tasks complete.** The 43 that existed at the start of this session, plus four appended by
the `T166` convergence pass.

| Task | Outcome | Evidence |
|---|---|---|
| `T165` verify Constitution V | done | `pnpm test:unit` — **506 tests, 46 files, all passing**. Every implementation task has a paired unit test; see *Verified* |
| `T166` run convergence | done | Two findings, both fixed rather than deferred; `T660`–`T663` appended and completed. Re-run shows zero unreachable observability symbols |
| `T167` triage `defects/` | done | Two records raised, **both CLOSED**. Folder holds no open records |
| `T168` principle deltas + report | done | PP-010 signed — see *The principle delta, and why it could not be signed before* |
| `T660` worker observability test | done | `worker/tests/unit/observability-installation.spec.ts` — 9 tests; mutation-tested (3 mutations, all caught) |
| `T661` extract `packages/observability` | done | Package created, both processes depend on it, worker installs the bundle |
| `T662` HTTP interceptor test | done | `backend/tests/unit/observability/http-interceptor.spec.ts` — 7 tests; mutation-tested (3 mutations, all caught) |
| `T663` implement HTTP interceptor | done | `backend/src/modules/observability/http-observability.interceptor.ts`, installed globally in `main.ts` |
| `T657` (re-opened) | corrected | Was marked `[X]` with half its task text undone. Re-verified and re-closed |

### The correction, stated plainly

**`T657` was marked complete when it was not.** Its task text reads *"Wire `logger.ts`,
`correlation.ts` and `metrics.ts` into `backend/src/main.ts` **and `worker/src/main.ts`**"*. Only the
API half existed. The worker emitted a hand-rolled `console.log(JSON.stringify(...))` line carrying
no level, no workspace, no actor and no correlation id, and never passing through `redact()`.

It was not merely forgotten — **it was not reachable.** The modules lived in
`backend/src/core/observability/`, and the worker has no dependency on `@pmi/backend` and must not
acquire one. Completing the task required moving them, which is why this closure appended two tasks
rather than editing one line.

`/speckit-converge` had attached a warning to that very task on 2026-08-14: *"`T168` must not sign
the principle delta until `T657` lands."* The warning was correct, and it is the only reason this
was caught before the epic closed.

### Why `T656` did not catch it

`backend/tests/unit/observability/bootstrap.spec.ts` was named for the bootstrap and full of passing
assertions. **Both of its installation checks read `backend/src/main.ts`.** Nothing anywhere read
`worker/src/main.ts`. It looked like coverage of observability; it was coverage of one process.

The structural fix is one installation check **per process**, and both files now say so in their
headers. If a third long-running process is ever added it needs a third file, not another `describe`
in an existing one.

### A second finding, from looking for the same shape again

`T164`'s text is *"metrics emission for **API requests** and generation jobs."* `requestFinished`
and `correlationFor` had **zero** production call sites: `main.ts` installed the bundle at startup
and nothing ran per request, so route, status and latency were never known and an inbound
`x-correlation-id` was discarded. Recorded as
[`DEF-001-002`](./defects/DEF-001-002-api-request-metrics-never-emitted.md), fixed by `T662`/`T663`.

### Checks that were themselves defective

Mutation testing found **two of my own new assertions could not fail**:

- `toMatch(/reportGenerationResult/)` was satisfied by the `import` statement, so deleting the call
  site left the check green.
- `toMatch(/buildObservability/)` had the same hole, in both the new worker check and the existing
  `T656` API check.

Both now assert the **call** (`/…\s*\(/`) rather than the identifier. This is `DEF-001-001`'s own
shape reproduced inside the check written to prevent it — an assertion matching the *declaration* of
a capability rather than its *use* — and it is recorded here because it would otherwise be
rediscovered.

Both installation checks also now strip comments before asserting, in both directions: a positive
assertion a comment can satisfy proves nothing, and a negative assertion a comment can break teaches
the next person to delete the comment instead of fixing the code. That second case is not
hypothetical — it failed exactly that way during this session.

### The principle delta, and why it could not be signed before

| Principle | Claim in `spec.md` | Status now |
|---|---|---|
| **PP-010** Observability by Default | *"✅ Satisfied here for the whole platform"* | ✅ **True as of `T663`.** It was false when written and false until this session |

Measured, not asserted — production call sites, comments and tests excluded:

| Symbol | Before | After |
|---|---|---|
| `buildObservability` | 1 (API only) | **2** — API and worker |
| `loggerFor` | 1 | **4** |
| `metrics.jobFinished` | **0** | 1 — every terminal job state |
| `metrics.requestFinished` | **0** | 1 — every HTTP request |
| `correlationFor` | **0** | 1 — the API edge |

`SC-011` — *"95% of generation requests complete or report a named failure within their time
limit"* — is a claim about a distribution of terminal states. **Nothing recorded terminal states
until this session**, so the criterion was unmeasurable while its epic reported the principle
satisfied.

Every deferral in this epic retains a valid owner (decision **D-6**).

## Verified

Every gate CI runs, executed locally on 2026-08-17:

| Gate | Command | Result |
|---|---|---|
| Package typecheck | `pnpm -r typecheck` | **pass** — 12 packages, exit 0 |
| Governance typecheck | `pnpm typecheck:governance` | **pass** — exit 0 |
| Lint | `pnpm lint` | **pass** — 0 errors, 0 warnings |
| Unit tests | `pnpm test:unit` | **506 passed**, 46 files |
| Architecture tests | `pnpm test:arch` | **22 passed**, 3 files |
| Contract tests | `pnpm test:contract` | no test files, exit 0 — expected, `--passWithNoTests`; every contract test belongs to a held epic |
| Governance checks | `pnpm test:governance` | **183 passed**, 12 files |

**Both new checks were confirmed red before their implementation existed**, and both were
**mutation-tested afterwards** — six mutations across the two files, every one caught after the two
weak assertions were hardened:

| Mutation | Caught by |
|---|---|
| worker startup record reverted to a hand-rolled log line | `main.ts emits its startup record through the structured logger`, `does not hand-roll a log line` |
| `reportGenerationResult(` call site deleted | `reports every job result` — **survived the first version**, caught after hardening |
| worker `buildObservability(` call removed | `main.ts builds the observability bundle` — **survived the first version**, caught after hardening |
| API `buildObservability(` call removed | same check, API side |
| `useGlobalInterceptors` removed from `main.ts` | `main.ts registers it globally` |
| interceptor's error arm dropped (`tap({next})` only) | `measures a FAILED request too` |
| concrete `url` used instead of the templated route | `records the templated route and status` |

**`G-09`, `G-08` and the ten steering-file checks pass with this document in place.**

**The `T537` governance check failed on the way in**, when `observability` was added to `test:unit`
without being mapped in `tests/governance/vitest-projects.spec.ts`. That is the check doing its job —
it exists because two Vitest projects once collected nothing while the run stayed green — and it is
reported here rather than quietly fixed.

## Not verified

- **The integration suite was not run.** `pnpm test:integration` requires a container runtime and
  this machine has none: `audit-immutability.spec.ts` (`T453`, EPIC-004) fails with *"Could not find
  a working container runtime strategy."* Six append-only-audit assertions are **unverified**. This
  is EPIC-004's `T649`, not EPIC-001's, and it does not gate this epic — but `pnpm test` exits 1 on
  this machine and that is stated rather than hidden.
- **The CI workflow has not run.** Every gate above was executed locally. The `.github/workflows/ci.yml`
  steps are wired and unexecuted until the next push.
- **No process was started.** The interceptor, the worker bootstrap and the startup records are
  verified by unit tests and source assertions, not by observing a running system. The first real
  end-to-end observation belongs to EPIC-028 `T646b`, which needs a Docker daemon.

## Deferred

| Item | Owner | Awaiting |
|---|---|---|
| `T138` per-project engine selection endpoint (EPIC-003) | — | held product surface; deferred to EPIC-006 |
| Worker generation persistence | — | EPIC-008/EPIC-009 models, held pending `PMI-DOC-004`. The worker **fails loudly** rather than silently discarding results — see `worker/src/main.ts` |
| Checklist item *"Requirement IDs conform to PMI-DOC-000 §3"* | as registered | decision **D-1**, open by design, to be executed in one pass with `D-9` and `D-13` |
| `attachCorrelation` / `extractCorrelation` have no production call site | — | **Decided, not deferred**: they are exported package API with their own tests, and `job-queue.ts` carries the id inline so PC-3's queue hop works. Adopting them would add id validation to a path whose tests use non-UUID fixtures — a behaviour change dressed as a tidy-up. Recorded in `DEF-001-002` |
| Decision **D-39** (branch-vs-epic check) | as registered | the deviation at the top of this report is the fourth occurrence |

**This epic defers no work of its own.** Everything above is either another epic's, or an open
programme decision.

## Constitution and principle conformance

| Principle | Verdict |
|---|---|
| I Spec Kit Command Gate | pass — executed via `/speckit-implement`; no code changed outside a task |
| II SRS as Source of Truth | pass — traceability inherited from `_shared/platform-spec.md`; no requirement invented |
| III Epic → Feature → Task | pass — 5 functions, 47 tasks, 2 convergence phases |
| IV Convergence Gate | pass — `T166` run; 2 findings, 4 tasks appended, **all 4 completed**; zero unbuilt work remains |
| V Mandatory Unit Tests | pass — 506 unit tests; both new checks red first and mutation-tested |
| VI Defect Traceability | pass — 2 defects recorded **before** any fix, both fixed by named tasks, both CLOSED; folder holds no open records |
| VII Promotion Pipeline | not applicable — no promotion attempted; platform promotion is EPIC-014 F-11.2 |
| VIII Session Labelling | **fail** — branch named the wrong epic. Recorded above, not erased |
| IX Mandatory Closing Report | pass — this document |

## Epic Exit Criteria

- [x] Every implementation task has a passing unit test (Constitution V) — 506 passing
- [x] `/speckit-converge` reports no unbuilt work for this epic — 2 findings, both built
- [x] `specs/001-platform-foundation/defects/` contains no open defect records — 2 records, both CLOSED
- [x] Principle deltas still hold; every deferral retains a valid owner — PP-010 now genuinely holds
- [x] Epic closure recorded in `closure.md` — this document. **EPIC-001 is release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` — **not this epic's to discharge**; gated by
      [EPIC-014 F-11.2](../014-devops-release/tasks.md), which confirms the per-epic `closure.md` records

**EPIC-001 is the first epic in this programme to close.**

## Recommended Next Task

**`/speckit-implement for EPIC-018` — tasks `T445` and `T446`.** Two tasks close a second epic
sitting at 94%, and one of them (`T446`, ownership of `typecheck:governance`) is a decision this
session's evidence bears on: the governance suite ran seven times today and caught a real regression,
which is an argument for leaving it where it is rather than transferring it to EPIC-014.

Then **`/speckit-implement for EPIC-028`** — 29 tasks, the agent and execution seam. Note that
`T646b` needs a Docker daemon, which this machine does not have.

**Above both, and worth more than either**: `PMI-DOC-004` and approved business scope. **393 tasks
across 19 epics** are fully specified, planned and tasked, waiting on two owner deliverables. No
engineering sequence changes that number — see [`_shared/programme-status.md`](../_shared/programme-status.md).

Also worth taking now, because today produced its fourth data point: **decision `D-39`**, the
branch-vs-epic conformance check.
