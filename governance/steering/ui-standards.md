---
subject: ui-standards
scope: repository
version: 1
status: active
owner: product-owner
last_reviewed: 2026-08-07
supersedes: null
---

# UI Standards

## Why this exists

SRS Volume 8, which governs interface design for PMI Studio, is not yet written. This file states
only what can be held true without it, and marks the rest as deferred rather than inventing it.
Inventing interface standards now would create a document Volume 8 then has to argue with.

## Standards

### UI-001 · Interface code is reviewed against the same standards as service code

The rules in [`./coding-standards.md`](./coding-standards.md) apply to the React application, not
only to backend packages.

**Check**: ESLint and `pnpm test:unit` run across the whole workspace, including the frontend
project.
**Rationale**: A separate, laxer standard for interface code is how a codebase acquires two
qualities of code, and the interface is the half users actually touch.

### UI-002 · The interface never displays a raw failure reason

A failure surfaced to a user is mapped to a message written for that user; the underlying reason
stays in the failure taxonomy.

**Check**: `pnpm test:unit` — the taxonomy's presentation mapping is covered per reason.
**Rationale**: Raw reasons leak internal structure and read as accusations. They are also unstable:
renaming an internal reason should not change what a user sees.

### UI-003 · Every state a request can be in has a defined presentation

Loading, empty, error and partial states are specified alongside the success state, not added after.

**Check**: per-feature acceptance criteria in the owning epic's spec.
**Rationale**: The states added later are the ones users hit on a slow connection or an empty
account — that is, on their first visit.

### UI-004 · Interface specifics defer to SRS Volume 8

Where this file is silent — visual language, component inventory, layout, accessibility conformance
level, localisation — the answer is deferred to Volume 8 and must not be settled here.

**Check**: `G-04` rejects restatement of governed text; this file states no visual standard for a
check to contradict.
**Rationale**: A placeholder standard is worse than an acknowledged gap. It gets cited, built
against, and then contradicted by the document that was always going to govern.

**Back-fill owner**: product-owner. Volume 8 is tracked in the
[RAID log](../../specs/_shared/raid-log.md).

## Deliberately not covered here

- **Visual design, components, accessibility level, localisation** — SRS Volume 8, not yet written.
- **The specification interface itself** — [EPIC-010](../../specs/010-specification-interface/).
- **General code standards** — [`./coding-standards.md`](./coding-standards.md).
