# Epic Specification: QA & Validation

**Epic**: `EPIC-015` | **Module**: M-12 | **Tasks**: 9

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

End-to-end validation, the nightly real-engine smoke test, performance and job-outcome-rate measurement, and closing remaining unit-test gaps.

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

- SC-009 500 specifications per project without degradation
- SC-011 95% of generation requests complete or report a named failure within the limit

## Depends on

- EPIC-005, EPIC-006, EPIC-007, EPIC-008, EPIC-009, EPIC-010, EPIC-011, EPIC-012, EPIC-013,
  EPIC-016, EPIC-019, EPIC-020, EPIC-021, EPIC-022 — the product epics validation runs against
- **Deliberately NOT EPIC-014.** DevOps & Release closes *after* QA reports. Declaring a mutual
  dependency made both epics unschedulable (analyze finding F1, 2026-08-04)

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

The real-engine smoke test runs **nightly, not per-commit** — it is slow, costs money, and is non-deterministic. Everything else runs against the fixture adapter.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/015-qa-validation/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
