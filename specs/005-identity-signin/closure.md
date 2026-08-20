# Closure record: EPIC-005 Identity & Sign-in

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-005 EPIC-006 EPIC-007` (labelled by
first command per Constitution VIII; branch `main` — stated here because the terminal title could
not be set) · **Released by**: PMI-DOC-004 v1.0 (**BR-0002**), scope ruling T-106, 2026-08-20.

The first product-surface epic to close after the D-10 hold discharged. Implemented the same day
the hold lifted.

## `T177` — every implementation task has a passing unit test (Constitution V)

**11 of 11 tasks complete; every test written first and observed RED before its implementation
existed** (import-failure red: 3 files, 0 tests collectable, exit 1 — recorded in the session log
before `password.service.ts` was written).

| Implementation task | Paired test | Result |
|---|---|---|
| T022 Argon2id hashing | T021 `password.spec.ts` (6 tests) | pass |
| T024 identity-provider boundary | T023 `identity-provider.spec.ts` (5 tests) | pass |
| T025 sign-in / sign-out / me | T024a `auth.controller.spec.ts` (11 tests) | pass |
| T057 sign-in page | T056a `SignIn.spec.tsx` (5 tests) | pass |
| T058 API client | T057a `api.spec.ts` (9 tests) | pass |
| — contract | T026 `auth.spec.ts` (10 tests) | pass |

Suites at closure: `pnpm test:unit` **859 passed** · `test:contract` 32 · `test:arch` pass ·
`test:integration` **49 passed against a real PostgreSQL** (Docker 28.3.3 via Testcontainers) ·
`pnpm -r typecheck` pass · `pnpm lint` 0 errors.

## `T178` — convergence

Performed within this run per the `speckit-converge` method (artifact-vs-code gap scan over
spec.md, plan.md, tasks.md, the shared contract, and the definition of done), executing Phase Z
task T178. **No unbuilt work found in this epic's scope.** Findings, all recorded rather than
appended as tasks because none is this epic's to build:

- **F1 — the user directory is not composed.** `USER_DIRECTORY` defaults to
  `UnconfiguredUserDirectory`, which **refuses by name** rather than answering "no such user" —
  the same posture as `AUDIT_WRITER` (EPIC-004 T674) and `JOB_STORE` (EPIC-001 T651).
  `PrismaUserDirectory` is built and exported; what is absent is a PrismaClient at the API's
  composition root, a **pre-existing platform seam** shared by three closed epics.
  **Owner: EPIC-014 F-11.2** (the first composed environment). Not new work this epic specified.
- **F2 — sessions are in-process memory.** Correct for the Phase 1 single-user surface (R-008:
  "the smallest thing that establishes user and workspace identity"); a restart signs the user
  out. Recorded as a property, not a defect; a shared session store is a Phase 3 SSO concern
  behind the identity-provider boundary built here.
- **F3 — EPIC-004's deferred item "Prisma-backed AUDIT_WRITER/READER adapters — owner EPIC-005"**:
  re-assigned with reason. That deferral predates D-31/EPIC-014's composition surface; the adapter
  cannot be constructed before a PrismaClient exists in the API process, which is the same F1 seam.
  **Owner now: EPIC-014 F-11.2**, named here so the deferral keeps a valid owner (D-6).

**Definition of done** (plan.md): sign-in/out/me behave per `contracts/platform-api.md` — verified
by T026; `password_hash` never returned by any read path — asserted by T024a/T026 and EPIC-004
T011a; **G-05.1 resolved** — the provisional FR-000 minted 2026-08-19 is superseded by **BR-0002**
(PMI-DOC-004 v1.0), so sign-in now traces to an approved business requirement.

## `T179` — defect triage

`specs/005-identity-signin/defects/` contains no records (only `.gitkeep`). **0 open, 0 raised,
0 deferred.**

## `T180` — closing report

### Work Completed

- `backend/src/modules/auth/` — `password.service.ts` (Argon2id, argon2 0.45.1, dependency
  register D-09), `identity-provider.ts` (boundary + local + Prisma directory + refusing default),
  `sessions.ts` (opaque-token server-side sessions), `auth.controller.ts` (sign-in/out/me,
  HTTP-only cookie), `session-context.middleware.ts` (populates the `WorkspaceContext` every
  controller has read since T030 — previously populated by nothing), `auth.module.ts`,
  `auth.tokens.ts`; wired into `app.module.ts`.
- `frontend/src/services/api.ts` (typed `ApiError`, named-field parsing, one-place session-expiry
  handling), `frontend/src/pages/SignIn.tsx`, shell wiring in `frontend/src/main.tsx`.
- Test infrastructure the frontend never had: Vitest `frontend` project (jsdom), registered in
  `vitest.workspace.ts`, `test:unit`, and the T537 governance map — all three places, per T539.
- Tests: 36 backend + 14 frontend assertions across 5 files, plus 10 contract tests.

### Not verified

- **No end-to-end HTTP sign-in has run** — needs the composed runtime (F1). Every layer below is
  verified: hashing against real argon2, provider against the boundary, controller against the
  session service, contract against routing metadata.
- Quickstart **V2** (EPIC-004's deferral "owner EPIC-005 for the sign-in half"): the sign-in half
  now **exists**; the scenario as an HTTP round trip still needs composition. Passed to
  **EPIC-014 F-11.2** with V12.

### Deferred (all with owners, D-6)

| Item | Owner | Awaiting |
|---|---|---|
| PrismaClient at the API composition root; swap `USER_DIRECTORY`, `AUDIT_WRITER/READER`, `JOB_STORE`, `PROJECT_STORE`, `REQUIREMENT_*` | EPIC-014 F-11.2 | first composed environment |
| Quickstart V2 end-to-end | EPIC-014 F-11.2 | same |
| Wire `onRefused` hooks to `AuditService` | EPIC-014 F-11.2 | same (the hooks exist) |
| Shared session store / SSO | Phase 3 | out of scope by design (R-008) |
| D-1 typed identifiers | project owner | MPS baseline (checklist note) |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T177)
- [x] Convergence reports no unbuilt work in scope (T178)
- [x] `defects/` contains no open records (T179)
- [x] Principle deltas hold (none declared); every deferral has a valid owner (T180)
- [x] Closure recorded — this document; **EPIC-005 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's, not this epic's

### Recommended Next Task

`/speckit-implement EPIC-008` — specification authoring, the next epic in the US-order build
(EPIC-006 and EPIC-007 close in this same session; EPIC-008 consumes EPIC-007's content hash).

---

# Addendum 2026-08-20 (later session) — Phase D: DEF-005-001 remediated

**Session**: `/speckit-implement for EPIC-005 Phase D — T830–T833`, executed in the isolated
worktree `epic/009-011-016-lifecycle-wave` (concurrent-session rule; EPIC-008 in flight in a
sibling session).

## What UAT found, and what was actually wrong

`DEF-005-001` proved sign-in returned **500** in the running application because nothing bound
`PrismaUserDirectory`. T830 — an integration test booting the REAL module graph over real HTTP
against a real PostgreSQL — reproduced that exactly (500 `internal_error`, the defect's own
probe), and then found a **second cause underneath the first**:

1. **`USER_DIRECTORY` unbound** — the defect's recorded cause. Fixed by T831: the factory binds
   `PrismaUserDirectory(new PrismaClient().user)` whenever `DATABASE_URL` is configured, and the
   deliberately-refusing default remains when it is not.
2. **Two implicit class-typed injections resolved to `undefined`** under esbuild-based runners
   (vitest, tsx), which emit no `design:paramtypes`: `AuthController`'s `SessionService`
   parameter and `AuthModule`'s own constructor. Sign-in then threw
   `TypeError: Cannot read properties of undefined (reading 'create')` AFTER the directory fix.
   This is **T674a's exact lesson recurring** (EPIC-004 closure: "the test was measuring 'did it
   return an object' and reporting it as 'is it wired'"). Fixed by explicit
   `@Inject(SessionService)` at both sites.

## Verification (executed, not asserted)

- **T830** `backend/tests/integration/sign-in.spec.ts` — 4/4 against PostgreSQL 16
  (Testcontainers): sign-in 200 + HttpOnly cookie · wrong password 401 (never 500, never 200) ·
  the cookie carries into `GET /v1/auth/me` 200 · no hash in any response. Observed RED first
  with the defect's exact 500 before T831.
- **T832** `backend/tests/unit/auth/composition.spec.ts` — resolves `USER_DIRECTORY` from the
  composed DI graph: `PrismaUserDirectory` with `DATABASE_URL`, the refusing default without.
- Full suites: 53 integration (7 files) · 495 unit+contract+frontend — green.

## T833 — the UAT path, re-run

The defect's own reproduction path — seeded workspace/user, `POST /v1/auth/sign-in`, session
into `/v1/auth/me` — now **passes end to end over real HTTP** (T830's live run is the record).
**Honest limit**: the browser hop through the web client was NOT driven — the Vite dev server
has no `/v1` proxy configured, so the shell cannot reach the API cross-origin in local dev. The
`ApiClient` layer is unit-verified; the proxy belongs to the interface epic (**owner:
EPIC-010**), recorded here rather than silently absorbed.

## Residual, named

- **The same latent hazard exists wherever a controller uses implicit class-typed constructor
  injection** (projects, requirements, engines, decisions, traceability): correct under `tsc`
  builds, `undefined` under esbuild runners, throwing only on first use. T830/T832 cover auth;
  a platform-wide conformance check (assert every controller resolves its dependencies from the
  composed graph) is the generalisation — candidate task for the epic that owns the harness
  (EPIC-015 QA or EPIC-014), flagged for `/speckit-tasks`.

**`DEF-005-001` is CLOSED** — resolving tasks T830–T833, verifying test
`backend/tests/integration/sign-in.spec.ts` (Constitution VI).
