# PMI-DOC-004 — Business Requirement Specification & Approved Scope

**Document ID**: PMI-DOC-004 · **Version**: 1.0 · **Status**: APPROVED
**Owner**: Project Owner (Product) · **Author**: drafted with Claude, 2026-08-20
**Depends on**: PMI-DOC-000 (structure, identifiers), PMI-DOC-001 (vision), PMI-DOC-002 (charter), PMI-DOC-003 (principles)
**Discharges**: PMI-TASK-001 **T-101** (Complete Business Requirement Specification) and **T-106** (Approve business scope — approved by the Project Owner, 2026-08-20, in the drafting session’s batched decision round)

> **Why this document exists**: 19 delivery Epics — 394 open tasks, every open task in the
> programme — are held awaiting exactly this document (`governance/epic-stage-register.md`).
> Each held Epic is fully specified, planned, tasked, clarified and analyzed; what they lack is
> the business requirement each traces UP to, and the approved scope ruling that releases them.
> This document supplies both, and nothing else: functional detail stays in the Epic specs,
> which Constitution II subordinates to this document where they disagree.

## 1. Executive Summary

PMI Studio is an enterprise AI-native engineering platform built on specification-first
delivery (PMI-DOC-001). This document states **what the business requires the product to do**,
as 24 business requirements (`BR-0001`–`BR-0113`) grouped under six business goals, and rules
**which of the catalogued capabilities are in the approved Phase 1 scope**. Its unit of
release is the Epic: every BR names the Epic(s) that implement it, so approval of this
document releases the held Epics through the existing Definition-of-Ready gate — no new
decomposition is created here.

## 2. Business Objective

From PMI-DOC-001, restated as numbered goals so requirements can trace to them (PMI-DOC-000 §5):

| ID | Business Goal | Success measure (KPI, from PMI-DOC-001) |
|---|---|---|
| BG-01 | Reduce ambiguity in software delivery — specifications are the single source of truth | Requirement traceability > 95% |
| BG-02 | Increase AI-assisted engineering productivity **under governance** | Higher AI-assisted implementation rate; improved DORA/SPACE |
| BG-03 | End-to-end traceability from business goal to release | Requirement traceability > 95%; reduced requirement defects |
| BG-04 | Pluggable specification engines — no lock-in to one engine or one AI provider | Second engine/agent adapter integrates without business-logic change |
| BG-05 | Enterprise governance: auditable, access-controlled, reviewable delivery | Zero ungoverned AI actions; complete audit trail |
| BG-06 | Reduce delivery lead time and rework | Reduction in delivery lead time (baseline: first measured release) |

## 3. Scope *(T-106 — the approval act)*

**The approved Phase 1 scope is the 28 declared Epics** (`governance/epic-stage-register.md`):
the 7 complete (EPIC-001, 003, 004, 018, 026, 027, 028), the 2 parent designs (EPIC-002, 017),
and the 19 held delivery Epics this document releases.

**Explicitly deferred to Phase 2+** — catalogued in `PMI_Studio_Module_Based_Requirements_and_Epics`
but carrying **no declared Epic** and therefore **no approved scope**:

- MCP Marketplace (discovery, install, permissions, health)
- Knowledge Platform (RAG, knowledge graph, semantic search)
- AI Platform beyond the delivered execution seam (model registry, prompt registry, routing, cost tracking)
- Reporting (executive dashboards, DORA/SPACE analytics, cost analytics)
- Administration (licensing, billing, monitoring, backup)
- Extension SDK (plugin SDK, marketplace, themes, public APIs)
- Constraint Management as a standalone module (its validation concerns are carried inside EPIC-019/021 where declared)

Deferral is a scope ruling, not a cancellation: each deferred area enters scope only through a
future revision of this document (MINOR version bump, re-approval of §3).

**Out of scope permanently** (PMI-DOC-002): source-code editor replacement; proprietary LLM development.

## 4. Stakeholders

Per PMI-DOC-002: Executive Sponsor · Product Management (owner of this document) · Solution
Architecture · Engineering · QA · DevOps · Security · Enterprise Customers · Partners & MCP
Providers. Decision authority for this document: **Project Owner**, exercised through the
`/speckit-*` decision sessions recorded in each Epic's Clarifications.

## 5. Definitions

| Term | Meaning |
|---|---|
| BRS | This document — the Business Requirement Specification |
| Epic | The unit of planning, convergence and release (Constitution III) |
| Held | Fully designed, awaiting a business input — not stalled (stage register) |
| Specification engine | A pluggable generator of specifications (Spec Kit is engine V1) |
| Governed AI action | An AI execution inside the sandbox/egress/audit controls of ADR-0002/0013 |

## 6. Requirements

Identifiers per PMI-DOC-000 §3 (`BR-xxxx`, corpus-wide, four digits). Each requirement is
testable at the business level; functional decomposition lives in the named Epic's spec.
**Trace direction**: BG → BR → EPIC (PMI-DOC-000 §5).

### 6.1 Access & identity (BG-05)

- **BR-0001** — The platform MUST isolate each tenant workspace's data and actions from every other tenant's. → EPIC-001, EPIC-004 *(delivered; retro-traced)*
- **BR-0002** — Users MUST sign in and act under an authenticated session; governed actions are refused to unauthenticated actors. The identity provider MUST be replaceable without changing the request pipeline. → EPIC-005 *(supersedes provisional FR-000 in the platform spec, closing the 2026-08-19 trace hole)*
- **BR-0003** — Access to artifacts and actions MUST be role-based, with review/approval authority separated from authoring. → EPIC-021, EPIC-024

### 6.2 Project & requirement management (BG-01, BG-03)

- **BR-0010** — Users MUST create and manage projects through a lifecycle (create, plan, execute, close) inside their workspace. → EPIC-006
- **BR-0020** — The platform MUST capture business requirements from documents and user input, normalize them to typed identifiers, and keep them as first-class, versioned records. → EPIC-007
- **BR-0021** — Requirement gaps and conflicts MUST be surfaced to the requirement owner before specification generation, not discovered after implementation. → EPIC-007

### 6.3 Specification lifecycle (BG-01, BG-04)

- **BR-0030** — The platform MUST generate implementation-ready specifications from selected requirements through a pluggable specification engine; Spec Kit is engine V1. → EPIC-008, EPIC-013 *(engine seam delivered by EPIC-003/028)*
- **BR-0031** — Specifications MUST be versioned with an approval workflow; a superseded version remains readable and traceable. → EPIC-009
- **BR-0032** — Users MUST author, review and navigate specifications through a dedicated interface. → EPIC-010
- **BR-0033** — When a requirement changes, the platform MUST identify the specifications, tasks and code the change impacts. → EPIC-020

### 6.4 Traceability & structure (BG-03)

- **BR-0040** — Every artifact MUST trace upstream to a requirement and downstream to tasks, code, tests and release, per the PMI-DOC-000 §5 chain. → EPIC-011
- **BR-0041** — Product structure (module → epic → feature → story) MUST be explicit and queryable, so scope questions are answered from the structure rather than from memory. → EPIC-022

### 6.5 Delivery workflow & governance (BG-02, BG-05)

- **BR-0050** — Specifications MUST decompose into ordered, dependency-aware tasks with progress visible per epic and per project. → EPIC-012
- **BR-0060** — Delivery MUST pass through named review gates with role-appropriate approvers; a gate that is skipped is a recorded violation, not a silent pass. → EPIC-021
- **BR-0061** — AI agents MUST be able to run unattended within governed bounds, with their output entering team review rather than shipping directly. → EPIC-023
- **BR-0062** — Access to run artifacts MUST be controlled at the artifact level, snapshotted at run start. → EPIC-024
- **BR-0063** — Approved artifacts MUST be publishable to external storage under the same access rules that governed them internally. → EPIC-025
- **BR-0070** — The organization's engineering conventions (steering) MUST be first-class content that the platform injects into AI work, tenant-scoped and versioned. → EPIC-019

### 6.6 Quality, operations & records (BG-05, BG-06)

- **BR-0080** — Every delivered epic MUST be validated by QA against its acceptance criteria before promotion; validation evidence is retained. → EPIC-015
- **BR-0090** — Promotion MUST follow local → dev → stage → prod with no skipped environment, gated on green tests and clean convergence (Constitution IV/VII). → EPIC-014
- **BR-0100** — Significant architectural decisions MUST be recorded as ADRs linked to the epics they govern. → EPIC-016
- **BR-0110** — AI execution MUST occur inside a sandbox whose network egress permits exactly the destinations policy names — delivered and enforced. → EPIC-003, EPIC-028 *(delivered; retro-traced)*
- **BR-0111** — Every workspace action MUST be auditable: who, what, when, immutable. → EPIC-004 *(delivered; retro-traced)*
- **BR-0112** — The repository and its governance MUST be navigable by a newcomer from a single index. → EPIC-018 *(delivered; retro-traced)*
- **BR-0113** — Epic readiness MUST be derived from artifacts on disk and visible on a stage register, never declared by hand. → EPIC-026 *(delivered; retro-traced)*

## 7. Business Rules

- **RULE-01** — No application code exists without a specification chain (Constitution I; PP-001 Specification First).
- **RULE-02** — AI accelerates engineering under human governance; a human approves scope, gates and releases (PP-003 Human-in-the-Loop).
- **RULE-03** — Where a spec and this BRS disagree, this BRS wins and the spec is corrected (Constitution II).
- **RULE-04** — Held work resumes only through the Definition-of-Ready gate, not by declaration (EPIC-026).
- **RULE-05** — Scope changes to §3 require a version bump and re-approval of this document — never a silent edit.

## 8. Constraints

- Delivery follows the constitution v1.4.0 (spec-kit command gate, mandatory tests, convergence, closing reports, Delivery Board sync).
- The AI provider and the execution substrate are replaceable behind contracts (FR-AGT-004/006); no business capability may depend on a named vendor.
- Sandbox egress stays deny-all-plus-allowlist (ADR-0002/0013); no capability may require general internet access from a generation sandbox.
- 20 product principles of PMI-DOC-003 bind the programme (decision D-6: declared per epic, deferred only with an owner).

## 9. Dependencies

- **Upstream**: PMI-DOC-000/001/002/003 (all Draft→current); the MPS volumes (`SRS/new/`) refine but do not gate this document (decision D-13 sequencing applies to identifiers, not to scope).
- **Downstream**: the 19 held Epic specs cite this document's BR-xxxx identifiers in their SRS Traceability tables; EPIC-005's provisional FR-000 is superseded by BR-0002 on approval.

## 10. Acceptance Criteria

This document is DONE when:

1. Every held Epic's hold reason is dischargeable by citing a BR in §6 — verified by the stage register showing 0 Epics held on PMI-DOC-004 after the DOR pass.
2. §3's scope ruling is approved by the Project Owner (T-106) and this document's status reads **Approved v1.0**.
3. Each BR carries at least one implementing Epic and each in-scope Epic traces to at least one BR (no orphan in either direction).
4. KPIs in §2 have owners and a measurement point (first measured release).

## 11. Traceability

Chain per PMI-DOC-000 §5: **BG (§2) → BR (§6) → EPIC → feature/story/task (each Epic's spec and tasks.md) → code/test (task pairing, Constitution V) → release (Constitution VII pipeline)**.
The BR→EPIC map is complete in §6; the reverse map lives in each Epic spec's SRS Traceability table, updated when the Epic resumes.

## 12. Related Documents

PMI-DOC-000 (standard) · PMI-DOC-001 (vision) · PMI-DOC-002 (charter) · PMI-DOC-003 (principles) · PMI-TASK-001 (T-101/T-106) · `governance/epic-stage-register.md` · `specs/srs-alignment.md` (open conflicts C-01/C-02 against PMI-DOC-000 — tracked there, not resolved here)

## 13. Revision History

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-20 | Initial draft: 6 goals, 24 BRs mapped to all 28 declared Epics, Phase 1 scope ruling drafted for T-106 approval |
| 1.0 | 2026-08-20 | **Approved** by the Project Owner: scope as drafted (28 Epics in, six catalog areas deferred), KPIs as drafted, Markdown authoritative. T-101 and T-106 discharged |
