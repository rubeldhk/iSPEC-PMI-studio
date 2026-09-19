# Feature Specification: Enhancement Model for Spec-Driven Engineering

**Feature Branch**: `017-enhancement-model`

**Epic**: `EPIC-017` — Enhancement Model for Spec-Driven Engineering *(product capability)*

**Created**: 2026-08-03 · **Clarified**: 2026-08-04 · **Split**: 2026-08-04

**Status**: **PARENT DESIGN** — split into four delivery epics; carries no tasks of its own

> ## ⚠️ This is a parent design, not a delivery epic
>
> **Split 2026-08-04 by ruling D-18.** The eleven functions specified here are delivered by four
> child epics. This document, together with [plan.md](./plan.md), [research.md](./research.md),
> [data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md),
> is the **shared design** they all reference — the same pattern `_shared/` serves for the platform.
>
> | Child epic | Functions | Requirements owned | Tasks |
> |---|---|---|---|
> | [EPIC-019 Steering Engine](../019-steering-engine/) | F-17.1 – F-17.3 | FR-ENH-001 – 005 | 27 |
> | [EPIC-020 Living Specifications & Impact](../020-living-specifications/) | F-17.4 – F-17.6 | FR-ENH-006 – 011 | 22 |
> | [EPIC-021 Review Gates & Roles](../021-review-gates-roles/) | F-17.7, F-17.8, F-17.11, F-17.12 | FR-ENH-012 – 016, 023, 024 | 23 |
> | [EPIC-022 Product Structure & Traceability](../022-product-traceability/) | F-17.9, F-17.10 | FR-ENH-020 – 022 | 16 |
>
> **EPIC-017 itself has no `tasks.md` and no `Phase Z` closure.** It is closed when all four children
> are. Requirements, user stories, success criteria, and the principle register are defined **once**
> here; each child declares which it owns.

**Input**: User description: `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx`

**Parent product spec**: [../_shared/platform-spec.md](../_shared/platform-spec.md)

**Sibling epic**: [EPIC-018 Repository Governance Process](../018-repository-governance/) — the
*process* half of the same source document, proceeding independently

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (Business Requirement
> Specification, APPROVED; scope ruling T-106). This Epic implements **BR-0070, BR-0033, BR-0060, BR-0041 (via children)**. The prior
> hold (decision D-10, PMI-TASK-001 T-101/T-106) is discharged; resumption goes through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

> ⚠️ **This epic is expected to split further.** Even after the process half moved to EPIC-018, what
> remains is five enhancement areas across two modules. That is closer to a module group than an
> epic. Decomposition is an expected outcome of `/speckit-plan`.

## Clarifications

### Session 2026-08-04

- Q: Does this epic deliver PMI Studio *product* capability, this *repository's own* specification
  process, or both? → A: **C — Both, split into two epics.** EPIC-017 retains the product capability
  and stays held; a sibling epic, **EPIC-018 Repository Governance Process**, takes the repository
  half and may proceed immediately. Product capability retained here: Steering Engine, Living
  Specifications, AI Review Gates, and the product-generated specification and traceability
  capabilities. Moved to EPIC-018: recommended repository paths, steering-file definitions, Spec Kit
  folder mapping, repository governance workflow, internal specification templates, and internal
  traceability conventions. This follows the same product/process separation already used to split
  EPIC-013 out of EPIC-003.
- Q: Does this document supersede the existing deferrals for the Knowledge Graph, Persistent Memory,
  and the AI-platform modules, or is it a target-state model delivered across the existing phases? →
  A: **A — Target state; existing phases unchanged.** The document describes intended target-state
  architecture and does **not** supersede approved phase and module assignments. Enterprise Knowledge
  Graph remains deferred to **M-10 (Phase 2)**; Persistent AI Memory remains part of that later
  knowledge-capability delivery; Prompt Registry and Model Registry remain under **M-07**;
  MCP-related capabilities remain under **M-09 (Phase 3)**; Agent Marketplace remains deferred to its
  approved later-phase module; AI-platform and cost-optimisation controls remain under **M-07**.
  **User Story 6 leaves this epic** for the Phase 2 knowledge epic. M-07, M-09, and M-10 are **not**
  pulled forward through EPIC-017.
- Q: Where does this document rank against `PMI-DOC-000` and the MPS under decision D-12? → A:
  **C — Layer the authority.** MPS governs product scope and requirements; `PMI-DOC-000` governs
  documentation standards used inside this repository; `PMI-DOC-003` governs principles; the
  enhancement document governs **the structure and traceability of specifications PMI Studio
  generates or manages as a product capability**. Therefore the 21-section structure and 12-link
  chain apply to product outputs, repository documents keep `PMI-DOC-000`, existing repository
  specifications are **not** rendered non-conformant, and conflict **C-18** is resolved by layering
  rather than supersession. Recorded as ruling **D-16** in
  [srs-alignment.md](../srs-alignment.md).

**Principle rulings from this session**: PP-013 and PP-017 are **confirmed as valid target-state
principles but remain deferred** — PP-013 to M-10, PP-017 to M-07. Neither is contested any longer.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Engineering Lifecycle — Vision → … → Continuous Improvement | FR-ENH-021 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Enhancements — Steering Engine (Organization, Workspace, Project, Product) | FR-ENH-001 to FR-ENH-005 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Enhancements — Living Specifications | FR-ENH-006, FR-ENH-007 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Enhancements — Specification Dependency Graph; Impact Analysis | FR-ENH-008 to FR-ENH-011 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Enhancements — AI Review Gates | FR-ENH-012 to FR-ENH-016 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Standard Specification Template — twenty-one sections | FR-ENH-020 — **product outputs only** (D-16) |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Traceability Chain — Vision → … → Operations (twelve links) | FR-ENH-021, FR-ENH-022 — **product traceability only** (D-16) |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended AI Agents — twelve named roles | FR-ENH-023, FR-ENH-024 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Guiding Principles — seven statements | Acceptance scenarios; SC-ENH-001 to SC-ENH-010 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Enhancements — Enterprise Knowledge Graph; Persistent AI Memory | ➡️ **Moved to the Phase 2 knowledge epic (M-10)** by the 2026-08-04 clarification |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Repository; Steering Files; Spec Kit Mapping | ➡️ **Moved to [EPIC-018](../018-repository-governance/)** by the 2026-08-04 clarification |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Additional Enterprise Modules — twelve modules | ⚠️ Mostly deferred to their approved modules — see the Adoption Register |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-003 Human-in-the-Loop; PP-016 Explainable AI | FR-ENH-012 to FR-ENH-016 |
| `SRS/PMI-DOC-000_Product_Documentation_and_Specification_Standard_v1.0.docx` | §4 Standard Document Structure; §5 Traceability Rules | ✅ **No conflict after D-16** — PMI-DOC-000 governs repository documents; this document governs product outputs |
| `SRS/new/PMI_Studio_MPS_v1.0_Volume_2_*.docx` | Cross-cutting requirements; 12 functional domains | ✅ MPS retains authority over product scope and requirements (D-12, reaffirmed by D-16) |
| `specs/srs-alignment.md` | **C-18** ✅ resolved by **D-16**; **D-2** and **D-4** scoped, not closed | FR-ENH-020, FR-ENH-021 |

**Requirements not yet covered by SRS**: none. Every requirement below derives from the named source
document.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

The platform-wide register is in the [parent product spec](../_shared/platform-spec.md). This epic
declares a full register rather than deltas alone, because it changes the programme's position on
four principles.

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | ✅ Satisfied | The source document's first guiding principle; steering constrains generation before it runs (FR-ENH-004) |
| PP-002 | Single Source of Truth | ✅ Satisfied | Living specifications (FR-ENH-006) exist precisely so a specification stops drifting from reality |
| PP-003 | Human-in-the-Loop | ✅ **Strengthened here** | Review gates require a named human decision before a specification advances (FR-ENH-014); "human approval for governed actions" is a guiding principle of the source |
| PP-004 | End-to-End Traceability | ✅ **Satisfied here for the product** | The twelve-link chain (FR-ENH-021) closes the code/test/release gap in PMI Studio's product traceability. Per **D-16** this does **not** settle repository traceability, which awaits **D-2** |
| PP-005 | Modular Architecture | ✅ Satisfied | Steering is four independently addressable scopes; the roster is a set of bounded roles |
| PP-006 | Engine Independence | ⚠️ Partial | Steering and review roles MUST be expressed as engine-neutral contract inputs, not Spec Kit prompt templates, or PP-006 regresses. Constraint recorded in Assumptions |
| PP-007 | API & MCP First | 🔶 **Deferred** | Unchanged — MCP surface remains catalog module **M-09 (Phase 3)**; reaffirmed 2026-08-04. Owner: tech lead |
| PP-008 | Security by Design | ⚠️ Partial | Steering includes a security subject and a Security Reviewer role (FR-ENH-002, FR-ENH-023); RBAC and SSO remain Phase 3 |
| PP-009 | Quality by Design | ✅ Satisfied | Review gates, validation rules, and test scenarios become structural rather than optional practice |
| PP-010 | Observability by Default | ⚠️ Partial | Observability Hub not adopted — see the Adoption Register. Signals themselves ship in EPIC-001 F-00.5 (decision D-7) |
| PP-011 | Documentation as Code | ✅ Satisfied | Steering content is versioned and editable as text |
| PP-012 | Everything Versioned | ✅ Satisfied | "Everything versioned" is a guiding principle of the source; steering itself is versioned (FR-ENH-003) |
| PP-013 | Knowledge-Driven Engineering | 🔶 **Deferred** | ✅ Resolved 2026-08-04: confirmed a valid **target-state** principle, but deferred to catalog module **M-10 (Phase 2)**. The Enterprise Knowledge Graph and Persistent AI Memory that would discharge it **left this epic** with User Story 6. Owner: product owner |
| PP-014 | Configuration over Customization | ✅ Satisfied | Steering is configuration; no per-tenant forks |
| PP-015 | Open Standards | ✅ Satisfied | Acceptance criteria in Gherkin/EARS — both open notations |
| PP-016 | Explainable AI | ✅ **Strengthened here** | Gate outcomes record which role reviewed what, its findings, and what a human overrode (FR-ENH-015) |
| PP-017 | Cost-Aware AI | 🔶 **Deferred** | ✅ Resolved 2026-08-04: confirmed a valid **target-state** principle, deferred to **M-07**. ⚠️ **Residual exposure**: the twelve reviewing roles (FR-ENH-023) still land in *this* epic and multiply model spend, while the optimisation controls that would bound it do not. Containment remains the platform's per-job caps (FR-025). RAID **R-02** must be re-scored when this epic is planned. Owner: tech lead |
| PP-018 | Scalability First | ⚠️ Partial | Dependency and impact queries must stay responsive at the platform's 500-specifications-per-project target (SC-ENH-003); the source states no scale target |
| PP-019 | Continuous Improvement (DORA/SPACE) | 🔶 **Deferred** | Lessons Learned unadopted; unchanged → M-14 Reporting. Owner: product owner |
| PP-020 | Customer Value | ✅ Satisfied | Nine measurable, user-facing success criteria below |

**Deferral count**: 4 (PP-007, PP-013, PP-017, PP-019) — each with an owner and a discharging module.
**Zero contested.** The two contested at draft were resolved by the 2026-08-04 clarification.

## Scope Moved Out of This Epic

Recorded rather than deleted, so the decisions stay traceable and the identifier gaps are explained.

| Item | Moved to | Ruling |
|---|---|---|
| **User Story 6** — reuse what the organization already knows | Phase 2 knowledge epic (**M-10**) | Q2 → A |
| **FR-ENH-017** — queryable record of organizational knowledge | Phase 2 knowledge epic (**M-10**) | Q2 → A |
| **FR-ENH-018** — surface relevant prior knowledge | Phase 2 knowledge epic (**M-10**) | Q2 → A |
| **FR-ENH-019** — retain assistance context across sessions | Phase 2 knowledge epic (**M-10**) | Q2 → A |
| **SC-ENH-008** — zero knowledge items cross a workspace boundary | Phase 2 knowledge epic (**M-10**) | Q2 → A |
| Recommended repository paths; steering-**file** definitions; Spec Kit folder mapping; repository governance workflow; internal specification templates; internal traceability conventions | [**EPIC-018**](../018-repository-governance/) | Q1 → C |

`FR-ENH-017` to `FR-ENH-019` and `SC-ENH-008` are **deliberately vacant** in this epic. The
identifiers travel with the requirements to their destination epic rather than being reused —
consistent with the programme's invariant-identifier convention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Steer generation with organizational context (Priority: P1)

An architect records the organization's standards once — coding standards, security posture, UI
conventions, technology stack, business rules — as steering content at the level where it applies:
organization, workspace, project, or product. From then on every generated specification obeys those
standards without anyone restating them, and a specification that violates one is reported rather
than quietly produced.

**Why this priority**: Steering is the enhancement every other one leans on. Without it, generated
specifications restate context by hand, drift between authors, and encode standards nowhere
inspectable. It is also the cheapest to prove: a specification generated with a steering rule and one
generated without it must differ observably.

**Independent Test**: Record steering content constraining one standard, generate a specification and
confirm the output honours it; retire the steering content, regenerate, and confirm the difference.

**Acceptance Scenarios**:

1. **Given** organization-level steering content, **When** a specification is generated in any
   workspace beneath it, **Then** that content constrains the result.
2. **Given** steering content at two scopes that conflict, **When** generation runs, **Then** the
   narrower scope wins and the override is recorded.
3. **Given** steering content is changed, **When** the user views specifications generated under the
   previous version, **Then** those are shown as generated under superseded steering.
4. **Given** a generated specification that violates active steering, **When** generation completes,
   **Then** the violation is reported as a finding rather than silently accepted.
5. **Given** no steering content exists, **When** generation runs, **Then** it succeeds unchanged —
   steering is additive, never a precondition.

---

### User Story 2 - Keep a specification alive (Priority: P1)

A specification is not written once and abandoned. When the artifacts it describes change, it is
marked as no longer current, showing what changed, so its owner can bring it back into agreement
rather than discovering the gap months later.

**Why this priority**: "Living Specifications" is what distinguishes this model from a document
store. The platform already flags a specification out of date when a *requirement* changes (FR-032);
this extends currency to the whole chain and makes staleness visible where the reader is.

**Independent Test**: Change an upstream artifact, confirm the derived specification is marked stale
with the change identified, reconcile it, and confirm the mark clears.

**Acceptance Scenarios**:

1. **Given** a current specification, **When** any artifact it derives from changes, **Then** it is
   marked not current, naming what changed.
2. **Given** a stale specification, **When** its owner reconciles it, **Then** the mark clears and
   the reconciliation is attributed and time-stamped.
3. **Given** a stale specification, **When** anyone views it, **Then** the staleness is visible on
   the specification itself, not only in a report.
4. **Given** a baselined specification, **When** an upstream artifact changes, **Then** the baseline
   is **not** altered — reconciliation creates a new draft (consistent with FR-011a).

---

### User Story 3 - See what a change will break (Priority: P1)

Before committing to a change, anyone can ask what depends on the thing being changed and see the
answer: which specifications, tasks, tests, and releases are affected, and how far the blast radius
reaches. Dependencies are recorded, not inferred by reading.

**Why this priority**: Impact analysis is what makes a large specification estate safe to change. At
the platform's target of 500 specifications per project, manual impact assessment stops working, and
an unassessed change is how a specification estate silently decays.

**Independent Test**: Record dependencies among several specifications, request impact for one, and
confirm the returned set matches the recorded graph — including indirect, multi-hop dependents.

**Acceptance Scenarios**:

1. **Given** artifacts with recorded dependencies, **When** the user requests impact for one,
   **Then** every direct and indirect dependent is returned.
2. **Given** an impact result, **When** the user inspects it, **Then** each dependent shows the path
   by which it is affected, not merely that it is.
3. **Given** a circular dependency, **When** it would be created, **Then** it is refused or reported
   — never silently stored.
4. **Given** a dependency on a retired or archived artifact, **When** impact is requested, **Then**
   the link is returned and marked, consistent with the platform's retired-requirement handling.

---

### User Story 4 - Gate a specification behind review (Priority: P2)

Before a specification advances through its lifecycle, designated reviewing roles examine it — for
requirements quality, architecture fit, security, and performance — and record findings. A human then
approves or rejects with those findings in front of them. The roles advise; the human decides.

**Why this priority**: "Human approval for governed actions" is a guiding principle of the source and
PP-003 of the programme. P2 because the lifecycle already functions with human-only review
(EPIC-009); gates raise its quality rather than enable it.

**Independent Test**: Submit a specification with a known defect, confirm the relevant reviewing role
reports it, and confirm advancement is blocked until a human explicitly decides.

**Acceptance Scenarios**:

1. **Given** a specification at a gated transition, **When** review runs, **Then** each configured
   role returns findings naming the part of the specification concerned.
2. **Given** outstanding findings, **When** a human approves anyway, **Then** approval succeeds and
   the override is recorded with the approver and the findings overridden.
3. **Given** findings exist and no human has decided, **When** advancement is attempted, **Then** the
   specification does **not** advance — an automated verdict alone never transitions a specification.
4. **Given** a reviewing role is unavailable, **When** review runs, **Then** the gate reports it as
   unavailable rather than passing by default.

---

### User Story 5 - Trace from vision to operations (Priority: P2)

Anyone can follow any artifact along the full product chain — vision, goals, capabilities,
requirements, specifications, architecture, planning, tasks, code, tests, release, operations — in
either direction, and see exactly where the chain is broken.

**Why this priority**: The platform delivers three links of this chain today and records the rest as
the open half of PP-004. P2 because the links must exist before they can be traversed, and several
link types depend on epics not yet built.

**Scope note (D-16)**: this is PMI Studio's **product** traceability capability. This repository's own
traceability conventions are EPIC-018's, governed by `PMI-DOC-000` and the eventual resolution of
decision **D-2**.

**Independent Test**: From a released operational artifact, traverse back to the originating vision
statement; then from a vision statement, list everything derived from it and identify the first
broken link.

**Acceptance Scenarios**:

1. **Given** a fully linked chain, **When** the user traverses from either end, **Then** every
   intermediate link is returned in order.
2. **Given** a chain with a missing link, **When** the user traverses it, **Then** the break is
   reported at the point it occurs, naming the missing link type.
3. **Given** an artifact linked to more than one parent, **When** traversal runs, **Then** all
   parents are returned rather than an arbitrary one.

---

*(User Story 6 — reuse what the organization already knows — moved to the Phase 2 knowledge epic on
2026-08-04. See Scope Moved Out of This Epic.)*

### Edge Cases

- **Steering conflict across scopes**: organization forbids what product requires — the narrower
  scope wins, and the override is recorded rather than resolved silently.
- **Steering retired mid-flight**: specifications generated under it stay valid and stay marked with
  the steering version that produced them.
- **Impact request on an artifact with thousands of dependents**: the result is bounded and reports
  that it is bounded, rather than truncating silently.
- **Circular dependency introduced indirectly** through a multi-hop path: detected on the path, not
  only on the direct edge.
- **Reviewing roles disagree**: all findings are returned; no automatic tie-break — the human decides.
- **A reviewing role returns malformed output**: treated as unavailable, never as a pass.
- **A specification generated before any steering existed**: marked as generated without steering,
  not retroactively judged non-compliant.
- **The chain breaks at a link type no epic has built yet**: reported as a missing link type rather
  than as a data error.
- **A product output uses the 21-section structure while a repository document uses PMI-DOC-000's**:
  both are correct — the structures are scoped to different artifact populations by **D-16**.

## Requirements *(mandatory)*

> **Identifier scheme**: this epic uses the `FR-ENH-###` / `SC-ENH-###` namespace deliberately.
> Reusing bare `FR-###` would repeat conflict **C-01**, where EPIC-002's `FR-001`–`FR-040` collide
> with the platform set. This anticipates decision **D-1**.
>
> **`FR-ENH-017` to `FR-ENH-019` are deliberately vacant** — they moved with User Story 6 to the
> Phase 2 knowledge epic on 2026-08-04.

### Functional Requirements

#### Steering

- **FR-ENH-001**: System MUST support steering context at four scopes — organization, workspace,
  project, and product — where a narrower scope inherits from every broader scope above it.
- **FR-ENH-002**: System MUST support the steering subjects named by the source document:
  organization, workspace, product, architecture, coding standards, security, UI standards, business
  rules, technology stack, and AI governance.
- **FR-ENH-003**: Users MUST be able to create, edit, version, and retire steering content, with the
  edit history retained.
- **FR-ENH-004**: System MUST apply all steering content in scope to every generation, and MUST
  record on each generated artifact which steering content and version constrained it.
- **FR-ENH-005**: System MUST resolve conflicting steering by preferring the narrower scope, and MUST
  record the override rather than discarding the broader rule.

#### Living specifications

- **FR-ENH-006**: System MUST mark a specification as not current when any artifact it derives from
  changes, identifying what changed.
- **FR-ENH-007**: Users MUST be able to reconcile a stale specification, clearing the mark and
  recording who reconciled it and when; a baselined specification MUST be reconciled through a new
  draft rather than by alteration.

#### Dependency graph and impact analysis

- **FR-ENH-008**: System MUST record dependencies between artifacts as first-class directed
  relationships, distinct from the derivation links of FR-029.
- **FR-ENH-009**: Users MUST be able to request the impact of changing an artifact and receive every
  direct and indirect dependent.
- **FR-ENH-010**: System MUST return, for each affected artifact, the dependency path by which it is
  affected, and MUST state when a result set has been bounded.
- **FR-ENH-011**: System MUST detect circular dependencies, including multi-hop cycles, and refuse or
  report them rather than storing them silently.

#### Review gates

- **FR-ENH-012**: System MUST allow review gates to be configured on specification lifecycle
  transitions, each naming the reviewing roles that must run.
- **FR-ENH-013**: System MUST return review findings that each identify the part of the specification
  they concern and the role that raised them.
- **FR-ENH-014**: System MUST require an explicit human decision to advance a gated transition; an
  automated verdict alone MUST NOT transition a specification.
- **FR-ENH-015**: System MUST record every gate outcome — the roles that ran, their findings, the
  human decision, and any findings overridden — against the specification.
- **FR-ENH-016**: System MUST report an unavailable or malformed reviewing role as a failed gate,
  never as a pass.

#### Product specification structure and traceability *(scoped by D-16)*

- **FR-ENH-020**: System MUST support the twenty-one-section specification structure named by the
  source document as the standard shape of a specification **that PMI Studio generates or manages**.
  This structure does **not** govern this repository's own documents, which follow `PMI-DOC-000`.
- **FR-ENH-021**: System MUST support the twelve-link **product** traceability chain — vision, goals,
  capabilities, requirements, specifications, architecture, planning, tasks, code, tests, release,
  operations — traversable in both directions.
- **FR-ENH-022**: System MUST report, for any chain traversal, the first missing link rather than
  returning a silently shortened chain.

#### Reviewing and authoring roles

- **FR-ENH-023**: System MUST support the twelve reviewing and authoring roles named by the source
  document, each with a declared responsibility and the artifact types it may act on.
- **FR-ENH-024**: System MUST record which role produced or reviewed every generated artifact.

### Key Entities

- **Steering Scope**: One of organization, workspace, project, product. Attributes: identifier, scope
  type, parent scope, workspace.
- **Steering Document**: Versioned guidance bound to a scope. Attributes: identifier, subject, scope,
  content, version, status, edit history.
- **Steering Application**: The record of which steering versions constrained one generation.
  Attributes: generated artifact, steering document versions, timestamp.
- **Dependency Edge**: A directed relationship between two artifacts. Attributes: source, target,
  dependency type, created timestamp, created by.
- **Impact Result**: One answer to an impact request. Attributes: origin artifact, affected artifact,
  path, distance, bounded flag.
- **Review Gate**: A configured checkpoint on a lifecycle transition. Attributes: identifier,
  transition, required roles, blocking flag.
- **Review Finding**: One issue raised by a reviewing role. Attributes: gate outcome, role, location,
  severity, message.
- **Gate Outcome**: The complete record of one gate execution. Attributes: specification, gate, roles
  run, findings, human decision, decider, overridden findings, timestamp.
- **Chain Link**: One edge of the twelve-link product traceability chain. Attributes: source, target,
  link type, workspace.
- **Role**: A named reviewing or authoring responsibility. Attributes: identifier, name,
  responsibility, permitted artifact types.

*(Knowledge Item and Memory Record moved to the Phase 2 knowledge epic.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-ENH-001**: 100% of generated specifications record which steering content and version
  constrained them; zero generated artifacts have unknown steering provenance.
- **SC-ENH-002**: A user can identify every specification affected by a proposed change in a single
  request, without opening any specification.
- **SC-ENH-003**: Impact results are returned for a project holding 500 specifications without
  degrading the responsiveness of the view.
- **SC-ENH-004**: 100% of gated lifecycle transitions carry a recorded human decision; zero
  specifications advance on an automated verdict alone.
- **SC-ENH-005**: Every review finding identifies the part of the specification it concerns and the
  role that raised it; zero unattributed findings.
- **SC-ENH-006**: Zero specifications are silently stale — every specification whose upstream
  artifacts have changed is visibly marked on the specification itself.
- **SC-ENH-007**: A user can traverse from any operational artifact back to its originating vision
  statement, or be told exactly which link breaks the chain.
- **SC-ENH-009**: Circular dependencies are detected before storage in 100% of cases, including
  multi-hop cycles.
- **SC-ENH-010**: A specification author new to the organization produces a specification conforming
  to the standard product structure without external help.

*(`SC-ENH-008` is deliberately vacant — it moved with User Story 6.)*

## Assumptions

- **Steering is additive.** A project with no steering content behaves exactly as the platform does
  today. Steering constrains generation; it is never a precondition for it.
- **Reviewing roles are engine-neutral.** Roles are expressed as capabilities requested through the
  engine contract, not as Spec Kit prompt templates — otherwise PP-006 engine independence regresses
  and the architecture test (T047, T142) becomes the only thing between this epic and a Spec Kit
  dependency inside `backend/`.
- **"AI agent" means a reviewing or authoring role**, not a separately deployed service. How a role
  is executed is a planning decision, not a specification decision.
- **The twelve-link chain extends the platform's three links**; it does not replace them. Existing
  requirement → specification → task links stay valid and become a subset of the longer chain.
- **Dependency edges are distinct from derivation links.** FR-029 records what an artifact was
  *generated from*; FR-ENH-008 records what an artifact *depends on*. Conflating them would make
  impact analysis return generation history instead of blast radius.
- **The twenty-one-section structure applies to product outputs only** (D-16). This repository's
  documents follow `PMI-DOC-000`, and no existing repository specification becomes non-conformant.
- **The organization tier is new.** The platform's tenancy model tops out at *workspace* (FR-002);
  FR-ENH-001 adds a scope above it, which changes EPIC-004's first migration.
- **The twelve roles are in scope; the AI platform that would optimise their cost is not.** Per Q2,
  M-07 does not move. Cost containment therefore remains the platform's per-job caps alone.
- **No target technology, storage, or interface is chosen here**; all are deferred to
  `/speckit-plan`, consistent with the platform spec.
- **The SRS is the requirement authority.** Where this specification and the source document
  disagree, the source document wins and this one is corrected (Constitution II).

## Adoption Register — source items NOT adopted as requirements here

Recorded in the pattern the platform spec established for the MPS drop. The test applied was
**"does deferring it make it more expensive later?"**, not "is it mentioned?".

| Source item | Decision | Reason |
|---|---|---|
| Specification Versioning & Baselines | ✅ **Already satisfied** | Delivered by EPIC-009 (FR-011, FR-011a/b, FR-013 to FR-015) |
| End-to-End Traceability (as a capability) | ✅ **Partly satisfied** | EPIC-011 delivers three links; FR-ENH-021 extends the product chain to twelve |
| Decision Records (ADR) | ✅ **Already satisfied** | EPIC-016 (FR-034) and the programme's own `adr/` (decision D-11) |
| Steering Engine — organization tier | ⚠️ **Adopted with a dependency** | Tenancy tops out at *workspace* today. A scope above it changes EPIC-004's first migration — cheap before any row exists, a migration afterwards |
| Recommended Repository layout; Steering **Files**; Spec Kit Mapping | ➡️ **Moved to [EPIC-018](../018-repository-governance/)** | Q1 → C. Repository process, not product capability |
| Enterprise Knowledge Graph; Persistent AI Memory | 🔶 **Deferred to M-10 (Phase 2)** | Q2 → A. Target-state principle PP-013 confirmed, timing unchanged. Owner: product owner |
| Prompt Registry; Model Registry | 🔶 **Deferred to M-07** | Q2 → A. Product capability, but not pulled forward. Owner: tech lead |
| Agent Marketplace | 🔶 **Deferred to its approved later-phase module** | Q2 → A. Related MCP capability stays in **M-09 (Phase 3)**. Owner: tech lead |
| Cost Management / AI-platform cost optimisation | 🔶 **Deferred to M-07** | Q2 → A. PP-017 confirmed as target state; RAID **R-02** must be re-scored when this epic is planned, because the roles land here and the controls do not |
| Strategy Management; Architecture Repository | 🔶 Deferred | No owning module in current scope. Owner: product owner |
| Policy Engine; Compliance Manager; Risk Register | 🔶 Deferred | Enterprise governance is Phase 3 by clarification. Owner: product owner |
| Observability Hub | 🔶 Deferred | Signals ship in EPIC-001 F-00.5 (decision D-7); a *hub* is aggregation, needing a hosting substrate this programme deliberately has not chosen |
| Lessons Learned | 🔶 Deferred | → M-14 Reporting, with PP-019. Owner: product owner |
| Acceptance criteria in Gherkin/EARS | ⚠️ **Partial** | The structure is adopted (FR-ENH-020); enforcing the *notation* is a validation rule deferred to `/speckit-plan` |

**3 already or partly satisfied · 1 adopted with a dependency · 1 moved to EPIC-018 · 8 deferred ·
1 partial.** Every deferral names an owner and a discharging module.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/017-enhancement-model/defects/` contains no open defect records
- [ ] Principle deltas above still hold; all four deferrals retain a valid owner and module
- [ ] **RAID R-02 re-scored** for the twelve reviewing roles, since PP-017's controls stayed in M-07
- [ ] The Phase 2 knowledge epic exists and owns FR-ENH-017 to FR-ENH-019 and SC-ENH-008
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
