# ADR-0024 — Workspace Fabric execution modes

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Tech lead (architecture) · security · project owner (product boundary)

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 7.

## Context

The delivered platform has exactly one execution mode: an isolated disposable container with
deny-all-plus-allowlist egress (`ADR-0002`, `ADR-0013`, delivered by `EPIC-003`/`EPIC-028`). It
works, it is enforced, and PMI-DOC-004A §4 lists it among the things V2 must **preserve**.

It is also insufficient for two customer situations the product now targets (`BG-10`):

- an organization whose source and secrets may not leave its own cloud;
- a developer running an approved agent against a local working tree.

PMI-DOC-004A `G-16` classifies this as **enhancement required**, not replacement — the existing
sandbox model stays. `ADR-0008` (ProjectExecutionEnvironment) and `ADR-0017` (interactive workspace
versus autonomous sandbox, **Open**) already opened this ground; neither settles how governance
holds across modes.

That last question is the risk. Three execution modes with three governance models is three products.

## Decision

**One fabric, three modes, one governance contract.**

| Mode | Where | Status |
|---|---|---|
| **Managed isolated** | PMI-managed disposable environment, allowlist egress | delivered — `BR-0110`, `BR-0134` |
| **Customer cloud** | Customer-owned environment under tenant policy | architecture must support — `BR-0131` |
| **Controlled local** | Developer machine, only where tenant policy explicitly permits | optional — `BR-0132` |

**The governance contract is mode-independent and is the substance of this decision.** Identity,
permissions, context assembly, policy evaluation, audit, evidence capture and completion rules apply
**identically** in all three modes (`BR-0133`). A capability that can only be governed in managed
mode is not a capability of the fabric — it is a capability of managed mode, and must say so.

Two invariants hold everywhere:

- **Credential isolation** — an execution environment never receives platform or database
  credentials its task does not require (`BR-0135`, `ADR-0012`).
- **Explicit permission** — network and tool access is granted, never inherited from the host
  (`BR-0134`, `ADR-0013`).

**Managed isolated remains the default and the only mode assumed by core workflows.** The other two
are opt-in per tenant. `ADR-0002` is *extended* by this ADR, never superseded — the same
relationship `D-36` established between `ADR-0002` and `ADR-0013`.

## Consequences

**Positive** — the delivered `EPIC-003`/`EPIC-028` execution model is untouched and remains correct.
This ADR adds modes beside it rather than beneath it.

**Positive** — customer-cloud execution becomes a deployment question rather than a product rewrite,
which is what makes regulated and data-resident customers addressable at all.

**Negative** — controlled local execution is the weakest link in every invariant above. A developer
machine cannot offer the isolation guarantees of a disposable container, and `BR-0132` is
deliberately MAY rather than MUST for that reason. Tenant policy must opt in explicitly, and the
evidence produced there should be treated as lower-assurance.

**Negative** — "identical governance across modes" is easy to state and expensive to prove. It needs
an architecture test per invariant per mode, or it degrades quietly into "identical governance in
the mode we test".

**Open** — how evidence assurance level is represented when it varies by execution mode. `ADR-0022`
does not model assurance tiers, and this ADR does not add them. *(Closed by the amendment below.)*

## Amendment 2026-09-03 — the default flips, and assurance gets a field (`ADR-0030`, `EPIC-041`, `D-47`)

Two changes, both made by `ADR-0030` and carried out by `EPIC-041`:

| | Before | After |
|---|---|---|
| Default mode | **Managed isolated** is the default and the only mode core workflows assume; controlled local is `MAY`, opt-in per tenant | **Controlled local is the default** for a project with a root directory (`FR-LPW-035`). Managed isolated remains available, unchanged, and is the mode unattended runs (`EPIC-023`) and CI use |
| Assurance | *Open* | Every execution carries `assurance: managed \| local`, derived from its surface at registration and never supplied by the caller (`FR-LPW-034`). One field, two values (PMI-DOC-007 `D-9`). Customer cloud gets a value when it gets an owner |

What does **not** change: *the governance contract is mode-independent*. Identity, permissions,
context assembly, policy evaluation, audit, evidence capture and completion rules apply identically
(`BR-0133`, `FR-LPW-031`). Assurance is the honest label on the evidence, not a switch that relaxes
a rule; a later Epic may let tenant policy weigh it, and nothing in `EPIC-041` does.

The negative recorded above — a developer machine is the weakest link in every invariant — is not
withdrawn. It is accepted for the target user (PMI-DOC-007 §2.4), and the mitigations are the
project-scoped connector credential, the assurance label, Constitution XII.6 and secret refusal at
intake.

## Traceability

PMI-DOC-004 v2.0 §6.14 (`BR-0110`, `BR-0131`–`BR-0135`) · PMI-DOC-004A `G-16`, Amendment §7 ·
`ADR-0002` (extended, not superseded) · `ADR-0008` · `ADR-0012` · `ADR-0013` · `ADR-0017` (Open) ·
`specs/brs-v2-reconciliation.md` `U-14` · unowned
