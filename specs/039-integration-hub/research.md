# Research: Integration Hub

**Epic**: `EPIC-039` · **Date**: 2026-10-09 · **Plan**: [plan.md](./plan.md)

Eighteen decisions (`R-039-18`, `Embed`, added with the 2026-10-09 scope amendment). The spec deferred two things to this plan — **performance targets** and **the
concrete real provider per capability** — and both are decided here (`R-039-9`, `R-039-15`).

**External sources.** This Epic talks to two real providers and adopts two small libraries, so
Context7 was consulted for each, and the library IDs are recorded for `/speckit-implement`:

| Dependency | Context7 ID | Topics consulted |
|---|---|---|
| GitHub REST API | `/websites/github_en_rest` | check runs for a ref and the `checks:read` permission; installation access tokens with `permissions`/`repositories` narrowing; workflow-run artifacts and the `actions:read` permission |
| Resend | `/websites/resend` | `POST /emails` with `Idempotency-Key`; `sending_access` keys and the `restricted_api_key` error; `429` and `retry-after` |
| fast-xml-parser | `/naturalintelligence/fast-xml-parser` | `XMLParser` with `ignoreAttributes: false`, `isArray`, `processEntities: false` for untrusted input |
| fflate | `/101arrowz/fflate` | `unzipSync` with a `filter` on name and `originalSize` |
| Ollama | `/ollama/ollama` | `POST /api/embed` with a batch `input` (L2-normalised vectors); `GET /api/tags` model `digest` |

Everything else is built on NestJS 10, Prisma 5, Vitest 2.1 and Node 22's built-in `fetch` and
`node:crypto`, already in the repository.

**Three dependencies are not on this branch**: `EPIC-031` and `EPIC-032` (open pull requests), and
`EPIC-038`'s retrieval half — `EmbeddingPort`, `IndexService`, `SearchService` — which is on
`epic/038-engineering-context` (commit `ab7301c`) and not yet here (this branch's
`backend/src/modules/context/retrieval/` holds only `outcome.types.ts`). Their contracts were read
from the sibling worktrees on 2026-10-09; `R-039-13` decides how this Epic is built without waiting
on them. References marked **W31**/**W32**/**W38** point into
`.claude/worktrees/epic-031-decision-policy-engine`, `…/epic-032-evidence-store-contracts` and
`…/epic-038-engineering-context`.

---

## R-039-1 — Module layout: one backend module, one composition file, three adapter packages

- **Decision**:
  - `packages/capability-contract` — vocabulary, adapter interface, conformance suite (`R-039-2`).
  - `packages/capability-adapters/fixture`, `.../github`, `.../resend`, `.../ollama` — one package
    per provider,
    named `@pmi/capability-adapter-<name>` on the `packages/storage-adapters/fixture`
    (`@pmi/storage-adapter-fixture`) pattern; **the only code that names a provider**. Each has
    `tests/conformance.spec.ts` calling the contract's exported suite. `pnpm-workspace.yaml` gains
    `packages/capability-adapters/*`; `vitest.workspace.ts` gains a `capability-adapters` project.
  - **Unlike** engine and agent adapters, which `backend/package.json` lists as TEST-ONLY
    devDependencies and which are composed in the **worker** (`worker/src/engine-composition.ts`),
    the capability adapters run **in the backend** in production, because the callers are backend
    workflows. They are regular `dependencies` of `backend`, composed at the backend's composition
    root. The divergence is deliberate and stated so `/speckit-analyze` does not read it as drift.
  - `backend/src/modules/integrations/` — registry, resolver, credentials, health, intake,
    notifications, controllers.
  - `backend/src/composition/integration-adapters.ts` — the **one** backend file that imports the
    adapter packages and builds the catalog, on the precedent of `composition/governed-loop.ts`.
- **Rationale**: `FR-HUB-061` asks for a boundary a check can enforce. A check is only simple when
  the permitted location is one path. With adapters in packages and the catalog in one
  composition file, the rule reads: *nothing in `backend/src` except
  `composition/integration-adapters.ts` imports `@pmi/capability-adapters-*` or names a provider*.
- **HTTP**: every adapter takes an injectable `FetchLike = (url, init) => Promise<Response>`
  defaulting to Node 22's global `fetch`, the house pattern of
  `packages/mcp-server/src/platform-client.ts:38`. No HTTP client library is added.
- **Alternatives considered**: adapters under `backend/src/modules/integrations/adapters/`
  (rejected: then the module that holds the resolver also holds GitHub, and the boundary check needs
  a carve-out inside the module it guards); one `capability-adapters` package with three folders
  (rejected: a GitHub change would re-typecheck Resend, and `TS-004` asks for independent
  typechecking).
- **Docs consulted**: none needed (repository layout).

## R-039-2 — A contract package, because the house pattern calls for one

- **Decision**: `@pmi/capability-contract`, on the `decision-contract` pattern (W31
  `packages/decision-contract/package.json`): private, `"type": "module"`, `main`/`types`/`exports`
  pointing at `./src/index.ts`, `typecheck` script only, plus an `./conformance` export like
  `@pmi/storage-contract`. Registered in the same change in `vitest.workspace.ts` (project
  `capability-contract`, no `passWithNoTests`), the root `test:unit` project list, the
  `tests/governance/vitest-projects.spec.ts` map, and `backend/package.json` as `workspace:*`.
  Shape in [contracts/capability-contract.md](./contracts/capability-contract.md).
- **Rationale**: three separate things must agree on the vocabulary — the backend, three adapter
  packages, and the conformance suite — and none of them may depend on another. That is exactly
  what every `*-contract` package exists for.
- **Alternatives considered**: types in the backend module (rejected: adapter packages would import
  the backend); a shared barrel (rejected for `EPIC-030`/`031`/`032` already).

## R-039-3 — Capability contracts: JSON files reviewed in Git, rows the resolver reads

- **Decision**: each capability version is a JSON file in `packages/capability-contract/capabilities/`
  (`<Name>.v<major>.<minor>.json`) holding the inputs, outputs, error categories, scope and
  `changesState`. The migration seeds `capability_contract_versions` with the five v1 rows as
  `approved`. Schemas are a **JSON Schema 2020-12 subset** (`type`, `properties`, `required`,
  `items`, `enum`, `maxItems`, `maxLength`, `pattern`, `additionalProperties: false`) validated by a
  ~150-line validator in the package.
- **Conformance check** (Constitution V — the JSON files are non-code output):
  `capability-contract/tests/capabilities-conformance.spec.ts` fails when a file's name disagrees
  with its content, a schema uses an unsupported keyword, a minor removes or retypes a field of the
  previous minor (`compareContractVersions`), `changesState` is true for a capability other than
  `SendNotification` without being listed in an allow-list that must be edited deliberately
  (`FR-HUB-014`), or the migration's seed rows differ from the files.
- **Immutability** (`FR-HUB-012`): a trigger, as `EPIC-047` did for contract versions
  (`R-047-14`), because an application-only rule is one refactor from gone. Approved rows use a
  write-once trigger function of the `gate_outcomes_write_once()` kind (`EPIC-021`'s review-gates
  migration) permitting only `status: approved -> retired`. The three append-only tables attach the
  shared `reject_mutation()` from the init migration as `"<table>_immutable" BEFORE UPDATE OR
  DELETE`: attached, never redefined, as that function's comment requires.
- **Rationale**: `PP-011` — a capability contract is a reviewed, versioned document; `FR-HUB-003` —
  the vocabulary is a registry the platform holds. Files give the first, rows the second.
- **Alternatives considered**: `zod` schemas in code (rejected: a zod schema is not a document a
  reviewer diffs as a contract, and `FR-HUB-015` wants before/after of the *contract*); `ajv`
  (rejected: a 120 KB dependency for a subset this small, and its full keyword set would let
  contracts grow features the conformance check cannot reason about).
- **Docs consulted**: none needed.

## R-039-4 — The catalog is code; the registry is data

- **Decision**: an adapter's descriptor (provider, transport, version, capabilities, scope mapping,
  credential kinds, binding schema) is **declared by its package** and assembled into an
  `AdapterCatalog` in the composition file. The `integration_registry_entries` table lists which
  catalog adapters a workspace uses. Registry reads join the two. Registration via the API names a
  catalog key and requires `EPIC-024` edit on `integration-registry` (`FR-HUB-029`).
- **Rationale**: copying the descriptor into the database creates two versions of one fact — and the
  first deployment that upgrades an adapter would show the old version. `FR-HUB-025`'s *"version
  changed"* is detected by comparing the catalog with the last observed version recorded in audit,
  and written by `system:catalog` at boot.
- **Spec note (an inconsistency, flagged, not reopened)**: `FR-HUB-029` makes *registering* an
  adapter a grant-checked act, while the adapter's existence is a deployment fact. The two readings
  are reconciled by this decision — **deployment makes an adapter available; registration lists it
  in a workspace** — which honours the requirement's wording without letting an API call conjure an
  implementation.

## R-039-5 — Connectors are listed by a seed, and their facts are read, not copied

- **Decision**: each workspace's registry is seeded, idempotently on first registry read and by the
  migration for existing workspaces, with two **inbound** entries:
  1. **`pmi-studio`** (`listedOrder: 1`, `FR-HUB-021`) — transport `mcp`; version from
     `packages/mcp-server/package.json` (`0.1.0` today); compatibility = integration contract
     `CONTRACT_VERSION` (`packages/execution-registry-contract/src/contract.ts:279`, `'1.0'`);
     permission scope = the tool names it binds (`pmi.health`, `pmi.project.context`,
     `pmi.requirements.list`, `pmi.constitution.get`, `pmi.project.decompose`,
     `pmi.execution.register`/`appendEvent`/`complete`/`comment`/`proposeStatus`/`history`,
     `pmi.tasks.sync`, `pmi.artifacts.sync`), read from the server's tool table; authorisation =
     *project connector credential* (`EPIC-041`); configuration = *configured* when the project has
     an active connector credential, read through `ConnectorCredentialStore` (count only).
  2. **The `EPIC-037` connector bindings beside it** (`FR-HUB-021`). `EPIC-037`'s bindings are its
     `EXECUTION_SURFACES` (`packages/execution-registry-contract/src/contract.ts:28`): `mcp-client`
     (which **is** `pmi-studio`), `ide-extension`, `local-cli`, `ci-cd`, `managed-sandbox`, and
     `fixture`. Each non-fixture surface other than `mcp-client` is listed as one inbound entry
     (`surface:ide-extension`, `surface:local-cli`, `surface:ci-cd`, `surface:managed-sandbox`),
     transport `rest`, compatibility contract `1.0`, permission scope = the connector scopes
     registered in `connector/connector-scope.ts:39-70`, authorisation = *project connector
     credential* (`pmi_ct_…`, `connector/credential-token.ts`) — except `managed-sandbox`, whose
     authorisation is *platform-issued execution identity*. `fixture` is **not listed**: it is a
     test surface, and the listing says so in the registry read's `omitted` field with that reason,
     rather than silently.
- **Health** for a connector reads *not applicable — "inbound; liveness is observed by the client,
  last connection: <instant>"*, the instant taken from `EPIC-041`'s workstation connections. That
  is a reason, not a blank (`FR-HUB-023`), and it does not invent a health check of a client the
  platform does not call.
- **Unchanged protocol** (`FR-HUB-022`): the seed writes one registry row and reads three things. An
  architecture test asserts the integrations module imports nothing from `packages/mcp-server/src`
  except the exported tool-name table and version, and writes to no connector table.
- **Actor**: the seed acts as `system:epic-039-seed`, recorded in audit like every registration.
- **Rationale**: PMI-DOC-007 §9.4 and Clarification 3 — one registry, two directions, protocols
  unchanged.
- **Alternatives considered**: a hard-coded connector list in the screen (rejected: two registries);
  registering connectors through the API (rejected: a connector's existence is not a workspace
  choice).

## R-039-6 — Health: derived current state, a scheduler with a bounded tick, and requests as observations

- **Decision**:
  - Current health is **derived at read**: latest `integration_health_checks` row within the
    project's interval, else **unknown** (`FR-HUB-027`). Nothing stores *healthy*.
  - **No periodic mechanism exists in the repository**: no `setInterval`, no `@nestjs/schedule`,
    no BullMQ repeatable job. `jobs/` is on-demand BullMQ for engine generation, and storage health
    (`storage/connection.service.ts:183`) is pull-only. This Epic introduces a `Ticker` port
    (`start(everyMs, fn)`, `stop()`), bound to an unref'd timer started in `OnModuleInit` (the
    `governance.module.ts:136` lifecycle precedent) and to a manual ticker in tests. Each tick runs
    the job handler `runDueHealthChecks()`: select configured `(project, entry)` pairs that are due,
    **at most 50 per tick, concurrency 4, 5 s timeout per check**, tick every **30 s**.
    `PMI_INTEGRATION_SCHEDULER=off` disables it, and every test sets it.
  - **Multi-instance safety**: a due pair is claimed with `INSERT … ON CONFLICT DO NOTHING` into a
    one-row-per-pair lease keyed by `(projectId, entryId, intervalBucket)` inside the same
    transaction — at most one check per pair per interval, whatever the instance count. (The lease is
    a column pair on the health table's unique index, not a tenth table.)
  - A **capability request's outcome is also an observation**: `credential-rejected` writes
    `unhealthy` at once (`FR-HUB-047`); `provider-throttled` writes `degraded` with
    `retryAfterSeconds` (spec Edge Cases). A success writes nothing — a single success is not a
    health check.
  - Setting a credential schedules that pair's check **immediately** (`SC-HUB-008`).
- **Health probes per adapter** (`R-039-9`): GitHub — `GET /repos/{owner}/{repo}` with the
  narrowed token (1 request); Resend — `GET /domains`, where `401 restricted_api_key` means
  *healthy and send-only*, `200` means *healthy but full-access*, and `401` otherwise means
  *credential rejected*; fixture — scripted.
- **Rationale**: stale health shown as healthy is the failure the spec names twice.
- **Alternatives considered**: a BullMQ `upsertJobScheduler` in the worker (rejected: the queue is
  optional, and `jobs.module.ts:45-74` binds a `NullJobQueue` without `VALKEY_URL`, so health would
  silently never run on a local stack and *stale reads unknown* would hide it); `@nestjs/schedule`
  (rejected: a dependency for one interval, and its cron decorators run on every instance without
  the lease); health on demand only (rejected: `FR-HUB-027` requires an
  interval, and the screen must show unhealthy before anyone requests).

## R-039-7 — The resolver: a pure eligibility core, policy decided at configuration, read at resolution

- **Decision**:
  - `evaluateCandidates(request, candidates, context) → Resolution` is a **pure function** in the
    contract package. Every candidate is evaluated against every condition of `FR-HUB-031`, in a
    fixed order — `in-build`, `active`, `implements-major`, `configured`, `credential`, `health`,
    `environment`, `policy` — and each candidate's record lists every condition with its result, the
    first failure named. Exactly one eligible → resolved; more than one → the configured preference
    decides; equal preference → **ambiguous** naming them (`FR-HUB-032`); none → refused, listing
    all (`FR-HUB-035`, `FR-HUB-036`). No retry, no queue, no fallback.
  - **Policy (`EPIC-031`) has no non-recording query** — every `decide()` writes a decision
    (W31 `backend/src/modules/decision/evaluator.ts:333-378`), and the pure `classifyAction`
    returns a band, not a permit, and is not exported (W31 `classifier.ts:65`). Calling `decide()`
    on every resolution would write a decision per build-status read and, for unmatched actions,
    default to `high` → *human-approval* (W31 `bands.ts:13`) — a read would wait for a person.
  - So **policy is decided when the project configures an adapter**: `PUT …/configuration/:capability`
    calls `DecisionEngine.decide({ actionType: 'integration.adapter.use.<Capability>', target:
    { type: 'project-capability-configuration', id }, objectVersion: String(configVersion),
    actor, projectId, workspaceId, requiredGates: [] })` and stores the `decisionId`. At resolution
    the resolver reads the decision's resolution (`resolutionOf(workspaceId, decisionId)`, the read
    `EPIC-047` uses — `R-047-5`) and the candidate is policy-permitted only when it is `approved` or
    `auto-executed`. `pending` → ineligible as `policy-pending`; `refused` → `policy-not-permitted`.
    The decision's `Explanation` (`policyVersion`, `matchedRule`, `riskClass`, `authorityApplied`)
    is embedded in the resolution's reasons verbatim (`BR-0174`).
  - **Derived, never cached** — a later refusal or a revoked approval takes effect on the next
    request.
- **Classification rules**: `EPIC-031` classifies by `actionPattern` (W31 `ports.ts:35-41`). This
  Epic contributes default rules — `integration.adapter.use.Read*` → `low` (auto-execute under the
  default tenant policy), `integration.adapter.use.SendNotification` → `high` (human approval) —
  as a JSON entry in `EPIC-031`'s `classification-rules/organization-default.json`, an **additive**
  edit to that package made after it merges and asserted in its own suite. Until then the default
  `high` applies and every configuration waits for a human in the Decision Inbox: correct, slower.
- **On this branch**: `backend/src/modules/policy/banded-policy.provider.ts:75` (`EPIC-031`
  `T1199`, scoped) binds `EPIC-030`'s loop `PolicyProvider` and is imported only by the Requirement
  Room — not by `app.module.ts` — and with `NoDeclaredRules` classifies everything `high`. It is a
  loop-transition adapter, not the decision engine, and this Epic does not build on it.
- **Rationale**: `FR-HUB-031` says policy must permit the adapter *for this project and capability*.
  That is a property of the configuration, which changes rarely; making it a per-request decision
  would turn every read into an approvable action.
- **Alternatives considered**: a dry-run method added to `EPIC-031` (rejected: an unmerged Epic's
  API changed for one consumer); this Epic's own policy table (rejected: a second policy engine,
  `PP-002`); `decide()` per resolution (rejected above).
- **Docs consulted**: none needed (repository types).

## R-039-8 — Environment, and the hosted repository binding

- **Decision**: the request's environment is the **platform's deployment environment**
  `PMI_ENVIRONMENT ∈ { local, dev, stage, prod }` (Constitution VII), read once at boot; a missing
  value refuses boot of the integrations module with the variable named, rather than defaulting to
  `prod` or `local`. A configuration's `permittedEnvironments` defaults to all four.
- **No such notion exists yet** — the nearest are `ENVIRONMENT_KINDS` (`managed-isolated`,
  `controlled-local`, `packages/execution-contract/src/index.ts:32`), which describe *where a
  command runs*, and the free-text `RegisterExecutionRequest.environment?`. Neither is the promotion
  stage. `PMI_ENVIRONMENT` is therefore new and added to `.env.example`; the closing report names it
  as a new required deployment variable.
- **Hosted repository** (`EPIC-041` Assumption 5 left *"configuring a remote"* here): the project's
  `providerBinding` for the Git-host adapter holds `{ repository: "owner/name" }`. This is the
  **hosted** identity `ReadRepository`, `ReadBuildStatus` and `ReadTestResults` read; the developer's
  local working copy's remote stays the developer's (spec Assumption 9). One binding per adapter per
  project; the three capabilities share it when the same adapter serves them.
- **Rationale**: `FR-HUB-031` names environment as an eligibility condition and the spec does not
  define it; the only environment vocabulary the programme has is the promotion pipeline.

## R-039-9 — Real providers for v1 (deferred to this plan by spec Assumption 5)

- **Decision**:

| Capability | Fixture adapter | Real adapter | Real provider calls |
|---|---|---|---|
| `ReadRepository` | `fixture-git` | `github-rest` | `GET /repos/{o}/{r}/commits/{ref}` (resolve), `GET /repos/{o}/{r}/git/trees/{sha}?recursive=1`, `GET /repos/{o}/{r}/contents/{path}?ref={sha}` |
| `ReadBuildStatus` | `fixture-ci` | `github-rest` | `GET /repos/{o}/{r}/commits/{sha}/check-runs`, `GET /repos/{o}/{r}/commits/{sha}/status` |
| `ReadTestResults` | `fixture-ci` | `github-rest` | `GET /repos/{o}/{r}/actions/runs?head_sha={sha}`, `GET /repos/{o}/{r}/actions/runs/{id}/artifacts`, `GET /repos/{o}/{r}/actions/artifacts/{id}/zip` → JUnit XML |
| `SendNotification` | `fixture-notify` | `resend-email` | `POST https://api.resend.com/emails` with `Idempotency-Key` |
| `Embed` *(deployment scope)* | `fixture-embed` | `ollama-embed` | `POST {baseUrl}/api/embed`, `GET {baseUrl}/api/tags` — see `R-039-18` |

  **GitHub** for the three reads — one adapter (`github-rest`, transport `native-api`, REST API
  version header `2022-11-28`) implementing all three, so one project binding and one credential
  serve them. **Resend** for notifications.
- **Why GitHub**: the corpus's projects and this repository are hosted there (`Repository &
  Environment Governance`), and one provider for Git *and* CI keeps the v1 credential story to
  one secret per project.
- **Test results on GitHub** have no first-class API. The adapter reads the **JUnit XML** that the
  project's workflow uploads as an artifact (default name `test-results`, configurable in
  `providerBinding.artifactName`) for the workflow runs of that commit. JUnit XML is the format every
  mainstream runner can emit (Vitest, Jest, pytest, JUnit, Go via `gotestsum`), which keeps the
  adapter provider-specific and runner-neutral. Parsing uses `fflate.unzipSync` with a `filter` that
  accepts only `*.xml` entries ≤ 50 MiB expanded (zip-bomb bound), and `fast-xml-parser` with
  `processEntities: false` (no entity expansion from untrusted XML). Results are `final: false`
  while any run for the commit is not `completed`, and `NONE` when completed runs uploaded no such
  artifact (→ `results-not-found`).
- **Credentials and least privilege** (`FR-HUB-034`):
  - `github-app-installation` — `{ appId, installationId, privateKeyPem }`. **Narrowing per
    request**: the adapter mints an installation token with `permissions` limited to exactly the
    capability's mapping (`ReadRepository` → `contents: read`; `ReadBuildStatus` → `checks: read,
    statuses: read`; `ReadTestResults` → `actions: read`) and `repositories: [<name>]`
    (`POST /app/installations/{id}/access_tokens`). The app JWT is signed RS256 with `node:crypto`
    — no `@octokit` dependency. Scope narrowing: `exact`. **Recommended.**
  - `github-token` — a fine-grained or classic token. **Cannot be narrowed by the platform** →
    `not-narrowable`; all three capabilities are reads, so the default is `proceed-and-record`
    (`FR-HUB-034`'s refuse default binds state-changing capabilities only).
  - `resend-api-key` — a Resend key's permission is fixed at creation (`full_access` or
    `sending_access`). The health probe establishes which (`R-039-6`): `sending_access` → scope
    `narrowed-at-issue`; `full_access` → `not-narrowable`, and because `SendNotification` changes
    state, the default is **refuse** until the owner replaces it with a sending-only key or sets
    `onNotNarrowable: proceed-and-record` deliberately.
- **Throttling**: GitHub `403`/`429` with `x-ratelimit-remaining: 0` or `retry-after`, Resend `429`
  with `retry-after` → `provider-throttled` with the hint; health `degraded`.
- **Two adapters per capability** (`FR-HUB-060`): the fixture adapters are complete providers
  (scriptable health, throttling, non-final results, malformed output for `FR-HUB-016`), not mocks;
  they ship in production builds and are what a project without GitHub uses to exercise the Hub.
- **Real-adapter tests**: the adapter conformance suite runs against **recorded responses**
  (`packages/capability-adapters/github/tests/recordings/*.json`) served through an injected
  `fetch`, in CI. A **live** run against a real repository and a Resend test address is opt-in
  (`PMI_LIVE_GITHUB_APP_*`, `PMI_LIVE_RESEND_KEY`) and part of the Tier 2 transcript (`R-039-16`) —
  never a CI dependency.
- **Alternatives considered**: GitLab (rejected for v1: not the corpus's host; it is exactly the
  second Git adapter `BG-04` anticipates, and the conformance suite is what it would pass); check-run
  annotations for test results (rejected: unstructured, depends on a third-party reporter action);
  Postmark (rejected: a server token can also edit server settings, so it can never be narrowed
  to *send*); Amazon SES (rejected: the AWS SDK for one call, and IAM scoping is outside the
  platform's sight); SMTP via `nodemailer` (rejected: SMTP is a protocol, not a provider, and offers
  no scope or idempotency).
- **Docs consulted**: `/websites/github_en_rest` (check runs; installation tokens; artifacts);
  `/websites/resend` (send, idempotency, restricted keys, rate limits);
  `/naturalintelligence/fast-xml-parser`; `/101arrowz/fflate`.

## R-039-10 — Credentials: AES-256-GCM envelope, a keyring port, and a handle with no value

- **Decision**:
  - **No encryption-at-rest facility exists** in the repository. `EPIC-041` connector credentials
    are minted, returned once and stored as `sha256` (`connector/credential-token.ts`): right for a
    credential the platform *verifies*, wrong for one it must *present*. `EPIC-025` declared a
    `TokenCipher` port (`storage/connection.service.ts:77-81`) whose only binding,
    `MarkerTokenCipher` (`:271-286`), writes `enc:<base64>`. That is **an encoding, not
    encryption**, and its own comment says a real deployment must supply AES. This Epic does **not**
    bind its credentials to that marker. It adds a real cipher in the module: AES-256-GCM via
    `node:crypto`, a random 12-byte IV per write, AAD `workspaceId|projectId|registryEntryId|kind`
    (`data-model.md` §4), behind a `CredentialCipher` port shaped like `TokenCipher` so `EPIC-025`
    can adopt it later. The storage marker is out of scope here and is reported as a finding in the
    closing report, not fixed.
  - **Keys** come from the `CredentialKeyring` port, bound to configuration:
    `PMI_INTEGRATION_KEYS` (JSON `{ keyId: base64(32 bytes) }`) and `PMI_INTEGRATION_ACTIVE_KEY`.
    Rotation = add a key, make it active; old rows still decrypt by `keyId`, and a re-encrypt task
    is a later concern. **Unbound → credential writes `503` naming the port**; never stored in
    clear. A KMS-backed keyring is a later binding of the same port.
  - **The value never leaves `credential.vault.ts`** except into `CredentialHandle.use(fn)` during
    one provider call (`contracts/capability-contract.md` §2). Every other store type selects no
    `ciphertext`; an architecture test fails if any other file names the column.
  - **Owner grant** (`FR-HUB-041`): the rule `EPIC-041` uses for `FR-LPW-027` — project owner, or
    an active `edit` grant on `{ artifactType: 'project', artifactId }`
    (`connector/connector-credential.service.ts:249-256`). The reusable form is `EPIC-042`'s
    `OwnerGate.requireOwner(ctx, projectId, operation)` (`governance/owner-gate.ts:47`), which
    audits `access_refused` before throwing `ForbiddenError`; this Epic uses it rather than a third
    copy of the rule.
  - **Registry grant** (`FR-HUB-029`): `EPIC-024` has **no closed artifact-type list and no
    workspace-level artifact** — types are free strings (`access/access-grant.service.ts:23`), and
    access is deny-by-default (`access-inheritance.service.ts:42-53`). This Epic introduces the first
    workspace-level artifact, `{ artifactType: 'integration-registry', artifactId: <workspaceId> }`,
    checked with `AccessEnforcementService.requireReadable/requireEditable` (`:87`, `:99`). Because
    zero grants means closed, the registry seed also **grants `edit` to the workspace's creator** at
    seeding, on the `T1128` pattern; without it every registration would be refused. Recorded as a
    risk in plan.md: a workspace whose creator has left needs a grant from an administrator, and
    administrator roles have no owning Epic.
  - **Redaction** (`FR-HUB-045`): the patterns in `backend/src/modules/executions/sanitisation.ts`
    (`looksLikeSecret`, `sanitiseArgs`) are moved — not copied — into `@pmi/capability-contract`'s
    `redaction.ts` only if `EPIC-037`'s tests can import them from there unchanged; otherwise the
    module imports them from `executions/sanitisation.ts`. One pattern list either way (`R-039-17`).
- **Rationale**: `ADR-0012` — credentials travel as references; the reference is the
  `integration_credentials.id` and the handle.
- **Alternatives considered**: storing a hash (rejected: an adapter needs the value); a secrets
  manager (rejected for v1: no such service in the stack; the port admits one later); pgcrypto
  (rejected: the key would have to reach the database in SQL).

## R-039-11 — External evidence: fill `EPIC-032`'s `AttestationSource`, contribute through its service

- **Decision**:
  - **The seam already exists**: `EPIC-032` declares `AttestationSource.authorise(sourceUri,
    workspaceId)` (W32 `packages/evidence-contract/src/ports.ts:76-88`), bound to `null` under the
    token `EVIDENCE_ATTESTATION_SOURCE` (W32 `backend/src/modules/evidence/evidence.module.ts:75`),
    so external sources are refused today. This Epic **binds it**: `authorise("pmi-adapter:<key>",
    workspaceId)` returns `{ uri, version }` for an active outbound registry entry of that
    workspace, the version from the catalog (`FR-HUB-052`, `FR-EVS-041`), else `null`.
  - **Contribution** goes through `EvidenceService.contribute(principal, body)` (W32
    `evidence.service.ts:222-300`) as the intake job's principal, with `attestation` an in-toto
    Statement: `subject: [{ name: <repository>@<revision>, digest: { gitCommit: <sha> } }]` (W32
    `attestation.ts:117`: at least one of `sha256`/`gitCommit`/`gitBlob`), `predicateType:
    https://in-toto.io/attestation/test-result/v0.1`, `predicate: { result, passedTests,
    failedTests, warnedTests: [], url }` — the shape `EPIC-032`'s own producer emits (W32
    `qa-suite.producer.ts:49-66`); `attestedArtifact` from the intake request; `source: { uri:
    "pmi-adapter:<key>" }`. Build status contributes `https://slsa.dev/provenance/v1`? **No** — a
    roll-up check state is not provenance. `ReadBuildStatus` results contribute only where an
    Evidence Contract item accepts the PMI predicate `https://pmi.studio/attestation/external-output/v1`,
    with the capability, contract version, adapter, adapter version and provider in the predicate.
  - **Inline, never referenced**: the predicate is carried inline so its `result` is readable at the
    gate. This **closes the residual of `DEF-032-004`** (deferred to `EPIC-039`): a *referenced*
    test-result's outcome cannot be read back, and this Epic never contributes one.
  - **Not final** (`FR-HUB-054`): `final: false` → nothing contributed; the intake stays `pending`,
    re-read every **120 s** until `giveUpAt` (default **30 min**), then `gave-up` with the reason.
  - **No revision** (`FR-HUB-053`): refused at enqueue and recorded.
  - **Refusal** (`FR-HUB-055`): the intake records `refused` with the resolution's code; nothing is
    contributed and the item stays unmet — `EPIC-032`'s gate is fail-closed (`FR-EVS-035`), so the
    Hub cannot satisfy anything by default even if it tried.
  - **Binding precondition** (W32 `DEF-032-002`): evidence counts only against a work item with a
    binding (`POST /evidence/bindings`); the intake checks `CompletionGate.evaluate` first and
    records `not-contributed / no-binding` rather than contributing evidence nothing reads.
- **What `SC-HUB-006` can and cannot show today**: *"moves from unmet to met"* is observed through
  `CompletionGate.evaluate` (`ContractStatus.items[].state`). It is **not** observed as a loop
  transition: `DEF-032-006` (HIGH, deferred to `EPIC-030`) records that the loop consumes none of its
  evidence seams. This Epic does not bind a seam nothing reads; the closing report must say so.
- **Spec inconsistency flagged (in `EPIC-032`, not here)**: `EPIC-032` names the filler of
  `AttestationSource` as `EPIC-013 / U-13` (W32 `ports.ts:19-23`, `spec.md:367`); `U-13` is this
  Epic. The `filledBy` string is corrected to `EPIC-039` as an additive one-line change once
  `EPIC-032` merges.

## R-039-12 — Callers, the entry point, and the execution event

- **Decision**:
  - **`PLATFORM_CALLERS`** is a closed list in the contract package: `room:requirement`,
    `room:change`, `room:defect`, `loop`, `context-assembly`, `evidence-intake`,
    `notification-dispatch`. In-process callers use the `CapabilityRequests` service; Rooms in the
    browser and Tier 1 tests use `POST /projects/:projectId/capability-requests`.
  - **Connector principals are refused at the route** with `SurfaceNotAcceptedError` (the existing
    `403 surface_not_accepted`), before the body is read — the developer's local agent reaches
    PMI Studio only through connector credentials, so this is the whole of `FR-HUB-004`. And no MCP
    tool is added; `mcp-server-boundary.spec.ts` gains an assertion that no `pmi.capability*` or
    `pmi.integrations*` tool exists.
  - **Execution event** (`FR-HUB-038`): the vocabulary is the closed union `ExecutionEventType`
    (`packages/execution-registry-contract/src/events.ts:74-78`), built from four frozen arrays —
    lifecycle (9), content (4), registration (4), governance (12) — and its parity test asserts
    *"9 + 4 + 4 + 12 = 29"* (`tests/events.spec.ts:25-31`). Payloads are untyped
    (`Readonly<Record<string, unknown>>`); the database checks only `class`, and
    `ExecutionEventService.append` refuses a type outside the vocabulary
    (`execution-event.service.ts:142-146`). This Epic adds **one** type, `capability-resolved`, to
    `GOVERNANCE_EVENTS` — so it may follow a terminal lifecycle event (Constitution XII.2) — and
    updates the parity assertion to 13 governance / 30 total in the same change (the `EPIC-047`
    precedent, `R-047-4`; if `EPIC-047` merges first the totals are 14/31, and whichever merges
    second rebases the count). It is appended with `ExecutionEventService.append` (`:141`), the
    simpler internal entry, with `emittedBy` = the caller's principal and the resolution id as the
    idempotency key.
- **Rationale**: one entry point that every caller shares is what makes the caller-level suite of
  `SC-HUB-001` the same suite for every caller.

## R-039-13 — Building against two unmerged dependencies

- **Decision**: the `EPIC-047` pattern (`R-047-13`). `CapabilityPolicy` and `EvidenceSink` are
  **ports defined in this module**, bound **refusing** (`503` naming the port) until `EPIC-031` and
  `EPIC-032` merge. Their adapters are **one task phase, scheduled last, blocked on those merges**.
  Route tests that need a permitted adapter override `CapabilityPolicy` with an **in-test binding
  that records every call**, set up visibly in the test — never a permissive default in the module.
  Until then, `SC-HUB-006` is unverifiable and is reported as such, not as passing.
- **Rationale**: branching from an integration of two open PRs would put their diffs in this one.

## R-039-14 — Audit: the platform audit log for lifecycle, the Hub's own tables for decisions

- **Decision**: registry lifecycle (`FR-HUB-025`), contract changes (`FR-HUB-015`), configuration
  changes (`FR-HUB-062`) and credential set/replace/remove (`FR-HUB-046`) are written to `EPIC-004`'s
  audit log through `AuditService.record(input, tx?)` (`audit/audit.service.ts:74`). `AuditAction`
  is closed (`create`, `update`, `lifecycle_transition`, `engine_invocation`, `access_refused`), so
  registration is `create`, retirement `lifecycle_transition`, configuration and credential changes
  `update`, with `targetType` `integration-registry-entry` / `capability-configuration` /
  `integration-credential` and the before/after in `detail`. The credential entry's `detail` is
  `{ before: { state, kind }, after: { state, kind } }` — never a value — and `REDACTED_KEYS`
  (`:42-53`) is a second line, not the first. Each write and its audit entry commit together through
  `auditedTransaction` (`audit/audit.interceptor.ts:25`).
  Resolutions and health have their own append-only tables because they are queried by the screen
  and the resolver, at volume, by project — an audit log is not an index.
- **Rationale**: `FR-HUB-037` puts resolutions under audit **retention**, which the append-only
  table satisfies without being the audit log.

## R-039-15 — Performance and scale targets (deferred to this plan by spec Assumption 10)

Measured against the targets of the Epics this one composes with: `EPIC-031` decide p95 < 120 ms,
`EPIC-032` evidence write p95 < 60 ms and gate evaluation p95 < 150 ms.

| Operation | Target (p95) | Design point / note |
|---|---|---|
| Resolution decision (catalog, configuration, credential presence, derived health, decision read) | **< 40 ms** | 2 candidates per capability; no provider call; one decision read, not a `decide()` (`R-039-7`) |
| Hub overhead per capability request (resolution + scope + credential decrypt + output validation + 2 inserts + execution event) | **< 120 ms** | excluding provider time; the GitHub App token mint is provider time and is cached per (installation, permission set) until 5 min before `expires_at` |
| Provider call timeout | **10 s** per HTTP call; **30 s** per `ReadTestResults` (≤ 4 calls + unzip/parse) | a timeout is `timed-out`, never re-resolved (`FR-HUB-039`) |
| JUnit parse | **< 2 s** at 20,000 test cases / 50 MiB expanded | hard caps → `result-too-large` |
| Registry read | **< 250 ms** | 50 entries per workspace, per-project facts included |
| Entry detail | **< 350 ms** | 100 health rows + 50 resolutions |
| Integrations screen first render | **< 1.2 s** | the `EPIC-047` screen budget |
| Health checking | interval **300 s** default (60–3600 s); 1 provider request per check (2 for a GitHub App token mint at most once per token lifetime); **≤ 50 checks per 30 s tick, concurrency 4, 5 s timeout** | v1 design point: 200 projects × 3 adapters = 600 pairs / 300 s = 2 checks/s, inside one tick's budget |
| GitHub rate budget | health ≤ 12 requests/hour/project at the default interval | far inside 5,000/h for a token and the installation limit |
| Evidence intake | re-read every **120 s**, give up after **30 min** (configurable 5–240 min) | ≤ 15 resolutions per intake |
| Volume | **10,000 resolutions/day per project** design point; append-only tables indexed by `(projectId, decidedAt)` | no pruning; retention is `EPIC-004`'s |
| `SC-HUB-008` | credential `PUT` → health check scheduled **immediately** → first eligible resolution **within 60 s** | leaves the 5-minute criterion for the human part |

Performance tests: a `backend-integration` benchmark (Testcontainers, 50 iterations, p95 asserted
with a 25% tolerance flag that **reports**, not blocks — the `EPIC-031` convention), recorded in
the closing report.

## R-039-16 — The view-only Integrations screen, its reachability and its Tier 2 transcript

- **Decision**:
  - `frontend/src/pages/Integrations.tsx`, delivered by changing the `integrations` entry in
    `frontend/src/shell/areas.ts` (line ~262: `epic: 'EPIC-039'`, `status: 'declared-not-delivered'`)
    to `delivered` with `element: IntegrationsArea` — **zero shell code changes**, the property
    `SC-SHL-004` guarantees. Route and navigation come from the area registry; `FR-SHL-016`'s
    reachability check now covers it (`FR-HUB-076`).
  - **View-only, structurally**: the page imports only the read functions of an
    `integrations.client.ts` that exports no write function; a frontend test asserts no `button`,
    `input`, `select`, `textarea` or `form` other than the list filter and the disclosure toggles
    exists, and that the text *"Configuration is through the API"* with a link to the contract is
    present (`FR-HUB-074`).
  - **`Fact<T>` renders two ways** — a value, or a muted *not applicable — <reason>* with a distinct
    style and an `aria-label`; health states have icon **and** text, never colour alone
    (`FR-HUB-073`, `UX-0031`).
  - **Filter** on the list (direction, health, capability, text) — the programme rule that every
    data list has one.
  - **360 px** (`FR-HUB-075`): the list collapses to cards; the entry detail stacks health history
    and resolutions; asserted by a viewport test.
  - **Access** (`FR-HUB-076`): the registry read returns `404` without `EPIC-024` read; the page
    shows the shell's standard *no access* state.
- **Tier 1**: the registry read routes driven through `AppModule` (quickstart Q11).
- **Tier 2**: the current house mechanism (`EPIC-042` to `046`). A Playwright spec
  `e2e/tests/epic-039-m1.spec.ts`, run with `pnpm --filter e2e test` against the reference-local
  stack (`E2E_BASE_URL`, `E2E_API_URL`, `E2E_EMAIL`/`E2E_PASSWORD`), appends timestamped lines and
  **writes** `docs/uat/EPIC-039-m1-transcript.md` naming the stack (`E2E_STACK`), credentials as
  placeholders only (precedent `e2e/tests/epic-046-m4.spec.ts`). The walk: sign in, open
  **Integrations** from the shell navigation, find `pmi-studio` first and the unhealthy fixture
  adapter with its reason, open a refused resolution and read its per-candidate explanation,
  confirm there is no configuration control and the *"through the API"* note is present, then
  repeat the list at 360 px. That answers `SC-HUB-007`'s question from the screen. Setup (an
  unhealthy adapter and a refusal) goes through the **API**, never the database, so the walk
  exercises the composed stack. A conformance check `tests/governance/epic039-transcript.spec.ts`
  asserts the file's shape once it exists (distinct ordered ISO timestamps, every stage present)
  and is `skipIf` absent, so it adds no known-red. The honest limit (*it cannot prove the file was
  not typed*) is stated in it, as `change-room-transcript.spec.ts` does.
- **Risk carried from `EPIC-044` to `046`**: those closures recorded their transcripts as
  *"authored, not yet measured"* because no stack was available. Constitution XI forbids closing on
  that; the plan schedules the walk as a closure task that **blocks** closure.
- **Rationale**: Constitution XI, and the `EPIC-047` precedent for a view-only registry screen.

## R-039-17 — The boundary check (`FR-HUB-061`) and its mutation proof

- **Decision**: `backend/tests/architecture/capability-independence.spec.ts`, a member of the
  independence family (`engine-`, `storage-`, `transport-`, `agent-independence.spec.ts`), using the
  comment-stripped source walk of `agent-independence.spec.ts` and the case set of
  `storage-independence.spec.ts`, including its **anti-vacuity** case (*has source files to check*)
  and its **positive** case (*the backend DOES depend on the contract: a seam, not a wall*):
  1. **No provider names** — `/\b(github|gitlab|bitbucket|resend|postmark|sendgrid|mailgun|ses|jenkins|circleci|buildkite|octokit)\b/i`
     and the hosts `api.github.com`, `api.resend.com`, `:11434` — in `backend/src/**` except
     `backend/src/composition/integration-adapters.ts`, and in every `packages/*` except
     `packages/capability-adapters/**`.
  2. **No adapter imports** — no `@pmi/capability-adapters-*` import outside that composition file.
  3. **Callers name capabilities** — no `backend/src/modules/**` file outside `integrations/` imports
     anything from `integrations/` except `CapabilityRequests` and `@pmi/capability-contract` types.
  4. The failure message names **each offending file and line** (`FR-HUB-061`, `US2` AS3).
- **Existing matches**: `executions/sanitisation.ts:48` matches only inside a `//` comment (stripped),
  and `packages/execution-contract/src/profiles.ts:28` only inside a block comment (stripped). The
  first run must be green on today's tree; if either survives stripping, it is allow-listed by path
  **and line content** with the reason — never by directory.
- **Mutation proof (`SC-HUB-001`)**: insert `const PROVIDER = 'github';` into
  `backend/src/modules/integrations/resolver.service.ts` (a core module), run
  `npx vitest run --project architecture backend/tests/architecture/capability-independence.spec.ts`,
  observe it fail naming that file and line, revert, observe green. Recorded in
  `specs/039-integration-hub/mutation-proofs.md` at the moment of observation, on the template of
  `specs/034-change-room/mutation-proofs.md` (requirement quoted, mutation, observed failing with
  test names and counts, reverted). No mutation tooling is committed in the repository; proofs are
  applied by hand from a copy and restored, as `EPIC-047` recorded. A second mutation inserts `import { githubAdapter } from
  '@pmi/capability-adapters-github'` into `backend/src/modules/loop/loop.service.ts` to prove rule 2.
- **Mutation proof (`SC-HUB-004`)**: change the credential status read
  (`credential.service.ts → status()`) to include the decrypted value — the exact mutation the spec
  names — and observe the `SC-HUB-004` canary suite fail. The suite sets a canary credential
  (`pmi-canary-<uuid>`, which also matches the secret patterns) and scans: every registry,
  configuration, credential, capability-request and evidence-intake response body; the rendered
  Integrations page DOM; audit entries; `capability_resolutions`, `capability_invocations`,
  `integration_health_checks` rows; execution events; captured logger output; error bodies from a
  forced provider failure; and the `pmi-studio` server's `pmi.project.context` and
  `pmi.execution.history` outputs through its in-process client. The canary is searched for raw,
  base64 and URL-encoded. Recorded in `mutation-proofs.md` with the failing test names.
- **Rationale**: Constitution V — *"a check that cannot fail is decoration"*; the spec's exit criteria
  name both mutations.

## R-039-18 — `Embed`: deployment scope, a local model, and `EmbeddingPort` filled without a shape change

*Added by the Project Owner's scope amendment of 2026-10-09 (spec Clarifications, last bullet).*

### The port as it is

`EPIC-038`'s port (W38 `backend/src/modules/context/retrieval/embedding.port.ts:29`):

```text
interface EmbeddingPort { readonly modelId: string; readonly dimension: number;
                          embed(texts: readonly string[]): Promise<number[][]> }
```

It is **process-wide** — bound once in `ContextModule` (W38 `context.module.ts:120-160`, today as
`null`, which `embedChecked` turns into `503 GovernanceSeamUnboundError` naming the port) — and
**carries no workspace or project**. `modelId` and `dimension` are read **synchronously**.
`embedChecked` refuses a count mismatch, a wrong dimension, a non-finite component and a zero
vector (W38 `:52-79`). The index records `embeddingModelId` and `dimension` on every entry
(W38 `index.service.ts:159-163`), prepares one vector space per workspace
(`vectors.prepare(workspaceId, dimension)`), and search **refuses to rank** when the workspace holds
entries from another model (W38 `search.service.ts:98-104`).

### Decision 1 — deployment scope, so the shape stays

- **Decision**: `Embed` is resolved at **deployment scope** (`FR-HUB-084`). One adapter is bound for
  the deployment through `PUT /integrations/deployment/capabilities/Embed` (edit grant on
  `integration-registry`), stored in a `deployment_capability_bindings` row. The Hub fills
  `EMBEDDING_PORT` with a `HubEmbeddingPort`:
  - `modelId` = `<adapterKey>:<model>@<version>` and `dimension` from the bound adapter's
    **declared** descriptor (`FR-HUB-081`), captured when the binding is read at boot and on every
    binding change — so the synchronous reads are honest.
  - `embed(texts)` runs one resolution per call through the same `evaluateCandidates` core with
    caller `context-assembly`, `scope: 'deployment'`: in build, implements `Embed` major 1, bound,
    credential if required, health, environment. Policy reads **not applicable — "deployment-scope
    binding, set by an identity with edit on integration-registry; EPIC-031 policy is per project"**
    — a reason, not a blank (`FR-HUB-023`).
  - Refusal → `GovernanceSeamUnboundError` naming **`EmbeddingPort`** with the Hub's explanation
    appended (`FR-HUB-085`), so `EPIC-038`'s existing `503` contract is unchanged and the message now
    says *why*. Adapter fault → `ProviderUnavailableError`, which `embedChecked` already raises for
    the same shapes; the Hub refuses first so the resolution records `adapter-fault`.
- **Why not per project**: `EmbeddingPort.embed` takes no project, so per-project resolution needs
  `embed(texts, { workspaceId, projectId })` — **a shape change in `EPIC-038`**. And it would be
  wrong even then: projects in one workspace share one vector space and search refuses mixed
  models, so two projects choosing two models would make the workspace's index unrankable. A
  workspace scope has the same shape problem and buys nothing a v1 deployment needs. Deployment
  scope is the only one the port supports today and the only one whose vector space is coherent.
  **No shape change is needed, and none is made** (`FR-HUB-087`).
- **Switching** (`US7` AS4): a new binding (or a new model version under the same adapter) changes
  `modelId`; `EPIC-038`'s search refuses foreign entries until each source is re-indexed. The switch
  is recorded (audit `update` on `deployment-capability-binding`), and the response to the `PUT`
  says re-indexing is required — this Epic does not trigger a re-index; it is `EPIC-038`'s operation.
- **Credentials at deployment scope** (`FR-HUB-084`): `integration_credentials` gains a nullable
  `projectId`; a row with `projectId` null is a deployment credential, set through
  `PUT /integrations/deployment/credentials/:entryId` by an identity with edit on
  `integration-registry`. AAD becomes `workspaceId|deployment|registryEntryId|kind`. Encryption,
  write-only reads, the canary scan and the audit rule are unchanged.

### Decision 2 — the real adapter is a **local** model server: Ollama

| Option | Kind | For | Against |
|---|---|---|---|
| **Ollama** `nomic-embed-text` | local model server, HTTP on `127.0.0.1:11434` | Local-first (`D-47`, `ADR-0030`): texts never leave the machine or the deployment's network; **no credential at all** in the default topology; no npm dependency — the adapter is a `fetch` client; model identity includes the weights `digest` from `GET /api/tags`, so `FR-HUB-082`'s version is real, not a label; L2-normalised batch output from `POST /api/embed` | An operator must install Ollama and pull the model; CPU latency is higher than a hosted API; not available in CI |
| In-process ONNX (`@huggingface/transformers`, MiniLM) | local, in the backend process | No extra service | A native `onnxruntime-node` binary in the backend image; model weights downloaded from the internet at first use (a supply-chain path the platform does not otherwise have); CPU contention with the API process |
| Hosted (OpenAI `text-embedding-3-small`, Voyage) | hosted API | Fast, no operator install | Sends governed engineering text off-platform — the opposite of local-first; a deployment-scope secret on day one; per-token cost (`PP-017`); and naming an AI vendor in a package needs care with `agent-independence.spec.ts` |

- **Decision**: `ollama-embed` (`@pmi/capability-adapter-ollama`, transport `native-api`, provider
  `ollama`). Default binding `{ baseUrl: "http://127.0.0.1:11434", model: "nomic-embed-text" }`.
  `dimension` **declared** by the binding's model entry in the adapter's model table
  (`nomic-embed-text` → 768, `all-minilm` → 384, `mxbai-embed-large` → 1024); an unlisted model is
  refused at binding, never probed into a dimension. `modelId` =
  `ollama-embed:nomic-embed-text@<digest[0..12]>`; the digest is read at binding and on every
  health check, and a changed digest is a **model version change** (`FR-HUB-082`) — recorded, and
  the port's `modelId` changes with it.
- **Credential**: kinds `[]` by default; an optional `bearer-token` kind for an Ollama behind an
  authenticating proxy (`narrowing: 'none'` — `Embed` does not change state, so the default is
  proceed-and-record).
- **Health**: `GET /api/tags` — healthy when the bound model is present with the recorded digest;
  `unhealthy: model-not-present` when absent; `degraded: model-version-changed` when the digest
  differs (until the binding is re-read).
- **Hosted remains possible**: a hosted adapter is exactly the second real adapter `BR-0126`
  anticipates; the contract, the deployment credential path and the conformance suite already admit
  it. Not built in v1.
- **Docs consulted**: `/ollama/ollama` (`/api/embed`, `/api/tags`).

### Decision 3 — the fixture is `EPIC-038`'s letter-bag, moved into an adapter

- **Decision**: `fixture-embed` implements the scheme of W38
  `backend/tests/helpers/context-retrieval-fixtures.ts:19-37` — 26 letter counts plus a constant
  component, `dimension` 27, `modelId` `fixture-letters` — deterministic and deliberately **not
  semantic** (`FR-HUB-086`). A test asserts its vectors equal `letterVector` for a fixed corpus, so
  `EPIC-038`'s tests can bind the Hub fixture with no change in expected rankings.

### Decision 4 — `T1282` and `T1301` (`SC-HUB-009`)

- **`T1282`** runs when `CONTEXT_EMBEDDING_MODULE` names a module whose default export returns an
  `EmbeddingPort` (W38 `backend/tests/integration/context-relevance.spec.ts:16,31`). This Epic ships
  that module: `packages/capability-adapters/ollama/src/embedding-module.ts` (exported as
  `@pmi/capability-adapter-ollama/embedding-module`), returning an `EmbeddingPort` over the Ollama
  adapter with the same checks. With Ollama and the model available, `T1282` **runs** — its result is
  recorded as observed, pass or fail. In CI, without Ollama, it stays skipped, and the closing report
  says so rather than counting it.
- **`T1301`** (`EPIC-038` Tier 2) was blocked because assembly answered `503` in every deployment.
  With the Hub bound, the first step answers; the journey is **discharged in `EPIC-038`**, and this
  Epic's evidence is `SC-HUB-009`'s route test plus the Tier 2 walk's embedding step.
- **Binding order**: the `EMBEDDING_PORT` binding is one task in this Epic's **last** phase, blocked
  on `EPIC-038`'s retrieval merging to `main` (the port, `IndexService` and `SearchService` do not
  exist on this branch). Until then the Hub's `Embed` resolution, adapters and conformance are built
  and tested on their own, and the binding is not faked.

### `Embed` contract 1.0 limits and targets (`FR-HUB-083`, `R-039-15`)

| Limit / target | Value | Why |
|---|---|---|
| Texts per request | **≤ 64** | `EPIC-038` re-indexes one source version at a time; 64 bounds memory at 768 × 64 floats |
| Characters per text | **≤ 8,000** | under `nomic-embed-text`'s 8,192-token context with margin for any tokenizer; over → refused naming the index of the text |
| Hub overhead per `embed()` | **< 15 ms p95** | resolution from an in-memory binding snapshot plus derived health; no decision read (deployment scope) |
| Single-query embed (search) | **< 150 ms p95** warm on the reference-local CPU | fits `EPIC-038`'s retrieval budget of < 800 ms |
| Batch of 32 × 1,000 chars | **< 2.5 s p95** on CPU | fits `EPIC-038`'s incremental re-index budget of < 5 s per source |
| Timeout | **20 s** per batch | a cold model load is the slow path; a timeout is `timed-out`, never re-resolved |
| Resolution volume | one row per `embed()` call | re-index bursts are bounded by `EPIC-038`'s incremental re-index; no per-text rows |

