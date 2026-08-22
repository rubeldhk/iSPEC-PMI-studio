# PMI-DOC-004A — V2 Gap Analysis & Amendment Package

**Document ID:** PMI-DOC-004A  
**Version:** 1.0  
**Status:** PROPOSED FOR OWNER REVIEW  
**Date:** 2026-08-21  
**Baseline reviewed:** PMI-DOC-004 v1.0, PMI-DOC-005 v1.0, prior PMI Studio MPS/module specifications, EPIC-001 system design, accepted Augment/Cosmos Learnings Amendment, Kiro enhancement direction, and current external product research.

## 1. Executive conclusion

PMI-DOC-004 v1.0 successfully performs the narrow job for which it was approved: it creates a business-requirement layer above the declared delivery Epics and releases held work. It should therefore **not be discarded**.

However, it is no longer sufficient as the full product-level business baseline. The project subsequently approved or reaffirmed capabilities that v1.0 either:
1. defers to Phase 2+,  
2. represents only indirectly through generic requirements, or  
3. does not represent at all.

The most important conflict is scope. PMI-DOC-004 v1.0 explicitly defers the MCP Marketplace, Knowledge Platform, most of the AI Platform, Reporting, Administration and standalone Constraint Management. The accepted Augment/Cosmos amendment subsequently makes **context curation, knowledge relationships, Engineering Experts, governed learning, MCP capability abstraction, Workspace Fabric, risk-adaptive governance, Requirement/Change/Defect Rooms, and specification-compliance evidence** part of the approved product direction. These are not all “marketplace extras”; several are now necessary to the differentiated core.

**Recommendation:** preserve v1.0 as the historical Phase-1 release baseline, approve a **major v2.0 BRS** that changes the product scope model from “28 declared Epics = product scope” to a layered target-product model:
- **Core Control Plane** — owned by PMI Studio and required for product differentiation.
- **Execution & Integration Plane** — integrated through replaceable capabilities/adapters.
- **Optional Expansion Plane** — marketplace, advanced analytics, billing/licensing, broad SDK/ecosystem features.

This avoids a product reset while correcting the gap between the current approved BRS and the product we actually decided to build.

---

## 2. Evidence baseline

### 2.1 Current approved BRS
PMI-DOC-004 v1.0 defines six business goals and 25 listed `BR-` requirements, although its executive summary says “24 business requirements.” This is a small but real document-quality defect. More importantly, its Phase-1 scope defers several domains that earlier and later product artifacts treat as platform capabilities.

### 2.2 Accepted Augment/Cosmos amendment
The accepted amendment establishes the following direction:
- Requirement Room, Change Room and Defect Room remain distinct first-class governed experiences.
- Governed Engineering Loops provide the reusable workflow abstraction beneath those rooms.
- Context becomes four coordinated capabilities: semantic retrieval, verified relationship graph, live engineering state and task-specific context curation.
- Agents become governed Engineering Experts with identity, models, tools, permissions, memory policy, required outputs and Evidence Contracts.
- Agent discoveries become trusted knowledge only through governed learning with provenance and approval.
- Specification compliance and evidence—not generic code generation—are the differentiator.
- MCP is first-class inside an Integration Hub, but workflows invoke abstract capabilities rather than vendor-specific APIs.
- Execution evolves into a Workspace Fabric: PMI-managed sandbox, customer-cloud environment, or controlled local connector.
- Human approval becomes risk-adaptive rather than mandatory for every AI action.
- PMI Studio remains aimed at software organizations that need a ready-to-use AI-native engineering ecosystem rather than companies building their own internal developer platform.

### 2.3 Existing architecture
EPIC-001 already provides important seams that should be retained:
- React/Vite presentation.
- NestJS application services.
- PostgreSQL and Redis/Valkey.
- durable asynchronous jobs.
- `SpecificationEngine` contract with Spec Kit and fixture adapters.
- isolated per-job execution sandbox.
- transport/service separation to permit future MCP surfaces.
- append-only audit/version history.
- workspace scoping on all rows.
- OpenTelemetry direction.
- engine independence enforced by architecture tests.

### 2.4 Existing module catalog
Earlier PMI Studio specifications already include:
Workspace/Organization, Project Management, Requirement Intelligence, Specification Management, Constraint Management, Workflow/Tasks, AI Platform, Specification Engine, MCP, Knowledge, DevOps, QA, Security/Governance, Reporting, Administration and Extension SDK.

### 2.5 Current external research relevant to the amendment
- **GitHub Spec Kit (Aug. 2026):** Spec Kit is now an extensible intent-driven harness with a Spec → Plan → Tasks → Implement workflow, multiple agent integrations, extensions, presets, bundles, programmable workflows, an `assess` extension, a bug-fix workflow and `/speckit.converge`. This strengthens the case for treating Spec Kit as an embedded/managed specification workflow provider rather than rebuilding every low-level SDD primitive.
- **Kiro (Aug. 2026):** the same agent harness spans IDE/CLI/Web; specs, steering, hooks, MCP, custom agents and skills share project state. PMI Studio should learn from the continuity model without becoming an IDE: one governed project context should follow a job across execution surfaces.
- **Augment Code (2026):** semantic context retrieval, multi-source context, MCP exposure, tasklists and remote agents illustrate why context quality and background execution matter. PMI Studio should integrate or emulate the architectural pattern at its control-plane level, not copy Augment’s coding product.

---

## 3. Gap matrix

| # | Planned / decided capability | PMI-DOC-004 v1.0 | Gap class | Required amendment |
|---|---|---|---|---|
| G-01 | Requirement Room with AI clarification, options, risks, acceptance criteria and baseline decision | BR-0020/0021 cover capture and gaps only | **Enhancement required** | Expand requirement management from records to a governed decision workflow |
| G-02 | Change Room during implementation | BR-0033 only says identify impacted artifacts | **Missing** | Add first-class change request lifecycle, trade-off analysis, decision, re-baseline and re-plan |
| G-03 | Defect Room per epic with TDD flow and defect→change transfer | QA validation only; no defect lifecycle | **Missing** | Add defect intake, reproduce/failing-test-first, fix, verify, evidence, close, transfer-to-change rule |
| G-04 | Governed Engineering Loop abstraction | review gates + unattended agents only | **Missing** | Add reusable Event→Context→Analyze→Decide→Execute→Verify→Evidence→Outcome loop |
| G-05 | Engineering Experts / Agent Registry | BR-0061 only says unattended agents may run | **Major gap** | Define governed expert identity, tools, models, permissions, context policy, evidence contract and risk profile |
| G-06 | Multi-agent orchestration | implicit, not specified | **Missing** | Add supervisor/worker or role-based delegation, isolated sessions and evidence aggregation |
| G-07 | Context Engine: semantic retrieval | Knowledge Platform explicitly deferred | **Scope conflict** | Move task-specific context retrieval into Core Control Plane |
| G-08 | Verified engineering relationship graph | BR-0040 traceability is narrower | **Enhancement required** | Extend trace graph through decisions, sessions, PRs, evidence, telemetry, defects and changes |
| G-09 | Live Engineering State | absent | **Missing** | Add repository/build/deployment/workflow/tool state as governed context |
| G-10 | Context curation by role/security/token budget/task | absent | **Missing** | Add Context Package as first-class execution input |
| G-11 | Governed learning/provenance | absent | **Missing** | Add candidate→evidence→confidence→policy/human decision→approved knowledge workflow |
| G-12 | Specification compliance agent and evidence-driven completion | QA AC validation is weaker | **Major gap** | Make compliance verdict and evidence package a release-quality primitive |
| G-13 | Evidence store / evidence contract | “validation evidence is retained” only | **Enhancement required** | Define typed evidence, provenance, immutable links, minimum proof per expert/workflow |
| G-14 | MCP first-class Integration Hub | MCP Marketplace explicitly deferred | **Scope conflict** | Separate **core capability abstraction + adapter registry** from optional public marketplace |
| G-15 | Capability Resolver (`CreatePullRequest`, `RunTests`, etc.) | absent | **Missing** | Add vendor-neutral capability contracts and policy-aware resolution |
| G-16 | Workspace Fabric (managed remote, customer cloud, controlled local) | only ephemeral sandbox is represented | **Enhancement required** | Extend secure execution substrate without removing existing sandbox model |
| G-17 | Claude/Cursor/Codex/Augment interchangeable execution | provider replaceability stated, agent integration not productized | **Enhancement required** | Add Execution Provider/Agent Adapter registry and compatibility checks |
| G-18 | Native Spec Kit management in PMI Studio | BR-0030 names Spec Kit V1 but not lifecycle/version/integration mode | **Enhancement required** | Manage Spec Kit version, integration choice, extensions/presets/bundles/workflows and compatibility |
| G-19 | Spec Kit converge / drift detection | BR-0040 traceability and QA do not require spec↔code convergence | **Missing** | Add continuous convergence/compliance checking |
| G-20 | Hooks/automation/events | workflow gates only | **Missing** | Add policy-governed automation triggers without turning them into invisible side effects |
| G-21 | Steering hierarchy: organization→workspace→project→repo/path | BR-0070 only “organization conventions” | **Enhancement required** | Define hierarchical, scoped, composable steering with conflict resolution |
| G-22 | Constraint management | explicitly deferred standalone | **Partial conflict** | Keep advanced constraint module optional, but core policy/architecture/security constraints must be first-class context |
| G-23 | Architecture repository & decision impact | only ADR recording | **Enhancement required** | Add architecture artifacts, constraints and impact links, not just ADR existence |
| G-24 | Portfolio/product roadmap | v1 focuses project lifecycle | **Missing / target scope** | Add optional portfolio layer above project for product organizations/consultancies |
| G-25 | DORA/SPACE/product metrics | success goals name them; reporting deferred | **Measurement gap** | Core telemetry/KPI data collection should be core; advanced report builder can remain expansion |
| G-26 | AI cost attribution/model routing | v1 defers AI platform; principles require cost-aware AI | **Scope gap** | Add minimum usage/cost accounting and policy routing; advanced optimization can be later |
| G-27 | Security policy / risk classification | review gates are role-based but not risk-adaptive | **Enhancement required** | Add risk classification and policy decision engine |
| G-28 | External stakeholder access to requirements/changes | RBAC is generic | **Enhancement required** | Add scoped stakeholder portal/review experience with secure invitations and decision authority |
| G-29 | Notifications / inbox / approvals queue | absent | **Missing UX workflow** | Add My Work / Decision Inbox with SLAs and notification preferences |
| G-30 | Product information architecture / application shell | Design System explicitly says screens are out of scope | **Not a defect in DOC-005, but missing artifact** | Add a separate Application UX Architecture standard/spec; do not pollute token standard with screen design |
| G-31 | Design tokens + real implementation mapping | DOC-005 defines tokens but not exact token names/values | **Expected implementation gap** | Implement in design Epic; prototype demonstrates a neutral accessible token set |
| G-32 | Responsive min viewport | DOC-005 delegates viewport to each Epic | **Consistency risk** | Add application-shell breakpoint/minimum policy so every Epic does not choose independently |
| G-33 | Table filtering | DOC-005 says every table MUST filter | **Covered** | Preserve; extend to search/sort/column density only where functional specs need them |
| G-34 | Full audit + evidence transparency | immutable action audit covered | **Enhancement required** | Provide human-readable execution timeline joining decisions, AI actions, tool calls and evidence |
| G-35 | Target-customer product boundary | old vision says “enterprise”; accepted amendment narrows positioning | **Strategic wording conflict** | Rephrase target as SMB/mid-market/regulated teams needing an integrated governed platform; enterprise-ready architecture remains a quality attribute |
| G-36 | “24 BRs” stated vs 25 BR identifiers present | inconsistency | **Document defect** | Correct count; V2 should derive counts automatically in validation |
| G-37 | v1 scope = only declared Epics | useful for delivery gate, weak as product definition | **Structural gap** | Separate **target product scope**, **release scope** and **declared Epic scope** |

---

## 4. What should remain unchanged

The V2 work should **preserve**, not rewrite:
- specification-first principle and hierarchy;
- `BG-01` through `BG-06`;
- tenant isolation, authentication and role separation;
- project lifecycle;
- first-class/versioned requirements and specifications;
- replaceable specification engine contract;
- specification approval/version history;
- end-to-end traceability;
- task decomposition and dependencies;
- review gates;
- sandboxed untrusted execution;
- immutable audit;
- release environment progression;
- ADR discipline;
- approved Design System/WCAG 2.2 AA;
- the existing EPIC-001 engine/sandbox implementation;
- React/NestJS/PostgreSQL/Valkey/worker architecture unless a future ADR changes them.

---

## 5. Amendment A — BRS scope and product boundary

### A-01 Replace “declared Epics are the product scope”
PMI-DOC-004 §3 should distinguish:
1. **Target Product Scope** — business capabilities PMI Studio is committed to as a product.
2. **Release Scope** — capabilities approved for a release.
3. **Declared Delivery Scope** — epics that are sufficiently decomposed to enter DOR.

A capability must not disappear from the BRS merely because its Epic has not yet been declared.

### A-02 Core Control Plane
The following become core product capabilities:
- Requirement Room
- Specification lifecycle
- Change Room
- Defect Room
- governed workflow/decision engine
- hierarchical steering/constraints
- traceability graph
- context curation + live engineering state
- Engineering Expert registry
- risk/policy governance
- evidence and specification-compliance verdicts
- adapter/capability integration hub
- Workspace Fabric
- audit and identity

### A-03 Integrated Execution Plane
PMI Studio should **integrate rather than rebuild**:
- AI coding agents/CLIs/IDEs
- source control
- CI/CD
- cloud and deployment platforms
- observability backends
- generic static analysis/security scanners
- deep code review products

PMI Studio owns orchestration, permissions, context, decisions, evidence and traceability around them.

### A-04 Optional Expansion Plane
The following may remain later/edition-dependent without weakening the core:
- public MCP/plugin marketplace
- broad third-party extension SDK
- billing/licensing
- advanced executive report designer
- full portfolio financials
- broad model marketplace
- theme marketplace
- enterprise-only identity/compliance packs

---

## 6. Amendment B — Governed Rooms

### B-01 Requirement Room
A Requirement Room must support:
**Intake → AI extraction/normalization → clarification → conflict/gap analysis → options → risks → acceptance criteria → stakeholder decision → baseline → specification handoff.**

The AI must distinguish fact, inference, recommendation and unresolved question.

### B-02 Change Room
A Change Room must support:
**Request → clarification → impacted artifact graph → options/trade-offs → schedule/cost/security/quality risk → decision → approved baseline delta → spec/task/test changes → re-plan → completion evidence.**

No implementation-changing request should bypass traceable change control once the relevant baseline is approved.

### B-03 Defect Room
A Defect Room must support:
**Report/test failure → classify → link to epic/requirement/spec → reproduce → create failing test → diagnose → add implementation work → fix → run test/regression → evidence → close.**

If the baseline behavior passes and the requested outcome changes intended behavior, transfer the item to Change Room with all evidence and context preserved.

---

## 7. Amendment C — Engineering Experts and execution

An Engineering Expert is a governed executable role, not just a prompt. Minimum contract:
- identity and role;
- allowed projects/workspaces;
- preferred and fallback model;
- allowed tools/capabilities;
- context policy;
- environment/workspace policy;
- risk level and required approvals;
- cost/token/time budget;
- memory policy;
- expected outputs;
- Evidence Contract;
- escalation conditions;
- version/provenance.

Agent sessions must be durable platform records even when actual code execution happens in Claude Code, Cursor, Codex, Augment, GitHub Copilot or another compatible provider.

---

## 8. Amendment D — Context, knowledge and learning

Define four separable services:
1. **Semantic Retrieval Service** — retrieves relevant code/artifact slices.
2. **Relationship Graph Service** — stores verified typed links.
3. **Live State Service** — repository, branch, build, deployment, workflow and tool state.
4. **Context Curator** — produces permission-filtered, task-specific Context Packages.

A Context Package should contain:
- objective;
- authoritative requirements/spec version;
- relevant constraints/steering;
- architecture/ADR context;
- code pointers or retrieved snippets;
- current live state;
- known risks;
- prior decisions;
- permitted tools;
- evidence requirements;
- token/cost budget;
- provenance.

Learning candidates require source, evidence, confidence, owner/policy decision and supersession history.

---

## 9. Amendment E — Integration Hub and capability abstraction

Workflows should request business/engineering capabilities, e.g.:
- `ReadRepository`
- `SearchCode`
- `CreateBranch`
- `CreatePullRequest`
- `RunTests`
- `RunSecurityScan`
- `ReadBuildStatus`
- `DeployEnvironment`
- `ReadTelemetry`
- `CreateIssue`
- `SendNotification`

A policy-aware Capability Resolver selects an authorized implementation:
MCP server, native API adapter, CLI adapter, customer connector or another transport.

**MCP is first-class, not the business abstraction.**

---

## 10. Amendment F — Spec Kit native integration

Because Spec Kit has evolved beyond the simple four-command flow, PMI Studio should manage Spec Kit as a versioned engine/workflow dependency:
- engine version and compatibility;
- selected integration/agent;
- Spec/Plan/Tasks/Implement lifecycle;
- clarify/checklist/analyze gates;
- converge/spec-code drift checks;
- bug extension where appropriate;
- assess/idea-assessment extension for upstream discovery where adopted;
- approved extensions/presets/workflows/bundles;
- local/private catalogs for controlled environments;
- generated artifact import and provenance.

PMI Studio must not fork its business model around current Spec Kit command names; adapters absorb command evolution.

---

## 11. Amendment G — UX application architecture

PMI-DOC-005 should remain a **design-system standard**. Add a companion UX/Application Architecture specification, rather than expanding DOC-005 into screen definitions.

Recommended primary navigation:
- Home
- Portfolio / Projects
- Requirement Room
- Specifications
- Change Room
- Defect Room
- Plan & Tasks
- Architecture & Decisions
- Engineering Experts
- Runs
- Evidence & Compliance
- Context
- Integrations
- QA & Releases
- Reports
- Governance
- Workspace / Administration

Cross-cutting UI:
- Global search / command palette
- Decision Inbox / My Work
- activity/evidence timeline
- notifications
- contextual AI assistant
- role-aware actions
- theme selection
- workspace/project switcher

---

## 12. Architecture decisions recommended

Create or reconcile ADRs for:
1. Governed Engineering Loop abstraction.
2. Context Engine four-service composition.
3. Engineering Expert contract and adapter model.
4. Evidence Contract and Compliance Verdict model.
5. Governed Learning lifecycle.
6. Capability Resolver / Integration Hub boundary.
7. Workspace Fabric execution modes.
8. Risk-adaptive policy engine.
9. Spec Kit engine/version/extension management.
10. Durable Agent Session model independent of execution provider.
11. Application UX architecture and navigation.
12. Target-product vs release-scope model.

---

## 13. Implementation sequence

### Wave 0 — Reconcile without disruption
- approve BRS v2 target scope;
- retain currently released Epics and identifiers;
- map new BRs to existing modules/Epics where possible;
- create new Epics only where no owner exists.

### Wave 1 — Product-control backbone
- Requirement Room enhancement;
- Change Room;
- Defect Room;
- shared Governed Engineering Loop;
- Decision Inbox;
- evidence model.

### Wave 2 — Context + Expert execution
- Context Package;
- Engineering Expert registry;
- provider adapters;
- agent sessions;
- risk/policy engine;
- spec compliance verdict.

### Wave 3 — Integration + Workspace Fabric
- capability contracts/resolver;
- Git/CI/testing adapters;
- MCP transport;
- managed remote workspace;
- customer-cloud connector;
- controlled local connector.

### Wave 4 — Intelligence and optimization
- governed learning;
- advanced semantic retrieval/graph;
- DORA/SPACE/product metrics;
- model/cost optimization;
- advanced reporting.

### Wave 5 — Expansion ecosystem
- public marketplace;
- extension SDK;
- billing/licensing;
- edition-specific enterprise packs.

---

## 14. Decisions requiring owner approval

1. Approve BRS v2 as a **major** revision rather than an amendment-only patch.
2. Approve “Core Control Plane / Integrated Execution Plane / Expansion Plane” as the product boundary.
3. Move **context curation, Engineering Experts, Change Room, Defect Room, evidence/compliance, capability abstraction and Workspace Fabric** into target-product core.
4. Keep the **public marketplace, billing/licensing and broad SDK** outside the core MVP.
5. Treat “enterprise-ready” as an architecture/governance quality, while targeting teams that need a ready-to-use platform rather than very large internal-platform organizations.
6. Create a companion **Application UX Architecture** specification; keep PMI-DOC-005 screen-agnostic.

---

## 15. Research sources used

- GitHub Spec Kit documentation, current through 2026-08-21: specification-driven workflow, integrations, extensions, bundles, bug workflow, converge and assess.
- Kiro documentation, updated Aug. 2026: shared agent harness, specs, steering, hooks, MCP, custom agents across IDE/CLI/Web.
- Augment Code documentation and product material: Context Engine, MCP, Tasklist, remote agent, external context and evidence-oriented code review.

These sources are used for architectural learning only; PMI Studio remains vendor-neutral.
