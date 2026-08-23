# Epic Specification: Change Room

**Epic**: `EPIC-034` | **Module**: Intent & Control — the second of three Rooms, and an instance of the Governed Engineering Loop

**Feature Branch**: `epic/034-change-room`

**Created**: 2026-08-22

**Status**: Draft

**Authorised by**: PMI-DOC-004 v2.0 **APPROVED 2026-08-22**, whose §6.5 makes the Change Room a
first-class requirement; [`ADR-0015`](../../adr/ADR-0015-requirement-change-defect-governance-authority.md)
**Accepted 2026-08-22**; Wave 1 of PMI-DOC-004A §13.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — nothing holds this Epic. `ADR-0015` is Accepted and is the sizing authority for
> `U-04`. Readiness still runs through the Definition-of-Ready gate, not by declaration (EPIC-026).

> ## ⚠ This is a BUILD, not an enhancement — despite what the amendment says
>
> The accepted amendment instructs *"maintain and enhance the existing Change Room"*. **There is no
> existing Change Room.** `EPIC-027` Finding A, confirmed by the project owner on 2026-08-22 and
> recorded in `ADR-0015`: `PRE-001` to `PRE-004` searched all 27 other Epic specifications and
> returned **zero occurrences**. On this point the amendment is wrong on a matter of fact, and
> `ADR-0015` says so in those words.
>
> **Size this as new capability.** An estimate that reads "enhance" and prices accordingly is wrong
> by the size of the Room.

**Input**: User description: "Build the Change Room: governed change control over an approved
baseline during implementation. The flow is request, clarification, impacted artifact graph, options
and trade-offs, schedule cost security and quality risk, decision, approved baseline delta, spec
task and test changes, re-plan, and completion evidence."

## Clarifications

### Session 2026-08-22

Two questions, both answered with the recommended option, in a consolidated round covering
`EPIC-031` to `EPIC-035` (Constitution X). The first was asked once and applies to all three Rooms.

- Q: Is each Room a distinct loop workflow type, or one shared type with variants? -> A: **Three distinct workflow types over one engine** (`FR-CHR-001`). `ADR-0018`'s only decided constraint, now enforced by `EPIC-030`'s `T944a`/`T944b` rather than asserted.
- Q: When two changes target one baseline, does the loop's first-commit-wins apply, or an explicit rebase? -> A: **An explicit recorded rebase, with re-decision where the impact changed** (`FR-CHR-054`). `EPIC-030`'s `FR-GEL-015` governs *transitions* — who moved the object first. It says nothing about what a decision was **made against**, and that is the part that matters here: a change approved against baseline v1 must not silently apply to v2, because the impact view, the trade-offs and the approval all referred to v1. So this Room is **stricter than the loop's generic rule**, and says so rather than inheriting it by default.

**Deferred, deliberately.** Impact-graph traversal depth and response targets (`PP-018`) are
plan-level. The PMI-DOC-006 approval is an act of the project owner — and `EPIC-033` flags it as
best discharged *before* this Epic plans, since this Room inherits the Room pattern rather than
setting it.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0042` — Change intake | FR-CHR-010 to FR-CHR-013 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0043` — Change clarification | FR-CHR-020 to FR-CHR-023 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0044` — Change impact | FR-CHR-030 to FR-CHR-035 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0045` — Trade-off analysis | FR-CHR-040 to FR-CHR-043 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0046` — Change decision | FR-CHR-050 to FR-CHR-054 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0047` — Re-baseline and re-plan | FR-CHR-060 to FR-CHR-065 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.5 `BR-0048` — Change evidence | FR-CHR-070 to FR-CHR-073 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §7 `RULE-02` *Baselines do not mutate silently* — the governing rule | FR-CHR-001, FR-CHR-011 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §6.1 `UX-0030` six required regions; §6.2 `UX-0031`, `UX-0032`, `UX-0035` | FR-CHR-080 to FR-CHR-085 |

**Requirements not yet covered by SRS**: **None.** Every requirement traces to an approved `BR-` in
PMI-DOC-004 v2.0 §6.5 or to `RULE-02`. `FR-CHR-080`–`FR-CHR-085` additionally cite PMI-DOC-006 v1.0,
which is **PROPOSED, not approved** — the back-fill owner is named under Assumptions.

### Ownership notes — read before planning

**This Epic owns seven requirements**: `BR-0042` through `BR-0048` — exactly capability area `U-04`
as [`brs-v2-reconciliation.md`](../brs-v2-reconciliation.md) §4 defines it.

| Cited | Owner | Why it appears here |
|---|---|---|
| `BR-0033` Impact analysis | `EPIC-020` Living Specifications | `BR-0044` assembles the impact **view**; `EPIC-020` owns the analysis that computes it. **Extend, do not duplicate** (`FR-CHR-031`) |
| `BR-0057` Defect-to-change transfer | `EPIC-035` (`U-05`) | this Room is the transfer **target**. `EPIC-035` owns the decision to transfer; this Room owns receiving it with context and evidence intact (`FR-CHR-012`) |
| `BR-0026` Baseline | `EPIC-033` (`U-01`) | the object this Room changes. `RULE-02` is the seam between them |
| `BR-0154` Re-plan | **unowned** (`U-12`, `EPIC-012` extension) | `BR-0047` requires downstream work be updated; **revising the task list without destroying completed-work history is `BR-0154`**, not this Epic — see the note below |
| `BR-0073` Architecture impact | **unowned** (`U-17`) | *"a change MUST identify the relevant architecture decisions and constraints and flag likely violations"*. Adjacent to `BR-0044` and **not owned here** |
| `BR-0064`, `BR-0067`, `BR-0068`, `BR-0140`–`BR-0142` | `EPIC-030`, `EPIC-031`, `EPIC-032` | loop, policy, Inbox, evidence — consumed as substrate |

#### A second §13-versus-§4 discrepancy, recorded rather than resolved

PMI-DOC-004 v2.0 §13 places `BR-0154` in its *Architecture impact, rationale, re-plan* row alongside
`BR-0073` and `BR-0083`, assigned to an `EPIC-016`/`EPIC-020` extension.
`brs-v2-reconciliation.md` §4 places it in **`U-12` Task assignment & re-plan**, an `EPIC-012`
extension, and keeps `U-17` to `BR-0073` and `BR-0083`.

**§4 wins**, on PMI-DOC-004's own instruction that §4 is authoritative for Wave 0 and §13 is a
summary. This is the second such looseness found while declaring Wave 1 — the first was `BR-0143`
appearing in two §13 rows, recorded in `EPIC-032`. Neither changes a requirement; both would change
what an Epic thinks it owns, which is why both are written down.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | a change is decided and re-baselined **before** implementation acts on it (`BR-0046`) |
| PP-002 | Single Source of Truth | Satisfied | the current baseline is the one truth; a change produces a new version, never a parallel one (`FR-CHR-060`) |
| PP-003 | Human-in-the-Loop | Satisfied | `BR-0046` — a material change receives an authorized decision before implementation affects an approved baseline. `ADR-0025` constraint 1 puts baseline change permanently in the high band |
| PP-004 | End-to-End Traceability | Satisfied | request → impact → decision → baseline delta → task and test changes → evidence is a complete `BR-0040` sub-chain |
| PP-005 | Modular Architecture | Satisfied | a loop instance over three substrate Epics; impact analysis is `EPIC-020`'s and consumed, not rebuilt |
| PP-006 | Engine Independence | Satisfied | a change is expressed against baselines and artifacts, not against a specification engine's model |
| PP-007 | API & MCP First | Partial | Room state and decisions are API surfaces; MCP exposure lands with `EPIC-013` `BR-0122` |
| PP-008 | Security by Design | Satisfied | security risk is a **first-class** trade-off dimension of `BR-0045` (`FR-CHR-041`), not a review someone remembers to ask for |
| PP-009 | Quality by Design | Satisfied | `BR-0048` closure requires the tests and evidence that validate the change, not a status field |
| PP-010 | Observability by Default | Satisfied | change volume, decision latency and change-failure rate are `BG-06`'s DORA measures and become computable here |
| PP-011 | Documentation as Code | Satisfied | change requests, decisions and baseline deltas are versioned, exportable content |
| PP-012 | Everything Versioned | Satisfied | `BR-0047` — new versions of affected artifacts, with the prior baseline still readable |
| PP-013 | Knowledge-Driven Engineering | Satisfied | the reason for each change is retained, which is what `BR-0083`'s *"why did this change?"* will later read |
| PP-014 | Configuration over Customization | Satisfied | a configured loop instance sharing the Room pattern (`UX-0035`) |
| PP-015 | Open Standards | Not applicable | no external change-management standard is adopted; recorded in this Epic's plan |
| PP-016 | Explainable AI | Satisfied | `BR-0045` requires options be **clearly marked as recommendations rather than decisions** (`FR-CHR-042`), and `UX-0031` makes that visible |
| PP-017 | Cost-Aware AI | Partial | impact and trade-off generation invoke models; budgets are `BR-0106` and unowned (`U-11`). This Room must not build its own |
| PP-018 | Scalability First | Partial | an impact graph over a large product can be large; traversal depth and response targets are this Epic's plan |
| PP-019 | Continuous Improvement | Satisfied | change-failure rate and mean time from decision to re-baseline are `BG-09`'s stated measures |
| PP-020 | Customer Value | Satisfied | `BG-09` — change handling inside the living specification lifecycle rather than beside it |

**Deferral count**: **0.** Three principles are Partial and each names where its remainder lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No approved baseline changes without passing through this Room (Priority: P1)

Someone wants an approved requirement to mean something different. They cannot edit it. They raise a
Change Request against the baseline it belongs to, and implementation does not act on the new
intention until the change is decided.

**Why this priority**: `RULE-02` — *baselines do not mutate silently* — is the rule that makes every
baseline in the product worth having. `EPIC-033` refuses the in-place edit; this Room is where the
refusal leads. Without it, `RULE-02` is a dead end rather than a workflow.

**Independent Test**: attempt an in-place edit of a baselined artifact and assert it becomes a Change
Request linked to that baseline; then assert implementation of the new intent is blocked until the
change is decided.

**Acceptance Scenarios**:

1. **Given** an approved baseline, **When** a modification is proposed, **Then** it is recordable as
   a Change Request **linked to that baseline**.
2. **Given** an undecided Change Request, **When** implementation work that depends on it is
   attempted, **Then** it is refused — no implementation-changing request bypasses traceable change
   control once the relevant baseline is approved.
3. **Given** a Change Request, **When** it is read, **Then** it identifies the requested outcome, the
   reason, the urgency, the requester and the unresolved questions (`BR-0043`).
4. **Given** an item transferred from the Defect Room, **When** it arrives, **Then** its originating
   context and evidence are preserved and its origin is visible (`BR-0057`).

---

### User Story 2 - The blast radius is visible before the decision, not after (Priority: P1)

A decision-maker sees what this change touches: requirements, specifications, architecture, tasks,
code, tests, release scope, and known operational effects — assembled, not remembered.

**Why this priority**: `BR-0044`. A change decided without its impact view is a change decided on the
part somebody happened to think of. `BG-06`'s change-failure rate is largely a measure of impact
that was missed.

**Independent Test**: raise a change against an artifact with known downstream dependents and assert
every dependent class named by `BR-0044` appears in the impact view, with unknowns marked as unknown
rather than omitted.

**Acceptance Scenarios**:

1. **Given** a Change Request, **When** its impact view is assembled, **Then** it spans requirements,
   specifications, architecture, tasks, code, tests, release scope and known operational effects.
2. **Given** an impact area the platform cannot determine, **When** the view is shown, **Then** it is
   marked **unknown** rather than omitted. An absent row and a clean row must not look alike.
3. **Given** the impact view, **When** it is assembled, **Then** it uses `EPIC-020`'s impact analysis
   rather than a second traversal built here.
4. **Given** a change touching a governed architecture decision, **When** the view is shown, **Then**
   the decision is surfaced — flagging likely violations is `BR-0073` and remains unowned, which the
   view states rather than silently omits.

---

### User Story 3 - Options carry schedule, cost, quality, security, compatibility and delivery (Priority: P2)

Before a material change decision, the Room presents options whose trade-offs span all six
dimensions, each marked a recommendation.

**Why this priority**: `BR-0045` enumerates the six dimensions deliberately. Presenting a change
choice on schedule alone is how security and compatibility become discoveries rather than inputs.

**Independent Test**: trigger a material change decision and assert two or more options, each
carrying all six trade-off dimensions or explicitly stating a dimension is not applicable.

**Acceptance Scenarios**:

1. **Given** a material change, **When** options are generated, **Then** two or more are presented.
2. **Given** an option, **When** it is displayed, **Then** its schedule, cost, quality, security,
   compatibility and delivery trade-offs are each stated or explicitly marked not applicable.
3. **Given** options, **When** they are displayed, **Then** each is marked a **recommendation rather
   than a decision**, and none is pre-selected.

---

### User Story 4 - An approved change re-baselines and re-plans, and the old baseline stays readable (Priority: P1)

The change is approved. New versions of the affected artifacts appear, downstream tasks and tests are
updated, and the prior baseline remains readable exactly as it was.

**Why this priority**: `BR-0047`. This is the half of change control that is usually skipped: the
decision gets recorded and the artifacts drift. A change that does not re-baseline leaves the
approved intent and the implemented intent permanently different.

**Independent Test**: approve a change and assert new artifact versions exist, downstream work is
updated, and the prior baseline is byte-identical to before.

**Acceptance Scenarios**:

1. **Given** an approved change, **When** it is applied, **Then** new versions of every affected
   artifact are created.
2. **Given** the same approval, **When** downstream work is examined, **Then** affected tasks and
   tests are updated **without destroying completed-work history** — through `BR-0154`'s mechanism,
   not a Room-local one.
3. **Given** an applied change, **When** the prior baseline is read, **Then** it is unchanged and
   identifies the baseline that superseded it.
4. **Given** an approved change, **When** it is decided, **Then** the decision was made by an
   authorized human — baseline change sits permanently in `ADR-0025`'s high band and no tenant policy
   may lower it.

---

### User Story 5 - Closure says what changed, why, what proves it, and which baseline now stands (Priority: P2)

A change is closed. Its record answers four questions without anyone reconstructing them: what
changed, why, which tests and evidence validate it, and which baseline supersedes the old state.

**Why this priority**: `BR-0048`. These four are what an auditor asks and what a later engineer needs.
Reconstructed six months on, they are guesses.

**Independent Test**: close a change and assert all four answers are present and retrievable from the
change record alone.

**Acceptance Scenarios**:

1. **Given** a closed change, **When** its record is read, **Then** it identifies what changed, why,
   the validating tests and evidence, and the superseding baseline.
2. **Given** a change whose Evidence Contract is unmet, **When** closure is attempted, **Then** it is
   refused and the unmet items are named (`EPIC-032`).

---

### User Story 6 - The Room reads like the other two (Priority: P3)

The same six regions, the same vocabulary, the same treatment of AI output as in the Requirement and
Defect Rooms.

**Why this priority**: `UX-0030`, `UX-0035`. P3 because it is inherited rather than invented here —
`EPIC-033` sets the vocabulary and this Room must not diverge from it.

**Independent Test**: assert all six regions present and region names identical to the shared pattern
and to `EPIC-033`'s.

**Acceptance Scenarios**:

1. **Given** the Change Room, **When** it renders, **Then** all six required regions are present with
   names identical to the shared pattern.
2. **Given** a policy-refused action, **When** the Room renders, **Then** the refusing policy is shown
   (`UX-0033`).

### Edge Cases

- **A change is raised against a baseline that has since been superseded** — it is rebased onto the
  current baseline as an explicit act with its own record, never silently retargeted.
- **Two changes are approved concurrently against the same baseline** — the second is explicitly
  rebased onto the baseline the first produced and re-decided if its impact view changed
  (`FR-CHR-054`). Silently applying it would ship an approval that referred to a baseline no longer
  in force *(clarified 2026-08-22)*.
- **A Requirement Room stage would be useful here** — not expressible. Each Room is a distinct
  workflow type (`FR-CHR-001`); borrowing another Room's stage collapses two governed surfaces,
  which is the one thing `ADR-0018` decided against *(clarified 2026-08-22)*.
- **A change is withdrawn after impact analysis** — the analysis and the withdrawal are retained. A
  withdrawn change is evidence that a question was asked.
- **A change's impact view cannot resolve part of the graph** — the unresolvable part is shown as
  unknown. An impact view that omits what it could not compute reads as a smaller change than it is.
- **An item arrives from the Defect Room whose evidence has since been invalidated** — it arrives with
  its evidence and the invalidation both visible; the transfer does not launder stale evidence.
- **A change would violate a governed architecture decision** — the decision is surfaced;
  **flagging the likely violation is `BR-0073` and unowned**, so this Room shows the decision and
  states that the violation check is not yet owned rather than implying it ran.
- **An emergency change** — urgency is a recorded field of `BR-0043`, not a bypass. `ADR-0025`
  constraint 2 applies: a skipped gate is a recorded exception or a violation, never a pass.
- **A change closes with tests updated but not run** — closure is refused; `BR-0048` requires the
  evidence that validates it, and `BR-0144` says declaring completion is not that evidence.

## Requirements *(mandatory)*

### Functional Requirements

*Room identity and boundary.*

- **FR-CHR-001**: The Change Room MUST be a **distinct configured workflow type** of the Governed Engineering Loop (`BR-0064`, `EPIC-030`) — its own stages, authorities and gates over a shared engine, never a variant of another Room's type (`FR-GEL-004`) — and MUST be the only path by which an approved baseline changes (`RULE-02`) *(distinctness clarified 2026-08-22)*.
- **FR-CHR-002**: This Epic MUST NOT implement the loop (`EPIC-030`), policy (`EPIC-031`), the evidence store (`EPIC-032`), impact analysis (`EPIC-020`), task revision (`BR-0154`, `U-12`), the architecture-violation check (`BR-0073`, `U-17`), or the Defect Room (`EPIC-035`).

*Change intake — `BR-0042`, `BR-0043`.*

- **FR-CHR-010**: Any proposed modification to an approved baseline MUST be recordable as a Change Request **linked to that baseline**.
- **FR-CHR-011**: No implementation-changing request MUST be able to bypass traceable change control once the relevant baseline is approved.
- **FR-CHR-012**: An item transferred from the Defect Room (`BR-0057`) MUST arrive with its context and evidence preserved and its origin visible.
- **FR-CHR-013**: A Change Request raised against a superseded baseline MUST be rebased as an explicit recorded act, never silently retargeted.
- **FR-CHR-020**: A Change Request MUST identify the requested outcome, the reason, the urgency, the requester and the unresolved questions.
- **FR-CHR-021**: Urgency MUST be a recorded attribute, **never a gate bypass** (`ADR-0025` constraint 2).
- **FR-CHR-022**: Clarification questions MUST be presented as one set and answerable in place, and answers retained on the record.
- **FR-CHR-023**: A withdrawn Change Request and its analysis MUST both be retained.

*Change impact — `BR-0044`.*

- **FR-CHR-030**: The system MUST compute or assemble an impact view spanning requirements, specifications, architecture, tasks, code, tests, release scope and known operational effects.
- **FR-CHR-031**: The impact view MUST **extend** `EPIC-020`'s impact analysis (`BR-0033`) and MUST NOT implement a second traversal.
- **FR-CHR-032**: An impact area the platform cannot determine MUST be marked **unknown**, never omitted.
- **FR-CHR-033**: Governed architecture decisions touched by a change MUST be surfaced in the view.
- **FR-CHR-034**: Where the architecture-violation check (`BR-0073`) is unowned, the view MUST state that it has not run rather than implying it passed.
- **FR-CHR-035**: The impact view MUST be retained with the change, so the decision can later be read against what was known at the time.

*Trade-off analysis — `BR-0045`.*

- **FR-CHR-040**: For a material change, the system MUST present **two or more** options.
- **FR-CHR-041**: Each option MUST state its schedule, cost, quality, **security**, compatibility and delivery trade-offs, or explicitly mark a dimension not applicable.
- **FR-CHR-042**: Options MUST be **clearly marked as recommendations rather than decisions**, and none pre-selected.
- **FR-CHR-043**: A recorded decision MUST retain the option chosen, its rationale and the options declined.

*Change decision — `BR-0046`.*

- **FR-CHR-050**: A material change MUST receive an **authorized decision before implementation affects an approved baseline**.
- **FR-CHR-051**: Baseline change MUST remain in the high risk band; no tenant policy MUST be able to lower it (`ADR-0025` constraint 1, via `EPIC-031`).
- **FR-CHR-052**: Decision authority MUST be evaluated through `EPIC-031`, using the `BR-0005` decision-authority record.
- **FR-CHR-053**: Change decisions MUST surface in the Decision Inbox (`BR-0068`).
- **FR-CHR-054**: Two changes MUST NOT apply concurrently to one baseline. The second MUST be **explicitly rebased** onto the baseline the first produced, as a recorded act (`FR-CHR-013`), and MUST be **re-decided where the rebase changes its impact view**. Inheriting `EPIC-030`'s first-commit-wins is insufficient: that rule governs which transition won, not what the decision was made against, and a change approved against the prior baseline referred to a different impact view, different trade-offs and a different approval *(clarified 2026-08-22)*.

*Re-baseline and re-plan — `BR-0047`.*

- **FR-CHR-060**: An approved change MUST create **new versions** of every affected artifact.
- **FR-CHR-061**: The prior baseline MUST remain readable and unchanged, and MUST identify what superseded it.
- **FR-CHR-062**: Downstream work MUST be updated — affected tasks and tests revised **without destroying completed-work history**, through `BR-0154`'s mechanism (`U-12`) rather than a Room-local one.
- **FR-CHR-063**: The approved baseline delta MUST be readable as a delta, not only as two full versions.
- **FR-CHR-064**: Specification, task and test changes arising from an approved change MUST be traceable to that change.
- **FR-CHR-065**: Re-plan MUST NOT silently discard work already completed against the prior baseline.

*Change evidence and closure — `BR-0048`.*

- **FR-CHR-070**: Closure MUST identify what changed, why, which tests and evidence validate it, and which baseline supersedes the old state.
- **FR-CHR-071**: Closure MUST be refused where the change's Evidence Contract is unmet, naming the unmet items (`EPIC-032`).
- **FR-CHR-072**: A declaration of completion MUST NOT substitute for the validating evidence (`BR-0144`).
- **FR-CHR-073**: A closed change MUST answer all four `BR-0048` questions from its own record, without reconstruction.

*Room pattern — `UX-0030` to `UX-0035`.*

- **FR-CHR-080**: The Room MUST present all six required regions: object state, loop progress, AI analysis, decision, evidence, activity timeline.
- **FR-CHR-081**: Region names MUST be identical to the shared Room pattern and to the other two Rooms (`UX-0035`).
- **FR-CHR-082**: AI output MUST be visually distinguishable from recorded fact and from human decision (`UX-0031`).
- **FR-CHR-083**: What is blocking progress MUST be visible without opening another screen (`UX-0032`).
- **FR-CHR-084**: A policy-refused action MUST show the refusing policy (`UX-0033`).
- **FR-CHR-085**: The Room MUST remain able to show state, decision and evidence at a 360px viewport (`UX-0040`, `UX-0042`).

### Key Entities

- **Change Request**: a proposed modification to an approved baseline, carrying requested outcome, reason, urgency, requester and unresolved questions. Always linked to the baseline it targets.
- **Impact View**: the assembled set of artifacts a change touches, with unknowns marked as unknown. Retained with the change.
- **Change Option**: one feasible course with six trade-off dimensions and stated reasoning. A recommendation, never a decision.
- **Change Decision**: an authorized human decision with rationale, chosen option and options declined. High band, permanently.
- **Baseline Delta**: the readable difference between the superseded baseline and the one the change produced.
- **Change Closure**: the record answering what changed, why, what validates it, and which baseline now stands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-CHR-001**: **Zero** approved baselines change other than through a decided Change Request — mutation-tested by adding a bypass path and observing the suite fail.
- **SC-CHR-002**: **100%** of impact views span all eight `BR-0044` areas, with undeterminable areas marked unknown rather than absent.
- **SC-CHR-003**: **100%** of material change decisions are taken by an authorized human; **zero** are auto-approved under any tenant policy.
- **SC-CHR-004**: **100%** of approved changes produce new artifact versions with the prior baseline still readable and byte-identical.
- **SC-CHR-005**: **Zero** changes close with an unmet Evidence Contract.
- **SC-CHR-006**: **100%** of closed changes answer all four `BR-0048` questions from their own record.
- **SC-CHR-007**: **Zero** completed work items are destroyed by a re-plan.
- **SC-CHR-008**: Region names match the shared Room pattern exactly, verified by comparison against `EPIC-033`'s rather than by review.
- **SC-CHR-009**: **Zero** changes apply to a baseline other than the one their decision was made against; every rebase is recorded, and one that alters the impact view is re-decided *(clarified 2026-08-22)*.
- **SC-CHR-010**: This Room resolves as its own workflow type: **zero** transitions succeed under another Room's stages, authorities or gates *(clarified 2026-08-22)*.

## Assumptions

- **PMI-DOC-006 v1.0 is `PROPOSED`, not approved.** `FR-CHR-080`–`FR-CHR-085` cite it. **Back-fill owner: project owner.** `EPIC-033` flags this as the strongest of the three Rooms' SRS dependencies and recommends discharging it before this Epic plans — this Epic inherits the pattern rather than setting it, so an unapproved pattern here means inheriting an unapproved decision.
- **The Room pattern is a SHARED ARTIFACT, and this Epic imports it rather than deriving it** *(recorded 2026-08-22, `EPIC-033` analysis finding `C1`)*. `EPIC-033` Phase 2 produces **`packages/room-contract`** — `RoomShellProps` (six required named region slots), `Epistemic`/`Labelled<T>` (the required epistemic discriminant) and `RoomObjectRef` — and **`frontend/src/rooms/RoomShell.tsx`**, which owns the `UX-0041` breakpoints and the `UX-0040` 360px floor. This Epic MUST import both and MUST NOT re-derive the pattern: `UX-0035` forbids the three Rooms diverging, and a second derivation is how they would. The regions are **required named props, not `children`**, so omitting one does not compile and a seventh has nowhere to go. **`EPIC-033` Phase 2 is therefore a hard prerequisite of this Epic's implementation**, not merely a related Epic.
- **`BR-0154` is `U-12` and unowned**, an `EPIC-012` extension. `FR-CHR-062` requires downstream task revision without destroying history; this Epic does **not** build that mechanism. Until `U-12` is declared, re-plan is specified against the contract `EPIC-012` will supply. **Owner: product owner.**
- **`BR-0073` architecture-violation flagging is `U-17` and unowned.** `FR-CHR-033` surfaces the touched decisions; `FR-CHR-034` requires the view to say the violation check has not run. **A check that has not run must not be reported as passed** — Constitution IX's rule, applied to a screen.
- **`BR-0083` rationale questions are `U-17` and unowned.** This Room retains the *why* of each change (`PP-013`), which is the raw material for that later capability; it does not answer rationale queries.
- Depends on `EPIC-030` (loop), `EPIC-031` (decision and Inbox), `EPIC-032` (evidence) and `EPIC-033` (the baselines it changes). All four are declared in this Wave.
- `EPIC-020` owns impact analysis (`BR-0033`) and this Room extends it. If `EPIC-020`'s traversal proves insufficient, the correct response is a change to `EPIC-020`, not a second traversal here (`FR-CHR-031`).
- Receives transfers from `EPIC-035` (`BR-0057`). `EPIC-035` owns the transfer decision; this Room owns the reception. The two halves are specified in the same Wave so neither is built against a guess.
- Impact-graph traversal depth and response targets are this Epic's plan (`PP-018`).
- **This Epic delivers a user-facing journey.** Constitution XI Tier 2 applies in full.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for the loop-instance configuration and Room pattern outputs, a passing executable conformance check (Constitution V)
- [ ] **`FR-CHR-011` is mutation-tested**: a path that changes an approved baseline without a decided Change Request is added, and the suite observed failing (`SC-CHR-001`). This is `RULE-02` made mechanical
- [ ] **`FR-CHR-032` is mutation-tested**: an undeterminable impact area is made to render as absent rather than unknown, and the suite observed failing (`SC-CHR-002`)
- [ ] **`FR-CHR-054` is mutation-tested**: a silent retarget onto a newer baseline is added, and the suite observed failing (`SC-CHR-009`). This is the one that would ship an approval referring to a baseline no longer in force
- [ ] The Room is demonstrably a **configured instance** of `EPIC-030`'s loop, shown by the instance configuration
- [ ] Region names are verified identical to `EPIC-033`'s by comparison rather than by review (`SC-CHR-008`)
- [ ] A Defect Room transfer has been exercised end to end with context and evidence preserved (`FR-CHR-012`), jointly with `EPIC-035`
- [ ] **Constitution XI Tier 1** — a test drives the Room through its **real entry point** against the composed module graph
- [ ] **Constitution XI Tier 2** — the request-to-re-baseline journey has been exercised against a **running application** and a **run-generated** transcript is committed
- [ ] The closing report restates that `BR-0073` and `BR-0154` remain unowned, so this Room's delivery is not read as having closed them
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/034-change-room/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)
