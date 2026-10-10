# EPIC-048 Governed Learning — cross-artifact analysis

**Date**: 2026-10-09 · **Command**: `/speckit-analyze` · **Artifacts**: `spec.md`, `plan.md`, `tasks.md`
(and `research.md`, `data-model.md`, `contracts/`) · **Non-destructive**: no artifact was changed by
this analysis.

## Metrics

| Measure | Value |
|---|---|
| Functional requirements | 62 |
| Success criteria | 9 |
| Tasks | 120 (`T2300`–`T2419`), 25 blocked on unmerged Epics |
| FR coverage | 62 / 62 (100%) |
| SC coverage | 8 full, 1 partial (`SC-LRN-007`) |
| Edge cases | 10 — 1 uncovered, 1 partial |
| Findings | CRITICAL 0 · HIGH 2 · MEDIUM 6 · LOW 6 |
| Constitution MUST violations | none |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
|---|---|---|---|---|---|
| I1 | Inconsistency | HIGH | `R-048-6`; data-model §4; `T2350`, `T2360` | A candidate whose approval the approver guard rejects is stranded in `pending-review`: its `EPIC-031` decision is already resolved, so no Inbox item exists, expiry cannot close it and it never terminates. `RK-5` has the same shape | Return it to `proposed` with the flag and have `learning.request-pending` request a new decision; amend `R-048-6`, data-model §4 and `T2350`/`T2358` |
| C1 | Coverage | HIGH | Spec edge case *knowledge contradicts an approved spec or steering rule* | No detection and no reviewer surfacing | Add a test/implementation pair in Phase 5, or record an explicit deferral with a defect and owner (semantic detection needs embeddings) |
| U1 | Underspecification | MEDIUM | US6, `FR-LRN-006`, `FR-LRN-033`; API contract | No named permission to read candidates, browse knowledge, submit as a human or submit a deprecation — any workspace member can today | State the rule; add route-test assertions to `T2334` and `T2370` |
| I2 | Inconsistency | MEDIUM | `FR-LRN-062` vs `R-048-3` | `FR-LRN-062` requires reuse-policy changes in the immutable audit; policy lives in steering and no task verifies that a steering edit is audited | Verify `SteeringService.edit` audits, else add a task or narrow `FR-LRN-062` |
| I3 | Inconsistency | MEDIUM | Spec Dependencies vs plan and tasks | The spec omits `A-031-1`, `A-031-2` and `A-038-1` | Back-fill the spec's dependencies |
| I4 | Inconsistency | MEDIUM | Spec Exit Criteria vs `R-048-10`, `T2414` | The spec still offers deferring `FR-LRN-055`/`056`; the plan says the clause is not used | Strike the deferral clause |
| A1 | Ambiguity | MEDIUM | `FR-LRN-045` vs `R-048-11` | Whether `boundary` with detail `scope:` satisfies "names scope" | Reword `FR-LRN-045`, or ask `EPIC-038` for a `scope` reason code |
| C2 | Coverage | MEDIUM | `SC-LRN-007` | The under-two-minutes decision time is never measured | Have the `T2415` Playwright run time a five-evidence decision and assert < 2 min |
| C3 | Coverage | LOW | Edge case *source execution marked invalid* | Open candidates from an invalid source are not flagged — only approved entries are | Extend `T2368` |
| C4 | Coverage | LOW | `R-048-22` vs `T2408` | Two performance targets unmeasured: Inbox-to-knowledge ≤ 60 s and reindex ≤ 5 s | Add to `T2408` or drop the targets |
| V1 | Constitution V | LOW | `T2383` | Produces no code and drafts `closure.md` early | Fold into `T2382`; move the back-fill text to `T2419` |
| V2 | Constitution V | LOW | `T2418`, `T2419` | No conformance check for the SRS owner annotations or the `ADR-0021` status | Add an assertion to `T2410` |
| I5 | Inconsistency | LOW | data-model §4 vs plan migration 2.4 | data-model omits the "approved requires a version in the same transaction" guard | Add it to data-model §4 |
| R1 | Sequencing | LOW | `T2325` | Event-count conflict with `EPIC-047` (29 → 30 here, 31 after its merge) will surface on rebase | Rebase immediately after `EPIC-047` merges |

## Coverage

| Requirement group | Tasks | Notes |
|---|---|---|
| `FR-LRN-001`…`008` | `T2305`–`T2308`, `T2313`–`T2317`, `T2326`–`T2335` | Covered |
| `FR-LRN-010`…`018` | `T2307`, `T2320`–`T2321`, `T2328`–`T2329`, `T2336`–`T2345` | Covered; U1 |
| `FR-LRN-020`…`030` | `T2346`–`T2363`, `T2390`–`T2391` | Covered; I1. Reject, expire and withdraw wait on `A-031-1` |
| `FR-LRN-031`…`039` | `T2352`–`T2353`, `T2364`–`T2371`, `T2392`–`T2393` | Covered; C3 |
| `FR-LRN-040`…`047` | `T2322`–`T2323`, `T2372`–`T2377`, `T2392`–`T2393` | Covered; I2, A1 |
| `FR-LRN-050`…`056` | `T2333`, `T2338`–`T2339`, `T2376`–`T2377`, `T2396`–`T2401` | Covered |
| `FR-LRN-060`…`063` | `T2324`–`T2327`, `T2330`–`T2331`, `T2352` | Covered; I2 |
| `FR-LRN-070`…`075` | `T2378`–`T2387`, `T2415` | Covered |

`SC-LRN-001`…`009` are all mapped; `SC-LRN-007` is partial (C2). No task is unmapped.

## Constitution alignment

V has two LOW gaps (V1, V2). XI Tier 1 and Tier 2 are both planned. Under XII rule 6, I1 is a
liveness defect, not a safety one: a refused AI approval still writes no knowledge.

## Recommended next

Resolve I1 and C1 in `tasks.md`, `research.md` and `data-model.md`, then `/speckit-implement` Phases
1–3 (`T2300`–`T2335`), which neither finding affects.

## Remediation (2026-10-09, before `/speckit-implement`)

| ID | Disposition | Where |
|---|---|---|
| I1 | **Resolved.** A refused resolution returns the candidate to `proposed` with the reason and a flag; `learning.request-pending` requests a new decision, at most three attempts in all, which also bounds the `RK-5` loop | `research.md` `R-048-6`, `R-048-12`, `R-048-14`; data-model §4; `T2350`, `T2358` |
| C1 | **Deferred with a defect.** No cheap structural check is honest (both candidates considered are recorded); semantic detection waits on `EPIC-039`'s `Embed` | `defects/DEF-048-001-…`; `T2420`–`T2421` (blocked); spec Edge Case note; `R-048-15` |
| U1 | **Resolved.** The permission rule is stated; route tests assert `401`/`404` | spec Assumption 11; `contracts/learning-api.md`; `T2334`, `T2370` |
| I2 | **Resolved by narrowing.** `SteeringService.edit` writes no audit row (verified); `FR-LRN-062`'s policy clause is met by `EPIC-019`'s version history; follow-up raised to `EPIC-019` | spec `FR-LRN-062`; `R-048-3`; `learning-contract.md` follow-ups |
| I3 | **Resolved.** Spec Dependencies list `A-031-1`, `A-031-2`, `A-038-1`, `A-047-1/2` | spec *Dependencies* |
| I4 | **Resolved.** Exit-criteria deferral clause struck | spec *Epic Exit Criteria* |
| A1 | **Resolved.** `FR-LRN-045` reworded: scope refusals are `boundary` with `scope:` detail | spec `FR-LRN-045` |
| C2 | **Resolved in the task** (still blocked): `T2415` times a five-evidence decision | `T2415` |
| C3 | **Resolved.** `T2368` flags open candidates from an invalid source | `T2368` |
| C4 | **Resolved.** `T2408` measures the sweep half of the 60 s target and reindex-attempt latency | `T2408` |
| V1 | **Resolved.** `T2383` folded into `T2382`; back-fill text moved to `T2419` | `T2382`, `T2383`, `T2419` |
| V2 | **Resolved.** `T2410` asserts the owner annotations and `ADR-0021` once `closure.md` exists, skipped before | `T2410` |
| I5 | **Resolved.** data-model §4 states the `learning_transitions_guard` version-in-transaction rule | data-model §4 |
| R1 | **Open, by nature.** A rebase after `EPIC-047` merges resolves the event count to 31 | `T2325` |
