# ADR-0011 — Agent context authorization

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: R-AI-014 and the Context Engine epic, which does not yet exist

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Native §11 requires explicit Context Scope: *"Every agent run must receive only the context
required for its assigned work"*, and *"An implementation agent working TASK-123 must not
automatically receive unrestricted access to the entire organization/project."*

No Context Engine, `ContextScope` or context-curation capability exists in the corpus (`PRE-009`).

## Decision

`ContextScope` and `AccessSnapshot` become near-term entities. `AccessSnapshot` **already exists**
for EPIC-024, so this is reuse rather than invention (`FR-AMD-003`).

**Open** on the model itself: what an agent may see is an access-control decision, and the epic that
would own it does not exist. Recorded rather than designed, because designing it here would be the
scope creep `FR-AMD-016` forbids.

## Consequences

**Positive** — the reuse of `AccessSnapshot` avoids a second access model.

**Negative** — remains open, so agents currently receive whatever their invocation carries. Acceptable
only because no implementation agent runs unattended yet.

## Traceability

Native §11 · R-AI-014 · EPIC-024 · Context Engine epic (unowned)
