# Quickstart: Local Project Workspace

**Epic**: `EPIC-041` · **Validates**: [spec.md](./spec.md) · **Contracts**:
[provisioning-api.md](./contracts/provisioning-api.md) · [project-files.md](./contracts/project-files.md) ·
[local-fabric-mode.md](./contracts/local-fabric-mode.md)

Fourteen scenarios, run and recorded **individually** at `/speckit-implement`'s polish phase.
**Every recorded result names the stack it came from** — the two stacks answer different questions
here by design (`R-041-1`, `R-041-12`).

## Prerequisites

**Reference local** (worker present — proves the initialise step):

```bash
pnpm install
docker compose up -d postgres valkey
pnpm --filter backend prisma migrate dev
export PMI_PROJECTS_ROOT="$HOME/pmi-projects"; export PMI_PROJECTS_ROOT_HOST="$PMI_PROJECTS_ROOT"
mkdir -p "$PMI_PROJECTS_ROOT"
pnpm --filter backend dev &  pnpm --filter worker dev &  pnpm --filter frontend dev
```

`uv` must be on the worker host's PATH (`R-041-8`). If it is not, Scenario 5 is the expected result
rather than Scenario 4.

**Containerised** (no worker — proves the mount and the pending state):

```bash
PMI_PROJECTS_ROOT_HOST="$HOME/pmi-projects" docker compose up -d --build
```

```bash
pnpm test:unit && pnpm test:arch && pnpm test:integration
```

---

### Scenario 1 — A project with a root path becomes a directory

`FR-LPW-001`, `FR-LPW-002` (prepare half). `POST /projects` with `rootPath: "<root>/alpha"`,
`agentIntegration: "claude"`, `scriptType: "sh"`. **Expect**: `201`; `provisioningState` is
`prepared`; on disk `alpha/.git`, `alpha/.pmi/project.json`, `alpha/.mcp.json`,
`alpha/.claude/skills/setup-PMIStudio/SKILL.md` exist; the response carries a credential value.

### Scenario 2 — A path outside the root is refused with nothing written

`FR-LPW-007`, `SC-LPW-005`. `rootPath: "/tmp/elsewhere"`. **Expect**: `400` naming the projects
root; no project row; `/tmp/elsewhere` untouched.

### Scenario 3 — A non-empty directory is refused by name

`FR-LPW-007`, `FR-LPW-012`. Pre-create `<root>/busy/README.md`. **Expect**: `400` naming
`busy`; `README.md` untouched; no other file written. Then pre-create `<root>/empty-repo` with only
`git init`. **Expect**: `201` — an empty git repository is adoptable.

### Scenario 4 — The initialise step completes on a host with `uv` (reference local)

`FR-LPW-002` (initialise half), `FR-LPW-008`, `SC-LPW-002`. After Scenario 1, wait for the job.
**Expect**: `provisioningState: provisioned`; `.specify/` present with the pinned tag's structure;
`.specify/extensions/pmi/extension.yml` present; `ProvisioningRecord.engineTag` equals
`PMI_ENGINE_TAG`; `bundleVersion` equals the bundle's.

### Scenario 5 — Without a worker, the project is honestly *initialisation pending* (containerised)

`FR-LPW-010`. Scenario 1 against the containerised stack. **Expect**: within the bound,
`provisioningState: initialisation_pending`; `.specify/` absent; the setup skill present; the
project screen says *run the setup skill*, not *wait*.

### Scenario 6 — Re-provisioning changes nothing

`FR-LPW-003`, `SC-LPW-004`. `POST /projects/:id/provision` on a provisioned project. **Expect**:
`200`, `outcome: no_change`, `filesWritten: []`; `git status` in the directory is clean.

### Scenario 7 — An interrupted run resumes without repeating a destructive step

Edge case *interrupted run*. Kill the API after `write_project_json`. Re-request. **Expect**: the
new record's `stepsCompleted` starts at `merge_mcp_json`; `.pmi/project.json` is byte-identical.

### Scenario 8 — The credential value appears in no file under the root

`FR-LPW-024`, `SC-LPW-003`. After Scenario 4, grep the whole directory for `pmi_ct_`. **Expect**:
zero matches; `.mcp.json` contains the literal `${PMI_STUDIO_TOKEN}`. **Mutation**: make the merge
step write the value; the conformance test must fail.

### Scenario 9 — A credential opens exactly one project

`FR-LPW-025`, `SC-LPW-006`. Mint for project A; call `GET /connector/whoami` → A. Call a route for
project B with A's credential. **Expect**: `404`, not `403`. **Mutation**: remove the project-scope
check; the suite must fail.

### Scenario 10 — Revocation is immediate and irreversible

`FR-LPW-023`. Revoke; call `whoami`. **Expect**: `401`, message identical to the unknown-token
message; the list shows `revokedAt` and `revokedById`; audit has one entry; a second revoke is
`200` with no new audit entry.

### Scenario 11 — Minting without the owner grant is refused and audited

`FR-LPW-027`. Sign in as a workspace member without the grant. **Expect**: `403`; audit entry
naming actor and project.

### Scenario 12 — A generation submitted from the project screen persists across a restart

`FR-LPW-040`–`FR-LPW-042`, `SC-LPW-007`, `SC-LPW-008` (reference local, fixture engine). Select
requirements, click *Generate specification*, watch `JobProgress` to completion. Restart API and
worker. **Expect**: the specification, its version, its links and the job's terminal state are all
readable; `pnpm test:arch` includes `durable-stores.spec.ts` green.

### Scenario 13 — An execution's assurance is derived, never accepted

`FR-LPW-034`, `SC-LPW-009`. Through the fixture connector, register with `surface: 'local-cli'`.
**Expect**: the stored execution reads `assurance: local`. Register with `assurance: 'managed'` in
the body. **Expect**: refused naming the field.

### Scenario 14 — The journey, recorded (Constitution XI Tier 2)

`SC-LPW-010`. The e2e run performs Scenarios 1, 4 (reference local) or 5 (containerised), 8 and 9
and writes `docs/uat/EPIC-041-<stack>-transcript.md`. **Expect**: two transcripts committed, each
naming its stack, neither hand-edited.

---

## Results — recorded 2026-09-04 at `/speckit-implement` (T1382)

**Stacks in this session.** Every automated scenario ran through the composed `AppModule` against
a PostgreSQL 16 Testcontainer (the **Tier 1** stack of Constitution XI — the API's own composition
root, a real database, no HTTP proxy), on `win32 x64`, Node 22.13. Scenario 4 ran the worker's
initialise step directly on this host (`uv 0.11.33`). The **containerised** stack (`docker compose
up --build`) and the **reference local** three-terminal stack were **not** brought up in this
session; the rows below say so where it matters.

| Scenario | Stack | Result | Evidence |
|---|---|---|---|
| 1 — root path becomes a directory | Tier 1 | PASS — `201`, `prepared`, `.git/`, `.pmi/project.json`, `.mcp.json`, skill present | `backend/tests/integration/provisioning-route.spec.ts` |
| 2 — path outside the root refused, nothing written | Tier 1 · unit | PASS — `400` names the root; no row | `provisioning-route.spec.ts`, `tests/unit/projects/projects-root.spec.ts` |
| 3 — non-empty directory refused by name; empty git repo adopted | Tier 1 | PASS — `400` / adopted | `provisioning-route.spec.ts` |
| 4 — initialise completes with `uv` | **this host** (the reference-local worker half) | PASS — `run_engine_init`, `copy_extension`, `register_hooks`, `verify_structure` in **25.3 s** (first use, `v0.16.4` fetched) | probe run of `LocalSpecKitInitialiser` with `execFileOnHost`; `.specify/` and `.claude/skills` present |
| 5 — no worker → *initialisation pending* | unit (containerised stack not run) | PASS at unit level — derived from the ledger after `PMI_INITIALISE_WAIT_MS`; **not observed on the containerised stack in this session** | `tests/unit/projects/initialisation-pending.spec.ts` |
| 6 — re-provisioning changes nothing | Tier 1 | PASS — `200`, `no_change`, no file rewritten | `provisioning-route.spec.ts` |
| 7 — interrupted run resumes | unit | PASS — resumes from the failed step; `git init` not repeated | `tests/unit/projects/provisioning.service.spec.ts` |
| 8 — credential value in no file under the root | contract · Tier 1 | PASS — no file matches `pmi_ct_…`; **mutation observed** (T1388) | `backend/tests/contract/project-files.spec.ts`, `connector-credential-route.spec.ts` |
| 9 — a credential opens exactly one project | Tier 1 | PASS — `whoami` → A; B with A's token → `404`; **mutation observed** (T1388) | `backend/tests/integration/connector-credential-route.spec.ts` |
| 10 — revocation immediate, irreversible | Tier 1 | PASS — `401` identical to unknown; one audit entry; second revoke `200` | `connector-credential-route.spec.ts` |
| 11 — minting without the owner grant refused and audited | Tier 1 | PASS — `403`; audit names actor and project | `connector-credential-route.spec.ts` |
| 12 — generation from the project screen persists across a restart | Tier 1 · component | PASS — the route-through persists and survives `rebootApp`; the control mounts `JobProgress` | `generation-persists-through-route.spec.ts`, `survives-restart.spec.ts`, `frontend/tests/unit/pages/project-generate.spec.tsx` |
| 13 — assurance derived, never accepted | unit · Tier 1 | PASS — `assurance_not_accepted`; stored by surface | `backend/tests/unit/executions/assurance.spec.ts`, `tests/integration/executions/` |
| 14 — the journey, recorded | — | NOT RUN — the e2e harness was not driven against a running stack in this session (T1387 open) | — |

**Performance (research.md §Performance), measured on this host:**

| Target | Bound | Measured | How |
|---|---|---|---|
| Prepare step, p95 | < 2 s | **104.5 ms** (max 110.8, min 55.3; 20 runs) | `ProvisioningService.prepare` with real files and `git init`, in-memory stores |
| Initialise step, p95 | < 90 s | **25.3 s** (one run, first use — `uvx` fetched `v0.16.4`) | Scenario 4 probe |
| Credential verification | < 5 ms | **0.024 ms** p95 (max 2.2 ms; 2,000 runs) | prefix lookup + constant-time digest, in memory |
| Create → open in agent, first-time user | < 2 min | **not measured with a person**; the automated path is prepare (about 0.1 s) + initialise (about 25 s) | `SC-LPW-001` remains a UAT observation |
