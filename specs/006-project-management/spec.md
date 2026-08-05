# Epic Specification: Project Management

**Epic**: `EPIC-006` | **Module**: M-02 | **Tasks**: 13

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

Projects as the container every other artifact belongs to: create, view, rename, archive, with content preserved intact through archival.

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
| FR-001 create, view, rename, and archive projects |
| FR-003 project content scoped with no cross-project leakage · *co-owned* |

## User stories owned

- US1 — set up a workspace and project

## Success criteria owned

- SC-004 workspace isolation

## Depends on

- EPIC-004 — tenancy; EPIC-005 — an authenticated actor

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

`GenerationJob` carries a foreign key to `Project`, so EPIC-001 needs either a Project stub table or deferred job persistence while this epic is held — see the D-10 seam in [srs-alignment.md](../srs-alignment.md).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/006-project-management/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
