---
subject: workspace
scope: repository
version: 1
status: active
owner: tech-lead
last_reviewed: 2026-08-07
supersedes: null
---

# Workspace

## Why this exists

Two sessions editing one working copy produce a diff neither of them intended, and neither can say
which half is theirs. Constitution VIII exists to prevent that; this file states the mechanics.

## Standards

### WS-001 · One session, one working copy

A second concurrent session clones into a separate working copy rather than sharing the first one.

**Check**: manual — the session's opening step confirms the working copy is unshared.
**Rationale**: Concurrent edits to the same tree cannot be attributed after the fact, and the loser
is usually discovered at commit time when the context that produced the change is gone.

### WS-002 · Synchronise before starting, not before committing

Work starts from an up-to-date tree.

**Check**: manual — recorded in the session's opening step.
**Rationale**: Rebasing a finished change is strictly harder than starting from the current one, and
the conflicts arrive when the work is already believed to be done.

### WS-003 · Host ports are parameterised, never fixed

Every host port published by [`docker-compose.yml`](../../docker-compose.yml) reads from an
environment variable with a default — `${PMI_POSTGRES_PORT:-5432}`.

**Check**: `docker compose config` resolves without a port collision on a machine already running
another project's database.
**Rationale**: Discovered concretely: ports 5432 and 6379 were already held by unrelated projects on
the development machine. Hard-coding them makes this repository hostile to any machine that runs
anything else.

### WS-004 · Local first, then dev, stage, prod — no skipped environment

A change reaches an environment only from the one below it.

**Check**: manual at promotion; Constitution VII governs.
**Rationale**: Skipping an environment means the first machine to run the change in a realistic
configuration is the one users are on.

### WS-005 · Generated and installed artifacts stay out of version control

`node_modules/`, build output, coverage and `.env` files are ignored, and the ignore rules live with
the tool that produces them.

**Check**: `git status --porcelain` is clean after `pnpm install` and `pnpm build`.
**Rationale**: A dirty tree after an ordinary build trains everyone to ignore `git status`, which is
where the real accidents then hide.

## Deliberately not covered here

- **Session labelling and branch naming** — [`../session-labelling.md`](../session-labelling.md).
- **Which environments exist and what promotes between them** — Constitution VII, in
  [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md).
- **CI configuration** — [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), owned by
  [EPIC-014](../../specs/014-devops-release/).
