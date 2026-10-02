# Quickstart results: EPIC-030

**Task**: `T983` · **Run**: 2026-08-23 · **Worktree**:
`.claude/worktrees/epic-030-governed-engineering-loop`

Each of the ten scenarios in [quickstart.md](./quickstart.md), and the executed test that
demonstrates it. **Every one is a test that runs**, not a transcript of a manual session — the
scenarios in this Epic are all assertions about refusal, and a refusal nobody re-checks is a claim.

| # | Scenario | Demonstrated by | Result |
|---|---|---|---|
| 1 | A workflow type this Epic's code does not name runs end to end | `loop-new-workflow-type.spec.ts` (`T946`) | **11/11 pass** |
| 2 | State cannot be written except by a transition | `loop-no-direct-write.spec.ts` (`T958`) | **9/9 pass** |
| 3 | A completed loop reconstructs from audit alone | `loop-history-rebuild.spec.ts` (`T960`) | **6/6 pass** |
| 4 | The audit store goes away and the loop refuses | `loop-fail-closed.spec.ts` (`T957`) | **6/6 pass** |
| 5 | Two transitions race and exactly one wins | `loop-concurrency.spec.ts` (`T956`) | **7/7 pass**, over 20 rounds |
| 6 | An automated transition with no rule cannot be configured | `loop-trigger-rule.spec.ts` (`T961`) | **9/9 pass** |
| 7 | A required gate cannot be passed by omission | `loop-gate-completeness.spec.ts` (`T967`) | **13/13 pass** |
| 8 | A tenant cannot add a stage | `loop-config-scope.spec.ts` (`T943`) | **7/7 pass** |
| 9 | A configuration change without approval does not load | `loop-config-loader.spec.ts` (`T937`) | **15/15 pass** |
| 10 | Constitution XI Tier 1: the loop is actually wired | `loop-reachability.spec.ts` (`T934`) | **9/9 pass** |

## The four mutation proofs

Each mutation was applied, the named test observed **failing**, and the mutation reverted. A check
that has never been seen to fail is a check nobody has tested.

| Task | Mutation | Observed |
|---|---|---|
| `T978` | `gate-evaluator.ts` — an unevaluated gate resolves `satisfied` instead of `violation` | **5 tests failed** across `loop-gate-completeness` and `loop-gate-exception`; 24/24 on revert |
| `T979` | `transition-writer.ts` — the audit write moved out of the transaction and its failure swallowed | **4 of 6 failed** in `loop-fail-closed`; 6/6 on revert |
| `T980` | `loop-config.loader.ts` — the `approvedBy`/`approvalRef` requirement removed | **4 of 15 failed** in `loop-config-loader`; 15/15 on revert |
| `T981` | `app.module.ts` — `LoopModule` unregistered | **8 of 9 failed** in `loop-reachability`; 9/9 on revert |

`T979` is the one worth reading twice. The mutation is not obviously wrong — moving an audit write
out of a transaction and logging its failure is a shape that appears in real codebases and looks like
resilience. It fails here because `T957` re-reads the object rather than trusting the return value,
and that re-read is the only thing that separates *fail-closed* from *reports a failure and advances
anyway*.

## Performance — `R-030-6`, `T982`

Measured by `loop-performance.spec.ts`. **Against the in-memory store**, which is the honest scope:
the overhead this Epic controls is the loop's own — authority, gate evaluation, record construction,
projection. Database latency belongs to whichever store is bound.

| Target | Measured | Margin |
|---|---|---|
| transition overhead p95 < 50 ms | **0.06 ms** | ~800× |
| end-to-end (declare + 7 transitions) p95 < 150 ms | **0.16 ms** | ~900× |
| projection p95 < 100 ms | **0.03 ms** | ~3000× |
| ≥ 50 transitions/second per workspace | **56,561/s** | ~1100× |

**Margins this large are a finding, not a victory.** They say the targets were set against a
database round trip and are being measured without one — so what they currently prove is that the
loop's own arithmetic is not the bottleneck, which is worth knowing and is not what `R-030-6`
intended to bound. The figures should be re-measured against the Prisma store when `EPIC-031`–`035`
bind it, and `DEF-030-002` records why that measurement must not run inside the parallel integration
suite.

## Not applicable

**Constitution XI Tier 2** — this Epic delivers no user-facing journey. Loop progress becomes visible
when a Room renders it (`EPIC-033`–`035`), and each of those Epics carries its own Tier 2 obligation.
Recorded here rather than omitted, per gate XI's own wording: *"an Epic with no user-facing
capability records that, rather than omitting the row."*


## Addendum — `T981`'s mutation changed shape on 2026-08-28 (`T1165`)

`EPIC-033` needed stage handlers, and `LoopModule` had no way to receive them:
`LOOP_STAGE_HANDLERS` was provided inside the module and consumed by
`LOOP_CONFIG_SOURCE` in the same scope, so nothing outside could replace it. It
gained `LoopModule.register()`, and `backend/src/composition/governed-loop.ts`
now holds the single call — single because Nest keys a dynamic module by its
metadata, so two `register` calls would be two modules with two
`InMemoryLoopStore`s.

Two consequences for this record, both found by re-running the mutation rather
than assumed:

**`T981`'s one-line mutation no longer fails.** Commenting `GOVERNED_LOOP` out of
`app.module.ts` leaves all 9 `loop-reachability` tests passing, because
`RequirementRoomModule` also imports the constant and `AppModule` imports that.
The loop is still in the graph by a second path.

This is a **strengthening, not a weakening**. Removing the loop from both places
does not produce a failing test — it produces a **compile error**, because
`RequirementRoomService` injects `LoopService` for `openRoom`. The loop is now
load-bearing for a Room, so it can no longer be silently unregistered at all;
the mutation this proof was written for has become unrepresentable.

**`T934`'s assertion had to change.** `app.select(LoopModule)` asks for a module
token the graph no longer contains — a dynamic module is keyed by its metadata —
so it threw whether or not the loop was registered. It now selects the
`GOVERNED_LOOP` constant, which is the same object the composition root imports,
and fails if that object is not in the graph.

