# Implementation Plan: Platform Foundation

**Epic**: `EPIC-001` | **Module**: M-00 | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Tasks**: 35 · [tasks.md](./tasks.md) | **Posture**: ▶ **PROCEEDING** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform plan](../_shared/plan.md) · [system-design](../_shared/system-design.md) ·
[schema](../_shared/schema.sql) · [research](../_shared/research.md) ·
[RAID](../_shared/raid-log.md))

## Summary

The machinery every other epic runs on. Nothing here is user-facing; everything here is depended
upon — which makes it the right place to start and the wrong place to be sloppy.

Four things get built: the monorepo and CI, the **error and failure taxonomy**, **generation job
orchestration**, and **observability**. The last two are where the engineering is.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-00.1 Monorepo and tooling | 8 | pnpm workspace, five packages, Vitest, dependency-boundary lint rule |
| F-00.2 Local services and CI | 3 | PostgreSQL 16 + Valkey 7, CI running unit/arch/contract |
| F-00.3 Error model and failure taxonomy | 4 | Typed errors, `{ error: { code, message, details } }`, the failure enum |
| F-00.4 Generation job orchestration | 8 | Job state machine, BullMQ queue, idempotency, cancellation, timeout, worker consumer |
| F-00.5 Observability | 8 | Structured logs, correlation propagation, sandbox correlation, metrics |

**Out of scope**: anything user-facing. This epic has no UI, no endpoints beyond health, and no
product behaviour.

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript 5.x on Node 22 LTS, NestJS,
Prisma, PostgreSQL 16, BullMQ on Valkey, OpenTelemetry + pino. Only what is specific to this epic
appears below.

**Concurrency model**: one BullMQ queue, bounded worker concurrency. Jobs are idempotent by
`job_key`, so a duplicate submission joins the existing job rather than starting a second.

**Job durability**: job state lives in PostgreSQL, not in Valkey. The queue is a delivery mechanism;
losing it must not lose job history. That is why `GenerationJob` is a table rather than a queue
record.

**No product entities**: this epic touches `GenerationJob` and the universal column convention only.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via [platform-spec](../_shared/platform-spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 5 functions, 35 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/001-platform-foundation/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS |
| — | Repository synced from GitHub before work | PASS |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); PP-010 satisfied here |
| — | Design constraints honoured (PC-1, PC-2) | PASS — no controllers in this epic; PC-2 caps land in EPIC-003 |

**Post-design re-check**: PASS. No gate weakened.

## The decision this plan must make

### The `GenerationJob → Project` seam ⚠ RESOLVE BEFORE T041

`GenerationJob` carries a foreign key to `Project`. `Project` belongs to **EPIC-006, which is held**
under D-10. Decision D-10 flagged this seam and left it to whoever started the slice — that is now.

**Decision: create a Project stub table in this epic.**

```text
projects (stub)
  id, workspace_id, name, owner_user_id, created_at
  -- no service, no validation, no controller, no behaviour
```

**Rationale**: the association "a job belongs to a project" is *structural*, not behavioural. No
Business Requirement Specification is going to remove it. What a BRS **will** settle is what a
project *does* — naming rules, archival semantics, templates, health dashboards — and none of that
is in the stub.

**Rejected**: deferring job persistence to an in-memory store. Purer, but it means writing the
persistence layer twice and testing the second version against tests written for the first. It also
makes the single-transaction guarantee in T045a untestable — and that is the guarantee that matters
most in this epic.

**Constraint accepted**: the stub is created by a migration owned by this epic and **must not grow**.
When EPIC-006 unfreezes it takes ownership and extends it. If a column is added to satisfy product
behaviour before then, the D-10 split has been violated.

## Design notes specific to this epic

**The failure taxonomy has no `unknown` member.** That is deliberate, and it is enforced by a
database CHECK constraint on `generation_jobs`: a terminal failure state without a named reason
cannot be stored. A generic error is a defect, not a fallback (FR-026, SC-005).

**Job state transitions are one-way into terminal states.** `queued → running → {succeeded, failed,
cancelled, timed_out}`. There is no retry transition in Phase 1 — a retry is a *new* job with a new
`job_key`. That keeps the audit trail honest about how many times an engine was actually invoked,
and therefore how much was spent (RAID R-02).

**Observability crosses the sandbox boundary asymmetrically.** The correlation identifier goes *in*
as an environment variable; telemetry does not come *out*. The worker records the job's spans and
metrics on the container's behalf. Widening the sandbox egress allow-list so the container could
emit its own telemetry would weaken ADR-0002 for marginal benefit. See
[`../_shared/system-design.md`](../_shared/system-design.md) PC-3 and research R-011.

**Two things must never be logged** — engine output (it may carry customer requirements) and any
credential. Asserted by T157, not left to code review.

## Build order

```text
F-00.1 monorepo ──► F-00.3 error taxonomy ──┬──► F-00.4 jobs ──► F-00.5 observability
       │                                     │
       └──► F-00.2 services + CI ────────────┘
```

F-00.4 additionally needs the workspace column convention from **EPIC-004 F-01.1** — see below.

## Cross-epic interleave ⚠

The split made dependencies look cleaner than they are. At function level the three proceeding
epics interleave:

| Order | Function | Epic | Needs |
|---|---|---|---|
| 1 | F-00.1, F-00.2, F-00.3 | EPIC-001 | — |
| 2 | F-01.1, F-01.2 | EPIC-004 | error taxonomy (F-00.3) |
| 3 | F-13.1 audit | EPIC-004 | workspace scoping (F-01.2) |
| 4 | **F-00.4 jobs** | **EPIC-001** | **workspace columns (F-01.1)**, audit (F-13.1) |
| 5 | F-00.5 observability | EPIC-001 | jobs (F-00.4) |
| 6 | F-08.1 – F-08.8 | EPIC-003 | jobs, failure taxonomy |

**Do not read this as "finish EPIC-001, then EPIC-004."** Steps 1–3 of this epic come first, then
EPIC-004 entirely, then steps 4–5 here.

## Phase 1 Outputs

This epic adds no new design artifacts — it implements the shared ones:

- [`../_shared/system-design.md`](../_shared/system-design.md) — job orchestration, PC-3 observability
- [`../_shared/schema.sql`](../_shared/schema.sql) — `generation_jobs`, universal columns, plus the
  Project stub decided above
- [`../_shared/research.md`](../_shared/research.md) — R-005 queue, R-006 sandbox, R-011 observability
- [`../_shared/quickstart.md`](../_shared/quickstart.md) — V5 failure handling, V11a observability

## Definition of done

- [ ] 35 tasks complete, every unit test passing (Constitution V)
- [ ] `pnpm test:unit`, `test:contract`, `test:arch` green in CI
- [ ] Quickstart **V5** — every failure reason distinct, no partial artifact stored — passes
- [ ] Quickstart **V11a** — one correlation identifier across four hops; no engine output or
      credential in logs — passes
- [ ] Project stub table exists and carries no behaviour
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
