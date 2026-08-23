# Cross-Artifact Analysis: EPIC-034 Change Room

**Session**: 2026-08-22

**Artifacts analysed**: [spec.md](./spec.md) (41 FR, 10 SC, 6 user stories, 13 exit criteria),
[plan.md](./plan.md), [tasks.md](./tasks.md) (98 tasks, 10 phases), with
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/change-contract.md](./contracts/change-contract.md) and
[quickstart.md](./quickstart.md) read for corroboration.

**Command**: `/speckit-analyze` — read-only apart from this record (`FR-ESK-019`).

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C2 | Constitution Alignment | CRITICAL | tasks.md:127 (`T406v`); plan.md:74 (Gate V) | `T406v` authors `packages/loop-contract/workflows/change-room.json` and cites `(conformance: T406l)`. `T406l` is this Epic's **independence architecture test** — it asserts no region vocabulary, no second traversal, no `TaskRegenerationService` import, no requirement text, no Defect Room vocabulary. It checks **nothing** about the workflow file. Constitution V requires an executable conformance check for a non-code output, and plan Gate V records **PASS** on the basis of `EPIC-030`'s configuration check. As written, the Epic's only non-code output has no check that checks it, and Gate V's PASS is not demonstrated by any task | Change the citation to `(conformance: T931)` — `EPIC-030`'s `T931` is the failing-first executable conformance check for loop configuration, and its `T932` already reads *every* file in `packages/loop-contract/workflows/`, so no new check is needed. Note the cross-Epic dependency explicitly: until `epic/030` merges, `T406v` cannot be discharged |
| C1 | Coverage Gap | HIGH | spec.md:403 (exit criterion 4); tasks.md:252-255 (Phase N) | Epic Exit Criteria name **three** mutation tests as conditions of completion: `FR-CHR-011` (→ `T995a` ✓), `FR-CHR-032` (→ `T995b` ✓), and **`FR-CHR-054` — which has no task**. Phase N's four mutation proofs are `FR-CHR-011`, `FR-CHR-032`, `FR-CHR-062` and XI Tier 1. The missing one is the one the spec singles out: *"This is the one that would ship an approval referring to a baseline no longer in force"*. `FR-CHR-054` has behavioural coverage (`T994h` test, `T994i` implementation), so this is not zero coverage of the requirement — it is **zero coverage of a mandatory exit gate**, and `/speckit-converge` would report it as unbuilt | Add a fifth Phase N mutation proof: make `rebase.service.ts` silently retarget a change onto the newer baseline instead of recording the rebase, revert, and require `T994h` to fail while the mutation stands. Record the observation against `SC-CHR-009` |
| A1 | Ambiguity | HIGH | spec.md:321 (`FR-CHR-040`), 328 (`FR-CHR-050`), 374 (`SC-CHR-003`); tasks.md:172 (`T996r`) | **"Material change" gates two MUST requirements and one success criterion and is defined nowhere** — not in spec.md, plan.md, research.md, data-model.md, the contract or quickstart.md. The data model has **no materiality field**, so a materiality gate is not representable; `PolicyProvider` refuses to lower the band and `decidedBy` must be human for *every* decision. The design therefore behaves as though **all** changes are material — and `T996r` tests two-or-more options unconditionally, resolving the ambiguity by implication without recording the resolution. The two readings build different products: under one, a one-line correction to a baselined requirement requires two options with six trade-off dimensions each; under the other, something undefined decides when it does not | State the resolution where the requirement lives. Recommended: `FR-CHR-040` and `FR-CHR-050` apply to **every** change through this Room, because `FR-CHR-011` already makes this the only path an approved baseline changes and `FR-CHR-051` already fixes the band — so "material" is redundant rather than undefined. If instead a threshold is intended, it needs a field in `ChangeRequest` and a rule, and neither exists |
| I1 | Inconsistency | MEDIUM | plan.md:139-148; tasks.md (test inventory) | The plan's Project Structure lists **4** integration test files and **1** architecture test file. tasks.md names **7** and **2** — adding `change-room-constraints`, `change-room-high-band`, `change-room-type-isolation` and `change-room-transcript`. All four are justified by tasks the plan itself implies (database constraints, the high-band fence, `SC-CHR-010`, XI Tier 2), but the plan's structure block reads as exhaustive and is now wrong by four files | Treat the plan's block as the drift, not the tasks. `/speckit-implement` reads tasks.md, so nothing is blocked; the plan should gain the four files at its next revision so a reader comparing the two does not conclude the task list invented tests |
| U1 | Underspecification | MEDIUM | tasks.md:244 (`T994z`) | `T994z` writes a test but is phrased as an implementation task — *"Implement the workflow-type isolation integration test"* — cites `(integration test: T406u)`, which is the **reachability** test and has nothing to do with type isolation, and omits the *"Write the failing…"* form every other one of the 34 test tasks uses. Consequence: pairing detectors classify it as implementation and pass it on a citation that proves nothing, and Constitution V's write-it-failing-first discipline is not stated for the one test that proves `SC-CHR-010` | Rewrite in the standard form — *"Write the failing integration test for workflow-type isolation in `backend/tests/integration/change-room-type-isolation.spec.ts`"* — and drop the `T406u` citation; a test-authoring task has no test partner to cite |
| L1 | Inconsistency | LOW | spec.md:401-403; tasks.md:254 (`T995c`) | The spec's exit criteria list three mutation proofs; the task list carries four, the extra being `T995c` for `FR-CHR-062` (the `TaskRegenerationService` import ban). The asymmetry runs in the safe direction — the task list is stricter than the gate — but it means the gate does not require the proof the plan calls the trap this Epic exists to avoid | When C1 is fixed, promote `T995c`'s subject to a fourth exit criterion so the gate and the task list agree, and so a later reader cannot satisfy the gate while dropping the ban's proof |

**Overflow**: none. Six findings, all listed.

## Coverage Summary

| Requirement group | Count | Has task? | Notes |
|---|---|---|---|
| `FR-CHR-001`–`002` Room identity and boundary | 2 | ✅ | `T406l`, `T406v`, `T994z` |
| `FR-CHR-010`–`013`, `020`–`023` Intake and clarification | 8 | ✅ | Phase 3 (`T996a`–`i`), `T994h` |
| `FR-CHR-030`–`035` Impact | 6 | ✅ | `T406f`–`g`, `T406n`–`o`, Phase 4 |
| `FR-CHR-040`–`043` Trade-offs | 4 | ✅ | `T406h`–`i`, Phase 5 — but see `A1` on the trigger condition |
| `FR-CHR-050`–`054` Decision | 5 | ✅ | Phase 6 (`T994a`–`d`, `T994h`–`i`), `T406s`/`T406t` |
| `FR-CHR-060`–`065` Re-baseline and re-plan | 6 | ✅ | `T406j`–`k`, Phase 6–7 |
| `FR-CHR-070`–`073` Evidence and closure | 4 | ✅ | `T994o`–`q` |
| `FR-CHR-080`–`085` Room pattern | 6 | ✅ | Phase 8 (`T994r`–`w`) |
| `SC-CHR-001`–`010` | 10 | ✅ | Every one cited on a task line |

**Requirement coverage: 51/51 (100%).** Every `FR-CHR-` and `SC-CHR-` identifier appears on an
actual task line, not merely in prose — checked against task lines only, because a requirement cited
in a header is not a requirement anybody builds.

**Exit-criteria coverage: 12/13.** Criterion 4 (`FR-CHR-054` mutation proof) is the exception — `C1`.

**HTTP surface: 9/9.** `T996i`, `T996q`, `T996x`, `T994g`, `T994q` (four routes), `T994y`.

**Quickstart: 14/14** scenarios named in full in `T995k`.

## Constitution Alignment Issues

- **Constitution V (non-code outputs)** — `C2`. The Epic's single non-code output cites a check that
  does not check it. This is the only constitution finding.
- **Constitution XI** — satisfied in both tiers. Tier 1: `T406u` imports the real `AppModule`, and
  `T995d` mutation-proves it. Tier 2: `T995o` requires a run-generated transcript and `T995p` a
  conformance check asserting it was generated rather than authored.
- **Constitution IX** — `T995r`, `T995s`, `T995t` restate the three unowned capabilities
  (`BR-0154`/`U-12`, `BR-0073`/`U-17`, `BR-0083`/`U-17`); `T995z` publishes the report and addresses
  the stale Delivery Board.
- **Concurrent-session gate reads FAIL** in plan.md, so `DOR-06` will not clear until `T406a`
  creates the worktree. This is the same posture as `EPIC-031`, `EPIC-032` and `EPIC-033` and is
  **not** reported as a finding — it is a recorded, justified deviation with a named discharge.

## Unmapped Tasks

**None.** All 98 tasks map to a requirement, a success criterion, an exit criterion, a constitution
principle, or a named cross-Epic handover.

## Metrics

| Metric | Value |
|---|---|
| Total requirements (FR + SC) | 51 |
| Total tasks | 98 |
| Requirement coverage | 100% |
| Exit-criteria coverage | 12/13 |
| Ambiguity count | 1 |
| Duplication count | 0 |
| Critical issues | 1 |
| High issues | 2 |

## Notes

**The count error did not recur.** `EPIC-030` stated a wrong figure in its plan, `EPIC-031`
reproduced it, and `EPIC-033` reproduced it inside a paragraph claiming the figures were counted.
Every figure in this plan was re-derived from the artifacts during this analysis — 41 FR across eight
groups, 10 SC, 6 user stories, 6 tables (8 numbered sections less 2 embedded), 9 routes, 6 ports, 0
new packages — and **all seven match**.

**Two findings are about a citation pointing at the wrong thing** (`C2`, `U1`), and both passed the
pre-commit verification because that verification checked whether a citation *exists*, not whether
what it names can *fail for the stated reason*. That is the same class of gap this Epic's own
`T995a`–`T995d` exist to close, one level up: a mutation proof asks whether the check would notice.
The pairing detector does not. Worth carrying into `EPIC-035`'s task list rather than rediscovering.
