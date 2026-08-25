# Epic Specification: Engineering Context

**Epic**: `EPIC-038` | **Module**: PMI-DOC-004 v2.0 §6.10
**Feature Branch**: `epic/038-engineering-context`
**Created**: 2026-08-25
**Status**: **OWNERSHIP DECLARED** — not specified, not scheduled

**Authorised by**: the project owner's decision of 2026-08-25 (Execution Governance Remediation
Rev 3, §07 and §03), which directed that ownership be established for every application area even
where implementation is deferred.

---

## Why this Epic exists as a declaration

The **Context** area of PMI-DOC-006 §4.1 had **no owning Epic**. Its requirements were not missing —
PMI-DOC-004 v2.0 §6.10 carries them — but nothing in `specs/` claimed them, so the shell registry
recorded the area as `undeclared` and the delivery report could not distinguish *"nobody owns
this"* from *"specified, not yet built"*.

Context assembly, permission-filtered packaging and versioning. The nearest existing owner, EPIC-019 Steering, governs constraints and architecture — a different subject, which is why absorption was rejected.

**This document declares ownership and nothing more.** It carries no functional requirements of its
own, no plan, and no tasks. Those arrive when the Epic is scheduled and `/speckit-specify` runs
against §6.10 properly.

## Scope claimed

| | |
|---|---|
| **Application area** | Context (PMI-DOC-006 §4.1) |
| **Requirements** | PMI-DOC-004 v2.0 §6.10 — BR-0091 · BR-0092 · BR-0093 · BR-0094 · BR-0095 · BR-0096 |
| **Lifecycle state** | **Ownership declared** — awaiting `/speckit-specify` |
| **Priority** | **P2** |
| **Scheduling disposition** | Deferred — schedule after Requirement Room S4 (EPIC-033) |

## What this Epic does NOT claim

- No screen is delivered, partly delivered, or in progress. The registry records
  `declared-not-delivered`, which is the honest state.
- No requirement here is implemented. Ownership is a commitment to specify, not evidence of work.
- The requirement identifiers above stay authoritative in PMI-DOC-004 v2.0. This document points at
  them; it does not restate them, because a restatement is a second source that can disagree.

## Exit from this state

`/speckit-specify` against PMI-DOC-004 v2.0 §6.10, producing a real `spec.md` that supersedes
this declaration, followed by the normal journey. Until then this Epic has no Definition of Ready
and is not a candidate for implementation.
