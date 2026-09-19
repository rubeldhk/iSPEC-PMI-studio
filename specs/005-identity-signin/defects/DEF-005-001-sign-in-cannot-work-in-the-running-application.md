# DEF-005-001 — sign-in cannot work in the running application

**Epic**: `EPIC-005` · blocks **`BR-0002`** and every authenticated journey in local UAT
**Raised**: 2026-08-20 | **Status**: **FIXED** 2026-08-20 by `T830`–`T833`; see Resolution
**Found by**: the first local UAT run of the delivered product surface
**Severity**: **CRITICAL** — the epic's headline capability does not function; every other
delivered epic's UI is unreachable behind it

## What was observed

Against the delivered code (`f03bb7f`, which includes `66c42aa` *"the product surface exists —
identity, projects, requirements"*), with a real workspace and user seeded and a **verified**
password hash:

```console
$ curl -i -X POST http://localhost:3000/v1/auth/sign-in \
    -d '{"email":"uat@pmi.test","password":"uat-password-123"}'
HTTP/1.1 500 Internal Server Error
{"error":{"code":"internal_error","message":"An unexpected error occurred."}}
```

The credentials are good: a direct probe confirmed `db.user.findFirst` returns the row and
`argon2.verify(user.passwordHash, 'uat-password-123')` returns `true`.

## Cause — proven, not inferred

Resolving the real container graph and calling the provider directly:

```console
IDENTITY_PROVIDER resolved: LocalIdentityProvider
THREW: UserDirectoryUnavailableError | The user directory is not configured. Provide
USER_DIRECTORY at the composition root; refusing to answer a sign-in it cannot actually check.
```

`PrismaUserDirectory` exists at `backend/src/modules/auth/identity-provider.ts:46` and has
**zero production call sites**. `auth.module.ts:35` still binds the deliberately-refusing
default:

```ts
{ provide: USER_DIRECTORY, useFactory: (): UserDirectory => new UnconfiguredUserDirectory() },
```

and its own module comment says the real adapter *"is supplied by overriding `USER_DIRECTORY` at
the composition root"* — which nothing does. The refusal is the module behaving **correctly**:
it was written so a missing adapter could never masquerade as a credentials problem. It is
reporting a wiring gap exactly as designed.

## Why 15 of 15 green tasks did not catch it

`T024a` — the controller's unit test — supplies a **mocked identity provider**, so it proves the
controller's behaviour given a working directory and can never observe whether a working one is
wired. No task in `tasks.md` wires `USER_DIRECTORY`, and no integration test signs in against a
real container graph (`backend/tests/integration/` covers workspace isolation, audit
immutability, engine swap/default, agent swap, requirement immutability — not sign-in).

**This is the programme's recurring defect shape, for the fourth recorded time**: capability
built, capability tested, capability called by nothing — `DEF-001-001` (observability bundle
unreachable), `DEF-001-002` (`requestFinished` with no call site), `DEF-028-005` (`runV6` tested
and never called), and now the user directory. EPIC-003's closure warned in these words: *"65
passing tests and an engine that cannot start."*

`SC-AGT-001` was answered by insisting a real container actually run. Sign-in has no equivalent
gate, and that absence is the finding underneath this one.

## Remaining work

- Override `USER_DIRECTORY` with `PrismaUserDirectory` at the composition root, the same seam as
  `AUDIT_WRITER` and `JOB_STORE` already use.
- Pair it with a test that can fail for this reason: an integration test that boots the real
  module graph and signs in end to end. A unit test with a mocked directory provably cannot.
- Consider, at epic level, whether every epic claiming a user-facing capability needs a
  smoke check against the running application before its closure may be written — the gap this
  defect and its three predecessors share.
- Both fixes belong to tasks; this record exists so they enter through `/speckit-tasks`
  (Constitution I, VI). **No code was changed by this UAT run.**

## Resolution (2026-08-20)

Fixed by EPIC-005 Phase D, tests first and mutation-verified — and the fix surfaced a **second
latent break the first was hiding**.

- **`T830`** — `backend/tests/integration/sign-in.spec.ts` boots the real `AppModule` (no mocks,
  no overrides) against a Testcontainers PostgreSQL and signs in over real HTTP. Confirmed
  failing first: 4/4 red, `expected 500 to be 200`.
- **`T831`** — `AuthModule.register()` makes the module's own promise real: the composition root
  can now supply the directory, and `AppModule` binds `PrismaUserDirectory` over a lazy shared
  `PrismaClient` (`backend/src/persistence/prisma.ts`) when `DATABASE_URL` is configured. With no
  database configured the refusing default stays — an unconfigured environment names its missing
  configuration instead of answering "no such user".
- **The second break**: with the directory wired, sign-in still 500ed —
  `AuthController.sessions` was **undefined**. The runtime is tsx/esbuild, which emits no
  `design:paramtypes`, so Nest's type-based injection resolves silently to nothing; the
  controller's second parameter and `AuthModule`'s constructor relied on metadata that never
  exists. Invisible for the epic's whole life because sign-in always threw earlier, and `T024a`
  constructs the controller manually so DI was never exercised. Fixed with explicit
  `@Inject(SessionService)` at both sites.
- **`T832`** — `backend/tests/unit/auth/composition.spec.ts` asserts the composed graph resolves
  `PrismaUserDirectory` (and the refusing default without a database), and pins both injection
  sites against regression to bare type annotations.
- **`T833`** — live UAT re-run against the running stack: sign-in 200 with `HttpOnly` cookie,
  `GET /v1/auth/me` resolves the session, wrong password 401 — and the request log records the
  401 as 401, `DEF-001-004`'s fix observed working in the same run.

**Mutation-verified**: unbinding the directory at the root and dropping the controller's
`@Inject` each turn their own assertion red (2 failures, distinct messages).

The recurring-shape recommendation (a smoke gate against the running application before a
product epic closes) remains open — it is a programme ruling for EPIC-015's scope, not a task
this record can absorb.
