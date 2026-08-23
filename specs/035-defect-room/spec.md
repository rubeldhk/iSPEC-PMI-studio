# Epic Specification: Defect Room

**Epic**: `EPIC-035` | **Module**: Intent & Control — the third of three Rooms, and an instance of the Governed Engineering Loop

**Feature Branch**: `epic/035-defect-room`

**Created**: 2026-08-22

**Status**: Draft

**Authorised by**: PMI-DOC-004 v2.0 **APPROVED 2026-08-22**, whose §6.6 makes the Defect Room a
first-class requirement; [`ADR-0015`](../../adr/ADR-0015-requirement-change-defect-governance-authority.md)
**Accepted 2026-08-22**; Wave 1 of PMI-DOC-004A §13.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — nothing holds this Epic. **This is the Epic
> [`ADR-0016`](../../adr/ADR-0016-tdd-defect-execution-policy.md) has been waiting for**: its
> `Awaits` reads *"the Defect Room epic, which does not yet exist"*, and its stated Negative
> consequence — *"depends on approved baselines existing, which depends on the Requirement Room,
> which depends on `PMI-DOC-004`"* — is now discharged twice over: PMI-DOC-004 v2.0 was approved on
> 2026-08-22, and the Requirement Room is declared in this same Wave as `EPIC-033`. Readiness still
> runs through the Definition-of-Ready gate, not by declaration (EPIC-026).

> ## ⚠ This is a BUILD, not an enhancement — despite what the amendment says
>
> The accepted amendment refers to *"the existing Defect Room"*. **There is no existing Defect
> Room.** `EPIC-027` Finding A, confirmed by the project owner on 2026-08-22 and recorded in
> `ADR-0015`: `PRE-001` to `PRE-004` searched all 27 other Epic specifications and returned **zero
> occurrences**. **Size this as new capability.**

**Input**: User description: "Build the Defect Room: test-first defect remediation per Epic, with a
governed transfer path to the Change Room. The flow is report or test failure, classify, link to epic
requirement and spec, reproduce, create a failing test, diagnose, add implementation work, fix, run
test and regression, evidence, close."

## Clarifications

### Session 2026-08-22

Two questions, both answered with the recommended option, in a consolidated round covering
`EPIC-031` to `EPIC-035` (Constitution X). The first was asked once and applies to all three Rooms.

- Q: Is each Room a distinct loop workflow type, or one shared type with variants? -> A: **Three distinct workflow types over one engine** (`FR-DFR-001`). `ADR-0018`'s only decided constraint, now enforced by `EPIC-030`'s `T944a`/`T944b` rather than asserted.
- Q: Where does a **Requirement Gap** go? -> A: **To the Requirement Room (`EPIC-033`) as new intent** (`FR-DFR-076`), with the defect record retained and marked reclassified, never deleted. **This was a real gap, found by the scan rather than by reading.** `ADR-0016` names three classification outcomes and this specification routed only two — Confirmed Defect to repair, Change Request to the Change Room. The third had **no destination at all**. A Requirement Gap cannot go to the Change Room, because there is no approved baseline to change; that absence is precisely what makes it a gap. Leaving it unrouted would have produced an item that classified correctly and then stopped moving.

**Deferred, deliberately.** Regression-suite runtime and close-path targets (`PP-018`) are
plan-level. The PMI-DOC-006 approval is an act of the project owner. `ADR-0016`'s convergence stays
in Epic Exit Criteria — its shape includes runtime behaviour only implementation can confirm.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0051` — Defect intake | FR-DFR-010 to FR-DFR-013 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0052` — Classification | FR-DFR-020 to FR-DFR-025 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0053` — Reproduction | FR-DFR-030 to FR-DFR-033 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0054` — Test-first repair | FR-DFR-040 to FR-DFR-044 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0055` — Repair work | FR-DFR-050 to FR-DFR-052 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0056` — Verification | FR-DFR-060 to FR-DFR-063 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0057` — Defect-to-change transfer | FR-DFR-070 to FR-DFR-075 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.6 `BR-0058` — Defect analytics | FR-DFR-080 to FR-DFR-083 |
| [`adr/ADR-0016-tdd-defect-execution-policy.md`](../../adr/ADR-0016-tdd-defect-execution-policy.md) | Open — the triage shape, **three outcomes not two**, and the never-delete rule | FR-DFR-021 to FR-DFR-025, FR-DFR-044 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §6.1 `UX-0030` six regions; §6.2 `UX-0034` the transfer action and **why it is offered**, `UX-0031`, `UX-0035` | FR-DFR-072, FR-DFR-090 to FR-DFR-095 |

**Requirements not yet covered by SRS**: **None.** Every requirement traces to an approved `BR-` in
PMI-DOC-004 v2.0 §6.6 or to `ADR-0016`. `FR-DFR-072` and `FR-DFR-090`–`FR-DFR-095` additionally cite
PMI-DOC-006 v1.0, which is **PROPOSED, not approved** — the back-fill owner is named under
Assumptions.

### Ownership notes — read before planning

**This Epic owns eight requirements**: `BR-0051` through `BR-0058` — exactly capability area `U-05`
as [`brs-v2-reconciliation.md`](../brs-v2-reconciliation.md) §4 defines it. It is the largest owned
set of the six Wave 1 Epics.

| Cited | Owner | Why it appears here |
|---|---|---|
| `BR-0080` QA validation | `EPIC-015` | test execution and validation against acceptance criteria. This Room **requests and consumes** it; it does not build a second test runner (`FR-DFR-062`) |
| `BR-0042` Change intake | `EPIC-034` (`U-04`) | the transfer **target**. This Epic owns the decision to transfer; `EPIC-034` owns receiving it |
| `BR-0026` Baseline | `EPIC-033` (`U-01`) | *"approved expected behavior"* in `BR-0052` **is** a baseline. Without `EPIC-033` there is nothing to classify against — `ADR-0016`'s stated Negative |
| `BR-0050`, `BR-0151` Tasks, provenance | `EPIC-012` | `BR-0055` converts a defect into traceable implementation tasks; `EPIC-012` owns the task model |
| `BR-0163` Operational feedback | **unowned** (`U-19`) | *"incidents and telemetry anomalies SHOULD be linkable back into the Defect and Change Rooms"*. This Room accepts monitoring-originated defects (`BR-0051`); the **linking back from production telemetry is `U-19`** and not owned here |
| `BR-0064`, `BR-0067`, `BR-0068`, `BR-0140`–`BR-0144` | `EPIC-030`, `EPIC-031`, `EPIC-032` | loop, policy, Inbox, evidence — consumed as substrate |

#### This is the product capability, not the repository convention

Constitution VI requires every Epic in **this repository** to keep `specs/<epic-id>/defects/`. That
is the programme's own defect discipline and it is unchanged by this Epic. What this Epic builds is
the **product** capability PMI Studio offers its customers. The two share a word and nothing else,
and conflating them would make this Epic look like it already exists — which is exactly the class of
error Finding A corrected.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | a defect is classified **against approved expected behaviour before implementation work begins** (`BR-0052`); AI triages and proposes, it does not authorise a fix |
| PP-002 | Single Source of Truth | Satisfied | approved behaviour comes from the baseline, not from a defect reporter's expectation |
| PP-003 | Human-in-the-Loop | Satisfied | reclassification to a change is a decision, and `ADR-0016` warns explicitly against automating it — *"do NOT blindly classify every passing reproduction test as a Change Request"* |
| PP-004 | End-to-End Traceability | Satisfied | defect → epic → requirement → specification → failing test → task → fix → evidence, and `BR-0058` retains origin and escape point |
| PP-005 | Modular Architecture | Satisfied | a loop instance; test execution is `EPIC-015`'s and tasks are `EPIC-012`'s |
| PP-006 | Engine Independence | Satisfied | a defect references artifacts and tests, not an engine's model |
| PP-007 | API & MCP First | Partial | intake from monitoring and CI is an API surface — the one place this Room most needs machine callers; MCP exposure lands with `EPIC-013` `BR-0122` |
| PP-008 | Security by Design | Satisfied | reproduction detail can carry sensitive payloads, so `FR-DFR-033` requires evidence attached under the artifact's own access rules (`BR-0062`), never as an open attachment |
| PP-009 | Quality by Design | Satisfied | `BR-0054` is test-first made mandatory: a failing test exists **before** a fix is accepted. This is Constitution V's rule offered as a product capability |
| PP-010 | Observability by Default | Satisfied | escape point, origin and severity are retained (`BR-0058`), which is what makes escaped-defect rate a measure rather than an impression |
| PP-011 | Documentation as Code | Satisfied | defect records, tests and evidence are versioned repository-visible content |
| PP-012 | Everything Versioned | Satisfied | a defect names the artifact **version** whose behaviour it contests |
| PP-013 | Knowledge-Driven Engineering | Satisfied | `BR-0058`'s origin and escape-point data is the organisation's own quality feedback, retained rather than closed over |
| PP-014 | Configuration over Customization | Satisfied | a configured loop instance sharing the Room pattern |
| PP-015 | Open Standards | Not applicable | no external defect-interchange standard is adopted; recorded in this Epic's plan |
| PP-016 | Explainable AI | Satisfied | AI triage output is labelled by epistemic status (`UX-0031`), and `FR-DFR-072` requires the Room to state **why** a transfer is being offered rather than merely offering it |
| PP-017 | Cost-Aware AI | Partial | triage and diagnosis invoke models; budgets are `BR-0106` and unowned (`U-11`). This Room must not build its own |
| PP-018 | Scalability First | Partial | regression-suite runtime bounds the close path; targets are this Epic's plan, and execution is `EPIC-015`'s |
| PP-019 | Continuous Improvement | Satisfied | `BG-06`'s escaped-defect rate is computed from `BR-0058` data |
| PP-020 | Customer Value | Satisfied | `BG-09` — defect handling inside the living specification lifecycle rather than in a bug tracker beside it |

**Deferral count**: **0.** Three principles are Partial and each names where its remainder lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A defect is judged against approved behaviour, not against an opinion (Priority: P1)

A report arrives. Before any fix is authorised, the Room identifies the approved expected behaviour
the report contests — the baselined requirement and its specification — and classifies the report
against it.

**Why this priority**: `BR-0052`. `ADR-0016`'s Positive consequence is exactly this: *"the
expectation-verification gate prevents new functionality being implemented under the label of bug
fixing."* Every defect process without this gate becomes an unbudgeted change channel.

**Independent Test**: submit a report that contests behaviour matching an approved baseline, and one
that contests behaviour the baseline does not cover; assert the first is not confirmed as a defect
and the second is classified as a requirement gap.

**Acceptance Scenarios**:

1. **Given** a defect report, **When** it is triaged, **Then** the approved expected behaviour it
   contests is identified and linked, or its absence is recorded.
2. **Given** a report where approved current behaviour is correct, **When** classification runs,
   **Then** it is not confirmed as a defect.
3. **Given** a report where **no approved behaviour exists at all**, **When** classification runs,
   **Then** the outcome is a **Requirement Gap** — the third outcome `ADR-0016` names, distinct from
   both defect and change.
4. **Given** any classification, **When** it is recorded, **Then** implementation work cannot begin
   until it has happened.

---

### User Story 2 - No fix is accepted without a failing test that proved the defect (Priority: P1)

An engineer reproduces the defect, a test is written that fails because of it, and only then is
repair work authorised. Closure requires that test plus applicable regression tests to pass.

**Why this priority**: `BR-0054` and `BR-0056`. Without it "fixed" means "the code changed", which
`ADR-0016` and Constitution V both refuse. It is also what makes `BR-0058`'s escape-point analytics
meaningful — a defect with no test never proved it existed.

**Independent Test**: attempt to accept a fix with no failing test on record and assert refusal; then
supply a test that fails, apply a fix, and assert closure requires both it and the regression set to
pass.

**Acceptance Scenarios**:

1. **Given** an automatable confirmed defect with no failing test, **When** a fix is submitted,
   **Then** it is not accepted.
2. **Given** a failing test demonstrating the defect, **When** a fix is applied, **Then** closure
   requires that test **and** applicable regression tests to pass, with the evidence retained.
3. **Given** a defect that is not automatable, **When** it is processed, **Then** the reason is
   recorded and alternative evidence is required — the exception is visible, not implicit.
4. **Given** a fix whose test passes but whose regression set fails, **When** closure is attempted,
   **Then** it is refused and the failing regression is named.
5. **Given** a defect under investigation, **When** its reproduction is recorded, **Then**
   reproducibility, environment, evidence and affected behaviour are all captured as data — not left
   implicit in the test — and the evidence is readable only under the access rules of the artifact it
   concerns (`BR-0053`, `FR-DFR-030`, `FR-DFR-033`) *(added 2026-08-22)*.

---

### User Story 3 - A defect that is really a change is transferred, not fixed (Priority: P1)

Approved current behaviour passes. The requested behaviour would alter intent. The Room offers
transfer to the Change Room, **states why it is offering it**, and carries the context and evidence
across intact.

**Why this priority**: `BR-0057`, and the reason this Room is not a bug tracker. A change implemented
as a defect fix is a baseline mutated without a change decision — `RULE-02` violated through the side
door, with no diff in the change record to show it.

**Independent Test**: construct an item whose reproduction test passes against approved behaviour and
whose request alters intent; assert transfer is offered with a stated reason, and that context and
evidence arrive in the Change Room intact.

**Acceptance Scenarios**:

1. **Given** approved current behaviour passing and a request that would alter intent, **When**
   triage completes, **Then** the item MUST transfer to the Change Room.
2. **Given** a transfer, **When** it occurs, **Then** context and evidence are preserved and the
   origin is visible from the resulting Change Request.
3. **Given** the transfer action, **When** it is offered, **Then** the Room **states why** it is
   being offered (`UX-0034`) — an unexplained transfer button is a reclassification nobody decided.
4. **Given** a reclassified item, **When** the defect record is read, **Then** it is recorded as
   reclassified and **never deleted** (`ADR-0016`).

---

### User Story 4 - A passing reproduction test is not automatically a change (Priority: P2)

The reproduction test passes. The Room does not conclude "change request". It routes to an evidence
check that may refine the test, investigate further, or reclassify.

**Why this priority**: `ADR-0016` quotes the source rule directly — *"Do NOT blindly classify every
passing reproduction test as a Change Request"* — because a test may pass for three uninteresting
reasons: it was wrong, the environment differed, or the defect is intermittent. Automating this step
converts every flaky test into a scope change.

**Independent Test**: submit a passing reproduction test and assert the outcome is an evidence check
with three available paths, not an automatic reclassification.

**Acceptance Scenarios**:

1. **Given** a passing reproduction test, **When** triage evaluates it, **Then** the outcome is an
   evidence check, not an automatic Change Request.
2. **Given** the evidence check, **When** it resolves, **Then** it may refine the test, request
   further investigation, or reclassify — and which path was taken is recorded.
3. **Given** an intermittent defect, **When** a single passing run is recorded, **Then** it does not
   by itself close or reclassify the defect.

---

### User Story 5 - Defects arrive from everywhere and always link to an Epic (Priority: P2)

Defects originate from automated tests, manual reports, monitoring, review tools and production
incidents. Each is linked to an Epic and a project regardless of origin.

**Why this priority**: `BR-0051`. An unlinked defect is invisible to per-Epic quality accounting, and
per-Epic is the granularity this programme's whole convergence model works at.

**Independent Test**: submit a defect from each named origin and assert all five land with an Epic
and project link and a recorded origin.

**Acceptance Scenarios**:

1. **Given** each origin `BR-0051` names, **When** a defect is submitted, **Then** it is accepted and
   linked to an Epic and a project.
2. **Given** a defect that cannot be linked to an Epic, **When** it is submitted, **Then** it is held
   for triage with the missing link named — not silently accepted unlinked.
3. **Given** a defect from monitoring, **When** it is read, **Then** its origin is recorded; **linking
   production telemetry back automatically is `BR-0163` and remains unowned**, which the Room states
   rather than implies.

---

### User Story 6 - Closed defects answer why they escaped (Priority: P3)

An engineering lead asks where defects are originating and where they are escaping. The answer comes
from retained data, not a survey.

**Why this priority**: `BR-0058`. P3 because it accrues value only once defects have flowed through —
but the fields must be captured from the first defect or the first quarter of data is lost.

**Independent Test**: close several defects and assert origin, escape point, severity, affected
requirement and specification, and resolution evidence are retained and queryable in aggregate.

**Acceptance Scenarios**:

1. **Given** a closed defect, **When** it is read, **Then** origin, escape point, severity, affected
   requirement and specification, and resolution evidence are all present.
2. **Given** a set of closed defects, **When** quality analysis is requested, **Then** escape point
   and origin are aggregatable without opening each record.

### User Story 7 - A confirmed defect becomes traceable repair work (Priority: P2)

A defect is confirmed. It becomes implementation tasks that carry their origin with them: each links
back to the failing behaviour and to the test that proved it, so an engineer picking one up months
later can see what it is repairing and why that repair is owed.

**Why this priority**: `BR-0055`. Confirming a defect and *fixing* it are different acts, and the
bridge between them is where traceability is usually lost — a task created by hand from a defect
someone read carries no link back, and `BR-0058`'s escape analytics then measures a population it
cannot join to its causes. Added 2026-08-22 after a cross-Epic scan found `BR-0055` owned, with
functional requirements, and exercised by **no user story** — the same shape as `EPIC-031`'s `C1`,
found before it could reach a task list rather than after.

**Independent Test**: confirm a defect, convert it, and assert the resulting tasks are `EPIC-012`
tasks each linked to the failing behaviour and its test — and that conversion is refused before
classification has happened.

**Acceptance Scenarios**:

1. **Given** a confirmed defect, **When** repair work is created, **Then** it becomes traceable
   implementation tasks, each linked to the failing behaviour and to its test.
2. **Given** a defect that has **not** been classified, **When** conversion is attempted, **Then** it
   is refused — repair work must not begin before classification (`FR-DFR-052`).
3. **Given** repair tasks created from a defect, **When** they are inspected, **Then** they are
   `EPIC-012` tasks and **not** a Room-local task model (`FR-DFR-051`).
4. **Given** a defect reclassified after tasks were created, **When** the record is read, **Then**
   the tasks and the reclassification are both visible — the tasks are not silently orphaned.

### User Story 8 - The Room reads like the other two (Priority: P3)

The same six regions, the same vocabulary, the same treatment of AI output as in the Requirement and
Change Rooms.

**Why this priority**: `UX-0030`, `UX-0035`. P3 because it is inherited rather than invented here —
`EPIC-033` sets the pattern and this Room must not diverge from it. *Added 2026-08-23 to close
analysis finding `I1`: `FR-DFR-090`–`FR-DFR-095` had no user story, so the whole Room surface was
carried inside `US4`, a story about passing reproduction tests, whose independent test does not
render the Room. Both sibling Rooms have this story; this one did not.*

**Independent Test**: [quickstart.md](./quickstart.md) Scenario 16 — assert all six regions present,
region names identical to `packages/room-contract` and to `EPIC-033`'s by programmatic comparison,
and that a Defect Room object cannot transition under another Room's stages.

**Acceptance Scenarios**:

1. **Given** the Defect Room, **When** it renders, **Then** all six required regions are present with
   names identical to the shared pattern (`FR-DFR-090`, `FR-DFR-091`).
2. **Given** AI triage output, **When** it is displayed, **Then** it is visually distinguishable from
   recorded fact and from human decision (`FR-DFR-092`, `UX-0031`).
3. **Given** a blocked defect, **When** the Room renders, **Then** what is blocking is visible without
   opening another screen, and a policy-refused action shows the refusing policy (`FR-DFR-093`,
   `FR-DFR-094`).
4. **Given** a 360px viewport, **When** the Room renders, **Then** state, decision and evidence remain
   visible (`FR-DFR-095`, `UX-0040`, `UX-0042`).

### Edge Cases

- **The contested behaviour has no approved baseline at all** — **Requirement Gap**, the third
  outcome. Not a defect, not a change: treating it as either invents an approval that never
  happened. It routes to the Requirement Room as new intent (`FR-DFR-076`), because a gap needs a
  requirement written, not a baseline amended *(destination clarified 2026-08-22)*.
- **A Requirement Room stage would be useful here** — not expressible. Each Room is a distinct
  workflow type (`FR-DFR-001`); borrowing another Room's stage collapses two governed surfaces,
  which is the one thing `ADR-0018` decided against *(clarified 2026-08-22)*.
- **A defect is reported against a superseded artifact version** — recorded against the version
  reported, then re-evaluated against current. It does not silently become a defect in current
  behaviour.
- **A reproduction test cannot be automated** — the reason is recorded and alternative evidence is
  required (`FR-DFR-043`). `BR-0054` says *"where automatable"*, and an unstated exception is
  indistinguishable from a skipped rule.
- **An intermittent defect passes once** — one passing run neither closes nor reclassifies it.
- **A transfer is offered and declined** — the offer and the decline are both retained; the defect
  continues as a defect with the question recorded.
- **The Change Room refuses the transferred item** — the item returns with the refusal attached; it
  does not vanish between two Rooms.
- **A fix passes its test and breaks another Epic's** — closure is refused; `BR-0056` requires
  *applicable regression tests*, and applicability is not bounded by the defect's own Epic.
- **A defect is filed by an AI agent** — accepted as an origin, and triage still requires approved
  expected behaviour to be identified. An agent may report; it may not classify a defect as confirmed.
- **A defect is reclassified after repair tasks already exist** — the tasks and the reclassification
  are both visible; the tasks are not silently orphaned. `ADR-0016` forbids deleting a reclassified
  record, and that applies to the work it produced *(added 2026-08-22)*.
- **A defect's reproduction evidence contains sensitive data** — attached under the artifact's own
  access rules (`BR-0062`), never as an unrestricted attachment.

## Requirements *(mandatory)*

### Functional Requirements

*Room identity and boundary.*

- **FR-DFR-001**: The Defect Room MUST be a **distinct configured workflow type** of the Governed Engineering Loop (`BR-0064`, `EPIC-030`) — its own stages, authorities and gates over a shared engine, never a variant of another Room's type (`FR-GEL-004`) *(clarified 2026-08-22)*.
- **FR-DFR-002**: This Epic MUST NOT implement the loop (`EPIC-030`), policy (`EPIC-031`), the evidence store (`EPIC-032`), the Change Room (`EPIC-034`), test execution or QA validation (`EPIC-015`, `BR-0080`), the task model (`EPIC-012`), or production telemetry linkage (`BR-0163`, `U-19`).

*Intake — `BR-0051`.*

- **FR-DFR-010**: Defects MUST be acceptable from automated tests, manual reports, monitoring, review tools and production incidents.
- **FR-DFR-011**: Every defect MUST link to an Epic and a project.
- **FR-DFR-012**: A defect that cannot be linked MUST be held for triage with the missing link named, never silently accepted unlinked.
- **FR-DFR-013**: The origin of every defect MUST be recorded.

*Classification — `BR-0052`, `ADR-0016`.*

- **FR-DFR-020**: A defect MUST be classified against **approved expected behaviour before implementation work begins**.
- **FR-DFR-021**: Triage MUST identify and link the approved expected behaviour contested, or record its absence.
- **FR-DFR-022**: Classification MUST support **three outcomes**: Confirmed Defect, Change Request, and **Requirement Gap** where no approved behaviour exists at all.
- **FR-DFR-023**: An AI or agent MAY triage and propose a classification; it MUST NOT confirm a defect or authorise a fix.
- **FR-DFR-024**: A defect reported against a superseded artifact version MUST be recorded against the version reported and re-evaluated against current, never silently re-targeted.
- **FR-DFR-025**: A reclassified defect MUST be **recorded as reclassified and never deleted** (`ADR-0016`).

*Reproduction — `BR-0053`.*

- **FR-DFR-030**: The workflow MUST capture reproducibility, environment, evidence and affected behaviour.
- **FR-DFR-031**: Intermittency MUST be representable; a single passing run MUST NOT close or reclassify an intermittent defect.
- **FR-DFR-032**: Reproduction evidence MUST be stored through `EPIC-032`'s evidence store, not a Room-local attachment mechanism.
- **FR-DFR-033**: Reproduction evidence MUST be readable only under the access rules of the artifact it concerns (`BR-0062`).

*Test-first repair — `BR-0054`, `ADR-0016`.*

- **FR-DFR-040**: Where automatable, a **failing test demonstrating the defect MUST exist before a fix is accepted**.
- **FR-DFR-041**: A fix submitted with no failing test on record MUST NOT be accepted.
- **FR-DFR-042**: The failing test MUST be linked to the defect and to the behaviour it contests.
- **FR-DFR-043**: Where a defect is not automatable, the reason MUST be recorded and alternative evidence required. The exception MUST be visible and enumerable.
- **FR-DFR-044**: A **passing** reproduction test MUST route to an evidence check with three available paths — refine the test, investigate further, or reclassify — and MUST NOT reclassify automatically (`ADR-0016`).

*Repair work — `BR-0055`.*

- **FR-DFR-050**: A confirmed defect MUST be convertible into traceable implementation tasks linked to the failing behaviour and its test.
- **FR-DFR-051**: Those tasks MUST use `EPIC-012`'s task model (`BR-0050`, `BR-0151`), not a Room-local one.
- **FR-DFR-052**: Repair work MUST NOT begin before classification has happened (`FR-DFR-020`).

*Verification — `BR-0056`.*

- **FR-DFR-060**: Closure MUST require the defect test **plus applicable regression tests** to pass, with the evidence retained. **Applicable** means the **transitive test set reachable from the artifacts the fix touched**, through `EPIC-011`'s traceability chain — not a set someone selects *(defined 2026-08-23, analysis finding `A1`; the term gated this requirement and `SC-DFR-007` and was defined in none of the seven artifacts)*.
- **FR-DFR-061**: Applicable regression scope MUST NOT be bounded by the defect's own Epic — which follows from `FR-DFR-060`'s definition rather than merely constraining it: the chain crosses Epic boundaries wherever the artifacts do. Stated separately because it is the case most likely to be got wrong.
- **FR-DFR-064**: Where the transitive set cannot be computed — because the chain is incomplete or `TestExecution` is unavailable — closure MUST be **refused**, and MUST NOT fall back to the defect test alone. An unknown regression set and an empty one must not behave alike.
- **FR-DFR-062**: Test execution MUST be requested from `EPIC-015` (`BR-0080`); this Epic MUST NOT build a second test runner.
- **FR-DFR-063**: A declaration of completion MUST NOT substitute for the passing evidence (`BR-0144`).

*Defect-to-change transfer — `BR-0057`, `UX-0034`.*

- **FR-DFR-070**: Where approved current behaviour passes and the requested behaviour would alter intent, the item **MUST transfer to the Change Room**.
- **FR-DFR-071**: Transfer MUST preserve context and evidence, and the origin MUST be visible from the resulting Change Request.
- **FR-DFR-072**: The Room MUST make the transfer action available **and state why it is being offered** (`UX-0034`).
- **FR-DFR-073**: A declined transfer MUST retain both the offer and the decline.
- **FR-DFR-074**: An item refused by the Change Room MUST return with the refusal attached; it MUST NOT be lost between Rooms.
- **FR-DFR-075**: A defect that is really a change MUST NOT be fixable as a defect.
- **FR-DFR-076**: An item classified as a **Requirement Gap** MUST be routed to the Requirement Room (`EPIC-033`) as **new intent**, carrying its reproduction context and evidence. The defect record MUST be retained and marked reclassified, never deleted (`ADR-0016`). It MUST NOT be routed to the Change Room: there is no approved baseline to change, and that absence is what makes it a gap *(clarified 2026-08-22 — the third outcome previously had no destination)*.
- **FR-DFR-077**: Each of the three classification outcomes MUST have a destination, and an item MUST NOT be able to rest in a classified state with nowhere to go.

*Analytics — `BR-0058`.*

- **FR-DFR-080**: Defect origin, escape point, severity, affected requirement and specification, and resolution evidence MUST be retained.
- **FR-DFR-081**: These MUST be aggregatable without opening each record.
- **FR-DFR-082**: The fields MUST be captured from intake onward, not reconstructed at closure.
- **FR-DFR-083**: Where telemetry-originated linkage is not available (`BR-0163`, `U-19`), the Room MUST state that rather than presenting an incomplete origin distribution as complete.

*Room pattern — `UX-0030` to `UX-0035`.*

- **FR-DFR-090**: The Room MUST present all six required regions: object state, loop progress, AI analysis, decision, evidence, activity timeline.
- **FR-DFR-091**: Region names MUST be identical to the shared Room pattern and to the other two Rooms (`UX-0035`).
- **FR-DFR-092**: AI triage output MUST be visually distinguishable from recorded fact and from human decision (`UX-0031`).
- **FR-DFR-093**: What is blocking progress MUST be visible without opening another screen (`UX-0032`).
- **FR-DFR-094**: A policy-refused action MUST show the refusing policy (`UX-0033`).
- **FR-DFR-095**: The Room MUST remain able to show state, decision and evidence at a 360px viewport (`UX-0040`, `UX-0042`).

### Key Entities

- **Defect Record**: an origin-tagged report linked to an Epic, project, contested behaviour and artifact version.
- **Classification**: the triage outcome — Confirmed Defect, Change Request, or Requirement Gap — with the approved behaviour it was judged against. Three outcomes, never two.
- **Reproduction**: environment, steps, intermittency and evidence for the contested behaviour.
- **Defect Test**: the failing test that demonstrated the defect, linked to it and to the behaviour contested. Required before a fix is accepted, where automatable.
- **Repair Task**: an `EPIC-012` task traceable to the failing behaviour and its test.
- **Transfer**: the governed move to the Change Room, carrying context, evidence, and the **stated reason** it was offered.
- **Escape Record**: origin, escape point, severity, affected requirement and specification, and resolution evidence — captured from intake, not at closure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-DFR-001**: **Zero** fixes are accepted for automatable defects without a failing test on record — mutation-tested by adding a bypass and observing the suite fail.
- **SC-DFR-002**: **100%** of defects are classified against approved expected behaviour before implementation work begins.
- **SC-DFR-003**: **Zero** items whose requested behaviour alters intent are closed as defect fixes; all transfer to the Change Room.
- **SC-DFR-004**: **Zero** passing reproduction tests are automatically reclassified as Change Requests.
- **SC-DFR-005**: **Zero** reclassified defect records are deleted; all are retained as reclassified.
- **SC-DFR-006**: **100%** of defects carry an Epic and project link, or are visibly held for triage.
- **SC-DFR-007**: **100%** of closures required the defect test plus applicable regression tests to pass, with evidence retained — *applicable* as `FR-DFR-060` defines it, so the percentage is taken over a **derivable** set rather than a chosen one.
- **SC-DFR-008**: Escape point and origin are aggregatable across closed defects without opening individual records.
- **SC-DFR-009**: A person can carry a defect from report to closure **using only a keyboard**, with focus visible at every step (`BR-0193`, `EPIC-029`).
- **SC-DFR-010**: **100%** of Requirement Gap classifications reach the Requirement Room as new intent, with the defect record retained and marked reclassified; **zero** rest in a classified state with no destination *(clarified 2026-08-22)*.
- **SC-DFR-011**: This Room resolves as its own workflow type: **zero** transitions succeed under another Room's stages, authorities or gates *(clarified 2026-08-22)*.
- **SC-DFR-012**: **100%** of repair tasks created from a confirmed defect link to the failing behaviour and its test; **zero** are created before classification *(added 2026-08-22)*.

## Assumptions

- **PMI-DOC-006 v1.0 is `PROPOSED`, not approved.** `FR-DFR-072` cites `UX-0034`, which is the only `UX-` requirement written specifically for this Room. **Back-fill owner: project owner**, through the approval outstanding as decision 6 in `brs-v2-reconciliation.md` §7.
- **The Room pattern is a SHARED ARTIFACT, and this Epic imports it rather than deriving it** *(recorded 2026-08-22, `EPIC-033` analysis finding `C1`)*. `EPIC-033` Phase 2 produces **`packages/room-contract`** — `RoomShellProps` (six required named region slots), `Epistemic`/`Labelled<T>` (the required epistemic discriminant) and `RoomObjectRef` — and **`frontend/src/rooms/RoomShell.tsx`**, which owns the `UX-0041` breakpoints and the `UX-0040` 360px floor. This Epic MUST import both and MUST NOT re-derive the pattern: `UX-0035` forbids the three Rooms diverging, and a second derivation is how they would. The regions are **required named props, not `children`**, so omitting one does not compile and a seventh has nowhere to go. **`EPIC-033` Phase 2 is therefore a hard prerequisite of this Epic's implementation**, not merely a related Epic.
- **`ADR-0016` is Open and this Epic is expected to converge it.** Its `Awaits` names *"the Defect Room epic, which does not yet exist"* — as of this declaration, it does. Its Negative consequence is discharged: approved baselines depend on the Requirement Room, which is `EPIC-033`, declared in this Wave. Convergence is in Epic Exit Criteria.
- **`BR-0163` operational feedback is `U-19` and unowned.** This Room accepts monitoring- and incident-originated defects (`BR-0051`); **automatic linkage from production telemetry is not this Epic**, and `FR-DFR-083` requires the Room to say so rather than present a partial origin distribution as complete. `brs-v2-reconciliation.md` §4 records `U-19` as depending on `U-04` and `U-05` — both declared in this Wave, so its blocker is now Epic declaration alone.
- **`BR-0106` session cost limits are `U-11` and unowned.** Triage and diagnosis invoke models; this Room must not build its own budget mechanism.
- Depends on `EPIC-030` (loop), `EPIC-031` (decision and Inbox), `EPIC-032` (evidence), `EPIC-033` (the baselines it classifies against — **and, since 2026-08-22, the destination for a Requirement Gap**) and `EPIC-034` (the change transfer target). All five are declared in this Wave, so both outbound routes are specified from both ends.
- `EPIC-015` owns test execution and QA validation (`BR-0080`). This Room requests runs and consumes results; if `EPIC-015`'s surface is insufficient, the correct response is a change to `EPIC-015`, not a runner here (`FR-DFR-062`).
- `EPIC-012` owns the task model. Repair work becomes `EPIC-012` tasks (`FR-DFR-051`).
- Regression-suite runtime bounds the close path; targets are this Epic's plan (`PP-018`).
- **This Epic delivers a user-facing journey.** Constitution XI Tier 2 applies in full.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for the loop-instance configuration and Room pattern outputs, a passing executable conformance check (Constitution V)
- [ ] **`FR-DFR-041` is mutation-tested**: a path accepting a fix with no failing test is added, and the suite observed failing (`SC-DFR-001`). Test-first is this Room's reason to exist
- [ ] **`FR-DFR-044` is mutation-tested**: automatic reclassification of a passing reproduction test is added, and the suite observed failing (`SC-DFR-004`). `ADR-0016` names this failure mode explicitly and it is the easiest of the eight requirements to "simplify" into a defect
- [ ] **`FR-DFR-077` is mutation-tested**: a `Classification` is made writable with a null destination, and the suite observed failing. This is the guarantee `R-035-5` and `ADR-0016` both rest on, and the task list carried the proof while the gate did not require it *(added 2026-08-23, analysis finding `L1`)*
- [ ] **Constitution XI Tier 1 is mutation-tested**: `DefectRoomModule` is removed from `app.module.ts`, and the reachability test observed failing. A reachability test that passes when the module is unregistered proves nothing *(added 2026-08-23, analysis finding `L1`)*
- [ ] All **three** classification outcomes are demonstrated **and routed** — Confirmed Defect to repair, Change Request to `EPIC-034`, Requirement Gap to `EPIC-033` as new intent. Two outcomes is the shape this Epic is most likely to ship by accident, and an unrouted third is how the shape returns wearing three names
- [ ] A **Requirement Gap** has been routed end to end into the Requirement Room, jointly with `EPIC-033` (`FR-DFR-076`). **This criterion depends on work in `EPIC-033`, not in this Epic**: that Room had no inbound route for a routed gap when this Epic was planned, because `FR-DFR-076` was added by a clarification after `EPIC-033` was planned. `EPIC-033` `T338u`/`T338v` add it. **Until they land this criterion cannot hold, and the Epic cannot be declared complete** — stated so that *"cannot close yet"* is visibly different from *"nobody did it"* *(recorded 2026-08-23, analysis finding `C1`)*
- [ ] **`ADR-0016` is converged** — moved to Accepted, or its `Awaits` restated against what actually remains. Its current `Awaits` is this Epic
- [ ] A transfer to the Change Room has been exercised end to end with context and evidence preserved, jointly with `EPIC-034` (`FR-DFR-071`)
- [ ] Region names are verified identical to `EPIC-033`'s by comparison rather than by review
- [ ] **Constitution XI Tier 1** — a test drives the Room through its **real entry point** against the composed module graph
- [ ] **Constitution XI Tier 2** — the report-to-closure journey has been exercised against a **running application** and a **run-generated** transcript is committed
- [ ] The closing report restates that `BR-0163` (`U-19`) remains unowned, so this Room's delivery is not read as having closed the operational feedback loop
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/035-defect-room/defects/` contains no open defect records — the repository's own Constitution VI folder, which this Epic's **product** capability does not replace
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)
