# ADR-0020 — Engineering Expert model for registered agents

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Cosmos §3.3 asks that registered agents be governed **Engineering Experts** rather than a model
plus a prompt, declaring identity, role, preferred and fallback model, cost policy, context policy,
capabilities, allowed tools, workspace requirements, permissions, prohibited actions, approval
requirements, risk classification, memory policy, required outputs and an **Evidence Contract**.

EPIC-028 built an `AgentRegistry` and an `AgentDescriptor` (`PRE-016`, partial).

## Decision

**Extend `AgentDescriptor` rather than replace it.** The built descriptor already carries
provider, model, agent version, execution type, capabilities, context limits, tool capabilities, MCP
support, repository capabilities, cost metadata, security classification and unattended support.

Cosmos adds role, fallback model, retrieval strategy, prohibited actions, approval requirements,
risk classification, memory policy and the evidence contract. **These are fields on an existing
type**, not a new abstraction — which is why this ADR is decided rather than open.

## Consequences

**Positive** — the seam exists and is provider-neutral by construction, so extension is additive.

**Negative** — the evidence contract cannot be enforced until the Evidence Package capability exists,
so some fields will be declared before anything reads them.

## Traceability

Cosmos §3.3 · PRE-016 · FR-AGT-002 · EPIC-028
