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

```bash
pnpm install
docker compose up -d postgres valkey
pnpm --filter backend prisma migrate dev
pnpm --filter backend seed          # one workspace, one user
pnpm dev                             # api :3000, worker, web :5173
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
