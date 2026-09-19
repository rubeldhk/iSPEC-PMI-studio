# ADR-0025 — Risk-adaptive policy engine

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Project owner (governance posture) · security · tech lead

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 8.

## Context

v1.0 governance is role-based and uniform: `BR-0060` requires named review gates with
role-appropriate approvers, and `RULE-02` (now `RULE-03`) requires a human to approve scope, gates
and releases. This is correct for consequential decisions and **wrong as a universal rule** — it
taxes trivial automation at the same rate as a production release.

PMI-DOC-004A `G-27` classifies this as *enhancement required* and the accepted amendment states the
direction plainly: human approval becomes **risk-adaptive rather than mandatory for every AI
action**.

The obvious failure mode is equally plain. "Risk-adaptive" is one bad default away from "the AI
decided it was low risk and shipped it". The governing constraint is `RULE-11` / `BR-0069`: no
invisible automation.

## Decision

**Risk is classified, policy decides, and the decision is always explainable.**

**Classification** (`BR-0066`). Every governed action carries a risk/impact class. Classification is
a property of the action and its target — modifying an approved baseline is high risk regardless of
who asks — and is **policy-declared, not model-inferred**. An Engineering Expert may propose a
class; it may not assign its own.

**Three bands** (`BR-0067`):

| Band | Treatment |
|---|---|
| **Low** | MAY auto-execute where policy permits |
| **Medium** | Requires policy and evidence gates — automated, but not unconditional |
| **High / consequential** | Requires authorized human approval; no policy may waive this |

**Four constraints bind the engine**, and they are the reason this is safe enough to adopt:

1. **The high band is not configurable away.** Baseline changes, release promotion, and any action
   PMI-DOC-004 marks as requiring authorized human decision stay human-approved regardless of tenant
   policy (`BR-0046`, `BR-0025`, `RULE-03`).
2. **No silent bypass.** A skipped required gate is a recorded violation or an explicit recorded
   exception — never a pass (`BR-0060`, carried unchanged from v1.0).
3. **Explainability is mandatory.** Any consequential action that was allowed or blocked must be
   explainable by the policy and risk decision that produced the result (`BR-0174`). An
   unexplainable allow is a defect.
4. **Auto-execution is still audited and still produces evidence.** Low risk means *no human in the
   loop*, not *no record* (`BR-0111`, `BR-0142`).

The engine is the **Decide** stage of the Governed Engineering Loop (`ADR-0018`), not a parallel
mechanism. Rooms do not each get their own policy logic.

## Consequences

**Positive** — `RULE-04` becomes implementable: low-risk automation stops waiting on humans, which
is most of the productivity claim in `BG-02`.

**Positive** — the approval burden becomes tunable per tenant without reopening the product's
governance guarantees, because constraint 1 fences what tuning can reach.

**Negative** — misclassification is now a security-relevant defect class. An action wrongly labeled
low risk auto-executes. This argues for conservative defaults and for treating classification rules
as reviewed artifacts under `BR-0070` steering, not as configuration.

**Negative** — the engine sits on the critical path of every governed action, so its availability
and latency become product concerns.

**Open** — whether risk classification is expressed in the same steering hierarchy as engineering
constraints (`BR-0070`–`BR-0072`) or in a separate policy artifact. The owning epic (`U-07`) decides.

## Traceability

PMI-DOC-004 v2.0 §6.7 (`BR-0060`, `BR-0066`, `BR-0067`, `BR-0069`), §6.18 (`BR-0174`) ·
`RULE-03`, `RULE-04`, `RULE-11` · PMI-DOC-004A `G-27` · `ADR-0018` (Decide stage) ·
`specs/brs-v2-reconciliation.md` `U-07` · unowned
