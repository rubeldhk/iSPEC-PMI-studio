# Closure record: EPIC-004 Workspace Tenancy & Audit

> ~~⚠️ **The epic is NOT closed.**~~ **Superseded 2026-08-18 — the epic is now CLOSED.** This file
> was created a day early because `T649` requires its outcome recorded here. Phase Z has since run
> and Constitution IX's closing report is at the foot of this document. The `T649` record below
> stands unchanged as the evidence it always was.

## `T649` — the migration executed against a real database

**Run 2026-08-17. All six `T453` cases pass.**

For the whole life of this epic, `tasks.md` carried the warning *"the migration has never been
applied to a real database… do not report this as a working schema until `T649` runs."* `T649` has
now run. The trigger is no longer unverified SQL in a file.

```text
pnpm test:integration
✓ tests/integration/audit-immutability.spec.ts (6 tests) 6429ms
Test Files  4 passed (4)
     Tests  35 passed (35)
```

| Case | Result |
|---|---|
| applied the migration and holds the probe row | pass |
| rejects `UPDATE` | pass |
| rejects `DELETE` | pass |
| leaves the row intact after both attempts | pass |
| still permits `INSERT` — append-only, not read-only | pass |
| exposes `reject_mutation()` for the version tables EPIC-007 and EPIC-009 will add | pass |

**Environment**: Docker 28.3.3, server 28.3.3, `linux/x86_64`, via Testcontainers on the Windows named
pipe `//./pipe/docker_engine`. Nothing was skipped — the suite's `DOCKER_UNAVAILABLE=1` name-level
skip was not triggered, so these are executions, not collections.

**What this verifies, precisely**

- **`FR-033`** — audit entries are append-only, *enforced by PostgreSQL*. The distinction `T453` was
  written to defend is now evidenced: a raw `UPDATE` issued outside the service layer is rejected by
  the database. A mocked repository could never have failed this test.
- **`SC-012`** — the immutability success criterion, verified for the first time.
- **`T013` and `T454`** transitively: the migration ran, so its DDL is not merely asserted by
  `T012a`'s content check.
- **`reject_mutation()` is shared**, as `T454` requires. EPIC-007 `requirement_versions` and
  EPIC-009 `specification_versions` attach to it rather than redefining it, and the sixth case
  proves the function is there for them to attach to.

**RAID `R-04` — "no container runtime available" — is retired for this repository.** It was true when
recorded and is no longer true; a Docker daemon is reachable here.

## Still open

| Task | What it is |
|---|---|
| `T052` | Cross-workspace access returns not-found and is audited |
| `T455` / `T456` | Project-scoping composes with workspace scoping (**FR-003**) |
| `T173`–`T176` | Phase Z closure |

The epic remains ▶ **proceeding**; it is not blocked on `PMI-DOC-004`.

---

# Closing Report: EPIC-004 Workspace Tenancy & Audit

**Session**: `EPIC-004 Workspace Tenancy` · **Branch**: `epic/004-workspace-tenancy-audit` ·
**Date**: 2026-08-18

Written against [`governance/closing-report.md`](../../governance/closing-report.md).
`T173`–`T176` are discharged by the sections below.

> **Constitution VIII: satisfied.** The branch names the epic being worked — the first session in
> this programme where that is true. `G-10` (`D-39`, taken yesterday) reports nothing.

## Work Completed

**29 of 29 tasks**, including five appended by convergence.

| Function | Outcome | Evidence |
|---|---|---|
| F-01.1 Workspace & user data foundation | done | 4 tasks; migration applied to a real PostgreSQL |
| F-01.2 Scoping & isolation | done | scoping helper, guard, **project scoping**, integration test |
| F-13.1 Audit trail | done | service, interceptor, read-only endpoint, database trigger |
| Phase 1 Convergence | done | 4 findings, all `partial`, all closed |
| Phase Z Closure | done | this document |

### What this session added

**`T455`/`T456` — project scoping (`FR-003`).** `FR-003` is co-owned with EPIC-006 and had **zero**
task coverage here until analysis finding `C4`. `projectScoped` delegates to `scoped()` rather than
filtering beside it, because the tempting implementation — project id alone, since a project belongs
to one workspace — has **no tenancy boundary at all** the moment an id is guessed, leaked in a URL,
or copied between environments. Tenancy is enforced by the filter, never by an id's provenance.

**`T052` — the isolation integration test.** The helper's own output builds the SQL: `selectWhere()`
reads whatever keys `scoped()` put in `where` and emits one equality per key, and nothing in the test
knows the word *workspace*. If the helper stops emitting `workspaceId`, the `WHERE` clause loses the
filter and the test sees the other tenant's row. **It fails by leaking, not by shape.**

**`T674`/`T674a` — the audit layer is reachable.** See below; this was the session's real finding.

## Verified

| Gate | Command | Result |
|---|---|---|
| Unit tests | `pnpm test:unit` | **679 passed**, 60 files |
| Integration | `pnpm test:integration` | **43 passed**, 5 files — real PostgreSQL via Testcontainers |
| Architecture | `pnpm test:arch` | 22 passed |
| Governance | `pnpm test:governance` | 359 passed, 24 files |
| Typecheck | `pnpm typecheck` | pass |
| Lint | `pnpm lint` | pass, 0 warnings |

**Six mutations, all caught**, each naming the right assertion:

| Mutation | Caught by |
|---|---|
| project scoping *replaces* workspace scoping | 3 assertions incl. the `FR-003` headline |
| caller-supplied `projectId` wins | 2 assertions |
| `scoped()` drops the workspace filter | 3 assertions in `T052`, against a real database |
| the guard stops recording refusals | both audit assertions in `T052` |
| the refusal message differs from a genuine absence | the `SC-004` comparison |
| the controller's `@Inject(AUDIT_READER)` removed | one assertion — see below |

### The mutation that got through first

`T674a` originally asserted that the DI container *instantiated* the controller. Removing
`@Inject(AUDIT_READER)` **did not fail it**: this suite is transformed by esbuild, which does not
emit `design:paramtypes`, so Nest saw a zero-argument constructor and built an instance whose reader
was `undefined`. Under `tsc` — how the API is actually built — the same code throws at bootstrap.

The test was measuring "did it return an object" and reporting it as "is it wired". Replaced with an
assertion on **what was injected** — the controller must reach the unconfigured reader and refuse by
name — which the mutation cannot survive. Recorded because it is the same failure this programme
keeps finding, caught this time in my own test rather than in someone else's.

## Convergence — `T174`

`/speckit-converge` checked 3 requirements, 2 success criteria, 5 plan decisions and 9 constitution
principles, and returned **four findings, all `partial`, none `missing`**. Nothing this epic
specified was absent; two things it built were unreachable.

**`F1` — the audit layer had no wiring.** `audit.module.ts` was `@Module({})`. `AuditService`,
`AuditInterceptor` and `AuditController` were fully built, fully tested and **never provided or
registered**: the running API had no audit layer, nothing served `/v1/audit`, and `FR-033` reported
as satisfied by no running code at all.

This is the exact sentence `EnginesModule` carries in its own header from `T462` — *"fully built,
fully tested, and unreachable"* — found by convergence there, fixed there, and still open here in
the epic that owns `FR-033`. `T674` wires it behind `AUDIT_WRITER` / `AUDIT_READER` tokens, so the
one remaining gap is a single persistence adapter rather than an absent module. The default writer
**refuses rather than discarding**: a no-op would let an action succeed with no audit record, which
is precisely what `FR-033` and the database trigger exist to prevent, and it would do it invisibly.

**`F2` — `assertSameWorkspace` has no production caller (`T675`).** Grep returns nothing outside its
own file. The guard is implemented, unit-tested and unreachable, because **no endpoint yet fetches a
workspace-scoped resource** — the audit controller scopes its own query and needs no guard. The
first such endpoint is EPIC-006 `T054` (projects service), which is held behind `PMI-DOC-004`.

> **Owner: EPIC-006.** The guard is not dead code and not a gap in this epic's design; it is
> correct code with no caller yet. It must be wired by the first resource-fetch endpoint, and that
> is recorded here rather than assumed.

**`F3` — two definition-of-done items are not dischargeable by this epic (`T676`).** `plan.md`
requires quickstart **V2** (*"sign in as a user of workspace B; request that id directly"*) and
**V12** (*"perform a create, an edit, a lifecycle transition, a generation, and a refused access"*).
Both require **sign-in** — EPIC-005, held — and a persistence adapter. Neither can pass here, at any
level of effort, and neither was recorded as deferred.

> **Owner: EPIC-005 for the sign-in half; EPIC-014 F-11.2 for the end-to-end run.** `V2`'s
> *assertions* are all covered by `T052` at the layer below HTTP — 404-not-403, identical messages,
> the refusal audited — but the scenario as written is an HTTP round trip and is **not claimed to
> pass**. `V12` needs four action types this epic does not produce.

**`F4` — `DEF-004-001` was open, and its own resolution was unimplemented (`T677`).** The defect
recommended Option C (defer to EPIC-005) *and* asked for a note in `_shared/schema.sql` so the gap
would not be re-raised. That note did not exist. It does now, naming the divergence, the owner and
the reason; the defect is **closed as deferred, not as fixed** — the schema still diverges from the
design DDL, and that is now recorded where a reader will find it.

## Not verified

- **Quickstart `V2` and `V12` have not been run**, and cannot be until EPIC-005 lands. Their
  assertions are covered at the layer below by `T052`; the scenarios themselves are unrun. This is
  the honest statement `plan.md`'s definition of done did not carry.
- **No audit entry has ever been written by the running API.** `T674` makes the layer reachable; the
  persistence adapter is still absent, and the default writer refuses. `SC-012` is verified at the
  unit and database levels — the trigger has raised (`T649`) — not end to end.
- **`assertSameWorkspace` has never refused a real request**, because no request path calls it yet.
- ~~**CI has not run.** Every gate above was executed locally; nothing is pushed.~~ **Corrected 2026-08-19: CI runs on every push**, and has since 2026-08-17.

## Deferred

| Item | Owner | Awaiting |
|---|---|---|
| Wire the tenancy guard into the first resource-fetch endpoint | **EPIC-006** `T054` | `PMI-DOC-004` |
| Prisma-backed `AUDIT_WRITER` / `AUDIT_READER` adapters | **EPIC-005** | a Prisma client at the composition root |
| `created_by` / `updated_by` columns (`DEF-004-001`) | **EPIC-005** | actor propagation |
| Quickstart `V2`, `V12` end-to-end | **EPIC-005**, then EPIC-014 F-11.2 | sign-in |
| RBAC and SSO (`PP-008` partial) | Phase 3 | out of scope by design |

## Constitution and principle conformance

| Principle | Verdict |
|---|---|
| I Spec Kit Command Gate | pass — all work via `/speckit-implement` and `/speckit-converge` |
| II SRS as Source of Truth | pass — inherits the platform traceability table; no requirement originates outside it |
| III Epic → Feature → Task | pass — 3 functions + convergence + closure, 29 tasks |
| IV Convergence Gate | pass — `T174` run; 4 findings appended and completed |
| V Mandatory unit tests | pass — every implementation task has a paired test, each confirmed red first; six mutations verified |
| VI Defect Traceability | pass — `DEF-004-001` closed as deferred with a named owner; `defects/` holds no open records |
| VII Promotion Pipeline | not applicable — gated separately by EPIC-014 F-11.2 |
| VIII Session Labelling | **pass — first time in this programme.** Branch `epic/004-workspace-tenancy-audit` names the epic worked |
| IX Mandatory Closing Report | pass — this document |

## Epic Exit Criteria

- [x] Every implementation task has a passing unit test (Constitution V) — `T173`
- [x] `/speckit-converge` reports no unbuilt work — `T174`; four findings appended and closed
- [x] `defects/` contains no open records — `T175`; 1 raised, 1 closed as deferred
- [x] Principle deltas still hold; every deferral retains a valid owner — `T176`
- [x] Epic closure recorded in `closure.md` — this document
- [ ] Platform promotion `local → dev → stage → prod` — **not this epic's to discharge**
      ([EPIC-014 F-11.2](../014-devops-release/tasks.md))

**EPIC-004 is CLOSED and release-eligible** — the fifth epic to close, after EPIC-001, EPIC-018,
EPIC-003 and EPIC-027.

Release-eligible is a claim about this epic's scope: the tenancy boundary, the scoping helpers, the
guard, and the audit trail exist, are tested, and are reachable. It is **not** a claim that a running
system refuses a cross-workspace HTTP request today — no request path calls the guard, and no
persistence adapter exists. Both are deferred above with named owners, and both wait on
`PMI-DOC-004` rather than on anything this epic could have built.

**The foundation trio is complete.** EPIC-001, EPIC-003 and EPIC-004 — the three epics every held
epic builds on — are now closed.

## Recommended Next Task

**`PMI-DOC-004` and approved business scope.** Unchanged, and now sharper: with the foundation trio
closed, **every remaining buildable thing in this programme is process, not product**. The only
proceeding epic left with open tasks is EPIC-026 (71 tasks, the epic-stage register), and it ships
no product capability.

Nineteen epics and 393 tasks are specified, planned, tasked and waiting on one business document.

If EPIC-026 is wanted before then, it is worth doing for one concrete reason: it replaces the
hand-maintained Proceeding/Held groupings and per-epic task counts in `specs/README.md` with a
generated register. Those counts were edited by hand twice in the last two days.
