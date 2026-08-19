# Implementation Plan: QA & Validation

**Epic**: `EPIC-015` | **Module**: M-12 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

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

End-to-end validation, the nightly real-engine smoke test, and the performance and job-outcome
measurements that make `SC-009` and `SC-011` verifiable.

Small in task count and disproportionately important: this epic owns the two success criteria that
were unmeasurable until 2026-08-07.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-12.1 End-to-end validation | 1 | Playwright journey covering quickstart V1–V12 including V11a |
| F-12.2 Engine smoke and performance | 3 | Nightly real-engine test, scale check, job outcome-rate |
| F-12.3 Test completeness | 1 | Close every unit-test gap enumerated by per-epic converge |
| Phase Z Epic closure | 4 | Per-epic gate (Constitution IV, V, VI, IX) |

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**The real engine runs nightly, not per-commit** (`T146`). It is slow, costs money, and is
non-deterministic. Everything else runs against the fixture adapter — the property that makes
EPIC-003's fixture the backbone of the fast suite.

**`SC-009` and `SC-011` now have numbers** (clarified 2026-08-07): views under **1 second at p95**
with 500 specifications, and 95% of generation requests resolving within a **10-minute** wall-clock
limit. Before that clarification both criteria named a target that did not exist.

**NEEDS CLARIFICATION**: none.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | ⚠️ **Infrastructure epic** — owns no functional requirement, correctly. It owns two success criteria instead |
| III | Epic → Feature → Task decomposition | PASS — 3 functions, 9 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — every task here **is** a test |
| VI | `specs/015-qa-validation/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. No new design was produced, so no gate could be weakened by it.

## Review of the existing task list

### G-15.1 · `T147` and `T147a` predate the thresholds they assert ⚠️ open

`T147` reads *"Add performance check for 500 specifications per project"* — with **no threshold**,
because none existed when it was written. `T147a` asserts `SC-011` similarly.

Both are now assertable: **p95 < 1s** for listing, search, and traceability views (`SC-009`), and
**10 minutes** wall-clock (`SC-011`, `FR-025`). **Both task descriptions should carry the numbers**,
or the tests will be written against whatever the implementer assumes.

This is the most actionable finding of the eleven plans: two tests that would otherwise measure
nothing in particular.

### G-15.2 · `T148` depends on records that do not exist yet — by design

Rewritten on 2026-08-03 from an unbounded *"fill remaining unit-test gaps"* to *"close every gap
enumerated by the per-epic converge runs (`T154`)"*. That makes it completable — but only after
fifteen epics have converged. Correct sequencing, worth stating so it is not started early.

## Build order

```text
F-12.1  T145 end-to-end journey        (needs the product surface built)
F-12.2  T146 nightly smoke · T147 scale · T147a outcome rate
F-12.3  T148 close enumerated gaps     (last — needs T154 per-epic converge records)
```

## Design notes specific to this epic

**Scale and outcome-rate are integration tests, not unit tests.** `SC-009` is a claim about what the
database returns under a real query at volume; a mocked repository would pass while the real one
degrades — the same argument EPIC-004 made for `T052`.

**`T145` covers V11a observability**, which exists because decision D-7 adopted PP-010 into the
proceeding slice. An end-to-end journey that does not check the correlation identifier would let the
one cross-boundary signal rot unnoticed.

## Phase 0 / Phase 1 outputs

**None.** Every technical question this epic raises was answered when `_shared/research.md`,
`data-model.md`, `schema.sql`, and `contracts/` were written. Generating a per-epic `research.md`
recording "no decisions" would be an artifact pretending to be work — the same judgement EPIC-016's
plan made.

## Definition of done

- [ ] 9 tasks complete, every test passing
- [ ] **G-15.1 closed** — `T147` asserts p95 < 1s at 500 specifications; `T147a` asserts the 10-minute limit
- [ ] Nightly real-engine smoke test green at least once (quickstart **V13**)
- [ ] Zero unit-test gaps remain across all epics (`T148`)
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
