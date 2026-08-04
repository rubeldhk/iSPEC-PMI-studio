# PMI Studio — Platform Product Specification

> ## ⚠️ This is the PARENT product specification
>
> **Restructured 2026-08-03.** This was `EPIC-001`'s spec when EPIC-001 was one 215-task epic
> spanning ten modules. It is now the **platform-wide product specification** that all fifteen
> epics draw from.
>
> - **Requirements, user stories, and success criteria are defined here once.** Each epic's
>   `spec.md` declares which it *owns*.
> - **The Principle Conformance register here is the platform baseline.** Epics record only
>   *deltas* — a refinement of decision D-6, since twenty rows repeated fifteen times would become
>   the box-ticking ADR-0005 warned about.
> - Clarification history, SRS traceability, and the MPS adoption register remain authoritative here.
>
> Start at [../README.md](../README.md) for the epic index.



**Scope**: platform-wide — the source for all 15 epics

**Owns**: 36 functional requirements · 8 user stories · 12 success criteria · the principle baseline

**Created**: 2026-08-02

**Status**: Draft — clarified, ready for planning

**Input**: User description: "analyze and incorporate informations from files in SRS folder"

## Clarifications

### Session 2026-08-02

- Q: Should EPIC-001 build the tooling that converts SRS documents into a citable knowledge base,
  or specify the PMI Studio product itself? → A: **B — Product specification.** EPIC-001 specifies
  PMI Studio. SRS documents remain Word files; specification citations reference source documents
  and sections by name rather than per-statement requirement IDs.
- Q: How much of PMI Studio should this first specification cover? → A: **B — Roadmap Phase 1
  slice.** EPIC-001 covers "Core platform + Spec Kit adapter + Project/Spec management" as defined
  by the SRS Roadmap, spanning three module areas rather than the full platform or a single module.
- Q: Does the Phase 1 adapter actually run Spec Kit to generate specifications and tasks, or only
  store specifications authored elsewhere? → A: **B — Generate via adapter.** Phase 1 invokes Spec
  Kit through the Specification Engine Interface for the core lifecycle (generate specification,
  generate tasks, validate). `estimateComplexity()` and `analyzeDependencies()` are deferred
  beyond Phase 1.
- Q: Is Phase 1 a single-user local tool or a multi-user hosted platform with organizations and
  permissions? → A: **C — Multi-tenant-ready, single-user surface.** Workspace and owner identity
  are carried in the data model on every entity from the first row; sign-in is basic. SSO, RBAC,
  and enterprise administration are deferred to roadmap Phase 3.
- Q: Where does a project's content begin — raw requirement capture, or directly at the
  specification? → A: **B — Basic requirement intake.** Requirements are first-class records
  against a project; specifications are generated from them, giving requirement → specification →
  task traceability. AI-assisted requirement analysis (Requirement Intelligence / REG) stays
  Phase 2.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Product Vision — "Spec Kit is adopted as the initial specification engine behind an adapter layer and can be replaced or extended without impacting the platform" | FR-016, FR-017, FR-018, FR-019 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Core Principles — "Specification First, AI Second"; "Engine-independent architecture" | FR-016, FR-017 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Core Principles — "Requirement → Spec → Task → Code → QA → Release lifecycle" | FR-004, FR-020, FR-029 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Core Principles — "Every artifact is versioned and traceable" | FR-013, FR-014, FR-029, FR-030 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | High-Level Architecture — Specification Engine Interface; Engine Adapters (Spec Kit V1, Future Engines) | FR-016, FR-017, FR-018 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Workspace & Organization; Project Management | FR-001, FR-002, FR-003 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Requirement Intake | FR-004, FR-005, FR-006, FR-007 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Specification Manager; Task Management | FR-010, FR-011, FR-012, FR-020 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Traceability Model — Business Goal → Requirement → … → Release | FR-029, FR-030, FR-031 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Roadmap — Phase 1: "Core platform + Spec Kit adapter + Project/Spec management" | Epic scope boundary |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Roadmap — Phase 2 / Phase 3 / Phase 4 assignments | Out of Scope |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | Specification Engine Contract — `ISpecificationEngine` (8 methods) | FR-016, FR-021, FR-022, FR-023 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | Key Recommendations — "Treat Spec Kit as Engine V1, not the product" | FR-017, FR-018, FR-019 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | Key Recommendations — "Store every feature as an independent Spec Kit specification" | FR-010 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | Key Recommendations — "Maintain Architecture Decision Records from day one" | FR-034 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 06 Specification Engine — Specification_Lifecycle, Spec_Versioning, Validation_Rules | FR-011, FR-013, FR-014, FR-023 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 02 Requirements — Business/Functional/NonFunctional, Acceptance_Criteria | FR-005, FR-007 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 11 Security — RBAC, SSO, Audit_Log | FR-002, FR-033 (RBAC/SSO deferred to Phase 3) |
| `SRS/raw study.docx` | "Spec Kit becomes the first implementation, not the core dependency… GUI, workflow engine, task manager, AI orchestration and governance layers all communicate with the abstract interface" | FR-017, FR-018, FR-019 |
| `SRS/raw study.docx` | "Each feature has its own specification, implementation plan, and tasks" | FR-010, FR-020 |
| `SRS/process.txt` | Enterprise documentation scale expectations (400–600 feature specifications) | SC-009 |
| `SRS/PMI-DOC-001_Executive_Product_Vision.docx` | Vision — "specifications as the single source of truth, with AI accelerating—not replacing—engineering discipline" | FR-016, FR-017 |
| `SRS/PMI-DOC-001_Executive_Product_Vision.docx` | Strategic Objectives — "Support pluggable specification engines" | FR-016 to FR-019 |
| `SRS/PMI-DOC-001_Executive_Product_Vision.docx` | Success Measures — "Requirement traceability >95%" | FR-029 to FR-031, SC-002, SC-003 |
| `SRS/PMI-DOC-002_Product_Charter.docx` | Objectives — "Support pluggable specification engines beginning with Spec Kit"; "end-to-end traceability from idea to release" | FR-017, FR-018, FR-029 |
| `SRS/PMI-DOC-002_Product_Charter.docx` | Governance — Architecture Decision Records | FR-034 |
| `SRS/PMI_Studio_Module_Based_Requirements_and_Epics.docx` | **AUTHORITATIVE module decomposition** (decision D-3). Modules touched: Workspace & Organization, Project Management, Requirement Intelligence, Specification Management, Workflow & Tasks, Specification Engine, DevOps, QA, Security & Governance | Epic scope and `tasks.md` grouping — see [srs-alignment.md](../srs-alignment.md) C-05, Part 3 |
| `SRS/PMI-DOC-000_Product_Documentation_and_Specification_Standard_v1.0.docx` | §3 Requirement Identifiers; §5 Traceability Rules; §4 Standard Document Structure | ⚠️ **This spec does not yet conform** — see [srs-alignment.md](../srs-alignment.md) C-01 to C-03 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-006 Engine Independence; Architecture Implications — "adapter-based architecture for specification engines" | FR-016 to FR-019, SC-008 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-002 Single Source of Truth; PP-004 End-to-End Traceability | FR-029 to FR-032 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-009 Quality by Design; PP-020 Customer Value | Acceptance scenarios; SC-001 to SC-012 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-012 Everything Versioned; PP-016 Explainable AI | FR-013, FR-014, FR-022 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-008 Security by Design; PP-010 Observability (audit portion) | FR-002, FR-033 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | Architecture Implications — "Treat AI agents as governed services, not autonomous authorities" | FR-024 to FR-028 (sandbox, caps, cancellation) |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-007 API & MCP First; PP-010 logging/metrics/tracing; PP-017 Cost-Aware AI | ⚠️ **Not satisfied by this Epic** — see [srs-alignment.md](../srs-alignment.md) C-07 to C-09 |
| `SRS/PMI-TASK-001_Master_Implementation_Task_Breakdown.docx` | Phase 6 Engineering — T-501 Database design, T-502 API specification, T-505 QA specification | `schema.sql`, `data-model.md`, `contracts/platform-api.md`, `quickstart.md` |
| `SRS/PMI-TASK-001_Master_Implementation_Task_Breakdown.docx` | Phase 4 Architecture — T-302 Design specification engine interface, T-303 Create Spec Kit adapter | FR-016 to FR-019; `contracts/specification-engine.md` |
| `SRS/PMI-TASK-001_Master_Implementation_Task_Breakdown.docx` | Phases 2, 4, 5 — T-101 BRS, T-304 MCP design, T-306 architecture review, T-401 to T-408 module specs | ⚠️ **This Epic runs ahead of these prerequisites** — resolved by decision D-10 (split delivery) |
| `SRS/PMI-PLAN-001_Engineering_Execution_Plan_v1.0.docx` | Execution Lanes — Foundation/AI Platform/Infrastructure *Proceed*; Business and Product Surface *Blocked until PMI-DOC-004* | ✅ **Independently validates D-10**; no revision needed |
| `SRS/new/M08_Specification_Management_Implementation_Specification_v1.0.docx` | §8 Lifecycle — `Draft → Review → Approved → Baseline → Implemented → Archived`; §6 FR-SPEC-004 Baseline, FR-SPEC-006 Export | ⚠️ **CONFLICTS with FR-011** (3 states) and `schema.sql` — see [srs-alignment.md](../srs-alignment.md) C-16, decision **D-14** |
| `SRS/new/PMI_Studio_MPS_v1.0_Volume_2_*.docx` | 12 core functional domains; cross-cutting requirements | Supersedes prior domain groupings — decision D-12 |
| `SRS/PMI_Studio_Master_Product_Specification_Release_Structure_v1.0.docx` | *"The MPS is the single authoritative source of truth"*; `REQ-0001` requirement template | ⚠️ **Authority chain unresolved** — see C-13, C-15, decision D-12 |
| `SRS/new/M01–M18_*_Implementation_Specification_v1.0.docx` | 18-module taxonomy; module-scoped IDs (`FR-SPEC-*`, `BR-SPEC-*`, `API-SPEC-*`) | ⚠️ **Fourth module taxonomy; `M-08` collides with ours** — see C-14, decision D-13 |

**Requirements not yet covered by SRS**: FR-024 and FR-025 (generation job cancellation and
timeout behaviour) address operational realities of invoking a long-running external engine that
the SRS does not currently address. Back-fill owner: project owner, to be added to a future
`Specification_Lifecycle.md` in the SRS.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

Principles bind the programme, not each Epic individually. This Epic's position on all twenty, with
every deferral argued and assigned. **A deferral is a debt reviewed at the convergence gate, not
permission to skip.**

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | ✅ Satisfied | Constitution I — all code produced via Spec Kit commands |
| PP-002 | Single Source of Truth | ✅ Satisfied | Constitution II; SRS Traceability table above |
| PP-003 | Human-in-the-Loop | ✅ Satisfied | Approval gate before task generation (FR-020); lifecycle transitions attributed (FR-014) |
| PP-004 | End-to-End Traceability | ⚠️ Partial | Requirement → spec → task built (FR-029–FR-031). **Code, test, and release links absent** — pending decision D-2 |
| PP-005 | Modular Architecture | ✅ Satisfied | Package boundary + module structure; see `system-design.md` |
| PP-006 | Engine Independence | ✅ Satisfied | Engine contract (FR-016–FR-019); architecture test fails the build on any Spec Kit reference (T047, T142); fixture adapter proves neutrality (SC-008) |
| PP-007 | API & MCP First | 🔶 **Deferred** | REST API delivered. **MCP → catalog module M-09 (Phase 3).** Constraint accepted now: services must stay callable independently of REST controllers so an MCP surface can be added without redesign. Owner: tech lead |
| PP-008 | Security by Design | ⚠️ Partial | Workspace isolation (FR-002), immutable audit (FR-033), Argon2id, sandbox egress allow-list. RBAC/SSO → Phase 3 by clarification |
| PP-009 | Quality by Design | ✅ Satisfied | Constitution V mandatory unit tests; acceptance scenarios on all 8 stories; 12 measurable criteria |
| PP-010 | Observability by Default | ✅ **Satisfied** | All four signals in scope. Audit is database-enforced (FR-033); logging, metrics, and tracing delivered by function **F-00.5** (T157–T164) with one correlation identifier spanning API → queue → worker → sandbox. Adopted by decision **D-7**; design in `system-design.md` PC-3 |
| PP-011 | Documentation as Code | ⚠️ Partial | All specs are Markdown in git. **`SRS/` itself is `.docx`** — decision D-5 open |
| PP-012 | Everything Versioned | ⚠️ Partial | Requirements (FR-009) and specifications (FR-013) versioned; schema in git. **API versioning unspecified** — decision D-8 open |
| PP-013 | Knowledge-Driven Engineering | 🔶 **Deferred** | → catalog module M-10 Knowledge Platform (Phase 2). No Phase 1 capability depends on it. Owner: product owner |
| PP-014 | Configuration over Customization | ✅ Satisfied | Engine and identity-provider adapters; no per-tenant forks |
| PP-015 | Open Standards | ✅ Satisfied | Adapter pattern throughout; Valkey preferred over Redis on licence grounds (RAID R-03) |
| PP-016 | Explainable AI | ✅ Satisfied | Raw engine output stored verbatim; engine and model version recorded on every artifact (FR-022) |
| PP-017 | Cost-Aware AI | 🔶 **Deferred** | *Containment* half delivered — hard wall-clock/CPU/memory caps per job bound cost (FR-025). *Optimisation* half (model selection by quality/latency/cost) → catalog module M-07 AI Platform; Phase 1 uses a single model. RAID R-02 tracks exposure. Owner: tech lead |
| PP-018 | Scalability First | ⚠️ Partial | Multi-tenant-ready from migration 1; stateless API; SC-009 targets 500 specs/project. Horizontal scaling and read replicas deferred until measured |
| PP-019 | Continuous Improvement (DORA/SPACE) | 🔶 **Deferred** | → catalog module M-14 Reporting. Requires delivery history this Epic does not yet produce. Owner: product owner |
| PP-020 | Customer Value | ✅ Satisfied | 12 measurable, user-facing success criteria |

**Deferral count**: 4 (PP-007, PP-013, PP-017, PP-019) — each with an owner and a discharging
module. PP-010 was deferred until decision **D-7** adopted it; it is now satisfied.

**Reviewed at**: the Epic convergence gate (Constitution IV). A deferral whose owner or destination
has become stale is a convergence failure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set up a workspace and project (Priority: P1)

A product owner signs in, lands in their workspace, and creates a project to hold the work for one
product or initiative. Everything they create from that point on — requirements, specifications,
tasks — belongs to that project and that workspace, and they can return later and find it exactly
as they left it.

**Why this priority**: Every other story needs somewhere to put its data. Without a project
container carrying workspace and owner identity, nothing else can be created, isolated, or
retrieved. This is the foundation the multi-tenant-ready data model rests on.

**Independent Test**: Sign in, create a project, add a description, sign out, sign back in, and
confirm the project is present with its details intact and attributed to the correct owner and
workspace.

**Acceptance Scenarios**:

1. **Given** an authenticated user with a workspace, **When** they create a project with a name
   and description, **Then** the project is saved and appears in their project list.
2. **Given** a project exists, **When** the user opens it, **Then** they see its requirements,
   specifications, and tasks scoped to that project only.
3. **Given** two projects in the same workspace, **When** the user views one, **Then** no content
   from the other project is visible or reachable.
4. **Given** content belonging to a different workspace, **When** a user attempts to access it,
   **Then** access is refused and the attempt is recorded.
5. **Given** a project with existing content, **When** the user renames or archives it, **Then**
   its content remains intact and traceable.

---

### User Story 2 - Capture requirements against a project (Priority: P1)

A business analyst records what the product must do as individual requirement records — each with
its own identifier, description, type, and priority — rather than as a wall of prose. They can
edit, prioritise, and retire requirements as understanding changes, and the history of those
changes is preserved.

**Why this priority**: Requirements are the head of the traceability chain the SRS defines. A
specification generated from nothing has no traceable parent, which breaks every downstream report.
This story delivers standalone value even before generation exists: a structured requirement
register.

**Independent Test**: Create several requirements of different types and priorities in a project,
edit one, retire another, and confirm the register reflects each change with its history intact.

**Acceptance Scenarios**:

1. **Given** an open project, **When** the user adds a requirement with a description, type, and
   priority, **Then** it is stored with a unique identifier and appears in the project's register.
2. **Given** an existing requirement, **When** the user edits its text, **Then** the change is
   saved and the previous text remains retrievable as history.
3. **Given** a requirement that is no longer wanted, **When** the user retires it, **Then** it is
   marked retired rather than erased, and anything already generated from it stays traceable.
4. **Given** a requirement with no description, **When** the user attempts to save it, **Then**
   the save is refused with a message naming the missing information.
5. **Given** a project with many requirements, **When** the user filters by type or priority,
   **Then** only matching requirements are listed.

---

### User Story 3 - Generate a specification from requirements (Priority: P1)

The user selects one or more requirements and asks the platform to produce a specification. The
platform hands the request to its specification engine, Spec Kit runs behind the adapter, and the
resulting specification is stored against the project — linked back to the exact requirements it
came from. The user watches progress and sees a clear result, success or failure.

**Why this priority**: This is the Epic's centre of gravity. It is the first proof that the engine
contract works against a real engine, and it is what makes PMI Studio a platform rather than a
document store. It is also where the SRS's defining architectural claim — engine independence — is
either honoured or lost.

**Independent Test**: Select requirements, trigger generation, and confirm a specification is
produced, stored against the project, and linked to those requirements — with the platform's own
code never referring to Spec Kit directly.

**Acceptance Scenarios**:

1. **Given** a project with requirements, **When** the user generates a specification from a
   selection of them, **Then** a specification is created and linked to each selected requirement.
2. **Given** a generation request, **When** the engine is working, **Then** the user sees that the
   job is running and can continue using the rest of the platform.
3. **Given** the engine fails or returns an unusable result, **When** the job ends, **Then** the
   failure is reported with a reason, no partial specification is stored, and the user can retry.
4. **Given** the engine is unavailable, **When** the user requests generation, **Then** they are
   told the engine is unavailable rather than shown a generic error.
5. **Given** a generated specification, **When** the user views it, **Then** they can see which
   engine and engine version produced it and when.
6. **Given** a specification already generated, **When** the source requirements change, **Then**
   the specification is flagged as out of date without being altered automatically.

---

### User Story 4 - Generate and manage tasks from a specification (Priority: P1)

Once a specification is approved, the user generates its task breakdown through the same engine
contract. Tasks are stored against the specification, each traceable to the specification and, by
extension, to the originating requirements.

**Why this priority**: The SRS lifecycle is *Requirement → Spec → Task*. Stopping at the
specification leaves the chain incomplete and gives the user nothing actionable. Same priority as
generation because the two together form the minimum useful loop.

**Independent Test**: Generate tasks from an approved specification and confirm each task is
stored, listed under that specification, and resolves back through it to its requirements.

**Acceptance Scenarios**:

1. **Given** an approved specification, **When** the user generates tasks, **Then** tasks are
   created and linked to that specification.
2. **Given** a specification not yet approved, **When** the user attempts task generation, **Then**
   the platform states that approval is required first.
3. **Given** generated tasks, **When** the user updates a task's status, **Then** the change is
   saved and reflected in the project's progress view.
4. **Given** tasks were generated previously, **When** the user regenerates, **Then** they are
   warned about the effect on existing tasks before anything is replaced.

---

### User Story 5 - Move a specification through its lifecycle with version history (Priority: P2)

A specification progresses from draft, through review, to approved. Each meaningful change creates
a new version, and the user can view any earlier version and see what changed between versions and
who changed it.

**Why this priority**: The SRS states plainly that "every artifact is versioned and traceable", and
dedicates `Spec_Versioning.md` and `Specification_Lifecycle.md` to it. Ranked P2 because the
generate loop (US3, US4) delivers value first, but no enterprise customer will accept
specifications without history.

**Independent Test**: Take a specification from draft to approved, edit it to create a new version,
then view and compare an earlier version.

**Acceptance Scenarios**:

1. **Given** a draft specification, **When** the user submits it for review and then approves it,
   **Then** its state reflects each transition and each transition is recorded with who and when.
2. **Given** an approved specification, **When** it is edited, **Then** a new version is created
   and the approved version remains retrievable unchanged.
3. **Given** two versions, **When** the user compares them, **Then** the differences between them
   are shown.
4. **Given** an invalid transition is attempted (for example approved directly back to draft),
   **When** the user requests it, **Then** it is refused with the allowed transitions named.

---

### User Story 6 - Validate a specification before approving it (Priority: P2)

Before approving, the user runs validation. The platform asks the engine to check the
specification and returns a list of problems — missing sections, untestable statements, unresolved
placeholders — so the user can fix them rather than approving something incomplete.

**Why this priority**: Validation is one of the three core contract capabilities this Epic
implements, and the SRS lists `Validation_Rules.md` under the Specification Engine. P2 because
approval can function without it, but quality degrades quickly if it is absent.

**Independent Test**: Validate a deliberately incomplete specification and confirm the reported
problems match its actual defects.

**Acceptance Scenarios**:

1. **Given** a specification, **When** the user runs validation, **Then** a list of findings is
   returned, each naming the part of the specification it concerns.
2. **Given** a specification with no problems, **When** validation runs, **Then** it reports that
   the specification passed.
3. **Given** validation findings exist, **When** the user attempts approval, **Then** they are
   shown the outstanding findings before approval proceeds.

---

### User Story 7 - Trace any artifact back to its origin (Priority: P2)

Anyone on the project can pick a task and follow it back to its specification and the requirements
behind it — or start from a requirement and see everything produced from it. Coverage gaps are
visible: requirements with no specification, specifications with no tasks.

**Why this priority**: Traceability is named in the SRS Core Principles and given its own model.
It is what makes the artifacts a system rather than a pile of documents. P2 because the links must
exist (US2–US4) before they can be reported on.

**Independent Test**: From a task, navigate to its specification and originating requirements; then
from a requirement, list everything derived from it; then confirm a requirement with no
specification is reported as a gap.

**Acceptance Scenarios**:

1. **Given** a task, **When** the user views its traceability, **Then** they see its specification
   and the requirements that specification was generated from.
2. **Given** a requirement, **When** the user views its traceability, **Then** they see every
   specification and task derived from it.
3. **Given** a requirement with no specification, **When** the user views project coverage, **Then**
   that requirement is listed as uncovered.
4. **Given** a retired requirement with derived artifacts, **When** the user views traceability,
   **Then** the link is still shown and marked as originating from a retired requirement.

---

### User Story 8 - Prove the platform is not tied to Spec Kit (Priority: P3)

An architect registers a second, alternative specification engine and switches a project to use it.
The platform's projects, requirements, specifications, tasks, and traceability all continue to work
unchanged. Nothing outside the adapter layer needed modification.

**Why this priority**: This is the acceptance test for the SRS's single most emphasised
architectural decision — *"Treat Spec Kit as Engine V1, not the product"*. P3 because the platform
delivers value with one engine, but without this story engine-independence is an untested claim.

**Independent Test**: Register a second engine implementing the same contract, switch a project to
it, run generation, and confirm the platform behaves identically with no changes outside the
adapter layer.

**Acceptance Scenarios**:

1. **Given** a second engine implementing the contract, **When** it is registered, **Then** it
   becomes selectable for a project.
2. **Given** a project switched to the alternative engine, **When** the user generates a
   specification, **Then** generation succeeds and the result records which engine produced it.
3. **Given** the platform code outside the adapter layer, **When** it is inspected, **Then** it
   contains no direct dependency on any specific engine.
4. **Given** an engine that does not provide a required capability, **When** it is registered,
   **Then** registration is refused naming the missing capability.

---

### Edge Cases

- **Engine runs long**: a generation job that exceeds its time limit is stopped, reported as timed
  out, and leaves no partial artifact.
- **User cancels mid-generation**: the job stops, nothing partial is stored, and the user may retry.
- **Engine returns malformed output**: rejected as a failed job with the reason recorded; never
  stored as a specification.
- **Engine returns an empty result**: treated as failure, not as an empty specification.
- **Duplicate submissions**: submitting the same generation request twice in quick succession
  produces one job, not two.
- **Concurrent edits**: two users editing the same specification — the second save is warned about
  the conflict rather than silently overwriting.
- **Requirement changes after generation**: derived specifications are flagged out of date; nothing
  regenerates automatically.
- **Requirement retired after generation**: derived artifacts survive and remain traceable.
- **Empty selection**: generating from zero requirements is refused with an explanation.
- **Very large requirement set**: a selection too large for the engine is reported as such before
  the job starts, not after it fails.
- **Cross-workspace access attempt**: refused and recorded.
- **Sign-in lost mid-job**: the job completes and its result is available when the user returns.
- **Project archived with a job running**: the job completes or is cancelled cleanly; no orphaned
  work.
- **Engine version changes between generations**: previously generated artifacts retain the engine
  version that produced them.

## Requirements *(mandatory)*

### Functional Requirements

#### Workspace, identity & projects

- **FR-001**: Users MUST be able to create, view, rename, and archive projects.
- **FR-002**: System MUST associate every stored artifact with a workspace and an owning user, and
  MUST prevent access to artifacts belonging to another workspace.
- **FR-003**: System MUST scope all project content — requirements, specifications, tasks — to its
  project, with no leakage between projects.

#### Requirement intake

- **FR-004**: Users MUST be able to create, edit, retire, and list requirements within a project.
- **FR-005**: System MUST store for each requirement a unique identifier, description, type, and
  priority.
- **FR-006**: System MUST retain retired requirements rather than deleting them, preserving
  traceability from artifacts already derived from them.
- **FR-007**: System MUST refuse to save a requirement missing information required for it to be
  actionable, naming what is missing.
- **FR-008**: Users MUST be able to filter and sort a project's requirements by type, priority, and
  status.
- **FR-009**: System MUST retain the edit history of each requirement.

#### Specification management

- **FR-010**: System MUST store each generated specification as an independent artifact belonging
  to exactly one project.
- **FR-011**: System MUST support the specification lifecycle defined by SRS module specification
  M08 §8 — `draft → review → approved → baselined → implemented → archived` — and MUST refuse
  transitions outside the permitted set, naming the permitted ones.
- **FR-011a**: System MUST treat a baselined specification as immutable: editing one creates a new
  version in `draft` rather than altering the baseline, and the baselined version remains
  retrievable unchanged (M08 BR-SPEC-001, BR-SPEC-002).
- **FR-011b**: System MUST allow an approved or baselined specification to be archived, and MUST
  retain archived specifications with their traceability links intact rather than deleting them.
- **FR-012**: Users MUST be able to view, edit, and list specifications within a project.
- **FR-013**: System MUST create a new version of a specification on each meaningful change, and
  MUST keep all prior versions retrievable and unaltered.
- **FR-014**: System MUST record, for every version and lifecycle transition, who made it and when.
- **FR-015**: Users MUST be able to compare any two versions of the same specification.

#### Specification engine interface & adapters

- **FR-016**: System MUST define a single specification engine capability contract covering, for
  Phase 1: generate specification, generate tasks, and validate specification.
- **FR-017**: System MUST invoke all engine capabilities exclusively through that contract; no part
  of the platform outside the adapter layer may depend on a specific engine.
- **FR-018**: System MUST provide a Spec Kit adapter implementing the contract, serving as the
  default engine.
- **FR-019**: System MUST allow additional engine adapters to be registered and selected per
  project without modifying platform behaviour outside the adapter layer.
- **FR-020**: System MUST generate a task breakdown for an approved specification through the
  contract, storing each task linked to that specification.
- **FR-021**: System MUST refuse registration of an engine that does not provide every capability
  the contract requires for Phase 1, naming the missing capability.
- **FR-022**: System MUST record, on every generated artifact, which engine and engine version
  produced it and when.
- **FR-023**: System MUST return validation findings that each identify the part of the
  specification they concern.

#### Engine job handling

- **FR-024**: Users MUST be able to cancel an in-progress generation job, with no partial artifact
  stored.
- **FR-025**: System MUST enforce a time limit on generation jobs, reporting a timed-out job as
  failed with no partial artifact stored.
- **FR-026**: System MUST report engine failure, unavailability, malformed output, and empty output
  as distinct, named failure reasons rather than a generic error.
- **FR-027**: System MUST leave the platform in its pre-request state when a generation job fails.
- **FR-028**: Users MUST be able to continue working elsewhere in the platform while a generation
  job runs.

#### Traceability

- **FR-029**: System MUST link every generated specification to the requirements it was generated
  from, and every generated task to its specification.
- **FR-030**: Users MUST be able to traverse traceability in both directions — from a requirement
  to everything derived from it, and from a task back to its originating requirements.
- **FR-031**: System MUST report coverage gaps: requirements with no specification, and
  specifications with no tasks.
- **FR-032**: System MUST flag a specification as out of date when a requirement it was generated
  from changes, without altering the specification.

#### Governance & audit

- **FR-033**: System MUST record an audit entry for artifact creation, modification, lifecycle
  transition, engine invocation, and refused access attempts.
- **FR-034**: Users MUST be able to record architecture decisions against a project and link them
  to the specifications they affect.

### Key Entities

- **Workspace**: The tenancy boundary. Attributes: identifier, name, owner. Every other entity
  carries its workspace.
- **User**: An authenticated actor. Attributes: identifier, display name, workspace membership.
- **Project**: A container for one product or initiative. Attributes: identifier, name,
  description, workspace, owner, status (active / archived), selected engine.
- **Requirement**: A single stated need. Attributes: identifier, description, type (business /
  functional / non-functional / constraint), priority, status (active / retired), project, edit
  history.
- **Specification**: A generated specification artifact. Attributes: identifier, title, content,
  lifecycle state, current version, project, originating requirements, producing engine and
  version, out-of-date flag.
- **Specification Version**: An immutable snapshot. Attributes: version identifier, content,
  author, timestamp, parent specification.
- **Task**: A unit of work derived from a specification. Attributes: identifier, description,
  status, parent specification, producing engine and version.
- **Engine Registration**: An available specification engine. Attributes: identifier, name,
  version, capabilities provided, default flag.
- **Generation Job**: One engine invocation. Attributes: identifier, requesting user, engine,
  inputs, state (queued / running / succeeded / failed / cancelled / timed out), failure reason,
  started and ended timestamps.
- **Traceability Link**: A directed relationship between artifacts. Attributes: source, target,
  relationship type, created timestamp.
- **Validation Finding**: One problem reported by the engine. Attributes: specification, location,
  severity, message.
- **Architecture Decision Record**: A recorded decision. Attributes: identifier, title, status,
  context, decision, consequences, linked specifications.
- **Audit Entry**: An immutable record of an action. Attributes: actor, action, target artifact,
  workspace, timestamp, outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from signing in to holding a generated specification linked to
  their requirements in under 15 minutes, without external help.
- **SC-002**: 100% of generated specifications resolve to at least one originating requirement;
  zero orphaned specifications exist.
- **SC-003**: 100% of generated tasks resolve back through their specification to at least one
  requirement.
- **SC-004**: Zero artifacts are ever visible across a workspace boundary; every cross-workspace
  access attempt is refused and recorded.
- **SC-005**: Every failed generation attempt reports a specific, named reason; zero generic
  failures reach the user.
- **SC-006**: Zero partial or malformed specifications are stored — a failed, cancelled, or
  timed-out job leaves no artifact behind.
- **SC-007**: Every approved specification retains its complete version history, and any prior
  version can be retrieved unchanged.
- **SC-008**: A second specification engine can be introduced and used for a project with zero
  changes to platform behaviour outside the adapter layer.
- **SC-009**: A single project supports at least 500 specifications without degrading the
  responsiveness of listing, search, or traceability views.
- **SC-010**: Users can identify every uncovered requirement in a project in a single view.
- **SC-011**: 95% of generation requests either complete or report a named failure within the
  stated time limit.
- **SC-012**: Every state-changing action on an artifact appears in the audit record.

## MPS-Derived Requirements — Adoption Register *(added 2026-08-03)*

The MPS drop introduced requirements this Epic did not previously cover. Each is adopted or deferred
deliberately; the test applied was **"does deferring it make it more expensive later?"** (research
R-012), not merely "is it required?".

| Source | Requirement | Decision | Reason |
|---|---|---|---|
| M08 §8 | Six-state lifecycle `draft → review → approved → baselined → implemented → archived` | ✅ **Adopted** (D-14) | Enforced by a database CHECK constraint. Free to change before any row exists; a migration afterwards |
| M08 BR-SPEC-001/002 | Baseline immutability; approval before downstream execution | ✅ **Adopted** | FR-011a; approval gate already existed (FR-020) |
| M08 §6 FR-SPEC-006 | **Export specification** | 🔶 Deferred | Overlaps EPIC-002 publishing and MPS module **M16 API & Integration Platform**. Owner: product owner |
| M08 §10 | **Domain events** (`EV-SPEC-*` Created/Updated/Approved/Closed) | 🔶 Deferred | Event-driven integration is Volume 2 cross-cutting, owned by **M16**. Audit (FR-033) already records the same state changes internally. Owner: tech lead |
| M08 §4 | **Five actors** (Administrator, Manager, Engineer, Reviewer, AI Assistant) | 🔶 Deferred | Role model is MPS **M04 RBAC**; clarification placed RBAC in Phase 3. This Epic has a single-user surface. Owner: product owner |
| M08 §14 | **99.9% availability** | 🔶 Deferred | Availability cannot be engineered before a hosting substrate is chosen, which this Epic deliberately does not choose. Owner: tech lead |
| Volume 2 | Advanced search and filtering | ✅ **Adopted** | Requirement filtering already existed (FR-008); **specification search added** as T083f/T083g |
| Volume 2 | Notifications and subscriptions | 🔶 Deferred | No owning module in EPIC-001 scope. Owner: product owner |
| Volume 2 | Import/export; event-driven integrations | 🔶 Deferred | **M16 API & Integration Platform** |
| Volume 2 | Multi-tenancy | ✅ Already satisfied | `workspace_id` on every row from migration 1 (FR-002) |
| Volume 2 | End-to-end traceability | ✅ Already satisfied | FR-029 to FR-031 |
| Volume 6 §8 | Quality gates — specification, architecture, security review before release | ✅ **Adopted** | Specification review and automated testing already existed; **architecture review (T152a) and security review (T152b) added to the Epic closure gate**. Discharges PMI-TASK-001 T-306 |

**7 deferred · 0 partial · 6 satisfied.** Every deferral names an owner and a destination, per the
D-6 discipline. The two items originally marked *partial* — specification search and the
architecture/security quality gates — were closed with tasks rather than left ambiguous, since a
partial with no task is indistinguishable from an oversight.

## Out of Scope *(Phase 1)*

Deferred per the SRS Roadmap and the clarifications above:

- **Phase 2**: Visual specification, AI agents and multi-agent collaboration, workflow
  orchestration, Requirement Intelligence (REG) — automated requirement analysis, classification,
  and quality scoring.
- **Phase 3**: MCP marketplace, enterprise governance, enterprise administration, SSO, full RBAC
  and role management.
- **Phase 4**: Native specification engine, predictive delivery.
- **Contract capabilities deferred**: improve specification, generate acceptance criteria, estimate
  complexity, analyze dependencies. Phase 1 implements generate specification, generate tasks, and
  validate only.
- **Modules not in this Epic**: Git integration, CI/CD, QA management, release management,
  reporting and analytics, plugin framework, billing and licensing, public API and SDK surface,
  MCP integration, portfolio management, prompt registry, knowledge and context, AI model manager.
- **Not in this Epic**: converting the `SRS/` Word documents into a structured knowledge base.
  Specifications cite SRS documents and sections by name. (This was the rejected EPIC-001 scope; it
  remains available as a future Epic if per-statement citation is later required.)

## Assumptions

- "Basic sign-in" means an authenticated session sufficient to establish user and workspace
  identity. The specific authentication mechanism is a planning decision; SSO and OAuth are Phase 3.
- Workspace and owner identity are carried on every entity from the first row so that Phase 3
  multi-tenancy and RBAC require no data model rewrite, even though Phase 1 presents a single-user
  surface.
- Spec Kit is invoked as an external engine behind the adapter. How it is invoked, hosted, and
  isolated is a planning decision, not a specification decision.
- Generation is asynchronous because an external engine cannot be assumed to return promptly; users
  are not blocked while a job runs.
- Specifications are generated, then human-editable. The platform does not treat engine output as
  immutable.
- A "meaningful change" that triggers a new specification version is a change to its content or
  lifecycle state, not incidental metadata.
- Task status values are minimal in Phase 1 (not started / in progress / done); richer workflow
  states arrive with the Phase 2 workflow engine.
- No target technology stack, hosting model, storage engine, or user interface framework is chosen
  here; all are deferred to `/speckit-plan`.
- The SRS is the requirement authority. Where this specification and the SRS disagree, the SRS wins
  and this document is corrected (Constitution Principle II).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

Exit criteria are **per epic** since the split of 2026-08-03 — see each epic's `spec.md`.
The platform-wide release gate lives in **EPIC-014 DevOps & Release** (F-11.2, tasks T151–T156),
which writes its outcome to `specs/_shared/release-readiness-report.md` (created by tasks
T151–T153; it does not exist until the release gate runs).

Platform-wide criteria that no single epic can discharge alone:

- [ ] Every implementation task **across all 15 epics** has a passing unit test (Constitution V)
- [ ] `/speckit-converge` run per epic reports no unbuilt work
- [ ] **Every** `specs/*/defects/` folder contains no open records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] **SRS back-fill completed for FR-024 and FR-025**, which have no SRS source (Constitution II)
- [ ] **Principle Conformance baseline reviewed** plus every epic's deltas (PMI-DOC-003, decision D-6)
