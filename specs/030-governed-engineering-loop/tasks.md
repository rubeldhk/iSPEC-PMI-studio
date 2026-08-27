---

description: "Task list for EPIC-030 Governed Engineering Loop"
---

# Tasks: Governed Engineering Loop

**Epic**: `EPIC-030`

**Input**: Design documents from `/specs/030-governed-engineering-loop/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/loop-contract.md](./contracts/loop-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task that produces or changes application code has an
accompanying unit-test task. Unit tests are written FIRST and MUST fail before the implementing code
is written. A task is not complete until its tests pass. The `/speckit-tasks` skill describes tests
as optional; **the constitution overrides it** — *"Where any template, skill file, tool default, or
prior practice conflicts with it, this document wins."*

**Non-code outputs count too** (Constitution V, v1.2.0). This Epic's non-code output is the set of
loop instance configuration files under `packages/loop-contract/workflows/`; their executable
conformance check is `T993s`, written failing-first, and `T932` makes the files pass it. A check
that cannot fail is decoration, which is why `T993s` precedes `T932` rather than describing it.

**Organization**: grouped by the five user stories of [spec.md](./spec.md), each independently
implementable and testable.

**Task ID range**: `T993a`–`T993`, 83 tasks (`T944a`/`T944b` added 2026-08-22 to close analysis finding `C1`). The corpus high-water mark was `T912` when this list was
written; identifiers are unique corpus-wide (`G-26-15`, `DEF-028-014`). Ids stay three-digit
deliberately — the governance regex is `T\d{3}[a-z]?\b`, so a four-digit id would be **invisible** to
both `G-26-15` and `DOR-08` rather than rejected by them.

**Before starting**: sync the repository from GitHub, and **work in a dedicated worktree** — the
plan's Constitution Check records the concurrent-session gate as **FAIL**, and `T993a` is its
discharge. Label the session `EPIC-030 Governed Engineering Loop` (Constitution VIII).

**Before finishing**: close with a report — artifacts by path, anything in scope not done and why,
and the recommended next task as a concrete Spec Kit command (Constitution IX). The Delivery Board
is currently **stale**; refresh it or restate the staleness.

**Interaction budget** (Constitution X): implementation is an execution phase — run without pausing
for confirmation. A genuinely blocking choice is a quick-select with a recommended default; a
low-risk reversible one proceeds on the default with the assumption recorded.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths in every description

## Path Conventions

Per [plan.md](./plan.md) Structure Decision — the `packages/<x>-contract` + `backend/src/modules/<x>`
split already used by `engine-contract`, `agent-contract` and `execution-contract`:

- Contract package: `packages/loop-contract/`
- Engine: `backend/src/modules/loop/`
- Schema: `backend/prisma/`
- Tests: `packages/loop-contract/tests/`, `backend/tests/integration/`, `backend/tests/architecture/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: make the workspace able to hold a fifth contract package, and discharge the failing gate

- [X] T993a Create the dedicated worktree at `.claude/worktrees/epic-030-governed-engineering-loop` — `git worktree add .claude/worktrees/epic-030-governed-engineering-loop epic/030-governed-engineering-loop` — and work there. Discharges the plan's one failing Constitution gate (concurrent-session isolation), following the EPIC-029 precedent. **Done 2026-08-22**; the path is the repository's own convention (gitignored, three siblings already), not the `../ispec-epic-030` the first draft named
- [X] T993b [P] Scaffold `packages/loop-contract/package.json` and `packages/loop-contract/tsconfig.json` so the package typechecks independently (`TS-004`)
- [X] T993c [P] Register a `loop-contract` project in `vitest.workspace.ts` without `passWithNoTests` — `TS-005`, an empty suite is a failure
- [X] T993d [P] Record `supertest` and `@types/supertest` in `specs/_shared/dependencies.md` with purpose, alternatives considered and licence (`TS-001`, `TS-002`) — verified absent from the repository today
- [X] T993e Add `supertest` and `@types/supertest` to `backend/package.json` devDependencies and refresh `pnpm-lock.yaml` (`TS-003`)
- [X] T993f [P] Add `packages/loop-contract` to the `## Paths that must not break` list in `governance/repository-layout.md` (`G-05d`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the contract, the schema and the conformance check every user story depends on

**⚠️ CRITICAL**: no user story phase may start until this phase completes

### The stage vocabulary and ports — `packages/loop-contract`

- [X] T993g [P] Write failing unit tests for the stage vocabulary in `packages/loop-contract/tests/stages.spec.ts` — asserts exactly eight stages in model order and that the tuple is readonly
- [X] T993h Implement `LOOP_STAGES` and the `LoopStage` type in `packages/loop-contract/src/stages.ts` (unit test: T993g) — `FR-GEL-001`, `FR-GEL-002`
- [X] T993i [P] Write failing unit tests for the five port shapes in `packages/loop-contract/tests/ports.spec.ts` — asserts `GateOutcome.result` has exactly four members and no default, and that `AuditSink.record` requires a non-optional transaction handle
- [X] T993j Implement `StageHandler`, `PolicyProvider`, `EvidenceProvider`, `GateProvider` and `AuditSink` in `packages/loop-contract/src/ports.ts` (unit test: T993i) — `FR-GEL-021`, `FR-GEL-041`, `FR-GEL-062`
- [X] T993k [P] Write failing unit tests for result and projection types in `packages/loop-contract/tests/types.spec.ts`
- [X] T993l Implement `TransitionResult`, `LoopProgress`, `GateOutcome` and `LoopObjectRef` in `packages/loop-contract/src/types.ts` (unit test: T993k)
- [X] T993m Implement the export barrel `packages/loop-contract/src/index.ts` (unit test: T993g)

### Persistence — `backend/prisma`

- [X] T993n Add `LoopInstanceConfiguration`, `LoopObject` and `LoopTransition` models to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) §2–§4
- [X] T993o Generate the migration under `backend/prisma/migrations/` including the `actorKind = 'automation' ⇒ triggerRuleId IS NOT NULL` constraint (`FR-GEL-031`) and the partial unique index on `(objectId, triggerEventId, triggerRuleId) WHERE outcome = 'accepted'` (`FR-GEL-033`)
- [X] T993p [P] Write failing integration test asserting `LoopTransition` rejects `UPDATE` and `DELETE` in `backend/tests/integration/loop-append-only.spec.ts` — `FR-GEL-040`, following the `audit-immutability.spec.ts` precedent
- [X] T993q [P] Write failing integration test asserting the automation constraint rejects a rule-less automated transition at the database level in `backend/tests/integration/loop-automation-constraint.spec.ts` — `FR-GEL-031`

### Configuration files and their conformance check — the non-code output

- [X] T993r [P] Author the loop instance configuration JSON schema and one worked example in `packages/loop-contract/workflows/` per [contracts/loop-contract.md](./contracts/loop-contract.md) §5 — `FR-GEL-005`, `FR-GEL-020` (a transition carries its named required gates)
- [X] T993s [P] Write the failing executable conformance check in `backend/tests/architecture/loop-config-conformance.spec.ts` — fails on a stage outside `LOOP_STAGES`, an unregistered stage handler, a trigger with no rule id, or absent `approvedBy`/`approvalRef`
- [X] T932 Make every file in `packages/loop-contract/workflows/` pass T993s (conformance: T993s) — Constitution V for a non-code output, `FR-GEL-005`
- [X] T933 [P] Write the failing architecture test in `backend/tests/architecture/loop-independence.spec.ts` — asserts `packages/loop-contract` imports nothing from a Room module and contains no Room vocabulary, modelled on `engine-independence.spec.ts` — `FR-GEL-061`

### Module skeleton and its wiring

- [X] T934 [P] Write the failing reachability test in `backend/tests/integration/loop-reachability.spec.ts` importing the real `AppModule` — Constitution XI Tier 1, `R-030-8`
- [X] T935 Implement `backend/src/modules/loop/loop.module.ts` and `backend/src/modules/loop/loop.tokens.ts` (integration test: T934)
- [X] T936 Register `LoopModule` in `backend/src/app.module.ts` (integration test: T934) — the wiring T934 exists to prove

**Checkpoint**: contract, schema and checks exist and fail for the right reasons — user stories may begin

---

## Phase 3: User Story 1 - A new governed workflow is declared as a configuration (Priority: P1) 🎯 MVP

**Goal**: a workflow type this Epic's code does not name runs end to end by configuration alone

**Independent test**: [quickstart.md](./quickstart.md) Scenario 1 — declare `example-review.json`,
drive an object through every declared stage, and assert `git diff --stat backend/src` is empty

- [X] T937 [P] [US1] Write failing unit tests for the configuration loader in `backend/tests/unit/loop-config-loader.spec.ts` — refusal on unknown stage, unregistered handler, rule-less trigger, missing approval
- [X] T938 [US1] Implement `backend/src/modules/loop/loop-config.loader.ts` (unit test: T937) — `FR-GEL-003`, `FR-GEL-007`, `FR-GEL-016`
- [X] T939 [P] [US1] Write failing unit tests for stage-omission handling in `backend/tests/unit/loop-stage-omission.spec.ts` — an omitted stage is visible, not absent — `FR-GEL-008`
- [X] T940 [US1] Implement stage resolution and omission in `backend/src/modules/loop/loop.service.ts` (unit test: T939)
- [X] T941 [P] [US1] Write failing unit tests for `StageHandler` registration and refusal-when-absent in `backend/tests/unit/loop-stage-registry.spec.ts` — `R-030-5`
- [X] T942 [US1] Implement the stage handler registry in `backend/src/modules/loop/stage-registry.ts` (unit test: T941) — `FR-GEL-007`, `FR-GEL-062` refuse-by-default
- [X] T943 [P] [US1] Write failing unit tests for tenant configuration scope in `backend/tests/unit/loop-config-scope.spec.ts` — a tenant row whose `stages` differ from the programme file is refused — `FR-GEL-009`
- [X] T944 [US1] Implement the programme/tenant configuration split in `backend/src/modules/loop/loop-config.loader.ts` (unit test: T943) — `FR-GEL-009`, clarified 2026-08-22
- [X] T944a [P] [US1] Write failing unit tests for workflow-type isolation in `backend/tests/unit/loop-type-isolation.spec.ts` — an object of workflow type A MUST NOT be transitionable under type B's stages, authorities or gates; each type resolves its own configuration — `FR-GEL-004`, `ADR-0018`
- [X] T944b [US1] Implement per-type configuration resolution on the transition path in `backend/src/modules/loop/loop.service.ts` (unit test: T944a) — `FR-GEL-004`. `ADR-0018`'s only decided constraint: *"A shared engine must not collapse three governed surfaces into one"*
- [X] T945 [US1] Implement `POST /loop/objects` in `backend/src/modules/loop/loop.controller.ts` (integration test: T934) — `declareObject`, pinning `configVersion` per `FR-GEL-006`
- [X] T946 [US1] Write the integration test for quickstart Scenario 1 in `backend/tests/integration/loop-new-workflow-type.spec.ts` — asserts zero lines of new engine code (`SC-GEL-001`)

**Checkpoint**: US1 is independently demonstrable — a new workflow type runs without engine changes

---

## Phase 4: User Story 2 - Every state change is explicit, authorized and answerable (Priority: P1)

**Goal**: transitions are the only way state moves, and the whole history reconstructs from them

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 2, 3, 4 and 5

- [X] T947 [P] [US2] Write failing unit tests for transition authority in `backend/tests/unit/loop-authority.spec.ts` — an unauthorized attempt is refused and names the missing authority — `FR-GEL-011`
- [X] T948 [US2] Implement authority evaluation in `backend/src/modules/loop/loop.service.ts` (unit test: T947)
- [X] T949 [P] [US2] Write failing unit tests for the transition record's required fields in `backend/tests/unit/loop-transition-record.spec.ts` — actor, authority basis, object version, from, to, trigger, result all present — `FR-GEL-012`, `SC-GEL-003`
- [X] T950 [US2] Implement transition-record construction in `backend/src/modules/loop/transition-writer.ts` (unit test: T949)
- [X] T951 [P] [US2] Write failing unit tests asserting a refusal is itself recorded in `backend/tests/unit/loop-refusal-record.spec.ts` — `FR-GEL-014`
- [X] T952 [US2] Implement refusal recording in `backend/src/modules/loop/transition-writer.ts` (unit test: T951)
- [X] T953 [US2] Implement `POST /loop/objects/:id/transitions` in `backend/src/modules/loop/loop.controller.ts` (integration test: T934) — `403` on missing authority, `409` on lost race
- [X] T954 [US2] Implement optimistic concurrency via conditional `updateMany` on `{ id, version }` with `version: { increment: 1 }` in `backend/src/modules/loop/transition-writer.ts` (integration test: T956) — `R-030-1`, `FR-GEL-015`
- [X] T955 [US2] Implement the single-transaction transition-plus-audit write in `backend/src/modules/loop/transition-writer.ts` (integration test: T957) — `R-030-2`, `FR-GEL-041`
- [X] T956 [P] [US2] Write the concurrency integration test in `backend/tests/integration/loop-concurrency.spec.ts` — two concurrent transitions, exactly one accepted, loser `409` with `wonBy`, both recorded (`SC-GEL-011`)
- [X] T957 [P] [US2] Write the fail-closed integration test in `backend/tests/integration/loop-fail-closed.spec.ts` — audit writer fails, transition refused, stage unchanged on read-back (`SC-GEL-009`)
- [X] T958 [P] [US2] Write failing unit tests for direct-state-write refusal in `backend/tests/unit/loop-no-direct-write.spec.ts` — `FR-GEL-010`, `SC-GEL-002`
- [X] T959 [US2] Implement `GET /loop/objects/:id/history` in `backend/src/modules/loop/loop.controller.ts` (integration test: T960) — `FR-GEL-013`
- [X] T960 [P] [US2] Write the history-reconstruction integration test in `backend/tests/integration/loop-history-rebuild.spec.ts` — rebuilds the loop with `currentStage` withheld and asserts agreement (`SC-GEL-005`)

**Checkpoint**: US2 is independently demonstrable — state is auditable, atomic and race-safe

---

## Phase 5: User Story 3 - An automated transition traces to the rule that fired it (Priority: P2)

**Goal**: `RULE-11` mechanically — no invisible automation

**Independent test**: [quickstart.md](./quickstart.md) Scenario 6

- [X] T961 [P] [US3] Write failing unit tests for trigger-rule citation in `backend/tests/unit/loop-trigger-rule.spec.ts` — a configuration with a rule-less automated transition is refused at load — `FR-GEL-030`, `FR-GEL-031`, `SC-GEL-004`
- [X] T962 [US3] Implement trigger-rule validation in `backend/src/modules/loop/loop-config.loader.ts` (unit test: T961) — `FR-GEL-030`, `SC-GEL-004`
- [X] T963 [P] [US3] Write failing unit tests for human/automation distinguishability in `backend/tests/unit/loop-actor-kind.spec.ts` — `FR-GEL-032`
- [X] T964 [US3] Implement `actorKind` recording in `backend/src/modules/loop/transition-writer.ts` (unit test: T963)
- [X] T965 [P] [US3] Write failing unit tests for trigger idempotency in `backend/tests/unit/loop-trigger-idempotency.spec.ts` — a repeated firing records a duplicate rather than advancing twice — `FR-GEL-033`
- [X] T966 [US3] Implement idempotent trigger handling in `backend/src/modules/loop/trigger-dispatcher.ts` (unit test: T965) — `FR-GEL-030` declares triggered transitions; this is where one fires

**Checkpoint**: US3 is independently demonstrable — every automated move names its rule

---

## Phase 6: User Story 4 - A required gate is never silently passed (Priority: P2)

**Goal**: `satisfied` is unreachable by omission

**Independent test**: [quickstart.md](./quickstart.md) Scenario 7

- [X] T967 [P] [US4] Write failing unit tests for gate-outcome completeness in `backend/tests/unit/loop-gate-completeness.spec.ts` — a declared gate with no recorded outcome makes the transition invalid, not passed — `FR-GEL-020`, `FR-GEL-021`, `SC-GEL-008`
- [X] T968 [US4] Implement gate evaluation and the four-outcome resolution in `backend/src/modules/loop/gate-evaluator.ts` (unit test: T967) — refuse / exception / violation, never satisfied-by-omission — `FR-GEL-020`, `SC-GEL-008`
- [X] T969 [P] [US4] Write failing unit tests for exception recording in `backend/tests/unit/loop-gate-exception.spec.ts` — authorizer and reason required — `FR-GEL-021`
- [X] T970 [US4] Implement exception and violation recording in `backend/src/modules/loop/gate-evaluator.ts` (unit test: T969)
- [X] T971 [US4] Implement `GET /loop/objects/:id/exceptions` in `backend/src/modules/loop/loop.controller.ts` (integration test: T934) — `FR-GEL-022`

**Checkpoint**: US4 is independently demonstrable — no gate can be passed by omission

---

## Phase 7: User Story 5 - A Room can render loop progress without knowing how the loop works (Priority: P3)

**Goal**: one projection, one vocabulary, every workflow type

**Independent test**: request the projection for two different workflow types and compare vocabularies

- [X] T972 [P] [US5] Write failing unit tests for the progress projection in `backend/tests/unit/loop-progress.spec.ts` — every stage exactly one of done/current/pending, omitted stages visible — `FR-GEL-050`, `FR-GEL-008`
- [X] T973 [US5] Implement the progress projection in `backend/src/modules/loop/progress.projection.ts` (unit test: T972)
- [X] T974 [P] [US5] Write failing unit tests for vocabulary identity across workflow types in `backend/tests/unit/loop-progress-vocabulary.spec.ts` — `FR-GEL-051`, `SC-GEL-007`
- [X] T975 [US5] Implement `GET /loop/objects/:id/progress` in `backend/src/modules/loop/loop.controller.ts` (integration test: T934)

**Checkpoint**: all five user stories are independently demonstrable

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: the measurements and mutation proofs the Epic is judged on

- [X] T976 [P] Add stage-residency instrumentation so "which stage, and for how long" is answerable without opening the object, in `backend/src/modules/loop/loop.service.ts` (unit test: T977) — `SC-GEL-006`
- [X] T977 [P] Write failing unit tests for stage-residency measurement in `backend/tests/unit/loop-residency.spec.ts`
- [X] T978 **Mutation proof — `FR-GEL-021`**: add a `satisfied`-by-default branch to `backend/src/modules/loop/gate-evaluator.ts`, revert (unit test: T967 — it must fail while the mutation stands). `SC-GEL-008`. Record the observation in this Epic's closing report — a gate check that cannot fail is decoration (Constitution V)
- [X] T979 **Mutation proof — `FR-GEL-041`**: split the transition and audit writes in `backend/src/modules/loop/transition-writer.ts`, revert (integration test: T957 — it must fail while the mutation stands). Record the observation
- [X] T980 **Mutation proof — `FR-GEL-016`**: remove the `approvedBy`/`approvalRef` requirement from `backend/src/modules/loop/loop-config.loader.ts`, revert (unit test: T937 — it must fail while the mutation stands). Record the observation (`SC-GEL-010`)
- [X] T981 **Mutation proof — Constitution XI Tier 1**: remove `LoopModule` from `backend/src/app.module.ts`, revert (integration test: T934 — it must fail while the mutation stands). Record the observation — a test importing `LoopModule` directly would still pass, which is the defect class Principle XI was ratified over
- [X] T982 [P] Verify the `R-030-6` performance targets — transition overhead p95 < 50 ms, end-to-end p95 < 150 ms, projection p95 < 100 ms, ≥ 50 transitions/second per workspace — and record the measured figures in this Epic's closing report
- [X] T983 Run every scenario in [quickstart.md](./quickstart.md) end to end and record the results

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX, XI)

**Purpose**: Gate the Epic before it may be promoted out of `local`

Ordered as the constitution's *"Quality gates in order"* states them: unit tests green → every
user-facing capability exercised through its real entry point → convergence clean → defect folder
empty → promote.

- [X] T984 Confirm every implementation task has a passing unit test or conformance check
- [X] T985 **Constitution XI Tier 1 (ALWAYS)** — `T934` drives a transition through the real HTTP route against the composed module graph via the real `AppModule`, and `T981` proved it fails when the module is unregistered. **Not satisfied by a mocked collaborator**
- [X] T986 **Constitution XI Tier 2 (Epics delivering a journey)** — **NOT APPLICABLE**: this Epic delivers no user-facing journey; loop progress becomes visible when a Room renders it (`EPIC-033`–`035`). Recorded rather than deleted, per the `EPIC-029` `F1` precedent
- [X] T987 Converge `ADR-0018` — move it to Accepted, or restate its `Awaits` against what actually remains
- [ ] T988 Confirm the `BR-0065` SRS edit has landed — PMI-DOC-004 v2.0 §6.7 and `specs/brs-v2-reconciliation.md` §3.1/§4 read `EPIC-030`, with a §17 revision-history entry. **Project owner's act**; until it lands the SRS wins (Constitution II) **NOT DONE — project owner.** PMI-DOC-004 v2.0 is an APPROVED SRS; amending it is the project owner's act with a §17 entry, not an implementation session's. Line 300 still reads `→ EPIC-012`, and `brs-v2-reconciliation.md` line 117 agrees while line 168 still records `U-06` as UNOWNED. Both are now factually wrong. See closure.md.
- [X] T989 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [X] T990 Triage `specs/030-governed-engineering-loop/defects/`; every record closed or deferred to a named Epic
- [X] T991 Re-run the full suite green after defect fixes — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`
- [ ] T992 Promote `local → dev` (then dev → stage → prod; no environment skipped) **NOT DONE — no reachable environment.** This session reaches `local` only: the work is on `epic/030-governed-engineering-loop`, unmerged, and promotion is a deployment act rather than a code change. Recorded rather than claimed. See closure.md.
- [X] T993 Publish the Epic closing report: work completed, work deferred, the four mutation observations, the measured performance figures, and the recommended next Epic/command (Constitution IX). Refresh the Delivery Board or restate its staleness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately. `T993a` first: it discharges the failing gate
- **Foundational (Phase 2)**: depends on Phase 1. **Blocks every user story**
- **US1 (Phase 3)**: depends on Phase 2 only
- **US2 (Phase 4)**: depends on Phase 2. Independent of US1 — but US1 first is the MVP
- **US3 (Phase 5)**: depends on Phase 2 and on US2's transition writer (`T950`)
- **US4 (Phase 6)**: depends on Phase 2 and on US2's transition writer (`T950`)
- **US5 (Phase 7)**: depends on Phase 2 and on US2's history (`T959`)
- **Polish (Phase N)**: depends on every story it measures
- **Closure (Phase Z)**: last

### Cross-Epic dependencies — none blocking

This Epic declares three seams and fills none of them. It is buildable and testable with
`EPIC-031`, `EPIC-032` and the Rooms absent, because every unfilled port **refuses** rather than
defaults (`FR-GEL-062`, `R-030-5`). That is deliberate: it is what stops this Epic's schedule
depending on three others.

### Parallel Example: Phase 2

```text
T993g, T993i, T993k  — three test files, no shared state
T993p, T993q        — two integration tests
T993r, T993s, T933  — configuration, its check, the independence check
T934              — the reachability test, written before T935/T936 exist
```

### Parallel Example: User Story 2

```text
T947, T949, T951, T956, T957, T958, T960  — seven test files in parallel
then T948, T950, T952, T954, T955         — implementations, sharing transition-writer.ts (serial)
```

---

## Implementation Strategy

**MVP is User Story 1.** A workflow type declared as configuration, running end to end, with no new
engine code. It proves `BR-0064` — the requirement this Epic owns — and it is demonstrable before
any Room exists.

**Increment order**: Setup → Foundational → US1 (MVP) → US2 → US3 → US4 → US5 → Polish → Closure.

**US2 is the largest phase and the one to schedule carefully.** Three of its tasks — `T954`, `T955`,
`T960` — carry the guarantees the other Epics build on, and two of them are mutation-proved in Phase
N. Time spent there is not overhead; it is the reason `EPIC-031`–`035` can assume anything.

**What "done" means here is unusually strict.** Four mutation proofs (`T978`–`T981`) each require a
deliberate break, an observed failure, and a revert. A check that passes against a broken build has
told you nothing, and this Epic's whole value to five other Epics is that its guarantees hold.

---

## Notes

- **Constitution V is non-negotiable and the skill default is wrong.** `/speckit-tasks` describes
  tests as optional; the constitution overrides every template, skill and tool default. Every
  implementation task above names its test.
- **Phase Z gained its XI rows in this run.** The constitution's v1.5.0 Sync Impact Report carries
  the follow-up *"propagate XI into the two templates flagged above before the next `/speckit-plan`
  or `/speckit-tasks` run"*. `plan-template.md` was done at `/speckit-plan`; `tasks-template.md` was
  done here. **The Sync Impact Report still lists both as outstanding** — correcting it requires
  `/speckit-constitution`, because the constitution is explicitly NOT exempt from its own command
  gate.
- **`T988` is not this Epic's to complete.** The `BR-0065` SRS edit is a project-owner act on an
  APPROVED document. It is listed so closure cannot be claimed while two documents disagree, not
  because an implementer should make the edit.
- `T993a` comes first for a reason. The plan records the concurrent-session gate as **FAIL**, and
  every task after it writes application code into a checkout that cannot be asserted exclusive.

## Phase C2A: Specification status-transition adjudication *(appended 2026-08-25)*

**Why this phase exists.** `EPIC-037` Band A stopped before writing a line of code: `T1058` required
consuming this Epic's adjudication and **there was nothing to consume**. This Epic evaluated loop
stages (`Event`…`Outcome`) and exposed no specification-lifecycle proposal intake — 0 matches for
`proposal` or `adjudicat` across the module. The two amendments Rev 3 §04 assigned here were never
scheduled. This phase is the minimum that unblocks Band A, and nothing more.

**Boundary**: no UI, no Decision Inbox, no Requirement Room, no `EPIC-037` work, and no unrelated
open task of this Epic. `T988` and `T992` stay untouched.

- [X] T1082 [P] Write failing contract tests in `packages/loop-contract/tests/adjudication.spec.ts` for the proposal-adjudication contract, per `FR-GEL-063`, `FR-GEL-064`, `FR-GEL-068` — the full intake field set, the **closed six-verdict** union, and that `SpecLifecycleState` and `LoopStage` are **distinct types with no conversion between them** (covers T1083)
- [X] T1083 Define the adjudication contract in `packages/loop-contract/src/adjudication.ts` — `AdjudicationProposal`, `AdjudicationVerdict` (six variants), and the `LifecycleApplicationPort` this Epic calls (contract test: T1082). **No transport, no data access, no `backend/src` import**: `EPIC-037` must consume it without reaching this Epic's internals (`FR-GEL-073`)
- [X] T1084 [P] Write failing unit tests in `backend/tests/unit/loop/separation-of-duties.spec.ts` per `FR-GEL-067` — an AI agent cannot approve its own proposal **under any policy**; a human proposer cannot when policy requires a distinct approver; identity is read from the **frozen** snapshot, not mutable display metadata (covers T1085)
- [X] T1085 Implement separation-of-duties evaluation in `backend/src/modules/loop/separation-of-duties.ts`, defaulting to **distinct approver required** (unit test: T1084)
- [X] T1086 [P] Write failing unit tests in `backend/tests/unit/loop/adjudicator.spec.ts` covering all six verdicts and their semantics per `FR-GEL-068`–`FR-GEL-070` — `validated` means valid **and not applied**; `approval_required` and `refused` both mean **no transition applied**; `inconsistent` means observed state contradicts the expectation; `reconciliation_required` means automated application is prohibited pending governed resolution (covers T1087)
- [X] T1087 Implement `backend/src/modules/loop/adjudicator.service.ts` — intake, lifecycle validation delegated to `EPIC-009`, authority and gate evaluation reusing this Epic's existing `evaluateAuthority` and `evaluateGates`, separation of duties, approval routing, and verdict construction (unit test: T1086). **Hold no table of permitted transitions** (`FR-GEL-065`)
- [X] T1088 [P] Write failing integration tests in `backend/tests/integration/loop/adjudication-application.spec.ts` per `FR-GEL-069` — a valid no-approval proposal is applied through `EPIC-009`; **an `EPIC-009` failure cannot yield `applied`**; an unknown outcome yields `reconciliation_required` (covers T1089)
- [X] T1089 Implement the `EPIC-009` application step in `backend/src/modules/loop/lifecycle-application.adapter.ts` — a durable intent recorded **before** the call, `applied` returned **only** on confirmation, and `reconciliation_required` on timeout or unknown outcome (integration test: T1088). **`EPIC-009` exposes no shared transaction boundary**, so this is the explicit orchestration model the authorisation permits rather than a claimed atomicity that does not exist
- [X] T1090 [P] Write failing integration tests in `backend/tests/integration/loop/adjudication-concurrency.spec.ts` per `FR-GEL-070`, `FR-GEL-071` — stale expected state yields `inconsistent` with nothing applied; an idempotent retry returns the **original** verdict without duplicating an approval or a transition; concurrent proposals cannot silently overwrite one another (covers T1091)
- [X] T1091 Implement optimistic concurrency and idempotent adjudication keyed on proposal and idempotency key (integration test: T1090)
- [X] T1092 [P] Write failing tests in `backend/tests/integration/loop/adjudication-evidence.spec.ts` per `FR-GEL-072` — intake, evaluation, approval, refusal and application each produce immutable evidence linking proposal, verdict and applied transition, and redaction does not break the chain (covers T1093)
- [X] T1093 Additive migration creating `adjudication_records` with the existing `reject_mutation()` trigger **attached** — the function is reused, the trigger is new and grants nothing until this statement runs (integration test: T1092)
- [X] T1094 [P] Write the failing architecture test in `backend/tests/architecture/adjudication-boundary.spec.ts` per `FR-GEL-073` — no consumer of `@pmi/loop-contract`'s adjudication types imports `backend/src/modules/loop/**`, and **no connector path invokes `EPIC-009`'s lifecycle service directly** to bypass adjudication
- [X] T1095 Reuse `EPIC-024` authorisation at intake — tenant and workspace isolation, actor authority checked at **adjudication time** (unit test: T1086). **Create no independent authorisation model** (`FR-GEL-066`)

---

## Phase C2A-Closure — resolving `X1` and `X6` (authorised 2026-08-25)

**Why this phase exists.** The C2A analyze session recorded two HIGH findings, and the project
owner ruled that neither needs a product-scope decision: `X1` is a typed-contract correction
required for deterministic event mapping, and `X6` is completion of the already-authorised minimum
production capability — *"a decision engine constructed only by tests is not an exposed
capability."*

Every task below is paired with the test that proves it. `T1102` is the one that could not have
been written before: unit tests could not catch `X6` because they **were** the manual construction.

- [X] T1096 [P] Correct the refusal contract in `packages/loop-contract/src/adjudication.ts` — `refusalStage` (`validation` \| `approval` \| `transition`) selects the `EPIC-037` event; `refusalReasonCode` (eight codes) says why and never selects an event; `REFUSAL_STAGE_OF` derives one from the other so they cannot disagree *(tests: `packages/loop-contract/tests/refusal-mapping.spec.ts` — totality, determinism, distinctness; `backend/tests/integration/loop/adjudication-persistence.spec.ts` — the same vocabulary enforced in PostgreSQL)*
- [X] T1097 Make `AdjudicationVerdict` a **closed discriminated union** in which invalid combinations cannot be constructed — `applied` requires `appliedTransitionId`, `refused` requires stage and code, `approval_required` requires a role, `inconsistent` requires a structured mismatch, `reconciliation_required` requires a structured cause, and every non-applied variant carries `appliedTransitionId?: never`; serialise both ways in `backend/src/modules/loop/adjudication-evidence.ts`; enforce the same invariants as CHECK constraints in `20260825120000_epic030_adjudication_refusal` *(tests: `backend/tests/integration/loop/adjudication-persistence.spec.ts` — all six round-trip, nine constraint refusals, and one positive control proving the constraints are not blanket refusals)*
- [X] T1098 Implement the `EPIC-009` validity adapter `EpicNineLifecycleValidation` in `backend/src/modules/loop/adjudication.adapters.ts`, taking `permittedFrom` as an injected function so no transition table is duplicated *(tests: `backend/tests/unit/loop/adjudication-adapters.spec.ts` — swapping the injected function changes the answer, and an empty table permits nothing)*
- [X] T1099 Implement the `EPIC-009` application adapter `EpicNineTransitionAdapter`, reporting a **null transition identity** rather than passing off the specification id, and resolving that to `application_transition_unidentified` *(tests: `adjudication-adapters.spec.ts` — the specification id is never forwarded; the outcome is reconciliation, never applied)*
- [X] T1100 Implement `UnconfiguredGateOutcomes` for `EPIC-021`, reporting `unavailable` — distinct from `passed: false` — because EPIC-021 supplies no gate-outcome service *(tests: `adjudication-adapters.spec.ts` — refused/`validation`/`gate_outcomes_unavailable` end to end, and application is never reached)*
- [X] T1101 Implement `AccessIntakeAuthorization` over `EPIC-024`'s `AccessEnforcementService`, plus `ConfiguredAuthorityPolicy` defaulting `autoApply` to **false** for any transition no rule names *(tests: `adjudication-adapters.spec.ts` — the exact artifact ref handed to EPIC-024, refusal propagates unsoftened, and an unconfigured transition auto-applies nothing)*
- [X] T1102 Register every adapter and `ProposalAdjudicatorService` in the Nest graph (`loop.module.ts`), exporting **only** `PROPOSAL_ADJUDICATOR` *(test: `backend/tests/integration/loop/adjudication-composition.spec.ts` — boots the real `AppModule` with no overrides, resolves the adjudicator from DI, asserts all seven ports resolve to their real adapter classes, asserts the bypass-capable tokens are **not** exported, and observes EPIC-024 refusing an ungranted proposal and EPIC-009 being reached once a grant exists)*

**Not closed by this phase, and reported rather than worked around:**

- **`EPIC-021` supplies no gate-outcome service.** `backend/src/modules/reviews/` has no Nest module,
  is imported by nothing, ships only `InMemoryGateOutcomeStore`, exposes no per-specification query,
  and nothing writes `gate_outcomes`. The adapter therefore refuses. Until EPIC-021 ships one, **no
  proposal can reach `applied` in production** — it is refused at the gate step.
- **`EPIC-009` does not surface the transition it records.** `transition()` returns the
  specification, `TRANSITION_RECORDER` is bound to an in-memory recorder, and there is no read
  surface — so `appliedTransitionId` cannot be bound to an authoritative row.

Both are dependency gaps in other Epics. Reproducing either Epic's policy inside EPIC-030 is what
the authorisation forbids, so neither was filled here.


---

## Phase C2B — EPIC-021 / EPIC-009 dependency remediation (authorised 2026-08-26)

**Only the self-contained correction was executed.** The definition-and-ownership check found that
the remaining C2B work is owned elsewhere — see `analysis.md`, C2B session, findings `X9`–`X11`.

- [X] T1103 Correct gate-unavailability semantics per `FR-GEL-074` — `GateOutcomePort` returns a typed `GateDisposition` (`passed` \| `failed` \| `pending` \| `unavailable` \| `stale`) bound to the requested transition; only `failed` refuses; the other three route to `reconciliation_required` with a structured cause; `gate_outcomes_unavailable` is removed from the refusal vocabulary in the contract **and** in the database (`20260826000000_epic030_gate_unavailability`) *(tests: `packages/loop-contract/tests/refusal-mapping.spec.ts` — unavailability is not a refusal code; `backend/tests/unit/loop/adjudication-adapters.spec.ts` — the full disposition matrix, failed vs unreadable; `backend/tests/integration/loop/adjudication-persistence.spec.ts` — the database refuses each gate cause as a refusal reason and accepts it as a reconciliation cause)*

**Not executed — blocked on an epic-ownership decision:**

- **X7 / EPIC-021 production gate-outcome capability** — the producer and the Prisma-backed stores
  are deferred by `specs/021-review-gates-roles/closure.md` to **EPIC-014 F-11.2**.
- **X8 / EPIC-009 durable transition identity** — the Prisma-backed recorder is deferred by
  `specs/009-spec-lifecycle-versioning/closure.md` to **EPIC-014 F-11.2**, *"the same deferral every
  closed epic carries"*.
- **EPIC-014 F-11.2 contains no task for either.** Its tasks (`T151`–`T156`) confirm closure
  records and run reviews, quickstarts and promotion. The work has a named owner and no schedule.
