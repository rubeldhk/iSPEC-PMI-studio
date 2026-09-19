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

## Addendum — 2026-08-20: `DEF-005-001` found by the first local UAT, fixed the same day

The first UAT run of the delivered surface could not sign in: the composed application resolved
the deliberately-refusing `UnconfiguredUserDirectory`, because nothing anywhere performed the
override every module comment promised. Fixing it (Phase D, `T830`–`T833`) surfaced a second
latent break: two type-annotated injection sites resolved to `undefined` under tsx/esbuild, which
emits no `design:paramtypes` — proof that this epic's green suite never once exercised its own
dependency injection.

Both are fixed, both are pinned by tests that were observed failing first and mutation-verified.
Live UAT now passes end to end: sign-in 200, session carried into `/me`, wrong password 401.

**What this says about the epic's original verification** — the same sentence EPIC-001's addendum
earned today: a mocked collaborator proves behaviour *given* the wiring, and only booting the
composed application proves the wiring. This is the programme's fourth
built-tested-called-by-nothing; the proposed smoke gate before product-epic closure is recorded in
the defect and awaits a ruling.
