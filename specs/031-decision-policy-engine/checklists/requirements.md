# Specification Quality Checklist: Decision & Policy Engine

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      → the spec states bands, constraints and refusals. No policy language, rules engine or store
      is chosen; `PP-015` records that the open-standard question is the plan's, not the spec's.
- [x] Focused on user value and business needs
      → six stories: an administrator who cannot disarm the high band, an engineer whose low-risk
      work stops waiting, a reviewer with one queue, an engineer owed an explanation, an Expert that
      may propose but not assign, and a gate that cannot be passed by omission. `BG-02` and `BG-05`.
- [x] Written for non-technical stakeholders
      → the three bands and the four constraints are the whole vocabulary, and each is stated in the
      sentence `ADR-0025` uses.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      → zero markers. **Re-validated after the 2026-08-22 clarification session**, which settled the
      two questions that were this Epic's to answer: classification rules live in the `BR-0070`
      steering hierarchy (`ADR-0025`'s delegated question), and the `BR-0005` authority record is
      published here provisionally for `U-02` to adopt. One carried item remains — the PMI-DOC-006
      approval, a **named Assumption with the project owner as owner**.
- [x] Requirements are testable and unambiguous
      → the two hardest are stated as negatives that can fail: `FR-DPE-012` (*no tenant-reachable
      configuration reaches the high band*) and `FR-DPE-013` (*"satisfied" is not reachable by
      omission*). Both are required to be mutation-tested at exit, because a fence that cannot fail
      is what Constitution V calls decoration.
- [x] Success criteria are measurable
      → eight, six of them zeros or hundreds. `SC-DPE-001` is verified by **enumerating the
      configuration surface**, not by inspecting defaults — the difference between proving a fence
      exists and observing that nobody has climbed it yet.
- [x] Success criteria are technology-agnostic
      → `SC-DPE-007` says "when the engine is unreachable", which is a property of the guarantee
      rather than of any transport.
- [x] All acceptance scenarios are defined
      → nineteen across six stories, each independently runnable with a stubbed loop seam and no
      Room in existence.
- [x] Edge cases are identified
      → eight, including the three that fail silently if unstated: engine unavailable (fail closed),
      unclassified action type (most restrictive band), and an expired exception (a fact, not a
      grace period).
- [x] Scope is clearly bounded
      → `FR-DPE-051` and `FR-DPE-052` state the boundary as requirements. `ADR-0025`'s sentence
      *"Rooms do not each get their own policy logic"* is `FR-DPE-051`, so a Room that grows its own
      policy fails a check rather than a review.
- [x] Dependencies and assumptions identified
      → nine, covering `EPIC-030` (the seam this fills), `EPIC-004`, `EPIC-005`, `EPIC-021`,
      `EPIC-032` and the unowned `U-02`.

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
      → classify, decide, queue, explain, propose-not-assign, gate, **and automation triggers**.
      The seventh story was added 2026-08-22 to close analysis finding `C1`: `BR-0069` had
      requirements and a delegation from `EPIC-030` but **no story**, and `/speckit-tasks` organises
      by story — so it produced no tasks for it, silently and without failing any check.
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **This Epic declares capability area `U-07` whole** — `BR-0066`–`BR-0069`, `BR-0174` and
  `BR-0192`. The `EPIC-027` register assigned `U-07` to *"a new epic — Decision Center, shared by
  all three Rooms"*; this is that epic, and the "shared" half is `FR-DPE-051` rather than an
  intention.

- **`ADR-0025` is Accepted, which makes this the least ambiguous of the six Wave 1 Epics.** The
  three bands, the four binding constraints and the policy-declared classification rule were all
  settled on 2026-08-21. What this spec adds is the failure behaviour the ADR implies but does not
  state: fail closed when the engine is unreachable (`FR-DPE-050`), and most-restrictive-band for an
  unclassified action type (`FR-DPE-004`). Both defaults run the same direction, and it is the
  direction `ADR-0025`'s own Negative consequence argues for.

- **Constitution XI Tier 2 applies here and did not apply to `EPIC-030`.** The Decision Inbox is a
  screen a person uses, so a run-generated transcript against a running application is owed at exit.
  Recorded now, in the Epic that acquires the obligation, rather than discovered at closure.

- **The stage moves to `Checklisted` with this session.** `Specified` and `Clarified` are now both
  evidenced and this checklist is fully resolved, so the three stages are contiguous and the
  `report` finding this Epic carried — *checklist evidence present without the stage before it* —
  clears. Next step is `/speckit-plan`.

- **This Epic now enforces a band `EPIC-030` declares.** `FR-GEL-016` makes a loop-configuration
  change permanently high band; `FR-DPE-012` is where that is actually fenced. The two were
  clarified the same day, and naming it in only one of them would have left the guarantee owned by
  nobody — the same ownership gap `BR-0065` produced in the other direction.
