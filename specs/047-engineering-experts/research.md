# Research: Engineering Experts

**Epic**: `EPIC-047` · **Date**: 2026-10-09 · **Plan**: [plan.md](./plan.md)

Fifteen decisions. **No new external library is introduced** — the Epic is built on NestJS 10,
Prisma 5.22 and Vitest 2.1 already in the repository — so Context7 was not consulted: there is no
external API whose current shape a decision depends on. Every decision below is grounded in the
repository instead, with `file:line` references taken on 2026-10-09.

Three dependencies are **open pull requests, not merged**: `EPIC-031` (#4), `EPIC-032` (#3),
`EPIC-038` (#5). `R-047-13` decides how this Epic is built without waiting on them.

---

## R-047-1 — An Expert extends the agent seam; it is not a second agent type

- **Decision**: an `EngineeringExpert` is a governed record in a new `backend/src/modules/experts/`
  module. Its contract names **models and capabilities** (`FR-EXP-023`); it does not embed an
  `AgentDescriptor`. At dispatch, the Expert is resolved to an `AgentGateway` whose descriptor
  matches a declared model and covers the requested capabilities, using the existing
  `assertAgentCapabilities` (`packages/agent-contract/src/index.ts:201`).
- **`AgentDescriptor` gains one optional field**, `enforceableLimits?: readonly ('time' | 'resource'
  | 'tokens' | 'cost')[]` — the extension `ADR-0020` decided on, additive, so no existing gateway
  changes shape. Absent means *none declared*, which `R-047-7` treats as unenforceable.
- **Rationale**: `ADR-0020` — *"extend `AgentDescriptor` rather than replace it"*. The descriptor
  describes what a provider **can** do; the contract describes what a role **may** do. Merging them
  would make a provider change a governance change.
- **Alternatives considered**: Expert as a subtype of `AgentDescriptor` (rejected: binds the role to
  one provider, contradicting `BR-0103`); a free-text system prompt per Expert (rejected: that is the
  "model plus a prompt" `BR-0101` exists to replace).
- **Docs consulted**: none needed (repository types only).

## R-047-2 — A gateway registry is introduced, as a port

- **Decision**: nothing in the repository selects a gateway by model today — consumers inject one
  `{gateway, session}` binding (`change-room/options.service.ts:61`, `defect-room.tokens.ts:136`),
  and none is wired (`change-room.module.ts:111`). This Epic defines an `ExpertGateways` port
  (`gatewaysFor(model) → AgentGateway[]`) on the pattern of `engines/engine-registry.service.ts:58`.
  **Unbound, dispatch refuses with `503`** naming the port; registration, versioning, approval,
  assignment and inspection all work without it.
- **Rationale**: the programme's consistent pattern — a port with no implementation refuses rather
  than degrades. Building provider gateways is `EPIC-028`'s seam, not this Epic.
- **Alternatives considered**: hard-wiring the Claude gateway (rejected: `PP-006`, `BR-0103`).

## R-047-3 — The session record is `EPIC-037`'s execution; Expert facts live beside it

- **Decision**: an Expert run is registered through `ExecutionRegistryFacade.register`
  (`executions/execution-registry.facade.ts:80`) **before** it executes (`FR-EXP-060`). This Epic
  keeps an `expert_sessions` row **keyed by `executionId`**: Expert, contract version, delegation
  parent, effective authority, tool observation, and limits.
- **Delegation is not `parentExecutionId`.** `EPIC-037`'s parent link means *re-run* and is
  asserted as such (`contract.ts:159`, `FR-EXR-018`). Overloading it would make every delegated
  session look like a retry. The delegation edge is `expert_sessions.delegatedFromExecutionId`.
- **Commands**: `GOVERNED_COMMANDS` is closed (`contract.ts:39-50`). An Expert run therefore names
  the governed command it executes; Expert work that is not a governed command is out of scope for
  dispatch in this Epic and refused with that reason.
- **Rationale**: one answer to *"what ran?"* (Assumption 2), and no change to `EPIC-037`'s
  execution table.
- **Unattended runs** (`FR-EXP-063`): the session is marked `reviewRequired` and its completion is
  sent through `ExecutionRegistryFacade.proposeTransition` (`execution-registry.facade.ts:108`) —
  proposed, adjudicated by the platform, never applied by the Expert (Constitution XII).
- **Alternatives considered**: adding Expert columns to `Execution` (rejected: couples the registry
  to one consumer); a separate Expert session table as the system of record (rejected: two records
  of one run).

## R-047-4 — Expert events: one additive event type in `EPIC-037`'s contract

- **Decision**: `EXECUTION_EVENT_TYPES` is a closed union (`packages/execution-registry-contract/
  src/events.ts:25-78`). This Epic adds **one** type, `expert-governance-recorded`, whose payload is a
  discriminated union on `kind`: `dispatch-refused`, `fallback-used`, `limit-narrowed`,
  `limit-unenforceable`, `limit-reached`, `limit-breach-detected-late`, `tool-use-unobserved`,
  `tool-call-breach`, `delegation-refused`, `stopped-by-parent`, `outputs-incomplete`,
  `review-required` *(added by analysis finding C2, `FR-EXP-063`)*.
- **Rationale**: `FR-EXP-061` requires these on the execution, not in a side log. One type keeps the
  contract change to a single additive line, asserted in `EPIC-037`'s own parity suite as
  `EPIC-038` did for `projectId`.
- **Alternatives considered**: eleven new event types (rejected: eleven edits to another Epic's
  contract for one consumer); a separate log table (rejected: `FR-EXP-061`).

## R-047-5 — Contract approval through `EPIC-031`, read on demand

- **Decision**: submitting a contract version calls `DecisionEngine.decide` (`decision/
  evaluator.ts:94` on the `EPIC-031` branch) with `actionType: 'expert-contract.approve'`,
  `target: {type: 'expert-contract-version', id}`, `objectVersion: <version number>`,
  `proposedClass: <contract risk class>`. The `decisionId` is stored on the version. `EPIC-031`
  offers **no callback** — consumers poll `resolutionOf(workspaceId, id)`
  (`decision.repository.ts:61`) — so a version's status is **derived at read and at dispatch** from
  the decision's resolution, never cached as *approved*.
- **Rationale**: a cached *approved* that `EPIC-031` later refused is exactly the unrecorded
  divergence this programme keeps finding. Reading is cheap; one read per dispatch.
- **Alternatives considered**: an approval event from `EPIC-031` (does not exist); approving inside
  this module (rejected: `FR-EXP-005`, Assumption 3).

## R-047-6 — Risk class is `EPIC-031`'s band

- **Decision**: a contract's risk class is `RiskBand` — `'low' | 'medium' | 'high'`
  (`packages/decision-contract/src/bands.ts:8-16`, `EPIC-031` branch). Until that package is on
  `main`, the experts module declares the same literal union locally, and an architecture test
  asserts the two are identical once both exist (`R-047-13`).
- **Rationale**: one risk vocabulary in the programme.

## R-047-7 — Limits: what the seam can and cannot enforce today

- **Decision**:
  - **Time** — enforceable everywhere: `AgentContext.timeoutMs` is required and `signal` stops the
    run (`index.ts:117`). Always recorded as *enforced*.
  - **Tokens and cost** — reported **after** a run (`AgentExecutionRecord.costMetadata`,
    `index.ts:140`); no current gateway can stop mid-run. Enforced only where the descriptor
    declares them in `enforceableLimits` (`R-047-1`); otherwise *unenforceable for this provider*.
  - **Resource** — the maximum number of tool calls (`FR-EXP-040`). Enforceable only where the
    gateway reports tool calls, which none does today (`R-047-8`); *unenforceable* unless declared.
  - Late reports that exceed a limit are recorded as `limit-breach-detected-late` (`FR-EXP-046`).
- **Consequence, stated plainly**: with the clarified default (`FR-EXP-043` — token and cost refuse
  dispatch when unenforceable), **no current gateway can run an Expert that sets token or cost
  limits** unless its contract chooses *proceed and record*. That is the clarification working as
  intended, and the closing report must say so rather than discover it.
- **Delegation**: each ancestor's remaining budget is the min over the chain; a delegate's
  consumption is charged up the chain when reported (`FR-EXP-036`).

## R-047-8 — Tool enforcement: at dispatch, plus reported calls

- **Decision**: dispatch checks the request's declared capabilities and tools against the contract,
  prohibitions first (`FR-EXP-013`). The gateway reports tool calls only if its result carries them;
  `AgentExecutionRecord` has no tool-call list today, so **every current gateway records tool use as
  `unobserved`** (`FR-EXP-024`). An optional `toolCalls?` on the execution record is **not** added
  here — that is a provider capability, and adding a field no gateway fills would read as coverage.
- **Rationale**: clarification 2 — never record enforcement the platform did not perform.

## R-047-9 — Permissions: contract ∩ actor, through `EPIC-024`

- **Decision**: a contract's permissions are a list of `{artifactType, action: 'read' | 'edit'}`.
  At dispatch, every target the request declares is checked twice: in the contract, and against the
  requesting actor via `AccessInheritanceService.effectivelyReadable/effectivelyEditable`
  (`access/access-inheritance.service.ts:61,77`). Both must allow (`FR-EXP-014`). For a delegate,
  the chain's contracts are intersected as well (`FR-EXP-034`).
- **Note**: `EPIC-024` is grant-based with no role enum; roles are free strings
  (`AssembleInput.actorRole`). The same gap is `DEF-038-005`; this Epic consumes, not fixes, it.

## R-047-10 — Context policy is a named subset of `EPIC-038`'s assembly input

- **Decision**: `contextPolicy = {budgetTokens, budgetCost, includeLiveState, essentialSources?}`,
  the fields `AssembleInput` already takes (`context/assembly.service.ts:67-85`). At dispatch it is
  passed to `assemble` with the run's objective and actor; the package is bound to the execution
  with `bindExecution`. This Epic assembles nothing itself (`FR-EXP-015`).

## R-047-11 — Evidence Contract reference: `{workClass, contractVersion}`

- **Decision**: the contract references `EPIC-032`'s Evidence Contract by its package identity,
  `{workClass, contractVersion}` (`packages/evidence-contract/src/contract.ts:30-32`), validated with
  `ContractCatalog.get(workClass, contractVersion)` (`contract.loader.ts:125`). A missing pair is a
  dangling reference (`FR-EXP-022`). The Prisma-side `EvidenceContract.id` is not used: the package
  identity is the one the completion gate binds to (`completion.gate.ts:126`).

## R-047-12 — Assignment: an append-only table beside `Task`

- **Decision**: `Task` has no assignee column (`schema.prisma:478`) and no generic history. This
  Epic adds `task_assignments` — append-only rows referencing `tasks.id`, superseded rather than
  updated — and the current assignee is the latest unsuperseded row. This is **not** a second task
  record (`FR-EXP-056`): it holds no title, status or provenance, only who holds the task and why.
- **Risk gate**: where the task's risk band exceeds the workspace's `maxUnattendedBand` for Experts,
  the row is created `pending-decision` with an `EPIC-031` decision, and stands only when that
  resolves approved (`FR-EXP-054`).

## R-047-13 — Building against three unmerged dependencies

- **Decision**: every dependency is a **port defined in this module** (`ExpertGateways`,
  `ContractApprovals`, `EvidenceContracts`, `ContextAssembler`, `ActorAccess`, `ExecutionRegistry`).
  Ports for `main` code (`EPIC-024`, `EPIC-028`, `EPIC-037`, `EPIC-046`) get adapters immediately.
  Adapters for `EPIC-031`, `EPIC-032` and `EPIC-038` are **one task phase**, scheduled last and
  blocked until those PRs merge. Until then the module binds them **refusing** (`503`, naming the
  port), and integration tests exercise the refusal — never a permissive stub **in the module**.
  Route tests that need an approved contract or a gateway override those ports with **in-test
  bindings that record every call**, set up visibly in the test itself; the module's own default
  stays refusing (analysis finding I1).
- **Rationale**: the alternative — branching from an integration of three open PRs — would make
  this PR's diff include theirs and its review depend on theirs.

## R-047-14 — Contract versions are immutable by construction

- **Decision**: `expert_contract_versions` rows are inserted, never updated, except for the
  `decisionId` written once on submission. Enforced by a database trigger rejecting `UPDATE` of any
  other column, plus a store with no update method. A new version copies, never edits.
- **Rationale**: `FR-EXP-004`; an application-only rule is one refactor away from gone.

## R-047-15 — Performance and scale targets (`PP-018`)

| Operation | Target (p95) | Design point |
|---|---|---|
| Dispatch check (contract, approval read, access, limits) | < 300 ms | excluding context assembly and the run |
| Delegation tree read | < 500 ms | depth 3 × fan-out 5 = 156 sessions |
| Contract version compare | < 200 ms | 12 elements |
| Experts screen load | < 1.2 s | 100 Experts per workspace |

Delegation defaults: **max depth 3, max fan-out 5** per session, configurable per workspace
(`FR-EXP-033`). Session volume is `EPIC-037`'s retention concern (`ADR-0027` "Negative").
