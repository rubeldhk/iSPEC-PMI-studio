# DEF-038-005 — the platform has no actor role to record

**Epic**: `EPIC-038` | **Raised**: 2026-10-08 | **Status**: DEFERRED to `EPIC-024`
**Originating task**: `T1831` (convergence finding against `FR-CTX-031`) · **Severity**: MEDIUM

## Finding

`FR-CTX-031` lists the actor's **role** among assembly's inputs, and `SC-CTX-001` requires every
package to record the actor and budget it was assembled under. Every package records
`actorRole = 'unspecified'`.

That is not this Epic declining to read a role; there is none to read. `WorkspaceContext` carries
`workspaceId` and `userId` only (`backend/src/core/workspace.guard.ts`). The `users` table has no
role. `WorkspaceBoundaryService` says so in its own header: *"There are no roles here, no
permissions, no hierarchy — the authorisation decision still belongs entirely to EPIC-024's
grants."*

What assembly *does* use is the actor's **permissions**, through `EPIC-024`'s adjudicator
(`access.adapter.ts`, `T1258`). The role is the half of `FR-CTX-031` with no source in the
programme.

## Why deferred

Inventing a role here — from grants, from the session, from a default — would be a second access
model, which `FR-CTX-054` forbids. When `EPIC-024` (or the identity Epic) introduces roles, the
controller reads it from the session in one line and the recorded `'unspecified'` stops appearing.
Until then the placeholder is stated, not blank: `''` would record that nobody had one.
