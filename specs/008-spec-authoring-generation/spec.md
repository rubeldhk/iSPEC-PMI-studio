# Epic Specification: Specification Authoring & Generation

**Epic**: `EPIC-008` | **Module**: M-04 | **Tasks**: 23

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

Turning selected requirements into a stored, traceable specification through the engine contract — including the read surface and out-of-date detection.

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
| FR-010 each specification belongs to exactly one project |
| FR-012 view, edit, and list specifications · *co-owned* |
| FR-029 link each specification to its originating requirements · *co-owned* |
| FR-032 flag a specification out of date when a source requirement changes |

## User stories owned

- US3 — generate a specification from requirements

## Success criteria owned

- SC-002 zero orphaned specifications

## Depends on

- EPIC-003 — the engine; EPIC-007 — requirements to generate from

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

Specification, versions, traceability links, and the job's terminal state are written in **one transaction**, which is what makes SC-002 structurally true rather than defended by cleanup jobs.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/008-spec-authoring-generation/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
