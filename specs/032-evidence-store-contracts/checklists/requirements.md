# Specification Quality Checklist: Evidence Store & Evidence Contracts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      → the spec states what evidence must carry and what the gate must refuse. No store, hash
      algorithm or attestation format is chosen; `PP-015` records that selection as the plan's work.
- [x] Focused on user value and business needs
      → five stories: an agent whose "done" is refused, a tech lead declaring proof up front, a
      reviewer tracing a six-week-old test result, a specialist tool contributing without being
      rebuilt, and nine kinds of proof behaving as one. All trace to `BG-08`.
- [x] Written for non-technical stakeholders
      → the whole argument is one sentence — completion is evidence-driven rather than
      assertion-driven — and every requirement is a consequence of it.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      → zero markers. **Re-validated after the 2026-08-22 clarification session**, which settled the
      `U-08` question — this Epic stands, `EPIC-015` consumes it — and added `FR-EVS-035`, the
      fail-closed rule for an unreachable store. One carried item remains: the PMI-DOC-006 approval,
      a **named Assumption with the project owner as owner**.
- [x] Requirements are testable and unambiguous
      → `FR-EVS-030` is stated as an unreachability — *completion with an unmet Contract MUST NOT be
      reachable* — and its exit criterion requires the bypass mutation. `FR-EVS-014` and
      `FR-EVS-034` are the two that would otherwise pass silently: an unresolvable reference and a
      failed integrity check both count as **unmet**, because presence is not validity.
- [x] Success criteria are measurable
      → eight; `SC-EVS-001` is the zero the differentiator rests on, and `SC-EVS-008` is `BG-08`'s
      own success measure computed from the store rather than estimated.
- [x] Success criteria are technology-agnostic
      → none names a store or format. `SC-EVS-005` — *zero analysis performed by PMI Studio* — is a
      property of the boundary `ADR-0022` decided, not of any integration.
- [x] All acceptance scenarios are defined
      → sixteen across five stories, each runnable with no Room, no compliance agent and no real
      external tool.
- [x] Edge cases are identified
      → eight, including the four that convert silently into passed gates if unstated: a deleted
      external reference, evidence for a superseded version, a Contract weakened in flight, and an
      empty Contract.
- [x] Scope is clearly bounded
      → three boundary requirements rather than prose. `FR-EVS-051` states the one most likely to be
      crossed by good intentions: `BR-0143` and `BR-0036` are `U-09` and stay unowned, so this Epic
      does **not** converge `ADR-0022`.
- [x] Dependencies and assumptions identified
      → nine, covering `EPIC-030`, `EPIC-031`, `EPIC-015`, `EPIC-024`, `EPIC-013` and the unowned
      `U-09` and `U-13`.

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
      → declare, attach, prove provenance, contribute externally, gate. No owned `BR-` is exercised
      by zero stories.
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **A discrepancy in the gap register, recorded rather than resolved.** PMI-DOC-004 v2.0 §13 lists
  `BR-0140`–`BR-0144` in its *Evidence & compliance* row **and** `BR-0143` again in its
  *Specification compliance verdict* row, so `BR-0143` appears twice in that summary.
  `brs-v2-reconciliation.md` §4 is precise where §13 is loose, and PMI-DOC-004 itself says §4 is the
  authority for Wave 0. This Epic follows §4 and does not own `BR-0143`. Written down so a later
  reader does not read the omission as an oversight and quietly widen this Epic's scope by one
  requirement — which is the whole of `U-09`.

- **`ADR-0022` is Open and this Epic does not close it.** Its PMI-DOC-004 dependency was discharged
  on 2026-08-22; what remains is an owning epic for the Specification Compliance Agent. That is
  `U-09`, one of the three areas the `EPIC-027` register still marks **UNOWNED** after this Wave.
  The Epic Exit Criteria say so explicitly, because "the differentiator is now owned" is exactly the
  overstatement this declaration invites.

- **The stage moves to `Checklisted` with this session**, and the `report` finding this Epic carried
  clears. Next step is `/speckit-plan`.

- **The question that could have dissolved this Epic is answered.** `U-08` was the only Wave 1
  declaration whose *existence as a separate Epic* was live rather than settled. It stands, because
  the store is substrate for all three Rooms and not only for Epic-level QA. What that leaves is a
  record to correct: `brs-v2-reconciliation.md` §4 still offers the alternative, and an exit
  criterion now says so.

- A fully-resolved checklist ahead of a recorded clarification session surfaces in the stage register
  as a `report` finding — *checklist evidence present without the stage before it*. That is the
  register describing an Epic between specify and clarify, and it clears when the session runs.
