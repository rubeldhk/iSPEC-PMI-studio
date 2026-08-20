# DEF-001-004 — every failed HTTP request is recorded as status 200

**Epic**: `EPIC-001` · affects `T663` / `PP-010` observability · relates to `DEF-001-002`
**Raised**: 2026-08-20 | **Status**: **FIXED** 2026-08-20 by `T834`–`T837`; see Resolution
**Found by**: first local UAT run of the API (`backend/src/main.ts` against the compose stack)
**Severity**: **HIGH** — telemetry reports failures as successes; the metric that exists to
show error rate cannot show one

## What was observed

Two requests, their real responses, and what the platform recorded:

| Request | Client received | `http.request` log recorded |
|---|---|---|
| `GET /v1/engines` (no session) | **401** | `"status":200`, level `info` |
| `POST /v1/auth/sign-in` | **500** | `"status":200`, level `info` |

Verbatim, from the run:

```json
{"msg":"http.request","route":"/v1/engines","method":"GET","status":200,"durationMs":3}
{"msg":"http.request","route":"/v1/auth/sign-in","method":"POST","status":200,"durationMs":1}
```

`curl -i` on the same two calls returned `HTTP/1.1 401` and `HTTP/1.1 500`.

## Cause

`backend/src/modules/observability/http-observability.interceptor.ts`:

```ts
return next.handle().pipe(tap({ next: finish, error: finish }));
```

The error arm is deliberate and its comment is right — *"the requests worth measuring most are
the ones that failed"*. But `finish()` reads the status from the response:

```ts
const status = response?.statusCode ?? 0;
```

On the error arm this runs **before** Nest's exception filter has mapped the exception onto the
response, so `statusCode` is still Express's default `200`. The interceptor therefore reports
the one number it exists to report, wrongly, on exactly the requests it was extended to cover.

Two consequences, both silent:

- `metrics.requestFinished({ status })` counts every 4xx and 5xx as a 200 — an error-rate panel
  built on this metric reads flat at zero while the API fails.
- The log level is chosen by `status >= 500 ? 'error' : 'info'`, so a 500 is logged at `info`.

## Why no test caught it

`T663`'s unit tests drive the interceptor with a fake `ExecutionContext`, and a fake response
carries whatever `statusCode` the test sets — so the test asserts the interceptor *reports the
response's status*, which it does. What no fake can reproduce is **when** Nest sets that status
relative to the interceptor's error arm. Same shape as `DEF-028-009`: neither artifact is wrong
alone, only their composition, and only a real run composes them.

## Remaining work

- Derive the status from the exception on the error arm (the mapping `toHttpStatus` already
  exists in `backend/src/core/errors.ts`) rather than reading it from a response the filter has
  not touched yet — or move the reporting to where the status is known.
- Add a test that drives a **real** failing request end to end, since the unit-level fake
  provably cannot fail on this.
- Both belong to a task; this record exists so the fix enters through one (Constitution VI).

## Resolution (2026-08-20)

Fixed by EPIC-001 Phase 8, tests first and mutation-verified.

- **`T834`** — `backend/tests/integration/http-observability-status.spec.ts` drives real HTTP
  requests through the interceptor **and** `ErrorFilter` together, over a listening Nest app.
  Confirmed failing first, reproducing the defect exactly: `expected 200 to be 401`,
  `expected 200 to be 500`, the metric carrying `status: '200'`, and `expected 'info' to be
  'error'`.
- **`T835`** — the error arm now derives the status from the exception via `toHttpStatus`, the
  same function `ErrorFilter` uses, so the two cannot drift. The success arm still reads the
  response, which *is* authoritative there; the asymmetry is the fix and is asserted. The failure
  is signalled by a wrapper object rather than an optional argument, because `throw undefined` is
  legal JavaScript and an `undefined` check would read it as success.
- **`T836`** — the log level is asserted separately at unit level (500 → `error`, 401 → `info`,
  and the success arm unchanged), since the level is a second symptom of the one corrupted value.
  **The old unit case was itself corrected**: it passed `ctx({ status: 500 })`, pre-setting the
  fake response to the answer Express would not yet hold. With the fake carrying what a real
  response actually carries on that arm, the case now fails against the old implementation.

**Mutation-verified**: reverting the derivation to `response?.statusCode ?? 0` turns **3 unit and
4 integration assertions red**. Both checks can fail for this defect's own reason, which is what
the original `T663` suite could not do.

Suites after the fix: 10 / 10 interceptor unit, 5 / 5 new integration, full integration suite
green when run without container contention.
