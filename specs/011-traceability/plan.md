# Implementation Plan: Traceability

**Epic**: `EPIC-011` | **Module**: M-04 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

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

The graph that makes the artifacts a system rather than a pile of documents: bidirectional traversal,
retired-requirement flagging, and coverage-gap reporting.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-04.12 Traceability link model and writing | 3 | `TraceabilityLink`, indexed both directions; links written at generation |
| F-04.13 Bidirectional traversal | 3 | Forward from a requirement, reverse from a task |
| F-04.14 Retired-requirement flagging | 2 | Retired links returned and marked, never omitted |
| F-04.15 Coverage reporting | 2 | Requirements with no specification; specifications with no tasks |
| F-04.16 Traceability API | 3 | Trace and coverage endpoints |
| F-04.17 Traceability interface | 2 | Traceability and coverage views |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**Links are indexed in both directions** (`T078`). Both traversals are first-class — `FR-030`
requires requirement→artifacts *and* task→requirements — and both must hold at `SC-009`'s 1-second
p95 with 500 specifications per project.

**⚠️ `T077a` will be superseded by EPIC-022.** It asserts `TraceabilityLink` permits **only the two
Phase 1 edge types**. EPIC-022 `T301` widens that enumeration to twelve chain types and **`T302`
updates this test**. The break is scheduled, not accidental — but it means `T077a` as written has a
known expiry.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-029 to FR-031 cite the Traceability Model section |
| III | Epic → Feature → Task decomposition | PASS — 6 functions, 19 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | ⚠️ **PASS with a cross-epic dependency** — see G-11.1 |
| VI | `specs/011-traceability/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL. Gate V is qualified and carried below.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-11.1 · `T081` cannot be verified from within this epic ⚠️ open, low impact

`T081` (traceability link creation on successful generation) pairs with unit test `T073`, which lives
in **EPIC-008**. The convention permits this and the README documents it — but this epic's exit
criterion says *"every implementation task in tasks.md has a passing unit test"*, and that cannot be
checked here in isolation. Recorded as **C5** in the 2026-08-03 analysis; unchanged.

### G-11.2 · `T077a` has a scheduled expiry ⚠️ known, handled

See Technical Context. EPIC-022 `T302` updates it. Noted so nobody "fixes" the widened enumeration
back to two types when the build goes red.

**Nothing else.** Full API surface (`T133`), contract tests (`T129`), interface paired (`T134`).

## Build order

```text
F-04.12 link model ──► F-04.13 traversal ──► F-04.14 retired flagging
                                    └─► F-04.15 coverage reporting
                                              └─► F-04.16 API ──► F-04.17 interface
```

## Design notes specific to this epic

**A retired requirement's links are returned and marked, never omitted** (`T127`, `FR-006`). Omitting
them would make a task appear to have no origin, which is worse than showing an origin that has been
retired.

**Coverage gaps are a report, not an error.** `FR-031` surfaces requirements with no specification so
someone can decide; nothing is auto-generated to close the gap.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 19 tasks complete, every unit test passing (Constitution V)
- [ ] Traversal works from both ends of the chain (`FR-030`)
- [ ] Every uncovered requirement is identifiable in a single view (`SC-010`)
- [ ] Quickstart **V9** (traceability both ways) passes
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
