# Container stack transcript — EPIC-014 F-11.3

**Epic**: `EPIC-014` · **Tasks**: `T150l` (scenarios), `T150m` (mutations) · **Date**: 2026-08-24/25
**Constitution XI Tier 1** — a real entry point, driven. Not a description of what should happen.

Stack under test: the image built from this repository's `Dockerfile`, run by `docker compose`
against the `postgres` and `valkey` services already in `docker-compose.yml`.

> **The run used a separate compose project** (`-p pmi014val`) with an override that drops the
> `container_name` pins, on ports 3100/5433/6381. **Not** because the deliverable needs it: a UAT
> stack was already running under the pinned names `pmi-postgres` and `pmi-valkey`, and validating
> must not disturb it. See *Findings* — the pins are a real limitation and they are recorded, not
> worked around in the committed file.

---

## §1 Scenarios (`T150l`)

Every line below is a response observed from the running stack.

### Scenario 1 — the stack starts from a clean checkout ✅

```
docker compose up -d --build
  pmi014val-postgres-1   Up (healthy)
  pmi014val-valkey-1     Up (healthy)
  pmi014val-app-1        Up
```

App log:

```
entrypoint: applying migrations
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "pmi_studio", schema "public" at "postgres:5432"
entrypoint: starting the API on 3000
[Nest] LOG [NestApplication] Nest application successfully started
{"service":"api","level":"info","msg":"api.started","port":3000}
```

**No `pnpm install` on the host, no Node version to match.** Docker and a checkout.

### Scenarios 2–4 — one origin, deep links, and the API's own answers ✅

| Address | Status | Content-Type | What it proves |
|---|---|---|---|
| `/v1/auth/me` | **401** | `application/json` | The API answered. Not swallowed by the static handler |
| `/` | **200** | `text/html` | The client is served |
| `/runs` | **200** | `text/html` | **A routed address returns the application — `R-036-3` closed** |
| `/specifications/abc` | **200** | `text/html` | And a *parameterised* one does too |
| `/no-such-place` | **200** | `text/html` | The app loads and shows its own not-found |
| `/v1/no-such-endpoint` | **500** | `application/json` | The API's own answer — see below |

**That last row is a pass, not a failure.** `500` for an unmatched API path is `DEF-001-006`,
`EPIC-001`'s open defect (`ErrorFilter` is a bare `@Catch()`). It is **wrong and deliberately left
visible**: a static fallback configured broadly enough to catch `/v1/**` would have returned `200`
with `index.html` and made the defect invisible, which would have looked like an improvement.

### Scenario 5 — no image contains a credential ✅

Both of `backend/prisma/seed.ts`'s refusals were driven **inside the running container**:

```
$ docker compose exec app  …  tsx prisma/seed.ts
Error: the development seed refuses to run with NODE_ENV=production

$ docker compose exec -e NODE_ENV=development app  …  tsx prisma/seed.ts
Error: seed requires a password — set SEED_USER_PASSWORD
```

The image sets `NODE_ENV=production`, so the first refusal fires by default. Neither was softened to
make the container convenient, which was the whole point (`R-014-6`).

### Scenario 6 — signing in and using the product ✅

```
$ docker compose exec -e NODE_ENV=development \
    -e SEED_USER_EMAIL=uat@pmi.local -e SEED_USER_PASSWORD='…' app  …  tsx prisma/seed.ts
seeded workspace ws_default and user uat@pmi.local
```

> **`quickstart.md` Scenario 6 as written does not work, and this run is how that was found.** It
> says `docker compose exec app pnpm --filter @pmi/backend seed`. That command **fails**, because
> the image runs `NODE_ENV=production` and the seed refuses it. The refusal is correct; the
> instruction was wrong. Corrected by `T150n` in `README.md` and recorded here rather than quietly
> fixed.

### Scenario 7 — the reference local stack still runs ✅

`pnpm --filter @pmi/backend dev` starts, which it did not before this Epic:

```
> tsx watch --env-file-if-exists=../.env src/main.ts
../.env not found. Continuing without it.
```

Before `T150f` the same command died with
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/backend/watch'`.

**`SC-SHL-006`'s recorded p95 of 20.5 ms is a measurement of `EPIC-036` `T442l`'s reference stack,
not of this one.** No timing was taken here, and none should be filed against that criterion.

---

## §2 Mutations (`T150m`)

`T200c`'s standard: a check nobody has seen fail is a check nobody knows works. Each was injected,
observed failing, and reverted.

### Mutation 1 — bake a credential ✅ went red

`ENV SEED_USER_PASSWORD=hunter2` appended to the `Dockerfile`:

```
× T150a · no container artifact carries a credential > Dockerfile assigns no literal secret
  → Dockerfile assigns a literal value to a secret-shaped name
Tests  1 failed | 22 passed
```

Reverted → `Tests 23 passed`.

### Mutation 2 — remove the static fallback ✅ went red

`ServeStaticModule` removed from `AppModule`, image rebuilt:

| Address | With fallback | **Without** |
|---|---|---|
| `/` | 200 `text/html` | **500** |
| `/runs` | 200 `text/html` | **500** |
| `/v1/auth/me` | 401 | 401 *(unaffected)* |

The deep link stops working and the API is untouched — exactly the failure `R-036-3` describes.

### Mutation 3 — unreachable database ✅ went red

`DATABASE_URL` pointed at a host that does not exist:

```
entrypoint: applying migrations
Error: Schema engine error:
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 1: prisma migrate deploy
```

**The API never started** — no `Nest application successfully started`, no `api.started`. `set -e`
aborted before `exec`, which is `R-014-5`'s requirement: an API that starts against an unmigrated
database answers `500` to everything and looks like a broken API rather than a missing migration.

### `T150b`'s evidence is fail-first ordering, not a mutation

It was committed before `T150f` and went red on the **real** fault:

```
× backend:dev runs a file that exists
  → backend:dev runs `tsx --env-file-if-exists=../.env watch src/main.ts`, which tells tsx to
    execute "watch" — and backend/watch does not exist.
× worker:dev runs a file that exists
```

**Two packages, not one.** `R-014-8` and `T150f` named only `backend`; the check found the identical
fault in `worker`. That is the difference between fixing a named instance and deriving the rule.

---

## §3 Findings this run produced

Each was found by **running** the thing, not by reading it.

| # | Finding | Disposition |
|---|---|---|
| 1 | **`worker` has the same broken `dev` script** as `backend` | Fixed in `T150f`. Found by the check, not by the research that motivated it |
| 2 | **Nested `node_modules` were never excluded from the build context.** `.dockerignore`'s `node_modules/` matches the root only; pnpm puts one in every workspace package, full of symlinks Docker refuses: `invalid file request agent-adapters/claude/node_modules/@pmi/agent-contract` | `**/node_modules` and `**/dist` added. **Analysis `U1` concluded this task needed no edit because every *listed* pattern was present — and every listed pattern was. The gap was a pattern nobody had listed** |
| 3 | **`tsconfig.base.json` is required in the build context.** Every package extends `../tsconfig.base.json` and vite resolves it while building `index.html` | Copied in the deps stage |
| 4 | **`node:22-bookworm-slim` has no OpenSSL**, which Prisma's engines need. `R-014-4` named the requirement and the first build did not act on it | `openssl` + `ca-certificates` installed in the base stage |
| 5 | **The `exclude` pattern was wrong twice.** `@nestjs/serve-static@4` matches with **`path-to-regexp@0.2.5`**, where `/v1{*splat}`, `/v1*` and `/v1/*` all **never match** and `/v1(.*)` does. A non-matching pattern does not throw — it excludes nothing | Fixed to `/v1(.*)`. `T150c` now runs the pattern through **the loader's own matcher** instead of asking whether `/v1` is mentioned |
| 6 | **`quickstart.md` Scenario 6's seed command fails** — the image is `NODE_ENV=production` and the seed refuses | Corrected in `README.md` (`T150n`) and recorded in §1 |
| 7 | **`container_name` pins prevent two stacks coexisting** on one machine | **Not changed.** The pins predate this Epic, `contracts/container-stack.md` §1 says those services are not this Epic's to reshape, and `docker exec pmi-postgres …` appears in existing docs. Recorded as a limitation |
| 8 | **The backend typecheck fails in every git worktree**, including `epic-036-application-shell`, and passes on `main`. `RangeError: Maximum call stack size exceeded` in `tsc`, with no error location | **Pre-existing, not this Epic's.** Verified against a clean worktree at the same commit before any change here. Backend typecheck was validated on `main` after merge |

**Finding 5 is the one worth carrying forward.** `T150c` originally asserted that the exclude list
*mentioned* `/v1`. It did — in all three wrong versions. A configuration check that reads a string
where the runtime reads a pattern will pass over every fault that lives in the pattern.
