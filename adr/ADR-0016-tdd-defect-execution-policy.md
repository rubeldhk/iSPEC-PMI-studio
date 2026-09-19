# ADR-0016 — TDD defect execution policy

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: the Defect Room epic, which does not yet exist

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

## Consequences

**Positive** — the expectation-verification gate prevents new functionality being implemented
under the label of bug fixing.

**Negative** — depends on approved baselines existing, which depends on the Requirement Room, which
depends on `PMI-DOC-004`.

## Traceability

Native §16 · Native §17 · Defect Management §3 to §11 · Defect Room epic (unowned)
