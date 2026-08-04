# Epic Specification: Identity & Sign-in

**Epic**: `EPIC-005` | **Module**: M-01 | **Tasks**: 11

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

Session-based sign-in behind an identity-provider boundary, plus the web client that consumes it. Deliberately minimal — the boundary exists so Phase 3 SSO replaces an adapter rather than the request pipeline.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[platform product specification](../_shared/platform-spec.md), which cites every source document
behind the requirements below. No requirement in this epic originates outside that table.

Authority is layered per decision **D-12**: the MPS governs product content, PMI-DOC-000 governs
documentation standards, PMI-DOC-003 governs principles.

## Requirements owned

Requirements are defined once in the [parent product spec](../_shared/platform-spec.md); this
epic **owns** the following and is where they are satisfied:

*None directly.* This epic delivers infrastructure or governance rather than a numbered
functional requirement. See Purpose and Exit Criteria.

## User stories owned

- US1 — sign-in portion

## Success criteria owned

- SC-001 contributes to the sign-in-to-specification journey

## Depends on

- EPIC-004 — workspace and user data foundation

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

⚠️ **No functional requirement covers sign-in.** It derives from the clarification *"basic sign-in"*, not from an SRS requirement. `PMI-DOC-004` should establish one — this epic is a candidate for early rework when the BRS lands.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/005-identity-signin/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
