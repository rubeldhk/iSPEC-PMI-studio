# PMI-DOC-004 — Business Requirement Specification & Target Product Scope

**Document ID**: PMI-DOC-004 · **Version**: 2.0 · **Status**: **APPROVED**
**Owner**: Project Owner (Product) · **Date**: 2026-08-21 · **Approved**: 2026-08-22 by the Project Owner
**Supersedes**: PMI-DOC-004 v1.0 **for target-product scope only**; v1.0 remains the historical
Phase-1 release baseline and its scope ruling stays valid as a release record (`RULE-12`).
**Depends on**: PMI-DOC-000 (structure, identifiers), PMI-DOC-001 (vision), PMI-DOC-002 (charter),
PMI-DOC-003 (principles), PMI-DOC-005 (design system)
**Incorporates**: PMI-DOC-004A V2 Gap Analysis & Amendment Package; the accepted Augment/Cosmos
Learnings Amendment as reconciled by `EPIC-027`; the approved Requirement/Change/Defect direction.

> PMI Studio is the governed control plane for AI-native software engineering: it converts intent
> into approved engineering work, supplies trusted context to interchangeable execution agents,
> records decisions and evidence, verifies specification compliance, and keeps requirements,
> changes, defects and releases traceable end to end.

---

## 0. What changed from v1.0, and what did not

v1.0 did a narrow job well: it created the business-requirement layer above the declared delivery
Epics and released 19 held Epics through the Definition-of-Ready gate. **It is not withdrawn.**

v2.0 changes one thing structurally: **the product scope model**. v1.0 §3 ruled that "the approved
Phase 1 scope is the 28 declared Epics", which made *declared delivery scope* and *product scope*
the same statement. That is a sound release gate and a weak product definition — a capability the
programme has decided to build disappears from the BRS until an Epic is declared for it. v2.0
separates three scopes (§3.5) so that no longer happens.

Everything listed in PMI-DOC-004A §4 is preserved unchanged: the specification-first principle,
`BG-01`–`BG-06`, tenant isolation, project lifecycle, versioned first-class requirements and
specifications, the replaceable engine contract, traceability, task decomposition, review gates,
sandboxed execution, immutable audit, environment progression, ADR discipline, PMI-DOC-005 and
WCAG 2.2 AA, and the delivered `EPIC-001`/`EPIC-003`/`EPIC-028` architecture.

### 0.1 Identifier ruling — read before citing any `BR-`

The v2.0 draft circulated in the review package **reused ten approved v1.0 identifiers with
different meanings** (`BR-0040`, `0041`, `0050`, `0060`, `0061`, `0062`, `0063`, `0080`, `0090`,
`0100`). PMI-DOC-000 §3 makes identifiers corpus-wide — one identifier, one meaning — and 50 live
citations across `specs/`, `governance/` and `adr/` already depend on the v1.0 meanings.

**Project Owner ruling, 2026-08-21: v1.0 identifier meanings are preserved.** Where v2.0 keeps a
v1.0 concept, it keeps the v1.0 identifier. Every genuinely new requirement takes a free identifier.
**No existing citation anywhere in the repository needs to change.** The cost is that §6 numbering
is not strictly section-aligned; the crosswalk in §14 is authoritative for anyone reconciling the
circulated draft's numbering against this document.

### 0.2 Coverage restored

The circulated draft dropped business coverage for three declared Epics — `EPIC-018` (repository
navigability), `EPIC-025` (external storage publishing) and `EPIC-026` (derived epic readiness) —
which would have orphaned them against the draft's own acceptance criterion 2. `BR-0063`,
`BR-0112` and `BR-0113` are carried forward unchanged; §6.21 exists to hold the last two.

### 0.3 Document defect closed

v1.0 §1 said "24 business requirements" while §6 listed 25 identifiers (PMI-DOC-004A `G-36`). The
count is stated once in §1 of this document and is asserted by the check named in §12.

---

## 1. Executive Summary

PMI Studio is a specification-first, AI-native software engineering platform for organizations that
need a **ready-to-use integrated engineering ecosystem** rather than a custom internal developer
platform.

The platform does not replace source-code IDEs and does not try to beat specialist coding agents at
code generation. It owns the governed lifecycle around them:

**Intent → Requirement → Decision → Specification → Plan → Execution → Evidence → Verification →
Release → Operations → Defect/Change → Updated Intent**

Spec Kit is the first specification engine and workflow provider behind replaceable contracts
(`ADR-0001`, `ADR-0007`). Claude Code, Codex, Cursor, Augment, GitHub Copilot and future compatible
agents may execute engineering work through adapters (`ADR-0006`, `ADR-0020`). Source control,
CI/CD, cloud, observability, security scanners and collaboration tools are integrated through a
vendor-neutral Capability Hub (`ADR-0023`).

The product differentiator is **specification compliance with trusted context, governed decisions
and auditable evidence** (`ADR-0022`).

This document states **123 business requirements** (`BR-xxxx`) under **ten business goals**
(`BG-01`–`BG-10`), and rules what PMI Studio owns, what it integrates, and what may ship later.

---

## 2. Business Goals

`BG-01` to `BG-06` carry forward from v1.0 with wording refined and meaning intact. `BG-07` to
`BG-10` are new.

| ID | Goal | Primary success measures |
|---|---|---|
| BG-01 | Reduce ambiguity by making approved specifications and decisions authoritative | >95% requirement/spec traceability; fewer requirement-origin defects |
| BG-02 | Increase AI-assisted engineering productivity **under policy** | AI-assisted completion rate; cycle time; rework |
| BG-03 | Maintain end-to-end intent-to-production traceability | >95% critical-artifact trace coverage; explainable impact paths |
| BG-04 | Avoid lock-in to a specification engine, AI provider or engineering tool | second adapter added without business-logic change |
| BG-05 | Make AI-native delivery governable, reviewable and auditable | zero ungoverned consequential actions; complete decision/evidence trail |
| BG-06 | Reduce delivery lead time and rework | lead time; change-failure rate; escaped defect rate |
| BG-07 | Provide trusted task-specific engineering context | context relevance; retrieval precision; lower context/token waste |
| BG-08 | Make completion evidence-driven rather than assertion-driven | % of completed work with satisfied Evidence Contract and compliance verdict |
| BG-09 | Make change and defect handling part of the same living specification lifecycle | change/defect trace coverage; mean time from decision to re-baseline |
| BG-10 | Give smaller and mid-sized engineering organizations an integrated AI-native delivery control plane | onboarding time; active projects; retained workspaces; integration setup time |

---

## 3. Product Scope Model

### 3.1 Core Control Plane — target-product core

PMI Studio owns, and will not delegate:

workspace/identity/access boundaries · project and product structure · Requirement Room ·
specification lifecycle and Spec Kit orchestration · Change Room · Defect Room · Governed
Engineering Loops · hierarchical steering and engineering constraints · task and planning
orchestration · traceability and the engineering relationship graph · Engineering Context packages ·
Engineering Expert registry and sessions · risk/policy decisions and approval gates · evidence store
and Evidence Contracts · specification compliance verdicts · architecture decisions and impact ·
audit and activity history · Capability Hub and adapter governance · Workspace Fabric execution
governance · QA and release-readiness orchestration · the core metrics needed to prove product
outcomes.

### 3.2 Integrated Execution Plane

PMI Studio integrates with rather than rebuilds:

AI coding agents and coding IDEs/CLIs · Git hosting and source control · CI/CD · cloud and
deployment platforms · test runners and test-management tools · security, static-analysis and
code-review tools · observability platforms · ticketing and collaboration systems.

PMI Studio owns the orchestration, permissions, context, decisions, evidence and traceability
*around* them (`RULE-09`).

### 3.3 Expansion Plane

May ship after the core or by edition, without weakening the core:

public MCP/plugin marketplace · broad public extension SDK · advanced executive report designer ·
billing and licensing · large-enterprise compliance/identity packs · theme marketplace · generalized
model marketplace · advanced portfolio financial management.

### 3.4 Permanent non-goals

Carried from PMI-DOC-002 and extended:

- source-code editor replacement;
- proprietary foundation-model development;
- replacing mature commodity systems where a secure adapter satisfies the need;
- allowing AI execution to bypass policy, audit or evidence requirements.

### 3.5 The three scopes — the structural change in this revision

| Scope | Meaning | Where it is ruled | Changes by |
|---|---|---|---|
| **Target Product Scope** | Business capability PMI Studio is committed to as a product | §3.1–§3.3 of this document | MAJOR revision of this document |
| **Release Scope** | Capability approved for a specific release | §10 slices `R1`–`R7` | MINOR revision of this document |
| **Declared Delivery Scope** | Epics decomposed far enough to enter DOR | `governance/epic-stage-register.md` | Epic declaration, never this document |

**A capability MUST NOT disappear from this BRS because no Epic has been declared for it.** An
in-scope requirement with no owning Epic is a recorded gap (§13), not an absence.

> **Approved 2026-08-22 by the Project Owner.** This section, together with §3.1–§3.3, is the
> approval act for decisions 1–5 of PMI-DOC-004A §14: v2.0 is a **major** revision; the
> three-plane boundary is the product boundary; context curation, Engineering Experts, Change Room,
> Defect Room, evidence and compliance, capability abstraction and Workspace Fabric are
> **target-product core**; public marketplace, billing/licensing and broad SDK stay **outside the
> core MVP**; and "enterprise-ready" is an architecture and governance quality (`BG-10`) rather
> than a target-segment claim.
>
> Approval changes scope, not delivery. **No Epic is declared and no posture changes by this act**
> (`RULE-14`, `ADR-0029`); Epic declaration remains the separate `/speckit-specify` flow that writes
> the stage register.

This replaces v1.0 §3, whose deferral list ("MCP Marketplace, Knowledge Platform, AI Platform,
Reporting, Administration, Extension SDK, standalone Constraint Management") conflated *deferred
from a release* with *outside the product*. Under §3.5 those areas split: the public marketplace,
broad SDK, billing and advanced report designer stay in the Expansion Plane; context/knowledge
retrieval, capability abstraction, core metrics and core constraint handling move into the Core
Control Plane, where the accepted amendment had already put them.

---

## 4. Stakeholders and Personas

### 4.1 Decision stakeholders
Project Owner (decision authority for this document) · Product Management · Engineering Leadership ·
Architecture · Security · QA · DevOps/Platform · Customer Administrators.

### 4.2 Working personas
Product Owner / Business Analyst · Stakeholder / Customer Reviewer · Project / Program Manager ·
Solution Architect · Software Engineer · QA Engineer · Security Reviewer · DevOps / Release
Engineer · Auditor / Compliance Reviewer · Workspace Administrator · Engineering Expert (AI/service
identity).

---

## 5. Core Concepts

| Term | Meaning |
|---|---|
| **Room** | A governed collaborative workspace around a lifecycle object, carrying context, decisions, AI analysis, evidence and actions |
| **Governed Engineering Loop** | The reusable workflow primitive: `Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome → Next Event` (`ADR-0018`) |
| **Engineering Expert** | A governed executable AI role with model, tool, context, permission and evidence policies (`ADR-0020`) |
| **Context Package** | A versioned, permission-filtered, task-specific context assembled for a human or Engineering Expert (`ADR-0019`) |
| **Evidence Contract** | The proof that must exist before a task, decision or outcome may be accepted (`ADR-0022`) |
| **Compliance Verdict** | An explainable assessment of implementation and evidence against approved intent (`ADR-0022`) |
| **Capability** | A vendor-neutral engineering action requested by a workflow; an adapter provides the implementation (`ADR-0023`) |
| **Workspace Fabric** | The governed execution substrate spanning managed isolated environments, customer-cloud environments and approved local connectors (`ADR-0024`) |
| **Baseline** | An approved immutable version of a requirement/specification/decision set from which downstream work derives |
| **Held** | Fully designed, awaiting a business input — not stalled (carried from v1.0) |
| **BRS** | This document |

---

# 6. Business Requirements

Identifiers follow PMI-DOC-000 §3 (`BR-xxxx`, corpus-wide, four digits). Each requirement is
testable at the business level; functional decomposition lives in the owning Epic's spec.
**Trace direction**: BG → BR → EPIC (PMI-DOC-000 §5).

**Reading the annotations.** A requirement marked *(v1.0)* is carried forward unchanged in meaning
and identifier. A requirement marked *(v1.0, broadened)* keeps its identifier and extends its scope.
Every other requirement is new in v2.0. The `→` names the owning Epic; **`→ no owner`** means the
requirement is in target scope with no declared Epic, which §13 records as a gap.

## 6.1 Workspace, identity and stakeholder access · BG-05, BG-10

- **BR-0001** *(v1.0)* — **Tenant isolation.** The platform MUST isolate each workspace's data, context, execution and actions from every other tenant. → `EPIC-001`, `EPIC-004`
- **BR-0002** *(v1.0)* — **Authenticated identity.** Human and service actions MUST execute under an authenticated identity; governed actions are refused to unauthenticated actors, and the identity provider MUST be replaceable without changing the request pipeline. → `EPIC-005`
- **BR-0003** *(v1.0, broadened)* — **Authorization.** Artifact and action access MUST be role- and policy-controlled, with authoring, approval and administration authority separable. → `EPIC-021`, `EPIC-024`
- **BR-0004** — **Stakeholder access.** Authorized external stakeholders MUST be able to review assigned requirements, changes and decisions without receiving broader engineering access. → no owner
- **BR-0005** — **Decision authority.** Every governed approval MUST identify the actor, the authority basis, the object version, the decision and the timestamp. → no owner

## 6.2 Project and product structure · BG-01, BG-03

- **BR-0010** *(v1.0)* — **Project lifecycle.** Users MUST create, configure, plan, execute, monitor, close and archive projects within a workspace. → `EPIC-006`
- **BR-0041** *(v1.0)* — **Product hierarchy.** Product structure (module → epic → feature → story/task) MUST be explicit and queryable, so scope questions are answered from the structure rather than from memory. → `EPIC-022`
- **BR-0012** — **Cross-project structure.** The platform SHOULD support portfolio/product grouping and cross-project dependencies without making portfolio management mandatory for a single-project team. → no owner
- **BR-0013** — **Health model.** Project health MUST be derived from current scope, decisions, risks, progress, evidence and quality state rather than declared by hand alone. → no owner

> `BR-0041` sits in this section rather than §6.9 because product structure is a structural concern,
> not a traceability one. It keeps its v1.0 identifier under the §0.1 ruling.

## 6.3 Requirement Room · BG-01, BG-09

- **BR-0020** *(v1.0, broadened)* — **Multi-source intake.** Requirements MUST be captured from direct input and from imported documents and artifacts, normalized to typed identifiers, and kept as first-class versioned records. → `EPIC-007`
- **BR-0021** *(v1.0, broadened)* — **Ambiguity analysis.** The platform MUST identify missing information, conflicts, duplicates, assumptions and ambiguity before baseline and specification — not after implementation. → `EPIC-007`
- **BR-0022** — **Guided clarification.** AI MUST be able to generate targeted clarification questions, and MUST distinguish fact, inference, recommendation and unresolved question. → no owner
- **BR-0023** — **Options and risks.** For material requirement decisions, AI MUST be able to present feasible options, trade-offs, dependencies and risks with its reasoning. → no owner
- **BR-0024** — **Acceptance criteria.** A requirement intended for implementation MUST carry measurable acceptance criteria before baseline, unless an approved exception exists. → no owner
- **BR-0025** — **Stakeholder decision.** Requirement decisions and approvals MUST be made by authorized humans and retained with rationale. → no owner
- **BR-0026** — **Baseline.** Approved requirement sets MUST form an immutable baseline; a later edit creates a change, never a silent mutation. → no owner
- **BR-0027** — **Handoff.** Baselined requirements MUST be selectable inputs to one or more specification workflows. → no owner

## 6.4 Specification lifecycle and engine independence · BG-01, BG-04

- **BR-0030** *(v1.0)* — **Specification generation.** The platform MUST create implementation-ready specifications from approved requirements through a replaceable specification-engine interface; Spec Kit is engine V1. → `EPIC-008`, `EPIC-013` *(seam delivered by `EPIC-003`/`EPIC-028`)*
- **BR-0031** *(v1.0)* — **Version and approval lifecycle.** Specifications MUST be versioned, reviewable, approvable and baselinable; a superseded version remains readable and traceable. → `EPIC-009`
- **BR-0032** *(v1.0)* — **Specification interface.** Users MUST be able to author, compare, review and navigate specifications through a dedicated interface. → `EPIC-010`
- **BR-0033** *(v1.0, broadened)* — **Impact analysis.** A proposed requirement or specification change MUST identify the impacted specifications, tasks, architecture, code, tests, releases and dependent decisions to the extent known. → `EPIC-020`
- **BR-0034** — **Spec Kit lifecycle.** The Spec Kit adapter MUST support the applicable specify/clarify/plan/checklist/tasks/analyze/implement/converge workflow without hard-coding business logic to individual command names. → `EPIC-008`, `EPIC-013`
- **BR-0035** — **Engine provenance.** Every generated artifact MUST record the engine, engine version, execution provider and model where available, its source inputs, and the generating session. → `EPIC-013`
- **BR-0036** — **Spec/code convergence.** The platform MUST be able to detect and surface missing, partial, contradictory or unrequested implementation relative to the approved specification. → no owner
- **BR-0037** — **Extension governance.** Spec-engine extensions, presets, workflows and bundles used in governed projects MUST be versioned, approved or policy-allowed, and provenance-recorded. → no owner

## 6.5 Change Room · BG-09

> Numbering note: the Change Room occupies `BR-0042`–`BR-0048`, not the circulated draft's
> `BR-0040`–`BR-0046`. `BR-0040` and `BR-0041` are approved v1.0 requirements with different
> meanings (§0.1).

- **BR-0042** — **Change intake.** Any proposed modification to an approved baseline MUST be recordable as a Change Request linked to the affected baseline. → no owner
- **BR-0043** — **Change clarification.** The Change Room MUST identify the requested outcome, the reason, the urgency, the requester and the unresolved questions. → no owner
- **BR-0044** — **Change impact.** The platform MUST compute or assemble an impact view across requirements, specifications, architecture, tasks, code, tests, release scope and known operational effects. → no owner
- **BR-0045** — **Trade-off analysis.** AI MUST be able to propose options with schedule, cost, quality, security, compatibility and delivery trade-offs, clearly marked as recommendations rather than decisions. → no owner
- **BR-0046** — **Change decision.** A material change MUST receive an authorized decision before implementation affects an approved baseline. → no owner
- **BR-0047** — **Re-baseline and re-plan.** An approved change MUST create new versions of the affected artifacts and update downstream work, while the prior baseline remains readable. → no owner
- **BR-0048** — **Change evidence.** Closure MUST identify what changed, why, which tests and evidence validate it, and which baseline supersedes the old state. → no owner

## 6.6 Defect Room · BG-06, BG-09

> Numbering note: the Defect Room occupies `BR-0051`–`BR-0058`. `BR-0050` is the approved v1.0 task
> decomposition requirement, which lives in §6.16.

- **BR-0051** — **Defect intake.** Defects MAY originate from automated tests, manual reports, monitoring, review tools or production incidents, and MUST link to an Epic and project. → no owner
- **BR-0052** — **Classification.** A defect MUST be classified against expected approved behavior before implementation work begins. → no owner
- **BR-0053** — **Reproduction.** The defect workflow MUST capture reproducibility, environment, evidence and affected behavior. → no owner
- **BR-0054** — **Test-first repair.** Where automatable, the workflow MUST establish a failing test demonstrating the defect before a fix is accepted. → no owner
- **BR-0055** — **Repair work.** The platform MUST convert a confirmed defect into traceable implementation tasks linked to the failing behavior and its test. → no owner
- **BR-0056** — **Verification.** Closure MUST require the defect test plus applicable regression tests to pass, with the evidence retained. → no owner
- **BR-0057** — **Defect-to-change transfer.** If approved current behavior passes and the requested behavior would alter intent, the item MUST transfer to the Change Room with its context and evidence preserved. → no owner
- **BR-0058** — **Defect analytics.** The platform MUST retain defect origin, escape point, severity, affected requirement/specification and resolution evidence for quality analysis. → no owner

## 6.7 Governed workflow and decision engine · BG-02, BG-05

- **BR-0060** *(v1.0, broadened)* — **Review gates.** Delivery MUST pass through named review gates with role-appropriate approvers; a skipped gate is a recorded violation or an explicit exception, never a silent pass. → `EPIC-021`
- **BR-0064** — **Governed Engineering Loop.** Requirement, Change, Defect and other governed workflows MUST be configurable instances of the common `Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome` model. → no owner
- **BR-0065** — **Explicit states.** Workflow state transitions MUST be explicit, authorized and auditable. → `EPIC-012`
- **BR-0066** — **Risk classification.** Actions MUST be classifiable by risk, impact and policy. → no owner
- **BR-0067** — **Risk-adaptive approval.** Low-risk actions MAY auto-execute where policy permits; medium-risk actions require policy and evidence gates; high-risk or consequential decisions require authorized human approval. → no owner
- **BR-0068** — **Decision Inbox.** Users MUST have a role-aware queue for approvals, review requests, escalations and blocked work. → no owner
- **BR-0069** — **Automation triggers.** Governed workflows MAY react to events, schedules or artifact changes, but every automated transition and action MUST be explainable from a visible rule or policy. → no owner

## 6.8 Steering, constraints and architecture · BG-01, BG-05

- **BR-0070** *(v1.0, broadened)* — **Hierarchical steering.** Engineering conventions and constraints MUST be first-class versioned content the platform injects into AI work, composable at organization, workspace, project, repository and path scope. → `EPIC-019`
- **BR-0071** — **Steering conflict.** The platform MUST detect conflicting applicable steering and identify the resolution or precedence rule that applies. → `EPIC-019`
- **BR-0072** — **Constraint types.** Business, architecture, security, technology, compliance and UI constraints MUST be first-class inputs to planning and execution where applicable. → `EPIC-019`, `EPIC-021`
- **BR-0100** *(v1.0)* — **Architecture records.** Significant architectural decisions MUST be recorded as ADRs or governed architecture artifacts linked to the epics and scope they govern. → `EPIC-016`
- **BR-0073** — **Architecture impact.** A change MUST identify the relevant architecture decisions and constraints and flag likely violations. → no owner

## 6.9 Traceability and the engineering relationship graph · BG-03

- **BR-0040** *(v1.0, broadened)* — **Trace chain.** The platform MUST maintain navigable typed relationships from business goal and stakeholder need through requirement, decision, acceptance criteria, specification, architecture, task, execution session, code/PR, test, evidence, release, deployment, incident, defect and change. → `EPIC-011`
- **BR-0081** — **Verified relationships.** System-derived and imported trace links MUST retain provenance; an LLM-inferred relationship MUST NOT silently become a verified fact. → `EPIC-011`
- **BR-0082** — **Bidirectional impact.** Users MUST be able to traverse upstream to intent and downstream to implementation and evidence. → `EPIC-011`
- **BR-0083** — **Rationale questions.** The platform SHOULD answer "why does this exist, and why did it change?" using verified relationships and cited project evidence. → no owner

## 6.10 Engineering Context · BG-07

> Numbering note: Context occupies `BR-0091`–`BR-0096`. `BR-0090` is the approved v1.0 environment
> promotion requirement, which lives in §6.17.

- **BR-0091** — **Semantic retrieval.** The platform MUST provide or integrate semantic retrieval over approved project engineering sources. → no owner
- **BR-0092** — **Live state.** Context MUST be able to include current repository, branch/PR, workflow, build, test, deployment and incident state, subject to permissions. → no owner
- **BR-0093** — **Context curation.** Before governed AI execution, the platform MUST assemble a task-specific Context Package from objective, role, permissions, security classification, relevance and token/cost budget. → no owner
- **BR-0094** — **Context provenance.** Every Context Package item MUST identify its source and its authoritative/version status. → no owner
- **BR-0095** — **Context isolation.** Context from one tenant or project MUST NOT leak into another unless an explicitly authorized reusable knowledge source permits it. → no owner
- **BR-0096** — **Context inspection.** A user or reviewer MUST be able to inspect the material context supplied to a consequential AI session. → no owner

## 6.11 Engineering Experts and agent sessions · BG-02, BG-04

- **BR-0101** — **Expert registry.** AI engineering roles MUST be registered as governed Engineering Experts. → no owner
- **BR-0102** — **Expert contract.** Each Expert MUST define role and purpose, preferred and fallback models, allowed tools and capabilities, context policy, workspace requirements, permissions, prohibited actions, risk class, budget, memory policy, expected outputs and Evidence Contract. → no owner
- **BR-0103** — **Provider independence.** The same governed role SHOULD be executable through multiple compatible providers and agents without changing business workflow semantics. → `EPIC-028`
- **BR-0104** — **Session record.** Every Engineering Expert run MUST create a durable session record linking inputs, context version, provider, model, actions, outputs, evidence and outcome — and MUST remain a platform record even when code execution happens inside an external provider. → `EPIC-028`
- **BR-0105** — **Delegation.** A governed Expert MAY delegate to sub-agents or other Experts where policy permits; each delegated session remains individually attributable and traceable. → no owner
- **BR-0061** *(v1.0, broadened)* — **Unattended execution.** AI agents MUST be able to run unattended within governed bounds; the resulting work enters verification and team review rather than bypassing release controls. → `EPIC-023`
- **BR-0106** — **Cost and time limits.** Sessions MUST support enforceable time, resource, token and cost limits where the underlying provider exposes them. → no owner

## 6.12 Governed learning and knowledge · BG-05, BG-07

> Numbering note: learning occupies `BR-0114`–`BR-0118`. `BR-0110`–`BR-0113` are approved v1.0
> requirements, held in §6.14, §6.18 and §6.21.

- **BR-0114** — **Learning candidate.** An agent observation MUST enter as an untrusted Learning Candidate, never directly as trusted organizational knowledge. → no owner
- **BR-0115** — **Evidence and provenance.** A Learning Candidate MUST retain its source, supporting evidence, confidence and scope. → no owner
- **BR-0116** — **Learning decision.** Policy MAY auto-approve explicitly low-risk categories; all other learning requires authorized human review. → no owner
- **BR-0117** — **Supersession.** Approved knowledge MUST retain history, scope and supersession or deprecation status. → no owner
- **BR-0118** — **Reuse.** Approved knowledge MAY be reused across projects only according to tenant, classification and scope policy. → no owner

## 6.13 Integration Hub and capability abstraction · BG-04

- **BR-0120** — **Capability contracts.** Core workflows MUST request vendor-neutral engineering capabilities rather than vendor-specific APIs. → no owner
- **BR-0121** — **Capability resolver.** The platform MUST select an authorized adapter based on tenant configuration, policy, environment and capability health. → no owner
- **BR-0122** — **MCP support.** MCP MUST be supported as a first-class integration protocol without becoming the only integration mechanism or the business abstraction. → `EPIC-013` *(core surface; public marketplace stays Expansion Plane)*
- **BR-0123** — **Adapter lifecycle.** Integrations MUST expose configuration, authorization, permission scope, health, version and compatibility, and audit metadata. → no owner
- **BR-0124** — **Least privilege.** A session MUST receive only the tools and capabilities its task requires. → `EPIC-024`, `EPIC-028`
- **BR-0125** — **External evidence.** CI, test, security, review and observability tools MUST be able to contribute typed evidence to PMI Studio. → no owner
- **BR-0126** — **Portability.** Replacing a Git, CI, AI or observability provider MUST NOT require changes to core business rules. → `EPIC-028`

## 6.14 Workspace Fabric and secure execution · BG-04, BG-05

> Numbering note: `BR-0110` is the approved v1.0 sandbox requirement and serves as this section's
> managed-execution requirement; the circulated draft's `BR-0130` is therefore unused.

- **BR-0110** *(v1.0, broadened)* — **Managed isolated execution.** AI execution MUST occur inside an isolated disposable environment whose network egress permits exactly the destinations policy names. → `EPIC-003`, `EPIC-028`
- **BR-0131** — **Customer-cloud execution.** The architecture MUST support policy-controlled execution in customer-owned cloud environments. → no owner
- **BR-0132** — **Controlled local connector.** The platform MAY support developer-machine execution where tenant policy explicitly permits it. → no owner
- **BR-0133** — **Uniform governance.** Identity, permissions, context, policy, audit, evidence and completion rules MUST apply consistently across every execution mode. → no owner
- **BR-0134** — **Network and resource policy.** Managed execution MUST enforce resource ceilings and explicit network and tool permissions. → `EPIC-003`, `EPIC-028`
- **BR-0135** — **Credential isolation.** An execution environment MUST NOT receive platform or database credentials its task does not require. → `EPIC-028`

## 6.15 Evidence, compliance and quality · BG-08

> Numbering note: `BR-0080` is the approved v1.0 QA validation requirement and serves as this
> section's QA requirement; the circulated draft's `BR-0145` is therefore unused.

- **BR-0140** — **Evidence types.** Tests, scans, build results, approvals, screenshots and transcripts, review findings, deployment results and external tool outputs MUST be storable or referenceable as typed evidence. → no owner
- **BR-0141** — **Evidence provenance.** Evidence MUST identify its source, time, artifact and version, and its integrity/provenance metadata. → no owner
- **BR-0142** — **Evidence Contract.** Governed work MUST define the minimum evidence required for successful completion. → no owner
- **BR-0143** — **Compliance verdict.** Before governed completion or promotion, the platform MUST assess approved specification, acceptance criteria, constraints, architecture, implementation and available evidence, and issue an explainable verdict. → no owner
- **BR-0144** — **"Done" is not proof.** An agent or user declaring completion MUST NOT substitute for required evidence. → no owner
- **BR-0080** *(v1.0, broadened)* — **QA validation.** Every delivered Epic and release scope MUST be validated against its acceptance criteria before promotion, with the validation evidence retained. → `EPIC-015`
- **BR-0146** — **External review integration.** Generic code-review, security and testing products MAY supply findings and evidence; PMI Studio need not recreate their specialist analysis. → no owner

## 6.16 Planning, tasks and delivery · BG-02, BG-06

- **BR-0050** *(v1.0)* — **Task decomposition.** Specifications MUST decompose into ordered, dependency-aware tasks with progress visible per epic and per project. → `EPIC-012`
- **BR-0151** — **Work provenance.** Each task MUST identify the requirement, specification and decision it originates from. → `EPIC-012`, `EPIC-022`
- **BR-0152** — **Execution assignment.** Tasks MAY be assigned to humans or Engineering Experts according to capability and policy. → no owner
- **BR-0153** — **Work isolation.** Parallel AI work MUST use isolated workspaces, branches or equivalent mechanisms to prevent uncontrolled cross-session interference. → `EPIC-028`
- **BR-0154** — **Re-plan.** Approved changes, defects and failed compliance checks MUST be able to add or revise tasks without destroying completed-work history. → no owner

## 6.17 Release and operations · BG-06

> Numbering note: `BR-0090` is the approved v1.0 promotion requirement; the circulated draft's
> `BR-0160` is therefore unused. `BR-0063` is restored here (§0.2).

- **BR-0090** *(v1.0, broadened)* — **Environment promotion.** Promotion MUST follow the environment policy configured for the project — local → dev → stage → prod with no skipped environment under the current policy — and a skipped required stage is a violation or a recorded exception. → `EPIC-014`
- **BR-0161** — **Release gate.** A release requires green mandatory tests, satisfied Evidence Contracts and an acceptable compliance verdict. → `EPIC-014`, `EPIC-015`
- **BR-0162** — **Release trace.** A release MUST trace to its included requirements and specification versions, changes, defects, tasks, commits/PRs, tests and approvals. → `EPIC-014`, `EPIC-011`
- **BR-0163** — **Operational feedback.** Incidents, telemetry anomalies and production defects SHOULD be linkable back into the Defect and Change Rooms. → no owner
- **BR-0164** — **Rollback evidence.** Release and rollback actions MUST be audited and linked to the triggering condition or decision. → `EPIC-014`
- **BR-0063** *(v1.0)* — **External publishing.** Approved artifacts MUST be publishable to external storage under the same access rules that governed them internally. → `EPIC-025`

## 6.18 Audit, security and governance · BG-05

> Numbering note: `BR-0111` and `BR-0062` are approved v1.0 requirements serving this section; the
> circulated draft's `BR-0170` and `BR-0172` are therefore unused.

- **BR-0111** *(v1.0, broadened)* — **Immutable audit.** Every governed action MUST record who, what, when, on which object and with what result, append-only and tamper-resistant. → `EPIC-004`
- **BR-0171** — **AI action audit.** Tool calls, material recommendations, approvals, exceptions and state-changing AI actions MUST be attributable to a session and an identity. → `EPIC-028`
- **BR-0062** *(v1.0, broadened)* — **Access snapshot.** Access to run artifacts MUST be controlled at artifact level and snapshotted at run start; permission-sensitive execution retains the effective access and policy snapshot it began with. → `EPIC-024`
- **BR-0173** — **Secret handling.** Secrets MUST be mediated through authorized capability and environment mechanisms, and excluded from logs and context unless explicitly required and protected. → `EPIC-028`
- **BR-0174** — **Policy explainability.** A blocked or allowed consequential action MUST be explainable by the policy or risk decision that produced the result. → no owner

## 6.19 Metrics, reporting and cost · BG-02, BG-06, BG-10

- **BR-0180** — **Core delivery metrics.** The platform MUST capture sufficient events to derive lead time, deployment frequency, change-failure rate, recovery time, requirement/specification coverage and traceability coverage where integrations supply the data. → no owner
- **BR-0181** — **AI productivity metrics.** The platform SHOULD distinguish human from AI-assisted work without using lines of code as the primary productivity measure. → no owner
- **BR-0182** — **Usage and cost attribution.** AI and session usage and cost data, where the provider exposes it, MUST be attributable to workspace, project and session. → no owner
- **BR-0183** — **Outcome metrics.** Dashboards SHOULD connect AI activity to delivery outcomes, quality and rework. → no owner
- **BR-0184** — **Advanced reporting.** Custom executive report builders and broad BI features MAY remain Expansion Plane capabilities. → Expansion Plane

## 6.20 UX and accessibility · BG-10

- **BR-0190** — **Unified application.** Core lifecycle capabilities MUST be navigable as one coherent application with persistent workspace and project context. → `EPIC-029` *(shell)*, PMI-DOC-006
- **BR-0191** — **Room pattern.** Requirement, Change and Defect Rooms SHOULD share one interaction model: object state, context, AI analysis, decision, evidence and activity timeline. → PMI-DOC-006
- **BR-0192** — **Decision visibility.** Pending approvals, policy blocks and missing evidence MUST be visible without searching individual artifacts. → no owner
- **BR-0193** — **Accessible interface.** All product UI MUST comply with PMI-DOC-005, including WCAG 2.2 AA, keyboard operation, visible focus and the required component states. → `EPIC-029`
- **BR-0194** — **Theme.** Light, dark and system theme behavior MUST follow PMI-DOC-005. → `EPIC-029`
- **BR-0195** — **Recoverable errors.** An error state MUST identify what happened and an available recovery path, without exposing sensitive internals. → `EPIC-029`

## 6.21 Programme and repository governance · BG-05

These two requirements are carried forward from v1.0 (§0.2). They govern the programme's own
repository rather than the customer-facing product, which is why they sit in their own section
rather than in the Core Control Plane inventory of §3.1 — but they remain approved requirements
with owning Epics, and removing them would orphan `EPIC-018` and `EPIC-026`.

- **BR-0112** *(v1.0)* — **Repository navigability.** The repository and its governance MUST be navigable by a newcomer from a single index. → `EPIC-018`
- **BR-0113** *(v1.0)* — **Derived readiness.** Epic readiness MUST be derived from artifacts on disk and visible on a stage register, never declared by hand. → `EPIC-026`

---

## 7. Business Rules

- **RULE-01 — Specification first.** No governed implementation work begins without an approved intent/specification chain or an explicit approved exception workflow. *(v1.0 RULE-01; Constitution I, PP-001)*
- **RULE-02 — Baselines do not mutate silently.** Once approved, changing intent requires the Change Room.
- **RULE-03 — AI recommends; policy and humans govern.** Consequential decisions remain human-accountable. *(v1.0 RULE-02; PP-003)*
- **RULE-04 — Risk-adaptive, not approval-everywhere.** Low-risk automation must not be slowed by unnecessary manual gates.
- **RULE-05 — Evidence over assertion.** "Done" requires the Evidence Contract and the compliance gate.
- **RULE-06 — Context is least-privilege.** Supply only relevant, authorized context.
- **RULE-07 — Learning is untrusted until governed.**
- **RULE-08 — Vendor-neutral business semantics.** No core workflow depends directly on one AI, Git, CI or MCP vendor.
- **RULE-09 — Integrate commodity capability.** PMI Studio owns governance, orchestration and evidence; specialist tools may own code generation, scanning, deep review and deployment mechanics.
- **RULE-10 — Every artifact is versioned and traceable.**
- **RULE-11 — No invisible automation.** A triggered action must have a visible rule and provenance.
- **RULE-12 — v1.0 scope remains valid as a release record.** v2.0 changes target-product scope; it does not falsify what Phase 1 approved.
- **RULE-13 — Where a spec and this BRS disagree, this BRS wins and the spec is corrected.** *(v1.0 RULE-03; Constitution II)*
- **RULE-14 — Held work resumes only through the Definition-of-Ready gate**, never by declaration. *(v1.0 RULE-04; EPIC-026)*
- **RULE-15 — Scope changes require a version bump and re-approval of this document** — never a silent edit. Target-scope changes are MAJOR; release-slice changes are MINOR. *(v1.0 RULE-05, refined by §3.5)*
- **RULE-16 — Identifiers are corpus-wide and never re-mean.** A `BR-xxxx` identifier keeps one meaning for the life of the corpus; a superseded requirement is marked superseded, never reassigned. *(PMI-DOC-000 §3; the rule §0.1 exists to enforce)*

---

## 8. Non-Functional Business Constraints

- Multi-tenant isolation by construction.
- Replaceable AI, specification and integration providers behind contracts (`FR-AGT-004`/`006`); no business capability may depend on a named vendor.
- Sandboxed or equivalently isolated untrusted execution; egress stays deny-all-plus-allowlist (`ADR-0002`, `ADR-0013`).
- Append-only audit and version evidence wherever history is required.
- WCAG 2.2 AA, per PMI-DOC-005.
- Observability through structured logs, metrics, traces and audit; OpenTelemetry-compatible instrumentation.
- Browser support per PMI-DOC-005.
- No general internet access from a managed generation sandbox unless policy explicitly permits a destination or capability.
- Cost and resource ceilings for unattended execution.
- Markdown/Git-compatible authoritative specifications remain exportable and inspectable.
- Delivery follows the constitution (spec-kit command gate, mandatory tests, convergence, closing reports, Delivery Board sync).
- The 20 product principles of PMI-DOC-003 bind the programme (decision `D-6`).

---

## 9. Traceability Model

Target chain:

**Business Goal → Stakeholder Need → Requirement → Clarification → Decision → Acceptance Criteria →
Baseline → Specification → Architecture/Constraint → Epic/Feature → Task → Agent/Human Session →
Code/PR → Test/Scan/Review Evidence → Compliance Verdict → Release → Deployment →
Telemetry/Incident → Defect/Change → New Baseline**

Every verified edge stores its type and provenance (`BR-0040`, `BR-0081`).

This extends, and does not replace, the PMI-DOC-000 §5 chain that v1.0 §11 adopted. The v1.0 chain
is the subset from Business Goal to Release; the additions are the decision, session, evidence,
verdict, telemetry, defect and change edges. Nothing in the v1.0 chain is removed, so the existing
Epic SRS Traceability tables remain valid as written.

---

## 10. Release Slices — Release Scope

This document defines target-product scope. Delivery remains incremental. These slices are
**Release Scope** under §3.5, and change by MINOR revision.

| Slice | Name | Content |
|---|---|---|
| **R1** | Foundation — preserve current work | Identity boundary, workspace tenancy, project/requirement/spec/task records, engine contract, Spec Kit adapter, sandbox, jobs, audit, base traceability |
| **R2** | Governed Intent | Requirement Room, specification UX, baseline decisions, steering, Decision Inbox |
| **R3** | Living Delivery | Change Room, Defect Room, Governed Engineering Loop, evidence model, compliance verdict |
| **R4** | Governed AI Execution | Engineering Experts, Context Packages, agent sessions, provider adapters, policy/risk engine |
| **R5** | Integrated Engineering Fabric | Capability Hub, Git/CI/test/security adapters, MCP transport, Workspace Fabric execution modes |
| **R6** | Intelligence & Improvement | Governed learning, advanced context/graph, DORA/SPACE/outcome analytics, cost optimization |
| **R7** | Ecosystem Expansion | Public marketplace and SDK, advanced reporting, billing/licensing, edition-specific enterprise features |

R1 is the delivered and declared work. **The 29 declared Epics all sit in R1–R2**; R3 onward is
where the unowned requirements of §13 live.

---

## 11. Acceptance Criteria for BRS v2.0

This document is ready for approval when:

1. every Core Control Plane capability in §3.1 maps to at least one `BR-`;
2. every declared Epic maps to at least one `BR-` and every `BR-` either names an owning Epic or is
   recorded as unowned in §13 — no orphan in either direction;
3. no `BR-` identifier means something different from what it meant in v1.0 (`RULE-16`);
4. Requirement, Change and Defect Rooms are explicit first-class requirements;
5. Engineering Experts, Context Packages, Evidence Contracts, compliance verdicts and the Capability
   Hub are explicit requirements;
6. target-product scope is separated from release scope and declared Epic scope (§3.5);
7. the product boundary states what PMI Studio owns versus integrates (§3.1–§3.2);
8. every new architectural decision is queued as an ADR (§12);
9. PMI-DOC-005 remains authoritative for visual and accessibility standards, and screen-level
   architecture lives in PMI-DOC-006;
10. the Project Owner approves the major scope revision.

Criteria 1–3, 6–9 are satisfied by this document as written. Criterion 2 is satisfied with 71
requirements recorded as unowned in §13. Criteria 4, 5 and 10 are the approval act itself.

---

## 12. Validation

Four assertions are mechanized rather than reviewed by eye — the count defect in v1.0 (§0.3) was
exactly the kind of error review misses, and the identifier collision in the circulated draft
(§0.1) was a larger instance of the same class.

**Implemented in** `tests/governance/brs-identifiers.spec.ts`, **run by** `pnpm test:governance`.

| Check | Asserts |
|---|---|
| `G-BRS-01` | The requirement count in §1 equals the number of distinct `BR-` identifiers defined in §6 |
| `G-BRS-02` | No `BR-` identifier is defined twice; every v1.0 identifier survives in §6 and carries a `(v1.0)` annotation |
| `G-BRS-03` | Every `BR-` cited anywhere in `specs/`, `governance/`, `adr/`, `docs/` or `SRS/` resolves to a requirement in §6, excluding the §14 reserved list. PMI-DOC-004 v1.0 and the review-package draft are exempt — they hold superseded numbering by design |
| `G-BRS-04` | Every identifier the circulated draft defined is either carried into §6 or explicitly reserved in §14, and nothing is both reserved and defined |

**Status: passing.** 8 tests, green as part of the 829-test governance suite on 2026-08-22.

The checks read the document rather than a maintained list of answers — a check carrying its own
copy of the answer only proves the copy agrees with itself. Current values: **123 requirements, 25
carried v1.0 identifiers, 8 reserved identifiers, zero duplicates, zero unresolved citations.**
Ownership split: **52 requirements with an owning Epic, 71 without** (§13).

### 12.1 What the checks caught

Recorded because it is the argument for having them, and because each was missed by review of a
document whose own subject was rigour:

| Found by | Defect |
|---|---|
| `G-BRS-01` | The first draft of §13 stated a gap count that disagreed with the requirement list — the same defect class as the v1.0 "24 versus 25" error this revision closes |
| `G-BRS-03` | A false positive on its first run: `BR-0011` named in §14 as *reserved and unused* read as a citation. The check definition was wrong, not the document, and the exclusion above is the correction |
| `G-BRS-03` | A second false positive: prose in `specs/brs-v2-reconciliation.md` describing a rejected numbering scheme used a code-formatted pseudo-identifier. The prose was reworded — the check was not weakened |
| `G-BRS-04` | `BR-0074` was vacated by the §0.1 renumbering but never added to the §14 reserved list, leaving it free to be assigned a second meaning — precisely what `RULE-16` forbids |

Each check was also mutation-tested on 2026-08-22: the stated count was falsified, a v1.0 identifier
deleted, a `(v1.0)` annotation stripped, and a reserved identifier un-reserved. All four mutations
failed the suite, and deleting `BR-0063` additionally tripped `G-BRS-03` on the citation it orphaned
— the EPIC-025 regression of §0.2, caught automatically.

---|---|
| `G-BRS-01` | The requirement count in §1 equals the number of distinct `BR-` identifiers in §6 |
| `G-BRS-02` | No `BR-` identifier appears twice in §6, and every v1.0 identifier appears exactly once with a `(v1.0)` annotation |
| `G-BRS-03` | Every `BR-` cited anywhere in `specs/`, `governance/`, `adr/` or `docs/` resolves to a requirement in §6, **excluding** the reserved-identifier list in §14 and any line that restates it |

Until these run in CI they are recorded here as required, not as satisfied by CI. All three were run
against this document on 2026-08-21 and **pass**:

- `G-BRS-01` — 123 distinct `BR-` identifiers in §6, matching the count in §1.
- `G-BRS-02` — zero duplicates; all 25 v1.0 identifiers present and each annotated `(v1.0)`.
- `G-BRS-03` — every `BR-` cited across `specs/`, `governance/`, `adr/` and `docs/` resolves in §6;
  zero unresolved citations. The reserved identifiers of §14 are excluded by definition — a document
  naming `BR-0011` as *reserved and unused* is not citing it, and the first run of this check
  reported exactly that false positive.

Ownership split at that run: **52 requirements with an owning Epic, 71 without** (§13).

`G-BRS-01` earned its place immediately — the first draft of §13 stated a gap count that disagreed
with the requirement list, which is the same defect class as the v1.0 count error this revision
closes. Review had not caught it; the check did.

---

## 13. Ownership Gaps

Under §3.5 an in-scope requirement without a declared Epic is a **recorded gap**, not an absence.
**71 of the 123 requirements have no owning Epic; 52 have one.** They are not blocked by this document — they are
blocked on Epic declaration, which is a separate act through the `/speckit-specify` flow and the
stage register.

The full gap register, with each unowned requirement mapped to the `EPIC-027` capability area that
already assigned it a home, is maintained in
[`specs/brs-v2-reconciliation.md`](../specs/brs-v2-reconciliation.md). That document is authoritative
for Wave 0; this section states only the summary.

| Capability area | Unowned requirements | `EPIC-027` register assignment |
|---|---|---|
| Requirement Room | `BR-0022`–`BR-0027` | new epic — explicitly NOT `EPIC-007` (`D-33`) |
| Change Room | `BR-0042`–`BR-0048` | new epic |
| Defect Room | `BR-0051`–`BR-0058` | new epic |
| Governed Engineering Loop, risk/policy, Decision Inbox | `BR-0064`, `BR-0066`–`BR-0069` | **UNOWNED** in the `EPIC-027` register |
| Engineering Context | `BR-0091`–`BR-0096` | new epic |
| Engineering Experts | `BR-0101`, `BR-0102`, `BR-0105`, `BR-0106` | new epic |
| Governed Learning | `BR-0114`–`BR-0118` | **UNOWNED** in the `EPIC-027` register |
| Capability Hub | `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125` | new epic — M-16 |
| Workspace Fabric | `BR-0131`–`BR-0133` | new epic |
| Evidence & compliance | `BR-0140`–`BR-0144`, `BR-0146` | new epic, or `EPIC-015` extension |
| Specification compliance verdict | `BR-0036`, `BR-0143` | **UNOWNED** in the `EPIC-027` register |
| Metrics & cost | `BR-0180`–`BR-0183` | deferred in v1.0; Core Control Plane here |
| Stakeholder access, decision authority | `BR-0004`, `BR-0005` | new epic |
| Portfolio & health | `BR-0012`, `BR-0013` | new epic |
| Architecture impact, rationale, re-plan | `BR-0073`, `BR-0083`, `BR-0154` | `EPIC-016`/`EPIC-020` extension |
| Spec extension governance | `BR-0037` | `EPIC-008`/`EPIC-013` extension |
| Operational feedback, policy explainability, decision visibility | `BR-0163`, `BR-0174`, `BR-0192` | new epic |

The three areas the `EPIC-027` register marks **UNOWNED** — Governed Engineering Loops, Governed
Learning and the Specification Compliance Agent — are the ones that arrived with the Cosmos
amendment and were never assigned a home. That register predicted exactly this moment: *"when
PMI-DOC-004 lands, three capability areas will have nowhere to go until someone creates epics for
them."* Approving this document makes that prediction current.

---

## 14. Identifier Crosswalk

For anyone reconciling the circulated v2.0 draft against this approved numbering. **Left column is
the draft's number; right column is the identifier this document uses.** Where they differ, the
draft's number collided with an approved v1.0 meaning (§0.1).

| Draft `BR-` | This document | Requirement | Why it moved |
|---|---|---|---|
| BR-0011 | **BR-0041** | Product hierarchy | v1.0 already owns this concept at `BR-0041` |
| BR-0040 | **BR-0042** | Change intake | v1.0 `BR-0040` is the trace chain |
| BR-0041 | **BR-0043** | Change clarification | v1.0 `BR-0041` is product structure |
| BR-0042 | **BR-0044** | Change impact | cascade |
| BR-0043 | **BR-0045** | Trade-off analysis | cascade |
| BR-0044 | **BR-0046** | Change decision | cascade |
| BR-0045 | **BR-0047** | Re-baseline and re-plan | cascade |
| BR-0046 | **BR-0048** | Change evidence | cascade |
| BR-0050 | **BR-0051** | Defect intake | v1.0 `BR-0050` is task decomposition |
| BR-0051–BR-0057 | **BR-0052**–**BR-0058** | Defect Room remainder | cascade |
| BR-0060 | **BR-0064** | Governed Engineering Loop | v1.0 `BR-0060` is review gates |
| BR-0061 | **BR-0065** | Explicit states | v1.0 `BR-0061` is unattended agents |
| BR-0062 | **BR-0066** | Risk classification | v1.0 `BR-0062` is the access snapshot |
| BR-0063 | **BR-0067** | Risk-adaptive approval | v1.0 `BR-0063` is external publishing |
| BR-0064 | **BR-0060** | No silent gate bypass | absorbed into v1.0 `BR-0060`, which already says it |
| BR-0065 | **BR-0068** | Decision Inbox | cascade |
| BR-0066 | **BR-0069** | Automation triggers | cascade |
| BR-0073 | **BR-0100** | Architecture records | v1.0 already owns this concept at `BR-0100` |
| BR-0074 | **BR-0073** | Architecture impact | freed slot |
| BR-0080 | **BR-0040** | Trace chain | v1.0 owns the concept at `BR-0040`; v1.0 `BR-0080` is QA |
| BR-0090–BR-0095 | **BR-0091**–**BR-0096** | Engineering Context | v1.0 `BR-0090` is environment promotion |
| BR-0100–BR-0104 | **BR-0101**–**BR-0105** | Expert registry → delegation | v1.0 `BR-0100` is ADRs |
| BR-0105 | **BR-0061** | Unattended execution | v1.0 already owns this concept at `BR-0061` |
| BR-0106 | **BR-0106** | Cost and time limits | unchanged |
| BR-0110–BR-0114 | **BR-0114**–**BR-0118** | Governed learning | v1.0 owns `BR-0110`–`BR-0113` |
| BR-0130 | **BR-0110** | Managed isolated execution | v1.0 already owns this concept at `BR-0110` |
| BR-0145 | **BR-0080** | QA validation | v1.0 already owns this concept at `BR-0080` |
| BR-0150 | **BR-0050** | Task decomposition | v1.0 already owns this concept at `BR-0050` |
| BR-0160 | **BR-0090** | Environment promotion | v1.0 already owns this concept at `BR-0090` |
| BR-0170 | **BR-0111** | Immutable audit | v1.0 already owns this concept at `BR-0111` |
| BR-0172 | **BR-0062** | Access snapshot | v1.0 already owns this concept at `BR-0062` |
| *(absent)* | **BR-0063** | External publishing | restored — draft dropped it (§0.2) |
| *(absent)* | **BR-0112** | Repository navigability | restored — draft dropped it (§0.2) |
| *(absent)* | **BR-0113** | Derived readiness | restored — draft dropped it (§0.2) |

Unused in this document, and reserved so they are never reused for a different meaning:
`BR-0011`, `BR-0074`, `BR-0130`, `BR-0145`, `BR-0150`, `BR-0160`, `BR-0170`, `BR-0172`.

Every identifier the circulated draft defined is therefore accounted for: it is either in use above
under the §0.1 ruling, or reserved on this line. `G-BRS-04` asserts that, and it is the assertion
that found `BR-0074` missing from this list.

---

## 15. Architecture Decisions

PMI-DOC-004A §12 names twelve decisions. Five already exist from `EPIC-027`; seven are created with
this revision.

| # | Decision | ADR | Status |
|---|---|---|---|
| 1 | Governed Engineering Loop abstraction | `ADR-0018` | Open — awaits an owning epic |
| 2 | Context Engine four-service composition | `ADR-0019` | Open — awaits an owning epic |
| 3 | Engineering Expert contract and adapter model | `ADR-0020` | Accepted |
| 4 | Evidence Contract and Compliance Verdict model | `ADR-0022` | Open — **this document discharges its PMI-DOC-004 dependency** |
| 5 | Governed Learning lifecycle | `ADR-0021` | Open — awaits an owning epic |
| 6 | Capability Resolver / Integration Hub boundary | `ADR-0023` | **new** |
| 7 | Workspace Fabric execution modes | `ADR-0024` | **new** |
| 8 | Risk-adaptive policy engine | `ADR-0025` | **new** |
| 9 | Spec Kit engine, version and extension management | `ADR-0026` | **new** |
| 10 | Durable Agent Session independent of execution provider | `ADR-0027` | **new** |
| 11 | Application UX architecture and navigation | `ADR-0028` | **new** |
| 12 | Target-product versus release scope model | `ADR-0029` | **new** — decided by §3.5 of this document |

---

## 16. Related Documents

PMI-DOC-000 (standard) · PMI-DOC-001 (vision) · PMI-DOC-002 (charter) · PMI-DOC-003 (principles) ·
PMI-DOC-004 v1.0 (historical Phase-1 baseline) · **PMI-DOC-004A** (gap analysis that motivated this
revision) · PMI-DOC-005 (design system) · **PMI-DOC-006** (application UX architecture) ·
PMI-TASK-001 · `governance/epic-stage-register.md` · `specs/brs-v2-reconciliation.md` ·
`specs/srs-alignment.md` (open conflicts `C-01`/`C-02` against PMI-DOC-000 — tracked there) ·
`specs/027-ai-native-amendment/register/` (authoritative capability-area assignments) ·
`adr/` (`ADR-0001`–`ADR-0029`).

---

## 17. Revision History

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-20 | Initial draft: 6 goals, 25 BRs mapped to all 28 declared Epics |
| 1.0 | 2026-08-20 | **Approved** by the Project Owner. Phase 1 scope = 28 declared Epics; six catalog areas deferred. `T-101` and `T-106` discharged |
| 2.0 draft (review package) | 2026-08-21 | Circulated draft reconciling the Rooms, governed loops, context architecture, Engineering Experts, evidence compliance, Capability Hub and Workspace Fabric |
| 2.0 | 2026-08-21 | **This revision.** Adopts the circulated draft's scope model and requirement set, and corrects two defects it carried: ten reused v1.0 identifiers (§0.1) and dropped coverage for `EPIC-018`/`EPIC-025`/`EPIC-026` (§0.2). Adds §3.5 three-scope model, §13 ownership gaps, §14 crosswalk, §12 validation checks and `RULE-16`. Closes the v1.0 count defect (§0.3). 123 requirements, 10 goals, 16 rules |
| 2.0 | 2026-08-22 | **APPROVED** by the Project Owner — decisions 1–5 of PMI-DOC-004A §14 signed as proposed. Target-product scope, the three-plane boundary and the core/expansion split are now the approved product definition. No Epic declared and no delivery posture changed by the approval (`RULE-14`) |
