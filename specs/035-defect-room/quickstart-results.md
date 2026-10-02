# EPIC-035 — Quickstart results

**Task**: `T999q` · **Run**: 2026-08-31 · **Constitution IX**

Each [quickstart.md](./quickstart.md) scenario run **individually**, not as one sweep, because a
combined run reports a single number and a single number cannot say which scenario it was that
passed. The command and the count are recorded per scenario so the claim is checkable rather
than asserted.

Counts are what `vitest` reported for that scenario's files at the moment of the run. Where a
scenario is demonstrated by more than one file — a service refusal and the database constraint
that refuses the same thing independently — both are listed, because the scenario is the
conjunction and not either half.

---

## Scenarios 1–17 — run

| # | Scenario | Demonstrated by | Result |
|---|---|---|---|
| 1 | A defect is judged against approved behaviour, not an opinion | `defect-room-triage.spec.ts` | **15 passed** |
| 2 | No approved behaviour at all is a Requirement Gap | `defect-room-outcomes.spec.ts` | **11 passed** |
| 3 | No fix is accepted without a failing test | `defect-room-defect-test.spec.ts` + `defect-room-test-first.spec.ts` | **26 passed** |
| 4 | A defect that cannot be automated says so, and why | `defect-room-not-automatable.spec.ts` | **15 passed** |
| 5 | A passing reproduction test goes to an evidence check | `defect-room-evidence-check.spec.ts` | **18 passed** |
| 6 | One passing run neither closes nor reclassifies | `defect-room-intermittency.spec.ts` | **11 passed** |
| 7 | Regression scope is not bounded by the defect's Epic | `defect-room-regression-scope.spec.ts` | **10 passed** |
| 8 | A declaration of completion is not evidence | `defect-room-verification.spec.ts` | **22 passed** |
| 9 | A transfer to the Change Room states why | `defect-room-transfer-offer.spec.ts` | **16 passed** |
| 10 | A declined transfer, and one the Change Room refuses | `defect-room-transfer-outcomes.spec.ts` + `defect-room-transfer.spec.ts` | **30 passed** |
| 11 | A Requirement Gap reaches the Requirement Room | `defect-room-gap-routing.spec.ts` | **9 passed** |
| 12 | Repair work is `EPIC-012` tasks, and not before classification | `defect-room-repair.spec.ts` + `defect-room-task-provenance.spec.ts` | **23 passed** |
| 13 | A reclassified defect keeps its record, and its tasks | `defect-room-repair-orphaning.spec.ts` + `defect-room-reclassification.spec.ts` | **20 passed** |
| 14 | Defects arrive from six origins and always link | `defect-room-intake.spec.ts` + `defect-room-held-for-triage.spec.ts` | **34 passed** |
| 15 | Escape analytics aggregate, and say what they cannot see | `defect-room-analytics.spec.ts` + `defect-room-origin-completeness.spec.ts` | **34 passed** |
| 16 | The Room cannot diverge from its siblings | `defect-room-type-isolation.spec.ts` + `defect-room-boundaries.spec.ts` + `DefectRoom.spec.tsx` | **47 passed** |
| 17 | Constitution XI Tier 1: the Room is wired | `defect-room-reachability.spec.ts` + `defect-room-triage-route.spec.ts` | **59 passed** |

**Total across the seventeen: 400 passed, 0 failed.**

---

## Scenario 18 — **NOT RUN**

**Constitution XI Tier 2: the journey, keyboard-only, against a running application.**

Not run, and **nothing has been written in its place.**

The scenario requires one defect carried through *report → triage → reproduce → failing test →
repair tasks → verify → close* against `pnpm start`, **using only a keyboard, with focus visible
at every step**, and a **run-generated transcript** committed as evidence. Quickstart states the
rule in its own words: *"Hand-written evidence is a constitution violation of the first order."*

Two separate things make this a person's task rather than an agent's:

1. **Only a person can do it.** Keyboard-only navigation with visible focus is a claim about what
   a human operating a browser experiences. Producing the transcript by driving the services
   directly would generate a file matching the conformance check while demonstrating none of what
   the scenario is about.

2. **The journey cannot complete in this deployment.** Steps 5–7 — repair tasks, verify, close —
   all refuse by design: `RepairTaskPort` and `TestExecution` are unbound
   (`T999h`'s deviations, `R-035-1`). A transcript of the full seven steps cannot presently be
   generated *by anyone*, and one that showed seven successful steps would be evidence of
   something that did not happen.

This is the same class as `T884`'s accessibility record and `EPIC-033`'s `T1210` keyboard walk,
and it is recorded here as **outstanding** rather than as a gap somebody filled in.

`SC-DFR-009` (`BR-0193`, `EPIC-029`) is exercised **inside** this run per `R-035-10`, so it is
outstanding with it.

---

## What this record does not claim

The seventeen scenarios above demonstrate the Room's **rules**. They do not demonstrate the Room
**working end to end for a person**, because in this deployment it largely cannot: four ports are
unbound and the paths behind them refuse. Every refusal is tested, named and traceable to the Epic
that owes the binding — but a refusal that is correct is still a refusal, and the closing report
says so rather than reporting seventeen green scenarios as a working Room.
