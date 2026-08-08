# Implementation Plan: Unattended Runs & Team Review

**Epic**: `EPIC-023` | **Module**: M-06 Workflow & Tasks | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Tasks**: 43 · [tasks.md](./tasks.md) | **Posture**: ⏸ **HELD** (decision D-10)

**Parent design** — not duplicated here: [`../002-team-review-access-storage/`](../002-team-review-access-storage/)
([plan](../002-team-review-access-storage/plan.md) ·
[research](../002-team-review-access-storage/research.md) ·
[data-model](../002-team-review-access-storage/data-model.md) ·
[contracts](../002-team-review-access-storage/contracts/) ·
[quickstart](../002-team-review-access-storage/quickstart.md))

**Shared design**: [`../_shared/`](../_shared/)

**Created by ruling D-19** (2026-08-07), which split EPIC-002 into three delivery epics along the
seam its own build order already described: the run/review chain, access control, and storage were
independent of each other, and of everything else.

## Summary

A run that never pauses: it records every question it would have asked along with its own suggested
answer, marks everything derived from a guess as *provisional*, and hands the team one collective
decision session. Then a re-run applies the team's answers and clears the markings.

The largest of the three children, and the one carrying the family's organising idea — **an
unattended run never decides**. It defers, marks, and carries on. That is what makes this the
programme's strongest expression of **PP-003 Human-in-the-Loop** and **PP-016 Explainable AI**.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-02.1 Unattended run mode | 11 | Run modes, stop-point range, question deferral, provisional marking, runs API |
| F-02.2 Provisional approval override | 4 | Warn-and-override approval; attributed override records |
| F-02.3 Team review and answer submission | 15 | Sessions, draft answers, conflicts, atomic submission, authority, review API |
| F-02.4 Re-run with submitted answers | 6 | Answer application, marking clearance, new-session rule, stale warnings |
| F-023.UI Interface | 2 | Review session page |
| F-023.Z Epic closure | 5 | Per-epic gate **including the SRS back-fill approval gate** (`T404`) |

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md) and the
[parent plan](../002-team-review-access-storage/plan.md). The research decisions that bear on this
epic:

**A run is not a generation job** (**R-002-1**). `GenerationJob` is one engine invocation; a `Run`
spans many across a user-selected range, survives questions, and carries an access snapshot. Merging
them would corrupt `job_state`, because "reached the selected stop point" is a legitimate run outcome
and a meaningless job outcome.

**A provisional marking is a link, not a flag** (**R-002-5**). It joins an artifact to the *specific*
question governing it, which is what lets markings clear selectively when one question is answered.
A boolean clears everything or nothing.

**Conflicts are surfaced, not resolved** (**R-002-6**). Two people answering differently is a
disagreement a human must settle, so both answers survive and submission is blocked. Last-write-wins
would silently discard a colleague's judgement.

**The access snapshot is read from, never re-queried** (**R-002-4**). A long unattended run cannot
half-apply a mid-flight permission change. Note the snapshot is *produced* by EPIC-024's grants — a
real cross-epic dependency.

**NEEDS CLARIFICATION**: none. The parent's five-question session of 2026-08-02 resolved every marker.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | ⚠️ **PASS WITH DEBT** — unattended runs (`FR-001`–`FR-020`) have **no SRS source**. `T404` gates **approval**, not merely closure |
| III | Epic → Feature → Task decomposition | PASS — 5 functions, 43 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS — `F-023.Z` in [tasks.md](./tasks.md) |
| V | Every implementation task carries a unit test, written to fail first — or, for document/configuration outputs, an executable conformance check | PASS — 0 gaps after the 2026-08-05 remediation |
| VI | `specs/023-unattended-runs-review/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS — via EPIC-014 F-11.2 |
| VIII | Session labelled with the working Epic, or the first command | PASS — session labelled `speckit-constitution` (its first command); stated in the closing report |
| IX | Run closes with a Work Completed + Recommended Next Task report | PASS |
| — | Repository synced from GitHub before work | PASS — 0 behind upstream, 2026-08-08 |
| — | No other Claude session on this checkout | ⚠️ **Cannot assert** — this epic was itself authored outside this session on 2026-08-07 |
| — | Principle register present, deferrals argued (D-6) | PASS — deltas in [spec.md](./spec.md); parent register in [EPIC-002](../002-team-review-access-storage/spec.md) |
| — | **C-01 identifier collision** | ⚠️ **Unresolved and now wider** — see G-02F.1 |

**Any FAIL blocks Phase 0.** No FAIL. Gate II carries the family's largest Constitution II debt, gated by `T404`.

**Post-design re-check**: PASS. No new design was produced — this epic implements the parent's.

## Review of the existing task list

### G-023.1 · Still the largest child, and still splittable ⚠️ open, low urgency

43 tasks across five functions. `F-02.1` (unattended runs) and `F-02.3` (team review) are coupled —
review exists because runs defer questions — so this is a weaker split case than EPIC-002 was. But it
is twice the size of its siblings, and `F-02.4` (re-run) depends on both. Recorded so the size is a
decision rather than an accident.

### G-023.2 · The access snapshot depends on an epic that may land later ⚠️ open

`T381` builds run-time access snapshotting, but grants themselves are **EPIC-024's** `F-02.5`. If
this epic is built first, `T381` has nothing to snapshot. The dependency is real and one-directional:
**EPIC-024 should land before this epic's `F-02.1` completes**.

**Otherwise clean.** The runs API (`T415`–`T417`) and review controller unit test (`T364a`) were
added on 2026-08-05 and migrated here intact; every implementation task pairs with a test.

### G-02F.1 · The identifier collision extends to success criteria ⚠️ new finding, family-wide

**C-01** was recorded as a *requirement* collision: EPIC-002's `FR-001`–`FR-040` clash with the
platform's `FR-001`–`FR-034`. Checking the split surfaced that **the success criteria collide too**,
and that was never recorded:

```text
EPIC-002 family:  SC-001 … SC-013
platform:         SC-001 … SC-012
```

Every identifier overlaps. `SC-001` here means one thing; `SC-001` in `_shared/platform-spec.md`
means another, and EPIC-010 owns that one. Before the split this was contained in a single spec.
**Now three separate epic specs each cite bare `SC-00n`**, so a reader cannot tell which population
is meant without checking the parent.

Decision **D-1** owns the fix for requirement identifiers; it should be widened to cover success
criteria. Recorded here rather than silently renumbered — renumbering is D-1's pass to make.

## Build order

```text
F-02.1 run mode ──► runs API (T415–T417)
        └─► F-02.2 provisional approval override
                 └─► F-02.3 review sessions ──► review API (T364a, T365)
                          └─► F-02.4 re-run ──► F-023.UI ──► F-023.Z closure

⚠️ T381 access snapshotting needs EPIC-024's grants to exist first.
```

## Design notes specific to this epic

**`reached_stop_point` is a success state**, not a failure (`FR-008a`). A run that stops where the
user asked it to stop has done its job.

**An artifact generated with no steering... no — with no provisional answer** carries no marking at
all. Markings exist only where a guess was made, which is what makes "everything derived from a
provisional answer is marked" checkable rather than universal.

**Submission is restricted to the project owner or the run's initiator** (`FR-015a`). Answering stays
open to everyone with access — the restriction is on *committing* the batch, not on participating.

**A run raising zero questions creates no review session.** An empty session would be a to-do item
that reads as work outstanding.

## Phase 0 / Phase 1 outputs

**None new.** This epic implements the parent's design:
- [`research.md`](../002-team-review-access-storage/research.md) — R-002-1 (Run vs GenerationJob),
  R-002-4 (access snapshot), R-002-5 (provisional marking), R-002-6 (concurrency guards)
- [`data-model.md`](../002-team-review-access-storage/data-model.md) — `Run`, `RecordedQuestion`,
  `ProvisionalMarking`, `ProvisionalApprovalOverride`, `ReviewSession`, `Answer`
- [`contracts/platform-api-epic-002.md`](../002-team-review-access-storage/contracts/platform-api-epic-002.md)
  — the Runs and Review Sessions endpoint groups
- [`quickstart.md`](../002-team-review-access-storage/quickstart.md) — V02-1 to V02-6

Generating a per-epic `research.md` restating decisions already made in
[EPIC-002](../002-team-review-access-storage/research.md) would duplicate the one thing the parent
exists to hold once.

## Definition of done

- [ ] 43 tasks complete, every unit test passing (Constitution V)
- [ ] **SRS back-fill complete** for `FR-001`–`FR-020` (`T404`) — gates approval, not just closure
- [ ] Quickstart **V02-1** to **V02-6** pass
- [ ] A run in unattended mode completes without human input regardless of question count
- [ ] Markings clear **selectively** when one question is answered, not all at once
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
