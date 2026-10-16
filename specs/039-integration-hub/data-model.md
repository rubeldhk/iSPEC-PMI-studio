# Data Model: Integration Hub

**Epic**: `EPIC-039` · **Date**: 2026-10-09 · **Research**: [research.md](./research.md) ·
**Contract**: [contracts/integration-hub-api.md](./contracts/integration-hub-api.md)

**Ten new tables**, all workspace-scoped except the vocabulary (§1) and the deployment binding record (§8a), in one migration
`backend/prisma/migrations/20261009130000_epic039_integration_hub/`. Three are **append-only** by
trigger (`integration_health_checks`, `capability_resolutions`, `capability_invocations`) plus the deployment binding record (§8a), one is **immutable after
approval** by trigger (`capability_contract_versions`), and one holds **ciphertext only**
(`integration_credentials`). Plus one additive event type in `packages/execution-registry-contract`
and one new contract package, `packages/capability-contract` (`R-039-2`).

Universal columns follow the repository convention: `createdAt`, and `updatedAt` only where a row
is mutable. Model names are PascalCase and tables `@@map`'d to snake_case.

What is **not** a table, on purpose:

- **Adapter implementations.** An adapter's code — key, provider, transport, version, capabilities
  and the scope each needs — is declared by the adapter package and read from the composed
  catalog (`R-039-4`). The database holds the **registry entry** that lists it in a workspace, not
  a second copy of its descriptor that could drift from the code.
- **Connector lifecycle facts.** The `pmi-studio` server's version, its operations and the
  integration contract it serves are read from `packages/mcp-server` and
  `packages/execution-registry-contract` at read time (`R-039-5`); the registry entry only lists it.
- **Health "current state".** Derived at read from the latest health check and the project's
  interval; there is no `currentHealth` column that could read *healthy* after it went stale
  (`FR-HUB-027`).
- **Evidence.** External results land in `EPIC-032`'s store; this Epic keeps only the intake
  attempt that produced them (`FR-HUB-051`, `R-039-11`).

---

## 1. `capability_contract_versions` — `CapabilityContractVersion`

The vocabulary as the platform holds it (`FR-HUB-003`). Seeded from
`packages/capability-contract/capabilities/*.json` at migration time for the five v1 capabilities;
the JSON files are the reviewed source, the rows are what the resolver reads (`R-039-3`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | One of the vocabulary names — `ReadRepository`, `ReadBuildStatus`, `ReadTestResults`, `SendNotification`, `Embed` in v1 (`FR-HUB-010`) |
| `scope` | `project` \| `deployment` | `deployment` for `Embed` only (`FR-HUB-084`, `R-039-18`) |
| `major`, `minor` | int ≥ 1, int ≥ 0 | Unique `(name, major, minor)` (`FR-HUB-011`) |
| `inputSchema`, `outputSchema` | jsonb | JSON Schema 2020-12 subset, validated by the package's own validator (`R-039-3`) |
| `errorCategories` | text[] | Closed per version; `adapter-fault`, `provider-throttled`, `provider-unavailable`, `not-found`, `credential-rejected` are common to every capability |
| `requiredScope` | jsonb `{ access: 'read' \| 'write', resources: string[] }` | Provider-neutral (`repository.contents`, `ci.checks`, `ci.artifacts`, `notification.send`, `model.embed`); each adapter maps it to its provider's permission names (`R-039-9`) |
| `changesState` | bool | Only `SendNotification` is `true` in v1 (`FR-HUB-014`) |
| `status` | `draft` \| `approved` \| `retired` | Approved rows are immutable (trigger, `FR-HUB-012`); retired = no new resolutions for that major once every minor of it is retired |
| `approvedBy?`, `approvedAt?` | | Set once |
| `createdBy`, `createdAt` | | `createdBy` = `git:packages/capability-contract/capabilities/<file>` for a seeded row (`FR-HUB-015`, below) |

**`FR-HUB-015` — the record of a contract change (remediated 2026-10-10, analysis C1).** A
contract is defined or changed only by adding a JSON file under `capabilities/` and a migration that
seeds it — no API writes this table. So the record of *who changed it, when, and what before/after*
is the **Git history of that file** (author, commit instant, diff). The platform audit log cannot
hold it anyway: `audit_entries` is workspace-scoped and a contract belongs to the deployment. The
conformance check asserts both halves: every seeded row names its file in `createdBy`, and every
file under `capabilities/` is tracked by Git (`git ls-files`), so a contract that exists without a
reviewable history fails. **Not tenant-scoped** (deployment vocabulary, the `engine_registrations`
exception).

**Trigger** `capability_contract_versions_immutable`: rejects `UPDATE` of any column on a row whose
`status` was `approved`, except `status → retired`. A change is a new row.

**Validation**: a new **minor** must be a superset of the previous minor of the same major — every
input, output and error category of the previous minor still present with the same type; anything
else is refused with the differences named, and must be a new major (`FR-HUB-011`). Checked by
`compareContractVersions` in the contract package, so the rule is the same in the conformance
check and at the API.

## 2. `integration_registry_entries` — `RegistryEntry`

One adapter (outbound) or connector (inbound) as listed in a workspace (`FR-HUB-020`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId` | text | Every query is scoped by it (`FR-HUB-005`) |
| `key` | text | The adapter's catalog key (`github-rest`, `fixture-ci`, …) or the connector's key (`pmi-studio`, `surface:ide-extension`, `surface:local-cli`, `surface:ci-cd`, `surface:managed-sandbox`); unique per workspace |
| `direction` | `outbound` \| `inbound` | `FR-HUB-020`. Inbound entries are **never** resolution candidates (`FR-HUB-022`) — the resolver's candidate query filters on `outbound`, and a unit test asserts it |
| `status` | `active` \| `retired` | Retired is never resolved; history stays readable (`FR-HUB-028`) |
| `listedOrder` | int | `pmi-studio` is `1` (`FR-HUB-021`); seeded entries first, then registration order |
| `registeredBy`, `registeredAt` | | `FR-HUB-025`; seeded connectors carry the system actor `system:epic-039-seed` (`R-039-5`) |
| `retiredBy?`, `retiredAt?` | | Set once |

Unique: `(workspaceId, key)`.

**Not stored, read from the catalog** (`R-039-4`, `R-039-5`): provider, transport, version,
capabilities and majors implemented, permission scope, authorisation model. The registry read
joins the row to the catalog descriptor. A row whose key the running catalog does not contain reads
`version: not applicable — "adapter not present in this build"` and is ineligible — the honest
answer after a deployment drops an adapter, and never a crash.

Every lifecycle change (registered, version observed changed, configured, retired) is an audit
entry with actor, instant and before/after (`FR-HUB-025`, `R-039-14`). *Version changed* is
detected at boot: the catalog version differs from the last recorded `observedVersion` in the
audit trail, and an entry is written by `system:catalog`.

## 3. `project_capability_configurations` — `ProjectAdapterConfiguration`

For one project and one capability: which adapters the project uses and how (`FR-HUB-031`,
`FR-HUB-032`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `projectId` | | FK `projects.id` in the same workspace |
| `capability` | text | A vocabulary name |
| `adapters` | jsonb `[{ registryEntryId, preference }]` | Outbound entries only; `preference` unique within the array, `1` = most preferred. An empty array means *not configured* |
| `permitDegraded` | bool, default `false` | `FR-HUB-026` |
| `permittedEnvironments` | text[] | Subset of `PLATFORM_ENVIRONMENTS` (`local`, `dev`, `stage`, `prod`); default all four (`R-039-8`) |
| `onNotNarrowable` | `refuse` \| `proceed-and-record` | Default `refuse` when the capability `changesState`, else `proceed-and-record` (`FR-HUB-034`) |
| `healthIntervalSeconds` | int, default 300, 60–3600 | Per project (`FR-HUB-027`); stored on the project's configuration of each capability, effective value = minimum over the project's rows naming the adapter |
| `providerBinding` | jsonb | Provider-neutral binding data the adapter needs and that is **not secret** — for the Git host `{ repository: "owner/name" }`, for test results `{ artifactName: "test-results", resultFormat: "junit-xml" }`, for notifications `{ from: "PMI Studio <noreply@…>" }`. Validated against the adapter's declared binding schema (`R-039-4`). Any value that `looksLikeSecret` is refused (`FR-HUB-045`) |
| `configVersion` | int ≥ 1 | Incremented on every change; the `objectVersion` of the policy decision |
| `decisionId?` | text | `EPIC-031` decision for this configuration version (`R-039-7`); the adapter is policy-permitted only while the decision resolves `approved` or `auto-executed`. **Status derived at resolution, never cached** |
| `updatedBy`, `updatedAt` | | Every change is a recorded configuration event (`FR-HUB-062`) and a new decision |

Unique: `(projectId, capability)`.

**A preference is not ambiguity**: two eligible adapters with distinct preferences resolve to the
lower number. Two eligible adapters where the configuration names only one of them cannot happen —
an adapter not named in `adapters` is not configured and so not eligible. *Ambiguous* therefore
means: two eligible adapters, both configured, and the project has expressed no order between them
— which the API prevents by requiring `preference` whenever `adapters` has more than one element.
The resolver keeps the refusal for the case a migration or a retired-then-re-registered entry
leaves two rows at the same preference (`FR-HUB-032`, `R-039-7`).

## 4. `integration_credentials` — `AdapterCredential`

Per project and adapter; **ciphertext only** (`FR-HUB-040`–`FR-HUB-046`, `R-039-10`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | The **credential reference** that travels inside the platform (`FR-HUB-042`) |
| `workspaceId` | | |
| `projectId` | | Required. *(Remediated 2026-10-10, I1: v1 has no deployment-scope credential; the `Embed` binding is deployment configuration and its v1 adapter needs no credential.)* |
| `registryEntryId` | uuid | The outbound adapter it is for |
| `kind` | text | The adapter's declared credential kind — `github-app-installation`, `github-token`, `resend-api-key`, `bearer-token`, `fixture-token` |
| `ciphertext` | bytea | AES-256-GCM |
| `iv` | bytea (12 bytes) | Random per write |
| `authTag` | bytea (16 bytes) | |
| `keyId` | text | Which platform key encrypted it (rotation) |
| `setBy`, `setAt` | | The only facts a read returns, besides *configured* (`FR-HUB-043`) |

Unique: `(workspaceId, projectId, registryEntryId)` — one credential per project and adapter. Replacing overwrites the row; removing deletes it (the
audit trail keeps actor and instant, never the value — `FR-HUB-046`).

**Additional authenticated data** is `workspaceId|projectId|registryEntryId|kind`. A row copied or
pointed at from another project fails to decrypt — so *"project A's credential is never used for
project B"* (`SC-HUB-005`) holds in the cipher as well as in the query.

**No Prisma read selects `ciphertext` outside `credential.vault.ts`.** The store used by every other
service is a `select`-restricted view type with no ciphertext field; an architecture test fails if
any other file names the `ciphertext` column (`R-039-10`).

## 5. `integration_health_checks` — `HealthRecord`

Append-only (trigger rejects `UPDATE` and `DELETE`). One row per check of one adapter for one
project (`FR-HUB-026`, `FR-HUB-027`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `projectId`, `registryEntryId` | | Project-scoped. The deployment `Embed` binding's health is held in its snapshot and recorded in §8a (I1) |
| `source` | `scheduled` \| `request` \| `credential-set` | What produced the row |
| `intervalBucket?` | bigint | `scheduled` rows only: `floor(epochSeconds(checkedAt) / interval)` — the lease (U2) |
| `state` | `healthy` \| `degraded` \| `unhealthy` | *Unknown* is never written — it is what a stale or missing row reads as |
| `reason` | text | Required unless `healthy`; `credential-rejected`, `provider-throttled`, `provider-unreachable`, `not-configured`, `scope-wider-than-declared`, … (closed list in the contract package) |
| `detail?` | text | Provider message, passed through `sanitiseText` first (`FR-HUB-045`) |
| `retryAfterSeconds?` | int | From the provider's throttle hint |
| `adapterVersion` | text | The version that was checked |
| `checkedAt` | timestamptz | |
| `durationMs` | int | |

Index: `(projectId, registryEntryId, checkedAt DESC)`.

**The lease (remediated 2026-10-10, analysis U2).** The table stays append-only and every row keeps
its required `state`: no claim row is written before the check. A scheduled check runs, and **its
row is inserted afterwards with `ON CONFLICT DO NOTHING`** against the partial unique index
`(projectId, registryEntryId, intervalBucket) WHERE source = 'scheduled'`. Two instances that pick
the same due pair in the same interval may both probe the provider, but exactly one check is
**recorded** per pair per interval; the loser's insert is a no-op. That is the guarantee
`FR-HUB-027` needs without a mutable claim table, and the duplicate probe is bounded by the
instance count.

**Derived current health** (`R-039-6`): the latest row for `(projectId, registryEntryId)`; if none,
or `now − checkedAt > interval`, the state reads **unknown** with reason `never-checked` or
`stale (last checked <instant>)`. A capability request is also an observation: a provider's
credential rejection during a request writes an `unhealthy / credential-rejected` row at once
(`FR-HUB-047`), and a throttle writes `degraded / provider-throttled`.

## 6. `capability_resolutions` — `Resolution`

Append-only (trigger). One row per resolver decision (`FR-HUB-036`, `FR-HUB-037`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId?` | | Required when `scope = project` (CHECK). Null for a `deployment` resolution: `EmbeddingPort.embed` carries no workspace (I1) |
| `scope` | `project` \| `deployment` | `deployment` for `Embed` |
| `projectId?` | | Required when `scope = project` (CHECK) |
| `caller` | text | A member of `PLATFORM_CALLERS` — `room:<roomType>`, `loop`, `context-assembly`, `evidence-intake`, `notification-dispatch` (`FR-HUB-004`, `R-039-12`). **Over HTTP only `room:*` is accepted**; the others are set by the in-process caller that owns them (analysis U1) |
| `actorPrincipalId` | text | The principal the caller acted for |
| `executionId?` | text | The `EPIC-037` execution, where the caller acts inside one (`FR-HUB-038`) |
| `capability`, `requestedMajor` | text, int | |
| `contractVersion?` | text `major.minor` | The version bound, on success |
| `outcome` | `resolved` \| `refused` | |
| `refusalCode?` | `unknown-capability` \| `provider-pinned` \| `caller-not-platform` \| `no-compatible-adapter` \| `no-eligible-adapter` \| `ambiguous` \| `scope-not-narrowable` \| `policy-seam-unbound` | Top-level code. Per-candidate ineligibility reasons live in `reasons`: `not-configured`, `credential-missing`, `health-unknown`, `health-unhealthy`, `health-degraded-not-permitted`, `environment-not-permitted`, `policy-pending`, `policy-not-permitted`, `incompatible-major`, `retired`, `not-in-build` |
| `registryEntryId?`, `adapterKey?`, `adapterVersion?`, `provider?` | | On success |
| `modelIdentity?` | jsonb `{ model, version, dimension }` | `Embed` only — recorded on every resolution (`FR-HUB-082`) |
| `scopeGranted?` | jsonb | `{ requested, granted, narrowing: 'exact' \| 'narrowed-at-issue' \| 'not-narrowable' }` — never a credential (`FR-HUB-034`) |
| `reasons` | jsonb | The explanation: the deciding rule, and **one entry per candidate** with each eligibility condition evaluated and the first failing one named (`FR-HUB-036`, `BR-0174`); the policy explanation is embedded as `EPIC-031` returns it |
| `decidedAt` | timestamptz | |

**Written at decision time, before any provider call.** A refusal is final at once. A resolved row
is followed by exactly one `capability_invocations` row (§6a) when the call ends. Splitting them is
what keeps both append-only: if the process dies mid-call, the resolution stands and the missing
invocation reads as **outcome unknown** — never as success. For `SendNotification`, that is the
difference between *"we do not know whether it was sent"* and silence. The execution event
(`FR-HUB-038`) is appended with the resolution, so the execution shows the decision even when the
call never returns.

Index: `(projectId, decidedAt DESC)`, `(registryEntryId, decidedAt DESC)`.

Retention: platform audit retention (`EPIC-004`, `FR-HUB-037`) — no pruning in this Epic.

## 6a. `capability_invocations` — `Invocation`

Append-only (trigger). At most one per resolved resolution (`FR-HUB-039`).

| Field | Type | Rule |
|---|---|---|
| `resolutionId` | uuid PK, FK | One invocation per resolution — a second call is a second resolution |
| `workspaceId`, `projectId` | | |
| `outcome` | `succeeded` \| `failed` \| `adapter-fault` | `adapter-fault` = output did not conform to the contract and was **not** passed through (`FR-HUB-016`) |
| `errorCategory?` | text | From the capability's `errorCategories`, or `timed-out` |
| `providerRequestId?` | text | Provider correlation id, where one exists |
| `retryAfterSeconds?` | int | Throttle hint (spec Edge Cases) |
| `durationMs` | int | Provider time, for the `R-039-15` targets |
| `endedAt` | timestamptz | |

Neither input nor output is stored — outputs may be repository content. A caller that needs the
result keeps it; the record keeps what was decided and whether it worked.

## 7. `evidence_intake_attempts` — `EvidenceIntake`

The pull loop for external results (`FR-HUB-050`–`FR-HUB-055`, `R-039-11`). Not evidence — the
record of trying to obtain it.

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `projectId` | | |
| `workRef` | jsonb | The governed work item whose Evidence Contract asked (`EPIC-032`'s work identity) |
| `contractItemId` | text | The Evidence Contract item being satisfied |
| `capability` | `ReadTestResults` \| `ReadBuildStatus` | `FR-HUB-050` |
| `revision` | text | The commit the work produced |
| `state` | `pending` \| `contributed` \| `not-contributed` \| `gave-up` \| `refused` | |
| `reason?` | text | Required unless `contributed`: `no-revision`, `not-final`, `resolution-refused:<code>`, `bound-exceeded` (`FR-HUB-053`–`FR-HUB-055`) |
| `resolutionIds` | uuid[] | Every resolution this intake made |
| `attestationId?` | text | `EPIC-032`'s id for the contributed evidence |
| `attempts`, `nextAttemptAt?`, `giveUpAt` | int, timestamptz | Re-read every 120 s until `giveUpAt` (default 30 min) (`FR-HUB-054`, `R-039-15`) |
| `createdAt`, `updatedAt` | | Mutable: this is a work queue, and its history is the resolutions it references |

## 8a. `deployment_capability_bindings` — `DeploymentBindingObservation`

**Remediated 2026-10-10 (analysis I1, Project Owner option (a)).** The `Embed` binding is
**deployment configuration recorded at boot** (`FR-HUB-084`). No API route and no workspace grant
can set, switch or unbind it, and v1 has **no `Embed` credential route**. This table is therefore
not a configuration a workspace edits: it is the **append-only record** of what each boot
observed, so that a switch — an operator action that takes effect on restart — is a recorded
configuration change rather than an invisible one.

The binding is read from two deployment variables at boot:

- `PMI_EMBED_ADAPTER` — the catalog key of the bound adapter (`fixture-embed`, `ollama-embed`);
  absent or empty = **unbound** → every `embed()` refuses (`FR-HUB-085`).
- `PMI_EMBED_BINDING` — JSON, the adapter's non-secret binding, e.g. `{ "baseUrl":
  "http://127.0.0.1:11434", "model": "nomic-embed-text" }`. Validated against the adapter's
  binding schema; `looksLikeSecret` refused; an unlisted model is refused at boot (the binding
  reads *ineligible: model not listed*, never a guessed dimension).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `capability` | text | `Embed` in v1 |
| `adapterKey?` | text | Null = the boot observed **no** binding |
| `providerBinding` | jsonb | As read from `PMI_EMBED_BINDING` (non-secret by validation) |
| `observedModel?` | jsonb `{ model, version, dimension }` | The declared dimension and the version the adapter reported (`FR-HUB-082`) |
| `modelId?` | text | `<adapterKey>:<model>@<version>` — what `HubEmbeddingPort.modelId` answers |
| `previousModelId?` | text | The latest earlier row's `modelId` |
| `reindexRequired` | bool | `true` when `modelId` differs from `previousModelId` (`US7` AS4) |
| `health` | text | `healthy` \| `degraded` \| `unhealthy`; `reason` required otherwise |
| `reason?` | text | e.g. `model-not-present`, `provider-unreachable`, `not-bound`, `model-not-listed` |
| `observedBy` | text | `system:deployment-config` at boot, `system:health` from the ticker |
| `observedAt`, `createdAt` | timestamptz | |

**Append-only** (`reject_mutation()`). A row is written **only when the observation differs from
the latest row** (adapter, binding, `modelId` or health state), so restarts with unchanged
configuration add nothing. **Not tenant-scoped**: like `engine_registrations`, it belongs to the
deployment — `EmbeddingPort` carries no workspace, and one model serves every workspace's index.
That is exactly why no workspace may change it.

**Health during the process lifetime** is re-observed by the health ticker and held in the
in-memory binding snapshot `HubEmbeddingPort` reads synchronously; a changed state is appended here.
`GET /integrations/deployment/capabilities` (read on the caller's `integration-registry`) shows the
current snapshot and the latest rows — **read only**.

## 8. `notification_deliveries` — `NotificationDelivery`

One `SendNotification` request and its delivery outcome (`US6`) — one row for **every** request, whichever caller asked (`T2626`, 2026-10-16).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | Also the provider idempotency key (`R-039-13`) |
| `workspaceId`, `projectId` | | |
| `cause` | jsonb `{ kind, ref }` | The governed event that caused it — e.g. `{ kind: 'decision-waiting', ref: <decisionId> }`; a Room asking through the route records `{ kind: 'capability-request', ref: <caller> }` (`T2626`) |
| `recipients` | text[] | Platform user ids, resolved to addresses only inside the adapter call |
| `resolutionId` | uuid | |
| `outcome` | `delivered` \| `failed` \| `refused` | |
| `providerMessageId?`, `failureReason?` | text | `failureReason` is the refusal code, or the failure category and the provider's message, passed through `sanitiseText` (`T2626`) |
| `createdAt` | | Immutable after insert |

A delivery failure never touches the cause (`US6` AS2): the row is the only write.

---

## Contract-package changes

- **New**: `packages/capability-contract` (`@pmi/capability-contract`) — the vocabulary types, the
  five v1 capability definitions, `CapabilityAdapter`, `AdapterDescriptor`, health and error
  vocabularies, the resolver's pure eligibility function, `compareContractVersions`, and the
  adapter conformance suite exported as `./conformance` (`R-039-2`).
- **Additive**: `packages/execution-registry-contract` — one event type, `capability-resolved`,
  payload `{ resolutionId, capability, contractVersion?, outcome, refusalCode?, adapterKey?,
  adapterVersion?, provider? }` (`R-039-12`). No credential, no scope detail, no input or output.

- **Consumed, not changed**: `EPIC-038`'s `EmbeddingPort` (`modelId`, `dimension`,
  `embed(texts)`) is filled by `HubEmbeddingPort` with **no shape change** (`FR-HUB-087`).

## State transitions

```text
Registry entry:   active ──retire──▶ retired            (one way; FR-HUB-028)
Contract version: draft ──approve──▶ approved ──retire──▶ retired
Derived health:   unknown ◀─stale─ healthy | degraded | unhealthy ◀─check─ (any)
Intake attempt:   pending ─▶ contributed | not-contributed | refused
                  pending ─(giveUpAt passed)─▶ gave-up
Credential:       not configured ──set──▶ configured ──replace──▶ configured
                                           configured ──remove──▶ not configured
```
