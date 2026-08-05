# Implementation Plan: Workspace Tenancy & Audit

**Epic**: `EPIC-004` | **Modules**: M-01 / M-13 | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Tasks**: 19 · [tasks.md](./tasks.md) | **Posture**: ▶ **PROCEEDING** (decision D-10)

**Shared design** — not duplicated here: [`../_shared/`](../_shared/)
([schema](../_shared/schema.sql) · [data-model](../_shared/data-model.md) ·
[system-design](../_shared/system-design.md) · [RAID](../_shared/raid-log.md))

## Summary

The tenancy boundary and the audit trail — the two guarantees every other epic assumes and none of
them re-implements.

Small in task count, disproportionately important: **if workspace scoping is wrong, every feature
built on top of it leaks data**, and the failure is silent. This epic exists to make that
impossible by construction rather than by discipline.

## Scope

| Function | Tasks | What it delivers |
|---|---|---|
| F-01.1 Workspace and user data foundation | 4 | `Workspace`, `User`, universal column convention, first migration |
| F-01.2 Workspace scoping and isolation | 5 | Scoping query helper, workspace guard, cross-workspace integration test |
| F-13.1 Audit trail | 6 | `AuditEntry`, append-only service, transactional interceptor, read-only endpoint |

**Out of scope**: authentication and sign-in (EPIC-005), RBAC and SSO (Phase 3).

## Technical Context

Inherited from [`../_shared/plan.md`](../_shared/plan.md). Specific to this epic:

**Tenancy is multi-tenant-ready on a single-user surface.** Every table carries `workspace_id` from
the **first** migration, so Phase 3 row-level security becomes a switch rather than a data
migration. That decision was settled by clarification and is not revisited here.

**Scoping is a helper, not a convention.** Every repository read goes through a scoping function
that applies `workspace_id`. A query that bypasses it is a test failure, not a code-review comment.

**Audit is transactional.** The interceptor writes the audit entry inside the **caller's**
transaction, so an action cannot succeed without its audit entry, and a rolled-back action leaves no
orphan audit row. This is the part most likely to be got subtly wrong.

## Constitution Check

| # | Gate | Status |
|---|------|--------|
| I | Code produced only via Spec Kit commands | PASS |
| II | Requirements trace to cited SRS documents | PASS — via [platform-spec](../_shared/platform-spec.md) |
| III | Epic → Feature → Task decomposition | PASS — 3 functions, 19 tasks |
| IV | `/speckit-converge` scheduled as the exit gate | PASS |
| V | Every implementation task carries a unit test, written to fail first | PASS — 0 gaps |
| VI | `specs/004-workspace-tenancy-audit/defects/` exists | PASS |
| VII | Promotion follows local → dev → stage → prod | PASS |
| — | Repository synced from GitHub before work | PASS |
| — | No other Claude session on this checkout | PASS — asserted by the operator |
| — | Principle register present, deferrals argued (D-6) | PASS — PP-008 partial (RBAC/SSO Phase 3) |
| — | Design constraints honoured (PC-1, PC-2) | PASS — the audit endpoint is read-only and delegates to a service |

**Post-design re-check**: PASS. Constitution II is *strengthened* here — the audit trail is what
makes traceability claims verifiable after the fact rather than asserted.

## Design notes specific to this epic

**404, not 403.** A resource in another workspace returns **not found**. Returning *forbidden* would
confirm the resource exists, which is itself a disclosure. Asserted by T015 and by the integration
test T052 against a real database.

**Mocking the database here would be worthless.** SC-004 ("zero artifacts visible across a workspace
boundary") is a claim about what the *database* returns under a real query. That is why T052 uses
Testcontainers rather than a mock — a mocked repository would pass while the real query leaked.

**Audit immutability is enforced twice.** In code, no update or delete path exists. In the database,
a trigger raises on `UPDATE` or `DELETE` against `audit_entries`. Belt and braces is justified here
because an audit trail that can be edited is not an audit trail.

**Every refused access is recorded.** A refusal writes an audit entry with `outcome = 'refused'`
*before* the response is sent. Otherwise the interesting security events — the ones that were
blocked — are exactly the ones with no trace.

## Build order

```text
F-01.1 workspace + user schema
   └─► F-01.2 scoping helper + guard ──► F-13.1 audit (needs workspace context)
```

**Depends on EPIC-001 F-00.3** (error taxonomy) — the guard returns typed errors, and the 404-not-403
behaviour is expressed through the shared error shape.

**Blocks EPIC-001 F-00.4** — `generation_jobs` needs the workspace column convention from F-01.1.
See the interleave table in [EPIC-001's plan](../001-platform-foundation/plan.md).

## Phase 1 Outputs

Implements existing shared artifacts; adds none:

- [`../_shared/schema.sql`](../_shared/schema.sql) — `workspaces`, `users`, `audit_entries`, the
  `reject_mutation()` trigger, universal columns
- [`../_shared/data-model.md`](../_shared/data-model.md) — universal rules; Workspace, User,
  AuditEntry entities
- [`../_shared/contracts/platform-api.md`](../_shared/contracts/platform-api.md) — the read-only
  `/v1/audit` endpoint and the 404-not-403 rule
- [`../_shared/quickstart.md`](../_shared/quickstart.md) — V2 workspace isolation, V12 audit completeness

## Definition of done

- [ ] 19 tasks complete, every unit test passing (Constitution V)
- [ ] Quickstart **V2** passes — a cross-workspace request returns **404**, and the attempt appears
      in `/v1/audit`
- [ ] Quickstart **V12** passes — create, edit, lifecycle transition, engine invocation, and refused
      access all present; **no write or delete path to audit exists**
- [ ] Integration test T052 green against a **real** PostgreSQL via Testcontainers
- [ ] Database trigger rejects `UPDATE` and `DELETE` on `audit_entries`
- [ ] `/speckit-converge` reports no unbuilt work
- [ ] `defects/` has no open records
