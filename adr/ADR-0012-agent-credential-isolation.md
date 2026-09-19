# ADR-0012 — Agent credential isolation

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Native §8 requires provider authentication to be abstracted and credentials to remain outside
application-visible project content. `D-31` (multi-tenant SaaS) escalated this from important to
**blocking**: in SaaS, PMI Studio holds customer AI provider credentials and mints repository tokens
on their behalf, so *"secrets are an environment concern"* is definitively dead.

## Decision

**Per-run minted, purpose-scoped, short-lived credentials** (`D-27`). A broker mints a token per
run, scoped to one repository and one branch, expiring with the run. **No long-lived secret ever
enters a sandbox.**

`ScopedCredentialRef` carries a ref and never a value, so a credential cannot leak through a logged
request object, a serialised error or a test fixture. A ref without `expiresAt` is rejected, and an
unresolvable ref fails the run **before any container starts**.

**BYOK is a near-term requirement** (`D-41`): tenant-owned AI provider keys put model spend on the
tenant's account. The two credential models coexist — delegation for repositories, ownership for
spend.

## Consequences

**Positive** — `RAID R-02` (unbounded AI cost) is mitigated structurally rather than by caps
alone, which is the first structural mitigation after three epics flagged it.

**Negative** — onboarding friction: a tenant must supply a key before running an agent.

**Accepted cost** — the broker **is not built**, has no owning epic, and `R-AI-011` (secure git
credential delegation) is uninvestigated. The type seam exists and is validated; the mechanism does
not.

## Traceability

D-27 · D-31 · D-41 · R-AI-011 · RAID R-02 · EPIC-028 (seam only)
