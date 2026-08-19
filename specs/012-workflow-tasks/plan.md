# Implementation Plan: Workflow & Tasks

**Epic**: `EPIC-012` | **Module**: M-06 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

Task generation from approved specifications, status tracking, and regeneration — completing the
Requirement → Specification → Task lifecycle the SRS defines.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-06.1 Task generation | 3 | `Task` model, generation through the contract, approval gate |
| F-06.2 Status and progress | 2 | Status transitions, project progress aggregation |
| F-06.3 Regeneration | 2 | Warn before replacing existing tasks |
| F-06.4 Task API | 3 | Contract tests, controller unit tests, tasks controller |
| F-06.5 Task interface | 2 | Task list and progress view |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**Task generation is gated on approval** (`FR-020`). `T101` pairs with `T095`, which lives in
**EPIC-009** — the gate is a lifecycle concern, so its test belongs with the lifecycle. Same
cross-epic pattern as EPIC-011's `T081`.

**Regeneration warns before it replaces** (`T097`, `FR-020` acceptance scenario 4). Silently
replacing a task list someone has been working from is the failure this task exists to prevent.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-020 cites the Task Management module |
| III | Epic → Feature → Task decomposition | PASS — 5 functions, 16 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps after the 2026-08-03 remediation |
| VI | `specs/012-workflow-tasks/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-12.1 · The controller gap — ✅ closed 2026-08-03

`F-06.4` originally contained **only** `T098`, a contract test for task endpoints that no task
implemented. Found as **G1**, the one CRITICAL of that analysis pass, and closed by adding `T098a`
(controller unit tests) and `T102a` (the tasks controller itself).

That finding is why every subsequent plan in this series reviews the API surface explicitly — it is
also how EPIC-002's much larger version of the same gap was later caught.

**Nothing open.** All five implementation tasks pair with tests; the API surface is complete.

## Build order

```text
F-06.1  T096 test ──► T100 model ──► T101 generation (gate test T095 in EPIC-009)
F-06.2  T101a ──► T102 status and progress
F-06.3  T097 ──► T103 regeneration warning
F-06.4  T098 contract + T098a unit ──► T102a controller
F-06.5  T103a ──► T104 task list view
```

## Design notes specific to this epic

**Task status is minimal in Phase 1** — not started / in progress / done, per the platform spec's
Assumptions. Richer workflow states arrive with the Phase 2 workflow engine, and adding them here
would pre-empt a module that does not exist.

**Every task resolves back through its specification to a requirement** (`T096`, `SC-003`). That
assertion is what makes the three-link chain real rather than nominal.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 16 tasks complete, every unit test passing (Constitution V)
- [ ] Task generation is refused on an unapproved specification, stating that approval is required
- [ ] Regeneration warns before replacing existing tasks
- [ ] Quickstart **V8** (generate tasks) passes
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
