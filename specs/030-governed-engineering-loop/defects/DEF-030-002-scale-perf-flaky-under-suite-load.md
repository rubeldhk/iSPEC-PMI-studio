# DEF-030-002 — `T147`'s p95 search assertion fails under full-suite load

**Epic**: `EPIC-030` | **Raised**: 2026-08-23 | **Status**: **CLOSED — DEFERRED to `EPIC-015` 2026-08-23** (`T990`)

> **Deferred, not fixed, and not dismissed.** `backend/tests/integration/scale.spec.ts` is `EPIC-015`'s (`T147`), and so is the `SC-009` criterion it measures. Changing someone else's performance budget from outside their Epic is how a target quietly becomes a formality.
>
> `DOR-11` reads `DEFERRED` with a named owner as closed, and its own comment says why:
> *"deferred-with-an-owner is a decision … treating it as open would punish recording the
> decision."* The defect below is real and unfixed; what is closed is `EPIC-030`'s
> obligation to carry it.

**Originating task**: observed while running the full suite for Phases 4–7
**Severity**: MEDIUM — no product behaviour is wrong. It is filed because it makes
`pnpm test` **non-deterministic**, and `T991` and Constitution IV both say *"re-run the full suite
green"*. A gate that fails at random is a gate people learn to re-run rather than read.

**Owner**: not `EPIC-030`. `backend/tests/integration/scale.spec.ts` is `EPIC-015`'s (`T147`).
Recorded here per Constitution VI because this is where it was found.

## Expected

`pnpm test` is green, repeatably.

## Actual

`T147 · SC-009 — search: p95 < 1000ms to load and scan all 500 candidates with content` fails when
the whole suite runs, and passes when its own file runs.

| Run | Context | File duration | Result |
|---|---|---|---|
| 1 | full suite | 82.9 s | pass |
| 2 | full suite | 48.4 s | **fail** |
| 3 | full suite | 36.0 s | **fail** |
| 4 | `scale.spec.ts` alone | **15.0 s** (the assertion itself 8.2 s) | pass |

Three failures and two passes over the same commit range, with no code in the search path changed by
this Epic.

## Cause

Not the query. **Testcontainers contention.**

`backend-integration` now has 21 files and most start their own `postgres:16-alpine` container.
Vitest runs them concurrently, so a machine that is fine at four containers is saturated at a dozen.
`T147` measures a **p95 wall-clock** over 40 samples, which makes it the file most sensitive to CPU
starvation — every other integration test asserts behaviour and does not care how long it waited.

This Epic added three integration files, so it made an existing sensitivity easier to hit. It did not
introduce it: the same assertion passes at 8.2 s in isolation, which is 8× under its 1 s-per-sample
budget with the machine to itself.

## Why it matters more than it looks

A performance assertion that measures the test runner's scheduling rather than the code under test
does not measure `SC-009`. Today it is noisy; the worse failure is the opposite one — the query
genuinely regressing and the number staying under budget because the suite happened to run alone
that day.

## Suggested fix (not this Epic's to make)

Three options, cheapest first:

1. **Isolate the measurement.** Mark `scale.spec.ts` to run in its own Vitest pool
   (`poolOptions.threads.singleThread`, or a dedicated project excluded from the parallel run).
   Cheapest, and it makes the number mean what it claims again.
2. **Share one container** across the integration suite via a global setup, so the fixed cost is paid
   once. Larger change; touches every integration file's `beforeAll`.
3. **Assert a budget that accounts for contention** — rejected as the wrong direction. Raising the
   threshold until it stops failing is how a performance test becomes a formality.

**Route to**: `EPIC-015`, which owns the file and the `SC-009` criterion it measures.
