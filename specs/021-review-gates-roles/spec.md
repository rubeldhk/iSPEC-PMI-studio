# Epic Specification: Review Gates & Roles

**Epic**: `EPIC-021` | **Module**: M-04 | **Tasks**: 23

**Parent design**: [../017-enhancement-model/](../017-enhancement-model/) — spec, plan, research,
data model, contracts, quickstart. Requirements are defined **once** there; this epic declares which
it *owns*.

**Shared design**: [../_shared/](../_shared/) — platform architecture, schema, engine contract

**Created**: 2026-08-04 — split from EPIC-017 by ruling **D-18**

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0003, BR-0060**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Designated roles examine a specification and record findings; a human then decides with those findings in front of them. The roles advise; the human decides. This is where human approval for governed actions becomes mechanism rather than intention.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent spec](../017-enhancement-model/spec.md), which cites `SRS/enhancement_module/` behind every
requirement below. No requirement in this epic originates outside that table.

Authority is layered per **D-16**: the enhancement document governs the structure and traceability of
specifications PMI Studio *produces*; `PMI-DOC-000` governs this repository's own documents.

## Requirements owned

| Requirement |
|---|
| FR-ENH-012 review gates configurable on lifecycle transitions |
| FR-ENH-013 findings identify their location and the role that raised them |
| FR-ENH-014 an explicit human decision is required to advance |
| FR-ENH-015 every gate outcome recorded, including overrides |
| FR-ENH-016 an unavailable or malformed role fails the gate |
| FR-ENH-023 the twelve reviewing and authoring roles |
| FR-ENH-024 record which role produced or reviewed every artifact |

## User stories owned

- US4 — gate a specification behind review

## Success criteria owned

- SC-ENH-004 100% of gated transitions carry a recorded human decision
- SC-ENH-005 every finding attributed to a role and a location

## Depends on

- EPIC-019 — the organization tier
- EPIC-009 — the six-state lifecycle these gates bind to
- EPIC-003 — the engine contract this epic extends with `reviewSpecification`

## Clarifications

### Session 2026-08-19

- Q: When a transition is configured with no explicit role list, how many roles should its gate run? → A: **None — the gate fails closed.** Configuration is required; there is no implicit default. Chosen because this Epic already carries the whole `PP-017` cost exposure of the family with M-07 optimisation controls deferred, and a default of twelve would bill the maximum for a transition nobody had configured. Failing closed makes the expensive case one a person opted into, and surfaces a missing configuration immediately rather than as a cost report later.

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
| PP-003 Human-in-the-Loop | ✅ **Satisfied here for the platform** — no automated verdict advances a specification |
| PP-016 Explainable AI | ✅ **Satisfied here** — gate outcomes record what each role said and what a human overrode |
| PP-017 Cost-Aware AI | 🔶 Deferred to M-07, **and this epic increases the exposure**. Twelve roles per gate, optimisation deferred, containment limited to per-job caps. T291 re-scores RAID R-02. Owner: tech lead |

## Notes

⚠️ **This epic carries the whole PP-017 cost exposure of the family.** Twelve roles per gate is twelve model invocations, with M-07's optimisation controls deferred by the 2026-08-04 ruling. **Gates should be configured with the roles a transition actually needs — twelve is the maximum, not the default.**

✅ **The default settled 2026-08-19: there is none — a gate with no configured roles fails closed.**
The sentence above said what the maximum was and left the default unstated, which meant the
cheapest thing to implement was also the most expensive to run. Requiring configuration makes the
twelve-role case one a person opted into, and turns a missing configuration into an immediate
refusal rather than a cost report at the end of the month.

✅ **A1 resolved 2026-08-07.** `FR-011` now enumerates the **eight permitted transitions** across six endpoints, so a gate binds to a defined set and `T277` can assert refusal by name.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/021-review-gates-roles/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] RAID **R-02** re-scored against the twelve-role profile (T291)
- [x] Conformance cases **C-17** to **C-20** green
- [x] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
