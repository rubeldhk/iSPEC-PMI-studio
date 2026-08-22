# ADR-0027 — Durable Agent Session independent of the execution provider

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Tech lead (architecture) · project owner (product boundary)

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 10.

## Context

`ADR-0006` established provider independence for the AI Agent Gateway and `ADR-0020` defined the
Engineering Expert as a registered governed role. `ADR-0009` separated persistent project state from
ephemeral agent execution. Together they say *who* may execute and *where state lives* — but not
what the **record of an execution** is.

That record is the gap. PMI-DOC-004A `G-17` notes that provider replaceability is stated while agent
integration is not productized, and Amendment C states the requirement directly: *agent sessions
must be durable platform records even when actual code execution happens in Claude Code, Cursor,
Codex, Augment, GitHub Copilot or another compatible provider.*

If the session record lives in the provider, three things follow, all bad. Audit
(`BR-0111`, `BR-0171`) becomes a query against a third party. Evidence (`ADR-0022`) is only as
durable as a vendor's retention policy. And switching providers loses history, which makes `BG-04`
true on paper and false in practice.

## Decision

**The Agent Session is a first-class PMI Studio record. The provider is an attribute of it.**

Every Engineering Expert run creates a durable session record linking (`BR-0104`):

- the invoking workflow, loop stage and governed object;
- the **Context Package version** supplied (`ADR-0019`, `BR-0093`);
- the Expert identity and contract version (`ADR-0020`, `BR-0102`);
- the execution provider and model actually used;
- the execution mode and environment (`ADR-0024`);
- actions and tool calls taken (`BR-0171`);
- outputs produced;
- evidence emitted (`BR-0140`);
- the outcome, and any escalation or policy decision that shaped it.

**Four rules give the record its value:**

1. **The record outlives the provider session.** Provider transcripts may be referenced; they may
   not be the only copy of anything the platform must retain.
2. **Delegation is attributable.** A sub-agent or delegated Expert gets its own session record,
   linked to its parent (`BR-0105`). A tree of work that resolves to one session record is not
   auditable.
3. **The effective access snapshot is retained.** Permission-sensitive execution keeps the access
   and policy state it began with (`BR-0062`, `ADR-0011`), so a later permission change does not
   rewrite what a past run was allowed to do.
4. **Budgets are enforced against the session**, where the provider exposes the necessary controls
   (`BR-0106`).

**The same governed role executes through multiple providers without changing workflow semantics**
(`BR-0103`). Where a provider cannot supply a required field — token cost, for instance — the
session records its absence rather than omitting it silently.

## Consequences

**Positive** — audit, evidence and traceability stop depending on a vendor. `BR-0080` (trace chain)
gains the *execution session* edge it needs to connect a task to the code and evidence it produced.

**Positive** — provider comparison becomes possible on the platform's own data: the same Expert,
same Context Package, different provider.

**Negative** — the platform must model an execution surface it does not control, and providers
expose different fidelity. The session schema must tolerate partial data without treating partial as
equivalent to complete.

**Negative** — session records are the highest-volume governed record the platform will hold.
Retention and storage cost is a real design constraint, not an afterthought.

**Open** — retention policy per session class, and whether provider transcripts are copied or
referenced. `EPIC-028` delivered the seam; the owning epic (`U-11`) decides retention.

## Traceability

PMI-DOC-004 v2.0 §6.11 (`BR-0101`–`BR-0106`, `BR-0061`), §6.18 (`BR-0062`, `BR-0171`) ·
PMI-DOC-004A `G-17`, Amendment C · `ADR-0006` · `ADR-0009` · `ADR-0011` · `ADR-0019` · `ADR-0020` ·
`ADR-0024` · `EPIC-028` (seam delivered) · `specs/brs-v2-reconciliation.md` `U-11`
