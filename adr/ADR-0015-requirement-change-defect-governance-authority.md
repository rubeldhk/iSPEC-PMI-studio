# ADR-0015 — Requirement, Change and Defect governance authority

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: PMI-DOC-004 and the project owner confirming Finding A

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

**Open.** The three Rooms are recorded as new held epics behind `PMI-DOC-004`, which is precisely
the document that should settle requirement-approval behaviour.

What is decided: agents **may not** autonomously change authoritative business intent (Native §12),
and PMI Studio controls state transitions. What is open: the role model, the approval thresholds and
the risk banding Cosmos §7 proposes.

## Consequences

**Positive** — the false premise is settled before anyone plans against it. "Enhance" and "build"
are different budgets, and three Rooms mis-sized is a programme-level estimate error.

**Negative** — three of the twenty capability areas remain unowned until epics are created.

## Traceability

Finding A · D-32 · D-33 · PRE-001 to PRE-004 · Native §12 to §15
