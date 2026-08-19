# ADR-0005 — Principles bind the programme, not each Epic

**Status**: Accepted
**Date**: 2026-08-03
**Deciders**: Project owner
**Supersedes**: nothing. **Related**: decision D-6 in `specs/srs-alignment.md`

## Context

PMI-DOC-003 declares twenty product principles *"mandatory for all future specifications, designs,
and implementations."*

Three of them cannot be satisfied by any early Epic:

- **PP-007** (API & MCP First) requires MCP, which lives in a module two roadmap phases out
- **PP-013** (Knowledge-Driven Engineering) requires the Knowledge Platform module
- **PP-019** (Continuous Improvement) requires DORA/SPACE measurement over delivery history that
  does not yet exist

Read as binding on every Epic individually, the principles make the first Epic undeliverable by
definition. Read as merely aspirational, they lose all force.

## Decision

Principles bind the **programme**. Every Epic must carry a **Principle Conformance & Deferrals
register** declaring its position on all twenty — *Satisfied*, *Partial*, *Deferred*, or *Not
applicable* — and for every deferral, the reason, an owner, and the module or phase that discharges
it.

**A deferral is a debt, not permission to skip.** It is reviewed at the Epic's convergence gate
(Constitution IV). A deferral whose owner or destination has gone stale is a convergence failure.

The register is enforced through `.specify/templates/spec-template.md`, so every future spec
inherits the obligation rather than depending on anyone remembering.

## Consequences

**Positive**

- An unexplained deferral becomes indistinguishable from an oversight — which is what the register
  prevents. A deferral must be *argued*, not merely *absent*.
- Two deferrals produced concrete design constraints rather than vague promises:
  - **PC-1** (from PP-007): services must be callable without the REST layer, so MCP can be added
    in Phase 3 without redesign. Enforced by an architecture test (T142a).
  - **PC-2** (from PP-017): cost *containment* ships now via job caps; cost *optimisation* goes to
    the AI Platform module.
- PP-010 was reconsidered rather than deferred by default, and **adopted** (decision D-7).

**Negative**

- Twenty rows per Epic spec is real overhead, and the register can become box-ticking if reviewed
  carelessly. The convergence-gate review (T151a) is the guard against that.

**Rejected alternatives**

- *Bind every Epic individually* — makes EPIC-001 impossible; would force either dishonest claims of
  conformance or an indefinite pause.
- *Treat principles as advisory* — discards governance the SRS explicitly mandates.

## Traceability

- Source: `SRS/PMI-DOC-003_Product_Principles_v1.0.docx`
- Decision: D-6 in `specs/srs-alignment.md`
- Registers: EPIC-001 and EPIC-002 `spec.md`
- Template: `.specify/templates/spec-template.md`
- Constraints: `system-design.md` PC-1, PC-2, PC-3
- Tasks: T142a (PC-1 enforcement), T151a (register review at closure)
