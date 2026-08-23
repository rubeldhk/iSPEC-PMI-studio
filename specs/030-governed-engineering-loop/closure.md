# Closure record: EPIC-030 Governed Engineering Loop

**Date**: 2026-08-23 · **Task**: `T993` · **Session**: `/speckit-implement EPIC-030`, executed in
the worktree `.claude/worktrees/epic-030-governed-engineering-loop` (concurrent-session rule)
· **Released by**: PMI-DOC-004 v2.0 `BR-0064`, `BR-0065`

## Work completed

**81 of 83 tasks.** Two are outstanding and neither is this session's to close — both named below.

| Phase | Tasks | Outcome |
|---|---|---|
| 1 Setup | `T913`–`T918` | `packages/loop-contract` scaffolded, registered, `supertest` declared |
| 2 Foundational | `T919`–`T936` | Contract, schema, migration, conformance check, independence test, XI Tier 1 |
| 3 US1 — declared as configuration | `T937`–`T946` | Loader, stage registry, type isolation, `declareObject` |
| 4 US2 — explicit, authorized, answerable | `T947`–`T960` | Authority, transition record, refusal recording, OCC, atomic write |
| 5 US3 — automation traces to its rule | `T961`–`T966` | Trigger validation, `actorKind`, idempotent dispatch |
| 6 US4 — no silent gate pass | `T967`–`T971` | Gate evaluator, exceptions, departures projection |
| 7 US5 — one projection, one vocabulary | `T972`–`T975` | Progress projection across every workflow type |
| N Polish | `T976`–`T983` | Four mutation proofs, residency, performance, quickstart |
| Z Closure | `T984`–`T993` | This record |

**Artifacts.** `packages/loop-contract/` (contract, 21 tests) ·
`packages/loop-contract/workflows/` (schema, worked example, README) ·
`backend/src/modules/loop/` (12 files: config loader, config registry, stage registry, authority,
gate evaluator, transition writer, trigger dispatcher, progress projection, residency, store,
service, controller, module, tokens) · `backend/prisma/` (3 tables, 2 enums, 2 triggers,
3 constraints, 1 partial index) · `backend/tests/` (10 unit, 7 integration, 3 architecture files).

**Suites.** 3114 of 3117 pass; 2 skipped by design (`DOCKER_UNAVAILABLE`); **1 fails** —
`DEF-030-002`, below. Typecheck clean repo-wide. Lint clean. Governance 830/830.

## The four mutation proofs

Each applied, the named test observed **failing**, the mutation reverted. Full detail in
[quickstart-results.md](./quickstart-results.md).

| Task | Mutation | Failures while it stood |
|---|---|---|
| `T978` | an unevaluated gate resolves `satisfied` | **5** |
| `T979` | the audit write moved out of the transaction | **4 of 6** |
| `T980` | the `approvedBy`/`approvalRef` requirement removed | **4 of 15** |
| `T981` | `LoopModule` unregistered | **8 of 9** |

`T979` is the one worth reading twice. The mutation is not obviously wrong — moving an audit write
out of a transaction and logging its failure is a shape that appears in real codebases and reads as
resilience. It fails only because `T957` **re-reads the object** instead of trusting the return
value, and that re-read is the entire difference between *fail-closed* and *reports a failure and
advances anyway*.

## Performance — `R-030-6`

| Target | Measured | Margin |
|---|---|---|
| transition overhead p95 < 50 ms | 0.06 ms | ~800× |
| end-to-end p95 < 150 ms | 0.16 ms | ~900× |
| projection p95 < 100 ms | 0.03 ms | ~3000× |
| ≥ 50 transitions/second | 56,561/s | ~1100× |

**The margins are a finding, not a victory.** They say the targets were set against a database round
trip and are being measured without one. What they prove is that the loop's own arithmetic is not
the bottleneck — worth knowing, and not what `R-030-6` set out to bound. Re-measure against the
Prisma store when `EPIC-031`–`035` bind it.

## Work deferred, and why

### `T988` — the `BR-0065` SRS edit has **not** landed

`SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md:300` still reads
*"`BR-0065` … → `EPIC-012`"*, and `specs/brs-v2-reconciliation.md:117` still assigns `BR-0065` to
`EPIC-012` while line 168 records `U-06` as **UNOWNED in the register**.

Both are now factually wrong: this Epic owns `U-06` and implements `BR-0065`.

**Not corrected here, deliberately.** PMI-DOC-004 v2.0 is an **approved** SRS, and Constitution II
makes it the authority this Epic answers to rather than one it edits. Amending an approved
specification is an act of the project owner with a §17 revision-history entry. Doing it from an
implementation session would be the specification following the code, which is the inversion this
whole programme exists to prevent.

**Owner: project owner.** Three edits: PMI-DOC-004 §6.7 `BR-0065` → `EPIC-030`;
`brs-v2-reconciliation.md` §3.1/§4 to match, with `U-06` no longer UNOWNED; a §17 entry recording
both.

### `T992` — promotion beyond `local`

Constitution VII requires `local → dev → stage → prod` with no environment skipped. This session
reaches **local only**: the work sits on `epic/030-governed-engineering-loop`, unmerged, and no
`dev` environment is reachable from here. Promotion is a deployment act, not a code change.

**Recorded rather than claimed.** The commits are on the branch and the branch is not merged.

## Two defects raised, neither this Epic's to fix

- **`DEF-030-001`** — every unmatched route in the application returns `500`, not `404`.
  `ErrorFilter` is a bare `@Catch()`, so NestJS's own `NotFoundException` reaches `toHttpStatus`,
  which maps anything that is not a `PlatformError` to `internal_error`. Found by `T934`'s
  **anti-vacuity** assertion on its first run — the part of the test that exists to prove the test
  is not vacuous. `EPIC-001`'s file; `FR-GEL-002` puts it outside this Epic. **Routed to `EPIC-001`.**
- **`DEF-030-002`** — `T147`'s p95 search assertion fails under full-suite load (82.9 s pass,
  48.4 s fail, 36.0 s fail, 30.3 s fail) and passes in isolation at 8.2 s, eight times under budget.
  Testcontainers contention: `backend-integration` now has 21 files each starting its own
  `postgres:16-alpine`. This Epic added three and made an existing sensitivity easier to hit; it did
  not introduce it. Filed because it makes `pnpm test` **non-deterministic**, which `T991` and
  Constitution IV both depend on. **Routed to `EPIC-015`.**

`specs/030-governed-engineering-loop/defects/` therefore holds **two open records**, both with a
named owning Epic. `T990`'s requirement is that every record is closed *or deferred to a named
Epic*; both are deferred, by name.

## `ADR-0018` converged

**Open → Accepted 2026-08-23** (`T987`). Its `Awaits` read *"the three Room epics, none of which
exists"*. The dependency it feared was sequencing, and building the loop first resolved it:
`EPIC-031`–`EPIC-035` are all `Ready`.

Two things the build settled that the ADR could not:

- **The engine names no Room.** `SC-GEL-001` is asserted by
  `loop-new-workflow-type.spec.ts`, which invents a workflow type, runs it end to end from a
  configuration file, then scans every engine source for that type's name, its gate, its rule, and
  any branch on `workflowType`. *"A shared engine must not collapse three governed surfaces into
  one"* is a build failure now.
- **The distinction that makes it workable.** A tenant's file may carry the **string**
  `"requirement-room"`; the contract may not carry the **concept**.
  `loop-independence.spec.ts` draws exactly that line — and it had to, or the rule would have been
  read as forbidding the feature `BR-0064` requires.

## What this Epic learned, for the five that follow

1. **`pnpm typecheck` catches what vitest cannot.** Vitest transpiles without typechecking; four
   real type errors sat under a green suite. Also: the other four worktrees were installed with
   `--ignore-scripts`, so their Prisma clients are ungenerated and `tsc` stack-overflows until
   `prisma generate` runs. That is not a type error and will look like one.
2. **Write the anti-vacuity assertion.** `DEF-030-001` was found by the part of `T934` that exists
   to prove `T934` is not vacuous, not by its subject.
3. **A check that misfires three times is measuring the wrong thing.** `T958`'s source scan flagged
   the declaration path, a type annotation and an inline object type before it was rewritten to
   measure something a regex can actually see.
4. **The engine's own rule caught the engine.** `SC-GEL-001` failed first against
   `loop-config.loader.ts`, which compared `workflowType === '(unnamed)'`. A sentinel, not a real
   branch — and still the shape the rule forbids. The line changed, not the check.

## Recommended next task

```
/speckit-implement EPIC-033
```

**`EPIC-033` before `EPIC-031` or `EPIC-032`.** All three are `Ready` and all three consume this
loop, but `EPIC-033` Phase 2 publishes `packages/room-contract` and `RoomShell`, which `EPIC-034`
`T406b` and `EPIC-035` `T997a` both **hard-stop** on — their first tasks say *"if it is not built,
stop."* Building it next unblocks the widest part of the remaining Wave; `EPIC-031` and `EPIC-032`
block nobody.

Before that Epic starts: `prisma generate` in its worktree, and merge or cherry-pick
`packages/loop-contract` — `EPIC-033`'s `T337e` already anticipates the unmerged case.

**Delivery Board**: stale. `EPIC-030` is now `Implemented` pending promotion; `EPIC-031`–`EPIC-035`
are `Ready`. This session cannot reach the board, so Constitution IX's fallback applies and the
staleness is declared rather than silently carried.
