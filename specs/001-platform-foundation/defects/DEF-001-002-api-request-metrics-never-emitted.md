# DEF-001-002 — `MetricsRecorder.requestFinished` is built, tested, and called by nothing

**Epic**: `EPIC-001` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T164` · found by the `T166` convergence pass while closing this epic
**Severity**: MEDIUM — half of one task's stated output is unreachable; no requirement fails today
because the endpoints it would measure belong to held epics

## Expected

`T164`'s task text: *"Implement metrics emission for **API requests** and generation jobs."*

Two kinds of metric. `MetricsRecorder` implements both — `requestFinished` and `jobFinished`.

## Actual

`jobFinished` became reachable under `T661`. `requestFinished` is called by **no production code**.
Neither is `Observability.correlationFor`, whose entire purpose is to adopt an inbound
`x-correlation-id` header at the API edge.

| Symbol | Production call sites before this defect |
|---|---|
| `metrics.jobFinished` | 1 — `worker/src/observability-composition.ts` (added by `T661`) |
| `metrics.requestFinished` | **0** |
| `observability.correlationFor` | **0** |

The cause is structural: `backend/src/main.ts` installs the bundle and emits one startup record.
Nothing runs **per request**. There is no HTTP interceptor, so there is no point at which a route,
a status code, or a duration is known.

## Reproduction

```bash
grep -rn 'requestFinished' backend/src worker/src   # 0 matches outside packages/observability
grep -rn 'correlationFor'  backend/src worker/src   # 0 matches outside packages/observability
```

## Impact

- **API request metrics do not exist.** Route, status and latency are unmeasured.
- **An inbound correlation id is ignored.** A caller that supplies `x-correlation-id` — the whole
  reason `correlationFromHeaders` validates rather than trusts — has it discarded, so a trace cannot
  span the caller. PC-3's chain begins one hop later than designed.

**This is the same shape as DEF-001-001 and was found by looking for it.** The prior defect was a
process with no observability; this is a process with observability installed at startup and nothing
at the point where the work happens.

## Two findings deliberately NOT treated as defects

- **`attachCorrelation` / `extractCorrelation` have no production call sites.** They are exported
  package API with their own tests, and `job-queue.ts` carries the correlation id inline
  (`{ jobId, correlationId }`), so PC-3's API → queue → worker hop **does** work. Adopting the
  helpers there would add id validation to a path whose existing tests use non-UUID fixtures — a
  behaviour change dressed as a tidy-up. Recorded, not churned.
- **`failure-taxonomy` has no direct call site by that name.** Its enum members reach production
  through `EngineFailureReason`, which has seven.

## Resolution

**Fixed** by `T662` (failing tests) and `T663` (implementation): a global HTTP interceptor that
adopts or mints the correlation id per request and records `http.request` / `http.duration_ms` on
completion, installed in `backend/src/main.ts`.

The interceptor lives in `backend/src/modules/observability/` rather than `backend/src/core/`,
because PC-1 forbids `core/**` from importing HTTP types and an interceptor **is** transport. That
is the same reason `audit.interceptor.ts` — which is not a NestJS interceptor at all — sits in
`modules/`.

**Status**: CLOSED 2026-08-17.

## Traceability

- Principle: **PP-010** Observability by Default · design constraint **PC-3**
- Originating task: `T164` · Fixed by: `T662`, `T663`
- Related: [`DEF-001-001`](./DEF-001-001-worker-observability-not-installed.md) — same failure shape,
  found first
