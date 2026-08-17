# Specification Quality Checklist: Epic Stage Register & Definition of Ready

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — requirements state *what* must be
      derived, published, and checked; no file format, tool, or data structure is named
- [x] Focused on user value and business needs — the value is stated concretely against four Epics
      whose position is ambiguous today (EPIC-002, EPIC-009, EPIC-012, EPIC-017)
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed — SRS Traceability, Principle Conformance, User Scenarios,
      Requirements, Success Criteria, Assumptions, Epic Exit Criteria

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — every open choice was defaulted from an existing
      repository precedent and recorded in Assumptions
- [x] Requirements are testable and unambiguous — each FR-ESK names the artifact evidence or
      reported outcome that decides it
- [x] Success criteria are measurable — SC-ESK-002/003/004/006/010 are counts; the remainder name a
      single-pass observable outcome
- [x] Success criteria are technology-agnostic — no format, framework, or tool appears in any SC
- [x] All acceptance scenarios are defined — 6 prioritised stories, 24 Given/When/Then scenarios
- [x] Edge cases are identified — 9, including `_shared/` exclusion, out-of-order artifacts,
      posture-beats-completeness, and the register appearing in its own output
- [x] Scope is clearly bounded — repository process only; journey ends at Ready to Implement
      (FR-ESK-009, US5); product Kanban is EPIC-012's, product spec lifecycle is EPIC-009's
- [x] Dependencies and assumptions identified — EPIC-018 soft dependency, D-13 advisory, 12
      assumptions each tied to a precedent

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows — record (US1), derive (US2), posture (US3), DOR (US4),
      boundary (US5), verify (US6)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitution Conformance *(project-specific — this repository)*

- [x] Constitution II — SRS traceability table populated; the absence of any SRS source is stated
      explicitly with **project owner** named as back-fill owner (precedent: FR-RGP-014/015)
- [x] Constitution III — Epic identifier `EPIC-026` assigned; directory created under `specs/`
- [x] Constitution V — every requirement's verification is an executable check (FR-ESK-016);
      manual review is explicitly rejected (FR-ESK-011)
- [x] Constitution VI — `specs/026-epic-stage-kanban/defects/` created
- [x] PMI-DOC-003 — Principle Conformance deltas recorded against the `_shared/` platform register
- [x] Conflict C-01 — identifiers namespaced `FR-ESK-###` / `SC-ESK-###`

## Notes

- Validation run 2026-08-09 (initial), re-validated 2026-08-09 after clarification. **22/22 → 22/22
  items passing; no state changes and no regressions.** The spec grew from 16 to 23 functional
  requirements, 10 to 14 success criteria, and 24 to 36 acceptance scenarios without any item
  falling out of compliance.
- **Clarification session of 2026-08-09 resolved five questions**, recorded in `spec.md`
  §Clarifications. Two of them closed a real hole rather than merely picking between options:
  the analysis and clarification steps each left no artifact, so **Analyzed** and **Clarified** were
  underivable and every Epic would have stalled one or two steps short of Ready. The general rule
  that came out of it — *an artifact records that a step ran, not that it found something*
  (FR-ESK-017) — now governs both.
- **Of the four defaults carried into clarification, all four survived**: process-not-product,
  stage-derived-posture-declared, the severity split, and the journey ending at Ready. Three were
  extended rather than changed — the derivation rule now reaches the two commands that left no
  evidence (FR-ESK-018, FR-ESK-019), and the severity split gained a second blocking check for a
  stale committed register (FR-ESK-021).
- **One default was deliberately softened**: FR-ESK-014 no longer makes readiness absolute. A single
  named DOR condition may be waived by a programme role, with a reason and an expiry, and the Epic
  then reads *Ready (waived)* rather than Ready (FR-ESK-022, FR-ESK-023). The reasoning is recorded
  in Assumptions — a gate with no legitimate exception path invites someone to weaken the check
  instead, which is the failure this register exists to detect.
- This Epic is the standing home for further repository process requirements. Each arrives as a new
  prioritised user story appended to `spec.md`; the current scope is the stage register and DOR only.
