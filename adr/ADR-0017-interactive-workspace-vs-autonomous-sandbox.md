# ADR-0017 — Interactive developer workspace versus autonomous agent sandbox

**Status**: Accepted (2026-09-04) — **owned since 2026-09-03 by `EPIC-041` Local Project Workspace** (`D-47`, `ADR-0030`). The interactive developer workspace is the controlled-local mode `ADR-0030` defines (a directory the user's own agent works in, provisioned by `EPIC-041`); the autonomous agent sandbox stays managed-isolated. Both modes share one governance contract and differ only in their recorded assurance.
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: ~~the interactive workspace epic, which does not yet exist~~ **`EPIC-041`'s closure.**
The epic now exists; this record moves to Accepted when it closes, with the decision that the
interactive workspace is the developer's own provisioned directory (`ADR-0030`), not a platform
surface.

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Native §21 requires two execution modes — an autonomous agent run initiated by PMI Studio, and
an interactive engineering workspace an authorised developer connects to — and states the constraint
plainly: *"Interactive IDE choice must not determine PMI Studio architecture."*

Only the autonomous path is built.

## Decision

**Open.** The autonomous path is delivered by EPIC-028: an agent runs inside a
`ProjectExecutionEnvironment` under an egress profile with scoped credentials.

The interactive path is a distinct product surface with no owning epic. What is decided is that it
**changes nothing architecturally**: interactive work must respect the same repository permissions,
branch protection, governance gates, Change Request policy, traceability, CI/CD and audit.

## Consequences

**Positive** — the built seams already support it; a developer session is another consumer of the
same execution environment.

**Negative** — remains unowned and unspecified.

## Traceability

Native §21 · Native §9 · EPIC-028 · interactive workspace epic (unowned)
