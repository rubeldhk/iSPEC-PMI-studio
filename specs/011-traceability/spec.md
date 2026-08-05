# Epic Specification: Traceability

**Epic**: `EPIC-011` | **Module**: M-04 | **Tasks**: 19

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

The graph that makes the artifacts a system rather than a pile of documents: bidirectional traversal, retired-requirement flagging, and coverage-gap reporting.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[platform product specification](../_shared/platform-spec.md), which cites every source document
behind the requirements below. No requirement in this epic originates outside that table.

Authority is layered per decision **D-12**: the MPS governs product content, PMI-DOC-000 governs
documentation standards, PMI-DOC-003 governs principles.

## Requirements owned

Requirements are defined once in the [parent product spec](../_shared/platform-spec.md); this
epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-029 link specifications to requirements and tasks to specifications · *co-owned* |
| FR-030 traverse traceability in both directions |
| FR-031 report coverage gaps |

## User stories owned

- US7 — trace any artifact back to its origin

## Success criteria owned

- SC-002 no orphaned specifications
- SC-003 every task resolves back to a requirement
- SC-010 uncovered requirements visible in a single view

## Depends on

- EPIC-008 — links are written at generation time

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-004 End-to-End Traceability | ⚠️ Partial — requirement → spec → task delivered here. Code, test, and release links await decision D-2 |

## Notes

Links are stored as rows and indexed in **both** directions, because both traversals are first-class and must stay fast at 500 specifications per project.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/011-traceability/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
