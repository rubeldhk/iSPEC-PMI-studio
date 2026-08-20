# Epic Specification: Architecture Decision Records

**Epic**: `EPIC-016` | **Module**: M-13 | **Tasks**: 12

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0100**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

ADRs as a product feature: recorded against a project and linked to the specifications they affect.

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
| FR-034 record architecture decisions and link them to specifications |

## User stories owned

*None* — no user-facing behaviour originates here.

## Success criteria owned

*None directly.*

## Depends on

- EPIC-006 — projects; EPIC-008 — specifications to link to

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **14** categories are not answered in this document, of which **11** — *Out of Scope*, *Domain & Data*, *Lifecycle / States*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *External deps*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../_shared/platform-spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit — recorded against [EPIC-010](../010-specification-interface/spec.md)
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

Distinct from the programme's **own** ADR record in [`adr/`](../../adr/), which already exists (decision D-11). This epic builds the feature; that directory is how the programme governs itself.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/016-architecture-decision-records/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
