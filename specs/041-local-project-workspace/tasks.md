# Tasks: Local Project Workspace

**Epic**: `EPIC-041` · **Module**: Projects (M-02) + Workspace Fabric (M-13) · **Branch**:
`epic/041-local-project-workspace` · **Generated**: 2026-09-03

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/provisioning-api.md](./contracts/provisioning-api.md) ·
[contracts/project-files.md](./contracts/project-files.md) ·
[contracts/local-fabric-mode.md](./contracts/local-fabric-mode.md) · [quickstart.md](./quickstart.md)

**Task ID range**: `T1310`–`T1393`, **84 tasks**.

> **On the identifiers.** `G-26-15` requires task identifiers to be unique **across the corpus**.
> The corpus maximum before this Epic is `T1309` (`EPIC-038`), so allocation starts at `T1310`,
> contiguous, with no suffix letters (`R-026-9`: a trailing letter is a shape, not an adjacency
> claim, and the ranges below do not need one).
>
> `T1383`–`T1393` were appended on 2026-09-03 by the `/speckit-analyze` remediation: `T1383` for
> finding `C1`, `T1384` for `T3`, and `T1385`–`T1393` for `I3` (the closure phase). `T1383` and
> `T1384` sit out of numeric sequence within their phases, because identifiers are never renumbered
> once written.

**Delivery posture**: ▶ **PROCEEDING** — first Epic of the local-first replan (`D-47`,
PMI-DOC-007 v1.0 approved 2026-09-03). Nothing it depends on is held.

**Session label**: `EPIC-041 Local Project Workspace` (Constitution VIII).

**Test statement** (Constitution V): every implementation task names the failing-first test task
that precedes it. Tasks whose output is a file the platform writes into a user's directory
(`.pmi/project.json`, `.mcp.json`) or a configuration file (`docker-compose.yml`, `.env.example`)
pair with an **executable conformance check** under `tests/governance/` or `backend/tests/`. Two
checks in this Epic are **mutation-tested** at closure (`SC-LPW-003`, `SC-LPW-006`), because each
guards the one failure the Epic cannot walk back. Whether a conformance check blocks CI: **blocks**,
for every check in this Epic.

**Feature map** (`F-041.n`, Constitution III): F-041.1 Setup & contracts (Phase 1) · F-041.2
Foundational wiring repairs (Phase 2) · F-041.3 Provisioning (US1) · F-041.4 Connector credential
(US2) · F-041.5 Controlled-local mode & assurance (US3) · F-041.6 Screens that reach what exists
(US4) · F-041.7 Provisioning & credential screens (US5) · F-041.8 Polish · F-041.Z Closure.

---

## Phase 1: Setup — F-041.1

**Purpose**: the places this Epic writes to exist, the contract words it needs exist, and the
configuration it reads is declared before any behaviour depends on it.

- [X] T1310 [P] Write the failing conformance check for the projects-root configuration in `tests/governance/projects-root-config.spec.ts` — `docker-compose.yml`'s `app` service binds `${PMI_PROJECTS_ROOT_HOST}` to `/projects` and sets `PMI_PROJECTS_ROOT=/projects`, `PMI_PROJECTS_ROOT_HOST` and `PMI_PUBLIC_URL`; `.env.example` declares the **six** variables `PMI_PROJECTS_ROOT`, `PMI_PROJECTS_ROOT_HOST`, `PMI_PUBLIC_URL`, `PMI_ENGINE_TAG`, `PMI_MCP_SERVER_VERSION`, `PMI_INITIALISE_WAIT_MS` with no value that looks like a path on anyone's machine (`FR-LPW-005`, `R-041-2`; analysis `U2`, `I1`)
- [X] T1311 Add the projects-root mount and the six variables to `docker-compose.yml` and `.env.example` (conformance check: T1310) — the mount is the one line that makes the containerised stack able to write a directory the user can open; `PMI_PUBLIC_URL` defaults to `http://localhost:${PMI_APP_PORT:-3000}` and is the only source of the address written into a project's files
- [X] T1312 [P] Write failing unit tests for `ExecutionEnvironmentKind` in `packages/execution-contract/tests/unit/environment-kind.spec.ts` — `descriptor.kind` is **required**, two members, and a `controlled-local` descriptor with `supportedLifecycles: ['ephemeral']` is a type error (`FR-LPW-030`, `R-041-4`)
- [X] T1313 Add `ExecutionEnvironmentKind` and `ExecutionEnvironmentDescriptor.kind` to `packages/execution-contract/src/index.ts` (unit test: T1312); set `kind: 'managed-isolated'` on the Docker provider in `execution-providers/docker/src/index.ts` and on the fixture provider — the refusal of persistent bindings stays exactly where it is (`FR-LPW-033`)
- [X] T1314 [P] Write failing unit tests for `assuranceFor` in `packages/execution-registry-contract/tests/assurance.spec.ts` — total over `EXECUTION_SURFACES` (the test enumerates the array and calls the function for each), `local-cli`/`mcp-client`/`ide-extension` → `local`, `managed-sandbox`/`ci-cd` → `managed` (`FR-LPW-034`, `R-041-5`)
- [X] T1315 Add `ExecutionAssurance` and `assuranceFor()` to `packages/execution-registry-contract/src/contract.ts` (unit test: T1314) — a `switch` with no `default` arm, so a new surface fails to compile until it is mapped
- [X] T1316 [P] Write failing unit tests for the workspace bundle in `packages/workspace-bundle/tests/bundle.spec.ts` — `BUNDLE_VERSION` is semver, `skillsDir()` contains `setup-PMIStudio/SKILL.md` with frontmatter `name: setup-PMIStudio`, `extensionDir()` contains `extension.yml` whose `provides.commands` and `hooks` are **empty** in v0.1; **`skillsPathFor(integration)`** returns the agent-specific skills directory for every integration the mapping names (`claude` → `.claude/skills`) and returns a typed refusal, never a guess, for one it does not (`FR-LPW-006`; `R-041-9`, [contracts/project-files.md](./contracts/project-files.md) §Skills path; analysis `C4`)
- [X] T1317 Create `packages/workspace-bundle/` with `package.json` (`@pmi/workspace-bundle`), `src/index.ts` (`BUNDLE_VERSION`, `skillsDir`, `extensionDir`, `skillsPathFor` and its configuration table), `skills/setup-PMIStudio/SKILL.md` (v0.1 — the seven "must" steps of the contract, nothing more) and `extension/extension.yml` (unit test: T1316); register it in `pnpm-workspace.yaml` and `vitest.workspace.ts`
- [X] T1318 [P] Write the failing integration test for the migration in `backend/tests/integration/local-workspace-constraints.spec.ts` — with raw SQL: `projects.root_path` unique per workspace; `provisioning_records` refuses `UPDATE` and `DELETE`; a `failed` record without `failed_step` is refused; `connector_credentials` has no value column; `executions.assurance` is `NOT NULL` (`data-model.md` §1–§5)
- [X] T1319 Write `backend/prisma/migrations/<ts>_epic041_local_workspace/migration.sql` and the schema changes in `backend/prisma/schema.prisma` (integration test: T1318) — five `Project` columns, `ProvisioningState`, `ProvisioningRecord`, `ConnectorCredential`, `Principal.kind += connector`, `JobKind += initialise_workspace`, `Execution.assurance` nullable → back-fill by surface → `NOT NULL`

**Checkpoint**: the platform can say *controlled-local* and *assurance*, has somewhere to record a
provisioning, and knows where its projects root is.

---

## Phase 2: Foundational — F-041.2 (blocking — the wiring repairs; PMI-DOC-004B §2.1)

**Purpose**: nothing local is demonstrable while the worker throws on persistence and tasks vanish
on restart. `D-47` places these repairs here. No story label: they predate every story.

- [X] T1320 [P] Write failing unit tests for the worker persistence in `worker/tests/unit/job-persistence.spec.ts` — `persistence().transaction()` runs the commit and **does not throw**; a commit that fails mid-way leaves no specification row (the single-transaction guarantee `generation.consumer.ts` states) (`FR-LPW-040`, `R-041-6`)
- [X] T1321 Create the two-export barrel `backend/src/worker-api.ts` (`prismaClient`, `GenerationCommitService`) and add `"exports": { "./worker-api": "./src/worker-api.ts" }` to `backend/package.json`; add `@pmi/backend: workspace:*` to `worker/package.json`; replace the throwing `persistence()` in `worker/src/main.ts` with a runner-driven consumer (unit test: T1320); make `GenerateSpecificationService.settle` tolerate the terminal state the commit already wrote when ledger and store share one `generation_jobs` row — found by T1383, every persisted success read as `engine_error` (unit test: `backend/tests/unit/specifications/generation-settle-shared-ledger.spec.ts`)
- [X] T1322 [P] Write the failing boundary test in `tests/governance/eslint-boundaries.spec.ts` (extend) — the only permitted worker → backend import is `@pmi/backend/worker-api`; any other path fails lint; backend → worker remains forbidden entirely
- [X] T1323 Extend `eslint-rules/` and `eslint.config.js` with the single allowed edge (conformance check: T1322)
- [X] T1324 [P] Write the failing integration test for the Prisma task store in `backend/tests/integration/task-store.spec.ts` (a mock-backed unit test was planned and dropped: a store whose whole job is the database is proved only against one) — every `TaskStore` method round-trips; `replaceForSpecification` is the only replacement path; another workspace's task is absent not forbidden (`FR-LPW-041`, `R-041-7`)
- [X] T1325 Implement `backend/src/modules/tasks/tasks.store.prisma.ts` and bind it in `tasks.module.ts` under `DATABASE_URL` (integration test: T1324); likewise `backend/src/modules/traceability/traceability-link.store.prisma.ts` bound in `traceability.module.ts` — a fourth in-memory store PMI-DOC-004B §2.1 missed, found by T1383 when `/trace` answered `requirementIds: []` for a specification the database showed fully linked (integration test: `backend/tests/integration/traceability-link-store.spec.ts`)
- [X] T1326 [P] Write failing integration tests for the run-side stores in `backend/tests/integration/run-stores.spec.ts` — `RunStore`, `QuestionStore`, `MarkingStore`, `OverrideStore` round-trip against PostgreSQL
- [X] T1327 Implement `backend/src/modules/runs/runs.store.prisma.ts` (four stores) and bind them in `runs.module.ts` under `DATABASE_URL` (integration test: T1326)
- [X] T1328 [P] Write the failing integration test for the job ledger in `backend/tests/integration/generation-job-ledger.spec.ts` — `findById`, `listForProject`, `updateState` over the real `generation_jobs` table, and `resultRef` written in the same transaction as the specification
- [X] T1329 Implement `backend/src/modules/specifications/generation-job.ledger.prisma.ts` over `PrismaJobStore` and bind it in `specifications.module.ts` under `DATABASE_URL` (test: T1328)
- [X] T1330 [P] Write the failing architecture test `backend/tests/architecture/durable-stores.spec.ts` — reads `tasks.module.ts`, `runs.module.ts`, `specifications.module.ts` and fails if any store factory can return an `InMemory*` implementation when `DATABASE_URL` is set (`FR-LPW-043`); written to fail against today's composition roots
- [X] T1331 [P] Write the failing integration test `backend/tests/integration/durable-stores-composed.spec.ts` — boots the real `AppModule` with Testcontainers and asserts, through the DI graph, that `TASK_STORE`, `RUN_STORE` and the ledger resolve to Prisma implementations (Constitution XI Tier 1 for `FR-LPW-041`)
- [X] T1332 [P] Write the failing restart test `backend/tests/integration/survives-restart.spec.ts` — create tasks and a job, dispose the Nest application, boot a second one against the same database, read everything back (`SC-LPW-007`, `US4` scenario 2)
- [X] T1383 [P] Write the failing route-through test `backend/tests/integration/generation-persists-through-route.spec.ts` — boots the real `AppModule` against Testcontainers PostgreSQL, runs `createGenerationWorker` **in-process** with the real `JobPersistence` from `T1321` and the fixture engine, submits through `POST /projects/:id/jobs/generate-specification`, polls `GET /jobs/:id` to `succeeded`, then disposes and re-boots the application and reads the specification, its version, its links and the job's `resultRef` back through the routes. **Zero hand-assembled composition** (`SC-LPW-008`, `FR-LPW-040`, `FR-LPW-042`; Constitution XI Tier 1). *Added 2026-09-03 for analysis finding `C1`: `T1320` proved the persistence function and `T1332` proved the stores, and nothing proved a user's submission reached either — milestone `M0`'s own proof was missing*

**Checkpoint**: a generation persists, tasks and runs survive a restart, and an architecture test
says so in a way that fails when it stops being true.

---

## Phase 3: User Story 1 — A project becomes a directory I can open (P1) 🎯 MVP — F-041.3

**Goal**: `LR-01`, `BR-0010` — the prepare step in the API, the initialise step in the worker, and
the honest states between them.

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 1–7.

- [X] T1333 [P] [US1] Write failing unit tests for the projects-root resolver in `backend/tests/unit/projects/projects-root.spec.ts` — a relative name resolves under the root; an absolute host path under `PMI_PROJECTS_ROOT_HOST` maps to the container path; `..` segments, a path outside the root, a Windows drive-letter path outside the root, and a path with spaces inside the root each produce the documented outcome; an unmounted root is detected before any write (`FR-LPW-005`, `FR-LPW-007`, `R-041-2`)
- [X] T1334 [US1] Implement `backend/src/modules/projects/projects-root.ts` (unit test: T1333)
- [X] T1335 [P] [US1] Write failing unit tests for the step vocabulary and state machine in `backend/tests/unit/projects/provisioning-types.spec.ts` — eleven steps in fixed order; `prepared`, `initialisation_pending` and `provisioned` are distinct; `failed` is reachable from any non-terminal state and carries `failedStep`; a resumed run starts at the first incomplete step (`data-model.md` §1.1, §2.1)
- [X] T1336 [US1] Implement `backend/src/modules/projects/provisioning.types.ts` (unit test: T1335)
- [X] T1337 [P] [US1] Write failing unit tests for the file writers in `backend/tests/unit/projects/project-files.spec.ts` (temp directory) — `.pmi/project.json` matches the contract schema, has `\n` endings and a trailing newline, carries `platformUrl` **from `PMI_PUBLIC_URL`** and nothing inferred from the request, and contains **no credential and no root path**; `.mcp.json` is **merged** (an existing `playwright` entry survives byte-for-byte), created when absent, and left untouched with a `merge_mcp_json` failure when unparseable; the token env reference is the literal `${PMI_STUDIO_TOKEN}` (`FR-LPW-009`, `FR-LPW-024`, `R-041-10`)
- [X] T1338 [US1] Implement `backend/src/modules/projects/project-files.ts` (unit test: T1337)
- [X] T1339 [P] [US1] Write failing unit tests for the prepare step in `backend/tests/unit/projects/provisioning.service.spec.ts` (temp directory, in-memory record store) — the seven prepare steps run in order and each is recorded; a non-empty directory is refused **by name** with nothing written, as is a path outside the root and one owned by another project — every refusal names its reason and leaves zero files (`SC-LPW-005`); an empty git repository is adopted; `git init` runs only where `.git` is absent; the setup skill is copied from `@pmi/workspace-bundle` into **`skillsPathFor(agentIntegration)`**, and an integration with no mapping fails the step by name rather than defaulting to any agent's directory (`FR-LPW-006`); a second run on a prepared project writes nothing and records `no_change`; an interrupted run resumes at the first missing step and never re-runs `create_directory` (`FR-LPW-002`, `FR-LPW-003`, `FR-LPW-012`, `FR-LPW-013`, `SC-LPW-004`)
- [X] T1340 [P] [US1] Write failing unit tests for the provisioning record store in `backend/tests/unit/projects/provisioning-store.spec.ts` — append-only interface (no update, no delete method exists), latest-record projection to `provisioningState`
- [X] T1341 [US1] Implement `backend/src/modules/projects/provisioning.store.ts` (interface, in-memory, Prisma) (unit test: T1340)
- [X] T1342 [US1] Implement `backend/src/modules/projects/provisioning.service.ts` — the prepare step, an audit entry per attempt via `AuditService.record` (`FR-LPW-004`), and enqueueing the `initialise_workspace` job through `JobsService` (unit test: T1339)
- [X] T1343 [P] [US1] Write failing unit tests for the initialise consumer in `worker/tests/unit/provisioning-consumer.spec.ts` — runs `run_engine_init`, `copy_extension`, `register_hooks`, `verify_structure` in order through an injected `LocalInitialiser`; `verify_structure` checks the directory against the structural contract for the chosen integration and fails the step, never silently passes, when a required path is absent (`SC-LPW-002`); a failing initialiser records `failed` with the step and a sanitised reason; success records `engineTag` and `bundleVersion` (`FR-LPW-008`, `R-041-8`, `R-041-9`)
- [X] T1344 [P] [US1] Write failing unit tests for the local initialiser in `engine-adapters/speckit/tests/unit/local-init.spec.ts` — builds exactly `uvx --from git+https://github.com/github/spec-kit.git@<tag> specify init --here --force --integration <i> --script <s>` with the project directory as cwd, where `<i>` is **whatever integration the project recorded** and no integration is special-cased (`FR-LPW-006`); a missing `uv` is reported as `initialiser_unavailable`, distinguishable from a failed init
- [X] T1345 [US1] Implement `engine-adapters/speckit/src/local-init.ts` (unit test: T1344) — the only file in this Epic that names Spec Kit outside `worker/` and the bundle
- [X] T1346 [US1] Implement `worker/src/provisioning.consumer.ts` and compose `LocalSpecKitInitialiser` in `worker/src/main.ts` (unit test: T1343); the consumer copies `extensionDir()` from `@pmi/workspace-bundle` into the project directory's `extensions/pmi` folder and merges its extensions manifest rather than replacing it
- [X] T1347 [P] [US1] Write failing unit tests for the pending bound in `backend/tests/unit/projects/initialisation-pending.spec.ts` — a prepared project whose job is not claimed within `PMI_INITIALISE_WAIT_MS` (default 30 s) transitions to `initialisation_pending`; a job claimed at 29 s does not (`FR-LPW-010`, `data-model.md` §1.1)
- [X] T1348 [US1] Implement the pending transition in `provisioning.service.ts` (unit test: T1347) — driven by the job ledger's state, not by a timer the API must keep alive
- [X] T1349 [P] [US1] Write failing unit tests for the extended create and the provision route in `backend/tests/unit/projects/projects.controller.spec.ts` — `POST /projects` with `rootPath` provisions after the row; a refused root **creates no row**; `POST /projects/:id/provision` returns `202`/`200` per the contract; the credential value appears in the create response **once** and in no other response (`FR-LPW-001`, `FR-LPW-050`, [contracts/provisioning-api.md](./contracts/provisioning-api.md))
- [X] T1350 [US1] Extend `projects.controller.ts`, `projects.service.ts` and `projects.module.ts` (unit test: T1349) — `PROJECTS_ROOT` config token, provisioning providers, `GET /projects/:id/provisioning`
- [X] T1351 [P] [US1] Write the failing Tier 1 integration test `backend/tests/integration/provisioning-route.spec.ts` — the real `AppModule`, a temp projects root, PostgreSQL: Scenario 1's five files exist and pass the structural check for the chosen integration after `POST /projects` (`SC-LPW-002`); Scenario 2 leaves `/tmp/elsewhere` untouched and the refusal names the root (`SC-LPW-005`); Scenario 3 refuses `busy` by name and adopts `empty-repo`; Scenario 6 writes nothing (Constitution XI Tier 1)
- [X] T1352 [P] [US1] Write the failing contract conformance check `backend/tests/contract/project-files.spec.ts` — provisions into a temp root through the service and reads back **every** file under it: the **set of paths written equals exactly the contract's enumeration** for the prepare step (`.pmi/project.json`, `.mcp.json`, the setup skill, plus `.git/` where initialised) and nothing else (`FR-LPW-011`); `.pmi/project.json` validates against the contract's shape; `.mcp.json` parses and carries the `pmi-studio` entry; and **no file matches `pmi_ct_[A-Za-z0-9_-]{20,}`** (`FR-LPW-009`, `SC-LPW-003`). Blocks CI. *Moved from `tests/governance/` on 2026-09-03 (analysis `I2`): it boots a backend service, and the governance project reads files only*

**Checkpoint**: US1 demonstrable — a project becomes a directory, refusals write nothing, and a
host without the initialiser says so.

---

## Phase 4: User Story 2 — My agent has a credential that opens exactly one project (P1) — F-041.4

**Goal**: `LR-02`, `BR-0135`, `BR-0201` — mint once, store a digest, resolve to a principal, refuse
without disclosing.

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 8–11.

- [X] T1353 [P] [US2] Write failing unit tests for token generation and verification in `backend/tests/unit/connector/credential-token.spec.ts` — 32 random bytes, `pmi_ct_` prefix, base64url; `tokenHash` is `sha256`; verification is constant-time and rejects a one-character change; the value is **not present on the stored record type** (`FR-LPW-021`, `R-041-3`)
- [X] T1354 [US2] Implement `backend/src/modules/connector/credential-token.ts` (unit test: T1353)
- [X] T1355 [P] [US2] Write failing unit tests for the credential store in `backend/tests/unit/connector/credential-store.spec.ts` — lookup by `tokenPrefix`; `lastUsedAt` written at most once per minute; `revokedAt` set once and never cleared; no method deletes; **the record type has no `expiresAt` field, and a credential minted under a mocked clock ninety days in the past still verifies** — the only thing that ends a credential is `revokedAt` (`FR-LPW-022`, `FR-LPW-023`, `FR-LPW-028`; analysis `C2`)
- [X] T1356 [US2] Implement `backend/src/modules/connector/connector-credential.store.ts` (interface, in-memory, Prisma) (unit test: T1355)
- [X] T1357 [P] [US2] Write failing unit tests for the credential service in `backend/tests/unit/connector/connector-credential.service.spec.ts` — mint registers a `Principal` of kind `connector` with the minting owner as sponsor through `PrincipalRegistryService`; mint without the owner grant is refused and audited; a project that is `not_provisioned` cannot mint; revoke is immediate, audited once, idempotent (`FR-LPW-020`, `FR-LPW-023`, `FR-LPW-027`)
- [X] T1358 [US2] Implement `backend/src/modules/connector/connector-credential.service.ts` (unit test: T1357)
- [X] T1359 [P] [US2] Write failing unit tests for the guard in `backend/tests/unit/connector/connector-auth.guard.spec.ts` — unknown, wrong-digest and revoked tokens produce **one identical `401`**; a valid token yields a `TrustedPrincipalContext` scoped to its project; a resource of another project is `404`; a route **not registered in the `ConnectorScope` registry** is `403` — in this Epic the registry holds exactly `connector.whoami`, and a test registers a second scope to prove `EPIC-043` can extend it without touching the guard (`FR-LPW-025`, `FR-LPW-026`; analysis `U1`)
- [X] T1360 [US2] Implement `backend/src/modules/connector/connector-auth.guard.ts` and `connector-scope.ts` (the registry: a route declares its scope with a decorator, the guard refuses an undeclared one) (unit test: T1359) — produces the context through `TrustedPrincipalFactory`, never by constructing one
- [X] T1361 [P] [US2] Write failing unit tests for the routes in `backend/tests/unit/connector/connector.controller.spec.ts` — mint returns `value` once; list never includes `value` or `tokenHash`; list filters by `revoked` and `label`; `GET /connector/whoami` returns only the project id ([contracts/provisioning-api.md](./contracts/provisioning-api.md))
- [X] T1362 [US2] Implement `backend/src/modules/connector/connector.controller.ts` and `connector.module.ts`, and register the module in `backend/src/app.module.ts` in the same commit (unit test: T1361) — `DEF-005-001` is what an unregistered module looks like
- [X] T1363 [P] [US2] Write the failing Tier 1 integration test `backend/tests/integration/connector-credential-route.spec.ts` — the real `AppModule`: Scenario 9 (`whoami` → A; B with A's token → `404`), Scenario 10 (revoke → `401` identical to unknown; one audit entry; second revoke `200`, no new entry), Scenario 11 (`403` without the grant, audited)
- [X] T1364 [P] [US2] Write the failing architecture test `backend/tests/architecture/connector-boundary.spec.ts` — no file under `backend/src/modules/connector/` imports a Room, a review gate or the access-grant service's mutation surface; the connector module can only ever authenticate and scope (`FR-LPW-026`). **And the converse for assurance**: under `backend/src/modules/{loop,policy,decisions,reviews}` the identifier `assurance` does not appear — it is recorded by the registry and read by its projection, and consulted by no rule (`FR-LPW-031`; analysis `C3`)

**Checkpoint**: US2 demonstrable — a credential opens one project, and a revoked one opens none.

---

## Phase 5: User Story 3 — Work done on my machine counts as governed work (P1) — F-041.5

**Goal**: `BR-0132`, `BR-0133`, Constitution XII — the contract can name where a command ran and
how much its evidence rests on.

**Independent test**: [quickstart.md](./quickstart.md) Scenario 13; the provider conformance suite.

- [X] T1365 [P] [US3] Write failing unit tests for the registry's assurance write in `backend/tests/unit/executions/assurance.spec.ts` — a registration from `local-cli` stores `assurance: local`; from `managed-sandbox`, `managed`; a body carrying `assurance` is refused naming the field; the projection carries it (`FR-LPW-034`, `SC-LPW-009`)
- [X] T1366 [US3] Implement the assurance write and the body refusal in `backend/src/modules/executions/` (registration service and sanitisation) (unit test: T1365) — through `assuranceFor`, the only writer
- [X] T1367 [P] [US3] Extend the provider conformance suite in `packages/execution-contract/tests/` — a `managed-isolated` provider must refuse a persistent binding; a `controlled-local` descriptor must declare `supportedLifecycles` including `persistent`; the suite asserts the refusal **only** for `managed-isolated` (`FR-LPW-033`)
- [X] T1368 [US3] Update `execution-providers/docker/tests/` and the fixture provider to the extended suite (conformance: T1367) — the Docker provider's behaviour does not change; the suite's expectation of it becomes explicit
- [X] T1369 [P] [US3] Write the failing fixture-connector test `packages/execution-registry-contract/tests/local-surface.spec.ts` — the fixture connector registers with `surface: 'mcp-client'` and a `controlled-local` environment binding a `persistent` workspace, and the registry accepts it (`FR-LPW-030`, `FR-LPW-032`)
- [X] T1370 [US3] Extend the fixture connector in `packages/execution-registry-contract/src/fixture-connector.ts` to declare its environment kind and surface (test: T1369)
- [X] T1371 [P] [US3] Write the failing unit test for the default mode in `backend/tests/unit/projects/default-mode.spec.ts` — a project with `rootPath` resolves `controlled-local` as its default execution kind; one without resolves `managed-isolated`; the choice is a project attribute, not a global (`FR-LPW-035`)
- [X] T1372 [US3] Implement the default-mode resolution in `projects.service.ts` (unit test: T1371)

**Checkpoint**: US3 demonstrable — an execution from a developer's machine is recorded, labelled
honestly, and governed identically.

---

## Phase 6: User Story 4 — What the platform already does, it now keeps: the screens (P1) — F-041.6

**Goal**: the user-facing half of the wiring repairs; the persistence half landed in Phase 2.

**Independent test**: [quickstart.md](./quickstart.md) Scenario 12.

- [X] T1373 [P] [US4] Write failing unit tests for the new client methods in `frontend/tests/unit/services/api-generation.spec.ts` — `generateSpecification(projectId, requirementIds)` posts to `/projects/:id/jobs/generate-specification` and returns the `202` job; `startRun` posts to `/projects/:id/runs`; both surface the refusal body on `4xx` (`FR-LPW-042`)
- [X] T1374 [US4] Add `generateSpecification`, `startRun`, `provisionProject`, `listProvisioning`, `listConnectorCredentials`, `mintConnectorCredential`, `revokeConnectorCredential` to `frontend/src/services/api.ts` (unit test: T1373)
- [X] T1375 [P] [US4] Write failing component tests in `frontend/tests/unit/pages/project-generate.spec.tsx` — with requirements selected, *Generate specification* calls the client and mounts `JobProgress` for the returned job; with none selected the control is disabled and says why; the four `FR-SHL-060` states are distinguishable
- [X] T1384 [P] [US4] Write failing component tests in `frontend/tests/unit/pages/specification-mounts.spec.tsx` — `LifecycleControls`, `ValidationFindings`, `VersionHistory` and `VersionDiff` are each rendered by `Specification.tsx` for a loaded specification, `VersionDiff` opens from a `VersionHistory` selection, and each keeps its own four states (`FR-LPW-044`, `R-041-11`). *Added 2026-09-03 for analysis `T3`: the test had been folded into the implementation task, unlike every other pair in this file*
- [X] T1376 [US4] Add the *Generate specification* control and `JobProgress` to `ProjectDetail` in `frontend/src/pages/Projects.tsx` (test: T1375); mount `LifecycleControls`, `ValidationFindings`, `VersionHistory` and `VersionDiff` in `frontend/src/pages/Specification.tsx` (test: T1384) (`FR-LPW-044`, `R-041-11`)
- [X] T1377 [P] [US4] Write the failing reachability test in `frontend/tests/unit/shell/mounted-components.spec.tsx` — every component under `frontend/src/components/` is imported by at least one page or area view (the inverse of `DEF-010-001`); written to fail today for the six

**Checkpoint**: US4 demonstrable — a generation started from the screen persists and is readable
after a restart, and no built component is unreachable.

---

## Phase 7: User Story 5 — I can see and manage what was provisioned (P2) — F-041.7

**Goal**: `BR-0010` — the provisioning panel and the credentials screen.

**Independent test**: [quickstart.md](./quickstart.md) Scenario 5's screen states; Scenario 10's
list.

- [X] T1378 [P] [US5] Write failing component tests in `frontend/tests/unit/pages/project-provisioning.spec.tsx` — the create form takes `rootPath`, `agentIntegration`, `scriptType` with configured defaults; the credential value is shown **once** with a copy control and is absent after navigation; the panel shows path, integration, script type, Spec Kit tag, extension version and state; `prepared` reads *wait*, `initialisation_pending` reads *run the setup skill*, `failed` names the step (`FR-LPW-050`, `FR-LPW-051`, `FR-LPW-053`)
- [X] T1379 [US5] Extend `frontend/src/pages/Projects.tsx` create form and `ProjectDetail` with the provisioning panel (test: T1378)
- [X] T1380 [P] [US5] Write failing component tests in `frontend/tests/unit/pages/connector-credentials.spec.tsx` — list with label, creator, created, last used, revoked; filter by revoked and label (`PMI-DOC-005`); mint shows the value once; revoke asks for confirmation naming the label; no cell ever renders a value or hash; keyboard reachable at 360 px (`FR-LPW-052`, `UX-0040`)
- [X] T1381 [US5] Implement `frontend/src/pages/ConnectorCredentials.tsx`, and register it with `AccessGrants` under the *Workspace & Administration* area in `frontend/src/shell/area-views.tsx` (test: T1380; `frontend/tests/unit/shell/areas.spec.ts` extended so the area's status stays `delivered` and both are reachable)

**Checkpoint**: US5 demonstrable — everything provisioned or minted is visible, and nothing secret is.

---

## Phase 8: Polish & Cross-Cutting — F-041.8

- [ ] T1382 [P] Write `docs/operator-setup.md` §Local workspace and update `README.md` §Setup with the six variables, `uv` on the worker host, and the two-stack outcome table (conformance: `tests/governance/readme-conformance.spec.ts` `T452`, extended to require the six variables); run [quickstart.md](./quickstart.md) Scenarios 1–13 individually against **both** stacks and record each result with its stack in `specs/041-local-project-workspace/quickstart.md` §Results; measure and record the four performance targets of `research.md` §Performance, including create → open-in-agent under two minutes by a first-time user (`SC-LPW-001`)

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX, XI, XII) — F-041.Z

> `T1385`–`T1393` were allocated on 2026-09-03 by the `/speckit-analyze` remediation (finding
> `I3`): a closure phase written as prose is one `/speckit-implement` cannot tick.

- [ ] T1385 Confirm every implementation task in `specs/041-local-project-workspace/tasks.md` has a passing unit test or conformance check, by running `pnpm test:unit && pnpm test:contract && pnpm test:integration && pnpm test:arch` and recording the counts
- [ ] T1386 **Constitution XI Tier 1 (ALWAYS)** — `T1351`, `T1363`, `T1331`, `T1383` drive provisioning, the connector guard, the durable stores and the route-through generation against the composed `AppModule` in `backend/src/app.module.ts` (integration tests: T1351, T1363, T1331, T1383); prove by inversion: unregister `ConnectorModule` and observe `T1363` fail, then restore it
- [ ] T1387 **Constitution XI Tier 2** — the e2e run under `e2e/` records `docs/uat/EPIC-041-containerised-transcript.md` (Scenario 5 expected) and `docs/uat/EPIC-041-reference-local-transcript.md` (Scenario 4 expected), each naming its stack, neither hand-edited (`SC-LPW-010`, `R-041-12`)
- [ ] T1388 **Two mutation observations recorded** in `specs/041-local-project-workspace/closure.md`: `T1352` fails when `backend/src/modules/projects/project-files.ts` is made to write the credential value (`SC-LPW-003`); `T1363` fails when the project-scope check in `backend/src/modules/connector/connector-auth.guard.ts` is removed (`SC-LPW-006`) — a contract test and an integration test observed failing under mutation, then restored
- [ ] T1389 **Constitution XII** — record in `specs/041-local-project-workspace/closure.md` that the commands producing this Epic's artifacts are **unregistered**, because the registry is mounted by `EPIC-043` behind this Epic's guard; this is the last Epic that can carry the row honestly
- [ ] T1390 **ADRs**: confirm `adr/ADR-0030-local-first-execution-and-integration-contract.md` exists and `adr/ADR-0009-persistent-project-state-vs-ephemeral-execution.md`, `adr/ADR-0024-workspace-fabric-execution-modes.md` carry their dated amendments; move `adr/ADR-0017-interactive-workspace-vs-autonomous-sandbox.md` to **Accepted** and update the row in `adr/README.md`
- [ ] T1391 Run `/speckit-converge`; append any remaining work to `specs/041-local-project-workspace/tasks.md`; triage `specs/041-local-project-workspace/defects/` leaving no open record; re-run `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:arch && pnpm test:governance`
- [ ] T1392 Regenerate `governance/epic-stage-register.md` with `pnpm register:update` and confirm this Epic's derived stage matches its evidence
- [ ] T1393 Promote `local → dev` (no environment skipped) — **needs explicit authorisation naming the environment**, as `EPIC-035`'s closure recorded — and publish `specs/041-local-project-workspace/closure.md`: work completed, work deferred (the `packages/persistence` move recorded in `plan.md` Complexity Tracking; the `BR-` back-fill for `LR-01`, `LR-02`, `LR-11`), the mutation observations, the measured performance figures, and the recommended next command: **`/speckit-specify` for `EPIC-043`**

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T1319` (migration) blocks every Prisma store and the assurance write.
  `T1313`/`T1315` (contract words) block US3. `T1317` (bundle) blocks the prepare step's
  `copy_setup_skill`
- **Foundational (Phase 2)**: blocks nothing in US1–US3 *technically* — provisioning does not use
  tasks or runs — but `D-47` orders it first because `M0` (a generation that persists) is the first
  demonstrable milestone and the repairs are owed under any model
- **US1 (Phase 3)**: Phase 1. **MVP.** `T1342` needs `T1334`, `T1336`, `T1338`, `T1341`;
  `T1346` needs `T1345`
- **US2 (Phase 4)**: Phase 1 and `T1350` (a credential needs a provisioned project). `T1360` needs
  `EPIC-028`'s `TrustedPrincipalFactory` and `PrincipalRegistryService` — both exist
- **US3 (Phase 5)**: `T1313`, `T1315`, `T1319`. Independent of US1/US2
- **US4 (Phase 6)**: Phase 2 (the stores the screens now reach) and `T1374`
- **US5 (Phase 7)**: US1 and US2 routes; `T1374`
- **Polish, Closure**: last

### Cross-Epic dependencies

**Consumes and does not rebuild**: `EPIC-004` non-disclosure and audit; `EPIC-006` projects;
`EPIC-024` owner grant; `EPIC-028` principal registry and trusted context; `EPIC-036` shell areas;
`EPIC-037` registry (assurance is written into its model; the routes stay unmounted until
`EPIC-043`).
**Depended on by**: `EPIC-043` (mounts behind `T1360`'s guard), `EPIC-042` (replaces bundle
v0.1), `EPIC-044`–`EPIC-046`.

### Parallel Example: Phase 1

```text
T1310, T1312, T1314, T1316, T1318      — five test files, no shared source
T1311, T1313, T1315, T1317, T1319      — their implementations, in order
```

### Parallel Example: Phase 3

```text
T1333, T1335, T1337, T1340, T1343, T1344, T1347, T1349, T1351, T1352   — ten tests, written first (T1352 under backend/tests/contract)
T1334 → T1336 → T1338 → T1341 → T1342 → T1348 → T1350                 — the API side, in order
T1345 → T1346                                                         — the worker side
```

---

## Implementation Strategy

**MVP is User Story 1** — a project becomes a directory, refusals write nothing, and a host
without the initialiser says *initialisation pending*. It is the MVP because every later Epic of
the replan assumes the directory exists; nothing else in this Epic has anywhere to land until it
does.

**Phase 1 is where two words stop being prose**: `controlled-local` as a kind the execution
contract can name, and `assurance` as a value derived by a total function. Neither has a runtime
component; both are what let `EPIC-043` register an execution from a developer's machine without
lying about where it ran.

**Phase 2 is the 20 %.** The worker persistence barrel (`T1321`) and the three Prisma store
bindings (`T1325`, `T1327`, `T1329`) are code, not prose, and they are owed under any execution
model. `T1330` is the test that makes the repair permanent: it reads the composition roots and
fails the moment a store factory can hand back an in-memory implementation again.

**The riskiest tasks are `T1339` and `T1352`**, for the same reason: they write into a directory
the user owns and will commit. `T1339`'s resume-without-repeating logic is the difference between an
interrupted provisioning and a corrupted repository; `T1352` is the check that a credential never
lands in it. Both are mutation-tested at closure, and neither may be weakened to pass.
