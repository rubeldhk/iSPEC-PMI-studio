# ADR-0010 — PMI Studio MCP architecture

**Status**: Accepted (2026-09-04) — **closed as delivered by `EPIC-043`**; `R-AI-014` resolved as project-scoped connector credentials (see *Closure* below)
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)
**Awaits**: `R-AI-014` (MCP least-privilege authorization model)
**Discharged**: PMI-DOC-004 — approved v2.0, 2026-08-22. `BR-0122` makes MCP a first-class
transport, and `ADR-0023` places it at the adapter layer rather than the business abstraction

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

## Closure — 2026-09-04, `EPIC-043` `/speckit-plan` (`FR-PIC-060`)

**`R-AI-014` is resolved.** The least-privilege authorisation model for the agent-facing MCP
surface is the **project-scoped connector credential** `EPIC-041` built: minted once, stored as a
digest, resolved on every call to a `connector` Principal, scoped to exactly one project, and
permitted only the operations registered in the connector scope registry (eleven scopes —
`specs/043-pmi-integration-contract/data-model.md` §8). A credential cannot read a Room, approve a
transition or administer a workspace, because no route with those effects carries a registered
scope.

**The agent-facing surface ships as the stdio server `pmi-studio`** (`packages/mcp-server`), a
REST client of the mounted `EPIC-037` registry and of three reads — health, project context,
requirements — per `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md`. The nine
capabilities this record named (`getAllowedContext` … `proposeChangeRequest`) map onto that
surface as follows: context and requirement reads are delivered here; specification, task and
traceability reads, implementation results, test evidence, defects and change requests arrive
through the same server as `EPIC-045`, `EPIC-046`, `EPIC-032`, `EPIC-035` and `EPIC-034` bind
their operations to it — each a tool added to one server, not a second server.

**`PC-1` holds as decided**: the server is a transport over existing services and contains no
business logic (`FR-PIC-011`, enforced by `mcp-server-boundary.spec.ts`). **`ADR-0023`** stands:
MCP sits at the adapter layer. Third-party server registration and the marketplace remain at M-09
Phase 3 (`EPIC-039`), unchanged by this closure.

Traceability added: `EPIC-041` · `EPIC-043` · `FR-PIC-020`–`FR-PIC-027` · `ADR-0030`
