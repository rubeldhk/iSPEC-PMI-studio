# Implementation Plan: Review Gates & Roles

**Epic**: `EPIC-021` | **Module**: M-04 | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Tasks**: 23 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../017-enhancement-model/`](../017-enhancement-model/)
([plan](../017-enhancement-model/plan.md) · [research](../017-enhancement-model/research.md) ·
[data-model](../017-enhancement-model/data-model.md) ·
[contracts](../017-enhancement-model/contracts/) ·
[quickstart](../017-enhancement-model/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

## Summary

Twelve reviewing roles, gates bound to lifecycle transitions, and an append-only record of what each role said and what a human decided.

Gate arbitration is a pure function — does this outcome permit advancement? — which is what makes SC-ENH-004 testable without invoking a model.

## Scope

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-17.11 Reviewing and authoring roles | 4 | Twelve roles; the `reviewSpecification` capability |
| F-17.7 Gate configuration | 4 | Gates on transitions; capability checking |
| F-17.8 Gate execution and human decision | 10 | Findings, arbitration, append-only outcomes, overrides |
| F-17.12 Cost re-scoring | 1 | RAID R-02 re-scored against the real invocation profile |

**Excluded**: everything owned by the sibling epics of the split — see [../README.md](../README.md).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../017-enhancement-model/plan.md). Specific to this epic:

**Roles execute as engine contract invocations against the single configured model**, one per role, **concurrently within a gate**, bounded by the platform's per-job caps (**R-017-4**). Role definitions live in configuration, not a registry — when M-07 lands, a registry replaces the configuration source behind the same boundary.

**Empty findings is a pass.** A deliberate divergence from the base contract's empty-output-is-failure rule, which exists for *generation* where an empty specification is meaningless. A review that finds nothing is legitimate and common — and the most likely thing to implement wrongly.

**NEEDS CLARIFICATION**: one, inherited — **A1**, the unenumerated set of permitted lifecycle transitions. It does not block Phase 0; it blocks full validation of T277.

## Constitution Check

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via the [parent spec](../017-enhancement-model/spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 4 functions, 23 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/021-review-gates-roles/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution`; stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 commits behind `origin/main`, 2026-08-04 |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md) |
| — | **D-16 honoured** — product scope only | PASS |

**Any FAIL blocks Phase 0.** No FAIL. One inherited open question (A1) recorded above and in [tasks.md](./tasks.md).

**Post-design re-check**: PASS. PP-003 and PP-016 are both *satisfied here for the platform*, not merely declared.

## Build order

```text
F-17.11 roles ──► F-17.7 gate configuration ──► F-17.8 gate execution
                                                      └──► F-17.12 R-02 re-score
                                                           (needs the real profile)
```

## Design notes specific to this epic

**Gate outcomes are append-only**, enforced in code and by database trigger, the way `audit_entries` already are. Editing one would destroy exactly the audit value that makes PP-016 true here rather than claimed.

**An unavailable role fails the gate.** Unavailability is a named outcome, never a silent pass. Skipping the reviewer that timed out is precisely how a governed action quietly becomes ungoverned.

**The platform echoes the role, not the adapter.** The platform knows which role it asked; trusting the adapter to report it would make attribution forgeable.

**An engine without `reviewSpecification` still registers.** Review is not a Phase 1 required capability, so FR-021 does not refuse it; a gate configured against such an engine fails at gate time with a named reason.

## Definition of done

- [ ] 23 tasks complete, every unit test passing (Constitution V)
- [ ] Quickstart **V17-7** and **V17-8** pass
- [ ] Conformance cases **C-17** to **C-20** green
- [ ] Database trigger rejects `UPDATE` and `DELETE` on `gate_outcomes`
- [ ] RAID **R-02** re-scored and recorded in `specs/_shared/raid-log.md`
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
