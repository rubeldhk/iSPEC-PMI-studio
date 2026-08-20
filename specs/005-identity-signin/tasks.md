---

description: "Task list for EPIC-005 — Identity & Sign-in"
---

# Tasks: Identity & Sign-in

**Epic**: `EPIC-005` | **Module**: M-01 | **Tasks**: 15

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (BR-0002; scope ruling
> T-106). The prior hold (decision D-10) is discharged; posture authority is
> [spec.md](./spec.md).


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-01.3 · Authentication and session

*Catalog epic overlap: Security & Governance → Authentication. Behind an identity-provider boundary so Phase 3 SSO replaces an adapter, not the request pipeline.*

- [X] T021 [P] Write failing unit tests for Argon2id hashing and verification in `backend/tests/unit/auth/password.spec.ts`
- [X] T022 Implement password hashing service in `backend/src/modules/auth/password.service.ts` (unit test: T021)
- [X] T023 [P] Write failing unit tests for the identity-provider boundary interface in `backend/tests/unit/auth/identity-provider.spec.ts`
- [X] T024 Implement identity-provider interface and local implementation in `backend/src/modules/auth/identity-provider.ts` (unit test: T023)
- [X] T024a [P] Write failing unit tests for the auth controller with a mocked identity provider, covering sign-in success, rejection, and session teardown, in `backend/tests/unit/auth/auth.controller.spec.ts`
- [X] T025 Implement session sign-in, sign-out, and `me` endpoints in `backend/src/modules/auth/auth.controller.ts` (unit test: T024a)
- [X] T026 [P] Write contract tests for `/auth/*` against `contracts/platform-api.md` in `backend/tests/contract/auth.spec.ts`

## F-01.4 · Sign-in experience and API client

- [X] T056a [P] [US1] Component unit tests for the sign-in page covering submit, error, and redirect in `frontend/tests/unit/pages/SignIn.spec.tsx`
- [X] T057 [P] [US1] Implement sign-in page and session handling in `frontend/src/pages/SignIn.tsx` (unit test: T056a)
- [X] T057a [P] [US1] Unit tests for the API client covering error-shape parsing and session expiry in `frontend/tests/unit/services/api.spec.ts`
- [X] T058 [US1] Implement API client for auth and projects in `frontend/src/services/api.ts` (unit test: T057a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/005-identity-signin/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T177 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/005-identity-signin/closure.md`
- [X] T178 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/005-identity-signin/closure.md`
- [X] T179 Triage `specs/005-identity-signin/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/005-identity-signin/closure.md`
- [X] T180 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/005-identity-signin/closure.md`

---

## Phase D · Defect remediation — `DEF-005-001` *(appended 2026-08-20 by the first local UAT)*

**Why this phase exists**: the epic closed 15 / 15 with every test green, and the running
application still returns **500** on sign-in with verified-good credentials.
[`DEF-005-001`](./defects/DEF-005-001-sign-in-cannot-work-in-the-running-application.md) records
the proof: `PrismaUserDirectory` is built, unit-tested, and bound at no composition root, so
`LocalIdentityProvider` throws `UserDirectoryUnavailableError` on every sign-in.

**The ordering is the point.** `T830` is written first and must **fail against the code as it
stands today** — a test that passes before the fix would be re-proving what `T024a` already
proves with a mocked directory, which is precisely the check that could not see this defect.

- [X] T830 Write a failing integration test that boots the **real module graph** (`AppModule`, no
      mocked identity provider) against a Testcontainers PostgreSQL, seeds a workspace and user
      with an Argon2id hash, and asserts `POST /v1/auth/sign-in` returns **200** with a session
      cookie — plus a wrong-password case returning 401 — in
      `backend/tests/integration/sign-in.spec.ts`, per `DEF-005-001` and `BR-0002`.
      **Confirm it fails with `UserDirectoryUnavailableError` before T831.** Guard with
      `DOCKER_UNAVAILABLE=1` like its siblings (RAID `R-04`)
- [X] T831 Bind `USER_DIRECTORY` to `PrismaUserDirectory` at the composition root — the same seam
      `AUDIT_WRITER` and `JOB_STORE` already use — so the adapter the epic built is the adapter the
      application runs, per `DEF-005-001` (integration test: T830)
- [X] T832 [P] Assert the wiring itself, so a future refactor cannot silently unbind it: resolve
      `USER_DIRECTORY` from the composed graph and assert it is **not** `UnconfiguredUserDirectory`,
      in `backend/tests/unit/auth/composition.spec.ts` (this is the check whose absence let a
      15 / 15 epic ship an unusable capability)
- [X] T833 Re-run the local UAT path end to end — sign in through the web client, confirm the
      session cookie carries into `GET /v1/auth/me` — and record the outcome in
      [`closure.md`](./closure.md) as a dated addendum; close `DEF-005-001` with its resolving
      tasks and verifying test named (Constitution VI)
