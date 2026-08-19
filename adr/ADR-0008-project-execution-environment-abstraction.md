# ADR-0008 — ProjectExecutionEnvironment abstraction

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Conflict `C-20`, rated CRITICAL and time-sensitive: `T646` — the next task in the programme —
was about to implement a production `ContainerRuntime` **inside the Spec Kit engine adapter**, where
the interface was declared. Native §4 forbids it directly: *"PMI Studio business logic must not
depend directly on Docker."*

Implementing it there would have made Docker the abstraction rather than a provider.

## Decision

`ContainerRuntime` and `SandboxSession` are **deleted** from the engine adapter and replaced by
`ProjectExecutionEnvironment` and `ExecutionSession` in `packages/execution-contract`. Docker becomes
a provider behind that port, in `execution-providers/docker`, registered at the worker composition
root.

`ExecutionSession` is deliberately identical in shape to the `SandboxSession` it replaces, so this
is one change rather than two wearing one name.

The Docker provider talks to the Docker Engine HTTP API over its unix socket — no `dockerode`, no
`docker` CLI.

## Consequences

**Positive** — every `ADR-0002` control is now asserted field-by-field in CI against a mocked
daemon, which was never possible while the interface lived inside the adapter. A Kubernetes provider
becomes a sibling registration rather than a rewrite, which matters because `D-31` makes the second
provider near-certainly Kubernetes.

**Negative** — one more package and one more registry.

**Accepted cost** — no real container has ever started. `T646b` remains outstanding.

## Traceability

C-20 · D-21 · FR-AGT-006 to FR-AGT-009 · EPIC-028 · extends ADR-0002
