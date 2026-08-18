# ADR-0006 — AI Agent Gateway and provider independence

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Native §2 extends the existing engine-independence rule to AI providers. Before EPIC-028,
`engine-adapters/speckit/src/speckit.adapter.ts` named `claude` in four places and took a single
`aiProviderToken`, so **swapping the AI provider and swapping the specification engine were the same
edit** — the merge Native §3 forbids in its own words: *"Do NOT merge SpecificationEngine and
AgentExecutor. They represent different abstractions."*

This was recorded as conflict `C-19` and rated CRITICAL, because the violation existed in the tree
and nothing could detect it.

## Decision

Introduce `packages/agent-contract` declaring `AgentGateway`, `AgentDescriptor`,
`AgentInvocation` and a closed `AGENT_FAILURE_REASONS` enum with no `unknown` member.

`backend/**` may import the contract and may never import an agent adapter. Adapters are supplied at
the **worker composition root**, exactly as engine adapters are. `SpecKitEngine` takes an injected
`AgentGateway` and reads `descriptor.specKitIntegrationName` instead of naming a provider.

Enforced by `backend/tests/architecture/agent-independence.spec.ts`, which fails the **build** — not
a review — when a provider identifier appears under `backend/src` or in any engine adapter,
including as a bare string.

**ADR-0001 is extended, not superseded.** Its rule was right; its scope was one layer too narrow.

## Consequences

**Positive** — the AI provider is swappable, and `agent-swap.spec.ts` proves it by driving one
agent-agnostic caller against two adapters with identical result shape, identical failure
classification and distinct provenance.

**Negative** — a second adapter family to maintain, and every future agent must implement the shared
conformance suite.

**Accepted cost** — `ClaudeAgent`'s invocation is written against the documented CLI contract and has
never been executed against a real container. `R-AI-001`/`R-AI-002` remain uninvestigated; `T646b`
is the task that would settle them.

## Traceability

C-19 · D-20 · FR-AGT-001 to FR-AGT-005 · EPIC-028 · extends ADR-0001
