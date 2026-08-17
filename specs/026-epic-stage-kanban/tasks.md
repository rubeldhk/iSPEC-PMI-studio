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

- [ ] T466 Register `specs/026-epic-stage-kanban/` under §Paths that must not break in `governance/repository-layout.md`, fixing EPIC-018's check `G-05d`, red since 2026-08-09 because this epic's own directory was created without registration
- [ ] T467 [P] Add the `register:update` script — `UPDATE_REGISTER=1 vitest run --project governance` — to `package.json` (R-026-5)
- [ ] T468 [P] Create `tests/governance/epic-stage/fixtures.ts` providing a temporary-directory Epic-tree builder for the unit tests, importable but never collected (non-`.spec.ts`, per the `helpers.ts` convention)

**Checkpoint**: `pnpm test:governance` green again at 159/159 before any new work lands.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The stage model as configuration, and the pure derivation every story reads from.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T469 [P] Write failing conformance check asserting `epic-stage.config.json` defines seven ordered stages each with evidence and a next command, three posture kinds, two Epic kinds, twelve DOR conditions, the waiver roles, and the Epic-directory exclusion pattern, in `tests/governance/epic-stage/config.spec.ts`
- [ ] T470 Author `governance/epic-stage.config.json` with the stage sequence, evidence rules, posture kinds, Epic kinds, `DOR-01`–`DOR-12`, waiver roles and exclusion pattern per [data-model.md](./data-model.md) §1–§5 (FR-ESK-015; check: T469)
- [ ] T471 [P] Write failing unit tests for Epic enumeration and the exclusion rule — every `NNN-` directory included, `specs/_shared/` excluded by pattern rather than by a maintained list, a directory without `spec.md` reported invalid — in `tests/governance/epic-stage/enumerate.spec.ts`
- [ ] T472 Implement Epic enumeration in `tests/governance/epic-stage/derive.ts`, reusing `epicDirectories()` from `tests/governance/helpers.ts` (FR-ESK-008; unit test: T471)
- [ ] T473 [P] Write failing unit tests for the seven per-stage evidence predicates against a fixture tree, including `Clarified` from a recorded session with no questions and `Checklisted` requiring zero unchecked items, in `tests/governance/epic-stage/evidence.spec.ts`
- [ ] T474 Implement the seven evidence predicates in `tests/governance/epic-stage/derive.ts` per [data-model.md](./data-model.md) §1 (FR-ESK-001, FR-ESK-002; unit test: T473)
- [ ] T475 [P] Write failing unit tests for highest-contiguous-stage derivation — evidence above a gap does not raise the stage and is emitted as an out-of-order finding — in `tests/governance/epic-stage/stage.spec.ts`
- [ ] T476 Implement contiguous stage derivation and out-of-order findings in `tests/governance/epic-stage/derive.ts` (FR-ESK-003, FR-ESK-006; unit test: T475)

**Checkpoint**: derivation is pure, unit-tested, and reads the real tree. Stories can now proceed.

---

## Phase 3: User Story 1 — Every Epic's stage is recorded and readable (P1) 🎯 MVP

**Goal**: A committed register listing every Epic with its stage and next command, and the two
journey steps that currently leave no evidence made to record their runs.

**Independent Test**: `V26-1` — one row per Epic directory, ordered, each naming a stage and next
command; `_shared` absent; `EPIC-026` present in its own register.

### Tests for User Story 1 (MANDATORY — Constitution V) ⚠️

- [ ] T477 [P] [US1] Write failing conformance check asserting the register exists, carries the generated-do-not-edit header naming `pnpm register:update`, and lists exactly one row per Epic directory ordered by identifier, in `tests/governance/epic-stage/register.spec.ts`
- [ ] T478 [P] [US1] Write failing unit tests for register rendering — column set, em dash as the sole empty marker, one line per row, no timestamps or aggregates — in `tests/governance/epic-stage/render.spec.ts`
- [ ] T479 [P] [US1] Write failing conformance check asserting the Findings and Active-waivers sections are omitted when empty and otherwise formatted per `RF-4`/`RF-5`, in `tests/governance/epic-stage/sections.spec.ts`
- [ ] T480 [P] [US1] Write failing conformance check asserting `specs/<epic>/analysis.md`, wherever present, conforms to the expected shape and severity vocabulary, in `tests/governance/epic-stage/analysis-record.spec.ts`
- [ ] T481 [P] [US1] Write failing conformance check asserting both skill files carry their recording instruction — and documenting in the file header that this proves the instruction exists, **not** that an agent followed it (R-026-4) — in `tests/governance/epic-stage/skill-instructions.spec.ts`

### Implementation for User Story 1

- [ ] T482 [US1] Implement register rendering in `tests/governance/epic-stage/render.ts` per [contracts/register-format.md](./contracts/register-format.md) `RF-1`–`RF-3` (FR-ESK-007; unit test: T478)
- [ ] T483 [US1] Implement the generate-and-compare entry point with `UPDATE_REGISTER=1` write mode in `tests/governance/epic-stage/register.spec.ts` (FR-ESK-021, R-026-5; check: T477)
- [ ] T484 [US1] Implement Findings and Active-waivers section rendering in `tests/governance/epic-stage/render.ts` (`RF-4`, `RF-5`; check: T479)
- [ ] T485 [US1] Generate and commit `governance/epic-stage-register.md` (FR-ESK-007, FR-ESK-021; check: T477)
- [ ] T486 [US1] Amend `.claude/skills/speckit-analyze/SKILL.md` to write a dated findings record to `specs/<epic>/analysis.md`, naming each finding and its severity (FR-ESK-019; checks: T480, T481)
- [ ] T487 [US1] Amend `.claude/skills/speckit-clarify/SKILL.md` to record a dated session on every run, stating "no questions required" when it asks none (FR-ESK-018; check: T481)

**Checkpoint**: the register exists, is readable in a pull request, and every journey step leaves
evidence that it ran. **This is the MVP** — valuable before any gate exists.

---

## Phase 4: User Story 2 — The stage is derived, so it cannot lie (P1)

**Goal**: Regeneration is deterministic, a stale committed copy fails the build, and no derivable
value can be hand-declared.

**Independent Test**: `V26-2` and `V26-3` — regeneration with no change produces no diff; adding an
Epic without regenerating fails.

### Tests for User Story 2 (MANDATORY — Constitution V) ⚠️

- [ ] T488 [P] [US2] Write failing conformance check asserting regeneration on unchanged input is byte-identical, in `tests/governance/epic-stage/determinism.spec.ts`
- [ ] T489 [P] [US2] Write failing conformance check asserting a committed register differing from a fresh generation fails the build, and that a hand edit is overwritten rather than adopted, in `tests/governance/epic-stage/drift.spec.ts`
- [ ] T490 [P] [US2] Write failing unit test asserting a `stage`, `readiness` or `next` key at any depth in the declarations file is rejected, in `tests/governance/epic-stage/no-shadow.spec.ts`

### Implementation for User Story 2

- [ ] T491 [US2] Enforce deterministic ordering and forbid clock-derived or aggregate content in `tests/governance/epic-stage/render.ts` (`RF-2`; checks: T488, T489)
- [ ] T492 [US2] Implement exact-text drift comparison after line-ending normalisation only, with no fuzzy matching, in `tests/governance/epic-stage/drift.spec.ts` (`RF-7`, FR-ESK-021; check: T489)
- [ ] T493 [US2] Reject derivable keys anywhere in `governance/epic-declarations.json` (`DF-7`, FR-ESK-003; unit test: T490)

**Checkpoint**: the register cannot drift from the repository or be edited into disagreement with it.

---

## Phase 5: User Story 3 — Deliberate stops read differently from stalls (P1)

**Goal**: The three posture kinds, the parent-design Epic kind, and the four declarations the
repository already needs.

**Independent Test**: `V26-5` — EPIC-009/012 read Held with their awaiting input; EPIC-002/017 read
parent-design at Planned with children named; a posture missing its object is reported.

### Tests for User Story 3 (MANDATORY — Constitution V) ⚠️

- [ ] T494 [P] [US3] Write failing unit tests for declaration parsing and validation — exactly three posture kinds, the required object field per kind, referential integrity against directories on disk — in `tests/governance/epic-stage/declarations.spec.ts`
- [ ] T495 [P] [US3] Write failing unit tests for the parent-design kind — terminal stage `Planned`, DOR not evaluated, `children` required, a `tasks.md` present reported as a contradiction — in `tests/governance/epic-stage/epic-kind.spec.ts`
- [ ] T496 [P] [US3] Write failing unit test asserting an Epic stopped with nothing declared reads `stalled` and never `Held`, in `tests/governance/epic-stage/stalled.spec.ts`

### Implementation for User Story 3

- [ ] T497 [US3] Implement declaration loading and validation in `tests/governance/epic-stage/derive.ts` per [contracts/declarations-format.md](./contracts/declarations-format.md) `DF-1`–`DF-3` (FR-ESK-004, FR-ESK-005, FR-ESK-020; unit test: T494)
- [ ] T498 [US3] Implement Epic-kind handling in `tests/governance/epic-stage/derive.ts` — parent designs complete at Planned and are exempt from the DOR (FR-ESK-024, `DF-4`; unit test: T495)
- [ ] T499 [US3] Implement the stalled-versus-declared distinction in `tests/governance/epic-stage/derive.ts` (FR-ESK-006; unit test: T496)
- [ ] T500 [US3] Author `governance/epic-declarations.json` with the four declarations the repository already requires — `EPIC-002` and `EPIC-017` as parent designs naming their children (rulings D-19, D-18), `EPIC-009` and `EPIC-012` as `Held` awaiting `PMI-DOC-004` (decision D-10) (FR-ESK-020, FR-ESK-024; checks: T494, T495)

**Checkpoint**: no Epic is misread — held is not stalled, and a parent design is neither.

---

## Phase 6: User Story 4 — An Epic cannot be Ready without meeting the DOR (P1)

**Goal**: Twelve mechanically-checkable conditions, evaluated in full, with an owned and expiring
single-condition waiver path that never yields an unqualified Ready.

**Independent Test**: `V26-6` and `V26-7` — all failing conditions listed in one pass; a waived Epic
reads `Ready (waived)`; an expired waiver fails the build.

### Tests for User Story 4 (MANDATORY — Constitution V) ⚠️

- [ ] T501 [P] [US4] Write failing unit tests for `DOR-01`–`DOR-06` against a fixture tree, in `tests/governance/epic-stage/dor-spec-side.spec.ts`
- [ ] T502 [P] [US4] Write failing unit tests for `DOR-07`–`DOR-12` against a fixture tree, in `tests/governance/epic-stage/dor-delivery-side.spec.ts`
- [ ] T503 [P] [US4] Write failing unit test asserting evaluation is total — every failing condition is listed and evaluation never short-circuits — in `tests/governance/epic-stage/dor-total.spec.ts`
- [ ] T504 [P] [US4] Write failing unit test asserting no Epic reads Ready with an uncovered failure and that a blocking posture defeats completeness, in `tests/governance/epic-stage/readiness.spec.ts`
- [ ] T505 [P] [US4] Write failing unit tests for waiver validation — exactly one condition, an owner from the three programme roles, a non-empty reason, a future expiry; invalid and expired handling — in `tests/governance/epic-stage/waivers.spec.ts`
- [ ] T506 [P] [US4] Write failing conformance check asserting a waived Epic reads `Ready (waived)` and never plain `Ready`, and that an expired waiver fails the build, in `tests/governance/epic-stage/waiver-readiness.spec.ts`

### Implementation for User Story 4

- [ ] T507 [US4] Implement `DOR-01`–`DOR-06` in `tests/governance/epic-stage/dor.ts` per [data-model.md](./data-model.md) §4 (FR-ESK-010, FR-ESK-011, FR-ESK-012; unit test: T501)
- [ ] T508 [US4] Implement `DOR-07`–`DOR-12` in `tests/governance/epic-stage/dor.ts`, with `DOR-08` reading `tasks.md` for the Constitution V pairing and `DOR-12` reading the declarations (FR-ESK-012; unit test: T502)
- [ ] T509 [US4] Implement total evaluation returning every failure in `tests/governance/epic-stage/dor.ts` (FR-ESK-013; unit test: T503)
- [ ] T510 [US4] Implement readiness resolution in `tests/governance/epic-stage/dor.ts` (FR-ESK-014; unit test: T504)
- [ ] T511 [US4] Implement waiver validation in `tests/governance/epic-stage/dor.ts`, reading the permitted roles from `governance/governance.config.json` rather than restating them (FR-ESK-022, `DF-5`; unit test: T505)
- [ ] T512 [US4] Implement `Ready (waived)` as a distinct readiness value and make expiry fail the build (FR-ESK-023, `DF-6`; check: T506)
- [ ] T513 [US4] Render active waivers into the register with condition, owner, reason and expiry (`RF-5`, FR-ESK-023; check: T479)

**Checkpoint**: the gate has teeth, the exception path is visible, and neither can be satisfied by
assertion.

---

## Phase 7: User Story 5 — The journey ends where implementation begins (P2)

**Goal**: Remove the duplication the register would otherwise create, and give the three new
artifacts a documented home.

**Independent Test**: `V26-8` — `specs/README.md` carries narrative and build order but no stage,
posture or task counts, and links to the register.

### Tests for User Story 5 (MANDATORY — Constitution V) ⚠️

- [ ] T514 [P] [US5] Write failing conformance check asserting `specs/README.md` carries no stage, posture or task-count content and links to the register, in `tests/governance/epic-stage/readme-no-duplication.spec.ts`
- [ ] T515 [P] [US5] Write failing conformance check asserting the register carries no convergence, defect, closure or promotion state and references the governing artifact instead, in `tests/governance/epic-stage/boundary.spec.ts`

### Implementation for User Story 5

- [ ] T516 [US5] Record the `specs/README.md` status migration under §Proposed migrations in `governance/repository-layout.md` **before** executing it (FR-RGP-007, `SC-RGP-005`; check: existing `G-05d`)
- [ ] T517 [US5] Remove the Proceeding/Held groupings and per-Epic task counts from `specs/README.md`, replacing them with a link to the register while retaining the restructure narrative, module mapping and build order (FR-ESK-009, R-026-1; check: T514, depends on T516)
- [ ] T518 [US5] Enforce the derived-content-only rule in `tests/governance/epic-stage/render.ts` so the register cannot restate governed state (`RF-6`, FR-ESK-009; check: T515)
- [ ] T519 [US5] Add the register, the declarations file and the stage config to the artifact map in `governance/repository-layout.md` (FR-RGP-006; check: existing `G-05`)
- [ ] T520 [US5] Add the same three artifacts plus the check group to the governance index in `governance/README.md`, each with its purpose, path, version and Constitution I status (FR-RGP-009; check: existing `G-05b`)

**Checkpoint**: PP-002 holds — one source for epic status, one for epic narrative, no overlap.

---

## Phase 8: User Story 6 — Stage and DOR are checked automatically (P2)

**Goal**: The check group is named, severity-split, wired into CI, and every check is capable of
failing.

**Independent Test**: `V26-3`, `V26-6`, `V26-7` all fail on injected faults and pass otherwise.

### Tests for User Story 6 (MANDATORY — Constitution V) ⚠️

- [ ] T521 [P] [US6] Write failing conformance check asserting the `epic-stage` group is collected by the existing `governance` Vitest project and needs no database, server or fixture beyond a temporary directory, in `tests/governance/epic-stage/harness.spec.ts`
- [ ] T522 [P] [US6] Write failing conformance check asserting every check in the group is capable of failing — a check that cannot fail is decoration (Constitution V) — in `tests/governance/epic-stage/can-fail.spec.ts`

### Implementation for User Story 6

- [ ] T523 [US6] Assign identifiers `G-26-01` to `G-26-10` to the checks and document each with its assertion and severity in the check table in `governance/README.md` (FR-ESK-016; check: T521)
- [ ] T524 [US6] Implement the severity split in `tests/governance/epic-stage/severity.ts` and apply it across the group — false Ready, register drift and expired waiver fail; stalled Epics, missing postures and out-of-order artifacts report (FR-ESK-016; checks: T489, T506)
- [ ] T525 [US6] Extend `tests/governance/tsconfig.json` coverage to the new modules so `pnpm typecheck:governance` type-checks the derivation and DOR logic (check: T521)
- [ ] T526 [US6] Verify `pnpm test:governance` runs the full group green, including EPIC-018's `G-05d` (`SC-ESK-002`, `SC-ESK-009`; check: T521)

**Checkpoint**: nothing in this epic rests on inspection.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T527 [P] Run quickstart scenarios `V26-1` to `V26-8` and record the results in `specs/026-epic-stage-kanban/quickstart.md`
- [ ] T528 [P] Fill remaining unit-test gaps in `tests/governance/epic-stage/` (Constitution V)
- [ ] T529 Reconcile EPIC-018's task count — `plan.md` says 31, `specs/README.md` says 32, `tasks.md` holds 34 — by correcting the two prose sources, or record it as a defect in `specs/018-repository-governance/defects/` if the discrepancy is more than arithmetic (R-026-1)
- [ ] T530 Add EPIC-026 to the `specs/README.md` epic index as a narrative entry, carrying no status content (check: T514)

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX)

**Purpose**: Gate the Epic before it may be promoted out of `local`.

- [ ] T531 Confirm every implementation task in `specs/026-epic-stage-kanban/tasks.md` has a passing unit test or conformance check
- [ ] T532 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T533 Triage `specs/026-epic-stage-kanban/defects/`; every record closed or deferred to a named Epic
- [ ] T534 Re-run `pnpm test:governance` and `pnpm typecheck:governance` green after defect fixes
- [ ] T535 Promote `local → dev` (then dev → stage → prod; no environment skipped)
- [ ] T536 Publish the Epic closing report and record closure in `specs/026-epic-stage-kanban/closure.md` (Constitution IX)

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
