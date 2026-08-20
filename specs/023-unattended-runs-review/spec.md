# Epic Specification: Unattended Runs & Team Review

**Epic**: `EPIC-023` | **Module**: M-06 Workflow & Tasks | **Tasks**: counted in [tasks.md](./tasks.md), never restated here (`T686`, PP-002)

**Parent design**: [../002-team-review-access-storage/](../002-team-review-access-storage/)
**Shared design**: [../_shared/](../_shared/) — architecture, schema, contracts, research, RAID

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0061**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

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

> ⚠️ **SRS debt.** unattended runs (FR-RUN-001–FR-RUN-020) has **no SRS source**, re-verified against the MPS drop.
> Constitution II requires the back-fill before this epic is **approved** — not merely
> before it closes. Back-fill owner: project owner.

## Requirements owned

Requirements are defined once in the [parent design](../002-team-review-access-storage/spec.md);
this epic **owns** the following and is where they are satisfied:

| Requirement |
|---|
| FR-RUN-001 to FR-RUN-008 — unattended run mode and the user-selected stop point |
| FR-RUN-005a to FR-RUN-005c — provisional approval by explicit, recorded override |
| FR-RUN-008a — the run stops at the range the user selected and reports that it did |
| FR-RUN-009 to FR-RUN-015 — review sessions, draft answers, conflict detection, atomic submission |
| FR-RUN-013a — a conflict is resolved by the project owner or the run initiator, and every competing answer is retained with its author |
| FR-RUN-015a — submission restricted to the project owner or the run initiator |
| FR-RUN-016 to FR-RUN-020 — re-run with submitted answers, marking clearance, and stale-answer warning |
| FR-RUN-019a — a stale answer is asked again as a fresh question rather than applied, and the re-run never blocks for one |

## User stories owned

- US1 — start an unattended run that does not stop to ask questions
- US2 — review all questions together and submit answers in one go
- US3 — re-run with the team's answers applied

## Success criteria owned

- SC-001, SC-002 — every question lands in exactly one review session
- SC-003 — 20 questions reviewed in a single sitting under 60 minutes
- SC-004, SC-005, SC-006 — provisional marking, submission gating, attribution
- SC-005a — zero provisional specifications approved without a recorded, attributable override
- SC-015 — conflicts resolved only by the owner or initiator; competing answers stay retrievable
- SC-016 — zero stale answers applied to a re-run
- SC-017 — a review session of 200 questions; the publish half of that ceiling is EPIC-025's

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
| PP-003 Human-in-the-Loop | ✅✅ **The strongest expression of this principle in the programme.** An unattended run records a question with its options and a *marked provisional* answer; a human commits the batch (FR-RUN-009–FR-RUN-020), and approving provisional work needs an explicit, attributed override (FR-RUN-005a–c) |
| PP-016 Explainable AI | ✅✅ Every deferred question records the options considered and the suggested answer with its context, so an AI suggestion is reviewable *before* it becomes a decision |

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task in [tasks.md](./tasks.md) has a passing unit test (Constitution V)
- [x] **SRS back-fill complete** — `SRS/PMI-DOC-004_Business_Requirement_Specification_v1.0.md` **BR-0061** is the business source for `FR-RUN-001`–`FR-RUN-020` (approved 2026-08-20, T-106)
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `specs/023-unattended-runs-review/defects/` contains no open defect records
- [ ] Principle deltas above still hold; any deferral retains a valid owner
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
- [ ] A closing report was published (Constitution IX)
