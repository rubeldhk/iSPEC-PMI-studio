---

description: "Task list for EPIC-004 — Workspace Tenancy & Audit"
---

# Tasks: Workspace Tenancy & Audit

**Epic**: `EPIC-004` | **Module**: M-01 / M-13 | **Tasks**: 23

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
- [X] T012a [P] Write failing unit tests asserting the generated migration applies the universal columns (`workspace_id`, `created_at/by`, `updated_at/by`) to **every** table, not only `Workspace` and `User`, in `backend/tests/unit/core/universal-columns.spec.ts`
- [X] T013 Add universal columns (`workspaceId`, `createdAt`) convention and first migration in `backend/prisma/migrations/20260814000000_init/` (unit test: T012a) — **done 2026-08-14**. Prisma installed (`prisma`, `@prisma/client` v5); migration generated **offline** via `prisma migrate diff --from-empty --to-schema-datamodel`, since `prisma migrate dev` needs a live database and none is available here.

  > ⚠️ **The migration has never been applied to a real database.** Its *content* is asserted by `T012a`; its *execution* happens for the first time inside `T453`, which needs a container runtime. Do not report this as a working schema until `T649` runs.
  >
  > **Column naming is camelCase**, not the snake_case of `_shared/schema.sql`. `tech-stack.md` makes `schema.prisma` authoritative at implementation and the design DDL "design-level"; the built application reads `workspaceId` throughout. **`createdBy`/`updatedBy` are absent** — recorded as `defects/DEF-004-001-created-by-columns.md`, not invented here.

## F-01.2 · Workspace scoping and isolation

*FR-002 and SC-004. Cross-workspace access returns not-found, never forbidden — existence is not disclosed.*

- [X] T011 [P] Write failing unit tests for workspace-scoping helpers in `backend/tests/unit/core/workspace-scope.spec.ts`
- [X] T014 Implement workspace-scoping query helper enforcing `workspace_id` on every read in `backend/src/core/workspace-scope.ts` (**FR-002**; unit test: T011)
- [X] T015 [P] Write failing unit tests asserting cross-workspace access returns not-found, never forbidden, in `backend/tests/unit/core/workspace-guard.spec.ts`
- [X] T016 Implement workspace context guard in `backend/src/core/workspace.guard.ts` (unit test: T015)
- [ ] T052 [P] [US1] Integration test asserting cross-workspace project access returns not-found and is audited, in `backend/tests/integration/workspace-isolation.spec.ts`

### Project scoping *(added 2026-08-08 — closes analysis finding **C4**)*

*`FR-003` is co-owned with EPIC-006 and had **zero** task coverage here. EPIC-006 `T054` builds the
projects service; the generic mechanism that stops content leaking between projects belongs with the
scoping helper, which lives in this epic.*

- [ ] T455 [P] [US1] Write failing unit tests asserting the scoping helper enforces `project_id` on project-scoped reads with no leakage between projects, and that project scoping composes with workspace scoping rather than replacing it (**FR-003**), in `backend/tests/unit/core/project-scope.spec.ts`
- [ ] T456 [US1] Extend the scoping query helper to apply project scoping alongside workspace scoping in `backend/src/core/workspace-scope.ts` (**FR-003**; unit test: T455)

## F-13.1 · Audit trail

- [X] T027 [P] Write failing unit tests asserting an audit entry is written in the same transaction and that no update or delete path exists, in `backend/tests/unit/audit/audit.spec.ts`
- [X] T028 Define `AuditEntry` model in `backend/prisma/schema.prisma` and implement the append-only audit service in `backend/src/modules/audit/audit.service.ts` (unit test: T027)
- [X] T028a [P] Write failing unit tests asserting the interceptor writes audit inside the caller's transaction and that a failed action rolls back its audit entry, in `backend/tests/unit/audit/audit.interceptor.spec.ts`
- [X] T029 Implement transactional audit interceptor in `backend/src/modules/audit/audit.interceptor.ts` (unit test: T028a)
- [X] T029a [P] Write failing unit tests asserting the audit controller exposes no write or delete route in `backend/tests/unit/audit/audit.controller.spec.ts`
- [X] T030 [P] Implement read-only `/audit` endpoint in `backend/src/modules/audit/audit.controller.ts` (unit test: T029a)

### Database-level immutability *(added 2026-08-08 — closes analysis finding **C1**)*

*`spec.md` states audit tables **reject `UPDATE` and `DELETE` at the database level**, and `plan.md`
says immutability is "enforced twice — in code… in the database, a trigger raises". `T028` delivered
only the code half. **No task built the trigger**, so the epic's own definition of done contained an
item nothing produced — and it is the half that survives a bug in the service layer.*

- [X] T453 [P] Write failing integration test asserting `UPDATE` and `DELETE` against `audit_entries` are rejected **by the database**, not merely absent from the service — issued as raw SQL against a real PostgreSQL via Testcontainers, since a mocked repository cannot fail this (**FR-033**, **SC-012**), in `backend/tests/integration/audit-immutability.spec.ts`
- [X] T454 Add the shared `reject_mutation()` function and the `audit_entries_immutable` `BEFORE UPDATE OR DELETE` trigger, per `../_shared/schema.sql`, to the migration in `backend/prisma/migrations/` (**FR-033**; integration test: T453; depends on T013). The **function is shared** — EPIC-007 `requirement_versions` and EPIC-009 `specification_versions` attach their own triggers to it and must not redefine it

  > **Written and never executed.** `T453` asserts the trigger against a real PostgreSQL via
  > Testcontainers, and **no container runtime is available here** (RAID **R-04**). The suite is
  > collected and skips *by name* under `DOCKER_UNAVAILABLE=1` — it is never silently passed. The
  > trigger SQL is therefore unverified: `reject_mutation()` has never raised.

- [ ] T649 **MANUAL** — run `pnpm test:integration` on a machine with a container runtime; confirm all
  six `T453` cases pass and record the outcome in `specs/004-workspace-tenancy-audit/closure.md`
  (verifies T013, T454; **FR-033**, **SC-012**)

  > This is the first execution of the migration against a real database and the first proof that
  > audit immutability is enforced by PostgreSQL rather than asserted in a comment. Phase Z must not
  > close without it.

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/004-workspace-tenancy-audit/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T173 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/004-workspace-tenancy-audit/closure.md`
- [ ] T174 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/004-workspace-tenancy-audit/closure.md`
- [ ] T175 Triage `specs/004-workspace-tenancy-audit/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/004-workspace-tenancy-audit/closure.md`
- [ ] T176 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/004-workspace-tenancy-audit/closure.md`
