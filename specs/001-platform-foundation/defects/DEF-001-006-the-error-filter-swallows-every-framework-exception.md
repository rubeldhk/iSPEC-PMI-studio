# DEF-001-006 — the error filter reports every framework exception as a server error

**Epic**: `EPIC-001` (owns `backend/src/core/`) · affects **every route in the API**
**Raised**: 2026-08-21 | **Status**: **OPEN**
**Found by**: investigating `DEF-007-001` (project-scoped lists return 200 for an unknown project) —
this was the control test, not the target
**Severity**: **HIGH** — every mistyped URL is reported as a server error, and real 404s are
indistinguishable from crashes

## What it does

`toHttpStatus` maps anything that is not a `PlatformError` to `internal_error`:

```ts
export function toHttpStatus(err: unknown): number {
  return err instanceof PlatformError ? STATUS[err.code] : STATUS.internal_error;
}
```

Nest raises its **own** `NotFoundException` when no route matches, and `HttpException` subclasses for
framework-level 400, 405 and 415. None of them is a `PlatformError`, so the global filter
(`backend/src/core/error.filter.ts`) converts all of them to **500**.

## Reproduction

```
GET /v1/no-such-route          ->  500  {"error":{"code":"internal_error", ...}}
```

Verified 2026-08-21 against the API running on `049806a`. The `internal_error` body shape confirms
the response came from `toErrorBody`, so the framework exception did pass through this filter rather
than bypassing it.

## Expected vs actual

| | |
|---|---|
| **Expected** | An unmatched route is `404`. A framework-level client error keeps its own status |
| **Actual** | Both become `500 internal_error` |

## Why it matters more than it looks

1. **Monitoring is poisoned.** Every typo, stale bookmark and scanner probe raises a server error, so
   the 500 rate stops meaning "the server is broken".
2. **It hides the thing it should reveal.** A genuine 404 and an unhandled crash are now the same
   response, which is the opposite of what an error taxonomy is for.
3. **It will mask the fix for `DEF-007-001`.** That defect's remedy is to raise a not-found for an
   unknown project. Raised as a Nest `NotFoundException`, it would arrive at the client as a 500 —
   so this must land **first**, or the endpoint work will look wrong while being right.

## The care the fix needs

The filter's current shape is not an accident, and the fix must keep what it protects. `toErrorBody`
deliberately refuses to echo an unrecognised error's text, *"because it may carry a connection
string, a token, or engine output."* That reasoning is correct and must survive.

So the fix is **not** "expose the exception". It is: recognise `HttpException`, take its **status**,
and emit a body whose message is drawn from a **known-safe set** — never the raw exception text for
an error the platform did not itself raise.

## Remaining work

- Map `HttpException` to its own status in `toHttpStatus`, leaving every unrecognised error at 500.
- Keep `toErrorBody` refusing to echo unknown error text; give framework errors a fixed message per
  status rather than their own.
- **Mutation-verify**: an unmatched route MUST return 404, and an unrecognised non-HTTP error MUST
  still return 500 with no detail leaked. Both observed failing first.
- Sweep for handlers that already throw Nest exceptions expecting them to survive the filter.
- **No code was changed by the session that found this.** The fix re-enters as tasks
  (Constitution VI).

## Links

- [`DEF-007-001`](../../007-requirement-intelligence/defects/DEF-007-001-project-scoped-lists-cannot-report-a-missing-project.md) — found alongside; blocked by this one
- `backend/src/core/errors.ts:159` · `backend/src/core/error.filter.ts:17`
