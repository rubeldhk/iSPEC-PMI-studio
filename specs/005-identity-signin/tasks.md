---

description: "Task list for EPIC-005 — Identity & Sign-in"
---

# Tasks: Identity & Sign-in

**Epic**: `EPIC-005` | **Module**: M-01 | **Tasks**: 15

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-01.3 · Authentication and session

*Catalog epic overlap: Security & Governance → Authentication. Behind an identity-provider boundary so Phase 3 SSO replaces an adapter, not the request pipeline.*

- [ ] T021 [P] Write failing unit tests for Argon2id hashing and verification in `backend/tests/unit/auth/password.spec.ts`
- [ ] T022 Implement password hashing service in `backend/src/modules/auth/password.service.ts` (unit test: T021)
- [ ] T023 [P] Write failing unit tests for the identity-provider boundary interface in `backend/tests/unit/auth/identity-provider.spec.ts`
- [ ] T024 Implement identity-provider interface and local implementation in `backend/src/modules/auth/identity-provider.ts` (unit test: T023)
- [ ] T024a [P] Write failing unit tests for the auth controller with a mocked identity provider, covering sign-in success, rejection, and session teardown, in `backend/tests/unit/auth/auth.controller.spec.ts`
- [ ] T025 Implement session sign-in, sign-out, and `me` endpoints in `backend/src/modules/auth/auth.controller.ts` (unit test: T024a)
- [ ] T026 [P] Write contract tests for `/auth/*` against `contracts/platform-api.md` in `backend/tests/contract/auth.spec.ts`

## F-01.4 · Sign-in experience and API client

- [ ] T056a [P] [US1] Component unit tests for the sign-in page covering submit, error, and redirect in `frontend/tests/unit/pages/SignIn.spec.tsx`
- [ ] T057 [P] [US1] Implement sign-in page and session handling in `frontend/src/pages/SignIn.tsx` (unit test: T056a)
- [ ] T057a [P] [US1] Unit tests for the API client covering error-shape parsing and session expiry in `frontend/tests/unit/services/api.spec.ts`
- [ ] T058 [US1] Implement API client for auth and projects in `frontend/src/services/api.ts` (unit test: T057a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/005-identity-signin/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T177 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/005-identity-signin/closure.md`
- [ ] T178 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/005-identity-signin/closure.md`
- [ ] T179 Triage `specs/005-identity-signin/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/005-identity-signin/closure.md`
- [ ] T180 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/005-identity-signin/closure.md`
