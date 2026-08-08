---
subject: product
scope: repository
version: 1
status: active
owner: product-owner
last_reviewed: 2026-08-07
supersedes: null
---

# Product

## Why this exists

PMI Studio is an AI-native engineering platform that turns requirements into specifications and
implementation tasks. Roughly a third of the requirements written for it so far had no traceable
source document — they were reasonable, and they were invented. This file states what a claim about
the product must be able to show.

## Standards

### PRD-001 · Every product requirement cites an SRS source

A functional requirement names the source document and section it derives from, in the epic's SRS
traceability table.

**Check**: the SRS traceability table in each `specs/<epic>/spec.md`, reviewed at epic approval.
**Rationale**: Constitution II ([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md))
makes the SRS the source of truth. A requirement with no source is a
preference wearing a requirement's identifier, and it will be defended as if it were sourced.

### PRD-002 · An unsourced requirement is marked, not quietly kept

Where a capability has no SRS source, the epic records the debt explicitly and names the back-fill
owner. The back-fill gates **approval**, not merely closure.

**Check**: SRS-debt notice present in the epic spec; verified at approval.
**Rationale**: Gating closure instead of approval lets a whole epic be built on an invented premise
before anyone checks — the cost of being wrong is then a rewrite rather than an edit.

### PRD-003 · Capability claims name the epic that delivers them

A statement that PMI Studio does something links to the epic where it is specified, or is marked as
not yet specified.

**Check**: manual review; the epic index in [`specs/README.md`](../../specs/README.md) is the
register.
**Rationale**: The roadmap is long enough that "the platform supports X" is ambiguous between
built, specified, and hoped for. Those three need different conversations.

### PRD-004 · Held work is described as held, never as cancelled or as done

An epic awaiting an input records what it awaits.

**Check**: the delivery-posture notice in each held epic spec (decision **D-10**).
**Rationale**: 141 tasks currently wait on `PMI-DOC-004`. They are complete, reviewed and
Constitution V compliant — they await an input, not more design. Describing them as incomplete
would invite someone to redo finished work.

## Deliberately not covered here

- **The product vision and charter** — `SRS/PMI-DOC-001` and `SRS/PMI-DOC-002`.
- **Product principles PP-001 to PP-020** — `SRS/PMI-DOC-003`, bound programme-wide by decision
  **D-6** and registered per epic.
- **Business rules** — [`./business-rules.md`](./business-rules.md), awaiting `PMI-DOC-004`.
