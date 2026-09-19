# DEF-001-001 — `T657` wired observability into the API and not into the worker

**Epic**: `EPIC-001` | **Raised**: 2026-08-17 | **Status**: CLOSED 2026-08-17

> **Header corrected 2026-08-19.** This line read `OPEN` while the resolution below read
> `**Status**: CLOSED 2026-08-17` — one record asserting both. `DOR-11` scans for an open status and
> found this one, so EPIC-001 was held out of `Ready` by a stale header rather than by an open
> defect. The body is the truth: `T660` and `T661` are complete and `worker/src/main.ts` calls
> `buildObservability`, both verified before this line was changed.
**Originating task**: `T657` (convergence, 2026-08-14) · found while executing `T165` Phase Z closure
**Severity**: HIGH — `spec.md` asserts a principle is satisfied platform-wide, and it is satisfied in
one of the platform's two long-running processes

## Expected

`T657`'s own task text, in [`tasks.md`](../tasks.md):

> Wire `logger.ts`, `correlation.ts` and `metrics.ts` into `backend/src/main.ts` **and
> `worker/src/main.ts`** per PP-010 (partial) — unit test: T656

And the warning `/speckit-converge` attached directly beneath it:

> **`T168` must not sign the principle delta until `T657` lands** — that exit criterion asks whether
> the deltas still hold, and today this one does not.

## Actual

`T657` is marked `[X]`. Only the API half exists.

| Process | `buildObservability` | structured logger | metrics recorder | correlation minted |
|---|---|---|---|---|
| `backend/src/main.ts` | ✅ imported and called | ✅ `loggerFor(...).log('info','api.started')` | ✅ `NullMetricSink` installed | ✅ `newCorrelationId()` |
| `worker/src/main.ts` | ❌ **never imported** | ❌ raw `console.log(JSON.stringify({...}))` | ❌ none | ❌ none |

The worker's startup record is hand-rolled JSON. It carries no `level`, no `workspaceId`, no
`actorId`, no `correlationId`, and it does not pass through `redact()` — so the log-safety
guarantees `logger.ts` enforces in code rather than by reviewer discipline do not apply to a single
line the worker emits.

`generation.consumer.ts` *relays* a `correlationId` it is handed and passes it into the engine
(PC-3 holds across the sandbox boundary). It never creates one, never logs one, and records no
metric. `MetricsRecorder.jobFinished` — the method whose entire purpose is the worker's terminal
job states — **is called by nothing outside its own spec.**

## Reproduction

```bash
grep -c 'buildObservability' backend/src/main.ts   # 1
grep -c 'buildObservability' worker/src/main.ts    # 0
grep -rn 'jobFinished' worker/ --include=*.ts      # no matches
```

`backend/tests/unit/observability/bootstrap.spec.ts` (`T656`) passes, because both of its
installation assertions read `backend/src/main.ts`. **No assertion anywhere reads
`worker/src/main.ts`.** The check that was supposed to catch this could not see half of what it was
written to verify — which is why the task could be marked complete in good faith.

## Impact

- **PP-010 "Observability by Default" is not satisfied platform-wide.** `spec.md` claims it is.
- **`SC-011` is unmeasurable.** *"95% of generation requests complete or report a named failure
  within their time limit"* is a claim about a distribution of job outcomes. Job outcomes happen in
  the worker. Nothing records them.
- **PC-3 is half-true.** A correlation id crosses API → queue → sandbox, and is invisible at the
  worker hop in between — the one place a trace is most needed when a generation hangs.

## Root cause

`buildObservability` and the three modules live in `backend/src/core/observability/`. The worker has
no dependency on `@pmi/backend` and must not acquire one — that would pull NestJS, Express and
Prisma into the process whose only job is to consume a queue and hold a concrete engine, and it
inverts the dependency direction the architecture tests defend.

So the worker half of `T657` was **not merely forgotten — it was not reachable.** Completing it
requires moving the modules to a package both processes may depend on. That is why this is a defect
record and two new tasks rather than a one-line fix.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Extract to `packages/observability`; both processes depend on it | Matches the existing `engine-contract` / `agent-contract` / `execution-contract` pattern. One implementation, one set of redaction rules. Costs a package and a Vitest project. **Recommended** |
| **B** | Give the worker its own logger built on `pino`, which it already depends on | Two implementations of the redaction rules in `FORBIDDEN_KEYS`. They agree on the day they are written and diverge at the first amendment — a direct PP-002 violation |
| **C** | Let `worker` depend on `@pmi/backend` | Pulls NestJS, Express, Prisma and `reflect-metadata` into the worker, and points the dependency arrow the wrong way |
| **D** | Correct `spec.md` to claim PP-010 for the API only, and defer the worker | Honest, and leaves `SC-011` permanently unmeasurable while EPIC-014 (QA/release) assumes it is not |

## Recommended resolution

**Option A**, executed now as part of this epic's closure, per `T166`'s instruction to *"append and
complete any remaining unbuilt work."*

## Resolution

**Fixed** — see `T660` (failing test) and `T661` (implementation), appended to
[`tasks.md`](../tasks.md) Phase 7. `T657` was un-ticked and re-verified.

**Status**: CLOSED 2026-08-17.

## Traceability

- Principle: **PP-010** Observability by Default (adopted by decision **D-7**, function F-00.5)
- Design constraint: **PC-3** (`specs/_shared/system-design.md`)
- Success criterion made unmeasurable: **SC-011**
- Originating task: `T657` · Test that could not see it: `T656`
- Fixed by: `T660`, `T661`
- Blocks: `T168` — the principle delta could not be signed while this was open
