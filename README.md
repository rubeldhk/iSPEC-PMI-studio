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
| `packages/` | Contracts shared across the boundary: engine, agent, execution, loop, room |
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

Two checks fail on purpose. Each is red because work is genuinely outstanding, and neither should be
skipped or deleted to get a green run:

| Check | Why |
|---|---|
| `T884` — `tests/governance/accessibility-record.spec.ts` | Waits on `T885`, a manual keyboard and screen-reader pass. An agent cannot hear a screen reader, and a record claiming otherwise would fabricate the evidence the check exists to test for |
| `tests/integration/scale.spec.ts` | Load-sensitive, not broken — see above |

Anything else red is a real failure.
