# Epic Specification: Requirement Room

**Epic**: `EPIC-033` | **Module**: Intent & Control — the first of three Rooms, and an instance of the Governed Engineering Loop

**Feature Branch**: `epic/033-requirement-room`

**Created**: 2026-08-22

**Status**: Draft

**Authorised by**: PMI-DOC-004 v2.0 **APPROVED 2026-08-22**, whose §6.3 makes the Requirement Room a
first-class requirement; [`ADR-0015`](../../adr/ADR-0015-requirement-change-defect-governance-authority.md)
**Accepted 2026-08-22** on the project owner's confirmation of `EPIC-027` **Finding A**; Wave 1 of
PMI-DOC-004A §13.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — nothing holds this Epic. `ADR-0015` moved **Open → Accepted** on 2026-08-22
> when the project owner confirmed Finding A, and it is now the **sizing authority** for `U-01`.
> Readiness still runs through the Definition-of-Ready gate, not by declaration (EPIC-026).

> ## ⚠ This is a BUILD, not an enhancement
>
> `EPIC-027` **Finding A**, confirmed by the project owner on 2026-08-22 and recorded in `ADR-0015`:
> the Requirement, Change and Defect Rooms **do not exist**. `PRE-001` to `PRE-004` searched all 27
> other Epic specifications and returned **zero occurrences** of any Room. Where the accepted
> amendment says *"maintain and enhance"*, the amendment is wrong on a matter of fact.
>
> **Size this as new capability.** `ADR-0015`'s own Consequences state the cost of getting this
> wrong: *"Any plan, estimate or task breakdown that assumed enhancement of existing Rooms is wrong
> by the size of the Rooms."*

**Input**: User description: "Build the Requirement Room: the governed decision workflow that turns
raw intent into a baselined requirement set ready for specification. The flow is intake, AI
extraction and normalization, clarification, conflict and gap analysis, options, risks, acceptance
criteria, stakeholder decision, baseline, and handoff to specification."

## Clarifications

### Session 2026-08-22

Two questions, both answered with the recommended option, in a consolidated round covering
`EPIC-031` to `EPIC-035` (Constitution X). The first was asked once and applies to all three Rooms.

- Q: Is each Room a distinct loop workflow type, or one shared type with variants? -> A: **Three distinct workflow types over one engine** (`FR-RQR-001`). This is `ADR-0018`'s only decided constraint stated as a requirement: *"the Requirement, Change and Defect Rooms remain distinct user-facing governed rooms with their own rules, states, permissions and decisions, while reusing a common workflow engine. A shared engine must not collapse three governed surfaces into one."* `EPIC-030` now has a test for it — `T944a`/`T944b`, added to close analysis finding `C1` — so the constraint is enforced rather than asserted.
- Q: Should an interim external-stakeholder access path be built before `U-02` is declared? -> A: **No** (`FR-RQR-004`). `BR-0004` lets authorized external stakeholders review assigned requirements *without receiving broader engineering access*. That is an access-control mechanism, and building one outside the Epic that owns it would put a second authorization model beside `EPIC-024`'s — the failure `D-33` describes in the requirement register, applied to access. Until `U-02` is declared, this Room serves workspace-internal authorized identities only, and says so rather than degrading quietly.

**Deferred, deliberately.** Requirement-set size and clarification-volume targets (`PP-018`) are
plan-level. The PMI-DOC-006 approval is an act of the project owner and remains this Room's
strongest SRS dependency — it should be discharged before `EPIC-034` plans against the same pattern.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.3 `BR-0022` — Guided clarification | FR-RQR-010 to FR-RQR-015 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.3 `BR-0023` — Options and risks | FR-RQR-020 to FR-RQR-023 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.3 `BR-0024` — Acceptance criteria | FR-RQR-030 to FR-RQR-033 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.3 `BR-0025` — Stakeholder decision | FR-RQR-040 to FR-RQR-044 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.3 `BR-0026` — Baseline | FR-RQR-050 to FR-RQR-055 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.3 `BR-0027` — Handoff | FR-RQR-060 to FR-RQR-062 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §7 `RULE-02` *Baselines do not mutate silently*; `RULE-03` *AI recommends; policy and humans govern* | FR-RQR-051, FR-RQR-011 |
| [`adr/ADR-0015-...md`](../../adr/ADR-0015-requirement-change-defect-governance-authority.md) | Accepted — Finding A, and the approval-threshold and risk-banding model this Room's decisions run under | the BUILD basis; FR-RQR-041 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §6.1 `UX-0030` six required regions; §6.2 `UX-0031`, `UX-0032`, `UX-0035` | FR-RQR-070 to FR-RQR-075 |
| [`specs/027-ai-native-amendment/register/premises.md`](../027-ai-native-amendment/register/premises.md) | `PRE-018` and Finding A evidence; decision `D-33` | the not-`EPIC-007` boundary |

**Requirements not yet covered by SRS**: **None.** Every requirement traces to an approved `BR-` in
PMI-DOC-004 v2.0 §6.3 or to the Accepted `ADR-0015`. `FR-RQR-070`–`FR-RQR-075` additionally cite
PMI-DOC-006 v1.0, which is **PROPOSED, not approved** — the back-fill owner is named under
Assumptions.

### Ownership notes — read before planning

**This Epic owns six requirements**: `BR-0022` through `BR-0027` — exactly capability area `U-01` as
[`brs-v2-reconciliation.md`](../brs-v2-reconciliation.md) §4 defines it.

#### This is NOT `EPIC-007` — decision `D-33`

`EPIC-007` **Requirement Intelligence** exists, is closed, and **keeps its identifier and its
scope**. Its own specification states that AI-assisted analysis is *Phase 2 and out of scope*, and
it owns `BR-0020` multi-source intake and `BR-0021` ambiguity analysis. It continues to.

`PRE-018` was recorded **partial** rather than confirmed, because both halves are true: EPIC-007
exists and is called Requirement Intelligence, **and** it is not this capability. `D-33` resolved it
— EPIC-007 keeps its identifier, name and register-only scope; the far larger governed-decision
capability that happens to share part of the name becomes a new epic. This is that epic.

`premises.md` states the cost of leaving it unreconciled in one sentence: *"the worst kind of drift —
two teams believing one epic covers both."*

#### Cited, not claimed

| Cited | Owner | Why it appears here |
|---|---|---|
| `BR-0020`, `BR-0021` | `EPIC-007` | intake and ambiguity analysis. This Room **consumes** the requirement register EPIC-007 owns; it does not re-implement it (`FR-RQR-002`) |
| `BR-0064` Governed loop | `EPIC-030` | this Room is an **instance** of that loop, not a workflow beside it (`FR-RQR-001`) |
| `BR-0067`, `BR-0068` Policy, Inbox | `EPIC-031` | approval banding and the queue this Room's decisions surface in |
| `BR-0140`–`BR-0142` Evidence | `EPIC-032` | the Evidence region and the Contract a baseline must satisfy |
| `BR-0005` Decision authority | **unowned** (`U-02`) | the approval record shape. Consumed, not redefined |
| `BR-0042` Change intake | `EPIC-034` (`U-04`) | `RULE-02` — an edit after baseline is a **change**, and this Room hands it to the Change Room |
| `BR-0030`, `BR-0031` Specification | `EPIC-008`, `EPIC-009` | the downstream `BR-0027` handoff target |

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | this Room *is* the principle as a product surface: intent becomes an approved baseline before specification begins (`BR-0027`) |
| PP-002 | Single Source of Truth | Satisfied | the baseline is the single approved requirement set (`FR-RQR-050`); `FR-RQR-002` forbids a second requirement register beside `EPIC-007`'s |
| PP-003 | Human-in-the-Loop | Satisfied | `BR-0025` — requirement decisions are made by **authorized humans** and retained with rationale. `FR-RQR-041` refuses an AI-taken baseline decision |
| PP-004 | End-to-End Traceability | Satisfied | intent → clarification → decision → acceptance criteria → baseline → specification is the `BR-0040` chain's first five edges |
| PP-005 | Modular Architecture | Satisfied | the Room is a loop instance over three substrate Epics; it owns its vocabulary and none of theirs |
| PP-006 | Engine Independence | Satisfied | the baseline is engine-agnostic; `BR-0027` makes it a **selectable input** to one or more specification workflows, not a Spec Kit artifact |
| PP-007 | API & MCP First | Partial | Room state and decisions are API surfaces; MCP exposure lands with `EPIC-013` `BR-0122` |
| PP-008 | Security by Design | Satisfied | decision authority is checked, not assumed (`FR-RQR-041`); stakeholder review without broader engineering access is `BR-0004` and belongs to `U-02` — recorded under Assumptions, not silently assumed here |
| PP-009 | Quality by Design | Satisfied | `BR-0024` makes measurable acceptance criteria a precondition of baseline, which is quality moved upstream of implementation |
| PP-010 | Observability by Default | Satisfied | time-in-stage and clarification-round counts are derivable from the loop instance |
| PP-011 | Documentation as Code | Satisfied | baselines and decisions are versioned, exportable content (`RULE-10`) |
| PP-012 | Everything Versioned | Satisfied | `BR-0026` — an approved set is immutable and a later edit creates a change; a superseded baseline stays readable |
| PP-013 | Knowledge-Driven Engineering | Satisfied | clarification questions and their answers are retained as project knowledge, not discarded on approval |
| PP-014 | Configuration over Customization | Satisfied | the Room is a **configured** loop instance (`BR-0064`), which is what makes the Change and Defect Rooms cheap |
| PP-015 | Open Standards | Not applicable | no external requirements-interchange standard is adopted; the choice is this Epic's plan |
| PP-016 | Explainable AI | Satisfied | `BR-0022`'s epistemic labelling — fact, inference, recommendation, unresolved question — is `FR-RQR-011`, and `UX-0031` makes it visible rather than merely recorded |
| PP-017 | Cost-Aware AI | Partial | AI clarification and options generation invoke models; session budgets are `BR-0106` and unowned (`U-11`). Recorded in Assumptions with the constraint that this Room must not build its own budget mechanism |
| PP-018 | Scalability First | Partial | requirement-set size and clarification volume targets are recorded in this Epic's plan |
| PP-019 | Continuous Improvement | Satisfied | requirement-origin defect rate is `BG-01`'s measure and becomes computable once baselines exist |
| PP-020 | Customer Value | Satisfied | `BG-01` — reducing ambiguity by making approved requirements authoritative is this Room's whole purpose |

**Deferral count**: **0.** Three principles are Partial and each names where its remainder lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Raw intent becomes an approved, immutable baseline (Priority: P1)

A product owner brings a page of unstructured intent. The Room extracts and normalizes it into
candidate requirements, asks what it cannot infer, surfaces conflicts and gaps, and — after an
authorized human decides — freezes the approved set as a baseline that cannot afterwards be edited
in place.

**Why this priority**: `BR-0026` is the requirement everything downstream leans on. A specification
generated from a set that can be quietly edited is a specification with no fixed antecedent, and
`BG-01`'s traceability measure becomes unverifiable.

**Independent Test**: submit unstructured intent, run the Room to baseline, then attempt an in-place
edit of the approved set and assert it is refused and offered as a change instead.

**Acceptance Scenarios**:

1. **Given** unstructured intent, **When** it is submitted, **Then** candidate requirements are
   extracted, normalized to typed identifiers, and presented as **candidates** rather than as facts.
2. **Given** an approved requirement set, **When** it is baselined, **Then** the baseline is
   immutable and carries its approver, rationale, timestamp and version.
3. **Given** a baselined set, **When** a user edits a requirement in it, **Then** the edit is refused
   as an in-place change and is offered as a Change Request against that baseline (`RULE-02`).
4. **Given** a superseded baseline, **When** it is read, **Then** it remains readable and identifies
   the baseline that superseded it.

---

### User Story 2 - The AI asks what it cannot infer, and never disguises a guess as a fact (Priority: P1)

A business analyst reads the Room's analysis. Every statement is labelled: this is recorded fact,
this is inference, this is a recommendation, this is an unresolved question. They answer the
questions in one pass, and the answers become part of the requirement record.

**Why this priority**: `BR-0022` and `RULE-03`. `UX-0031` states the failure mode as a design rule:
*"A recommendation that renders identically to an approved decision is a governance failure expressed
as a styling choice."* If the labelling is not built in from the first screen, it is retrofitted
after somebody has already acted on an inference.

**Independent Test**: run analysis over intent containing a known gap and a known ambiguity; assert
every output element carries exactly one epistemic label, and that unanswered questions block
baseline rather than defaulting.

**Acceptance Scenarios**:

1. **Given** AI analysis output, **When** it is presented, **Then** every element is labelled fact,
   inference, recommendation, or unresolved question — exactly one label, never none.
2. **Given** a set of clarification questions, **When** they are presented, **Then** they are
   presented **together** rather than one at a time, and each is answerable in place.
3. **Given** an unresolved question on a requirement intended for implementation, **When** baseline is
   attempted, **Then** it is refused and the open questions are named.
4. **Given** AI output rendered beside a recorded decision, **When** the Room is displayed, **Then**
   the two are visually distinguishable without reading the labels (`UX-0031`).

---

### User Story 3 - Nothing is baselined without measurable acceptance criteria (Priority: P1)

A requirement intended for implementation carries acceptance criteria that a tester could run.
Baseline is refused without them, unless an approved exception exists — and the exception is visible.

**Why this priority**: `BR-0024`. This is where `BG-01`'s *"fewer requirement-origin defects"*
actually comes from — a requirement whose acceptance is decided later is decided by whoever
implements it.

**Independent Test**: attempt baseline on a requirement with no acceptance criteria; assert refusal.
Then repeat under a recorded exception and assert the exception is attached and enumerable.

**Acceptance Scenarios**:

1. **Given** a requirement intended for implementation with no measurable acceptance criteria,
   **When** baseline is attempted, **Then** it is refused and the requirement is named.
2. **Given** the same requirement under an authorized exception, **When** baseline proceeds, **Then**
   the exception carries its authorizer and reason and reads as an exception thereafter.
3. **Given** a baselined set, **When** its exceptions are requested, **Then** they are enumerable
   without opening each requirement.

---

### User Story 4 - Material decisions come with options, trade-offs and risks (Priority: P2)

Before a material requirement decision, the Room presents feasible options with their trade-offs,
dependencies and risks, and the reasoning behind each — clearly marked as recommendations.

**Why this priority**: `BR-0023`. A decision surface offering one path is a conclusion wearing a
decision's clothes — the same objection `EPIC-027`'s own decision register raises against a conflict
recorded with fewer than two options.

**Independent Test**: trigger a material decision and assert at least two options, each with
trade-offs, dependencies, risks and stated reasoning, all labelled as recommendation.

**Acceptance Scenarios**:

1. **Given** a material requirement decision, **When** options are generated, **Then** two or more
   are presented, each with trade-offs, dependencies and risks.
2. **Given** presented options, **When** they are displayed, **Then** each is marked a recommendation
   and none is pre-selected as decided.
3. **Given** a decision taken, **When** it is recorded, **Then** the option chosen, the rationale and
   the options **not** chosen are all retained.

---

### User Story 5 - A baselined set is a selectable input to specification (Priority: P2)

An engineer starting specification work selects an approved baseline as the input. The specification
that results traces to that baseline version.

**Why this priority**: `BR-0027`. Without the handoff the Room produces an artifact nothing consumes,
and the *Intent → Requirement → Specification* chain that `BG-03` measures has a gap exactly where
the approval happened.

**Independent Test**: baseline a set, start a specification workflow, and assert the baseline version
is recorded as its input.

**Acceptance Scenarios**:

1. **Given** one or more approved baselines, **When** a specification workflow is started, **Then**
   they are selectable as its input.
2. **Given** a specification produced from a baseline, **When** it is inspected, **Then** it names
   the baseline **version** it derived from.

---

### User Story 6 - The Room looks and reads like the other two (Priority: P3)

A user who has used the Change Room opens the Requirement Room and finds the same six regions in the
same vocabulary: object state, loop progress, AI analysis, decision, evidence, activity timeline.

**Why this priority**: `UX-0030` and `UX-0035`. P3 because it is provable only once a second Room
exists — but specified here, in the first Room, because the first Room is what the other two will be
built to match. A vocabulary settled by accident in Room one is a vocabulary the other two inherit.

**Independent Test**: assert all six regions are present and that their names come from the shared
pattern definition rather than from this Room's own vocabulary.

**Acceptance Scenarios**:

1. **Given** the Requirement Room, **When** it renders, **Then** all six required regions are present.
2. **Given** the region names, **When** they are compared with the shared pattern, **Then** they are
   identical — a Room-local synonym is not expressible.
3. **Given** an object blocked by a missing approval or unmet evidence, **When** the Room renders,
   **Then** the blocker is visible without opening another screen (`UX-0032`).

### Edge Cases

- **Intent contradicts an existing baseline** — surfaced as a conflict during analysis, and resolved
  by decision rather than by the newer text winning. Last-write-wins on requirements is how a
  baseline stops meaning anything.
- **A requirement is baselined and the source document is later revised** — the baseline does not
  move. The revision enters as new intent.
- **An AI proposes a requirement nobody asked for** — it is a candidate labelled *recommendation* and
  cannot reach baseline without a human decision (`RULE-03`).
- **A stakeholder decides while lacking authority for that risk band** — refused by `EPIC-031`'s
  policy, and the refusal is shown in the Room with its deciding policy (`UX-0033`).
- **Two baselines are approved concurrently for overlapping requirements** — the second must be
  raised against the first, not beside it; concurrent approval of overlapping scope is a conflict,
  not a merge.
- **A clarification question is never answered** — the requirement cannot be baselined for
  implementation, and the Room says which question is blocking rather than reporting "not ready".
- **A requirement is baselined with zero acceptance criteria under an exception** — permitted, and
  the exception is enumerable forever after. An exception that becomes invisible is a rule that was
  waived once and then forgotten.
- **`EPIC-007` already holds requirement records** — this Room consumes that register (`FR-RQR-002`)
  rather than creating a second one, which is `D-33`'s whole point.
- **A Change Room stage would be useful here** — not expressible. Each Room is a distinct workflow
  type (`FR-RQR-001`); borrowing another Room's stage would collapse two governed surfaces, which is
  the one thing `ADR-0018` decided against *(clarified 2026-08-22)*.
- **An external stakeholder needs to review a requirement** — not supported, and the Room states that
  rather than failing on click (`FR-RQR-004`, `UX-0002`). `U-02` owns it *(clarified 2026-08-22)*.

## Requirements *(mandatory)*

### Functional Requirements

*Room identity and boundary.*

- **FR-RQR-001**: The Requirement Room MUST be a **distinct configured workflow type** of the Governed Engineering Loop (`BR-0064`, `EPIC-030`), not a workflow implemented beside it and not a variant of a shared Room type. Its stages, authorities and gates are its own; the engine is shared. `EPIC-030` `FR-GEL-004` enforces the distinctness *(clarified 2026-08-22)*.
- **FR-RQR-002**: This Epic MUST consume the requirement register `EPIC-007` owns (`BR-0020`, `BR-0021`) and MUST NOT create a second requirement store (`D-33`).
- **FR-RQR-003**: This Epic MUST NOT implement the loop (`EPIC-030`), risk and approval policy (`EPIC-031`), the evidence store (`EPIC-032`), the Change Room (`EPIC-034`) or the Defect Room (`EPIC-035`).
- **FR-RQR-004**: This Epic MUST NOT build an external-stakeholder access path. `BR-0004` is `U-02` and unowned; until it is declared this Room serves workspace-internal authorized identities only, and MUST say so rather than degrading silently *(clarified 2026-08-22)*.

*Guided clarification — `BR-0022`.*

- **FR-RQR-010**: The system MUST generate targeted clarification questions from submitted intent and from candidate requirements.
- **FR-RQR-011**: Every AI output element MUST carry exactly one epistemic label: **fact**, **inference**, **recommendation**, or **unresolved question**. An unlabelled element MUST NOT be presentable.
- **FR-RQR-012**: Clarification questions MUST be presented as one set rather than one at a time, and MUST be answerable in place.
- **FR-RQR-013**: Answers MUST be retained as part of the requirement record, not discarded once resolved.
- **FR-RQR-014**: The system MUST identify conflicts, duplicates, gaps and assumptions across the candidate set before baseline.
- **FR-RQR-015**: Intent that contradicts an existing baseline MUST surface as a conflict for decision, never resolve by recency.

*Options and risks — `BR-0023`.*

- **FR-RQR-020**: For a material requirement decision, the system MUST present **two or more** feasible options.
- **FR-RQR-021**: Each option MUST carry its trade-offs, dependencies, risks and the reasoning behind it.
- **FR-RQR-022**: Options MUST be marked recommendations; none MUST be pre-selected as decided.
- **FR-RQR-023**: A recorded decision MUST retain the option chosen, its rationale, and the options not chosen.

*Acceptance criteria — `BR-0024`.*

- **FR-RQR-030**: A requirement intended for implementation MUST carry **measurable** acceptance criteria before baseline.
- **FR-RQR-031**: Baseline MUST be refused where such a requirement lacks them, naming the requirement.
- **FR-RQR-032**: An approved exception MAY permit baseline without them; the exception MUST carry its authorizer and reason.
- **FR-RQR-033**: Exceptions on a baseline MUST be enumerable without opening each requirement.

*Stakeholder decision — `BR-0025`.*

- **FR-RQR-040**: Requirement decisions and approvals MUST be made by **authorized humans** and retained with rationale.
- **FR-RQR-041**: An AI or agent MUST NOT take a requirement decision. It MAY prepare, propose and recommend.
- **FR-RQR-042**: Decision authority MUST be evaluated through `EPIC-031`'s policy engine, using the `BR-0005` decision-authority record rather than a Room-local one.
- **FR-RQR-043**: A refused decision MUST show the policy that refused it (`UX-0033`).
- **FR-RQR-044**: Decisions MUST surface in the Decision Inbox (`BR-0068`, `EPIC-031`) rather than only inside this Room.

*Baseline — `BR-0026`.*

- **FR-RQR-050**: An approved requirement set MUST form an **immutable baseline**, carrying approver, rationale, timestamp and version.
- **FR-RQR-051**: An edit to a baselined requirement MUST be refused as an in-place change and offered as a Change Request against that baseline (`RULE-02`, `BR-0042`).
- **FR-RQR-052**: A superseded baseline MUST remain readable and MUST identify what superseded it.
- **FR-RQR-053**: A baseline MUST satisfy its Evidence Contract before approval completes (`BR-0142`, `EPIC-032`).
- **FR-RQR-054**: Concurrent approval of overlapping requirement scope MUST surface as a conflict, not merge.
- **FR-RQR-055**: A revision to a source document after baseline MUST enter as new intent and MUST NOT move an existing baseline.

*Handoff — `BR-0027`.*

- **FR-RQR-060**: Baselined requirement sets MUST be selectable inputs to one or more specification workflows.
- **FR-RQR-061**: A specification produced from a baseline MUST record the baseline **version** it derived from.
- **FR-RQR-062**: The handoff MUST be engine-agnostic — a baseline is not a Spec Kit artifact.

*Room pattern — `UX-0030` to `UX-0035`.*

- **FR-RQR-070**: The Room MUST present all six required regions: object state, loop progress, AI analysis, decision, evidence, activity timeline.
- **FR-RQR-071**: Region names MUST come from the shared Room pattern; a Room-local synonym MUST NOT be expressible (`UX-0035`).
- **FR-RQR-072**: AI output MUST be **visually distinguishable** from recorded fact and from human decision (`UX-0031`).
- **FR-RQR-073**: What is blocking progress — missing evidence, pending approval, policy block — MUST be visible without opening another screen (`UX-0032`).
- **FR-RQR-074**: Loop progress MUST render from `EPIC-030`'s shared projection rather than a Room-local translation.
- **FR-RQR-075**: The Room MUST remain able to show state, decision and evidence at a 360px viewport (`UX-0040`, `UX-0042`).

### Key Entities

- **Requirement Candidate**: an extracted, normalized, not-yet-decided requirement, always labelled by epistemic status.
- **Clarification**: a targeted question, its answer, and its author. Retained after resolution.
- **Requirement Decision**: an authorized human decision with rationale, chosen option and the options declined.
- **Acceptance Criterion**: a measurable, testable condition attached to a requirement before baseline.
- **Baseline**: an immutable approved requirement set with approver, rationale, timestamp and version. The unit `RULE-02` protects.
- **Baseline Exception**: an authorized, recorded departure from a baseline precondition. Enumerable forever after.
- **Handoff**: the selection of a baseline version as input to a specification workflow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-RQR-001**: **Zero** approved baselines can be edited in place; every attempt is refused and offered as a change — mutation-tested by adding an in-place edit path and observing the suite fail.
- **SC-RQR-002**: **100%** of AI output elements carry exactly one epistemic label; an unlabelled element is not presentable.
- **SC-RQR-003**: **Zero** requirements intended for implementation reach baseline without measurable acceptance criteria or a recorded exception.
- **SC-RQR-004**: **Zero** requirement decisions are taken by a non-human actor.
- **SC-RQR-005**: **100%** of material decisions present two or more options with trade-offs, dependencies and risks.
- **SC-RQR-006**: Every baseline is traceable to the intent it came from and to the specifications derived from it, in both directions.
- **SC-RQR-007**: All six Room regions are present and their names match the shared pattern exactly — verified by comparison, not review.
- **SC-RQR-008**: A person can carry unstructured intent through to an approved baseline **using only a keyboard**, with focus visible at every step (`BR-0193`, `EPIC-029`).
- **SC-RQR-009**: This Room resolves as its own workflow type: **zero** transitions succeed under another Room's stages, authorities or gates — asserted by `EPIC-030`'s `T944a` against this type *(clarified 2026-08-22)*.

## Assumptions

- **PMI-DOC-006 v1.0 is `PROPOSED`, not approved.** `FR-RQR-070`–`FR-RQR-075` cite `UX-0030`–`UX-0035` and `UX-0040`. `BR-0191`, which requires the shared Room pattern, is *SHOULD* in PMI-DOC-004 — so the pattern's binding force comes largely from the proposed document. **Back-fill owner: project owner**, through the PMI-DOC-006 approval outstanding as decision 6 of `brs-v2-reconciliation.md` §7. This is the strongest SRS dependency of the three Rooms and should be discharged before `EPIC-034` plans against the same pattern.
- **`BR-0004` stakeholder access is `U-02` and unowned — confirmed 2026-08-22, no interim path.** *"Authorized external stakeholders review assigned requirements without receiving broader engineering access"* is a Requirement Room-adjacent capability this Epic does **not** own. `FR-RQR-004` now states the prohibition as a requirement rather than an intention: an interim path would be a second authorization model beside `EPIC-024`'s. **Owner: product owner**, when `U-02` is declared.
- **`BR-0106` session cost limits are `U-11` and unowned.** AI clarification and options generation invoke models. This Room MUST NOT build its own budget mechanism; it consumes whatever `U-11` supplies and, until then, records model usage without enforcing a ceiling.
- Depends on `EPIC-030` (loop), `EPIC-031` (decision and Inbox) and `EPIC-032` (evidence). All three are declared in this same Wave; the sequencing is that this Room is planned after the three are specified, not after they are built.
- `EPIC-007` is closed and keeps its scope (`D-33`). This Room extends the requirement lifecycle above EPIC-007's register; it does not reopen it.
- Design system, themes and accessibility are `EPIC-029`'s. This Room styles its own work against that system (`FR-DS-052`), and `SC-RQR-008` is the accessibility obligation it inherits.
- Requirement-set size and clarification-volume targets are this Epic's plan (`PP-018`).
- **This Epic delivers a user-facing journey** — a Room is a screen a person works in. Constitution XI Tier 2 applies in full.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for the loop-instance configuration and Room pattern outputs, a passing executable conformance check (Constitution V)
- [ ] **`FR-RQR-051` is mutation-tested**: an in-place edit path for a baselined requirement is added and the suite observed failing (`SC-RQR-001`). `RULE-02` is the rule the Change Room's existence depends on
- [ ] **`FR-RQR-011` is mutation-tested**: an unlabelled AI output element is made presentable and the suite observed failing (`SC-RQR-002`)
- [ ] The Room is demonstrably a **configured instance** of `EPIC-030`'s loop — shown by the instance configuration, not asserted (`FR-RQR-001`)
- [ ] Region names are verified identical to the shared Room pattern by comparison rather than by review (`SC-RQR-007`)
- [ ] **Constitution XI Tier 1** — a test drives the Room through its **real entry point** against the composed module graph
- [ ] **Constitution XI Tier 2** — the intent-to-baseline journey has been exercised against a **running application** and a **run-generated** transcript is committed. A hand-written transcript does not satisfy this (the `SC-AGT-001` precedent)
- [ ] The `BR-0004` external-stakeholder gap is restated in the closing report as still owned by `U-02`, so nobody reads this Room's delivery as having closed it
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/033-requirement-room/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)
