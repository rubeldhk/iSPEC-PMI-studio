# Implementation Plan: Living Specifications & Impact

**Epic**: `EPIC-020` | **Module**: M-04 | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../017-enhancement-model/`](../017-enhancement-model/)
([plan](../017-enhancement-model/plan.md) · [research](../017-enhancement-model/research.md) ·
[data-model](../017-enhancement-model/data-model.md) ·
[contracts](../017-enhancement-model/contracts/) ·
[quickstart](../017-enhancement-model/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

## Summary

A dependency graph, impact analysis over it, and specification currency driven by both.

The dependency graph is built **first**: what-changed-upstream is a question about the graph, and building currency detection first means inventing a second, weaker traversal and then deleting it.

## Scope

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-17.5 Dependency graph | 6 | `DependencyEdge`, multi-hop cycle detection, the service |
| F-17.6 Impact analysis | 6 | Recursive traversal, paths, bounded results, endpoints |
| F-17.4 Living specification currency | 6 | Stale marking, reconciliation, baseline-safe forking |

**Excluded**: everything owned by the sibling epics of the split — see [../README.md](../README.md).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../017-enhancement-model/plan.md). Specific to this epic:

**Impact analysis is a recursive database query with a depth bound**, not a materialised closure table (**R-017-5**). The write path for edges is user-driven and low-volume; a closure table would trade that for write amplification on every edge change. Revisit only if measurement shows SC-ENH-003 missed.

**Cycle detection and impact path construction are pure functions** — unit-testable with no database. The recursive query itself needs Testcontainers.

**NEEDS CLARIFICATION**: none.

## Constitution Check

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via the [parent spec](../017-enhancement-model/spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 3 functions, 22 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/020-living-specifications/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution`; stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 commits behind `origin/main`, 2026-08-04 |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md) |
| — | **D-16 honoured** — product scope only | PASS |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. Constitution V is *strengthened* — cycle detection and path construction are pure, so the hardest logic in the epic is testable without infrastructure.

## Build order

```text
F-17.5 dependency graph ──► F-17.6 impact analysis
        └──────────────────► F-17.4 living specifications
                              (needs edges to know what changed upstream)
```

## Design notes specific to this epic

**A bounded impact result announces itself.** An unbounded traversal on a dense graph is a denial of service against the user's own project; a silently truncated one is worse, because it reads as completeness.

**Reconciling a baselined specification forks a new draft.** The baseline stays retrievable and unaltered — FR-011a is not weakened by staleness.

**Staleness renders on the specification itself**, not only in a report. A staleness report nobody opens is not a signal.

## Definition of done

- [ ] 22 tasks complete, every unit test passing (Constitution V)
- [ ] Quickstart **V17-4**, **V17-5**, **V17-6** pass
- [ ] Integration test T261 green against a **real** PostgreSQL via Testcontainers
- [ ] Multi-hop cycles refused before storage, not after
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
