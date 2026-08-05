---

description: "Task list for EPIC-001 — Platform Foundation"
---

# Tasks: Platform Foundation

**Epic**: `EPIC-001` | **Module**: M-00 | **Tasks**: 35

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
- [X] T004 [P] Scaffold BullMQ worker package in `worker/src/main.ts`
- [X] T005 [P] Scaffold engine contract package in `packages/engine-contract/src/index.ts`
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

- [ ] T165 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/001-platform-foundation/closure.md`
- [ ] T166 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/001-platform-foundation/closure.md`
- [ ] T167 Triage `specs/001-platform-foundation/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/001-platform-foundation/closure.md`
- [ ] T168 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/001-platform-foundation/closure.md`
