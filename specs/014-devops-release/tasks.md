---

description: "Task list for EPIC-014 — DevOps & Release"
---

# Tasks: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Tasks**: 33

> **Counted, not quoted.** This number is recomputed by `/speckit-analyze`; the phase and function sections below are its composition. It drifted before because two documents restated it and neither was derived — EPIC-018 read 31 here, 32 in the index and 34 in its task list, and by the time `T529` came to reconcile them the real figures were 31 / 37 / 38. **The remediation went stale before it ran.** Corrected by `T686`.

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — the D-10 hold was **discharged on 2026-08-20** by `PMI-DOC-004` v1.0
> (APPROVED; scope ruling T-106). Resumption goes through the Definition-of-Ready gate, not
> by declaration (EPIC-026).
>
> **Corrected 2026-08-24 (`D-45`).** This block said **⏸ HELD** for four days after the hold
> was lifted. [spec.md](./spec.md) recorded PROCEEDING on 2026-08-20; [plan.md](./plan.md)
> and this file both went on saying HELD. **Three documents, two answers, and the two that
> were wrong were the two a reader opens first.** Nothing derives a posture from anywhere —
> it is written by hand in three places, which is the shape `EPIC-036` spent four
> convergence passes removing from its area registry.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-11.1 · Developer enablement

- [X] T149a [P] Unit tests asserting the seed script is idempotent and creates exactly one workspace and one user with a hashed password, in `backend/tests/unit/core/seed.spec.ts`
- [X] T149 [P] Add seed script creating one workspace and user in `backend/prisma/seed.ts` (unit test: T149a) — plus the `seed` script in `backend/package.json` that `specs/_shared/quickstart.md` invokes, which did not exist either. Seeds the `org_default` organization first: `Workspace.organizationId` is an `onDelete: Restrict` relation, so a workspace without it fails on the foreign key on a fresh database
- [X] T452 [P] Conformance check asserting `README.md` exists at the repository root and covers every setup step in `specs/_shared/quickstart.md` — the executable check Constitution V (v1.2.0) requires for a document output, since manual review does not satisfy the gate — in `tests/governance/readme-conformance.spec.ts`
- [X] T150 Create `README.md` at the repository root with developer setup documentation matching `specs/_shared/quickstart.md` — the repository currently holds only `readme.txt` (conformance check: T452). *Writing it found `DEF-014-001`: the quickstart's Setup block said `docker compose up -d postgres redis` and `docker-compose.yml` defines no `redis` service — `ADR-0003` chose Valkey after the 2024 relicensing. Step two of the documented setup had never worked. Corrected in the quickstart and in the README, and `T452` now also refuses a README that starts a service the compose file does not define.*

## F-11.2 · Platform release gate

*MANDATORY — Constitution IV, VI, VII. The **platform-wide** gate: nothing promotes out of `local`
until all pass.*

**Restructured 2026-08-03** (`/speckit-analyze` finding **C1**). Per-epic closure work moved out of
here into a `Phase Z · Epic closure` in each epic's own `tasks.md`, so an epic can close **without
waiting on this held epic**. What remains is genuinely platform-wide: this gate **confirms** each
epic's `closure.md` record — it does not repeat the per-epic checks.

- [ ] T151 Confirm a `closure.md` exists for **all 15 epics** and each records every implementation task in that epic passing its unit test (Constitution V); consolidate into `specs/_shared/release-readiness-report.md` — do not re-run the per-epic checks
- [ ] T151a Review the Principle Conformance & Deferrals **baseline** register in `specs/_shared/platform-spec.md`: confirm all 20 principles are still correctly declared and every deferral retains a valid owner and discharging module (decision D-6); record in `specs/_shared/release-readiness-report.md`. Per-epic deltas are confirmed in each epic's own closure task
- [ ] T152 Run `pnpm test:arch` and confirm engine-independence (PC-1 transport separation and PC-2 engine independence) is intact; record in `specs/_shared/release-readiness-report.md`
- [ ] T152a Hold and record an **architecture review** against `specs/_shared/system-design.md`, the ADRs, and constraints PC-1 to PC-3 (MPS Volume 6 §8 quality gate; PMI-TASK-001 T-306) in `specs/_shared/release-readiness-report.md`
- [ ] T152b Hold and record a **security review** covering sandbox isolation, workspace scoping, credential handling, and audit immutability (MPS Volume 6 §8 quality gate) in `specs/_shared/release-readiness-report.md`
- [ ] T153 Execute quickstart V1–V12 **and V14** and record outcomes in `specs/_shared/release-readiness-report.md` (the SC-001 timing run is owned by EPIC-010 T124a; confirm its result here rather than re-running it)
- [ ] T154 Confirm every epic's `closure.md` records a clean `/speckit-converge` with no unbuilt work remaining; consolidate into `specs/_shared/release-readiness-report.md`
- [ ] T155 Confirm every epic's `closure.md` records an empty `defects/` folder, or remaining records deferred to a named epic; consolidate into `specs/_shared/release-readiness-report.md`
- [ ] T155a Confirm SRS back-fill completed for FR-024 and FR-025 (job cancellation and timeout), which have no SRS source (Constitution II); record in `specs/_shared/release-readiness-report.md`
- [ ] T156 Promote `local → dev` (then dev → stage → prod; no environment skipped)

## F-11.3 · Containerised local deployment

*Added 2026-08-24 by [`D-45`](./decisions/D-45-containerised-local-deployment-lands-in-epic-014.md).
Design in [plan.md](./plan.md) §F-11.3, decisions in [research.md](./research.md) `R-014-1`–`R-014-8`,
interfaces in [contracts/container-stack.md](./contracts/container-stack.md), validation in
[quickstart.md](./quickstart.md).*

**This function depends on nothing else in this Epic** — see [spec.md](./spec.md) *Depends on*. The
release gate above still runs last; developer enablement never did.

**Identifier block: `T150a`–`T150z`.** Chosen because **998 of 999 three-digit prefixes are
allocated corpus-wide and `T864` is the only free one** — spending it here would leave the corpus
with none while `EPIC-026` still owes the widening decision (`EPIC-036` `handovers.md`, `T441n`).
Sub-lettering is the established pattern in this Epic (`T149a`, `T151a`, `T152a`, `T152b`, `T155a`)
and `T150a`–`T150z` was verified free across every `tasks.md` in the corpus before use (`G-26-15`).

**No `[US#]` labels.** This Epic owns no user stories — [spec.md](./spec.md) says so — and organises
by **function**, as F-11.1 and F-11.2 above do. The generic per-story phase structure is not imposed
on a document that has never used it.

### Checks first — each MUST be seen to fail before the thing it checks exists

- [ ] T150a [P] Conformance check refusing a credential in any container artifact — greps `Dockerfile`, `docker-compose.yml` and `.dockerignore` for `PASSWORD`, `SECRET`, `TOKEN` and `_KEY` assigned a literal value, and asserts `.dockerignore` excludes `.env` — in `tests/governance/container-secrets.spec.ts`. Constitution V requires a non-code output to carry an executable check that can fail, and a `Dockerfile` is exactly that output (`contracts/container-stack.md` §4, §6)
- [ ] T150b [P] Conformance check asserting every `package.json` script's declared entry point resolves — the `dev` script currently names `watch` as a file and dies with `ERR_MODULE_NOT_FOUND` — in `tests/governance/package-scripts.spec.ts`. **Must fail on the unfixed script before `T150f` fixes it** (`R-014-8`)
- [ ] T150c [P] Unit test asserting the API serves the client with `/v1` excluded — `ServeStaticModule` is configured with a `rootPath` pointing at the client build and an `exclude` covering `/v1`, and an unmatched non-`/v1` path resolves to `index.html` while `/v1/**` does not — in `backend/tests/unit/core/serve-static.spec.ts` (`R-014-1`)
- [ ] T150d [P] Unit test asserting the entrypoint runs `prisma migrate deploy` **before** the API process and aborts the start when it fails, in `backend/tests/unit/core/entrypoint.spec.ts` — a stack that starts against an unmigrated database answers 500s and looks like a different bug (`R-014-5`)

### The dependency, registered before it is installed

- [ ] T150e Add `@nestjs/serve-static` to `specs/_shared/dependencies.md` as **`D-30`** with its licence and risk, in the same change as the install below — `TS-001` in `tests/governance/dependency-register.spec.ts` names every third-party runtime dependency and goes red without the row. **That check was written by `EPIC-036` (`T436c`); this is the first time it binds a different Epic** (`R-014-2`) (conformance: existing `TS-001`)
- [ ] T150f Install `@nestjs/serve-static` in `backend/package.json` and fix the broken `dev` script to `tsx watch --env-file-if-exists=../.env src/main.ts` — `tsx` reads the first non-flag argument as the file to run, so the flag must not precede `watch` (conformance: T150b)

### The image and the stack

- [ ] T150g Wire `ServeStaticModule` into the Nest application in `backend/src/app.module.ts` — `rootPath` at the client build output, `exclude` covering `/v1`, default `renderPath: '*'` left in place as the SPA history fallback. The backend is on `@nestjs/platform-express`, so Express fallthrough applies and the Fastify-only `serveStaticOptions.fallthrough` caveat does not (unit test: T150c)
- [ ] T150h Write `Dockerfile` at the repository root — a client build stage running `vite build`, a dependency stage installing with pnpm and running `prisma generate` **inside the image** so the default `native` binary target resolves against the image platform, and a runtime stage carrying the sources and `tsx`. **No compiler is added**: `backend/package.json` has no build script by design (`D-40`, `DEF-001-005`). `prisma/schema.prisma` and `prisma/migrations/` are copied to `./prisma` preserving structure **before** the install that triggers generation (`R-014-3`, `R-014-4`) (conformance: T150a)
- [ ] T150i Extend `.dockerignore` so the build context excludes `.env`, `node_modules`, `.git`, `dist` and every `specs/` artifact — the image must not be able to contain a credential even by accident (conformance: T150a)
- [ ] T150j Write the container entrypoint running `prisma migrate deploy` as its own step and then the API, aborting the start if the migration fails, in `docker/entrypoint.sh` (unit test: T150d)
- [ ] T150k Add the `app` service to `docker-compose.yml` — built from the `Dockerfile`, `depends_on` both existing services with `condition: service_healthy`, `DATABASE_URL`/`VALKEY_URL`/`PORT` supplied as environment, port `${PMI_APP_PORT:-3000}`. **The existing `postgres` and `valkey` services are not reshaped**; their images, volumes, healthchecks and port variables are already correct (`contracts/container-stack.md` §1) (conformance: T150a)

### Prove it, including the failures

- [ ] T150l Execute [quickstart.md](./quickstart.md) Scenarios 1–7 against a clean checkout and record the verbatim transcript in `docs/deployment/EPIC-014-container-stack-transcript.md` — Constitution XI Tier 1, a real entry point. Scenario 3 is the one that matters: a deep link survives a refresh
- [ ] T150m Run the three mutation checks in [quickstart.md](./quickstart.md) — bake a dummy `SEED_USER_PASSWORD` (T150a must go red), remove the static fallback (Scenario 3 must fail), point `DATABASE_URL` at an unreachable database (the stack must fail at migration and the API must not start) — and record each **observed failure**, verbatim, in `docs/deployment/EPIC-014-container-stack-transcript.md` §Mutations. A check nobody has seen fail is a check nobody knows works (`T200c`'s standard)
- [ ] T150n Update `README.md` with the containerised path — `docker compose up -d --build`, with no host toolchain — alongside the existing reference local stack, stating **which stack is which** and that `SC-SHL-006`'s recorded p95 is a measurement of `EPIC-036` `T442l`'s stack and not of this one (`R-014-7`) (conformance: T452, extended to cover the container path)
- [ ] T150o Record `R-036-3` as discharged in `specs/036-application-shell/research.md` and in that Epic's `closure.md` — **by this Epic, in that Epic's record**, naming `T150l` Scenario 3 as the evidence. `EPIC-036` could not prove deep links outside the Vite dev server because nothing served the built client; that is no longer true, and the record that says otherwise must say so

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/014-devops-release/closure.md`, this epic's own closure record, which **F-11.2 above** then
confirms alongside the other fourteen. Keep the two separate: this phase closes EPIC-014 as an epic;
F-11.2 is the platform gate that closes the release.*

- [ ] T213 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/014-devops-release/closure.md`
- [ ] T214 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/014-devops-release/closure.md`
- [ ] T215 Triage `specs/014-devops-release/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/014-devops-release/closure.md`
- [ ] T216 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/014-devops-release/closure.md`
