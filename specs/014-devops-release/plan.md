# Implementation Plan: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: 17 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

Developer enablement and the **platform release gate** — the two-stage closure structure that
ruling **C1** created on 2026-08-03.

This epic no longer performs per-epic closure. Each epic discharges its own `Phase Z` and writes
`closure.md`; `F-11.2` here **confirms** those records and adds what no single epic can.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-11.1 Developer enablement | 3 | Seed script, `README.md`, and their checks |
| F-11.2 Platform release gate | 10 | Confirm 15 closure records, architecture and security reviews, quickstart, SRS back-fill, promotion |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**This epic is the closure gate and is itself held.** That was the C1 problem: the proceeding slice
had no reachable exit while twelve epics waited on the BRS. Resolved by splitting per-epic closure
out — an epic now reaches *release-eligible* alone, and only **platform promotion** waits here.

**`T151`/`T154`/`T155` confirm, they do not re-run.** Each reads the fifteen `closure.md` records.
Repeating the per-epic checks here would recreate the bottleneck the split removed.

**Two MPS quality gates land here**: architecture review (`T152a`) and security review (`T152b`),
discharging PMI-TASK-001 T-306.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | ⚠️ **Infrastructure epic** — owns no functional requirement; that is correct, not a debt. It discharges Constitution IV/VII rather than an FR |
| III | Epic → Feature → Task decomposition | PASS — 2 functions, 17 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | ⚠️ **PASS under the v1.2.0 reading** — see G-14.1 |
| VI | `specs/014-devops-release/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL. Gate V's basis changed on 2026-08-05 and is recorded below.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-14.1 · `T149` and `T150` produce non-code outputs — resolved by constitution v1.2.0

`T149` (seed script) gained a paired unit test `T149a` in the 2026-08-03 remediation. `T150` produces
`README.md` — a document. Under constitution **v1.2.0** (2026-08-05), a non-code output is satisfied
by an **executable conformance check**, not a unit test.

`T150` currently has neither. ⚠️ **Open**: it needs a check asserting the README matches
`_shared/quickstart.md`, or it is the one task in this epic that fails Principle V as amended.

### G-14.2 · `T153` covers V1–V12 and V14 — ✅ current

Updated on 2026-08-05 when EPIC-016's `T143c` added quickstart **V14** for ADRs. Without that update
the release gate would have passed without ever exercising `FR-034`.

⚠️ **This will need updating again** whenever any epic adds a quickstart scenario. Nothing enforces
it — the numbering lives in `_shared/quickstart.md` and the gate that runs it lives here.

## Build order

```text
F-11.1  T149a check ──► T149 seed ──► T150 README

F-11.2  (all fifteen epics closed first)
        T151 unit-test records ──► T154 converge records ──► T155 defect records
        T151a principle baseline · T152 test:arch · T152a arch review · T152b security review
        T153 quickstart V1–V12 + V14 · T155a SRS back-fill
                        └─► T156 promote local → dev → stage → prod
```

## Design notes specific to this epic

**Confirmation, not repetition.** The gate reads records. An epic that has not written `closure.md`
is not ready, and the gate says so rather than doing the epic's work for it.

**`T156` is the only task in the programme that promotes anything.** Constitution VII's one-way
pipeline has exactly one entry point, and this is it.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 17 tasks complete (Constitution V, as amended by v1.2.0)
- [ ] **G-14.1 closed** — `T150` has an executable conformance check
- [ ] All fifteen `closure.md` records present and clean
- [ ] Architecture and security reviews held and recorded
- [ ] Promotion follows `local → dev → stage → prod` with no environment skipped
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
