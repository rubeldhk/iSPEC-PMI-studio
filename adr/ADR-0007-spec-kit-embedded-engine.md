# ADR-0007 — Spec Kit as an embedded engine, not an application dependency

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Native §6 asks that Spec Kit operations become PMI Studio services rather than user-entered
slash commands, and that *"users must not be required to know Spec-Kit commands."*

The corpus already places Spec Kit behind `SpecificationEngine` (`ADR-0001`), so the engine boundary
exists. What does not exist is the product surface that would let a user drive it without knowing it
is there.

## Decision

Keep Spec Kit strictly behind the `SpecificationEngine` contract, and treat its command surface
as an **implementation detail of the adapter**. `EPIC-028` made `SpecKitEngine` the default engine,
so the platform now resolves it without naming it at any call site.

Surfacing the lifecycle as PMI Studio workflows — requirement to specification to plan to tasks
without a slash command — is **product surface owned by EPIC-008 and EPIC-013**, and stays held
behind `PMI-DOC-004`.

## Consequences

**Positive** — the seam is already built and proven; nothing further is needed at the engine
layer.

**Negative** — the user-facing half is held, so the amendment's ask is only half satisfied and will
remain so until the BRS lands.

## Traceability

Native §6 · FR-018 · EPIC-008 · EPIC-013 · preserves ADR-0001
