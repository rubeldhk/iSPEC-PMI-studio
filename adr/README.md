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
| [ADR-0015](./ADR-0015-requirement-change-defect-governance-authority.md) | Requirement, Change and Defect governance authority | Open | 2026-08-17 |
| [ADR-0016](./ADR-0016-tdd-defect-execution-policy.md) | TDD defect execution policy | Open | 2026-08-17 |
| [ADR-0017](./ADR-0017-interactive-workspace-vs-autonomous-sandbox.md) | Interactive developer workspace versus autonomous agent sandbox | Open | 2026-08-17 |
| [ADR-0018](./ADR-0018-governed-engineering-loops.md) | Governed Engineering Loops as a shared workflow abstraction | Open | 2026-08-17 |
| [ADR-0019](./ADR-0019-context-engine-composition.md) | Context Engine composition — four capabilities, not one store | Open | 2026-08-17 |
| [ADR-0020](./ADR-0020-engineering-expert-model.md) | Engineering Expert model for registered agents | Accepted | 2026-08-17 |
| [ADR-0021](./ADR-0021-governed-learning.md) | Governed Learning — agent observations are not knowledge | Open | 2026-08-17 |
| [ADR-0022](./ADR-0022-specification-compliance-and-evidence.md) | Specification compliance and evidence as the differentiator | Open | 2026-08-17 |

> **ADR-0006 to ADR-0022 added 2026-08-17** by EPIC-027 (`T627`, `T659`) under decision `D-35`.
> Native §27 names twelve subjects and Cosmos §9 names five more; all seventeen are recorded now,
> each either **Accepted** or **Open naming what it awaits**. Native §26 forbids answering by
> assumption, and an ADR that exists as an open question is what prevents one.
>
> **ADR-0001 to ADR-0005 are preserved.** `ADR-0002` is *extended* by `ADR-0013` (controlled network
> egress), never superseded — decision `D-36`. `G-27-07` asserts both facts.
