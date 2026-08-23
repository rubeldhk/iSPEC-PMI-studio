# Epic Specification: Decision & Policy Engine

**Epic**: `EPIC-031` | **Module**: Decision Center — the **Decide** stage of the Governed Engineering Loop, shared by all three Rooms

**Feature Branch**: `epic/031-decision-policy-engine`

**Created**: 2026-08-22

**Status**: Draft

**Authorised by**: PMI-DOC-004 v2.0 **APPROVED 2026-08-22**, which makes `BR-0066`–`BR-0069`,
`BR-0174` and `BR-0192` first-class requirements; [`ADR-0025`](../../adr/ADR-0025-risk-adaptive-policy-engine.md)
**Accepted 2026-08-21**; Wave 1 of PMI-DOC-004A §13.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — nothing holds this Epic. Unlike the loop it plugs into, its governing decision
> `ADR-0025` is **Accepted**, not Open: the three bands, the four binding constraints and the
> policy-declared classification rule are settled before a line is planned. Readiness still runs
> through the Definition-of-Ready gate, not by declaration (EPIC-026).

**Input**: User description: "Build the risk-adaptive decision and policy engine, and the Decision
Inbox it feeds. This is the Decide stage of the Governed Engineering Loop, not a parallel mechanism —
Rooms must not each carry their own policy logic."

## Clarifications

### Session 2026-08-22

Three questions, all answered with the recommended option, in a consolidated round covering
`EPIC-031` to `EPIC-035` (Constitution X).

- Q: Should risk-classification rules live in the existing `BR-0070` steering hierarchy, or in a separate policy artifact? -> A: **The `BR-0070` steering hierarchy** (`FR-DPE-005`). This is the question `ADR-0025` left open and named `U-07` as the decider of. Its own Consequences already argued for it -- *"treating classification rules as reviewed artifacts under `BR-0070` steering, not as configuration"* -- and `BR-0071` steering-conflict resolution solves the scope-precedence problem a separate artifact would have had to re-solve. **Consequence for `EPIC-019`**: classification rules become a steering *subject*, so `EPIC-019` owns their storage, scoping and conflict resolution while this Epic owns their meaning.
- Q: Should this Epic define the `BR-0005` decision-authority record now, given `U-02` is unowned? -> A: **Yes -- as a published contract this Epic owns provisionally** (`FR-DPE-014`), which `U-02` adopts unchanged when declared. The same pattern `EPIC-030` used for its five ports: publish the shape, let the owner fill it. Waiting would block this Epic on an undeclared one; inventing a private record would give `BR-0005` two definitions.
- Q: Should *changing a loop instance configuration* join the non-configurable high band explicitly? -> A: **Yes** (`FR-DPE-012`). `EPIC-030`'s `FR-GEL-016`, clarified the same day, makes it permanently high band -- but **this Epic is the one that enforces bands**. If `FR-DPE-012` does not name it, nothing does.

**Deferred, deliberately.** Engine availability and latency targets (`PP-018`) and the enumeration
of "consequential" actions are plan-level. The PMI-DOC-006 approval is an act of the project owner,
not an ambiguity in this specification.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0066` — Risk classification | FR-DPE-001 to FR-DPE-006 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0067` — Risk-adaptive approval | FR-DPE-010 to FR-DPE-016 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0068` — Decision Inbox | FR-DPE-020 to FR-DPE-025 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0069` — Automation triggers | FR-DPE-030 to FR-DPE-033 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.18 `BR-0174` — Policy explainability | FR-DPE-040 to FR-DPE-044 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.20 `BR-0192` — Decision visibility | FR-DPE-021, FR-DPE-026 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §7 `RULE-03`, `RULE-04`, `RULE-11` | FR-DPE-011, FR-DPE-031, FR-DPE-040 |
| [`adr/ADR-0025-risk-adaptive-policy-engine.md`](../../adr/ADR-0025-risk-adaptive-policy-engine.md) | Decision — three bands and four binding constraints | FR-DPE-010 to FR-DPE-013, FR-DPE-050 |
| [`adr/ADR-0015-requirement-change-defect-governance-authority.md`](../../adr/ADR-0015-requirement-change-defect-governance-authority.md) | Decision — approval thresholds and the decision-authority record | FR-DPE-014, FR-DPE-015 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §5 `UX-0021` Decision Inbox; §6.2 `UX-0032`, `UX-0033` | FR-DPE-020, FR-DPE-026, FR-DPE-043 |

**Requirements not yet covered by SRS**: **None.** Every requirement traces to an approved `BR-` in
PMI-DOC-004 v2.0 or to the Accepted `ADR-0025`. `FR-DPE-020`/`026`/`043` additionally cite
PMI-DOC-006 v1.0, which is **PROPOSED, not approved** — the back-fill owner is named under
Assumptions.

### Ownership notes — read before planning

**This Epic owns six requirements**: `BR-0066`, `BR-0067`, `BR-0068`, `BR-0069`, `BR-0174`,
`BR-0192` — the whole of capability area `U-07` as `brs-v2-reconciliation.md` §4 defines it. That
register assigns `U-07` to *"a new epic — Decision Center, shared by all three Rooms"*, which is
this Epic.

Four further requirements are cited and **none is claimed**:

| Cited | Owner | Why it appears here |
|---|---|---|
| `BR-0060` Review gates | `EPIC-021` | policy decides *whether* a gate applies; `EPIC-021` owns the gate and its approvers. Constraint 2 of `ADR-0025` binds both |
| `BR-0005` Decision authority | **unowned** (`U-02`) | every approval this engine records must identify actor, authority basis, object version, decision and timestamp. This Epic **consumes that contract and must not invent a second one** — see Assumptions |
| `BR-0111` Immutable audit | `EPIC-004` | constraint 4 — auto-execution is still audited. This Epic emits into that store |
| `BR-0070` Hierarchical steering | `EPIC-019` | `ADR-0025` leaves **Open** whether classification rules live in the steering hierarchy or a separate policy artifact, and says *"the owning epic (`U-07`) decides"*. That is this Epic, and the decision is listed in Epic Exit Criteria |

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | `ADR-0025` was Accepted before this Epic was declared; the engine implements a decided policy model rather than discovering one |
| PP-002 | Single Source of Truth | Satisfied | one policy engine for every Room (`FR-DPE-051`); `ADR-0025` — *"Rooms do not each get their own policy logic"* |
| PP-003 | Human-in-the-Loop | Satisfied | this is the principle the Epic exists to make *tunable without weakening*: constraint 1 fences what tuning can reach (`FR-DPE-012`) |
| PP-004 | End-to-End Traceability | Satisfied | every decision links the action, its risk class, the policy version that judged it and the resulting record (`FR-DPE-041`) |
| PP-005 | Modular Architecture | Satisfied | the engine is the loop's **Decide** stage behind one seam, not a mechanism beside it |
| PP-006 | Engine Independence | Not applicable | no specification-engine surface |
| PP-007 | API & MCP First | Partial | the Decision Inbox and the decide call are API surfaces; MCP exposure lands with `EPIC-013` `BR-0122` |
| PP-008 | Security by Design | Satisfied | misclassification is a **security-relevant defect class** by `ADR-0025`'s own Consequences; `FR-DPE-004` answers it with fail-closed defaults and `FR-DPE-005` with reviewed classification rules |
| PP-009 | Quality by Design | Satisfied | every constraint is asserted by an executable check; `FR-DPE-012` and `FR-DPE-040` are required to be mutation-tested at exit |
| PP-010 | Observability by Default | Satisfied | decision volume, band distribution and auto-execution rate are emitted; without them nobody can tell a well-tuned tenant from a disarmed one |
| PP-011 | Documentation as Code | Satisfied | policy and classification rules are versioned, reviewable content (`FR-DPE-005`) |
| PP-012 | Everything Versioned | Satisfied | a decision names the policy version that produced it, and that version stays readable (`FR-DPE-041`) |
| PP-013 | Knowledge-Driven Engineering | Satisfied | the classification ruleset is reusable organizational knowledge, and `ADR-0025` requires it be treated as a reviewed artifact rather than as configuration |
| PP-014 | Configuration over Customization | Satisfied | approval burden is tunable per tenant by policy, never by forking the engine (`FR-DPE-011`) |
| PP-015 | Open Standards | Not applicable | no external policy standard is adopted; the choice is recorded in this Epic's plan |
| PP-016 | Explainable AI | Satisfied | `BR-0174` is a requirement this Epic **owns**: an unexplainable allow is a defect, not a warning (`FR-DPE-040`) |
| PP-017 | Cost-Aware AI | Not applicable | the engine invokes no model. An Expert may *propose* a class; the engine does not ask one to |
| PP-018 | Scalability First | Partial | `ADR-0025` names availability and latency as product concerns because the engine sits on the critical path of every governed action. Targets are recorded in this Epic's plan |
| PP-019 | Continuous Improvement | Satisfied | band distribution over time is the evidence that `RULE-04` is working rather than merely permitted |
| PP-020 | Customer Value | Satisfied | `BG-02` — low-risk automation that stops waiting on humans is most of the productivity claim |

**Deferral count**: **0.** Two principles are Partial and name where their remainder lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A high-risk action stays human-approved however the tenant configures policy (Priority: P1)

A workspace administrator turns tenant policy as permissive as the product allows. They then attempt
to have a baseline change auto-approved. It is refused. The high band is not reachable by
configuration, and the refusal says so.

**Why this priority**: this is constraint 1 of `ADR-0025`, and it is the reason the whole risk-adaptive
model is safe enough to adopt. `ADR-0025` states the failure mode in one line: *"'Risk-adaptive' is
one bad default away from 'the AI decided it was low risk and shipped it'."* If the high band can be
configured away, every other requirement in this Epic is a preference.

**Independent Test**: enumerate every tenant-reachable policy setting and assert that no combination
moves a high-risk action out of human approval. Testable with no Room and no loop instance beyond a
stub.

**Acceptance Scenarios**:

1. **Given** the most permissive tenant policy the product allows, **When** an action classified high
   is submitted, **Then** it requires authorized human approval and the response names the constraint
   that made it non-negotiable.
2. **Given** a policy document attempting to declare a baseline change as low risk, **When** it is
   loaded, **Then** the policy is refused at load time and names the action it tried to downgrade.
3. **Given** an action PMI-DOC-004 marks as requiring authorized human decision, **When** any policy
   is applied to it, **Then** its band remains high — release promotion and baseline change included.

---

### User Story 2 - Low-risk work stops waiting for a human who adds nothing (Priority: P1)

An engineer triggers a routine, reversible, policy-permitted action. It executes without an approval
step, and it still produces an audit record and its required evidence.

**Why this priority**: `RULE-04` — *risk-adaptive, not approval-everywhere*. `ADR-0025` records that
uniform approval *"taxes trivial automation at the same rate as a production release"*. Without this
story the Epic delivers only new refusals, and `BG-02` collects nothing.

**Independent Test**: submit a low-band action under a permitting policy; assert it executes with no
human decision, and assert an audit record and evidence reference exist afterwards.

**Acceptance Scenarios**:

1. **Given** a low-risk action and a policy permitting auto-execution, **When** it is submitted,
   **Then** it executes with no human in the loop.
2. **Given** that same auto-executed action, **When** the audit trail is read, **Then** the action,
   its band, the policy version and its evidence are all present. *Low risk means no human in the
   loop, not no record.*
3. **Given** a medium-risk action, **When** it is submitted, **Then** it proceeds only after its
   policy and evidence gates are satisfied — automated, but not unconditional.

---

### User Story 3 - Everything awaiting me is in one place (Priority: P1)

A reviewer opens the Decision Inbox and sees every approval, review request, escalation and blocked
item that is theirs — scoped to their role — without opening a single artifact to discover it.

**Why this priority**: `BR-0068` and `BR-0192`. `BR-0192` is explicit that pending approvals, policy
blocks and missing evidence must be visible *without searching individual artifacts*. A governed
platform whose pending decisions can only be found by looking for them produces the same delay as
having no automation at all, and hides it better.

**Independent Test**: create approvals, escalations, policy blocks and evidence gaps across several
objects; assert the Inbox returns exactly the subset the current role may act on, and that each entry
links to the object and the action it concerns.

**Acceptance Scenarios**:

1. **Given** items awaiting several roles, **When** a user opens the Inbox, **Then** they see the
   items their role may act on and no others.
2. **Given** an object blocked by policy, **When** the Inbox is read, **Then** the block appears with
   the reason, without the object being opened.
3. **Given** an item whose required evidence is missing, **When** the Inbox is read, **Then** the
   missing evidence is named rather than shown as a generic "not ready".
4. **Given** a user's role changes, **When** the Inbox is reloaded, **Then** the visible set follows
   the new role — an entry does not persist because it was once visible.
5. **Given** an item is decided, **When** the Inbox is reloaded, **Then** it leaves the queue and its
   decision is retrievable from the object.

---

### User Story 4 - A blocked or allowed action explains itself (Priority: P2)

An engineer's action is refused. They see which policy and which risk decision produced the refusal,
and what would change the outcome. The same holds for an action that was allowed.

**Why this priority**: `BR-0174`, and constraint 3 of `ADR-0025`: *"An unexplainable allow is a
defect."* Explainability on refusals alone is the intuitive half and the less important one — an
unexplained refusal is an annoyance, an unexplained allow is how a governance failure ships.

**Independent Test**: for every decision the engine can return, assert an explanation exists naming
the policy, the rule and the risk class; then assert that a decision path producing no explanation
fails a check rather than logging a warning.

**Acceptance Scenarios**:

1. **Given** a refused consequential action, **When** its explanation is requested, **Then** it names
   the policy, the rule, the risk class and the actor authority that would be required.
2. **Given** an **allowed** consequential action, **When** its explanation is requested, **Then** it
   names the policy and risk decision that permitted it.
3. **Given** a decision produced with no citable policy, **When** the check runs, **Then** it is
   reported as a defect — an unexplainable allow is not an acceptable runtime state.
4. **Given** a refusal, **When** it is shown in a Room, **Then** the Room can display the deciding
   policy without a second lookup (`UX-0033`).

---

### User Story 5 - An AI may propose a risk class and may never assign its own (Priority: P2)

An Engineering Expert prepares an action and proposes that it is low risk. The engine records the
proposal, classifies the action from policy, and proceeds on the policy's answer.

**Why this priority**: `ADR-0025` — *"Classification is a property of the action and its target —
modifying an approved baseline is high risk regardless of who asks — and is policy-declared, not
model-inferred."* This is the single sentence that separates a governed engine from a well-behaved
one.

**Independent Test**: submit an action carrying a self-assigned class and assert the engine's band is
derived from policy, with the proposal retained as a proposal.

**Acceptance Scenarios**:

1. **Given** an action carrying a proposed risk class, **When** it is classified, **Then** the
   effective class comes from policy and the proposal is recorded separately.
2. **Given** a proposal that disagrees with policy, **When** the decision is read, **Then** the
   disagreement is visible rather than reconciled silently.
3. **Given** an action type with no classification rule, **When** it is classified, **Then** it
   receives the **most restrictive** band, not the least.

---

### User Story 6 - A skipped gate is a violation or an exception, never a pass (Priority: P3)

A required gate is unsatisfied and policy would otherwise allow the action. The engine does not pass
it. It refuses, or it proceeds under an authorized recorded exception that reads as an exception
forever after.

**Why this priority**: constraint 2 of `ADR-0025`, carried unchanged from `BR-0060` v1.0. P3 because
`EPIC-021` owns the gates themselves and `EPIC-030` owns the transition seam; this Epic owns only the
policy half of the answer — but if the policy half can say "pass", the other two Epics cannot prevent it.

**Independent Test**: with a required gate unsatisfied, enumerate every decision the engine can
return and assert "satisfied" is not among them.

**Acceptance Scenarios**:

1. **Given** an unsatisfied required gate, **When** policy is evaluated, **Then** the result is
   refuse, or proceed-under-recorded-exception — never satisfied.
2. **Given** an exception, **When** it is recorded, **Then** it carries its authorizer, reason and
   expiry, and is enumerable later as an exception.

### User Story 7 - An automated decision names the rule that caused it (Priority: P2)

An engineer finds a governed action that executed with nobody involved. They open it and see the
rule that permitted it, the event that triggered it, and the policy version that rule came from —
and they can tell at a glance that no human decided it.

**Why this priority**: `BR-0069` and `RULE-11`. `ADR-0025` names the failure mode in one line:
*"'Risk-adaptive' is one bad default away from 'the AI decided it was low risk and shipped it'."*
`EPIC-030` enforces the loop-side half — an automated transition with no citable rule is refused at
configuration load — and **explicitly delegates the policy half here**: *"which rules may exist, and
what they may trigger, is `EPIC-031`'s."* Added 2026-08-22 to close analysis finding `C1`, which
found that `BR-0069` had requirements, a delegation from another Epic, and **no user story** — so
`/speckit-tasks`, which organises by user story, produced no tasks for it.

**Independent Test**: configure a reactive trigger, fire it, and assert the resulting decision names
its rule, its event and its policy version and is marked as automation. Then load a policy declaring
an automated action with no citable rule and assert refusal.

**Acceptance Scenarios**:

1. **Given** a policy permitting a workflow to react to an event, **When** the event fires, **Then**
   the resulting decision executes and records the rule, the triggering event and the policy version.
2. **Given** a policy declaring an automated action with **no citable rule**, **When** it is loaded,
   **Then** it is refused, naming the action — the same load-time fence `FR-DPE-012` uses, applied to
   automation.
3. **Given** an automated decision and a human decision side by side, **When** their records are
   read, **Then** which is which is apparent **without inference**.
4. **Given** an automated decision, **When** its explanation is requested, **Then** it names the
   visible rule that fired it, and an explanation that cannot name one is a defect rather than a
   blank field.

### Edge Cases

- **The policy engine is unavailable** — governed actions fail **closed**. `ADR-0025` names
  availability as a product concern precisely because the alternative — proceeding when policy cannot
  be consulted — converts an outage into an ungoverned window.
- **A new action type has no classification rule** — most restrictive band, not least (`FR-DPE-004`).
  A default of "low" means every capability added after this Epic ships arrives unguarded.
- **Two policies at different scopes disagree** — resolved by the precedence rule and the resolution
  is part of the explanation. This is `BR-0071`'s steering-conflict shape applied to policy; whether
  it *is* steering is the `ADR-0025` open question this Epic must settle.
- **A tenant sets every action to low risk** — the high band is unreachable (constraint 1), and the
  attempt itself is visible in the policy's own version history.
- **An action is reclassified while a decision is pending** — the pending decision keeps the class it
  was raised under; a reclassification creates a new decision rather than mutating one in flight.
- **An approver approves their own request** — refused unless policy explicitly permits it for that
  action class, and the permission is itself visible in the explanation.
- **The Decision Inbox is empty because the user has no role** — an empty state that says so, not a
  blank queue indistinguishable from "nothing pending" (`UX-0051`).
- **An exception expires while work is in flight** — the expiry is a fact on the record, not a grace
  period. An expired exception does not retroactively become a pass.
- **A tenant edits steering to reclassify a loop configuration change as low risk** — refused.
  `FR-DPE-012` fences it, and the attempt stays visible in steering's own version history
  *(clarified 2026-08-22)*.
- **Classification steering conflicts across scopes** — resolved by `BR-0071`, and the precedence
  rule that resolved it is part of the explanation rather than an internal detail
  *(clarified 2026-08-22)*.

## Requirements *(mandatory)*

### Functional Requirements

*Risk classification — `BR-0066`.*

- **FR-DPE-001**: Every governed action MUST be classifiable by risk, impact and applicable policy.
- **FR-DPE-002**: Classification MUST be a property of the action and its target, not of the requester. Modifying an approved baseline is high risk regardless of who asks.
- **FR-DPE-003**: Risk classification MUST be **policy-declared, never model-inferred**. An Engineering Expert MAY propose a class; it MUST NOT assign its own, and its proposal MUST be retained separately from the effective class.
- **FR-DPE-004**: An action type with no matching classification rule MUST receive the most restrictive band.
- **FR-DPE-005**: Classification rules MUST be expressed in the **`BR-0070` hierarchical steering system** — versioned, reviewable, composable at organization, workspace, project, repository and path scope — and MUST NOT be runtime configuration edited without review. Where rules at different scopes conflict, `BR-0071` steering-conflict resolution applies and the precedence rule that resolved them MUST appear in the explanation (`FR-DPE-042`) *(clarified 2026-08-22; `ADR-0025`'s open question, settled)*.
- **FR-DPE-006**: A change to a classification rule MUST NOT alter the recorded class of a decision already taken.

*Risk-adaptive approval — `BR-0067`, `ADR-0025` three bands and four constraints.*

- **FR-DPE-010**: The engine MUST implement exactly three bands: **low** MAY auto-execute where policy permits; **medium** requires policy and evidence gates; **high or consequential** requires authorized human approval.
- **FR-DPE-011**: The approval burden MUST be tunable per tenant by policy, without forking or bypassing the engine.
- **FR-DPE-012**: **The high band MUST NOT be configurable away.** Baseline changes, release promotion, **changes to a loop instance configuration** (`EPIC-030` `FR-GEL-016`) and any action PMI-DOC-004 marks as requiring authorized human decision MUST remain human-approved under every tenant policy. A policy attempting to downgrade one MUST be refused at load time *(loop configuration added 2026-08-22 — this Epic enforces the band `EPIC-030` declares)*.
- **FR-DPE-013**: A required gate that is unsatisfied MUST resolve to refuse or to proceed-under-recorded-exception. **"Satisfied" MUST NOT be reachable by omission** (`BR-0060`, constraint 2).
- **FR-DPE-014**: Every approval MUST record actor, authority basis, object version, decision and timestamp, using the `BR-0005` decision-authority contract rather than a second one. **This Epic publishes that contract provisionally**, as a shape `U-02` adopts unchanged when it is declared; it MUST NOT be a private record this Epic keeps to itself *(clarified 2026-08-22)*.
- **FR-DPE-015**: An approver MUST NOT approve their own request unless policy explicitly permits it for that action class, and that permission MUST appear in the explanation.
- **FR-DPE-016**: An auto-executed action MUST still produce an audit record and its required evidence (constraint 4).

*Decision Inbox — `BR-0068`, `BR-0192`.*

- **FR-DPE-020**: The system MUST provide a role-aware queue of approvals, review requests, escalations and blocked work.
- **FR-DPE-021**: Pending approvals, policy blocks and missing evidence MUST be visible from the queue **without opening the individual artifacts** (`BR-0192`).
- **FR-DPE-022**: Queue membership MUST be derived from current role and policy at read time; an entry MUST NOT persist because it was once visible.
- **FR-DPE-023**: Every entry MUST link to the object and the specific action it concerns.
- **FR-DPE-024**: A decided item MUST leave the queue, and its decision MUST remain retrievable from the object.
- **FR-DPE-025**: A blocked entry MUST name what would unblock it — the missing evidence, the pending approver, or the refusing policy — rather than reporting a generic not-ready state.
- **FR-DPE-026**: The queue MUST be reachable in one action from every screen, and MUST define loading, empty, populated and error states (`UX-0021`, `UX-0051`).

*Automation triggers — `BR-0069`, `RULE-11`.*

- **FR-DPE-030**: Policy MAY permit governed workflows to react to events, schedules or artifact changes.
- **FR-DPE-031**: Every automated action MUST be explainable from a **visible rule or policy**. A rule that cannot be cited MUST NOT be loadable.
- **FR-DPE-032**: An automated decision MUST be distinguishable from a human decision in its record, without inference.
- **FR-DPE-033**: The engine MUST emit the band distribution and auto-execution rate of the decisions it takes, so a well-tuned tenant is distinguishable from a disarmed one.

*Policy explainability — `BR-0174`.*

- **FR-DPE-040**: Every consequential action that was **blocked or allowed** MUST be explainable by the policy and risk decision that produced the result. **An unexplainable allow is a defect, not a warning.**
- **FR-DPE-041**: An explanation MUST name the policy version, the matched rule, the risk class and the authority applied.
- **FR-DPE-042**: Where policies at different scopes conflict, the explanation MUST name the precedence rule that resolved them.
- **FR-DPE-043**: A refusal MUST be renderable by a Room without a second lookup (`UX-0033`).
- **FR-DPE-044**: A decision MUST retain the policy version that produced it; a later policy change MUST NOT rewrite a past explanation.

*Availability and boundary.*

- **FR-DPE-050**: Where the engine cannot be consulted, governed actions MUST fail **closed**. Proceeding without policy converts an outage into an ungoverned window.
- **FR-DPE-051**: The engine MUST be the loop's **Decide** stage, invoked through the `EPIC-030` seam. A Room MUST NOT carry its own policy logic (`ADR-0025`).
- **FR-DPE-052**: This Epic MUST NOT implement the Governed Engineering Loop (`EPIC-030`), the evidence store or Evidence Contracts (`EPIC-032`), review gates and their approvers (`EPIC-021`), or any Room user experience (`EPIC-033`–`EPIC-035`).

### Key Entities

- **Risk Class**: the band an action falls in — low, medium, high/consequential — derived from the action and its target by policy. Never self-assigned.
- **Classification Rule**: a versioned, reviewed rule mapping an action and target to a risk class.
- **Policy**: the versioned tenant-scoped statement of what each band requires. Bounded by the non-configurable high band.
- **Decision**: one evaluation — its action, effective class, proposed class if any, outcome, authority, policy version and explanation. Immutable once taken.
- **Explanation**: the policy version, matched rule, risk class, precedence resolution and authority that produced a decision. A decision without one is a defect.
- **Exception**: an authorized, recorded, expiring departure from a required gate. Never a pass.
- **Inbox Entry**: a role-scoped, derived view of one pending decision, block or escalation. Derived at read time; not a stored queue row that can go stale.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-DPE-001**: **Zero** tenant-reachable policy configurations move a high-risk action out of human approval — verified by enumerating the configuration surface, not by inspecting defaults.
- **SC-DPE-002**: **100%** of consequential decisions, allowed and blocked alike, carry an explanation naming policy version, rule, class and authority.
- **SC-DPE-003**: **Zero** decisions execute with a model-assigned risk class; every effective class traces to a policy rule.
- **SC-DPE-004**: A reviewer can see every item awaiting them in **one** action from any screen, with no artifact opened to discover one.
- **SC-DPE-005**: **100%** of auto-executed low-band actions produce an audit record and their required evidence.
- **SC-DPE-006**: An unsatisfied required gate yields refuse or recorded-exception in **100%** of evaluations; the check is mutation-tested by adding a pass path and observing the suite fail.
- **SC-DPE-007**: When the engine is unreachable, **100%** of governed actions are refused rather than permitted.
- **SC-DPE-008**: Band distribution and auto-execution rate are reportable per workspace, so a tenant that has tuned itself into permanent auto-approval is visible without an audit.

## Assumptions

- **PMI-DOC-006 v1.0 is `PROPOSED`, not approved.** `FR-DPE-020`, `FR-DPE-026` and `FR-DPE-043` cite `UX-0021`, `UX-0033` and `UX-0051`. Each restates an approved `BR-` (`BR-0068`, `BR-0174`, `BR-0195`), so none depends on the proposed document for authority — the Inbox's placement in the shell does. **Back-fill owner: project owner**, through the PMI-DOC-006 approval outstanding as decision 6 in `brs-v2-reconciliation.md` §7.
- **`BR-0005` is unowned (`U-02`), and this Epic now publishes its contract provisionally** *(settled 2026-08-22)*. `FR-DPE-014` requires the decision-authority record; `ADR-0015` names `BR-0005` as settling it. This Epic defines the record's **shape** as a published contract, which `U-02` adopts unchanged when declared. It does **not** define a second authority model, and the shape is not private to this Epic.
- **`ADR-0025`'s open question is answered** *(2026-08-22)*: classification rules live in the **`BR-0070` steering hierarchy** (`FR-DPE-005`). **Consequence for `EPIC-019`**: it owns their storage, scoping and conflict resolution as a steering subject; this Epic owns their meaning. `ADR-0025` itself still says *Open* on this point and must be updated — listed in Epic Exit Criteria.
- Depends on `EPIC-030` for the loop and its Decide seam. The dependency is one-directional: `EPIC-030` declares the seam and defaults it to refuse; this Epic fills it.
- Audit persistence is `EPIC-004`'s (`BR-0111`); identity and authentication are `EPIC-005`'s (`BR-0002`). This Epic builds neither.
- Evidence *gates* are referenced by the medium band, but evidence typing and Evidence Contracts are `EPIC-032`'s (`BR-0142`). Until that Epic lands, an evidence gate is expressed against the contract `EPIC-032` will supply, not against an interim evidence model built here.
- "Consequential" is taken from PMI-DOC-004 v2.0 as it stands. Enumerating exactly which actions are consequential is planning work for this Epic, bounded by `FR-DPE-012` — the list may grow, and may not shrink below what PMI-DOC-004 marks.
- Engine availability and latency targets are recorded in this Epic's plan (`PP-018`), not asserted here.
- **This Epic delivers a user-facing journey** — the Decision Inbox. Constitution XI Tier 2 therefore applies in full, unlike `EPIC-030`.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for policy and classification-rule outputs, a passing executable conformance check that reads the artifact and fails when it drifts (Constitution V)
- [ ] **Constraint 1 is mutation-tested**: the non-configurable high band is removed and the suite observed failing (`SC-DPE-001`). A fence that cannot fail is decoration
- [ ] **Constraint 3 is mutation-tested**: a decision path is made to return no explanation and the suite observed failing (`SC-DPE-002`)
- [x] The `ADR-0025` open question is **decided** — classification rules live in the `BR-0070` steering hierarchy, with the consequence for `EPIC-019` stated (clarified 2026-08-22)
- [ ] **`ADR-0025` has been updated** to record that answer and close its `Open` line. Deciding something in a spec while the ADR still reads *open* is the same drift `RULE-16` prevents for identifiers, applied to decisions
- [ ] The `BR-0005` decision-authority contract is **published** as a versioned shape, with `U-02` named as its eventual owner and the adoption path stated
- [ ] **Constitution XI Tier 1** — a test drives a decision through its **real entry point** against the composed module graph. A mocked policy collaborator provably cannot satisfy this: the mock sits exactly where the missing wiring would be
- [ ] **Constitution XI Tier 2** — the Decision Inbox journey has been exercised against a **running application** and a **run-generated** transcript is committed. A hand-written transcript does not satisfy this (the `SC-AGT-001` precedent)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/031-decision-policy-engine/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)
