# Specification Quality Checklist: Change Room

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      → the spec states what must be linked, assembled, refused and retained. No graph store,
      diffing method or change-management standard is chosen; `PP-015` and `PP-018` record those as
      the plan's work.
- [x] Focused on user value and business needs
      → six stories: someone who cannot edit an approved requirement, a decision-maker seeing the
      blast radius before deciding, options carrying all six trade-off dimensions, an approval that
      actually re-baselines, a closure that answers four questions, and a Room that reads like its
      siblings. All trace to `BG-06` or `BG-09`.
- [x] Written for non-technical stakeholders
      → the flow is the business's own — request, clarify, impact, options, decide, re-baseline,
      re-plan, close.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      → zero markers. Four open questions are carried as **named Assumptions with owners**: the
      PMI-DOC-006 approval (project owner), `BR-0154` re-plan (`U-12`), `BR-0073` architecture
      violation flagging (`U-17`), and `BR-0083` rationale questions (`U-17`). Each is a neighbouring
      capability's ownership, not an ambiguity in this Epic's own scope.
- [x] Requirements are testable and unambiguous
      → the two load-bearing ones are stated as unreachabilities and both must be mutation-tested:
      `FR-CHR-011` (nothing changes an approved baseline outside a decided Change Request) and
      `FR-CHR-032` (an undeterminable impact area renders as **unknown**, never absent). The second
      matters more than it looks: an absent row and a clean row are the same pixel, and the
      difference is the whole value of an impact view.
- [x] Success criteria are measurable
      → eight, six of them zeros or hundreds. `SC-CHR-007` — *zero completed work items destroyed by
      a re-plan* — is the one a re-plan implementation is most likely to violate quietly.
- [x] Success criteria are technology-agnostic
      → `SC-CHR-004` says the prior baseline stays "readable and byte-identical", which is a property
      of the guarantee rather than of any store.
- [x] All acceptance scenarios are defined
      → seventeen across six stories, each runnable with the substrate Epics stubbed.
- [x] Edge cases are identified
      → eight, including the four that fail silently: a change raised against a superseded baseline,
      two concurrent changes on one baseline, an unresolvable impact sub-graph, and an "emergency"
      change. `FR-CHR-021` answers the last — **urgency is a recorded field, never a gate bypass**.
- [x] Scope is clearly bounded
      → `FR-CHR-002` names seven things this Epic must not implement, three of which are unowned
      capability areas. Stating them as a requirement rather than prose means a task that drifts into
      one fails a check.
- [x] Dependencies and assumptions identified
      → nine, covering the four Wave 1 Epics it depends on, `EPIC-020`, `EPIC-035` and the unowned
      `U-12` and `U-17`.

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
      → intake, clarify, impact, options, decide, re-baseline, re-plan, close, render. Each of the
      seven owned `BR-` requirements is exercised by at least one story.
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **This is a BUILD despite the amendment saying "maintain and enhance the existing Change Room".**
  There is no existing Change Room. `EPIC-027` Finding A, confirmed 2026-08-22 and recorded in
  `ADR-0015`: `PRE-001` to `PRE-004` searched all 27 other Epic specifications and returned zero
  occurrences. The blockquote is at the top of the spec, above the Input, because an estimate written
  from this document must not be able to miss it.

- **A second §13-versus-§4 discrepancy, recorded rather than resolved.** PMI-DOC-004 v2.0 §13 places
  `BR-0154` in its *Architecture impact, rationale, re-plan* row, assigned to an
  `EPIC-016`/`EPIC-020` extension; `brs-v2-reconciliation.md` §4 places it in `U-12`, an `EPIC-012`
  extension. §4 wins on PMI-DOC-004's own instruction. The first such looseness — `BR-0143` in two
  §13 rows — was recorded in `EPIC-032`. Neither changes a requirement; both would change what an
  Epic thinks it owns.

- **`FR-CHR-034` is Constitution IX applied to a screen.** `BR-0073` — flagging likely architecture
  violations — is `U-17` and unowned. This Room surfaces the touched decisions and must **state that
  the violation check has not run**, rather than showing a clean panel. A check that has not run must
  not be reported as passing, whether the report is a closing report or a user interface.

- **The Defect Room transfer is specified from both ends in one Wave.** `EPIC-035` owns the decision
  to transfer (`BR-0057`); this Room owns receiving it with context and evidence intact
  (`FR-CHR-012`). Both exit criteria require the transfer be exercised end to end jointly, so neither
  half is built against a guess about the other.

- **The stage is `Specified`, and the next step is `/speckit-clarify`.** A fully-resolved checklist
  ahead of a recorded clarification session surfaces in the stage register as a `report` finding —
  *checklist evidence present without the stage before it*. That clears when the session runs.
