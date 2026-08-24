# Analysis: EPIC-033 Requirement Room

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/room-contract.md](./contracts/room-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: four findings, one blocking.** No CRITICAL.

**Remediation applied 2026-08-22 — all four closed.** `tasks.md` gained `T405y` (the shared-pattern
handoff, named), a stated citation convention and thirteen scenarios written in full; `plan.md`'s
table count is corrected to six. `EPIC-034` and `EPIC-035` were additionally told the artifact's
name on their own branches — the half of `C1` that could not be fixed from here. `DOR-09` now reads
**zero blocking findings**; `DOR-06` still fails on the concurrent-session gate.

**This Epic's analysis carries more weight than the three before it**, because `EPIC-033` decides
the Room pattern `EPIC-034` and `EPIC-035` inherit. A defect in the shared half propagates to two
Epics rather than staying local — and the blocking finding is exactly that: the shared artifact
exists, and the two Epics that must import it do not know its name.

Three patterns from earlier Epics were applied forward before this run — requirement citations
(`U1`), a named adapter-binding task (`C2`), and the inverse *does-this-test-have-an-implementation*
check. **All three held**; the inverse check caught `T403u` during authoring and `T403w` closed it.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage Gap | HIGH | `plan.md` Complexity Tracking; `tasks.md` Phase 2, T405q; `EPIC-034`/`EPIC-035` `spec.md` | **The shared artifact has no handle in the two Epics that inherit it.** `packages/room-contract` and `frontend/src/rooms/RoomShell.tsx` are produced by this Epic's Phase 2 and **must** be imported by `EPIC-034` and `EPIC-035` — that is `R-033-3`'s entire purpose and the reason Phase 2 is scheduled first. **Neither of those specs mentions `room-contract` or `RoomShell`.** Both name `EPIC-033` as a dependency in general terms, which is all they could do: this plan did not exist when they were clarified. The consequence is concrete — a planner opening `EPIC-034` finds `UX-0035` and no artifact, and re-derives the pattern, which is precisely what `UX-0035` forbids and what Phase 2 exists to prevent. `T405q` asserts the artifacts *are* shareable; **nothing tells the other two Rooms to share them** | Add a task in Phase Z that records the shared-artifact handoff explicitly — naming `packages/room-contract` and `RoomShell` as required imports for `EPIC-034` and `EPIC-035` — and raise it at those Epics' `/speckit-plan` runs. `T405q` proves shareability; this makes the sharing an instruction rather than an availability |
| I1 ✅ | Inconsistency | MEDIUM | `plan.md` Technical Context (Storage) and Scale/Scope | **Plan states 5 new tables in two places; there are 6.** [data-model.md](./data-model.md) defines `RequirementCandidate`, `Clarification`, `RequirementDecision`, `Baseline`, `BaselineException` and `Handoff` — `AiAnalysis` (§3) is embedded, not a table — and `T337u` lists all six. **This is the third occurrence of this defect class**: `EPIC-030` `I1` (16 versus 30 requirements, 4 versus 3 tables) and `EPIC-031`'s first draft (30 versus 32). Sharper here, because this plan carries an explicit *"counted from the artifacts, not asserted"* note — which was true of five figures and false of this one | Correct both occurrences to **6 new tables**. The counting note should either be true of every figure it covers or not be made |
| U1 ✅ | Underspecification | LOW | `tasks.md`, 27 requirements | **27 requirements are cited on the failing-test task and never on the implementation.** `FR-RQR-050` cites `T338e` (the test); `T338f` implements it and cites only `unit test: T338e`. The trace is valid but **two-hop**, and the convention is written down nowhere — so every analyze run rediscovers it and has to decide whether it is a gap. It is not; it is a house style used consistently across all four tasked Epics | State the convention once, near the top of `tasks.md`: *a requirement is cited on the task that tests it; the implementing task cites the test.* One sentence retires a recurring false positive |
| A1 ✅ | Ambiguity | LOW | `quickstart.md` (13 scenarios); `tasks.md` T405j | **The scenario-enumeration fix has now failed three ways.** `EPIC-031` closed this finding by rewording to *"enumerated by number"* — an instruction, not an enumeration. `EPIC-032` closed it by listing all twelve in full. `EPIC-033` listed them but **abbreviated after the first** — `**Scenario 1** … **2** … **3**` — so extraction finds 4 of 13 and the enumeration is only legible to a human reader | Write `Scenario N` in full for each of the thirteen. Recorded as a three-variant failure so the fourth attempt is not another abbreviation |

**Blocking**: `C1` (HIGH) — **resolved 2026-08-22**, see Remediation status. `DOR-09` ignores rows
marked ✅, so this record no longer holds the Epic out of `Ready`. `DOR-06` still does.

## Coverage summary

Computed by identifier extraction across all 100 task lines and all five design documents, after
the 2026-08-22 remediation.

| Requirement group | Defined | Cited | Has an implementation task |
|---|---|---|---|
| Room identity and boundary (`FR-RQR-001`–`004`) | 4 | 4 | 4 |
| Guided clarification (`FR-RQR-010`–`015`) | 6 | 6 | 6 |
| Options and risks (`FR-RQR-020`–`023`) | 4 | 4 | 4 |
| Acceptance criteria (`FR-RQR-030`–`033`) | 4 | 4 | 4 |
| Stakeholder decision (`FR-RQR-040`–`044`) | 5 | 5 | 5 |
| Baseline (`FR-RQR-050`–`055`) | 6 | 6 | 6 |
| Handoff (`FR-RQR-060`–`062`) | 3 | 3 | 3 |
| Room pattern (`FR-RQR-070`–`075`) | 6 | 6 | 6 |
| **Functional total** | **38** | **38** | **38** |
| Success criteria (`SC-RQR-001`–`009`) | 9 | 9 | 9 |

**Citation coverage 100%. Implementation coverage 100%.** Both axes clean — the first time in the
Wave, and a direct result of the three earlier findings being applied forward.

**Unmapped tasks: none.** All 100 map to a requirement, success criterion, constitution obligation,
`TS-00x` standard, or named handover (`T405q`–`T405t`, `T405w`).

**Failing-test tasks with no implementation partner: 2**, both legitimate — `T337w` (constraints
created by the `T337v` migration) and `T403e` (an architecture check *is* its implementation).
`T403u` was the third and was closed by `T403w` during authoring.

**All nine `R-033-*` research decisions are cited downstream**, and every file named in `plan.md`'s
Project Structure has a task.

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The only directly edited files are on the exempt list |
| II — SRS as source of truth | **Satisfied with a named risk**, correctly recorded rather than silently: `FR-RQR-070`–`075` rest on PMI-DOC-006, status `PROPOSED`, and `BR-0191` is only a *SHOULD*. Argued in `R-033-9` and Complexity Tracking |
| V — Mandatory task-level tests | **Satisfied both directions** — `DOR-08` reports 0 unpaired, and the inverse check reports only two legitimate orphans |
| IX — Closing report / Delivery Board | Board **stale**, declared in `plan.md` and `tasks.md` |
| X — Interaction discipline | Satisfied |
| XI — Reachability gate | Tier 1 planned (`T337x`, inverted by `T405e`). **Tier 2 applies** (`T405o`) and must be a **keyboard** transcript, because `SC-RQR-008` requires the journey be completable by keyboard alone |
| Concurrent-session isolation | **FAIL, already recorded** in `plan.md` with `T337a` as its discharge. Not re-raised — `RF-4` |

**No constitution MUST is violated.**

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 47 |
| Total tasks | 100 |
| Citation coverage | 100% (38/38 FR, 9/9 SC) |
| Implementation coverage | 100% (38/38 FR, 9/9 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **0** |
| **Blocking issues (CRITICAL + HIGH)** | **0** after remediation (was 1) |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 ✅ | Closed | **Both halves.** `T405y` added here — the handoff as an instruction, naming `packages/room-contract` and `RoomShell` as required imports. And `EPIC-034`/`EPIC-035` each gained an Assumption naming those artifacts **on their own branches**, which is the half that could not be fixed from this Epic |
| I1 ✅ | Closed | `plan.md` corrected to **6 new tables** in both places, with the third-recurrence recorded rather than the number quietly changed |
| U1 ✅ | Closed | The two-hop citation convention is now stated once near the top of `tasks.md` |
| A1 ✅ | Closed | `T405j` writes `Scenario N` in full, thirteen times. Verified by extraction: 13 of 13 |

**Applied 2026-08-22 on explicit approval.** `/speckit-analyze` itself wrote only this record.

## Notes

- **`C1` is a cross-Epic finding, and only a cross-Epic read could produce it.** Every document in
  `EPIC-033` is internally consistent; every document in `EPIC-034` and `EPIC-035` is internally
  consistent. The gap exists only in the relationship, and it exists because those two Epics were
  clarified **before** this plan decided the pattern would be shared. That ordering was correct — the
  pattern could not have been decided earlier — which makes this a handoff that has to be created
  rather than a mistake that has to be corrected.
- **Three recurring defect classes, three different outcomes.** `U1` (uncited requirements) and `C2`
  (missing adapter binding) were applied forward and **held** — coverage is 100% on both axes for the
  first time in the Wave. `I1` (a stated count disagreeing with the list) **recurred for the third
  time**, in the one plan that explicitly claimed its figures were extracted. And `A1` has now failed
  in three different ways. The two that held were mechanical fixes; the two that recurred are habits.
  That distinction is the useful part.
- **`U1` here is a false positive worth retiring rather than fixing twice.** The two-hop trace —
  requirement on the test, implementation on the test's id — is deliberate and consistent across four
  Epics. Writing the convention down once costs a sentence and stops four future analyses
  rediscovering it.
