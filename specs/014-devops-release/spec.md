# Epic Specification: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Tasks**: 17

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

Developer enablement and the mandatory Epic closure gate — including the architecture and security reviews the MPS quality gates require, and the promotion pipeline.

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

*None* — no user-facing behaviour originates here.

## Success criteria owned

*None directly.*

## Depends on

- **Every other epic, including EPIC-015** — this is the final closure gate and runs last
- The dependency is one-way: QA validates the product epics, then DevOps closes and promotes

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

Closure now includes the **architecture review (T152a)** and **security review (T152b)** required by MPS Volume 6 §8, discharging PMI-TASK-001 T-306. Promotion follows `local → dev → stage → prod` with no environment skipped (Constitution VII).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/014-devops-release/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] **This epic owns the platform release gate** (F-11.2): all 15 `closure.md` records confirmed, then promotion `local → dev → stage → prod` with no skipped environment
