# ADR-0029 — Target-product scope versus release scope versus declared Epic scope

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Project owner (scope authority)

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 12. This ADR records the
> structural decision that PMI-DOC-004 v2.0 §3.5 makes.

## Context

PMI-DOC-004 v1.0 §3 ruled: *"The approved Phase 1 scope is the 28 declared Epics."* As a **release
gate** this was exactly right, and it did its job — it released 19 held Epics through the
Definition-of-Ready gate, which is why v1.0 was written.

As a **product definition** it has a structural flaw, recorded as PMI-DOC-004A `G-37`: it makes
declared delivery scope and product scope the same statement. A capability the programme has decided
to build is absent from the BRS until someone declares an Epic for it.

That flaw produced the `G-07` and `G-14` scope conflicts. v1.0 deferred the Knowledge Platform and
the MCP Marketplace; the accepted Augment/Cosmos amendment then made context curation and MCP
capability abstraction core to the differentiator. Both documents were approved. Both were correct
under their own model. The disagreement was structural, not editorial.

The `EPIC-027` register shows the same shape from the delivery side: **sixteen of twenty capability
areas held behind PMI-DOC-004**, and three with no owning epic at all. Those sixteen were decided
product direction that no approved document listed as in-scope.

## Decision

**Three scopes, separately ruled, separately changed.**

| Scope | Means | Ruled in | Changes by |
|---|---|---|---|
| **Target Product Scope** | Capability PMI Studio is committed to as a product | PMI-DOC-004 §3.1–§3.3 | **MAJOR** revision of PMI-DOC-004 |
| **Release Scope** | Capability approved for a specific release | PMI-DOC-004 §10, slices `R1`–`R7` | **MINOR** revision of PMI-DOC-004 |
| **Declared Delivery Scope** | Epics decomposed far enough to enter DOR | `governance/epic-stage-register.md` | Epic declaration — **never** by editing PMI-DOC-004 |

**The operative rule**: a capability MUST NOT disappear from the BRS because no Epic has been
declared for it. An in-scope requirement with no owning Epic is a **recorded gap**, not an absence
(PMI-DOC-004 v2.0 §13, `specs/brs-v2-reconciliation.md` §4).

Three consequences of the split are themselves decisions:

1. **Deferral splits into two different acts.** "Not in this release" is a MINOR change. "Not in
   this product" is a MAJOR one. v1.0 could not distinguish them, which is why `G-14` looked like a
   contradiction rather than a sequencing statement.
2. **The stage register keeps its authority and gains no new power.** PMI-DOC-004 never declares an
   Epic or changes a posture. `epic-declarations.json` remains the only hand-authored input to the
   register, and derived state stays derived (`BR-0113`).
3. **v1.0's scope ruling remains valid as a release record** (`RULE-12`). It is `R1` in the new
   model, not an error to be corrected.

## Consequences

**Positive** — the BRS can state the whole product without over-committing delivery, and the
delivery gate keeps working exactly as before. This is what makes v2.0 an amendment rather than a
reset.

**Positive** — the 71 unowned requirements become visible and countable instead of invisible. What
was previously "not in the BRS" is now "in scope, no owner, `U-nn`" — a planning input rather than
a silence.

**Negative** — target scope is a commitment with no delivery date attached, which is a promise that
can age badly. `RULE-15` requires a MAJOR revision to withdraw one, so withdrawal is deliberate and
visible; it is still a promise.

**Negative** — three scopes means three places to check before answering "is X in scope?". The
answer is now three answers. That is more honest and less convenient.

**Negative** — the gap register must be maintained or it rots. A requirement whose Epic was declared
but whose `U-nn` row still reads *unowned* is worse than no register.

## Traceability

PMI-DOC-004 v2.0 §3.5, §10, §13, `RULE-12`, `RULE-15` · PMI-DOC-004 v1.0 §3 (preserved as `R1`) ·
PMI-DOC-004A `G-07`, `G-14`, `G-22`, `G-24`, `G-25`, `G-26`, `G-37`, Amendment A ·
`EPIC-027` capability-area register (16 held, 3 unowned) · `governance/epic-stage-register.md` ·
`specs/brs-v2-reconciliation.md`
