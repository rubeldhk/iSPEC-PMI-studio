# DEF-005-001 — sign-in cannot work in the running application

**Epic**: `EPIC-005` · blocks **`BR-0002`** and every authenticated journey in local UAT
**Raised**: 2026-08-20 | **Status**: **RESOLVED 2026-08-20** — by Phase D (T830–T833); verifying test `backend/tests/integration/sign-in.spec.ts` (4/4 on real PostgreSQL). A second cause was found beneath the recorded one: two implicit class-typed injections resolved undefined under esbuild runners (fixed by explicit @Inject — T674a's lesson). Full record: closure.md addendum 2026-08-20
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
