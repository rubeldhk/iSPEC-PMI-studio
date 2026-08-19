# ADR-0014 — Source-of-truth boundaries between PostgreSQL, Git, Spec Kit and the agent workspace

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Conflict `C-23`, the deepest design question in the amendment: the same specification would
exist as a PostgreSQL row **and** as tracked markdown. Native §6 names the hazard — *"Avoid two
uncontrolled sources of truth"* — and §22 proposes a boundary while leaving the rules undefined.

## Decision

**PostgreSQL is authoritative for governance state; markdown is a one-way projection** (`D-29`).

Native §22 is adopted verbatim: the agent workspace and the AI conversation are **not
authoritative**, and generated output becomes authoritative only through a governed lifecycle
transition.

The `specs/` tree inside an execution environment is **read-mostly for agents**. An agent that edits
a specification produces a **diff for review, never a change**.

Git remains authoritative for implementation history.

## Consequences

**Positive** — "what was approved" is answerable from exactly one place.

**Negative, stated plainly** — the repository tree can visibly drift from the database between
regenerations, and engineers will occasionally read a stale spec in the repo.

The alternative — git authoritative for content — was rejected because approval state would then
point at content the governance store does not hold.

## Traceability

C-23 · D-29 · Native §6 · Native §22 · EPIC-009
