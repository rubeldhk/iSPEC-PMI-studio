---

description: "Task list for EPIC-001 — Platform Foundation"
---

# Tasks: Platform Foundation

**Epic**: `EPIC-001` | **Module**: M-00 | **Tasks**: 47

> **Counted, not quoted.** This number is recomputed by `/speckit-analyze`; the phase and function sections below are its composition. It drifted before because two documents restated it and neither was derived — EPIC-018 read 31 here, 32 in the index and 34 in its task list, and by the time `T529` came to reconcile them the real figures were 31 / 37 / 38. **The remediation went stale before it ran.** Corrected by `T686`.

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here depends on the
> Business Requirement Specification.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-00.1 · Monorepo and tooling

- [X] T001 Create pnpm workspace root in `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- [X] T002 [P] Scaffold NestJS API package in `backend/` with `src/main.ts` and `src/app.module.ts`
- [X] T003 [P] Scaffold React + Vite web package in `frontend/`
- [X] T004 [P] Scaffold BullMQ worker package in `worker/src/main.ts` (unit tests: `worker/tests/unit/worker-bootstrap.spec.ts`, `worker/tests/unit/observability-installation.spec.ts`)
- [X] T005 [P] Scaffold engine contract package in `packages/engine-contract/src/index.ts` (unit test: `packages/engine-contract/tests/unit/contract.spec.ts`)
- [X] T006 [P] Scaffold adapter packages `engine-adapters/speckit/` and `engine-adapters/fixture/`
- [X] T007 [P] Configure Vitest across all packages in `vitest.workspace.ts`
- [X] T008 [P] Configure ESLint + Prettier, including a dependency-boundary rule forbidding `backend/**` from importing `engine-adapters/**`, in `eslint.config.js`

## F-00.2 · Local services and CI

- [X] T009 [P] Add PostgreSQL 16 and Valkey 7 services in `docker-compose.yml` (Valkey over Redis on licence grounds — ADR-0003, RAID R-03)
- [X] T010 Add CI pipeline running `test:unit`, `test:arch`, `test:contract` in `.github/workflows/ci.yml`
- [X] T048 Add `test:arch` script wiring to CI in `package.json` and `.github/workflows/ci.yml`

## F-00.3 · Error model and failure taxonomy

*Where FR-026 and SC-005 become structurally true: there is no generic error to fall back to.*

- [X] T017 [P] Write failing unit tests for the API error shape and code mapping in `backend/tests/unit/core/errors.spec.ts`
- [X] T018 Implement typed error classes and the `{ error: { code, message, details } }` filter in `backend/src/core/errors.ts` and `backend/src/core/error.filter.ts` (unit test: T017)
- [X] T019 [P] Write failing unit tests asserting every failure reason maps to a distinct code, with no generic fallback, in `backend/tests/unit/core/failure-taxonomy.spec.ts`
- [X] T020 Implement the failure taxonomy enum and mapper in `backend/src/core/failure-taxonomy.ts` (unit test: T019)

## F-00.4 · Generation job orchestration

*Satisfies **FR-024**, **FR-025**, **FR-027** and **FR-028**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*Cross-cutting: serves specification generation, task generation, and validation alike.*

- [X] T040 [P] Write failing unit tests for the job state machine, covering every terminal state and asserting no partial artifact is stored, in `backend/tests/unit/jobs/job-state.spec.ts`
- [X] T041 Define `GenerationJob` model in `backend/prisma/schema.prisma` and implement the job state machine in `backend/src/modules/jobs/job-state.machine.ts` (unit test: T040)
- [X] T042 [P] Write failing unit tests for idempotent job keys, asserting a duplicate submission joins the existing job, in `backend/tests/unit/jobs/job-idempotency.spec.ts`
- [X] T043 Implement BullMQ queue, job creation, and idempotency in `backend/src/modules/jobs/jobs.service.ts` (unit test: T042)
- [X] T044 [P] Write failing unit tests for cancellation and timeout producing `cancelled` and `timeout` with no artifact, in `backend/tests/unit/jobs/job-cancel-timeout.spec.ts`
- [X] T045 Implement cancellation via `AbortSignal` and wall-clock timeout enforcement in `backend/src/modules/jobs/job-runner.service.ts` (unit test: T044)
- [X] T045a [P] Write failing unit tests for the worker consumer against a stubbed engine, asserting the success path writes specification, versions, links, and terminal state in one transaction, and every failure path writes no artifact, in `worker/tests/unit/generation.consumer.spec.ts`
- [X] T046 Implement the worker consumer that claims a job, resolves the engine, and persists the result in `worker/src/generation.consumer.ts` (unit test: T045a)

## F-00.5 · Observability

- [X] T157 [P] Unit tests for structured log emission, asserting every record carries workspace, actor, and correlation identifiers and that no credential or engine output is logged, in `backend/tests/unit/observability/logging.spec.ts`
- [X] T158 Implement structured logging with request and job context in `backend/src/core/observability/logger.ts` (unit test: T157)
- [X] T159 [P] Unit tests for correlation identifier propagation across API → queue → worker in `backend/tests/unit/observability/correlation.spec.ts`
- [X] T160 Implement correlation identifier generation and propagation through BullMQ job payloads in `backend/src/core/observability/correlation.ts` (unit test: T159)
- [X] T161 [P] Unit tests asserting the sandbox receives and returns a correlation identifier without widening its egress allow-list, in `engine-adapters/speckit/tests/unit/correlation.spec.ts`
- [X] T162 Implement correlation propagation across the sandbox boundary in `engine-adapters/speckit/src/correlation.ts` (PC-3; unit test: T161)
- [X] T163 [P] Unit tests for job and request metrics — counts, durations, terminal-state breakdown — in `backend/tests/unit/observability/metrics.spec.ts`
- [X] T164 Implement metrics emission for API requests and generation jobs in `backend/src/core/observability/metrics.ts` (unit test: T163)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/001-platform-foundation/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T165 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/001-platform-foundation/closure.md`
- [X] T166 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/001-platform-foundation/closure.md`
- [X] T167 Triage `specs/001-platform-foundation/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/001-platform-foundation/closure.md`
- [X] T168 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/001-platform-foundation/closure.md`

> **Closed 2026-08-17** — see [`closure.md`](./closure.md). `T166` found two defects, both fixed
> rather than deferred (`T660`–`T663`). **EPIC-001 is release-eligible and is the first epic in this
> programme to close.**

---

## Phase 6: Convergence

*Appended by `/speckit-converge` on 2026-08-14. No existing task modified. IDs continue from the
**corpus** maximum (`T649`) — not this epic's, which is the mistake that produced conflict `C-27`
(see [srs-alignment.md](../srs-alignment.md) Part 9).*

**All four findings share one shape**: the logic is built, unit-tested and correct, and **nothing
composes it into a running system**. This is the defect EPIC-003 `T462` named — *"fully built, fully
tested, and unreachable"* — recurring across the whole of F-00.4 and F-00.5. The unit suites pass
because the services take narrow ports (correct PC-1 design) and the tests supply them; no process
does.

- [X] T650 [P] Write failing unit tests asserting `JobsModule` provides `JobsService`, `JobRunnerService` and the job state machine, and that resolving them from the Nest container succeeds, in `backend/tests/unit/jobs/jobs.module.spec.ts` per FR-024 (partial)
- [X] T651 Wire the job providers in `backend/src/modules/jobs/jobs.module.ts` using factory providers, keeping the services framework-free (PC-1), mirroring `engines.module.ts` per FR-024, FR-025, FR-027 (partial) — unit test: T650
- [X] T652 [P] Write failing unit tests asserting the worker constructs a BullMQ `Worker` bound to the generation queue and dispatches each job to `consumeGenerationJob`, against a stubbed queue, in `worker/tests/unit/worker-bootstrap.spec.ts` per FR-028 (partial)
- [X] T653 Create the BullMQ `Worker` in `worker/src/main.ts`, wiring it to `consumeGenerationJob` with the composed engine registry, cancellation signal and wall-clock limits per FR-028, T046 (partial) — unit test: T652
- [X] T654 [P] Write failing unit tests asserting `JobsService` enqueues onto a real queue port and that a duplicate submission joins the live job rather than enqueuing twice, in `backend/tests/unit/jobs/queue-port.spec.ts` per FR-028 (partial)
- [X] T655 Construct the BullMQ queue behind the existing narrow port and provide it to `JobsService` in `backend/src/modules/jobs/jobs.module.ts` per FR-028, T043 (partial) — unit test: T654
- [X] T656 [P] Write failing unit tests asserting the API bootstrap installs the structured logger and metrics, and that a request carries a correlation identifier end to end, in `backend/tests/unit/observability/bootstrap.spec.ts` per PP-010 (partial)
- [X] T657 Wire `logger.ts`, `correlation.ts` and `metrics.ts` into `backend/src/main.ts` and `worker/src/main.ts` per PP-010 (partial) — unit test: T656

  > **`spec.md` claims PP-010 is "✅ Satisfied here for the whole platform".** At runtime nothing
  > emits a log, a metric, or a correlation identifier, because all three modules are referenced only
  > by their own tests. **`T168` must not sign the principle delta until `T657` lands** — that
  > exit criterion asks whether the deltas still hold, and today this one does not.
  >
  > **Re-opened and re-closed 2026-08-17 during `T165`.** The API half was wired; the worker half was
  > not, and was **not reachable** — the modules lived in `backend/src/core/`, which the worker may not
  > import. `T656` passed throughout because both of its installation assertions read
  > `backend/src/main.ts` and nothing read `worker/src/main.ts`. Recorded as
  > [`DEF-001-001`](./defects/DEF-001-001-worker-observability-not-installed.md) and discharged by
  > `T660`/`T661` below. The warning above was correct and did its job.

---

## Phase 7: Convergence — `DEF-001-001`

*Appended by `/speckit-implement` on 2026-08-17 while executing `T165`. No existing task modified
except `T657`, whose completion claim was false. IDs continue from the **corpus** maximum (`T659`,
enumerated across all 28 `tasks.md` files) — not this epic's, which is the mistake that produced
conflict `C-27`.*

**The finding**: `T657` wired observability into `backend/src/main.ts` and not into
`worker/src/main.ts`, because `buildObservability` lived in `backend/src/core/observability/` and the
worker has no dependency on `@pmi/backend` — nor should it acquire one. PP-010 was therefore
satisfied in one of two long-running processes while `spec.md` claimed the platform. See
[`DEF-001-001`](./defects/DEF-001-001-worker-observability-not-installed.md) for the full record,
the four options considered, and why option **A** was taken.

- [X] T660 [P] Write failing unit tests asserting the worker bootstrap installs the observability bundle — that `worker/src/main.ts` builds it, emits `worker.started` through the structured logger rather than `console.log`, and records a terminal-state metric per job — in `worker/tests/unit/observability-installation.spec.ts` per PP-010, PC-3, SC-011
- [X] T661 Extract `logger.ts`, `correlation.ts`, `metrics.ts` and `bootstrap.ts` into `packages/observability`, depend on it from both `backend` and `worker`, and install the bundle in `worker/src/main.ts` and `worker/src/generation.consumer.ts` per PP-010 — unit test: T660

**Second finding, from the same pass** — `T166` looked for further instances of the DEF-001-001
shape and found one. `T164` says *"metrics emission for **API requests** and generation jobs"*;
`requestFinished` and `correlationFor` had zero production call sites, because nothing in the API
runs per request. See
[`DEF-001-002`](./defects/DEF-001-002-api-request-metrics-never-emitted.md).

- [X] T662 [P] Write failing unit tests asserting the HTTP interceptor adopts a valid inbound `x-correlation-id` and mints one otherwise, records `http.request` and `http.duration_ms` with a templated route and status, measures failed requests too, and is installed globally by `backend/src/main.ts`, in `backend/tests/unit/observability/http-interceptor.spec.ts` per PP-010, PC-3
- [X] T663 [US-] Implement `HttpObservabilityInterceptor` in `backend/src/modules/observability/http-observability.interceptor.ts` and install it in `backend/src/main.ts` — placed in `modules/` not `core/`, because PC-1 forbids `core/**` from importing HTTP types and an interceptor is transport (unit test: T662)
