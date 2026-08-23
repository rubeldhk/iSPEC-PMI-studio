# DEF-030-001 — every unmatched route answers `500`, never `404`

**Epic**: `EPIC-030` | **Raised**: 2026-08-23 | **Status**: OPEN

**Originating task**: `T934` (Constitution XI Tier 1) · found by that test's **anti-vacuity**
assertion, not by its subject
**Severity**: MEDIUM — no data is at risk and no governed rule is broken. It is filed because it
makes a whole class of test unwritable, and because a `500` tells a caller *"we broke"* when the
truth is *"you asked for something that does not exist."*

**Owner**: not `EPIC-030`. `backend/src/core/error.filter.ts` and `errors.ts` are `EPIC-001`'s
(`T018`), and `FR-GEL-002` puts them outside this Epic. Recorded here because this is where it was
found, per Constitution VI.

## Expected

`GET /v1/loop/objects/probe/not-a-real-sub-resource` matches no route, so NestJS raises
`NotFoundException` and the caller receives **`404`**.

## Actual

**`500`**, with body `{"error":{"code":"internal_error","message":"An unexpected error occurred."}}`.

Observed while running `T934`. Not specific to the loop — this is every unmatched path in the
application.

## Cause

Two correct decisions that combine into a wrong one.

`backend/src/core/error.filter.ts` is registered with a bare `@Catch()`, which in NestJS catches
**everything**, including the framework's own `HttpException` subclasses:

```ts
@Catch()
export class ErrorFilter implements ExceptionFilter { … }
```

and `backend/src/core/errors.ts` maps anything it does not recognise to `internal_error`:

```ts
export function toHttpStatus(err: unknown): number {
  return err instanceof PlatformError ? STATUS[err.code] : STATUS.internal_error;
}
```

`NotFoundException` is not a `PlatformError`, so the route-not-found path — which NestJS signals as
an exception — is reported as a server fault.

**The mapping is deliberately conservative and that part is right.** `toErrorBody`'s comment says an
unrecognised error's own text is never exposed *"because it may carry a connection string, a token,
or engine output"*. The bug is not the default; it is that a framework `HttpException` reaches the
default at all, when it already carries a status the platform could honour without exposing
anything.

## Why it was not caught before

Nothing had driven the application through its real HTTP entry point. The five existing
`backend/tests/integration/` files exercise services, and a service never sees a 404 for an
unmatched route because the router is what produces one.

This Epic's research recorded that gap in the abstract — *"no `createNestApplication` test exists
anywhere in the repository"*. `T934` is the first test to look, and it found this on its first run.
It is the same shape as `DEF-005-001`, where sign-in was a `500` in the running application while
15/15 tasks were green.

## Impact on `T934`

The anti-vacuity assertion — *"a route the loop does not own returns 404, or the check above is
vacuous"* — cannot assert `404` today. It has been rewritten to assert the property it actually
needs: an unmatched path is **distinguishable** from a matched one, `500` versus the `501` a matched
route returns. That is a weaker guarantee and the test says so in place, with this record's id.

**When this is fixed, `T934` should be tightened back to `404`.** Left as a comment in that file so
the two do not drift apart.

## Suggested fix (not this Epic's to make)

Narrow the filter, or widen the mapping — one line either way:

```ts
export function toHttpStatus(err: unknown): number {
  if (err instanceof PlatformError) return STATUS[err.code];
  if (err instanceof HttpException) return err.getStatus();   // framework statuses are already safe
  return STATUS.internal_error;
}
```

`toErrorBody` needs the matching arm, and should still refuse to echo the exception's message for
anything but a framework exception, preserving the reason the conservative default exists.

**Route to**: `EPIC-001`, or the next Epic that touches `backend/src/core/`. A one-line change with
an application-wide blast radius is exactly what `RULE-02`-style change control is for, and this
Epic does not own the file.
