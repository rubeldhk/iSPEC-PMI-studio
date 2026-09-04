# Contract: Provisioning and Credential API

**Epic**: `EPIC-041` · **Feeds**: [plan.md](../plan.md) · **Model**: [data-model.md](../data-model.md)

Every capability is callable without a screen (`PP-007`). The two screens of `FR-LPW-050`–`FR-LPW-053`
consume exactly these routes.

**Refusal convention**, inherited from the sibling Epics: `400` for a stated refusal a caller can
act on, `404` for a resource in another workspace (absent rather than forbidden — `EPIC-004`),
`409` for a conflict with retained state, `503` for a capability that exists and is not currently
answerable. **No route degrades**: where the platform cannot do its job it says so.

---

## `POST /projects` — extended

Existing route. The body gains three optional fields; supplying `rootPath` requests provisioning
after the row is created.

**Body**: `name`, `description?`, `rootPath?`, `agentIntegration?`, `scriptType?`. Defaults for the
last two come from configuration (`FR-LPW-005`).

| Outcome | Status | Why |
|---|---|---|
| Created, no `rootPath` | `201` | today's behaviour, unchanged |
| Created and provisioning started | `201` | body carries `provisioningState: 'prepared'` or `'failed'`, and — **once, in this response only** — `connectorCredential.value` (`FR-LPW-021`, `FR-LPW-050`) |
| `rootPath` outside the projects root | `400` | `FR-LPW-007` — names the root. The project row **is not created** |
| `rootPath` non-empty or already owned | `400` \| `409` | `FR-LPW-007`, `FR-LPW-012` — names the path, or the owning project |
| Projects root unavailable | `503` | `R-041-2` — before anything is written |

---

## `POST /projects/:id/provision`

Provision, or resume provisioning, an existing project. `FR-LPW-002`, `FR-LPW-003`.

**Body**: `rootPath?` (required if the project has none), `agentIntegration?`, `scriptType?`.

| Outcome | Status | Why |
|---|---|---|
| Prepared; initialise queued | `202` | the initialise step is asynchronous (`R-041-1`) |
| Already provisioned | `200` | `outcome: 'no_change'`, `filesWritten: []` (`FR-LPW-003`, `SC-LPW-004`) |
| Resumed from `failed` / `initialisation_pending` | `202` | record shows `stepsCompleted` from the prior run |
| Refusals | as above | |

Idempotency: a request while an initialise job is live joins it (`data-model.md` §6).

---

## `GET /projects/:id` — extended

Adds `rootPath`, `agentIntegration`, `scriptType`, `provisioningState`, `provisionedAt`, and
`latestProvisioning` (the newest `ProvisioningRecord`, with `failedStep` where present).
`FR-LPW-051`.

## `GET /projects/:id/provisioning`

The full append-only list of `ProvisioningRecord`s, newest first, paginated. `FR-LPW-004`.

---

## `POST /projects/:id/connector-credentials`

Mint. `FR-LPW-020`, `FR-LPW-027`.

**Body**: `label`.

| Outcome | Status | Why |
|---|---|---|
| Minted | `201` | body carries `value` **exactly once**, plus `id`, `label`, `tokenPrefix`, `createdAt` |
| Caller lacks the owner grant | `403` | `FR-LPW-027` — audited |
| Project not provisioned | `400` | a credential for a directory that does not exist has nothing to authorise |

## `GET /projects/:id/connector-credentials`

List. Never includes `value` or `tokenHash` (`FR-LPW-053`). Filterable by `revoked` and `label`
(`PMI-DOC-005`).

## `POST /connector-credentials/:id/revoke`

`FR-LPW-023`. `201` with the record showing `revokedAt`, `revokedById`. Revoking a revoked
credential is `200`, idempotent, and writes no second audit entry. `403` without the owner grant.

---

## Authentication with a connector credential

```
Authorization: Bearer pmi_ct_<token>
```

Resolved by `ConnectorAuthGuard` (`R-041-3`): prefix lookup → digest comparison in constant time →
`revokedAt IS NULL` → `TrustedPrincipalContext` for the credential's `Principal`, scoped to its
project.

| Condition | Response | Why |
|---|---|---|
| Valid | request proceeds with a connector principal | |
| Unknown, wrong digest, or revoked | `401` | one message for all three — a distinguishable refusal leaks which |
| Valid, but the resource belongs to another project | `404` | `FR-LPW-025` — existence is not disclosed |
| Valid, but the route declares no connector scope, or one the credential lacks | `403` | scope, not identity |

**The scope set is a registry, not a list in prose** (`FR-LPW-026`; analysis `U1`). A route that
accepts a connector credential declares its scope with a decorator — `@ConnectorScope('connector.whoami')`
— and the guard refuses any route that declares none. This Epic registers exactly one scope,
`connector.whoami`. `EPIC-043` registers `execution.*`, `artifacts.sync` and `tasks.sync` on its own
routes without touching the guard. A credential authorises every registered scope for its project;
per-scope credentials are a later policy question and are not modelled here.

**Terminology.** This Epic's artifacts say *connector credential*. The wire names are
`PMI_STUDIO_TOKEN` (the environment variable the agent reads) and the `pmi_ct_` prefix (*connector
token*), and PMI-DOC-007 §3 named the table `ConnectorToken`. One concept, two spellings: the prose
name is *credential*, the wire name is *token*, and neither is renamed (analysis `T2`).

**In this Epic nothing is mounted behind the guard yet.** The guard, its tests and its refusal
mapping ship here; `EPIC-043` mounts the execution registry and the sync routes behind it. The
guard is exercised in this Epic through a single diagnostic route, `GET /connector/whoami`, which
returns the project id the credential opens and nothing else — enough for the setup skill to verify
a token (bundle v0.1, `R-041-9`) and for the Tier 1 test to drive the guard through a real route.

---

## `POST /projects/:id/jobs/generate-specification` — now reachable

Existing route, unchanged. This Epic adds the client method and the screen control that call it
(`FR-LPW-042`) and the persistence that makes its result survive (`FR-LPW-040`). `GET /jobs/:id`
feeds `JobProgress`.

---

## Execution registration — one field, refused on input

`POST /executions` (EPIC-037; mounted by EPIC-043) will refuse a body carrying `assurance` with
`400` naming the field, and every execution read back carries `assurance` derived server-side
(`FR-LPW-034`, `R-041-5`). Stated here because the field is this Epic's; enforced when the route
mounts.
