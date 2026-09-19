---
subject: coding-standards
scope: repository
version: 1
status: active
owner: tech-lead
last_reviewed: 2026-08-07
supersedes: null
---

# Coding Standards

## Why this exists

Most of this repository's code will be written in sessions that do not share context with each
other. Standards that can be checked mechanically survive that; conventions held in someone's head
do not.

## Standards

### CS-001 · Exported functions declare an explicit return type

Every function exported from a module states its return type.

**Check**: ESLint, configured in [`eslint.config.js`](../../eslint.config.js).
**Rationale**: An inferred return type changes silently when the body changes. Consumers find out
at their own call sites, often in a different package.

### CS-002 · Failure reasons come from a closed set

A failure is one of the named reasons in `packages/engine-contract` — there is no `unknown` member.

**Check**: `pnpm test:unit`, which enumerates `ENGINE_FAILURE_REASONS` and asserts exhaustive
handling.
**Rationale**: An `unknown` member is where every unclassified failure goes to be ignored. Forcing a
named reason means a new failure mode is a compile error at each site that must decide what to do
about it.

### CS-003 · A misclassified failure is a defect, even when the code path works

Where a mechanism can produce two indistinguishable outcomes, the code distinguishes them
explicitly.

**Check**: `pnpm test:unit` — test `T045a` asserts a wall-clock timeout is reported as a timeout.
**Rationale**: Discovered concretely — aborting a shared controller on timeout made the engine
report `cancelled`, so a systemic timeout looked like ordinary user behaviour in every metric. The
fix was a `timedOutByLimit` flag and a reclassifier.

### CS-004 · A cross-tenant read returns 404, never 403

A request for a resource in another workspace is answered as though the resource does not exist.

**Check**: `pnpm test:unit` covers `workspace.guard.ts`; `ForbiddenError` is deliberately absent
from `backend/src/core/errors.ts`.
**Rationale**: 403 confirms the resource exists. That is an enumeration oracle handed to the one
caller who should learn nothing.

### CS-005 · Workspace scope is applied last and overrides the caller

Query scoping is applied after caller-supplied filters, not merged with them.

**Check**: `pnpm test:unit` covers `workspace-scope.ts`.
**Rationale**: If a caller can contribute to the scope clause, a caller can widen it. Applying scope
last makes the safe outcome structural rather than a matter of remembering.

### CS-006 · No credential is logged, including inside diagnostics

Secrets do not reach a log line, a metric label, an error message, or a diagnostics payload.

**Check**: `pnpm test:unit` covers the logger redaction path; reviewed at code review.
**Rationale**: `diagnostics` is the field people add "just this once" for debugging, and it is the
field that gets shipped to an aggregator.

### CS-007 · Audit rows are immutable at the database

Audit tables reject `UPDATE` and `DELETE` by trigger, not by convention.

**Check**: migration under `backend/prisma/`, asserted by an integration test.
**Rationale**: An audit trail the application can rewrite records what the application currently
believes, which is not what an audit trail is for. Enforcement belongs below the code that would be
compromised.

## Deliberately not covered here

- **The test discipline itself** — Constitution V, in
  [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md), makes unit tests
  non-negotiable.
- **Formatting** — delegated to the formatter configuration; not a matter for a standard.
- **Interface code conventions** — [`./ui-standards.md`](./ui-standards.md).
