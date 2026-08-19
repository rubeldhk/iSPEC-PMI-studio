# Epic Specification: Unattended Runs & Team Review

**Epic**: `EPIC-023` | **Module**: M-06 Workflow & Tasks | **Tasks**: 43

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ⏸ **HELD** pending `PMI-DOC-004` Business Requirement Specification and approved business
> scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — the tasks are complete, reviewed,
> and Constitution V compliant. They await an input, not more design.

## Purpose

A run that never pauses. It records every question it would have asked along with its own suggested
answer, marks everything derived from a guess as *provisional*, and hands the team one collective
decision session instead of a stop-start process.

The organising insight, inherited from the parent: **an unattended run never decides.** It defers,
marks, and carries on. A human commits the batch.

## SRS Traceability *(Constitution II)*

This epic **inherits** the SRS traceability table in the
[parent design](../002-team-review-access-storage/spec.md), which cites every source behind the
requirements below. Authority is layered per decision **D-12**.

> ⚠️ **SRS debt.** unattended runs (FR-001–FR-020) has **no SRS source**, re-verified against the MPS drop.
> Constitution II requires the back-fill before this epic is **approved** — not merely
> before it closes. Back-fill owner: project owner.

## Requirements owned

Requirements are defined once in the [parent design](../002-team-review-access-storage/spec.md);
this epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-001 to FR-008 — unattended run mode and the user-selected stop point |
| FR-005a to FR-005c — provisional approval by explicit, recorded override |
| FR-008a — the run stops at the range the user selected and reports that it did |
| FR-009 to FR-015 — review sessions, draft answers, conflict detection, atomic submission |
| FR-015a — submission restricted to the project owner or the run initiator |
| FR-016 to FR-020 — re-run with submitted answers, marking clearance, and stale-answer warning |

## User stories owned

- US1 — start an unattended run that does not stop to ask questions
- US2 — review all questions together and submit answers in one go
- US3 — re-run with the team's answers applied

## Success criteria owned

- SC-001, SC-002 — every question lands in exactly one review session
- SC-003 — 20 questions reviewed in a single sitting under 60 minutes
- SC-004, SC-005, SC-006 — provisional marking, submission gating, attribution

## Depends on

- EPIC-001 — job orchestration, failure taxonomy, observability
- EPIC-008 — generation, which unattended runs drive
- EPIC-009 — the lifecycle that provisional approval overrides

## Clarifications

### Session 2026-08-19

- No questions required.

Scanned against the twenty-category ambiguity taxonomy. **12** categories are not answered in this document, of which **9** — *Out of Scope*, *Domain & Data*, *Scale assumptions*, *UX Flow*, *Accessibility / i18n*, *Reliability*, *Edge cases*, *Constraints*, *Tradeoffs* — are answered up the chain from the [parent](../002-team-review-access-storage/spec.md) and inherited here under Constitution II. Asking those again per Epic would require this document to restate what the parent owns, which is the duplication `T686` removed from the task counts.

**3** are answered nowhere in that chain:

- *Error / empty states* — **Outstanding** — a plan-level concern that changes no requirement this Epic owns, recorded rather than asked
- *Performance* — **Outstanding** — recorded, not asked
- *Terminology* — **Outstanding** — no canonical glossary exists programme-wide; naming has held without one so far

## Principle conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md); the
epic-level register is in the [parent design](../002-team-review-access-storage/spec.md). This
epic records only where it **differs** or is the place a principle is satisfied:

| Principle | Status in this epic |
|---|---|
| PP-003 Human-in-the-Loop | ✅✅ **The strongest expression of this principle in the programme.** An unattended run records a question with its options and a *marked provisional* answer; a human commits the batch (FR-009–FR-020), and approving provisional work needs an explicit, attributed override (FR-005a–c) |
| PP-016 Explainable AI | ✅✅ Every deferred question records the options considered and the suggested answer with its context, so an AI suggestion is reviewable *before* it becomes a decision |

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [ ] **SRS back-fill complete** — this epic must not be *approved* without it (Constitution II)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/023-unattended-runs-review/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published (Constitution IX)
