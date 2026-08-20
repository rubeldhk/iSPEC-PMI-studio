# Epic Specification: Specification Interface

**Epic**: `EPIC-010` | **Module**: M-04 | **Tasks**: 19

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0032**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

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

## Clarifications

### Session 2026-08-19

- Q: What accessibility standard should the web interface be held to when its acceptance criteria are written? → A: **WCAG 2.2 Level AA.** Automated checks run in CI; a manual keyboard and screen-reader pass is required at Epic exit. Chosen because no document in the programme — this Epic, its siblings, or the parent — named a target, so every interface task would otherwise have picked its own bar or none. 2.2 over 2.1 because it is the current statutory reference, and both are testable by tooling rather than by opinion, which is what lets a gate read the result instead of a person asserting it.

Scanned against the twenty-category ambiguity taxonomy. **12** categories are not answered in this document, of which **9** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../_shared/platform-spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

*No deltas.* This epic inherits the platform register unchanged.

## Notes

No component library is chosen. SRS Volume 8 defines a design system that does not exist yet; picking one now would pre-empt it.

**Accessibility target: WCAG 2.2 Level AA** *(clarified 2026-08-19)*. Automated checks run in CI; a
manual keyboard and screen-reader pass is required at Epic exit. This Epic owns the target for the
platform — no document above it names one, so the interface Epic is where it is set rather than
inherited. A component library chosen later must meet it; it does not get to redefine it.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/010-specification-interface/defects/` contains no open defect records
- [ ] **WCAG 2.2 Level AA**: automated checks pass in CI, and the manual keyboard and screen-reader pass is recorded *(clarified 2026-08-19)*
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
