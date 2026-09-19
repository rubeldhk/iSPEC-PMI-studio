# PMI Studio Plan Amendment

## Amendment Purpose

Amend the existing PMI Studio product and implementation plan to clarify the product boundary, target market, integration architecture, and AI-native engineering operating model.

**Do NOT redesign PMI Studio from scratch. Do NOT discard, replace, or regenerate existing approved requirements, modules, epics, architecture decisions, Requirement Room, Change Room, Defect Room, Spec Kit integration, governance model, or implementation work.**

This amendment SHALL be applied incrementally to the existing specifications and plans.

---

# 1. Product Positioning Amendment

PMI Studio SHALL be positioned as:

> **A ready-to-use AI-native engineering operating system for software organizations that need an integrated, governed, spec-driven development ecosystem without building their own internal engineering platform.**

PMI Studio is NOT primarily designed for very large technology companies that maintain dedicated internal platform-engineering organizations and custom AI engineering infrastructure.

Primary target organizations include:

- Small and medium software companies
- SaaS organizations
- Startups scaling engineering operations
- Software agencies
- Distributed development organizations
- AI-native development teams
- Product engineering organizations
- Organizations modernizing traditional SDLC processes with AI
- Organizations without dedicated internal developer-platform teams

---

# 2. Core Product Principle

PMI Studio SHALL NOT attempt to recreate every tool used throughout the SDLC.

Apply the following decision principle:

> **Own the engineering workflow, specification, governance, orchestration, traceability, context and evidence. Integrate commodity execution capabilities where mature external tools already exist.**

Every existing and future capability SHALL therefore be classified as:

### A. PMI Studio Native Capability

Capabilities fundamental to PMI Studio's differentiated engineering operating model.

### B. Integrated Capability

External engineering systems orchestrated through APIs, MCP, CLI, webhooks, plugins, adapters or other controlled integration mechanisms.

### C. Hybrid Capability

PMI Studio owns the workflow, state, policies and evidence while an external system performs some execution.

Do not remove existing functionality solely because an external product provides something similar.

Determine ownership based on whether PMI Studio must control that capability to maintain its end-to-end engineering workflow.

---

# 3. Capabilities PMI Studio Should Own

The architecture SHOULD treat the following as core/native platform responsibilities:

## Product and Engineering Intent

- Requirement gathering
- Requirement clarification
- Requirement reasoning
- Requirement approval
- Requirement baselining
- Acceptance criteria
- Specification management
- Constraint management
- Decision records
- Architecture decisions
- Requirement-to-implementation traceability

## Planning

- Specification-driven planning
- Epic decomposition
- Feature decomposition
- Task generation
- Dependency analysis
- Implementation sequencing
- AI-assisted estimation
- Risk analysis
- Planning validation

## AI Engineering Orchestration

- Agent registry
- Agent assignment
- Model selection
- Multi-model routing
- Agent workflow orchestration
- Agent permissions
- Agent execution policies
- Agent context preparation
- Agent activity tracking
- Human/AI responsibility boundaries

## Governance

- Engineering policies
- AI policies
- Approval gates
- Human-in-the-loop controls
- Role-based authorization
- Execution permissions
- Audit trails
- Evidence requirements
- Exception management
- Risk controls

## Change Management

Maintain and enhance the existing Change Room.

It SHALL support:

Change Request
→ AI clarification
→ impact analysis
→ affected specification identification
→ dependency analysis
→ options
→ trade-offs
→ risks
→ recommendation
→ human decision
→ specification update
→ re-planning
→ implementation.

AI SHALL support decision preparation.

Accountable humans SHALL retain authority for decisions requiring human approval.

## Defect Management

Maintain and enhance the existing Defect Room.

Defects may originate from:

- Automated tests
- QA
- Developers
- Production monitoring
- Customers
- Support
- AI agents
- Security testing
- Observability systems

Target workflow:

Defect Report
→ Classification
→ Link to Epic/Feature/Requirement
→ Reproduction
→ Test creation or identification
→ Initial test
→ FAIL: Defect confirmed
→ Add List
→ Implement
→ Test
→ Regression validation
→ Evidence
→ Complete.

If expected behavior passes and the requested behavior represents a modification rather than a specification violation:

→ transfer to Change Room.

Preserve full traceability between defect, specification, tests, implementation and release.

---

# 4. Capabilities PMI Studio Should Integrate

PMI Studio SHOULD integrate rather than unnecessarily replace mature external engineering systems.

Examples include:

### Source Control

- GitHub
- GitLab
- Bitbucket
- Other Git-compatible systems

### AI Coding/Engineering Engines

- Claude Code
- OpenAI Codex
- GitHub Copilot
- Gemini
- Cursor
- Future compatible agents/models

PMI Studio SHALL NOT depend architecturally on a single AI provider.

### CI/CD

Examples:

- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps
- Cloud-native pipelines

### Cloud/Infrastructure

Examples:

- AWS
- Azure
- GCP
- Kubernetes
- Terraform

### Communication

Examples:

- Slack
- Microsoft Teams
- Email

### Observability

Examples:

- Datadog
- Grafana
- Sentry
- Splunk
- Cloud monitoring platforms

PMI Studio SHALL consume relevant signals from these systems and convert them into engineering context, evidence, defects, risks or workflow events where appropriate.

---

# 5. Introduce the Engineering Integration Layer

Add an explicit architectural layer:

## Engineering Integration Hub

Responsibilities:

- MCP connectivity
- API adapters
- CLI adapters
- Plugin architecture
- Webhook/event ingestion
- Authentication
- Credential management
- Integration permissions
- Capability discovery
- Tool registration
- Integration health
- Version compatibility
- Rate-limit handling
- Error handling
- Integration audit logging

External systems SHALL be abstracted from core PMI Studio workflows wherever practical.

Example:

PMI Studio workflow SHALL request:

`CreateImplementationBranch()`

rather than embedding GitHub-specific logic throughout the application.

A GitHub adapter may execute that capability.

This allows another adapter to implement the same capability for GitLab.

---

# 6. Introduce an AI/Agent Abstraction Layer

PMI Studio SHALL support multiple AI execution engines.

Target architecture:

PMI Studio
→ Agent Orchestrator
→ AI Gateway
→ Provider/Agent Adapter
→ Claude / Codex / Gemini / Copilot / other compatible engines.

The core workflow SHALL NOT assume Claude Code, Cursor, Codex or another individual provider is permanently required.

Provider-specific features may be exposed through capability negotiation.

The platform SHALL determine:

- available agents
- available models
- supported capabilities
- context limits
- tool permissions
- execution environment
- cost
- security classification
- task suitability

before assignment.

---

# 7. Preserve and Strengthen Remote Engineering Workspace

Continue the existing remote PMI Studio workspace/VM direction.

The target execution model SHOULD support:

PMI Studio
→ Agent Orchestrator
→ Controlled Remote Workspace
→ Repository
→ Native Spec Kit
→ Engineering tools
→ AI agent
→ MCP tools
→ Build/Test environment.

Workspaces SHOULD support:

- VM/container isolation
- ephemeral execution
- repository isolation
- controlled filesystem access
- controlled network access
- temporary credentials
- secret isolation
- command policies
- execution logging
- resource limits
- agent identity
- environment reproducibility
- destruction/cleanup policies

This SHALL enable remote and autonomous AI engineering without requiring unrestricted access to developer computers.

---

# 8. Make Spec Kit Native to the Engineering Workflow

Preserve Spec Kit as a foundational specification-driven capability.

However, Spec Kit SHALL operate as part of the PMI Studio workflow rather than as an isolated command-line utility.

Target relationship:

Requirement Room
→ Approved Requirement
→ Specification
→ Spec Kit
→ Clarification
→ Plan
→ Tasks
→ Agent Orchestration
→ Implementation
→ Testing
→ Evidence
→ Completion.

PMI Studio SHALL maintain traceability between Spec Kit artifacts and platform entities.

---

# 9. Introduce the Engineering Context Layer

Add or strengthen a centralized Engineering Context Engine.

Agents SHALL NOT depend only on repository source code.

Relevant context may include:

- requirements
- specifications
- acceptance criteria
- constraints
- architecture
- ADRs
- coding standards
- organizational standards
- repository structure
- ownership
- dependencies
- API definitions
- historical decisions
- previous changes
- defects
- tests
- releases
- incidents
- security policies
- implementation history
- AI execution history

The Context Engine SHALL provide task-specific context rather than indiscriminately sending all available information to an LLM.

---

# 10. Strengthen the Enterprise Engineering Knowledge Graph

Where consistent with the existing architecture, represent relationships such as:

Requirement
→ Epic
→ Feature
→ Specification
→ Decision
→ Task
→ Agent Session
→ Code Change
→ Commit
→ Pull Request
→ Test
→ Security Evidence
→ Release
→ Deployment
→ Incident
→ Defect
→ Change Request.

This graph SHALL support impact analysis and traceability.

Example query:

> What requirements, specifications, services, tests, decisions and releases are affected by this proposed change?

The system SHOULD answer from structured engineering relationships and verified evidence rather than relying exclusively on LLM inference.

---

# 11. Evidence-Driven Delivery

Add the concept of an Engineering Evidence Package to implementation completion.

A task SHOULD NOT be considered complete merely because an AI agent reports success.

Evidence may include:

- specification reference
- implementation diff
- tests executed
- test results
- acceptance criteria results
- security scans
- static analysis
- architecture checks
- policy checks
- AI review
- human review
- build results
- deployment validation

Completion gates SHALL evaluate required evidence according to project policy.

---

# 12. Human and AI Responsibility Model

Explicitly distinguish:

### Human Decision

Humans remain accountable for consequential decisions defined by governance policy.

Examples may include:

- requirement approval
- scope baseline
- significant architecture changes
- high-impact change requests
- security exceptions
- production approvals

### AI Recommendation

AI may:

- ask questions
- identify ambiguity
- analyze impact
- generate alternatives
- calculate or estimate consequences
- identify risks
- recommend options
- prepare decision packages

### AI Execution

Authorized agents may:

- generate code
- create tests
- execute tests
- update documentation
- perform analysis
- prepare pull requests
- execute approved engineering workflows

subject to policy and permissions.

---

# 13. Unified User Experience

Although external tools may execute portions of the workflow, users SHOULD experience PMI Studio as a coherent engineering environment.

A user should be able to follow:

Requirement
→ Specification
→ Decision
→ Plan
→ Task
→ Implementation
→ Test
→ Review
→ Release
→ Defect/Change

without manually reconstructing information across multiple disconnected systems.

PMI Studio SHALL surface relevant external information within the appropriate workflow context whenever technically and legally feasible.

---

# 14. Do Not Become Another Coding IDE

PMI Studio SHALL NOT position itself primarily as a replacement for:

- Cursor
- VS Code
- Claude Code
- GitHub Copilot
- JetBrains
- other coding environments.

These systems may act as engineering execution interfaces.

PMI Studio's differentiated responsibility is the engineering operating system surrounding those execution environments.

---

# 15. Target Value Proposition

The architecture and roadmap SHALL optimize for organizations that want:

> The engineering capabilities and discipline of a sophisticated internal developer platform without having to design, integrate, secure and maintain one themselves.

PMI Studio should provide:

**Ready-to-use workflow + AI orchestration + specification + governance + context + traceability + evidence + integrations.**

---

# 16. Architectural Target

Use the following conceptual architecture when reconciling existing plans:

```text
                         PMI STUDIO
            AI-Native Engineering Operating System

 ┌───────────────────────────────────────────────────┐
 │ Requirement │ Specification │ Planning │ Decisions│
 │ Change      │ Defect        │ Governance          │
 └──────────────────────┬────────────────────────────┘
                        │
               Engineering Context
                        │
                 Knowledge Graph
                        │
                Agent Orchestrator
                        │
                   AI Gateway
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Claude         Codex         Other AI
          │             │             │
          └─────────────┼─────────────┘
                        │
             Controlled Workspace
                 VM / Container
                        │
             Native Spec Kit + Repo
                        │
               Implementation
                        │
                 Test / Review
                        │
                Evidence Gate
                        │
              Integration Hub
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
     GitHub            CI/CD           Cloud
       │                                 │
       └────────────────┬────────────────┘
                        ▼
                    Production
                        │
                 Observability
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
          Defect Room         Change Room
```

---

# 17. Plan Reconciliation Instructions

Before creating new implementation tasks:

1. Review the existing Master Product Specification, module specifications, architecture, technical stack, epics and current implementation plan.

2. Map this amendment against existing requirements.

3. Classify findings as:
   - Already covered
   - Covered but requires enhancement
   - Missing
   - Conflicting
   - Should become integration rather than native implementation

4. **Do not duplicate existing requirements.**

5. Preserve existing IDs and traceability wherever possible.

6. Create new requirement IDs only where genuinely necessary.

7. Identify architectural decisions requiring ADRs.

8. Identify affected epics/modules/tasks.

9. Do not reopen approved decisions unless this amendment creates a genuine architectural conflict.

10. Do not stop currently valid implementation work unnecessarily.

11. Separate:
   - immediate architectural corrections,
   - near-term implementation,
   - later platform capabilities.

12. Update architecture diagrams and interface boundaries accordingly.

---

# 18. Required Amendment Output

Produce an amendment impact report containing:

1. Executive summary
2. Existing architecture impact
3. Product-boundary changes
4. Requirements affected
5. Modules affected
6. Epics affected
7. New requirements
8. Requirements requiring modification
9. Requirements that should change from native implementation to integration
10. Architecture changes
11. New/updated ADRs
12. Engineering Integration Hub impact
13. AI Gateway/Agent Orchestrator impact
14. Context Engine/Knowledge Graph impact
15. Remote Workspace impact
16. Requirement Room impact
17. Change Room impact
18. Defect Room impact
19. Governance/security impact
20. Traceability/evidence impact
21. Implementation-plan impact
22. Tasks to add/change/remove
23. Migration strategy
24. Risks
25. Open decisions requiring human approval

Finish with a proposed updated implementation sequence.

---

# 19. Critical Constraint

**This amendment is evolutionary, not a product reset.**

Do not replace working architecture merely to match examples from Microsoft, Spotify, Meta, GitHub or other large organizations.

Use industry patterns only to validate architectural principles.

PMI Studio's competitive advantage is to package those lessons into an accessible, integrated AI-native engineering operating system for organizations that cannot or do not want to build a sophisticated internal engineering platform themselves.

Proceed by reconciling this amendment with the existing PMI Studio specification and implementation plan.