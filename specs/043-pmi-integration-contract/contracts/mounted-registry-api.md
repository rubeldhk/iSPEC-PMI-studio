# Contract — the mounted registry (`EPIC-043`)

`EPIC-037`'s REST binding, mounted behind the connector guard. Operation semantics, event
vocabulary and state machines are unchanged (`specs/037-governed-execution-registry/contracts/`).
What this document adds is **who may call, what the body may no longer carry, and what the
platform derives**.

## 1. Authentication and scope (every route below)

```text
Authorization: Bearer <connector credential>        required
X-Contract-Version: <contract version>              required; mismatch → 400 unsupported_contract_version
X-PMI-Surface: mcp-client                            optional; only the pmi-studio server sends it (R-043-4)
Idempotency-Key                                      required on every POST (EPIC-037)
```

- The guard resolves the credential to `req.connector = { credentialId, workspaceId, projectId,
  principal }`. Every refusal of a missing, malformed, unknown, revoked or other-project credential
  is **`401 { code: 'invalid_connector_credential', message: 'Invalid connector credential.' }`**
  and performs nothing (`FR-PIC-021`).
- Each route declares its `@ConnectorScope`; a credential reaching a route outside the registered
  scopes is `403 scope_required { scope }`.
- Workspace and project come from the credential. A path or body naming another is `404` for
  reads (non-disclosure) and `400` for writes.

## 2. Routes

| Route | Scope | Status | Body may not carry |
|---|---|---|---|
| `POST /v1/executions` | `execution.register` | `201` snapshot; replay `201` original | `workspaceId`, `projectId`, `identity`, `surface`, `assurance` → `400 identity_not_accepted` / `surface_not_accepted` |
| `POST /v1/executions/:id/events` | `execution.append` | `201 { eventId, sequence }`; `409` on `expectedSequence` mismatch | `workspaceId` |
| `POST /v1/executions/:id/completion` | `execution.complete` | `201` | `workspaceId` |
| `POST /v1/executions/:id/comments` | `execution.comment` | `201 { commentId }` — **new in this Epic**: `ExecutionRegistryFacade.comment()` over `ExecutionCommentService.add()` (`T1465`, `T1466`) | `workspaceId` |
| `POST /v1/executions/:id/proposals` | `execution.propose` | `202 { proposalId, state }` — accepted, never applied | `workspaceId` |
| `GET /v1/executions/:id/history` | `execution.read` | `200` ordered events; `404` when the execution's `projectId` is not the credential's (`FR-PIC-032`) | — (the path no longer carries a workspace) |
| `GET /v1/executions/:id` | `execution.read` | `200` snapshot; same `404` rule | — |
| `POST /v1/executions/sync` | `execution.sync` | `501 not_available_until { epic: 'EPIC-037' }` until `EPIC-037` US4 is delivered; then `200 { accepted[], conflicts[] }` | `workspaceId` |

The `:workspaceId` path segment `DEF-037-001` described is **gone**; the workspace is the
credential's. Every read verifies the execution's `projectId` against the credential's before
answering, and answers `404` otherwise — the same non-disclosure rule as the guard's.

### Deviations from `EPIC-037`'s contract document (analysis `I1`)

`specs/037-governed-execution-registry/contracts/execution-contract.md` §2 was written before the
controller; the **built controller is authoritative** and this Epic mounts it as built.

| `EPIC-037` §2 says | Built and mounted here | Note |
|---|---|---|
| `POST …/{id}/complete` | `POST …/:id/completion` | same semantics |
| `POST …/{id}/status-proposals` | `POST …/:id/proposals` | same `202` |
| `GET …/{id}/events` | `GET …/:id/history` | same ordered stream |
| `GET /v1/executions?target=…&targetVersion=…` | not mounted | artifact-history query is `FR-EXR-016`, unbuilt in `EPIC-037`; out of scope here |
| `POST …/{id}/comments` | added by this Epic | `EPIC-037` built the service, not the route |
| `POST /v1/executions/sync` | reserved | `EPIC-037` US4 unbuilt |

The drift in `EPIC-037`'s document is its owner's to correct; it is recorded here so the two
documents can be read together.

## 3. What the platform derives on `POST /v1/executions`

| Field | Source |
|---|---|
| `workspaceId`, `projectId` | the credential |
| `identity` | `connector-identity.ts` from `req.connector` (data-model.md §5) |
| `surface` | `local-cli`, or `mcp-client` when `X-PMI-Surface: mcp-client` |
| `assurance` | `assuranceFor(surface)` (`EPIC-041`) |

## 4. The timeline read — session-scoped, for the screen (`FR-PIC-035`, `R-043-7`)

```text
GET /v1/projects/:id/executions?surface=&state=&initiator=&after=&limit=     200
    { items: [{ executionId, command, surface, assurance, state, initiator: { principalId, kind, label }, sponsorUserId, registeredAt, completedAt, proposal: { id, state, decidedBy } | null }], nextCursor }
GET /v1/projects/:id/executions/:executionId/events                          200
    [{ sequence, type, category, actorId, occurredAt, payload }]
GET /v1/projects/:id/workstation-connections                                 200
    [{ credentialId, label, credentialState, firstSeenAt, lastSeenAt, extensionVersion, toolkitVersion, contractVersion, serverVersion }]
```

Session cookie, workspace membership, project in the workspace — the universal product rules.
No route applies or approves a transition (`FR-PIC-054`).

## 5. The architecture check that replaces `executions-unmounted.spec.ts` (`R-043-10`)

`executions-mounted.spec.ts`: static — every handler in `executions.controller.ts` carries
`@UseGuards(ConnectorAuthGuard)` and a registered `@ConnectorScope`; live — the composed
`AppModule` answers every route above with the one `401` for an absent credential, and a control
route (`GET /v1/auth/me` → `401` of the session kind) proves the router is alive. Observed red by
removing the guard from one route (`SC-PIC-009`).
