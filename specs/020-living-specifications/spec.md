# Epic Specification: Living Specifications & Impact

**Epic**: `EPIC-020` | **Module**: M-04 | **Tasks**: 22

**Parent design**: [../017-enhancement-model/](../017-enhancement-model/) — spec, plan, research,
data model, contracts, quickstart. Requirements are defined **once** there; this epic declares which
it *owns*.

**Shared design**: [../_shared/](../_shared/) — platform architecture, schema, engine contract

**Created**: 2026-08-04 — split from EPIC-017 by ruling **D-18**

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0033**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Specifications that stay honest about their own currency, and a dependency graph that makes change safe. At 500 specifications per project, manual impact assessment stops working — and an unassessed change is how a specification estate silently decays.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent spec](../017-enhancement-model/spec.md), which cites `SRS/enhancement_module/` behind every
requirement below. No requirement in this epic originates outside that table.

Authority is layered per **D-16**: the enhancement document governs the structure and traceability of
specifications PMI Studio *produces*; `PMI-DOC-000` governs this repository's own documents.

## Requirements owned

| Requirement |
|---|
| FR-ENH-006 mark a specification not current when an upstream artifact changes |
| FR-ENH-007 reconcile a stale specification; baselines fork rather than alter |
| FR-ENH-008 dependencies as first-class directed relationships |
| FR-ENH-009 impact returns every direct and indirect dependent |
| FR-ENH-010 each dependent carries its path; bounded results say so |
| FR-ENH-011 cycles detected and refused, including multi-hop |

## User stories owned

- US2 — keep a specification alive
- US3 — see what a change will break

## Success criteria owned

- SC-ENH-002 every affected specification identified in a single request
- SC-ENH-003 impact results at 500 specifications per project without degradation
- SC-ENH-006 zero silently stale specifications
- SC-ENH-009 100% of cycles detected before storage, including multi-hop

## Depends on

- EPIC-019 — the organization tier
- EPIC-008 — specifications to mark stale
- EPIC-009 — baseline semantics, which reconciliation must not violate

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **11** categories are not answered in this document, of which **8** — *Out of Scope*, *Domain & Data*, *UX Flow*, *Performance*, *Reliability*, *Compliance*, *Edge cases*, *Constraints* — are answered up the chain from the [parent](../017-enhancement-model/spec.md) (via 2 levels of inheritance) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

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
| PP-002 Single Source of Truth | ✅ **Satisfied here** — living specifications exist precisely so a specification stops drifting from reality |
| PP-018 Scalability First | ⚠️ Partial — impact queries must hold at 500 specifications (SC-ENH-003); the source document states no scale target |

## Notes

**`currency_status` generalises FR-032, it does not duplicate it.** The platform already flags a specification out of date when a *source requirement* changes; this widens the trigger to any upstream artifact. **One field, wider trigger** — two independent staleness flags would eventually disagree.

**`DependencyEdge` is a separate table from `TraceabilityLink`** (**R-017-3**). Derivation is system-written, acyclic, immutable; dependency is user-maintained, cyclic-checked, mutable. Note EPIC-022 reaches the *opposite* conclusion for the twelve-link chain, and deliberately so.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/020-living-specifications/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
