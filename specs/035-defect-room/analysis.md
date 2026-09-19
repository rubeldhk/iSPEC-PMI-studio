# Cross-Artifact Analysis: EPIC-035 Defect Room

**Session**: 2026-08-23

**Artifacts analysed**: [spec.md](./spec.md) (46 FR, 12 SC, 7 user stories, 14 exit criteria),
[plan.md](./plan.md), [tasks.md](./tasks.md) (81 tasks, 11 phases), with
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/defect-contract.md](./contracts/defect-contract.md) and
[quickstart.md](./quickstart.md) read for corroboration.

**Command**: `/speckit-analyze` — read-only apart from this record (`FR-ESK-019`).

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage Gap | HIGH | spec.md exit criterion 5; tasks.md `T998t`, `T999v`, `T999x` | **A mandatory exit criterion cannot be discharged by any task in any Epic.** Criterion 5 requires a Requirement Gap *"routed end to end into the Requirement Room, jointly with `EPIC-033`"*, and the exit criteria open with *"may be declared complete … only when ALL hold."* But `EPIC-033` has no inbound route (`R-035-4`), so `T998t` asserts **refusal**, `T999v` explicitly declines to mark the criterion met, and `T999x(d)` raises the obligation **in the closing report** — by which time `EPIC-033` is `Analyzed` with a fixed task list and nothing there is scheduled to build it. The dependency is real and correctly identified; it is **discharged at the wrong end and at the wrong time**, and the consequence is that this Epic cannot close. Structurally identical to `EPIC-033`'s own `C1`, one Wave later | Raise it on `EPIC-033` **now**, not at closure — a task on that branch adding a Requirement-Gap intake route, the way `EPIC-033`'s `T405y` instructed the two Rooms to import the shared artifacts. Then either that task discharges criterion 5, or the criterion is restated to name the dependency explicitly so *"cannot close yet"* is visibly different from *"forgot to do it"* |
| A1 ✅ | Ambiguity | HIGH | spec.md:379 (`FR-DFR-060`), 380 (`FR-DFR-061`), 431 (`SC-DFR-007`) | **"Applicable regression tests" gates a MUST and a success criterion and is defined nowhere** — not in spec.md, plan.md, research.md, the contract, the data model or quickstart.md. `FR-DFR-061` says only what applicability is **not** bounded by (*"the defect's own Epic"*), which narrows nothing: every superset of the defect's Epic satisfies it, including "every test in the repository" and "the two the implementer thought of". `SC-DFR-007` then claims *"100% of closures required the defect test plus applicable regression tests to pass"* — a percentage over an undefined set. Compounded by `R-035-1`: with no test-execution owner, nothing can enumerate the set either, so the ambiguity has not been forced into the open by an implementation | Define applicability as a **derivable rule**: the transitive test set reachable from the artifacts the fix touched, through `EPIC-011`'s chain — which is buildable from what exists and is what `T998l` already assumes when it asserts an Epic-A fix breaking an Epic-B test is refused. If instead determination belongs to the runner, say so, and `FR-DFR-060` inherits `R-035-1`'s unowned status rather than reading as satisfiable |
| I1 ✅ | Inconsistency | MEDIUM | tasks.md Phase 6 (`T998y`, `T998z`); spec.md `FR-DFR-090`–`FR-DFR-095` | **The entire Room surface is labelled `[US4]` and lives in a phase about something else.** Phase 6's goal is *"a passing reproduction test is not automatically a change"* and its independent test is quickstart Scenarios 5 and 6 — neither of which renders the Room. `T998y`/`T998z` carry six requirements (`FR-DFR-090`–`095`) and the whole of `DefectRoom.tsx`. The cause is upstream: **this spec has no Room-pattern user story**, where `EPIC-033` and `EPIC-034` both do (`EPIC-034` `US6`, *"The Room reads like the other two"*). Quickstart Scenario 16 is the Room-pattern scenario and is not named as any story's independent test. Consequence: Phase 6's checkpoint claims US4 demonstrable while containing tasks that cannot demonstrate it, and the Room surface has no checkpoint of its own | Two options, and the first is better. **Add a Room-pattern user story to the spec** (P3, as its siblings have), giving `FR-DFR-090`–`095` a phase, a goal and Scenario 16 as its independent test. Or, if the identifier ceiling forbids a phase, relabel `T998y`/`T998z` as unlabelled cross-cutting tasks and move them to Phase N, so no checkpoint claims them |
| I2 ✅ | Inconsistency | LOW | plan.md Project Structure; tasks.md | The plan's `backend/tests/` block shows `integration/` and `architecture/` and **no `unit/` node**, while tasks.md names **25** unit spec files; `frontend/src/pages/` shows `DefectRoom.tsx` but not `DefectRoom.test.tsx`. **This is not `EPIC-034`'s `I1` recurring** — the categories the plan *does* enumerate match exactly, 9 of 9 — but a tree with two children under `backend/tests/` reads as that directory's contents, and it will hold 34 files | Add a `unit/` node with a representative entry and an ellipsis, and the frontend test file. Cheap, and it stops a reader concluding the task list invented a test tree |
| T1 ✅ | Terminology | LOW | spec.md Key Entities (*Transfer*); data-model.md §7 (`Routing`) | The spec's Key Entity **Transfer** is modelled as `Routing` where `destination = 'change-room'`. The deviation is **deliberate and documented in place**, with the reason given: `FR-DFR-077` requires every routed outcome to have a destination, and two tables would let one outcome quietly have none. Recorded here so the drift is a decision on the record rather than something a later reader rediscovers as an error | No change. If the spec is revised for `I1`, align Key Entities to name `Routing` and keep *Transfer* as its Change-Room case |
| L1 ✅ | Inconsistency | LOW | spec.md exit criteria 2–3; tasks.md `T999n` | The spec's exit criteria require **two** mutation proofs (`FR-DFR-041`, `FR-DFR-044`); the task list carries **four**, the extras being `FR-DFR-077` (a `Classification` writable with a null destination) and Constitution XI Tier 1. The asymmetry runs in the safe direction and `T999n` says so in the task text, but the gate does not require the proof that the total-`Record` guarantee actually holds — which is the guarantee `R-035-5` and `ADR-0016` both rest on | Promote both to exit criteria so the gate and the task list agree. Same finding as `EPIC-034`'s `L1`; the recurrence suggests the specify step should ask what the mutation proofs are rather than leaving the task step to add them |

**Overflow**: none. Six findings, all listed.

**Blocking**: `C1` and `A1` (HIGH) — **both resolved 2026-08-23**, see Remediation status. `DOR-09`
ignores rows marked ✅, so this record no longer holds the Epic out of `Ready`. `DOR-06` still does,
until `T997` creates the worktree and the plan's Constitution Check row moves FAIL → PASS.

## Coverage Summary

| Requirement group | Count | Has task? | Notes |
|---|---|---|---|
| `FR-DFR-001`–`002` Room identity and boundary | 2 | ✅ | `T997m`, `T997w`, `T998x` |
| `FR-DFR-010`–`013` Intake | 4 | ✅ | Phase 7 (`T999`–`T999c`) |
| `FR-DFR-020`–`025` Classification | 6 | ✅ | `T997e`–`T997f`, Phase 3 |
| `FR-DFR-030`–`033` Reproduction | 4 | ✅ | `T997k`–`T997l`, `T998j`–`T998k` |
| `FR-DFR-040`–`044` Test-first repair | 5 | ✅ | `T997g`–`T997h`, `T998g`–`T998i`, Phase 6 |
| `FR-DFR-050`–`052` Repair work | 3 | ✅ | Phase 9 (`T999g`–`T999k`) |
| `FR-DFR-060`–`063` Verification | 4 | ✅ | `T998l`–`T998n` — but see `A1` on what *applicable* selects |
| `FR-DFR-070`–`077` Transfer and routing | 8 | ✅ | `T997q`–`T997r`, Phase 5 — `FR-DFR-076` asserts refusal, see `C1` |
| `FR-DFR-080`–`083` Analytics | 4 | ✅ | `T997y`–`T997z`, Phase 8 |
| `FR-DFR-090`–`095` Room pattern | 6 | ✅ | `T998y`–`T998z` — but see `I1` on the phase they sit in |
| `SC-DFR-001`–`012` | 12 | ✅ | Every one cited on a task line |

**Requirement coverage: 58/58 (100%).** Every `FR-DFR-` and `SC-DFR-` identifier appears on an actual
task line, not merely in prose.

**Exit-criteria coverage: 13/14 → 16/16 after remediation.** Criterion 5 was the exception (`C1`); it is now dischargeable by `EPIC-033` `T338u`/`T338v`, and two further criteria were added by `L1`.

**HTTP surface: 13/13.** `T999a`, `T998f`, `T998k`, `T998h`, `T998v`, `T999h`, `T998n` (two routes),
`T998p`, `T998r` (two routes), `T999f` (two routes).

**Quickstart: 18/18** scenarios named in full in `T999q`.

**Owned `BR-0051`–`BR-0058`: 8/8 exercised by a user story.** `EPIC-031`'s `C1` signature — an owned
requirement with functional requirements and no story — does **not** recur; `US7` closed the
`BR-0055` instance before this Epic was planned.

## Constitution Alignment Issues

**None.** Checked specifically against where the previous four Epics failed:

- **Constitution V (non-code output)** — `T997w` cites `conformance: T993s`, `EPIC-030`'s actual
  configuration check, and names the cross-Epic dependency. `EPIC-034`'s `C2` does not recur.
- **Constitution V (task-level tests)** — `DOR-08` unpaired **0**; failing tests with no
  implementation partner **0**.
- **Constitution XI** — Tier 1 (`T997v`) with its inversion (`T999n`); Tier 2 (`T999t`) with a
  conformance check asserting the transcript was generated rather than authored (`T999u`), and
  `SC-DFR-009`'s keyboard journey folded into the same run.
- **Constitution IX** — `T999x` restates four unowned dependencies; `T999z` publishes the report and
  addresses the stale Delivery Board.
- **Concurrent-session gate reads FAIL** in plan.md, so `DOR-06` will not clear until `T997` creates
  the worktree. Same posture as `EPIC-031`–`EPIC-034`; a recorded, justified deviation with a named
  discharge, and **not** reported as a finding.

## Unmapped Tasks

**None.** All 81 tasks map to a requirement, a success criterion, an exit criterion, a constitution
principle, or a named cross-Epic handover.

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 58 → **59** after remediation |
| Total tasks | 81 |
| Requirement coverage | 100% |
| Exit-criteria coverage | 13/14 → **16/16** after remediation |
| Ambiguity count | 1 |
| Duplication count | 0 |
| Critical issues | 0 |
| High issues | 2 |

## Remediation status

**Applied 2026-08-23**, across **two branches** — `C1` could not be closed from this one alone.

| ID | State | What changed |
|---|---|---|
| C1 ✅ | Closed | **Both halves.** On `epic/033-requirement-room`: **`T338u`/`T338v` added** — the failing integration test and `POST /rooms/requirement/gap-intake`, plus the route in that Epic's contract HTTP surface and an Assumption recording that it is a destination for `EPIC-035`. On this branch: **Exit Criterion 5 now names its dependency** and says the Epic cannot be declared complete until those tasks land, so *"cannot close yet"* reads differently from *"nobody did it"*; and **`T997d` raises it at Phase 1** instead of `T999x` naming it at closure, when `EPIC-033`'s task list is already fixed. `T999x(d)` now *reports* the state rather than raising the obligation |
| A1 ✅ | Closed | **`FR-DFR-060` now defines *applicable***: the transitive test set reachable from the artifacts the fix touched, through `EPIC-011`'s chain — derivable, not chosen. `FR-DFR-061` is re-framed as the case most likely to be got wrong rather than as the only constraint, and `SC-DFR-007` cites the definition so the percentage is taken over a determinate set. **`FR-DFR-064` added**: where the transitive set cannot be computed — an incomplete chain, or `TestExecution` unavailable — closure is **refused** and does not fall back to the defect test alone, because an unknown regression set and an empty one must not behave alike. `T998l` and `T998m` carry both |
| I1 ✅ | Closed | **`User Story 8` added to the spec** (P3, *"The Room reads like the other two"*), with Scenario 16 as its independent test and four acceptance scenarios — the story both sibling Rooms already had. **`Phase 6b` added to tasks.md** and `T998y`/`T998z` relabelled `[US8]`. **A phase costs a heading, not an identifier**, so the fix was available with the numbering exhausted and the two tasks kept their `T998` ids |
| I2 ✅ | Closed | The plan's Project Structure gained a `unit/` node with two representative entries and an ellipsis, and `DefectRoom.test.tsx` under `frontend/src/pages/` |
| T1 ✅ | No change needed | The `Transfer` → `Routing` deviation was already deliberate and documented in place, with the reason (`FR-DFR-077` totality). Recorded as reviewed rather than silently accepted |
| L1 ✅ | Closed | **Two exit criteria added** — `FR-DFR-077` mutation-tested, and Constitution XI Tier 1 mutation-tested. `T999n` no longer describes itself as carrying proofs *"the exit criteria do not require"* |

### Figures after remediation

Four moved, and none of them from a miscount: **47 FR** (`FR-DFR-064`), **8 user stories** (`US8`),
**16 exit criteria** (two mutation proofs), and `EPIC-033` **102 tasks** (`T338u`/`T338v`). Task count
here is **unchanged at 81** — every fix was absorbed by a heading, a definition or a citation, because
999 of 999 prefixes are in use and there was nothing else available.

**Re-verified**: 81 tasks, 0 duplicate ids, 0 cross-branch collisions, `DOR-08` unpaired **0**,
failing tests with no implementation partner **0**, `FR`/`SC` uncited **0 of 59**, quickstart
scenarios **18/18**, plan figures **5/5 re-extracted and matching**. `EPIC-033`: **102 tasks**, no
duplicates. Governance **830/830** on both branches.

## Notes

**Every plan figure re-derives.** All nine were re-extracted during this analysis — 46 FR across ten
groups, 12 SC, 7 user stories, 14 exit criteria, 8 tables, 13 routes, 9 ports, 18 scenarios — and
**all nine match**. The count defect that hit `EPIC-030`, `EPIC-031` and `EPIC-033` has now not
recurred twice running.

**Two of the six findings are cross-Epic obligations discharged in the wrong place** (`C1`, and
`I1`'s missing user story), and both were created the same way: by a clarification or a decision
taken *after* the artifact that needed to change was already finalised. `FR-DFR-076` gave the third
outcome a destination after `EPIC-033` was planned; the Room-pattern requirements arrived without the
user story its two siblings have. Neither is a mistake in this Epic's reasoning. Both are what
happens when six Epics are declared in one Wave and then walked through the lifecycle in order —
the earlier ones freeze while the later ones are still learning what they need.

**The task-identifier scheme is exhausted.** 999 of 999 prefixes are in use after this Epic. That is
recorded in [tasks.md](./tasks.md) and handed to `EPIC-026` by `EPIC-034`'s `T995y` and this Epic's
`T999z`; it is **not** a finding against these artifacts, but it does mean **no further Epic can be
tasked** until the regex is widened or the suffix convention is retired.

**The remediation tested that claim and it held.** Closing `I1` needed a user-story phase and closing
`A1` needed a requirement, in an Epic with zero free identifiers — and both fits, because a phase
costs a heading and a requirement costs a citation on an existing task. `EPIC-033` had free suffixes
under used prefixes, which is where `C1`'s two tasks went. What is exhausted is **new prefixes**, and
the distinction is the one `EPIC-034`'s `T995y` asks `EPIC-026` to decide on.
