# Implementation Plan: Local Project Workspace

**Epic**: `EPIC-041` · **Branch**: `epic/041-local-project-workspace` · **Date**: 2026-09-03

**Spec**: [spec.md](./spec.md) (clarified 2026-09-03) · **Research**: [research.md](./research.md)

**SRS References**: `SRS/PMI-DOC-007_Local_First_Replan_v1.0` §2–§3, §7 (`EPIC-041` brief), §9.3
(`LR-01`, `LR-02`, `LR-11`) · `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` §6.14
(`BR-0132`, `BR-0133`, `BR-0135`), §6.22 (`BR-0201`, `BR-0202`), §6.2 (`BR-0010`) ·
`SRS/PMI-DOC-004B` §2.1

**Input**: Feature specification from `specs/041-local-project-workspace/spec.md`

## Summary

A project in PMI Studio becomes a real directory on the developer's machine. Provisioning runs in
**two steps in two processes**: the API **prepares** the directory (git, `.pmi/project.json`, a
merged `.mcp.json`, the setup skill) and the worker **initialises** it (Spec Kit at a pinned tag,
the PMI extension). The split is not a convenience — it is where the platform's engine boundary
falls (`R-041-1`), and it lands exactly on the clarified requirement that a host without the
initialiser leaves the project honestly *initialisation pending* for the setup skill to finish.

A **project-scoped connector credential** is minted once, stored as a digest, and resolves to a
non-human `Principal`, so the same identity model answers *who is acting* for humans, agents and
connectors (`R-041-3`). **Controlled-local** becomes a kind the execution contract can name, and
every execution carries an **assurance** derived from its surface (`R-041-4`, `R-041-5`) — one
field, two values, closing `ADR-0024`'s open item. The Foundational phase repairs the three severed
places nothing local can be demonstrated without: the worker persists (`R-041-6`), tasks, runs and
jobs are durable (`R-041-7`), and a generation can be started from the screen (`R-041-11`).

The plan writes `ADR-0030` and amends `ADR-0009` and `ADR-0024`, as PMI-DOC-007 §9.2 requires;
those records are part of this plan's output, not a later task.

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22 (`ADR-0003`).

**Primary Dependencies**: NestJS 10, Prisma 5.22, BullMQ 5 (the initialise job rides the existing
queue). **No new runtime dependency.** Token generation and hashing use `node:crypto`
(`R-041-3`); file operations use `node:fs/promises`; `git init` and `uvx … specify init` are
invoked as tools through `node:child_process` — the former from the API, the latter **only** from
the worker via `engine-adapters/speckit` (`R-041-1`, `R-041-8`). One new **workspace** package,
`@pmi/workspace-bundle` (`R-041-9`), which is content, not a dependency. `worker` gains a
`workspace:*` dependency on `@pmi/backend` through a narrow exported barrel (`R-041-6`).

**Storage**: PostgreSQL 16 via Prisma. **Two new tables** (`provisioning_records`,
`connector_credentials`), **five new columns** on `projects`, **one** on `executions`, one enum
member each on `JobKind` and the principal `kind` vocabulary. Additive migration
`<ts>_epic041_local_workspace`. Plus the file system under `PMI_PROJECTS_ROOT` — a store the
platform writes to and never reads content back from (`FR-LPW-011`).

**Testing**: Vitest 2.1 — `backend-unit` (services with in-memory stores and a temp-dir file
system), `backend-integration` (Testcontainers PostgreSQL, gated by `DOCKER_UNAVAILABLE=1` as the
sibling Epics are), `architecture` (two new checks: `durable-stores.spec.ts`; the engine-independence
check unchanged and load-bearing), `governance` (file-shape conformance for `.pmi/project.json` and
`.mcp.json`), `frontend`, and `e2e` for the Tier 2 transcripts (`R-041-12`).

**Target Platform**: Linux server and Windows developer machines (`scriptType: ps` is a first-class
choice, not an afterthought), browser. **This Epic delivers a journey** — create → provision →
open in the agent — so Constitution XI Tier 2 applies.

**Project Type**: backend module (`projects` extended, `connector` new) + worker job + two contract
packages + one content package + two screens in existing application-shell areas.

**Performance Goals**: prepare p95 < 2 s; initialise p95 < 90 s (first `uvx` fetch dominates);
credential verification < 5 ms on every call; create → open in agent < 2 min (`SC-LPW-001`). Table
and reasoning: `research.md` §Performance.

**Constraints**: `backend/src` may not contain the string `speckit` (`engine-independence.spec.ts`) —
this is the constraint that shapes the whole design; the credential value exists only in the
response that minted it and the user's environment (`FR-LPW-021`, `FR-LPW-024`); the containerised
stack runs no worker (`docker-compose.yml`), so under it every project is *initialisation pending*
by construction (`R-041-1`).

**Scale/Scope**: one projects root per platform instance, designed for 1,000 projects; 35
functional requirements in five groups; two screens; two Tier 2 transcripts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes produced only via Spec Kit commands | **PASS** — `ADR-0030` and the two amendments are governance records under `adr/`, written by this command as PMI-DOC-007 §9.2 directs; no application code is touched by the plan |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — PMI-DOC-007 is in `SRS/`; three requirements rest on provisional `LR-` identifiers with the `BR-` back-fill recorded under Assumptions (`D-46`/`D-47` pattern) |
| III | Epic → Feature → Task; `specs/041-local-project-workspace/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the Epic exit gate | **PASS** — in the Exit Criteria |
| V | Every implementation task carries a failing-first unit test; document outputs carry a conformance check | **PASS** — planned in `/speckit-tasks`; the two written files get governance conformance checks (`R-041-10`) |
| VI | `specs/041-local-project-workspace/defects/` is the sole defect intake | **PASS** — created at specify, tracked in git |
| VII | local → dev → stage → prod, no environment skipped | **PASS** |
| VIII | Session labelled with the working Epic | **PASS** — branch `epic/041-local-project-workspace` |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched into one questionnaire | **PASS** — five asked at once on 2026-09-03, all recommendations accepted, no follow-up round needed |
| XI | Tier 1 always; Tier 2 for a journey | **PASS** — Tier 1 through the real routes (`POST /projects`, `/provision`, `/connector-credentials`, `GET /connector/whoami`) against the composed `AppModule`; Tier 2 planned as two run-generated transcripts, one per stack (`R-041-12`) |
| XII | Governed commands registered in PMI Studio before executing | **PARTIAL** — see Complexity Tracking |
| — | Repository synced from GitHub before work started | **PASS** — fetched 2026-09-03; `origin/main` is behind local, nothing to integrate |
| — | No other Claude session active on this checkout | **PASS** — twelve worktrees exist for other Epics; this checkout is on this Epic's branch alone |

**Post-Phase 1 re-check**: unchanged. The design added one gate consideration and resolved it:
`R-041-6`'s worker → backend edge was checked against Gate I's architectural claim (engine
independence) and against `transport-independence.spec.ts`; the edge points the permitted way
(worker depends on backend, never the reverse) and is confined to a two-export barrel.

## Project Structure

### Documentation (this feature)

```text
specs/041-local-project-workspace/
├── spec.md                          clarified 2026-09-03
├── plan.md                          ← this file
├── research.md                      R-041-1 … R-041-12
├── data-model.md                    2 tables, 5 + 1 columns, 2 enum members, 3 contract additions
├── contracts/
│   ├── provisioning-api.md          routes, refusals, the connector guard
│   ├── project-files.md             .pmi/project.json · .mcp.json · setup skill v0.1 · extension v0.1
│   └── local-fabric-mode.md         ExecutionEnvironmentKind · ExecutionAssurance · assuranceFor()
├── quickstart.md                    14 scenarios, each naming its stack
├── checklists/requirements.md
└── defects/                         Constitution VI intake
```

### Source Code (repository root)

```text
backend/src/modules/projects/
├── projects.module.ts               + provisioning providers, PROJECTS_ROOT config token
├── projects.controller.ts           + POST :id/provision · GET :id/provisioning · extended POST / GET
├── projects.service.ts              + rootPath, agentIntegration, scriptType on create
├── provisioning.service.ts          FR-LPW-002…013 — the PREPARE steps; names no engine
├── projects-root.ts                 FR-LPW-005, FR-LPW-007 — root resolution, refusal, host/container mapping (R-041-2)
├── project-files.ts                 FR-LPW-009 — .pmi/project.json writer, .mcp.json merger (R-041-10)
├── provisioning.store.ts            ProvisioningRecord: interface, in-memory (tests), Prisma
└── provisioning.types.ts            ProvisioningState, step vocabulary (data-model.md §2.1)

backend/src/modules/connector/                        NEW module
├── connector.module.ts
├── connector-credential.service.ts  FR-LPW-020…028 — mint, list, revoke; digest; principal binding (R-041-3)
├── connector-credential.store.ts    interface, in-memory, Prisma
├── connector-auth.guard.ts          Bearer → TrustedPrincipalContext; 401/404/403 mapping
└── connector.controller.ts          POST/GET credentials · revoke · GET /connector/whoami

backend/src/modules/tasks/tasks.store.prisma.ts               R-041-7 — PrismaTaskStore
backend/src/modules/runs/runs.store.prisma.ts                 R-041-7 — run, question, marking, override stores
backend/src/modules/specifications/generation-job.ledger.prisma.ts   R-041-7 — over PrismaJobStore
backend/src/modules/{tasks,runs,specifications}/*.module.ts   factories select Prisma under DATABASE_URL
backend/src/worker-api.ts                                     R-041-6 — the two-export barrel
backend/package.json                                          + "exports": { "./worker-api": … }
backend/prisma/migrations/<ts>_epic041_local_workspace/       data-model.md §1–§6
backend/tests/architecture/durable-stores.spec.ts             FR-LPW-043

worker/src/main.ts                   R-041-6 — real JobPersistence replaces the throw
worker/src/provisioning.consumer.ts  the INITIALISE job: run_spec_kit_init · copy_extension · register_hooks · verify_structure
worker/src/engine-composition.ts     composes LocalSpecKitInitialiser from engine-adapters/speckit

engine-adapters/speckit/src/local-init.ts     R-041-8 — uvx … specify init --here, on the host

packages/execution-contract/src/index.ts             ExecutionEnvironmentKind, descriptor.kind (R-041-4)
packages/execution-registry-contract/src/contract.ts ExecutionAssurance, assuranceFor() (R-041-5)
packages/workspace-bundle/                           NEW — skills/setup-PMIStudio/SKILL.md (v0.1), extension/ (v0.1), index.ts
execution-providers/docker/src/index.ts              descriptor.kind = 'managed-isolated'; refusal unchanged

frontend/src/services/api.ts         + generateSpecification, startRun, provisionProject, listProvisioning,
                                       listConnectorCredentials, mintConnectorCredential, revokeConnectorCredential
frontend/src/pages/Projects.tsx      create form: rootPath, agentIntegration, scriptType; credential shown once;
                                       ProjectDetail: provisioning panel, Generate specification + JobProgress
frontend/src/pages/Specification.tsx mounts LifecycleControls, ValidationFindings, VersionHistory, VersionDiff (R-041-11)
frontend/src/pages/ConnectorCredentials.tsx   NEW — list, mint, revoke; filterable
frontend/src/shell/area-views.tsx    Workspace & Administration gains ConnectorCredentials + AccessGrants

docker-compose.yml                   app: volume ${PMI_PROJECTS_ROOT_HOST}:/projects; env PMI_PROJECTS_ROOT=/projects,
                                       PMI_PROJECTS_ROOT_HOST=${PMI_PROJECTS_ROOT_HOST}
.env.example                         PMI_PROJECTS_ROOT, PMI_PROJECTS_ROOT_HOST, PMI_SPECKIT_TAG, PMI_MCP_SERVER_VERSION
e2e/                                 EPIC-041 journey → docs/uat/EPIC-041-<stack>-transcript.md (R-041-12)
tests/governance/project-files.spec.ts        FR-LPW-009 conformance: shape, no credential pattern

adr/ADR-0030-local-first-execution-and-integration-contract.md   NEW (this plan)
adr/ADR-0009-…md · adr/ADR-0024-…md · adr/ADR-0017-…md · adr/README.md   amended (this plan)
```

**Structure Decision**: the provisioning logic lives in the existing `projects` module because a
root path is an attribute of a project, not a separate aggregate; the credential gets its own
`connector` module because `EPIC-043` will mount routes behind its guard and should depend on one
module rather than on `projects`. Everything that names Spec Kit is under `worker/`,
`engine-adapters/speckit/` or the new content package — never `backend/`.

## Phase 0 — Research

Complete: [research.md](./research.md), twelve decisions. Context7 was available; the Spec Kit
initialiser flags, the extension manifest shape and Claude Code's project-scoped `.mcp.json` format
were each read from current documentation and the library IDs recorded per decision.

The decision that shapes everything else is `R-041-1`: **the prepare/initialise split is the engine
boundary**. It was not chosen for elegance — the architecture test that keeps `backend/src` free of
the string `speckit` makes any other placement of `specify init` a build failure — and it happens to
land precisely on the clarified requirement that a host without the initialiser records
*initialisation pending* rather than failing. The containerised stack, which runs no worker, is the
case that makes this real rather than theoretical.

## Phase 1 — Design & Contracts

Complete: [data-model.md](./data-model.md), [contracts/provisioning-api.md](./contracts/provisioning-api.md),
[contracts/project-files.md](./contracts/project-files.md),
[contracts/local-fabric-mode.md](./contracts/local-fabric-mode.md), [quickstart.md](./quickstart.md).

**Four shapes carry the guarantees**, in the pattern `EPIC-035` and `EPIC-038` established of
making the failure unrepresentable rather than merely forbidden:

| Guarantee | The shape |
|---|---|
| The credential value is never re-displayed | `ConnectorCredential` has `tokenHash` and `tokenPrefix` and **no value column**; the only place a value exists after minting is the response that minted it |
| *Waiting for the worker* and *needs the setup skill* are different facts | `ProvisioningState` has both `prepared` and `initialisation_pending`; a single "pending" would send the user to the skill while the worker was still working |
| A partial run is inspectable and resumable | `ProvisioningRecord.stepsCompleted` and `filesWritten` are ordered lists from a fixed step vocabulary; resumption starts at the first missing step |
| Assurance cannot be claimed | `assuranceFor(surface)` is total over `EXECUTION_SURFACES` and is the only writer of `Execution.assurance`; a body field of that name is refused |

**The ADR work is done here, not deferred.** `ADR-0030` is written; `ADR-0009` and `ADR-0024`
carry dated amendments in place; `ADR-0017` names its owner and its closing condition; the index
records all four. The specification's exit criterion for these is therefore satisfiable at closure
by inspection.

## Complexity Tracking

| Item | Why it is here | Disposition |
|---|---|---|
| **Gate XII is PARTIAL** | Constitution XII requires governed commands to be registered in PMI Studio before they execute. The registry exists (`EPIC-037`) and is deliberately unmounted until a caller can be authenticated — which is **this Epic's credential and guard**, mounted by `EPIC-043`. The commands producing this Epic's artifacts are therefore unregistered | Recorded, not waived. This is the last Epic that can carry this row honestly: `EPIC-043` closes it, and it depends on this one |
| **Worker → backend dependency** (`R-041-6`) | A new edge in the dependency graph, in a repository that has kept `worker` and `backend` apart | Confined to a two-export barrel (`backend/src/worker-api.ts`) with an `eslint-boundaries` rule allowing exactly that path. The alternative — moving `backend/prisma` into a package — is the better long-term shape and is recorded as a follow-up, not smuggled into a wiring repair |
| **A content package that copies files into a user's repository** (`R-041-9`) | The platform writes into a directory the user owns and commits | Every written file is enumerated in `contracts/project-files.md`; merges never replace; a conformance test reads back what was written; no file may contain a credential |
| **Two stacks give two different provisioning outcomes** (`R-041-1`) | Under the containerised stack a project is always *initialisation pending* | Not a defect — the clarified behaviour. Every transcript names its stack (`R-041-12`), and the screen distinguishes the two states |
| **A route that exists only to be tested** (`GET /connector/whoami`) | Nothing else is mounted behind the guard in this Epic | It is also what the v0.1 setup skill uses to verify a token, so it earns its place; `EPIC-043` mounts the real surface beside it |
| **Provisional identifiers `LR-01`, `LR-02`, `LR-11`** | Three requirements have no `BR-` number until PMI-DOC-004 v2.1 | Back-fill owed by the Project Owner before the release gate; recorded in the spec's Assumptions and `D-47` |

## Related Documents

- [spec.md](./spec.md) — requirements `FR-LPW-001`–`FR-LPW-053`, success criteria, exit criteria
- [research.md](./research.md) — `R-041-1`–`R-041-12`
- [data-model.md](./data-model.md) — tables, columns, enum members, contract types
- [contracts/provisioning-api.md](./contracts/provisioning-api.md) ·
  [contracts/project-files.md](./contracts/project-files.md) ·
  [contracts/local-fabric-mode.md](./contracts/local-fabric-mode.md)
- [quickstart.md](./quickstart.md) — fourteen validation scenarios
- `adr/ADR-0030` (new) · `adr/ADR-0009`, `adr/ADR-0024` (amended) · `adr/ADR-0017` (owned)
- `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` v1.0 · `SRS/PMI-DOC-004B` · `specs/_shared/decisions/D-47`
- `specs/037-governed-execution-registry/contracts/execution-contract.md` — the contract `EPIC-043` mounts behind this Epic's guard
