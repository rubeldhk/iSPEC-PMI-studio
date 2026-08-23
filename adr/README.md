# Architecture Decision Records

Required by **PMI-DOC-000 §9** (*"Every significant architectural decision requires an ADR"*),
**PMI-DOC-003** (Architecture Implications), and **PMI-PLAN-001 F-00.1** (deliverable: ADR
repository).

## Format

`ADR-nnnn-short-title.md`, numbered from `ADR-0001`. Each records: Status, Context, Decision,
Consequences, and Traceability.

## Status values

`Proposed` → `Accepted` → `Superseded by ADR-nnnn`

## Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-0001](./ADR-0001-spec-kit-behind-engine-adapter.md) | Spec Kit behind a specification engine adapter | Accepted | 2026-08-02 |
| [ADR-0002](./ADR-0002-container-sandbox-for-engine-execution.md) | Container sandbox for engine execution | Accepted | 2026-08-02 |
| [ADR-0003](./ADR-0003-typescript-nestjs-postgresql-stack.md) | TypeScript / NestJS / PostgreSQL stack | Accepted | 2026-08-02 |
| [ADR-0004](./ADR-0004-one-way-external-storage-publishing.md) | One-way publishing to external storage | Accepted | 2026-08-02 |
| [ADR-0005](./ADR-0005-principles-bind-programme-not-epic.md) | Principles bind the programme, not each Epic | Accepted | 2026-08-03 |

## Note

These five were **back-filled on 2026-08-03** from decisions already recorded in
`specs/_shared/research.md`, `specs/_shared/raid-log.md`, and `specs/srs-alignment.md`. The
decisions were made and reasoned at the dates shown; only the ADR form is new.

**EPIC-016** builds ADRs as a **product feature** (FR-034, `architecture_decision_records` table).
This directory is the programme's own ADR record — a separate thing, and the reason the programme
does not depend on its own product to govern itself.
| [ADR-0006](./ADR-0006-ai-agent-gateway-provider-independence.md) | AI Agent Gateway and provider independence | Accepted | 2026-08-17 |
| [ADR-0007](./ADR-0007-spec-kit-embedded-engine.md) | Spec Kit as an embedded engine, not an application dependency | Accepted | 2026-08-17 |
| [ADR-0008](./ADR-0008-project-execution-environment-abstraction.md) | ProjectExecutionEnvironment abstraction | Accepted | 2026-08-17 |
| [ADR-0009](./ADR-0009-persistent-project-state-vs-ephemeral-execution.md) | Persistent project state versus ephemeral agent execution | Accepted | 2026-08-17 |
| [ADR-0010](./ADR-0010-pmi-studio-mcp-architecture.md) | PMI Studio MCP architecture | Open | 2026-08-17 |
| [ADR-0011](./ADR-0011-agent-context-authorization.md) | Agent context authorization | Open | 2026-08-17 |
| [ADR-0012](./ADR-0012-agent-credential-isolation.md) | Agent credential isolation | Accepted | 2026-08-17 |
| [ADR-0013](./ADR-0013-controlled-network-egress.md) | Controlled network egress | Accepted | 2026-08-17 |
| [ADR-0014](./ADR-0014-source-of-truth-boundaries.md) | Source-of-truth boundaries between PostgreSQL, Git, Spec Kit and the agent workspace | Accepted | 2026-08-17 |
| [ADR-0015](./ADR-0015-requirement-change-defect-governance-authority.md) | Requirement, Change and Defect governance authority | Accepted | 2026-08-17 |
| [ADR-0016](./ADR-0016-tdd-defect-execution-policy.md) | TDD defect execution policy | Open | 2026-08-17 |
| [ADR-0017](./ADR-0017-interactive-workspace-vs-autonomous-sandbox.md) | Interactive developer workspace versus autonomous agent sandbox | Open | 2026-08-17 |
| [ADR-0018](./ADR-0018-governed-engineering-loops.md) | Governed Engineering Loops as a shared workflow abstraction | Open | 2026-08-17 |
| [ADR-0019](./ADR-0019-context-engine-composition.md) | Context Engine composition — four capabilities, not one store | Open | 2026-08-17 |
| [ADR-0020](./ADR-0020-engineering-expert-model.md) | Engineering Expert model for registered agents | Accepted | 2026-08-17 |
| [ADR-0021](./ADR-0021-governed-learning.md) | Governed Learning — agent observations are not knowledge | Open | 2026-08-17 |
| [ADR-0022](./ADR-0022-specification-compliance-and-evidence.md) | Specification compliance and evidence as the differentiator | Open | 2026-08-17 |
| [ADR-0023](./ADR-0023-capability-resolver-integration-hub.md) | Capability Resolver and the Integration Hub boundary | Accepted | 2026-08-21 |
| [ADR-0024](./ADR-0024-workspace-fabric-execution-modes.md) | Workspace Fabric execution modes | Accepted | 2026-08-21 |
| [ADR-0025](./ADR-0025-risk-adaptive-policy-engine.md) | Risk-adaptive policy engine | Accepted | 2026-08-21 |
| [ADR-0026](./ADR-0026-spec-kit-version-and-extension-management.md) | Spec Kit engine, version and extension management | Accepted | 2026-08-21 |
| [ADR-0027](./ADR-0027-durable-agent-session.md) | Durable Agent Session independent of the execution provider | Accepted | 2026-08-21 |
| [ADR-0028](./ADR-0028-application-ux-architecture.md) | Application UX architecture as a document separate from the design system | Accepted | 2026-08-21 |
| [ADR-0029](./ADR-0029-target-product-versus-release-scope.md) | Target-product scope versus release scope versus declared Epic scope | Accepted | 2026-08-21 |

> **ADR-0006 to ADR-0022 added 2026-08-17** by EPIC-027 (`T627`, `T659`) under decision `D-35`.
> Native §27 names twelve subjects and Cosmos §9 names five more; all seventeen are recorded now,
> each either **Accepted** or **Open naming what it awaits**. Native §26 forbids answering by
> assumption, and an ADR that exists as an open question is what prevents one.
>
> **ADR-0001 to ADR-0005 are preserved.** `ADR-0002` is *extended* by `ADR-0013` (controlled network
> egress), never superseded — decision `D-36`. `G-27-07` asserts both facts.

> **ADR-0023 to ADR-0029 added 2026-08-21** by **PMI-DOC-004 v2.0** under PMI-DOC-004A §12, which
> names twelve architecture decisions the V2 scope model requires. Five already existed —
> `ADR-0018`, `ADR-0019`, `ADR-0020`, `ADR-0021`, `ADR-0022` — and these seven are the remainder.
> All seven are **Accepted**: each records a boundary the BRS depends on. Most describe capability
> with **no owning epic**, which is a delivery gap recorded in
> [`specs/brs-v2-reconciliation.md`](../specs/brs-v2-reconciliation.md) §4, not an open question in
> the decision itself.
>
> **PMI-DOC-004 v2.0 was approved 2026-08-22**, discharging the PMI-DOC-004 half of the **Awaits**
> clause on five records — `ADR-0010`, `ADR-0015`, `ADR-0018`, `ADR-0021` and `ADR-0022`. Each
> stays **Open** on its remaining blocker — an owning epic — except `ADR-0015`, whose second
> blocker was the project owner's confirmation of `EPIC-027` **Finding A**. That confirmation came
> on **2026-08-22**, so `ADR-0015` moved Open → **Accepted**: the three Rooms are **builds, not
> enhancements**. Every discharge is dated in the record itself, so a reader sees what was
> released and what still holds.
>
> `ADR-0002` remains extended — never superseded — by `ADR-0013` and now also by `ADR-0024`
> (Workspace Fabric adds execution modes beside the container sandbox, not beneath it).
