# Analysis: EPIC-031 Decision & Policy Engine

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/decision-contract.md](./contracts/decision-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: five findings, one blocking — and it is a CRITICAL.** An entire owned business requirement
has no tasks, another Epic has explicitly delegated its enforcement here, and the root cause is
structural rather than an oversight in the task list.

Coverage was computed by identifier extraction across all 84 task lines and all five design
documents, not by reading. `C1` and `C2` were both invisible to a read-through.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage Gap | CRITICAL | `spec.md` FR-DPE-030/031/032; `tasks.md` (all phases) | **An entire owned `BR-` has no tasks.** `BR-0069` Automation triggers is this Epic's, and three of its four requirements have **zero** coverage: `FR-DPE-030` (policy may permit reactive workflows), `FR-DPE-031` (*"a rule that cannot be cited MUST NOT be loadable"*), `FR-DPE-032` (automated decision distinguishable from human without inference). Only `FR-DPE-033` is covered, by `T763`. **`EPIC-030` explicitly delegated here** — its spec says *"Which rules may exist, and what they may trigger, is `EPIC-031`'s"* — so `EPIC-030` built half of `RULE-11`'s guarantee and pointed at this Epic for the other half, which does not exist. `spec.md`'s SRS Traceability additionally traces `RULE-11` through `FR-DPE-031`. **Root cause is structural**: the spec has six user stories and **none covers `BR-0069`**, so `/speckit-tasks`, which organises by user story, had nothing to hang these requirements on | Add a seventh user story for automation triggers, then a phase implementing it: the load-time refusal of an uncitable rule (mirroring `FR-DPE-012`'s policy-loader fence), `actorKind` recording, and the reactive-trigger permission. Without it, `RULE-11` ships half-enforced with two Epics each believing the other did it |
| C2 | Coverage Gap | MEDIUM | `tasks.md` T728, T740; `research.md` R-031-1 | **No task binds `SteeringSource` to `EPIC-019`.** `T728` defines the port *interface* in the contract package; `T740` says the classifier reads *"steering-resolved rules"*; `T780`/`T781` handle the failure path. Nothing creates the **adapter** that connects the port to `EPIC-019`'s `SteeringService` and `resolveSteering()`. `R-031-1`'s entire premise is reusing that module, and the reuse has no task | Add an adapter task in Phase 2 — `backend/src/modules/decision/steering.adapter.ts` — with its unit test, binding `SteeringSource` to `SteeringService`/`resolveSteering()` and registered in `decision.module.ts` |
| U1 | Underspecification | MEDIUM | `spec.md` FR-DPE-026, SC-DPE-003, SC-DPE-005 | Three requirements are covered **in substance** but cited by **no task line**, so traceability for them is by inference. `FR-DPE-026` (Inbox reachable in one action, four states) → `T757`/`T759`; `SC-DPE-003` (zero model-assigned classes) → `T771`/`T772`; `SC-DPE-005` (auto-executed actions still produce a record) → `T747`/`T748` | Cite the identifier in each covering task line |
| U2 | Underspecification | LOW | `spec.md` FR-DPE-052; `tasks.md` T735 | The boundary requirement — *this Epic MUST NOT implement the loop, the evidence store, review gates or Room UX* — is verified only at `/speckit-converge`. `T735` asserts no Room vocabulary and `RISK_BANDS.length === 3`; it does not assert the absence of a loop-stage or evidence-contract type | Extend `T735` to reject those too — `contracts/decision-contract.md` §8 already states the rule, so the check would enforce what the contract says |
| A1 | Ambiguity | LOW | `quickstart.md` (12 scenarios); `tasks.md` | Tasks cite quickstart Scenarios 1, 2, 8 and 10 by number; the other **eight** are reached only through `T788`'s catch-all. A scenario that silently stopped being exercised would not be visible | Cite the scenario number in each implementing task, or have `T788` enumerate all twelve |

**Blocking**: `C1` (CRITICAL). `DOR-09` treats CRITICAL and HIGH alike, so the practical effect is
the same as a HIGH — the grade is CRITICAL because the cause is a **missing spec artifact** (no user
story for an owned `BR-`) rather than a task that was forgotten, and because a second Epic has
already shipped its half of the guarantee on the assumption this one exists.

## Coverage summary

Computed by identifier extraction across all 84 task lines.

| Requirement group | Defined | Covered in substance | Cited by identifier |
|---|---|---|---|
| Risk classification (`FR-DPE-001`–`006`) | 6 | 6 | 6 |
| Risk-adaptive approval (`FR-DPE-010`–`016`) | 7 | 7 | 7 |
| Decision Inbox (`FR-DPE-020`–`026`) | 7 | 7 | 6 — `026` uncited (`U1`) |
| **Automation triggers (`FR-DPE-030`–`033`)** | **4** | **1** | **1** — `030`/`031`/`032` **uncovered** (`C1`) |
| Policy explainability (`FR-DPE-040`–`044`) | 5 | 5 | 5 |
| Availability and boundary (`FR-DPE-050`–`052`) | 3 | 3 | 2 — `052` convergence-only (`U2`) |
| **Functional total** | **32** | **29** | **27** |
| Success criteria (`SC-DPE-001`–`008`) | 8 | 8 | 6 — `003`, `005` uncited (`U1`) |

**Requirement coverage: 29/32 = 91% in substance, 27/32 = 84% by explicit citation.**
The three substantive gaps are all `BR-0069` (`C1`).

**Unmapped tasks: none.** Every one of the 84 maps to a requirement, a success criterion, a
constitution obligation, a `TS-00x` standard, or a named handover (`T793`, `T795`).

**Design-document traceability is complete**: all eight `R-031-*` research decisions are cited in
`plan.md` or `tasks.md`; no requirement is referenced anywhere without being defined in `spec.md`.

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The two files edited directly are both on the exempt list |
| II — SRS as source of truth | Satisfied. Every requirement traces to an approved `BR-` or the Accepted `ADR-0025` |
| V — Mandatory task-level tests | **Satisfied and verified mechanically**: `DOR-08` reports **0 unpaired** across all 84 tasks, and every `unit test: Tnnn` reference resolves to a task that genuinely is a test |
| IX — Closing report / Delivery Board | Board is **stale** and declared so in `plan.md` and `tasks.md` |
| X — Interaction discipline | Satisfied. Nine questions across five Epics in one questionnaire; plan, tasks and this analysis paused for nothing |
| XI — Reachability gate | Tier 1 planned (`T736`, inverted by `T785`). **Tier 2 applies** and is planned (`T791`, with `T792` asserting the transcript was generated rather than authored) |
| Concurrent-session isolation | **FAIL, already recorded** in `plan.md` Complexity Tracking with `T716` as its discharge. Not re-raised here — re-reporting a settled deviation is the noise `RF-4` warns against |

**No constitution MUST is violated by the artifacts.** `PP-016` was checked specifically, because
`C1` looked at first like it might undermine it: the row cites `FR-DPE-040`, which **is** covered, so
`PP-016` stands. What `C1` does undermine is the SRS Traceability row tracing `RULE-11` through
`FR-DPE-031` — a business rule, not a constitution principle. Stated precisely rather than
overstated.

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 40 |
| Total tasks | 84 |
| Requirement coverage (substance) | 91% (29/32 FR), 100% (8/8 SC) |
| Requirement coverage (explicit citation) | 84% (27/32 FR), 75% (6/8 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **1** |
| **Blocking issues (CRITICAL + HIGH)** | **1** |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 | Open | Not applied — `/speckit-analyze` is read-only apart from this record |
| C2 | Open | Not applied |
| U1 | Open | Not applied |
| U2 | Open | Not applied |
| A1 | Open | Not applied |

Nothing above was fixed by this run.

## Notes

- **`C1` is the failure `D-33` describes, inverted.** That decision warned of *"two teams believing
  one epic covers both"*. Here neither covers it: `EPIC-030` recorded `BR-0069` as *"enforcement seam
  only; owned by `EPIC-031`"* and built the loop-side half; `EPIC-031` owns the requirement and has
  no tasks for it. Each Epic's own documents are internally consistent, which is why only a
  cross-Epic read finds it.
- **The root cause is worth more than the fix.** `/speckit-tasks` organises by user story. A
  requirement group with no user story therefore produces no tasks — silently, and without failing
  any check, because `DOR-08` asks whether tasks have tests, not whether requirements have tasks.
  `EPIC-032`–`035` should be checked for the same shape before they are tasked.
- **A grading correction, recorded rather than quietly fixed.** The first pass justified `C1`'s
  severity partly on `PP-016` Explainable AI resting on `FR-DPE-031`. It does not — the row cites
  `FR-DPE-040`, which is covered. The severity stands on the cross-Epic delegation and the `RULE-11`
  traceability row instead. Checked before asserting, which is the same discipline the findings
  themselves are about.
