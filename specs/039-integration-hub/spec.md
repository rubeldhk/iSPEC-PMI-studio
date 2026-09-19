# Epic Specification: Integration Hub

**Epic**: `EPIC-039` | **Module**: PMI-DOC-004 v2.0 §6.13
**Feature Branch**: `epic/039-integration-hub`
**Created**: 2026-08-25
**Status**: **OWNERSHIP DECLARED** — not specified, not scheduled

**Authorised by**: the project owner's decision of 2026-08-25 (Execution Governance Remediation
Rev 3, §07 and §03), which directed that ownership be established for every application area even
where implementation is deferred.

---

## Why this Epic exists as a declaration

The **Integrations** area of PMI-DOC-006 §4.1 had **no owning Epic**. Its requirements were not missing —
PMI-DOC-004 v2.0 §6.13 carries them — but nothing in `specs/` claimed them, so the shell registry
recorded the area as `undeclared` and the delivery report could not distinguish *"nobody owns
this"* from *"specified, not yet built"*.

Capability abstraction and third-party integration. Sequenced after EPIC-037 deliberately: the universal execution contract is the platform's first real integration surface and should set the pattern this hub generalises, rather than being retrofitted into it.

**This document declares ownership and nothing more.** It carries no functional requirements of its
own, no plan, and no tasks. Those arrive when the Epic is scheduled and `/speckit-specify` runs
against §6.13 properly.

## Scope claimed

| | |
|---|---|
| **Application area** | Integrations (PMI-DOC-006 §4.1) |
| **Requirements** | PMI-DOC-004 v2.0 §6.13 — BR-0120 · BR-0121 · BR-0122 · BR-0123 · BR-0124 · BR-0125 · BR-0126 |
| **Lifecycle state** | **Ownership declared** — awaiting `/speckit-specify` |
| **Priority** | **P2** |
| **Scheduling disposition** | Deferred — MUST follow EPIC-037 |

## What this Epic does NOT claim

- No screen is delivered, partly delivered, or in progress. The registry records
  `declared-not-delivered`, which is the honest state.
- No requirement here is implemented. Ownership is a commitment to specify, not evidence of work.
- The requirement identifiers above stay authoritative in PMI-DOC-004 v2.0. This document points at
  them; it does not restate them, because a restatement is a second source that can disagree.

## Exit from this state

`/speckit-specify` against PMI-DOC-004 v2.0 §6.13, producing a real `spec.md` that supersedes
this declaration, followed by the normal journey. Until then this Epic has no Definition of Ready
and is not a candidate for implementation.
