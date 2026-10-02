# Implementation Plan: PMI Integration Contract

**Epic**: `EPIC-043` · **Branch**: `epic/043-pmi-integration-contract` · **Date**: 2026-09-04

**Spec**: [spec.md](./spec.md) (clarified 2026-09-04) · **Research**: [research.md](./research.md)

**SRS References**: `SRS/PMI-DOC-007_Local_First_Replan_v1.0` §2.2, §2.4, §4 (the integration
contract), §7 (`EPIC-043` brief), §9.3 (`LR-08`, `LR-11`) ·
`SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.13 (`BR-0122`, `BR-0124`), §6.14
(`BR-0132`, `BR-0133`, `BR-0135`), §6.22 (`BR-0196`–`BR-0203`) ·
`specs/037-governed-execution-registry/contracts/execution-contract.md`

**Input**: Feature specification from `specs/043-pmi-integration-contract/spec.md`

## Summary

`EPIC-037` specified one semantic contract for governed execution and built the registry behind an
in-process facade. Its REST controller was written and then **unmounted**, because the only
authentication boundary the application had resolved a human session cookie and nothing could
authenticate a non-human caller (`DEF-037-001`); its MCP binding was never built, because the
authorisation model was open (`ADR-0010`, awaiting `R-AI-014`). `EPIC-041` built the answer to
both without knowing it: a project-scoped connector credential that the `ConnectorAuthGuard`
resolves to a `connector` Principal, with a scope registry that says which operations a credential
may reach.

This plan binds the contract to that credential in **three layers that each rest on the one
below**:

1. **The mounted registry** (`R-043-3`, `R-043-4`, `R-043-10`): the `EPIC-037` controller is
   mounted behind the guard; identity is derived from the credential and never read from the body;
   surface and assurance are derived from the transport; the architecture check that kept it
   unmounted is replaced by one that keeps it guarded.
2. **The reads** (`R-043-8`, `R-043-9`): `pmi.health`, `pmi.project.context` and
   `pmi.requirements.list` as guarded routes, plus the workstation connection record health
   writes.
3. **The `pmi-studio` server** (`R-043-1`, `R-043-2`, `R-043-5`, `R-043-6`): a stdio MCP server
   that is a **REST client** of layers 1 and 2 and nothing more. It holds no business rule, no
   state and no backend import; every tool is a translation of one route. Parity between the two
   bindings is therefore *structural* and the parity test (`AC-EXR-01`–`04`) proves it by driving
   the same registry through both.

The **execution timeline** on the project screen is the one screen (`R-043-7`), and the Tier 2
transcript is milestone `M1` end to end (`R-043-12`). The plan closes `ADR-0010`, annotates
`DEF-037-001` and extends `ADR-0030`; those records are part of this plan's output.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (`ADR-0003`).

**Primary Dependencies**: NestJS 10, Prisma 5.22 (unchanged). **One new runtime dependency**,
confined to one new package: `@modelcontextprotocol/sdk` **1.x** with its `zod` peer
(`R-043-2`; the 2.0 alpha line is rejected). One new workspace package, `packages/mcp-server`
(`@pmi/mcp-server`), which depends on `@pmi/execution-registry-contract` for types and on nothing
else in this repository — **never** on `@pmi/backend` (`R-043-1`, lint-enforced). The backend gains
no dependency; the frontend gains none.

**Storage**: PostgreSQL 16 via Prisma. **One new table** (`workstation_connections`), **one new
column** (`connector_credentials.snapshotId`), one new index on `executions` for the per-project
timeline read, and rows — not schema — in `connector_registrations` and `delegations` created at
credential mint (`R-043-3`). Additive migration `<ts>_epic043_integration_contract`.

**Testing**: Vitest 2.1 — `mcp-server` (a new project: the server driven through
`InMemoryTransport` by a real `Client`, and the fixture connector conformance suite run against an
`ExecutionRegistry` adapter over that client — `R-043-1`, `SC-PIC-001`), `backend-unit` (guard
composition, identity derivation, timeline service, reads), `backend-contract` (the tool surface
document against the running server's `tools/list`, `FR-PIC-005`), `backend-integration`
(Testcontainers: the mounted routes with real credentials, the parity test across the four
surfaces, the cross-project refusals, the mutation targets), `architecture`
(`executions-mounted.spec.ts` replacing `executions-unmounted.spec.ts`; `mcp-server-boundary`;
`connector-boundary` extended), `frontend` (timeline panel, connection panel), `e2e` (Tier 2
transcript `M1`, `R-043-12`).

**Target Platform**: Linux server for the API; Windows, macOS and Linux developer machines for
the server (stdio, spawned by the agent from `.mcp.json`).

**Project Type**: web service (API + worker + web) plus **one CLI-style package** — the stdio
server — that runs on the user's machine.

**Performance Goals**: `SC-PIC-005` — an execution appears on the timeline within **5 s** of its
completion call on the reference-local stack; per-call credential verification stays under
**1 ms** (`EPIC-041` measured 0.024 ms).

**Constraints**: no identity from a request body (`FR-PIC-024`); one identical refusal for every
credential failure (`FR-PIC-021`); no credential material in any argument, result or log
(`FR-PIC-026`); the backend still names no engine and no agent (`FR-PIC-012`); the server holds no
state and reads no project file (`FR-PIC-007`, `FR-PIC-011`).

**Scale/Scope**: one server process per agent session; tens of tool calls per governed command;
executions per project in the low thousands (paginated timeline).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** — `ADR-0010` closure, the `DEF-037-001` annotation and the `ADR-0030` extension are governance records written by this command as the spec's `FR-PIC-060`/`061` direct; no application code is written at the plan step |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — PMI-DOC-007 is in `SRS/`; two requirements rest on provisional `LR-` identifiers with the `BR-` back-fill recorded under Assumptions |
| III | Epic → Feature → Task; `specs/043-pmi-integration-contract/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test; document outputs carry a conformance check | **PASS** — planned in `/speckit-tasks`; the tool-surface document gets a contract check against the running server (`FR-PIC-005`); the mounted-behind-the-guard check is an architecture test that must be observed red by inversion (`SC-PIC-009`) |
| VI | `specs/043-pmi-integration-contract/defects/` is the sole defect intake | **PASS** — created at specify, tracked in git |
| VII | local → dev → stage → prod, no environment skipped | **PASS** — publication of `@pmi/mcp-server` is a promotion condition, not a task (`FR-PIC-062`) |
| VIII | Session labelled with the working Epic | **PASS** — branch `epic/043-pmi-integration-contract` |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-09-04, all recommendations accepted, no follow-up round |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1: every tool and route is driven through the composed `AppModule` (integration) and a real MCP client (in-memory transport) against that same application; Tier 2: the `M1` transcript (`R-043-12`) |
| XII | Governed commands registered in PMI Studio before executing | **PARTIAL → PASS at closure** — see Complexity Tracking: this Epic *is* the registration path; the commands that build it run before it exists |
| — | Repository synced from GitHub before work started | **PASS** — `origin/main` is behind local; nothing to integrate |
| — | No other Claude session active on this checkout | **PASS** — this checkout is on this Epic's branch alone |

**Post-Phase 1 re-check**: unchanged. The design added two gate considerations and resolved both:
the server's dependency direction (it depends on the contract package and speaks HTTP to the
platform; it never imports the backend — `R-043-1`, lint- and architecture-enforced), and the
delegation the registry requires for a connector principal (granted at mint on the project and
resolved through the execution's project — `R-043-3` — rather than by weakening the check).

## Project Structure

### Documentation (this feature)

```text
specs/043-pmi-integration-contract/
├── spec.md                          clarified 2026-09-04
├── plan.md                          ← this file
├── research.md                      R-043-1 … R-043-12
├── data-model.md                    1 table, 1 column, 1 index, rows at mint, the identity derivation
├── contracts/
│   ├── mcp-tool-surface.md          the ten tools + four reserved, schemas, refusal codes (FR-PIC-005)
│   ├── mounted-registry-api.md      /v1/executions/* behind the guard; body changes; timeline read
│   └── reads-api.md                 health · project context · requirements · workstation connection
├── quickstart.md                    12 scenarios, each naming its stack
├── checklists/requirements.md
└── defects/                         Constitution VI intake
```

### Source Code (repository root)

```text
packages/mcp-server/                                  NEW package @pmi/mcp-server (R-043-1, R-043-2)
├── package.json                     bin: pmi-studio · deps: @modelcontextprotocol/sdk ^1, zod; @pmi/execution-registry-contract
├── src/
│   ├── main.ts                      stdio entry: env → PlatformClient → createServer → StdioServerTransport
│   ├── server.ts                    createServer(client): registers the ten tools + four reserved
│   ├── platform-client.ts           the REST client: bearer credential, X-Contract-Version, refusal mapping (R-043-5)
│   ├── tools/execution.ts           the seven EPIC-037 tools → /v1/executions/*
│   ├── tools/reads.ts               pmi.health · pmi.project.context · pmi.requirements.list
│   ├── tools/reserved.ts            constitution.get · project.decompose · artifacts.sync · tasks.sync → not_available_until
│   ├── refusals.ts                  isError + structuredContent { code, … }; never echoes a credential
│   └── registry-adapter.ts          ExecutionRegistry over an MCP Client — what the fixture suite runs against (SC-PIC-001)
└── tests/
    ├── server.spec.ts               InMemoryTransport: tools/list equals the contract; schemas validate
    ├── refusals.spec.ts             one refusal per credential failure; no credential echoed (SC-PIC-003 target)
    ├── conformance.spec.ts          FixtureConnector(registryAdapter) — R-037-10 against MCP
    └── main.spec.ts                 env resolution; empty credential; unreachable platform

backend/src/modules/executions/
├── executions.controller.ts         MOUNTED: @UseGuards(ConnectorAuthGuard) + @ConnectorScope per route; identity from req.connector (R-043-3, R-043-4)
├── executions.module.ts             controllers: [ExecutionsController, ExecutionTimelineController]; imports ConnectorModule
├── execution-timeline.controller.ts GET /v1/projects/:id/executions · GET …/executions/:executionId/events — session-scoped (FR-PIC-035)
├── execution-timeline.service.ts    per-project listing with filters, newest first, paginated (R-043-7)
├── connector-identity.ts            ExecutionIdentityRefs from ConnectorRequestContext: snapshot, registration, delegation (R-043-3)
└── execution-registration.service.ts delegation resolved through the execution's project (R-043-3)

backend/src/modules/connector/
├── connector-credential.service.ts  + snapshot captured and delegations granted at mint (R-043-3)
├── connector-scope.ts               + the scopes this Epic registers (execution.*, project.read, requirements.read, health)
├── connector-reads.controller.ts    GET /v1/projects/:id/context · /requirements?groupBy=epic · /health (R-043-9)
├── project-context.service.ts       the context read; epic list derivation stated (FR-PIC-043)
├── workstation-connection.service.ts + store (interface, in-memory, Prisma) (R-043-8)
└── connector.module.ts              + the above; exports what executions.module needs

backend/src/modules/projects/project-files.ts   mcpServerEntry honours PMI_MCP_SERVER_COMMAND (R-043-11)
backend/prisma/schema.prisma                    WorkstationConnection; ConnectorCredential.snapshotId; executions index
backend/prisma/migrations/<ts>_epic043_integration_contract/migration.sql

backend/tests/architecture/
├── executions-mounted.spec.ts       REPLACES executions-unmounted.spec.ts (R-043-10, FR-PIC-031)
├── mcp-server-boundary.spec.ts      packages/mcp-server imports no backend, no store, no Prisma
└── connector-boundary.spec.ts       extended: the scopes this Epic registers are exactly the contract's
backend/tests/contract/mcp-tool-surface.spec.ts  contracts/mcp-tool-surface.md ⇔ tools/list (FR-PIC-005)
backend/tests/integration/
├── mounted-registry.spec.ts         the routes with real credentials; identity from the credential; refusals (US2)
├── execution-parity.spec.ts         AC-EXR-01–04: managed fixture · MCP client · REST-with-credential · CI fixture (FR-PIC-010)
├── connector-reads.spec.ts          context · requirements · health · connection record (US4, US5)
└── execution-timeline.spec.ts       session-scoped timeline read (FR-PIC-035)

frontend/src/pages/Projects.tsx      + ExecutionTimeline panel · + connection rows on the Local workspace panel (FR-PIC-050–054)
frontend/src/services/api.ts         + listExecutions · getExecutionEvents · listWorkstationConnections
frontend/tests/unit/pages/project-executions.spec.tsx

e2e/tests/epic-043-m1.spec.ts        Tier 2: create project → credential → server over stdio → execution on the timeline (R-043-12)
eslint.config.js                     packages/mcp-server may import only @pmi/execution-registry-contract and @pmi/execution-contract
vitest.workspace.ts · package.json   + mcp-server project
adr/ADR-0010 (closed) · adr/ADR-0030 (extended) · specs/037-…/defects/DEF-037-001 (annotated)
```

**Structure Decision**: the server is a **separate package that speaks HTTP**, not a second
transport compiled into the API. That is what makes `FR-PIC-011` (no business rule in the server)
and `FR-PIC-010` (parity) true by construction rather than by discipline, and what lets the
server run on the user's machine where the API's process is not (`R-043-1`).

## Phase 0 — Research

[research.md](./research.md) resolves twelve decisions: `R-043-1` the server as a REST client in
its own package; `R-043-2` the SDK line and its import paths (Context7-verified); `R-043-3` how a
connector credential satisfies the registry's identity — snapshot, registration and delegation at
mint, delegation resolved through the project; `R-043-4` surface and assurance derived from the
transport; `R-043-5` the refusal vocabulary and its parity; `R-043-6` contract-version negotiation;
`R-043-7` the timeline read; `R-043-8` the workstation connection record; `R-043-9` the reads and
the Epic-list derivation before `EPIC-044`; `R-043-10` the replacement architecture check;
`R-043-11` the checkout override; `R-043-12` the `M1` transcript.

No `NEEDS CLARIFICATION` remains: the five judgement calls were confirmed on 2026-09-04.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the one table, the column, the index, the rows created at
  mint, the identity derivation, the refusal vocabulary.
- [contracts/mcp-tool-surface.md](./contracts/mcp-tool-surface.md) — the ten tools and four
  reserved names with schemas and refusal codes; the document a contract test checks against
  `tools/list`.
- [contracts/mounted-registry-api.md](./contracts/mounted-registry-api.md) — `/v1/executions/*`
  behind the guard: headers, what the body may no longer carry, status codes, the session-scoped
  timeline read.
- [contracts/reads-api.md](./contracts/reads-api.md) — health, project context, requirements and
  the workstation connection.
- [quickstart.md](./quickstart.md) — twelve scenarios proving the user stories, each naming its
  stack.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Gate XII PARTIAL — the commands producing this Epic run unregistered | This Epic **is** the registration path for a developer's machine: the guard, the mounted routes and the server are what a connector needs before it can register anything | Registering through the in-process facade from a repository script would be a hand-assembled composition that Constitution XI forbids as evidence; the honest row is *unregistered until this Epic ships*, and the `M1` transcript is the first registered execution |
| A new runtime dependency (`@modelcontextprotocol/sdk`) | The protocol has a versioned wire format, a handshake and schema conventions; hand-writing them is how a binding drifts from the protocol | Rejected: a hand-rolled JSON-RPC layer is more code, less conformance, and named nowhere in `EPIC-037`'s contract, which assumes the protocol as documented |
| A fourth architecture boundary (`packages/mcp-server` ⇏ backend) | Without it the server can reach the facade in-process and the parity claim becomes a claim about discipline | Rejected: an in-process server would run only where the API runs, which is not the user's machine |

## Related Documents

- `specs/041-local-project-workspace/` — the credential, the guard, the scope registry, the
  assurance write, `.mcp.json`
- `specs/037-governed-execution-registry/` — the contract, the registry, the fixture connector,
  `DEF-037-001`
- `adr/ADR-0010` (closed by this plan), `adr/ADR-0023` (MCP at the adapter layer), `adr/ADR-0030`
  (extended by this plan)
- `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §4 — the integration contract this plan binds
