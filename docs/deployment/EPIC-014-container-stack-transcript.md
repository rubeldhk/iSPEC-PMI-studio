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

---

## §4 Convergence C-1 re-run — 2026-08-25

**Both corrected commands were driven as written**, not reasoned about. `T150q` and `T150r` changed
documentation and one compose line; this is the evidence they now work.

### Scenario 5 — the credential command runs

```
$ docker run --rm --entrypoint sh pmi-studio-app -c 'ls -a /app | grep -c "^\.env$" || true'
0
```

`0` — no `.env` in the image, which is what the scenario claims. **Before `T150r` this command
failed**: no image named `pmi-studio-app` existed, because the `app` service declared `build:` with
no `image:` and Docker named it from the checkout directory. `docker-compose.yml` now declares the
name, so it is the repository's rather than the directory's.

### Scenario 6 — the seed command runs

```
$ docker compose exec -e NODE_ENV=development \
    -e SEED_USER_EMAIL=you@pmi.local -e SEED_USER_PASSWORD='choose-something' \
    app pnpm --filter @pmi/backend exec tsx prisma/seed.ts
seeded workspace ws_default and user you@pmi.local
```

**Before `T150q` this command failed twice over**: the env assignments sat in the host shell and
never reached the container, and `NODE_ENV` was never overridden, so the seed refused. Both
refusals in `backend/prisma/seed.ts` are unchanged and still fire — see §1.

### The stack still serves

| Address | Status |
|---|---|
| `/` | 200 |
| `/runs` | 200 |
| `/v1/auth/me` | 401 |
| `/v1/no-such-endpoint` | 500 *(`DEF-001-006`, still visible)* |

### What `T150s` caught, including in itself

Written first, it went red on **`C2`** and **passed over `C1`** — the fault it existed for. Its
filter required a line to *start* with `docker `, and the quickstart writes the seed as
`SEED_USER_EMAIL=… \` then `docker compose exec …`. **An env-prefixed command is the normal shell
idiom for exactly the kind of command this check inspects**, so requiring `docker` first was
checking a shape rather than a meaning. Found by running the new check against the two known faults
and noticing it caught one.

Once corrected it was red on both, then green after `T150q` and `T150r` — which is the ordering the
phase was written for.

---

## §5 Convergence C-2 — 2026-08-25

### The mutation that proved a fix was decoration

`T150x` added `specs/_shared/quickstart.md` to `T150s`'s documents — the file `DEF-014-001` was
raised against. Before trusting that, the defect was reintroduced there:

```
$ sed -i 's/postgres valkey/postgres redis/' specs/_shared/quickstart.md
Tests  33 passed          ← STILL GREEN
```

**Adding the file changed nothing.** None of `T150s`'s three assertions looked at
`docker compose up <service>` — that property lived in `T452`, which reads `README.md` only. A file
added to a list without the assertion it needed is decoration, and it would have read as coverage.

With the `docker compose up` assertion added:

```
$ sed -i 's/postgres valkey/postgres redis/' specs/_shared/quickstart.md
× T150s · specs/_shared/quickstart.md starts only services that exist
  → specs/_shared/quickstart.md starts a service docker-compose.yml does not define
Tests  1 failed | 35 passed
```

Restored → `36 passed`. **The check now names the file the defect is in**, rather than failing on
README step-coverage and sending the reader to the wrong document.

### Scenario 3's mutation expectation was wrong

It said *"`/runs` on refresh must 404"*. §2 above records the observed value: **`500`**. The
mutation works exactly as intended — with the fallback gone the request reaches the API and
`DEF-001-006` answers `500`. **A mutation check whose expected value is wrong is worse than no
mutation check**: it teaches the reader to distrust a working guard. Corrected by `T150x`.

### What C-2 says about the shape of this Epic

Three passes, and the faults got quieter each time: commands that did not run (`C-1`), then
expectations that did not match (`C-2`), and in both, **a fix that looked complete and was not until
it was mutated.** The consistent lesson is in `T150z`'s note: *a check that verifies a list is
complete verifies only that the list matches itself.*

---

## §6 Convergence C-3 — 2026-08-25

### `T153c` found a gap two Epics old on its first run

The check compares the `### V<n>` scenarios `specs/_shared/quickstart.md` defines against the
`V`-numbers `T153` claims to run. First run:

```
× T153c · the release gate runs every quickstart scenario
  → specs/_shared/quickstart.md defines V11a, which T153 does not run.
```

**`V11a` had never been run at the gate.** `EPIC-011` added *Observability across the sandbox
boundary* between `V11` and `V12`, and **a lettered scenario is not inside a numeric range** — so
`V1–V12` silently excluded it from the day it was written, for every release since. Nobody read it
wrong; the sentence was simply not the kind of thing reading catches.

`T153`'s scope now reads `V1–V12`, **`V11a`**, `V14` and **`V15`**.

### `V15` — the gate now starts the stack it ships

Before this, `F-11.3` delivered a containerised platform that `T153` never started: the shared
quickstart mentioned containers **zero times**. The Exit Criterion was proved once, by §1 above, and
never again. `V15` confirms rather than re-derives — three commands, pointing at
`specs/014-devops-release/quickstart.md` for the detail.

### Mutation

```
$ printf '\n### V16 — a scenario nobody wired to the gate\n' >> specs/_shared/quickstart.md
× T153c → specs/_shared/quickstart.md defines V16, which T153 does not run.
Tests  1 failed | 39 passed
```

Restored → `40 passed`.

### What C-3 says

`G-14.2` predicted this in writing — *"nothing enforces it"* — and was still headed **"✅ current"**
while two scenarios sat outside the gate. **A warning that does not fire is a comment.** Three
passes of this Epic have now ended at the same sentence, and it is worth stating once more plainly:
*a number restated in two documents drifts unless something compares them.*

---

## §7 Convergence C-4 — 2026-08-25

### Mutation 4 — `.dockerignore`, the one assertion taken on trust

`T150i` was written **after** the exclusions were already present, so it went green on its first run
and stayed green. Three mutations had been recorded and none touched it; the only thing that ever
proved that gap real was a **build failure**. `T153e` closes that:

```
$ grep -v '^\*\*/node_modules$' .dockerignore > .dockerignore
× T150i · .dockerignore excludes **/node_modules
  → .dockerignore no longer excludes **/node_modules
Tests  1 failed | 43 passed
```

Restored → `44 passed`. **Every check in this Epic has now been seen to fail.**

### `T153d` — deriving the gate's own inventory

Gate V demanded derived coverage of everything else while counting itself by hand, and had drifted
twice: four when there were five (`T150y` fixed it by hand in `C-2`), then five when there were
seven. The Definition of done still said *"the three conformance checks"*, never updated at all.

First run:

```
× T153d → Gate V does not list T150i, T153c, T153d, which exist as checks.
```

**And it caught two faults of its own while being written**, both by running it rather than reading
it:

1. **The Definition-of-done assertion read one line of a wrapped bullet.** *"the three conformance
   checks"* sits on the bullet's *second* line, so the first version passed over the exact sentence
   it existed for. A markdown bullet is one statement however it is folded.
2. **Reading the whole table row needed a hardcoded allowlist** of "ids that are evidence, not
   checks" — and it grew by one the moment a row was added. Reading **the Task column the table
   actually defines** removed the list instead of maintaining it. `T150l` moved to the evidence
   column with it: the *check* is `T150c`; `T150l` is how it is exercised.

The Definition of done now points at the table instead of counting beside it.

### What four passes of this Epic amount to

Seven findings, then four, then three, then two. The system was correct from the first pass; every
finding since has been a **record, a count, or a check that had never failed**. The sentence they
all reduce to, now enforced in five places across two Epics:

> **A claim about a set drifts unless something derives it.**

Areas, states, surfaces, documents, scenarios — and finally the gate that demanded it of all of them.

---

## §8 Convergence C-5 — 2026-08-25

### `C-4`'s fix was one level too shallow

`T153d` derived *which checks Gate V lists* — from a **hand-written list of four files**. That is
the same fault it was written to abolish, moved down a level. `T150p` sat in both of its blind
spots: its assertions live in `readme-conformance.spec.ts`, which the list did not name, **and** it
owns no `describe` block — it is `it('… (T150p)')` inside `describe('T452 · …')`.

`T153f` removes both: the directories are **globbed**, and a check is recognised by **any id a
`describe` *or* `it` title names**. Where an assertion is nested is a formatting choice; the id is
the claim. Titles only — a comment mentioning `T150m` is a cross-reference, not a check.

First run after widening:

```
× T153d → Gate V does not list T150p, which exist as checks.
```

**Mutation** — a new check, in a file nothing listed, named only in an `it()` title:

```
$ it('a brand new check nobody added to Gate V (T156z)', …)   in readme-conformance.spec.ts
× T153d → Gate V does not list T156z, which exist as checks.
```

Restored → green. **Both blind spots are closed by the same change.**

### Mutation 5 — `T150p`, the check that was hiding in one of them

```
$ (remove the "Containerised — one command" section from README.md)
× T452 · documents BOTH stacks, and says which is which (T150p)
  → the README does not document the containerised stack
Tests  1 failed | 12 passed
```

Restored → `13 passed`.

**Nine checks, nine pieces of fail-first evidence** — five mutations and one fail-first ordering
(`T150b`), plus `T153c` and `T153d` each red on their own first run.

> **`C-4` claimed "every check in this Epic has now been seen to fail." That claim was wrong** — not
> because a mutation was skipped, but because **the inventory it was measured against was
> incomplete**. The claim is made again here, and this time against a derived set rather than a
> listed one, which is the only difference that matters.

---

## §9 Convergence C-6 — 2026-08-25

### The fourth correction of one fault is where you stop correcting it

Gate V's own status cell read *"**Four checks, four pieces of fail-first evidence** — see the table
below"* while the table below listed **nine**, two lines apart. The Build order read *"the three
checks"* — wrong since the plan was written.

The count had already been corrected in the table (`T150y`, `C-2`) and in the Definition of done
(`T153d`, `C-4`). Each fix touched the site that had just been found, and the next site drifted.
`T153h` reads **all three regions** instead — the Gate V row, the Gate V table section, and the
Build order — and the numbers are **deleted rather than updated**:

> The table is the inventory. Prose beside it points at it and never counts it.

First run, before the deletions:

```
× the Gate V row does not restate the check count      → Four checks
× the Build order block does not restate the check count → three checks
```

### Both directions mutated

**A — a live count must fail:**

```
$ sed -i 's|──► the Gate V checks|──► the nine checks|'
× the Build order block restates the check count: nine checks
```

**B — quoted history must stay exempt:**

```
$ (change "This row previously said **"three checks…"**" to "eleven checks")
Tests  48 passed
```

The `I2` and `T150y` correction notes quote what the document *used to* say. **Rewriting quoted
history to keep a check green is the failure `flat()` guards against in `EPIC-036`'s
`registry-documented.spec.ts`**, and the rule here is deliberately the same one: skip a blockquote,
or a line carrying an explicit quotation marker — and assert both exemptions so neither can widen
unnoticed.

### Where six passes leave it

Seven findings, then four, three, two, two, one. The system was correct from the first pass. Every
finding since was a record, a count, or a check that had never failed — and three of them were
inside the check written to close the previous pass. The sentence they all reduce to is now enforced
in six places across two Epics:

> **A claim about a set drifts unless something derives it** — and prose beside a derived set drifts
> too, unless something reads that as well.
