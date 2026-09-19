# ADR-0015 — Requirement, Change and Defect governance authority

**Status**: Accepted
**Date**: 2026-08-17 · **Accepted**: 2026-08-22
**Deciders**: Tech lead (architecture) · project owner (Finding A, governance posture)
**Discharged**:
- PMI-DOC-004 — approved v2.0, 2026-08-22. §6.3, §6.5 and §6.6 make the Requirement, Change and
  Defect Rooms first-class requirements.
- `EPIC-027` **Finding A confirmed by the project owner, 2026-08-22** — the three Rooms do not
  exist and are **builds, not enhancements**.

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

The amendment instructs *"maintain and enhance the existing Change Room"* and *"the existing
Defect Room"*. **Neither exists.** Searching all 27 other epic specifications returns zero
occurrences of Change Room, Defect Room, Requirement Room or Decision Room (`PRE-001` to `PRE-004`).

`D-32` settled that these are **new capability, sized as builds** — but the governance authority
model beneath them is a product decision, not an architectural one.

## Decision

**Accepted.** Both blockers resolved on 2026-08-22.

**Finding A is confirmed.** The Requirement, Change and Defect Rooms **do not exist** and are
**builds, not enhancements**. Where the amendment says *"maintain and enhance the existing Change
Room"* and *"the existing Defect Room"*, the amendment is wrong on a matter of fact: `PRE-001` to
`PRE-004` searched all 27 other epic specifications and returned zero occurrences of Change Room,
Defect Room, Requirement Room or Decision Room. This ratifies at project-owner level what `D-32`
had already recorded, and it is the sizing basis for the three Room epics — capability areas
`U-01`, `U-04` and `U-05`.

**The governance authority model is now settled**, by the two documents that arrived after this ADR
was opened:

| Was open | Now decided by |
|---|---|
| Risk banding | `ADR-0025` — three bands, with the high band not configurable away |
| Approval thresholds | PMI-DOC-004 v2.0 `BR-0067` — low MAY auto-execute under policy, medium requires policy and evidence gates, high or consequential requires authorized human approval |
| Decision authority record | `BR-0005` — every governed approval identifies actor, authority basis, object version, decision and timestamp |
| Requirement approval behaviour | `BR-0025` (stakeholder decision with rationale), `BR-0026` (immutable baseline), `BR-0046` (change decision before a baseline is affected) |

What carried unchanged from the original decision: agents **may not** autonomously change
authoritative business intent (Native §12), and PMI Studio controls state transitions.

**What is not decided here, and is not open here.** The detailed per-Room role model — who may
clarify, who may propose options, who may baseline in each Room — belongs to the Room epics
themselves (`U-01`, `U-04`, `U-05`). That is specification detail under an accepted authority model,
not an unresolved architecture decision.

## Consequences

**Positive** — the false premise is settled before anyone plans against it. "Enhance" and "build"
are different budgets, and three Rooms mis-sized is a programme-level estimate error.

**Negative** — three of the twenty capability areas remain unowned until epics are created. Wave 1
declares them; until it does, confirming Finding A sizes work that has no owner.

**Consequence of the confirmation** — the three Room epics must be estimated as new builds. Any
plan, estimate or task breakdown that assumed enhancement of existing Rooms is wrong by the size of
the Rooms, which is the programme-level error this ADR existed to prevent.

## Traceability

Finding A (confirmed 2026-08-22) · D-32 · D-33 · PRE-001 to PRE-004 · Native §12 to §15 ·
PMI-DOC-004 v2.0 §6.3, §6.5, §6.6, `BR-0005`, `BR-0025`, `BR-0026`, `BR-0046`, `BR-0067` ·
`ADR-0025` · `specs/brs-v2-reconciliation.md` `U-01`, `U-04`, `U-05`
