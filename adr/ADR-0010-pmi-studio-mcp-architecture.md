# ADR-0010 — PMI Studio MCP architecture

**Status**: Open
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: R-AI-014 (MCP least-privilege authorization model) and PMI-DOC-004

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Conflict `C-25`: MCP was deferred to M-09 Phase 3 as a **marketplace**, and the amendment makes
it the agent's least-privilege access path to governed context — a different thing at a different
phase.

Native §10 requires MCP to respect PC-1: *"MCP is another transport over existing application
capabilities, not another implementation of business logic."*

## Decision

**Split, per `D-26`.** The agent-facing least-privilege context surface —
`getAllowedContext`, `getRequirement`, `getSpecification`, `getTask`, `getTraceability`,
`submitImplementationResult`, `submitTestEvidence`, `reportDefect`, `proposeChangeRequest` — joins
core agent enablement. Third-party server registration, discovery and the marketplace stay at M-09
Phase 3.

**Open** on the authorization model. `R-AI-014` is uninvestigated, and the agent-facing surface
cannot ship without it.

## Consequences

**Positive** — `PC-1` is vindicated: MCP is a second transport over services already tested as
transport-independent, which is the condition on which `C-07`'s deferral was accepted.

**Negative** — `C-07`'s deferral is narrowed rather than reversed, so the phase boundary now runs
through the middle of one protocol.

## Traceability

C-25 · C-07 · D-26 · R-AI-014 · PC-1 · EPIC-013 · M-09
