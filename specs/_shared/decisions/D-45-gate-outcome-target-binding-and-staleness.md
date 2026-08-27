# D-45 — gate outcomes bind to the version they examined, and go stale when it moves

**Status**: **DECIDED — authorised 2026-08-26 by the Project Owner (Step C2C/C2D remediation)**
**Owner**: Project Owner (Product)
**Authorises**: `FR-ENH-025`–`FR-ENH-030`, `SC-ENH-006`, `SC-ENH-007` in
[EPIC-021](../../021-review-gates-roles/spec.md)
**Discharges**: finding `G2` — *"target binding and staleness are implemented but not yet
recorded as normative requirements"*
**Precedent**: `D-44` and `D-41`, which authorised documents the same way

## The question

C2C implemented gate-outcome **target binding** and **staleness**: an outcome is bound to the exact
specification version, lifecycle statuses and gate-set version it examined, and any change to those
makes it stale rather than authoritative.

The behaviour was correct and tested. Its **provenance** was not. `FR-ENH-012`–`016`, EPIC-021's
approved requirements, say nothing about binding an outcome to the version it examined — so the
implementation rested on a remediation instruction rather than on anything normative. C2D reported
this as `G2` and left the requirements marked *SRS-unsourced*.

That is not a state a requirement can stay in. Constitution II makes the SRS the source of truth,
and a requirement whose only justification is "a prompt asked for it" is exactly what that principle
exists to prevent. Reporting `G2` closed while the requirements described themselves as unsourced
would have been two contradictory claims in one report.

## The decision

**The C2C/C2D remediation authorisation is the current source of `FR-ENH-025`–`FR-ENH-030`.**

The reasoning is recorded rather than assumed: an outcome not bound to the version it examined can
authorise a transition on a specification that has since changed. The gate examined one artifact and
the transition applies to another. That is not a theoretical gap — it is the `X11` finding, which
the Project Owner elevated to HIGH on precisely those grounds:

> *"an outcome not bound to the evaluated target version could authorize the wrong transition."*

## What this does NOT do

It does not make the requirements SRS-sourced. `PMI-DOC-004` still has no `BR-` covering gate
target binding, and this decision does not invent one — a decision file is an authorisation, not a
business requirement.

**The back-fill obligation stands**, and is recorded in EPIC-021's spec next to the requirements
themselves. It follows the standing pattern `T149`/`F-11.3` set for SRS-unsourced infrastructure:
proceed under a recorded owner authorisation, and back-fill the `BR-` when the document is next
revised.

## The historical fact, preserved

These requirements were **implemented before they were normative**. C2C built the behaviour, C2D
found it unsourced, and this decision sources it afterwards. That order is not ideal and is recorded
rather than tidied away: the implementation came first, and the requirement caught up.

## Consequences

- EPIC-021's `FR-ENH-025`–`FR-ENH-030` cite this decision as their current source.
- `G2` is closed. The back-fill obligation is tracked separately and is not a blocking finding.
- Traceability maps each requirement to its tasks and tests (`T1125`).
