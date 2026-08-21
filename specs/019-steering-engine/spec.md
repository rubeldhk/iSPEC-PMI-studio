# Epic Specification: Steering Engine

**Epic**: `EPIC-019` | **Module**: M-01 / M-04 | **Tasks**: 27

**Parent design**: [../017-enhancement-model/](../017-enhancement-model/) — spec, plan, research,
data model, contracts, quickstart. Requirements are defined **once** there; this epic declares which
it *owns*.

**Shared design**: [../_shared/](../_shared/) — platform architecture, schema, engine contract

**Created**: 2026-08-04 — split from EPIC-017 by ruling **D-18**

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0070**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Purpose

Standards recorded once, at the level where they apply, constraining every generation beneath them. This is the enhancement every other one leans on — without it, generated specifications restate context by hand and drift between authors.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent spec](../017-enhancement-model/spec.md), which cites `SRS/enhancement_module/` behind every
requirement below. No requirement in this epic originates outside that table.

Authority is layered per **D-16**: the enhancement document governs the structure and traceability of
specifications PMI Studio *produces*; `PMI-DOC-000` governs this repository's own documents.

## Requirements owned

| Requirement |
|---|
| FR-ENH-001 four steering scopes with inheritance |
| FR-ENH-002 the ten steering subjects |
| FR-ENH-003 create, edit, version, retire steering content |
| FR-ENH-004 apply steering to every generation and record provenance |
| FR-ENH-005 narrower scope wins; the override is recorded |

## User stories owned

- US1 — steer generation with organizational context

## Success criteria owned

- SC-ENH-001 100% of generated specifications record their steering provenance

## Depends on

- EPIC-004 — tenancy, which this epic extends with an organization tier
- EPIC-008 — generation, which provenance stamps attach to
- EPIC-003 — the engine contract this epic extends

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **14** categories are not answered in this document, of which **11** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *Compliance*, *External deps*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../017-enhancement-model/spec.md) (via 2 levels of inheritance) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

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
| PP-001 Specification First, AI Second | ✅ **Satisfied here** — steering constrains generation *before* it runs |
| PP-006 Engine Independence | ⚠️ **At risk here, and defended.** Steering enters through the contract as structured data, never as a prompt fragment. **`T246a` is the backstop** — it fails the build if `backend/src/**` assembles steering into prompt text. `T047`/`T142` are not sufficient: they match engine *names*, and a prompt built from steering names none |
| PP-014 Configuration over Customization | ✅ Satisfied here — steering is configuration, not a per-tenant fork |

## Notes

⚠️ **This epic must land first in the family.** F-17.1 adds a tenancy scope above workspace: a column while no workspace rows exist, a data migration afterwards (research **R-017-1**). `organization_id` goes on `workspaces` only — a second denormalised tenancy column would be a second thing to get wrong in a security boundary.

**Steering is additive.** A project with no steering behaves exactly as the platform does today; every existing conformance case must still pass unchanged.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/019-steering-engine/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] Conformance cases **C-14** to **C-16** green against both adapters
- [x] `pnpm test:arch` green including **`T246a`** — no steering text assembled into a prompt in `backend/src/**`
- [x] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
