# Epic Specification: Artifact Access Control

**Epic**: `EPIC-024` | **Module**: M-13 Security & Governance | **Tasks**: 21

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

Direct read and edit grants to named users on individual artifacts.

A deliberate, bounded advance on the SRS roadmap, which places governance in Phase 3. Roles,
groups, inherited organisational permissions and SSO stay there. What lands here is the minimum
that makes a shared review session safe — because a collaborative surface without access control
is a liability the moment a project holds anything commercially sensitive.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent design](../002-team-review-access-storage/spec.md), which cites every source behind the
requirements below. Authority is layered per decision **D-12**.

## Requirements owned

Requirements are defined once in the [parent design](../002-team-review-access-storage/spec.md);
this epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-021, FR-022 — grant and revoke read or edit access per artifact |
| FR-023, FR-024 — refuse and record; hide rather than show as inaccessible |
| FR-025 — a derived artifact is at least as restricted as its source |
| FR-026 — every grant and revocation audited |
| FR-027 — no artifact may reach a state with no user holding edit access |
| FR-028 — access evaluated against the grants in force when a run started |

## User stories owned

- US4 — control who can see and change each project artifact

## Success criteria owned

- SC-007 — zero artifacts visible to a user holding no grant; every refusal recorded
- SC-008 — zero artifacts can reach a state with no editor
- SC-013 — every grant, revocation and refusal appears in the audit record

## Depends on

- EPIC-004 — tenancy and audit, which these grants extend
- EPIC-008 — artifacts to grant access on
- **EPIC-023** — the `Run` model, which carries the `access_snapshot` column `T381` writes (FR-028).
  A run-start snapshot cannot be taken against a `Run` that does not exist

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **11** categories are not answered in this document, of which **8** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Reliability*, *External deps*, *Edge cases*, *Constraints* — are answered up the chain from the [parent](../002-team-review-access-storage/spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Performance* — **Outstanding** — recorded, not asked
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
epic-level register is in the [parent design](../002-team-review-access-storage/spec.md). This
epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-008 Security by Design | ✅ **Satisfied here.** Per-artifact grants, refusals recorded before the response is sent, derived artifacts inheriting restriction. RBAC and SSO remain Phase 3 |

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/024-artifact-access-control/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published (Constitution IX)
