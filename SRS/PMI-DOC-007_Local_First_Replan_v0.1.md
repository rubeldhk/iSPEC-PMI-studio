# PMI-DOC-007 — Local-First Replan: PMI Studio as the Visual Manager of Spec Kit

**Document ID**: PMI-DOC-007 · **Version**: 1.0 · **Status**: APPROVED — by the Project Owner on 2026-09-03 with every §12 default intact (D-1 to D-9); recorded as decision `D-47`
**Owner**: Project Owner (Product) · **Date**: 2026-09-03
**Supersedes**: nothing. **Amends** (on approval): PMI-DOC-004 v2.0 (MINOR → v2.1), `ADR-0009`,
`ADR-0024`; **closes** `ADR-0010`, `ADR-0017`; **adds** `ADR-0030`.
**Input**: the Owner's ten restated objectives of 2026-09-03 and the verification recorded in
[PMI-DOC-004B](./PMI-DOC-004B_Spec_Kit_Visual_Manager_Objective_Verification_and_Replan_v0.1.md).
**Baseline**: commit `62644ba`, 40 declared Epics, constitution v1.6.0, `pnpm test:unit` green
(395 files, 3886 tests).

---

## 0. How to read and use this document

PMI-DOC-004B established *what is wrong*: nine of ten objectives unmet, one root cause — the
platform runs Spec Kit itself in a disposable sandbox, while the objectives require the user's own
AI agent to run Spec Kit in a real project directory with PMI Studio watching. This document is the
*replan*: the target model, the contracts, the domain changes, and six Epic briefs written so that
each can be handed to `/speckit-specify` without further authoring.

It is written **assuming Option A of PMI-DOC-004B §4** (local-first pivot). Every decision the
Owner has not yet taken is listed in §12 with the default this document assumes; striking a default
changes the affected section and nothing else.

**What this document does not do.** It does not declare an Epic, create a `specs/` directory,
change a posture, edit the stage register, or renumber anything. Those are separate governed acts
(`RULE-14`, `ADR-0029`, `FR-ESK-008`). New business requirements are given **provisional
identifiers `LR-nn`** here; they receive `BR-` numbers only in PMI-DOC-004 v2.1, so that no
citation in the corpus points at a requirement that does not yet exist (`G-BRS-03`).

**Method preserved.** The Owner's method is 80 % documentation and AI work, 20 % development and
human work. §10 accounts for every Epic against that split; where the 20 % is unavoidable it says
why.

---

## 1. Product statement

> **PMI Studio is the visual manager of Spec Kit.** A project is a real directory on the
> developer's machine, initialised for Spec Kit by PMI Studio. Requirements, constraints and the
> constitution are authored in PMI Studio and delivered into that directory. The developer's own
> AI agent — Claude Code first, any Spec-Kit-compatible agent by design — runs the `/speckit-*`
> commands there. Every command registers itself with PMI Studio through a governed contract, so
> PMI Studio shows the journey: each Epic's stage, every markdown artifact, and every task on a
> board that moves as the agent works. Around that core, PMI Studio keeps what it already does
> well: the Requirement, Change and Defect Rooms, governed decisions, evidence and audit.

Two sentences state the inversion this replan makes, and they are the whole of it:

| Today (`ADR-0002`, `ADR-0009`) | After this replan (`ADR-0030`) |
|---|---|
| PMI Studio **executes** Spec Kit, in a disposable container, with a credential it holds | The **user's agent executes** Spec Kit, in the user's directory, with the user's credential |
| The database is the only durable state; the workspace is discarded | The **project directory is durable** for content; the database is durable for **status, decisions and evidence** |

Constitution Principle XII already states the operating principle this rests on: *"execute
anywhere through an approved integration; govern, record and trace everything in PMI Studio."*
This replan makes "anywhere" mean, first and by default, *here, on the developer's machine*.

---

## 2. Target architecture

### 2.1 Components

```
Developer machine
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  PMI Studio  (docker compose up — API :3000, web, PostgreSQL, Valkey)            │
│    ├─ Projects · Epics · Requirements · Constraints/Constitution                 │
│    ├─ Execution Registry (EPIC-037, mounted)  ◄──────────────┐                  │
│    ├─ Artifact store · Task store · Rooms · Audit             │                  │
│    └─ Spec Journey Board · Markdown viewer · Task Kanban      │  MCP (stdio)     │
│                                                              │  or REST+token   │
│  <rootPath>/                       ◄─ provisioned by PMI     │                  │
│    ├─ .specify/                        (specify init)        │                  │
│    │    ├─ memory/constitution.md      GENERATED from PMI    │                  │
│    │    ├─ extensions.yml              hooks → speckit.pmi.* │                  │
│    │    └─ extensions/pmi/             the PMI extension     │                  │
│    ├─ .claude/skills/speckit-*/        stock Spec Kit        │                  │
│    ├─ .claude/skills/setup-PMIStudio/  PMI setup skill       │                  │
│    ├─ .mcp.json                        pmi-studio server ────┘                  │
│    ├─ .pmi/project.json                projectId, apiUrl, epic map (no secret)   │
│    └─ specs/<NNN-epic-slug>/  spec.md plan.md tasks.md analysis.md …            │
│                                                                                 │
│  Claude Code (the user's) ── runs /speckit-* ── hooks call pmi-studio tools      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Nothing in this picture is new infrastructure. PMI Studio is the containerised stack that
`docker-compose.yml` already defines. The project directory is what `specify init` already
produces. The only new runtime component is the **`pmi-studio` MCP server**, a small stdio process
started by the user's agent from `.mcp.json`, which is the MCP binding EPIC-037's contract already
specifies (`contracts/execution-contract.md` §3).

### 2.2 The first-run flow, end to end

This is the journey the Owner described, as a sequence. Each numbered step names the Epic that
delivers it.

1. **Create project** in PMI Studio with a name and a root path. PMI creates the directory, runs
   `specify init --here --integration <agent> --script <sh|ps>`, writes `.pmi/project.json`,
   `.mcp.json`, `.specify/extensions.yml`, installs the PMI extension and the `setup-PMIStudio`
   skill, and **mints a project-scoped connector token** shown once. *(EPIC-041)*
2. **Add requirements and Epics** in PMI Studio — Epics group requirements; the baseline is the
   Requirement Room's baseline. *(EPIC-044)*
3. **Add constraints** in PMI Studio's Constraints screen; PMI generates
   `.specify/memory/constitution.md` from constraints + steering + the standing PMI section that
   instructs the agent to register every command. *(EPIC-042)*
4. **Open the directory in Claude Code.** On first launch Claude Code prompts to approve the
   project-scoped `pmi-studio` server from `.mcp.json`. The user runs **`/setup-PMIStudio`**,
   which verifies Spec Kit, `uv`, Node, Docker, the token, Context7 and GitHub MCP, installs or
   guides for each, and ends by calling `pmi.health` so PMI Studio records the workstation as
   connected. *(EPIC-042)*
5. **Run `/speckit-specify` for the first time.** The `before_specify` hook calls
   `pmi.project.decompose`: PMI returns the Epics, their requirements and the decomposition
   policy. The hook shows the proposed plan (one spec per Epic; any Epic whose estimate exceeds
   the ceiling is shown with a proposed split, awaiting the user's confirmation). For each Epic
   the hook registers an execution, the stock specify runs with that Epic's requirement bundle as
   its input, and `after_specify` syncs `spec.md` and completes the execution. *(EPIC-042, 043)*
6. **PMI Studio shows every Epic** on the Spec Journey Board at stage *Specified*, next command
   `/speckit-clarify`, derived from the execution records. *(EPIC-044)*
7. **Each subsequent command** (`clarify`, `checklist`, `plan`, `tasks`, `analyze`, `implement`,
   `converge`) follows the same register → run → sync → complete shape via its hooks. The Epic's
   markdown set is visible under the Epic in PMI Studio after every sync. *(EPIC-043, 045)*
8. **`/speckit-tasks`** produces `tasks.md`; the sync parses it into `Task` rows and the Kanban
   shows them. **`/speckit-implement`** emits `progress-reported` events as tasks are checked;
   cards move automatically. A human moving a card creates a `status-transition-proposed` event,
   never a silent file edit. *(EPIC-046)*
9. **Everything the Rooms already do** — clarifications, decisions, change requests, defects —
   continues unchanged, now linked to executions that actually happened.

### 2.3 Source-of-truth boundaries

This is the table that keeps the two durable stores from fighting. It extends `ADR-0014`.

| Thing | Authoritative in | Mirrored in | Never edited in |
|---|---|---|---|
| Requirement text, Epic membership, baseline | PMI database | `specs/<epic>/spec.md` input bundle (rendered) | the directory |
| Constraints, steering, decomposition policy | PMI database | `.specify/memory/constitution.md` (generated, header says so) | the directory |
| `spec.md`, `plan.md`, `tasks.md`, `analysis.md`, `research.md`, `data-model.md`, `contracts/*`, `checklists/*` | **project directory** (git) | PMI `ArtifactFile` versions, by digest | PMI UI (read-only viewer) |
| Task status | `tasks.md` checkboxes **as observed** by sync and implement events | PMI `Task.status` | PMI UI writes only a *proposal* |
| Execution history, stage, evidence, approvals, audit | PMI database (EPIC-037 event stream) | — | anywhere |
| Connector token | PMI database (hashed) + the user's environment | never a file in the directory | — |

### 2.4 Security model for controlled-local mode

`ADR-0024` calls controlled local *"the weakest link in every invariant"*. This replan accepts
that for the target user (a developer on their own machine) and states the controls explicitly
rather than pretending the sandbox's guarantees carry over:

- **Project-scoped connector token**, minted at provisioning, stored hashed, shown once,
  revocable in the UI, supplied to the MCP server as `${PMI_STUDIO_TOKEN}` from the user's
  environment (`.mcp.json` supports `${VAR}` expansion; the file itself carries no secret).
- **Least privilege by contract**: the token authorises only EPIC-037 operations, artifact sync,
  requirement/constitution reads and task proposals **for one project**. It cannot read another
  project, approve anything, or touch a Room.
- **No AI self-approval** (Constitution XII.6) holds unchanged — the agent proposes, a human
  approves in PMI Studio.
- **Evidence assurance tier**: executions from surface `local-cli` or `mcp-client` are recorded
  with `assurance: 'local'`; managed-sandbox executions keep `assurance: 'managed'`. This closes
  the *Open* item in `ADR-0024` with the smallest possible model: one field, two values.
- **Secret refusal** at intake (`FR-EXR-022`) applies unchanged.

---

## 3. Domain model changes

Additive migrations only, in the style every Epic since EPIC-004 has used. Names are proposals for
the plan step; the plan may rename, not remove.

| Model | Change | Owner Epic |
|---|---|---|
| `Project` | `+ rootPath String?` · `+ agentIntegration String?` (`claude`, `copilot`, …) · `+ scriptType String?` · `+ provisionedAt DateTime?` | 041 |
| `ConnectorToken` *(new)* | `id, projectId, tokenHash, label, createdById, createdAt, revokedAt, lastUsedAt` | 041 |
| `Epic` *(new)* | `id, workspaceId, projectId, number Int, slug, title, description, status, createdAt` · unique `(projectId, number)` | 044 |
| `Requirement` | `+ epicId String?` (nullable relation; a requirement may be unassigned) | 044 |
| `Specification` | `+ epicId String?` | 044 |
| `DecompositionPolicy` *(new)* | `projectId, oneSpecPerEpic Boolean = true, taskCeiling Int = 50, splitRequiresConfirmation Boolean = true, version` | 042 |
| `ProjectConstraint` *(new)* | `id, projectId, kind (principle\|constraint\|non-goal), title, body, order, version, status` | 042 |
| `ConstitutionRender` *(new)* | `projectId, version, digest, renderedAt, content` — what was written to the file, so a hand-edited file is detectable | 042 |
| `ArtifactFile` *(new)* | `id, projectId, epicId?, path, kind (spec\|plan\|tasks\|analysis\|research\|data-model\|contract\|checklist\|other), digest, sizeBytes, content, executionId?, syncedAt` — one row per synced version, immutable | 045 |
| `Task` | wire `PrismaTaskStore`; `+ epicId?` · `+ sourceLine Int?` · `+ sourceDigest` (the `tasks.md` digest the row was parsed from) | 046 |
| `Execution` (EPIC-037) | `+ assurance ('managed'\|'local')` · `+ epicId String?` | 043 |
| `EpicStage` *(projection, not a table)* | derived from `Execution` rows per Epic using the stage config; materialised on read | 044 |

Removed: nothing. `Run`, `GenerationJob`, the sandbox path and every Room model stay.

---

## 4. The integration contract

EPIC-037 already specifies one semantic contract with REST, MCP and SDK bindings. This replan adds
**no new semantics to execution registration**. It adds a second, smaller contract for the inputs
and artifacts the local agent needs, and it mounts both.

### 4.1 MCP server `pmi-studio` (stdio) — tool surface

| Tool | Class | Purpose | Backed by |
|---|---|---|---|
| `pmi.health` | read | Confirms token, project, API version; records workstation as connected | new |
| `pmi.project.context` | read | `projectId`, name, agent integration, epic list with numbers/slugs | new |
| `pmi.requirements.list` | read | Requirements for the project, grouped by Epic, with baseline state | EPIC-007/033 services |
| `pmi.constitution.get` | read | The current rendered constitution and its digest | new (042) |
| `pmi.project.decompose` | read | The decomposition plan for a first specify: per Epic, requirement bundle, estimate, split proposal | new (042) |
| `pmi.execution.register` · `appendEvent` · `complete` · `comment` · `proposeStatus` · `history` · `sync` | write/read | **Exactly EPIC-037's seven MCP tools**, unchanged | EPIC-037 facade |
| `pmi.artifacts.sync` | write | Upload one Epic's markdown set (path, digest, content) bound to an execution | new (045) |
| `pmi.tasks.sync` | write | Parse `tasks.md` into task rows bound to an execution; returns the diff | new (046) |

Rules carried from EPIC-037: every mutating tool requires an idempotency key; refusals return
`isError: true` with `structuredContent`; no tool ever accepts a secret in its arguments.

### 4.2 REST binding

The same operations on `/v1/executions/*` (as specified in EPIC-037 §2) plus:

```text
POST /v1/projects/{id}/provision            create directory, specify init, extension, token   201
POST /v1/projects/{id}/connector-tokens     mint                                              201 (token shown once)
POST /v1/connector-tokens/{id}/revoke                                                          201
GET  /v1/projects/{id}/context              as pmi.project.context                            200
GET  /v1/projects/{id}/requirements?groupBy=epic                                              200
GET  /v1/projects/{id}/constitution                                                           200
GET  /v1/projects/{id}/decomposition                                                          200
POST /v1/projects/{id}/artifacts/sync                                                         201
POST /v1/projects/{id}/tasks/sync                                                             201
GET  /v1/epics/{id}/artifacts · GET /v1/artifacts/{id}                                        200
GET  /v1/epics/{id}/stage                                                                     200
Auth: Authorization: Bearer <connector token>  → principal = connector, scope = one project
```

### 4.3 Why the EPIC-037 controller can now be mounted

It was unmounted because *"nothing can authenticate its callers"* (`DEF-037-001`). The connector
token is that authentication. Mounting requires: a `ConnectorAuthGuard` that resolves the token to
a `Principal` (EPIC-028's registry, which already models non-human principals and delegation),
removal of the request-body `authenticatedPrincipalId` field the header of
`executions.controller.ts` identifies as the defect, and updating the architecture test
`executions-unmounted.spec.ts` to assert *mounted behind the guard* instead of *unmounted*.

---

## 5. The Spec Kit extension and the setup skill

### 5.1 Why an extension, not edited skills

The ten `.claude/skills/speckit-*` files are upstream Spec Kit artifacts, hash-pinned in
`.specify/integrations/claude.manifest.json`. Editing them breaks upgrades and the manifest.
Spec Kit provides an **extension system** for exactly this: an `extension.yml` manifest under
`.specify/extensions/<id>/` declaring commands named `speckit.<id>.<cmd>` and **hooks**
(`before_specify`, `after_specify`, `after_plan`, `after_tasks`, `after_implement`, …) registered
in `.specify/extensions.yml`. The stock `speckit-specify` skill already reads
`.specify/extensions.yml` and runs `before_specify` hooks (see its *Pre-Execution Checks*).

The PMI extension id is **`pmi`**. Commands are `speckit.pmi.*`.

### 5.2 Hook map

| Stock command | Hook | PMI command | Does |
|---|---|---|---|
| `/speckit-specify` | `before_specify` | `speckit.pmi.begin` | If `.pmi/first-run` is present: `pmi.project.decompose`, show the plan, confirm splits, and loop the stock flow per Epic. Otherwise: `pmi.execution.register` for the one command |
| `/speckit-specify` | `after_specify` | `speckit.pmi.finish` | `pmi.artifacts.sync` + `pmi.execution.complete` with output binding (digests) and the mandatory completion comment |
| `/speckit-clarify`, `checklist`, `plan`, `analyze`, `converge`, `constitution` | `before_*` / `after_*` | same two commands | Register; sync the Epic's changed files; complete |
| `/speckit-tasks` | `after_tasks` | `speckit.pmi.finish` + `pmi.tasks.sync` | Parse `tasks.md` into rows |
| `/speckit-implement` | `before_implement` | `speckit.pmi.begin` | Register with `command: implement` |
| `/speckit-implement` | *(in-flight)* | `speckit.pmi.progress` | On each task checkbox change: `pmi.execution.appendEvent` `progress-reported` with the task id |
| `/speckit-implement` | `after_implement` | `speckit.pmi.finish` | `pmi.tasks.sync`, artifacts sync, complete — `partially-completed` when unchecked tasks remain |

Where Spec Kit's hook system does not yet offer a hook the map needs (an in-flight progress hook
during implement), the extension documents the gap and falls back to `after_implement` sync,
which still moves the board — later rather than live. This is recorded as `R-07` in §11.

### 5.3 `/setup-PMIStudio`

A user-invocable skill installed by provisioning into `.claude/skills/setup-PMIStudio/SKILL.md`.
It is idempotent and reports a table at the end. Steps, each *check → install or guide → verify*:

| # | Checks | If missing |
|---|---|---|
| 1 | `.pmi/project.json` present and readable | Stop: this directory was not provisioned by PMI Studio; explain how to create the project |
| 2 | `uv` on PATH | Guide: platform-specific install command; do not run installers silently |
| 3 | `specify` CLI at the version PMI pinned | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@<tag>` |
| 4 | `.specify/` initialised for the recorded agent integration | `specify init --here --force --integration <agent> --script <type>` |
| 5 | PMI extension present and hooks registered | Re-copy from PMI (`pmi.project.context` carries the extension version) |
| 6 | `PMI_STUDIO_TOKEN` in the environment | Guide: where to mint it in PMI Studio and how to export it; never ask the user to paste it into chat |
| 7 | `.mcp.json` lists `pmi-studio`, `context7`, `github` | Write the missing entries (no secrets; `${VAR}` references only) |
| 8 | Docker daemon reachable (only if PMI Studio runs containerised on this machine) | Guide |
| 9 | Node ≥ 22 (for the MCP server) | Guide |
| 10 | `pmi.health` succeeds | Report the reason from `structuredContent` |

Constraint: the skill **installs tooling and writes configuration**; it never enters a credential,
never modifies system settings, and always shows the command before running it.

### 5.4 The generated constitution

`pmi.constitution.get` returns, and provisioning writes, a file with this shape:

```markdown
<!-- GENERATED by PMI Studio from project <id> · constitution version <n> · digest <sha256>
     Do not edit here. Change constraints in PMI Studio → Constraints, then run /setup-PMIStudio
     or any /speckit-* command to refresh. -->

# <Project name> Constitution

## Core Principles
<one ### per ProjectConstraint of kind=principle, in order>

## Constraints
<one ### per kind=constraint>

## Non-goals
<kind=non-goal>

## Decomposition Policy  (rendered from DecompositionPolicy)
- One specification per Epic.
- An Epic whose task estimate exceeds 50 MUST be split before /speckit-tasks; a split is
  proposed by the agent and confirmed by a human.

## Governed Execution  (standing PMI section — Constitution XII, verbatim intent)
Every /speckit-* command run in this project MUST be registered with PMI Studio before it starts
and completed after it ends, through the pmi-studio tools. Never write to PMI Studio's database.
Never approve your own proposed status transition. If PMI Studio is unreachable, stop and say so
(strict mode) unless the project policy permits provisional offline records.

## Steering  (rendered from EPIC-019 steering, resolved for this project)
```

### 5.5 The first-run decomposition algorithm

Inputs: Epics with their requirements; `DecompositionPolicy`. Output: an ordered list of specify
invocations, each with an Epic and a requirement bundle.

1. For each Epic with ≥ 1 baselined or approved requirement, estimate task count: the agent is
   asked for an estimate per Epic **before** writing anything, using the requirement bundle only.
2. If `estimate > taskCeiling`, propose a split into two or more child Epics along functional
   seams; present it; on confirmation, PMI creates the child Epics (numbers allocated by PMI) and
   the parent becomes `kind: parent-design`, exactly the shape rulings D-18/D-19 used by hand.
3. Run stock specify once per delivery Epic; register and complete each as its own execution.
4. Remove `.pmi/first-run`. Subsequent `/speckit-specify` calls are single-Epic and take the Epic
   from `.specify/feature.json` or the argument.

---

## 6. User interface surfaces

Every surface lands in an area PMI-DOC-006 §4.1 already declares; no new area is invented.

| Surface | Area (PMI-DOC-006) | What the user does | Epic |
|---|---|---|---|
| Create project with root path, agent, script type; provision; see token once | Projects | O-1 | 041 |
| Connector tokens list, revoke | Workspace & Administration | security | 041 |
| Epic list and detail; assign requirements to Epics | Requirement Room / Projects | O-2 | 044 |
| Constraints editor; constitution preview and digest; "file differs" warning | Governance | O-3 | 042 |
| Workstation status (last `pmi.health`, extension version, Spec Kit version) | Projects | O-5 | 042 |
| **Spec Journey Board**: Epics as cards in stage columns (Specified … Ready … Implementing … Converged), last command, next command, last execution time | Specifications | O-7 | 044 |
| Specification list gains stage + Epic columns | Specifications | O-7 | 044 |
| Epic detail: file tree of synced artifacts, markdown viewer, version picker, digest | Specifications | O-9 | 045 |
| **Task Kanban**: columns Not started / In progress / Done (and Blocked), cards from `tasks.md`, live movement from implement events, manual move → proposal with reason | Plan & Tasks | O-10 | 046 |
| Execution timeline per Epic (from EPIC-037 history) | Runs → renamed "Executions" | O-8 | 043 |
| Home "Recent engineering activity" gets its source (executions) | Home | closes a `partly-delivered` note | 043 |

Every table gets a filter (PMI-DOC-005). Every screen states its four states (loading, empty,
error, partial — `FR-SHL-060`).

---

## 7. Epic briefs

Each brief is written to be the `$ARGUMENTS` of one `/speckit-specify` invocation, in this
repository's own governed flow, after the Owner approves this document. Requirement identifiers use
the prefix the Epic will own. Task counts are sizing estimates.

### EPIC-041 — Local Project Workspace

**Specify input**: *"Local Project Workspace — a PMI Studio project becomes a real directory on the
developer's machine. Provisioning creates the directory, runs `specify init` for the chosen agent
integration, installs the PMI Spec Kit extension and the setup skill, writes `.pmi/project.json`
and `.mcp.json`, and mints a project-scoped connector token. Adds controlled-local as a Workspace
Fabric mode (`BR-0132`, `BR-0133`) and repairs the four severed wiring points recorded in
PMI-DOC-004B §2.1 as its Foundational phase."*

- **US1 (P1)** As a project owner I create a project with a root path and get a directory I can
  open in my agent, already initialised for Spec Kit.
- **US2 (P1)** As a developer I receive a connector token once, and can revoke it.
- **US3 (P1)** As the platform, a generation submitted through the API is persisted (worker
  persistence connected; tasks and runs on Prisma stores; `generateSpecification` reachable from
  the UI).
- **US4 (P2)** As an administrator I see which projects are provisioned and where.
- **FR-LPW-001..** provisioning is idempotent and refuses a non-empty directory unless told to
  adopt it; **FR-LPW-010** the token is hashed at rest and never written into the directory;
  **FR-LPW-020** `execution-contract` gains `surface: 'local-cli'` and `assurance`.
- **Out of scope**: any UI beyond the create form and the token list; the extension's behaviour
  (042); the MCP server (043).
- **Depends on**: nothing. **Est.**: ~35 tasks. **Human share**: highest of the six — the wiring
  repairs are code, not prose.

### EPIC-043 — PMI Integration Contract: MCP Server and Mounted Registry

**Specify input**: *"PMI Integration Contract — deliver the MCP binding of the EPIC-037 execution
contract as a stdio server `pmi-studio`, add the read tools a local agent needs (project context,
requirements, constitution, decomposition) and the sync tools (artifacts, tasks), and mount the
EPIC-037 REST surface behind connector-token authentication, closing `DEF-037-001` and `ADR-0010`."*

- **US1 (P1)** As an agent I register, report and complete an execution over MCP and see it in
  PMI Studio's execution timeline.
- **US2 (P1)** As the platform I refuse a call whose token is revoked, expired or for another
  project, disclosing nothing about that project.
- **US3 (P2)** As an agent I replay a registration with the same idempotency key and get the
  original.
- **FR-PIC-001** the fixture connector conformance suite (`R-037-10`) passes against the MCP
  server; **FR-PIC-010** parity with REST asserted (`AC-EXR-01`–`04`); **FR-PIC-020** no tool
  accepts or returns credential material.
- **Out of scope**: adjudication (EPIC-030), evidence storage (EPIC-032), any screen except the
  execution timeline.
- **Depends on**: 041 (token). **Est.**: ~30 tasks. **Human share**: small server, one guard.

### EPIC-042 — PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Specify input**: *"PMI Spec Kit Extension — the `pmi` Spec Kit extension with `speckit.pmi.begin`,
`finish` and `progress` commands hooked before and after every governed command; the
`/setup-PMIStudio` skill; the Constraints screen; the generated constitution; the decomposition
policy and the first-run decomposition of requirements into one specification per Epic."*

- **US1 (P1)** As a developer I run `/setup-PMIStudio` and end with a green table or a precise
  instruction for each red row.
- **US2 (P1)** As a developer my first `/speckit-specify` produces one spec per Epic from PMI's
  requirements, proposing a split where the ceiling would be exceeded, and every one is
  registered.
- **US3 (P1)** As a project owner I edit constraints in PMI Studio and the project's constitution
  file is regenerated; a hand edit is detected by digest and shown.
- **US4 (P2)** As a developer any `/speckit-*` command works offline in provisional mode when the
  policy allows, and syncs later.
- **FR-EXT-001** the extension never modifies a stock skill file; **FR-EXT-010** every hook
  degrades to a clear refusal when PMI is unreachable in strict mode; **FR-EXT-020** the
  constitution's *Governed Execution* section is invariant text owned by PMI.
- **Out of scope**: the MCP server itself (043); Kanban (046).
- **Depends on**: 041, 043. **Est.**: ~40 tasks. **Human share**: lowest — almost entirely
  markdown, YAML and templates.

### EPIC-044 — Epic Model and Spec Journey Board

**Specify input**: *"Epic Model and Spec Journey Board — Epic becomes a product entity that groups
requirements and owns specifications; each Epic's stage is derived from its execution records using
the EPIC-026 stage configuration (extracted to a shared package) extended with Implementing and
Converged; the Specifications area shows a board of Epics by stage with last and next command."*

- **US1 (P1)** As a project owner I create Epics and assign requirements; unassigned requirements
  are visible as such.
- **US2 (P1)** As anyone I open the board and see every Epic in its stage with the command that
  put it there and the command expected next.
- **US3 (P2)** As a reviewer I see that reaching a stage and passing a gate are different claims
  (findings shown beside stage, as the register does today).
- **FR-EPB-001** a stage is never written, only derived; **FR-EPB-010** the derivation is the
  same code the governance register uses (`packages/epic-stage`), so this repository's own board
  and the product's board cannot disagree about what a stage means.
- **Out of scope**: DOR conditions for customer projects (later); artifact viewing (045).
- **Depends on**: 043. **Est.**: ~30 tasks.

### EPIC-045 — Artifact Sync and Markdown Viewer

**Specify input**: *"Artifact Sync and Markdown Viewer — every governed command's completion syncs
the Epic's markdown set into PMI Studio as immutable versioned files bound to the execution; the
Epic detail shows a file tree and renders markdown read-only with a version picker."*

- **US1 (P1)** As a stakeholder without a checkout I read the current `spec.md`, `plan.md` and
  `tasks.md` of any Epic in PMI Studio.
- **US2 (P2)** As a reviewer I pick an earlier version and see what a given execution produced.
- **FR-ART-001** files are immutable rows keyed by digest; a re-sync of an unchanged file creates
  no row; **FR-ART-010** the viewer never offers editing; **FR-ART-020** rendering is safe
  (no script execution from markdown).
- **Depends on**: 043. **Est.**: ~20 tasks. Adds one runtime dependency (a markdown renderer) —
  a plan decision per `specs/_shared/dependencies.md`.

### EPIC-046 — Task Kanban with Governed Auto-Status

**Specify input**: *"Task Kanban — tasks are parsed from each Epic's `tasks.md` on sync, shown on a
board in the Plan & Tasks area, moved automatically by implement progress and completion events,
and moved manually only through a status-transition proposal that PMI Studio adjudicates."*

- **US1 (P1)** As a developer I watch cards move while `/speckit-implement` runs.
- **US2 (P1)** As a project owner I see percent complete per Epic and per project.
- **US3 (P2)** As a developer I drag a card and PMI records a proposal with my reason; the file
  is not edited behind my back.
- **FR-KAN-001** the `tasks.md` grammar is stated (`- [ ] T### [P?] …`, the repository's own
  `DS-1`) and a line that does not parse is reported, never dropped; **FR-KAN-010** a manual
  move never writes `tasks.md`; **FR-KAN-020** the board reconciles when a sync and a manual
  proposal disagree, surfacing the conflict.
- **Depends on**: 044, 045. **Est.**: ~30 tasks.

---

## 8. Roadmap and milestones

| Milestone | Contains | Demonstrates |
|---|---|---|
| **M0 — Wiring repaired** | EPIC-041 Foundational phase | A generation submitted from the UI persists; tasks and runs survive a restart |
| **M1 — First execution seen** | EPIC-041 complete, EPIC-043, `/setup-PMIStudio` half of 042 | Create project → open in Claude Code → `/speckit-specify` → execution appears in PMI Studio. **This is the moment the product becomes the objectives.** |
| **M2 — Governed first run** | EPIC-042 complete | Requirements and constraints from PMI; one spec per Epic; constitution generated |
| **M3 — The journey visible** | EPIC-044, EPIC-045 | Spec Journey Board; every markdown file readable under its Epic |
| **M4 — The board moves itself** | EPIC-046 | Kanban driven by implement events |
| **M5 — Rooms reconnected** | small tasks in 033/034/035 | A defect or change request links to the execution that caused it |

Build order: **041 → 043 → 042 → 044 → 045 → 046**; 042 ∥ 044 after 043; 045 ∥ 046 after 044.

**Declaration sequencing** (D-7 default): declare 041, 043 and 042 on approval; declare 044–046
after M1, so their specifications can cite real execution records rather than imagined ones.

---

## 9. Governance and architecture changes

### 9.1 `ADR-0030` — Local-first execution and the PMI integration contract *(new, draft)*

> **Context.** The delivered platform executes Spec Kit in a managed sandbox. The Owner's
> objectives require the user's own agent to execute Spec Kit in a durable local directory, with
> PMI Studio as the record. `ADR-0024` admits controlled local as optional; `ADR-0017` leaves the
> interactive workspace unowned; `ADR-0010` designs an MCP surface with no code.
> **Decision.** Controlled local is the **default** execution mode. The project directory is the
> durable substrate for artifact content; PMI Studio is the durable substrate for status, decisions
> and evidence (§2.3). Agents reach PMI Studio only through the EPIC-037 contract and the read/sync
> tools of §4, authenticated by a project-scoped connector token. Executions carry an assurance tier.
> **Consequences.** The sandbox remains as an optional mode and is not required by any objective.
> Governance is identical across modes at the contract; assurance differs and is recorded, not hidden.
> The 20 % human work concentrates in one place: the wiring repairs of EPIC-041.

### 9.2 Amendments

| Artifact | Change |
|---|---|
| `ADR-0009` | Scope *"volumes are cache only"* to managed mode; add: in controlled-local mode the project directory and its git repository are the durable substrate for content |
| `ADR-0024` | Flip the default: controlled local **MUST**; managed isolated **MAY**; add the assurance tier that closes its *Open* item |
| `ADR-0010` | Close as delivered by EPIC-043; `R-AI-014` resolved as project-scoped tokens |
| `ADR-0017` | Close as owned by EPIC-041 |
| `ADR-0014` | Extend the source-of-truth table with §2.3 |
| Constitution → 1.6.1 (PATCH) | Directory contract: a PMI-managed project's `.specify/memory/constitution.md` is **generated** and not hand-edited. No principle changes; XII is the principle this replan implements |
| PMI-DOC-004 → v2.1 (MINOR) | Assign `BR-` numbers to §9.3; insert release slice **R3-local** between R2 and R3; nothing leaves scope |
| `epic-declarations.json` | On declaration: postures from §9.4 |

### 9.3 New business requirements (provisional identifiers)

| ID | Requirement | Owner Epic | Objective |
|---|---|---|---|
| LR-01 | A project MUST be able to own a local root directory initialised for Spec Kit by PMI Studio | 041 | O-1 |
| LR-02 | A project MUST issue revocable project-scoped connector credentials for agents | 041 | O-4, O-8 |
| LR-03 | Epic MUST be a first-class product entity grouping requirements and owning specifications | 044 | O-2 |
| LR-04 | Project constraints MUST be authored in PMI Studio and rendered into the project's Spec Kit constitution, with drift detectable | 042 | O-3 |
| LR-05 | A setup command MUST verify and, where safe, install the local toolchain and integrations, guiding where it cannot | 042 | O-5 |
| LR-06 | The first specification run MUST decompose the project's requirements into one specification per Epic under a stored decomposition policy with a task ceiling and human-confirmed splits | 042 | O-6 |
| LR-07 | Each Epic's Spec Kit stage MUST be derived from execution records and displayed with last and next command | 044 | O-7 |
| LR-08 | Agents MUST register and complete every governed command through the integration contract (restates `BR-0196`–`BR-0203` for local mode; no new obligation) | 043 | O-8 |
| LR-09 | Every synced artifact MUST be readable in PMI Studio under its Epic, versioned and immutable | 045 | O-9 |
| LR-10 | Tasks MUST be shown on a board that moves automatically from execution events, with manual moves recorded as proposals | 046 | O-10 |
| LR-11 | Executions MUST carry an assurance tier reflecting their execution mode | 043 | security |

### 9.4 Postures for parked work (recorded, not cancelled)

| Epic | Posture | `awaiting` / reason |
|---|---|---|
| EPIC-038 Engineering Context | Held *after the current task block closes* | M3 — retrieval is more valuable once artifacts are synced |
| EPIC-039 Integration Hub | Held | EPIC-043, whose MCP server becomes 039's first registered capability |
| EPIC-040 Metrics & Reporting | Held | M4 — executions and tasks are the data it reports |
| EPIC-031 Decision & Policy Engine | Held | M2 — EPIC-030 adjudication suffices for proposals |
| EPIC-023 / 024 / 025 | Held | managed-sandbox family; optional mode |

---

## 10. Effort against the 80/20 method

| Epic | Documentation & AI work | Human development | Why the human share is what it is |
|---|---|---|---|
| 041 | spec, plan, fabric-mode contract, provisioning runbook | directory service, token guard, **four wiring repairs** | The repairs are owed under any model; nothing is demonstrable while the worker throws |
| 043 | tool contract, parity tests as prose first | MCP server (~600 lines), one guard, unmount → mount | The server is thin because the facade exists |
| 042 | extension manifest, three command files, setup skill, constitution template, policy doc | two small endpoints | Squarely the 80 % |
| 044 | spec, stage config extension | `Epic` migration, board screen, package extraction | Derivation code already exists and is tested |
| 045 | spec, artifact grammar | store, endpoint, viewer component | One new dependency |
| 046 | spec, `tasks.md` grammar, reconciliation rules | parser, board, event listener | Parser is small; the rules are the work |

---

## 11. Risks (RAID extract)

| ID | Risk | Mitigation |
|---|---|---|
| R-01 | Local mode offers weaker isolation than the sandbox | Recorded assurance tier; token scope; XII.6 unchanged; sandbox retained for unattended runs |
| R-02 | Spec Kit upstream changes hook names or the extension schema | Pin the Spec Kit tag in `.pmi/project.json`; `/setup-PMIStudio` verifies the pinned version; the extension declares `requires.speckit_version` |
| R-03 | Windows path and script-type differences (`--script ps`) | Provisioning records the script type; the extension has no shell of its own — it calls MCP tools |
| R-04 | Token leakage into the directory or chat | `.mcp.json` uses `${PMI_STUDIO_TOKEN}`; the setup skill never asks for the value; intake refuses credential material |
| R-05 | `tasks.md` hand-edited between syncs | Digest per sync; conflicts surfaced, never auto-resolved (`FR-EXR-012` pattern) |
| R-06 | Two boards (repository governance register and product board) drift in meaning | One derivation package used by both |
| R-07 | No in-flight hook during `/speckit-implement` | Fall back to `after_implement` sync; board updates late rather than live; record as a known limitation until Spec Kit offers a progress hook |
| R-08 | The stock `speckit-specify` "one feature per invocation" rule | The `before_specify` hook loops the stock flow; it does not change the rule |

---

## 12. Decisions assumed (Owner strikes to change)

| # | Decision | Default assumed here |
|---|---|---|
| D-1 | Option A local-first pivot | **Assumed** |
| D-2 | Transport | **MCP first, REST mounted alongside** |
| D-3 | Constitution source | **PMI is source; file is generated** |
| D-4 | Decomposition policy | **one spec per Epic; ceiling 50; splits confirmed by a human** |
| D-5 | Kanban manual moves | **proposal-gated** |
| D-6 | Park list | **as §9.4** |
| D-7 | Declaration sequencing | **041, 043, 042 now; 044–046 after M1** |
| D-8 *(new)* | Mechanism for PMI-aware commands | **Spec Kit extension with hooks, never edited stock skills** |
| D-9 *(new)* | Assurance model | **one field, two values** (`managed`, `local`) |

Approval of this document with defaults intact is the approval act for D-1 to D-9 and authorises
the `/speckit-specify` flow for EPIC-041, EPIC-043 and EPIC-042.

---

## 13. Related documents

- [PMI-DOC-004B](./PMI-DOC-004B_Spec_Kit_Visual_Manager_Objective_Verification_and_Replan_v0.1.md) — the verification this replan answers
- [PMI-DOC-004 v2.0](./PMI-DOC-004_Business_Requirement_Specification_v2.0.md) — target scope; v2.1 assigns §9.3
- [PMI-DOC-006](./PMI-DOC-006_Application_UX_Architecture_v1.0.md) — the areas §6 lands in
- `../specs/037-governed-execution-registry/contracts/execution-contract.md` — the contract §4 binds
- `../governance/epic-stage.config.json` — the stage model §7 EPIC-044 reuses
- `../adr/ADR-0009`, `ADR-0010`, `ADR-0014`, `ADR-0017`, `ADR-0024`
- `../.specify/memory/constitution.md` v1.6.0, Principle XII
- Spec Kit extension system: `extensions/EXTENSION-DEVELOPMENT-GUIDE.md` and
  `RFC-EXTENSION-SYSTEM.md` in `github/spec-kit`; Claude Code project-scoped `.mcp.json`

## 14. Revision history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-03 | First draft. Assumes PMI-DOC-004B Option A; adds D-8, D-9 |
| 1.0 | 2026-09-03 | **Approved** by the Project Owner, defaults intact. Authorises `/speckit-specify` for EPIC-041, EPIC-043, EPIC-042 (`D-47`) |
