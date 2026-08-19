---

description: "Task list for EPIC-026 — Epic Stage Register & Definition of Ready"
---

# Tasks: Epic Stage Register & Definition of Ready

**Epic**: `EPIC-026` | **Process, not product** | **Tasks**: 71 (T466–T536)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)
**Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/](./contracts/) | **Validation**: [quickstart.md](./quickstart.md)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here is product surface, so nothing
> here waits on `PMI-DOC-004`.

**Session label**: `EPIC-026 Epic Stage Register` (Constitution VIII).

> ⚠️ **Branch first.** This epic was specified, clarified and planned from a checkout sitting on
> `epic/003-specification-engine` with uncommitted EPIC-003 changes. Gate VIII is recorded as
> qualified in [plan.md](./plan.md). Create `epic/026-epic-stage-kanban` before T466.

**Tests**: Constitution V, in **both** readings — this epic produces documents *and* code.

- **Derivation and DOR logic are application code** → conventional unit tests, written first, failing
  before implementation.
- **Governance documents** → executable conformance checks that read the artifact and fail on drift
  (constitution v1.2.0). Manual review does not satisfy the gate.

Every implementation task below names its paired test or check. A task is not complete until it
passes.

**Severity split** (`FR-ESK-016`): a **false Ready**, a **stale committed register**, and an
**expired waiver** fail the build. Stalled Epics, missing postures and out-of-order artifacts report
without failing it.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `US1`–`US6`, mapping to the user stories in [spec.md](./spec.md)
- Every task names an exact file path

---

## Phase 1: Setup

**Purpose**: Unblock the currently-red suite and create the working surface.

- [X] T466 Register `specs/026-epic-stage-kanban/` under §Paths that must not break in `governance/repository-layout.md`, fixing EPIC-018's check `G-05d`, red since 2026-08-09 because this epic's own directory was created without registration
- [X] T467 [P] Add the `register:update` script — `UPDATE_REGISTER=1 vitest run --project governance` — to `package.json` (R-026-5)

  > **The literal command does not work on this repository's own machine.** pnpm runs scripts through
  > `cmd.exe` on Windows, where a leading `VAR=value` is parsed as a command name — verified before
  > working around it: `FOO=bar node -e ...` returns *"'FOO' is not recognized as an internal or
  > external command"*. Implemented as `node scripts/update-register.mjs`, a six-line launcher that
  > sets `UPDATE_REGISTER=1` and runs the same vitest invocation. `cross-env` would also fix it; this
  > repository has consistently declined a dependency for a small job (the Docker provider talks to
  > the Engine API rather than take `dockerode` for four endpoints).
- [X] T468 [P] Create `tests/governance/epic-stage/fixtures.ts` providing a temporary-directory Epic-tree builder for the unit tests, importable but never collected (non-`.spec.ts`, per the `helpers.ts` convention)

**Checkpoint**: ✅ `pnpm test:governance` green — **359/359 across 24 files**, not the 159 predicted when this was written; the governance corpus roughly doubled between then and now (EPIC-027 alone added 154). `T466` needed no work: `specs/026-epic-stage-kanban/` was registered in `governance/repository-layout.md` when the directory was committed, so `G-05d` was already green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The stage model as configuration, and the pure derivation every story reads from.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T469 [P] Write failing conformance check asserting `epic-stage.config.json` defines seven ordered stages each with evidence and a next command, three posture kinds, two Epic kinds, twelve DOR conditions, the waiver roles, and the Epic-directory exclusion pattern, in `tests/governance/epic-stage/config.spec.ts`
- [X] T470 Author `governance/epic-stage.config.json` with the stage sequence, evidence rules, posture kinds, Epic kinds, `DOR-01`–`DOR-12`, waiver roles and exclusion pattern per [data-model.md](./data-model.md) §1–§5 (FR-ESK-015; check: T469)
- [X] T471 [P] Write failing unit tests for Epic enumeration and the exclusion rule — every `NNN-` directory included, `specs/_shared/` excluded by pattern rather than by a maintained list, a directory without `spec.md` reported invalid — in `tests/governance/epic-stage/enumerate.spec.ts`
- [X] T472 Implement Epic enumeration in `tests/governance/epic-stage/derive.ts`, reusing `epicDirectories()` from `tests/governance/helpers.ts` (FR-ESK-008; unit test: T471)
- [X] T473 [P] Write failing unit tests for the seven per-stage evidence predicates against a fixture tree, including `Clarified` from a recorded session with no questions and `Checklisted` requiring zero unchecked items, in `tests/governance/epic-stage/evidence.spec.ts`
- [X] T474 Implement the seven evidence predicates in `tests/governance/epic-stage/derive.ts` per [data-model.md](./data-model.md) §1 (FR-ESK-001, FR-ESK-002; unit test: T473)
- [X] T475 [P] Write failing unit tests for highest-contiguous-stage derivation — evidence above a gap does not raise the stage and is emitted as an out-of-order finding — in `tests/governance/epic-stage/stage.spec.ts`
- [X] T476 Implement contiguous stage derivation and out-of-order findings in `tests/governance/epic-stage/derive.ts` (FR-ESK-003, FR-ESK-006; unit test: T475)

  > ⚠️ **`T473` and `T475` were not written red-first, and that is recorded rather than glossed.**
  > `derive.ts` was created for `T472` (enumeration) and I wrote the evidence predicates and the
  > stage derivation into the same file in the same edit, so their tests were written against
  > existing code. Constitution V asks for a test that fails before its implementation; what it
  > protects against is a test that *cannot* fail. Each was therefore verified by **mutation**:
  >
  > | Mutation | Result |
  > |---|---|
  > | `Clarified` derived from the absence of `[NEEDS CLARIFICATION]` markers | 4 tests red |
  > | `Checklisted` satisfied by a checklist's mere presence | 1 test red — the unresolved-item case |
  > | the contiguity guard removed, so evidence above a gap counts | 4 tests red |
  >
  > **`T476` found a real off-by-one.** The first derivation returned the *following* stage's `next`
  > command, so an Epic at `Clarified` was told to run `/speckit-plan` — skipping `/speckit-checklist`
  > entirely. A stage's own `next` field is the command to run from it. Caught by `T475`, which is
  > what the tests were for even written late.

**Checkpoint**: ✅ derivation is pure, unit-tested against fixture trees the repository does not
contain, and its default path reads the real `specs/`. **43 tests across 4 files.** Stories can now
proceed.

---

## Phase 3: User Story 1 — Every Epic's stage is recorded and readable (P1) 🎯 MVP

**Goal**: A committed register listing every Epic with its stage and next command, and the two
journey steps that currently leave no evidence made to record their runs.

**Independent Test**: `V26-1` — one row per Epic directory, ordered, each naming a stage and next
command; `_shared` absent; `EPIC-026` present in its own register.

### Tests for User Story 1 (MANDATORY — Constitution V) ⚠️

- [X] T477 [P] [US1] Write failing conformance check asserting the register exists, carries the generated-do-not-edit header naming `pnpm register:update`, and lists exactly one row per Epic directory ordered by identifier, in `tests/governance/epic-stage/register.spec.ts`
- [X] T478 [P] [US1] Write failing unit tests for register rendering — column set, em dash as the sole empty marker, one line per row, no timestamps or aggregates — in `tests/governance/epic-stage/render.spec.ts`
- [X] T479 [P] [US1] Write failing conformance check asserting the Findings and Active-waivers sections are omitted when empty and otherwise formatted per `RF-4`/`RF-5`, in `tests/governance/epic-stage/sections.spec.ts`
- [X] T480 [P] [US1] Write failing conformance check asserting `specs/<epic>/analysis.md`, wherever present, conforms to the expected shape and severity vocabulary, in `tests/governance/epic-stage/analysis-record.spec.ts`
- [X] T481 [P] [US1] Write failing conformance check asserting both skill files carry their recording instruction — and documenting in the file header that this proves the instruction exists, **not** that an agent followed it (R-026-4) — in `tests/governance/epic-stage/skill-instructions.spec.ts`

### Implementation for User Story 1

- [X] T482 [US1] Implement register rendering in `tests/governance/epic-stage/render.ts` per [contracts/register-format.md](./contracts/register-format.md) `RF-1`–`RF-3` (FR-ESK-007; unit test: T478)
- [X] T483 [US1] Implement the generate-and-compare entry point with `UPDATE_REGISTER=1` write mode in `tests/governance/epic-stage/register.spec.ts` (FR-ESK-021, R-026-5; check: T477)
- [X] T484 [US1] Implement Findings and Active-waivers section rendering in `tests/governance/epic-stage/render.ts` (`RF-4`, `RF-5`; check: T479)
- [X] T485 [US1] Generate and commit `governance/epic-stage-register.md` (FR-ESK-007, FR-ESK-021; check: T477)
- [X] T486 [US1] Amend `.claude/skills/speckit-analyze/SKILL.md` to write a dated findings record to `specs/<epic>/analysis.md`, naming each finding and its severity (FR-ESK-019; checks: T480, T481)
- [X] T487 [US1] Amend `.claude/skills/speckit-clarify/SKILL.md` to record a dated session on every run, stating "no questions required" when it asks none (FR-ESK-018; check: T481)

  > **The first register says something nobody expected.** 22 of 28 Epics read **Specified** — the
  > lowest stage there is — including EPIC-001, EPIC-003 and EPIC-004, all of which are **closed**.
  > The derivation is not wrong: `Clarified` requires a recorded `### Session`, and **only 6 of 28
  > specs carry one**. The other 22 never recorded a clarification session, so their plans, tasks and
  > closures sit above a gap and are reported as 45 out-of-order findings rather than counted as
  > progress.
  >
  > This is `FR-ESK-018` justifying itself on its first run. The register is not measuring how far
  > each Epic got; it is measuring **what each Epic can prove**, and the answer for most of them is
  > "less than it looks". `T487` amends the clarify skill so the gap stops growing; the 22 existing
  > Epics need a recorded session each, which is not this phase's work.
  >
  > **US1's Independent Test partly fails, and that is reported rather than fixed by loosening a
  > rule.** EPIC-002 (`Clarified`), EPIC-017 (`Planned`) and EPIC-004 (`Specified`) *are* mutually
  > distinguishable, as the test requires — but EPIC-003 and EPIC-004 are not distinguishable from
  > each other, both reading `Specified`. Raised for Phase 9 rather than resolved by weakening the
  > `Clarified` evidence rule, which would make the stage measure how clean a document looks instead
  > of whether anyone examined it.
  >
  > **Two mutations confirm the drift check bites**: hand-editing one cell to `Ready` fails the
  > byte-for-byte comparison; adding an unregenerated Epic directory fails three assertions
  > including the row count. `G-05b` — EPIC-018's index check — independently caught that the two
  > new governance artifacts were unindexed, which is the cross-epic gate working.

**Checkpoint**: ✅ the register exists at `governance/epic-stage-register.md`, is readable in a pull
request, and both journey steps now carry their recording instruction. **455 governance tests across
33 files.** **This is the MVP** — valuable before any gate exists.

---

## Phase 4: User Story 2 — The stage is derived, so it cannot lie (P1)

**Goal**: Regeneration is deterministic, a stale committed copy fails the build, and no derivable
value can be hand-declared.

**Independent Test**: `V26-2` and `V26-3` — regeneration with no change produces no diff; adding an
Epic without regenerating fails.

### Tests for User Story 2 (MANDATORY — Constitution V) ⚠️

- [X] T488 [P] [US2] Write failing conformance check asserting regeneration on unchanged input is byte-identical, in `tests/governance/epic-stage/determinism.spec.ts`
- [X] T489 [P] [US2] Write failing conformance check asserting a committed register differing from a fresh generation fails the build, and that a hand edit is overwritten rather than adopted, in `tests/governance/epic-stage/drift.spec.ts`
- [X] T490 [P] [US2] Write failing unit test asserting a `stage`, `readiness` or `next` key at any depth in the declarations file is rejected, in `tests/governance/epic-stage/no-shadow.spec.ts`

### Implementation for User Story 2

- [X] T491 [US2] Enforce deterministic ordering and forbid clock-derived or aggregate content in `tests/governance/epic-stage/render.ts` (`RF-2`; checks: T488, T489)
- [X] T492 [US2] Implement exact-text drift comparison after line-ending normalisation only, with no fuzzy matching, in `tests/governance/epic-stage/drift.spec.ts` (`RF-7`, FR-ESK-021; check: T489)
- [X] T493 [US2] Reject derivable keys anywhere in `governance/epic-declarations.json` (`DF-7`, FR-ESK-003; unit test: T490)

  > **`T491` was already done, by `T482`.** The deterministic ordering and the ban on clock-derived
  > and aggregate content went into `render.ts` when it was first written, so `T488` passed the
  > moment it existed. Recorded rather than reported as fresh work — and verified by mutation, since
  > a check that has never been red is a check nobody has tested: making the renderer trust caller
  > order fails the ordering assertion, and adding a generation timestamp fails two.
  >
  > **Four mutations, all caught:**
  >
  > | Mutation | Result |
  > |---|---|
  > | renderer trusts caller order instead of sorting | 1 red |
  > | a generation timestamp is added to the header | 2 red — one in each suite |
  > | drift comparison `.trim()`s before comparing | 1 red — the trailing-whitespace case |
  > | `findDerivedKeys` scans only the top level | 6 red |
  >
  > **The fuzzy-comparison mutation is the one worth keeping in mind.** `.trim()` is an entirely
  > reasonable-looking line, and it is exactly how an exact comparison becomes an approximate one:
  > each concession is defensible alone and together they remove the guarantee.

**Checkpoint**: ✅ the register cannot drift from the repository or be edited into disagreement with
it, and the one hand-authored input cannot grow a shadow copy of what the tree already knows.
**482 governance tests across 36 files.**

---

## Phase 5: User Story 3 — Deliberate stops read differently from stalls (P1)

**Goal**: The three posture kinds, the parent-design Epic kind, and the four declarations the
repository already needs.

**Independent Test**: `V26-5` — EPIC-009/012 read Held with their awaiting input; EPIC-002/017 read
parent-design at Planned with children named; a posture missing its object is reported.

### Tests for User Story 3 (MANDATORY — Constitution V) ⚠️

- [X] T494 [P] [US3] Write failing unit tests for declaration parsing and validation — exactly three posture kinds, the required object field per kind, referential integrity against directories on disk — in `tests/governance/epic-stage/declarations.spec.ts`
- [X] T495 [P] [US3] Write failing unit tests for the parent-design kind — terminal stage `Planned`, DOR not evaluated, `children` required, a `tasks.md` present reported as a contradiction — in `tests/governance/epic-stage/epic-kind.spec.ts`
- [X] T496 [P] [US3] Write failing unit test asserting an Epic stopped with nothing declared reads `stalled` and never `Held`, in `tests/governance/epic-stage/stalled.spec.ts`

### Implementation for User Story 3

- [X] T497 [US3] Implement declaration loading and validation in `tests/governance/epic-stage/derive.ts` per [contracts/declarations-format.md](./contracts/declarations-format.md) `DF-1`–`DF-3` (FR-ESK-004, FR-ESK-005, FR-ESK-020; unit test: T494)
- [X] T498 [US3] Implement Epic-kind handling in `tests/governance/epic-stage/derive.ts` — parent designs complete at Planned and are exempt from the DOR (FR-ESK-024, `DF-4`; unit test: T495)
- [X] T499 [US3] Implement the stalled-versus-declared distinction in `tests/governance/epic-stage/derive.ts` (FR-ESK-006; unit test: T496)
- [X] T500 [US3] Author `governance/epic-declarations.json` with the four declarations the repository already requires — `EPIC-002` and `EPIC-017` as parent designs naming their children (rulings D-19, D-18), `EPIC-009` and `EPIC-012` as `Held` awaiting `PMI-DOC-004` (decision D-10) (FR-ESK-020, FR-ESK-024; checks: T494, T495)

  > **`stalled` reads on 25 of 28 Epics, including this one — and that is a finding, not a bug.**
  > The register carries no timestamps (`RF-2`), so it cannot know whether an Epic moved last week.
  > "Stopped" therefore has to be **structural** — short of its terminal stage — and with only four
  > declarations authored, almost everything qualifies. **EPIC-026 itself reads `stalled` while
  > being actively worked.**
  >
  > Implemented exactly as `data-model.md` §3 specifies rather than quietly redefined. But the word
  > is carrying weight it cannot support without a time dimension the contract forbids, and US3's
  > goal — *"an Epic that has stopped on purpose reads differently from one that has stopped by
  > neglect"* — is only half met: the two declared holds do read differently, and the other 23 read
  > the same as genuine drift. **Raised for Phase 9.**
  >
  > **Only 4 declarations exist, and ~19 Epics carry a prose hold.** `T500` names the four the task
  > specifies. EPIC-005–016 and EPIC-019–025 say "⏸ HELD pending `PMI-DOC-004`" in their `spec.md`
  > and now read `stalled`, because a hold in prose is not a declaration. That gap is precisely what
  > `SC-ESK-010` predicts the register will expose — recorded rather than closed by widening this
  > task's scope.
  >
  > **A mutation survived, and the code lost.** `derivePosture` carried an
  > `Object.hasOwn(postureKinds, …)` guard before its switch. Removing it left **every test green**:
  > the switch already ignores unrecognised kinds, so the guard could not change an outcome. It was
  > deleted rather than given a test that would have been theatre — code that cannot be observed to
  > work is code that only appears to be a control. Twelfth time this repository has recorded that
  > shape, first time it was mine and caught before it shipped.
  >
  > Mutation `F` — removing the `DF-3` object check so `Held — pending` is accepted — failed 4 tests.

**Checkpoint**: ✅ no Epic is *misread* — a declared hold names its releasing input, a parent design
reads `n/a` at `Planned` rather than stalling for tasks it is not meant to have, and absence is never
presented as a decision. **519 governance tests across 39 files.**

---

## Phase 6: User Story 4 — An Epic cannot be Ready without meeting the DOR (P1)

**Goal**: Twelve mechanically-checkable conditions, evaluated in full, with an owned and expiring
single-condition waiver path that never yields an unqualified Ready.

**Independent Test**: `V26-6` and `V26-7` — all failing conditions listed in one pass; a waived Epic
reads `Ready (waived)`; an expired waiver fails the build.

### Tests for User Story 4 (MANDATORY — Constitution V) ⚠️

- [X] T501 [P] [US4] Write failing unit tests for `DOR-01`–`DOR-06` against a fixture tree, in `tests/governance/epic-stage/dor-spec-side.spec.ts`
- [X] T502 [P] [US4] Write failing unit tests for `DOR-07`–`DOR-12` against a fixture tree, in `tests/governance/epic-stage/dor-delivery-side.spec.ts`
- [X] T503 [P] [US4] Write failing unit test asserting evaluation is total — every failing condition is listed and evaluation never short-circuits — in `tests/governance/epic-stage/dor-total.spec.ts`
- [X] T504 [P] [US4] Write failing unit test asserting no Epic reads Ready with an uncovered failure and that a blocking posture defeats completeness, in `tests/governance/epic-stage/readiness.spec.ts`
- [X] T505 [P] [US4] Write failing unit tests for waiver validation — exactly one condition, an owner from the three programme roles, a non-empty reason, a future expiry; invalid and expired handling — in `tests/governance/epic-stage/waivers.spec.ts`
- [X] T506 [P] [US4] Write failing conformance check asserting a waived Epic reads `Ready (waived)` and never plain `Ready`, and that an expired waiver fails the build, in `tests/governance/epic-stage/waiver-readiness.spec.ts`

### Implementation for User Story 4

- [X] T507 [US4] Implement `DOR-01`–`DOR-06` in `tests/governance/epic-stage/dor.ts` per [data-model.md](./data-model.md) §4 (FR-ESK-010, FR-ESK-011, FR-ESK-012; unit test: T501)
- [X] T508 [US4] Implement `DOR-07`–`DOR-12` in `tests/governance/epic-stage/dor.ts`, with `DOR-08` reading `tasks.md` for the Constitution V pairing and `DOR-12` reading the declarations (FR-ESK-012; unit test: T502)
- [X] T509 [US4] Implement total evaluation returning every failure in `tests/governance/epic-stage/dor.ts` (FR-ESK-013; unit test: T503)
- [X] T510 [US4] Implement readiness resolution in `tests/governance/epic-stage/dor.ts` (FR-ESK-014; unit test: T504)
- [X] T511 [US4] Implement waiver validation in `tests/governance/epic-stage/dor.ts`, reading the permitted roles from `governance/governance.config.json` rather than restating them (FR-ESK-022, `DF-5`; unit test: T505)
- [X] T512 [US4] Implement `Ready (waived)` as a distinct readiness value and make expiry fail the build (FR-ESK-023, `DF-6`; check: T506)
- [X] T513 [US4] Render active waivers into the register with condition, owner, reason and expiry (`RF-5`, FR-ESK-023; check: T479)

  > **The determinism tension, and how it resolves.** Readiness depends on whether a waiver has
  > expired; expiry depends on the date; `RF-2` forbids clock-derived content. Both hold because an
  > expired waiver **fails the build** (`DF-6`): the register cannot legitimately sit in a state
  > where the clock flipped a row, because the day that happens is the day CI goes red and demands a
  > decision. `today` is injected everywhere and defaults to the clock only at the outermost edge, so
  > every test is fixed in time.
  >
  > **The whole repository now reads `Not ready` — 26 delivery Epics, plus 2 parent designs at
  > `n/a`.** Every one fails `DOR-09`: no `analysis.md` exists anywhere, because the recording
  > instruction only landed in `T486` this phase. That is correct, not a bug — and it means the DOR
  > has never yet passed for anything, so *`Ready` is untested against the real corpus*. It is tested
  > against fixtures, and the first real `Ready` will be EPIC-026's own.
  >
  > **Four mutations, all caught:**
  >
  > | Mutation | Result |
  > |---|---|
  > | evaluation short-circuits at the first failure | 3 red |
  > | a waived Epic reads plain `Ready` | 3 red |
  > | an expired waiver still grants cover | 2 red |
  > | `DOR-08` stops checking the Constitution V pairing | 1 red |
  >
  > **`DOR-08` is the condition worth the most.** *"Every implementation task pairs with a test"* is
  > Constitution V, the principle this repository has broken more times than any other and always
  > the same way — a task marked complete whose test does not exist. EPIC-003's closure records three
  > such tasks with **no test file anywhere in the repository**. Checking it before implementation
  > starts is cheaper than finding it in a closing report.

**Checkpoint**: ✅ the gate has teeth, the exception path is visible, and neither can be satisfied by
assertion.

---

## Phase 7: User Story 5 — The journey ends where implementation begins (P2)

**Goal**: Remove the duplication the register would otherwise create, and give the three new
artifacts a documented home.

**Independent Test**: `V26-8` — `specs/README.md` carries narrative and build order but no stage,
posture or task counts, and links to the register.

### Tests for User Story 5 (MANDATORY — Constitution V) ⚠️

- [X] T514 [P] [US5] Write failing conformance check asserting `specs/README.md` carries no stage, posture or task-count content and links to the register, in `tests/governance/epic-stage/readme-no-duplication.spec.ts`
- [X] T515 [P] [US5] Write failing conformance check asserting the register carries no convergence, defect, closure or promotion state and references the governing artifact instead, in `tests/governance/epic-stage/boundary.spec.ts`

### Implementation for User Story 5

- [X] T516 [US5] Record the `specs/README.md` status migration under §Proposed migrations in `governance/repository-layout.md` **before** executing it (FR-RGP-007, `SC-RGP-005`; check: existing `G-05d`)
- [X] T517 [US5] Remove the Proceeding/Held groupings and per-Epic task counts from `specs/README.md`, replacing them with a link to the register while retaining the restructure narrative, module mapping and build order (FR-ESK-009, R-026-1; check: T514, depends on T516)
- [X] T518 [US5] Enforce the derived-content-only rule in `tests/governance/epic-stage/render.ts` so the register cannot restate governed state (`RF-6`, FR-ESK-009; check: T515)
- [X] T519 [US5] Add the register, the declarations file and the stage config to the artifact map in `governance/repository-layout.md` (FR-RGP-006; check: existing `G-05`)
- [X] T520 [US5] Add the same three artifacts plus the check group to the governance index in `governance/README.md`, each with its purpose, path, version and Constitution I status (FR-RGP-009; check: existing `G-05b`)

  > **A regex that could not match, and printed as though it could.** `T518`'s guard was written
  > through a python heredoc where `` is a **backspace character**, not a word boundary. So
  > `/CLOSED/` became `/␈CLOSED␈/` — seven invisible control characters across five patterns.
  > `String(pattern)` printed `/CLOSED/`, the array had five entries, the function was entered with
  > `value = "CLOSED"`, and `pattern.test(value)` returned **false**.
  >
  > It took four rounds of diagnostics to find, because every observable said the code was correct.
  > Recorded because the failure mode generalises: **a guard can be present, reachable, and inert**,
  > and printing it does not prove it works. Only the red test did. Same family as the eleven
  > "check that cannot observe its condition" defects this repository has logged — this one could
  > not observe anything at all.
  >
  > **Two mutations confirm the boundary holds in both directions**: adding a task count back to
  > `specs/README.md` fails `G-26-09`; disabling the renderer guard fails three `G-26-10` assertions.
  >
  > `T516` recorded the migration **before** `T517` executed it (`SC-RGP-005`), including what moves,
  > what stays, and why now — the EPIC-018 count that drifted 31 / 32 / 34 and then 31 / 37 / 38
  > while a remediation task waited to fix it.

**Checkpoint**: ✅ PP-002 holds — one source for epic status, one for epic narrative, no overlap.
**615 governance tests across 46 files.**

---

## Phase 8: User Story 6 — Stage and DOR are checked automatically (P2)

**Goal**: The check group is named, severity-split, wired into CI, and every check is capable of
failing.

**Independent Test**: `V26-3`, `V26-6`, `V26-7` all fail on injected faults and pass otherwise.

### Tests for User Story 6 (MANDATORY — Constitution V) ⚠️

- [X] T521 [P] [US6] Write failing conformance check asserting the `epic-stage` group is collected by the existing `governance` Vitest project and needs no database, server or fixture beyond a temporary directory, in `tests/governance/epic-stage/harness.spec.ts`
- [X] T522 [P] [US6] Write failing conformance check asserting every check in the group is capable of failing — a check that cannot fail is decoration (Constitution V) — in `tests/governance/epic-stage/can-fail.spec.ts`

### Implementation for User Story 6

- [X] T523 [US6] Assign identifiers `G-26-01` to `G-26-10` to the checks and document each with its assertion and severity in the check table in `governance/README.md` (FR-ESK-016; check: T521)
- [X] T524 [US6] Implement the severity split in `tests/governance/epic-stage/severity.ts` and apply it across the group — false Ready, register drift and expired waiver fail; stalled Epics, missing postures and out-of-order artifacts report (FR-ESK-016; checks: T489, T506)
- [X] T525 [US6] Extend `tests/governance/tsconfig.json` coverage to the new modules so `pnpm typecheck:governance` type-checks the derivation and DOR logic (check: T521)
- [X] T526 [US6] Verify `pnpm test:governance` runs the full group green, including EPIC-018's `G-05d` (`SC-ESK-002`, `SC-ESK-009`; check: T521)

  > **`G-26-02` now makes the Phase 7 bug impossible to repeat silently.** The check scans every
  > file in the group for control characters, and on a deliberate re-introduction it reports:
  >
  > ```text
  > render.ts contains a control character at offset 2782 — U+0008.
  > A  written through a shell heredoc becomes a BACKSPACE, and the regex silently matches nothing.
  > ```
  >
  > Four rounds of diagnostics the first time; one line of output now. That is the difference
  > between a lesson and a control.
  >
  > **`G-26-02` also caught a real gap on the run that introduced it.** `severity.ts` was written
  > with no spec importing it, and the *"every module under test has a spec"* assertion failed
  > immediately. `severity.spec.ts` exists because the check demanded it, not because I noticed.
  >
  > **`T525` needed no work.** `tests/governance/tsconfig.json` includes `**/*.ts`, which already
  > reaches into `epic-stage/`, and the vitest glob `tests/governance/**/*.spec.ts` already collects
  > the group. `T521` asserts both rather than assuming them — a narrowed glob would silently stop
  > type-checking the derivation and the DOR, and nothing would say so.
  >
  > **Three mutations, all caught**: the backspace regex (1 red, naming the offset and codepoint); a
  > severity spelled by hand at a call site instead of through `severityOf` (1 red); the group
  > acquiring a `pg` import (1 red).

**Checkpoint**: ✅ nothing in this epic rests on inspection. **639 governance tests across 49
files**, all collected by the existing `governance` project, needing no database, server or daemon.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T527 [P] Run quickstart scenarios `V26-1` to `V26-8` and record the results in `specs/026-epic-stage-kanban/quickstart.md`
- [X] T528 [P] Fill remaining unit-test gaps in `tests/governance/epic-stage/` (Constitution V)
- [X] T529 Reconcile EPIC-018's task count — `plan.md` says 31, `specs/README.md` says 32, `tasks.md` holds 34 — by correcting the two prose sources, or record it as a defect in `specs/018-repository-governance/defects/` if the discrepancy is more than arithmetic (R-026-1)
- [X] T530 Add EPIC-026 to the `specs/README.md` epic index as a narrative entry, carrying no status content (check: T514)

  > **`T527`: all eight scenarios executed, results in [quickstart.md](./quickstart.md).** Faults
  > injected and reverted where the scenario calls for one — `V26-3` created a scratch Epic without
  > regenerating (4 assertions red), `V26-2` hand-edited a cell and watched it be overwritten.
  >
  > **`V26-6` is the one that justifies `FR-ESK-013`.** EPIC-014 returned **three** failures —
  > `DOR-05`, `DOR-08`, `DOR-09` — out of twelve conditions evaluated. A short-circuiting evaluator
  > would have reported it as one condition away from ready.
  >
  > **`T529` was arithmetic after all.** EPIC-018 holds **38** tasks: the 31 planned, plus 3 from
  > Phase 6 convergence, 3 from Phase 7 (`DEF-018-001`), and `T667` (`D-39`). Legitimate growth
  > through convergence, not a discrepancy — so both prose sources were corrected rather than a
  > defect raised. The numbers this task quoted (31 / 32 / 34) were already stale when it ran, and
  > the README's copy no longer exists: `T517` removed it.
  >
  > **`T528` filled a real gap.** `build.ts` — where enumeration, declarations, the DOR, waivers,
  > severity and rendering all meet — was exercised only *through* other suites asserting properties
  > of the finished text. Nothing asserted the **join**: that a declaration reaches its row, that a
  > finding is attributed correctly, that a severity comes from the table. `build.spec.ts` adds 13
  > tests for it.
  >
  > **`T530` needed no work** — `T517` already added EPIC-026 to the index as a narrative entry in
  > the process-epics table, carrying no status content.

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX)

**Purpose**: Gate the Epic before it may be promoted out of `local`.

- [X] T531 Confirm every implementation task in `specs/026-epic-stage-kanban/tasks.md` has a passing unit test or conformance check
- [X] T532 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [X] T533 Triage `specs/026-epic-stage-kanban/defects/`; every record closed or deferred to a named Epic
- [X] T534 Re-run `pnpm test:governance` and `pnpm typecheck:governance` green after defect fixes
- [X] T535 Promote `local → dev` (then dev → stage → prod; no environment skipped)

  > **Constitution VII: NOT APPLICABLE — project-owner decision, 2026-08-18.** This epic ships
  > governance documents and executable checks; it has no runtime artifact to promote, and `plan.md`
  > Gate VII already recorded *"PASS — trivially; this epic ships no runtime artifact."* EPIC-027 set
  > the precedent and closed release-eligible on the same basis. Raised as finding `F2` by
  > `/speckit-analyze` and decided rather than quietly marked done.
- [X] T536 Publish the Epic closing report and record closure in `specs/026-epic-stage-kanban/closure.md` (Constitution IX)

---

## Phase 2: Convergence — `DEF-026-001` *(appended 2026-08-19)*

*The deferred half of `DEF-026-001`. The waiver made the exception owned, dated and visible; it did
not make `DOR-08` correct. This does, and retires the waiver.*

- [X] T678 [P] Write failing unit tests asserting `DOR-08` requires a pairing only for tasks that name **application code** — Constitution V's actual wording — and still catches a genuinely unpaired implementation task, in `tests/governance/epic-stage/dor-08-scope.spec.ts`
- [X] T679 Narrow `DOR-08` in `tests/governance/epic-stage/dor.ts` to tasks naming a source file under an application-code path (`FR-ESK-011`, `DEF-026-001`; unit test: T678)
- [X] T680 Retire the `DOR-08` waiver from `governance/epic-declarations.json` once the condition is correct, so EPIC-026 reads plain `Ready` (`FR-ESK-023`; check: `G-26-03`)

  > **EPIC-026 now passes all twelve conditions cleanly and reads plain `Ready`** — the first
  > unqualified `Ready` produced against the real corpus. The Active-waivers section is gone from the
  > register, omitted because it is empty (`RF-5`).
  >
  > **The narrowing was measured against all 28 Epics, not just its author's.** `DOR-08` went from
  > **0 of 28 passing** to **23 of 28**, and each round of the remaining failures was inspected before
  > being treated as a fault. Five distinct detector faults surfaced that way, every one a real task
  > line from this repository:
  >
  > | Fault | Example |
  > |---|---|
  > | the plural `(unit tests: T053, T054)` | EPIC-006 `T054` |
  > | a task whose own artifact is a `.spec.ts` | EPIC-004 `T052` |
  > | the pairing declared on the sibling — `covers T674` | EPIC-004 `T674` |
  > | the pairing after an em dash, not in parentheses | EPIC-001 `T657` |
  > | `(conformance: T556)` | EPIC-028 `T563` |
  >
  > After the fourth, chasing formats one at a time was clearly accumulating epicycles, so the rule
  > became **a verification keyword followed by a real `Tnnn` reference, anywhere in the line**.
  > Requiring the task id is what keeps it precise: *"check the output carefully"* is prose, not a
  > pairing, and a test asserts exactly that.
  >
  > **Two mutations confirm the gate survived**: making nothing count as application code fails six
  > assertions, including every "still bites" case; dropping the `Tnnn` requirement from the pairing
  > pattern fails the prose case.
  >
  > **Five Epics still fail, and they are NOT tuned away.** EPIC-002 and EPIC-017 are parent designs
  > with no tasks by design — their readiness is `n/a`, so the verdict is unused. EPIC-001 (2),
  > EPIC-003 (3) and EPIC-028 (3) carry tasks that write application code and name no verification in
  > any form. Those are **candidate Constitution V gaps in closed epics**, reported for review rather
  > than shaped out of existence — which is what the condition is for.

- [X] T681 Recognise a test named by **path** as a pairing, and cite the tests that already verified `T004`, `T005`, `T462`, `T463` and `T465` (`DEF-026-004`; unit test: `tests/governance/epic-stage/dor-08-scope.spec.ts`)

  > **Eight tasks were reported unpaired. Eight tests already existed.** Each was read before being
  > cited — a filename match would have been wrong at least once: `T004` names `worker/src/main.ts`,
  > and `worker-bootstrap.spec.ts` imports `worker-bootstrap.js`, not `main.ts`. Two files reference
  > `src/main`, so both are cited.
  >
  > Two faults, not one. **Three tasks named their test by file path** — a stronger reference than a
  > task id, since it names the artifact rather than a number to look up — and the pattern required
  > `Tnnn`. **Five had the traceability running one way only**: the test knew the task and the task
  > did not know the test. `engines.module.spec.ts` is literally headed *"T462 — the engine layer is
  > actually reachable from the application."*
  >
  > **`DOR-08` now passes 26 of 28.** The two remaining are EPIC-002 and EPIC-017, parent designs
  > carrying no tasks by design, whose readiness is `n/a` and whose verdict is unused.
  >
  > **What was not done**: relaxing the condition until the eight disappeared. Seven would have gone
  > by dropping the application-code requirement and the eighth by dropping the pairing requirement,
  > leaving a check that reports nothing and a repository that looks compliant. A mutation confirms
  > the line held — accepting *any* second file as a pairing fails five assertions.

- [X] T682 [P] Write failing unit tests asserting `DOR-07` and `DOR-08` are reported **not applicable** — never passed, never failed — for an Epic kind whose `evaluatesDor` is false, in `tests/governance/epic-stage/dor-applicability.spec.ts`
- [X] T683 Declare per-condition applicability in `governance/epic-stage.config.json` and honour it in `tests/governance/epic-stage/dor.ts`, so a parent design stops reporting two permanent non-findings (`FR-ESK-015`, `FR-ESK-024`; unit test: T682)

  > **Requested as "implement EPIC-002 and EPIC-017" — which cannot be done.** Both are parent
  > designs with no `tasks.md`, by rulings `D-19` and `D-18`, and `/speckit-implement` requires a
  > task list. Writing tasks into them would contradict the rulings that moved delivery into their
  > seven children, all of which are `HELD` on `PMI-DOC-004`. What *was* available is the reason
  > those two Epics kept appearing in reports at all.
  >
  > **A third result state, not a pass.** `DOR-07` and `DOR-08` read `tasks.md`, so they reported
  > *"tasks.md is absent"* against a kind `FR-ESK-024` defines as carrying none — a permanent
  > non-finding on every run, forever. They now report **not applicable**.
  >
  > Marking them `passed` would have been the convenient lie and is explicitly refused: Constitution
  > IX forbids reporting an unrun check as passing, and a parent design has not *satisfied* `DOR-07`
  > — the condition does not reach it. A count of passing conditions would have been wrong the moment
  > it included these two.
  >
  > **The carve-out is narrow, and stays narrow.** Applicability is declared in
  > `epic-stage.config.json` (`FR-ESK-015`), only two conditions declare it, and **absence is not an
  > exemption** — the other ten reach every kind. Both parent designs are still judged on everything
  > else and still fail real conditions: EPIC-002 on `DOR-05` and `DOR-09`, EPIC-017 on `DOR-03` and
  > `DOR-09`.
  >
  > **Three mutations, all caught**: ignoring applicability (4 red); reporting not-applicable as
  > passing (1 red — the Constitution IX assertion); treating a silent condition as exempt (3 red).
  >
  > `DOR-08` now reads **28 of 28** passing-or-not-applicable.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup** — no dependencies. **T466 first**: the suite is red until it lands, and a red
  baseline makes "write the test, watch it fail" meaningless.
- **Phase 2 Foundational** — depends on Setup. **Blocks every user story.**
- **Phase 3–8 User stories** — all depend on Phase 2. See the story graph below.
- **Phase 9 Polish** — depends on the stories being complete.
- **Phase Z Closure** — depends on everything.

### User story dependencies

```text
Phase 2 Foundational (derivation)
        │
        ├──► US1 register + evidence  🎯 MVP ──┐
        │                                      │
        ├──► US2 determinism + drift ──────────┤
        │                                      │
        ├──► US3 postures + kinds ─────► US4 DOR + waivers
        │                                      │
        └──► US5 boundary + integration ───────┴──► US6 checks + CI
```

- **US1 (P1)** — independent. Delivers the register on its own.
- **US2 (P1)** — independent of US3/US4; strengthens US1's output.
- **US3 (P1)** — independent. `DOR-12` in US4 reads its postures, so US3 precedes US4.
- **US4 (P1)** — depends on US3 for posture, otherwise independent.
- **US5 (P2)** — independent; touches only `specs/README.md` and the governance documents.
- **US6 (P2)** — depends on the checks written throughout, which it names and severity-splits.

### Within each user story

- Tests are written first and MUST fail before implementation (Constitution V)
- Configuration before derivation; derivation before rendering; rendering before the register
- Postures before the DOR — a condition cannot read a concept that does not exist
- Waivers last among the DOR work — building the exception first shapes the rule around it

### Parallel opportunities

- T467 and T468 in parallel after T466
- All `[P]` test tasks within a phase — each writes its own `.spec.ts`
- **US1, US2, US3 and US5 can all start together** once Phase 2 completes
- US4 waits only on US3; US6 waits on the checks it names

---

## Parallel Example: User Story 1

```bash
# All five US1 tests together — five separate files, written first, all failing:
Task: "Register existence and coverage check in tests/governance/epic-stage/register.spec.ts"
Task: "Rendering unit tests in tests/governance/epic-stage/render.spec.ts"
Task: "Findings/waivers section check in tests/governance/epic-stage/sections.spec.ts"
Task: "Analysis-record conformance check in tests/governance/epic-stage/analysis-record.spec.ts"
Task: "Skill-instruction presence check in tests/governance/epic-stage/skill-instructions.spec.ts"

# Then the two skill amendments in parallel — different files, no shared state:
Task: "Amend .claude/skills/speckit-analyze/SKILL.md to write analysis.md"
Task: "Amend .claude/skills/speckit-clarify/SKILL.md to record every session"
```

---

## Implementation Strategy

### MVP first (Phase 1 + 2 + User Story 1)

1. **T466** — get the suite green before touching anything else
2. Phase 2 — configuration and pure derivation, unit-tested
3. Phase 3 — the register exists and is committed; both journey steps record their runs
4. **STOP and VALIDATE** — run `V26-1`; the board is readable in a pull request

The MVP is genuinely useful alone: it answers "how far along is every Epic" without any gate
existing. Everything after it makes the answer harder to falsify.

### Incremental delivery

1. Foundation → derivation trustworthy
2. **+ US1** → the register exists 🎯
3. **+ US2** → it cannot drift or be edited into disagreement
4. **+ US3** → held, stalled and parent-design are distinguishable
5. **+ US4** → readiness is gated, with a visible exception path
6. **+ US5** → the duplication is removed rather than added to
7. **+ US6** → nothing rests on inspection

Each step is independently valuable and none breaks the previous.

---

## Notes

- **T466 is not optional housekeeping.** `G-05d` has been red since this epic's directory was
  created. Constitution I forbids fixing it outside a covering task — this is that task.
- **Two Spec Kit skill files change** (T486, T487). Both are Constitution I exempt, so they are
  ordinary edits; both changes are additive and neither alters what the commands report to the
  operator.
- **T481 proves an instruction exists, not that it was obeyed.** Nothing can prove the latter. The
  design makes non-compliance self-punishing instead — the Epic stays at a lower stage and fails
  `DOR-09`, visibly. Recorded in R-026-4 rather than papered over.
- **T517 removes content from `specs/README.md`.** It is a migration, so T516 records it first
  (`FR-RGP-007`). Narrative, module mapping and build order all stay.
- **Expect Epics to read lower than you remember** once the register lands. Epics analysed before
  T486 have no `analysis.md` and cannot prove they were analysed. That is the honest reading, not a
  regression — see spec Assumptions.
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks, not direct
  patches (Constitution VI)
- Every command run ends with a closing report (Constitution IX); unrun checks are never reported as
  passing
