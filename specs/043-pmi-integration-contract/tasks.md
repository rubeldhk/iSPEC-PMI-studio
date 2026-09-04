# Tasks: PMI Integration Contract

**Epic**: `EPIC-043` · **Module**: Governed Execution Registry (M-11) + Connector (M-13) · **Branch**:
`epic/043-pmi-integration-contract` · **Generated**: 2026-09-04

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/mcp-tool-surface.md](./contracts/mcp-tool-surface.md) ·
[contracts/mounted-registry-api.md](./contracts/mounted-registry-api.md) ·
[contracts/reads-api.md](./contracts/reads-api.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T1398`–`T1466`, **69 tasks**.

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**.
> The corpus maximum before this Epic is `T1397` (`EPIC-041` Phase 9), so allocation starts at
> `T1398`, contiguous, with no suffix letters (`R-026-9`). The closure phase is pre-allocated
> (`T1456`–`T1464`), as `EPIC-041`'s analysis finding `I3` established.

**Delivery posture**: ▶ **PROCEEDING** — second Epic of the local-first replan (`D-47`). Depends on
`EPIC-041` (complete on its branch; this branch is cut from it) and on `EPIC-037`'s registry and
fixture connector (delivered). Nothing it depends on is held.

**Session label**: `EPIC-043 PMI Integration Contract` (Constitution VIII).

**Test statement** (Constitution V): every implementation task names the failing-first test task
that precedes it. Tasks whose output is a document or configuration (`.env.example`, `README.md`,
the tool-surface contract) pair with an **executable conformance check** under `tests/governance/`
or `backend/tests/contract/`. Three checks are **mutation-tested** at closure (`SC-PIC-003`,
`SC-PIC-004`, `SC-PIC-009`). Whether a conformance check blocks CI: **blocks**, for every check in
this Epic.

**Feature map** (`F-043.n`, Constitution III): F-043.1 Setup — the package, the boundary, the
override, the contract codes (Phase 1) · F-043.2 Foundational — identity at mint, the mounted
registry, the replaced check (Phase 2) · F-043.3 The server and the timeline (US1) · F-043.4 One
refusal (US2) · F-043.5 Replay (US3) · F-043.6 The reads (US4) · F-043.7 The workstation
connection (US5) · F-043.8 Polish · F-043.Z Closure.

---

## Phase 1: Setup — F-043.1

**Purpose**: the new package exists with its boundary enforced, the checkout override is
configuration, and the contract package carries the codes and the header this Epic adds.

- [X] T1398 [P] Write the failing governance conformance check `tests/governance/mcp-server-package.spec.ts` — `packages/mcp-server/package.json` exists with name `@pmi/mcp-server`, a `bin` named `pmi-studio`, runtime dependencies **exactly** `@modelcontextprotocol/sdk` (`^1.29`), `zod` (`^3`) and `@pmi/execution-registry-contract`; `vitest.workspace.ts` and the root `package.json` `test:unit` list an `mcp-server` project; `tests/governance/vitest-projects.spec.ts` maps it
- [X] T1399 Create `packages/mcp-server/package.json`, `packages/mcp-server/tsconfig.json`, `packages/mcp-server/src/main.ts` (a bootstrap that exits naming the missing environment until `T1427`), add the `mcp-server` project to `vitest.workspace.ts` and `package.json`, and install the two dependencies with `pnpm add` at the package (conformance: `tests/governance/mcp-server-package.spec.ts` T1398)
- [X] T1400 [P] Write the failing architecture test `backend/tests/architecture/mcp-server-boundary.spec.ts` — no file under `packages/mcp-server/src/` imports `@pmi/backend`, `@pmi/worker`, `@prisma/client`, any path containing `/persistence/` or `.store`, or any `engine-adapters/` path; the package imports only `@modelcontextprotocol/sdk`, `zod`, `node:` modules, `@pmi/execution-registry-contract` and `@pmi/execution-contract`; and `eslint.config.js` carries a `packages/mcp-server/**/*.ts` rule restricting the same
- [X] T1401 Add the `packages/mcp-server/**/*.ts` `no-restricted-imports` rule to `eslint.config.js` and extend `tests/governance/eslint-boundaries.spec.ts` to assert it (architecture test: T1400; conformance: `tests/governance/eslint-boundaries.spec.ts`)
- [X] T1402 [P] Extend `tests/governance/projects-root-config.spec.ts` with a failing block — `.env.example` declares `PMI_MCP_SERVER_COMMAND=` (empty) with a comment naming the checkout use; `docker-compose.yml` does **not** pass it; `README.md` §Setup names it (conformance: `tests/governance/readme-conformance.spec.ts`)
- [X] T1403 Declare `PMI_MCP_SERVER_COMMAND` in `.env.example`, `README.md` §Setup and `docs/operator-setup.md` §6 (conformance: `tests/governance/projects-root-config.spec.ts` T1402)
- [X] T1404 [P] Write failing unit tests in `backend/tests/unit/projects/project-files.spec.ts` (extend) and `backend/tests/unit/projects/projects-root.spec.ts` (extend) — `readProjectsRootConfig` exposes `mcpServerCommand` from `PMI_MCP_SERVER_COMMAND` (undefined when empty); `mcpServerEntry` with a command produces `{ command, args }` split on whitespace and the same `env`; without one, the `npx -y @pmi/mcp-server@<version>` entry unchanged; the `.mcp.json` conformance in `backend/tests/contract/project-files.spec.ts` still passes
- [X] T1405 Implement the override in `backend/src/modules/projects/projects-root.ts` and `backend/src/modules/projects/project-files.ts`, and pass it through `backend/src/modules/projects/provisioning.service.ts` (unit test: T1404) — `R-043-11`
- [X] T1406 [P] Write failing tests in `packages/execution-registry-contract/tests/contract-shape.spec.ts` (extend) — `REGISTRY_REFUSALS` gains `invalid_connector_credential`, `scope_required`, `identity_not_accepted`, `surface_not_accepted`, `not_available_until`, `platform_unreachable`, `credential_in_argument`; exports `CONTRACT_VERSION = '1.0'` (the fixture connector uses it instead of its literal — analysis `U1`), `PMI_SURFACE_HEADER = 'x-pmi-surface'`, `CONTRACT_VERSION_HEADER = 'x-contract-version'`, `IDEMPOTENCY_KEY_HEADER`; a `RefusalDetail` type per code
- [X] T1407 Add `CONTRACT_VERSION`, the codes, headers and types to `packages/execution-registry-contract/src/contract.ts` and export them from `packages/execution-registry-contract/src/index.ts` (unit test: T1406) — `R-043-5`, `R-043-6`

**Checkpoint**: the package exists and is lint-bounded; the contract package speaks the new codes.

---

## Phase 2: Foundational — F-043.2 (blocking — identity at mint, the mounted registry, the replaced check)

**Purpose**: everything every story rests on. A credential must satisfy the registry's identity
before any tool can register; the routes must be mounted behind the guard before a server can call
them; the architecture check must guard the mount before it is trusted.

- [X] T1408 [P] Write the failing integration test `backend/tests/integration/integration-contract-schema.spec.ts` (Testcontainers) — table `workstation_connections` with a unique `credentialId` and the universal columns; column `connector_credentials.snapshotId` nullable; index on `executions (workspaceId, projectId, registeredAt)`; and extend `backend/tests/unit/core/universal-columns.spec.ts` for the new table
- [X] T1409 Add `WorkstationConnection`, `ConnectorCredential.snapshotId` and the executions index to `backend/prisma/schema.prisma`, write `backend/prisma/migrations/20260904120000_epic043_integration_contract/migration.sql` (additive, with the CHECK and unique constraints), run `prisma generate` (integration test: T1408; unit test: `backend/tests/unit/core/universal-columns.spec.ts`)
- [X] T1410 [P] Write failing unit tests `backend/tests/unit/connector/credential-identity.spec.ts` — minting a credential captures an identity snapshot for its principal and stores `snapshotId`; creates (once per workspace per surface kind) `ConnectorRegistration` rows of kind `mcp-client` and `local-cli` and references the `mcp-client` one from the principal; grants the four delegable actions from the sponsor to the principal on `{ artifactType: 'project', artifactId }`; revoking revokes the four delegations in the same transaction; `completeIdentity(credential)` performs the same for a credential whose `snapshotId` is null (lazy completion) and is idempotent
- [X] T1411 Implement the mint-time identity in `backend/src/modules/connector/connector-credential.service.ts` — new ports `IdentitySnapshotPort`, `DelegationGrantPort`, `ConnectorRegistrationPort` by shape — and wire `IdentitySnapshotService`, `PrincipalDelegationService` and `PrincipalRegistryService.registerConnector` in `backend/src/modules/connector/connector.module.ts` (unit test: T1410) — `R-043-3`, `data-model.md` §4
- [X] T1412 [P] Write failing unit tests `backend/tests/unit/executions/connector-identity.spec.ts` — `identityFromConnector(ctx, lookups)` returns `ExecutionIdentityRefs` with `authenticatedPrincipalId`, `sponsorUserId` and `connectorRegistrationId` from the principal, `agentSnapshotId` from the credential (completing it lazily when null), `delegationId`/`delegationIdentityVersion` from the `execution.register` delegation on the project; throws `identity_not_resolvable` when completion fails; never reads a request body
- [X] T1413 Implement `backend/src/modules/executions/connector-identity.ts` (unit test: T1412) — `data-model.md` §5
- [X] T1414 [P] Write failing unit tests `backend/tests/unit/executions/delegation-scope.spec.ts` — a delegation on `{ project, P }` satisfies registration of a target of any type whose execution `projectId` is `P`; a target in project `Q` with a delegation on `P` is refused `delegation_missing`; an execution with no `projectId` is checked against the target as today; the existing `execution-registration.service` tests are unchanged
- [X] T1415 Extend `backend/src/modules/executions/execution-registration.service.ts` so `requireDelegated` is tried against the target and then, when the request carries `projectId`, against `{ artifactType: 'project', artifactId: projectId }` (unit test: T1414) — `R-043-3`
- [X] T1416 [P] Write failing unit tests `backend/tests/unit/connector/connector-scopes.spec.ts` and extend `backend/tests/architecture/connector-boundary.spec.ts` — `registeredConnectorScopes()` is **exactly** the eleven scopes of `data-model.md` §8; every `@ConnectorScope` in `backend/src/modules/` names a registered scope; every guarded route carries one
- [X] T1417 Register the ten new scopes in `backend/src/modules/connector/connector-scope.ts` next to `connector.whoami` (unit test: T1416)
- [X] T1418 [P] Write the failing architecture test `backend/tests/architecture/executions-mounted.spec.ts` — **static**: `executions.controller.ts` declares `@UseGuards(ConnectorAuthGuard)` on the class or on every handler, and every handler carries a registered `@ConnectorScope`; `executions.module.ts` lists the controller; **live**: the composed `AppModule` answers `POST /v1/executions`, `POST /v1/executions/x/events`, `…/completion`, `…/comments`, `…/proposals`, `GET /v1/executions/x/history`, `GET /v1/executions/x`, `POST /v1/executions/sync` with `401 { code: 'invalid_connector_credential', message: 'Invalid connector credential.' }` for an absent credential, and `GET /v1/auth/me` with the session `401` as the control — and **delete** the former unmounted check (executions-unmounted, in the same folder) in the same change (`R-043-10`)
- [X] T1419 Mount the registry: rewrite `backend/src/modules/executions/executions.controller.ts` — `@UseGuards(ConnectorAuthGuard)`, a `@ConnectorScope` per route, identity from `identityFromConnector(req.connector)`, `workspaceId`/`projectId` from `req.connector`, `surface` from the `x-pmi-surface` header (`mcp-client`) or `local-cli`, the `x-contract-version` header required, the `:workspaceId` path segment removed, `202` for proposals; list it in `backend/src/modules/executions/executions.module.ts` and import `ConnectorModule` there (architecture test: T1418) — `R-043-4`, `contracts/mounted-registry-api.md`
- [X] T1420 [P] Write failing unit tests `backend/tests/unit/executions/executions.controller.spec.ts` — a body carrying `identity`, `workspaceId`, `projectId`, `surface` or `assurance` is refused `identity_not_accepted`/`surface_not_accepted` naming the field; a missing or mismatched contract-version header is `unsupported_contract_version` with `supported` and `received`; the derived fields reach the facade; `x-pmi-surface: mcp-client` yields `mcp-client`, its absence `local-cli`, any other value `surface_not_accepted`; the proposal route returns `202`; `GET …/history` and `GET /:id` for an execution whose `projectId` is not the credential's answer `404` (`FR-PIC-032`, analysis `C2`)
- [X] T1421 Implement the refusals and the header handling in `backend/src/modules/executions/executions.controller.ts` and check the snapshot's `projectId` against `req.connector.projectId` on every read before answering (analysis `C2`), and map the new codes to statuses in `backend/src/core/errors.ts` (`invalid_connector_credential` 401, `scope_required` 403, `identity_not_accepted`/`surface_not_accepted`/`unsupported_contract_version` 400, `not_available_until` 501) (unit test: T1420)

- [X] T1465 [P] Write failing unit tests `backend/tests/unit/executions/facade-comment.spec.ts` — `ExecutionRegistryFacade.comment(request)` appends a comment through `ExecutionCommentService.add()` with the connector principal as author, is permitted after a terminal lifecycle event, refuses an empty body, and the fixture connector's round trip is unchanged; the `POST /v1/executions/:id/comments` route answers `201 { commentId }` behind the guard with scope `execution.comment` (analysis `C1`)
- [X] T1466 Add `comment()` to `backend/src/modules/executions/execution-registry.facade.ts` and the `:id/comments` route to `backend/src/modules/executions/executions.controller.ts`, and have `POST /v1/executions/sync` answer `501 not_available_until { epic: 'EPIC-037' }` until `EPIC-037` US4 lands (unit test: T1465; architecture test: T1418)

> `T1465`–`T1466` were appended on 2026-09-04 by the `/speckit-analyze` remediation (finding `C1`): `EPIC-037` delivered the comment service without a facade method or a route, and never built its sync intake. Identifiers are never renumbered, so they sit out of sequence within this phase.

**Checkpoint**: a credential minted after this phase can register an execution over REST through
the composed application; the architecture check is green and was observed red before `T1419`.

---

## Phase 3: User Story 1 — A governed command from my machine appears in PMI Studio (P1) 🎯 MVP — F-043.3

**Goal**: the `pmi-studio` server, the timeline read, the timeline panel, and the parity proof.

**Independent test**: Scenario 3 of the quickstart — register → appendEvent → complete through a
real MCP client against the composed application; the timeline shows the execution with surface
`mcp-client`, assurance `local`, the proposal pending.

- [X] T1422 [P] [US1] Write failing tests `packages/mcp-server/tests/server.spec.ts` — through `InMemoryTransport.createLinkedPair()` and a real `Client`: `tools/list` names **exactly** the fourteen tools of `contracts/mcp-tool-surface.md` (ten live, four reserved) each with an input and an output schema; the `initialize` result's `instructions` carries the contract version for a person and `pmi.health` returns it for a program (analysis `A1`); `pmi.execution.sync` is listed and refuses `not_available_until { epic: 'EPIC-037' }` (`FR-PIC-034`); a tool argument `contractVersion` naming another version is refused `unsupported_contract_version` before any platform call; a reserved tool validates its arguments and then refuses `not_available_until` naming its Epic
- [X] T1423 [P] [US1] Write failing tests `packages/mcp-server/tests/platform-client.spec.ts` (an injected `fetch`) — every request carries `Authorization: Bearer <credential>`, `x-contract-version`, `x-pmi-surface: mcp-client` and, on POST, `idempotency-key`; a `4xx` body becomes `{ isError: true, structuredContent: { code, message, …detail } }` with the platform's code; a network failure becomes `platform_unreachable` carrying the host only; the credential never appears in any result, error message or thrown error
- [X] T1424 [US1] Implement `packages/mcp-server/src/platform-client.ts` and `packages/mcp-server/src/refusals.ts` (unit test: T1423) — `R-043-5`, `R-043-6`
- [X] T1425 [US1] Implement `packages/mcp-server/src/server.ts` (`createServer(client)`), `packages/mcp-server/src/tools/execution.ts` (six live; `sync` reserved per `FR-PIC-034`), `packages/mcp-server/src/tools/reads.ts` (health, context, requirements), `packages/mcp-server/src/tools/reserved.ts` (unit test: T1422) — `R-043-2`, `contracts/mcp-tool-surface.md`
- [X] T1426 [P] [US1] Write failing tests `packages/mcp-server/tests/main.spec.ts` — `resolveEnvironment(env)` requires `PMI_STUDIO_URL`, treats an empty `PMI_STUDIO_TOKEN` as absent (the server still starts and every tool refuses `invalid_connector_credential`; `pmi.health` detail says `credential_absent`); the bootstrap composes `PlatformClient` → `createServer` → `StdioServerTransport` and reads no file
- [X] T1427 [US1] Implement `packages/mcp-server/src/main.ts` and the `bin/pmi-studio.js` entry named by `package.json` (unit test: T1426)
- [X] T1428 [P] [US1] Write failing tests `packages/mcp-server/tests/conformance.spec.ts` — the `FixtureConnector` from `@pmi/execution-registry-contract` runs its full round trip against an `ExecutionRegistry` implemented over an MCP `Client` connected to `createServer` whose platform client is backed by an in-memory stub of the mounted routes; every expectation of `packages/execution-registry-contract/tests/fixture-connector.spec.ts` holds unchanged (`R-037-10`, `SC-PIC-001`)
- [X] T1429 [US1] Implement `packages/mcp-server/src/registry-adapter.ts` — `ExecutionRegistry` over a `Client` (unit test: T1428)
- [X] T1430 [P] [US1] Write the failing contract check `backend/tests/contract/mcp-tool-surface.spec.ts` — parse the tool table of `specs/043-pmi-integration-contract/contracts/mcp-tool-surface.md`, start `createServer` in memory, and assert `tools/list` names exactly those tools with the stated scopes and refusal codes (`FR-PIC-005`)
- [X] T1431 [P] [US1] Write failing unit tests `backend/tests/unit/executions/execution-timeline.service.spec.ts` — lists a project's executions newest first with `command`, `surface`, `assurance`, `state`, `initiator`, `sponsorUserId`, `registeredAt`, `completedAt`, `proposal`; filters by `surface`, `state`, `initiator`; cursor pagination; events for one execution in sequence; a project in another workspace is not found
- [X] T1432 [US1] Implement `backend/src/modules/executions/execution-timeline.service.ts` and `backend/src/modules/executions/execution-timeline.controller.ts` (`GET /v1/projects/:id/executions`, `GET /v1/projects/:id/executions/:executionId/events`, session-scoped) and list the controller in `backend/src/modules/executions/executions.module.ts` (unit test: T1431) — `R-043-7`
- [X] T1433 [P] [US1] Write failing component tests `frontend/tests/unit/pages/project-executions.spec.tsx` — the Execution timeline panel on `ProjectDetail` in its four `FR-SHL-060` states; rows newest first with the seven fields; filters by surface, state and initiator; expanding a row lists events in sequence with type, actor and time and the proposal's state; no control applies or approves anything and the panel says where approval belongs
- [X] T1434 [US1] Implement `ExecutionTimeline` in `frontend/src/pages/Projects.tsx` and `listExecutions`, `getExecutionEvents` in `frontend/src/services/api.ts` (unit test: T1433) — `FR-PIC-050`–`FR-PIC-054`
- [X] T1435 [P] [US1] Write the failing Tier 1 integration test `backend/tests/integration/execution-parity.spec.ts` — against the composed `AppModule` with a real credential: the same governed command from **(a)** the managed fixture through the facade, **(b)** an MCP `Client` connected to `createServer` whose platform client's `fetch` is the application's HTTP server, **(c)** REST with the credential, **(d)** the CI fixture; all four agree on normalised command, target-version bindings, lifecycle milestones, governance outcome and evidence obligations; (b) carries surface `mcp-client`, (c) `local-cli`, both assurance `local`, none from the caller; the timeline read returns (b) and (c) (`AC-EXR-01`–`04`, `SC-PIC-002`, `SC-PIC-008`)
- [X] T1436 [P] [US1] Write the failing Tier 1 integration test `backend/tests/integration/execution-timeline.spec.ts` — the session route lists only the project's executions, refuses another workspace's project with the opaque `404`, paginates, and returns events in sequence

**Checkpoint**: `M1` is provable in-process — Scenario 3 holds through a real client.

---

## Phase 4: User Story 2 — A wrong credential opens nothing and learns nothing (P1) — F-043.4

**Goal**: one refusal, everywhere; nothing performed; nothing echoed.

**Independent test**: Scenarios 5–7 — absent, malformed, revoked and other-project credentials
against every tool and route; then remove the project-scope check and watch the suite fail.

- [X] T1437 [P] [US2] Write failing tests `packages/mcp-server/tests/refusals.spec.ts` — the four credential failures produce one identical `structuredContent` (`invalid_connector_credential`, the guard's message) on every tool; a `credential`-shaped value in any argument (`pmi_ct_…`, `sk-…`, `Bearer …`) is refused `credential_in_argument` naming the argument and never its value; every refusal passes through `sanitise()` which replaces credential shapes with `<credential>`
- [X] T1438 [US2] Implement the argument scan and the sanitiser in `packages/mcp-server/src/refusals.ts` and apply them in `packages/mcp-server/src/server.ts` (unit test: T1437)
- [X] T1439 [P] [US2] Write the failing Tier 1 integration test `backend/tests/integration/mounted-registry.spec.ts` — against the composed `AppModule`: absent, malformed, revoked and other-project credentials receive byte-identical `401` bodies on all eight routes and perform nothing (no execution, no event, no audit entry beyond the refusal); a valid credential on a route outside its scopes is `403 scope_required` naming the scope; revocation is effective on the very next request; a body carrying `identity` is `400 identity_not_accepted` with the initiator otherwise derived from the credential; every accepted call writes an audit entry naming the connector principal, the project, the operation and the outcome (`FR-PIC-036`) — the `SC-PIC-004` and `SC-PIC-007` target
- [X] T1440 [US2] Extend `backend/src/modules/executions/sanitisation.ts` to scrub credential shapes from every refusal body and audit detail, and add the `connector.*` audit entries to `backend/src/modules/executions/executions.controller.ts` through `AuditService` (integration test: T1439; unit test: T1441)
- [X] T1441 [P] [US2] Write failing unit tests `backend/tests/unit/executions/refusal-sanitisation.spec.ts` — a refusal message containing a credential value renders `<credential>`; an audit detail never carries one; the `SC-PIC-003` mutation target

**Checkpoint**: Scenario 5 holds on every tool and every route.

---

## Phase 5: User Story 3 — A retried registration is the same registration (P2) — F-043.5

**Goal**: replay through both bindings preserves `EPIC-037`'s idempotency end to end.

**Independent test**: Scenario 8.

- [ ] T1442 [P] [US3] Write the failing Tier 1 integration test `backend/tests/integration/execution-replay.spec.ts` — over REST and over the MCP client: the same key and payload return the original execution with identical identifying fields and create no second row; the same key with a different command, target or binding is a conflict; the same key from a second credential of the same project is a conflict on emitting principal; no sequence number is consumed by a refused replay (`SC-PIC-006`)
- [ ] T1443 [US3] Ensure `packages/mcp-server/src/tools/execution.ts` forwards `idempotencyKey` unchanged and `backend/src/modules/executions/executions.controller.ts` passes the credential's principal into the registry's replay comparison; extend `packages/mcp-server/tests/server.spec.ts` for the passthrough (integration test: T1442; unit test: T1422)

---

## Phase 6: User Story 4 — My agent can read what it needs to begin (P2) — F-043.6

**Goal**: project context and requirements, this project only, with the Epic-list derivation
stated; the reserved tools honest.

**Independent test**: Scenarios 9 and 10.

- [ ] T1444 [P] [US4] Write failing unit tests `backend/tests/unit/connector/project-context.service.spec.ts` — the context read returns the project's fields, `extensionVersion` from the bundle, `contractVersion`, `platformUrl`, `epics: []` and `epicSource: 'unavailable-until-EPIC-044'`; the requirements read returns every active requirement once under `unassigned` with reference, description, type, priority, status and `baselineState`, retired ones omitted, `groupBy` other than `epic` refused; nothing from another project; each read writes an audit entry naming the connector principal, the project and the operation (`FR-PIC-036`, analysis `C3`)
- [ ] T1445 [US4] Implement `backend/src/modules/connector/project-context.service.ts` and `backend/src/modules/connector/connector-reads.controller.ts` (`GET /v1/projects/:id/context`, `GET /v1/projects/:id/requirements?groupBy=epic`, guarded, scopes `project.read` and `requirements.read`) and list it in `backend/src/modules/connector/connector.module.ts` (unit test: T1444) — `R-043-9`, `contracts/reads-api.md`
- [ ] T1446 [P] [US4] Write the failing Tier 1 integration test `backend/tests/integration/connector-reads.spec.ts` — Scenario 9 through REST and through the MCP client; a credential for project B reading project A's context or requirements is `404`; the reserved tools through the client refuse `not_available_until` after validating arguments; Scenario 2's health call (the `US5` half is asserted here too)
- [ ] T1447 [US4] Implement argument validation before the `not_available_until` refusal in `packages/mcp-server/src/tools/reserved.ts`, with the PMI-DOC-007 §4.1 argument schemas (unit test: T1422)

---

## Phase 7: User Story 5 — I can see that a developer's machine is connected (P3) — F-043.7

**Goal**: `pmi.health` records the workstation; the Local workspace panel shows it.

**Independent test**: Scenario 2.

- [ ] T1448 [P] [US5] Write failing unit tests `backend/tests/unit/connector/workstation-connection.spec.ts` — `touch(credential, versions)` creates the row on first call with `firstSeenAt = lastSeenAt` and updates `lastSeenAt` and the versions after; one row per credential; a revoked credential's row is kept and the read joins the credential's label and state; a health call writes a `connector.health` audit entry with the versions in `detail` (`FR-PIC-036`, analysis `C3`); the in-memory and Prisma stores behave alike (`durable-stores.spec.ts` gains `WORKSTATION_CONNECTION_STORE`)
- [ ] T1449 [US5] Implement `backend/src/modules/connector/workstation-connection.service.ts`, `backend/src/modules/connector/workstation-connection.store.ts` (interface, in-memory, Prisma under `DATABASE_URL`), the guarded `POST /v1/projects/:id/health` (scope `health.write`) in `backend/src/modules/connector/connector-reads.controller.ts`, and the session route `GET /v1/projects/:id/workstation-connections` (unit test: T1448; architecture test: `backend/tests/architecture/durable-stores.spec.ts`) — `R-043-8`
- [ ] T1450 [P] [US5] Extend `frontend/tests/unit/pages/project-provisioning.spec.tsx` with failing tests — the Local workspace panel lists the most recent connection per credential (label, last seen, extension and toolkit versions, credential state) or says no workstation has connected yet
- [ ] T1451 [US5] Implement the connection rows in `frontend/src/pages/Projects.tsx` and `listWorkstationConnections` in `frontend/src/services/api.ts` (unit test: T1450) — `FR-PIC-053`
- [ ] T1452 [US5] Wire `pmi.health` in `packages/mcp-server/src/tools/reads.ts` to `POST /v1/projects/{id}/health` with the caller's versions and the `credential_absent` detail (unit test: T1422; integration test: T1446)

---

## Phase 8: Polish & Cross-Cutting — F-043.8

- [ ] T1453 Update `README.md` §Setup and `docs/operator-setup.md` — the `pmi-studio` server, how the agent starts it from `.mcp.json`, `PMI_MCP_SERVER_COMMAND` for a checkout, publication as a promotion condition, and the `M1` flow in words (conformance: `tests/governance/readme-conformance.spec.ts`)
- [ ] T1454 Write the failing Tier 2 harness `e2e/tests/epic-043-m1.spec.ts` — Playwright creates a project with a root path and reads the credential once; a Node step starts the server from the project's `.mcp.json` over stdio with `PMI_STUDIO_TOKEN` in the environment and, through a real `Client`, registers, reports and completes an execution; Playwright reads the timeline entry and records the elapsed time from the completion call; a second project's credential is refused — writes `docs/uat/EPIC-043-m1-transcript.md` naming the stack (`R-043-12`, `SC-PIC-005`, `SC-PIC-007`)
- [ ] T1455 Fill `specs/043-pmi-integration-contract/quickstart.md` §Results with the measured figures (timeline latency, per-call verification) and the transcript path

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI, XII) — F-043.Z

- [ ] T1456 Confirm every implementation task in `specs/043-pmi-integration-contract/tasks.md` has a passing unit test or conformance check, by running `pnpm test:unit && pnpm test:contract && pnpm test:integration && pnpm test:arch` and recording the counts in `specs/043-pmi-integration-contract/closure.md`
- [ ] T1457 **Constitution XI Tier 1 (ALWAYS)** — `T1435`, `T1439`, `T1446` and `T1436` drive the mounted registry, the server through a real client, the reads and the timeline against the composed `AppModule` in `backend/src/app.module.ts` (integration tests: T1435, T1439, T1446, T1436); prove by inversion — remove `ConnectorModule` from `backend/src/modules/executions/executions.module.ts` and observe `T1439` fail — and record the observation in `specs/043-pmi-integration-contract/closure.md`
- [ ] T1458 **Constitution XI Tier 2** — run `e2e/tests/epic-043-m1.spec.ts` against the reference-local stack and commit `docs/uat/EPIC-043-m1-transcript.md`, run-generated, naming the stack (integration test: T1454)
- [ ] T1459 **Three mutation observations recorded** in `specs/043-pmi-integration-contract/closure.md`: `T1437`/`T1441` fail when a refusal is made to echo the credential (`SC-PIC-003`); `T1439` fails when the project-scope check is removed from `backend/src/modules/connector/connector-auth.guard.ts` (`SC-PIC-004`); `T1418` fails when `@UseGuards` is removed from one route in `backend/src/modules/executions/executions.controller.ts` (`SC-PIC-009`) — each restored and re-run green (unit tests: T1437, T1441; integration test: T1439; architecture test: T1418)
- [ ] T1460 **Constitution XII** — record in `specs/043-pmi-integration-contract/closure.md` that the commands producing this Epic's artifacts ran **unregistered** (the registration path did not exist), and that the `M1` transcript's execution is the **first registered execution from a developer's machine**; from the next Epic on, `EPIC-042`'s extension registers every governed command
- [ ] T1461 **ADRs and records**: confirm `adr/ADR-0010-pmi-studio-mcp-architecture.md` reads Accepted with its closure section, `adr/ADR-0030-local-first-execution-and-integration-contract.md` carries its 2026-09-04 amendment, and `specs/037-governed-execution-registry/defects/DEF-037-001-execution-history-readable-without-authentication.md` moves `T1038`'s posture from planned to delivered, naming `executions-mounted.spec.ts`
- [ ] T1462 Run `/speckit-converge`; append any remaining work to `specs/043-pmi-integration-contract/tasks.md`; triage `specs/043-pmi-integration-contract/defects/` leaving no open record; re-run `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:arch && pnpm test:governance`
- [ ] T1463 Regenerate `governance/epic-stage-register.md` with `pnpm register:update` and confirm this Epic's derived stage matches its evidence
- [ ] T1464 Promote `local → dev` (no environment skipped) — **needs explicit authorisation naming the environment** — with `@pmi/mcp-server` published under the name `.mcp.json` carries or the override documented for `dev` (`FR-PIC-062`), and publish `specs/043-pmi-integration-contract/closure.md`: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (`/speckit-specify` for `EPIC-042`)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3**: strict. The package and the contract codes (Phase 1) are what
  the mounted controller and the server import; identity at mint and the mount (Phase 2) are what
  every tool call needs to succeed.
- **Phase 3 (US1)** is the MVP and the only story with the server in it; **Phase 4 (US2)** hardens
  what Phase 3 built and can start once `T1419` and `T1424` exist; **Phase 5 (US3)** needs both
  bindings (`T1425`, `T1419`); **Phase 6 (US4)** needs the guard and scopes (`T1417`, `T1419`) and
  the server (`T1425`); **Phase 7 (US5)** needs the migration (`T1409`) and the reads controller
  (`T1445`).
- Within a phase, every `[P]` test task may run before or alongside its neighbours; each
  implementation task waits for its named test and for the file-sharing task before it
  (`T1424` → `T1425`, `T1419` → `T1421`, `T1445` → `T1449`).
- `T1418` **deletes** `executions-unmounted.spec.ts`; until `T1419` lands, the architecture suite
  is red by design — the failing-first observation `SC-PIC-009` asks for.

### Cross-Epic dependencies

| This Epic needs | From | State |
|---|---|---|
| `ConnectorAuthGuard`, the scope registry, `assuranceFor`, `.mcp.json`, the credential | `EPIC-041` | delivered on `epic/041-local-project-workspace`, this branch's base |
| `ExecutionRegistryFacade`, the fixture connector, the contract package | `EPIC-037` | delivered |
| `IdentitySnapshotService`, `PrincipalDelegationService`, `registerConnector` | `EPIC-028` | delivered |
| Epic entity for the Epic list | `EPIC-044` | later — the derivation is stated as unavailable (`R-043-9`) |
| Content for the four reserved tools | `EPIC-042`, `EPIC-045`, `EPIC-046` | later — reserved by name |

### Parallel Example: Phase 1

```text
T1398 · T1400 · T1402 · T1404 · T1406   (five failing checks, different files)
then T1399 → T1401 → T1403 → T1405 → T1407
```

### Parallel Example: Phase 3

```text
T1422 · T1423 · T1426 · T1428 · T1430 · T1431 · T1433 · T1435 · T1436   (nine failing tests)
then T1424 → T1425 → T1427 → T1429 ;  T1432 ;  T1434
```

## Implementation Strategy

1. **Phases 1–2 first** and commit: after them a credential can register an execution over REST
   through the composed application, and the architecture check guards the mount.
2. **US1 next** — the server, the timeline and the parity proof — and stop to demonstrate
   Scenario 3 through a real client. That is `M1` in-process.
3. **US2** before anything is shown to anyone: one refusal, nothing echoed, mutation observed.
4. **US3, US4, US5** in that order; each is small and independently demonstrable.
5. **Polish and closure**: the transcript is the last thing written, because it is the only thing
   here that a person, not a test, will read first.
