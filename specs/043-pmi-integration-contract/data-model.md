# Data Model — EPIC-043 PMI Integration Contract

**Session**: 2026-09-04 · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

Additive only. One table, one column, one index, and rows the mint step now creates in tables
`EPIC-028` already owns. Nothing is removed; nothing `EPIC-037` stored changes shape.

## 1. New table — `workstation_connections` (`R-043-8`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId` | text | tenancy, indexed |
| `projectId` | text FK → `projects` | |
| `credentialId` | text FK → `connector_credentials` | **unique** — one row per credential |
| `firstSeenAt` | timestamptz | set once |
| `lastSeenAt` | timestamptz | updated by every `pmi.health` |
| `extensionVersion` | text? | reported by the caller; the bundle version it holds |
| `toolkitVersion` | text? | reported by the caller (the engine's local toolkit) |
| `contractVersion` | text | the version the caller negotiated |
| `serverVersion` | text? | `@pmi/mcp-server` package version |
| `createdAt`, `updatedAt` | timestamptz | universal columns |

Written only through `WorkstationConnectionService.touch(...)` from the health route. Never
deleted; revocation of the credential leaves the row, and the panel shows the credential's state
beside it.

## 2. New column — `connector_credentials.snapshotId` (`R-043-3`)

`snapshotId text NULL` — the identity snapshot captured at mint (or lazily, for credentials minted
before this Epic). Re-captured, and the column updated, when the principal's `identityVersion`
changes. The guard's identity derivation reads it; a null triggers the lazy completion path.

## 3. New index — `executions (workspaceId, projectId, registeredAt DESC)` (`R-043-7`)

For the per-project timeline listing. `executions.projectId` already exists and is nullable; every
execution registered through the guard sets it from the credential, and the timeline reads only
rows whose `projectId` is set.

## 4. Rows created at mint (no schema change)

| Table | Row | When |
|---|---|---|
| `connector_registrations` | one per workspace per surface kind (`mcp-client`, `local-cli`), `registeredByUserId` = the minting owner | first mint that needs it |
| `identity_snapshots` (EPIC-028) | one per credential at mint, `principalId` = the credential's principal | mint, and identity-version change |
| `delegations` (EPIC-024/028) | four per credential: `execution.register`, `execution.report`, `execution.attach-evidence`, `transition.propose`, from the sponsor to the principal, on `{ artifactType: 'project', artifactId }` | mint |

Revoking a credential revokes its four delegations in the same transaction (the principal is also
moved out of `active`, as `EPIC-041` does today), so a revoked credential fails **both** the guard
and, should anything bypass it, the registry's own delegation check.

## 5. The identity derivation (`R-043-3`)

```text
ConnectorRequestContext                     ExecutionIdentityRefs
  credentialId ──► credential.snapshotId ──► agentSnapshotId
  principal.id ──────────────────────────► authenticatedPrincipalId
  principal.sponsorUserId ───────────────► sponsorUserId
  principal.connectorRegistrationId ─────► connectorRegistrationId
  (delegation lookup: principal × project × 'execution.register') ──► delegationId, delegationIdentityVersion
```

Built by `connector-identity.ts`, once per request, from server-side facts only. A body carrying
`identity` is refused (`identity_not_accepted`). The registry then resolves the snapshot and the
delegation authoritatively exactly as before — the check is not moved, only fed honestly.

**Delegation scope**: `ExecutionRegistrationService` treats a delegation on
`{ 'project', execution.projectId }` as covering a target of any type **inside that project**. A
target in another project, or an execution with no `projectId`, is checked against the target
itself as today.

## 6. Surface, assurance and the transport (`R-043-4`)

| Arrived through | `surface` | `assurance` (`assuranceFor`) |
|---|---|---|
| Mounted REST route with a connector credential, no `X-PMI-Surface` header | `local-cli` | `local` |
| Mounted REST route with a connector credential and `X-PMI-Surface: mcp-client` | `mcp-client` | `local` |
| Managed sandbox / CI (unchanged, `EPIC-037`, `EPIC-041`) | as today | `managed` |

A body-supplied `surface` or `assurance` is refused.

## 7. Refusal vocabulary (`R-043-5`) — additions to `REGISTRY_REFUSALS`

| Code | REST | MCP | Carries |
|---|---|---|---|
| `invalid_connector_credential` | 401, message `Invalid connector credential.` | `isError`, same message | nothing else — the one refusal (`FR-PIC-021`) |
| `scope_required` | 403 | `isError` | `scope` |
| `identity_not_accepted` | 400 | `isError` | the field name |
| `surface_not_accepted` | 400 | `isError` | the field name |
| `unsupported_contract_version` | 400 | `isError` | `supported`, `received` |
| `not_available_until` | 501 | `isError` | `epic` |
| `platform_unreachable` | — | `isError` | `address` (host only, never the credential) |

Every refusal passes through the sanitiser that replaces credential-shaped values with
`<credential>` (`FR-PIC-026`).

## 8. Connector scopes registered by this Epic

`execution.register`, `execution.append`, `execution.complete`, `execution.comment`,
`execution.propose`, `execution.read`, `execution.sync`, `project.read`, `requirements.read`,
`health.write` — alongside `EPIC-041`'s `connector.whoami`. The architecture test asserts the
registry holds **exactly** these eleven, so a route cannot invent a scope and a scope cannot exist
without a route.

## 9. Entities the screen reads (projections, not tables)

- **Execution timeline entry**: `executionId, command, surface, assurance, state, initiator
  (principal kind + label), sponsor, registeredAt, completedAt?, proposal?` — from the executions
  store and `ExecutionProjectionService`.
- **Timeline event**: `sequence, type, category, actorId, occurredAt, payload (sanitised)` — the
  existing `AppendedEvent`.
- **Workstation connection view**: §1 joined to the credential's label and state.
