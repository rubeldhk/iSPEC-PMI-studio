# Contract — the `pmi-studio` MCP tool surface (`EPIC-043`)

**Checked by** `backend/tests/contract/mcp-tool-surface.spec.ts`: the running server's `tools/list`
must name exactly the tools below, with the argument and result shapes stated here (`FR-PIC-005`).
The semantics of the seven execution tools are `EPIC-037`'s
(`specs/037-governed-execution-registry/contracts/execution-contract.md`) and are **not restated**.

**Server identity**: name `pmi-studio`; `serverInfo.version` = the package version;
`instructions` states the contract version and that every call requires `PMI_STUDIO_TOKEN` in the
environment.

**Rules for every tool** (`R-043-5`, `R-043-6`): a refusal is a tool result with `isError: true`
and `structuredContent: { code, message, …detail }`, never a protocol error; every mutating tool
requires `idempotencyKey`, and carries a `correlationId` — required on `register` and `proposeStatus`, optional on `appendEvent`, `complete` and `comment` (whose `EPIC-037` request types have none), where it travels as the `x-correlation-id` header; every tool accepts an optional `contractVersion` and
refuses a value other than the server's; **no argument, result or refusal carries a credential**
— a credential-shaped value in any argument is refused as `credential_in_argument` naming the
argument, never its value.

## 1. Execution tools — `EPIC-037`'s seven: six live, `sync` reserved

| Tool | Route it translates to | Mutating | Scope | State |
|---|---|---|---|---|
| `pmi.execution.register` | `POST /v1/executions` | yes | `execution.register` | live |
| `pmi.execution.appendEvent` | `POST /v1/executions/{id}/events` | yes | `execution.append` | live |
| `pmi.execution.complete` | `POST /v1/executions/{id}/completion` | yes | `execution.complete` | live |
| `pmi.execution.comment` | `POST /v1/executions/{id}/comments` | yes | `execution.comment` | live — **route and facade method added by this Epic** (`T1465`, `T1466`) |
| `pmi.execution.proposeStatus` | `POST /v1/executions/{id}/proposals` | yes | `execution.propose` | live |
| `pmi.execution.history` | `GET /v1/executions/{id}/history` and `GET /v1/executions/{id}` — result `{ snapshot, events }` | no | `execution.read` | live |
| `pmi.execution.sync` | `POST /v1/executions/sync` | yes | `execution.sync` | **reserved** — `not_available_until { epic: 'EPIC-037' }` until its provisional intake (US4) is delivered (`FR-PIC-034`) |

Argument shapes are the contract's request types **minus** `workspaceId`, `projectId`, `surface`,
`identity` and `assurance` — the server never sends them and the route never accepts them. The
server adds the header `X-PMI-Surface: mcp-client`. Result shapes are the contract's
`ExecutionSnapshot`, `AppendedEvent` and history list, as `structuredContent`.

## 2. Reads

| Tool | Route | Scope | Result (`structuredContent`) |
|---|---|---|---|
| `pmi.health` | `POST /v1/projects/{id}/health` — `{id}` resolved from the credential | `health.write` | `{ projectId, contractVersion, apiVersion, serverVersion, connectedAt }` |
| `pmi.project.context` | `GET /v1/projects/{id}/context` | `project.read` | `{ projectId, name, agentIntegration, scriptType, provisioningState, extensionVersion, contractVersion, platformUrl, epics: [{number, slug, name}], epicSource }` |
| `pmi.requirements.list` | `GET /v1/projects/{id}/requirements?groupBy=epic` | `requirements.read` | `{ groups: [{ epic: {number, slug, name} \| 'unassigned', requirements: [{ id, reference, description, type, priority, status, baselineState }] }], epicSource }` |

`pmi.health` arguments: `{ extensionVersion?, toolkitVersion?, serverVersion?, constitutionDigest? }` —
what the caller knows about itself; the platform records them (`R-043-8`). `constitutionDigest`
(EPIC-042 `R-042-5`) is the SHA-256 of the on-disk constitution file, or `null` when the file is
absent; the platform classifies it and answers `constitutionState` (`current | stale | drift |
missing`), stored on the workstation connection.

**Made live by `EPIC-042`** (`specs/042-pmi-spec-kit-extension/contracts/governance-api.md` §2):

| Tool | Route | Scope | Result (`structuredContent`) |
|---|---|---|---|
| `pmi.constitution.get` | `GET /v1/projects/{id}/constitution?onDiskDigest=` | `constitution.read` | `{ version, digest, renderedAt, content, state }` — `state` classified from `onDiskDigest`, `current` when none is given |
| `pmi.project.decompose` | `GET /v1/projects/{id}/decomposition` | `decomposition.read` | `{ firstRun, openFirstRun, nothingToDecompose, policy: { oneSpecPerEpic, taskCeiling, splitRequiresConfirmation, offlineMode, version }, epics: [{ number, slug, name, requirements }], unassigned, epicSource }` |

*Amended 2026-09-05 (`EPIC-042` Phase 9, `T1544`/`T1548`): `openFirstRun` is the id of a
registered, non-terminal `specify` execution — another session's first run — or `null`; the begin
hook refuses `first_run_in_progress` while it is set, so two first runs never proceed side by side.*

## 3. Reserved — listed, schema-validated, refusing by name (`FR-PIC-002`, `FR-PIC-045`)

| Tool | Refusal | Owner |
|---|---|---|
| `pmi.artifacts.sync` | `not_available_until { epic: 'EPIC-045' }` | `EPIC-045` |
| `pmi.tasks.sync` | `not_available_until { epic: 'EPIC-046' }` | `EPIC-046` |

Their argument schemas are the ones PMI-DOC-007 §4.1 describes; an argument that fails the schema
is refused as a schema error **before** the `not_available_until` refusal, so a client is
validated even while the content is absent.

## 4. Refusal codes a client must handle

`invalid_connector_credential` · `scope_required` · `identity_not_accepted` ·
`surface_not_accepted` · `unsupported_contract_version` · `not_available_until` ·
`platform_unreachable` · `credential_in_argument` — plus every code in `EPIC-037`'s
`REGISTRY_REFUSALS`, passed through unchanged.

## 5. Environment

| Variable | Meaning |
|---|---|
| `PMI_STUDIO_URL` | the platform's public address (`EPIC-041` writes it into `.mcp.json`) |
| `PMI_STUDIO_TOKEN` | the connector credential, from the user's environment only; empty → every tool refuses `invalid_connector_credential` and `pmi.health` says `credential_absent` in its detail |

The server reads **no file** under the project directory (`FR-PIC-007`).

*Amended 2026-09-05 (`EPIC-044` `T1575`, `FR-EPB-060`–`FR-EPB-062`): `pmi.project.context`'s
`epics` and `pmi.requirements.list`'s groups now come from the Epic entity, and both reads state
`epicSource: 'epic.entity'` (the derivation `EPIC-043` shipped answered
`'unavailable-until-EPIC-044'`). The shapes are unchanged (`FR-PIC-043`); closed Epics are omitted
from `epics`, and a requirement whose Epic is closed is listed under `unassigned` for the first run.*
