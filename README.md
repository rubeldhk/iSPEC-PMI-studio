# PMI Studio

A specification-driven engineering platform: requirements become governed specifications, and
specifications become work, with the decisions and evidence retained at every step.

This file is developer setup. It mirrors the Setup block in
[`specs/_shared/quickstart.md`](./specs/_shared/quickstart.md), and
`tests/governance/readme-conformance.spec.ts` (`T452`) asserts it stays in step — a command added
there fails this check until it is added here.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 22 LTS + `pnpm@9.15.9` | Monorepo tooling |
| Docker | PostgreSQL, Valkey, and the engine sandbox |
| PostgreSQL 16 + Valkey 7 | Started by `docker compose`; not installed on the host |
| AI provider credentials | **Only** for the real-engine smoke test. Every other check runs against the fixture adapter |

**Valkey, not Redis** — `ADR-0003`, after the 2024 relicensing. It speaks the same protocol, so
BullMQ and ioredis are unchanged. `docker-compose.yml` defines `postgres` and `valkey`; there is no
`redis` service, and asking for one fails (`DEF-014-001`).

Nothing here requires a Spec Kit installation on your machine — the `specify` CLI and the AI agent
CLI live inside the engine container image.

## Setup

**There are two stacks, and they answer different questions.** Pick deliberately:

| | **Containerised** | **Reference local** |
|---|---|---|
| What you need | Docker and a checkout | Node 22, pnpm, and Docker for the data stores |
| Everything runs | in containers, on **one origin** | API and web on the host, data stores in Docker |
| Hot reload | no — rebuild to see a change | yes |
| Use it for | *"does the product work?"* — UAT, deep links, a clean-machine check | day-to-day development |
| Defined by | `Dockerfile`, `docker-compose.yml` (`EPIC-014` F-11.3) | `specs/036-application-shell/quickstart.md` `T442l` |

> **Any published measurement must say which stack it came from.** `SC-SHL-006`'s recorded p95 of
> 20.5 ms is a measurement of the **reference local** stack, whose composition `T442l` pins exactly.
> A number taken on the containerised stack answers a different question and must not be filed
> against that criterion.

### Containerised — one command

```bash
docker compose up -d --build          # everything, on http://localhost:3000
```

No `pnpm install`, no Node version to match. The API serves the built web client, so `/v1` and the
client share one origin and a deep link like `/runs` survives a refresh.

Seeding is still a command you run, and the image never carries a credential:

```bash
docker compose exec -e NODE_ENV=development \
  -e SEED_USER_EMAIL=dev@pmi.local -e SEED_USER_PASSWORD='choose-something' \
  app pnpm --filter @pmi/backend exec tsx prisma/seed.ts
```

`NODE_ENV=development` is **required for that one command**: the image runs as `production` and the
seed refuses to run under it. That refusal is the point — a seed creates a known account with a
known password, which is right for a developer machine and a backdoor anywhere else.

**One stack per machine.** `docker-compose.yml` pins `container_name` on `postgres` and `valkey`, so
a second project using those names conflicts. Stop one before starting the other.

### Reference local — three terminals

```bash
pnpm install
docker compose up -d postgres valkey
pnpm --filter backend prisma migrate dev
pnpm --filter backend seed          # one workspace, one user
# Three terminals — there is no process runner, and adding one would be a
# dependency change rather than a task decision (DEF-014-002).
pnpm --filter backend dev            # api  :3000
pnpm --filter worker dev             # worker
pnpm --filter frontend dev           # web  :5173 (proxies /v1 to the api)
```

`pnpm --filter backend seed` is what makes the application usable: a migrated database holds no
workspace and no user, so **sign-in is impossible** until it runs. It is idempotent — running it
twice leaves exactly one workspace and one user, and does not rewrite a password you are already
using.

Set the credentials before seeding. There is no default password, so an unset one fails loudly
rather than creating a predictable account nobody chose:

```bash
SEED_USER_EMAIL=dev@pmi.local SEED_USER_PASSWORD='choose-something' pnpm --filter backend seed
```

The seed refuses to run with `NODE_ENV=production`.

### Local workspace — the variables (EPIC-041)

A project can own a **directory on your machine** that PMI Studio prepares and your own agent
works in (`specs/041-local-project-workspace`). Six variables govern the directory and two the
defaults a project gets; `.env.example` carries them all:

| Variable | What it is | Default |
|---|---|---|
| `PMI_PROJECTS_ROOT` | where the **API** writes project directories (inside the container this is the mount) | `/projects` in the containerised stack |
| `PMI_PROJECTS_ROOT_HOST` | the same directory **as your machine sees it** — written into each project's `.pmi/project.json` and mounted by `docker-compose.yml` | required for the containerised stack |
| `PMI_PUBLIC_URL` | the URL the agent on your machine reaches the API at | `http://localhost:3000` |
| `PMI_ENGINE_TAG` | the pinned tag of the engine's local toolkit the initialise step installs | `v0.16.4` |
| `PMI_MCP_SERVER_VERSION` | the MCP server package version written into each project's `.mcp.json` | see `.env.example` |
| `PMI_INITIALISE_WAIT_MS` | how long a *prepared* project waits for a worker before it reads *initialisation pending* | `30000` |
| `PMI_DEFAULT_AGENT_INTEGRATION` | the agent integration a project gets when its creator chooses none | empty: the workspace bundle's default |
| `PMI_DEFAULT_SCRIPT_TYPE` | the script type (`sh` or `ps`) a project gets when its creator chooses none | `sh` |
| `PMI_MCP_SERVER_COMMAND` | development only: a command line that runs the `pmi-studio` server from this checkout instead of the published package | empty: the published `@pmi/mcp-server` |

The credential the agent uses is never written into the directory: `.mcp.json` carries the
reference `${PMI_STUDIO_TOKEN}`, and you set that variable yourself from the value PMI Studio shows
you **once** when the project is created.

**`uv` must be on the worker host's PATH.** The initialise step runs the engine's toolkit at
`PMI_ENGINE_TAG` through `uvx`. What happens depends on which stack you run:

| Stack | Worker | After *Create* the project reads | Then |
|---|---|---|---|
| Reference local, `uv` installed | on the host | *prepared* → **provisioned** (about 25 s on first use, cached after) | open the directory with your agent |
| Reference local, no `uv` | on the host | *prepared* → **failed** at `run_engine_init`, naming `initialiser_unavailable` | install `uv` and provision again |
| Containerised | none reaches your directory | *prepared* → **initialisation pending** after `PMI_INITIALISE_WAIT_MS` | run the setup skill `setup-PMIStudio` from the directory with your agent |

### The `pmi-studio` server — how your agent reaches PMI Studio (EPIC-043)

Your agent starts the MCP server named in the project's `.mcp.json`
(`npx -y @pmi/mcp-server@<PMI_MCP_SERVER_VERSION>`) with `PMI_STUDIO_TOKEN` from your
environment. The server is a client of the platform's REST API and nothing more: every tool is
one route, every refusal comes back as `isError` with a structured code, and the credential travels
only in the `Authorization` header. It reads no file under your directory.

**Milestone M1, in words** (`specs/043-pmi-integration-contract`): create a project with a root
path → copy the credential shown once into `PMI_STUDIO_TOKEN` → open the directory with your
agent → a governed command calls `pmi.execution.register`, reports progress, and completes → the
execution appears on the project screen's **Execution timeline**, with surface `mcp-client` and
assurance `local`. A proposed status transition is approved or refused in PMI Studio, never by the
agent.

| You are | The server runs from | Set |
|---|---|---|
| using a deployed stack | the published `@pmi/mcp-server` package | nothing — `.mcp.json` is complete |
| developing this repository | this checkout (`packages/mcp-server/src/main.ts`) | `PMI_MCP_SERVER_COMMAND=node ./node_modules/tsx/dist/cli.mjs ./packages/mcp-server/src/main.ts` **before** creating the project, so `.mcp.json` carries it |

Publishing `@pmi/mcp-server` under the name `.mcp.json` carries is a condition of promoting
`EPIC-043` out of `local`, not a task inside it.

### The PMI extension, the setup skill and the generated constitution (EPIC-042)

Every governed command your agent runs in a provisioned directory is **registered before it
starts and completed after it ends** without you typing anything: the `pmi` Spec Kit extension
registers a mandatory `before_*`/`after_*` hook for each governed command (`speckit.pmi.begin`,
`speckit.pmi.finish`; `speckit.pmi.progress` after `implement`). The hooks are prompts that call
only the `pmi-studio` tools; they ship no script and never touch a stock skill file — the ten
stock skills stay byte-identical to the toolkit's manifest, which a test proves by digest.

**`/setup-PMIStudio`** (bundle 0.2.0) is the full ten-step check — the project file, `uv`, the
toolkit at the pinned tag, `.specify/`, the extension and its hooks, `PMI_STUDIO_TOKEN` set,
`.mcp.json` with `pmi-studio`, `context7` and `github`, Docker where relevant, Node ≥ 22, and
`pmi.health` — installing only the toolkit, the extension and configuration, guiding for the
rest, and ending with a table on every run. It never asks for a credential value.

**The constitution is generated.** Constraints (principles, constraints, non-goals), the
decomposition policy and the **offline mode** are authored in PMI Studio under
**Governance → Constraints**; `.specify/memory/constitution.md` in every workstation is a render
with a version and a digest. The setup skill and every begin hook refresh a stale file, restore a
missing one, and **ask before replacing a drifted one** (a file matching no render); the project
screen and the Constraints screen show *file differs* until a later report matches. The
*Governed Execution* section is owned by PMI Studio and is the same in every project.

**Offline.** With the default **strict** mode, a governed command stops when PMI Studio is
unreachable. With **provisional** mode (set by the owner), the begin hook writes a durable
record under `.pmi/provisional/` before the command runs, every line about it says *(not
governed)*, and the queue is offered to `pmi.execution.sync` on the next reachable command — a
reservation until `EPIC-037`'s intake ships.

**The first run.** The first `/speckit-specify` in a project (marker `.pmi/first-run`) reads the
decomposition plan, estimates each Epic before writing anything, proposes a split above the task
ceiling for a person to confirm, and runs the stock specify flow once per Epic as its own
execution. Since `EPIC-044` the plan is the project's own Epics (below): one specify per Epic,
requirements assigned to none listed separately, and a confirmed split becomes child Epics.

### Epics and the Spec Journey Board (EPIC-044)

**Epic is a product entity.** Under **Requirement Room → Epics** the project owner creates an Epic
(the platform allocates its number, never reused; the slug follows the title), edits its title and
description, closes it, and assigns requirements to it from the Epic's own screen or from the
requirement list; the specification list names each specification's Epic the same way. A member
reads everything; only the owner writes. Nothing here has a stage field: a **stage is derived from
the project's governed executions**, never stored and never typed — the *Specified* card is the
completed `specify` execution bound to the Epic, and so on through the product profile up to
*Converged*.

**The Spec Journey Board** (**Specifications → Board**) shows one card per Epic in the column of its
derived stage, with the last command (a link to the timeline), the next command or why there is
none, the readiness verdict as a separate claim (*no readiness conditions configured* until a
project configures some), running executions, executions bound to no Epic, a split parent with the
children it became, and a footer naming the derivation package version. There is no manual refresh
and no control that sets a stage.

**One rule, two readers.** The derivation lives in `packages/epic-stage` (`@pmi/epic-stage`, no
runtime dependencies): the contiguity rule, the readiness resolver, the file-tree adapter the
repository's own `governance/epic-stage-register.md` uses, and the execution adapter the board
uses. Its configuration `packages/epic-stage/epic-stage.config.json` is mirrored byte-for-byte as
`governance/epic-stage.config.json` (`G-44-01`); an architecture check keeps the package free of
backend imports and the Epic module free of command-name literals. The register's footer names the
same package version the board shows, so the two cannot silently drift apart.

### Artifact sync and the markdown viewer (EPIC-045)

**What is synced.** The finish hook of every governed command uploads that Epic's markdown set —
`spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `analysis.md`, `quickstart.md`,
and every `.md` under the Epic's `contracts/` and `checklists/`. Each file becomes an **immutable
version keyed by its content digest**: syncing unchanged content stores nothing new, changing a
file adds a version, and no route, tool or screen ever edits or deletes one.

**What is not synced.** `closure.md`, `defects/`, anything outside the Epic directory, anything that
is not markdown in those two sub-directories, and binaries. A file outside the set is refused **on
its own** — the rest of the sync still stores — and the refusal appears on the execution's timeline
with a code, never with the file's content.

**Where to read them.** The Epic detail (**Requirement Room → Epics → open an Epic**) has a
**Files** section: the tree grouped by folder with each file's kind, size, digest and the command
that produced it; opening one renders it read-only with a version picker naming every execution
that delivered each version. The address carries `?file=` and `?version=`, so a link points at
exactly what you are looking at. The Epic's synced `spec.md` also becomes the Epic's
**specification**, which is why the specification list has rows in local-first mode.

**The directory stays authoritative.** PMI Studio is a mirror of what a governed command wrote, and
the record of which execution wrote it. Nothing on these screens creates, uploads, renames, edits or
deletes a file, and the section says so.

**Two variables** (`.env.example` at the repository root carries both, with their defaults and a
line each on what a refusal looks like):

| Variable | Default | What a refusal looks like |
|---|---|---|
| `PMI_ARTIFACT_MAX_BYTES` | `1048576` (1 MiB) | a larger file is refused `too_large`; the command still completes and the other files are stored |
| `PMI_ARTIFACT_MAX_FILES` | `200` | the file past the limit is refused `too_many_files`; the ones before it are stored |
| `PMI_ARTIFACT_SYNC_BODY_BYTES` | `16777216` (16 MiB) | the API's request-body limit; a sync above it is refused **whole** as `413 payload_too_large` — split the set or raise the limit (`DEF-045-001`) |

Both refuse **per file**, never per sync. A file whose content carries something credential-shaped
is refused `credential_shape` and **nothing is stored for it** — the timeline names the shape, never
the value.

### The task board (EPIC-046)

**What is parsed.** The finish hook of a governed `tasks` or `implement` run sends that Epic's
`tasks.md`, and the platform reads its **task lines** into rows bound to the execution that
produced them. A considered line is `- [ ]` or `- [X]` followed by an identifier and a description;
a ticked box means `done` and an empty one means `not_started`, because those are the only two
states a checkbox can express.

**The grammar, and where its settings live.** The identifier shape is the repository's own, read
from `governance/epic-stage.config.json` rather than written here — one definition, so widening it
is one edit (`FR-ESK-025`). All four settings are in `.env.example` at the repository root with
their defaults and a line each on what a refusal looks like: `PMI_TASKS_MAX_BYTES` and
`PMI_TASKS_MAX_LINES` refuse the **whole** sync, so the board keeps the parse it had rather than
half a new one; `PMI_TASK_ID_PATTERN` and `PMI_TASK_DESCRIPTION_MAX` refuse **one line**, which is
listed under *Refused lines* with its number and coded reason while the rest of the file syncs. A
line the parser cannot read is never silently dropped.

**A manual move is a proposal, and never edits the file.** Dragging or choosing a new column opens
a form that requires a reason, and what it sends is a **proposal** — recorded, adjudicated, and
answered with one of six verdicts (`validated`, `applied`, `approval_required`, `refused`,
`inconsistent`, `reconciliation_required`). Nothing PMI Studio does writes to `tasks.md`: the
project directory is authoritative, and a board that edited it would be inventing the fact it is
supposed to be reporting. An agent may propose but may never approve its own proposal
(Constitution XII.6). When a person's status and the file disagree, the board says so on the card
and in an **Open disagreements** list rather than picking a winner quietly; the file wins the moment
it speaks, and the proposal record survives unamended.

**Where to read it.** **Plan & Tasks → an Epic** shows the board: four columns, the latest parse's
header — execution, digest, time, and *lines considered = parsed + refused + duplicates* — the
progress percentage, and the open disagreements. When the latest parse is older than the Epic's
latest run, the header says so and names both times, so a board that is behind is never mistaken
for a current one.

## Tests

```bash
pnpm test:unit          # Vitest — MANDATORY per Constitution V, must be green
pnpm test:contract      # API contract (contracts/platform-api.md)
pnpm test:integration   # Testcontainers: real PostgreSQL
pnpm test:arch          # FAILS if backend/ references a specification engine
pnpm test:governance    # The repository's own rules, as executable checks
pnpm lint
pnpm -r typecheck
```

`pnpm test:arch` deserves attention: it is the mechanism that keeps the platform's central
architectural claim true. If it fails, engine independence has been broken, regardless of whether
anything else still passes.

Two suites are sensitive to machine load rather than to correctness. `tests/integration/scale.spec.ts`
asserts a p95 budget and fails under a fully parallel run while passing alone (`DEF-030-002`,
deferred to `EPIC-015`), and the two container-backed integration specs compete for Docker. Run
`pnpm test:integration` on its own before concluding anything from a failure there.

## Layout

| Path | What lives there |
|---|---|
| `backend/` | The API — NestJS as a transport over framework-free services |
| `frontend/` | The web client |
| `worker/` | Job execution, and the composition root where concrete engines and agents are named |
| `packages/` | Contracts shared across the boundary: engine, agent, execution, loop, room; the `pmi-studio` server, the workspace bundle and the stage derivation (`epic-stage`) |
| `engine-adapters/`, `agent-adapters/`, `execution-providers/` | Implementations, never imported by `backend/` |
| `specs/` | One directory per Epic: specification, plan, tasks, analysis, defects, closure |
| `governance/` | The repository's rules, and the generated Epic stage register |
| `tests/governance/` | Those rules as executable checks |
| `adr/` | Architecture decision records |

## How work happens here

Changes flow through Spec Kit commands rather than ad-hoc edits (Constitution I), and every
implementation task carries a test written first and observed failing (Constitution V). The
repository checks both of those on itself:

```bash
pnpm test:governance
```

`governance/epic-stage-register.md` is **generated** — rebuild it with `pnpm register:update` rather
than editing it. It exits non-zero on the first run and succeeds on the second; the first run writes
the file and then compares against what it replaced.

## Known-red checks

Three checks fail on purpose. Each is red because work is genuinely outstanding, and none should be
skipped or deleted to get a green run:

| Check | Why |
|---|---|
| `T884` — `tests/governance/accessibility-record.spec.ts` | Waits on `T885`, a manual keyboard and screen-reader pass. An agent cannot hear a screen reader, and a record claiming otherwise would fabricate the evidence the check exists to test for |
| `T999u` — `backend/tests/architecture/defect-room-transcript.spec.ts` | Waits on `T999t`, the EPIC-035 Tier 2 journey. It is keyboard-only against a running application, and two of its seven steps refuse in this deployment because `RepairTaskPort` and `TestExecution` are unbound — so the transcript cannot be produced by an agent, and typing one is the fabrication the check tests for. Added to this table on 2026-09-23: it had been red since EPIC-035 while the table said anything else red was a real failure |
| `tests/integration/scale.spec.ts` | Load-sensitive, not broken — see above |

Anything else red is a real failure.
