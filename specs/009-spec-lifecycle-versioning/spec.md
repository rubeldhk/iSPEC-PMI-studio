# Epic Specification: Specification Lifecycle & Versioning

**Epic**: `EPIC-009` | **Module**: M-04 | **Tasks**: 26

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

The six-state lifecycle mandated by SRS module specification M08 §8, with immutable versions, attributed transitions, comparison, and engine-backed validation before approval.

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
| FR-011 six-state lifecycle `draft → review → approved → baselined → implemented → archived` |
| FR-011a baselined specifications are immutable; edits fork a new draft |
| FR-011b archival retains the specification and its traceability links |
| FR-013 a new version on each meaningful change; prior versions unaltered |
| FR-014 record who transitioned and when |
| FR-015 compare any two versions |
| FR-023 validation findings identify their location · *co-owned* |

## User stories owned

- US5 — lifecycle with version history
- US6 — validate before approving

## Success criteria owned

- SC-007 complete version history; any prior version retrievable unchanged

## Depends on

- EPIC-008 — specifications to move through the lifecycle

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-012 Everything Versioned | ✅ Satisfied here — versions are append-only and database-enforced |

## Notes

Adopted by decision **D-14** after the MPS drop replaced the original three-state model. Corrected while this epic was held, so no migration was required.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/009-spec-lifecycle-versioning/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
