# Analysis: EPIC-031 Decision & Policy Engine

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/decision-contract.md](./contracts/decision-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: five findings, one blocking — and it is a CRITICAL.** An entire owned business requirement
had no tasks, another Epic had explicitly delegated its enforcement here, and the root cause was
structural rather than an oversight in the task list.

**Remediation applied 2026-08-22 — all five closed.** `spec.md` gained a seventh user story;
`tasks.md` gained eight tasks (`T728a`/`T728b`, `T780a`–`T780f`) and six edits. Requirement coverage
by explicit citation is now **100%** (32/32 FR, 8/8 SC), and `DOR-09` reads **zero blocking
findings**. `DOR-06` still fails on the plan's recorded concurrent-session gate, so the Epic remains
**Not ready** and correctly so.

Coverage was computed by identifier extraction across every task line and all five design
documents, not by reading. `C1` and `C2` were both invisible to a read-through. Recomputed after
the 2026-08-22 remediation (92 tasks).

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage Gap | CRITICAL | `spec.md` FR-DPE-030/031/032; `tasks.md` (all phases) | **An entire owned `BR-` has no tasks.** `BR-0069` Automation triggers is this Epic's, and three of its four requirements have **zero** coverage: `FR-DPE-030` (policy may permit reactive workflows), `FR-DPE-031` (*"a rule that cannot be cited MUST NOT be loadable"*), `FR-DPE-032` (automated decision distinguishable from human without inference). Only `FR-DPE-033` is covered, by `T763`. **`EPIC-030` explicitly delegated here** — its spec says *"Which rules may exist, and what they may trigger, is `EPIC-031`'s"* — so `EPIC-030` built half of `RULE-11`'s guarantee and pointed at this Epic for the other half, which does not exist. `spec.md`'s SRS Traceability additionally traces `RULE-11` through `FR-DPE-031`. **Root cause is structural**: the spec has six user stories and **none covers `BR-0069`**, so `/speckit-tasks`, which organises by user story, had nothing to hang these requirements on | Add a seventh user story for automation triggers, then a phase implementing it: the load-time refusal of an uncitable rule (mirroring `FR-DPE-012`'s policy-loader fence), `actorKind` recording, and the reactive-trigger permission. Without it, `RULE-11` ships half-enforced with two Epics each believing the other did it |
| C2 ✅ | Coverage Gap | MEDIUM | `tasks.md` T728, T740; `research.md` R-031-1 | **No task binds `SteeringSource` to `EPIC-019`.** `T728` defines the port *interface* in the contract package; `T740` says the classifier reads *"steering-resolved rules"*; `T780`/`T781` handle the failure path. Nothing creates the **adapter** that connects the port to `EPIC-019`'s `SteeringService` and `resolveSteering()`. `R-031-1`'s entire premise is reusing that module, and the reuse has no task | Add an adapter task in Phase 2 — `backend/src/modules/decision/steering.adapter.ts` — with its unit test, binding `SteeringSource` to `SteeringService`/`resolveSteering()` and registered in `decision.module.ts` |
| U1 ✅ | Underspecification | MEDIUM | `spec.md` FR-DPE-026, SC-DPE-003, SC-DPE-005 | Three requirements are covered **in substance** but cited by **no task line**, so traceability for them is by inference. `FR-DPE-026` (Inbox reachable in one action, four states) → `T757`/`T759`; `SC-DPE-003` (zero model-assigned classes) → `T771`/`T772`; `SC-DPE-005` (auto-executed actions still produce a record) → `T747`/`T748` | Cite the identifier in each covering task line |
| U2 ✅ | Underspecification | LOW | `spec.md` FR-DPE-052; `tasks.md` T735 | The boundary requirement — *this Epic MUST NOT implement the loop, the evidence store, review gates or Room UX* — is verified only at `/speckit-converge`. `T735` asserts no Room vocabulary and `RISK_BANDS.length === 3`; it does not assert the absence of a loop-stage or evidence-contract type | Extend `T735` to reject those too — `contracts/decision-contract.md` §8 already states the rule, so the check would enforce what the contract says |
| A1 ✅ | Ambiguity | LOW | `quickstart.md` (12 scenarios); `tasks.md` | Tasks cite quickstart Scenarios 1, 2, 8 and 10 by number; the other **eight** are reached only through `T788`'s catch-all. A scenario that silently stopped being exercised would not be visible | Cite the scenario number in each implementing task, or have `T788` enumerate all twelve |

**Blocking**: `C1` (CRITICAL) — **resolved 2026-08-22**, see Remediation status. `DOR-09` ignores
rows marked ✅, so this record no longer holds the Epic out of `Ready`. `DOR-06` still does.

The grade was CRITICAL rather than HIGH because the cause was a **missing spec artifact** — no user
story for an owned `BR-` — rather than a forgotten task, and because a second Epic had already
shipped its half of the guarantee on the assumption this one existed.

## Coverage summary

Computed by identifier extraction across all 92 task lines, after remediation.

| Requirement group | Defined | Covered in substance | Cited by identifier |
|---|---|---|---|
| Risk classification (`FR-DPE-001`–`006`) | 6 | 6 | 6 |
| Risk-adaptive approval (`FR-DPE-010`–`016`) | 7 | 7 | 7 |
| Decision Inbox (`FR-DPE-020`–`026`) | 7 | 7 | **7** — `026` cited on `T757`/`T759` |
| **Automation triggers (`FR-DPE-030`–`033`)** | **4** | **4** | **4** — `030`/`031`/`032` covered by `T780a`–`T780f` (User Story 7) |
| Policy explainability (`FR-DPE-040`–`044`) | 5 | 5 | 5 |
| Availability and boundary (`FR-DPE-050`–`052`) | 3 | 3 | **3** — `052` now enforced by `T735`, extended to every clause of contract §8 |
| **Functional total** | **32** | **32** | **32** |
| Success criteria (`SC-DPE-001`–`008`) | 8 | 8 | **8** — `003` cited on `T772`, `005` on `T748` |

**Requirement coverage after remediation: 32/32 = 100% in substance and 100% by explicit
citation**, for both functional requirements and success criteria. The three substantive gaps were
all `BR-0069` (`C1`) and are closed by User Story 7.

**Unmapped tasks: none.** Every one of the **92** maps to a requirement, a success criterion, a
constitution obligation, a `TS-00x` standard, or a named handover (`T793`, `T795`).

**Design-document traceability is complete**: all eight `R-031-*` research decisions are cited in
`plan.md` or `tasks.md`; no requirement is referenced anywhere without being defined in `spec.md`.

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The two files edited directly are both on the exempt list |
| II — SRS as source of truth | Satisfied. Every requirement traces to an approved `BR-` or the Accepted `ADR-0025` |
| V — Mandatory task-level tests | **Satisfied and verified mechanically**: `DOR-08` reports **0 unpaired** across all 92 tasks, re-verified after remediation, and every `unit test: Tnnn` reference resolves to a task that genuinely is a test |
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
| Total tasks | 92 |
| Requirement coverage (substance) | **100%** (32/32 FR), 100% (8/8 SC) |
| Requirement coverage (explicit citation) | **100%** (32/32 FR), **100%** (8/8 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **1** |
| **Blocking issues (CRITICAL + HIGH)** | **0** after remediation (was 1) |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 | ✅ Closed | `spec.md` gained **User Story 7 — An automated decision names the rule that caused it** (P2, four acceptance scenarios). `tasks.md` gained **Phase 9** with `T780a`–`T780f`: reactive-trigger permission (`FR-DPE-030`), the **load-time refusal of an uncitable rule** (`FR-DPE-031`, the `FR-DPE-012` fence shape applied to automation), and `actorKind` recording (`FR-DPE-032`) |
| C2 | ✅ Closed | `T728a`/`T728b` added under a new *Binding the contract to EPIC-019 steering* subsection — the adapter binding `SteeringSource` to `SteeringService`/`resolveSteering()`, which `R-031-1`'s premise required and no task created |
| U1 | ✅ Closed | Identifiers cited: `FR-DPE-026` on `T757`/`T759`, `SC-DPE-003` on `T772`, `SC-DPE-005` on `T748` |
| U2 | ✅ Closed | `T735` extended to reject loop-stage names and evidence-contract types, enforcing **every** clause of `contracts/decision-contract.md` §8 rather than the first |
| A1 | ✅ Closed | `T788` now enumerates all twelve quickstart scenarios by number rather than running them as a catch-all |

**Applied 2026-08-22 on explicit approval**, in a step after the analysis run. `/speckit-analyze`
itself wrote only this record.

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
