---

description: "Task list for EPIC-004 — Workspace Tenancy & Audit"
---

# Tasks: Workspace Tenancy & Audit

**Epic**: `EPIC-004` | **Module**: M-01 / M-13 | **Tasks**: 14

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here depends on the
> Business Requirement Specification.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-01.1 · Workspace and user data foundation

- [X] T011a [P] Write failing unit tests asserting `Workspace`/`User` schema constraints — required `workspace_id`, unique email, `password_hash` never selected — in `backend/tests/unit/core/schema-constraints.spec.ts`
- [X] T012 Initialise Prisma and define `Workspace` and `User` models in `backend/prisma/schema.prisma` (unit test: T011a)
- [X] T013 Add universal columns (`workspace_id`, `created_at/by`, `updated_at/by`) convention and first migration in `backend/prisma/migrations/`

## F-01.2 · Workspace scoping and isolation

*FR-002 and SC-004. Cross-workspace access returns not-found, never forbidden — existence is not disclosed.*

- [X] T011 [P] Write failing unit tests for workspace-scoping helpers in `backend/tests/unit/core/workspace-scope.spec.ts`
- [X] T014 Implement workspace-scoping query helper enforcing `workspace_id` on every read in `backend/src/core/workspace-scope.ts` (unit test: T011)
- [X] T015 [P] Write failing unit tests asserting cross-workspace access returns not-found, never forbidden, in `backend/tests/unit/core/workspace-guard.spec.ts`
- [X] T016 Implement workspace context guard in `backend/src/core/workspace.guard.ts` (unit test: T015)
- [ ] T052 [P] [US1] Integration test asserting cross-workspace project access returns not-found and is audited, in `backend/tests/integration/workspace-isolation.spec.ts`

## F-13.1 · Audit trail

- [X] T027 [P] Write failing unit tests asserting an audit entry is written in the same transaction and that no update or delete path exists, in `backend/tests/unit/audit/audit.spec.ts`
- [X] T028 Define `AuditEntry` model in `backend/prisma/schema.prisma` and implement the append-only audit service in `backend/src/modules/audit/audit.service.ts` (unit test: T027)
- [X] T028a [P] Write failing unit tests asserting the interceptor writes audit inside the caller's transaction and that a failed action rolls back its audit entry, in `backend/tests/unit/audit/audit.interceptor.spec.ts`
- [X] T029 Implement transactional audit interceptor in `backend/src/modules/audit/audit.interceptor.ts` (unit test: T028a)
- [X] T029a [P] Write failing unit tests asserting the audit controller exposes no write or delete route in `backend/tests/unit/audit/audit.controller.spec.ts`
- [X] T030 [P] Implement read-only `/audit` endpoint in `backend/src/modules/audit/audit.controller.ts` (unit test: T029a)
