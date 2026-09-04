# Data Model: Local Project Workspace

**Epic**: `EPIC-041` · **Feeds**: [plan.md](./plan.md) · **Decisions**: [research.md](./research.md)

## 0. The one structural idea

**A directory is a fact the database records, never a fact the database owns.**

`Project.rootPath` says where the directory is; the `ProvisioningRecord` says what was done to it
and when; nothing in these tables holds a byte of what is *in* it. PMI-DOC-007 §2.3 draws the line
— the directory is authoritative for content, PMI Studio for status, decisions and evidence — and
every table below sits on the PMI Studio side of it. The one apparent exception, the connector
credential, is stored as a digest precisely so that the only place the value ever exists is the
user's environment.

All changes are **additive**. Migration: `<ts>_epic041_local_workspace`.

---

## 1. `Project` — five new columns

| Field | Type | Notes |
|---|---|---|
| `rootPath` | `String?` | `FR-LPW-001` — the directory **as the user's machine sees it** (`R-041-2`). Null until provisioning is requested. Unique per workspace: `@@unique([workspaceId, rootPath])` |
| `agentIntegration` | `String?` | the Spec Kit integration chosen at creation (`claude`, `copilot`, …). A parameter, never a default in code (`FR-LPW-006`) |
| `scriptType` | `String?` | `sh` \| `ps`, chosen by the user, never inferred from the path |
| `provisioningState` | `ProvisioningState` | see §1.1. Default `not_provisioned` |
| `provisionedAt` | `DateTime?` | set only on transition to `provisioned` |

### 1.1 `ProvisioningState`

```
not_provisioned ──► prepared ──► provisioned
        │               │
        │               └──► initialisation_pending ──► provisioned
        └──► failed  (from any non-terminal state; carries failedStep on the record)
```

| State | Means | Reached by |
|---|---|---|
| `not_provisioned` | a row and nothing else — today's state for every project | creation |
| `prepared` | directory, git, `.pmi/project.json`, `.mcp.json`, setup skill written; initialise job queued | prepare step succeeded |
| `initialisation_pending` | prepared, and no worker took the initialise job within `PMI_INITIALISE_WAIT_MS` (default 30 s; `R-041-1`) | job wait exceeded — derived from the job ledger's state, not from a timer the API must keep alive |
| `provisioned` | Spec Kit initialised and PMI extension installed | initialise step succeeded — by the worker, or reported by the setup skill through `EPIC-043`'s contract |
| `failed` | a step failed; `ProvisioningRecord.failedStep` names it | any step failed |

**`prepared` and `initialisation_pending` are different facts** and the screen shows them
differently (`FR-LPW-051`): one says *wait*, the other says *run the setup skill*. A single
"pending" state would send the user to the skill while the worker was still working.

A re-run from `failed` or `initialisation_pending` resumes at the first incomplete step
(`FR-LPW-003`, edge case *interrupted run*). A re-run from `provisioned` is a no-op that writes a
record saying so.

---

## 2. `ProvisioningRecord` — new, append-only

| Field | Notes |
|---|---|
| `id`, `workspaceId`, `projectId` | |
| `actorId` | who requested it — a human, always (the setup skill's report arrives through `EPIC-043` and names the connector principal) |
| `correlationId` | carried prepare → queue → initialise (`PP-010`) |
| `startedAt`, `endedAt` | |
| `outcome` | `succeeded` \| `no_change` \| `pending` \| `failed` |
| `stepsCompleted` | `Json` — ordered list of step names from the fixed vocabulary in §2.1 |
| `failedStep` | `String?` — required when `outcome = 'failed'`, CHECKed |
| `failureReason` | `String?` — sanitised; never a path outside the root, never a credential |
| `engineTag` | the tag written (`FR-LPW-008`); null when initialisation did not run. Engine-neutral in the API (`engine-independence.spec.ts` forbids naming the engine in `backend/src`); stored in the column `specKitTag` the Phase 1 migration created, via `@map` |
| `bundleVersion` | `@pmi/workspace-bundle` version copied (`FR-LPW-008`) |
| `filesWritten` | `Json` — relative paths, so a partial run is inspectable (`US1` scenario 5) |

**Append-only, enforced by the database** the way `EPIC-004` enforces audit rows: no `UPDATE`, no
`DELETE`. The project's `provisioningState` is a projection of the latest record.

### 2.1 Step vocabulary

Fixed, ordered, and shared between the prepare and initialise steps so a resumed run knows where it
stopped:

```
check_root · create_directory · adopt_or_init_git · write_project_json · merge_mcp_json ·
copy_setup_skill · queue_initialise │ run_engine_init · copy_extension · register_hooks · verify_structure
```

The bar marks the process boundary (`R-041-1`). Nothing before it names an engine.

---

## 3. `ConnectorCredential` — new

| Field | Notes |
|---|---|
| `id`, `workspaceId`, `projectId` | scope is **one project** (`FR-LPW-020`, `FR-LPW-025`) |
| `principalId` | the `Principal` of kind `connector` this credential authenticates (`R-041-3`) |
| `tokenPrefix` | first 8 characters after `pmi_ct_`, indexed — the lookup key |
| `tokenHash` | `sha256(token)`, hex. **The value is never stored** (`FR-LPW-021`) |
| `label` | `FR-LPW-022` |
| `createdById`, `createdAt` | |
| `lastUsedAt` | `DateTime?` — updated on successful verification, at most once per minute to avoid a write per call |
| `revokedAt`, `revokedById` | `DateTime?`, `String?` — set once, never cleared (`FR-LPW-023`) |

Indexes: `@@index([tokenPrefix])`, `@@index([projectId])`.

**Revocation is a stored fact, not a time comparison** (edge case *clock skew*): verification reads
`revokedAt IS NULL`, nothing else. There is no `expiresAt` column in this Epic (`FR-LPW-028`).

---

## 4. `Principal` — one vocabulary member

`kind` gains **`connector`** beside `agent` and `service` (`R-041-3`). `sponsorUserId` is the
minting owner. No other change; `D-46`'s rule that human identity stays `User` is untouched.

---

## 5. `Execution` — one column

| Field | Notes |
|---|---|
| `assurance` | `ExecutionAssurance` — `managed` \| `local`. **Non-null**, written by the registry from `assuranceFor(surface)` (`R-041-5`), refused if present in the registration body (`FR-LPW-034`) |

Back-fill for existing rows: every existing execution originated from the managed sandbox or the
fixture, so the migration sets `managed` for `surface IN ('managed-sandbox','ci-cd')` and `local`
otherwise, then adds the `NOT NULL` constraint.

---

## 6. `GenerationJob` — one enum member

`JobKind` gains **`initialise_workspace`**. The job's `inputRefs` carry `projectId`, the resolved
write path, `agentIntegration`, `scriptType`, `engineTag` and `bundleVersion`. Its `resultRef` is
the `ProvisioningRecord` id. The existing partial unique index over live jobs per `jobKey` gives
idempotency for free: a second provision request while one is queued joins it.

---

## 7. Tasks, runs, jobs — durable at last

No schema change. `tasks`, `runs`, `recorded_questions`, `provisional_markings`,
`provisional_approval_overrides` and `generation_jobs` already exist as tables; this Epic binds the
stores that were never bound (`R-041-7`). The data-model change is that these tables stop being
empty.

---

## 8. Contract types (not tables)

| Package | Addition |
|---|---|
| `@pmi/execution-contract` | `ExecutionEnvironmentKind = 'managed-isolated' \| 'controlled-local'`; `ExecutionEnvironmentDescriptor.kind` (`R-041-4`) |
| `@pmi/execution-registry-contract` | `ExecutionAssurance`; `assuranceFor(surface: ExecutionSurface): ExecutionAssurance`, total over `EXECUTION_SURFACES` (`R-041-5`) |
| `@pmi/workspace-bundle` *(new)* | `BUNDLE_VERSION`, `skillsDir()`, `extensionDir()` (`R-041-9`) |

---

## 9. Files the platform writes into the directory

Not a database, but a schema all the same — see [contracts/project-files.md](./contracts/project-files.md).
Listed here so the one rule they share is stated once: **no file under the root path may contain
the credential value** (`FR-LPW-024`, `SC-LPW-003`).
