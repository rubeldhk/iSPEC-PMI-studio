# Epic Specification: Product Structure & Traceability

**Epic**: `EPIC-022` | **Module**: M-04 | **Tasks**: 16

**Parent design**: [../017-enhancement-model/](../017-enhancement-model/) — spec, plan, research,
data model, contracts, quickstart. Requirements are defined **once** there; this epic declares which
it *owns*.

**Shared design**: [../_shared/](../_shared/) — platform architecture, schema, engine contract

**Created**: 2026-08-04 — split from EPIC-017 by ruling **D-18**

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0041**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

The standard shape of a specification PMI Studio produces, and the twelve-link chain from vision to operations that makes the product's artifacts a system rather than a pile of documents.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent spec](../017-enhancement-model/spec.md), which cites `SRS/enhancement_module/` behind every
requirement below. No requirement in this epic originates outside that table.

Authority is layered per **D-16**: the enhancement document governs the structure and traceability of
specifications PMI Studio *produces*; `PMI-DOC-000` governs this repository's own documents.

## Requirements owned

| Requirement |
|---|
| FR-ENH-020 the twenty-one-section structure for product outputs |
| FR-ENH-021 the twelve-link product traceability chain |
| FR-ENH-022 report the first missing link, never a silently shortened chain |

## User stories owned

- US5 — trace from vision to operations

## Success criteria owned

- SC-ENH-007 traverse from any operational artifact to its originating vision, or be told where the chain breaks
- SC-ENH-010 an author new to the organization produces a conforming specification unaided

## Depends on

- EPIC-011 — the link model this epic widens
- EPIC-019 — the organization tier
- EPIC-009 — the validation-finding shape reused by structure conformance

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **13** categories are not answered in this document, of which **10** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *Compliance*, *External deps*, *Edge cases*, *Constraints* — are answered up the chain from the [parent](../017-enhancement-model/spec.md) (via 2 levels of inheritance) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit — recorded against [EPIC-010](../010-specification-interface/spec.md)
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform baseline is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
enhancement-family register is in the [parent spec](../017-enhancement-model/spec.md). This epic
records only where it differs:

| Principle | Status in this epic |
|---|---|
| PP-004 End-to-End Traceability | ✅ **Satisfied here for the product.** Per **D-16** this does *not* settle repository traceability, which still awaits decision **D-2** |
| PP-015 Open Standards | ✅ Satisfied — acceptance criteria in Gherkin/EARS, both open notations |

## Notes

🔀 **Fold candidate.** This epic extends EPIC-011's link model rather than standing fully apart. The split recorded it as a candidate for folding into EPIC-011; it is kept separate while both are held and unimplemented, when folding is still cheap.

⚠️ **This epic breaks EPIC-011 `T077a` by design.** That test asserts `TraceabilityLink` permits only the two Phase 1 edge types, and fails the build the moment T301 widens the enumeration. **T302 updates it** — a planned task, not a runtime surprise.

**D-16 scope**: the twenty-one-section structure and twelve-link chain govern **product outputs only**. No existing repository specification becomes non-conformant.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/022-product-traceability/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] EPIC-011 `T077a` updated and green (T302)
- [x] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
