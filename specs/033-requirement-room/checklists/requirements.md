# Specification Quality Checklist: Requirement Room

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      → the spec states what the Room must refuse, label and retain. No store, model or
      requirements-interchange format is chosen; `PP-015` and `PP-018` record those as the plan's.
- [x] Focused on user value and business needs
      → six stories: a product owner reaching an immutable baseline, an analyst reading labelled
      analysis, a requirement that cannot baseline without measurable criteria, a decision offered
      real options, an engineer selecting a baseline for specification, and a user who finds the same
      six regions they saw in another Room. All trace to `BG-01` or `BG-09`.
- [x] Written for non-technical stakeholders
      → the flow is stated in the words the business uses — intake, clarify, options, decide,
      baseline, hand off — and every requirement is a consequence of one of them.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      → zero markers. Three open questions are carried as **named Assumptions with owners**: the
      PMI-DOC-006 approval (project owner), `BR-0004` external stakeholder access (product owner,
      `U-02`), and `BR-0106` session cost limits (`U-11`). None changes a requirement below; each
      changes who owns a neighbouring capability, which is why each names an owner instead.
- [x] Requirements are testable and unambiguous
      → the two load-bearing ones are stated as unreachabilities and both are required to be
      mutation-tested at exit: `FR-RQR-051` (no in-place edit of a baseline) and `FR-RQR-011` (an
      unlabelled AI element is not presentable). `FR-RQR-041` — *an AI or agent MUST NOT take a
      requirement decision* — is testable by attempting one.
- [x] Success criteria are measurable
      → eight, five of them zeros. `SC-RQR-004` is the shortest and the most consequential: zero
      requirement decisions taken by a non-human actor.
- [x] Success criteria are technology-agnostic
      → `SC-RQR-007` compares region names against the shared pattern, which is a property of the
      vocabulary rather than of any rendering technology.
- [x] All acceptance scenarios are defined
      → eighteen across six stories. Story 6 is honestly marked P3 because it is only *provable*
      once a second Room exists — but it is specified here, in the first Room, because the first
      Room is what the other two will be built to match.
- [x] Edge cases are identified
      → eight, including the three that would silently erode `RULE-02`: intent contradicting a
      baseline (conflict, never recency), a revised source document (new intent, baseline unmoved),
      and concurrent overlapping approvals (conflict, never merge).
- [x] Scope is clearly bounded
      → `FR-RQR-002` and `FR-RQR-003` state the boundary as requirements. The first is `D-33` made
      mechanical: this Room consumes `EPIC-007`'s register and may not create a second.
- [x] Dependencies and assumptions identified
      → eight, covering the three substrate Epics of this Wave, `EPIC-007`, `EPIC-029`, and the
      unowned `U-02` and `U-11`.

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
      → intake, clarify, criteria, decide, baseline, hand off, render. Each of the six owned `BR-`
      requirements is exercised by at least one story.
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **This is a BUILD, and the spec says so in a blockquote at the top rather than in a footnote.**
  `EPIC-027` Finding A was confirmed by the project owner on 2026-08-22 and recorded in `ADR-0015`,
  now Accepted: `PRE-001` to `PRE-004` searched all 27 other Epic specifications and returned zero
  occurrences of any Room. `ADR-0015`'s own Consequences state the cost of getting this wrong —
  *"Any plan, estimate or task breakdown that assumed enhancement of existing Rooms is wrong by the
  size of the Rooms."* Placement is deliberate: an estimate written from this document should not be
  able to miss it.

- **This is not `EPIC-007`, and `D-33` is why.** `PRE-018` was recorded **partial** rather than
  confirmed, because both halves are true — EPIC-007 exists and is called Requirement Intelligence,
  and it is not this capability. Its own spec puts AI-assisted analysis in Phase 2, out of scope.
  `premises.md` names the failure mode of leaving it unreconciled: *"the worst kind of drift — two
  teams believing one epic covers both."* `FR-RQR-002` turns that from a warning into a check.

- **The PMI-DOC-006 dependency is strongest here of the three Rooms**, and should be discharged
  before `EPIC-034` plans against the same pattern. `BR-0191` — the shared Room pattern — is a
  *SHOULD* in PMI-DOC-004, so most of the pattern's binding force lives in a document that is still
  `PROPOSED`. The first Room built sets the vocabulary the other two inherit, whether or not anyone
  approved it.

- **The stage is `Specified`, and the next step is `/speckit-clarify`.** A fully-resolved checklist
  ahead of a recorded clarification session surfaces in the stage register as a `report` finding —
  *checklist evidence present without the stage before it*. That is the register describing an Epic
  between specify and clarify, and it clears when the session runs.
