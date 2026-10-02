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

## Amendment 2026-09-03 — scoped to managed mode by `ADR-0030` (`EPIC-041`, `D-47`)

*"The git remote is the durable substrate. Volumes are cache only"* was written when the only
workspace was a container's scratch area. `ADR-0030` adds a **controlled-local** mode in which the
workspace is the developer's own project directory and its git repository. In that mode the
directory **is** the durable substrate for artifact content — there is no remote to be authoritative
over it, and calling it a cache would license discarding the user's work.

The decision above therefore holds **for managed-isolated execution** and is otherwise amended:

| Mode | Durable substrate for content | Durable substrate for status, decisions, evidence |
|---|---|---|
| Managed isolated | the git remote; volumes are cache | PMI Studio |
| Controlled local | **the project directory and its git repository** (PMI-DOC-007 §2.3) | PMI Studio |

Native §5's invariant — *"No sandbox state may implicitly become authoritative project state"* —
is untouched, because a controlled-local workspace is not sandbox state: it is a `persistent`
binding with a named `projectRef`, which is the shape the `WorkspaceBinding` union was built to
make explicit. The Docker provider's refusal of persistent bindings stands **for the Docker
provider** (`EPIC-041` `FR-LPW-033`) and is no longer a statement about the contract.

`C-21` — *persistent project state has no home* — is closed by `EPIC-041`.

## Traceability

C-21 · D-22 · FR-AGT-008 · Native §5 · EPIC-028 · EPIC-029 (proposed) · **`ADR-0030` · `EPIC-041`
(`FR-LPW-013`, `FR-LPW-030`, `FR-LPW-033`) · PMI-DOC-007 §2.3, §9.2 · `D-47`**
