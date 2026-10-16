# Tasks: Integration Hub

**Epic**: `EPIC-039` · **Branch**: `epic/039-integration-hub` · **Generated**: 2026-10-09

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/integration-hub-api.md](./contracts/integration-hub-api.md) ·
[contracts/capability-contract.md](./contracts/capability-contract.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T2100`–`T2299` (reserved for `EPIC-039`; `EPIC-047` stays below `T2100`,
`EPIC-048` holds `T2300`–`T2499`). This file uses `T2100`–`T2241` (**142 tasks**) and, since the
analysis remediation of 2026-10-10, `T2242`–`T2249` (**8 tasks**, in *Analysis remediation* below and
cross-referenced where they slot into a phase), leaving `T2250`–`T2299` for convergence.
Identifiers are never renumbered once written.

**Analysis remediation (2026-10-10).** [analysis.md](./analysis.md) findings and their disposition:
**I1** — `Embed` binding is deployment configuration recorded at boot, no route, no workspace grant
(`T2200`–`T2205` rewritten; data-model §8a, API §4a, plan, research `R-039-18` updated). **U1** —
`T2242`/`T2243`, `T2149`, `T2193`. **U2** — `T2244`, `T2124`, `T2168`. **C1** — `T2246`.
**C2** — `T2248`. **C3** — `T2249`. **C4** — `T2247` before `T2102`. **C5** — `T2238`.
**C6** — `T2152`. **D1** — `T2240` folded into `T2232`. **P1** — `T2213`, `T2237`. I2 and I3 are
reported in the closing report, as the analysis recommends.

**Tests are not optional here.** Constitution V: every implementation task names, in parentheses,
the test task that must precede it and fail first. Non-code outputs (the capability contract JSON
files) are paired with an executable conformance check.

**Three dependencies are not on this branch** — `EPIC-031` and `EPIC-032` (open PRs) and `EPIC-038`'s
retrieval half (its own branch). Every phase before Phase 11 builds against ports bound **refusing**
(`R-039-13`). Tasks that cannot complete until a merge are marked **BLOCKED (EPIC-0xx)**; they are
collected in Phase 11, except where a story's test must assert the refusal before the merge.

**`Embed` discharges `EPIC-038` work.** Phase 9 (US7) and Phase 11's `T2217`–`T2221` fill
`EPIC-038`'s `EmbeddingPort` through the Hub, which makes `EPIC-038`'s `T1282` (ranking by meaning)
runnable and unblocks its `T1301` (Tier 2 journey, with the known-red `T1294`) and `SC-CTX-006`.
Those tasks are **discharged in `EPIC-038`'s `tasks.md`**, not here; this Epic supplies the binding
and the evidence (`SC-HUB-009`).

---

## Phase 1: Setup

- [X] T2100 Create `specs/039-integration-hub/defects/README.md` — Constitution VI's sole defect intake, tracked in git so `DOR-11` can read it
 — **Done**: intake README with the record format; `T2236` reads it at closure.
- [X] T2101 [P] Create the package skeleton `packages/capability-contract/` (`package.json` `@pmi/capability-contract`, private, `type: module`, exports `.` and `./conformance`, `typecheck` only; `tsconfig.json` extending `../../tsconfig.base.json`) per `R-039-2`
 — **Done**: `@pmi/capability-contract`, exports `.`, `./conformance`, `./capabilities/*`.
- [X] T2102 [P] Create the package skeletons `packages/capability-adapters/fixture/`, `packages/capability-adapters/github/`, `packages/capability-adapters/resend/`, `packages/capability-adapters/ollama/` (`@pmi/capability-adapter-<name>`, each depending on `@pmi/capability-contract: workspace:*`); add `packages/capability-adapters/*` to `pnpm-workspace.yaml`; add `fast-xml-parser` and `fflate` to the GitHub package only (`R-039-9`) — **after `T2247`** puts both in the dependency register (`TS-001`)
 — **Done**: four `@pmi/capability-adapter-*` packages; `fflate@^0.8.2` and `fast-xml-parser@^5.2.0` in the GitHub package only, installed with the lockfile after `T2247`; the adapters are runtime dependencies of `backend` (R-039-1).
- [X] T2103 Write the failing governance assertion in `tests/governance/vitest-projects.spec.ts` for two new projects `capability-contract` and `capability-adapters`, then register both in `vitest.workspace.ts` (no `passWithNoTests`) and in the root `package.json` `test:unit` project list in the same change (T537/T539 rule)
 — **Done**: both projects in `vitest.workspace.ts` and `test:unit`, mapped in `vitest-projects.spec.ts`; the T2103 case was observed failing before registration.
- [X] T2104 [P] Write the failing reachability test `backend/tests/integration/integrations-reachability.spec.ts` importing the real `AppModule` and calling `GET /integrations/registry` — Constitution XI Tier 1; must fail before T2105
 — **Done**: `integrations-reachability.spec.ts` — registry, vocabulary and the request route through the real `AppModule`; 3/3 green against PostgreSQL.
- [X] T2105 Create `backend/src/modules/integrations/integrations.module.ts` and register it in `backend/src/app.module.ts` before `ServeStaticModule`, in the same change (integration test: T2104) — `DEF-005-001` is what an unregistered module looks like
 — **Done**: `IntegrationsModule` registered before `ServeStaticModule` in the same change.
- [X] T2106 [P] Add `PMI_ENVIRONMENT`, `PMI_INTEGRATION_KEYS`, `PMI_INTEGRATION_ACTIVE_KEY`, `PMI_INTEGRATION_SCHEDULER`, and (I1) `PMI_EMBED_ADAPTER`, `PMI_EMBED_BINDING` to `.env.example` with placeholder values only, and a governance assertion in `tests/governance/integrations-env.spec.ts` that each is documented and none holds a real-looking key (`R-039-8`, `R-039-10`, `FR-HUB-084`)
 — **Done**: `.env.example` documents the six variables (two added by I1); `integrations-env.spec.ts` 9/9, observed failing first.

**Checkpoint**: a defect intake, seven packages the workspace knows about, and a module the application actually builds.

---

## Phase 2: Foundational (blocking — no user story may start before this completes)

### The contract package

- [X] T2107 [P] Write failing unit tests in `packages/capability-contract/tests/vocabulary.spec.ts` — `CAPABILITY_NAMES` is exactly the five of `FR-HUB-010`; `PLATFORM_CALLERS` is the closed list of `R-039-12` and contains no connector or agent; `PLATFORM_ENVIRONMENTS` is `local | dev | stage | prod`; `Embed` is the only `deployment`-scoped name (`FR-HUB-084`)
 — **Done**: `vocabulary.spec.ts` (incl. the U1 HTTP-caller rule).
- [X] T2108 Implement `packages/capability-contract/src/vocabulary.ts` (unit test: T2107)
 — **Done**: `src/vocabulary.ts`.
- [X] T2109 [P] Write failing unit tests in `packages/capability-contract/tests/schema.spec.ts` — the JSON Schema subset validator accepts `type`, `properties`, `required`, `items`, `enum`, `maxItems`, `maxLength`, `pattern`, `additionalProperties: false`, and **rejects any other keyword by name**; validation errors name the path (`R-039-3`)
 — **Done**: `schema.spec.ts` 16 cases. Deviation: `minItems`/`minLength`/`description` added to the subset — `FR-HUB-083`'s lower bounds cannot be stated without them.
- [X] T2110 Implement `packages/capability-contract/src/schema.ts` (unit test: T2109)
 — **Done**: `src/schema.ts`, no runtime dependency.
- [X] T2111 [P] Write failing unit tests in `packages/capability-contract/tests/contract.spec.ts` — `compareContractVersions` accepts an additive minor and refuses, naming each difference, a minor that removes or retypes an input, output or error category (`FR-HUB-011`); a contract with `changesState: true` must declare it (`FR-HUB-014`)
 — **Done**: `contract.spec.ts`.
- [X] T2112 Implement `packages/capability-contract/src/contract.ts` (unit test: T2111)
 — **Done**: `src/contract.ts` — `compareContractVersions`, `contractDocumentErrors`.
- [X] T2113 [P] Write the failing conformance check `packages/capability-contract/tests/capabilities-conformance.spec.ts` — each file in `capabilities/` is named for its content; schemas use only the subset; only `SendNotification` has `changesState: true` unless an explicit allow-list is edited; `Embed` declares the 64-text and 8,000-character limits (`FR-HUB-083`); **it must be observed failing on a deliberately broken copy** (Constitution V)
 — **Done**: `capabilities-conformance.spec.ts`, including five cases run on a deliberately broken copy of the files.
- [X] T2114 Write the five contract documents `packages/capability-contract/capabilities/ReadRepository.v1.0.json`, `ReadBuildStatus.v1.0.json`, `ReadTestResults.v1.0.json`, `SendNotification.v1.0.json`, `Embed.v1.0.json` per [contracts/capability-contract.md](./contracts/capability-contract.md) §1 (conformance check: T2113)
 — **Done**: five `capabilities/*.v1.0.json`; `Embed` states `maxTexts` 64 and `maxTextLength` 8000.
- [X] T2115 [P] Write failing unit tests in `packages/capability-contract/tests/fact.spec.ts` — `Fact<T>` admits a value or a non-empty reason and nothing else; an empty reason does not type-check and is refused at runtime (`FR-HUB-023`)
 — **Done**: `fact.spec.ts` (compile-time `@ts-expect-error` cases plus runtime refusal).
- [X] T2116 Implement `packages/capability-contract/src/fact.ts`, `health.ts` and `errors.ts` (unit test: T2115) — `HEALTH_STATES` written as three, `unknown` derived only; `COMMON_ERROR_CATEGORIES`
 — **Done**: `src/fact.ts`, `src/health.ts` (with the pure `deriveHealth`), `src/errors.ts`.
- [X] T2117 [P] Write failing unit tests in `packages/capability-contract/tests/adapter.spec.ts` — `CredentialHandle` has no `value`, `toString()` is `[credential]`, `toJSON()` throws; an `AdapterDescriptor` without provider, transport, version or `implements` is refused naming the field; an `Embed` descriptor must declare `embedding.models[].dimension` (`FR-HUB-024`, `FR-HUB-081`)
 — **Done**: `adapter.spec.ts`.
- [X] T2118 Implement `packages/capability-contract/src/adapter.ts` (unit test: T2117)
 — **Done**: `src/adapter.ts` — the handle keeps its secret in a module-private WeakMap; `toJSON` throws.
- [X] T2119 [P] Write failing unit tests in `packages/capability-contract/tests/eligibility.spec.ts` — `evaluateCandidates` evaluates **every** condition for **every** candidate in the fixed order of `R-039-7`, names the first failure per candidate, resolves exactly one eligible, uses preference among several, refuses `ambiguous` at equal preference naming both, refuses `no-eligible-adapter` listing all, never selects an `inbound` entry, never crosses a major (`FR-HUB-030`–`FR-HUB-036`)
 — **Done**: `eligibility.spec.ts` 13 cases.
- [X] T2120 Implement `packages/capability-contract/src/eligibility.ts` (unit test: T2119)
 — **Done**: `src/eligibility.ts` — total, fixed order, inbound excluded with a reason.
- [X] T2121 [P] Write failing unit tests in `packages/capability-contract/tests/redaction.spec.ts` — the patterns are the same list as `backend/src/modules/executions/sanitisation.ts` (asserted by import, not by copy) and a `pmi-canary-` value matches (`FR-HUB-045`, `R-039-10`)
 — **Done**: `redaction.spec.ts`; the identity assertion with `sanitisation.ts` lives in `backend/tests/unit/integrations-redaction.spec.ts` because the package imports nothing from the repository (deviation: file location).
- [X] T2122 Implement `packages/capability-contract/src/redaction.ts`, `ports.ts` (`CAPABILITY_PORTS`: name, filledBy, absent) and `index.ts` (unit test: T2121)
 — **Done**: `src/redaction.ts` (patterns MOVED from `executions/sanitisation.ts`, which re-exports them; canary, fine-grained GitHub and Resend key shapes added), `src/ports.ts`, `src/index.ts`.
- [X] T2123 [P] Write the shared adapter conformance suite `packages/capability-contract/tests/conformance/capability-conformance.suite.ts` — cases CC-01 to CC-13 of [contracts/capability-contract.md](./contracts/capability-contract.md) §3, with a harness interface for failure injection; exported as `./conformance`
 — **Done**: `packages/capability-contract/tests/conformance/capability-conformance.suite.ts` CC-01..CC-13, exported as `./conformance`.

### Schema, stores and the execution event

- [X] T2124 [P] Write the failing integration test `backend/tests/integration/integrations-constraints.spec.ts` — raw SQL around the services: `UPDATE`/`DELETE` on `capability_resolutions`, `capability_invocations`, `integration_health_checks`, `deployment_capability_bindings` rejected by `reject_mutation()`; an approved contract version accepts only `status → retired`; `(workspaceId, key)` unique; a `project`-scope resolution without `projectId` or `workspaceId` violates the `CHECK`; one credential per (project, adapter); (U2, `T2244`) a second `scheduled` health row for the same pair and `intervalBucket` is a no-op under `ON CONFLICT DO NOTHING` while `request` rows are unconstrained
 — **Done**: `integrations-constraints.spec.ts` 15/15 against PostgreSQL, rewritten for I1 and U2.
- [X] T2125 Write `backend/prisma/migrations/20261009130000_epic039_integration_hub/migration.sql` and the ten models in `backend/prisma/schema.prisma` per [data-model.md](./data-model.md), attaching the shared `reject_mutation()` (never redefining it) and seeding the five approved v1 contract versions from the JSON files (integration test: T2124) — never `prisma format`
 — **Done**: migration `20261009130000_epic039_integration_hub` + ten Prisma models (no back-relations on Workspace/Project); seed generated from the JSON files; `universal-columns.spec.ts` updated (two tables declared not tenant-scoped).
- [X] T2126 [P] Extend the conformance check T2113 with a case asserting the migration's seed rows equal the five JSON files byte-for-byte after normalisation (`R-039-3`)
 — **Done**: the seed-equality case in `capabilities-conformance.spec.ts`.
- [X] T2127 [P] Write failing unit tests in `backend/tests/unit/integrations-store.spec.ts` — workspace scoping on every read; the three decision tables have no update method; the credential store view type has no `ciphertext` field
 — **Done**: `integrations-store.spec.ts` 13/13.
- [X] T2128 Implement `backend/src/modules/integrations/integrations.store.ts` (interfaces + in-memory, unit tests only) (unit test: T2127)
 — **Done**: `integrations.store.ts` with `CredentialVaultPort` as the only ciphertext path.
- [X] T2129 [P] Write failing integration tests in `backend/tests/integration/integrations-store-prisma.spec.ts` — the behaviour of T2127 against PostgreSQL
 — **Done**: `integrations-store-prisma.spec.ts` 10/10 against PostgreSQL (written after `T2130`'s first draft; run red on a compile error, then green).
- [X] T2130 Implement `backend/src/modules/integrations/integrations.store.prisma.ts` (integration test: T2129)
 — **Done**: `integrations.store.prisma.ts`; the U2 insert is a raw `ON CONFLICT DO NOTHING`.
- [X] T2131 [P] Write a failing unit test in `packages/execution-registry-contract/tests/capability-event.spec.ts` — `capability-resolved` is in `GOVERNANCE_EVENTS`, `isExecutionEventType` accepts it, `classOf` is `governance`; and update `packages/execution-registry-contract/tests/events.spec.ts`'s parity to 9 + 4 + 4 + 13 = 30 (`R-039-12`)
 — **Done**: `capability-event.spec.ts` + parity 9+4+4+13 = 30; observed 5 failing before `T2132`.
- [X] T2132 Add `capability-resolved` to `GOVERNANCE_EVENTS` in `packages/execution-registry-contract/src/events.ts` (unit test: T2131)
 — **Done**: `capability-resolved` in `GOVERNANCE_EVENTS`; the registry's refusal text no longer says '29-event'.

### Ports, catalog and ticker

- [X] T2133 [P] Write failing unit tests in `backend/tests/unit/integrations-ports.spec.ts` — `CapabilityPolicy`, `EvidenceSink` and `CredentialKeyring` bound refusing each throw `GovernanceSeamUnboundError` naming itself; none answers permissively (`R-039-13`)
 — **Done**: `integrations-ports.spec.ts` 7/7.
- [X] T2134 Implement `backend/src/modules/integrations/integrations.tokens.ts` with the six ports and their refusing bindings (unit test: T2133)
 — **Done**: `integrations.tokens.ts` — seams with refusing defaults and a visible `bind()`.
- [X] T2135 [P] Write failing unit tests in `backend/tests/unit/integrations-catalog.spec.ts` — the catalog refuses two adapters with one key; joins a registry row to its descriptor; reads a key absent from the build as *not applicable — "adapter not present in this build"* and ineligible; detects a changed version against the last observed one (`R-039-4`)
 — **Done**: `integrations-catalog.spec.ts`.
- [X] T2136 Implement `backend/src/modules/integrations/catalog.service.ts` and `backend/src/composition/integration-adapters.ts` (the one backend file importing adapter packages; fixture adapters only at this point) (unit test: T2135)
 — **Done**: `catalog.service.ts`, `composition/integration-adapters.ts`.
- [X] T2137 [P] Write failing unit tests in `backend/tests/unit/integrations-ticker.spec.ts` — the manual ticker runs the callback only when advanced; the timer ticker is unref'd and stops on module destroy; `PMI_INTEGRATION_SCHEDULER=off` starts nothing (`R-039-6`)
 — **Done**: `integrations-ticker.spec.ts` (adds `manual` for route tests).
- [X] T2138 Implement `backend/src/modules/integrations/health/ticker.ts` (unit test: T2137)
 — **Done**: `health/ticker.ts`.

**Checkpoint**: a vocabulary that is a document, a resolver core that cannot skip a condition, tables that cannot be rewritten, ports that refuse, and one place where providers are composed.

---

## Phase 3: User Story 1 — A platform workflow asks for a capability, never a provider (Priority: P1) 🎯 MVP

**Goal**: request each capability through the real entry point and receive a result or an explained refusal.

**Independent test**: quickstart Q4, Q5, Q7–Q9, Q11 — with only fixture adapters registered.

- [X] T2139 [P] [US1] Write failing unit tests for the fixture read adapters in `packages/capability-adapters/fixture/tests/conformance.spec.ts` — `fixture-git` (`ReadRepository`) and `fixture-ci` (`ReadBuildStatus`, `ReadTestResults`) pass the T2123 suite, with scriptable health, throttling, non-final runs and a non-conforming output for `FR-HUB-016`
 — **Done**: `fixture/tests/conformance.spec.ts` — the CC suite over `fixture-git` and `fixture-ci` plus binding-script cases.
- [X] T2140 [US1] Implement `packages/capability-adapters/fixture/src/{git,ci}.fixture.ts` and `index.ts` (unit test: T2139)
 — **Done**: `fixture/src/{shared,git.fixture,ci.fixture,index}.ts` — scripted by the binding's `script`.
- [X] T2141 [P] [US1] Write failing unit tests in `backend/tests/unit/integrations-configuration.spec.ts` — `PUT` of a capability's configuration increments `configVersion`, refuses several adapters without distinct preferences, an inbound or retired entry, a binding failing the adapter's schema or containing secret-looking material; requests a policy decision through `CapabilityPolicy` and stores its id; policy status derived on read, never cached; every change audited as `update` with before/after (`FR-HUB-031`, `FR-HUB-032`, `FR-HUB-062`, `R-039-7`)
 — **Done**: `integrations-configuration.spec.ts`. Deviation: bindings are held per adapter (`providerBinding[registryEntryId]`), since two adapters of one capability need different bindings.
- [X] T2142 [US1] Implement `backend/src/modules/integrations/configuration.service.ts` (unit test: T2141)
 — **Done**: `configuration.service.ts`.
- [X] T2143 [P] [US1] Write failing unit tests in `backend/tests/unit/integrations-resolver.spec.ts` — the service assembles candidates from catalog, registry, configuration, credential presence, derived health, `PMI_ENVIRONMENT` and policy status; records the resolution **before** any invocation; refuses `unknown-capability`, `provider-pinned`, `no-compatible-adapter`; never re-resolves after a failure (`FR-HUB-030`–`FR-HUB-039`)
 — **Done**: `integrations-resolver.spec.ts`.
- [X] T2144 [US1] Implement `backend/src/modules/integrations/resolver/{resolver.service.ts,explanation.ts}` (unit test: T2143)
 — **Done**: `resolver/{resolver.service.ts,explanation.ts}`.
- [X] T2145 [P] [US1] Write failing unit tests in `backend/tests/unit/integrations-output-validation.spec.ts` — a non-conforming adapter output is refused as `adapter-fault` and never returned; an `Embed` result with a count mismatch, wrong dimension, non-finite or zero vector is refused (`FR-HUB-016`, `FR-HUB-081`)
 — **Done**: `integrations-output-validation.spec.ts`.
- [X] T2146 [US1] Implement `backend/src/modules/integrations/requests/output-validation.ts` (unit test: T2145)
 — **Done**: `requests/output-validation.ts`.
- [X] T2147 [P] [US1] Write failing unit tests in `backend/tests/unit/integrations-requests.spec.ts` — the request service validates input against the contract, refuses credential material in input (`FR-HUB-045`), invokes the resolved adapter once with a timeout, writes exactly one invocation row, appends `capability-resolved` to the execution when `executionId` is given (`FR-HUB-038`) and refuses `Embed` here (deployment scope)
 — **Done**: `integrations-requests.spec.ts`.
- [X] T2148 [US1] Implement `backend/src/modules/integrations/requests/capability-requests.service.ts` — the `CapabilityRequests` service in-process callers use (unit test: T2147)
 — **Done**: `requests/capability-requests.service.ts`; composed in `hub.ts` with everything else.
- [X] T2149 [P] [US1] Write failing route tests in `backend/tests/integration/integrations-requests-route.spec.ts` against `AppModule` — `POST /projects/:id/capability-requests` for `ReadRepository`, `ReadBuildStatus`, `ReadTestResults` through the fixture adapters with an **in-test `CapabilityPolicy` binding that records every call**; the refusals of Q5, Q7, Q8, Q9; a connector credential is refused `surface_not_accepted` before the body is read (Q11, `FR-HUB-004`); (U1) a body naming a non-`room:*` caller is a recorded `caller-not-platform` refusal; a project in another workspace is `404`; while `CapabilityPolicy` is unbound the route is `503` naming it
 — **Done**: `integrations-requests-route.spec.ts` 12/12 against `AppModule` (503 while unbound, then a recording policy bound in the test). Note: the controllers existed before this file ran; `T2104` was the route-level test observed failing first. `surface_not_accepted` is HTTP 400 — the platform's existing mapping (API §5 note).
- [X] T2150 [US1] Implement `backend/src/modules/integrations/requests/capability-requests.controller.ts` and `configuration.controller.ts` per the API contract §3, §5 (integration test: T2149)
 — **Done**: `requests/capability-requests.controller.ts`, `configuration.controller.ts`, `session.ts` (connector refusal before the body is used).
- [X] T2151 [P] [US1] Add a failing case to `backend/tests/architecture/mcp-server-boundary.spec.ts` — no `pmi.capability*` or `pmi.integrations*` tool exists in `packages/mcp-server/src/tools/` (`FR-HUB-004`, `R-039-12`); it must pass on today's tree and fail on a planted tool
 — **Done**: case added to `mcp-server-boundary.spec.ts`, with a planted-tool check; `@pmi/mcp-server` also exports a plain `tool-names` table asserted equal to the registered tools.

**Checkpoint**: the MVP — a workflow names a capability and gets a result or a reason, and nothing else can ask.

---

## Phase 4: User Story 2 — Swapping a provider changes configuration, not business rules (Priority: P1)

**Goal**: a second, real adapter for each read capability, and a boundary that makes swapping a configuration event.

**Independent test**: quickstart Q2, Q6.

- [X] T2152 [P] [US2] Write the failing boundary check `backend/tests/architecture/capability-independence.spec.ts` — anti-vacuity; no provider names in `backend/src/**` except the composition file and in `packages/*` except `capability-adapters/**`; no `@pmi/capability-adapter-*` import outside the composition file; no module outside `integrations/` imports its internals; the backend **does** depend on `@pmi/capability-contract`; failures name file and line (`FR-HUB-061`, `R-039-17`). (C6) The provider-name rule is also the enforcement of `FR-HUB-050`: a bespoke per-tool intake path would have to name its tool's provider outside the adapters, and this check fails it — **Done**: `capability-independence.spec.ts` 12 cases (anti-vacuity, provider names, adapter imports, internals, the contract dependency, file:line in failures); FR-HUB-050 covered by the provider-name rule (C6).
- [X] T2153 [US2] Make T2152 green on today's tree — allow-list any comment-surviving match by path **and** line content with a reason, never by directory (architecture test: T2152) — **Done**: green on today's tree with no allow-list entry needed.
- [X] T2154 [P] [US2] Write failing unit tests in `packages/capability-adapters/github/tests/token.spec.ts` — the App JWT is RS256-signed with `node:crypto`; installation tokens are requested with exactly the capability's permissions and the bound repository; a token is cached per (installation, permission set) until 5 min before expiry; a `github-token` credential reports `not-narrowable` (`R-039-9`, `FR-HUB-034`) — **Done**: `github/tests/token.spec.ts` 6 cases.
- [X] T2155 [US2] Implement `packages/capability-adapters/github/src/auth.ts` (unit test: T2154) — **Done**: `github/src/auth.ts` — RS256 JWT with `node:crypto`, per-(installation, permission set) cache to 5 min before expiry, `github-token` → `not-narrowable`.
- [X] T2156 [P] [US2] Record dated provider responses in `packages/capability-adapters/github/tests/recordings/` for commits, trees, contents, check runs, combined status, workflow runs, artifacts and an artifact zip; and write failing tests in `packages/capability-adapters/github/tests/conformance.spec.ts` running the T2123 suite over an injected `FetchLike` serving them — **Done**: three dated recordings in `github/tests/recordings/` (constructed from the documented API and labelled so in their provenance, not captured live) served by `@pmi/capability-contract/replay`; `conformance.spec.ts` runs CC-01..CC-09 (CC-10..CC-13 not applicable to read capabilities, skipped by the suite).
- [X] T2157 [US2] Implement `packages/capability-adapters/github/src/{read-repository,read-build-status,http,descriptor}.ts` (unit test: T2156) — `x-github-api-version: 2022-11-28`; `403`/`429` with `retry-after` or `x-ratelimit-remaining: 0` → `provider-throttled` — **Done**: `github/src/{read-repository,read-build-status,http,descriptor,index}.ts`.
- [X] T2158 [P] [US2] Write failing unit tests in `packages/capability-adapters/github/tests/junit.spec.ts` — `fflate.unzipSync` with a filter accepting only `*.xml` ≤ 50 MiB expanded; `fast-xml-parser` with `processEntities: false`; an entity-expansion payload is not expanded; 20,001 cases → `result-too-large`; any run not `completed` → `final: false`; no artifact → `results-not-found` — **Done**: `github/tests/junit.spec.ts`.
- [X] T2159 [US2] Implement `packages/capability-adapters/github/src/read-test-results.ts` (unit test: T2158) — **Done**: `github/src/read-test-results.ts` — fflate filter `*.xml` ≤ 50 MiB, `processEntities: false`, 20,000-case cap.
- [X] T2160 [US2] Add `github-rest` to `backend/src/composition/integration-adapters.ts` (unit test: T2135 extended with the GitHub descriptor) — **Done**: `github-rest` in `composition/integration-adapters.ts`; `integrations-catalog.spec.ts` extended.
- [X] T2161 [P] [US2] Write the failing caller-level suite `backend/tests/integration/integrations-caller-suite.spec.ts` — one suite run twice against `AppModule`, once with the project configured for `fixture-*` and once for `github-rest` over the recordings, for each read capability; the second run differs from the first only by a `PUT …/configuration`; asserts the configuration change is audited (`SC-HUB-001`, `FR-HUB-060`, `FR-HUB-062`, `US2` AS1–AS2) — **Done**: `integrations-caller-suite.spec.ts` 4/4 against `AppModule` — fixture, then `github-rest` over recordings on loopback, differing only by `PUT …/configuration` (audited).
- [X] T2162 [US2] Make T2161 green — any difference between the two runs is a defect in an adapter or the contract, recorded in `defects/` first (integration test: T2161) — **Done**: green with no difference between the runs; no defect recorded.

**Checkpoint**: `BG-04` is a test, not a sentence.

---

## Phase 5: User Story 3 — Every integration surface is listed with the same lifecycle facts (Priority: P1)

**Goal**: one registry, both directions, every field a value or a reason; health that goes stale.

**Independent test**: quickstart Q3, Q15, Q16.

- [X] T2163 [P] [US3] Write failing unit tests in `backend/tests/unit/integrations-registry.spec.ts` — register a catalog key (refusing a connector key and an unknown key), retire idempotently, history readable after retirement; every act audited with before/after; `EPIC-024` edit on `{ artifactType: 'integration-registry', artifactId: workspaceId }` required to register or retire and read to read (`FR-HUB-025`, `FR-HUB-028`, `FR-HUB-029`)
 — **Done**: `integrations-registry.spec.ts`.
- [X] T2164 [US3] Implement `backend/src/modules/integrations/registry.service.ts` (unit test: T2163)
 — **Done**: `registry.service.ts`.
- [X] T2165 [P] [US3] Write failing unit tests in `backend/tests/unit/integrations-connector-seed.spec.ts` — the seed lists `pmi-studio` first and `surface:ide-extension`, `surface:local-cli`, `surface:ci-cd`, `surface:managed-sandbox`; reads `pmi-studio`'s version from `packages/mcp-server/package.json`, its tools from the server's tool table and the contract version from `CONTRACT_VERSION`; names `fixture` in `omitted` with its reason; grants `edit` on `integration-registry` to the workspace creator; is idempotent; acts as `system:epic-039-seed` (`FR-HUB-021`, `R-039-5`, `R-039-10`)
 — **Done**: `integrations-connector-seed.spec.ts` 3/3.
- [X] T2166 [US3] Implement the connector seed in `backend/src/modules/integrations/registry.service.ts` (unit test: T2165)
 — **Done**: seed in `registry.service.ts`; facts read through `connector-facts.ts` from `@pmi/mcp-server/tool-names` and `CONTRACT_VERSION`; creator = the workspace's earliest user.
- [X] T2167 [P] [US3] Write a failing architecture test `backend/tests/architecture/integrations-connector-unchanged.spec.ts` — the integrations module imports from `packages/mcp-server` only its exported tool-name table and version, and writes to no connector table (`FR-HUB-022`) — **Done**: `integrations-connector-unchanged.spec.ts` 5/5 — only `@pmi/mcp-server/tool-names` imported, no path reach, no connector-store write; the write regex shown to fail on a planted call. Left untracked by the interrupted run; finished and committed in this run.
- [X] T2168 [P] [US3] Write failing unit tests in `backend/tests/unit/integrations-health.spec.ts` — derived health: latest check within the interval, else `unknown` with `never-checked` or `stale`; a request's `credential-rejected` writes `unhealthy` and a throttle writes `degraded` with the hint; a success writes nothing; `runDueHealthChecks` selects at most 50 due pairs, concurrency 4, 5 s timeout, and (U2, `T2244`) records one check per pair per interval under concurrent instances by inserting the row **after** the check with `ON CONFLICT DO NOTHING` (`FR-HUB-026`, `FR-HUB-027`, `FR-HUB-047`, `R-039-6`) — **Done**: `integrations-health.spec.ts` 8/8 — derived, interval minimum, scripted state, degraded hint, 50/4 limits, 5 s timeout, and the U2 two-instance lease. Left untracked by the interrupted run; committed in this run.
- [X] T2169 [US3] Implement `backend/src/modules/integrations/health/{health.service.ts,health-scheduler.ts}` (unit test: T2168) — **Done**: `health/health.service.ts` (`derive`, `observeOutcome`, `probe`, `checkNow`, `runDueHealthChecks`). Deviation: no separate `health-scheduler.ts` — the scheduler is the ticker (`health/ticker.ts`) started in `IntegrationsModule.onModuleInit`, which calls `runDueHealthChecks`.
- [X] T2170 [P] [US3] Write failing route tests in `backend/tests/integration/integrations-registry-route.spec.ts` against `AppModule` — `GET /integrations/registry` returns `pmi-studio` first and every field a value or *not applicable* with a reason for every entry (`SC-HUB-003`); `GET …/:entryId` returns health history and recent resolutions with explanations in one response (`FR-HUB-072`); `POST`/`retire` refused without the grant; capabilities routes list five approved versions; health via the job handler with the manual ticker reads `unknown` once stale (Q15) — **Done**: `integrations-registry-route.spec.ts` 13/13 against `AppModule` — `pmi-studio` first, every Fact a value or a reason with and without a project, health via the manual ticker and a backdated check reading `unknown / stale`, detail with history and per-candidate refusals, 404 for a member without the grant, idempotent retire, the five approved versions. Note: the controller existed before this file (as with `T2149`); `T2104` was the route test observed failing first.
- [X] T2171 [US3] Implement `backend/src/modules/integrations/registry.controller.ts` per the API contract §1–§2 (integration test: T2170) — **Done**: `registry.controller.ts` (already in place); green under `T2170`. The test helper gained `sql()` and `asUser()`.

**Checkpoint**: *"what talks to this platform?"* has one answer.

---

## Phase 6: User Story 4 — A project owner configures a provider without ever exposing its secret (Priority: P1)

**Goal**: per-project credentials, encrypted, write-only, narrowed at resolution.

**Independent test**: quickstart Q12–Q14.

- [X] T2172 [P] [US4] Write failing unit tests in `backend/tests/unit/integrations-cipher.spec.ts` — AES-256-GCM round trip; a random 12-byte IV per write; decrypting with another project's AAD fails; an unknown `keyId` fails closed; with no keyring the write is refused `503` naming `CredentialKeyring` and nothing is stored (`R-039-10`, `SC-HUB-005`) — **Done**: `integrations-cipher.spec.ts`.
- [X] T2173 [US4] Implement `backend/src/modules/integrations/credentials/{credential.cipher.ts,keyring.ts}` (unit test: T2172) — **Done**: `credentials/credential.cipher.ts`, `credentials/keyring.ts`.
- [X] T2174 [P] [US4] Write failing unit tests in `backend/tests/unit/integrations-vault.spec.ts` — `withCredential(ref, scope, fn)` yields a `CredentialHandle` only for the resolved project and adapter; the plaintext is released only inside `use(fn)`; the vault is the only reader of `ciphertext` (`FR-HUB-042`, `FR-HUB-044`) — **Done**: `integrations-vault.spec.ts`.
- [X] T2175 [US4] Implement `backend/src/modules/integrations/credentials/credential.vault.ts` (unit test: T2174) — **Done**: `credentials/credential.vault.ts` — the only opener; a copied row reads as absent.
- [X] T2176 [P] [US4] Write the failing architecture test `backend/tests/architecture/integrations-credentials-boundary.spec.ts` — no file other than `credential.vault.ts` and `integrations.store.prisma.ts` names `ciphertext`; no adapter package imports the vault; `CredentialHandle` never reaches a controller return type — **Done**: `integrations-credentials-boundary.spec.ts` 6/6.
- [X] T2177 [P] [US4] Write failing unit tests in `backend/tests/unit/integrations-credentials.spec.ts` — set, replace and remove require `OwnerGate.requireOwner` (`governance/owner-gate.ts:47`) and audit `access_refused` on refusal; `status()` returns `{ state, kind, setBy, setAt }` and nothing else; audit `detail` never holds a value; removal makes the adapter ineligible as `credential-missing`; setting schedules an immediate health check (`FR-HUB-041`, `FR-HUB-043`, `FR-HUB-046`, `SC-HUB-008`) — **Done**: `integrations-credentials.spec.ts`.
- [X] T2178 [US4] Implement `backend/src/modules/integrations/credentials/{credential.service.ts,credentials.controller.ts}` per the API contract §4 (unit test: T2177) — **Done**: `credentials/{credential.service.ts,credentials.controller.ts}`.
- [X] T2179 [P] [US4] Write failing unit tests in `backend/tests/unit/integrations-scope.spec.ts` — the resolver grants only the contract's `requiredScope`; `narrowing` is `exact`, `narrowed-at-issue` or `not-narrowable`; `not-narrowable` follows `onNotNarrowable`, defaulting to `refuse` for a state-changing capability and `proceed-and-record` otherwise (`FR-HUB-034`, `US4` AS4) — **Done**: `integrations-scope.spec.ts`.
- [X] T2180 [US4] Implement `backend/src/modules/integrations/resolver/scope.ts` (unit test: T2179) — **Done**: `resolver/scope.ts`.
- [X] T2181 [P] [US4] Write the failing canary suite `backend/tests/integration/integrations-credential-canary.spec.ts` against `AppModule` — set `pmi-canary-<uuid>` for an adapter, then exercise every route of the API contract, render the Integrations page DOM through its client, read audit entries, the three decision tables, execution events, captured logger output, a forced provider error body, and `pmi-studio`'s `pmi.project.context` and `pmi.execution.history` through its in-process client; the canary (raw, base64, URL-encoded) is found nowhere; and project B never resolves with project A's credential (`SC-HUB-004`, `SC-HUB-005`, quickstart Q13–Q14) — **the suite the `SC-HUB-004` mutation proof targets** — **Done**: `integrations-credential-canary.spec.ts` 9/9 against `AppModule`.
- [X] T2182 [US4] Make T2181 green — any hit is a defect recorded in `defects/` before its fix (integration test: T2181) — **Done**: green; no hit, no defect recorded.

**Checkpoint**: the Hub holds secrets and cannot show one.

---

## Phase 7: User Story 5 — External test and build results become typed evidence (Priority: P2)

**Goal**: intake reads results through capabilities and contributes them to `EPIC-032`'s store.

**Independent test**: quickstart Q17 — **after `EPIC-032` merges**; before it, the refusal.

- [X] T2183 [P] [US5] Write failing unit tests in `backend/tests/unit/integrations-evidence-intake.spec.ts` — no revision → `not-contributed / no-revision` at enqueue; `final: false` → `pending`, re-read every 120 s until `giveUpAt`, then `gave-up`; a refused resolution → `refused` with its code and nothing contributed; no binding at `CompletionGate.evaluate` → `not-contributed / no-binding`; a contribution is an in-toto Statement with a `gitCommit` subject, the test-result predicate inline (never referenced), and `source.uri = pmi-adapter:<key>` (`FR-HUB-050`–`FR-HUB-055`, `R-039-11`) — **Done**: `integrations-evidence-intake.spec.ts` 13 cases, observed failing (module missing) before `T2184`. The give-up case runs the health ticker alongside the intake job, as production does, so health does not go stale over 30 minutes.
- [X] T2184 [US5] Implement `backend/src/modules/integrations/evidence/evidence-intake.service.ts` against the `EvidenceSink` port (unit test: T2183) — **Done**: `evidence/evidence-intake.service.ts` — enqueue records `no-revision` before the 400; the job resolves in process as `evidence-intake`; the predicate is inline; a store fault is `refused / evidence-store-refused`. Composed in `hub.ts` as `hub.intake`.
- [X] T2185 [P] [US5] Write failing route and job tests in `backend/tests/integration/integrations-evidence-intake.spec.ts` against `AppModule` — `POST …/evidence-intake` → `202`; the `integrations.evidence-intake` job handler with the manual ticker; **while `EvidenceSink` is unbound** the intake records `refused / evidence-seam-unbound` and the item stays unmet (`FR-HUB-055`) — **Done**: `integrations-evidence-intake.spec.ts` (integration) 8/8 against `AppModule` — observed failing (no `intake.job.js`) first; `202`, the recorded `no-revision` row before the `400`, and `refused / evidence-seam-unbound` from the job on the manual ticker with no resolution made.
- [X] T2186 [US5] Implement `backend/src/modules/integrations/evidence/intake.job.ts` and the routes of API contract §6 (integration test: T2185) — **Done**: `evidence/intake.job.ts` (`INTAKE_JOB = integrations.evidence-intake`, started on the module ticker beside health) and `evidence/intake.controller.ts` (API §6 enqueue and read).

**Checkpoint**: the mechanism `FR-EVS-040` names exists; it refuses until its store is there.

---

## Phase 8: User Story 6 — Notifications go out through whichever provider the project uses (Priority: P2)

**Goal**: `SendNotification` through a fixture and through Resend, delivered once, refused when it would leak.

**Independent test**: quickstart Q10.

- [X] T2187 [P] [US6] Write failing tests in `packages/capability-adapters/fixture/tests/notify.spec.ts` — `fixture-notify` passes the T2123 suite including CC-10, records deliveries, honours the idempotency key, and fails on demand with a provider reason — **Done**: `fixture/tests/notify.spec.ts` — the T2123 suite (CC-01–04, 07, 08, 10; the read- and Embed-only cases not applicable) plus five fixture cases; observed failing (no export) before `T2188`.
- [X] T2188 [US6] Implement `packages/capability-adapters/fixture/src/notify.fixture.ts` (unit test: T2187) — **Done**: `fixture/src/notify.fixture.ts` — records deliveries, one per idempotency key (the repeat answers the first message id), scripted failures through the binding; added to the composition file.
- [X] T2189 [P] [US6] Record dated Resend responses in `packages/capability-adapters/resend/tests/recordings/` and write failing tests in `packages/capability-adapters/resend/tests/conformance.spec.ts` — `POST /emails` carries `Idempotency-Key`; `GET /domains` → `401 restricted_api_key` reads *healthy, `narrowed-at-issue`*, `200` reads *healthy, `not-narrowable`*, other `401` reads `credential-rejected`; `429` with `retry-after` → `provider-throttled` — **Done**: two dated recordings (`2026-10-10.resend-email.json` sending-only, `…full-access.json`), constructed from the Resend documentation (Context7 `/websites/resend`) and labelled so in `provenance` — no key was available for a live capture (`T2231`); `resend/tests/conformance.spec.ts` (suite incl. CC-09, CC-10 + 8 specifics), observed failing (no module) first.
- [X] T2190 [US6] Implement `packages/capability-adapters/resend/src/{send,health,descriptor}.ts` and add `resend-email` to the composition file (unit test: T2189) — **Done**: `resend/src/{descriptor,http,send,health,index}.ts` — `Idempotency-Key` on `POST /emails`, the `GET /domains` probe reading the key's scope, `429` → `provider-throttled`; `resend-email` added to the composition file.
- [X] T2191 [P] [US6] Write failing unit tests in `backend/tests/unit/integrations-notifications.spec.ts` — subject or body with credential material is refused `credential-material-in-content`, never redacted and sent; one `notification_deliveries` row per request; a provider failure records the reason and touches nothing of the cause; a full-access Resend key is refused by default (`US6`, `FR-HUB-034`, `FR-HUB-045`) — **Done**: `integrations-notifications.spec.ts` 5 cases, observed failing (no service) first; the Resend case runs `resend-email` over its recordings — full-access key → `scope-not-narrowable`, sending-only key → delivered with the delivery id as `Idempotency-Key`.
- [X] T2192 [US6] Implement `backend/src/modules/integrations/notifications/notification.service.ts` (unit test: T2191) — **Done**: `notifications/notification.service.ts` — in process as `notification-dispatch`, the delivery id minted first and sent as the idempotency key, one row per request (`refused` / `failed` with the sanitised category / `delivered`), the cause only read; composed as `hub.notifications`.
- [X] T2193 [US6] Extend T2161 with `SendNotification` run against `fixture-notify` and `resend-email` (recordings) through `POST …/capability-requests` with a `room:*` caller, and through the in-process `CapabilityRequests` service with caller `notification-dispatch` (U1: that caller is not accepted over HTTP) (integration test: T2161) — **Done**: `integrations-caller-suite.spec.ts` 8/8 against `AppModule` — `SendNotification` run twice (`fixture-notify`, then `resend-email` over loopback recordings with a sending-only key) through the route as `room:change` and in process through `hub.notifications` as `notification-dispatch`; `notification-dispatch` over HTTP refused `caller-not-platform`; same contract shape. Green at first run because `T2188`–`T2192` had already landed (the extension exercises them; it was not observed red).

**Checkpoint**: the one state-changing capability is narrowable, idempotent and refuses to leak.

---

## Phase 9: User Story 7 — Context assembly embeds through whichever model the deployment binds (Priority: P2)

**Goal**: the `Embed` capability, a deterministic fixture and a local real adapter, a deployment-scope binding, and `HubEmbeddingPort` ready to fill `EPIC-038`'s `EmbeddingPort` with no shape change.

**Independent test**: quickstart Q21 here; Q19–Q20 after `EPIC-038` merges (Phase 11).

- [X] T2194 [P] [US7] Write failing tests in `packages/capability-adapters/fixture/tests/embed.spec.ts` — `fixture-embed` passes the T2123 suite including CC-11 and CC-13: dimension 27, `modelId` `fixture-letters`, identical vectors for identical text, equal to `EPIC-038`'s `letterVector` for a fixed corpus (copied into the test as expected values, with its source cited), and **not** semantic (`FR-HUB-086`) — **Done**: `fixture/tests/embed.spec.ts` — the T2123 suite incl. CC-11, CC-12 and CC-13 (the expected vectors copied from `EPIC-038`'s `letterVector` with the source cited; car/arc/automobile shows it is not semantic) plus four cases; observed failing (no export) first.
- [X] T2195 [US7] Implement `packages/capability-adapters/fixture/src/embed.fixture.ts` (unit test: T2194) — **Done**: `fixture/src/embed.fixture.ts` — 27-dimension letter bag, model `fixture-letters`, version from the scripted `modelDigest`.
- [X] T2196 [P] [US7] Record dated Ollama responses in `packages/capability-adapters/ollama/tests/recordings/` and write failing tests in `packages/capability-adapters/ollama/tests/conformance.spec.ts` — `POST /api/embed` with a batch `input`; the dimension comes from the adapter's model table and an unlisted model is refused at binding; the version is the `GET /api/tags` digest and a changed digest changes the version (CC-12); a missing model is `unhealthy: model-not-present`; an optional `bearer-token` credential is sent only when bound (`R-039-18`) — **Done**: three dated recordings (`2026-10-10.ollama-embed.json`, `…new-digest.json`, `…model-absent.json`), constructed from the Ollama documentation (Context7 `/ollama/ollama`) — Ollama is not installed here; the 768 vector components are synthetic (seeded, L2-normalised) and the provenance says so; `tests/embed-replay.ts` answers any batch from them. `ollama/tests/conformance.spec.ts` (suite incl. CC-09, CC-11, CC-12 + 9 specifics), observed failing (no module) first.
- [X] T2197 [US7] Implement `packages/capability-adapters/ollama/src/{embed,health,models,descriptor}.ts` and add `ollama-embed` and `fixture-embed` to the composition file (unit test: T2196) — **Done**: `ollama/src/{models,descriptor,embed,health,index}.ts` — model table (768/384/1024), the digest from `/api/tags` as version, `model-not-present`, bearer only when bound; `ollama-embed` and `fixture-embed` added to the composition file.
- [X] T2198 [P] [US7] Write failing unit tests in `packages/capability-adapters/ollama/tests/embedding-module.spec.ts` — the default export returns an object satisfying `EPIC-038`'s `EmbeddingPort` shape (`modelId`, `dimension`, `embed(texts)`) over the Ollama adapter, applying the same refusals as `embedChecked` (`R-039-18` Decision 4) — **Done**: `ollama/tests/embedding-module.spec.ts` 7 cases over the recordings — the default export's shape from `PMI_EMBED_BINDING`, the limits before sending, the four `embedChecked` refusals, a fault never returns vectors; observed failing (no module) first.
- [X] T2199 [US7] Implement `packages/capability-adapters/ollama/src/embedding-module.ts` and export it as `@pmi/capability-adapter-ollama/embedding-module` — the module `EPIC-038`'s `CONTEXT_EMBEDDING_MODULE` names for `T1282` (unit test: T2198) — **Done**: `ollama/src/embedding-module.ts`, exported as `@pmi/capability-adapter-ollama/embedding-module` (the `package.json` export already named it) — `createOllamaEmbeddingPort` and the default export; `modelId` gains the digest after the first call.
- [X] T2200 [P] [US7] Write failing unit tests in `backend/tests/unit/integrations-deployment-binding.spec.ts` — **(I1, rewritten 2026-10-10)** the binding is read **at boot** from `PMI_EMBED_ADAPTER`/`PMI_EMBED_BINDING`: unset → unbound; an unknown key, an adapter not implementing `Embed`, an unlisted model or secret-looking binding → bound-but-ineligible with the reason named, never a guessed dimension; records `observedModel` and `modelId`; appends a `deployment_capability_bindings` row only when the observation differs from the latest, with `reindexRequired: true` when `modelId` changed; there is **no** write method a route or a workspace grant could reach (`FR-HUB-084`, `US7` AS4) — **Done**: `integrations-deployment-binding.spec.ts` 12 cases, observed failing (no service) first; one failure after implementing was a real defect in the in-memory store — `latestObservation` broke a tie at one instant toward the OLDER row; fixed so the later append wins, as `createdAt` does in PostgreSQL.
- [X] T2201 [US7] Implement `backend/src/modules/integrations/embedding/{deployment-binding.service.ts,deployment.controller.ts}` per API contract §4a — boot observation and the one **read** route `GET /integrations/deployment/capabilities` (unit test: T2200) — **Done**: `embedding/deployment-binding.service.ts` (boot observation, in-memory snapshot, append-on-change, `recheck` on the health tick, no write method) and `embedding/deployment.controller.ts` (`GET /integrations/deployment/capabilities`, read only); `observeAtBoot` awaited in `IntegrationsModule.onModuleInit`.
- [X] T2202 [P] [US7] Write failing unit tests in `backend/tests/unit/integrations-hub-embedding-port.spec.ts` — `HubEmbeddingPort` implements the interface `modelId`/`dimension`/`embed(texts)` **unchanged**; `modelId` and `dimension` come from the boot binding snapshot synchronously; each `embed()` is one deployment-scope resolution (no workspace) recording `modelIdentity`; 65 texts → `batch-too-large`, 8,001 characters → `text-too-long` naming the index; unbound or ineligible → `GovernanceSeamUnboundError` whose message names `EmbeddingPort` and carries the Hub's explanation; an adapter fault never returns vectors (`FR-HUB-080`–`FR-HUB-085`, `FR-HUB-087`) — **Done**: `integrations-hub-embedding-port.spec.ts` 8 cases — a type-level `EmbeddingPort` assignment, `embedChecked` accepting the result and the vectors equal to `letterVector`, one deployment resolution and invocation per call with `modelIdentity`, the two limit refusals, unbound/ineligible 503 naming `EmbeddingPort` with the reason, faults never returning vectors. Written before the implementation; observed failing (module absent) by moving the implementation aside, then green.
- [X] T2203 [US7] Implement `backend/src/modules/integrations/embedding/hub-embedding-port.ts` and export it from `IntegrationsModule` (unit test: T2202) — the binding into `EPIC-038`'s `ContextModule` is `T2218`, blocked — **Done**: `embedding/hub-embedding-port.ts` — `modelId`/`dimension` from the boot snapshot, resolution through `evaluateCandidates` with policy *not applicable* (a reason), a model version changed since boot refused as `adapter-fault`; composed as `hub.embedding` and exported from `IntegrationsModule` as the `HubEmbeddingPort` provider. Store gains `listDeploymentResolutions` (both stores).
- [X] T2204 [P] [US7] Write failing route tests in `backend/tests/integration/integrations-deployment-route.spec.ts` against `AppModule` — **(I1)** boot with `PMI_EMBED_ADAPTER=fixture-embed`, read `GET /integrations/deployment/capabilities`; reboot against the same database with `ollama-embed` (recordings served by a local test server, never the network) and observe a new recorded row with `reindexRequired: true`; reboot unchanged and observe no new row; `PUT`/`DELETE` on `/integrations/deployment/capabilities/Embed` and any `/integrations/deployment/credentials/*` route answer `404` (no such route) (quickstart Q21) — **Done**: `integrations-deployment-route.spec.ts` 5/5 against `AppModule` (three boots on one database: `fixture-embed`, then `ollama-embed` over a loopback replay, then unchanged), observed failing first (3 of 5).
- [X] T2205 [US7] Make T2204 green (integration test: T2204) — **Done**: two defects found by T2204 and fixed: (1) the read route answered `404` to the workspace creator because the registry's first-read seeding (which grants the creator) was not run — the deployment read now shares `RegistryService.ensureSeeded`; (2) an unchanged reboot appended a row because PostgreSQL's `jsonb` reorders keys — the binding is now compared in a canonical (sorted-key) rendering.

**Checkpoint**: `EmbeddingPort` has an owner whose binding is one line away, waiting only on `EPIC-038`'s merge.

---

## Phase 10: User Story 8 — A reviewer sees what the platform is connected to and whether it is healthy (Priority: P3)

**Goal**: the view-only Integrations screen, reachable from the shell.

**Independent test**: quickstart Q22 (Tier 2).

- [X] T2206 [P] [US8] Write failing component tests in `frontend/tests/unit/pages/integrations.spec.tsx` — the list shows name, direction, transport, capabilities, version, health and configuration status, with a filter (direction, health, capability, text); an opened entry shows health history and recent resolutions with each refusal's per-candidate explanation inline (`UX-0032`); health states and *not applicable* fields have distinct styles and `aria-label`s and never rely on colour alone (`UX-0031`); there is **no** `button`, `input`, `select`, `textarea` or `form` other than the filter and disclosure toggles, and the text *"Configuration is through the API"* is present (`FR-HUB-074`); no cell renders a credential value; readable at 360px (`UX-0040`) (`FR-HUB-071`–`FR-HUB-075`)
 — **Done**: `frontend/tests/unit/pages/integrations.spec.tsx` 7/7. Written by the interrupted run of 2026-10-10 (committed as left in `f8b2983`); its red-before-green was not recorded then, so it was observed failing on 2026-10-11 with `Integrations.tsx` moved aside (the import does not resolve), then restored and green.
- [X] T2207 [US8] Implement `frontend/src/pages/Integrations.tsx` and `frontend/src/services/integrations.client.ts` (read functions only) (unit test: T2206)
 — **Done**: `frontend/src/pages/Integrations.tsx` (lists, not tables; filter and disclosure toggles the only controls; *"Configuration is through the API"*) and `frontend/src/services/integrations.client.ts` (`listRegistry`, `entryDetail` — GET only).
- [X] T2208 [P] [US8] Update the failing shell tests in `frontend/tests/unit/shell/areas.spec.ts` and `frontend/tests/unit/shell/Navigation.spec.tsx` for `integrations` delivered under `EPIC-039`, and a test that the page imports no write function from any client
 — **Done**: `areas.spec.ts` and `Navigation.spec.tsx` expect 10 delivered / 2 partly / 6 owed / 0 undeclared and 12 destinations; the read-only case asserts the page imports only types from a client and the client has no write verb. Observed red (five assertions) before `T2209`. One expectation the interrupted run left stale (the seventeen-prototype count body still read 8 / 2 / 7 / 0 under a 9 / 2 / 6 / 0 title) corrected.
- [X] T2209 [US8] Add `IntegrationsArea` to `frontend/src/shell/area-views.tsx`, then set `integrations` in `frontend/src/shell/areas.ts` to `element: IntegrationsArea` and `status: 'delivered'` — element first, status second — and update the area counts in `specs/036-application-shell/` (unit test: T2208)
 — **Done**: `IntegrationsArea` in `area-views.tsx` (a `<main>` landmark around `IntegrationsPage`, scoped by the shell's selected project), then `integrations` → `delivered` with `element: IntegrationsArea` in `areas.ts`. `specs/036-application-shell/` counts updated to 10 / 2 / 6 / 0 with an *Updated 2026-10-11 (EPIC-039 `T2209`)* note in each count-bearing document, and `/integrations` added to the contract's route table; `T442t` green. Whole `frontend` project 104 files / 1,194 tests green.
- [X] T2210 [P] [US8] Write a failing route test in `backend/tests/integration/integrations-access.spec.ts` — a reader without `EPIC-024` read on `integration-registry` gets `404` from every registry route (`FR-HUB-076`)
 — **Done**: `backend/tests/integration/integrations-access.spec.ts` 11/11 against `AppModule` — the owner control (200 on the six reads), then a workspace member without the grant gets `404` from all eight registry routes (list, list with project, entry, vocabulary, one contract version, the deployment binding, register, retire) with the unknown-entry body, nothing changed, and a read grant through `POST /artifacts/integration-registry/:ws/grants` opens the reads and not the writes. The routes predate the test, so red was observed by mutation: `requireReadable` made a no-op in `integrations.module.ts` → 6 of 11 failed (each read route); reverted; green.

**Checkpoint**: the journey exists end to end on this branch.

---

## Phase 11: Dependency adapters — **BLOCKED until `EPIC-031`, `EPIC-032` and `EPIC-038` merge**

### `EPIC-031` — policy

- [X] T2211 [P] Write failing unit tests in `backend/tests/unit/integrations-adapter-policy.spec.ts` — configuration calls `DecisionEngine.decide` with `actionType: 'integration.adapter.use.<Capability>'`, target `{ type: 'project-capability-configuration', id }`, `objectVersion: String(configVersion)`, `requiredGates: []`; status is read through `resolutionOf` and maps `approved`/`auto-executed` → permitted, `pending` → `policy-pending`, `refused` → `policy-not-permitted`; the decision's `Explanation` is embedded verbatim (`R-039-7`)
 — **Done** (unblocked: `EPIC-031` is on `main`): `backend/tests/unit/integrations-adapter-policy.spec.ts` 10/10 — the `decide` request of `R-039-7` (no proposed class; owner as actor and requester), the four outcome mappings, the resolving decision followed and a later refusal taking effect on the next read, the deciding row's `Explanation` verbatim, a lost decision a fault, `exception` never permitted. Observed failing (module absent) before `T2212`.
- [X] T2212 Implement `backend/src/modules/integrations/policy/capability-policy.adapter.ts` and bind it in `integrations.module.ts` (unit test: T2211)
 — **Done**: `policy/capability-policy.adapter.ts` (`decisionCapabilityPolicy`, on `EPIC-047`'s `decisions.adapter.ts` pattern) bound into `CapabilityPolicySeam` in `integrations.module.ts`, which now imports `DecisionModule` (`DecisionEngine`, `DECISION_REPOSITORY`). `CAPABILITY_PORTS` and the tokens table updated. `T2149`'s *unbound → 503* case no longer describes the module, so it was rewritten against the real binding: a configuration `PUT` records one `policy_decisions` row (`integration.adapter.use.ReadRepository`, `objectVersion '1'`, no gates, band `high`, outcome `pending` — no rule classifies it, `FR-DPE-004`) and a request is refused `policy-pending` without a second decision; observed failing with the `bind` removed (2 of 13), green with it (13/13).
- [ ] T2213 [P] **OPEN — needs the Project Owner (or `EPIC-031`'s owner)** Add the default classification rules `integration.adapter.use.Read*` → `low` and `integration.adapter.use.SendNotification` → `high` to `packages/decision-contract/classification-rules/organization-default.json`, asserted in that package's own suite by a new case in `packages/decision-contract/tests/classification-rules.spec.ts` (P1) (`R-039-7`) — an additive edit to another Epic's package, recorded in its suite
 — **Not done (2026-10-11), and why**: unblocked by the merge, but it cannot be done as written without overriding a decision `EPIC-031` recorded. (1) `organization-default.json`'s own `$comment` states that it *"declares only what is high under every tenant policy … authoring a low band means auto-executing an action without a human, which is a tenant's decision, not a shipped default"* — `Read*` → `low` is exactly such a shipped default. (2) `EPIC-031`'s conformance check (`backend/tests/architecture/classification-rules-conformance.spec.ts`, `T733`) admits only lowercase dotted patterns with an optional trailing `.*`, so neither `integration.adapter.use.Read*` nor a PascalCase exact action is a well-formed rule; the action type would have to change shape (e.g. `integration.adapter.use.read-repository`), which `R-039-7` fixes. (3) `SendNotification` → `high` adds nothing: an unmatched action is already `high`. **Effect while open**: every adapter configuration is `high` and waits for a person in the Decision Inbox — the outcome `R-039-7` calls *correct, slower*, asserted by `T2149`/`T2212`. **Decision needed**: whether a shipped low band for the read capabilities is acceptable (and in which action-type spelling), or whether it stays a tenant-authored rule.

### `EPIC-032` — evidence

- [X] T2214 [P] Write failing unit tests in `backend/tests/unit/integrations-adapter-evidence.spec.ts` — the `AttestationSource` binding authorises `pmi-adapter:<key>` for an active outbound entry of the workspace with the catalog version and returns `null` otherwise; `EvidenceSink` calls `EvidenceService.contribute` with the body of `R-039-11`; a store fault propagates as a refusal, never as success (`FR-HUB-051`, `FR-HUB-052`)
 — **Done** (unblocked: `EPIC-032` is on `main`): `backend/tests/unit/integrations-adapter-evidence.spec.ts` 15/15, observed failing (modules absent) first — `pmi-adapter:<key>` authorised only for an active outbound entry of that workspace in this build, at the catalog version (seven `null` cases); `bindingExists` through `CompletionGate.evaluate`, an unevaluable binding a refusal rather than *no binding*; `contribute` with the `R-039-11` body, no `reference`, the binding's subject when the intake named none, and faults propagated.
- [X] T2215 Implement `backend/src/modules/integrations/evidence/{attestation-source.adapter.ts,evidence-sink.adapter.ts}`, bind `EVIDENCE_ATTESTATION_SOURCE` and `EvidenceSink`, and change `AttestationSource`'s `filledBy` to `EPIC-039` in `packages/evidence-contract/src/ports.ts` (unit test: T2214) — closes the `DEF-032-004` residual by contributing inline predicates only
 — **Done**: `evidence/attestation-source.adapter.ts` (`hubAttestationSource`) and `evidence/evidence-sink.adapter.ts` (`evidenceServiceSink`); `EvidenceSinkSeam` bound in `integrations.module.ts` (which imports `EvidenceModule`), and `EVIDENCE_ATTESTATION_SOURCE` bound in `EPIC-032`'s `evidence.module.ts` to the Hub's exported `INTEGRATIONS_ATTESTATION_SOURCE` (`hub.token.ts`) — the two modules import each other through `forwardRef`; the providers do not cycle. `EVIDENCE_PORTS`' `AttestationSource.filledBy` is now `EPIC-039` (its own `ports.spec.ts` case updated first and observed failing). Inline predicates only: `DEF-032-004`'s residual closed. Mutations: the sink unbound → 3 of 12 intake cases fail; the source `null` → 3 of 12 fail.
- [X] T2216 Extend `backend/tests/integration/integrations-evidence-intake.spec.ts` with quickstart Q17 end to end: a bound task's test-result item moves unmet → met at `CompletionGate.evaluate` from fixture results alone, in every run (`SC-HUB-006`); state in the test that this is not a loop transition (`DEF-032-006`)
 — **Done**: `integrations-evidence-intake.spec.ts` 12/12 against `AppModule` — Q17 end to end: a task bound to `task-completion` reads `tests-pass` unmet; the intake job resolves `ReadTestResults` through `fixture-ci` and contributes an inline test-result Statement recorded as `pmi-adapter:fixture-ci` at `0.1.0`, `stored`; `GET /evidence/task:tk_q17/unmet` then reads only `reviewed` (`SC-HUB-006`). The test states it is not a loop transition (`DEF-032-006`). `T2185`'s *unbound → refused* case rewritten for the bound module: unbound work is `not-contributed / no-binding` with no resolution made. `EPIC-032`'s own `evidence-*` integration files still 40/40 with the cross-module binding.

### `EPIC-038` — `EmbeddingPort` (discharges `EPIC-038` `T1282`, `T1301`)

- [X] T2217 [P] Write the failing route test `backend/tests/integration/integrations-embed-context.spec.ts` against `AppModule` — with `Embed` bound to `fixture-embed`, `POST /context/index/reindex` and `POST /context/packages` answer without the `503` naming `EmbeddingPort`; unbound, they answer it with the Hub's explanation in the message; in **100%** of runs (`SC-HUB-009`, quickstart Q19)
 — **Done** (unblocked: `EPIC-038` retrieval is on `main`): `backend/tests/integration/integrations-embed-context.spec.ts` 6/6 against `AppModule` — bound to `fixture-embed`, a real requirement is reindexed (index health names `fixture-embed:fixture-letters@sha256:fixture-letters-1`), `POST /context/packages` answers `201` with that model on the package, and each `embed()` is a recorded deployment-scope resolution; rebooted on the same database without `PMI_EMBED_ADAPTER`, both routes answer `503` naming `EmbeddingPort` with the Hub's explanation, still *refusing rather than degrading*. Observed failing before `T2218` (3 of the bound cases: `503` from the `null` port). Run three times, 6/6 each — deterministic, no clock or network (`SC-HUB-009`'s *100% of runs* for the fixture).
- [X] T2218 Bind `EMBEDDING_PORT` in `backend/src/modules/context/context.module.ts` to `HubEmbeddingPort` (replacing the `null` passed to `IndexService` and `SearchService`) by importing `IntegrationsModule` — **no change to `EmbeddingPort`'s shape**; and update `EPIC-038`'s `CONTEXT_PORTS` entry `filledBy` to `EPIC-039 (Integration Hub, Embed)` (integration test: T2217) — if the binding proves to need a shape change, stop and record a defect in `specs/038-engineering-context/defects/` instead (`FR-HUB-087`)
 — **Done**: `ContextModule` imports `IntegrationsModule` and binds `EMBEDDING_PORT` to the exported `INTEGRATIONS_EMBEDDING_PORT` (`useExisting: HubEmbeddingPort`), passing it — not `null` — to `IndexService` and `SearchService`. **No change to `EmbeddingPort`'s shape.** `CONTEXT_PORTS` `EmbeddingPort.filledBy` = `EPIC-039 (Integration Hub, Embed)` (`context-ports.spec.ts` updated). Two consequences recorded in `EPIC-038`'s own tests: index health reports no model while the Hub's port has dimension 0 (rather than the placeholder `unbound`), and `T1278`'s *503 for an indexable source* now needs a source that exists, because the source is read before the port refuses. The Hub's refusal message carries `EPIC-038`'s *unranked … not degraded* sentence. All 12 `context-*` integration files 144/144 (+ `T1282` skipped).
- [X] T2219 [P] Add a case to `backend/tests/architecture/context-independence.spec.ts` (`EPIC-038`'s) that the context module names no Embed adapter or provider and depends only on `HubEmbeddingPort` through the integrations module's export
 — **Done**: four `T2219` cases in `context-independence.spec.ts` — no Embed adapter, provider or adapter package named in the context module; from `integrations/` only `integrations.module.js` and `hub.token.js`, only in `context.module.ts`; `EMBEDDING_PORT` bound to the Hub token and never `null` into the index or search; the checks shown to fire.
- [ ] T2220 **NOT RUN — no Ollama** Run `EPIC-038`'s `backend/tests/integration/context-relevance.spec.ts` with `CONTEXT_EMBEDDING_MODULE` set to the T2199 module against Ollama serving `nomic-embed-text` — record in `specs/039-integration-hub/quickstart-results.md` that `T1282` **ran** and its observed result, pass or fail; in CI it stays skipped and is reported as such (quickstart Q20, `SC-HUB-009`)
 — **Not done (2026-10-16), and why**: the binding it needed exists (`T2218`) and the module it names exists (`T2199`), but no Ollama server is reachable on this machine (`GET http://localhost:11434/api/tags` → no connection, checked 2026-10-11 and 2026-10-16), so `EPIC-038`'s `context-relevance.spec.ts` (`T1282`) was **not run** and stays skipped — never reported as passed. No `quickstart-results.md` was written, since it would record a run that did not happen. To discharge: `ollama pull nomic-embed-text`, then `CONTEXT_EMBEDDING_MODULE=<abs path to packages/capability-adapters/ollama/dist or src>/embedding-module` with `PMI_EMBED_BINDING={"model":"nomic-embed-text"}` and run that file.
- [X] T2221 Record in `specs/038-engineering-context/tasks.md` (as a note under `T1282` and `T1301`, not a tick) that both are dischargeable through `EPIC-039`'s binding, citing `T2217`–`T2220`; the ticks belong to `EPIC-038`'s own run
 — **Done**: notes (not ticks) under `T1282` and `T1301` in `specs/038-engineering-context/tasks.md` — both dischargeable through `EPIC-039`'s binding, citing `T2217`–`T2219`; `T1282` not run (`T2220`), `T1301` not run, so `T1294` stays red.

**Checkpoint**: each seam this Epic declared refusing is bound to its owner, and `EPIC-038` stops answering `503`.

---

## Phase 12: Polish & cross-cutting

- [X] T2222 [P] Write the failing performance test `backend/tests/integration/integrations-performance.spec.ts` — resolution p95 < 40 ms; request overhead p95 < 120 ms excluding provider time; `embed()` overhead p95 < 15 ms; JUnit parse < 2 s at 20,000 cases; registry read p95 < 250 ms at 50 entries; entry detail p95 < 350 ms; 50 iterations; a 25% miss **reports**, does not block (`R-039-15`, `R-039-18`)
 — **Done**: `backend/tests/integration/integrations-performance.spec.ts` 6/6 against `AppModule` (50 iterations after 5 warm-up; a p95 within 25 % over target is reported, beyond it fails). Measured 2026-10-16 on the shared developer machine: resolution **20.1 ms** (< 40), request overhead **30.5 ms** (< 120; an upper bound — the fixture's provider time is ~0), `embed()` **10.4 ms** (< 15), JUnit parse at 20,000 cases **247 ms** (< 2 s; one run), registry read at 50 entries **144 ms** (< 250), entry detail with 100 health rows and ≥ 50 resolutions **53.8 ms** (< 350). Not observed red: it measures code already built, and every figure met its target on the first run.
- [X] T2223 [P] Write `backend/tests/integration/integrations-embed-latency.live.spec.ts`, skipped unless Ollama is reachable — single-query embed p95 < 150 ms warm; a 32 × 1,000-character batch p95 < 2.5 s; results recorded, never asserted in CI
 — **Written, not run**: `backend/tests/integration/integrations-embed-latency.live.spec.ts` — skipped unless `PMI_OLLAMA_URL` (default `localhost:11434`) answers and serves `nomic-embed-text`; figures printed, never asserted beyond shape. On this machine it reports **2 skipped** (no Ollama), which is not a pass.
- [X] T2224 [P] Write failing unit tests in `backend/tests/unit/integrations-boot.spec.ts` — the module refuses to start without `PMI_ENVIRONMENT`, naming it; refuses an unknown value (`R-039-8`)
 — **Done**: `integrations-boot.spec.ts`.
- [X] T2225 Implement the boot check in `backend/src/modules/integrations/integrations.module.ts` (unit test: T2224)
 — **Done**: `resolvePlatformEnvironment` in `integrations.module.ts`; `PMI_ENVIRONMENT=local` and `PMI_INTEGRATION_SCHEDULER=off` set for the backend vitest projects.
- [X] T2226 [P] Write failing unit tests in `backend/tests/unit/integrations-version-change.spec.ts` — at boot, a catalog version differing from the last observed one writes an audit `update` by `system:catalog` with before/after (`FR-HUB-025`)
 — **Done**: `backend/tests/unit/integrations-version-change.spec.ts` 5/5, observed failing (`observeCatalogVersions is not a function`) first — a different version writes one `update` by `system:catalog` with before/after; same version, first sighting, retired, inbound or not-in-build entries write nothing; an unreadable store does not abort boot (`DEF-039-001`'s lesson).
- [X] T2227 Implement version-change detection in `backend/src/modules/integrations/catalog.service.ts` (unit test: T2226)
 — **Done**: `observeCatalogVersions` and `CATALOG_ACTOR` in `catalog.service.ts`; run from `IntegrationsModule.onModuleInit` under `DATABASE_URL`, reading the last `after.version` the audit trail recorded for each entry (the registration's, or the last `system:catalog` change — data-model §2). Through `AppModule`: a new `T2227` case in `integrations-registry-route.spec.ts` (14/14) records an older observed version, reboots on the same database and finds exactly one `system:catalog` update 0.0.9 → 0.1.0, and none on a second reboot; observed failing with the boot call removed.
- [X] T2228 Record the `SC-HUB-001` mutation proof in `specs/039-integration-hub/mutation-proofs.md` — (a) `const PROVIDER = 'github';` in `resolver/resolver.service.ts`, (b) an adapter import in `backend/src/modules/loop/loop.service.ts`; `capability-independence.spec.ts` observed failing naming file and line for each; reverted; green — on the `specs/034-change-room/mutation-proofs.md` template, written at the moment of observation — **Done**: recorded in `mutation-proofs.md` (both mutations failed `capability-independence.spec.ts` naming file and line; reverted; green).
- [X] T2229 Record the `SC-HUB-004` mutation proof in `specs/039-integration-hub/mutation-proofs.md` — `credential.service.ts → status()` made to return the decrypted value; `integrations-credential-canary.spec.ts` observed failing with each failing test named; reverted; green — **Done**: recorded in `mutation-proofs.md` (`status()` returning the value failed the canary suite on the credentials GET; reverted; green).
- [X] T2230 [P] Write `backend/tests/architecture/integrations-mutation-proofs.spec.ts` — `mutation-proofs.md` records both proofs with a mutation, named failing tests and a revert, and names the files T2228/T2229 changed
 — **Done**: `backend/tests/architecture/integrations-mutation-proofs.spec.ts` 9/9 — each section names its criterion, an applied mutation, an observed failure with a count and named failing tests, and a revert observed green; the mutated files (`resolver.service.ts`, `loop.service.ts`, `credential.service.ts`) still exist; every named failing test's title is still in the check it came from. Six broken-copy cases (section, revert, observation removed; a file renamed away; a test title renamed; a file deleted) are each flagged. First run red on a parser defect (a bullet joined to the line before it), fixed in the test.
- [ ] T2231 [P] Live caller-level run (quickstart Q23) against a real GitHub App installation and a Resend sending-only key — recorded in `specs/039-integration-hub/quickstart-results.md`, opt-in, never in CI

---

## Phase Z: Closure

- [X] T2232 Write the Tier 2 Playwright walk `e2e/tests/epic-039-m1.spec.ts` (setup through the API; navigation → Integrations → `pmi-studio` first → unhealthy reason → refused resolution's explanation → no configuration control → 360 px; credentials as placeholders; asserts no `pmi_ct_` or canary in the transcript) and its conformance check `tests/governance/epic039-transcript.spec.ts` (`skipIf` absent, stating its honest limit) — `R-039-16`. (D1) **Includes `T2240`'s step**: the walk's final step records `SC-HUB-007`'s reviewer question and the answer read from the screen alone
 — **Done (written; not run — `T2233`)**: `e2e/tests/epic-039-m1.spec.ts` (setup through the API — a project, `fixture-ci` registered and configured scripted unhealthy, one refused request; then navigation → Integrations → `pmi-studio` first → *unhealthy — provider-unreachable* → the refused resolution's per-candidate list → no configuration control and the *through the API* note → 360 px with no horizontal scroll → `SC-HUB-007`'s question and the answer read from the screen; asserts no `pmi_ct_` or `pmi-canary-` before writing `docs/uat/EPIC-039-m1-transcript.md`). Loads under Playwright (`--list`: 1 test). Conformance check `tests/governance/epic039-transcript.spec.ts`: skipped while the transcript is absent, as `R-039-16` decided (no known-red added), with eight planted cases passing — a generated transcript passes; a hand-written summary, no stack, too few steps, a missing stage, a repeated instant, out-of-order instants and a connector credential are each flagged. Its honest limit is stated in the file.
- [ ] T2233 Run T2232 against the reference-local stack so it **writes** `docs/uat/EPIC-039-m1-transcript.md` — Constitution XI Tier 2; **blocks closure**; never hand-written; if no stack is available the Epic does not close
- [ ] T2234 Run `/speckit-converge` for `EPIC-039`; every remaining item is built or deferred to a named Epic (Constitution IV)
- [ ] T2235 Run the suites this Epic touches, each on its own: `capability-contract`, `capability-adapters`, `backend-unit` and `architecture` filtered to `integrations-` and `capability-`, `backend-integration` `integrations-` (`--no-file-parallelism`), `frontend` `integrations`, `governance`, `execution-registry-contract`; then the full suite once, when the machine is free — every result reported as observed, a skipped suite never as passed
- [ ] T2236 Confirm `specs/039-integration-hub/defects/` has no open record (Constitution VI)
- [X] T2237 Update the PMI-DOC-004 §6.13 owner annotations for `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125` and `BR-0126` to `EPIC-039` in `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md`, asserted by `tests/governance/epic039-brs-owners.spec.ts` (P1) — **requires the Project Owner's sign-off** (Constitution II; spec Exit Criteria)
 — **Done, on the Project Owner's instruction**: the sign-off is the Project Owner's instruction *"finish EPIC-039 and EPIC-048 and merge their PRs"* (2026-10-11), treated as authorising this SRS edit; recorded in `closure.md` and the commit. `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125` (were *no owner*) and `BR-0126` (was `EPIC-028`) now read *owner **EPIC-039** (reassigned 2026-10-16 on the Project Owner's instruction of 2026-10-11)* — `BR-0126` keeps a note that `EPIC-028`'s agent seam still evidences the AI-provider half (`FR-HUB-063`). `tests/governance/epic039-brs-owners.spec.ts` 7/7, observed failing (5 of 7) before the edit; `BR-0122`/`BR-0124` asserted unchanged.
- [ ] T2238 Write the closing report `specs/039-integration-hub/closure.md` — work completed; work deferred (`PP-019` → `EPIC-040`; `FR-HUB-064` observability portability; hosted `Embed`; webhooks); (C5) `FR-HUB-063` evidenced by **citing `EPIC-028`'s agent seam** (`@pmi/agent-contract`, `agent-independence.spec.ts`, `BR-0103`), not rebuilt; unverifiable-until-merge items (`SC-HUB-006`, `SC-HUB-008` timing, `SC-HUB-009`); findings for other Epics (`EPIC-025`'s `MarkerTokenCipher`); new deployment variables; `EPIC-038` `T1282`/`T1301` now dischargeable; analysis I2/I3 named; the recommended next command — then `pnpm register:update`
- [ ] T2239 Refresh the PMI Studio Delivery Board at its existing artifact URL, or declare it stale in the closing report naming the delta (Constitution IX)
- [ ] T2240 ~~Add `SC-HUB-007`'s reviewer question to the Tier 2 transcript's final step and confirm in `closure.md` that it was answered from the screen alone~~ — **folded into `T2232`** (analysis D1, 2026-10-10); closed when `T2232`/`T2233` close
- [ ] T2241 Record the Constitution XI Tier 1 matrix (capability → entry point → test → observed result) in `closure.md`, with the after-merge rows marked as such

---

## Analysis remediation (2026-10-10) — `T2242`–`T2249`

Each slots into the phase named; the phase's checkpoint is not reached without it.

- [X] T2242 [P] [US1] (U1, Phase 3) Write failing unit tests in `backend/tests/unit/integrations-callers.spec.ts` — `acceptsOverHttp(caller)` is true for exactly `room:requirement`, `room:change`, `room:defect`; the in-process `CapabilityRequests` service accepts every `PLATFORM_CALLERS` member; a route body naming `loop`, `context-assembly`, `evidence-intake` or `notification-dispatch` is refused `caller-not-platform`, recorded as a resolution, and nothing is invoked
 — **Done**: `integrations-callers.spec.ts`.
- [X] T2243 [US1] (U1, Phase 3) Implement the HTTP caller rule in `backend/src/modules/integrations/requests/capability-requests.service.ts` (`requestOverHttp`) and use it from the controller (unit test: T2242)
 — **Done**: U1 rule in `capability-requests.service.ts` (`acceptsOverHttp`).
- [X] T2244 [P] [US3] (U2, Phases 2 and 5) Add the lease cases to `T2124` and `T2168`; the implementation is carried by `T2125` (the `source`/`intervalBucket` columns and the partial unique index `integration_health_checks_scheduled_lease`) and `T2169` (the scheduler inserts after the check with `ON CONFLICT DO NOTHING`)
 — **Done**: lease cases in `integrations-constraints.spec.ts` and `integrations-store.spec.ts`; partial unique index `integration_health_checks_scheduled_lease`.
- [X] T2245 [US3] (U2, Phase 5) Implement the store method `recordScheduledCheck` returning whether this instance's row was recorded, in both stores (unit test: T2168; integration test: T2124)
 — **Done**: `recordScheduledCheck` in both stores; used by `runDueHealthChecks`.
- [X] T2246 [P] (C1, Phase 2) Extend `packages/capability-contract/tests/capabilities-conformance.spec.ts` — every seeded row's `createdBy` names its file (`git:packages/capability-contract/capabilities/<file>`), and every file under `capabilities/` is tracked by Git (`git ls-files --error-unmatch`), so `FR-HUB-015`'s record is the reviewed Git history (data-model §1)
 — **Done**: Git-history cases in `capabilities-conformance.spec.ts` (green once the files were committed).
- [X] T2247 (C4, Phase 1, **before `T2102`**) Add register rows for `fast-xml-parser` and `fflate` to `specs/_shared/dependencies.md` and extend `tests/governance/dependency-register.spec.ts` to govern `packages/capability-adapters/*` as well as `frontend`/`backend`/`worker` — observed failing before the rows exist (`TS-001`)
 — **Done**: D-33 fflate, D-34 fast-xml-parser added to the register; `dependency-register.spec.ts` now discovers `packages/capability-adapters/*` and was observed failing before the rows existed. The EPIC-046 `T1694` 'register ends at D-32' assertion was narrowed to its intent (no EPIC-046 row).
- [X] T2248 [P] [US4] (C2, Phase 6) Write the timed route test `backend/tests/integration/integrations-time-to-first-resolution.spec.ts` against `AppModule` — the owner `PUT`s a configuration and a credential; the immediate health check is recorded; the next request resolves to the new adapter; the recorded instants show credential-set → first eligible resolution **< 60 s** and the whole owner path **< 5 minutes** (`SC-HUB-008`, `R-039-15`) — with the in-test `CapabilityPolicy` binding, since `EPIC-031` approval is the human part — **Done**: `integrations-time-to-first-resolution.spec.ts` 1/1 against `AppModule` — `github-rest` over loopback recordings; refused `credential-missing` before, resolved after the credential `PUT` with no tick; instants read from the database (credential `setAt`, the `credential-set` health row, the first `resolved` resolution, the registration): observed ≈0.5 s end to end against the < 60 s / < 5 min targets. Observed failing first on a mixed-clock comparison (test defect, fixed to read every instant from one source).
- [X] T2249 [P] [US7] (C3, Phase 9) Write the `Embed` caller-level suite `backend/tests/unit/integrations-embed-caller-suite.spec.ts` — one suite run twice through `HubEmbeddingPort`, once bound to `fixture-embed` and once to `ollama-embed` over recordings: the same shapes, the same limit refusals, `modelIdentity` recorded on every resolution, and the port's `modelId`/`dimension` taken from each binding (`SC-HUB-001` for `Embed`) — **Done**: `integrations-embed-caller-suite.spec.ts` — one suite through `HubEmbeddingPort` and `embedChecked`, run against `fixture-embed` and `ollama-embed` (recordings): same shapes, same limit refusals, `modelIdentity` on every resolution, `modelId`/`dimension` from each binding. Green at first run: it exercises `T2195`–`T2203`, already landed.

---

## Dependencies & execution order

- **Phase 1 → Phase 2 → stories.** Phase 2 blocks everything.
- **US1 (Phase 3)** needs Phase 2 only, and is the MVP.
- **US2 (Phase 4)** needs US1 (the route and resolver it runs through).
- **US3 (Phase 5)** needs Phase 2; its health work feeds US1's eligibility but US1 is testable with scripted fixture health.
- **US4 (Phase 6)** needs US1 (resolution) and US3 (health scheduling on credential set).
- **US5 (Phase 7)** needs US1; its end-to-end proof is Phase 11 (`EPIC-032`).
- **US6 (Phase 8)** needs US1 and US4 (Resend scope narrowing).
- **US7 (Phase 9)** needs Phase 2 and US1's output validation (T2146); its `EPIC-038` binding is Phase 11.
- **US8 (Phase 10)** needs US3 (the registry reads) and data from US1.
- **Phase 11** needs the merges; `T2211`–`T2213` on `EPIC-031`, `T2214`–`T2216` on `EPIC-032`, `T2217`–`T2221` on `EPIC-038`; each group is independent of the others.
- **Phase 12** after the stories; **Phase Z** last, and `T2233` blocks closure.

## Parallel opportunities

Every `[P]` test task within a phase can be written together. Implementation tasks touching
`resolver.service.ts` (T2144, T2180) and the composition file (T2136, T2160, T2190, T2197) are
sequential. Example — Phase 2: T2107, T2109, T2111, T2113, T2115, T2117, T2119, T2121 together, then
their implementations in any order; T2124, T2127, T2131, T2133, T2135, T2137 together. The four
adapter packages (Phases 4, 8, 9) are independent of each other.

## Implementation strategy

**MVP = Phases 1–3**: a workflow requests `ReadRepository`, `ReadBuildStatus` or `ReadTestResults`
through the real route, against fixture adapters, and receives a result or an explained refusal —
and a connector cannot ask. **Phases 4–6** complete the P1 stories: a real GitHub adapter behind the
same suite, the registry with both directions, and credentials that cannot leak. **Phases 7–9** are
P2 and independent of each other; **Phase 10** delivers the screen. **Phase 11** lands per
dependency as each merges; until then every route needing them refuses `503`, which the
integration suites assert. **Phase Z** closes only with a run-generated Tier 2 transcript.

---

## Phase 13: Convergence (2026-10-16, `T2234`) — `T2620`–`T2634`

`/speckit-converge` assessed the code against `spec.md`, `plan.md` and this file after Phases 1–12.
Its findings, each traced to its source and either **built** here or **deferred to a named Epic**
(Constitution IV). Items needing a person or live credentials (`T2231`, `T2233`, `T2220`/`T2223`)
and the open policy-band question (`T2213`) were excluded as already recorded. The API contract's
16 routes all have handlers and no handler is outside it; the ten data-model tables are all in
`schema.prisma`.

- [X] T2620 [P] (partial, `FR-HUB-052`, US5 AS1) The contributed `ReadTestResults` Statement names neither the capability and its contract version nor the adapter version and provider, and reads `output.url` where the contract field is `source.runUrl` — add them to the predicate in `backend/src/modules/integrations/evidence/evidence-intake.service.ts`, asserted first in `backend/tests/unit/integrations-evidence-intake.spec.ts`
 — **Done**: `intakeStatement` (exported from `evidence-intake.service.ts`) carries the capability, contract version, adapter, adapter version and provider as an in-toto `ResourceDescriptor` in the test-result predicate's `configuration`, and reads the URL from `source.runUrl`. Two new cases in `integrations-evidence-intake.spec.ts` (15/15), observed failing first.
- [X] T2621 [P] (partial, `FR-HUB-045`) Adapter **outputs** are never scanned for credential material; a `ReadBuildStatus` output is contributed verbatim — refuse an output carrying credential material as `adapter-fault` before it is returned or recorded, in `backend/src/modules/integrations/requests/output-validation.ts`, asserted first in `backend/tests/unit/integrations-output-validation.spec.ts`
 — **Done**: `checkOutput` refuses an output carrying credential material as `adapter-fault`, naming the path and never the value. Two new cases in `integrations-output-validation.spec.ts` (10/10), observed failing first; the whole `backend-unit` `integrations-` filter 209/209.
- [X] T2622 [P] (contradicts, Edge case *major retired*, data-model §1) The resolver reads contract versions from the package and ignores `capability_contract_versions.status`, so retiring a major in the store does not stop resolution — consult the store's approved-and-not-retired versions in `resolver/resolver.service.ts`, asserted first in `backend/tests/unit/integrations-resolver.spec.ts`
 — **Done**: the resolver resolves a major only when the store holds an approved (not retired) version of it; the package's document supplies the schema. New case in `integrations-resolver.spec.ts`, observed failing first (it resolved after retirement).
- [X] T2623 [P] (partial, `FR-HUB-031`, API Ports table) Credential eligibility checks only that a row exists; a row the vault cannot open (keyring unbound, key rotated out) resolves and the adapter runs with no credential — make *present* mean *openable* and refuse `credential-missing` otherwise, asserted first in `backend/tests/unit/integrations-resolver.spec.ts`
 — **Done** — **a real defect**: a credential sealed under a key that had left the keyring still counted as *present*, so the adapter resolved and ran with no credential. `CredentialVault.canOpen` now decides presence, and the resolver gets the vault from `hub.ts`. New case in `integrations-resolver.spec.ts`, observed failing (*resolved*) first; `backend-unit` `integrations-` 211/211.
- [X] T2624 [P] (contradicts, `FR-HUB-026`) `HubEmbeddingPort` hard-codes `permitDegraded: true`, so a degraded `Embed` binding is eligible by default — default it to not permitted, opt-in through `PMI_EMBED_BINDING`'s `permitDegraded: true`, asserted first in `backend/tests/unit/integrations-hub-embedding-port.spec.ts`
 — **Done**: a degraded `Embed` binding is ineligible by default; the deployment opts in with `PMI_EMBED_PERMIT_DEGRADED=true` (a new deployment variable, not a binding field, so the adapter's binding schema is untouched) — documented in `.env.example` and governed by `integrations-env.spec.ts` (observed failing before the documentation). Three new cases in `integrations-hub-embedding-port.spec.ts`, observed failing first; `backend-unit` `integrations-` 214/214.
- [X] T2625 [P] (missing, Edge case *retired while configured*, API §2) The configuration read does not say an adapter it names is retired — add each adapter's registry `status` to the view in `configuration.service.ts`, asserted first in `backend/tests/unit/integrations-configuration.spec.ts`
 — **Done**: each adapter in the configuration view carries its registry `status` (`active` · `retired` · `not-listed`); the configuration is kept, and the resolver already refuses the retired entry. New case in `integrations-configuration.spec.ts` (17/17), observed failing with the change reverted; API §2 row updated; `backend-unit` `integrations-` 215/215.
- [X] T2626 [P] (partial, US6 AS1–AS2) A `SendNotification` requested through the route writes no `notification_deliveries` row, and a provider failure records only its category — record the delivery for every `SendNotification` invocation and carry the sanitised provider message, asserted first in `backend/tests/unit/integrations-notifications.spec.ts`
 — **Done**: `CapabilityRequests.request` records one `notification_deliveries` row for every `SendNotification` request (route or in process, resolved, refused or failed); `NotificationService` now hands it the delivery id, cause and recipients instead of writing its own row; a route request's cause is `{ kind: 'capability-request', ref: <caller> }` and its own `idempotencyKey` stays the provider's key; a failure records `<category>: <provider message>` through `sanitiseText`. Five new cases in `integrations-notifications.spec.ts` (10/10), three observed failing first; `backend-unit` `integrations-` 220/220; `integrations-caller-suite` + `integrations-credential-canary` 17/17. data-model §8 updated.
- [X] T2627 [P] (partial, `SC-HUB-007`, API §7) The Integrations screen does not show a project's per-capability configuration (adapters, preference, policy status) or the deployment's `Embed` binding — add both reads to `frontend/src/services/integrations.client.ts` (read only) and render them in `frontend/src/pages/Integrations.tsx`, asserted first in `frontend/tests/unit/pages/integrations.spec.tsx`
 — **Done**: `integrations.client.ts` gains two reads (`listConfiguration`, `deploymentCapabilities` — GET only); `Integrations.tsx` renders *Configuration for this project* (each capability's adapters in preference order, a retired one marked, the policy status in words, the configuration version; *not applicable* with no project, and nothing asked) and *Deployment capabilities* (the `Embed` adapter, model, dimension and health, or *Not usable* with the Hub's explanation). Each read fails in its own section. No control added. Five new cases in `integrations.spec.tsx` (12/12), all observed failing first; `frontend` page + shell 309/309.
- [X] T2628 [P] (partial, `FR-HUB-023` audit metadata) `lastChangeAt` is `retiredAt ?? registeredAt`, ignoring version and configuration changes — derive it from the latest audit entry for the entry, asserted first in `backend/tests/unit/integrations-registry.spec.ts`
 — **Done**: `lastChangeAt` is the latest of registration, retirement, the latest audit entry for the entry (a `system:catalog` version change included) and, for a project, the latest audit entry of a configuration naming the entry. A new `AuditTrailReader` port (`latestAt`) reads `audit_entries` in the module (as `T2227` does); the unit fixture stamps its audit rows with the Hub clock. Two new cases in `integrations-registry.spec.ts`, observed failing first; `backend-unit` `integrations-` 222/222; `integrations-registry-route` 14/14 against PostgreSQL.
- [ ] T2629 [P] (doc drift) `plan.md` still routes `SendNotification` over HTTP as `notification-dispatch` (U1 forbids it) and says `403` for a connector (it is `400 surface_not_accepted`); `data-model.md` §3 (per-adapter `providerBinding`), §6 (refusal codes `credential-material-in-content`, `invalid-input`, `batch-too-large`, `text-too-long`), §7 (intake reasons `no-binding`, `evidence-seam-unbound`, `evidence-store-refused:*`, `invocation-failed:*`) and four undocumented columns lag the code — bring both documents in line with a dated note each
- [ ] T2630 (missing, US1 / `PP-013`) No product caller requests `ReadRepository`, `ReadBuildStatus` or `ReadTestResults` — only the route and tests do. **Deferred** to the callers' owners: the governed loop (`EPIC-030`) and the Rooms (`EPIC-033`, `EPIC-034`, `EPIC-035`) adopt `CapabilityRequests` / `POST …/capability-requests`; recorded in `closure.md`
- [ ] T2631 (missing, US6 body) Nothing in the product triggers `SendNotification` (*a decision is waiting*, *a gate refused*). **Deferred** to `EPIC-031` (Decision Inbox: a decision waiting) and `EPIC-032` (a completion gate refusal), which call `hub.notifications` as `notification-dispatch`; recorded in `closure.md`
- [ ] T2632 (partial, US5 body) Evidence intake is enqueued only through its route; no completion flow enqueues it when an Evidence Contract asks for test results. **Deferred** to `EPIC-032` (the completion flow that knows an item awaits external results); recorded in `closure.md`
- [ ] T2633 (closure) The spec's other deferrals are not named in `T2238`'s list — `PP-010` dashboards and trends → `EPIC-040`; `PP-015` capability-description standard; `PP-018` volume targets; the Administrator role (no owning Epic); `BR-0131` customer-cloud execution; the public marketplace → Expansion Plane; out-of-scope capabilities (`CreateBranch`, …) — name each with its landing place in `closure.md`
- [ ] T2634 (closure, process) `spec.md` lines 29–30 say the BRS owner annotations change *when this Epic is accepted into the stage register*; `T2237` changed them on the Project Owner's instruction before that — record the exception and its authority in `closure.md` (`spec.md` is not edited by convergence)
