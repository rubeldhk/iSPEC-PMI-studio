# Implementation Plan: Steering Engine

**Epic**: `EPIC-019` | **Module**: M-01 / M-04 | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../017-enhancement-model/`](../017-enhancement-model/)
([plan](../017-enhancement-model/plan.md) · [research](../017-enhancement-model/research.md) ·
[data-model](../017-enhancement-model/data-model.md) ·
[contracts](../017-enhancement-model/contracts/) ·
[quickstart](../017-enhancement-model/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

## Summary

The organization tier, the four-scope hierarchy, versioned steering content, and the provenance record that makes SC-ENH-001 checkable rather than asserted.

Small in task count, disproportionately sequenced: it changes the tenancy model, and that is cheap exactly once.

## Scope

| Function | Est. tasks | What it delivers |
|---|---|---|
| F-17.1 Steering scopes and hierarchy | 6 | Organization tier; four-scope inheritance |
| F-17.2 Steering content, versioning and API | 8 | Create, edit, version, retire; the ten subjects; endpoints |
| F-17.3 Steering application, provenance and engine contract | 8 | Resolution, override records, provenance stamping, the `steering` contract field, conformance cases C-14 to C-16 |

**Excluded**: everything owned by the sibling epics of the split — see [../README.md](../README.md).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../017-enhancement-model/plan.md). Specific to this epic:

**The tenancy model grows a level.** `organization_id` on `workspaces` only; every artifact reaches its organization by one join (**R-017-1**).

**Steering must not become a prompt.** The contract carries `SteeringInput[]` as plain data, pre-resolved and ordered broadest-to-narrowest, so an adapter that concatenates gets precedence right without understanding the hierarchy (**R-017-2**, [steering-contract](../017-enhancement-model/contracts/steering-contract.md)).

**Resolution is a pure function** — testable with no database and no model.

**NEEDS CLARIFICATION**: none.

## Constitution Check

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via the [parent spec](../017-enhancement-model/spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 3 functions, 27 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/019-steering-engine/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution`; stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 commits behind `origin/main`, 2026-08-04 |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md) |
| — | **D-16 honoured** — product scope only | PASS |

**Any FAIL blocks Phase 0.** No FAIL.

**Post-design re-check**: PASS. PP-006 is *strengthened* — steering gains an explicit contract boundary at the place it was most likely to erode.

## Build order

```text
F-17.1 scopes + organization tier
   └─► F-17.2 content, versioning, API
          └─► F-17.3 resolution ──► provenance ──► engine contract ──► conformance
```

## Design notes specific to this epic

**Provenance is stamped at application time, never recomputed.** Recomputing returns *current* steering, not the steering that applied — the difference between provenance and a guess.

**An artifact generated with no steering gets an empty provenance record, not a missing row.** That distinction is exactly what makes SC-ENH-001's zero-unknown-provenance target checkable.

**A steering violation is a finding, not a failure.** A specification that violates a standard is still a specification; the finding is what makes the violation actionable.

## Definition of done

- [ ] 27 tasks complete, every unit test passing (Constitution V)
- [ ] Quickstart **V17-1**, **V17-2**, **V17-3** pass
- [ ] Conformance cases **C-14** to **C-16** green against the fixture and Spec Kit adapters
- [ ] `pnpm test:arch` green — no engine-specific reference introduced by steering
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
