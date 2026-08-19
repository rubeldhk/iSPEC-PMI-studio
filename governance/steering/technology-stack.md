---
subject: technology-stack
scope: repository
version: 1
status: active
owner: tech-lead
last_reviewed: 2026-08-07
supersedes: null
---

# Technology Stack

## Why this exists

The chosen technologies and their versions are recorded in
[`specs/_shared/tech-stack.md`](../../specs/_shared/tech-stack.md) and
[`specs/_shared/dependencies.md`](../../specs/_shared/dependencies.md). This file does not restate
that list — it states the rules for changing it, which is where the expensive mistakes are made.

## Standards

### TS-001 · A new runtime dependency is justified in the dependency register

Adding a dependency records what it is for, what was considered instead, and its licence, in
[`specs/_shared/dependencies.md`](../../specs/_shared/dependencies.md).

**Check**: `pnpm install` diff reviewed against the register at code review.
**Rationale**: Every dependency is a permanent maintenance obligation and a supply-chain surface.
The register makes the obligation visible at the moment it is taken on, when it is still cheap to
decline.

### TS-002 · Licences are checked before adoption, not at release

A dependency's licence is confirmed compatible before it enters `package.json`.

**Check**: recorded in the dependency register entry.
**Rationale**: Redis moved to a source-available licence, which is why this programme runs
**Valkey**. Discovering that at release means either a rushed swap or shipping something that
cannot be shipped.

### TS-003 · Versions are pinned by the lockfile, and the lockfile is committed

`pnpm-lock.yaml` is committed and treated as part of the source.

**Check**: CI installs with a frozen lockfile; a drifted lockfile fails the build.
**Rationale**: An unpinned tree means the build that passed CI is not the build that ships, and the
difference surfaces as a defect with no reproducible cause.

### TS-004 · Every workspace package typechecks independently

Each package defines a `typecheck` script that runs against its own `tsconfig`.

**Check**: `pnpm -r typecheck` in CI.
**Rationale**: Discovered concretely — the root `typecheck` script passed while two adapter
packages had no `tsconfig.json` at all and were never checked. An aggregate script that silently
skips packages reports success it has not earned.

### TS-005 · An empty test suite is a failure, except where emptiness is expected

`--passWithNoTests` is applied to the contract and integration projects only. Unit and architecture
suites fail when they collect nothing.

**Check**: the `test:*` scripts in [`package.json`](../../package.json).
**Rationale**: Discovered concretely — CI failed on `No test files found` for a suite that was
legitimately empty. Applying the flag everywhere would have hidden the opposite failure: a unit
suite that stops matching its own files and silently passes forever.

## Deliberately not covered here

- **Which technologies are chosen** — [`specs/_shared/tech-stack.md`](../../specs/_shared/tech-stack.md).
- **Why the stack was chosen** — [ADR-0003](../../adr/ADR-0003-typescript-nestjs-postgres.md).
- **Third-party integration boundaries in the product** — [EPIC-025](../../specs/025-external-storage-publishing/).
