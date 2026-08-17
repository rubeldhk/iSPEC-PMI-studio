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
├── srs-alignment.md  conflicts C-01..C-28, decisions D-1..D-42
└── <epic>/           spec.md · plan.md · tasks.md · checklists/ · defects/ · closure.md
```

📊 **Programme status** — measured state of infrastructure, system design, solution plan, technology
plan and amendment incorporation: [`_shared/programme-status.md`](./_shared/programme-status.md)
(2026-08-17).

Requirements are defined **once** in `_shared/platform-spec.md`. Each epic's `spec.md` declares
which it *owns*. Architecture is never duplicated — fifteen copies of a schema would become fifteen
divergent truths.

## Epics

### ▶ Proceeding — 89 tasks

Buildable now. Nothing here depends on the Business Requirement Specification.

| Epic | Title | Module | Tasks |
|------|-------|--------|-------|
| [EPIC-001](./001-platform-foundation/) | Platform Foundation | M-00 | 47 ✅ **CLOSED 2026-08-17** — [closure.md](./001-platform-foundation/closure.md) |
| [EPIC-003](./003-specification-engine/) | Specification Engine & Sandbox | M-08 | 35 |
| [EPIC-004](./004-workspace-tenancy-audit/) | Workspace Tenancy & Audit | M-01 / M-13 | 19 |

### ⏸ Held — 199 tasks

Blocked on `PMI-DOC-004` Business Requirement Specification and approved business scope
(PMI-TASK-001 T-101, T-106; decision D-10; RAID **D-K**). Held is not cancelled — these tasks are
complete, reviewed, and Constitution V compliant.

| Epic | Title | Module | Tasks |
|------|-------|--------|-------|
| [EPIC-005](./005-identity-signin/) | Identity & Sign-in | M-01 | 15 |
| [EPIC-006](./006-project-management/) | Project Management | M-02 | 13 |
| [EPIC-007](./007-requirement-intelligence/) | Requirement Intelligence | M-03 | 22 |
| [EPIC-008](./008-spec-authoring-generation/) | Specification Authoring & Generation | M-04 | 23 |
| [EPIC-009](./009-spec-lifecycle-versioning/) | Specification Lifecycle & Versioning | M-04 | 26 |
| [EPIC-010](./010-specification-interface/) | Specification Interface | M-04 | 19 |
| [EPIC-011](./011-traceability/) | Traceability | M-04 | 19 |
| [EPIC-012](./012-workflow-tasks/) | Workflow & Tasks | M-06 | 16 |
| [EPIC-013](./013-engine-api-selection/) | Engine API & Selection | M-08 | 8 |
| [EPIC-014](./014-devops-release/) | DevOps & Release | M-11 | 17 |
| [EPIC-015](./015-qa-validation/) | QA & Validation | M-12 | 9 |
| [EPIC-016](./016-architecture-decision-records/) | Architecture Decision Records | M-13 | 12 |

### Separate epics

| Epic | Title | Status |
|------|-------|--------|
| [EPIC-002](./002-team-review-access-storage/) | Team Review, Access Control & External Storage | **PARENT DESIGN** — split 2026-08-07 by ruling **D-19** into three module-aligned children. Holds requirements, clarifications, SRS traceability and the principle register; carries no tasks |
| [EPIC-023](./023-unattended-runs-review/) | Unattended Runs & Team Review — M-06 Workflow | ⏸ Held · **43 tasks** · owns FR-001–FR-020, FR-005a–c, FR-015a |
| [EPIC-024](./024-artifact-access-control/) | Artifact Access Control — M-13 Security & Governance | ⏸ Held · **21 tasks** · owns FR-021–FR-028 |
| [EPIC-025](./025-external-storage-publishing/) | External Storage Publishing — M-11 DevOps | ⏸ Held · **32 tasks** · owns FR-029–FR-040 |
| [EPIC-018](./018-repository-governance/) | Repository Governance Process | ▶ **Proceeding** — process, not product. Split from EPIC-017 on 2026-08-04 (D-17). Planned and tasked (**32 tasks**, T312–T339 + closure) |

### The enhancement-model family — 87 tasks, all ⏸ held

`SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` was cut twice. **D-17** split
it along the product/process seam — the repository process became EPIC-018 and proceeds; the product
capability stayed held. **D-18** then split that product half into four delivery epics.

[**EPIC-017**](./017-enhancement-model/) is now a **parent design carrying no tasks** — spec, plan,
research, data model, contracts, and quickstart shared by all four children, the role `_shared/`
plays for the platform.

| Epic | Title | Module | Tasks | IDs |
|------|-------|--------|-------|-----|
| [EPIC-019](./019-steering-engine/) | Steering Engine | M-01 / M-04 | 26 | T225–T250 |
| [EPIC-020](./020-living-specifications/) | Living Specifications & Impact | M-04 | 22 | T251–T272 |
| [EPIC-021](./021-review-gates-roles/) | Review Gates & Roles | M-04 | 23 | T273–T295 |
| [EPIC-022](./022-product-traceability/) | Product Structure & Traceability | M-04 | 16 | T296–T311 |

⚠️ **EPIC-019 must land first** — it adds a tenancy scope above workspace, which is a column while no
workspace rows exist and a data migration afterwards.
🔀 **EPIC-022 is a fold candidate** into EPIC-011, kept separate while folding is still cheap.

Ruling **D-16** layered the source document's authority: its 21-section template and 12-link chain
govern PMI Studio's *outputs*, while `PMI-DOC-000` continues to govern this repository's own
documents — which is why no existing specification here became non-conformant.

EPIC-023/024/025 (96, split from EPIC-002) and EPIC-018 (32) are counted in the grand total below but not in the platform or
enhancement subtotals, which cover the D-15 and D-18 families only.

**Total: 502 tasks** — including EPIC-023/024/025 (96, split from EPIC-002 by D-19) and EPIC-018 (32). The platform family holds **288** — 215 from the D-15 split, plus 7
remediation tasks and a 4-task `Phase Z · Epic closure` in each of the 15 epics (T165–T224). The
enhancement-model family holds **87** (T225–T311, ruling D-18). **Not one existing task ID has ever
moved.**

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

- **Task IDs are globally unique and invariant** (`T001`–`T432` plus suffixes such as `T143a`). A
  `(unit test: T0nn)` reference may point into another epic — expected and correct.
- **Requirement IDs are not yet globally unique.** The EPIC-002 family has its own `FR-001`–`FR-040` that
  collide with the platform set. This is conflict **C-01**; decision **D-1** fixes it by adopting
  PMI-DOC-000's typed four-digit scheme.
- **Module IDs `M-nn` follow the 16-module catalog**, superseded by the MPS 18-module taxonomy but
  not yet re-cut (decisions D-12, D-13). `M-08` here is the *Specification Engine*; MPS `M08` is
  *Specification Management*. Read carefully.
- Each epic carries its own `defects/` (Constitution VI) and converges independently
  (Constitution IV) via its **`Phase Z · Epic closure`**, which writes `closure.md`. An epic reaches
  *release-eligible* on its own; **platform promotion** is a separate gate in
  [EPIC-014 F-11.2](./014-devops-release/tasks.md), which confirms the 15 `closure.md` records.
