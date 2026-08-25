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
| **D-30** | **@nestjs/serve-static** | **4.x** | Serves the built web client from the API on one origin, with the SPA history fallback (`EPIC-014` `R-014-1`) | MIT | ☐ | Low — a thin wrapper over the Express static handler the adapter already ships |

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
| D-12 | React | 18.x | UI framework (covers `react` and `react-dom`) | MIT | ☐ | Low |
| **D-13** | **React Router** | **7.x** | Client routing — **declarative mode only** (`BrowserRouter`/`Routes`/`Route`/`Outlet`), never framework mode. Adopted by `EPIC-036` for `FR-SHL-017`: addresses that survive a refresh, support back/forward, and answer not-found | MIT | ☐ | Low — v7 bridges React 18 to 19, so the `18.3.1` pin is unaffected |
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
| D-22 | Supertest + @types/supertest | 7.x / 6.x | API contract tests; **and from EPIC-030, the Constitution XI Tier 1 pattern for the backend** — driving a composed `AppModule` through its real HTTP routes | MIT | ☐ |
| D-23 | Testcontainers | 10.x | Integration against real PostgreSQL/Valkey | MIT | ☐ |
| D-24 | Playwright | 1.x | End-to-end | Apache-2.0 | ☐ |
| D-25 | ESLint | 9.x | Linting, dependency-boundary rule | MIT | ☐ |
| D-26 | Prettier | 3.x | Formatting | MIT | ☐ |
| D-27 | pnpm | 9.x | Workspace and package management | MIT | ☐ |

### D-22 in detail — recorded by EPIC-030 `T993d`, and it was already here

`TS-001` requires a register entry before a dependency enters a `package.json`. EPIC-030's research
verified `supertest` was absent from `backend/package.json` and **no `createNestApplication` test
existed anywhere in the repository** — both true — and concluded it was a new dependency. It is not:
`D-22` has carried it since the platform specification, declared for *"API contract tests"* that were
never written. The register was ahead of the code, which is the direction that costs nothing.

So `T993d` **augmented** this row rather than adding a `D-30` beside it. A second row for one library
is the duplication a register exists to prevent, and claiming to have recorded something already
recorded would be false.

- **Purpose here**: EPIC-030 establishes the backend Constitution XI Tier 1 pattern — a test that
  drives the real `AppModule` through its real HTTP routes. `EPIC-029`'s `T899a` set the frontend
  precedent; the backend's five existing `tests/integration/` files exercise services, not routes.
- **Alternatives considered**: NestJS's `app.getHttpServer()` with the built-in `http` module —
  rejected as several lines of boilerplate per assertion, which is how a reachability test degrades
  into a service test. `light-my-request` — rejected: Fastify-oriented, and this platform is on
  Express (`D-03`). Calling controller methods directly — rejected outright; that is precisely the
  hand-assembled graph Constitution XI Tier 1 forbids.
- **Licence**: MIT, both packages.

### D-30 in detail — the first dependency `TS-001` caught before it was installed

`@nestjs/serve-static` is registered **here first and installed second**, deliberately.

`TS-001` — the register conformance check in `tests/governance/dependency-register.spec.ts` — was
written by `EPIC-036` `T436c` and asserts that every third-party runtime dependency is named in this
document. **`EPIC-014` is the first Epic other than its author to be bound by it**, and the binding
worked in the intended direction: the row exists because the check would otherwise have gone red the
moment `pnpm add` ran.

`D-13` (React Router) records the same lesson from the other side — a dependency raised from 6.x to
7.x with the register left saying 6.x, twice. The pattern both entries point at is that **a register
nothing reads is a list, and a register something reads is a gate.**

**Why 4.x.** It tracks the NestJS major line, and this repository is on `@nestjs/common` 10.x with
`@nestjs/platform-express`. The Express adapter matters: `ServeStaticModule` relies on Express's
fallthrough for the history fallback, and the Fastify adapter needs
`serveStaticOptions.fallthrough: true` to behave the same way. Recorded because a future adapter
change would silently remove deep-link support while every other check stayed green.

### D-13 in detail — recorded by EPIC-036 `T436b`, and the same lesson a second time

`EPIC-036`'s plan and `research.md` `R-036-1` both call React Router **new**, and name it `D-30`.
It is not new. `D-13` has carried *"React Router, 6.x, Client routing"* since the platform
specification, declared for routing that was never built — `frontend/src/main.tsx` has held a
`useState` view union since `T003` and the address bar never leaves `/`. The register was ahead of
the code again, which is the direction that costs nothing.

So `T436b` **raised this row from 6.x to 7.x** rather than adding a `D-30` beside it, exactly as
`T993d` did for `D-22` above. Twice now an Epic has read "no such dependency in `package.json`" as
"no such dependency in the register"; the two questions have different answers and the register is
the one `TS-001` asks about.

- **Purpose here**: `FR-SHL-017` — every area and key sub-view addressable, surviving a refresh,
  with working back and forward, and answering **not found** for an area the shell does not host.
- **Version**: 7.x rather than the registered 6.x. v7 bridges React 18 to 19, so the `18.3.1` pin in
  `frontend/package.json` is unaffected; `T436e` asserts both facts so a silent React bump fails.
- **Mode**: **declarative only** — the component tree. Framework mode brings its own build,
  file-system routes, loaders and server rendering, which would replace Vite's role and reach far
  outside this Epic. Recorded here because the register row cannot express it and the distinction
  is the whole of `R-036-1`.
- **Package name**: v7 publishes `react-router`. The v6-era `react-router-dom` is superseded, and a
  `react-router-dom` import in this repository is a mistake rather than a style choice.
- **Alternatives considered**: hand-rolled routing — history push/pop, `popstate`, path matching,
  nested layouts, scroll restoration and not-found, a router with none of a router's test suite;
  TanStack Router — no precedent here and nothing in the requirements needs what it adds; a hash
  router — needs no server fallback and makes every address worse to work around a deployment gap
  that is organisational (`R-036-3`).
- **Licence**: MIT.

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
