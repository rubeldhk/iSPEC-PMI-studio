# Epic Specification: Specification Interface

**Epic**: `EPIC-010` | **Module**: M-04 | **Tasks**: 14

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

The web surface for specifications: list and detail views, job progress, version history and comparison, lifecycle controls, and the validation findings panel.

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
| FR-012 view and list specifications · *co-owned* |
| FR-028 the interface stays usable while a generation job runs · *co-owned* |

## User stories owned

- US3, US5, US6 — interface portions

## Success criteria owned

- SC-001 sign-in to a generated specification in under 15 minutes

## Depends on

- EPIC-008, EPIC-009 — the API surface these views consume

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

No component library is chosen. SRS Volume 8 defines a design system that does not exist yet; picking one now would pre-empt it.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/010-specification-interface/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
