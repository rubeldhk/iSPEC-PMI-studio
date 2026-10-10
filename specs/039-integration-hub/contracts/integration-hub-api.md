# Contract: Integration Hub API

**Epic**: `EPIC-039` · **Date**: 2026-10-09 · **Model**: [../data-model.md](../data-model.md) ·
**Package**: [capability-contract.md](./capability-contract.md)

All routes are workspace-scoped through the existing authenticated workspace context
(`backend/src/core/workspace.guard.ts`). Project routes resolve the project inside the caller's
workspace and answer `404` for a project in another workspace (`FR-HUB-005`, the platform
visibility rule). Errors use the platform classes in `backend/src/core/errors.ts`:
`400 ValidationFailedError`, `403 ForbiddenError`, `404 NotFoundError`, `409 ConflictError`,
`503 GovernanceSeamUnboundError` (the body names the seam). **No new error class** — a refused
resolution is not an HTTP error; it is a `200` carrying a refusal (see *Capability requests*).

**No route returns, echoes or logs a credential value** (`FR-HUB-043`). Every response body of
every route below is in the scope of the `SC-HUB-004` canary scan (quickstart Q14).

## 1. Registry (`BR-0123`) — read: `EPIC-024` read on the workspace's `integration-registry` artifact

| Method | Route | Purpose | Notes |
|---|---|---|---|
| `GET` | `/integrations/registry?projectId=` | Every entry, both directions, `pmi-studio` first | Each entry carries **every** lifecycle field (`FR-HUB-023`, `SC-HUB-003`); see *Entry shape*. `projectId` supplies the per-project facts (configuration status, health); without it those fields read *not applicable — "no project selected"* |
| `GET` | `/integrations/registry/:entryId?projectId=` | One entry, plus its health history (latest 100) and recent resolutions (latest 50) with explanations | `FR-HUB-072` — one response, so the screen needs no second screen |
| `GET` | `/integrations/capabilities` | The vocabulary: every capability contract version with status | `FR-HUB-003` |
| `GET` | `/integrations/capabilities/:name/versions/:major.:minor` | One version's full contract | |

### Entry shape

```text
{ id, key, name, direction: 'outbound'|'inbound', status: 'active'|'retired', listedOrder,
  provider:        Fact<string>,
  transport:       Fact<'native-api'|'cli'|'mcp'|'customer-connector'|'rest'>,
  version:         Fact<string>,
  compatibility:   Fact<{ capabilities: [{ name, majors[] }] } | { integrationContract: string }>,
  permissionScope: Fact<{ resources[], access } | { operations: string[] }>,
  authorisation:   Fact<'github-app-installation'|'github-token'|'resend-api-key'|'fixture-token'|'project-connector-credential'|...>,
  configuration:   Fact<{ state: 'configured'|'not-configured', setBy?, setAt? }>,   // never a value
  health:          Fact<{ state: 'healthy'|'degraded'|'unhealthy'|'unknown', reason?, checkedAt? }>,
  audit:           { registeredBy, registeredAt, retiredBy?, retiredAt?, lastChangeAt } }

Fact<T> = { applicable: true, value: T } | { applicable: false, reason: string }
```

`Fact` is the type that makes *"never blank"* (`FR-HUB-023`) a compile-time property: a field is
either a value or a reason, and there is no third shape. It is exported by
`@pmi/capability-contract` so the screen renders the two branches differently (`FR-HUB-073`).

## 2. Registration and retirement (`FR-HUB-029`) — `EPIC-024` edit on `integration-registry`

| Method | Route | Purpose | Notes |
|---|---|---|---|
| `POST` | `/integrations/registry` | `{ key }` — list an adapter the running catalog contains | `400` if the key is not in the catalog; `409` if already listed; recorded with before/after (`FR-HUB-025`) |
| `POST` | `/integrations/registry/:entryId/retire` | Retire an entry | Idempotent. Configurations pointing at it stay and read *points at a retired adapter*; requests refuse naming the retirement (spec Edge Cases) |

Connectors are **not** registered through this route: they are listed by the seed (`R-039-5`).
`POST` with a connector key is `400 — "connectors are listed by the platform, not registered"`.

## 3. Project configuration (`FR-HUB-031`, `FR-HUB-062`) — owner grant on the project

The **owner grant** is the one `FR-LPW-027` uses: the project's owner, or an active `edit` grant on
the project artifact (`R-039-10`).

| Method | Route | Purpose | Notes |
|---|---|---|---|
| `GET` | `/projects/:projectId/integrations/configuration` | Every capability's configuration, with derived policy status per adapter | Read grant on the project suffices |
| `PUT` | `/projects/:projectId/integrations/configuration/:capability` | Replace one capability's configuration | Body: `{ adapters: [{ registryEntryId, preference }], permitDegraded?, permittedEnvironments?, onNotNarrowable?, healthIntervalSeconds?, providerBinding? }`. `400` when `adapters` has more than one element without distinct preferences, names an inbound or retired entry, or `providerBinding` fails the adapter's binding schema or contains secret-looking material (`FR-HUB-045`). On success: `configVersion` increments, an `EPIC-031` decision is requested (`R-039-7`) and the response carries `{ configVersion, decisionId, policyStatus }`. `503` naming `CapabilityPolicy` while the decision seam is unbound |

## 4. Credentials (`FR-HUB-040`–`FR-HUB-047`) — owner grant on the project

| Method | Route | Purpose | Notes |
|---|---|---|---|
| `PUT` | `/projects/:projectId/integrations/credentials/:entryId` | Set or replace | Body `{ kind, value }` — `kind` must be one the adapter declares. **`204 No Content`**: nothing is echoed. `403` without the owner grant (`US4` AS2). `503` naming `CredentialKeyring` when no platform key is configured — never stored unencrypted. The adapter's next health check is scheduled immediately, so the owner sees the result within one check (`SC-HUB-008`) |
| `DELETE` | `/projects/:projectId/integrations/credentials/:entryId` | Remove | `204`; idempotent; the adapter becomes ineligible as **not configured** (`US4` AS5) |
| `GET` | `/projects/:projectId/integrations/credentials` | Status only | `[{ entryId, state: 'configured'|'not-configured', kind?, setBy?, setAt? }]` — the response type has no value field (`FR-HUB-043`). **This is the read `SC-HUB-004`'s mutation targets** |

Setting, replacing and removing are audited with actor and instant, never the value
(`FR-HUB-046`).

## 4a. Deployment-scope binding (`Embed`, `FR-HUB-084`) — `EPIC-024` edit on `integration-registry`

| Method | Route | Purpose | Notes |
|---|---|---|---|
| `GET` | `/integrations/deployment/capabilities` | Every deployment-scope capability: bound adapter, observed model `{ model, version, dimension }`, derived health, credential status | Read on `integration-registry` |
| `PUT` | `/integrations/deployment/capabilities/Embed` | `{ registryEntryId, providerBinding, permittedEnvironments?, healthIntervalSeconds? }` | `400` for an unlisted model, an inbound/retired entry, or a binding naming a different adapter/model from another workspace's binding (one vector space per deployment). Response `{ observedModel, reindexRequired: boolean }` — `true` whenever `modelId` changed (`US7` AS4) |
| `DELETE` | `/integrations/deployment/capabilities/Embed` | Unbind | `EPIC-038` returns to the `503` naming `EmbeddingPort` (`FR-HUB-085`) |
| `PUT` / `DELETE` / `GET` | `/integrations/deployment/credentials/:entryId` | Deployment credential — same semantics as §4 | Edit on `integration-registry` instead of the project owner grant |

## 5. Capability requests (`BR-0120`, `BR-0121`) — platform-side callers only

`POST /projects/:projectId/capability-requests`

```text
{ capability: string,          // a vocabulary name
  major: number,               // FR-HUB-033
  caller: PlatformCaller,      // 'room:requirement' | 'room:change' | 'room:defect' | 'loop' |
                               // 'context-assembly' | 'evidence-intake' | 'notification-dispatch'
  executionId?: string,        // FR-HUB-038
  input: object }              // validated against the contract's inputSchema
```

- **`Embed` is not requested here**: it is deployment-scoped and reached only through
  `EPIC-038`'s `EmbeddingPort` (§8). A body naming `Embed` is `400 — "Embed is resolved at
  deployment scope through EmbeddingPort"`.
- **Who may call**: an authenticated **session** principal acting through a platform caller.
  A **connector** principal — the developer's local agent, `pmi-studio`, any `EPIC-041` connector
  credential — is refused `403 surface_not_accepted` before anything else is read (`FR-HUB-004`,
  `US1` AS5). There is no MCP tool for this route, and `mcp-server-boundary.spec.ts` gains a case
  asserting none is added (`R-039-12`).
- **The body MUST NOT name a provider, adapter or transport.** Any of the keys `adapter`,
  `adapterKey`, `provider`, `transport`, `registryEntryId`, or a value equal to a catalog key, is
  refused as `provider-pinned` (`FR-HUB-001`, `US1` AS3).
- **`200`**, always, for a decided request:

```text
{ resolutionId,
  outcome: 'resolved' | 'refused',
  refusal?: { code, message, candidates: [{ entryKey, ineligibleBecause, detail }] },
  resolution?: { contractVersion, adapterKey, adapterVersion, provider, eligibleBecause[],
                 scope: { requested, granted, narrowing } },
  invocation?: { outcome: 'succeeded' | 'failed' | 'adapter-fault', errorCategory?, retryAfterSeconds? },
  result?: <the capability's outputSchema> }      // only when invocation.outcome = 'succeeded'
```

  A refusal is the Hub working, not failing, so it is not a 4xx — the same reasoning
  `EPIC-031` applies to `refused` decisions surfaced in a body (`R-039-7`). `400` is reserved for a
  malformed body; `503` for an unbound seam the request cannot be decided without
  (`CapabilityPolicy`).
- **Explanation** (`FR-HUB-036`): `eligibleBecause` names each condition that held; a refusal lists
  **every** candidate adapter with the first condition it failed. The policy condition embeds the
  `EPIC-031` `Explanation` (`policyVersion`, `matchedRule`, `riskClass`, `authorityApplied`)
  verbatim.
- Recorded as a `capability_resolutions` row and, with `executionId`, a `capability-resolved`
  event on that execution (`FR-HUB-037`, `FR-HUB-038`).

## 6. Evidence intake (`BR-0125`) — job, not route

The intake runs as the job `integrations.evidence-intake` (the `EPIC-037`/jobs pattern, `R-039-11`),
enqueued by `POST /projects/:projectId/integrations/evidence-intake`:

```text
{ workRef: { type, id }, contractItemId, capability: 'ReadTestResults' | 'ReadBuildStatus',
  revision?: string, attestedArtifact: { id, version } }
```

- `202 { intakeId }`. `400` when `revision` is missing — recorded as `not-contributed / no-revision`
  first (`FR-HUB-053`).
- `GET /projects/:projectId/integrations/evidence-intake/:intakeId` — state, reason, attempts,
  resolutions, `attestationId`.
- The job contributes through `EPIC-032`'s `EvidenceService.contribute` with
  `source.uri = "pmi-adapter:<adapterKey>"`, authorised by this Epic's `AttestationSource`
  binding (`R-039-11`).

## 7. Integrations screen reads

The screen (`/integrations`) uses §1 only, plus `GET /projects/:projectId/integrations/configuration`
for the configuration summary. It calls no write route; the frontend architecture test asserts the
page imports no mutating client function (`R-039-16`).

## 8. `EPIC-038`'s routes, reached through `Embed` (`SC-HUB-009`)

Not this Epic's routes, and not changed by it: `POST /context/packages` and
`POST /context/index/reindex` (W38 `context.controller.ts`). Bound through `HubEmbeddingPort`, they
stop answering `503 governance_seam_unbound — EmbeddingPort` once `Embed` is bound and eligible, and
answer it again (with the Hub's explanation in the message) when it is not. These two routes are
`SC-HUB-009`'s Tier 1 entry points.

## Ports this Epic declares (`R-039-13`)

| Port | Filled by | Absent |
|---|---|---|
| `CapabilityPolicy` | `EPIC-031` `DecisionEngine` adapter | **refuse** — configuration `PUT` and every resolution `503` naming it |
| `EvidenceSink` | `EPIC-032` `EvidenceService` adapter | **refuse** — intake records `refused / evidence-seam-unbound`; the Evidence Contract item stays unmet (`FR-HUB-055`) |
| `CredentialKeyring` | platform key material from configuration (`R-039-10`) | **refuse** — credential `PUT` `503`; adapters needing a credential are ineligible as `credential-missing` |
| `ExecutionEvents` | `EPIC-037` `ExecutionRegistryFacade.appendEvent` | bound on `main` |
| `RegistryAccess` | `EPIC-024` access inheritance | bound on `main` |
| `ProjectOwnerGrant` | `EPIC-042` `OwnerGate.requireOwner` (the `EPIC-041` rule) | bound on `main` |

And one it **fills** for `EPIC-038`: `EMBEDDING_PORT` (`CONTEXT_EMBEDDING_PORT`) with
`HubEmbeddingPort` — **blocked until `EPIC-038`'s retrieval merges** (`R-039-18`).

And one it **fills**: `EPIC-032`'s `AttestationSource` (`EVIDENCE_ATTESTATION_SOURCE`) —
`authorise("pmi-adapter:<key>", workspaceId)` returns `{ uri, version }` for an active outbound entry
of that workspace, the version taken from the catalog, and `null` otherwise.
