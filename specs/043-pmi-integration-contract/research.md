# Research — EPIC-043 PMI Integration Contract

**Session**: 2026-09-04 · **Plan**: [plan.md](./plan.md)

Twelve decisions. Each records what was chosen, why, what lost, and the documentation consulted.
Context7 was available in this session; the one external dependency was verified against it.

## `R-043-1` — The server is a REST client in its own package

**Decision**: `packages/mcp-server` (`@pmi/mcp-server`) is a stdio MCP server whose every tool is
a translation of one mounted route. It depends on `@modelcontextprotocol/sdk`, `zod`, and
`@pmi/execution-registry-contract` (types, the contract version, the surface vocabulary) — and on
**nothing else in this repository**. It never imports `@pmi/backend`, a store, or Prisma. The
platform address and the credential come from `PMI_STUDIO_URL` and `PMI_STUDIO_TOKEN`, which is
exactly what `EPIC-041` wrote into `.mcp.json`.

**Rationale**: the server runs on the user's machine, where the API's process is not; so it must
speak to the platform over the network. Once it does, the parity `EPIC-037` demands (`FR-EXR-020`,
`AC-EXR-01`–`04`) is **structural** — MCP → REST → registry — and `FR-PIC-011` (no business rule in
the server) is true by construction. It also keeps the boundary `DEF-037-001` taught: the only
thing that authenticates a connector is the guard on the routes, and the server is just one more
caller of them.

**Alternatives considered**: (a) a second transport compiled into the API, reaching the facade
in-process — runs only where the API runs; rejected. (b) A server that embeds the registry client
SDK and the facade over a database connection — the connector-writes-to-tables anti-pattern
`BR-0201` forbids; rejected.

**Docs consulted**: none needed (repository architecture).

## `R-043-2` — The SDK line and its import paths

**Decision**: `@modelcontextprotocol/sdk` **^1.29** (the `v1.x` line), `zod` **^3** as its peer.
Imports: `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport` from
`@modelcontextprotocol/sdk/server/stdio.js`, `Client` from `@modelcontextprotocol/sdk/client/index.js`,
`InMemoryTransport` from `@modelcontextprotocol/sdk/inMemory.js`. Tools are registered with
`server.registerTool(name, { title, description, inputSchema, outputSchema, annotations }, handler)`;
handlers return `{ content, structuredContent }` and, for refusals, `{ content, isError: true,
structuredContent }`. The SDK validates `structuredContent` against `outputSchema` for
non-error results and skips validation for `isError` results, which is what lets a refusal carry
its own shape (`R-037-7`).

**Rationale**: the 1.x line is the stable, published one; the 2.0 line is alpha with different
package names (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`) and subpath
layout. Pinning 1.x with the migration guide on record means the eventual move is a mechanical
import change.

**Alternatives considered**: the 2.0 alpha — rejected as unreleased; a hand-rolled JSON-RPC stdio
layer — rejected in Complexity Tracking.

**Docs consulted**: Context7 `/modelcontextprotocol/typescript-sdk/__branch__v1.x` — *server
overview and registerTool with outputSchema*; `/modelcontextprotocol/typescript-sdk` — *errors:
isError for recoverable refusals*, *testing: InMemoryTransport.createLinkedPair, Client.listTools
and callTool*, *migration guide v1→v2 (import paths)*.

## `R-043-3` — How a connector credential satisfies the registry's identity

**Decision**: the registry requires `ExecutionIdentityRefs` — `authenticatedPrincipalId`,
`agentSnapshotId`, `connectorRegistrationId`, `sponsorUserId`, `delegationId`,
`delegationIdentityVersion` — and resolves the snapshot and the delegation authoritatively
(`execution-registration.service.ts`). `EPIC-041` minted a `connector` Principal per credential
and nothing else. This Epic completes the identity **at mint**, in `ConnectorCredentialService`:

1. a `ConnectorRegistration` per workspace per surface kind (`mcp-client`, `local-cli`), created
   on first need and referenced by the principal;
2. an identity snapshot captured through `IdentitySnapshotService.capture(workspaceId,
   principalId)` and stored on the credential (`connector_credentials.snapshotId`); re-captured
   when the principal's identity version changes;
3. delegations from the sponsoring owner to the principal for the four delegable actions
   (`execution.register`, `execution.report`, `execution.attach-evidence`, `transition.propose`)
   on the artifact `{ artifactType: 'project', artifactId: projectId }`.

Existing credentials (minted before this Epic) are completed **lazily on first guarded call**, by
the same code path, so no back-fill migration invents identity rows.

The guard already produces `ConnectorRequestContext { credentialId, workspaceId, projectId,
principal }`. A new `connector-identity.ts` builds `ExecutionIdentityRefs` from it, and the
controller passes **that** to the facade — the body's `identity` is refused if present
(`FR-PIC-024`, refusal `identity_not_accepted`).

The registry's delegation check uses the execution's **target** as the artifact
(`request.input.targetType/targetId`). A connector is delegated on the project, and a target
(a specification, an Epic) lives inside it. `ExecutionRegistrationService` is extended so that a
delegation on the execution's `projectId` **covers any target within that project**; the check is
not weakened — a target in another project still fails.

**Rationale**: the registry's identity model (`EPIC-028`, `C3B`) is the right one and is kept
whole; what was missing was a caller that could populate it honestly. Doing it at mint keeps the
per-call path to a lookup, and doing it in the credential service keeps `EPIC-041`'s module the
owner of everything a credential is.

**Alternatives considered**: (a) a synthetic snapshot per call — a snapshot that is never stored
is not a snapshot; rejected. (b) Skipping the delegation check for connector principals — that
*is* weakening the check; rejected. (c) Delegating per target on demand — a delegation minted by
the thing it authorises; rejected.

**Docs consulted**: none needed.

## `R-043-4` — Surface and assurance are derived from the transport

**Decision**: the mounted controller sets `surface: 'local-cli'` for a request that arrived with
a connector credential over REST; the server sets `surface: 'mcp-client'` on every registration it
forwards, and the controller **accepts** `mcp-client` only from a request carrying the server's
`X-PMI-Surface: mcp-client` header, which the server always sends. Any other body-supplied
`surface` is refused (`surface_not_accepted`, the pattern `EPIC-041` set for `assurance`).
Assurance is derived by `assuranceFor(surface)` exactly as `EPIC-041` wired it (`FR-LPW-034`).

**Rationale**: the clarified answer keeps the two surfaces distinct because `AC-EXR-02` and
`AC-EXR-03` test them separately; the header is the smallest honest way for the server to say
which it is, and it cannot widen anything (both surfaces are `local`).

**Alternatives considered**: one surface for both — loses the parity distinction; caller-declared
surface — the body is the thing we stopped trusting.

## `R-043-5` — The refusal vocabulary and its parity

**Decision**: one vocabulary, three renderings. REST renders a refusal as the platform's error body
(`toErrorBody`), MCP as `{ isError: true, structuredContent: { code, message, …detail } }`, the SDK
adapter as a typed rejection. The codes this Epic adds to the contract's `REGISTRY_REFUSALS`:
`invalid_connector_credential` (the one refusal for every credential failure — message
`Invalid connector credential.`, verbatim from the guard), `scope_required` (with the scope name),
`identity_not_accepted`, `surface_not_accepted`, `not_available_until` (with the Epic), and
`platform_unreachable` (server-side only: the platform did not answer). Credential-shaped values
anywhere in a refusal are replaced by `<credential>` before rendering (`FR-PIC-026`).

**Rationale**: `R-037-7` already decided refusals are tool results, not protocol errors, because a
refused registration is a governed outcome the caller must record. A code the extension can switch
on (`EPIC-042`) is what makes that decision usable.

**Alternatives considered**: JSON-RPC errors for refusals — rejected by `EPIC-037`.

## `R-043-6` — Contract-version negotiation

**Decision**: the server pins `CONTRACT_VERSION` from `@pmi/execution-registry-contract`, sends it
as `X-Contract-Version` on every request, and advertises it in the MCP `initialize` result
(`serverInfo.version` carries the package version; `instructions` carries the contract version).
A tool argument `contractVersion` naming another version is refused before the call leaves the
server (`unsupported_contract_version`, the existing code). The REST controller refuses a missing or
mismatched header the same way.

**Rationale**: `EPIC-037` requires negotiation, never best-guessing; doing it at both ends makes a
stale server and a stale client both visible.

## `R-043-7` — The timeline read

**Decision**: a session-authenticated `GET /v1/projects/:id/executions` (filters `surface`,
`state`, `initiator`; newest first; cursor-paginated) and `GET
/v1/projects/:id/executions/:executionId/events`, served by a new `ExecutionTimelineService` over
the executions store and the projection service. It reads only executions whose `projectId` is the
route's project and whose workspace is the session's. The screen is a panel of the project screen
(clarified), with the four `FR-SHL-060` states and the filters `PMI-DOC-005` requires.

**Rationale**: the registry has per-execution reads and no per-project listing because nothing
needed one until a screen existed. The listing is a read model, not a new store.

**Alternatives considered**: a workspace-wide area — deferred by the clarification.

## `R-043-8` — The workstation connection record

**Decision**: a new table `workstation_connections` — one row per credential — written by
`pmi.health` (`POST /v1/projects/:id/health` behind the guard) with `lastSeenAt`, `firstSeenAt`,
`extensionVersion`, `toolkitVersion`, `contractVersion`, `serverVersion`. Read by the session route
`GET /v1/projects/:id/workstation-connections` for the Local workspace panel. Revocation does not
delete the row; the panel shows the credential's state beside it.

**Rationale**: the replan's first-run flow ends with `pmi.health` *recording the workstation as
connected* (§2.2 step 4), and `EPIC-042`'s setup skill reports versions into exactly this record.

## `R-043-9` — The reads, and the Epic list before `EPIC-044`

**Decision**: `GET /v1/projects/:id/context` returns the project's own fields, the extension and
contract versions, the public address, and `epics: []` with `epicSource:
'unavailable-until-EPIC-044'`; `GET /v1/projects/:id/requirements?groupBy=epic` returns every
active requirement under the one group `unassigned` with `epicSource` stated the same way. The
`Requirement` model has **no grouping field today** — PMI-DOC-007 §3 adds `epicId` in `EPIC-044` —
so the honest derivation is *none*, stated in the response, and `EPIC-044` replaces the source
without changing the shape (`FR-PIC-043`). Both routes are behind the guard with scopes
`project.read` and `requirements.read`.

**Rationale**: inventing a grouping (by reference prefix, by type) would be a second Epic model
that `EPIC-044` would have to migrate away from.

## `R-043-10` — The replacement architecture check

**Decision**: `executions-unmounted.spec.ts` is **deleted** and `executions-mounted.spec.ts` takes
its place, with the same two halves inverted: the static half reads the controller and asserts
every route handler carries `@UseGuards(ConnectorAuthGuard)` and a `@ConnectorScope` that the scope
registry knows; the live half boots the composed `AppModule` and asserts every route answers an
absent credential with the one `401` refusal, a control route proving the server is alive. The
inversion required by `SC-PIC-009` is performed by removing the guard from one route and observing
both halves fail.

**Rationale**: `DEF-037-001`'s lesson — source inspection let the original mistake through — is why
the live half stays.

## `R-043-11` — The checkout override

**Decision**: `mcpServerEntry` (`EPIC-041`, `project-files.ts`) honours an optional
`PMI_MCP_SERVER_COMMAND` (a full command line, split on whitespace): when set, `.mcp.json`'s entry
runs that instead of `npx -y @pmi/mcp-server@<version>`. It is declared in `.env.example` and the
governance configuration check; it is **not** set in `docker-compose.yml`. The published package
and the override run the same `packages/mcp-server/src/main.ts`.

**Rationale**: the clarified answer — an npm package with a checkout override for development —
needs one variable and no second copy of platform code.

## `R-043-12` — The `M1` transcript

**Decision**: `e2e/tests/epic-043-m1.spec.ts` drives the reference-local stack: Playwright creates
a project with a root path and copies the credential once; a Node step starts the server from the
project's `.mcp.json` over stdio with `PMI_STUDIO_TOKEN` in the environment and, through a real
`Client`, registers, reports and completes an execution; Playwright then reads the timeline entry.
The transcript records the elapsed time from the completion call to the entry's appearance
(`SC-PIC-005`, 5 s) and the refusal of a second project's credential (`SC-PIC-007`).

**Rationale**: Constitution XI Tier 2 asks for a run-generated transcript of a journey; `M1` is
the journey this Epic exists for.

**Docs consulted**: none needed (Playwright is already the e2e harness).
