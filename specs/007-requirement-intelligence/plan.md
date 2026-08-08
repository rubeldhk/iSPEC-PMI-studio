# Implementation Plan: Requirement Intelligence

**Epic**: `EPIC-007` | **Module**: M-03 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: 22 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

The requirement register — the head of the traceability chain. Structured records with history and
retirement, not a wall of prose. AI-assisted analysis (REG) is Phase 2 and explicitly out of scope.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-03.1 Requirement data model | 3 | `Requirement` + `RequirementVersion`, indexed for filtering |
| F-03.2 Validation rules | 1 | Refuse incomplete requirements, naming the field |
| F-03.3 Requirement register service | 1 | Create, edit, list, filter |
| F-03.4 Edit history | 2 | Append-only versions on edit |
| F-03.5 Retirement | 2 | Mark, never delete; derived artifacts stay traceable |
| F-03.6 Change detection | 2 | Content hashing, feeding out-of-date flagging |
| F-03.7 Requirement API | 3 | `/requirements` endpoints |
| F-03.8 Requirement interface | 4 | Register page with filters; editor with history |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**Content hashing (`T069`) is the seam to EPIC-008.** `FR-032` flags a specification out of date when
a source requirement changes; that detection needs a stable notion of "changed". `T068a` asserts the
hash moves on material edits and holds for incidental ones — get that wrong and either nothing is
ever flagged, or everything is.

**Retirement is not deletion** (`FR-006`). Anything already generated from a requirement stays
traceable to it, which is what makes EPIC-011's retired-link flagging (`T127`) meaningful.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-004 to FR-009 cite the Requirement Intake module via [platform-spec](../_shared/platform-spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 8 functions, 22 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 9 implementation tasks, 9 paired tests |
| VI | `specs/007-requirement-intelligence/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

**No gaps.** Eight functions, each with tests before implementation, a complete API surface
(`T070`), contract tests (`T063`), and both interface components paired (`T071`, `T072`).

One design observation: `F-03.6` (change detection) exists only to serve EPIC-008's `F-04.7`. It is
correctly placed here — the hash is a property of the requirement — but it is the one function in
this epic with no user-visible behaviour, so it will look unmotivated to anyone reading this epic
alone.

## Build order

```text
F-03.1 model ──► F-03.2 validation ──► F-03.3 service
                              ├─► F-03.4 edit history
                              ├─► F-03.5 retirement
                              └─► F-03.6 change detection ──► (EPIC-008 F-04.7)
F-03.7 API ──► F-03.8 interface
```

## Design notes specific to this epic

**Filtering is indexed, not scanned** (`T064`). Indexes on type, priority, and status exist because
`FR-008` is a list operation on a register that grows with the project, and `SC-009`'s 1-second p95
applies to listing views.

**A requirement with no description is refused, naming the field** (`T059`, `FR-007`) — not silently
saved as a draft.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 22 tasks complete, every unit test passing (Constitution V)
- [ ] Editing a requirement preserves the prior text as retrievable history
- [ ] Retiring a requirement keeps derived artifacts traceable
- [ ] Quickstart **V3** (requirement register) passes
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
