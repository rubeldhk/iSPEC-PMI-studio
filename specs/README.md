# PMI Studio — Epic Index

**Restructured 2026-08-03.** What was a single 215-task EPIC-001 is now **15 epics**, cut along the
SRS's own hierarchy: MPS Volume 6 §1 places Epics *below* Modules, and the old EPIC-001 spanned ten
of them.

## Structure

```text
specs/
├── _shared/          architecture, schema, contracts, research, RAID — ONE source of truth
│   ├── platform-spec.md      36 FRs · 8 user stories · 12 success criteria · principle register
│   ├── plan.md               technical context, constitution check, project structure
│   ├── system-design.md      components, PC-1..PC-3 constraints, sandbox design
│   ├── data-model.md · schema.sql · contracts/
│   ├── research.md           12 decisions with alternatives
│   └── raid-log.md           risks, assumptions, issues, dependencies
├── srs-alignment.md  conflicts C-01..C-17, decisions D-1..D-14
└── <epic>/           spec.md · tasks.md · checklists/ · defects/
```

Requirements are defined **once** in `_shared/platform-spec.md`. Each epic's `spec.md` declares
which it *owns*. Architecture is never duplicated — fifteen copies of a schema would become fifteen
divergent truths.

## Epics

### ▶ Proceeding — 74 tasks

Buildable now. Nothing here depends on the Business Requirement Specification.

| Epic | Title | Module | Tasks |
|------|-------|--------|-------|
| [EPIC-001](./001-platform-foundation/) | Platform Foundation | M-00 | 31 |
| [EPIC-003](./003-specification-engine/) | Specification Engine & Sandbox | M-08 | 29 |
| [EPIC-004](./004-workspace-tenancy-audit/) | Workspace Tenancy & Audit | M-01 / M-13 | 14 |

### ⏸ Held — 141 tasks

Blocked on `PMI-DOC-004` Business Requirement Specification and approved business scope
(PMI-TASK-001 T-101, T-106; decision D-10; RAID **D-K**). Held is not cancelled — these tasks are
complete, reviewed, and Constitution V compliant.

| Epic | Title | Module | Tasks |
|------|-------|--------|-------|
| [EPIC-005](./005-identity-signin/) | Identity & Sign-in | M-01 | 11 |
| [EPIC-006](./006-project-management/) | Project Management | M-02 | 9 |
| [EPIC-007](./007-requirement-intelligence/) | Requirement Intelligence | M-03 | 18 |
| [EPIC-008](./008-spec-authoring-generation/) | Specification Authoring & Generation | M-04 | 19 |
| [EPIC-009](./009-spec-lifecycle-versioning/) | Specification Lifecycle & Versioning | M-04 | 22 |
| [EPIC-010](./010-specification-interface/) | Specification Interface | M-04 | 14 |
| [EPIC-011](./011-traceability/) | Traceability | M-04 | 15 |
| [EPIC-012](./012-workflow-tasks/) | Workflow & Tasks | M-06 | 10 |
| [EPIC-013](./013-engine-api-selection/) | Engine API & Selection | M-08 | 4 |
| [EPIC-014](./014-devops-release/) | DevOps & Release | M-11 | 12 |
| [EPIC-015](./015-qa-validation/) | QA & Validation | M-12 | 5 |
| [EPIC-016](./016-architecture-decision-records/) | Architecture Decision Records | M-13 | 2 |

### Separate epic

| Epic | Title | Status |
|------|-------|--------|
| [EPIC-002](./002-team-review-access-storage/) | Team Review, Access Control & External Storage | Clarified; not yet planned. Depends on the epics above |

**Total: 215 tasks** — unchanged by the split. Not one task ID moved.

## Build order

```text
EPIC-001 Platform Foundation
    ├─► EPIC-003 Specification Engine & Sandbox      ─┐
    └─► EPIC-004 Workspace Tenancy & Audit           ─┤
                                                      │  ⏸ BRS gate
            ┌─────────────────────────────────────────┘
            ▼
        EPIC-005 Identity ─► EPIC-006 Projects ─► EPIC-007 Requirements
                                                       │
                                                       ▼
                                    EPIC-008 Authoring & Generation
                                       ├─► EPIC-009 Lifecycle & Versioning ─► EPIC-012 Tasks
                                       ├─► EPIC-010 Interface
                                       └─► EPIC-011 Traceability
                                    EPIC-013 Engine API   EPIC-016 ADRs
                                                       │
                                                       ▼
                                    EPIC-015 QA ─► EPIC-014 DevOps & Release (closure)
```

## Known limitation — Spec Kit tooling and `_shared/`

`.specify/scripts/powershell/check-prerequisites.ps1` reports `AVAILABLE_DOCS` for **one feature
directory**. Because the design artifacts live in `_shared/`, it returns only `tasks.md` for every
epic — `research.md`, `data-model.md`, `quickstart.md`, and `contracts/` are invisible to it.

**This is expected, not a defect.** The alternative — duplicating the schema and architecture into
fifteen folders — was rejected for good reason. But it means:

- `/speckit-plan` and `/speckit-tasks` will report fewer available docs than actually exist
- Anyone reading a tool's output rather than this index may conclude an epic has no design behind it

**When working on an epic, read `_shared/` as part of its context.** Every epic `spec.md` and
`plan.md` links to it explicitly.

## Conventions

- **Task IDs are globally unique and invariant** (`T001`–`T164` plus suffixes). A
  `(unit test: T0nn)` reference may point into another epic — expected and correct.
- **Requirement IDs are not yet globally unique.** EPIC-002 has its own `FR-001`–`FR-040` that
  collide with the platform set. This is conflict **C-01**; decision **D-1** fixes it by adopting
  PMI-DOC-000's typed four-digit scheme.
- **Module IDs `M-nn` follow the 16-module catalog**, superseded by the MPS 18-module taxonomy but
  not yet re-cut (decisions D-12, D-13). `M-08` here is the *Specification Engine*; MPS `M08` is
  *Specification Management*. Read carefully.
- Each epic carries its own `defects/` (Constitution VI) and converges independently
  (Constitution IV).
