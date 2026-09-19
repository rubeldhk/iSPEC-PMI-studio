---
subject: ai-governance
scope: repository
version: 1
status: active
owner: project-owner
last_reviewed: 2026-08-07
supersedes: null
---

# AI Governance

## Why this exists

Most of this repository is written by AI sessions, and the product itself generates specifications
with AI. Both need the same rule: a generated artifact is a **proposal** until a human commits it,
and the record must show which is which.

## Standards

### AIG-001 · A generated artifact is provisional until a human commits it

Output produced without a human decision at the point of the decision is marked provisional, and
approving it requires an explicit, attributed override.

**Check**: unattended-run behaviour is specified and tested in
[EPIC-023](../../specs/023-unattended-runs-review/) (`FR-005a` to `FR-005c`).
**Rationale**: Principle `PP-003` Human-in-the-Loop. An unattended run never decides — it defers,
marks, and carries on. Removing the marking would make a guess indistinguishable from a decision in
the permanent record.

### AIG-002 · A deferred question records its options and the suggested answer

When a run declines to decide, it records what it would have asked, the options it considered, and
which it would have picked.

**Check**: specified and tested in [EPIC-023](../../specs/023-unattended-runs-review/) (`FR-009` to
`FR-020`).
**Rationale**: Principle `PP-016` Explainable AI. A suggestion with no visible reasoning is
reviewable only by re-deriving it, so in practice it is approved unread.

### AIG-003 · Generated output is never treated as its own source

An AI-produced statement about requirements is traced to an SRS document before it becomes a
requirement.

**Check**: SRS traceability table per epic spec; see [`./product.md`](./product.md) `PRD-001`.
**Rationale**: Principle `PP-017`. Otherwise a plausible generated sentence enters the corpus and is
cited by the next generation as though it were sourced — the failure compounds quietly and is
almost impossible to unpick later.

### AIG-004 · Session work is attributable

Every change made in an AI session is traceable to that session through its branch and its closing
report.

**Check**: `G-08` asserts branch naming matches the convention in
[`../session-labelling.md`](../session-labelling.md); Constitution IX
([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)) requires the closing
report.
**Rationale**: When several sessions contribute to one epic, "who changed this and what were they
working on" has to be answerable from the repository rather than from memory.

### AIG-005 · An unrun check is never reported as passing

A session's report distinguishes what was executed from what was assumed.

**Check**: `G-09` asserts the honesty rule is stated in
[`../closing-report.md`](../closing-report.md); enforcement is at review.
**Rationale**: The most expensive failure mode of an AI session is a confident summary of work that
was not verified. Everything downstream is then built on a claim nobody checked, and the cost of
discovering it grows with every epic.

## Deliberately not covered here

- **The engine boundary and sandbox controls** — [`./architecture.md`](./architecture.md) and
  [`./security.md`](./security.md).
- **Which AI provider is used** — [`specs/_shared/tech-stack.md`](../../specs/_shared/tech-stack.md)
  and [EPIC-013](../../specs/013-engine-api-selection/).
- **Product principles PP-001 to PP-020** — `SRS/PMI-DOC-003`, bound by decision **D-6**.
