---
subject: architecture
scope: repository
version: 1
status: active
owner: tech-lead
last_reviewed: 2026-08-07
supersedes: null
---

# Architecture

## Why this exists

The design lives in [`specs/_shared/system-design.md`](../../specs/_shared/system-design.md) and the
[ADRs](../../adr/). This file does not repeat either. It states the boundaries that must hold while
code is being written, because those are the ones broken by a plausible-looking shortcut rather than
by a deliberate decision.

## Standards

### ARC-001 · Services are callable without HTTP

Application logic is reachable as a function call. The HTTP layer is a caller, never the only door.

**Check**: architecture test `T142a`, run under `pnpm test:arch`.
**Rationale**: Design constraint **PC-1**. The worker invokes the same logic as the API; if that
logic only exists behind a route, the worker has to talk to its own process over a socket, and
every test needs a server.

### ARC-002 · The engine is reached through the adapter contract only

Nothing outside `engine-adapters/` imports a concrete engine. Callers depend on
`SpecificationEngine` in `packages/engine-contract/`.

**Check**: `backend/tests/architecture/engine-independence.spec.ts` — asserts both the absence of
concrete imports and the presence of the contract.
**Rationale**: [ADR-0001](../../adr/ADR-0001-engine-adapter.md). Spec Kit is a scaffolding CLI, not
a callable API; the runtime that drives it is one implementation among several, and the fixture
engine has to be substitutable or nothing is testable without a sandbox.

### ARC-003 · Engine output is never logged

Output from a generation run does not reach a log sink, a metric label, or an error message.

**Check**: `pnpm test:unit` covers the failure taxonomy and logger paths; reviewed at code review.
**Rationale**: Engine output may carry customer requirements. A log aggregator is a copy of that
content in a system with different access controls and a different retention policy.

### ARC-004 · Telemetry does not leave the sandbox

The correlation id travels **into** the container as an environment variable. Nothing observable
travels out of it.

**Check**: `engine-adapters/speckit/src/correlation.ts` — `buildSandboxEnvironment` returns exactly
two keys, asserted by its unit test.
**Rationale**: Design constraint **PC-3**, and the asymmetry is deliberate. Emitting telemetry from
the container requires widening egress beyond the AI provider endpoint, which weakens
[ADR-0002](../../adr/ADR-0002-container-sandbox.md) for a convenience.

### ARC-005 · A structural stub stays structural

Where a table exists only to satisfy a foreign key ahead of its owning epic, it carries no
behaviour and grows no columns until that epic starts.

**Check**: code review against the schema; the `Project` stub is annotated in
[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma).
**Rationale**: The stub resolves a real seam without pre-empting EPIC-006's design. A stub that
accretes fields becomes the design, chosen by whoever needed a column first.

## Deliberately not covered here

- **The architecture itself** — [`specs/_shared/system-design.md`](../../specs/_shared/system-design.md).
- **Why each structural decision was taken** — the [ADRs](../../adr/README.md).
- **The schema** — [`specs/_shared/schema.sql`](../../specs/_shared/schema.sql) and
  [`specs/_shared/data-model.md`](../../specs/_shared/data-model.md).
