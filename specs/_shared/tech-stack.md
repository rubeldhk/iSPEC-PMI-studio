# Technology Stack: PMI Studio Phase 1 Platform Core

**Epic**: `EPIC-001` | **Date**: 2026-08-02 | **Plan**: [plan.md](./plan.md)

The stack, why each piece is here, and what it would cost to change. Dependency register with
licences and risk is in [dependencies.md](./dependencies.md).

> **Re-examined against the AI-native amendment on 2026-08-13** —
> [ai-native-architecture.md](./ai-native-architecture.md) §B.1. **No preserved element requires
> replacement.** Three require extension and one (Docker) is demoted from *abstraction* to
> *provider*. Two candidate additions are recommended and not yet adopted: `pgvector` (`D-24`) and a
> model-routing layer beneath the agent gateway (`D-30`).

> **Version policy**: major/LTS lines are fixed here. Exact patch versions are pinned at
> implementation time via a lockfile and recorded in [dependencies.md](./dependencies.md). Nothing
> below asserts a specific patch release.

## At a glance

| Layer | Choice | Line | Reversibility |
|---|---|---|---|
| Language | TypeScript | 5.x | 🔴 Very hard |
| Runtime | Node.js | 22 LTS | 🔴 Very hard |
| API framework | NestJS | 10.x | 🟠 Hard |
| ORM / migrations | Prisma | 5.x | 🟡 Moderate |
| Database | PostgreSQL | 16 | 🟠 Hard |
| Queue | BullMQ | 5.x | 🟡 Moderate |
| Queue backing store | Redis or Valkey | 7.x | 🟢 Easy — see RAID **R-03** |
| Web framework | React | 18.x | 🟠 Hard |
| Build tool | Vite | 5.x | 🟢 Easy |
| Unit tests | Vitest | 1.x | 🟢 Easy |
| API tests | Supertest | 6.x | 🟢 Easy |
| Integration tests | Testcontainers | 10.x | 🟢 Easy |
| End-to-end | Playwright | 1.x | 🟢 Easy |
| Sandbox runtime | Docker Engine | 25+ | 🟠 Hard |
| Password hashing | Argon2id | — | 🟢 Easy |
| Monorepo | pnpm workspaces | 9.x | 🟡 Moderate |

## Rationale by choice

### TypeScript + Node.js 22 LTS ⚠ highest-impact decision

The engine contract is the architectural centre of this Epic. TypeScript makes it a **compile-time
interface** — an adapter that fails to satisfy it does not build. That is a stronger guarantee than
any test, and it is the single reason this language was chosen over the alternatives.

A single language across API, worker, and web also means contract types are shared verbatim with no
translation layer, which matters when the contract is the thing you are protecting.

**Rejected**: *Python + FastAPI* — superficially attractive because `specify` is Python, but the
adapter shells out to a CLI regardless (research R-001), so language affinity buys nothing.
*.NET / Java Spring* — both fit the enterprise profile with equal or better interface enforcement;
rejected only to avoid a second language against a TypeScript front end.

> **Override this if your team is already .NET or Java-heavy.** It is the decision most sensitive to
> team skill rather than technical merit, and the one I would most expect you to change.

### NestJS

Its module system maps directly onto the SRS layered architecture, and its DI container is precisely
the mechanism FR-019 needs: engine adapters register against an injection token and resolve per
project at runtime. Adding an engine becomes registering a provider — no calling code changes, which
is SC-008 stated as a framework feature rather than a convention.

**Rejected**: *Fastify / Express with manual wiring* — lighter, but the adapter registry, module
boundaries, and lifecycle would all be hand-built. That is the part NestJS already gets right for
this shape of problem.

### PostgreSQL 16 + Prisma

Traceability (FR-029 to FR-031) is a graph over artifacts needing referential integrity and
efficient traversal in both directions. Audit and version tables need append-only guarantees. Both
want a relational store with real foreign keys.

Prisma gives generated types consistent with the TypeScript-first decision, plus a clean migration
workflow. `workspace_id` is present on every table from the first migration, so Phase 3 row-level
security is a switch rather than a migration.

**Rejected**: *MongoDB* — the traceability graph and audit integrity want foreign keys. *SQLite* —
no concurrent write story for parallel generation jobs. *TypeORM* — viable; Prisma preferred for
type generation and migration ergonomics.

### BullMQ on Redis/Valkey

Generation is long-running, cancellable, and must survive restarts. BullMQ provides durable job
state, per-job timeouts (FR-025), cancellation of in-flight work (FR-024), progress reporting
(FR-028), and idempotent job keys — which gives the duplicate-submission edge case for free.

> **Licence caution**: Redis relicensed away from BSD in 2024. Valkey is the BSD-licensed fork and
> is wire-compatible. Treat the backing store as interchangeable and default to Valkey unless you
> have a Redis entitlement. Tracked as RAID **R-03**.

**Rejected**: *Database-backed polling queue* — one fewer service, but cancellation and timeout
semantics would be hand-built and weaker. *Cloud-native queues* — forces a hosting decision Phase 1
does not need to make and complicates local development.

### React + Vite

Conventional, well-staffed, and the programme anticipates a substantial UI (`PMI-DOC-005`, a full design
system, a screen specification for every screen). Vite keeps the feedback loop fast.

**Note**: no component library is chosen. `PMI-DOC-005` (approved 2026-08-20) defines the design
system; the build-vs-adopt choice is decision `D-42`, EPIC-029 `T890`. Phase 1 UI is deliberately
plain until that Epic lands. *(Was: "SRS Volume 8 defines a design system that does not exist
yet" — a volume never written, corrected by `D-41`.)*

### Docker for the engine sandbox ⚠ non-negotiable in this design

The AI coding agent writes files and executes commands by design (research R-001). A container gives
a reliable resource ceiling, a kill switch that actually works, and a network boundary. Without it,
generation is a remote code execution path into the platform.

**Rejected**: *same-host subprocess* — no blast-radius containment, no reliable timeout enforcement.
*Firecracker / gVisor* — stronger isolation, more operational weight than Phase 1 warrants; revisit
if untrusted third-party engines are ever registered.

### Testing stack

Constitution V makes unit tests mandatory per task, and the real engine is slow, costly, and
non-deterministic. The fixture adapter makes engine-dependent logic testable without invoking an AI
agent; Testcontainers keeps workspace-isolation tests honest against a real database, because
mocking the database would make SC-004 meaningless.

## Language and runtime boundaries

| Component | Language | Notes |
|---|---|---|
| API, worker, adapters, web | TypeScript | Single language |
| Database migrations | Prisma schema + SQL | [schema.sql](./schema.sql) is the design-level DDL; `schema.prisma` is authoritative at implementation |
| Engine sandbox image | Dockerfile + shell | Contains the Python-based `specify` CLI and the AI agent CLI — **not** platform code |
| CI | GitHub Actions YAML | |

The engine image is the one place a non-TypeScript toolchain appears, and it is deliberately sealed
behind the adapter.

## What this stack does NOT decide

- **Hosting** — containers imply nothing about where they run
- **AI provider and model** — engine image configuration, recorded per artifact (FR-022)
- **Observability tooling** — audit is built; telemetry is an ops choice
- **Component library / design system** — `PMI-DOC-005` approved 2026-08-20; the library choice awaits decision `D-42` (EPIC-029 `T890`), not the never-written SRS Volume 8 (`D-41`)
- **Secrets management** — an environment concern, not a Phase 1 requirement

## Change cost

If you want to revisit anything, do it **before** `/speckit-implement`:

| Change | Impact |
|---|---|
| Language/runtime | Invalidates nearly every file path across all 156 tasks |
| API framework | Rewrites the backend module structure and adapter registration; ~40 tasks |
| Database or ORM | Rewrites schema, migrations, repositories; ~25 tasks |
| Sandbox approach | Rewrites T086–T092 and weakens FR-024 to FR-027 |
| Queue backing store | Configuration only — Redis ↔ Valkey is a swap |
| Test tooling | Configuration plus test file headers |
| Frontend framework | Rewrites 14 UI tasks; backend untouched |
