# Quickstart: the containerised local stack

**Epic**: `EPIC-014` · **Phase**: 1 · **Date**: 2026-08-24 · **Plan**: [plan.md](./plan.md)

How to prove the containerised stack works without reading its code. Scope in
[`D-45`](./decisions/D-45-containerised-local-deployment-lands-in-epic-014.md); interfaces in
[contracts/container-stack.md](./contracts/container-stack.md); decisions in
[research.md](./research.md).

> **This file covers only the scope `D-45` added.** The platform release gate's own validation is
> `T153`, which executes `specs/_shared/quickstart.md` V1–V12 and V14. The two are different
> things and this one does not replace that one.

---

## Prerequisites

Docker, and a checkout. **Nothing else** — that is the point of the Epic.

```bash
docker compose up -d --build
```

**No `pnpm install` on the host, no Node version to match, no `pnpm --filter … dev`.** If any of
those turn out to be required, this Epic has not delivered what it claims.

---

## Scenario 1 — the stack starts from a clean checkout 🎯 MVP

**Proves**: the Epic Exit Criterion *"starts from a clean checkout"*.

From a fresh clone, with no `node_modules` and no prior images:

```bash
docker compose up -d --build
```

**Expected**: three containers running — `postgres`, `valkey` and the application. The application
waited for both healthchecks, ran `prisma migrate deploy` as its own step, then started
(`R-014-5`).

> **Mutation check, required at exit.** Point `DATABASE_URL` at a database that cannot be reached
> and start again. **The stack must fail at the migration step and the API must not come up.** An
> API that starts and then answers 500s is the failure mode `R-014-5` exists to prevent, and it
> looks like a different bug to whoever meets it.

---

## Scenario 2 — one origin, and `/v1` still reaches the API

**Proves**: `R-014-1`, and that the client needed no change.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/v1/auth/me
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/
```

**Expected**: `401` for the first — the API answered, unauthenticated. `200` for the second — the
client's `index.html`.

**Why this is the whole design.** The client never prefixes an absolute API host; in development
`vite.config.ts`'s `server.proxy` makes two servers look like one origin. Here they *are* one
origin. If `/v1` returned `index.html`, static serving has swallowed the API and the `exclude` is
wrong.

---

## Scenario 3 — a deep link survives, which is the point of `R-036-3` 🎯 MVP

**Proves**: the Exit Criterion *"returns the application — not a 404 — for an address the client
routes itself"*; closes [`R-036-3`](../036-application-shell/research.md).

Open `http://localhost:3000/runs`, then **press refresh**. Then open
`http://localhost:3000/no-such-place` directly.

**Expected**: the refresh stays on Runs and the application renders — it does not 404. The unknown
address loads the application, which then shows **its own** not-found page (`EPIC-036`'s
`NotFound`), naming the area if one is specified.

> **This is what `EPIC-036` could not prove.** Its closure record states the Epic does **not**
> demonstrate deep links outside the Vite dev server, because nothing in the repository served the
> built client. `EPIC-029`'s UAT had to hand-roll a static server and a `/v1` proxy in a scratchpad
> for the same reason. When this scenario passes, that gap is closed and `R-036-3` can be marked
> discharged — **by this Epic, in `EPIC-036`'s record**, not by `EPIC-036` retroactively.

> **Mutation check, required at exit.** Remove the static fallback configuration. `/runs` on refresh
> must 404 and this scenario must fail. A fallback nobody has seen fail is a fallback nobody knows
> works (`T200c`'s standard).

---

## Scenario 4 — the API's own 404s are still visible

**Proves**: `contracts/container-stack.md` §2 — the fallback did not hide `DEF-001-006`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/v1/no-such-endpoint
```

**Expected**: whatever the API produces — **today a `500`, which is wrong and is
`EPIC-001`'s `DEF-001-006`**, not this Epic's. What must NOT happen is `200` with `index.html`.

> **Recorded as a deliberate non-fix.** A static fallback configured broadly enough to catch
> `/v1/**` would make this defect invisible and look like an improvement. Leaving a known-wrong
> status visible is better than papering it over from the wrong Epic.

---

## Scenario 5 — no image contains a credential

**Proves**: the Exit Criterion *"No image contains a credential"*; `BR-0173`, `BR-0135`.

```bash
docker compose config
docker run --rm --entrypoint sh pmi-studio-app -c 'ls -a /app | grep -c "^\.env$" || true'
```

**Expected**: the resolved compose file passes `DATABASE_URL`, `VALKEY_URL` and `PORT` **as
environment**, and names no password anywhere. No `.env` inside the image. No
`SEED_USER_PASSWORD` in any layer.

> **Corrected 2026-08-25 (`T150r`, convergence `C2`).** `pmi-studio-app` **did not exist**. The
> `app` service declared `build:` with no `image:`, so Docker named the image from the compose
> project — the checkout directory — making it `ispec-pmi-studio-app` here and something else
> elsewhere. **The command failed for everyone**, in the scenario that proves the property this
> Epic cares most about. `docker-compose.yml` now declares `image: pmi-studio-app`, so the name is
> the repository's rather than the directory's, and `T150s` asserts every documented `docker run`
> names an image the compose file defines.

**And the seed still refuses.** Run it with no password and it must throw *"seed requires a
password"*; run it with `NODE_ENV=production` and it must refuse outright. Both behaviours exist
today in `backend/prisma/seed.ts` and this Epic must not soften either.

> **Mutation check, required at exit.** Add a dummy `ENV SEED_USER_PASSWORD=x` to the Dockerfile.
> The credential conformance check must go red. It is asserted, not reviewed — Constitution V
> requires a non-code output to carry a check that can fail, and a `Dockerfile` is exactly that kind
> of output.

---

## Scenario 6 — signing in and using the product

**Proves**: the stack is actually usable, end to end.

```bash
docker compose exec -e NODE_ENV=development \
  -e SEED_USER_EMAIL=you@pmi.local -e SEED_USER_PASSWORD='choose-something' \
  app pnpm --filter @pmi/backend exec tsx prisma/seed.ts
```

**`NODE_ENV=development` is required for this one command.** The image runs as `production`, and
`backend/prisma/seed.ts` refuses that outright:

```
Error: the development seed refuses to run with NODE_ENV=production
```

**That refusal is the point, not an obstacle** (`R-014-6`). A seed creates a known account with a
known password — right for a developer machine, a backdoor anywhere else — so the image never runs
it and never carries the credential. Overriding the variable for a single interactive command is a
deliberate act by a person, which is exactly the property being protected.

> **Corrected 2026-08-25 (`T150q`, convergence `C1`).** This block previously read
> `SEED_USER_EMAIL=… docker compose exec app pnpm --filter @pmi/backend seed`. **That command
> fails**, and had done since the image existed: the env assignments sat in the *host* shell and
> never reached the container, and `NODE_ENV` was never overridden. `README.md` was corrected when
> the fault was found (`T150n`) and this file — the one whose job is to prove the product runs —
> was not. `T150s` now reads both documents, and would have caught it.

Then sign in at `http://localhost:3000` and reach each delivered area.

**Expected**: sign-in succeeds; the shell renders; navigation works; the breadcrumb names workspace
and project. **The seed is a command you ran**, not something the image did for you (`R-014-6`).

---

## Scenario 7 — the reference local stack still works

**Proves**: `R-014-7`, and the Exit Criterion that `EPIC-036` `T442l`'s stack survives.

With the containerised stack **stopped**, follow `specs/036-application-shell/quickstart.md`'s
reference stack: Vite dev server, `tsx` API on `:3000`, `pnpm --filter @pmi/backend dev`.

**Expected**: it still runs, unchanged — **including `dev`, which is fixed by this Epic**
(`R-014-8`; it currently dies with `Cannot find module '…/backend/watch'`). Hot reload works.

> **Why this scenario exists at all.** `SC-SHL-006`'s recorded p95 of 20.5 ms is a measurement of
> *that* stack, defined precisely by `T442l` because the criterion's scope had been named and never
> defined. The containerised stack is an addition. **A measurement taken on one is not a measurement
> of the other**, and any published number must say which stack produced it.

---

## What this Epic's container scope does not prove, and must not claim to

- **That `dev`, `stage` or `prod` work.** Out of scope. `BR-0090` owns promotion, Constitution VII
  is untouched, and a container on a developer's machine proves nothing about a deployed
  environment.
- **That a split client/API topology works.** The client is served by the API here, by design
  (`R-014-1`). A CDN or separate static host is a different arrangement and is untested.
- **That the release gate has run.** `T151`–`T156` are the gate and are unaffected by this scope
  (`D-45`). They still run last, and they still need fifteen `closure.md` records.
