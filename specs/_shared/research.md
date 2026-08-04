# Phase 0 Research: PMI Studio Phase 1 Platform Core

**Epic**: `EPIC-001` | **Date**: 2026-08-02 | **Spec**: [spec.md](./platform-spec.md)

Every unknown left open by the specification is resolved here. Each entry records the decision, why
it was chosen, and what was rejected. Decisions marked **⚠ CONFIRM** are the ones most expensive to
reverse later — review these before `/speckit-tasks`.

---

## R-001: How is Spec Kit actually invoked as an engine? ⚠ CONFIRM

**This is the load-bearing finding of Phase 0 and it changes the shape of the Epic.**

**Finding**: Spec Kit is **not a callable generation API**. Per the official documentation
(`github/spec-kit`, `docs/reference/core.md`), the `specify` CLI does one thing: it scaffolds a
project — directory structure, templates, scripts, and AI agent integration files:

```bash
specify init --here --force --integration claude --script sh
```

The actual `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` commands are **prompt templates
executed by an AI coding agent** (Claude Code, Copilot, Gemini), not subcommands of `specify`. There
is no `specify generate-spec` to call.

**Decision**: The Spec Kit adapter orchestrates a five-step sequence inside an isolated, ephemeral
workspace, one per generation job:

1. Create a scratch directory and initialise a git repository.
2. Run `specify init --here --force --integration claude --script sh --ignore-agent-tools` to
   scaffold `.specify/` and the agent skill files.
3. Write the platform's requirements into the workspace as the command input.
4. Invoke the AI coding agent CLI in headless (non-interactive) mode against the scaffolded
   workspace, passing the `/speckit-*` command and its arguments.
5. Read back the generated `specs/<feature>/spec.md` and `tasks.md`, parse them into platform
   entities, then destroy the workspace.

`--ignore-agent-tools` matters: it lets scaffolding succeed in a container where the agent CLI is
invoked as a separate step rather than being probed for at init time.

**Consequences the specification did not anticipate**:

- Generation requires a **sandboxed filesystem and process runtime**, not an HTTP client. This is
  the single largest component in Phase 1.
- Generation is **long-running and non-deterministic** — it is an AI agent run, not a function call.
  This validates the spec's asynchronous-job assumption (FR-028) and makes FR-024 cancellation and
  FR-025 timeouts genuinely necessary rather than defensive.
- The engine needs **AI provider credentials**. These are platform-held secrets and must never be
  exposed to a project or reachable from generated content.
- "Engine version" (FR-022) must capture **both** the Spec Kit version and the AI agent/model
  identity, because the same Spec Kit version with a different model produces different output.

**Alternatives considered**:

- *Call a Spec Kit library in-process* — rejected: no such generation library exists; `specify` is a
  scaffolding CLI.
- *Reimplement the Spec Kit prompts inside the platform* — rejected: it abandons Spec Kit as Engine
  V1, contradicting the SRS, and forks the prompt templates immediately.
- *Run generation in the platform's own process without isolation* — rejected: an AI agent writes
  arbitrary files and runs commands. Without a sandbox this is remote code execution against the
  platform host.

---

## R-002: Runtime language and platform ⚠ CONFIRM

**Decision**: TypeScript on Node.js 22 LTS for the API and workers; React with Vite for the web
interface. One language across the whole stack, in a pnpm workspace monorepo.

**Rationale**: The engine contract (FR-016) is the centre of this Epic, and TypeScript lets it be a
real compile-time interface that adapters must satisfy — a violation fails the build rather than a
test. A single language also means the contract types are shared verbatim between API, worker, and
UI with no translation layer.

**Alternatives considered**:

- *Python + FastAPI* — attractive because `specify` is Python, but irrelevant: the adapter shells out
  to the CLI regardless, so language affinity buys nothing. Rejected for weaker structural typing on
  the engine contract.
- *.NET / Java Spring* — both fit the enterprise profile and have stronger interface enforcement, but
  add a second language against a TypeScript front end. Reconsider if your team is already .NET-heavy
  — this is the decision most worth overriding on team-skill grounds.

---

## R-003: API framework and adapter registration

**Decision**: NestJS.

**Rationale**: Its module system maps directly onto the SRS layered architecture, and its dependency
injection container is exactly the mechanism FR-019 needs — engine adapters register as providers
against an injection token and are resolved per project at runtime. Adding an engine becomes
registering a provider, with no change to calling code, which is precisely SC-008.

**Alternatives considered**: *Fastify or Express with hand-rolled wiring* — lighter, but the adapter
registry, lifecycle, and module boundaries would be built by hand, which is the part NestJS already
gets right for this shape of problem.

---

## R-004: Persistence

**Decision**: PostgreSQL 16, accessed through Prisma.

**Rationale**: Traceability (FR-029 to FR-031) is a graph over artifacts and needs referential
integrity and recursive queries — a relational store with foreign keys, not a document store.
Specification content is stored as text with structured metadata alongside. Every table carries
`workspace_id` from the first migration (FR-002), so Phase 3 row-level security can be switched on
without a data migration.

**Alternatives considered**:

- *MongoDB* — rejected: the traceability graph and audit integrity want foreign keys.
- *SQLite* — rejected: no concurrent write story for parallel generation jobs.
- *TypeORM instead of Prisma* — viable; Prisma chosen for generated types that match the
  TypeScript-first decision and a cleaner migration workflow.

---

## R-005: Job orchestration, cancellation and timeouts

**Decision**: BullMQ backed by Redis, with one queue for generation jobs.

**Rationale**: Directly serves the job requirements — durable state across restarts, per-job
timeouts (FR-025), cancellation of in-flight work (FR-024), and progress reporting so the user can
keep working (FR-028). Jobs are idempotent by job key, which gives the spec's duplicate-submission
edge case for free.

**Alternatives considered**:

- *Database-backed polling queue* — one less service to run, but cancellation and timeout semantics
  would be hand-built.
- *Cloud-native queue (SQS, Cloud Tasks)* — defers a hosting decision this Epic does not need to
  make, and complicates local development.

---

## R-006: Engine sandbox and isolation ⚠ CONFIRM

**Decision**: Each generation job runs in a **short-lived Docker container** from a purpose-built
engine image containing the `specify` CLI, the AI agent CLI, and git. The container gets an ephemeral
workspace volume, a hard CPU/memory/wall-clock cap, a non-root user, a read-only root filesystem
apart from the workspace, and **egress restricted to the AI provider endpoint only**.

**Rationale**: Step 4 of R-001 runs an AI agent that writes files and executes commands. That is
untrusted execution by construction. The container boundary is what makes FR-025 (timeout),
FR-027 (leave platform in pre-request state), and the whole failure taxonomy of FR-026 enforceable
rather than aspirational — killing a container is reliable in a way that killing a rogue in-process
task is not.

**Alternatives considered**:

- *Same-host subprocess with a working directory* — simpler, and rejected: no meaningful blast-radius
  containment and no reliable resource ceiling.
- *Per-tenant long-lived containers* — rejected for Phase 1: state leaks between jobs, and the
  scheduling problem grows without a Phase 1 need.
- *Firecracker / gVisor microVMs* — stronger isolation, more operational weight than Phase 1 warrants.
  Revisit if untrusted third-party engines are ever registered.

---

## R-007: Parsing engine output into platform entities

**Decision**: The adapter reads the generated Markdown and extracts a defined set of fields, treating
anything unparseable as **malformed output** (FR-026) rather than storing it. Storage keeps both the
raw Markdown and the parsed structure, so a parser improvement can re-derive structure without
re-running the engine.

**Rationale**: An AI agent produces prose against a template; the template is a strong but not
absolute guarantee. Storing the raw artifact means a parsing bug is never data loss. Rejecting rather
than partially storing satisfies FR-027 and SC-006.

**Alternatives considered**: *Store the Markdown only and parse on read* — rejected: FR-029
traceability links and FR-031 coverage reporting need queryable structure at write time.

---

## R-008: Authentication for "basic sign-in"

**Decision**: Server-side sessions with HTTP-only cookies; passwords hashed with Argon2id. All
authentication sits behind an identity-provider interface, mirroring the engine adapter pattern.

**Rationale**: The clarification set Phase 1 as a single-user surface with SSO deferred to Phase 3.
Sessions are the smallest thing that establishes user and workspace identity on every request.
Putting it behind an interface means the Phase 3 SSO work replaces an adapter rather than rewriting
the request pipeline.

**Alternatives considered**:

- *Self-issued JWTs* — rejected: revocation is awkward, and there is no cross-service need in Phase 1.
- *Hosted identity provider now (Auth0, Entra ID)* — a reasonable shortcut, but pulls a Phase 3
  decision and an external dependency into Phase 1.

---

## R-009: How engine-independence is enforced and proven

**Decision**: Three mechanisms, not one:

1. The Spec Kit adapter lives in its own workspace package (`engine-adapters/speckit`), which the
   backend depends on **only** through the contract package.
2. An **architecture test** fails the build if anything under `backend/src` references a Spec Kit
   symbol, package, or string identifier.
3. A deliberately minimal second adapter (`engine-adapters/fixture`) implements the same contract and
   is used by the User Story 8 acceptance test.

**Rationale**: SC-008 claims a second engine can be introduced with zero changes outside the adapter
layer. A claim like that decays silently unless something fails when it stops being true. The
architecture test is what converts the SRS's central architectural principle into a build-time
guarantee, and the fixture adapter is what proves the contract is genuinely engine-neutral rather
than Spec-Kit-shaped.

**Alternatives considered**: *Code review discipline alone* — rejected: this is the SRS's most
emphasised decision and the one most likely to erode under delivery pressure.

---

## R-010: Testing approach

**Decision**: Vitest for unit tests (mandatory per Constitution V, written to fail first), Supertest
for API contract tests, Testcontainers for integration tests against real PostgreSQL and Redis, and
Playwright for the end-to-end journey. The Spec Kit engine is stubbed by the fixture adapter in all
tests except one nightly smoke test that exercises the real engine.

**Rationale**: Constitution V requires a unit test per implementation task, and the engine is slow,
costly, and non-deterministic. Testing against the fixture adapter keeps the suite fast and
repeatable; the nightly real-engine run catches drift in the actual integration.

**Alternatives considered**: *Mock PostgreSQL* — rejected: the workspace-isolation guarantees
(FR-002, SC-004) are only meaningful against a real database.

---

## R-011: Observability approach ⚠ CONFIRM

*Added 2026-08-03 after decision **D-7** adopted PP-010 into this Epic.*

**Decision**: OpenTelemetry for traces and metrics; structured JSON logs carrying the same
correlation identifier; no vendor-specific agent in application code.

| Signal | Approach |
|---|---|
| Logs | Structured JSON to stdout. Every record carries `workspace_id`, `actor_id`, `correlation_id`, and `job_id` where applicable |
| Traces | OpenTelemetry SDK; span per request and per generation job |
| Metrics | OpenTelemetry meters — request counts and durations, job counts by terminal state, job duration |
| Correlation | A single identifier generated at the API edge, carried through the BullMQ job payload and **into the sandbox as an environment variable** |

**Rationale**: PP-010 makes logging, metrics, and tracing first-class. OpenTelemetry is
vendor-neutral, which serves PP-015 (open standards, no lock-in) — the collector endpoint is
configuration, so choosing a backend is not a Phase 1 decision. Emitting logs to stdout keeps the
container contract simple and the sandbox unchanged.

**The hard part, and why this is built now**: the correlation identifier must cross the sandbox
boundary (ADR-0002), which is deliberately locked down — non-root, read-only root filesystem, egress
restricted to the AI provider. Passing an identifier **in** as an environment variable requires no
change to that contract. Getting telemetry **out** of the sandbox would require widening egress,
which is why the sandbox does not emit its own telemetry: the **worker** records the job's spans and
metrics on the container's behalf, from outside.

That asymmetry is the whole reason D-7 was worth deciding before implementation. Retrofitting it
would mean reopening the sandbox security contract.

**Two things that must never be logged**: engine output (it may contain customer requirements) and
any credential. Asserted by test in T157.

**Alternatives considered**:

- *Vendor SDK directly (Datadog, New Relic)* — rejected: couples application code to a backend,
  against PP-015.
- *Logs only* — rejected: PP-010 names metrics and tracing explicitly.
- *Sandbox emits its own telemetry* — rejected: requires widening the egress allow-list, weakening
  ADR-0002 for marginal benefit.

## R-012: Posture on newly-arrived MPS requirements

*Added 2026-08-03 after the MPS drop introduced requirements EPIC-001 does not cover.*

**Decision**: adopt only what is architecturally load-bearing now; defer the rest through the
Principle Conformance register (D-6) with owner and destination named. Specifically: **adopt the
six-state lifecycle** (D-14, because it changes schema and a schema is expensive to migrate);
**defer** export, domain events, role model, and availability targets to their owning modules.

**Rationale**: M-04 is held under D-10, so most of these cannot be built anyway. But the lifecycle
is different in kind — it is enforced by a database CHECK constraint, and correcting an enum before
any row exists is free, whereas afterwards it is a migration. The test is not "is this required?"
but "does deferring it make it more expensive later?"

**Alternatives considered**: *adopt everything now* — inflates a held Epic with work that cannot
start and would be re-specified when its owning module spec matures. *Defer everything including the
lifecycle* — saves nothing and buys a migration.

## Deferred to later phases

| Topic | Why deferred |
|-------|--------------|
| Hosting target and deployment topology | Constitution VII fixes the promotion order (`local → dev → stage → prod`) but not the substrate. No Phase 1 requirement depends on it. |
| Horizontal scaling of engine workers | SC-009 concerns project size, not concurrency. Add when measured. |
| Operational telemetry (metrics, tracing) | ⚠️ **Justification superseded 2026-08-03.** This entry originally argued observability was "an operational choice". **PMI-DOC-003 PP-010 makes logging, metrics, and tracing first-class**, removing that latitude. Now an open decision — **D-7** in [srs-alignment.md](../srs-alignment.md). See `system-design.md` PC-3 for the retrofit cost. |
| Accessibility and localisation standards | No SRS requirement yet; a UI framework decision now, standards when the design system arrives (SRS Volume 8). |
| AI provider and model selection | An engine image configuration concern. Must be recorded per artifact (FR-022) but need not be fixed here. **PMI-DOC-003 PP-017** adds cost-aware selection as a principle; split by decision D-6 — containment ships here, optimisation goes to catalog module M-07 (`system-design.md` PC-2). |

## Open risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Engine output drifts as Spec Kit templates or the model change | Parsers break; generation quality moves without warning | Store raw output (R-007); pin Spec Kit and agent versions in the engine image; record both per artifact (FR-022) |
| AI agent run cost and latency are unbounded per job | Runaway spend; poor experience | Hard wall-clock and resource caps in the container (R-006); surface job duration |
| Container-in-container execution complicates CI | Engine tests unreliable in the pipeline | Fixture adapter for the normal suite; real engine only in a nightly job (R-010) |
| Spec Kit's own governance files are exempt from Constitution I | Generated workspace files could be confused with platform code | Ephemeral workspaces are destroyed after each job and never committed |
