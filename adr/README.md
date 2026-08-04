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
