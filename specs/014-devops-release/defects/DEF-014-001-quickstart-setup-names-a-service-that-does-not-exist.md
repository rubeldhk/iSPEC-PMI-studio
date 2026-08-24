# DEF-014-001 — the documented setup command names a service that does not exist

**Epic**: `EPIC-014` (owns developer enablement) · the file is `specs/_shared/`
**Raised**: 2026-08-23 | **Status**: **CLOSED — FIXED 2026-08-23** (`T150`)
**Found by**: writing `README.md` for `T150`, which must match
`specs/_shared/quickstart.md` step for step
**Severity**: **MEDIUM** — step two of the documented setup fails outright. Nothing is at risk, but
a new developer or a UAT operator stops here

## What it is

`specs/_shared/quickstart.md`'s Setup block reads:

```bash
docker compose up -d postgres redis
```

`docker-compose.yml` defines **`postgres` and `valkey`**. There is no `redis` service, so the
command fails with `no such service: redis` and neither container starts — including the Postgres
one that would have.

The Prerequisites table above it has the same problem twice: *"Docker | PostgreSQL, **Redis**, and
the engine sandbox"* and *"**PostgreSQL 16 + Redis** | Via `docker compose`"*.

## Why the compose file is right and the quickstart is wrong

`docker-compose.yml`'s own header says it, and `ADR-0003` decided it:

> Valkey rather than Redis: Redis relicensed away from BSD in 2024, which is a
> commercial-redistribution exposure for this platform. Valkey is the BSD fork and speaks the same
> protocol, so BullMQ and ioredis are unchanged.

So the fix is to the documentation, not to the stack. The service was renamed when `ADR-0003` was
accepted and the quickstart kept the old name.

## How it survived

Nothing executes the quickstart's Setup block. `T153` executes the **validation scenarios** V1–V12
and V14, which begin after the environment is up; the setup steps themselves had no check, and
`README.md` — the other place these commands would have been read — did not exist. `T452` is the
check that closes this: it asserts every command in the quickstart's Setup block appears in the
README, which means a wrong command is now wrong in two places a reader will hit rather than one.

**It does not, and cannot, check that the command works.** A conformance check comparing two
documents catches drift between them, not drift between a document and the stack. Running
`docker compose config --services` and comparing is the check that would have caught this, and it
belongs with `EPIC-001`'s `T009`, which owns the compose file.

## Fix

`specs/_shared/quickstart.md` — `redis` → `valkey` in the Setup command and in both Prerequisites
rows, with `ADR-0003` cited so the next reader does not "correct" it back.

## Links

- `docker-compose.yml` — the two services, and the header explaining the choice
- `adr/ADR-0003` — the decision, and RAID `R-03`
- `specs/014-devops-release/tasks.md` — `T150`, `T452`
