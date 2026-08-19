# Epic Specification: Specification Engine & Sandbox

**Epic**: `EPIC-003` | **Module**: M-08 | **Tasks**: 35

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING.** Buildable now — nothing here depends on the Business Requirement
> Specification.

## Purpose

The architectural centre of the programme: one contract, two adapters, and a sandboxed runtime for executing an AI coding agent. This is where *"Treat Spec Kit as Engine V1, not the product"* is made true or false.

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
| FR-016 define the engine capability contract |
| FR-017 invoke engines only through the contract |
| FR-018 Spec Kit adapter as the default engine |
| FR-021 refuse an engine missing a required capability |
| FR-022 record engine and model version on every artifact |
| FR-023 validation findings identify their location · *co-owned* |

## User stories owned

- US3 — generation, engine side
- US8 — prove the platform is not tied to Spec Kit

## Success criteria owned

- SC-008 a second engine with zero changes outside the adapter layer

## Depends on

- EPIC-001 — job orchestration and failure taxonomy

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **12** categories are not answered in this document, of which **8** — *Out of Scope*, *Scale assumptions*, *UX Flow*, *Performance*, *Reliability*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../_shared/platform-spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**4** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Accessibility / i18n* — settled in this session as **WCAG 2.2 Level AA** — automated checks in CI plus a manual keyboard and screen-reader pass at Epic exit — recorded against [EPIC-010](../010-specification-interface/spec.md)
- *Compliance* — settled in this session as **indefinite audit retention with append-only redaction** rather than deletion, recorded against [EPIC-004](../004-workspace-tenancy-audit/spec.md)
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register lives in the [parent product spec](../_shared/platform-spec.md).
This epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-006 Engine Independence | ✅ **Satisfied here for the whole platform.** Package boundary, build-failing architecture test, and a fixture adapter that proves the contract is engine-neutral |
| PP-017 Cost-Aware AI | ⚠️ Containment half satisfied here — hard CPU, memory, and wall-clock caps per sandboxed job (PC-2). Optimisation deferred to M-07 AI Platform |

## Notes

**Buildable with no product surface at all.** The contract takes plain data — `RequirementInput[]`, not database entities — which is what made the D-10 split possible.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

- [x] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] `/speckit-converge` reports no unbuilt work for this epic
- [x] `specs/003-specification-engine/defects/` contains no open defect records
- [x] Principle deltas above still hold; any deferral retains a valid owner
- [x] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**

**Closed 2026-08-17.** See [`closure.md`](./closure.md). `T138` was routed to EPIC-013 (conflict `C-29`), not built: this epic does not own `FR-019`.
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
