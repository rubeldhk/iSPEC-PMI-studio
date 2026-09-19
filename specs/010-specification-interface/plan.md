# Implementation Plan: Specification Interface

**Epic**: `EPIC-010` | **Module**: M-04 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ▶ **PROCEEDING** (released 2026-08-20 by PMI-DOC-004 v1.0; see [spec.md](./spec.md))

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.

## Summary

The web surface for specifications: list and detail views, job progress, version history and
comparison, lifecycle controls, and the validation findings panel — plus the SC-001 journey
measurement this epic owns.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-04.11 Specification interface | 14 | List, detail, job progress, version history, diff, lifecycle controls, findings panel |
| F-04.18 SC-001 journey measurement | 1 | The 15-minute sign-in-to-specification timing run |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**No component library is chosen**, deliberately. SRS Volume 8 defines a design system that does not
exist yet; picking one now would pre-empt it. Every task here specifies behaviour, not appearance.

**Job progress must not block the rest of the UI** (`T085`, `FR-028`). Generation is asynchronous
because an external engine cannot be assumed to return promptly — a modal spinner would undo that.

**Lifecycle controls offer only permitted transitions** (`T115a`). With `FR-011`'s set now enumerated
(2026-08-07), this component has a defined list to render rather than an inferred one.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — FR-012 and FR-028 co-owned; cited via [platform-spec](../_shared/platform-spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 2 functions, 19 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps; 7 implementation tasks, 7 paired component tests |
| VI | `specs/010-specification-interface/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-10.1 · `T124a` measures SC-001 but the criterion moved ⚠️ open, low impact

`T124a` was added on 2026-08-03 to close finding **G2** — this epic owns `SC-001` but had no task
measuring it. That is now correct. What changed since: `SC-009` and `SC-011` were quantified on
2026-08-07, and `SC-001`'s 15-minute target was **not** — it was already numeric. So `T124a` stands
as written.

Recorded here only because a reader comparing the three timing criteria will notice two were
clarified and one was not, and might assume an omission.

**Nothing else.** Every component has a paired test. There are no contract tests, correctly — this
epic exposes no API.

## Build order

```text
F-04.11  T083c/T083d list ──► T083e/T084 detail ──► T084a/T085 job progress
                        ├─► T113a/T114 version history ──► T114a/T115 diff
                        ├─► T115a/T116 lifecycle controls   (needs EPIC-009 endpoints)
                        └─► T123a/T124 findings panel
F-04.18  T124a SC-001 timing   (last — needs the whole journey)
```

## Design notes specific to this epic

**The specification view shows engine, version, and out-of-date state** (`T084`). Provenance that is
stored but never displayed satisfies `FR-022` and fails the user.

**Invalid transitions are not offered**, and the permitted set is shown (`T115a`). Disabling a button
without saying why is how users conclude software is broken.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 19 tasks complete, every component test passing (Constitution V)
- [ ] The UI stays usable while a generation job runs (`FR-028`)
- [ ] `T124a` records the SC-001 journey in under 15 minutes
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
