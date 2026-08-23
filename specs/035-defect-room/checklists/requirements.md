# Specification Quality Checklist: Defect Room

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      → the spec states what must be classified, proved, transferred and retained. No test framework,
      store or defect-interchange format is chosen; `PP-015` and `PP-018` record those as the plan's.
- [x] Focused on user value and business needs
      → six stories: a report judged against approved behaviour, a fix that needs a failing test, an
      item transferred rather than fixed, a passing test that is not automatically a change, defects
      arriving from five origins, and closed defects that explain how they escaped. `BG-06`, `BG-09`.
- [x] Written for non-technical stakeholders
      → the flow is the business's own — report, classify, reproduce, prove, fix, verify, close — and
      the one subtle rule is stated in a sentence: a defect that is really a change must not be fixed
      as a defect.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      → zero markers. Three open questions are carried as **named Assumptions with owners**: the
      PMI-DOC-006 approval (project owner), `BR-0163` operational feedback (`U-19`), and `BR-0106`
      session cost limits (`U-11`). A fourth item — `ADR-0016`'s convergence — is not a question but
      an obligation, and sits in Epic Exit Criteria because this Epic is what that ADR awaits.
- [x] Requirements are testable and unambiguous
      → the two load-bearing ones are stated as unreachabilities and both must be mutation-tested:
      `FR-DFR-041` (no fix accepted without a failing test) and `FR-DFR-044` (a passing reproduction
      test never reclassifies automatically). The second is the single easiest requirement in this
      Epic to "simplify" into a defect, which is why `ADR-0016` states it as a prohibition.
- [x] Success criteria are measurable
      → nine, five of them zeros. `SC-DFR-005` — *zero reclassified defect records deleted* — exists
      because the natural implementation of reclassification is a move, and a move loses the record.
- [x] Success criteria are technology-agnostic
      → `SC-DFR-007` speaks of the defect test plus applicable regression tests passing, which is a
      property of the closure rule rather than of any runner.
- [x] All acceptance scenarios are defined
      → nineteen across six stories, each runnable with the substrate Epics and `EPIC-015` stubbed.
- [x] Edge cases are identified
      → nine, including the four that would otherwise be decided by accident: no approved baseline at
      all (**Requirement Gap**, the third outcome), a non-automatable defect (recorded exception, not
      an implicit skip), an intermittent defect passing once, and a transfer the Change Room refuses
      — which returns with the refusal attached rather than vanishing between two Rooms.
- [x] Scope is clearly bounded
      → `FR-DFR-002` names seven things this Epic must not implement, including two — test execution
      and the task model — that a defect workflow is most tempted to absorb.
- [x] Dependencies and assumptions identified
      → nine, covering all five Wave 1 Epics it depends on, `EPIC-012`, `EPIC-015`, and the unowned
      `U-11` and `U-19`.

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
      → intake, classify, reproduce, prove, **repair**, verify, transfer, analyse, render. All eight
      owned `BR-` requirements are exercised; this is the largest owned set of the six Wave 1 Epics.
      **Re-checked 2026-08-22** by a cross-Epic scan for the `EPIC-031` `C1` shape — an owned `BR-`
      with requirements and no user story. `BR-0055` was exactly that, and `BR-0053` was thin. User
      Story 7 and a fifth US2 scenario close both. The claim above was previously true of the
      requirement list and false of the story list, which is the gap the scan exists to find.
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **This is the Epic `ADR-0016` has been waiting for.** Its `Awaits` reads *"the Defect Room epic,
  which does not yet exist"*, and its Negative consequence — *"depends on approved baselines
  existing, which depends on the Requirement Room, which depends on `PMI-DOC-004`"* — is discharged
  twice over: PMI-DOC-004 v2.0 was approved 2026-08-22, and `EPIC-033` is declared in this same Wave.
  Convergence is an exit criterion, not an assumption.

- **Three outcomes, not two.** `ADR-0016` is explicit that classification yields Confirmed Defect,
  Change Request, **or Requirement Gap** where no approved behaviour exists at all. Two outcomes is
  the shape this Epic is most likely to ship by accident, because a gap looks like a change until
  someone asks which baseline it changes. `FR-DFR-022` and an exit criterion both name all three.

- **`FR-DFR-044` is the requirement most at risk of being optimised away.** `ADR-0016` quotes the
  source rule — *"Do NOT blindly classify every passing reproduction test as a Change Request"* —
  because a test may pass for three uninteresting reasons: it was wrong, the environment differed, or
  the defect is intermittent. Automating that step converts every flaky test into a scope change.

- **This is the product capability, not the repository convention.** Constitution VI's
  `specs/<epic-id>/defects/` folders are the programme's own discipline and are unchanged by this
  Epic. The two share a word and nothing else — and conflating them would make this Epic look like it
  already exists, which is precisely the class of error Finding A corrected.

- **The stage moves to `Checklisted` with this session**, and the `report` finding this Epic carried
  clears. Next step is `/speckit-plan`.

- **The clarification scan found a real gap, not a wording problem.** `ADR-0016` names three
  classification outcomes; this specification routed two. Confirmed Defect went to repair and Change
  Request to the Change Room, and **Requirement Gap had no destination at all** — an item would have
  classified correctly and then stopped moving. `FR-DFR-076` routes it to the Requirement Room as new
  intent, and `FR-DFR-077` states the general rule the omission broke: every outcome has a
  destination. The spec's own Notes had warned that *"two outcomes is the shape this Epic is most
  likely to ship by accident"*; it turns out three names with two exits is how that shape survives
  being counted.
