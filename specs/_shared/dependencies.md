# Third-Party Dependency Register: PMI Studio Phase 1

**Epic**: `EPIC-001` | **Date**: 2026-08-02 | **Plan**: [plan.md](./plan.md)

Every third-party component the platform depends on, why it is here, and what it exposes us to.

> ## ⚠ Licence verification required before implementation
>
> Licence positions below are **stated as expected, not verified**. Open-source licensing changes —
> Redis is the live example (see D-08 and RAID **R-03**). Every entry must be confirmed against the
> actual package metadata at version-pin time, and the "Verified" column updated. Do not treat this
> table as a legal clearance.

## Runtime dependencies — backend and worker

| ID | Component | Line | Purpose | Expected licence | Verified | Risk |
|----|-----------|------|---------|------------------|----------|------|
| D-01 | Node.js | 22 LTS | Runtime | MIT | ☐ | Low — LTS, broad support |
| D-02 | TypeScript | 5.x | Language, contract enforcement | Apache-2.0 | ☐ | Low |
| D-03 | NestJS | 10.x | API framework, DI, adapter registration | MIT | ☐ | Medium — deep structural coupling |
| D-04 | Prisma | 5.x | ORM, migrations, type generation | Apache-2.0 | ☐ | Medium — schema and repositories coupled |
| D-05 | PostgreSQL | 16 | Primary datastore | PostgreSQL Licence | ☐ | Low — permissive, stable governance |
| D-06 | BullMQ | 5.x | Job queue, cancellation, timeouts | MIT | ☐ | Medium — job semantics coupled |
| D-07 | ioredis | 5.x | Redis/Valkey client | MIT | ☐ | Low |
| **D-08** | **Redis or Valkey** | **7.x** | **Queue backing store** | **⚠ See note** | ☐ | **HIGH — licence** |
| D-09 | argon2 (node) | 0.4x | Argon2id password hashing | MIT | ☐ | Low |
| D-10 | class-validator / class-transformer | 0.14 / 0.5 | Request validation | MIT | ☐ | Low |
| D-11 | dockerode (or Docker CLI) | 4.x | Sandbox container lifecycle | Apache-2.0 | ☐ | Medium — sandbox control path |
| D-11a | @opentelemetry/sdk-node + auto-instrumentations | 0.5x / 0.5x | Traces and metrics (PP-010, research R-011) | Apache-2.0 | ☐ | Low — vendor-neutral by design |
| D-11b | pino | 9.x | Structured JSON logging with request/job context | MIT | ☐ | Low |

### D-08 in detail — the one that needs a decision

Redis changed licence in 2024, moving away from BSD to source-available terms, and has changed again
since. **Valkey** is the BSD-licensed fork, wire-compatible and a drop-in replacement.

- **Exposure**: source-available terms can restrict commercial redistribution and managed-service
  offerings — directly relevant to an enterprise platform you intend to sell.
- **Mitigation**: default to **Valkey**. BullMQ and ioredis speak the same protocol, so this is a
  configuration change, not a code change.
- **Action**: confirm the licence of the exact version you deploy before it ships. Tracked as RAID
  **R-03**.

## Runtime dependencies — frontend

| ID | Component | Line | Purpose | Expected licence | Verified | Risk |
|----|-----------|------|---------|------------------|----------|------|
| D-12 | React | 18.x | UI framework | MIT | ☐ | Low |
| D-13 | React Router | 6.x | Client routing | MIT | ☐ | Low |
| D-14 | TanStack Query | 5.x | Server state, polling job status | MIT | ☐ | Low |
| D-15 | Vite | 5.x | Build and dev server | MIT | ☐ | Low |

No component library is listed deliberately — `PMI-DOC-005` (approved 2026-08-20) defines the
design system and leaves the build-vs-adopt choice to decision `D-42`. *(Was: "SRS Volume 8", a
volume never written — corrected by `D-41`.)* The system does not
exist yet. Choosing one now would pre-empt it.

## Engine sandbox image

These live **inside the container**, never in platform code. This is the boundary that keeps Spec
Kit out of the platform.

| ID | Component | Purpose | Expected licence | Verified | Risk |
|----|-----------|---------|------------------|----------|------|
| D-16 | Spec Kit (`specify` CLI) | Scaffolds the workspace | MIT | ☐ | **HIGH — see below** |
| D-17 | AI coding agent CLI | Executes `/speckit-*` commands | Vendor terms | ☐ | **HIGH — see below** |
| D-18 | Python | Runtime for `specify` | PSF | ☐ | Low |
| D-19 | git | Workspace initialisation | GPL-2.0 | ☐ | Low — invoked as a tool, not linked |
| D-20 | Base OS image | Container base | Distribution terms | ☐ | Low |

### D-16 / D-17 — the engine dependencies

These are the highest-risk dependencies in the Epic, and the adapter layer exists precisely because
of them.

- **Version coupling**: Spec Kit template changes alter generated output shape, which can break the
  parser. Pin the version in the image; never track latest.
- **Model coupling**: the same Spec Kit release with a different AI model produces different output.
  `descriptor.version` records **both** (FR-022).
- **Vendor terms**: the AI agent CLI and the model API carry commercial terms, rate limits, and
  per-token cost. Review before production.
- **Cost**: each generation is a metered AI agent run. Unbounded jobs mean unbounded spend — the
  wall-clock and resource caps are a cost control as much as a safety control.
- **Containment**: all of this sits behind the engine contract. Replacing the engine is an adapter
  change, which is the entire architectural bet.

## Development and test dependencies

| ID | Component | Line | Purpose | Expected licence | Verified |
|----|-----------|------|---------|------------------|----------|
| D-21 | Vitest | 1.x | Unit tests (Constitution V) | MIT | ☐ |
| D-21a | @testing-library/react + jest-dom | 16.x / 6.x | Component unit tests — how the 14 UI tasks satisfy Constitution V | MIT | ☐ |
| D-22 | Supertest | 6.x | API contract tests | MIT | ☐ |
| D-23 | Testcontainers | 10.x | Integration against real PostgreSQL/Valkey | MIT | ☐ |
| D-24 | Playwright | 1.x | End-to-end | Apache-2.0 | ☐ |
| D-25 | ESLint | 9.x | Linting, dependency-boundary rule | MIT | ☐ |
| D-26 | Prettier | 3.x | Formatting | MIT | ☐ |
| D-27 | pnpm | 9.x | Workspace and package management | MIT | ☐ |

## Infrastructure

| ID | Component | Purpose | Expected licence | Verified | Risk |
|----|-----------|---------|------------------|----------|------|
| D-28 | Docker Engine | Sandbox execution | Apache-2.0 | ☐ | Medium — required on every host running the worker |
| D-29 | GitHub Actions | CI | Vendor terms | ☐ | Low — Constitution names GitHub as canonical |

**Docker Desktop note**: Docker Engine is Apache-2.0, but **Docker Desktop** has commercial licence
terms for larger organisations. Developer workstations may need licences even though servers do not.
Easy to overlook; tracked as RAID **R-08**.

## Dependency policy

| Rule | Why |
|---|---|
| Exact versions pinned in a committed lockfile | Reproducible builds; engine output stability |
| Spec Kit and AI agent versions pinned in the image, never `latest` | Template drift silently changes output |
| Every dependency listed here before it is added | Prevents undeclared transitive risk |
| Licence verified at pin time, table updated | This register is expectation, not clearance |
| Automated vulnerability scanning in CI | Standard practice |
| A new runtime dependency is a plan change, not a task decision | Constitution I — code changes flow through Spec Kit commands |

## Supply-chain exposure summary

| Concern | Where | Handling |
|---|---|---|
| Licence change in a core dependency | D-08 Redis | Default to Valkey; verify before ship |
| Commercial terms on developer tooling | D-28 Docker Desktop | Confirm organisational entitlement |
| Vendor terms and metered cost | D-16, D-17 | Review before production; enforce caps |
| Generated-output drift | D-16, D-17 | Pin versions; store raw output; record engine version |
| Framework lock-in | D-03 NestJS, D-04 Prisma | Accepted — structural, reversible only at high cost |
| Observability backend lock-in | D-11a OpenTelemetry | **Avoided** — collector endpoint is configuration; no vendor SDK in application code (PP-015) |
| Untrusted execution | D-17 in sandbox | Container isolation, egress allow-list, no platform credentials |
