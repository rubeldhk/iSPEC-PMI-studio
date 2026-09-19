# Contract: the containerised local stack

**Epic**: `EPIC-014` · **Phase**: 1 · **Date**: 2026-08-24 · **Plan**: [../plan.md](../plan.md)

What the stack exposes, what it consumes, and what it must never contain. Decisions in
[../research.md](../research.md); scope in
[`D-45`](../decisions/D-45-containerised-local-deployment-lands-in-epic-014.md).

---

## 1. Services — three, and only three

| Service | Image | Exposed | Depends on |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` — **unchanged** | `${PMI_POSTGRES_PORT:-5432}` | — |
| `valkey` | `valkey/valkey:7-alpine` — **unchanged** | `${PMI_VALKEY_PORT:-6379}` | — |
| `app` | **new**, built from this repository | `${PMI_APP_PORT:-3000}` | both, `service_healthy` |

**One application service, not two.** The API serves the built client (`R-014-1`), so there is no
web container, no nginx and no reverse proxy. `docker-compose.yml`'s existing two services are
**edited only to the extent of adding the third** — their images, volumes, healthchecks and port
variables are already correct and are not this Epic's to reshape.

**`app` waits for health, not for start.** Both existing services already declare healthchecks
(`pg_isready`, `valkey-cli ping`); `app` consumes them with `condition: service_healthy`. A
container that starts before Postgres accepts connections fails its migration step, which is
`R-014-5`'s loud failure arriving for the wrong reason.

**Only one stack can run per machine** (`T150t`, convergence). All three services pin
`container_name` — `pmi-postgres`, `pmi-valkey`, `pmi-app` — so a second compose project using this
file conflicts on the name before it conflicts on a port:

```
Error response from daemon: Conflict. The container name "/pmi-valkey" is already in use
```

**Found by hitting it**: validating `T150l` required a separate project and an override, because a
UAT stack was already holding those names.

**The pins are not removed, and that is a decision.** They predate this Epic; §1 above already
states that `postgres` and `valkey` are not this Epic's to reshape; and `docker exec pmi-postgres …`
appears in existing documentation and in day-to-day use, which an unpinned name would break for a
convenience nobody asked for. **Stop one stack before starting another** — and if two must coexist,
use `-p <project>` with an override that clears the names, which is what the validation run did.

**`app` declares `image: pmi-studio-app`** (`T150r`). A service with `build:` and no `image:` is
named from the compose project — the checkout directory — so the image name would differ per clone
and could not be written into documentation. `quickstart.md` Scenario 5 named an image that existed
nowhere for exactly that reason.

---

## 2. The one origin

```
http://localhost:${PMI_APP_PORT:-3000}
  /v1/**            → the API           (Nest controllers)
  /assets/**        → built client assets
  /                 → index.html
  anything else     → index.html         ← the history fallback, R-036-3
```

**`/v1` is excluded from static serving and answers as the API.** Everything else that does not
match a file returns `index.html`, so an address the client routes itself — `/runs/abc`,
`/specifications/xyz` — loads the application instead of a 404. That single line is the whole of
`R-036-3`, and it is why the client needs no change: `/v1` is same-origin here exactly as the Vite
proxy makes it same-origin in development.

**The API's 404 behaviour is not this Epic's to fix.** `DEF-001-006` — every unmatched *API* path
answering `500` rather than `404`, because `ErrorFilter` is a bare `@Catch()` — is `EPIC-001`'s open
defect. The static fallback MUST NOT be configured so broadly that it hides it: a request to
`/v1/no-such-endpoint` must still reach the API and produce whatever the API produces, wrong status
and all. **Making that defect invisible would be worse than leaving it visible.**

---

## 3. Configuration — supplied, never baked

| Variable | Source | In the image? |
|---|---|---|
| `DATABASE_URL` | compose, pointing at the `postgres` service | **no** |
| `VALKEY_URL` | compose, pointing at the `valkey` service | **no** |
| `PORT` | compose, default `3000` | **no** |
| `AI_PROVIDER_TOKEN` | the developer's `.env`, passed through | **no** — and empty is a valid value; the sandbox refuses to start either way |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | **the person running the seed, at that moment** | **never** — see §5 |

**`.env` is read by compose, not copied into the image.** The repository's `.dockerignore` must
continue to exclude it, and the build must not depend on it existing.

---

## 4. What the image contains

- the TypeScript sources and `tsx` — **no compiler, no `dist/`** for the API (`R-014-3`);
- **`tsconfig.base.json`** (`T150v`). Every package's `tsconfig.json` extends `../tsconfig.base.json`,
  and **vite resolves it while building `index.html`** — so without it the client build fails
  outright with `failed to resolve "extends":"../tsconfig.base.json"`, a message that names the file
  but not why it is absent. It was missing from the first two builds and from this list;
- `node_modules` installed **inside** the image, with Prisma Client generated there so its `native`
  binary target resolves against the image's own platform (`R-014-4`);
- the client's build output, produced by a build stage and copied in;
- `prisma/schema.prisma` and `prisma/migrations/`, copied to `./prisma` with the directory structure
  preserved **before** the install that triggers generation.

**It MUST NOT contain**: `.env`, `.git`, any password, any API token, any generated
`node_modules` copied from the host, or the seed's credentials.

---

## 5. Start sequence

```
1. postgres + valkey reach healthy
2. app: prisma migrate deploy        ← separate step, before the process (R-014-5)
3. app: tsx src/main.ts              ← the API, serving /v1 and the client
```

**Seeding is not in this sequence.** It stays a command a person runs, with the password supplied
then (`R-014-6`). An image that seeds itself must carry or invent a credential, and
`backend/prisma/seed.ts` exists to refuse exactly that — it throws on an unset password and refuses
`NODE_ENV=production` outright. Those two refusals MUST survive containerisation unchanged; they are
the contract, not an implementation detail of it.

**A failed migration MUST stop the stack.** Step 2 failing means step 3 does not run. An API that
starts against an unmigrated database answers 500s and looks like a different bug.

---

## 6. What this contract must never contain

Asserted by this Epic's own conformance checks, not by review:

- **no credential in any image or any committed compose file** — the check greps the build context
  and the Dockerfile, and it must be able to fail;
- **no second copy of the `/v1` path convention** — the client's assumption is the one; this stack
  reproduces the topology rather than restating the rule;
- **no replacement of the reference local stack** — `EPIC-036` `T442l`'s stack keeps running, and
  documentation states which stack any measurement came from (`R-014-7`);
- **no promotion claim.** This is `local`. `BR-0090` owns `local → dev → stage → prod` and
  Constitution VII is untouched. **A container running on a developer's machine proves nothing about
  a deployed environment.**

---

## 7. What the stack does NOT prove

Stated here so a green run is not over-read:

| Not proved | Why |
|---|---|
| That the client works behind a CDN or a separate static host | It is served by the API here, by design (`R-014-1`). A split topology is a different arrangement and is untested |
| That `dev`, `stage` or `prod` work | Out of scope, explicitly. This Epic delivers one rung |
| That `SC-SHL-006`'s p95 holds here | That number is a measurement of `EPIC-036`'s reference stack (`R-014-7`). This is a different stack and answers a different question |
| That the API returns 404 for unknown API paths | `DEF-001-006`, `EPIC-001`'s, deliberately left visible (§2) |
| ~~That the release gate exercises it~~ — **it does now** | Until 2026-08-25 it did not: `T153` ran `V1–V12` and `V14`, and the shared quickstart mentioned containers **zero times**. `T153a` added `V15`; `T153c` fails if a scenario is ever defined and not run |
