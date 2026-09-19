# ADR-0003 — TypeScript / NestJS / PostgreSQL stack

**Status**: Accepted
**Date**: 2026-08-02 (recorded as an ADR 2026-08-03)
**Deciders**: Project owner, tech lead

## Context

EPIC-001 needs a runtime for an API, an asynchronous worker that spawns sandboxed containers, and a
web interface — with the specification engine contract (ADR-0001) at its centre.

The contract is the thing most worth protecting. Whatever else changes, an adapter that fails to
satisfy it must not reach production.

## Decision

| Layer | Choice |
|---|---|
| Language / runtime | TypeScript 5.x on Node.js 22 LTS |
| API framework | NestJS 10.x |
| ORM / migrations | Prisma 5.x |
| Database | PostgreSQL 16 |
| Queue | BullMQ on **Valkey** (see Consequences) |
| Web | React 18 + Vite 5 |
| Sandbox | Docker Engine (ADR-0002) |
| Tests | Vitest, Supertest, Testcontainers, Playwright |

Organised as a pnpm workspace monorepo.

## Rationale

- **TypeScript** makes the engine contract a *compile-time* interface — a non-conforming adapter
  does not build. That is a stronger guarantee than any test, and it was the deciding factor.
- **NestJS** dependency injection is the mechanism FR-019 needs: adapters register against an
  injection token and resolve per project, so adding an engine changes no calling code.
- **PostgreSQL** because traceability is a graph needing referential integrity and both-direction
  traversal, and because audit and version tables need database-enforced append-only behaviour.
- **Prisma** for generated types consistent with the TypeScript-first decision.

## Consequences

**Positive**

- One language across API, worker, adapters, and web; contract types shared verbatim.
- Schema-level enforcement of invariants — a failed job cannot be stored without a named reason;
  audit rows reject UPDATE and DELETE.

**Negative**

- Structural lock-in to NestJS and Prisma. Reversible only at high cost.
- **This is the decision most sensitive to team skill rather than technical merit.** RAID **R-09**
  tracks the risk that it mismatches the delivery team. Reversing it invalidates nearly every file
  path across 200+ tasks, so it must be confirmed before implementation begins.

**Licence note**: Redis relicensed away from BSD in 2024. **Valkey** — the BSD fork — is the default
backing store; BullMQ and ioredis speak the same protocol, so it is a configuration choice, not a
code change. Tracked as RAID **R-03**.

**Rejected alternatives**

- *Python + FastAPI* — superficially attractive because `specify` is Python, but the adapter shells
  out to a CLI regardless, so language affinity buys nothing.
- *.NET / Java Spring* — equal or better interface enforcement; rejected only to avoid a second
  language against a TypeScript front end. **Reconsider if the team is already .NET-heavy.**

## Traceability

- Research: R-002, R-003, R-004, R-005, R-010
- Principles: PP-005, PP-014, PP-015
- Risks: RAID R-03, R-09
- Documents: `tech-stack.md`, `dependencies.md`, `schema.sql`
