# Epic Quality Checklist: Unattended Runs & Team Review

**Epic**: `EPIC-023` | **Tasks**: 43 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../002-team-review-access-storage/checklists/requirements.md](../../002-team-review-access-storage/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-02.1 – F-02.4, F-023.Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12)
- [x] Dependencies on other epics stated — EPIC-001, EPIC-008, EPIC-009
- [ ] Requirement IDs conform to PMI-DOC-000 §3 — **blocked on decision D-1**. This epic's
      `FR-001`–`FR-020` collide with the platform set (conflict **C-01**); unlike the EPIC-017
      family, these are *not* namespaced
- [x] **SRS debt declared, not hidden** — `FR-001`–`FR-020` have no SRS source, re-verified against
      the MPS drop, with a named back-fill owner and `T404` gating **approval**

## Split integrity *(ruling D-19)*

- [x] Every requirement owned is defined in the parent spec — no dangling reference
- [x] The owned set is disjoint from EPIC-024/025 — no requirement is claimed twice
- [x] The owned ranges do not overlap **each other** *(fixed 2026-08-10 — see iteration)*
- [x] The parent's split table agrees with this epic's own header on requirements and task count
- [x] Task IDs declared invariant — allocated at the split, IDs held rather than renumbered
- [x] User stories owned (US1, US2, US3) appear exactly once across the family
- [x] Success criteria owned (`SC-001`–`SC-006`) appear exactly once across the family
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded — PP-003, PP-016 (decision D-6)
- [x] Every controller carries both a unit test and a contract test (gap G-02.3/G-02.4, closed)

## Exit readiness

- [ ] All tasks complete with tests passing
- [ ] **SRS back-fill complete** — this epic must not be *approved* without it (`T404`)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `defects/` has no open records
- [ ] Principle deltas still hold; deferrals retain valid owners
- [ ] **Epic closure recorded in `closure.md` (Phase Z); this epic is release-eligible** —
      ⚠️ **not currently listed in `spec.md` Epic Exit Criteria**, though `T411`–`T414` write it
- [ ] Platform promotion is gated separately by EPIC-014 `F-11.2` — ⚠️ **`spec.md` currently claims
      this epic discharges promotion**, contradicting `/speckit-analyze` finding **C1**

## Validation iteration — 2026-08-10

Two items failed and were fixed:

1. **Overlapping ownership ranges.** The owned table listed `FR-009`–`FR-020` *and* `FR-016`–`FR-019`
   as separate rows with different descriptions — the second range is wholly contained in the first,
   so four requirements were claimed twice with conflicting summaries. Corrected to `FR-009`–`FR-015`
   (review sessions) and `FR-016`–`FR-020` (re-run and clearance).
2. **`FR-008a` owned but undeclared.** Added by the 2026-08-08 clarification and present in
   `tasks.md`, but missing from `spec.md`'s owned table. Added.

**One finding remains open** — see Exit readiness. It is shared with EPIC-024 and EPIC-025 and is
recorded in the Notes below rather than silently corrected, because it changes an exit gate.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- ⚠️ **Open finding — exit criteria diverge from analyze finding C1.** `/speckit-analyze` finding
  **C1** moved per-epic closure out of EPIC-014 into each epic's own `Phase Z`, precisely so an epic
  can close **without waiting on the held EPIC-014**. The EPIC-017 family (019–022) adopted this:
  each states closure in `closure.md` and explicitly disclaims platform promotion. **The EPIC-002
  family (023, 024, 025) did not** — all three still claim `local → dev → stage → prod` and omit the
  `closure.md` gate, even though their `Phase Z` tasks write exactly that file. EPIC-014 `T151`
  *confirms* those records and does not re-run them, so as written these three epics gate themselves
  on a held epic for no reason. **Recommend aligning all three with the 019–022 wording.**
- The organising insight: **an unattended run never decides.** It defers, marks, and carries on;
  a human commits the batch.
