# Register: Capabilities

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Native / integrated / hybrid for every capability (`FR-AMD-004`).

`ownership` follows Plan Amendment §2's test: *does PMI Studio have to control this to maintain its
end-to-end engineering workflow?* `removed_because_external` MUST be false throughout — §2 forbids
removing existing functionality merely because an external product provides something similar.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## §18.9 — capabilities that should become integrations rather than native builds

`FR-AMD-010` requires this list explicitly. Every row below carries `ownership: integrated` and an
abstraction boundary, and **none of them is an existing capability being removed** — §2 forbids that,
and `G-27-04` asserts `removed_because_external` is false on every row in this register.

| Capability | Why integrate | Boundary |
|---|---|---|
| `CAP-015` AI code generation | Cosmos §2 forbids competing as a coding IDE; the engines are interchangeable | `AgentGateway.execute()` |
| `CAP-031` Source control hosting | PMI Studio needs git the protocol, not a vendor | `CreateImplementationBranch()` |
| `CAP-032` CI/CD execution | Native §18: integrate rather than duplicating CI/CD inside the agent | capability adapter |
| `CAP-033` Cloud provisioning | Commodity; becoming an infrastructure product strengthens nothing | `ProjectExecutionEnvironment` |
| `CAP-034` Communication | Surface decisions into existing channels | notification adapter |
| `CAP-036` Deep code review | Cosmos §3.5: compliance beats a generic review product | evidence submission |
| `CAP-037` Static analysis / security scanning | Commodity; consume the output as evidence | evidence submission |
| `CAP-038` IDE and developer tooling | Native §21: IDE choice must not determine architecture | interactive session |

**Nothing in the existing corpus moves from native to integrated.** The amendment introduces these as
integrations; it does not ask PMI Studio to give up anything it already specified. That is the
distinction §18.9 is really asking about, and the answer is a genuine none.

## §18.9 — capabilities that should become integrations rather than native builds

`FR-AMD-010` requires this list explicitly. Every row below carries `ownership: integrated` and an
abstraction boundary, and **none of them is an existing capability being removed** — §2 forbids that,
and `G-27-04` asserts `removed_because_external` is false on every row in this register.

| Capability | Why integrate | Boundary |
|---|---|---|
| `CAP-015` AI code generation | Cosmos §2 forbids competing as a coding IDE; the engines are interchangeable | `AgentGateway.execute()` |
| `CAP-031` Source control hosting | PMI Studio needs git the protocol, not a vendor | `CreateImplementationBranch()` |
| `CAP-032` CI/CD execution | Native §18: integrate rather than duplicating CI/CD inside the agent | capability adapter |
| `CAP-033` Cloud provisioning | Commodity; becoming an infrastructure product strengthens nothing | `ProjectExecutionEnvironment` |
| `CAP-034` Communication | Surface decisions into existing channels | notification adapter |
| `CAP-036` Deep code review | Cosmos §3.5: compliance beats a generic review product | evidence submission |
| `CAP-037` Static analysis / security scanning | Commodity; consume the output as evidence | evidence submission |
| `CAP-038` IDE and developer tooling | Native §21: IDE choice must not determine architecture | interactive session |

**Nothing in the existing corpus moves from native to integrated.** The amendment introduces these as
integrations; it does not ask PMI Studio to give up anything it already specified. That is the
distinction §18.9 is really asking about, and the answer is a genuine none.

## Register

| id | capability | ownership | reason | abstraction_boundary | existing_home | removed_because_external |
|---|---|---|---|---|---|---|
| CAP-001 | Requirement gathering and capture | native | PMI Studio must control the intake of business intent to maintain its end-to-end workflow; everything downstream traces to it | — | NO-EXISTING-COVERAGE | false |
| CAP-002 | Requirement clarification and ambiguity detection | native | The clarification loop is where governance begins; delegating it would put the decision record outside the platform that must answer for it | — | NO-EXISTING-COVERAGE | false |
| CAP-003 | Requirement approval and baselining | native | Approval state is governance state, and Native §22 makes PostgreSQL authoritative for it. Control is the whole point | — | NO-EXISTING-COVERAGE | false |
| CAP-004 | Acceptance criteria | native | Acceptance criteria are what specification compliance is evaluated against; an external owner would break the evidence chain | — | NO-EXISTING-COVERAGE | false |
| CAP-005 | Specification management | native | The differentiated capability. EPIC-008 and EPIC-009 own authoring and lifecycle | — | EPIC-008 | false |
| CAP-006 | Constraint management | native | Constraints bind specification generation and agent execution; both are PMI Studio surfaces | — | NO-EXISTING-COVERAGE | false |
| CAP-007 | Decision records and architecture decisions | native | ADRs are governance memory. EPIC-016 owns the product capability; this repository already keeps its own in adr/ | — | EPIC-016 | false |
| CAP-008 | Requirement-to-implementation traceability | native | Traceability is the thing that makes impact analysis answerable from structured relationships rather than LLM inference (§10) | — | EPIC-011 | false |
| CAP-009 | Specification-driven planning | native | PMI Studio must control planning to keep plan, spec and task in one governed chain | — | EPIC-008 | false |
| CAP-010 | Epic, feature and task decomposition | native | Decomposition is where governance granularity is set; EPIC-012 owns workflow and tasks | — | EPIC-012 | false |
| CAP-011 | Dependency analysis and implementation sequencing | native | Sequencing decisions are programme decisions and must be answerable from the graph | — | EPIC-012 | false |
| CAP-012 | AI-assisted estimation and risk analysis | hybrid | PMI Studio owns the estimate of record and its evidence; the reasoning may come from any registered agent | AgentGateway.execute() | NO-EXISTING-COVERAGE | false |
| CAP-013 | Planning validation | native | PMI Studio must control validation gates because they decide whether work is complete; a gate an external tool owns is a gate PMI Studio cannot enforce | — | EPIC-015 | false |
| CAP-014 | Agent registry and agent assignment | native | Which agent may do what is an authorization decision, so PMI Studio must own it. BUILT by EPIC-028 as AgentRegistry | — | EPIC-028 | false |
| CAP-015 | AI code generation and reasoning | integrated | PMI Studio does not need to generate code itself to maintain its workflow, and Cosmos §2 forbids competing as a coding IDE. Claude, Codex, Cursor and Augment are interchangeable execution engines | AgentGateway.execute() | EPIC-028 | false |
| CAP-016 | Model selection and multi-model routing | hybrid | Selection policy is native because it encodes cost, security classification and task suitability; the routing mechanism beneath it may be an external gateway (D-30, open) | AgentGateway descriptor negotiation | EPIC-028 | false |
| CAP-017 | Agent permissions and execution policies | native | Least privilege is a governance control and cannot be delegated to the thing being constrained | — | EPIC-028 | false |
| CAP-018 | Agent context preparation | native | Context curation decides what an agent may see, which is an access-control decision (Native §11) | — | NO-EXISTING-COVERAGE | false |
| CAP-019 | Agent activity tracking and execution records | native | Provenance is evidence. BUILT by EPIC-028 as AgentExecutionRecord, carrying no prompt and no model output | — | EPIC-028 | false |
| CAP-020 | Human/AI responsibility boundaries | native | The split between human decision, AI recommendation and AI execution is the governance model itself | — | NO-EXISTING-COVERAGE | false |
| CAP-021 | Engineering and AI policies | native | PMI Studio must control policy definition to maintain its end-to-end workflow — policy is what every other gate reads | — | NO-EXISTING-COVERAGE | false |
| CAP-022 | Approval gates and human-in-the-loop controls | native | PP-003 binds the programme; risk-adaptive banding (Cosmos §7) refines it rather than delegating it | — | EPIC-021 | false |
| CAP-023 | Role-based and attribute-based authorization | native | Authorization decides who may approve what, and approval is the governance act | — | EPIC-024 | false |
| CAP-024 | Audit trails | native | PMI Studio must control audit because it is the evidence of governance rather than an operational log; append-only audit already exists (FR-033) | — | EPIC-004 | false |
| CAP-025 | Evidence requirements and completion gates | native | Cosmos §3.5 makes evidence the differentiator: an agent reporting done is not sufficient | — | NO-EXISTING-COVERAGE | false |
| CAP-026 | Exception management and risk controls | native | PMI Studio must control exception handling because §12 names security exceptions as human-accountable decisions, and an exception granted elsewhere is a control bypassed | — | NO-EXISTING-COVERAGE | false |
| CAP-027 | Requirement Room | native | The governed intake workflow. PMI Studio must control it because approval state lives there. Corpus occurrences: zero (PRE-003) | — | NO-EXISTING-COVERAGE | false |
| CAP-028 | Change Room | native | Post-baseline change control. Zero corpus occurrences (PRE-001), so this is a build rather than the enhancement the amendment assumes | — | NO-EXISTING-COVERAGE | false |
| CAP-029 | Defect Room and TDD remediation | native | Defect governance with expectation verification. Zero corpus occurrences (PRE-002); distinct from the Constitution VI defects/ convention | — | NO-EXISTING-COVERAGE | false |
| CAP-030 | Decision Intelligence / Decision Center | native | Shared by all three Rooms. One capability, not three, which is why it carries its own row | — | NO-EXISTING-COVERAGE | false |
| CAP-031 | Source control hosting | integrated | PMI Studio does not need to host git to maintain its workflow. D-22 makes the git remote the durable substrate, which is a dependency on git the protocol, not on a vendor | CreateImplementationBranch() | EPIC-014 | false |
| CAP-032 | CI/CD execution | integrated | Native §18 is explicit: integrate with CI/CD governance rather than duplicating it inside the agent. PMI Studio consumes results as evidence | Capability adapter per Cosmos §5 | EPIC-014 | false |
| CAP-033 | Cloud and infrastructure provisioning | integrated | Commodity. Becoming an infrastructure product would not strengthen the engineering workflow | ProjectExecutionEnvironment | EPIC-028 | false |
| CAP-034 | Communication channels | integrated | PMI Studio surfaces decisions into Slack, Teams or email rather than replacing them | Notification capability adapter | NO-EXISTING-COVERAGE | false |
| CAP-035 | Observability and monitoring platforms | hybrid | The tools are integrated; converting their signals into engineering context, evidence, defects and risks is native, because that conversion is governance | Signal ingestion adapter | NO-EXISTING-COVERAGE | false |
| CAP-036 | Generic deep code review | integrated | Cosmos §3.5 and §8 both say specification compliance beats a generic review product, and that external tools MAY supply the evidence | Evidence submission contract | NO-EXISTING-COVERAGE | false |
| CAP-037 | Static analysis and security scanning | integrated | PMI Studio does not need to control scanning to maintain its workflow; it needs the output as evidence, so the tool is integrated and the evidence contract is native | Evidence submission contract | EPIC-015 | false |
| CAP-038 | IDE and developer tooling | integrated | Native §21: interactive IDE choice must not determine PMI Studio architecture. Cursor, VS Code and JetBrains are execution interfaces | Interactive workspace session | NO-EXISTING-COVERAGE | false |
| CAP-039 | Specification generation | hybrid | PMI Studio owns the five ordered steps, the failure taxonomy and the provenance; Spec Kit performs the mechanics and an agent does the reasoning. This is the built seam | SpecificationEngine + AgentGateway | EPIC-003 | false |
| CAP-040 | Sandboxed execution | hybrid | PMI Studio owns the policy — egress, resource caps, credentials, lifecycle — and Docker or Kubernetes performs the isolation | ProjectExecutionEnvironment | EPIC-028 | false |
| CAP-041 | Repository operations by agents | hybrid | PMI Studio owns branch policy, credential scope and what may be pushed; git executes. Agents must not push to protected branches (Native §18) | CreateImplementationBranch(), CreatePullRequest() | EPIC-014 | false |
| CAP-042 | Impact analysis | hybrid | The graph traversal and the evidence are native; the reasoning that explains them may come from any agent, and §10 says answer from structured relationships rather than LLM inference | AgentGateway.analyze() | EPIC-011 | false |
| CAP-043 | Test execution | hybrid | PMI Studio owns which tests gate completion and what the evidence means; the runner is commodity | Evidence submission contract | EPIC-015 | false |
| CAP-044 | Semantic retrieval over project knowledge | hybrid | Curation policy — role, permissions, token budget, security classification — is native. The retrieval mechanism, including any vector store, is an implementation choice (D-24, open) | Context Engine retrieval port | NO-EXISTING-COVERAGE | false |
| CAP-045 | MCP tool surface | hybrid | The least-privilege authorization model is native; MCP is a transport over services that are already transport-independent (PC-1). D-26 split the agent-facing surface from the marketplace | MCP transport over existing services | EPIC-013 | false |
