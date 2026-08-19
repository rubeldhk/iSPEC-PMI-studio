# Implementation Plan: Specification Lifecycle & Versioning

**Epic**: `EPIC-009` | **Module**: M-04 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

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

The six-state lifecycle mandated by SRS module specification M08 §8, with immutable versions,
attributed transitions, version comparison, and engine-backed validation before approval.

This epic is the reason the 2026-08-07 clarification happened. `FR-011` promised the system would
refuse an invalid transition **naming the permitted ones**, and that set existed nowhere — finding
**A1**, which blocked `T106` and `T113` here and `T277` in EPIC-021. It is now enumerated: **eight
transitions across six endpoints**.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-04.8 Lifecycle state machine | 7 | Six states, eight transitions, guards, attributed transitions, baseline immutability |
| F-04.9 Versioning and comparison | 6 | Append-only versions on meaningful change, **enforced by a database trigger**; version diff |
| F-04.10 Lifecycle, versioning and validation APIs | 11 | Six transition endpoints, version endpoints, validation orchestration and findings |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**The permitted transition set is now fixed** (`FR-011`, clarified 2026-08-07):

| # | Transition | Endpoint |
|---|---|---|
| 1 | `draft → review` | `submit-for-review` |
| 2 | `review → approved` | `approve` |
| 3 | `review → draft` | `reject` |
| 4 | `approved → baselined` | `baseline` |
| 5 | `baselined → implemented` | `mark-implemented` |
| 6–8 | `approved` / `baselined` / `implemented → archived` | `archive` |

**Eight transitions, six endpoints** — `archive` serves three starting states, which is exactly why
`T106` (eight) and `T108`/`T113` (six) always looked contradictory and were not.

**`archived` is terminal**, and an approved specification may not return to `draft`. Correcting one
after approval is a new version (`FR-011a`), not a backward transition. A state machine that permits
`approved → draft` would silently make baseline immutability unenforceable.

**Validation findings are engine output**, not platform logic. `T121` orchestrates through the engine
contract; a finding without a location is malformed output, not a finding (`T117`).

**NEEDS CLARIFICATION**: none. Finding **A1** was resolved on 2026-08-07; zero markers remain in the spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via [platform-spec](../_shared/platform-spec.md); `FR-011` cites SRS M08 §8 |
| III | Epic → Feature → Task decomposition | PASS — 3 functions, 28 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 11 implementation tasks, 11 paired tests |
| VI | `specs/009-spec-lifecycle-versioning/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

Reviewing the 26 tasks against the spec surfaced **two** things, both consequences of the tasks
predating the 2026-08-07 clarification.

### G-09.1 · `T106` and `T108` must be checked against the now-enumerated set ⚠️ open

`T106` asserts "all eight permitted transitions"; `T108` covers "all six lifecycle transition
endpoints". Both were written before the set existed, so neither could name it. They are now
**checkable against the `FR-011` table** — and both need reading against it before implementation,
because "eight" and "six" were guesses that happen to be right rather than derived facts.

### G-09.2 · `T095` is labelled `[US4]` in an epic that owns US5 and US6 ⚠️ open, low impact

`T095` ("task generation is refused unless the specification is approved") is the approval-gate test
consumed by EPIC-012 `T101`. It sits here because the gate is a lifecycle concern, but its story
label points at a story this epic does not own. Harmless in execution; misleading in a coverage
report grouped by story.

**Nothing else.** Every implementation task pairs with a test, the API surface is complete
(`T113`, `T123`), and `FR-011a`/`FR-011b` both have dedicated tasks (`T099a`/`T099b`).

## Build order

```text
F-04.8  T095/T106 tests ──► T099 minimal machine (approved state, for M-06)
             └─► T099a/T099b baseline immutability + archive
             └─► T109 LifecycleTransition ──► T111 attribution

F-04.9  T105/T107 tests ──► T110 versioning ──► T112 comparison

F-04.10 T108/T119 contract tests ──► T113 six endpoints ──► T120/T121/T122 validation ──► T123
```

## Design notes specific to this epic

**`T099` ships the minimal machine, `T111` completes it.** EPIC-012 needs only the `approved`
state to gate task generation; attribution and the full guard set can follow. Splitting it this way
is what lets M-06 start before this epic finishes.

**Transitions are recorded, not inferred.** `LifecycleTransition` (`T109`) is a row per transition
with actor and time — `FR-014` cannot be satisfied by reading the current state and guessing how it
got there.

**Versions are append-only.** A new version on each meaningful change (`T110`), with prior versions
retrievable unaltered (`SC-007`). "Meaningful" is defined in the platform spec's Assumptions as a
change to content or lifecycle state, not incidental metadata.

**Approval surfaces outstanding findings before it proceeds** (`T122`, `FR-023`). It does not block
— EPIC-002's `FR-005a` later adds the override path for provisional content.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 28 tasks complete, every unit test passing (Constitution V)
- [ ] `T106` asserts exactly the eight transitions in the `FR-011` table, and refuses every other by name
- [ ] `T113` exposes exactly six endpoints, with `archive` serving three starting states
- [ ] An approved specification cannot return to `draft`; `archived` is terminal
- [ ] Quickstart **V6** (lifecycle and versioning) and **V7** (validation before approval) pass
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
