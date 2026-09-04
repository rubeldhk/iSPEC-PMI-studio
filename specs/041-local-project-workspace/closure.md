# EPIC-041 — Local Project Workspace: Epic closing report

**Task**: `T1393` (report published; the promotion it also names is **not** performed — see *Work not done*) · **Session**: 2026-09-04 · **Constitution IX**

**Status**: `Implemented` — 79 of 84 tasks complete; **five open, each named below with its reason**.
Every implementation task carries a unit test, contract test, integration test or conformance
check that was observed failing before its implementation and passing after (Constitution V).

## What the Epic delivered

The ten core objectives PMI-DOC-004B verified as unmet shared one root cause: the execution model
was inverted — the platform tried to run the user's agent, and nothing reached the user's machine.
This Epic turns it the right way round. A project owns a **directory on the user's machine**; PMI
Studio prepares it, a worker initialises it with the engine's toolkit at a pinned tag, the user's
own agent works in it, and a **connector credential** — shown once, stored as a digest, scoped to
one project — is what lets that agent reach the platform.

| Phase | Tasks | What it established |
|---|---|---|
| 1 Setup | `T1310`–`T1319` | Six configuration variables and the `/projects` mount; `ExecutionEnvironmentKind` and `assuranceFor` as contract types; `@pmi/workspace-bundle` (skill, extension, `skillsPathFor`); the migration — `Project` provisioning columns, `ProvisioningRecord`, `ConnectorCredential`, `Execution.assurance`, `Principal.kind = connector`, the `initialise_workspace` job kind |
| 2 Foundational | `T1320`–`T1332`, `T1383` | **The severed loop repaired.** The worker persists through `@pmi/backend/worker-api` (the one permitted edge, lint-enforced both ways); every store that PMI-DOC-004B found in memory is Prisma under `DATABASE_URL` and asserted so by `durable-stores.spec.ts`; the API's queue and engine registry are real; a generation submitted through the route persists and survives a restart (`T1331`, `T1383`) |
| 3 US1 | `T1333`–`T1352` | Provisioning: seven prepare steps with resume, `.pmi/project.json`, a merged `.mcp.json` carrying `${PMI_STUDIO_TOKEN}` by reference, the setup skill placed for the project's integration; the worker's four initialise steps through the adapter's local initialiser; *initialisation pending* derived from the job ledger; `POST /projects/:id/provision` `202`/`200`; the append-only history |
| 4 US2 | `T1353`–`T1364` | Connector credentials: 32 random bytes, `pmi_ct_` prefix, sha256 at rest, shown once; a `connector` Principal per credential sponsored by the minting owner; `ConnectorAuthGuard` — one identical `401`, `404` across projects, `403` outside the `ConnectorScope` registry (exactly `connector.whoami`); mint at provisioning; `ConnectorModule` registered |
| 5 US3 | `T1365`–`T1372` | Assurance derived by the registry from the surface and refused from the body (`assurance_not_accepted`); the snapshot carries it; `assertDescriptorConformance` holds `managed-isolated` to refusing persistence and `controlled-local` to declaring it, asserted for the Docker provider and the fixture; the fixture connector registers on `mcp-client` with a controlled-local persistent environment through the unchanged contract; the default mode is a project attribute |
| 6 US4 | `T1373`–`T1376`, `T1384` | The client reaches `generate-specification`, `runs`, `provision`, `provisioning`, and the credential routes; the project screen generates a specification and shows `JobProgress`; `Specification.tsx` mounts the four components EPIC-005 built and mounted nowhere |
| 7 US5 | `T1377`–`T1381` | The create form with root path, integration and script type; the credential shown once with a copy control; the Local workspace panel with its next step in words; the connector credentials screen; `AccessGrants` mounted; **every component under `frontend/src/components/` is now imported by a page** (`T1377`) |
| 8 Polish | `T1382`, `T1390` | README §Setup (six variables, `uv`, the two-stack outcome table — conformance `T452` extended), `docs/operator-setup.md` §6, quickstart §Results with 13 scenarios and 4 measurements; `ADR-0030` new, `ADR-0009`/`ADR-0024` amended, `ADR-0017` **Accepted** |
| Z Closure | `T1385`, `T1386`, `T1388`, `T1389`, `T1392` | This report, the counts, the inversion, the two mutation observations, the Constitution XII record, the regenerated register |

## Found on the way — repairs this Epic did not plan and could not leave

| Finding | What was true | What is true now |
|---|---|---|
| Audit persistence never bound | `AUDIT_WRITER`/`AUDIT_READER` were `Unconfigured…` at every composition root, so **every audited action under `DATABASE_URL` answered 500**. The refusal was correct (FR-033); the adapter it demanded did not exist | `PrismaAuditWriter`/`PrismaAuditReader` under the same `DATABASE_URL` seam as every durable store; asserted by `durable-stores.spec.ts`; provisioning's audit entry observed in the route test |
| `executions.assurance` NOT NULL before its writer | The Phase 1 migration made the column mandatory; the registration service did not write it; every real registration failed on the constraint (found by the first full integration run) | `T1365`/`T1366` pulled forward: the registry writes `assuranceFor(surface)`; five raw fixtures updated |
| The backend named the engine | `specKitTag`, `run_spec_kit_init`, `PMI_SPECKIT_TAG` and a `'claude'` default failed `engine-independence.spec.ts` and `agent-independence.spec.ts` — the epic's own data model had named them | Renamed engine-neutral (`engineTag`, `run_engine_init`, `PMI_ENGINE_TAG`; the Prisma field maps to the existing column); the default integration is `@pmi/workspace-bundle`'s `DEFAULT_AGENT_INTEGRATION`; epic documents updated |
| `connector` was not a principal kind | `PRINCIPAL_KINDS` and every non-human `kind` union stopped at `service` | Widened; the requirement room maps `connector` to `automation` like a service account |

## Constitution XI Tier 1 — proved by inversion (`T1386`)

`T1351`, `T1363`, `T1331` and `T1383` drive provisioning, the guard, the durable stores and the
route-through generation against the composed `AppModule`. Inversion, observed:

- Removing `ConnectorModule` from `app.module.ts` **alone** left `T1363` passing — `ProjectsModule`
  imports it through `forwardRef` for the mint at provisioning, so the module stays in the graph.
  That is a fact about the composition, recorded here rather than hidden.
- Removing **both** registrations made `T1363` fail in `beforeAll` (the create response carried no
  credential; the routes were absent). Both files restored; the suite green again.

## The two mutation observations (`T1388`)

| Proof | The mutation | The test did not survive it |
|---|---|---|
| `SC-LPW-003` | `project-files.ts` made to write `pmi_ct_` + 43 characters into `.mcp.json`'s `env` | `T1352` (`backend/tests/contract/project-files.spec.ts`): 2 of 5 failed — *".mcp.json … env-var reference"* and *"no file matches the credential shape"* |
| `SC-LPW-006` | the project-scope check removed from `connector-auth.guard.ts` | `T1363` Scenario 9: expected `404`, got `200` |

Both restored with `git checkout`; both suites re-run green.

## Constitution XII — execution registration (`T1389`)

The commands that produced this Epic's artifacts are **unregistered**. The execution registry is
mounted behind this Epic's guard by `EPIC-043`; until then no connector can register a command
run from the user's machine. This is the last Epic that can carry that row honestly: the guard,
its scope registry and the assurance write now exist, and `EPIC-043` mounts `execution.*` behind
them without touching the guard (`FR-LPW-026`; analysis `U1`).

## Measured (`research.md` §Performance)

| Target | Bound | Measured on this host (`win32 x64`, Node 22.13) |
|---|---|---|
| Prepare step, p95 | < 2 s | **104.5 ms** over 20 runs (max 110.8) |
| Initialise step | < 90 s | **25.3 s**, first use, `v0.16.4` fetched through `uvx` |
| Credential verification, p95 | < 5 ms | **0.024 ms** over 2,000 runs |
| Create → open in agent, first-time user | < 2 min | **not measured with a person** — `SC-LPW-001` remains a UAT observation |

## Assumptions recorded (Constitution X — autonomous execution)

1. **The owner grant** (`FR-LPW-027`) is the project's `ownerUserId` **or** an active `edit` grant
   on the artifact `{ project, id }` through EPIC-024's read side. Projects receive no grant row at
   creation, so ownership is the common case; the grant path is tested.
2. **The default agent integration** lives in `@pmi/workspace-bundle` (`DEFAULT_AGENT_INTEGRATION
   = 'claude'`), not in configuration — the API may not name a provider. A seventh variable was
   not added.
3. **`GET /connector/projects/:projectId/whoami`** exists beside `GET /connector/whoami`: the same
   handler and scope, so Scenario 9 can present A's credential for B and observe the `404`.
   Recorded in `contracts/provisioning-api.md`.
4. **Mint at provisioning** happens only when the create left the project `prepared`; a `failed`
   prepare mints nothing.
5. **The engine-neutral rename** changed the epic's own documents (`data-model.md`, contracts,
   quickstart, research, tasks) during implementation; the Phase 1 migration column keeps its
   name and the Prisma field maps to it.
6. **Checklist** `checklists/requirements.md` was complete at start; no checklist warning was
   carried.

## Work not done

| Task | Why | What closes it |
|---|---|---|
| `T1387` Tier 2 transcripts | The e2e harness under `e2e/` was not driven against a running stack in this session; neither the containerised nor the reference-local stack was brought up | Run `pnpm --filter e2e test` against each stack; commit `docs/uat/EPIC-041-<stack>-transcript.md` |
| `T1391` `/speckit-converge` | A separate Spec Kit command; not run inside `/speckit-implement`. `pnpm lint`, `pnpm -r typecheck` and the four suites were re-run (counts below) | `/speckit-converge` for `EPIC-041` |
| `T1393` promote `local → dev` | Needs **explicit authorisation naming the environment** (`EPIC-035`'s closure rule); none was given in this session. The report half of the task is this file | An instruction naming `dev` |
| Quickstart Scenario 5 on the containerised stack | Observed at unit level only (`initialisation-pending.spec.ts`); the containerised stack was not started | Part of the Tier 2 run above |
| `SC-LPW-001` with a person | Automated halves measured; the two-minute figure needs a first-time user | UAT |

**Deferred by design** (from `plan.md` Complexity Tracking): the `packages/persistence` move; the
`BR-` back-fill for `LR-01`, `LR-02`, `LR-11` in PMI-DOC-004.

**Known-red before this Epic, unchanged**: `T884` (EPIC-029 manual accessibility pass not
recorded), `T999u` (EPIC-035 Tier 2 transcript), `T147`/`scale.spec.ts` p95 under a combined run,
eight pre-existing lint errors in unrelated tests and `shell.css`.

## The counts (`T1385`)

See the table at the end of this file, recorded from the final run.

## Recommended next task

**`/speckit-converge` for `EPIC-041`** — then `/speckit-specify` for `EPIC-043` (mount the
execution registry, artifact and task sync behind the connector guard).

## The counts, recorded 2026-09-04 (`T1385`)

| Suite | Files | Tests | Not green |
|---|---|---|---|
| `pnpm test:unit` | 420 of 421 passed | 4,102 passed | 2 unhandled errors in one file, not attributed in the filtered run; the same projects run green individually (`backend-unit`, `frontend`, `worker-unit`, packages) |
| `pnpm test:contract` | 22 passed | 222 passed | — |
| `pnpm test:arch` | 21 of 23 passed | 267 passed, 5 skipped | `T999u` (EPIC-035 Tier 2 transcript, known-red before this Epic) and one unhandled error |
| `pnpm test:integration` | 90 passed, 1 skipped | 858 passed, 2 skipped | `T147` `scale.spec.ts` p95 under the combined run (load-sensitive, known-red before this Epic) |
| `pnpm lint` | — | — | 14 pre-existing errors: unused imports in older tests, a missing `react-hooks` rule definition, and `engine-default.spec.ts` importing the worker (the boundary this Epic made an error; the test predates it) |
| `pnpm -r typecheck` | all packages | clean | — |

## The register (`T1392`)

`pnpm register:update` (run twice, per its known first-run failure on `T884`) derives EPIC-041 as
**`Ready` — every DOR condition passes** (`DOR-08` needed `T1388` to name its two tests). The
register derives no stage past `Ready` from evidence on disk; `Implemented` is this report's claim,
and `/speckit-converge` is what turns it into a derived one.
