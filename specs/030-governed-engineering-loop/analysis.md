# Analysis: EPIC-030 Governed Engineering Loop

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/loop-contract.md](./contracts/loop-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: six findings, one blocking.** No CRITICAL. One HIGH — a requirement with zero task
coverage, and it happens to be the only constraint `ADR-0018` actually decided.

Coverage was computed mechanically rather than by reading: identifiers extracted from `spec.md`,
matched against every task line, and every `unit test: Tnnn` pairing reference resolved against the
task list. Three of the six findings below were invisible to a read-through and surfaced only from
the extraction.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage Gap | HIGH | `spec.md` FR-GEL-004; `tasks.md` (all phases) | **`FR-GEL-004` has zero tasks.** *"Distinct workflow types MUST remain distinct governed surfaces with their own rules, states, permissions and decisions, while sharing one engine."* This is `ADR-0018`'s **only decided constraint** — *"A shared engine must not collapse three governed surfaces into one"* — and nothing in the task list verifies it. `T933` asserts the contract carries no Room vocabulary, which is a different claim | Add a failing-test task plus implementation: assert an object of workflow type A cannot be transitioned under type B's authorities, stages or gates, in `backend/tests/unit/loop-type-isolation.spec.ts`. Place it in Phase 3 (US1), which is where workflow types are introduced |
| I1 | Inconsistency | MEDIUM | `plan.md` Technical Context → Scale/Scope | Two wrong counts. Claims *"16 functional requirements across five groups"* — `spec.md` defines **30** across **seven**. Claims *"4 new tables"* — `data-model.md` defines **3** (`GateOutcome` is embedded in `LoopTransition`; `LoopModel` is a compile-time constant, deliberately not a table) | Correct both figures in `plan.md`. This is the `G-36` count-defect class PMI-DOC-004 §0.3 closed and `G-BRS-01` now guards — a stated count disagreeing with the list it summarises |
| I2 | Inconsistency | MEDIUM | `tasks.md` header, "Non-code outputs count too" | The sentence says the configuration conformance check's fail-ability is proven by `T978`. **`T978` is the `FR-GEL-021` gate mutation proof**, which exercises `gate-evaluator.ts`, not the config check. The config check's fail-ability is in fact established by `T931`, written failing-first | Repoint the sentence to `T931`. The underlying Constitution V obligation is satisfied; only the cross-reference is wrong |
| U1 | Underspecification | MEDIUM | `spec.md` FR-GEL-005, FR-GEL-020, FR-GEL-030, FR-GEL-060, SC-GEL-004, SC-GEL-008 | Six requirements are covered **in substance** but cited by **no task line**, so requirement→task traceability for them is by inference rather than by reference. `BR-0040` and `PP-004` both make traceability a first-class obligation, and inference is what `/speckit-converge` cannot check | Cite the identifier in the covering task: `T930`/`T932` → `FR-GEL-005`; `T975` → `FR-GEL-020`; `T966`/`T973` → `FR-GEL-030`; `T968`/`T969` → `SC-GEL-004`; `T974`/`T978` → `SC-GEL-008` |
| U2 | Underspecification | LOW | `spec.md` FR-GEL-060; `tasks.md` T933 | The boundary requirement — *this Epic MUST NOT implement risk policy, evidence typing or Room UX* — is verified only at `/speckit-converge`. `T933` asserts no Room **vocabulary**; it does not assert the absence of a risk, policy or evidence type. Drift into `EPIC-031`/`EPIC-032` territory would be caught late rather than at build time | Extend `T933`'s architecture test to assert `packages/loop-contract` declares no risk, band, policy or evidence-contract type — `contracts/loop-contract.md` §6 already states this as a rule, so the check would only enforce what the contract says |
| A1 | Ambiguity | LOW | `quickstart.md` (10 scenarios); `tasks.md` | Tasks cite quickstart Scenarios 1, 6 and 7 by number; the other seven are reached only through `T983`'s catch-all *"run every scenario end to end"*. A scenario that silently stops being exercised would not be visible | Cite the scenario number in each task that implements it, or have `T983` enumerate all ten by number |

**Blocking**: `C1` (HIGH). `DOR-09` treats CRITICAL and HIGH as blocking, so this record holds the
Epic out of `Ready` until `C1` is resolved or downgraded with a reason.

## Coverage summary

Computed by identifier extraction across all 81 task lines, not by reading.

| Requirement group | Defined | Covered in substance | Cited by identifier |
|---|---|---|---|
| Loop model & vocabulary (`FR-GEL-001`–`009`) | 9 | 9 | 7 — `004` uncovered (`C1`), `005` uncited (`U1`) |
| Explicit authorized state (`FR-GEL-010`–`016`) | 7 | 7 | 7 |
| Gate seam (`FR-GEL-020`–`022`) | 3 | 3 | 2 — `020` uncited (`U1`) |
| Automation triggers (`FR-GEL-030`–`033`) | 4 | 4 | 3 — `030` uncited (`U1`) |
| Audit (`FR-GEL-040`–`041`) | 2 | 2 | 2 |
| Projections (`FR-GEL-050`–`051`) | 2 | 2 | 2 |
| Boundary (`FR-GEL-060`–`062`) | 3 | 3 | 2 — `060` convergence-only (`U2`) |
| **Functional total** | **30** | **29** | **25** |
| Success criteria (`SC-GEL-001`–`011`) | 11 | 11 | 9 — `004`, `008` uncited (`U1`) |

**Requirement coverage: 29/30 = 97% in substance, 25/30 = 83% by explicit citation.**
The single substantive gap is `FR-GEL-004` (`C1`).

**Unmapped tasks: none.** Every one of the 81 tasks maps to a requirement, a success criterion, a
constitution obligation, or a `TS-00x` steering standard.

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The two files edited directly this session are both on the exempt list |
| II — SRS as source of truth | Satisfied, with the `BR-0065` ownership edit recorded as outstanding and the SRS declared to win until it lands |
| V — Mandatory task-level tests | **Satisfied and verified mechanically**: `DOR-08` reports **0 unpaired** implementation tasks across all 81. Every `unit test: Tnnn` reference resolves to a task that is genuinely a test |
| IX — Closing report / Delivery Board | Board is **stale** and declared so in `plan.md` and `tasks.md` |
| X — Interaction discipline | Satisfied. Clarify batched five questions; plan, tasks and this analysis paused for nothing |
| XI — Reachability gate | Tier 1 planned (`T934`, proved by inversion at `T981`). Tier 2 recorded **not applicable** — no user-facing journey |
| Concurrent-session isolation | **FAIL, already recorded** in `plan.md` Complexity Tracking with `T913` as its discharge. Not re-raised as a finding here: an analysis that re-reports a deviation the plan already justified is noise, and `RF-4`'s reasoning applies — reaching a stage and passing a gate are different claims |

**No constitution MUST is violated by the artifacts.** The one FAIL is a recorded, justified
deviation with a scheduled discharge, which is what Complexity Tracking exists for.

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 41 |
| Total tasks | 81 |
| Requirement coverage (substance) | 97% (29/30 FR), 100% (11/11 SC) |
| Requirement coverage (explicit citation) | 83% (25/30 FR), 82% (9/11 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **0** |
| **Blocking issues (CRITICAL + HIGH)** | **1** |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 | Open | Not applied — `/speckit-analyze` is read-only apart from this record |
| I1 | Open | Not applied |
| I2 | Open | Not applied |
| U1 | Open | Not applied |
| U2 | Open | Not applied |
| A1 | Open | Not applied |

Nothing above was fixed by this run. The command writes this record and no other file; applying the
remediation is a separate, explicitly approved step.

## Notes

- **Three of six findings came from extraction, not reading.** `C1`, `I1` and `I2` are each a
  cross-reference that reads correctly in prose and is wrong in fact — the class of defect this
  repository has repeatedly found only after mechanising the check (`G-BRS-01` on a stated count,
  `DEF-018-001` on a conformance record overstating presence, `DEF-026-008` on a severity the gate
  could not see). Reading the three documents in sequence would not have surfaced any of them.
- **`C1` is worth more than its severity suggests.** `ADR-0018` is Open and this Epic is expected to
  converge it. The ADR decided exactly one thing, and that one thing currently has no test. Closing
  the ADR while its sole constraint is unverified would be convergence on paper.
- **`I1` understates this Epic's scope by roughly half.** Sixteen requirements versus thirty is the
  difference between a medium Epic and a large one, and the count feeds estimation before anyone
  opens the requirement list.
