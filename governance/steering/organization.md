---
subject: organization
scope: repository
version: 1
status: active
owner: project-owner
last_reviewed: 2026-08-07
supersedes: null
---

# Organization

## Why this exists

Three roles carry decision rights on this programme, and almost every stalled item in the RAID log
is stalled because nobody could say whose call it was. This file names the roles and binds each
open decision to one of them.

## Standards

### ORG-001 · Three programme roles, named on every governed artifact

Ownership is expressed as one of exactly three roles — `tech-lead`, `product-owner`,
`project-owner` — never as an individual's name.

**Check**: `G-02` rejects any steering file whose `owner` is outside the three roles.
**Rationale**: A file owned by a person becomes unowned the day that person changes team. A file
owned by a role survives staff changes, which is the whole point of writing the owner down.

### ORG-002 · Every open decision has a named owner

An entry in the decision register ([`specs/srs-alignment.md`](../../specs/srs-alignment.md)) states
which role resolves it. An open decision with no owner is a decision nobody is making.

**Check**: manual review at epic closure — the closure report confirms every deferral this epic
touches retains a valid owner. Constitution VI requires this; `G-07` does not attempt it.
**Rationale**: Decisions D-1, D-2, D-4, D-9 and D-13 have been open across several epics. Each
stayed open because it was everyone's to raise and no one's to settle.

### ORG-003 · Deferral is recorded, not implied

Where a principle from `PMI-DOC-003` is not satisfied in an epic, the epic's principle register
records the deferral, its reason, and the role that owns it.

**Check**: per-epic principle conformance register, verified at closure (decision **D-6**).
**Rationale**: An unrecorded deferral is indistinguishable from an oversight six months later, and
the two need opposite responses.

### ORG-004 · Decisions are recorded where they are looked for

A decision that changes how the programme is built is recorded in the decision register; a decision
that changes the shape of the software is recorded as an [ADR](../../adr/). Not both, and not
neither.

**Check**: manual review at epic closure.
**Rationale**: Two registers with overlapping content produce the failure this whole epic exists to
prevent — a second source of truth that silently forks.

## Deliberately not covered here

- **The workflow those roles operate** — Constitution III governs the Epic → Feature → Task chain;
  see [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md).
- **The RAID log itself** — [`specs/_shared/raid-log.md`](../../specs/_shared/raid-log.md).
- **Product-side roles and permissions** — a product capability, specified in
  [EPIC-021](../../specs/021-review-gates-roles/), not a repository standard.
