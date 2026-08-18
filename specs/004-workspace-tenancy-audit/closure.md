# Closure record: EPIC-004 Workspace Tenancy & Audit

> ⚠️ **The epic is NOT closed.** This file exists because `T649` requires its outcome to be recorded
> here, and `T649` is now genuinely done. Phase Z (`T173`–`T176`) has not run, and `T052`, `T455`,
> `T456` remain open. Do not read this document as a closing report — Constitution IX's report will
> be added below when the epic actually closes.

## `T649` — the migration executed against a real database

**Run 2026-08-17. All six `T453` cases pass.**

For the whole life of this epic, `tasks.md` carried the warning *"the migration has never been
applied to a real database… do not report this as a working schema until `T649` runs."* `T649` has
now run. The trigger is no longer unverified SQL in a file.

```text
pnpm test:integration
✓ tests/integration/audit-immutability.spec.ts (6 tests) 6429ms
Test Files  4 passed (4)
     Tests  35 passed (35)
```

| Case | Result |
|---|---|
| applied the migration and holds the probe row | pass |
| rejects `UPDATE` | pass |
| rejects `DELETE` | pass |
| leaves the row intact after both attempts | pass |
| still permits `INSERT` — append-only, not read-only | pass |
| exposes `reject_mutation()` for the version tables EPIC-007 and EPIC-009 will add | pass |

**Environment**: Docker 28.3.3, server 28.3.3, `linux/x86_64`, via Testcontainers on the Windows named
pipe `//./pipe/docker_engine`. Nothing was skipped — the suite's `DOCKER_UNAVAILABLE=1` name-level
skip was not triggered, so these are executions, not collections.

**What this verifies, precisely**

- **`FR-033`** — audit entries are append-only, *enforced by PostgreSQL*. The distinction `T453` was
  written to defend is now evidenced: a raw `UPDATE` issued outside the service layer is rejected by
  the database. A mocked repository could never have failed this test.
- **`SC-012`** — the immutability success criterion, verified for the first time.
- **`T013` and `T454`** transitively: the migration ran, so its DDL is not merely asserted by
  `T012a`'s content check.
- **`reject_mutation()` is shared**, as `T454` requires. EPIC-007 `requirement_versions` and
  EPIC-009 `specification_versions` attach to it rather than redefining it, and the sixth case
  proves the function is there for them to attach to.

**RAID `R-04` — "no container runtime available" — is retired for this repository.** It was true when
recorded and is no longer true; a Docker daemon is reachable here.

## Still open

| Task | What it is |
|---|---|
| `T052` | Cross-workspace access returns not-found and is audited |
| `T455` / `T456` | Project-scoping composes with workspace scoping (**FR-003**) |
| `T173`–`T176` | Phase Z closure |

The epic remains ▶ **proceeding**; it is not blocked on `PMI-DOC-004`.
