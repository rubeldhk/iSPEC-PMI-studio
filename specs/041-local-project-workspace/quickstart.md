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
