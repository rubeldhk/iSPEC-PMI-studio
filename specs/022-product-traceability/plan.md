# Implementation Plan: Product Structure & Traceability

**Epic**: `EPIC-022` | **Module**: M-04 | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../017-enhancement-model/`](../017-enhancement-model/)
([plan](../017-enhancement-model/plan.md) · [research](../017-enhancement-model/research.md) ·
[data-model](../017-enhancement-model/data-model.md) ·
[contracts](../017-enhancement-model/contracts/) ·
[quickstart](../017-enhancement-model/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

## Summary

A versioned structure definition checked as a validation rule, and the twelve-link chain delivered by widening `TraceabilityLink` rather than adding a second link table.

The chain **is** derivation, extended — which is why it widens the existing table, the opposite conclusion to EPIC-020's separate `DependencyEdge`. The distinguishing test is not is-it-a-link but does-it-behave-like-derivation.

## Scope

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-17.9 Product specification structure | 4 | Versioned structure definition; conformance as findings |
| F-17.10 Product traceability chain | 8 | Twelve link types, bidirectional traversal, first-missing-link reporting |

**Excluded**: everything owned by the sibling epics of the split — see [../README.md](../README.md).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../017-enhancement-model/plan.md). Specific to this epic:

**The twenty-one sections are a validation rule, not a stored skeleton** (**R-017-6**). A skeleton makes every generated specification carry twenty-one headings whether or not they apply — which is how box-ticking documents get made.

**The chain widens `TraceabilityLink`** rather than adding a table (**R-017-7**). EPIC-011 already indexes it in both directions; a second table would split one traversal in two.

**NEEDS CLARIFICATION**: none.

## Constitution Check

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via the [parent spec](../017-enhancement-model/spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 2 functions, 16 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/022-product-traceability/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution`; stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 commits behind `origin/main`, 2026-08-04 |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md) |
| — | **D-16 honoured** — product scope only | PASS |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. PP-004 moves from partial to satisfied **for the product**; the repository half is explicitly out of scope by D-16 and still owed by D-2.

## Build order

```text
F-17.9 structure definition ──► conformance checking

F-17.10  T301 widen enumeration ──► T302 fix EPIC-011 T077a  ⚠️ build is red between
                                        └──► traversal ──► gap reporting ──► endpoints
```

## Design notes specific to this epic

**Chain links stay system-written and acyclic.** They are derivation. Dependency edges — user-maintained and cycle-checked — live in EPIC-020 and are a different thing.

**Traversal reports the first missing link type by name.** A silently shortened chain reads as a complete one, which is worse than an error.

**No quickstart scenario for the chain.** Most link types — code, tests, release, operations — belong to epics not yet built. A partial scenario would pass for the wrong reason.

## Definition of done

- [ ] 16 tasks complete, every unit test passing (Constitution V)
- [ ] EPIC-011 `T077a` updated to the twelve chain types and green
- [ ] Structure conformance reports a missing required section by name
- [ ] Chain traversal reports the first missing link type rather than a shortened chain
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
