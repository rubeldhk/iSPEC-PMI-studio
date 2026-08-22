# ADR-0023 — Capability Resolver and the Integration Hub boundary

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Project owner (product boundary) · tech lead (architecture)

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 6, which names the Capability
> Resolver / Integration Hub boundary as an architecture decision the V2 scope model requires.

## Context

PMI-DOC-004 v1.0 §3 deferred the **MCP Marketplace** to Phase 2+, and in doing so deferred all of
MCP. The accepted Augment/Cosmos amendment then made MCP first-class inside an Integration Hub.
PMI-DOC-004A `G-14` classifies this as a **scope conflict** rather than a gap: two approved
documents disagreed about whether MCP is core.

The conflict dissolves once two different things stop sharing one name:

- a **public marketplace** — discovery, install, ratings, third-party publishing — which is an
  ecosystem product;
- a **capability abstraction and adapter registry** — how a governed workflow asks for engineering
  work to be done — which is core plumbing.

There is a second, larger risk. If workflows call vendor APIs directly, `BG-04` (no lock-in) becomes
unenforceable by construction: every workflow that names GitHub is a workflow that must be rewritten
to support GitLab. `EPIC-027`'s register already assigned *Integration Hub + Capability Resolver* to
a new epic (M-16), and `ADR-0010` (PMI Studio MCP architecture) remains **Open**.

## Decision

**Three layers, and the boundary between them is the decision.**

1. **Capability contracts** — core workflows request vendor-neutral engineering capabilities:
   `ReadRepository`, `SearchCode`, `CreateBranch`, `CreatePullRequest`, `RunTests`,
   `RunSecurityScan`, `ReadBuildStatus`, `DeployEnvironment`, `ReadTelemetry`, `CreateIssue`,
   `SendNotification`. A workflow names a capability, never a vendor (`BR-0120`).
2. **Capability Resolver** — a policy-aware selector that binds a requested capability to an
   authorized adapter using tenant configuration, policy, environment and adapter health
   (`BR-0121`).
3. **Adapters** — the implementations. An MCP server, a native API adapter, a CLI adapter, a
   customer connector, or another transport. Each exposes configuration, authorization, permission
   scope, health, version/compatibility and audit metadata (`BR-0123`).

**MCP is a transport at layer 3, not the abstraction at layer 1.** It is first-class among
transports and MUST be supported (`BR-0122`); it MUST NOT become the business vocabulary. A workflow
that would break if MCP were replaced has crossed the boundary this ADR draws.

**The public marketplace stays in the Expansion Plane** (PMI-DOC-004 v2.0 §3.3). Layers 1–3 are Core
Control Plane. This is what resolves `G-14`: the marketplace was correctly deferred, the abstraction
was not.

**Least privilege binds at resolution.** A session receives only the capabilities its task requires
(`BR-0124`), which is enforceable at layer 2 and unenforceable at layer 3 alone.

## Consequences

**Positive** — `BG-04` becomes testable rather than aspirational: replacing a Git or CI provider is
an adapter change with no core diff, which is exactly the assertion `BR-0126` requires. The v1.0
deferral of the marketplace survives intact, so no prior approval is reversed.

**Positive** — external tools can contribute typed evidence through the same registry
(`BR-0125`), so `ADR-0022`'s "evidence may come from specialist tools" has a mechanism.

**Negative** — the capability vocabulary is now an interface with versioning obligations. Adding a
capability is cheap; changing one is a breaking change across every adapter.

**Negative** — a resolver is an indirection, and indirection costs debuggability. `BR-0174` (policy
explainability) partly mitigates this: a resolution decision must be explainable.

**Open** — the initial capability list above is a starting set, not a closed enumeration. The owning
epic (`U-13`) fixes the v1 vocabulary.

## Traceability

PMI-DOC-004 v2.0 §6.13 (`BR-0120`–`BR-0126`) · PMI-DOC-004A `G-14`, `G-15`, Amendment E ·
`ADR-0010` (MCP architecture, Open) · `EPIC-027` capability area *Integration Hub + Capability
Resolver* → new epic M-16 · `specs/brs-v2-reconciliation.md` `U-13` · unowned
