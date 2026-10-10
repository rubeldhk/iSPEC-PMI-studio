# Feature Specification: Engineering Experts

**Feature Branch**: `epic/047-engineering-experts`

**Epic**: `EPIC-047` — Engineering Experts

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "EPIC-047 Engineering Experts — rank 5 of `specs/brs-v2-gap-ranking.md`.
Register AI engineering roles as governed Engineering Experts (`BR-0101`); each Expert defines a
versioned contract (`BR-0102`); governed delegation, each delegated session attributable and linked
to its parent (`BR-0105`); enforceable time, resource, token and cost limits where the provider
exposes them (`BR-0106`); tasks may be assigned to humans or Experts according to capability and
policy (`BR-0152`, folded in per ranking decision 3)."

> **Ownership.** PMI-DOC-004 v2.0 §6.11 assigns `BR-0101` and `BR-0105` to **`EPIC-028`**
> *(assigned 2026-08-25)*. `EPIC-028` closed at 102 / 102 tasks with neither requirement in its
> `spec.md`: it delivered the provider-neutral agent seam (`AgentDescriptor`, `AgentGateway`), not
> the governed role on top of it. This Epic **takes over** `BR-0101` and `BR-0105`, and owns the
> unowned `BR-0102`, `BR-0106` and `BR-0152`. `BR-0103` (provider independence) and `BR-0104`
> (session record) stay with `EPIC-028` and `EPIC-037`; this Epic **consumes** them. The BRS
> owner annotations are updated when this Epic is accepted into the stage register, not before.
>
> **This Epic is declared from a PROPOSED ranking.** `specs/brs-v2-gap-ranking.md` declares
> nothing and asks for Project Owner review; this specification is the declaration it deferred to
> `/speckit-specify`. Its decisions 3 (fold `BR-0152` in here) and 1–2 (finish `EPIC-032` and
> `EPIC-031` first) are taken as accepted — both Epics have open pull requests.

## Clarifications

### Session 2026-10-09

- Q: Should this new Epic take over the Expert registry (`BR-0101`) and delegation (`BR-0105`) from
  the closed `EPIC-028`, or should `EPIC-028` be reopened? → A: **`EPIC-047` takes both over**; the
  PMI-DOC-004 §6.11 owner annotations are updated when this Epic is accepted into the register.
- Q: When an Expert runs inside an external tool that the platform cannot intercept, how strictly
  are allowed tools and prohibited actions enforced? → A: **At dispatch, plus whatever the provider
  reports**; anything the provider cannot report is recorded as **unobserved** — never as enforced
  (`FR-EXP-024`).
- Q: When a provider cannot enforce a limit the contract sets, should the run go ahead or be
  refused? → A: **Per-contract posture per limit; by default token and cost limits refuse
  dispatch, time and resource limits proceed and record** (`FR-EXP-043`).
- Q: Should an Expert remember anything across sessions in this Epic? → A: **No.** The memory
  policy is declared, but its only accepted value here is `none`; any other value is deferred to
  Governed Learning (rank 7, unowned) (`FR-EXP-020`).
- Q: Can people create and edit Expert contracts in the Engineering Experts screen? → A: **View
  only.** Contracts are authored through the API and approved in `EPIC-031`'s Decision Inbox;
  in-screen authoring waits for administrator roles (`FR-EXP-076`).

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.11 `BR-0101` — Expert registry | FR-EXP-001 to FR-EXP-008 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.11 `BR-0102` — Expert contract | FR-EXP-010 to FR-EXP-022 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.11 `BR-0105` — Delegation | FR-EXP-030 to FR-EXP-037 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.11 `BR-0106` — Cost and time limits | FR-EXP-040 to FR-EXP-046 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.16 `BR-0152` — Execution assignment | FR-EXP-050 to FR-EXP-056 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.11 `BR-0103`, `BR-0104`, `BR-0061` (consumed, not owned) | FR-EXP-023, FR-EXP-060 to FR-EXP-063 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §4 — **Delivery › Engineering Experts** area | FR-EXP-070 to FR-EXP-075 |
| `adr/ADR-0020-engineering-expert-model.md` | Decision — extend `AgentDescriptor`, do not replace it | FR-EXP-002, FR-EXP-010 |
| `adr/ADR-0027-durable-agent-session.md` | Rules 2 and 4 — attributable delegation; budgets against the session | FR-EXP-031, FR-EXP-040 |
| `.specify/memory/constitution.md` | XII — Execution Registration | FR-EXP-060, FR-EXP-061 |

**Requirements not yet covered by SRS**: none. The screen requirements (`FR-EXP-070`–`075`) derive
from PMI-DOC-006's area map and the shared shell pattern (`UX-0031`, `UX-0032`, `UX-0040`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | This document precedes any Expert implementation |
| PP-002 | Single Source of Truth | Satisfied | `FR-EXP-016` — the contract references the Evidence Contract (`EPIC-032`) and context policy (`EPIC-038`) rather than restating them |
| PP-003 | Human-in-the-Loop | Satisfied | `FR-EXP-005` — a contract version is approved through `EPIC-031`'s decision path before anything runs under it; `FR-EXP-053` — assignment never dispatches by itself |
| PP-004 | End-to-End Traceability | Satisfied | `FR-EXP-060` — every Expert run names the contract version it ran under, through `EPIC-037` |
| PP-005 | Modular Architecture | Satisfied | Policy, evidence, context, execution and tasks are ports owned elsewhere; this Epic owns the role, its contract, delegation and limits |
| PP-006 | Engine Independence | Satisfied | `FR-EXP-023` — an Expert names models and capabilities, never a vendor-bound runtime; `BR-0103` is preserved |
| PP-007 | API & MCP First | Satisfied | Every capability is callable without the screen |
| PP-008 | Security by Design | Satisfied | `FR-EXP-013`, `FR-EXP-014` — permissions and prohibited actions are enforced at dispatch; `FR-EXP-034` — delegation never widens authority |
| PP-009 | Quality by Design | Satisfied | `SC-EXP-003` and `SC-EXP-004` are mutation-tested |
| PP-010 | Observability by Default | Partial | Dispatch refusals and limit breaches are recorded as execution events; dashboards → `EPIC-040` |
| PP-011 | Documentation as Code | Satisfied | A contract is a versioned, machine-readable record, not a prompt in prose |
| PP-012 | Everything Versioned | Satisfied | `FR-EXP-004` — contract versions are immutable once approved |
| PP-013 | Knowledge-Driven Engineering | Satisfied | `FR-EXP-015` — each Expert's context policy is an `EPIC-038` assembly input |
| PP-014 | Configuration over Customization | Satisfied | Experts, contracts, delegation policy and limits are configuration |
| PP-015 | Open Standards | Partial | Contract fields follow `ADR-0020`; no external agent-description standard is adopted |
| PP-016 | Explainable AI | Satisfied | `FR-EXP-052` — every assignment and every dispatch refusal records the rule that decided it |
| PP-017 | Cost-Aware AI | Satisfied | `BR-0106` is owned here — `FR-EXP-040`–`FR-EXP-046` |
| PP-018 | Scalability First | Partial | Delegation fan-out is bounded (`FR-EXP-033`); volume targets land in `plan.md` |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Expert performance comparison → `EPIC-040` (Metrics & Reporting) |
| PP-020 | Customer Value | Satisfied | `SC-EXP-006` — a reviewer answers *"who ran this, under what rules, and who delegated it?"* from the record alone |

**Deferral count**: 1 — `PP-019` → `EPIC-040`, restated in the closing report.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An AI role is a registered, governed Expert, not a model and a prompt (Priority: P1)

**`BR-0101`, `BR-0102`.** An engineering lead registers an Engineering Expert — for example
*Test Engineer* — and defines its contract: role and purpose, preferred and fallback models, allowed
tools and capabilities, context policy, workspace requirements, permissions, prohibited actions,
risk class, budget, memory policy, expected outputs and Evidence Contract. The contract is approved
before any work runs under it.

**Why this is P1 and the MVP**: every other story is a property of a registered Expert. Without the
registry there is nothing to delegate, limit or assign.

**Independent test**: register an Expert with a complete contract, approve it, and confirm a run
can be dispatched under it — and that an incomplete or unapproved contract cannot be.

**Acceptance scenarios**

1. **Given** a contract missing any of the twelve required elements, **When** it is submitted,
   **Then** it is rejected, naming each missing element.
2. **Given** a complete contract, **When** it is submitted, **Then** it is recorded as a draft
   version and **no run may be dispatched under it** until it is approved.
3. **Given** an approved contract version, **When** it is changed, **Then** a new version is
   created; the approved version is unchanged and runs already made under it still name it.
4. **Given** an Expert whose contract names an Evidence Contract or context policy that does not
   exist, **When** it is submitted, **Then** it is rejected naming the dangling reference.
5. **Given** an Expert that is retired, **When** a run is requested, **Then** it is refused; its
   history remains inspectable.
6. **Given** an actor without an edit grant on the registry, **When** they register or change an
   Expert or the delegation policy, **Then** it is refused — and they can still read the registry
   if they hold read.

### User Story 2 - A run cannot do what its Expert's contract forbids (Priority: P1)

**`BR-0102`.** When work is dispatched to an Expert, the platform checks the request against the
approved contract — capabilities, tools, permissions, prohibited actions, workspace requirements
and the provider's ability to honour them — and refuses anything outside it.

**Why P1**: a contract that is recorded but not enforced is documentation. The failure it permits is
invisible: the run looks governed, and was not.

**Independent test**: dispatch a request that needs a tool the contract does not allow, and confirm
it is refused before anything executes, with the refusal recorded.

**Acceptance scenarios**

1. **Given** a request requiring a capability or tool outside the contract, **When** it is
   dispatched, **Then** it is refused before execution, naming the capability or tool.
2. **Given** a request touching an action on the contract's prohibited list, **When** it is
   dispatched, **Then** it is refused, and the refusal is a recorded execution event.
3. **Given** the preferred model is unavailable and a fallback is declared, **When** the run is
   dispatched, **Then** it runs on the fallback **and records that it did and why**.
4. **Given** neither the preferred nor any fallback model is available, **When** the run is
   dispatched, **Then** it is refused — never silently run on an undeclared model.
5. **Given** a workspace that does not meet the contract's workspace requirements, **When** the run
   is dispatched, **Then** it is refused naming the unmet requirement.

### User Story 3 - Delegated work stays attributable (Priority: P1)

**`BR-0105`.** An Expert may delegate to a sub-agent or another Expert where policy permits. Each
delegated session is its own record, linked to the session that delegated it.

**Why P1**: a tree of work that resolves to one record is not auditable (`ADR-0027` rule 2). And a
delegation that can widen authority is a way around every other rule in this Epic.

**Independent test**: run an Expert that delegates twice, and reconstruct the full tree — who
delegated what to whom, under which contract — from the records alone.

**Acceptance scenarios**

1. **Given** an Expert whose contract and policy permit delegation to a named Expert, **When** it
   delegates, **Then** a separate session record is created, linked to its parent, naming the
   delegate's own contract version.
2. **Given** a delegation the policy does not permit, **When** it is attempted, **Then** it is
   refused and the refusal recorded on the parent session.
3. **Given** a delegate whose contract allows more than its parent's, **When** it runs as a
   delegate, **Then** its effective authority is the **intersection** of the two — delegation never
   widens what the originating request was allowed to do.
4. **Given** a delegation chain at the configured maximum depth, **When** a further delegation is
   attempted, **Then** it is refused.
5. **Given** a parent session's budget, **When** delegates consume tokens, cost or time, **Then**
   the consumption counts against the parent's budget as well as their own.

### User Story 4 - A session cannot spend more than it was given (Priority: P2)

**`BR-0106`.** Sessions carry enforceable time, resource, token and cost limits, enforced where the
underlying provider exposes the necessary controls.

**Independent test**: run a session whose limit is reached mid-run, and confirm it is stopped and
recorded as stopped by the limit.

**Acceptance scenarios**

1. **Given** a session whose provider exposes a control for a limit, **When** the limit is
   reached, **Then** the session is stopped and its outcome records which limit stopped it.
2. **Given** a provider that does not expose a control for a limit the contract sets, **When** the
   run is dispatched, **Then** the session record states that limit as **unenforceable for this
   provider** — never as enforced — and the dispatch follows the contract's stated posture for
   unenforceable limits.
3. **Given** a session's consumption cannot be reported by its provider, **When** the session
   ends, **Then** consumption reads *not reported with a reason*, distinct from zero.
4. **Given** a request whose own limits exceed the Expert's contract, **When** it is dispatched,
   **Then** the contract's limits apply, and the narrowing is recorded.

### User Story 5 - Work goes to a human or an Expert by capability and policy (Priority: P2)

**`BR-0152`.** A task may be assigned to a person or to an Engineering Expert. Assignment to an
Expert is allowed only where the Expert's capabilities match the task and policy permits it.

**Independent test**: assign a task to an Expert lacking the needed capability, and confirm it is
refused with the reason; assign it to one that has it, and confirm the assignment is recorded but
nothing runs until it is dispatched.

**Acceptance scenarios**

1. **Given** a task and an Expert whose capabilities cover it, **When** the task is assigned,
   **Then** the assignment is recorded with the rule that permitted it.
2. **Given** an Expert whose capabilities do not cover the task, **When** assignment is attempted,
   **Then** it is refused, naming the missing capability.
3. **Given** a task whose risk class exceeds what policy allows an Expert to take unattended,
   **When** it is assigned to an Expert, **Then** the assignment requires a human decision through
   `EPIC-031` before it stands.
4. **Given** a task assigned to an Expert, **When** the assignment is recorded, **Then** nothing
   executes; dispatch is a separate governed act.
5. **Given** a reassignment between a person and an Expert, **When** it happens, **Then** the
   earlier assignment remains in the task's history.

### User Story 6 - A reviewer can see the roster and what each Expert may do (Priority: P3)

**PMI-DOC-006 §4 — Delivery › Engineering Experts.** A screen lists Experts, opens one, and shows its
current contract, its version history, and its recent runs and delegations.

**Independent test**: open an Expert with two contract versions and a delegated run, and read both
versions and the delegation tree on the screen.

**Acceptance scenarios**

1. **Given** registered Experts, **When** the area is opened, **Then** each shows its role, risk
   class, approved contract version and status.
2. **Given** an Expert with several contract versions, **When** it is opened, **Then** the versions
   are listed and any two can be compared.
3. **Given** a run that delegated, **When** it is opened from the Expert, **Then** its delegation
   tree is visible without opening another screen.

### Edge Cases

- **A contract version is approved while a run under the previous version is in flight.** The run
  finishes under the version it started with; the record names that version, not the newer one.
- **An Expert delegates to itself.** Refused as a cycle — as is any delegation chain that revisits
  an Expert already in it.
- **A delegate outlives its parent** (parent cancelled or timed out). The delegate is stopped, and
  its record names the parent's end as the reason.
- **An Expert's Evidence Contract is retired after approval.** New runs are refused until the
  contract is re-versioned; runs already recorded are unaffected.
- **A provider reports consumption late** — after the limit was already exceeded. The breach is
  recorded as detected late, with the instant it was detected; it is never reported as prevented.
- **A task's assignee Expert is retired.** The assignment remains in history and is marked as
  pointing at a retired Expert; the task shows as needing reassignment.

## Requirements *(mandatory)*

### Functional Requirements

**Registry (`BR-0101`)**

- **FR-EXP-001**: The platform MUST maintain a registry of Engineering Experts per workspace.
- **FR-EXP-002**: An Expert MUST extend the existing agent descriptor (`ADR-0020`) rather than
  introduce a second notion of an agent.
- **FR-EXP-003**: An Expert MUST have a stable identity independent of the models and providers its
  contract names.
- **FR-EXP-004**: An Expert's contract MUST be versioned. An approved version MUST be immutable;
  changing it MUST create a new version.
- **FR-EXP-005**: A contract version MUST be approved through `EPIC-031`'s decision path before any
  run is dispatched under it. The approval authority MUST follow the contract's risk class.
- **FR-EXP-006**: An Expert MUST be retirable. A retired Expert MUST NOT accept new runs or
  assignments; its history MUST remain inspectable.
- **FR-EXP-007**: Registering, versioning, approving and retiring an Expert MUST each be recorded
  with the actor and instant.
- **FR-EXP-008**: Experts MUST be isolated by workspace; an Expert registered in one workspace MUST
  NOT be dispatchable from another.
- **FR-EXP-009**: Registering, versioning, submitting and retiring an Expert, and changing the
  delegation policy, MUST require an `EPIC-024` **edit** grant on the workspace's `expert-registry`
  artifact; reading the registry MUST require **read**. Assigning a task MUST require edit on that
  task. Until administrator roles exist (`DEF-038-005`), the grant is the authority — no workspace
  member authors an Expert's permissions merely by belonging to the workspace.

**Contract (`BR-0102`)**

- **FR-EXP-010**: A contract MUST define all of: role and purpose; preferred and fallback models;
  allowed tools and capabilities; context policy; workspace requirements; permissions; prohibited
  actions; risk class; budget; memory policy; expected outputs; and Evidence Contract.
- **FR-EXP-011**: A contract missing any required element MUST be rejected, naming every missing
  element.
- **FR-EXP-012**: Dispatch MUST refuse a request needing a capability or tool outside the approved
  contract, before anything executes.
- **FR-EXP-013**: Dispatch MUST refuse a request touching a prohibited action. Prohibitions MUST
  take precedence over any allowance.
- **FR-EXP-014**: A run's permissions MUST be the contract's permissions intersected with the
  requesting actor's (`EPIC-024`). An Expert MUST NOT be a route to authority its requester lacks.
- **FR-EXP-015**: The context policy MUST be supplied to `EPIC-038`'s assembly as an input; this
  Epic MUST NOT assemble context itself.
- **FR-EXP-016**: The Evidence Contract MUST reference `EPIC-032`'s Evidence Contract by identity
  and version, and MUST NOT restate it.
- **FR-EXP-017**: Where the preferred model is unavailable, the run MUST use a declared fallback and
  record which and why. A run MUST NOT use an undeclared model.
- **FR-EXP-018**: Where no declared model is available, dispatch MUST refuse.
- **FR-EXP-019**: Dispatch MUST refuse when the workspace does not meet the contract's workspace
  requirements, naming the unmet requirement.
- **FR-EXP-020**: The memory policy MUST be declared, and in this Epic its only accepted value is
  **`none`** — a session retains nothing beyond itself *(clarified 2026-10-09)*. A contract
  declaring any other value MUST be rejected, naming Governed Learning as where cross-session
  memory is decided. The platform MUST NOT persist session memory.
- **FR-EXP-021**: Expected outputs MUST be checked when a run ends; a run that did not produce a
  required output MUST be recorded as incomplete, not succeeded.
- **FR-EXP-022**: A contract referencing an Evidence Contract, context policy or delegate Expert that
  does not exist MUST be rejected naming the dangling reference.
- **FR-EXP-023**: A contract MUST name models and capabilities, never a provider-specific runtime,
  so the same Expert executes through any compatible provider (`BR-0103`, consumed).
- **FR-EXP-024**: Tool and action enforcement MUST apply at dispatch and to every tool call the
  provider reports *(clarified 2026-10-09)*. Where a provider cannot report its tool calls, the
  session record MUST mark tool use as **unobserved**; it MUST NOT be recorded as enforced. A
  reported call outside the contract MUST stop the session where the provider allows it, and MUST
  be recorded as a breach either way.

**Delegation (`BR-0105`)**

- **FR-EXP-030**: An Expert MAY delegate to a sub-agent or another Expert only where its contract
  and the workspace's delegation policy both permit it.
- **FR-EXP-031**: Each delegated session MUST be its own record, linked to its parent and naming its
  own Expert and contract version (`ADR-0027` rule 2).
- **FR-EXP-032**: A refused delegation MUST be recorded on the parent session with its reason.
- **FR-EXP-033**: Delegation depth and fan-out MUST be bounded by configuration.
- **FR-EXP-034**: A delegate's effective authority MUST be the intersection of its own contract and
  every ancestor's. Delegation MUST NOT widen authority.
- **FR-EXP-035**: A delegation cycle MUST be refused.
- **FR-EXP-036**: Consumption by a delegate MUST count against every ancestor's budget.
- **FR-EXP-037**: When a parent session ends, its running delegates MUST be stopped and recorded as
  stopped by the parent's end.

**Limits (`BR-0106`)**

- **FR-EXP-040**: A session MUST carry time, resource, token and cost limits, enforced against the
  session (`ADR-0027` rule 4). **Resource** means the **maximum number of tool calls** in the
  session; it is enforceable only where the provider reports tool calls (`FR-EXP-024`).
- **FR-EXP-041**: Where the provider exposes a control for a limit, the platform MUST enforce it and
  stop the session when it is reached, recording which limit stopped it.
- **FR-EXP-042**: Where the provider does not expose a control for a limit, the session record MUST
  state the limit as **unenforceable for this provider**. It MUST NOT be recorded as enforced.
- **FR-EXP-043**: A contract MUST state, per limit, its posture for an unenforceable limit —
  **refuse dispatch** or **proceed and record** — and dispatch MUST follow it. Where a contract
  states none, the default MUST be **refuse dispatch** for token and cost limits and **proceed and
  record** for time and resource limits *(clarified 2026-10-09)*.
- **FR-EXP-044**: Where a request's limits exceed the contract's, the contract's MUST apply and the
  narrowing MUST be recorded.
- **FR-EXP-045**: Consumption a provider cannot report MUST read *not reported with a reason*,
  distinct from zero.
- **FR-EXP-046**: A breach detected after the fact MUST be recorded as detected late, with the
  instant of detection — never as prevented.

**Assignment (`BR-0152`)**

- **FR-EXP-050**: A task MAY be assigned to a person or to an Engineering Expert.
- **FR-EXP-051**: Assignment to an Expert MUST be refused where the Expert's capabilities do not
  cover the task, naming the missing capability.
- **FR-EXP-052**: Every assignment MUST record the rule that permitted it.
- **FR-EXP-053**: Assignment MUST NOT dispatch. Running the work is a separate governed act.
- **FR-EXP-054**: Where the task's risk class exceeds what policy lets an Expert take, the assignment
  MUST require a human decision through `EPIC-031` before it stands.
- **FR-EXP-055**: Reassignment MUST preserve earlier assignments in the task's history.
- **FR-EXP-056**: Assignment MUST use `EPIC-046`'s task store; this Epic MUST NOT keep a second task
  record.

**Execution record (`BR-0104`, `BR-0061`, Constitution XII — consumed)**

- **FR-EXP-060**: Every Expert run MUST be registered with `EPIC-037` before it begins, naming the
  Expert and contract version.
- **FR-EXP-061**: Dispatch refusals, fallbacks, limit stops and delegation refusals MUST be recorded
  as events on that execution, not in a separate log.
- **FR-EXP-062**: An Expert run in progress MUST continue under the contract version it started
  with, whatever is approved meanwhile.
- **FR-EXP-063**: Where an Expert session runs unattended, its output MUST enter verification and
  review (`BR-0061`, `EPIC-023`) rather than bypass release controls: the session is recorded as
  **requiring review**, and its completion is **proposed** through `EPIC-037`, never applied by the
  Expert.

**The Engineering Experts screen** *(PMI-DOC-006 §4, Delivery group)*

- **FR-EXP-070**: Engineering Experts MUST be presented in their own application area in the
  Delivery group, as a **view-only** registry screen, **not** a governed Room. Contract approval runs through
  `EPIC-031`'s Decision Inbox, not a workflow declared here.
- **FR-EXP-071**: The screen MUST list Experts with role, risk class, approved version and status.
- **FR-EXP-072**: The screen MUST show an Expert's contract, its versions, and a comparison of any
  two versions.
- **FR-EXP-073**: The screen MUST show an Expert's recent runs and, for a run that delegated, its
  delegation tree without opening another screen (`UX-0032`).
- **FR-EXP-074**: Enforced and unenforceable limits MUST be visually distinguishable (`UX-0031`).
- **FR-EXP-075**: Contract, status and delegation MUST remain readable at a 360px viewport
  (`UX-0040`).
- **FR-EXP-076**: Contracts MUST be authored, versioned and retired through the API, and approved
  in `EPIC-031`'s Decision Inbox. The screen MUST NOT offer authoring *(clarified 2026-10-09)* —
  in-screen authoring waits for administrator roles, as `DEF-038-007` records for context
  configuration.

### Key Entities

- **Engineering Expert** — a registered governed AI role in one workspace, with a stable identity.
  Extends the agent descriptor; never replaces it.
- **Expert Contract Version** — the twelve required elements, immutable once approved, with its
  approval decision.
- **Delegation Policy** — workspace configuration: which Experts may delegate to which, maximum depth
  and fan-out.
- **Delegation Link** — the parent-to-child edge between two sessions, naming both contract
  versions and the effective (intersected) authority.
- **Session Limit** — one limit on one session: its value, whether it was enforced or unenforceable
  for the provider, and whether it was reached.
- **Assignment** — a task's assignee (person or Expert), the rule that permitted it, and any decision
  it required. Recorded **beside** the task, in the same database, referencing `EPIC-046`'s task —
  never a second copy of the task.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-EXP-001**: **100%** of Expert runs name an approved contract version; **zero** runs are
  dispatched under a draft, unapproved or retired contract.
- **SC-EXP-002**: **100%** of contracts in the registry define all twelve required elements.
- **SC-EXP-003**: **Zero** runs execute a capability, tool or prohibited action outside their
  contract — mutation-tested by removing the dispatch check and observing the suite fail.
- **SC-EXP-004**: **Zero** delegations widen authority — mutation-tested by replacing the
  intersection with the delegate's own contract and observing the suite fail.
- **SC-EXP-005**: **100%** of delegated sessions are separately recorded and linked to their parent;
  any delegation tree is reconstructable from the records alone.
- **SC-EXP-006**: A reviewer can answer *"who ran this, under what rules, and who delegated it?"*
  from the record alone, without asking the person who started it.
- **SC-EXP-007**: **Zero** limits are recorded as enforced for a provider that could not enforce
  them; **zero** unreported consumptions read as zero.
- **SC-EXP-008**: **Zero** task assignments to an Expert lack a recorded permitting rule, and
  **zero** assignments start execution by themselves.

## Assumptions

1. **`BR-0101` and `BR-0105` are taken over from `EPIC-028`** — *confirmed 2026-10-09*. The 2026-08-25 assignment was never
   reflected in `EPIC-028`'s requirements and that Epic is closed. Reopening a closed Epic to add a
   governed registry would put two concerns — the seam and the role — in one convergence gate.
2. **The session record is `EPIC-037`'s execution, not a new record here.** `BR-0104` stays with
   its owners; this Epic adds the Expert, contract version, delegation link and limits to what is
   recorded. A second session record would be a second answer to *"what ran?"*.
3. **Contract approval reuses `EPIC-031`.** The contract's risk class selects the approval band,
   so a low-risk Expert is not held to the ceremony of a high-risk one. No workflow type is declared
   here.
4. **Unenforceable limits are a per-contract posture** — *confirmed 2026-10-09* (`FR-EXP-043`), defaulting to **refuse
   dispatch** for cost and token limits and **proceed and record** for time and resource limits.
   `ADR-0027` requires the absence to be recorded; it does not say whether to run. The default is
   the safer choice where money is at stake.
5. **Enforcement is at dispatch and at the seam** — *confirmed 2026-10-09* (`FR-EXP-024`). A provider that executes outside the platform
   (an external IDE agent) can be refused or stopped, but its individual tool calls cannot be
   intercepted unless the provider reports them. Tool and action enforcement is therefore applied
   to what the request declares and what the provider reports; anything a provider cannot report is
   recorded as unobserved.
6. **Assignment never dispatches** (`FR-EXP-053`). Constitution XII makes registration precede
   execution, and an assignment that ran work would make a field edit into an execution.
7. **No cross-session memory, and no in-screen authoring** — *both clarified 2026-10-09*. Each
   narrows this Epic deliberately: memory to Governed Learning (`FR-EXP-020`), authoring to a
   later Epic that introduces administrator roles (`FR-EXP-076`).

**Dependencies**: `EPIC-028` (agent seam and descriptor), `EPIC-024` (access), `EPIC-031` (decision
and policy — **open PR**), `EPIC-032` (Evidence Contracts — **open PR**), `EPIC-037` (execution
registry), `EPIC-038` (context policy as an assembly input — **open PR**), `EPIC-046` (task store),
`EPIC-023` (unattended execution), `EPIC-036` (application shell).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/047-engineering-experts/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`FR-EXP-012`/`FR-EXP-013` are mutation-tested**: the dispatch contract check is removed and
      the suite observed failing (`SC-EXP-003`)
- [ ] **`FR-EXP-034` is mutation-tested**: delegation authority is widened to the delegate's own
      contract and the suite observed failing (`SC-EXP-004`)
- [ ] The PMI-DOC-004 §6.11 owner annotations for `BR-0101` and `BR-0105` name `EPIC-047`
