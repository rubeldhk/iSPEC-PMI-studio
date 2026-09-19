# ADR-0016 — TDD defect execution policy

**Status**: Accepted
**Date**: 2026-08-17 · **Accepted**: 2026-08-31 (`EPIC-035` `T999w`)
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaited**: the Defect Room epic, which did not yet exist. `EPIC-035` is it.

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Native §16 and the Defect Management document both require a defect to **prove** that the
implementation violates an already-approved expectation before any fix is authorised, and both
forbid marking a defect complete merely because code changed.

Native §17 adds the subtlety: *"Do NOT blindly classify every passing reproduction test as a Change
Request"* — a test may pass because it was wrong, or the environment differed, or the defect is
intermittent.

## Decision

**Open**, with the shape recorded: Defect, AI triage, identify approved expected behaviour,
reproduce, generate or identify a test, run it. FAIL confirms the defect and enters a TDD remediation
queue; PASS goes to an evidence check that may refine the test, investigate, or reclassify to a
Change Request.

A reclassified defect is **never deleted** — it is recorded as reclassified, preserving auditability.

Three outcomes, not two: Confirmed Defect, Change Request, or **Requirement Gap** where no approved
behaviour exists at all.

## Convergence (`EPIC-035` `T999w`, 2026-08-31)

This ADR was Open awaiting *"the Defect Room epic, which does not yet exist"*. It exists, and
every element of the recorded shape is now built and tested. Moved to **Accepted**, with what
remains stated rather than left implied.

**Decided and built.**

| The shape this ADR recorded | Where it lives | Proved by |
|---|---|---|
| Identify the approved expected behaviour, or record its absence | `triage.service.ts` | `T998` — and *"no approved behaviour"* and *"I could not look"* are held apart, because they are one `catch` block apart |
| **Three outcomes, not two** | `classification.types.ts` | `T997e`, `T998b`, and `FR-DFR-077`'s mutation proof |
| A reclassified defect is **never deleted** | `markSuperseded`, `orphanRepairLinks` | `T998e`, `T999j` — an updated row destroys the same history a deleted one does, more quietly |
| PASS goes to an evidence check with three paths, none automatic | `evidence-check.service.ts`, `defect-room.json` | `T998u`, `T998x`, and `FR-DFR-044`'s mutation proof |
| FAIL confirms and enters a TDD remediation queue | `repair.service.ts` | `T999g` |

**What the implementation added that the ADR did not say**, and which belongs in the record
because it was learned rather than designed:

- **Even `reclassify` does not reclassify.** The evidence check records that somebody chose to
  and hands back the route where the new outcome is stated. The check cannot know *which*
  outcome the item becomes — that judgement belongs in front of approved behaviour — and a
  check that inferred it would be this ADR's named failure mode arriving one step later, past
  the place anybody looks.
- **The PASS → Change Request edge does not exist in the loop configuration.** The failure mode
  is unrepresentable rather than merely forbidden, which is a stronger guarantee than a service
  refusing: a service can be edited, and the mutation proof for `FR-DFR-044` shows exactly what
  that edit looks like.

**What remains, and it is not this ADR's.** The negative consequence below — *"depends on
approved baselines existing"* — is discharged: `EPIC-033` supplies them, and its gap-intake
route is bound. What is **not** discharged is test execution: `BR-0080` has no callable owner
anywhere in the programme (`R-035-1`), so the *"run it"* step of the recorded shape refuses in
every deployment. That is a programme-level gap carried in `EPIC-035`'s closing report as an
unowned dependency, not an open question about this decision.

## Consequences

**Positive** — the expectation-verification gate prevents new functionality being implemented
under the label of bug fixing.

**Negative** — depends on approved baselines existing, which depends on the Requirement Room, which
depends on `PMI-DOC-004`.

## Traceability

Native §16 · Native §17 · Defect Management §3 to §11 · Defect Room epic (unowned)
