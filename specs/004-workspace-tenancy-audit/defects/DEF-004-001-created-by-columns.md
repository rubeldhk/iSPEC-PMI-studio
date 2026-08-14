# DEF-004-001 — `created_by` / `updated_by` are in the design DDL and absent from the schema

**Epic**: `EPIC-004` | **Raised**: 2026-08-14 | **Status**: OPEN
**Originating task**: `T013` (first migration) · found while writing `T012a`
**Severity**: MEDIUM — no current requirement fails, but the convention is stated in two places and honoured in one

## Expected

`T013`'s own task text names the universal columns as
*"`workspace_id`, `created_at/by`, `updated_at/by`"*, and `specs/_shared/schema.sql` carries
`created_by` / `updated_by` in **10 places**.

## Actual

`backend/prisma/schema.prisma` declares **zero** `createdBy` or `updatedBy` fields, so the generated
migration `20260814000000_init` creates none. Of the six tables:

| Table | `createdAt` | `updatedAt` | `createdBy` | `updatedBy` |
|---|---|---|---|---|
| `workspaces` | ✅ | ✅ | ❌ | ❌ |
| `users` | ✅ | ✅ | ❌ | ❌ |
| `projects` | ✅ | ❌ | ❌ | ❌ |
| `generation_jobs` | ✅ | ❌ | ❌ | ❌ |
| `audit_entries` | ✅ | ❌ | ❌ | ❌ |
| `engine_registrations` | ✅ | ❌ | ❌ | ❌ |

`updatedAt` is also partial — present only where a model declares `@updatedAt`.

## Reproduction

```bash
grep -c 'created_by\|updated_by' specs/_shared/schema.sql   # 10
grep -c 'createdBy\|updatedBy' backend/prisma/schema.prisma # 0
```

## Why it was not fixed in place

Adding four columns across six models is not `T013`'s scope, and it is not a mechanical change:

1. **Every write path would need an actor.** `projects`, `generation_jobs` and `audit_entries` are
   written by services that do not currently thread a user id into the repository call. Identity is
   EPIC-005, which is **held**.
2. **It would change built, passing code** in an epic whose remaining tasks are meant to unblock
   others, not widen scope.
3. **`audit_entries` already has `actorId`** — a `createdBy` on the audit table would be a second
   answer to the same question, which is a PP-002 problem rather than a fix.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Add `createdBy`/`updatedBy` to the tenant-scoped models now, nullable | Honours the stated convention; every write path must be revisited when EPIC-005 lands, and nullable provenance is weak provenance |
| **B** | Amend `_shared/schema.sql` and `T013`'s text to drop them | One source of truth restored immediately; discards a convention that was deliberately designed |
| **C** | Defer to EPIC-005 (identity), which supplies the actor the columns need | Keeps the convention, sequences it behind the thing that makes it meaningful. **Recommended** |

## Recommended resolution

**Option C.** Record the divergence, keep the schema as built, and let EPIC-005 add the columns
together with the actor propagation that gives them a value. Until then `_shared/schema.sql` should
carry a note saying so, otherwise the next reader finds the same gap and re-raises it.

## Traceability

- Requirement: **FR-002** (universal columns)
- Design: `specs/_shared/schema.sql`
- Test that would have asserted it: `backend/tests/unit/core/universal-columns.spec.ts` (`T012a`) —
  deliberately does **not** assert these columns; the reason is in its header comment
- Blocks: nothing. Recorded so it is not rediscovered.
