# Closing Report: EPIC-026 Epic Stage Register & Definition of Ready

**Session**: `EPIC-026 Epic Stage Register` · **Branch**: `epic/026-epic-stage-kanban` ·
**Date**: 2026-08-18

Written against [`governance/closing-report.md`](../../governance/closing-report.md).
`T531`–`T536` are discharged by the sections below.

> **Constitution VIII: satisfied.** The branch names the epic being worked, and `G-10` reports
> nothing. The second session in this programme where that is true — `plan.md` recorded Gate VIII as
> **QUALIFIED** because the epic was specified from `epic/003-specification-engine`, and that
> qualification is now discharged in fact.

## Work Completed

**71 of 71 tasks.** The repository can now answer, mechanically, *where is each Epic and may it
start?*

| Phase | Outcome | Evidence |
|---|---|---|
| 1 Setup | done | `register:update` launcher, fixture-tree builder |
| 2 Foundational | done | stage model as configuration; pure derivation, 43 tests |
| 3 US1 — the register **(MVP)** | done | `governance/epic-stage-register.md`, generated and committed |
| 4 US2 — it cannot lie | done | determinism, exact-text drift, no shadow declarations |
| 5 US3 — stops read differently | done | three posture kinds, parent designs, `stalled` derived |
| 6 US4 — the DOR | done | `DOR-01`–`DOR-12`, total evaluation, owned expiring waivers |
| 7 US5 — the PP-002 boundary | done | status out of `specs/README.md`, `RF-6` enforced at render time |
| 8 US6 — nothing rests on inspection | done | 11 named checks, severity split, `G-26-02` |
| 9 Polish | done | 8 scenarios executed, `build.spec.ts`, EPIC-018's count corrected |
| Z Closure | done | this document |

**EPIC-026 is the first Epic in this programme to reach stage `Ready`.** Its own register row reads:

```text
| EPIC-026 | … | delivery | Ready | — | Ready (waived) | `/speckit-implement` |
```

`Ready (waived)`, never plain `Ready` — see the waiver below. That is the mechanism working, not a
blemish on it.

## Verified

| Gate | Command | Result |
|---|---|---|
| Governance checks | `pnpm test:governance` | **658 passed**, 50 files — **298 belong to this epic** |
| Governance typecheck | `pnpm typecheck:governance` | pass |
| Lint | `pnpm lint` | pass, 0 warnings |
| Register regeneration | `pnpm register:update` | idempotent — byte-identical on repeat |

**All eight quickstart scenarios executed**, not asserted — faults injected and reverted where the
scenario calls for one. Results in [`quickstart.md`](./quickstart.md).

**Nineteen mutations across the epic, every one caught.** The three worth naming:

- **the register's drift check `.trim()`s before comparing** — 1 red. `.trim()` is an entirely
  reasonable-looking line, and it is exactly how an exact comparison becomes approximate.
- **the contiguity guard removed, so evidence above a gap counts** — 4 red. Without it an Epic reads
  `Tasked` when nobody planned it.
- **the backspace regex re-introduced** — 1 red, naming the file, the offset and `U+0008`.

## The three defects, and what each cost

| Defect | What it was | Found by |
|---|---|---|
| [`DEF-026-001`](./defects/DEF-026-001-dor-08-over-reports.md) | **`DOR-08` is broader than Constitution V** — it demands a paired test for setup, polish and closure tasks, and fired 12 false positives against EPIC-026 itself | `T531`, running the DOR against its own author |
| [`DEF-026-002`](./defects/DEF-026-002-stage-seven-unreachable.md) | **Stage 7 was unreachable.** The first Epic ever to satisfy its DOR read `Analyzed \| stalled \| Ready (waived) \| DOR evaluation` — four cells, three disagreeing with the fourth | `T532` convergence |
| [`DEF-026-003`](./defects/DEF-026-003-checks-contradict-their-contracts.md) | **Two checks forbade what their own contracts require** — `G-26-07` banned the expiry date `RF-5` mandates; `G-26-10` banned the defect citation `FR-ESK-009` mandates | `T532`, on the first register to carry a waiver |

All three recorded **before** any fix (Constitution VI). All three closed.

**`DEF-026-002` is the one worth reading.** `deriveStage` skips stage 7 because it is a verdict
rather than an artifact — correct — and nothing ever layered the verdict back on, so the ladder
stopped at 6 for every Epic forever. Neither suite could see it: the stage tests assert an artifact
ladder that genuinely ends at `Analyzed`, and `readiness.spec.ts` tests the verdict in isolation.
**The disagreement lived between them**, and it took the first Epic in the programme actually
reaching readiness to surface at all.

Its fix carries a guard that fails when *no* Epic is at readiness — without it, the four assertions
that matter would pass vacuously against an empty list. That guard fired on its first run, which is
how it earned its place.

### And one thing recording a defect did

Raising `DEF-026-002` as OPEN made `DOR-11` fail, which **withdrew EPIC-026's readiness in the same
run**. That is `data-model.md` §4's *"evaluation is fresh, never stamped"* behaving exactly as
written: the register does not remember that an Epic was ready, it asks again. Closing the record
restored it.

## The waiver

| Epic | Condition | Owner | Expires | Why |
|---|---|---|---|---|
| EPIC-026 | `DOR-08` | **project-owner** | 2026-11-16 | `DEF-026-001` |

Taken by the project owner on 2026-08-18, when the alternative was to narrow a gate at the closing
phase of the epic it first inconvenienced — *"the move the waiver mechanism exists to prevent."*

The expiry is 90 days, matching `governance.config.json`'s steering-review interval. **On that date
it fails the build** unless renewed as a fresh dated record or the condition is fixed. Until then the
register carries a permanent visible mark: `Ready (waived)`, never `Ready`.

**Deferred work**: narrow `DOR-08` to Constitution V's actual wording — *"every task producing or
changing application code"* — with its own red test proving the narrowed condition still catches a
real unpaired implementation task. Owner: EPIC-026 follow-up or EPIC-018.

## What the register found on its first run

**22 of 28 Epics read `Specified`** — the lowest stage — including three that are closed. The
derivation is not wrong: `Clarified` requires a recorded `### Session`, and **only 6 of 28 specs
carry one**. The other 22 never recorded a clarification session, so their plans, tasks and closures
sit above a gap and surface as 45 out-of-order findings rather than counting as progress.

The register is not measuring how far each Epic got. It measures **what each Epic can prove**, and
for most of them the answer is *less than it looks*. `T487` stops the gap growing; back-filling 22
sessions is not this epic's work.

## Not verified

- **`Ready` — unqualified — has never been produced.** EPIC-026 reached `Ready (waived)`; no Epic
  has passed all twelve conditions cleanly. Plain `Ready` is verified against fixtures only.
- **`stalled` reads on most of the repository**, including Epics being actively worked. With no
  timestamps (`RF-2`) the register cannot distinguish *stopped* from *in progress*, so "stopped" is
  structural: short of terminal stage. `SC-ESK-005`'s goal is half met — the two declared holds do
  read differently from drift, and 23 undeclared Epics do not.
- **~19 Epics carry a prose hold with no declaration.** EPIC-005–016 and EPIC-019–025 say
  "⏸ HELD pending `PMI-DOC-004`" in `spec.md` and read `stalled`. `T500` declared the four the task
  named; the rest is a governance gap the register now makes visible.
- ~~**CI has not run.** Every gate above was executed locally; nothing is pushed.~~ **Corrected 2026-08-19: CI runs on every push**, and has since 2026-08-17.
- **`G-26-06` proves an instruction exists, not that an agent followed it** (`R-026-4`), and says so
  in its own header.

## Deferred

| Item | Owner | Awaiting |
|---|---|---|
| Narrow `DOR-08` to Constitution V's wording (`DEF-026-001`) | EPIC-026 follow-up / EPIC-018 | the waiver expiry, 2026-11-16 |
| Declare postures for the ~19 Epics whose hold is prose only | project-owner | a decision that the prose is authoritative |
| Back-fill clarification sessions for 22 Epics | per-epic | `/speckit-clarify` on each |
| Give `stalled` a time dimension, or rename it | EPIC-026 follow-up | a decision on whether `RF-2` should admit a last-changed input |

## Constitution and principle conformance

| Principle | Verdict |
|---|---|
| I Spec Kit Command Gate | pass — outputs under `specs/026-*/`, `governance/`, `tests/governance/`; the two skill edits are Constitution I exempt |
| II SRS as Source of Truth | pass — owner-originated, back-fill owner named, precedent EPIC-018 `FR-RGP-014`/`015` |
| III Epic → Feature → Task | pass — 6 user stories, 71 tasks |
| IV Convergence Gate | pass — `T532` run; two defects found and closed, two requirements annotated |
| V Mandatory checks | pass — 298 checks; **`DOR-08` waived for this epic**, recorded above |
| VI Defect Traceability | pass — 3 recorded **before** any fix, 3 closed; `defects/` holds no open records |
| VII Promotion Pipeline | **not applicable** — this epic ships governance documents and executable checks, no runtime artifact. Decided by the project owner 2026-08-18, following the EPIC-027 precedent |
| VIII Session Labelling | **pass** — branch names the epic; `G-10` reports nothing |
| IX Mandatory Closing Report | pass — this document |

## Epic Exit Criteria

- [x] Every implementation task has a passing test or conformance check — `T531`, with `DOR-08`
      waived and the reason recorded
- [x] `/speckit-converge` reports no unbuilt work — `T532`; findings closed in phase
- [x] `defects/` contains no open records — `T533`; 3 raised, 3 closed
- [x] `pnpm test:governance` and `pnpm typecheck:governance` green — `T534`
- [x] Constitution VII recorded — `T535`; **not applicable**, project-owner decision
- [x] Closing report published and closure recorded — `T536`, this document

**EPIC-026 is CLOSED and release-eligible** — the sixth epic to close, after EPIC-001, EPIC-018,
EPIC-003, EPIC-027 and EPIC-004.

Release-eligible is a claim about this epic's scope: the register exists, is generated, is committed,
cannot drift, and the DOR has teeth. It is **not** a claim that the programme's Epics are in good
order — the register's first run says the opposite, loudly, and that is the point of building it.

## Recommended Next Task

**`PMI-DOC-004` and approved business scope.** Unchanged, and now with nothing left standing beside
it: with EPIC-026 closed, **every buildable epic in this repository is complete**. The foundation
trio (EPIC-001, 003, 004), the governance pair (EPIC-018, 026), the reconciliation (EPIC-027) and
the seam (EPIC-028) are done. Nineteen epics and 393 tasks are specified, planned, tasked, and
waiting on one business document.

If work is wanted before then, the register now names it precisely. In order of value:

1. **Back-fill 22 clarification sessions.** The single largest source of understated progress in the
   programme — three closed Epics currently read `Specified`.
2. **Declare postures for the ~19 prose-only holds**, so `stalled` means drift rather than
   "nobody has written it down yet".
3. **Narrow `DOR-08`** before the waiver expires on 2026-11-16.
