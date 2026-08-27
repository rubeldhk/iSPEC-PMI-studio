# Analysis: EPIC-030 Governed Engineering Loop

**Session**: 2026-08-22 · **Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md),
[tasks.md](./tasks.md) · **Also read**: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/loop-contract.md](./contracts/loop-contract.md),
[quickstart.md](./quickstart.md)

Cross-artifact consistency pass before implementation. Read-only apart from this record
(`FR-ESK-019`).

**Result: six findings, one blocking.** No CRITICAL. One HIGH — a requirement with zero task
coverage, and it happens to be the only constraint `ADR-0018` actually decided.

**Remediation applied 2026-08-22**: `C1`, `I1`, `I2` and `U1` are closed and marked ✅. `U2` and
`A1` remain open — both LOW, both improvements to checks rather than gaps in them. With `C1`
closed, `DOR-09` reads **zero blocking findings**; `DOR-06` still fails on the plan's recorded
concurrent-session gate, so the Epic remains **Not ready** and correctly so.

Coverage was computed mechanically rather than by reading: identifiers extracted from `spec.md`,
matched against every task line, and every `unit test: Tnnn` pairing reference resolved against the
task list. Three of the six findings below were invisible to a read-through and surfaced only from
the extraction.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage Gap | HIGH | `spec.md` FR-GEL-004; `tasks.md` (all phases) | **`FR-GEL-004` has zero tasks.** *"Distinct workflow types MUST remain distinct governed surfaces with their own rules, states, permissions and decisions, while sharing one engine."* This is `ADR-0018`'s **only decided constraint** — *"A shared engine must not collapse three governed surfaces into one"* — and nothing in the task list verifies it. `T933` asserts the contract carries no Room vocabulary, which is a different claim | Add a failing-test task plus implementation: assert an object of workflow type A cannot be transitioned under type B's authorities, stages or gates, in `backend/tests/unit/loop-type-isolation.spec.ts`. Place it in Phase 3 (US1), which is where workflow types are introduced |
| I1 ✅ | Inconsistency | MEDIUM | `plan.md` Technical Context → Scale/Scope | Two wrong counts. Claims *"16 functional requirements across five groups"* — `spec.md` defines **30** across **seven**. Claims *"4 new tables"* — `data-model.md` defines **3** (`GateOutcome` is embedded in `LoopTransition`; `LoopModel` is a compile-time constant, deliberately not a table) | Correct both figures in `plan.md`. This is the `G-36` count-defect class PMI-DOC-004 §0.3 closed and `G-BRS-01` now guards — a stated count disagreeing with the list it summarises |
| I2 ✅ | Inconsistency | MEDIUM | `tasks.md` header, "Non-code outputs count too" | The sentence says the configuration conformance check's fail-ability is proven by `T978`. **`T978` is the `FR-GEL-021` gate mutation proof**, which exercises `gate-evaluator.ts`, not the config check. The config check's fail-ability is in fact established by `T993s`, written failing-first | Repoint the sentence to `T993s`. The underlying Constitution V obligation is satisfied; only the cross-reference is wrong |
| U1 ✅ | Underspecification | MEDIUM | `spec.md` FR-GEL-005, FR-GEL-020, FR-GEL-030, FR-GEL-060, SC-GEL-004, SC-GEL-008 | Six requirements are covered **in substance** but cited by **no task line**, so requirement→task traceability for them is by inference rather than by reference. `BR-0040` and `PP-004` both make traceability a first-class obligation, and inference is what `/speckit-converge` cannot check | Cite the identifier in the covering task. **The first draft of this recommendation named four wrong task ids** — written from the pre-renumber list rather than read back from the file, the same defect class this finding reports. Corrected and applied: `T993r`/`T932` → `FR-GEL-005`; `T993r`/`T967`/`T968` → `FR-GEL-020`; `T961`/`T962`/`T966` → `FR-GEL-030`; `T961`/`T962` → `SC-GEL-004`; `T967`/`T968`/`T978` → `SC-GEL-008` |
| U2 | Underspecification | LOW | `spec.md` FR-GEL-060; `tasks.md` T933 | The boundary requirement — *this Epic MUST NOT implement risk policy, evidence typing or Room UX* — is verified only at `/speckit-converge`. `T933` asserts no Room **vocabulary**; it does not assert the absence of a risk, policy or evidence type. Drift into `EPIC-031`/`EPIC-032` territory would be caught late rather than at build time | Extend `T933`'s architecture test to assert `packages/loop-contract` declares no risk, band, policy or evidence-contract type — `contracts/loop-contract.md` §6 already states this as a rule, so the check would only enforce what the contract says |
| A1 | Ambiguity | LOW | `quickstart.md` (10 scenarios); `tasks.md` | Tasks cite quickstart Scenarios 1, 6 and 7 by number; the other seven are reached only through `T983`'s catch-all *"run every scenario end to end"*. A scenario that silently stops being exercised would not be visible | Cite the scenario number in each task that implements it, or have `T983` enumerate all ten by number |

**Blocking**: `C1` (HIGH) — **resolved 2026-08-22**, see Remediation status. `DOR-09` treats
CRITICAL and HIGH as blocking and ignores rows marked ✅, so this record no longer holds the Epic
out of `Ready`. `DOR-06` still does.

## Coverage summary

Computed by identifier extraction across all task lines, not by reading. Recomputed after the
2026-08-22 remediation (83 tasks).

| Requirement group | Defined | Covered in substance | Cited by identifier |
|---|---|---|---|
| Loop model & vocabulary (`FR-GEL-001`–`009`) | 9 | 9 | **9** — `004` covered by `T944a`/`T944b`, `005` cited on `T993r`/`T932` |
| Explicit authorized state (`FR-GEL-010`–`016`) | 7 | 7 | 7 |
| Gate seam (`FR-GEL-020`–`022`) | 3 | 3 | **3** — `020` cited on `T993r`/`T967`/`T968` |
| Automation triggers (`FR-GEL-030`–`033`) | 4 | 4 | **4** — `030` cited on `T961`/`T962`/`T966` |
| Audit (`FR-GEL-040`–`041`) | 2 | 2 | 2 |
| Projections (`FR-GEL-050`–`051`) | 2 | 2 | 2 |
| Boundary (`FR-GEL-060`–`062`) | 3 | 3 | 2 — `060` convergence-only (`U2`) |
| **Functional total** | **30** | **30** | **29** — only `060` remains convergence-only (`U2`, LOW) |
| Success criteria (`SC-GEL-001`–`011`) | 11 | 11 | **11** — `004` cited on `T961`/`T962`, `008` on `T967`/`T968`/`T978` |

**Requirement coverage after remediation: 30/30 = 100% in substance, 29/30 = 97% by explicit
citation.** `FR-GEL-004` gained `T944a`/`T944b`; the one remaining uncited requirement is
`FR-GEL-060`, verified at convergence by design (`U2`, LOW, open).

**Unmapped tasks: none.** Every one of the **83** tasks maps to a requirement, a success criterion,
a constitution obligation, or a `TS-00x` steering standard.

## Constitution alignment

| Principle | State |
|---|---|
| I — Spec Kit command gate | Satisfied. The two files edited directly this session are both on the exempt list |
| II — SRS as source of truth | Satisfied, with the `BR-0065` ownership edit recorded as outstanding and the SRS declared to win until it lands |
| V — Mandatory task-level tests | **Satisfied and verified mechanically**: `DOR-08` reports **0 unpaired** implementation tasks across all 83, re-verified after remediation. Every `unit test: Tnnn` reference resolves to a task that is genuinely a test |
| IX — Closing report / Delivery Board | Board is **stale** and declared so in `plan.md` and `tasks.md` |
| X — Interaction discipline | Satisfied. Clarify batched five questions; plan, tasks and this analysis paused for nothing |
| XI — Reachability gate | Tier 1 planned (`T934`, proved by inversion at `T981`). Tier 2 recorded **not applicable** — no user-facing journey |
| Concurrent-session isolation | **FAIL, already recorded** in `plan.md` Complexity Tracking with `T993a` as its discharge. Not re-raised as a finding here: an analysis that re-reports a deviation the plan already justified is noise, and `RF-4`'s reasoning applies — reaching a stage and passing a gate are different claims |

**No constitution MUST is violated by the artifacts.** The one FAIL is a recorded, justified
deviation with a scheduled discharge, which is what Complexity Tracking exists for.

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 41 |
| Total tasks | 83 |
| Requirement coverage (substance) | **100%** (30/30 FR), 100% (11/11 SC) |
| Requirement coverage (explicit citation) | **97%** (29/30 FR), **100%** (11/11 SC) |
| Ambiguity findings | 1 |
| Duplication findings | 0 |
| **Critical issues** | **0** |
| **Blocking issues (CRITICAL + HIGH)** | **0** after remediation (was 1) |

## Remediation status

Recorded separately from the findings table so `DOR-09` reads open findings, not history.

| ID | State | Action taken |
|----|-------|--------------|
| C1 | ✅ Closed | `T944a` (failing test, `backend/tests/unit/loop-type-isolation.spec.ts`) and `T944b` (per-type configuration resolution on the transition path) added to Phase 3 / US1, both citing `FR-GEL-004` and `ADR-0018` |
| I1 | ✅ Closed | `plan.md` Scale/Scope corrected to **30 requirements across seven groups** and **3 new tables**, with the correction and its reasoning recorded inline rather than silently edited |
| I2 | ✅ Closed | `tasks.md` header repointed from `T978` to `T993s`, and reworded to say why `T993s` precedes `T932` |
| U1 | ✅ Closed | Identifiers cited on `T993r`, `T932`, `T961`, `T962`, `T966`, `T967`, `T968`, `T978`. The recommendation's own first draft named four wrong task ids — corrected against the file before applying |
| U2 | Open | LOW. Extending `T933` to reject risk/policy/evidence types is an improvement to a check, not a gap in coverage |
| A1 | Open | LOW. Scenario-number citation; `T983` already runs all ten |

**Applied 2026-08-22 on explicit approval**, in a step after the analysis run. `/speckit-analyze`
itself wrote only this record; `spec.md` was not touched at all, and `plan.md` and `tasks.md` were
edited only by the approved remediation.

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

---

# Analysis: EPIC-030 — Step C2A adjudication addition

**Session**: 2026-08-25 · **Scope**: the eighth requirement group only (`FR-GEL-063`–`FR-GEL-073`,
`SC-GEL-012`–`SC-GEL-017`, `T1082`–`T1095`). Unrelated EPIC-030 requirements were **not**
re-analysed, per the Step C2A instruction *"Do not repeat or rewrite unrelated EPIC-030
requirements."*

**Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md) · **Also read**:
[data-model.md](./data-model.md), [contracts/adjudication-contract.md](./contracts/adjudication-contract.md),
[quickstart.md](./quickstart.md), and EPIC-037's
[spec.md](../037-governed-execution-registry/spec.md) and
[contracts/event-vocabulary.md](../037-governed-execution-registry/contracts/event-vocabulary.md).

## Findings — Session 2026-08-25 (Step C2A)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| X1 | Inconsistency | HIGH | `packages/loop-contract/src/adjudication.ts` `AdjudicationVerdict`; EPIC-037 `contracts/event-vocabulary.md` class 4 | **`refused` is not injective onto EPIC-037's event vocabulary.** Five of six verdicts map to exactly one class-4 event. `refused` must become one of `validation-failed`, `approval-refused` or `transition-refused` — and the verdict carries only a prose `reason` to distinguish them. Prose is not a discriminator, so EPIC-037 cannot emit the correct event deterministically | Add a machine-readable `refusalCategory` (`'separation-of-duties' \| 'lifecycle' \| 'gate' \| 'application'`) to `AdjudicationVerdict` **before** EPIC-037 `T1058`. Do not have EPIC-037 parse `reason` |
| X2 | Constitution Alignment | MEDIUM | Constitution V; `tasks.md` T1082–T1095 | **Failing-first was not evidenced per test/implementation pair.** The paired tasks were authored in the required order, but no run was captured showing each test red before its implementation existed. Constitution V requires the failure to be *observed*, not merely intended | Capture failing-first evidence for the eight pairs, or record the omission as a defect under Principle VI. Do not backfill a claim that was not observed |
| X3 | Underspecification | LOW | `packages/loop-contract/src/adjudication.ts` `SpecificationStatus` | `SpecificationStatus = string` is a bare alias, so the type system cannot stop a `LoopStage` value being passed. `FR-GEL-064` is enforced by the `T1082` contract test (no mapping function exists), not structurally | Acceptable while EPIC-009 exports no branded status type. Revisit if one appears |
| X4 | Coverage Gap | LOW | `spec.md` FR-GEL-063 | `FR-GEL-063` says "accept as governed intake" and **no transport surface exists** — no route, no MCP binding | **Accepted, not a defect.** The C2A boundary authorised *"only the minimum backend/contract/database work"*; EPIC-037 consumes the service in-process. Recorded so the absence is not later mistaken for an omission |
| X6 | Coverage Gap | HIGH | `backend/src/modules/loop/` (no adapters); `loop.module.ts` (no registration) | **All seven ports have zero production implementations**, and `ProposalAdjudicatorService` is not registered in the Nest DI graph — it is constructed only by tests. The decision logic, the contract, the table and its trigger are real and verified; nothing in a running application reaches them, and nothing writes to `adjudication_records` outside a test | EPIC-037 Band A cannot supply these itself without re-implementing EPIC-030's integrations with EPIC-009, EPIC-021 and EPIC-024 — which *"consume, never re-implement"* forbids. Propose adapter + DI tasks (`T1096`–`T1102`) for owner authorisation **before** Band A resumes. Not silently expanded into during C2A, per the implementation boundary |
| X5 ✅ | Coverage Gap | MEDIUM | `tasks.md` T1092; `backend/tests/integration/loop/adjudication-evidence.spec.ts` | `T1092` promised *"redaction does not break the chain"* and the test file asserted no such thing, while the task was marked complete | **Fixed in this session** — the test now appends a redacting row and asserts the proposal → verdict → transition linkage survives while the prose does not, and that earlier evidence is not removed |

## Coverage summary

| Requirement | Has task? | Task IDs | Notes |
|---|---|---|---|
| FR-GEL-063 | yes | T1082, T1083, T1087 | Proposal shape in the contract package |
| FR-GEL-064 | yes | T1082 | Asserted as *absence of a mapping function*; see X3 |
| FR-GEL-065 | yes | T1086, T1087 | Validity delegated to EPIC-009; no local transition table |
| FR-GEL-066 | yes | T1086, T1087, T1094, T1095 | Gates from EPIC-021; authorisation from EPIC-024 |
| FR-GEL-067 | yes | T1084, T1085 | Agent/service self-approval refused before policy is read |
| FR-GEL-068 | yes | T1082, T1086, T1087 | Closed set of six, exhausted in tests |
| FR-GEL-069 | yes | T1088, T1089 | `unknown` never becomes `applied` or `refused` |
| FR-GEL-070 | yes | T1090, T1091 | Checked before authority, so stale ≠ unauthorised |
| FR-GEL-071 | yes | T1090, T1091, T1093 | Unique index — not a read-then-write race |
| FR-GEL-072 | yes | T1092, T1093 | Trigger **attached**; redaction chain asserted (X5) |
| FR-GEL-073 | yes | T1083, T1094 | Architecture test asserts the boundary both ways |

**Coverage**: 11 / 11 (100%). `SC-GEL-012`–`SC-GEL-017` each map to a quickstart scenario
(11–16) and at least one task.

## Metrics

- Requirements analysed: **11** · Success criteria added: **6**
- Tasks in scope: **14** (`T1082`–`T1095`)
- Findings: **6** — 0 CRITICAL · **2 HIGH** · 2 MEDIUM · 2 LOW
- One MEDIUM finding (X5) was remediated during the session; the rest are open.

## Notes

`X1` and `X6` are the two findings that block EPIC-037 Band A. It is a **contract** change, not an
implementation defect, and it is cheaper to make now than after connectors bind to the verdict
shape. `X2` is a process-evidence gap and is reported rather than papered over.

---

# Analysis: EPIC-030 — C2A closure (`X1`, `X6`)

**Session**: 2026-08-25 (second) · **Scope**: the two HIGH findings from the C2A session, and
anything the work to close them surfaced. Unrelated EPIC-030 requirements were not re-analysed.

**Artifacts**: [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md),
[data-model.md](./data-model.md),
[contracts/adjudication-contract.md](./contracts/adjudication-contract.md),
[quickstart.md](./quickstart.md)

## Findings — Session 2026-08-25 (closure)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| X1 ✅ | Inconsistency | HIGH | `packages/loop-contract/src/adjudication.ts` | **Closed.** Refusal is now two orthogonal typed concepts: `refusalStage` selects the `EPIC-037` event, `refusalReasonCode` says why. `REFUSAL_STAGE_OF` derives the stage from the code so the two cannot disagree, `REFUSAL_EVENT_OF` is total over the three stages and maps to three distinct events, and the same vocabulary is enforced by CHECK constraints in PostgreSQL. Prose is never parsed | Verified by `refusal-mapping.spec.ts` (totality, determinism, distinctness, correct stage per reason) and `adjudication-persistence.spec.ts` |
| X6 ✅ | Coverage Gap | HIGH | `backend/src/modules/loop/`, `loop.module.ts` | **Closed.** All seven ports have production adapters, `ProposalAdjudicatorService` is registered in the Nest graph, and only `PROPOSAL_ADJUDICATOR` is exported so no consumer can assemble an adjudicator with its own gate provider | Verified by `adjudication-composition.spec.ts`, which boots the real `AppModule` with no overrides, resolves every port, and **observes** EPIC-024 refusing an ungranted proposal and EPIC-009 being reached once a grant exists |
| X7 | Coverage Gap | HIGH | `backend/src/modules/reviews/` (EPIC-021) | **EPIC-021 supplies no gate-outcome service.** No Nest module, imported by nothing, only `InMemoryGateOutcomeStore`, no per-specification query, and nothing writes `gate_outcomes`. The adapter refuses (`gate_outcomes_unavailable`) rather than assuming gates pass — so **no proposal can reach `applied` in production** | EPIC-021 must ship a gate-outcome read service. **Not fillable here**: reproducing EPIC-021's policy inside EPIC-030 is what the authorisation forbids. Owner decision required |
| X8 | Underspecification | MEDIUM | `backend/src/modules/specifications/lifecycle-api.service.ts` (EPIC-009) | **EPIC-009 does not surface the transition it records.** `transition()` returns the specification, `TRANSITION_RECORDER` is bound to `InMemoryTransitionRecorder`, and no read surface exists — so `appliedTransitionId` cannot be bound to an authoritative row. The adapter reports a null identity, which resolves to `application_transition_unidentified` rather than forwarding the specification id | EPIC-009 should return the `TransitionRecord` (or expose a read). Only reachable once `X7` is closed, hence MEDIUM |
| X2 | Constitution Alignment | MEDIUM | Constitution V | **Still open.** Failing-first was not observed per pair in C2A, and the closure tasks were written the same way | Unchanged from the C2A session |
| X3 | Underspecification | LOW | `SpecificationStatus` | **Still open.** Bare `string` alias | Unchanged |
| X4 | Coverage Gap | LOW | `spec.md` FR-GEL-063 | **Still accepted.** No transport surface, by the C2A boundary; in-process module reachability is what EPIC-037 consumes | Unchanged |

## Metrics

- Findings this session: **7** — 0 CRITICAL · **1 HIGH open** (`X7`) · 2 HIGH **closed** · 2 MEDIUM · 2 LOW
- Tasks added: **7** (`T1096`–`T1102`), each paired with the test that proves it
- New production adapters: **7** · new Nest providers: **8** · new tables: **1**

## Notes

**Why EPIC-030 does not return to `Ready` on this session.** Both findings the owner named are
demonstrably closed, and the register is regenerated from source rather than relabelled. But `X7`
is a new HIGH: the capability is wired, reachable and governed, and it cannot complete an
application because EPIC-021 supplies nothing to read. An Epic that reported `Ready` while no
proposal in it can reach `applied` would be making the claim `DOR-09` exists to prevent.

`X7` and `X8` are gaps in **other Epics**, surfaced by wiring against them for the first time —
which is the same way `EPIC-037` surfaced the absence of adjudication itself.

## Evidence — the immutability trigger count

Recorded because the figure was **misreported as 17** during Step C2A and the wrong number reached
a code comment and EPIC-037's `analysis.md`. The count is the number of `CREATE TRIGGER` statements
bound to `reject_mutation()`; the function alone protects nothing.

```bash
for d in $(ls backend/prisma/migrations | grep -E '^[0-9]' | sort); do
  n=$(grep -c "EXECUTE FUNCTION reject_mutation()" "backend/prisma/migrations/$d/migration.sql")
  [ "$n" != "0" ] && printf "%-52s %s\n" "$d" "$n"
done
```

| Migration | Triggers |
|---|---|
| `20260814000000_init` | 1 |
| `20260820000200_epic007_requirements` | 1 |
| `20260820130000_epic009_lifecycle_findings_adr_links` | 2 |
| `20260820180000_epic019_steering` | 1 |
| `20260821000000_epic023_runs_review` | 3 |
| `20260821010000_epic024_access_control` | 2 |
| `20260821020000_epic025_storage_publishing` | 2 |
| `20260823000000_epic030_governed_engineering_loop` | 1 |
| `20260823010000_epic033_requirement_room` | 1 |
| **Subtotal — before C2A** | **14** |
| `20260825000000_epic030_adjudication` (`adjudication_records`) | 1 → **15** |
| `20260825120000_epic030_adjudication_refusal` (`application_intents`) | 1 → **16** |

Confirmed independently against a live database built from those migrations, which is the check
that would catch a migration file that declares a trigger the database never received:

```bash
docker exec pmi-postgres psql -U pmi -d pmi_studio -tAc "SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid WHERE p.proname = 'reject_mutation' AND NOT t.tgisinternal;"
```

Observed: **16**. Authoritative: **14 before C2A · 15 after C2A · 16 after C2A closure.**

**`EPIC-037` still carries the stale figure.** Its `analysis.md` says the function is *"bound by 17
triggers elsewhere"*. That file is closed and owner-approved, and was deliberately **not** edited
during this step — the correction is listed as a required targeted change before Band A resumes.

---

# Analysis: EPIC-030 — C2B definition and ownership check (`X7`, `X8`)

**Session**: 2026-08-26 · **Scope**: the ownership of gate evaluation and lifecycle-transition
identity, per the Step C2B definition check. Read: EPIC-009 and EPIC-021 `spec.md`, `tasks.md`,
`closure.md`; EPIC-014 `spec.md`, `tasks.md`; `specs/_shared/platform-spec.md`; and the
implementations under `backend/src/modules/{specifications,reviews}`.

## The eight questions

| # | Question | Answer | Approved source |
|---|---|---|---|
| 1 | Who defines which gates apply? | **EPIC-021.** `GateConfigService.configure()` writes a `ReviewGate {workspaceId, transition:"from->to", requiredRoles, blocking}`. `GateStore.findForTransition(workspaceId, transition)` is the lookup EPIC-030 needs | `FR-ENH-012`; gate transitions **derived** from EPIC-009's `PERMITTED_TRANSITIONS`, never copied |
| 2 | Who evaluates them? | **EPIC-021.** `GateExecutionService.execute()` runs each required role through EPIC-003's engine contract; `gate-arbitration.ts` + `GateDecisionService.decide()` record the mandatory human decision | `FR-ENH-013`, `FR-ENH-014`, `FR-ENH-016` |
| 3 | When? | At a gated lifecycle transition — a gate binds to one `from->to` pair | `FR-ENH-012` |
| 4 | Where is the outcome persisted? | `GateOutcome` → `gate_outcomes`. **Not append-only**: `humanDecision`, `decidedById`, `decidedAt` are filled later by `fillDecision`, so the table is deliberately two-phase mutable | `FR-ENH-015` |
| 5 | How is it bound? | To `workspaceId`, `specificationId` and `gateId` (hence the transition). **Not** to a version or baseline | — |
| 6 | Who owns transition history? | **EPIC-009.** `TransitionRecord`, the `TransitionRecorder` port, and `lifecycle_transitions` — which *is* append-only, trigger attached | `FR-014` |
| 7 | Durable transition record that can be exposed? | **Structurally yes, operationally no.** `LifecycleMachine.transition()` creates and returns a `TransitionRecord` with an id; `SpecificationLifecycleService.transition()` **discards it** and returns the specification. `TRANSITION_RECORDER` is bound to `InMemoryTransitionRecorder` | — |
| 8 | Do state and evidence share one transaction? | **No.** State lives in `InMemorySpecificationStore`; evidence in `InMemoryTransitionRecorder`. Neither is Prisma-backed, so no shared transaction exists to join | — |

## Findings — Session 2026-08-26 (C2B)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| X9 ✅ | Inconsistency | HIGH | `packages/loop-contract/src/adjudication.ts`; `adjudicator.service.ts` | **Closed by `T1103`.** C2A closure reported gate unavailability as `refused` / `validation-failed`, which asserts that a gate examined the proposal and turned it down. `GateOutcomePort` now returns a typed `GateDisposition`; only `failed` refuses; `unavailable`, `stale` and `pending` route to `reconciliation_required` with structured causes. `FR-ENH-016` — the gate **ran** and a role could not answer — correctly remains `gate_failed` | Verified by the disposition matrix in `adjudication-adapters.spec.ts` and by database constraints in `adjudication-persistence.spec.ts` |
| X10 | Ownership | HIGH | `specs/021-review-gates-roles/closure.md`; `specs/009-spec-lifecycle-versioning/closure.md`; `specs/014-devops-release/tasks.md` | **Blocked — the remediation for `X7` and `X8` is deferred to an owner with no task for it.** EPIC-021's closure defers *"gate endpoints + wiring gates into the lifecycle transition path"* to **EPIC-014 F-11.2**; EPIC-009's closure defers *"the platform-wide composition root (Prisma-backed stores + recorder), the same deferral every closed epic carries"* to the same place. **EPIC-014 F-11.2 (`T151`–`T156`) contains no such task** — it *confirms* closure records and runs reviews, quickstarts and promotion. `specs/_shared/platform-spec.md`'s platform-wide criteria list contains no persistence-composition item either | An owner must be assigned. Building it inside EPIC-030, EPIC-009 or EPIC-021 during C2B would reassign ownership away from a recorded, approved deferral — Step C2B stop condition 5 |
| X11 | Underspecification | MEDIUM | EPIC-021 `GateOutcome` model | Two things Step C2B requires of a gate outcome are **absent from EPIC-021's approved model**: binding to a **target version or baseline**, and any notion of **staleness**. Adding either is new product policy for EPIC-021, not an EPIC-030 adapter concern | Requires an EPIC-021 specification change — Step C2B stop condition 2 |

## Why this stops

`X9` was self-contained in EPIC-030 and is closed. The rest is not blocked on effort; it is blocked
on **who owns the work**:

- Atomic transition recording (question 8) requires both the specification store *and* the
  transition recorder to be Prisma-backed and joined in one transaction. That is the
  composition-root swap — Step C2B stop condition 4, *"architectural reassignment"*.
- A durable `transitionId` cannot come from `InMemoryTransitionRecorder`, which the authorisation
  explicitly forbids as a source.
- EPIC-021 has **services but no producer**: nothing composes them, nothing writes `ReviewGate` or
  `GateOutcome`, and they are exercised only by unit tests. The authorisation is explicit that *"a
  database table and read service that nobody writes to do not close X7."*

What *can* be done without that decision was done. What cannot has been reported rather than
half-built.
