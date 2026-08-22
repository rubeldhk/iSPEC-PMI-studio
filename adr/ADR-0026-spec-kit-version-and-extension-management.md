# ADR-0026 — Spec Kit engine, version and extension management

**Status**: Accepted
**Date**: 2026-08-21
**Deciders**: Tech lead (architecture) · project owner (governance of extensions)

> Created by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12 decision 9.

## Context

`ADR-0001` put Spec Kit behind a specification-engine adapter and `ADR-0007` made it an embedded
engine rather than an application dependency. Both decisions hold and neither is reopened here.

What has changed is Spec Kit itself. PMI-DOC-004A §2.5 records that as of August 2026 it is an
extensible intent-driven harness: Spec → Plan → Tasks → Implement, plus clarify/checklist/analyze
gates, multiple agent integrations, extensions, presets, bundles, programmable workflows, an
`assess` extension, a bug-fix workflow and `/speckit.converge`. This repository already carries ten
`speckit-*` skills reflecting that surface.

v1.0 `BR-0030` names Spec Kit as engine V1 but says nothing about **which version**, **which
integration**, or **which extensions** a governed project is permitted to use. PMI-DOC-004A `G-18`
classifies that as enhancement required, and `G-19` adds convergence/drift detection as missing
outright.

Two risks follow. First, business logic that hard-codes today's command names breaks when Spec Kit
renames them — and it has renamed them before. Second, an ungoverned extension is unreviewed code
shaping approved specifications.

## Decision

**Spec Kit is managed as a versioned engine dependency with a governed extension surface.**

**Version and compatibility.** A project records its engine and engine version, and the platform
records engine, engine version, execution provider and model, source inputs and generating session
on **every generated artifact** (`BR-0035`). An artifact whose provenance cannot be stated cannot be
trusted for `ADR-0022` compliance purposes.

**Lifecycle, not command names.** The adapter supports the applicable
specify/clarify/plan/checklist/tasks/analyze/implement/converge workflow **as lifecycle stages**.
Business logic binds to stages; the adapter absorbs command evolution (`BR-0034`). This is the
operative rule of PMI-DOC-004A Amendment F: *PMI Studio must not fork its business model around
current Spec Kit command names.*

**Extensions are governed artifacts.** Extensions, presets, workflows and bundles used in a governed
project must be versioned, approved or policy-allowed, and provenance-recorded (`BR-0037`). Local
and private catalogs are supported for controlled environments — an air-gapped tenant cannot depend
on a public catalog.

**Convergence is a platform capability, not a Spec Kit command.** The platform must detect and
surface missing, partial, contradictory or unrequested implementation relative to the approved
specification (`BR-0036`). `/speckit.converge` may implement it today; the requirement survives the
engine being replaced, which is the whole point of `BG-04`.

**What this does not decide**: whether PMI Studio adopts the `assess` or bug-fix extensions. Those
are product-scope choices for the owning epic, and Amendment F lists them as *where adopted*.

## Consequences

**Positive** — `BR-0036` gives specification compliance (`ADR-0022`) a concrete input. Drift
detection is the mechanism behind "the differentiator is specification compliance".

**Positive** — engine upgrades become a managed change with a compatibility statement rather than a
surprise, and artifacts generated under an older engine remain interpretable because their
provenance says which engine made them.

**Negative** — a stage-level abstraction over a fast-moving upstream will lag it. When Spec Kit adds
a genuinely new stage, the adapter cannot expose it until the abstraction admits it. This is the
accepted cost of `BG-04`, and it is a real cost.

**Negative** — extension governance adds an approval step to something Spec Kit users expect to be
frictionless. Policy-allowed catalogs mitigate this; they do not remove it.

## Traceability

PMI-DOC-004 v2.0 §6.4 (`BR-0030`, `BR-0034`–`BR-0037`) · PMI-DOC-004A `G-18`, `G-19`, Amendment F ·
`ADR-0001` (engine adapter, upheld) · `ADR-0007` (embedded engine, upheld) · `EPIC-027` capability
area *Spec Kit native lifecycle* → `EPIC-008`/`EPIC-013` · `specs/brs-v2-reconciliation.md` `U-09`,
`U-18`
