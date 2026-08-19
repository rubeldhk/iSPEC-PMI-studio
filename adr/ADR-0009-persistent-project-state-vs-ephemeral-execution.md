# ADR-0009 — Persistent project state versus ephemeral agent execution

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Conflict `C-21`: the current design destroys the workspace by construction and never commits
it, so persistent project state has no home. Native §5 requires the two to be separated explicitly
and states the invariant: *"No sandbox state may implicitly become authoritative project state."*

## Decision

**The git remote is the durable substrate.** Volumes are cache only and always reconstructible.

The `WorkspaceBinding` discriminated union makes the dangerous state **unrepresentable**: a binding
is either `ephemeral` with a scratch path, or `persistent` with a project reference, a mode and a
branch. There is no binding that is persistent and unnamed, so promotion always goes through git.

The Docker provider declares `supportedLifecycles: ['ephemeral']` and **refuses** a persistent
binding with `policy_refused`, naming the reason.

## Consequences

**Positive** — no new storage tier to operate, back up or isolate per tenant, which matters more
under `D-31` than it would have otherwise. `PersistentProjectState` becomes a reference plus a cache
policy rather than a storage entity — a materially smaller build.

**Negative** — every run pays clone or fetch time. Mitigated by caching, never by treating the cache
as authoritative.

## Traceability

C-21 · D-22 · FR-AGT-008 · Native §5 · EPIC-028 · EPIC-029 (proposed)
