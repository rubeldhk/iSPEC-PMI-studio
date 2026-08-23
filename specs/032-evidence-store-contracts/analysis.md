# Analysis: EPIC-032 Evidence Store & Evidence Contracts

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/evidence-contract.md](./contracts/evidence-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: five findings, two blocking.** No CRITICAL.

Two patterns found in earlier Epics were applied forward before this run — requirement citations on
every task (`EPIC-030`/`EPIC-031` `U1`) and a named adapter-binding task (`EPIC-031` `C2`). **Both
held.** What this run found instead is the **inverse** defect, which those fixes could not have
caught: a requirement with a failing test and **no task that makes it pass**.

That shape is worse than an uncovered requirement, because it *looks* covered. Citation coverage
reads 100%, `DOR-08` reports zero unpaired, and the gap is only visible by asking the opposite
question — not *"does this task have a test?"* but *"does this test have an implementation?"*

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage Gap | HIGH | `spec.md` FR-EVS-035; `tasks.md` T856j, T862a, T862d | **The fail-closed rule has a test, a mutation proof, and no implementation.** `FR-EVS-035` — *"where the evidence store cannot be reached, the completion gate MUST refuse"* — is cited by three tasks: `T856j` declares the **port interface**, `T862a` writes the integration test, `T862d` mutates it. **None implements the gate's refuse-on-unreachable branch.** `T857f` builds `completion.gate.ts` and does not cite it. `T862d` instructs *"make the gate allow when the store is unreachable"* — presuming behaviour no task creates. This is the requirement the **2026-08-22 clarification added**, which makes it sharper: the session produced a requirement, a success criterion, a test and a mutation proof, and no implementation | Add an implementation task in Phase 3 or 7 — refuse-on-unreachable in `backend/src/modules/evidence/completion.gate.ts`, citing `FR-EVS-035` and paired to `T862a` |
| C2 | Coverage Gap | HIGH | `spec.md` FR-EVS-012; `tasks.md` T859h | **`FR-EVS-012` is cited by exactly one task, and it is the test.** *"Evidence attached to a superseded version MUST remain readable and MUST NOT read as evidence for the current version."* `T859h` writes the failing test; **no task implements version matching.** The behaviour needs `attestedVersion` compared against the work's current version inside `contract.status.ts`, and nothing says to build it. `T859h` would be written, would fail, and the task list would offer nothing further | Add an implementation task paired to `T859h` — version-scoped item matching in `backend/src/modules/evidence/contract.status.ts`, citing `FR-EVS-012` |
| I1 | Inconsistency | MEDIUM | `packages/evidence-contract/`; `contracts/evidence-contract.md` §2; `data-model.md` §2 | **"Contract" means two different things in this Epic, one inside the other.** `packages/evidence-contract` is an *interface contract* package, named for the `engine-contract`/`agent-contract` family. `EvidenceContract` is a *domain entity* meaning the required-evidence set (`BR-0142`). So a package called `evidence-contract` exports a type called `EvidenceContract` that means something else, and prose saying *"the evidence contract"* is ambiguous in this Epic specifically | Rename the domain entity to **`EvidenceRequirementSet`** (or the file to `requirement-set.ts`), keeping `BR-0142`'s wording in prose. The package name follows an established five-Epic convention and should not move |
| U1 | Underspecification | LOW | `research.md` R-032-3 | `R-032-3` — where the evidence model lives — is the only research decision **never cited by identifier** downstream. Its content is realised in `plan.md`'s Project Structure, but nothing points back at the decision, so a later reader asking *why a sixth contract package* has no thread to pull | Cite `R-032-3` in `plan.md`'s Structure Decision alongside the other seven |
| A1 | Ambiguity | LOW | `quickstart.md` (12 scenarios); `tasks.md` T862i | Tasks cite Scenarios 1 and 6 by number; `T862i` says *"all twelve … enumerated 1–12 by number rather than as a catch-all"* — but the task **instructs** enumeration rather than enumerating. **This is the same `A1` `EPIC-031` recorded, and the fix applied there was the same wording change** — so the fix did not fix it. An instruction to enumerate is still a catch-all | Enumerate the twelve scenarios explicitly in `T862i`, or cite the scenario number on each implementing task. Recording the failed prior fix so the same wording is not tried a third time |

**Blocking**: `C1` and `C2` (both HIGH). `DOR-09` treats HIGH as blocking, so this record holds the
Epic out of `Ready` until both are resolved. `DOR-06` also still fails on the plan's recorded
concurrent-session gate.

## Coverage summary

Computed by identifier extraction across all 81 task lines and all five design documents.

| Requirement group | Defined | Cited | **Has an implementation task** |
|---|---|---|---|
| Evidence types (`FR-EVS-001`–`006`) | 6 | 6 | 6 |
| Provenance (`FR-EVS-010`–`016`) | 7 | 7 | **6** — `012` test-only (`C2`) |
| Evidence Contract (`FR-EVS-020`–`027`) | 8 | 8 | 8 |
| Completion gate (`FR-EVS-030`–`035`) | 6 | 6 | **5** — `035` test-only (`C1`) |
| External contribution (`FR-EVS-040`–`043`) | 4 | 4 | 4 |
| Boundary (`FR-EVS-050`–`052`) | 3 | 3 | 3 — verified by architecture check, which is the implementation |
| **Functional total** | **34** | **34** | **32** |
| Success criteria (`SC-EVS-001`–`009`) | 9 | 9 | 9 |

**Citation coverage is 100%. Implementation coverage is 32/34 = 94%.** The distinction is the whole
of this analysis: the first number is what `DOR-08` and the earlier fixes measure, and it was clean
while two requirements had nothing to build.

**Unmapped tasks: none.** All 81 map to a requirement, success criterion, constitution obligation,
`TS-00x` standard, or named handover (`T863d`, `T863e`, `T863j`).

**Four failing-test tasks have no implementation partner**; two are legitimate and two are `C1`/`C2`:

| Task | Verdict |
|---|---|
| `T856r` architecture independence | **Legitimate** — an architecture check *is* the implementation |
| `T859c` append-only integration | **Legitimate** — the constraint is created by the `T856o` migration |
| `T859h` superseded version | **`C2`** — nothing implements it |
| `T860c` version-less refusal | **Covered** — `T860d` implements the `400`, but does not cite `T860c` as its pairing |

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The only directly edited files are on the exempt list |
| II — SRS as source of truth | Satisfied. Every requirement traces to an approved `BR-` in §6.15 or `ADR-0022`'s decided half |
| V — Mandatory task-level tests | **Satisfied in the direction it measures** — `DOR-08` reports 0 unpaired across all 81. `C1` and `C2` are the *opposite* direction, which Constitution V does not ask about and this analysis does |
| IX — Closing report / Delivery Board | Board **stale**, declared in `plan.md` and `tasks.md` |
| X — Interaction discipline | Satisfied. Nine questions across five Epics in one questionnaire; this run paused for nothing |
| XI — Reachability gate | Tier 1 planned (`T856s`, inverted by `T862e`). **Tier 2 not applicable by rule** — `UX-0060` and `U-09` (`R-032-8`), recorded rather than omitted |
| Concurrent-session isolation | **FAIL, already recorded** in `plan.md` Complexity Tracking with `T855a` as its discharge. Not re-raised — `RF-4` |

**No constitution MUST is violated.**

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 43 |
| Total tasks | 81 |
| Citation coverage | 100% (34/34 FR, 9/9 SC) |
| **Implementation coverage** | **94%** (32/34 FR), 100% (9/9 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **0** |
| **Blocking issues (CRITICAL + HIGH)** | **2** |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 | Open | Not applied — `/speckit-analyze` is read-only apart from this record |
| C2 | Open | Not applied |
| I1 | Open | Not applied |
| U1 | Open | Not applied |
| A1 | Open | Not applied |

## Notes

- **The pre-applied fixes worked, and that is why this run found something new.** `EPIC-030` and
  `EPIC-031` both surfaced uncited requirements (`U1`) and `EPIC-031` surfaced a missing port
  adapter (`C2`). Both were applied forward here before committing, and both held — citation
  coverage is 100% and `T856m` exists. The residue is the defect those fixes cannot see.
- **`DOR-08` asks a one-directional question.** *"Does this implementation task name a test?"* It
  cannot ask *"does this test name an implementation?"*, and neither can any check in the suite. Two
  requirements in this Epic had a test, a success criterion and — for `FR-EVS-035` — a mutation
  proof, while nothing built the behaviour. **This is worth a governance check of its own**, and it
  would have caught both findings here mechanically. Not this Epic's to build; worth escalating
  alongside the task-identifier exhaustion `T863j` already carries.
- **`A1` records a fix that failed.** `EPIC-031`'s identical finding was closed by rewording the
  catch-all task to say *"enumerated by number"*. That wording change was applied here too, and the
  extraction still finds only two scenarios cited — because instructing enumeration is not
  enumerating. Written down so the same wording is not tried a third time.
- **`I1` is the kind of thing that is cheap now and permanent later.** Once `EvidenceContract` is a
  Prisma model, a TypeScript export and a column name, renaming it costs a migration.
