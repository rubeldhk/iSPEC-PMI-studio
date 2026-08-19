# Register: Clauses

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Every substantive clause across the five amendment documents, one row each.

**One row per clause, duplicates cross-linked** (clarified 2026-08-14). The collapsed form — one
row per distinct capability — cannot prove `SC-AMD-001`, because a clause nobody noticed is
indistinguishable from one that is not there.

**Quote, never paraphrase.** Finding A exists because the amendment's own paraphrase of this corpus
was wrong; a register that paraphrases its sources inherits the same failure mode.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Register

| id | document | section | text | normativity | duplicates |
|---|---|---|---|---|---|
| CLA-001 | plan-amendment | §Purpose | Amend the existing PMI Studio product and implementation plan to clarify the product boundary, target market, integration architecture, and AI-native engineering operating model. | shall | — |
| CLA-002 | plan-amendment | §Purpose | Do NOT redesign PMI Studio from scratch. | must | CLA-191 ; CLA-358 ; CLA-587 ; CLA-598 |
| CLA-003 | plan-amendment | §Purpose | Do NOT discard, replace, or regenerate existing approved requirements, modules, epics, architecture decisions, Requirement Room, Change Room, Defect Room, Spec Kit integration, governance model, or implementation work. | must | CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 ; CLA-182 |
| CLA-004 | plan-amendment | §Purpose | This amendment SHALL be applied incrementally to the existing specifications and plans. | shall | — |
| CLA-005 | plan-amendment | §1 | PMI Studio SHALL be positioned as a ready-to-use AI-native engineering operating system for software organizations that need an integrated, governed, spec-driven development ecosystem without building their own internal engineering platform. | shall | — |
| CLA-006 | plan-amendment | §1 | PMI Studio is NOT primarily designed for very large technology companies that maintain dedicated internal platform-engineering organizations and custom AI engineering infrastructure. | narrative | — |
| CLA-007 | plan-amendment | §1 | Primary target organizations include small and medium software companies, SaaS organizations, startups scaling engineering operations, software agencies, distributed development organizations, AI-native development teams, product engineering organizations, organizations modernizing traditional SDLC processes with AI, and organizations without dedicated internal developer-platform teams. | narrative | — |
| CLA-008 | plan-amendment | §2 | PMI Studio SHALL NOT attempt to recreate every tool used throughout the SDLC. | shall | — |
| CLA-009 | plan-amendment | §2 | Own the engineering workflow, specification, governance, orchestration, traceability, context and evidence. Integrate commodity execution capabilities where mature external tools already exist. | shall | CLA-066 ; CLA-155 ; CLA-556 ; CLA-585 |
| CLA-010 | plan-amendment | §2 | Every existing and future capability SHALL therefore be classified as A. PMI Studio Native Capability, B. Integrated Capability, or C. Hybrid Capability. | shall | — |
| CLA-011 | plan-amendment | §2A | PMI Studio Native Capability: capabilities fundamental to PMI Studio's differentiated engineering operating model. | narrative | — |
| CLA-012 | plan-amendment | §2B | Integrated Capability: external engineering systems orchestrated through APIs, MCP, CLI, webhooks, plugins, adapters or other controlled integration mechanisms. | narrative | CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 ; CLA-258 |
| CLA-013 | plan-amendment | §2C | Hybrid Capability: PMI Studio owns the workflow, state, policies and evidence while an external system performs some execution. | narrative | — |
| CLA-014 | plan-amendment | §2 | Do not remove existing functionality solely because an external product provides something similar. | must | — |
| CLA-015 | plan-amendment | §2 | Determine ownership based on whether PMI Studio must control that capability to maintain its end-to-end engineering workflow. | must | — |
| CLA-016 | plan-amendment | §3 | The architecture SHOULD treat the following as core/native platform responsibilities. | should | — |
| CLA-017 | plan-amendment | §3.intent | Requirement gathering is a core/native platform responsibility. | should | — |
| CLA-018 | plan-amendment | §3.intent | Requirement clarification is a core/native platform responsibility. | should | — |
| CLA-019 | plan-amendment | §3.intent | Requirement reasoning is a core/native platform responsibility. | should | — |
| CLA-020 | plan-amendment | §3.intent | Requirement approval is a core/native platform responsibility. | should | — |
| CLA-021 | plan-amendment | §3.intent | Requirement baselining is a core/native platform responsibility. | should | — |
| CLA-022 | plan-amendment | §3.intent | Acceptance criteria are a core/native platform responsibility. | should | — |
| CLA-023 | plan-amendment | §3.intent | Specification management is a core/native platform responsibility. | should | — |
| CLA-024 | plan-amendment | §3.intent | Constraint management is a core/native platform responsibility. | should | — |
| CLA-025 | plan-amendment | §3.intent | Decision records are a core/native platform responsibility. | should | — |
| CLA-026 | plan-amendment | §3.intent | Architecture decisions are a core/native platform responsibility. | should | — |
| CLA-027 | plan-amendment | §3.intent | Requirement-to-implementation traceability is a core/native platform responsibility. | should | — |
| CLA-028 | plan-amendment | §3.planning | Specification-driven planning is a core/native platform responsibility. | should | — |
| CLA-029 | plan-amendment | §3.planning | Epic decomposition is a core/native platform responsibility. | should | — |
| CLA-030 | plan-amendment | §3.planning | Feature decomposition is a core/native platform responsibility. | should | — |
| CLA-031 | plan-amendment | §3.planning | Task generation is a core/native platform responsibility. | should | — |
| CLA-032 | plan-amendment | §3.planning | Dependency analysis is a core/native platform responsibility. | should | — |
| CLA-033 | plan-amendment | §3.planning | Implementation sequencing is a core/native platform responsibility. | should | — |
| CLA-034 | plan-amendment | §3.planning | AI-assisted estimation is a core/native platform responsibility. | should | — |
| CLA-035 | plan-amendment | §3.planning | Risk analysis is a core/native platform responsibility. | should | — |
| CLA-036 | plan-amendment | §3.planning | Planning validation is a core/native platform responsibility. | should | — |
| CLA-037 | plan-amendment | §3.orchestration | Agent registry is a core/native platform responsibility. | should | CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 ; CLA-252 |
| CLA-038 | plan-amendment | §3.orchestration | Agent assignment is a core/native platform responsibility. | should | — |
| CLA-039 | plan-amendment | §3.orchestration | Model selection is a core/native platform responsibility. | should | — |
| CLA-040 | plan-amendment | §3.orchestration | Multi-model routing is a core/native platform responsibility. | should | — |
| CLA-041 | plan-amendment | §3.orchestration | Agent workflow orchestration is a core/native platform responsibility. | should | — |
| CLA-042 | plan-amendment | §3.orchestration | Agent permissions are a core/native platform responsibility. | should | — |
| CLA-043 | plan-amendment | §3.orchestration | Agent execution policies are a core/native platform responsibility. | should | — |
| CLA-044 | plan-amendment | §3.orchestration | Agent context preparation is a core/native platform responsibility. | should | — |
| CLA-045 | plan-amendment | §3.orchestration | Agent activity tracking is a core/native platform responsibility. | should | — |
| CLA-046 | plan-amendment | §3.orchestration | Human/AI responsibility boundaries are a core/native platform responsibility. | should | — |
| CLA-047 | plan-amendment | §3.governance | Engineering policies are a core/native platform responsibility. | should | — |
| CLA-048 | plan-amendment | §3.governance | AI policies are a core/native platform responsibility. | should | — |
| CLA-049 | plan-amendment | §3.governance | Approval gates are a core/native platform responsibility. | should | — |
| CLA-050 | plan-amendment | §3.governance | Human-in-the-loop controls are a core/native platform responsibility. | should | — |
| CLA-051 | plan-amendment | §3.governance | Role-based authorization is a core/native platform responsibility. | should | — |
| CLA-052 | plan-amendment | §3.governance | Execution permissions are a core/native platform responsibility. | should | — |
| CLA-053 | plan-amendment | §3.governance | Audit trails are a core/native platform responsibility. | should | — |
| CLA-054 | plan-amendment | §3.governance | Evidence requirements are a core/native platform responsibility. | should | — |
| CLA-055 | plan-amendment | §3.governance | Exception management is a core/native platform responsibility. | should | — |
| CLA-056 | plan-amendment | §3.governance | Risk controls are a core/native platform responsibility. | should | — |
| CLA-057 | plan-amendment | §3.change | Maintain and enhance the existing Change Room. | must | CLA-003 ; CLA-058 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-361 ; CLA-408 ; CLA-409 |
| CLA-058 | plan-amendment | §3.change | The Change Room SHALL support: Change Request, AI clarification, impact analysis, affected specification identification, dependency analysis, options, trade-offs, risks, recommendation, human decision, specification update, re-planning, implementation. | shall | CLA-003 ; CLA-057 ; CLA-060 ; CLA-064 ; CLA-139 ; CLA-141 ; CLA-152 ; CLA-182 |
| CLA-059 | plan-amendment | §3.change | AI SHALL support decision preparation. | shall | — |
| CLA-060 | plan-amendment | §3.change | Accountable humans SHALL retain authority for decisions requiring human approval. | shall | CLA-058 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 ; CLA-411 |
| CLA-061 | plan-amendment | §3.defect | Maintain and enhance the existing Defect Room. | must | CLA-003 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 ; CLA-445 |
| CLA-062 | plan-amendment | §3.defect | Defects may originate from automated tests, QA, developers, production monitoring, customers, support, AI agents, security testing and observability systems. | may | — |
| CLA-063 | plan-amendment | §3.defect | Target defect workflow: Defect Report, Classification, Link to Epic/Feature/Requirement, Reproduction, Test creation or identification, Initial test, FAIL: Defect confirmed, Add List, Implement, Test, Regression validation, Evidence, Complete. | shall | — |
| CLA-064 | plan-amendment | §3.defect | If expected behavior passes and the requested behavior represents a modification rather than a specification violation, transfer to Change Room. | shall | CLA-003 ; CLA-057 ; CLA-058 ; CLA-152 ; CLA-182 ; CLA-361 ; CLA-408 ; CLA-409 |
| CLA-065 | plan-amendment | §3.defect | Preserve full traceability between defect, specification, tests, implementation and release. | must | — |
| CLA-066 | plan-amendment | §4 | PMI Studio SHOULD integrate rather than unnecessarily replace mature external engineering systems. | should | CLA-009 ; CLA-155 ; CLA-556 ; CLA-585 |
| CLA-067 | plan-amendment | §4.scm | Source control (GitHub, GitLab, Bitbucket, other Git-compatible systems) is an integration rather than a native build. | should | — |
| CLA-068 | plan-amendment | §4.engines | AI coding/engineering engines (Claude Code, OpenAI Codex, GitHub Copilot, Gemini, Cursor, future compatible agents/models) are integrations rather than native builds. | should | — |
| CLA-069 | plan-amendment | §4.engines | PMI Studio SHALL NOT depend architecturally on a single AI provider. | shall | CLA-097 ; CLA-209 ; CLA-495 ; CLA-584 |
| CLA-070 | plan-amendment | §4.cicd | CI/CD systems (GitHub Actions, GitLab CI, Jenkins, Azure DevOps, cloud-native pipelines) are integrations rather than native builds. | should | — |
| CLA-071 | plan-amendment | §4.cloud | Cloud and infrastructure systems (AWS, Azure, GCP, Kubernetes, Terraform) are integrations rather than native builds. | should | — |
| CLA-072 | plan-amendment | §4.comms | Communication systems (Slack, Microsoft Teams, Email) are integrations rather than native builds. | should | — |
| CLA-073 | plan-amendment | §4.observability | Observability systems (Datadog, Grafana, Sentry, Splunk, cloud monitoring platforms) are integrations rather than native builds. | should | — |
| CLA-074 | plan-amendment | §4 | PMI Studio SHALL consume relevant signals from these systems and convert them into engineering context, evidence, defects, risks or workflow events where appropriate. | shall | — |
| CLA-075 | plan-amendment | §5 | Add an explicit architectural layer: the Engineering Integration Hub. | must | — |
| CLA-076 | plan-amendment | §5 | The Engineering Integration Hub is responsible for MCP connectivity. | shall | CLA-012 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 ; CLA-258 |
| CLA-077 | plan-amendment | §5 | The Engineering Integration Hub is responsible for API adapters. | shall | — |
| CLA-078 | plan-amendment | §5 | The Engineering Integration Hub is responsible for CLI adapters. | shall | — |
| CLA-079 | plan-amendment | §5 | The Engineering Integration Hub is responsible for plugin architecture. | shall | — |
| CLA-080 | plan-amendment | §5 | The Engineering Integration Hub is responsible for webhook/event ingestion. | shall | — |
| CLA-081 | plan-amendment | §5 | The Engineering Integration Hub is responsible for authentication. | shall | — |
| CLA-082 | plan-amendment | §5 | The Engineering Integration Hub is responsible for credential management. | shall | — |
| CLA-083 | plan-amendment | §5 | The Engineering Integration Hub is responsible for integration permissions. | shall | — |
| CLA-084 | plan-amendment | §5 | The Engineering Integration Hub is responsible for capability discovery. | shall | — |
| CLA-085 | plan-amendment | §5 | The Engineering Integration Hub is responsible for tool registration. | shall | — |
| CLA-086 | plan-amendment | §5 | The Engineering Integration Hub is responsible for integration health. | shall | — |
| CLA-087 | plan-amendment | §5 | The Engineering Integration Hub is responsible for version compatibility. | shall | — |
| CLA-088 | plan-amendment | §5 | The Engineering Integration Hub is responsible for rate-limit handling. | shall | — |
| CLA-089 | plan-amendment | §5 | The Engineering Integration Hub is responsible for error handling. | shall | — |
| CLA-090 | plan-amendment | §5 | The Engineering Integration Hub is responsible for integration audit logging. | shall | — |
| CLA-091 | plan-amendment | §5 | External systems SHALL be abstracted from core PMI Studio workflows wherever practical. | shall | — |
| CLA-092 | plan-amendment | §5 | PMI Studio workflow SHALL request CreateImplementationBranch() rather than embedding GitHub-specific logic throughout the application. | shall | — |
| CLA-093 | plan-amendment | §5 | A GitHub adapter may execute that capability, and this allows another adapter to implement the same capability for GitLab. | may | — |
| CLA-094 | plan-amendment | §6 | PMI Studio SHALL support multiple AI execution engines. | shall | — |
| CLA-095 | plan-amendment | §6 | Target architecture: PMI Studio, Agent Orchestrator, AI Gateway, Provider/Agent Adapter, then Claude / Codex / Gemini / Copilot / other compatible engines. | shall | CLA-037 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 ; CLA-252 |
| CLA-096 | plan-amendment | §6 | The core workflow SHALL NOT assume Claude Code, Cursor, Codex or another individual provider is permanently required. | shall | — |
| CLA-097 | plan-amendment | §6 | Provider-specific features may be exposed through capability negotiation. | may | CLA-069 ; CLA-209 ; CLA-495 ; CLA-584 |
| CLA-098 | plan-amendment | §6 | The platform SHALL determine available agents before assignment. | shall | — |
| CLA-099 | plan-amendment | §6 | The platform SHALL determine available models before assignment. | shall | — |
| CLA-100 | plan-amendment | §6 | The platform SHALL determine supported capabilities before assignment. | shall | — |
| CLA-101 | plan-amendment | §6 | The platform SHALL determine context limits before assignment. | shall | — |
| CLA-102 | plan-amendment | §6 | The platform SHALL determine tool permissions before assignment. | shall | — |
| CLA-103 | plan-amendment | §6 | The platform SHALL determine execution environment before assignment. | shall | — |
| CLA-104 | plan-amendment | §6 | The platform SHALL determine cost before assignment. | shall | — |
| CLA-105 | plan-amendment | §6 | The platform SHALL determine security classification before assignment. | shall | — |
| CLA-106 | plan-amendment | §6 | The platform SHALL determine task suitability before assignment. | shall | — |
| CLA-107 | plan-amendment | §7 | Continue the existing remote PMI Studio workspace/VM direction. | should | — |
| CLA-108 | plan-amendment | §7 | The target execution model SHOULD support: PMI Studio, Agent Orchestrator, Controlled Remote Workspace, Repository, Native Spec Kit, Engineering tools, AI agent, MCP tools, Build/Test environment. | should | CLA-012 ; CLA-076 ; CLA-126 ; CLA-152 ; CLA-196 ; CLA-200 ; CLA-231 ; CLA-232 |
| CLA-109 | plan-amendment | §7 | Workspaces SHOULD support VM/container isolation. | should | — |
| CLA-110 | plan-amendment | §7 | Workspaces SHOULD support ephemeral execution. | should | — |
| CLA-111 | plan-amendment | §7 | Workspaces SHOULD support repository isolation. | should | — |
| CLA-112 | plan-amendment | §7 | Workspaces SHOULD support controlled filesystem access. | should | — |
| CLA-113 | plan-amendment | §7 | Workspaces SHOULD support controlled network access. | should | CLA-296 ; CLA-297 ; CLA-351 |
| CLA-114 | plan-amendment | §7 | Workspaces SHOULD support temporary credentials. | should | — |
| CLA-115 | plan-amendment | §7 | Workspaces SHOULD support secret isolation. | should | — |
| CLA-116 | plan-amendment | §7 | Workspaces SHOULD support command policies. | should | — |
| CLA-117 | plan-amendment | §7 | Workspaces SHOULD support execution logging. | should | — |
| CLA-118 | plan-amendment | §7 | Workspaces SHOULD support resource limits. | should | — |
| CLA-119 | plan-amendment | §7 | Workspaces SHOULD support agent identity. | should | — |
| CLA-120 | plan-amendment | §7 | Workspaces SHOULD support environment reproducibility. | should | — |
| CLA-121 | plan-amendment | §7 | Workspaces SHOULD support destruction/cleanup policies. | should | — |
| CLA-122 | plan-amendment | §7 | This SHALL enable remote and autonomous AI engineering without requiring unrestricted access to developer computers. | shall | — |
| CLA-123 | plan-amendment | §8 | Preserve Spec Kit as a foundational specification-driven capability. | must | — |
| CLA-124 | plan-amendment | §8 | Spec Kit SHALL operate as part of the PMI Studio workflow rather than as an isolated command-line utility. | shall | — |
| CLA-125 | plan-amendment | §8 | Target relationship: Requirement Room, Approved Requirement, Specification, Spec Kit, Clarification, Plan, Tasks, Agent Orchestration, Implementation, Testing, Evidence, Completion. | shall | CLA-003 ; CLA-181 ; CLA-287 ; CLA-361 ; CLA-371 ; CLA-373 ; CLA-375 ; CLA-436 |
| CLA-126 | plan-amendment | §8 | PMI Studio SHALL maintain traceability between Spec Kit artifacts and platform entities. | shall | CLA-108 ; CLA-152 ; CLA-196 ; CLA-231 ; CLA-232 ; CLA-345 |
| CLA-127 | plan-amendment | §9 | Add or strengthen a centralized Engineering Context Engine. | must | CLA-130 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-509 ; CLA-523 |
| CLA-128 | plan-amendment | §9 | Agents SHALL NOT depend only on repository source code. | shall | — |
| CLA-129 | plan-amendment | §9 | Relevant context may include requirements, specifications, acceptance criteria, constraints, architecture, ADRs, coding standards, organizational standards, repository structure, ownership, dependencies, API definitions, historical decisions, previous changes, defects, tests, releases, incidents, security policies, implementation history and AI execution history. | may | — |
| CLA-130 | plan-amendment | §9 | The Context Engine SHALL provide task-specific context rather than indiscriminately sending all available information to an LLM. | shall | CLA-127 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-509 ; CLA-523 |
| CLA-131 | plan-amendment | §10 | Where consistent with the existing architecture, represent relationships such as Requirement, Epic, Feature, Specification, Decision, Task, Agent Session, Code Change, Commit, Pull Request, Test, Security Evidence, Release, Deployment, Incident, Defect, Change Request. | should | — |
| CLA-132 | plan-amendment | §10 | This graph SHALL support impact analysis and traceability. | shall | — |
| CLA-133 | plan-amendment | §10 | Example query: what requirements, specifications, services, tests, decisions and releases are affected by this proposed change? | narrative | — |
| CLA-134 | plan-amendment | §10 | The system SHOULD answer from structured engineering relationships and verified evidence rather than relying exclusively on LLM inference. | should | — |
| CLA-135 | plan-amendment | §11 | Add the concept of an Engineering Evidence Package to implementation completion. | must | CLA-138 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-520 ; CLA-528 ; CLA-592 |
| CLA-136 | plan-amendment | §11 | A task SHOULD NOT be considered complete merely because an AI agent reports success. | should | — |
| CLA-137 | plan-amendment | §11 | Evidence may include specification reference, implementation diff, tests executed, test results, acceptance criteria results, security scans, static analysis, architecture checks, policy checks, AI review, human review, build results and deployment validation. | may | — |
| CLA-138 | plan-amendment | §11 | Completion gates SHALL evaluate required evidence according to project policy. | shall | CLA-135 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-520 ; CLA-528 ; CLA-592 |
| CLA-139 | plan-amendment | §12 | Explicitly distinguish Human Decision, AI Recommendation and AI Execution. | must | CLA-058 ; CLA-060 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 ; CLA-411 |
| CLA-140 | plan-amendment | §12.human | Humans remain accountable for consequential decisions defined by governance policy. | shall | — |
| CLA-141 | plan-amendment | §12.human | Human decisions may include requirement approval, scope baseline, significant architecture changes, high-impact change requests, security exceptions and production approvals. | may | CLA-058 ; CLA-060 ; CLA-139 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 ; CLA-411 |
| CLA-142 | plan-amendment | §12.ai-rec | AI may ask questions, identify ambiguity, analyze impact, generate alternatives, calculate or estimate consequences, identify risks, recommend options and prepare decision packages. | may | — |
| CLA-143 | plan-amendment | §12.ai-exec | Authorized agents may generate code, create tests, execute tests, update documentation, perform analysis, prepare pull requests and execute approved engineering workflows, subject to policy and permissions. | may | — |
| CLA-144 | plan-amendment | §13 | Although external tools may execute portions of the workflow, users SHOULD experience PMI Studio as a coherent engineering environment. | should | — |
| CLA-145 | plan-amendment | §13 | A user should be able to follow Requirement, Specification, Decision, Plan, Task, Implementation, Test, Review, Release, Defect/Change without manually reconstructing information across multiple disconnected systems. | should | — |
| CLA-146 | plan-amendment | §13 | PMI Studio SHALL surface relevant external information within the appropriate workflow context whenever technically and legally feasible. | shall | — |
| CLA-147 | plan-amendment | §14 | PMI Studio SHALL NOT position itself primarily as a replacement for Cursor, VS Code, Claude Code, GitHub Copilot, JetBrains or other coding environments. | shall | CLA-494 ; CLA-583 |
| CLA-148 | plan-amendment | §14 | These systems may act as engineering execution interfaces. | may | — |
| CLA-149 | plan-amendment | §14 | PMI Studio's differentiated responsibility is the engineering operating system surrounding those execution environments. | narrative | — |
| CLA-150 | plan-amendment | §15 | The architecture and roadmap SHALL optimize for organizations that want the engineering capabilities and discipline of a sophisticated internal developer platform without having to design, integrate, secure and maintain one themselves. | shall | — |
| CLA-151 | plan-amendment | §15 | PMI Studio should provide ready-to-use workflow, AI orchestration, specification, governance, context, traceability, evidence and integrations. | should | — |
| CLA-152 | plan-amendment | §16 | Use the stated conceptual architecture when reconciling existing plans: Requirement/Specification/Planning/Decisions/Change/Defect/Governance over Engineering Context, Knowledge Graph, Agent Orchestrator, AI Gateway, provider adapters, Controlled Workspace, Native Spec Kit and Repo, Implementation, Test/Review, Evidence Gate, Integration Hub, Production, Observability, feeding back to Defect Room and Change Room. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-108 ; CLA-126 ; CLA-179 |
| CLA-153 | plan-amendment | §17.1 | Before creating new implementation tasks, review the existing Master Product Specification, module specifications, architecture, technical stack, epics and current implementation plan. | must | — |
| CLA-154 | plan-amendment | §17.2 | Map this amendment against existing requirements. | must | — |
| CLA-155 | plan-amendment | §17.3 | Classify findings as Already covered, Covered but requires enhancement, Missing, Conflicting, or Should become integration rather than native implementation. | must | CLA-009 ; CLA-066 ; CLA-556 ; CLA-585 |
| CLA-156 | plan-amendment | §17.4 | Do not duplicate existing requirements. | must | — |
| CLA-157 | plan-amendment | §17.5 | Preserve existing IDs and traceability wherever possible. | must | — |
| CLA-158 | plan-amendment | §17.6 | Create new requirement IDs only where genuinely necessary. | must | — |
| CLA-159 | plan-amendment | §17.7 | Identify architectural decisions requiring ADRs. | must | — |
| CLA-160 | plan-amendment | §17.8 | Identify affected epics/modules/tasks. | must | — |
| CLA-161 | plan-amendment | §17.9 | Do not reopen approved decisions unless this amendment creates a genuine architectural conflict. | must | — |
| CLA-162 | plan-amendment | §17.10 | Do not stop currently valid implementation work unnecessarily. | must | — |
| CLA-163 | plan-amendment | §17.11 | Separate immediate architectural corrections, near-term implementation, and later platform capabilities. | must | — |
| CLA-164 | plan-amendment | §17.12 | Update architecture diagrams and interface boundaries accordingly. | must | — |
| CLA-165 | plan-amendment | §18 | Produce an amendment impact report containing twenty-five named sections, finishing with a proposed updated implementation sequence. | must | CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 ; CLA-173 |
| CLA-166 | plan-amendment | §18.1 | The impact report contains an executive summary. | must | CLA-165 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 ; CLA-173 |
| CLA-167 | plan-amendment | §18.2 | The impact report contains existing architecture impact. | must | CLA-165 ; CLA-166 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 ; CLA-173 |
| CLA-168 | plan-amendment | §18.3 | The impact report contains product-boundary changes. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 ; CLA-173 |
| CLA-169 | plan-amendment | §18.4 | The impact report contains requirements affected. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-170 ; CLA-171 ; CLA-172 ; CLA-173 |
| CLA-170 | plan-amendment | §18.5 | The impact report contains modules affected. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-171 ; CLA-172 ; CLA-173 |
| CLA-171 | plan-amendment | §18.6 | The impact report contains epics affected. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-172 ; CLA-173 |
| CLA-172 | plan-amendment | §18.7 | The impact report contains new requirements. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-173 |
| CLA-173 | plan-amendment | §18.8 | The impact report contains requirements requiring modification. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-174 | plan-amendment | §18.9 | The impact report contains requirements that should change from native implementation to integration. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-175 | plan-amendment | §18.10 | The impact report contains architecture changes. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-176 | plan-amendment | §18.11 | The impact report contains new/updated ADRs. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-177 | plan-amendment | §18.12 | The impact report contains Engineering Integration Hub impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-178 | plan-amendment | §18.13 | The impact report contains AI Gateway/Agent Orchestrator impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-179 | plan-amendment | §18.14 | The impact report contains Context Engine/Knowledge Graph impact. | must | CLA-127 ; CLA-130 ; CLA-152 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 |
| CLA-180 | plan-amendment | §18.15 | The impact report contains Remote Workspace impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-181 | plan-amendment | §18.16 | The impact report contains Requirement Room impact. | must | CLA-003 ; CLA-125 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 |
| CLA-182 | plan-amendment | §18.17 | The impact report contains Change Room impact. | must | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-152 ; CLA-165 ; CLA-166 ; CLA-167 |
| CLA-183 | plan-amendment | §18.18 | The impact report contains Defect Room impact. | must | CLA-003 ; CLA-061 ; CLA-152 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 |
| CLA-184 | plan-amendment | §18.19 | The impact report contains governance/security impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-185 | plan-amendment | §18.20 | The impact report contains traceability/evidence impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-186 | plan-amendment | §18.21 | The impact report contains implementation-plan impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-187 | plan-amendment | §18.22 | The impact report contains tasks to add/change/remove. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-188 | plan-amendment | §18.23 | The impact report contains migration strategy. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-189 | plan-amendment | §18.24 | The impact report contains risks. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-190 | plan-amendment | §18.25 | The impact report contains open decisions requiring human approval. | must | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 |
| CLA-191 | plan-amendment | §19 | This amendment is evolutionary, not a product reset. | shall | CLA-002 ; CLA-358 ; CLA-587 ; CLA-598 |
| CLA-192 | plan-amendment | §19 | Do not replace working architecture merely to match examples from Microsoft, Spotify, Meta, GitHub or other large organizations. | must | — |
| CLA-193 | plan-amendment | §19 | Use industry patterns only to validate architectural principles. | must | — |
| CLA-194 | plan-amendment | §19 | PMI Studio's competitive advantage is to package those lessons into an accessible, integrated AI-native engineering operating system for organizations that cannot or do not want to build a sophisticated internal engineering platform themselves. | narrative | — |
| CLA-195 | plan-amendment | §19 | Proceed by reconciling this amendment with the existing PMI Studio specification and implementation plan. | must | — |
| CLA-196 | native-speckit | §Objective | Extend the existing PMI Studio architecture so that Spec-Kit becomes a native, embedded specification and engineering capability of PMI Studio. | shall | CLA-108 ; CLA-126 ; CLA-152 ; CLA-231 ; CLA-232 ; CLA-345 |
| CLA-197 | native-speckit | §Objective | AI engineering agents such as Claude Code, Cursor, Codex, and future agents can execute governed work remotely without requiring Claude Desktop or another local desktop application. | shall | — |
| CLA-198 | native-speckit | §Objective | Do NOT replace or weaken the existing engine-contract, adapter isolation, worker boundary, asynchronous job architecture, sandbox security model, traceability model, or application/service boundaries. | must | — |
| CLA-199 | native-speckit | §Objective | The existing architecture remains authoritative unless this plan explicitly identifies a required extension. | shall | — |
| CLA-200 | native-speckit | §1 | Design PMI Studio around the separation of Control Plane, Governance and Decision Layer, Workflow Orchestrator, AI Agent Gateway, Specification Engine Interface, Spec-Kit Native Engine, Project Execution Environment, Ephemeral Agent Sandboxes, MCP Integration Layer and Repository/CI-CD Integration. | shall | CLA-012 ; CLA-037 ; CLA-076 ; CLA-095 ; CLA-108 ; CLA-208 ; CLA-210 ; CLA-211 |
| CLA-201 | native-speckit | §1 | PMI Studio must own governance and lifecycle state. | must | — |
| CLA-202 | native-speckit | §1 | Spec-Kit must provide specification-driven engineering mechanics. | must | — |
| CLA-203 | native-speckit | §1 | AI agents must provide reasoning and authorized execution. | must | — |
| CLA-204 | native-speckit | §1 | Execution environments must provide isolated repository/runtime/tool access. | must | — |
| CLA-205 | native-speckit | §1 | No individual AI provider, coding agent, IDE, or Spec-Kit implementation may become inseparable from the PMI Studio application layer. | must | — |
| CLA-206 | native-speckit | §2 | The existing dependency rule remains mandatory: application to engine-contract permitted, application to concrete engine adapter forbidden, worker to engine-contract permitted, worker composition root to engine adapters permitted, adapter to application/backend forbidden. | must | — |
| CLA-207 | native-speckit | §2 | Extend the engine-independence principle to AI agents. | must | — |
| CLA-208 | native-speckit | §2 | Introduce an AI Agent Contract / Agent Gateway. | must | CLA-037 ; CLA-095 ; CLA-200 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 ; CLA-252 |
| CLA-209 | native-speckit | §2 | PMI Studio workflows MUST NOT contain provider-specific implementation logic such as invoke Claude, run Cursor, or execute Codex. | must | CLA-069 ; CLA-097 ; CLA-495 ; CLA-584 |
| CLA-210 | native-speckit | §2 | Workflows must request capabilities through an agent abstraction. | must | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-211 ; CLA-237 ; CLA-244 ; CLA-252 |
| CLA-211 | native-speckit | §2 | Conceptual model: AI Agent Gateway fronting a Claude Adapter, Cursor Adapter, Codex Adapter, Fixture/Test Adapter and future agent adapters. | shall | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-237 ; CLA-244 ; CLA-252 |
| CLA-212 | native-speckit | §2 | An AgentExecutionRequest should carry project_id, workspace_id, epic_id, task_id, role, requested_capabilities, context_scope, permissions, execution_policy, timeout, resource_limits and model/provider preference. | should | — |
| CLA-213 | native-speckit | §2 | The orchestrator selects an appropriate registered agent. | shall | — |
| CLA-214 | native-speckit | §3 | Do NOT merge SpecificationEngine and AgentExecutor. They represent different abstractions. | must | — |
| CLA-215 | native-speckit | §3 | SpecificationEngine answers how PMI Studio performs specification-driven engineering. | narrative | — |
| CLA-216 | native-speckit | §3 | AgentExecutor answers which AI execution capability performs the reasoning/work. | narrative | — |
| CLA-217 | native-speckit | §3 | The design must allow future configurations such as NativePMIEngine with Claude, SpecKitEngine with Cursor, SpecKitEngine with Codex, and NativePMIEngine with an enterprise internal agent, without redesigning application services. | must | — |
| CLA-218 | native-speckit | §4 | Plan an evolution where PMI Studio maintains a logical Project Execution Environment containing the project's engineering state. | shall | CLA-200 ; CLA-222 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 ; CLA-535 |
| CLA-219 | native-speckit | §4 | The conceptual project structure contains .git, .specify, specs, docs, src, tests, agent configuration, project configuration and runtime/toolchain configuration. | narrative | — |
| CLA-220 | native-speckit | §4 | The exact physical implementation may use persistent storage plus ephemeral compute. | may | — |
| CLA-221 | native-speckit | §4 | Do NOT assume that every project requires one permanently running VM. | must | — |
| CLA-222 | native-speckit | §4 | Define a ProjectExecutionEnvironment abstraction capable of supporting persistent VM, persistent development container, ephemeral container, Kubernetes workload, cloud development environment and future execution providers. | must | CLA-200 ; CLA-218 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 ; CLA-535 |
| CLA-223 | native-speckit | §4 | PMI Studio business logic must not depend directly on Docker. | must | — |
| CLA-224 | native-speckit | §4 | Docker remains the Phase 1 execution provider unless another existing decision explicitly changes it. | shall | CLA-200 ; CLA-218 ; CLA-222 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 ; CLA-535 |
| CLA-225 | native-speckit | §5 | Explicitly separate Persistent Project State from Ephemeral Agent Sandbox. | must | CLA-200 ; CLA-218 ; CLA-222 ; CLA-224 ; CLA-237 ; CLA-346 ; CLA-361 ; CLA-535 |
| CLA-226 | native-speckit | §5 | Persistent Project State contains the Git repository, approved specifications, plans, tasks, project configuration, Spec-Kit configuration, agent instructions, test configuration, build configuration and required development artifacts. | narrative | — |
| CLA-227 | native-speckit | §5 | The typical sandbox lifecycle is: task authorized, create isolated sandbox, checkout authorized repository/branch, mount or copy authorized project context, initialize required Spec-Kit/agent environment, execute agent, run tests/build/validation, capture structured result, commit/push/create PR when policy permits, collect evidence, destroy sandbox. | shall | — |
| CLA-228 | native-speckit | §5 | No sandbox state may implicitly become authoritative project state. | must | — |
| CLA-229 | native-speckit | §5 | All authoritative changes must pass through governed persistence and repository mechanisms. | must | — |
| CLA-230 | native-speckit | §6 | Plan how existing Spec-Kit operations become PMI Studio services/workflows rather than user-entered slash commands. | shall | — |
| CLA-231 | native-speckit | §6 | Map speckit.constitution to PMI governance / project constitution, speckit.specify to the specification workflow, speckit.clarify to the requirement/specification clarification workflow, speckit.plan to the architecture and planning workflow, speckit.tasks to the task generation workflow, and speckit.implement to the governed implementation workflow. | shall | CLA-108 ; CLA-126 ; CLA-152 ; CLA-196 ; CLA-232 ; CLA-345 |
| CLA-232 | native-speckit | §6 | Users must not be required to know Spec-Kit commands. | must | CLA-108 ; CLA-126 ; CLA-152 ; CLA-196 ; CLA-231 ; CLA-345 |
| CLA-233 | native-speckit | §6 | PMI Studio orchestrates Spec-Kit through services and engine adapters. | shall | — |
| CLA-234 | native-speckit | §6 | Preserve generated artifacts where required for Spec-Kit compatibility, but PMI Studio database entities remain the governance and traceability authority. | shall | — |
| CLA-235 | native-speckit | §6 | Define clearly which source is authoritative for Requirement, Requirement baseline, Specification, Specification version, Plan, Task, Decision, Change Request, Defect, Test evidence and Implementation evidence. | must | — |
| CLA-236 | native-speckit | §6 | Avoid two uncontrolled sources of truth between PostgreSQL and repository Markdown. | must | — |
| CLA-237 | native-speckit | §7 | Design an Agent Gateway supporting multiple AI execution providers. | must | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-218 ; CLA-222 |
| CLA-238 | native-speckit | §7 | The minimum conceptual interface should consider executeTask, analyze, generate, review, test, cancel, getCapabilities and healthCheck. | should | — |
| CLA-239 | native-speckit | §7 | Do not prematurely finalize method names if research indicates a better contract. | must | — |
| CLA-240 | native-speckit | §7 | Agent descriptors should identify provider, model, execution type, supported capabilities, context limits, tool capabilities, MCP support, repository capabilities, cost metadata, security classification and interactive/unattended support. | should | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-246 ; CLA-256 ; CLA-257 ; CLA-258 |
| CLA-241 | native-speckit | §7 | Every AI execution must record provider, model, agent version where available, execution ID, project, triggering artifact, correlation ID, start/end timestamps, status, token/cost metadata when available, evidence, resulting artifacts and policy decisions. | must | — |
| CLA-242 | native-speckit | §7 | Never log prompts or output containing sensitive project information through unrestricted operational logs. | must | — |
| CLA-243 | native-speckit | §7 | Follow existing PC-3 telemetry constraints. | must | — |
| CLA-244 | native-speckit | §8 | Research and plan Claude as the initial reference AI Agent Adapter. | shall | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-252 |
| CLA-245 | native-speckit | §8 | Do NOT automate Claude Desktop UI. | must | — |
| CLA-246 | native-speckit | §8 | Evaluate supported server-side mechanisms such as Claude Code headless/non-interactive execution, Claude Agent SDK, CLI execution inside isolated environments, MCP, hooks and subagents. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-256 ; CLA-257 ; CLA-258 |
| CLA-247 | native-speckit | §8 | Claude Desktop may remain an optional developer interface but must not be required for PMI Studio operation. | must | — |
| CLA-248 | native-speckit | §8 | Provider authentication must be abstracted. | must | — |
| CLA-249 | native-speckit | §8 | Do not architect the SaaS backend around a developer's personal desktop login/session. | must | — |
| CLA-250 | native-speckit | §8 | Support future organization-managed credentials, BYOK, provider API credentials, cloud-provider-hosted models and enterprise AI gateways. | shall | — |
| CLA-251 | native-speckit | §8 | Credentials must remain outside application-visible project content. | must | — |
| CLA-252 | native-speckit | §9 | Research Cursor's supported remote/cloud/CLI/agent integration mechanisms and define how a Cursor adapter could implement the same Agent Contract. | shall | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 |
| CLA-253 | native-speckit | §9 | Cursor Desktop must not become required infrastructure. | must | — |
| CLA-254 | native-speckit | §9 | The architecture must support developers optionally using their preferred IDE while PMI Studio retains server-side governance. | must | — |
| CLA-255 | native-speckit | §9 | Repository policies, CI/CD gates, PMI Studio governance and traceability remain authoritative regardless of IDE. | shall | — |
| CLA-256 | native-speckit | §10 | Plan a future-compatible PMI Studio MCP surface. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-257 ; CLA-258 |
| CLA-257 | native-speckit | §10 | The MCP surface must respect existing PC-1: transport to service permitted, service to transport forbidden. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-258 |
| CLA-258 | native-speckit | §10 | MCP is another transport over existing application capabilities, not another implementation of business logic. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-259 | native-speckit | §10 | Candidate MCP capabilities include getProject, getEpic, getRequirement, getRequirementBaseline, getSpecification, getArchitecture, getPlan, getTask, getDecision, getChangeRequest, getDefect, getTraceability, getAllowedContext, submitImplementationResult, submitTestEvidence, reportDefect, proposeChangeRequest, requestDecision and updateAuthorizedTaskState. | may | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-260 | native-speckit | §10 | Exact MCP tools and resources must be specified during design. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-261 | native-speckit | §10 | Apply least privilege to the MCP surface. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-262 | native-speckit | §10 | An implementation agent working TASK-123 must not automatically receive unrestricted access to the entire organization or project. | must | — |
| CLA-263 | native-speckit | §11 | Introduce explicit Context Scope. | must | CLA-127 ; CLA-130 ; CLA-179 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-509 ; CLA-523 |
| CLA-264 | native-speckit | §11 | Every agent run must receive only the context required for its assigned work. | must | — |
| CLA-265 | native-speckit | §11 | An agent may receive the task, parent feature, parent Epic, applicable requirements, acceptance criteria, applicable specification sections, applicable architecture decisions, coding standards, relevant source files, relevant tests and Definition of Done. | may | — |
| CLA-266 | native-speckit | §11 | An agent should NOT automatically receive unrelated requirements, unrelated projects, organization secrets, production credentials, unrestricted database access or unrelated source modules. | should | — |
| CLA-267 | native-speckit | §11 | Plan ContextScope and AccessSnapshot models compatible with the existing generation_jobs access_snapshot concept. | shall | — |
| CLA-268 | native-speckit | §12 | AI agents MUST NOT autonomously change authoritative business intent. | must | — |
| CLA-269 | native-speckit | §12 | Prohibit direct AI authorization of requirement approval, requirement baseline changes, material specification baseline changes, change request approval, high-impact architecture decisions, production deployment when human approval is required, security policy modification and bypassing required tests or reviews. | must | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-372 ; CLA-396 ; CLA-411 |
| CLA-270 | native-speckit | §12 | Agents may analyze, propose, generate options, identify risks, provide reasoning, implement authorized work, generate tests, run tests, report defects, propose change requests and submit evidence. | may | — |
| CLA-271 | native-speckit | §12 | PMI Studio controls state transitions. | shall | — |
| CLA-272 | native-speckit | §13 | Before specification: Requirement Capture, AI Analysis, Clarification Questions, Options, Risks, Trade-off Analysis, Stakeholder Decision, Approval, Requirement Baseline, Specification Engine. | shall | — |
| CLA-273 | native-speckit | §13 | Spec-Kit specification generation must consume approved/baselined requirements rather than uncontrolled stakeholder text where governance requires approval. | must | — |
| CLA-274 | native-speckit | §14 | After baseline, material changes to approved behavior must enter the Change Request workflow. | must | — |
| CLA-275 | native-speckit | §14 | The Change Request workflow runs: Change Request, AI Impact Analysis, affected Requirements, affected Specifications, affected Architecture, affected Tasks, affected Code, affected Tests, cost/schedule/security/risk analysis, options, trade-offs, recommendation, authorized decision, re-baseline, implementation. | shall | — |
| CLA-276 | native-speckit | §14 | AI coding agents must not silently reinterpret requirements during implementation. | must | — |
| CLA-277 | native-speckit | §14 | When an implementation requires behavior inconsistent with the approved baseline, execution should stop or raise a governed change proposal according to policy. | should | — |
| CLA-278 | native-speckit | §15 | Every Epic must support a Defect Room. | must | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-283 ; CLA-361 ; CLA-443 ; CLA-445 |
| CLA-279 | native-speckit | §15 | Defects may originate from automated tests, CI/CD, unit tests, integration tests, E2E/Playwright, smoke tests, security tests, monitoring, AI agents, QA, developers, stakeholders and UAT/manual testing. | may | — |
| CLA-280 | native-speckit | §15 | Each defect must be linked to its Epic and, when determinable, to Requirement, Acceptance Criteria, Specification, Task, Code, Test, Build and Deployment. | must | — |
| CLA-281 | native-speckit | §15 | AI triage must determine whether the report represents a Confirmed Defect, Change Request, Requirement Gap, Duplicate, Cannot Reproduce, Environmental/Configuration issue or Invalid report. | must | — |
| CLA-282 | native-speckit | §16 | For a probable defect: Defect Report, AI Triage, identify approved expected behavior, reproduce, generate or identify test, execute initial test. | shall | — |
| CLA-283 | native-speckit | §16 | If the initial test FAILS and confirms violation of approved expected behavior: Confirmed Defect, add to TDD Remediation Queue, RED test captured, authorize implementation, agent implements minimal correction, run target test, GREEN, run related regression suite, verify against requirement/acceptance criteria, capture evidence, complete defect. | shall | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-361 ; CLA-443 ; CLA-445 |
| CLA-284 | native-speckit | §16 | Never permit an AI agent to mark a defect complete merely because code was changed. | must | — |
| CLA-285 | native-speckit | §16 | Test and verification evidence are required before a defect is complete. | must | — |
| CLA-286 | native-speckit | §17 | Do NOT blindly classify every passing reproduction test as a Change Request. | must | — |
| CLA-287 | native-speckit | §17 | When the initial test passes, possible outcomes are: incorrect or incomplete reproduction test requiring refinement; intermittent, environment, data or concurrency issue requiring investigation; existing implementation conforms to approved baseline but the reporter expects different behavior, reclassified to Change Request; or no approved behavior exists, routed to Requirement Gap / Requirement Room. | shall | CLA-003 ; CLA-125 ; CLA-181 ; CLA-361 ; CLA-371 ; CLA-373 ; CLA-375 ; CLA-436 |
| CLA-288 | native-speckit | §17 | Preserve original defect identity and history; a defect reclassified to a change request is not deleted. | must | — |
| CLA-289 | native-speckit | §18 | Plan controlled repository interaction. | shall | — |
| CLA-290 | native-speckit | §18 | Agent jobs should normally operate on an isolated branch or worktree. | should | — |
| CLA-291 | native-speckit | §18 | The agent must not push directly to protected branches. | must | — |
| CLA-292 | native-speckit | §18 | Integrate with existing or planned CI/CD governance rather than duplicating CI/CD inside the agent. | must | — |
| CLA-293 | native-speckit | §18 | Capture traceability across Requirement, Specification, Plan, Task, Agent Run, Commit, PR, Build, Test, Deployment and Verification. | must | — |
| CLA-294 | native-speckit | §19 | Preserve and extend existing sandbox assumptions. | must | — |
| CLA-295 | native-speckit | §19 | AI execution is untrusted execution. | shall | — |
| CLA-296 | native-speckit | §19 | Required sandbox controls include isolated environment per execution, non-root execution, read-only base filesystem where practical, explicit writable workspace, CPU limit, memory limit, wall-clock limit, process limit where appropriate, controlled network egress, no database credentials, no PMI Studio service credentials, scoped AI credentials, scoped repository credentials, scoped MCP authorization, cleanup after execution, secret redaction and auditable tool use where technically possible. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-113 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 |
| CLA-297 | native-speckit | §19 | Re-evaluate the existing AI provider endpoint only egress policy because future implementation agents may require controlled access to approved MCP servers, package registries, repository endpoints and documentation services. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-113 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 |
| CLA-298 | native-speckit | §19 | Do NOT simply open general internet access. | must | — |
| CLA-299 | native-speckit | §19 | Design an explicit EgressPolicy abstraction and allow-list mechanism. | must | — |
| CLA-300 | native-speckit | §20 | The current BullMQ worker/job architecture should remain the asynchronous execution foundation unless research demonstrates a material limitation. | should | — |
| CLA-301 | native-speckit | §20 | Plan whether to evolve GenerationJob into a more general ExecutionJob or AgentRun while preserving backwards compatibility and clear domain semantics. | shall | — |
| CLA-302 | native-speckit | §20 | Required states should consider queued, provisioning, running, waiting_for_input, waiting_for_approval, validating, succeeded, failed, cancelled and timed_out. | should | — |
| CLA-303 | native-speckit | §20 | Do not add states without defining transition ownership and recovery semantics. | must | — |
| CLA-304 | native-speckit | §20 | Jobs must remain cancellable, timeout-controlled, restart-safe where feasible, idempotent where required, observable and correlated end-to-end. | must | — |
| CLA-305 | native-speckit | §21 | Design two execution modes: Autonomous Agent Run and Interactive Engineering Workspace. | must | — |
| CLA-306 | native-speckit | §21 | PMI Studio initiates controlled autonomous execution for specification generation, architecture generation, planning, task generation, implementation, testing, defect analysis and review. | shall | — |
| CLA-307 | native-speckit | §21 | An authorized developer connects to a project environment using an approved tool for interactive work. | shall | — |
| CLA-308 | native-speckit | §21 | Interactive work must still respect repository permissions, branch protection, governance gates, Change Request policy, traceability, CI/CD and audit. | must | — |
| CLA-309 | native-speckit | §21 | Interactive IDE choice must not determine PMI Studio architecture. | must | — |
| CLA-310 | native-speckit | §22 | Define explicit authority boundaries between PostgreSQL, Git, Spec-Kit files, AI conversation and the agent workspace. | must | — |
| CLA-311 | native-speckit | §22 | PostgreSQL / PMI Studio is authoritative for governance state. | shall | — |
| CLA-312 | native-speckit | §22 | Git is authoritative for implementation history and engineering artifact version history where applicable. | shall | — |
| CLA-313 | native-speckit | §22 | Spec-Kit files are engine-compatible representations of approved or generated specification state. | shall | — |
| CLA-314 | native-speckit | §22 | AI conversation and context are NOT authoritative. | must | — |
| CLA-315 | native-speckit | §22 | The agent workspace is NOT authoritative. | must | — |
| CLA-316 | native-speckit | §22 | Generated output becomes authoritative only through the appropriate PMI Studio lifecycle transition or Git repository governance process. | shall | — |
| CLA-317 | native-speckit | §22 | Identify synchronization and conflict-resolution rules between the authoritative sources. | must | — |
| CLA-318 | native-speckit | §23 | Extend the current traceability model to support Business Goal, Requirement, Requirement Version, Decision, Specification, Specification Version, Architecture Decision, Plan, Epic, Feature, Task, Agent Run, Defect, Change Request, Test, Commit, Pull Request, Build, Deployment and Verification. | must | — |
| CLA-319 | native-speckit | §23 | Do not assume all traceability relationships are strictly hierarchical. | must | — |
| CLA-320 | native-speckit | §23 | Model traceability as typed relationships capable of traversal in both directions. | must | — |
| CLA-321 | native-speckit | §24 | Preserve PC-3. | must | — |
| CLA-322 | native-speckit | §24 | One correlation ID must follow API, workflow, queue, worker, AgentRun, sandbox and repository/CI interaction where supported. | must | — |
| CLA-323 | native-speckit | §24 | Continue to provide structured logging, metrics, tracing and immutable audit. | shall | — |
| CLA-324 | native-speckit | §24 | Do not log customer requirement bodies unnecessarily, model output unnecessarily, credentials, secrets or source code unnecessarily. | must | — |
| CLA-325 | native-speckit | §24 | Differentiate operational telemetry from governance audit evidence. | must | — |
| CLA-326 | native-speckit | §25 | Plan explicitly for agent provider unavailable, model timeout, container provisioning failure, malformed AI output, tool execution failure, MCP unavailable, repository unavailable, test failure, partial implementation, agent crash, worker crash, duplicate job delivery, cancellation during execution, approval timeout, stale project baseline and conflicting concurrent changes. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-327 | native-speckit | §25 | A failed AI execution must not corrupt authoritative project state. | must | — |
| CLA-328 | native-speckit | §25 | Where possible, use transactional state transitions and immutable execution evidence. | should | — |
| CLA-329 | native-speckit | §26 | Before finalizing the plan, research and document R-AI-001, the current supported server-side Claude Code / Agent SDK execution model. | must | — |
| CLA-330 | native-speckit | §26 | Research R-AI-002, Claude Code headless and container execution. | must | — |
| CLA-331 | native-speckit | §26 | Research R-AI-003, Claude MCP integration and authorization. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-332 | native-speckit | §26 | Research R-AI-004, Claude hooks and subagent applicability to PMI governance. | must | — |
| CLA-333 | native-speckit | §26 | Research R-AI-005, Cursor remote, cloud, CLI and agent integration capabilities. | must | — |
| CLA-334 | native-speckit | §26 | Research R-AI-006, Spec-Kit behavior when used inside persistent versus disposable repositories. | must | — |
| CLA-335 | native-speckit | §26 | Research R-AI-007, the best mechanism for preserving Spec-Kit project state between agent runs. | must | — |
| CLA-336 | native-speckit | §26 | Research R-AI-008, provider-neutral agent contract design. | must | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 |
| CLA-337 | native-speckit | §26 | Research R-AI-009, sandbox network and credential isolation for coding agents requiring package, repository or MCP access. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-338 | native-speckit | §26 | Research R-AI-010, persistent workspace versus ephemeral worktree or container trade-offs. | must | — |
| CLA-339 | native-speckit | §26 | Research R-AI-011, secure Git credential delegation to ephemeral agents. | must | — |
| CLA-340 | native-speckit | §26 | Research R-AI-012, agent cancellation and timeout semantics. | must | — |
| CLA-341 | native-speckit | §26 | Research R-AI-013, model, context and cost metadata availability across providers. | must | — |
| CLA-342 | native-speckit | §26 | Research R-AI-014, MCP least-privilege authorization model. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-343 | native-speckit | §26 | Do not make unsupported assumptions where research is required. | must | — |
| CLA-344 | native-speckit | §27 | Create or update an ADR covering the AI Agent Gateway and provider independence. | must | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 |
| CLA-345 | native-speckit | §27 | Create or update an ADR covering Spec-Kit as an embedded engine rather than an application dependency. | must | CLA-108 ; CLA-126 ; CLA-152 ; CLA-196 ; CLA-231 ; CLA-232 ; CLA-344 ; CLA-346 |
| CLA-346 | native-speckit | §27 | Create or update an ADR covering the Project Execution Environment abstraction. | must | CLA-200 ; CLA-218 ; CLA-222 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-344 ; CLA-345 |
| CLA-347 | native-speckit | §27 | Create or update an ADR covering persistent project state versus ephemeral agent execution. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-348 ; CLA-349 ; CLA-350 ; CLA-351 ; CLA-352 |
| CLA-348 | native-speckit | §27 | Create or update an ADR covering PMI Studio MCP architecture. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-349 | native-speckit | §27 | Create or update an ADR covering agent context authorization. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-350 ; CLA-351 ; CLA-352 |
| CLA-350 | native-speckit | §27 | Create or update an ADR covering agent credential isolation. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-349 ; CLA-351 ; CLA-352 |
| CLA-351 | native-speckit | §27 | Create or update an ADR covering controlled network egress. | must | CLA-113 ; CLA-296 ; CLA-297 ; CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 |
| CLA-352 | native-speckit | §27 | Create or update an ADR covering source-of-truth boundaries between PostgreSQL, Git, Spec-Kit and the agent workspace. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-349 ; CLA-350 ; CLA-351 |
| CLA-353 | native-speckit | §27 | Create or update an ADR covering Requirement, Change and Defect governance authority. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-349 ; CLA-350 ; CLA-351 |
| CLA-354 | native-speckit | §27 | Create or update an ADR covering TDD defect execution policy. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-349 ; CLA-350 ; CLA-351 |
| CLA-355 | native-speckit | §27 | Create or update an ADR covering interactive developer workspace versus autonomous agent sandbox. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-349 ; CLA-350 ; CLA-351 |
| CLA-356 | native-speckit | §27 | Preserve existing ADRs unless explicitly superseded with documented reasoning. | must | — |
| CLA-357 | native-speckit | §28 | This plan MUST NOT invalidate already implemented EPIC-001 functionality without explicit justification. | must | — |
| CLA-358 | native-speckit | §28 | Prefer additive evolution. | should | CLA-002 ; CLA-191 ; CLA-587 ; CLA-598 |
| CLA-359 | native-speckit | §28 | Preserve the React presentation layer, NestJS service architecture, TypeScript/Node platform, PostgreSQL, Prisma, BullMQ, Redis/Valkey abstraction, SpecificationEngine contract, engine adapters, fixture adapter, worker composition root, Docker isolation, asynchronous generation, workspace identity, append-only audit and version history, existing traceability, architecture dependency tests and OpenTelemetry design. | must | — |
| CLA-360 | native-speckit | §28 | Any proposed change to a preserved element requires a reason, the affected existing requirement or decision, migration impact, compatibility impact and the alternative considered. | must | — |
| CLA-361 | native-speckit | §29 | Produce an implementation-grade technical plan covering updated architecture, component boundaries, the Agent Gateway contract, the ProjectExecutionEnvironment contract, Spec-Kit native integration design, Claude reference adapter design, Cursor adapter strategy, MCP architecture, context authorization model, credential and security architecture, persistent versus ephemeral workspace lifecycle, Requirement Room integration, Change Request Room integration, Defect Room and TDD integration, Git/PR/CI-CD workflow, extended traceability model, execution job state machine, data-model changes, API and service changes, worker changes, sandbox changes, observability changes, failure and recovery model, required migrations, required ADRs, architecture and dependency tests, integration/E2E/security tests, phased implementation sequence, backward-compatibility strategy, RAID additions and unresolved decisions requiring stakeholder approval. | must | CLA-003 ; CLA-012 ; CLA-037 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-076 |
| CLA-362 | native-speckit | §29 | Explicitly identify what belongs in the current Epic, what requires a new Epic, what should be architectural preparation only, and what should remain deferred. | must | — |
| CLA-363 | native-speckit | §29 | Do NOT immediately expand all future capabilities into implementation scope merely because the architecture must accommodate them. | must | — |
| CLA-364 | native-speckit | §30 | The resulting design must preserve the invariant that PMI Studio owns governance. | must | — |
| CLA-365 | native-speckit | §30 | Spec-Kit owns specification-driven engineering mechanics. | must | — |
| CLA-366 | native-speckit | §30 | AI agents perform authorized reasoning and execution. | must | — |
| CLA-367 | native-speckit | §30 | Git owns implementation history. | must | — |
| CLA-368 | native-speckit | §30 | Execution environments are isolated and replaceable. | must | — |
| CLA-369 | native-speckit | §30 | No AI provider, IDE, Spec-Kit implementation detail, or sandbox provider may become the architectural authority for PMI Studio. | must | — |
| CLA-370 | native-speckit | §30 | The platform must remain functional and evolvable if Claude, Cursor, Spec-Kit, the AI model, or the underlying execution substrate is replaced. | must | — |
| CLA-371 | lifecycle | §0 | Recommended lifecycle: Requirement Gathering, Requirement Intelligence, Decision, Approved Requirement Baseline, Specification, Planning, Implementation, Change Request, Impact Intelligence, Decision, Re-baseline, Implementation, Verification, Release. | should | CLA-003 ; CLA-125 ; CLA-181 ; CLA-287 ; CLA-361 ; CLA-373 ; CLA-375 ; CLA-436 |
| CLA-372 | lifecycle | §0 | The important architectural principle is that AI analyzes, questions, recommends and explains, while authorized stakeholders approve consequential requirements and changes. | shall | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-396 ; CLA-411 |
| CLA-373 | lifecycle | §1 | Add a dedicated Requirement Management System before SpecKit or specification generation. | should | CLA-003 ; CLA-125 ; CLA-181 ; CLA-287 ; CLA-361 ; CLA-371 ; CLA-375 ; CLA-436 |
| CLA-374 | lifecycle | §1 | Stakeholders should not need to understand SpecKit, Git, Markdown, Jira or the repository. | should | — |
| CLA-375 | lifecycle | §1 | Give stakeholders a Requirement Workspace where they can submit requirements through forms, conversational AI, uploaded documents, meeting notes or transcripts, existing specifications, or API import. | should | CLA-003 ; CLA-125 ; CLA-181 ; CLA-287 ; CLA-361 ; CLA-371 ; CLA-373 ; CLA-436 |
| CLA-376 | lifecycle | §1 | For every incoming requirement, PMI Studio creates a governed Requirement Record. | should | — |
| CLA-377 | lifecycle | §1 | The AI Requirement Analyst detects ambiguity, missing information and contradictions. | should | — |
| CLA-378 | lifecycle | §1 | The AI Requirement Analyst finds duplicate and overlapping requirements. | should | — |
| CLA-379 | lifecycle | §1 | The AI Requirement Analyst identifies affected business capabilities. | should | — |
| CLA-380 | lifecycle | §1 | The AI Requirement Analyst generates clarification questions. | should | — |
| CLA-381 | lifecycle | §1 | The AI Requirement Analyst generates possible implementation and business options. | should | — |
| CLA-382 | lifecycle | §1 | The AI Requirement Analyst identifies assumptions and constraints. | should | — |
| CLA-383 | lifecycle | §1 | The AI Requirement Analyst identifies security, privacy and compliance concerns. | should | — |
| CLA-384 | lifecycle | §1 | The AI Requirement Analyst identifies dependencies. | should | — |
| CLA-385 | lifecycle | §1 | The AI Requirement Analyst estimates complexity and uncertainty. | should | — |
| CLA-386 | lifecycle | §1 | The AI Requirement Analyst generates acceptance criteria candidates. | should | — |
| CLA-387 | lifecycle | §1 | The AI Requirement Analyst establishes traceability to business objectives. | should | — |
| CLA-388 | lifecycle | §1 | The AI Requirement Analyst recommends priority using MoSCoW, WSJF or value-risk approaches. | should | — |
| CLA-389 | lifecycle | §1 | The AI Requirement Analyst records the AI reasoning and evidence behind recommendations. | should | — |
| CLA-390 | lifecycle | §1 | PMI Studio should not immediately convert a stakeholder sentence into a specification. | should | — |
| CLA-391 | lifecycle | §1 | Only after stakeholder decisions are recorded does the requirement become Ready for Specification. | should | — |
| CLA-392 | lifecycle | §2 | Do not treat requirements as editable text documents; treat them as governed entities. | should | — |
| CLA-393 | lifecycle | §2 | A useful requirement state model is Captured, AI Analyzed, Clarification Required, Stakeholder Review, Approved, Baseline, Specified, Planned, Implementing, Verified, Released. | should | — |
| CLA-394 | lifecycle | §2 | Alternative terminal and exception requirement states are Rejected, Deferred, Superseded and Withdrawn. | should | — |
| CLA-395 | lifecycle | §2 | Every requirement state transition should have permissions and evidence requirements. | should | — |
| CLA-396 | lifecycle | §2 | AI may move a requirement from Captured to AI Analyzed but should not autonomously move Stakeholder Review to Approved for material requirements; that requires an authorized human decision. | should | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-411 |
| CLA-397 | lifecycle | §3 | Create a Requirement Decision Room presenting stakeholders with decisions requiring attention rather than hundred-page specifications. | should | CLA-412 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-437 ; CLA-439 ; CLA-444 ; CLA-488 |
| CLA-398 | lifecycle | §3 | A decision record should name the requirement, the decision owner, the AI confidence, the options with cost, delivery, security and scalability, the AI recommendation and its reasoning, and the risks of the recommended option. | should | — |
| CLA-399 | lifecycle | §3 | Stakeholder actions on a decision include approve, select an alternative option, request another option, ask AI, defer and escalate. | should | — |
| CLA-400 | lifecycle | §3 | Every stakeholder action becomes part of the decision history. | should | — |
| CLA-401 | lifecycle | §4 | Once approved, PMI Studio creates a Requirement Baseline containing Business Objective, Capability, Requirement, Decision, Constraint and Acceptance Criteria. | should | — |
| CLA-402 | lifecycle | §4 | Only after baselining should the Specification Engine generate Requirement, Feature, Specification, Architecture, Plan and Task. | should | — |
| CLA-403 | lifecycle | §4 | The chain becomes Why, What, Decision, How, Work, rather than allowing AI to jump directly from an informal request to implementation. | should | — |
| CLA-404 | lifecycle | §5 | Once a requirement or specification has been baselined, stakeholders should not directly edit it. | should | — |
| CLA-405 | lifecycle | §5 | Any proposed modification to a baselined requirement becomes a Change Request. | should | — |
| CLA-406 | lifecycle | §5 | A Change Request can originate from stakeholders, developers, QA, architecture review, security review, production incidents, AI agents, regulatory changes or defect analysis. | may | — |
| CLA-407 | lifecycle | §5 | Proposing a change is different from approving one. | shall | — |
| CLA-408 | lifecycle | §6 | When a Change Request arrives, the AI Change Intelligence Engine traverses the traceability graph from CR through Requirement, Decision, Specification, Architecture, API, Data Model, Task, Code, Tests, CI/CD and Deployment. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-152 ; CLA-179 ; CLA-182 ; CLA-361 |
| CLA-409 | lifecycle | §6 | The Change Intelligence Engine should automatically identify affected requirements, specifications, architecture, APIs, database changes, tasks, code components, regression tests, security impact, schedule impact, cost and release impact. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-361 ; CLA-408 |
| CLA-410 | lifecycle | §6 | AI generates options for each Change Request, with the trade-offs of each. | should | — |
| CLA-411 | lifecycle | §6 | AI recommends; the authorized stakeholder decides. | shall | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 |
| CLA-412 | lifecycle | §7 | Add a Change Decision Room using essentially the same experience as the Requirement Decision Room, giving one unified stakeholder Decision Center. | should | CLA-397 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-437 ; CLA-439 ; CLA-444 ; CLA-488 |
| CLA-413 | lifecycle | §7 | Stakeholders should not need to navigate the engineering workspace to make decisions. | should | — |
| CLA-414 | lifecycle | §7 | Each decision card explains what changed, why the decision is necessary, what happens if nothing is done, the options, the cost, schedule, scope and security impact, the AI recommendation and its reasoning, and who else needs to approve. | should | — |
| CLA-415 | lifecycle | §8 | Avoid storing only an AI-generated recommendation; store a Decision Evidence Package. | should | CLA-135 ; CLA-138 ; CLA-397 ; CLA-412 ; CLA-416 ; CLA-417 ; CLA-437 ; CLA-439 |
| CLA-416 | lifecycle | §8 | A Decision Evidence Package contains the question, context, affected requirements, available options, assumptions, evidence, constraints, risk analysis, trade-off analysis, AI recommendation, confidence, model and version, stakeholder comments, final decision, decision maker, timestamp and superseded decisions. | should | CLA-135 ; CLA-138 ; CLA-397 ; CLA-412 ; CLA-415 ; CLA-417 ; CLA-437 ; CLA-439 |
| CLA-417 | lifecycle | §8 | The Decision Evidence Package creates institutional memory, so PMI Studio can answer later why a capability was not implemented, from actual project evidence. | should | CLA-135 ; CLA-138 ; CLA-397 ; CLA-412 ; CLA-415 ; CLA-416 ; CLA-437 ; CLA-439 |
| CLA-418 | lifecycle | §9 | Build security into this architecture rather than bolting it on, because AI touches requirements, source code, architecture and potentially commercially sensitive information. | should | — |
| CLA-419 | lifecycle | §9 | Use RBAC plus ABAC with roles such as Viewer, Stakeholder, Requirement Analyst, Product Owner, Project Manager, Architect, Security Reviewer, Engineer, QA, Change Approver, Administrator and AI Agent. | should | — |
| CLA-420 | lifecycle | §9 | Define permissions at Organization, Workspace, Project, Requirement, Specification, Change and Decision levels. | should | — |
| CLA-421 | lifecycle | §9 | Sensitive requirements could additionally be compartmentalized. | may | — |
| CLA-422 | lifecycle | §9 | AI agents should receive least-privilege context, not unrestricted access to the entire project. | should | CLA-127 ; CLA-130 ; CLA-179 ; CLA-263 ; CLA-504 ; CLA-508 ; CLA-509 ; CLA-523 |
| CLA-423 | lifecycle | §9 | Maintain immutable audit events for created, edited, AI analyzed, approved, rejected, baseline changed, change requested, impact calculated, decision made, spec regenerated, code affected and deployed. | should | — |
| CLA-424 | lifecycle | §10 | An AI coding agent should never silently modify the intended behavior because implementation became difficult. | shall | — |
| CLA-425 | lifecycle | §10 | During implementation, a Spec Conformance Check determines whether the implementation alters expected behavior; if it does, a proposed Change Request is created and routed through impact analysis to a human decision. | should | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 |
| CLA-426 | lifecycle | §10 | No material requirement change without an explicit Change Request could become a fundamental PMI Studio governance rule. | should | — |
| CLA-427 | lifecycle | §11 | Use a unified Project Knowledge Graph underneath both systems rather than independent requirement and change databases. | should | CLA-152 ; CLA-179 ; CLA-408 ; CLA-428 ; CLA-434 ; CLA-444 ; CLA-453 ; CLA-483 |
| CLA-428 | lifecycle | §11 | The knowledge graph links Business Goal, Requirement, Decision, Acceptance Criteria, Specification, Architecture, Plan, Epic, Feature, Task, Code, Test, Build, Deploy and Verification, with Change Request impacting requirement, decision, specification, architecture, task, code and test. | should | CLA-152 ; CLA-179 ; CLA-408 ; CLA-427 ; CLA-434 ; CLA-444 ; CLA-453 ; CLA-483 |
| CLA-429 | lifecycle | §11 | The graph is what enables meaningful AI impact analysis. | narrative | — |
| CLA-430 | lifecycle | §12 | Every Change Request could receive an AI Change Risk Score. | should | — |
| CLA-431 | lifecycle | §12 | The risk score is calculated from scope impact, architecture impact, security impact, data impact, API compatibility, dependency impact, test coverage, schedule impact, production blast radius, requirement uncertainty and AI confidence. | should | — |
| CLA-432 | lifecycle | §12 | Approval requirements can be policy-driven by risk band, so governance becomes risk-adaptive rather than bureaucratic. | should | — |
| CLA-433 | lifecycle | §13 | Give stakeholders an AI project interface able to answer questions such as what requirements are waiting for me, why is a release delayed, what changed since I approved the scope, and what happens if we approve a given change request. | should | — |
| CLA-434 | lifecycle | §13 | The AI should answer using the governed project graph and provide links back to the actual Requirement, Decision, Change Request and evidence. | should | CLA-152 ; CLA-179 ; CLA-408 ; CLA-427 ; CLA-428 ; CLA-444 ; CLA-453 ; CLA-483 |
| CLA-435 | lifecycle | §13 | This creates an AI conversational governance interface, not merely another project-management dashboard. | narrative | — |
| CLA-436 | lifecycle | §Arch | Formalize the capability as three connected engines: Requirement Intelligence Engine before specification, Specification and Delivery Engine, and Change Intelligence Engine after baseline. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 ; CLA-182 |
| CLA-437 | lifecycle | §Arch | Put a shared Decision Intelligence Engine underneath Requirement and Change Management. | should | CLA-397 ; CLA-412 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-439 ; CLA-444 ; CLA-488 |
| CLA-438 | lifecycle | §Arch | PMI Studio governs the decisions connecting business intent to production software, rather than merely generating requirements and code. | narrative | — |
| CLA-439 | lifecycle | §Arch | Incorporate into the master specification: Requirement Intelligence before specification, Change Intelligence after baseline, a shared Decision Intelligence layer, immutable traceability, risk-adaptive approval, and stakeholder-facing conversational governance. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 ; CLA-182 |
| CLA-440 | defect-management | §0 | Make Defect Management a third governed intelligence workflow alongside Requirement and Change Management, not just a QA ticket list. | should | — |
| CLA-441 | defect-management | §0 | A reported defect must first prove that the implementation violates an already-approved expectation. | must | — |
| CLA-442 | defect-management | §0 | If the existing behavior matches the approved requirement or specification, it is not a defect; it becomes a Change Request. | shall | — |
| CLA-443 | defect-management | §0 | The Requirement Room asks what should we build, before specification and baseline; the Defect Room asks whether we built the approved behavior incorrectly, during and after implementation; the Change Request Room asks whether the approved behavior should change, after baseline. | narrative | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 |
| CLA-444 | defect-management | §0 | All three Rooms feed the same Decision Intelligence and Traceability Graph. | shall | CLA-152 ; CLA-179 ; CLA-397 ; CLA-408 ; CLA-412 ; CLA-415 ; CLA-416 ; CLA-417 |
| CLA-445 | defect-management | §1 | Every Epic should have its own Defect Room. | should | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-446 | defect-management | §1 | The Epic page shows Requirements, Specifications, Architecture, Tasks, Tests, Defects, Changes, Decisions and Deployments. | should | — |
| CLA-447 | defect-management | §1 | The Defect Room aggregates defects from both automated and manual sources. | shall | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-448 | defect-management | §1 | Automated defect sources include CI/CD, unit tests, integration tests, E2E tests, Playwright, API tests, security scans, performance tests, smoke tests, production monitoring, coding agents, QA agents and deployment verification. | may | — |
| CLA-449 | defect-management | §1 | Manual defect sources include QA engineers, developers, product owners, stakeholders, UAT users, customer support and authorized customers. | may | — |
| CLA-450 | defect-management | §1 | Every defect report receives an immutable ID and is automatically linked to its Epic. | must | — |
| CLA-451 | defect-management | §2 | A raw defect should not immediately become a development task. | should | — |
| CLA-452 | defect-management | §2 | AI should automatically collect relevant context for a defect, including the Epic, feature, environment, build, commit, test, expected behavior, actual behavior and evidence. | should | — |
| CLA-453 | defect-management | §2 | AI searches the traceability graph from the defect through Epic, Feature, Requirement, Acceptance Criteria, Specification, existing tests, implementation, commit, build and deployment. | should | CLA-152 ; CLA-179 ; CLA-408 ; CLA-427 ; CLA-428 ; CLA-434 ; CLA-444 ; CLA-483 |
| CLA-454 | defect-management | §3 | Before implementation, PMI Studio performs an Expectation Verification Test. | shall | — |
| CLA-455 | defect-management | §3 | The triage flow is Reported Defect, AI Triage, find approved expected behavior, generate or reproduce test, run initial test, then branch on FAIL or PASS. | shall | — |
| CLA-456 | defect-management | §3 | On FAIL, the implementation does not satisfy the approved behavior and the defect proceeds through the TDD workflow. | shall | — |
| CLA-457 | defect-management | §3 | On PASS, the current implementation already satisfies the approved requirement, specification and test, and the reporter is effectively requesting different behavior, so the item moves from the Defect Room to the Change Request Room. | shall | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-183 |
| CLA-458 | defect-management | §3 | PMI Studio can automatically generate a Change Request derived from the defect while preserving the entire conversation, evidence and traceability. | should | — |
| CLA-459 | defect-management | §3 | This prevents developers from quietly implementing new functionality under the label of bug fixing. | narrative | — |
| CLA-460 | defect-management | §4 | Strengthen the proposed defect workflow into Defect, Reproduce, Test, Defect List, Implement, Test, Regression, Verify, Complete. | should | — |
| CLA-461 | defect-management | §4 | The internal defect sequence is DEFECT, AI TRIAGE, REPRODUCE, GENERATE FAILING TEST, INITIAL TEST, FAIL, ADD TO DEFECT/TDD LIST, IMPLEMENT, RUN TARGET TEST, RUN RELATED REGRESSION, VERIFY REQUIREMENT, COMPLETE. | should | — |
| CLA-462 | defect-management | §4 | This is effectively controlled Red, Green, Regression, Verification. | narrative | — |
| CLA-463 | defect-management | §5 | Once confirmed as a defect, the AI Defect Agent should produce a Defect Implementation Package. | should | — |
| CLA-464 | defect-management | §5 | The Defect Implementation Package states expected behavior, observed behavior, the requirement, the acceptance criterion, the affected specification, reproduction steps, the failing test, the expected RED result, likely affected components, implementation constraints and regression scope. | should | — |
| CLA-465 | defect-management | §5 | The coding agent receives this controlled package rather than a vague instruction to fix a bug. | should | — |
| CLA-466 | defect-management | §6 | Formalize the AddList concept as a TDD Remediation Queue rather than leaving it as a generic list. | should | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-467 | defect-management | §6 | Each Epic gets one TDD Remediation Queue tracking defect, severity, test, status and owner. | should | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-468 | defect-management | §6 | The TDD Remediation Queue becomes the operational defect backlog for the Epic. | shall | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-469 | defect-management | §7 | An initial test PASS should not always automatically mean Change Request. | must | — |
| CLA-470 | defect-management | §7 | A defect test might pass because of a wrong reproduction scenario, an environment-specific problem, an intermittent defect, a concurrency issue, a data-specific defect, a browser or device-specific issue, an incorrect AI-generated test, or a production configuration difference. | narrative | — |
| CLA-471 | defect-management | §7 | On initial test PASS, run an AI Evidence Check branching to refine the test, investigate or route to human review, or transfer to the Change Request Room. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-361 ; CLA-408 |
| CLA-472 | defect-management | §7 | Only transfer to Change Request when PMI Studio has sufficient evidence that observed behavior conforms to the approved baseline but the reporter expects different behavior. | must | — |
| CLA-473 | defect-management | §8 | Defects should receive an AI risk score like Change Requests. | should | — |
| CLA-474 | defect-management | §8 | A defect risk assessment records severity, business impact, security impact, production exposure, regression risk, customer impact, AI confidence and suggested priority. | should | — |
| CLA-475 | defect-management | §9 | The Defect Room should use AI to detect duplicate defects. | should | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-476 | defect-management | §9 | The Defect Room should use AI to detect a common root cause across several defects. | should | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-477 | defect-management | §9 | Instead of several coding agents independently patching symptoms, PMI Studio can recommend investigating the root cause before implementing individual fixes. | should | — |
| CLA-478 | defect-management | §10 | The relationship between the Defect Room and the Change Request Room should be first-class. | should | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-183 |
| CLA-479 | defect-management | §10 | Never delete a defect that is reclassified; record it as reclassified to the change request instead, preserving auditability. | must | — |
| CLA-480 | defect-management | §11 | Defects can also discover missing requirements, which is a third outcome beyond Defect versus Change. | narrative | — |
| CLA-481 | defect-management | §11 | When the approved baseline defines no expected behavior, PMI Studio should classify the report as a Requirement Gap and route it to the Requirement Room. | should | CLA-003 ; CLA-125 ; CLA-181 ; CLA-287 ; CLA-361 ; CLA-371 ; CLA-373 ; CLA-375 |
| CLA-482 | defect-management | §11 | The triage engine should classify incoming reports as Confirmed Defect, Change Request, Requirement Gap, Duplicate, Cannot Reproduce, or Invalid/Environmental. | should | — |
| CLA-483 | defect-management | §12 | Define the three Rooms as core product capabilities under an AI governance layer, connected by a Decision Engine and a Traceability Graph. | should | CLA-152 ; CLA-179 ; CLA-408 ; CLA-427 ; CLA-428 ; CLA-434 ; CLA-444 ; CLA-453 |
| CLA-484 | defect-management | §12 | This creates a continuous governed loop rather than a linear SpecKit workflow. | narrative | — |
| CLA-485 | defect-management | §12 | Rule one: before baseline, uncertainty is resolved through the Requirement Room. | shall | CLA-003 ; CLA-125 ; CLA-181 ; CLA-287 ; CLA-361 ; CLA-371 ; CLA-373 ; CLA-375 |
| CLA-486 | defect-management | §12 | Rule two: after baseline, deviations from approved behavior are resolved through the Defect Room using TDD. | shall | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-487 | defect-management | §12 | Rule three: changes to approved behavior are resolved through the Change Request Room using impact analysis, trade-offs and explicit decisions. | shall | CLA-003 ; CLA-057 ; CLA-058 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-361 ; CLA-408 |
| CLA-488 | defect-management | §12 | All three Rooms are connected by AI Decision Intelligence, evidence, approvals, versioned baselines and end-to-end traceability. | shall | CLA-397 ; CLA-412 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-437 ; CLA-439 ; CLA-444 |
| CLA-489 | defect-management | §12 | Incorporate this into the Master Specification as a unified Requirement-Defect-Change Governance Architecture, rather than implementing the three modules independently. | should | — |
| CLA-490 | cosmos-learnings | §1 | Amend the existing PMI Studio product and implementation plan using selected architectural lessons from Augment Code/Cosmos. | shall | — |
| CLA-491 | cosmos-learnings | §1 | This is an evolutionary refinement, not a product reset. | shall | — |
| CLA-492 | cosmos-learnings | §1 | Existing approved requirements, module specifications, epics, Requirement Room, Change Room, Defect Room, Spec Kit integration, governance model, remote workspace direction, AI Gateway, Integration Hub, and valid implementation work SHALL be preserved unless a direct conflict is identified. | shall | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 |
| CLA-493 | cosmos-learnings | §1 | PMI Studio remains targeted at software organizations that need a ready-to-use, integrated AI-native engineering ecosystem and do not want or cannot afford to build a large-company internal developer platform. | shall | — |
| CLA-494 | cosmos-learnings | §2 | PMI Studio SHALL NOT compete primarily as an AI coding IDE or attempt to outperform specialist coding agents at code generation. | shall | CLA-147 ; CLA-583 |
| CLA-495 | cosmos-learnings | §2 | Claude Code, Codex, Cursor, Augment and future compatible systems SHOULD be treated as interchangeable or complementary execution engines where appropriate. | should | CLA-069 ; CLA-097 ; CLA-209 ; CLA-584 |
| CLA-496 | cosmos-learnings | §2 | PMI Studio's differentiated responsibility SHALL remain the governed lifecycle from intent and requirements through specification, decision, planning, AI/human execution, evidence, release, defect and change. | shall | — |
| CLA-497 | cosmos-learnings | §3.1 | Introduce Governed Engineering Loops as a reusable workflow abstraction underneath repeatable PMI Studio processes. | shall | — |
| CLA-498 | cosmos-learnings | §3.1 | A loop SHALL support Event, Context, Analyze, Decide, Execute, Verify, Evidence, Outcome, Next Event. | shall | — |
| CLA-499 | cosmos-learnings | §3.1 | Requirement Room, Change Room and Defect Room SHALL remain distinct user-facing governed rooms with their own rules, states, permissions and decisions, while reusing the common workflow engine. | shall | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 |
| CLA-500 | cosmos-learnings | §3.1 | The Requirement Loop runs Request, Clarify, Analyze, Options/Risks, Acceptance Criteria, Decision, Baseline, Specification. | shall | — |
| CLA-501 | cosmos-learnings | §3.1 | The Change Loop runs Change Request, Clarify, Impact, Options/Trade-offs, Risk, Decision, Specification Update, Re-plan. | shall | — |
| CLA-502 | cosmos-learnings | §3.1 | The Defect Loop runs Defect, Classify, Link to Requirement/Epic, Reproduce, Test, Diagnose, Fix, Verify, Evidence, Close. | shall | CLA-003 ; CLA-061 ; CLA-152 ; CLA-183 ; CLA-278 ; CLA-283 ; CLA-361 ; CLA-443 |
| CLA-503 | cosmos-learnings | §3.1 | If the expected behavior passes and the requested behavior represents a modification rather than a specification violation, the Defect Loop SHALL transfer the item to the Change Room. | shall | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-152 ; CLA-182 ; CLA-183 |
| CLA-504 | cosmos-learnings | §3.2 | Upgrade the Engineering Context Engine into four coordinated capabilities rather than treating context as a single document store or knowledge graph. | shall | CLA-127 ; CLA-130 ; CLA-152 ; CLA-179 ; CLA-263 ; CLA-408 ; CLA-422 ; CLA-427 |
| CLA-505 | cosmos-learnings | §3.2 | Semantic Retrieval finds the most relevant code, specifications, decisions, documentation and history for the current task. | shall | — |
| CLA-506 | cosmos-learnings | §3.2 | The Knowledge Graph maintains verified relationships among requirements, decisions, architecture, tasks, code, tests, releases, defects and changes. | shall | CLA-152 ; CLA-179 ; CLA-408 ; CLA-427 ; CLA-428 ; CLA-434 ; CLA-444 ; CLA-453 |
| CLA-507 | cosmos-learnings | §3.2 | Live Engineering State represents current workflow, repository, build, deployment, incident and tool state. | shall | — |
| CLA-508 | cosmos-learnings | §3.2 | Context Curation constructs task-specific context packages according to role, permissions, token budget, security classification and task objective. | shall | CLA-127 ; CLA-130 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-509 ; CLA-523 |
| CLA-509 | cosmos-learnings | §3.2 | Agents SHALL receive curated task-specific context rather than indiscriminately receiving all available project information. | shall | CLA-127 ; CLA-130 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-523 |
| CLA-510 | cosmos-learnings | §3.3 | Enhance the existing Agent Registry so registered engineering agents are defined as governed Engineering Experts, not merely a model plus prompt. | shall | CLA-037 ; CLA-095 ; CLA-200 ; CLA-208 ; CLA-210 ; CLA-211 ; CLA-237 ; CLA-244 |
| CLA-511 | cosmos-learnings | §3.3 | An Engineering Expert declares identity, role and purpose. | shall | — |
| CLA-512 | cosmos-learnings | §3.3 | An Engineering Expert declares preferred model, fallback model and cost policy. | shall | — |
| CLA-513 | cosmos-learnings | §3.3 | An Engineering Expert declares context policy and retrieval strategy. | shall | — |
| CLA-514 | cosmos-learnings | §3.3 | An Engineering Expert declares capabilities and allowed tools. | shall | — |
| CLA-515 | cosmos-learnings | §3.3 | An Engineering Expert declares workspace and environment requirements. | shall | — |
| CLA-516 | cosmos-learnings | §3.3 | An Engineering Expert declares permissions and prohibited actions. | shall | — |
| CLA-517 | cosmos-learnings | §3.3 | An Engineering Expert declares approval requirements and risk classification. | shall | — |
| CLA-518 | cosmos-learnings | §3.3 | An Engineering Expert declares session and project memory policy. | shall | — |
| CLA-519 | cosmos-learnings | §3.3 | An Engineering Expert declares required outputs. | shall | — |
| CLA-520 | cosmos-learnings | §3.3 | An Engineering Expert declares an Evidence Contract defining what proof must accompany successful execution. | shall | CLA-135 ; CLA-138 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-528 ; CLA-592 |
| CLA-521 | cosmos-learnings | §3.4 | Introduce a controlled organizational learning mechanism. | shall | — |
| CLA-522 | cosmos-learnings | §3.4 | Agent observations SHALL NOT silently become trusted project or organizational knowledge. | shall | — |
| CLA-523 | cosmos-learnings | §3.4 | The learning flow runs Agent Discovery, Learning Candidate, Supporting Evidence, Confidence/Impact Evaluation, Policy Decision, then either automatic acceptance for explicitly permitted low-risk cases or Human Review, then Approved Knowledge, then Context Engine. | shall | CLA-127 ; CLA-130 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-509 |
| CLA-524 | cosmos-learnings | §3.4 | The system SHALL preserve provenance, source, confidence, approval status and supersession history for learned knowledge. | shall | — |
| CLA-525 | cosmos-learnings | §3.5 | PMI Studio SHALL prioritize specification compliance and engineering evidence over building a generic deep-code-review product. | shall | — |
| CLA-526 | cosmos-learnings | §3.5 | External review, static-analysis, security and testing tools MAY provide evidence to PMI Studio. | may | — |
| CLA-527 | cosmos-learnings | §3.5 | Introduce or strengthen a Specification Compliance Agent that evaluates approved specification, acceptance criteria, constraints, architecture, implementation and test evidence, and determines whether the delivered result satisfies the approved intent. | shall | — |
| CLA-528 | cosmos-learnings | §3.5 | Completion SHALL be evidence-driven; an agent reporting done is not sufficient. | shall | CLA-135 ; CLA-138 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-520 ; CLA-592 |
| CLA-529 | cosmos-learnings | §4 | The Engineering Context and Knowledge system SHOULD support traceability across Business Objective, Stakeholder Need, Requirement, Clarification, Decision, Acceptance Criteria, Specification, Architecture Decision, Epic/Feature, Task, Agent Session, Code Change, Commit/PR, Test, Security Evidence, Release, Deployment, Telemetry/Incident, Defect and Change Request. | should | — |
| CLA-530 | cosmos-learnings | §4 | The platform SHOULD answer impact and rationale questions from structured relationships and verified evidence, with LLM reasoning used to interpret and explain rather than invent relationships. | should | — |
| CLA-531 | cosmos-learnings | §5 | MCP SHALL become a first-class integration protocol within the Engineering Integration Hub. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-532 | cosmos-learnings | §5 | Core PMI Studio workflows SHALL depend on abstract capabilities rather than directly depending on a particular MCP server or vendor API. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-533 | cosmos-learnings | §5 | A workflow requests a capability such as CreatePullRequest, and the Capability Resolver selects an authorized GitHub MCP adapter, GitHub API adapter, GitLab adapter or another compatible implementation. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-534 | cosmos-learnings | §5 | This preserves portability across GitHub, GitLab, Bitbucket, AI providers, CI/CD systems, cloud providers and future protocols. | narrative | — |
| CLA-535 | cosmos-learnings | §6 | Evolve the existing remote workspace and VM concept into a Workspace Fabric capable of supporting multiple controlled execution modes. | shall | CLA-200 ; CLA-218 ; CLA-222 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 |
| CLA-536 | cosmos-learnings | §6 | The Workspace Fabric supports a PMI-managed isolated VM or container workspace. | shall | CLA-200 ; CLA-218 ; CLA-222 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 |
| CLA-537 | cosmos-learnings | §6 | The Workspace Fabric supports a customer-cloud workspace in the customer's AWS, Azure or GCP environment. | shall | CLA-200 ; CLA-218 ; CLA-222 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 |
| CLA-538 | cosmos-learnings | §6 | The Workspace Fabric supports a controlled local or developer-machine connector where policy permits. | shall | CLA-200 ; CLA-218 ; CLA-222 ; CLA-224 ; CLA-225 ; CLA-237 ; CLA-346 ; CLA-361 |
| CLA-539 | cosmos-learnings | §6 | All execution modes SHOULD apply consistent identity, policy, context, audit, evidence and permission controls. | should | — |
| CLA-540 | cosmos-learnings | §6 | PMI Studio SHALL preserve the existing remote-first secure execution direction. | shall | — |
| CLA-541 | cosmos-learnings | §7 | Human checkpoints SHALL remain first-class. | shall | — |
| CLA-542 | cosmos-learnings | §7 | The platform SHALL avoid requiring human approval for every AI action. | shall | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 |
| CLA-543 | cosmos-learnings | §7 | Actions SHOULD be evaluated by risk, policy and impact: low risk permits automatic execution, medium risk requires an evidence or policy gate, and high risk or consequential decisions require mandatory human approval. | should | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 |
| CLA-544 | cosmos-learnings | §7 | Requirement baselines, significant scope changes, security exceptions, major architecture changes and other policy-defined consequential decisions SHALL remain human-accountable. | shall | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-190 ; CLA-269 ; CLA-372 ; CLA-396 |
| CLA-545 | cosmos-learnings | §8 | Requirements and specification are a PMI Studio core differentiator to own. | shall | — |
| CLA-546 | cosmos-learnings | §8 | Change and defect governance are a PMI Studio core differentiator to own. | shall | — |
| CLA-547 | cosmos-learnings | §8 | Workflow, decision and evidence are a PMI Studio core differentiator to own. | shall | — |
| CLA-548 | cosmos-learnings | §8 | Context curation and traceability are a PMI Studio core differentiator to own. | shall | CLA-127 ; CLA-130 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-509 |
| CLA-549 | cosmos-learnings | §8 | Specification compliance is a PMI Studio core differentiator to own. | shall | — |
| CLA-550 | cosmos-learnings | §8 | AI coding is integrate or hybrid, served by Claude, Codex, Cursor, Augment and others. | shall | — |
| CLA-551 | cosmos-learnings | §8 | Generic deep code review is integrate or hybrid, consuming external review evidence. | shall | — |
| CLA-552 | cosmos-learnings | §8 | Source control is an integration served by GitHub, GitLab or Bitbucket. | shall | — |
| CLA-553 | cosmos-learnings | §8 | CI/CD, cloud and observability are integrations served by capability adapters, MCP or API. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-554 | cosmos-learnings | §9 | Review the current Master Product Specification, module specifications, system design, tech stack, epics and active plan before changing tasks. | must | — |
| CLA-555 | cosmos-learnings | §9 | Map each refinement in this amendment to existing requirements and architecture. | must | — |
| CLA-556 | cosmos-learnings | §9 | Classify each finding as Already Covered, Enhancement Required, Missing, Conflict, or Integration Boundary Change. | must | CLA-009 ; CLA-066 ; CLA-155 ; CLA-585 |
| CLA-557 | cosmos-learnings | §9 | Do not duplicate existing requirements or create replacement IDs unnecessarily. | must | — |
| CLA-558 | cosmos-learnings | §9 | Preserve existing requirement, epic, module and ADR identifiers wherever possible. | must | CLA-344 ; CLA-345 ; CLA-346 ; CLA-347 ; CLA-348 ; CLA-349 ; CLA-350 ; CLA-351 |
| CLA-559 | cosmos-learnings | §9 | Identify any new ADRs required for Governed Engineering Loops, Context Engine composition, Engineering Expert definition, Governed Learning, and Specification Compliance/Evidence. | must | CLA-127 ; CLA-130 ; CLA-179 ; CLA-263 ; CLA-422 ; CLA-504 ; CLA-508 ; CLA-509 |
| CLA-560 | cosmos-learnings | §9 | Identify affected tasks and dependencies; do not stop valid implementation work unless a genuine conflict exists. | must | — |
| CLA-561 | cosmos-learnings | §9 | Apply changes incrementally and produce a migration and reconciliation sequence. | must | — |
| CLA-562 | cosmos-learnings | §10 | Produce an amendment impact report containing an executive summary and confirmation that this is an evolutionary amendment. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-563 | cosmos-learnings | §10 | The impact report states existing requirements, modules and epics affected. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-564 | cosmos-learnings | §10 | The impact report states already-covered capabilities. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-565 | cosmos-learnings | §10 | The impact report states requirements requiring enhancement. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-566 | cosmos-learnings | §10 | The impact report states new requirements genuinely required. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-567 | cosmos-learnings | §10 | The impact report states conflicts and recommended resolution. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-568 | cosmos-learnings | §10 | The impact report states architecture and ADR changes. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-569 | cosmos-learnings | §10 | The impact report states Governed Engineering Loop design impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-570 | cosmos-learnings | §10 | The impact report states Context Engine and Knowledge Graph impact. | must | CLA-127 ; CLA-130 ; CLA-152 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 |
| CLA-571 | cosmos-learnings | §10 | The impact report states Agent Registry and Engineering Expert impact. | must | CLA-037 ; CLA-095 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 |
| CLA-572 | cosmos-learnings | §10 | The impact report states Governed Learning impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-573 | cosmos-learnings | §10 | The impact report states Specification Compliance and Evidence impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-574 | cosmos-learnings | §10 | The impact report states Integration Hub and MCP capability abstraction impact. | must | CLA-012 ; CLA-076 ; CLA-108 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 |
| CLA-575 | cosmos-learnings | §10 | The impact report states Workspace Fabric impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-576 | cosmos-learnings | §10 | The impact report states security and governance impact. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-577 | cosmos-learnings | §10 | The impact report states task additions, modifications and removals. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-578 | cosmos-learnings | §10 | The impact report states implementation sequencing and migration strategy. | must | CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 ; CLA-169 ; CLA-170 ; CLA-171 ; CLA-172 |
| CLA-579 | cosmos-learnings | §10 | The impact report states open decisions requiring human approval. | must | CLA-058 ; CLA-060 ; CLA-139 ; CLA-141 ; CLA-165 ; CLA-166 ; CLA-167 ; CLA-168 |
| CLA-580 | cosmos-learnings | §11 | Do not reposition PMI Studio for very large enterprises building their own internal engineering platforms. | must | — |
| CLA-581 | cosmos-learnings | §11 | Do not rebuild PMI Studio around Augment or Cosmos terminology or architecture. | must | — |
| CLA-582 | cosmos-learnings | §11 | Do not replace the existing Requirement Room, Change Room or Defect Room. | must | CLA-003 ; CLA-057 ; CLA-058 ; CLA-061 ; CLA-064 ; CLA-125 ; CLA-152 ; CLA-181 |
| CLA-583 | cosmos-learnings | §11 | Do not turn PMI Studio into a coding IDE. | must | CLA-147 ; CLA-494 |
| CLA-584 | cosmos-learnings | §11 | Do not hard-code the platform to Augment, Claude, Cursor, Codex or any single AI provider. | must | CLA-069 ; CLA-097 ; CLA-209 ; CLA-495 |
| CLA-585 | cosmos-learnings | §11 | Do not replace mature commodity tools where integration provides the required capability. | must | CLA-009 ; CLA-066 ; CLA-155 ; CLA-556 |
| CLA-586 | cosmos-learnings | §11 | Do not allow unverified agent learning to become trusted organizational knowledge. | must | — |
| CLA-587 | cosmos-learnings | §12 | Acceptance: existing PMI Studio architecture is reconciled rather than regenerated. | shall | CLA-002 ; CLA-191 ; CLA-358 ; CLA-598 |
| CLA-588 | cosmos-learnings | §12 | Acceptance: the five approved Augment/Cosmos learnings are represented in the plan. | shall | — |
| CLA-589 | cosmos-learnings | §12 | Acceptance: PMI Studio's SMB and mid-market product boundary remains intact. | shall | — |
| CLA-590 | cosmos-learnings | §12 | Acceptance: Requirement, Change and Defect Rooms remain first-class governed workflows. | shall | — |
| CLA-591 | cosmos-learnings | §12 | Acceptance: context architecture explicitly separates semantic retrieval, knowledge graph, live state and context curation. | shall | CLA-127 ; CLA-130 ; CLA-152 ; CLA-179 ; CLA-263 ; CLA-408 ; CLA-422 ; CLA-427 |
| CLA-592 | cosmos-learnings | §12 | Acceptance: agents have explicit evidence contracts and governed permissions. | shall | CLA-135 ; CLA-138 ; CLA-415 ; CLA-416 ; CLA-417 ; CLA-520 ; CLA-528 |
| CLA-593 | cosmos-learnings | §12 | Acceptance: learning is controlled and provenance-aware. | shall | — |
| CLA-594 | cosmos-learnings | §12 | Acceptance: MCP is first-class but vendor and protocol coupling is avoided through capability abstraction. | shall | CLA-012 ; CLA-076 ; CLA-108 ; CLA-200 ; CLA-240 ; CLA-246 ; CLA-256 ; CLA-257 |
| CLA-595 | cosmos-learnings | §12 | Acceptance: specification compliance and evidence remain stronger differentiators than generic code generation. | shall | — |
| CLA-596 | cosmos-learnings | §12 | Acceptance: the resulting implementation sequence minimizes disruption to currently valid work. | shall | — |
| CLA-597 | cosmos-learnings | §13 | Execute this amendment against the current PMI Studio plan by first performing reconciliation and impact analysis, then updating the affected specification, architecture, ADRs, epics and tasks. | must | — |
| CLA-598 | cosmos-learnings | §13 | Do not perform a wholesale rewrite. | must | CLA-002 ; CLA-191 ; CLA-358 ; CLA-587 |
| CLA-599 | cosmos-learnings | §13 | Where an existing decision already satisfies this amendment, preserve it and mark it as covered. | must | — |
