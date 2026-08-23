# Research: Governed Engineering Loop

**Epic**: `EPIC-030` · **Phase**: 0 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Eight decisions. Four resolve `NEEDS CLARIFICATION` items from Technical Context; four resolve
choices the 2026-08-22 clarification session created by settling a requirement without settling how
it is met.

**Current-docs discipline**: Context7 MCP was available and was used for both external-dependency
decisions (`R-030-1`, `R-030-8`). Library IDs are recorded so `/speckit-implement` and
`/speckit-converge` can query the same source without re-resolving.

---

## `R-030-1` — Concurrency control for `FR-GEL-015`

**Decision**: **Optimistic concurrency on a `version` column**, applied with a conditional
`updateMany` filtered on `{ id, version }` and `version: { increment: 1 }`. A result of
`count === 0` means another transition won the race; that attempt is refused and the refusal is
recorded per `FR-GEL-014`.

**Rationale**: `FR-GEL-015` says *first to commit wins, second refused with a recorded conflict* —
which is precisely OCC's semantics, and the refusal is the outcome rather than an error to retry
past. It takes no locks, so a slow stage handler cannot block every other transition on the same
object, and the loop sits on the critical path of every governed action (`ADR-0025`). The current
Prisma documentation demonstrates exactly this shape, including the `count === 0` check as the
signal that the race was lost.

**Alternatives considered**:
- *Pessimistic row lock (`SELECT … FOR UPDATE`)* — rejected. It serialises rather than refuses, which
  is the behaviour `FR-GEL-015` explicitly rejected during clarification: the waiter's gates were
  evaluated against a stage that no longer exists by the time the lock is granted.
- *`Serializable` isolation* — rejected as the primary mechanism. It converts the conflict into a
  retryable database error rather than a domain outcome, so the "recorded conflict naming the
  transition that won" would have to be reconstructed after the fact instead of being the result.
- *Application-level mutex* — rejected. It moves a correctness guarantee out of the database into a
  process that can be restarted mid-transition.

**Docs consulted**: `/prisma/web` — *optimistic concurrency control with a version field*. Confirmed
the `updateMany` + version-filter form, which is the version-safe expression on the pinned
`@prisma/client` `^5`; the extended `update`-with-non-unique-`where` form is not relied upon.

---

## `R-030-2` — Fail-closed audit for `FR-GEL-041`

**Decision**: **The transition write and its audit record occur in one database transaction.** If
the audit write fails, the transaction rolls back and the transition never happened. The existing
`AuditService.record(input, tx?)` already accepts a transaction handle, so this needs no new audit
mechanism.

**Rationale**: `FR-GEL-041` requires the loop to refuse rather than proceed unrecorded. Making
atomicity the mechanism means the guarantee is enforced by the database rather than by remembering
to check a return value — there is no ordering of two writes in which one can succeed alone. It also
answers the edge case honestly: an audit outage produces refused transitions, which are visible,
rather than a gap, which is not.

**Alternatives considered**:
- *Write the transition, queue the audit record durably* — rejected at clarification. It introduces
  "provisional" transitions, a second state the loop model does not have.
- *Best-effort audit with alerting* — rejected. `BR-0111` is unconditional and `BG-05` measures zero
  ungoverned actions; an alert is a report of the violation, not a prevention of it.
- *Audit to a separate store with two-phase commit* — rejected as disproportionate. `EPIC-004` owns
  audit persistence and it is already in the same database.

**Docs consulted**: none needed — this uses an existing in-repository seam
(`backend/src/modules/audit/audit.service.ts`), not an external library feature.

---

## `R-030-3` — Where the loop model lives

**Decision**: A new workspace package **`packages/loop-contract/`**, holding the stage vocabulary,
the transition contract, the loop-instance configuration schema and the progress-projection shape.
The engine that implements it lives in **`backend/src/modules/loop/`**.

**Rationale**: This repository already separates a contract from its implementations three times —
`packages/engine-contract`, `packages/agent-contract`, `packages/execution-contract` — each with an
architecture test asserting the independence. `FR-GEL-002` (one vocabulary, defined once) and
`FR-GEL-061` (no Room-specific vocabulary) are exactly the kind of constraint those packages exist
to make checkable. A contract package also gives the Rooms something to depend on that is not the
engine.

**Alternatives considered**:
- *Everything inside `backend/src/modules/loop/`* — rejected. Three Room Epics would then import from
  the backend module, and `FR-GEL-061` would be enforced by review rather than by a boundary.
- *Extend `packages/execution-contract`* — rejected. That contract is about executing agent work; the
  loop is about governing workflow state, and merging them would put Room-adjacent vocabulary into a
  package `EPIC-028` owns.

---

## `R-030-4` — Loop instance configuration: format, location, and its conformance check

**Decision**: Configurations are **JSON documents under `packages/loop-contract/workflows/`**, one
per workflow type, each carrying a `schemaVersion` and a monotonic `configVersion`. A **conformance
check** in `backend/tests/architecture/` reads every file and fails when it declares a stage outside
`FR-GEL-001`, names an unregistered stage handler, or declares an automated transition with no
citable rule.

**Rationale**: `FR-GEL-005` requires versioned, reviewable, repository-resident content, and
`FR-GEL-009` makes stages programme-defined — repository files are the natural expression of both.
Constitution V requires a non-code output to carry an **executable conformance check** rather than a
review step: *"A conformance check MUST be able to fail. A check that cannot fail is decoration."*
This check is what makes `FR-GEL-007` (refuse a bad configuration at load) provable before runtime.

**Alternatives considered**:
- *Database-held configuration with an admin UI* — rejected for now. It would make configuration
  changes invisible to code review, and `FR-GEL-016` makes those changes a high-band governed act.
- *YAML* — rejected on a thin margin. JSON has no ambiguity about types and the repository already
  uses JSON for `governance/epic-stage.config.json`, which is the closest analogue in the tree.

---

## `R-030-5` — Registering stage implementations

**Decision**: A **`StageHandler` port per stage**, registered by token in the loop module. A
configuration naming a stage with no registered handler is **refused at load** (`FR-GEL-007`), and
the **Decide** seam with no registered policy provider **refuses the transition** rather than
permitting it (`FR-GEL-062`).

**Rationale**: The three seams this Epic declares — Decide (`EPIC-031`), Evidence (`EPIC-032`),
Room UX (`EPIC-033`–`035`) — do not exist yet, so the loop must be buildable and testable with them
absent. Refuse-by-default is the only posture consistent with `ADR-0025`'s reasoning; a substrate
whose missing policy provider defaults to permit installs the failure mode at the foundation.

**Alternatives considered**:
- *No-op default handlers* — rejected. A no-op Decide handler is an auto-approval wearing a
  placeholder's name, and it would pass every test written against it.
- *Fail at first use rather than at load* — rejected. `FR-GEL-007` requires the refusal at
  configuration load, so a misconfiguration is found by CI rather than by the first object that
  reaches that stage in production.

---

## `R-030-6` — Performance and scale targets (`PP-018`, deferred here by the spec)

**Decision**:

| Target | Value |
|---|---|
| Loop's own transition overhead, excluding stage-handler work | **p95 < 50 ms** |
| End-to-end transition including audit write, excluding stage handlers | **p95 < 150 ms** |
| Loop-progress projection (`FR-GEL-050`) | **p95 < 100 ms** |
| Transition throughput per workspace | **≥ 50/second sustained** |
| Loop history retained per object | unbounded; transitions are append-only and never pruned |

**Rationale**: `ADR-0025` names availability and latency as product concerns *"because the engine
sits on the critical path of every governed action"* — the same is true of the loop it is the Decide
stage of. The overhead figure is stated separately from the end-to-end figure so that a slow stage
handler is attributable to the handler rather than to the loop. Throughput is set per workspace
because `BR-0001` makes the workspace the isolation unit.

**Alternatives considered**: *Leave targets to implementation* — rejected. The spec deferred them to
this plan specifically so a number exists before tasks are written; deferring again would mean the
first performance conversation happens after the design is fixed.

---

## `R-030-7` — Governing configuration change (`FR-GEL-016`) before `EPIC-031` exists

**Decision**: A two-stage answer, with the interim stated as interim.

1. **Now**: configurations are repository files, so a change requires a reviewed, attributed commit.
   The loop **records the approving commit** alongside the `configVersion` it loaded, and refuses to
   load a configuration whose approval metadata is absent.
2. **On `EPIC-031`**: the repository-review gate is **replaced** by the policy engine's high-band
   approval, and the loop asks the Decide seam. `FR-GEL-016` says the band is not lowerable, so the
   swap only ever tightens.

**Rationale**: `FR-GEL-016` requires authorized human approval; a reviewed commit *is* authorized
human approval, recorded and attributable. What it is not is *policy-evaluated*, and pretending
otherwise would let the interim become permanent by looking finished.

**Alternatives considered**:
- *Wait for `EPIC-031`* — rejected. It makes this Epic un-implementable until another Epic ships,
  which is the sequencing `ADR-0018` warns about.
- *Ship without the gate and add it later* — rejected. A configuration that can be changed without
  approval is a route around every approval it defines, and retrofitting a gate after Rooms depend
  on the configuration is materially harder.

**Recorded as a debt**: this interim is named in `plan.md` Complexity Tracking and must be closed by
`EPIC-031`; it is not an accepted end state.

---

## `R-030-8` — Satisfying Constitution XI Tier 1

**Decision**: The reachability test bootstraps the **real composition root** —
`Test.createTestingModule({ imports: [AppModule] })` — then `createNestApplication()`, and drives a
transition through the **actual HTTP route** with supertest. The only permitted override is the
outermost infrastructure boundary (the database); **no loop collaborator is mocked**.

**Rationale**: Constitution XI Tier 1 requires *"the real composition root rather than a
hand-assembled one"* and states that a mocked collaborator provably cannot satisfy it, because *"the
mock is present precisely where the missing wiring would be."* Importing `AppModule` is what makes
the test fail when the loop module is written but never registered — the defect class Principle XI
was ratified over, six times.

**Alternatives considered**:
- *`Test.createTestingModule({ imports: [LoopModule] })`* — rejected. It composes a graph the
  application never builds, so it cannot detect an unregistered module.
- *Calling the loop service directly* — rejected explicitly by Principle XI: *"Calling a service
  method directly is not an entry point; it is the thing the entry point was supposed to reach."*

**Docs consulted**: `/nestjs/docs.nestjs.com` — *end-to-end testing with `Test.createTestingModule`,
`AppModule` import and `overrideProvider`*. Confirmed the `imports: [AppModule]` +
`createNestApplication()` + supertest shape on the pinned `@nestjs/core` `^10.4.15`.

---

## Resolved `NEEDS CLARIFICATION` items

| Item | Resolved by |
|---|---|
| Performance Goals | `R-030-6` |
| Constraints (latency budget) | `R-030-6` |
| Storage of loop state and configuration | `R-030-1`, `R-030-4` |
| Project Type / where the code lives | `R-030-3` |

**None remain.** Every Technical Context field in `plan.md` carries a concrete value.

## Library IDs for downstream commands

| Dependency | Context7 library ID | Consulted for |
|---|---|---|
| Prisma (`@prisma/client` `^5`) | `/prisma/web` | optimistic concurrency control (`R-030-1`) |
| NestJS (`@nestjs/core` `^10.4.15`) | `/nestjs/docs.nestjs.com` | composed-graph e2e testing (`R-030-8`) |

**One new dependency, verified**: `supertest` (and `@types/supertest`) are **not** currently in
`backend/package.json`, and **no `createNestApplication` test exists anywhere in the repository** —
checked, not assumed. Two consequences, both tasks rather than assumptions:

- `TS-001` requires an entry in [`specs/_shared/dependencies.md`](../_shared/dependencies.md)
  recording what it is for, what was considered instead, and its licence, **before** it enters
  `package.json`.
- **This Epic establishes the backend Constitution XI Tier 1 pattern.** `EPIC-029`'s `T899a` set the
  precedent on the frontend by mounting the application at its root; the backend has no equivalent
  yet, and its five `tests/integration/` files exercise services rather than HTTP routes. The
  reachability test written here is the one every later backend Epic will copy, which is an argument
  for getting `R-030-8` right rather than expedient.

No other external library is introduced by this Epic.
