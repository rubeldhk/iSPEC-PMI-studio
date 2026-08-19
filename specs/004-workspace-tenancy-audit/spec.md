# Epic Specification: Workspace Tenancy & Audit

**Epic**: `EPIC-004` | **Module**: M-01 / M-13 | **Tasks**: 19

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING.** Buildable now — nothing here depends on the Business Requirement
> Specification.

## Purpose

The tenancy boundary and the audit trail. Multi-tenant-ready from the first migration on a single-user surface, with audit immutability enforced by the database rather than by convention.

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
| FR-002 every artifact carries a workspace; cross-workspace access refused |
| FR-003 project content scoped to its project · *co-owned* |
| FR-033 audit entry for every state-changing action and refused access |

## User stories owned

- US1 — workspace isolation portion

## Success criteria owned

- SC-004 zero artifacts visible across a workspace boundary
- SC-012 every state-changing action appears in the audit record

## Depends on

- EPIC-001 — error taxonomy

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-008 Security by Design | ⚠️ Partial — isolation and audit satisfied here; RBAC and SSO remain Phase 3 |

## Notes

Cross-workspace access returns **404, not 403** — existence is not disclosed. Audit tables reject UPDATE and DELETE at the database level, so an action cannot succeed without its audit entry.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/004-workspace-tenancy-audit/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
