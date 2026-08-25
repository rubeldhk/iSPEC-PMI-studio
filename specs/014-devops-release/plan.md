# Implementation Plan: DevOps & Release

**Epic**: `EPIC-014` | **Module**: M-11 | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Tasks**: see [tasks.md](./tasks.md) — counted there, never restated here (`T686`, PP-002) | **Posture**: ▶ **PROCEEDING** (D-10 discharged 2026-08-20; see [spec.md](./spec.md))

> **Corrected 2026-08-24 (`D-45`).** This header read **⏸ HELD (decision D-10)** while
> [spec.md](./spec.md)'s delivery posture had read **▶ PROCEEDING** since **2026-08-20** — the hold
> was discharged by PMI-DOC-004 v1.0 and the plan was never updated. Four days of a plan and its
> spec disagreeing about whether the Epic was allowed to run.

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([platform-spec](../_shared/platform-spec.md) · [system-design](../_shared/system-design.md) · [data-model](../_shared/data-model.md) · [schema](../_shared/schema.sql) · [platform-api](../_shared/contracts/platform-api.md)))

> ## ⚠️ Retroactive plan
>
> `tasks.md` predates this plan — these tasks were generated in the 2026-08-03 decomposition and
> never passed a Constitution Check. This plan records the technical context they assumed and
> **reviews the existing task list**. It is one of eleven written on 2026-08-07 to close finding
> **C3**, and it adds no design: everything this epic needs already exists in `_shared/`.
>
> **That last clause stopped being true on 2026-08-24** (`D-45`). **F-11.3 adds design** — eight
> decisions, a contract and a quickstart, none of which `_shared/` answers, because `_shared/`
> describes a platform that has never been containerised. The retroactive framing still holds for
> F-11.1 and F-11.2; it does not extend to F-11.3.

## Summary

Developer enablement and the **platform release gate** — the two-stage closure structure that
ruling **C1** created on 2026-08-03.

This epic no longer performs per-epic closure. Each epic discharges its own `Phase Z` and writes
`closure.md`; `F-11.2` here **confirms** those records and adds what no single epic can.

## Scope

| Function | What it delivers |
|---|---|
| F-11.1 Developer enablement | Seed script, `README.md`, and their checks |
| F-11.2 Platform release gate | Confirm 15 closure records, architecture and security reviews, quickstart, SRS back-fill, promotion |
| **F-11.3 Containerised local deployment** *(new, `D-45`)* | One application image serving `/v1` and the built client on one origin, wired to the existing `postgres` and `valkey`; the SPA history fallback that closes `R-036-3`; a credential conformance check; the broken `dev` script |
| Phase Z Epic closure | Per-epic gate (Constitution IV, V, VI, IX) |

> **Corrected 2026-08-24 (analysis `I1`, `D1`).** This table carried a **Tasks** column, and it said
> F-11.1 had **3** when [tasks.md](./tasks.md) listed **4** — `T452` was added and the number was
> not. **That is finding `F1` from the 2026-08-19 session recurring**: `T686` closed it by deleting
> the *total* from this document and left the *per-function* counts, so the same drift reopened in
> the same table. The header four lines up has said *"counted there, never restated here"* the whole
> time, which made this table a contradiction of its own document.
>
> **The column is deleted, not resynchronised.** A number restated in two places drifts; a number
> stated in one does not. `tasks.md` is where tasks are counted.

## Technical Context

Inherited wholesale from [`../_shared/plan.md`](../_shared/plan.md) — TypeScript on Node 22, NestJS,
Prisma, PostgreSQL 16, BullMQ + Valkey, React + Vite, Vitest, Testcontainers. Specific to this epic:

**This epic is the closure gate and is itself held.** That was the C1 problem: the proceeding slice
had no reachable exit while twelve epics waited on the BRS. Resolved by splitting per-epic closure
out — an epic now reaches *release-eligible* alone, and only **platform promotion** waits here.

**`T151`/`T154`/`T155` confirm, they do not re-run.** Each reads the fifteen `closure.md` records.
Repeating the per-epic checks here would recreate the bottleneck the split removed.

**Two MPS quality gates land here**: architecture review (`T152a`) and security review (`T152b`),
discharging PMI-TASK-001 T-306.

### F-11.3 — what containerisation adds to the technical context *(`D-45`, 2026-08-24)*

The inherited stack is unchanged. What is new is that **it must run without a host toolchain**:

| | Decision | Where |
|---|---|---|
| Client serving | the **API serves the built client** via `@nestjs/serve-static`; one image, one origin, `renderPath: '*'` as the SPA history fallback and `exclude` keeping `/v1` on the API | `R-014-1` |
| New dependency | `@nestjs/serve-static` → registered as **`D-30`** in [`../_shared/dependencies.md`](../_shared/dependencies.md) in the same change, because `TS-001` will otherwise go red | `R-014-2` |
| API runtime | **`tsx` from source, no compiler added.** `backend/package.json` has no build script by design — see [`D-40`](./decisions/D-40-runtime-metadata-vs-explicit-tokens.md) and `DEF-001-005` | `R-014-3` |
| Prisma | Client generated **inside** the image so the default `native` target is correct; schema copied to `./prisma` preserving structure, before install | `R-014-4` |
| Migrations | `prisma migrate deploy` as a **separate step before** the process, so a schema failure stops the stack loudly | `R-014-5` |
| Seed | **stays manual.** No image runs it; no image carries a password | `R-014-6` |
| Adapter | `@nestjs/platform-express` — Express fallthrough applies, so the Fastify-only `serveStaticOptions.fallthrough` caveat does not | `R-014-1` |

**NEEDS CLARIFICATION**: none. Every question this scope raised is answered in
[research.md](./research.md).

**Risks carried, not resolved here**:

| Risk | Disposition |
|---|---|
| `DEF-001-006` — unmatched **API** paths answer `500`, not `404` (`EPIC-001`'s open defect) | The static fallback MUST NOT be configured broadly enough to hide it. Asserted by quickstart Scenario 4 |
| The broken `dev` script (`R-014-8`) | Fixed in this scope. **If this scope is ever descoped, this must be re-filed as a defect under Constitution VI** — it is a one-line `package.json` fault that stops the documented developer entry point |
| Serving static assets from the API process | A **local** choice. Explicitly not the programme's production answer; a split topology is a `dev`/`stage`/`prod` decision |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | ⚠️ **Infrastructure epic** — owns no functional requirement; that is correct, not a debt. It discharges Constitution IV/VII rather than an FR |
| III | Epic → Feature → Task decomposition | PASS — 2 functions, 17 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | ⚠️ **PASS under the v1.2.0 reading** — see G-14.1 |
| VI | `specs/014-devops-release/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind `origin/epic/001-platform-foundation`, 2026-08-07 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — files authored outside this session appeared in the tree on 2026-08-05 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); platform baseline in [`_shared/platform-spec.md`](../_shared/platform-spec.md) |

**Any FAIL blocks Phase 0.** No FAIL. Gate V's basis changed on 2026-08-05 and is recorded below.

### Re-evaluated for F-11.3 *(2026-08-24, `D-45`)*

The table above was written for an Epic that produced **no design**. F-11.3 produces design, so the
gates it touches are re-run rather than inherited:

| # | Gate | Status for F-11.3 |
|---|------|-------------------|
| I | Code produced only via Spec Kit commands | PASS — scope added by `D-45`, designed here, tasks to follow from `/speckit-tasks` |
| II | Requirements trace to cited SRS documents | ⚠️ **PASS with a stated debt.** F-11.3 adds no numbered requirement and traces to `BR-0090`'s first rung, consuming `BR-0173`/`BR-0135` (owned by `EPIC-028`). **No SRS document requires the platform to be containerised** — [spec.md](./spec.md) says so plainly and records the back-fill owner as **unassigned**. That is a debt named, not a gate dodged |
| III | Epic → Feature → Task decomposition | PASS — F-11.3 is a function; tasks come from `/speckit-tasks` |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `Phase Z` unchanged |
| V | Every implementation task carries a unit test, or an executable conformance check for non-code output | ⚠️ **The gate that binds hardest here.** A `Dockerfile` and a `docker-compose.yml` are **non-code outputs**, so each needs a check that can fail. **Four checks, four pieces of fail-first evidence** — see the table below. **This is the gate to fail this scope on**, and the one `T150` failed for months (see G-14.1) |
| VI | `defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | **PASS, and F-11.3 does not touch it.** This scope delivers `local` only. A container on a developer's machine proves nothing about a deployed environment, and both [spec.md](./spec.md) and [contracts/container-stack.md](./contracts/container-stack.md) say so rather than implying otherwise |
| VIII | Session labelled with the working Epic | PASS — this pass ran under `EPIC-036` UAT and switched to `EPIC-014`; stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Dependency register current | ⚠️ **Actionable, not yet done.** `@nestjs/serve-static` needs row **`D-30`** in `_shared/dependencies.md`. `TS-001` — built by `EPIC-036` `T436c` — goes red the moment the package is installed without it. **This is the first time that check binds an Epic other than the one that wrote it** |

#### Gate V in full — every check, and how each is seen to fail

*Analysis `I2`, 2026-08-24. This row previously said **"three checks, each with a mutation"** while
`T150m` ran three mutations covering a **different** set: the `dev`-entry-point check had none, and
the unreachable-database mutation belonged to no check named here. Four and four, reconciled:*

| Check | Task | How it is seen to fail |
|---|---|---|
| No credential in a container artifact | `T150a` | **Mutation** — bake a dummy `SEED_USER_PASSWORD` into the `Dockerfile`; the check must go red (`T150m`, quickstart Scenario 5) |
| The SPA history fallback | `T150c` | **Mutation** — remove the static fallback and rebuild; `/runs` goes from `200 text/html` to `500`, observed by `T150l` Scenario 3 and recorded by `T150m`. The *check* is `T150c`, which runs the pattern through the loader's own matcher; `T150l` is how it is exercised end to end |
| Migration runs before the process | `T150d` | **Mutation** — point `DATABASE_URL` at an unreachable database; the stack must fail at migration and the API must **not** start (`T150m`, quickstart Scenario 1) |
| Every `package.json` script entry resolves | `T150b` | **Fail-first ordering, not a mutation.** `T150b` is written before `T150f` and **must go red on the unfixed `dev` script**, which is the same guarantee reached by the same standard (`T200c`) — the check is observed failing against the real fault rather than an injected one. It is arguably the stronger evidence of the four |
| Every documented container command is runnable | `T150s` | **Two real faults and one self-inflicted, all observed.** Added by convergence `C-1` after two commands in `quickstart.md` were found not to run. It went red on `C2`, **passed over `C1` — the fault it was written for** — because its filter required a line to start with `docker ` while the quickstart writes `SEED_USER_EMAIL=… \` first; corrected, red on both, then green. `C-2` then extended it to `specs/_shared/quickstart.md`, and **the mutation showed that adding the file changed nothing** until the `docker compose up` assertion was added with it — `DEF-014-001` reintroduced there stayed green. Now red, naming that file |
| The build context excludes what must never be in an image | `T150i` | **Mutation** — remove `**/node_modules` from `.dockerignore`; the check must go red naming the pattern (`T153e`). Until convergence `C-4` this was **the one assertion in the Epic taken on trust**: it was written after the exclusions were already present, so it went green on its first run and stayed green, and the only thing that ever proved the gap real was a build failure |
| The release gate runs every quickstart scenario | `T153c` | **Mutation** — add a `### V16` heading to `specs/_shared/quickstart.md`; the check must go red naming `V16`. Found `V11a` unrun at the gate **on its first run**, a gap two Epics old: a lettered scenario is not inside a numeric `V1–V12` range |
| Gate V lists every check that exists | `T153d` | **Its own first run.** Written in `C-4` and immediately red on `T150i`, `T153c` and itself — and its Definition-of-done assertion was red on a count that had been wrong since `C-2`. **This table is now derived**, which is why it is the last row that will need adding by hand |

> **Four became five (`T150y`, convergence `G3`).** This table said *"four checks, four pieces of
> fail-first evidence"* while `C-1` had added a fifth. **Gate V is the gate this scope is meant to be
> failed on**, so an inventory of its own checks that undercounts them is the same shape as a
> specification undercounting its areas — which is what `EPIC-036` spent four convergence passes
> removing. Counted here, derived nowhere; if a sixth check appears, this row is how it gets missed.

**Post-design re-check**: **PASS**, with Gate II's debt (now owned — see [spec.md](./spec.md), answered
at `T214`) and the `D-30` register row carried as named actions rather than as assumptions. No gate
was weakened by the design; Gate V was made **stricter** by it, because the scope introduces two
non-code outputs where the Epic previously had one.

## Review of the existing task list

### G-14.1 · `T149` and `T150` produce non-code outputs — resolved by constitution v1.2.0

`T149` (seed script) gained a paired unit test `T149a` in the 2026-08-03 remediation. `T150` produces
`README.md` — a document. Under constitution **v1.2.0** (2026-08-05), a non-code output is satisfied
by an **executable conformance check**, not a unit test.

`T150` currently has neither. ⚠️ **Open**: it needs a check asserting the README matches
`_shared/quickstart.md`, or it is the one task in this epic that fails Principle V as amended.

> **✅ Closed 2026-08-24 (`D-45` review).** `T452` — *"Conformance check asserting `README.md`
> exists at the repository root and…"* — is in [tasks.md](./tasks.md) and is marked `[X]`. **This
> section had said "Open" since 2026-08-05 while the task that closed it sat completed two files
> away.** Found by reading the task list during this plan pass, not by a check: nothing compares a
> plan's open findings against the tasks that discharge them, which is a gap worth naming even
> though closing it is not this scope's job.
>
> The lesson generalises to F-11.3 and is why Gate V above names **three** checks with **three**
> mutations rather than trusting that a task will produce them.

### G-14.2 · `T153`'s scenario coverage — ✅ **enforced**, no longer remembered

Updated on 2026-08-05 when EPIC-016's `T143c` added quickstart **V14** for ADRs. Without that update
the release gate would have passed without ever exercising `FR-034`.

⚠️ **This will need updating again** whenever any epic adds a quickstart scenario. Nothing enforces
it — the numbering lives in `_shared/quickstart.md` and the gate that runs it lives here.

> **The warning above came true, and it took two Epics to notice** (`T153b`, convergence `H2`).
>
> This section was headed *"covers V1–V12 and V14 — **✅ current**"*. It was not current, twice
> over:
>
> - **`V11a` was never run at all.** `EPIC-011` added *Observability across the sandbox boundary*
>   between `V11` and `V12`, and **a lettered scenario is not inside a numeric range** — so
>   `V1–V12` silently excluded it, from the day it was written, for every release since.
> - **`F-11.3` added seven scenarios** and allocated no `V`-number, so the containerised stack the
>   gate is meant to ship was never in the gate's scope.
>
> Neither was noticed by reading. Both were found by `T153c` on its **first run** — the check this
> section said did not exist, written because *"nothing enforces it"* is a prediction that had
> already come true when it was made.
>
> **A warning that does not fire is a comment.** `T153c` now parses the `### V<n>` headings the
> quickstart defines and the `V`-numbers `T153` claims, and fails on any scenario the gate does not
> run — with an `NOT_AT_THE_GATE` map for deliberate exclusions, each carrying its reason (`V13` is
> the nightly real-engine test, which would bill the programme per promotion). Mutation-verified:
> adding a `V16` heading turns it red naming `V16`.
>
> This is `EPIC-036` `T442v`'s lesson in a different document: **a number restated in two places
> drifts unless something compares them.**

## Build order

```text
F-11.1  T149a check ──► T149 seed ──► T150 README ──► T452 README check

F-11.3  dependency row D-30 ──► image + compose service ──► the three checks
        (depends on NOTHING else in this Epic — see spec.md "Depends on")

F-11.2  (all fifteen epics closed first)
        T151 unit-test records ──► T154 converge records ──► T155 defect records
        T151a principle baseline · T152 test:arch · T152a arch review · T152b security review
        T153 quickstart V1–V12 + V14 · T155a SRS back-fill
                        └─► T156 promote local → dev → stage → prod
```

## Design notes specific to this epic

**Confirmation, not repetition.** The gate reads records. An epic that has not written `closure.md`
is not ready, and the gate says so rather than doing the epic's work for it.

**`T156` is the only task in the programme that promotes anything.** Constitution VII's one-way
pipeline has exactly one entry point, and this is it.

## Phase 0 / Phase 1 outputs

**For F-11.1 and F-11.2: none, and that judgement stands.** Every technical question the release
gate raises was answered when `_shared/research.md`, `data-model.md`, `schema.sql` and `contracts/`
were written. A per-epic `research.md` recording *"no decisions"* would be an artifact pretending
to be work — the same judgement EPIC-016's plan made.

**For F-11.3: three artifacts, because it genuinely decides things** (`D-45`, 2026-08-24):

| Artifact | Why it exists |
|---|---|
| [research.md](./research.md) | Eight decisions (`R-014-1`–`R-014-8`) with alternatives and the Context7 library IDs behind them |
| [contracts/container-stack.md](./contracts/container-stack.md) | The services, the one origin, what the image must never contain, and **what the stack does not prove** |
| [quickstart.md](./quickstart.md) | Seven scenarios with three mutation checks — how to prove it works without reading it |

**No `data-model.md`.** This scope persists nothing, defines no entity and adds no migration. The
existing `_shared/data-model.md` is untouched, and writing a per-Epic one saying *"no entities"*
would be the artifact-pretending-to-be-work this plan already refuses once above.

## Definition of done

- [ ] Every task complete (Constitution V, as amended by v1.2.0) — counted in [tasks.md](./tasks.md), not here
- [X] **G-14.1 closed** — `T452` gave `T150` its executable conformance check
- [ ] **F-11.3**: the stack starts from a clean checkout with no host toolchain; a deep link
      survives a refresh (`R-036-3` discharged); **every check in the Gate V table above passes
      and each has been seen to fail** — the table is the inventory, counted nowhere else
      (`T153d`); `@nestjs/serve-static` is registered as `D-30`; the reference local stack
      (`EPIC-036` `T442l`) still runs and `dev` is fixed
- [ ] All fifteen `closure.md` records present and clean
- [ ] Architecture and security reviews held and recorded
- [ ] Promotion follows `local → dev → stage → prod` with no environment skipped
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
