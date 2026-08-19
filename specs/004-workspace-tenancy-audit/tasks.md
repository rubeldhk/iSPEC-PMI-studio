---

description: "Task list for EPIC-004 — Workspace Tenancy & Audit"
---

# Tasks: Workspace Tenancy & Audit

**Epic**: `EPIC-004` | **Module**: M-01 / M-13 | **Tasks**: 29

> **Counted, not quoted.** This number is recomputed by `/speckit-analyze`; the phase and function sections below are its composition. It drifted before because two documents restated it and neither was derived — EPIC-018 read 31 here, 32 in the index and 34 in its task list, and by the time `T529` came to reconcile them the real figures were 31 / 37 / 38. **The remediation went stale before it ran.** Corrected by `T686`.

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

  > ⚠️ **The migration has never been applied to a real database.** Its *content* is asserted by `T012a`; its *execution* happens for the first time inside `T453`, which needs a container runtime. ~~Do not report this as a working schema until `T649` runs.~~ **`T649` ran 2026-08-17 — the migration has been applied to a real PostgreSQL and the trigger fires.**
  >
  > **Column naming is camelCase**, not the snake_case of `_shared/schema.sql`. `tech-stack.md` makes `schema.prisma` authoritative at implementation and the design DDL "design-level"; the built application reads `workspaceId` throughout. **`createdBy`/`updatedBy` are absent** — recorded as `defects/DEF-004-001-created-by-columns.md`, not invented here.

## F-01.2 · Workspace scoping and isolation

*FR-002 and SC-004. Cross-workspace access returns not-found, never forbidden — existence is not disclosed.*

- [X] T011 [P] Write failing unit tests for workspace-scoping helpers in `backend/tests/unit/core/workspace-scope.spec.ts`
- [X] T014 Implement workspace-scoping query helper enforcing `workspace_id` on every read in `backend/src/core/workspace-scope.ts` (**FR-002**; unit test: T011)
- [X] T015 [P] Write failing unit tests asserting cross-workspace access returns not-found, never forbidden, in `backend/tests/unit/core/workspace-guard.spec.ts`
- [X] T016 Implement workspace context guard in `backend/src/core/workspace.guard.ts` (unit test: T015)
- [X] T052 [P] [US1] Integration test asserting cross-workspace project access returns not-found and is audited, in `backend/tests/integration/workspace-isolation.spec.ts`

  > **The helper's own output builds the SQL.** `selectWhere()` reads whatever keys `scoped()` put in
  > `where` and emits one equality per key; nothing in the test knows the word *workspace*. So if the
  > helper ever stops emitting `workspaceId`, the `WHERE` clause loses the filter and the test sees
  > the other tenant's row — **it fails by leaking, not by shape**, which is the difference between
  > this and the unit test.
  >
  > Three mutations confirm it: dropping the workspace filter from `scoped()` fails three assertions;
  > silencing the guard's `onRefused` fails the two audit assertions; making the refusal message
  > differ from a genuine absence fails the `SC-004` comparison.
  >
  > One assertion was wrong on the first run and is worth keeping in mind: asking for another
  > workspace correctly returns **your own rows**, not an empty set, because the scope is applied
  > last and wins. An empty-result assertion there would also have passed against a helper producing
  > a query that matched nothing at all.

### Project scoping *(added 2026-08-08 — closes analysis finding **C4**)*

*`FR-003` is co-owned with EPIC-006 and had **zero** task coverage here. EPIC-006 `T054` builds the
projects service; the generic mechanism that stops content leaking between projects belongs with the
scoping helper, which lives in this epic.*

- [X] T455 [P] [US1] Write failing unit tests asserting the scoping helper enforces `project_id` on project-scoped reads with no leakage between projects, and that project scoping composes with workspace scoping rather than replacing it (**FR-003**), in `backend/tests/unit/core/project-scope.spec.ts`
- [X] T456 [US1] Extend the scoping query helper to apply project scoping alongside workspace scoping in `backend/src/core/workspace-scope.ts` (**FR-003**; unit test: T455)

  > **Composition, not substitution.** `projectScoped` delegates to `scoped()` rather than filtering
  > on `projectId` beside it. The tempting implementation reasons that a project belongs to exactly
  > one workspace, so the workspace filter is redundant — but tenancy is enforced by the filter,
  > never by an id's provenance. A guessed, leaked or copied project id reaches another tenant's
  > content with **no boundary at all**. Delegating means the workspace scope cannot be dropped
  > without deleting a call.
  >
  > Two mutations confirm the tests can fail: making project scoping *replace* workspace scoping
  > fails three assertions including the headline one; reversing the spread so a caller's `projectId`
  > wins fails two. `projectScopedCreate` is included because a row is only reachable by a scoped
  > read if something stamped both ids on it.

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

  > ~~**Written and never executed.**~~ **Executed 2026-08-17 by `T649` — all six cases pass.** The
  > suite was written to skip *by name* under `DOCKER_UNAVAILABLE=1` rather than pass silently, and
  > that skip was never triggered: these are executions. `reject_mutation()` has now raised.

- [X] T649 **MANUAL** — run `pnpm test:integration` on a machine with a container runtime; confirm all
  six `T453` cases pass and record the outcome in `specs/004-workspace-tenancy-audit/closure.md`
  (verifies T013, T454; **FR-033**, **SC-012**)

  > **Run 2026-08-17 — all six pass.** Docker 28.3.3 was found to be available on this machine after
  > all; the suite ran against a real PostgreSQL via Testcontainers in 6.4s. `reject_mutation()` has
  > now raised: a raw `UPDATE` and a raw `DELETE` issued outside the service layer were both rejected
  > **by the database**, the row survived intact, and `INSERT` still succeeds — append-only, not
  > read-only. **`FR-033` and `SC-012` are verified for the first time in this programme**, and the
  > "written and never executed" warning on `T454` above is discharged. Outcome recorded in
  > [`closure.md`](./closure.md).

---

## Phase 1: Convergence *(appended 2026-08-18 by `/speckit-converge`, task `T174`)*

*Four findings, all `partial` — nothing in this epic is missing, and two things it built are
unreachable. `F1` is the gap `EnginesModule` already names in its own header from `T462`:
**"fully built, fully tested, and unreachable."* The audit layer is the same shape, still open, in
the epic that owns `FR-033`.*

- [X] T674 Provide `AuditService` and `AuditController` from `AuditModule` behind an injectable `AuditWriter` token, following the `EnginesModule`/`T462` factory-provider pattern, so the API exposes `/v1/audit` and only the persistence adapter remains outstanding, in `backend/src/modules/audit/audit.module.ts` per **FR-033** (partial) — HIGH
- [X] T674a [P] Write failing unit tests asserting the module provides the service and registers the controller, and that the writer is supplied by token rather than constructed, in `backend/tests/unit/audit/audit.module.spec.ts` (Constitution V; covers T674)
- [X] T675 Record that `assertSameWorkspace` has no production caller — no endpoint yet fetches a workspace-scoped resource — and name the epic that supplies the first one, in `specs/004-workspace-tenancy-audit/closure.md` per **FR-002**, **SC-004** (partial) — HIGH
- [X] T676 Re-scope the `plan.md` definition-of-done items for quickstart `V2` and `V12` with a named owner: both need sign-in (EPIC-005, held) and a persistence adapter, so neither is dischargeable by this epic alone, in `specs/004-workspace-tenancy-audit/closure.md` per **plan: definition of done** (partial) — MEDIUM
- [X] T677 Add the divergence note `DEF-004-001`'s recommended resolution calls for to `specs/_shared/schema.sql`, and close the defect as deferred to EPIC-005 with that owner recorded, per **Constitution VI** (partial) — MEDIUM

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/004-workspace-tenancy-audit/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T173 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/004-workspace-tenancy-audit/closure.md`
- [X] T174 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/004-workspace-tenancy-audit/closure.md`
- [X] T175 Triage `specs/004-workspace-tenancy-audit/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/004-workspace-tenancy-audit/closure.md`
- [X] T176 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/004-workspace-tenancy-audit/closure.md`
