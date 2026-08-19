# ADR-0013 — Controlled network egress

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Conflict `C-22`, and the amendment's **only direct conflict with a built and tested control**.
`ADR-0002` permits egress to the AI provider endpoint only, asserted by a test. Native §19 requires
that policy re-evaluated because implementation agents may need package registries, repository
endpoints and MCP servers — while also warning: *"Do NOT simply open general internet access."*

## Decision

**Named `EgressProfile` values, proxy-enforced** (`D-28`).

`generation` keeps today's policy **and today's test, unchanged** — frozen by a committed content
hash so a change to it fails a check rather than passing quietly.

`implementation` is a new, deliberately minimal profile with one destination. A guessed
npm/PyPI/GitHub list would be untested, would read as authoritative, and would be inherited as
settled (`R-028-6`).

`assertEgressProfile` rejects `*`, `0.0.0.0/0`, `::/0` and an empty destination list. A provider
declaring `supportsNetworkPolicy: false` cannot accept any profile at all.

**`ADR-0002` is EXTENDED, not superseded** (`D-36`).

## Consequences

**Positive** — the policy becomes auditable rather than merely configured, which matters more
under `D-31` because the sandbox host is shared between tenants.

**Negative** — a proxy is a new operational component, and it lands on the SaaS platform rather than
on a customer. **It is not built**, and the concrete destination list stays open (`R-AI-009`).

## Traceability

C-22 · D-28 · D-36 · R-AI-009 · SC-AGT-005 · extends ADR-0002
