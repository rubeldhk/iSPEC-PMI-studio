# Research: containerised local deployment

**Epic**: `EPIC-014` · **Phase**: 0 · **Date**: 2026-08-24 · **Plan**: [plan.md](./plan.md) ·
**Scope decision**: [`D-45`](./decisions/D-45-containerised-local-deployment-lands-in-epic-014.md)

This file exists only for the scope `D-45` added. **The rest of this Epic still generates no
research** — the release gate reads records and decides nothing technical, and the previous plan's
judgement stands: an artifact recording *"no decisions"* is an artifact pretending to be work.

---

## `R-014-1` — the client is served by the API, not by a second container

**Decision**: the built web client is served by the **NestJS application itself**, via
`@nestjs/serve-static`. One image, one origin, one port.

**Rationale**: three requirements point the same way and one of them is `R-036-3` itself.

1. **The client assumes `/v1` is same-origin.** `frontend/vite.config.ts` declares
   `server.proxy['/v1'] → http://localhost:3000`, and nothing in the client prefixes an absolute
   API host. In dev the proxy makes one origin out of two servers. A containerised stack must
   reproduce **that topology, not merely that behaviour** — otherwise the client needs a base-URL
   concept it does not have, which is a client change this Epic has no standing to make
   (`FR-SHL-003` is `EPIC-036`'s, but the principle is the same: do not edit another Epic's code to
   fit your deployment).
2. **Unknown paths must return the application.** `ServeStaticModule`'s default `renderPath` is
   `'*'`, which sends `index.html` for anything it does not match — the SPA history fallback, as a
   documented option rather than a hand-rolled rule. `exclude` keeps `/v1` from being swallowed.
   The backend is on **`@nestjs/platform-express`**, so Express's fallthrough applies and the
   Fastify-only `serveStaticOptions.fallthrough: true` caveat does not.
3. **`R-036-3` describes exactly this hole.** `EPIC-029`'s UAT had to serve `dist/` from a
   scratchpad static server *with a hand-rolled `/v1` proxy*, because `vite.config.ts` declares
   `server.proxy` (dev only) and no `preview.proxy`. Serving from the API removes the proxy from
   the problem instead of re-implementing it.

**Alternatives considered**:

- **A second container running nginx, plus a reverse proxy in front.** The conventional answer, and
  correct for a real production topology. Rejected **for local**: it adds an nginx config, a third
  service and a proxy layer to maintain, to solve a problem one documented module option solves. It
  is also the shape that would have to change again the moment a CDN enters the picture — so it
  buys no future-proofing either.
- **`vite preview`.** Rejected: it has no proxy configuration at all (`preview.proxy` is unset,
  which is precisely what `R-036-3` records), and it is a dev-tooling server that its own
  documentation does not offer as a production host.
- **A hash router (`#/runs/abc`)**, needing no server support. Rejected here for the same reason
  `R-036-3` rejected it: it makes every address uglier to work around a deployment gap, and the gap
  now has an owner.

### The `exclude` pattern, and why it needed measuring *(added `T150w`, 2026-08-25)*

**The pattern is `/v1(.*)`. It had to be measured, and two wrong ones shipped before it.**

This decision originally recorded *that* `exclude` keeps `/v1` on the API and never recorded *what*
to write — and the pattern turned out to be the whole difficulty. `@nestjs/serve-static@4` does not
use Express's router for exclusions. It uses **`path-to-regexp@0.2.5`**, in
`dist/utils/is-route-excluded.util.js`, and compares `re.exec(pathname + '/')`. Tested against that
version inside the running container:

| Pattern | Matches `/v1/auth/me`? | |
|---|---|---|
| `/v1{*splat}` | **no** | Express 5 / path-to-regexp 8 syntax |
| `/v1*` | **no** | the Express 4 wildcard — still not this matcher's |
| `/v1/*` | **no** | |
| **`/v1(.*)`** | **yes** | and `/runs`, `/`, `/assets/x.js` correctly do **not** match |

**A non-matching pattern does not throw.** It silently excludes nothing, so every unmatched `/v1`
path returns `index.html` with a `200`, and the client reports a JSON parse error three layers from
the cause. Both wrong patterns looked right and both passed a check that asked only whether the
exclude list *mentioned* `/v1` — which all three versions did.

`T150c` now loads **the same matcher the loader loads** and runs **the same comparison the loader
runs**, asserting that `/v1/…` is excluded and `/runs`, `/` and `/assets/…` are not. The lesson
generalises past this library: **a configuration check that reads a string where the runtime reads a
pattern will pass over every fault that lives in the pattern.**

> **One `unrequested` note, recorded for the next reader** (convergence `F5`). `T150l` created
> `docs/deployment/` for its transcript. No artifact named that location; it mirrors
> `EPIC-029`/`EPIC-036`'s `docs/accessibility/`, so the convention is consistent — but it was
> established by use rather than by decision, and this sentence is the only place that says so.

**What this decision does NOT claim.** Serving static assets from the API process is a **local**
choice. It couples client delivery to API availability and puts no CDN or cache in the path. If a
deployed environment ever wants a separate static host, that is a `dev`/`stage`/`prod` topology
decision, and it is explicitly out of this Epic's scope. Recorded so nobody reads this as the
programme's production answer.

**Docs consulted**: `/nestjs/docs.nestjs.com` — serving a static SPA with `ServeStaticModule`,
`renderPath`, `exclude`, and the Express-vs-Fastify fallthrough difference.

---

## `R-014-2` — `@nestjs/serve-static` is a new dependency, and the register check will say so

**Decision**: add `@nestjs/serve-static` to `backend/package.json` **and** to
[`specs/_shared/dependencies.md`](../_shared/dependencies.md) as **`D-30`**, in the same change.

**Rationale**: `tests/governance/dependency-register.spec.ts` (`TS-001`, built by `EPIC-036`
`T436c`) asserts that **every third-party runtime dependency is named in the register**. Adding the
package without the row turns that check red — which is the check working, not a nuisance.

This is the first time `TS-001` binds a dependency it was not written for, and it is worth stating
plainly: **the check was written by another Epic and now constrains this one.** That is the point of
it.

**Alternatives considered**: serving the client with `express.static` mounted by hand, which needs
no new dependency. Rejected — it re-implements `renderPath`/`exclude` as bespoke middleware, and the
hand-rolled version is what `R-036-3` already found being written into a scratchpad.

**Docs consulted**: `/nestjs/docs.nestjs.com` — `@nestjs/serve-static` installation and
configuration. Register format read from `specs/_shared/dependencies.md`; next free id is `D-30`
(`D-29` is the current maximum).

---

## `R-014-3` — the API container runs from source through `tsx`, and no compiler is added

**Decision**: the image ships the TypeScript sources and runs them with `tsx`, exactly as the host
does today. **No `tsc` build step is introduced.**

**Rationale**: `backend/package.json` declares **no build script** — this is not an oversight, it is
the subject of [`D-40`](./decisions/D-40-runtime-metadata-vs-explicit-tokens.md). That decision
found `emitDecoratorMetadata` set in `tsconfig.base.json` while nothing was compiled by `tsc`, so
`design:paramtypes` never existed at runtime, seven dependencies resolved to `undefined`, and every
product endpoint returned 500 — **found by browser UAT, not by 1000+ green tests**. The answer was
explicit `@Inject` tokens everywhere, enforced by
`backend/tests/unit/core/controller-composition.spec.ts`.

So the codebase is now runtime-agnostic by construction, and a `tsc` build *would* work. It is still
not introduced here, for two reasons: it is scope this Epic does not need, and **changing how the
API is compiled is precisely the class of change `DEF-001-005` came from.** A container that runs
what the developer runs cannot diverge from what the developer tested.

**Alternatives considered**: a `tsc` or `esbuild` bundle stage producing `dist/`, smaller and faster
to boot. Rejected as above — real benefits, wrong Epic, and a runtime-semantics change bought for a
few hundred milliseconds of container start.

**Docs consulted**: none needed — this is a decision about this repository's own build posture,
already researched in `D-40`.

---

## `R-014-4` — Prisma Client is generated inside the image, never copied into it

**Decision**: run `prisma generate` **inside the build stage of the image**, and let the default
`native` binary target resolve against the image's own platform. Do not copy `node_modules` from the
host, and do not add `binaryTargets` to `schema.prisma`.

**Rationale**: `backend/prisma/schema.prisma` declares `generator client { provider =
"prisma-client-js" }` with **no `binaryTargets`**, so the target is `native` — the platform that ran
`generate`. Copying a host-generated client into a Linux image is the classic way to ship a query
engine that cannot load. Generating inside the image makes `native` correct by construction and
keeps the schema unchanged, so nothing about local non-container development shifts.

The schema must also be copied **to `./prisma`, preserving the directory structure**, before the
install that triggers generation — Prisma's own deployment guidance calls out the wrong-path case as
a specific failure.

**Alternatives considered**: pinning `binaryTargets = ["linux-musl-openssl-3.0.x"]` (or the glibc
equivalent) for an Alpine base. Rejected as unnecessary once generation happens in-image, and it
would edit a schema file that every other environment shares to serve one of them.

**Docs consulted**: `/prisma/web` — deploying Prisma in Docker: `binaryTargets` compatibility, the
schema-copy path requirement, and `prisma migrate deploy` semantics.

---

## `R-014-5` — migrations run before the API starts, as a separate step

**Decision**: `prisma migrate deploy` runs as its **own step before the API process starts**, not
from inside the application's bootstrap.

**Rationale**: Prisma's guidance is explicit that migrations should complete before the app is
started, *"otherwise the app may hit errors when it queries a database that doesn't have the
expected tables"*. `migrate deploy` only applies migration files — it does not use the schema to
fetch models, detect drift, reset the database, or need a shadow database — which is what makes it
safe to run unattended at start.

Keeping it out of `main.ts` also keeps a failed migration **loud**: the step fails and the stack does
not come up, rather than an API that starts and then answers 500s.

**Alternatives considered**: running `migrate deploy` from the Nest bootstrap. Rejected — it turns a
schema failure into a runtime failure, and couples process start to database DDL.

**Docs consulted**: `/prisma/web` — `prisma migrate deploy` semantics and pre-deploy ordering.

---

## `R-014-6` — the seed stays manual, and the image carries no credential

**Decision**: **no image runs the seed, and no image contains a password.** Seeding remains an
explicit command a person runs, with `SEED_USER_PASSWORD` supplied at that moment.

**Rationale**: `backend/prisma/seed.ts` already refuses `NODE_ENV=production` and has **no default
password** — an unset one throws *"seed requires a password"* rather than creating a predictable
account. Its own comment states the reason: a seed creates a known account with a known password,
*"that is right for a developer machine and is a backdoor anywhere else."*

An image that seeds itself must carry or generate a credential, which destroys that posture the
first time the image is published anywhere. `BR-0173` (secret handling) and `BR-0135` (credential
isolation) both point the same way; both are owned by `EPIC-028` and are **consumed here, not
redefined**.

**Alternatives considered**: an entrypoint that seeds when the database is empty, for a
one-command first run. Genuinely more convenient and rejected on exactly the grounds above — the
convenience is worth less than the property that no image ever contains a usable credential.

**Docs consulted**: none needed — the constraint is this repository's, and it is already enforced by
`backend/prisma/seed.ts` and `T149a`.

---

## `R-014-7` — the reference local stack is not replaced, and the two must stay distinguishable

**Decision**: the containerised stack is an **addition**. `EPIC-036`'s reference local stack keeps
working, and every published measurement states which stack produced it.

**Rationale**: `EPIC-036` `T442l` defines the reference stack precisely — Vite dev server, `tsx` API
on `:3000`, one workspace and one project, Chromium at 1280×720, forty samples measured in
isolation — because `SC-SHL-006`'s *"under 1s at p95"* was a criterion whose scope had been named
and never defined. **`SC-SHL-006`'s recorded 20.5 ms p95 is a measurement of that stack.** A
containerised stack has a different client server, a different process boundary and a different
start path; a number taken on it answers a different question and must not be filed against the same
criterion.

**Alternatives considered**: making the containerised stack the reference and re-measuring.
Rejected — it invalidates a recorded measurement to gain nothing this Epic needs, and the decision
of which stack a criterion is measured on belongs to the Epic that owns the criterion.

**Docs consulted**: none needed — internal, `specs/036-application-shell/quickstart.md`.

---

## `R-014-8` — the broken `dev` script is fixed here, and gains a check

**Decision**: correct `backend/package.json`'s `dev` script to
`tsx watch --env-file-if-exists=../.env src/main.ts`, and add an executable check that the declared
dev entry point actually resolves.

**Rationale**: the script as written is
`tsx --env-file-if-exists=../.env watch src/main.ts`. `tsx` reads the first non-flag argument as the
file to run, so it tries to load `…/backend/watch` and dies with `ERR_MODULE_NOT_FOUND`. **The
documented developer entry point does not start**, which is squarely `F-11.1` developer enablement.
Found during `EPIC-036` UAT on 2026-08-24, when the API had to be started with `start` instead —
losing hot reload for the rest of that session.

> **Corrected 2026-08-25 (`T150u`, convergence).** This decision named **one** package. There were
> **two**: `worker/package.json` carried the identical `tsx --env-file-if-exists=../.env watch
> src/main.ts`, and `T150f` fixed both.
>
> **The second one was found by the check, not by the research that motivated it.** `T150b` reads
> every workspace manifest and resolves each declared entry point the way the runner would, so it
> went red on `backend:dev` *and* `worker:dev` on its first run. Had the task simply fixed the
> instance this decision named, `worker` would still be broken and nothing would say so.
>
> That is the argument for deriving a rule rather than enumerating a fix, and it is the same
> argument `T442w` and `T442y` made in `EPIC-036` a day earlier: **wherever a claim is about a set,
> the set must be derived or something will be missing from it.**

It belongs in this scope because **an image that shells the same invocation inherits the defect**,
and because a script nothing executes is exactly the shape `T452` was written to catch for the
README.

**Alternatives considered**: filing it as a standalone defect under Constitution VI and fixing it
separately. Reasonable, and rejected only because `D-45` already brought developer enablement into
this phase — splitting one line of `package.json` into its own defect record costs more ceremony
than it buys. **It is recorded as a defect-shaped finding in the plan's risk table** so it is not
lost if this scope is descoped.

**Docs consulted**: none needed — reproduced directly, error message captured.
