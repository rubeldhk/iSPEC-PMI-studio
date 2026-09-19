# ADR-0017 — Interactive developer workspace versus autonomous agent sandbox

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: the interactive workspace epic, which does not yet exist

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
