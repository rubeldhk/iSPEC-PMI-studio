# Epic Specification: Governed Engineering Loop

**Epic**: `EPIC-030` | **Module**: cross-cutting workflow substrate (every governed workflow)

**Feature Branch**: `epic/030-governed-engineering-loop`

**Created**: 2026-08-22

**Status**: Draft

**Authorised by**: PMI-DOC-004 v2.0 **APPROVED 2026-08-22** (decisions 1–5 signed), which makes
`BR-0064` a first-class requirement; Wave 1 of PMI-DOC-004A §13, opened by
[`specs/brs-v2-reconciliation.md`](../brs-v2-reconciliation.md) §8.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — nothing holds this Epic. `ADR-0018` was **discharged of its PMI-DOC-004
> dependency** on 2026-08-22; its remaining `Awaits` names *the three Room epics*, and this Epic is
> the substrate those Rooms are declared against rather than a consumer of them. Readiness still
> runs through the Definition-of-Ready gate, not by declaration (EPIC-026).

**Input**: User description: "Build the Governed Engineering Loop: the single reusable workflow
abstraction that every governed engineering workflow in PMI Studio is an instance of. The loop is
Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome → next Event. This Epic
owns the abstraction only. It does not own any Room, and it does not own the Decide or Evidence
stage implementations, which are separate Epics."

## Clarifications

### Session 2026-08-22

Five questions, all answered with the recommended option. The scan rated Functional Scope,
Terminology, Edge Cases and Completion Signals **Clear**; the five below were the Partial or Missing
categories with the highest impact × uncertainty.

- Q: Who should own `BR-0065` — *workflow state transitions MUST be explicit, authorized and auditable* — now that this Epic builds the mechanism it describes? → A: **`EPIC-030`. It moves here.** The scan established that `EPIC-012` **never cited `BR-0065`** — zero occurrences across `specs/012-workflow-tasks/` — so no existing claim is being taken away, and `EPIC-012` keeps `BR-0050` and `BR-0151` so it is not orphaned. `F-04` in `brs-v2-reconciliation.md` §5.1 sets the precedent: a home assignment *"is not an architecture decision"* and correcting it is a cell edit. **The PMI-DOC-004 §6.7 and reconciliation §3.1/§4 edits are outstanding and owned by the project owner** — until they land the SRS still reads `EPIC-012`, and under Constitution II the SRS wins on the record.
- Q: If the audit store cannot accept a transition record, should the transition be refused, or proceed and be recorded afterwards? → A: **Refuse — fail closed** (`FR-GEL-041`). Matches `EPIC-031`'s `FR-DPE-050` and `ADR-0025`'s reasoning that proceeding without governance converts an outage into an ungoverned window.
- Q: At what scope may a loop instance be configured — programme-wide, per tenant, or per project? → A: **Workflow types and their stages are programme-defined; tenants configure only authorities, gates and trigger rules** (`FR-GEL-009`). This is what keeps `UX-0035` enforceable per product rather than per customer.
- Q: Is changing a loop instance configuration itself a governed action requiring authorized human approval? → A: **Yes — permanently high band, and no tenant policy may lower it** (`FR-GEL-016`). `ADR-0025` constraint 1 applied one level up: a configuration that can lower its own gates is the failure mode installed at the foundation.
- Q: When two actors attempt transitions on the same object at the same moment, what should happen? → A: **First to commit wins; the second is refused with a recorded conflict naming the transition that won** (`FR-GEL-015`).

**Deferred, deliberately.** Transition throughput and latency targets (`PP-018`), configuration-version
retention, and MCP exposure (`PP-007`, lands with `EPIC-013`) are plan-level and were not asked.
PMI-DOC-006's approval is an act of the project owner, not an ambiguity in this specification.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0064` — Governed Engineering Loop | FR-GEL-001 to FR-GEL-008 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0065` — Explicit states (**owner moved to this Epic**, clarified 2026-08-22; §6.7 still reads `EPIC-012` until the edit lands) | FR-GEL-010 to FR-GEL-016 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0060` — Review gates (seam only, not implemented here) | FR-GEL-020 to FR-GEL-022 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.7 `BR-0069` — Automation triggers (**enforcement seam only**; owned by `EPIC-031`, `U-07`) | FR-GEL-030 to FR-GEL-033 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.18 `BR-0111` — Immutable audit | FR-GEL-012, FR-GEL-040 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §5 Core Concepts — *Governed Engineering Loop*; §7 `RULE-11` *No invisible automation* | FR-GEL-001, FR-GEL-030 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §6.1 `UX-0030` *Loop progress* region; §6.2 `UX-0035` no divergence in region vocabulary | FR-GEL-050, FR-GEL-051 |
| [`adr/ADR-0018-governed-engineering-loops.md`](../../adr/ADR-0018-governed-engineering-loops.md) | Decision — Rooms stay distinct governed surfaces over one shared engine | FR-GEL-004, FR-GEL-060 |

**Requirements not yet covered by SRS**: **None.** Every requirement below traces to an approved
`BR-` in PMI-DOC-004 v2.0 or to `ADR-0018`. `FR-GEL-050`/`FR-GEL-051` additionally cite PMI-DOC-006
v1.0, which is **PROPOSED, not approved** — see the first entry under Assumptions, where the
back-fill owner is named.

**One outstanding SRS edit** *(clarified 2026-08-22)*: `BR-0065`'s owner moved to this Epic, and
PMI-DOC-004 §6.7 has not yet been edited to say so. This is **not** an uncovered requirement — the
requirement is approved and cited correctly — it is an ownership record that two documents will
disagree about until the edit lands. Under Constitution II **the SRS wins on the record**, so this
Epic does not act as though the change has already happened. The edit is an Epic Exit Criterion and
its owner is named under Assumptions.

### Ownership notes — read before planning

**This Epic owns two requirements: `BR-0064` and `BR-0065`** *(the second clarified 2026-08-22)*.
Two others are cited and neither is claimed. Stating that here rather than leaving it to inference is
the point: `brs-v2-reconciliation.md` §4 assigns `BR-0069` to `U-07`, so a spec that cited it without
qualification would read as a second owner.

| Cited | Owner | What this Epic supplies |
|---|---|---|
| `BR-0064` | **this Epic** (`U-06`) | the abstraction itself |
| `BR-0065` | **this Epic** *(moved 2026-08-22; SRS edit outstanding)* | explicit states, authorized transitions, auditable history — see below |
| `BR-0060` | `EPIC-021` Review Gates & Roles | the seam a gate hangs on, and the guarantee that a silent pass is unreachable (`FR-GEL-021`) |
| `BR-0069` | `EPIC-031` Decision & Policy Engine (`U-07`) | mechanical enforcement — an automated transition with no citable rule is refused at configuration load (`FR-GEL-031`). Which rules may exist, and what they may trigger, is `EPIC-031`'s |

#### The `BR-0065` question — settled 2026-08-22, with one edit outstanding

`BR-0064` is capability area `U-06`, one of the three the `EPIC-027` register marks **UNOWNED**.
`BR-0065` — *workflow state transitions MUST be explicit, authorized and auditable* — was assigned to
`EPIC-012` Workflow & Tasks in PMI-DOC-004 v2.0 §6.7.

**The clarification scan found that `EPIC-012` never cited it.** `BR-0065` returns **zero
occurrences** across `specs/012-workflow-tasks/`; the assignment exists only in PMI-DOC-004 §6.7 and
the reconciliation's Epic→BR map, because `EPIC-012` predates BRS v2.0 and was mapped to the
requirement rather than written against it.

That changes the question from *"which of two claims survives"* to *"where does an unclaimed general
requirement belong"* — and the answer is the Epic that builds the general mechanism. `F-04` in
`brs-v2-reconciliation.md` §5.1 is the precedent and states the cost plainly: a home assignment *"is
not an architecture decision"*, and correcting it is a cell edit. `EPIC-012` keeps `BR-0050` and
`BR-0151`, so it does not become an orphan under PMI-DOC-004 §11 criterion 2.

> **The edit has not been made.** PMI-DOC-004 v2.0 is an **APPROVED** document; changing it is a
> project-owner act with a revision-history obligation (§17), not a side effect of a clarification
> run. Until PMI-DOC-004 §6.7 and `brs-v2-reconciliation.md` §3.1/§4 are edited, **the SRS still
> reads `EPIC-012` and under Constitution II the SRS wins.** This Epic records the decision, cites
> the requirement, and carries the edit as an Epic Exit Criterion with the project owner named.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | `BR-0064` and `ADR-0018` precede any loop code; the loop itself is the mechanism that makes specification-first enforceable for every workflow |
| PP-002 | Single Source of Truth | Satisfied | one loop model, one stage vocabulary; `FR-GEL-002` forbids a second |
| PP-003 | Human-in-the-Loop | Satisfied | the **Decide** stage is a first-class stage of the model, not an optional step; `FR-GEL-021` refuses a silent gate skip |
| PP-004 | End-to-End Traceability | Satisfied | every transition records its object version, actor, authority basis and trigger (`FR-GEL-012`) |
| PP-005 | Modular Architecture | Satisfied | the loop is a substrate with three declared seams — Decide (`EPIC-031`), Evidence (`EPIC-032`), Room UX (`EPIC-033`–`035`) |
| PP-006 | Engine Independence | Satisfied | the loop carries no specification-engine vocabulary; a Spec Kit workflow is one loop instance among others |
| PP-007 | API & MCP First | Partial | loop state and transitions are exposed through the platform API; MCP exposure is not required by any `BR-` this Epic owns and lands with `EPIC-013` `BR-0122` |
| PP-008 | Security by Design | Satisfied | a transition executes under an authenticated identity with a recorded authority basis (`BR-0002`, `BR-0005`); `FR-GEL-011` refuses an unauthorized transition rather than logging one |
| PP-009 | Quality by Design | Satisfied | every requirement below is asserted by an executable check; the loop configuration is a non-code output and carries a conformance check per Constitution V |
| PP-010 | Observability by Default | Satisfied | transitions emit structured audit records (`BR-0111`); stage residency is measurable, which is what makes `SC-GEL-006` checkable |
| PP-011 | Documentation as Code | Satisfied | loop instance configuration is versioned repository content, not database-only state (`FR-GEL-005`) |
| PP-012 | Everything Versioned | Satisfied | a loop instance configuration is versioned and a mid-flight object keeps the version it entered under (`FR-GEL-006`) |
| PP-013 | Knowledge-Driven Engineering | Satisfied | the shared stage vocabulary is reusable organizational knowledge — it is the reason three Rooms can be read by one person |
| PP-014 | Configuration over Customization | Satisfied | this is the principle the Epic exists to serve: `FR-GEL-003` makes a workflow type a configuration of the loop, never a fork of it |
| PP-015 | Open Standards | Not applicable | no external standard governs a workflow abstraction; OpenTelemetry applies to its emissions, inherited from `EPIC-001` |
| PP-016 | Explainable AI | Satisfied | `FR-GEL-031` requires every automated transition to name the visible rule that fired it (`RULE-11`); an unexplainable transition is refused |
| PP-017 | Cost-Aware AI | Not applicable | the loop invokes no model; cost applies to the Analyze and Execute *implementations*, which are other Epics |
| PP-018 | Scalability First | Partial | the loop sits on the critical path of every governed action, so transition throughput is a real concern — the target is recorded in this Epic's plan, not asserted here |
| PP-019 | Continuous Improvement | Satisfied | stage-residency data is the raw material for the DORA lead-time measure `BG-06` names |
| PP-020 | Customer Value | Satisfied | `BG-05` — zero ungoverned consequential actions is unachievable without one governed transition mechanism |

**Deferral count**: **0.** Three principles are Partial and none is Deferred. `PP-007` and `PP-018`
name where their remainder lands — `EPIC-013` and this Epic's own plan — and neither is a debt
owed by another party.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A new governed workflow is declared as a configuration, not built as a second engine (Priority: P1)

A tech lead needs a fourth governed workflow — say a release-approval workflow. They declare a loop
instance: which stages apply, what enters and leaves each one, who may authorize each transition,
and which gates are required. They write no workflow engine, and the resulting workflow reads to a
user exactly like the Requirement, Change and Defect Rooms do.

**Why this priority**: this is the requirement. `BR-0064` says governed workflows MUST be
*configurable instances* of the common model. If the first three Rooms each carry their own engine,
the fourth costs what the first did, and `ADR-0018`'s stated positive — *"building the three Rooms
on one loop engine avoids three divergent workflow implementations"* — is lost before it is
collected.

**Independent Test**: declare a loop instance for a workflow type this Epic does not know about,
drive an object through every stage, and assert that no code outside the configuration was added.
Fully testable without any Room existing.

**Acceptance Scenarios**:

1. **Given** the loop model and an empty configuration, **When** a new workflow type is declared
   with its stages, authorities and gates, **Then** objects of that type move through the loop with
   no new engine code.
2. **Given** a declared workflow type, **When** its configuration names a stage outside the eight of
   the model, **Then** the declaration is refused and names the offending stage.
3. **Given** two declared workflow types, **When** each is inspected, **Then** both use the same
   stage names for the same stages — divergence is not expressible.
4. **Given** a workflow type whose configuration omits a stage that does not apply to it, **When** an
   object runs, **Then** it skips that stage as configured and the skip is visible in the object's
   loop history rather than silently absent.

---

### User Story 2 - Every state change is explicit, authorized, and answerable months later (Priority: P1)

An auditor opens a governed object closed six weeks ago and asks: what stage was it in at each
point, who moved it, under what authority, and what triggered the move. Every answer is in the
record, and no transition is missing from it.

**Why this priority**: `BR-0065` and `BR-0111` are unconditional, and `BG-05` measures *zero
ungoverned consequential actions*. A transition mechanism that can be bypassed makes every other
governance guarantee in the programme conditional on nobody having bypassed it.

**Independent Test**: drive an object through a full loop, then reconstruct the entire history from
the audit record alone with no access to the object's current state. Every transition appears
exactly once, in order, with actor and authority.

**Acceptance Scenarios**:

1. **Given** an object in a governed loop, **When** any transition occurs, **Then** an append-only
   record captures who, what, when, on which object version, from which stage to which, and with
   what result.
2. **Given** an actor without authority for a transition, **When** they attempt it, **Then** the
   transition is refused and the refusal names the missing authority — the object does not move.
3. **Given** a completed object, **When** its loop history is read, **Then** the stage sequence is
   contiguous: no stage appears that was not entered, and no entered stage is missing.
4. **Given** an attempt to write a loop state directly rather than through a transition, **When** it
   is made, **Then** it is refused — there is one way in.

---

### User Story 3 - An automated transition can always be traced to the rule that fired it (Priority: P2)

An engineer sees a governed object move without anyone touching it. They open the transition and
find the rule that caused it, the event it reacted to, and the configuration version that rule came
from.

**Why this priority**: `RULE-11` — *no invisible automation* — and `BR-0069`. `ADR-0025` states the
failure mode in one line: *"'Risk-adaptive' is one bad default away from 'the AI decided it was low
risk and shipped it'."* The loop is where that is prevented mechanically rather than by policy
review, because the loop is the only thing every automated transition passes through.

**Independent Test**: configure an event-triggered transition, fire the event, and assert the
resulting transition record names its rule; then configure a transition with no visible rule and
assert the configuration is refused.

**Acceptance Scenarios**:

1. **Given** an automated transition, **When** it executes, **Then** its record names the rule, the
   triggering event, and the configuration version that rule belongs to.
2. **Given** a proposed automated transition with no citable rule, **When** the configuration is
   loaded, **Then** it is refused — an unexplainable transition is not a runtime warning.
3. **Given** an automated transition, **When** its record is read, **Then** it is distinguishable
   from a human-initiated transition without inference.

---

### User Story 4 - A required gate is never silently passed (Priority: P2)

A required review gate on a transition is not satisfied. The object does not move. If the gate is
bypassed under an approved exception, the exception is recorded on the transition and is readable
later as an exception — not as a pass.

**Why this priority**: `BR-0060` states it directly: *a skipped gate is a recorded violation or an
explicit exception, never a silent pass*. `EPIC-021` owns the gates and their approvers; this Epic
owns the seam they hang on. If the seam permits a silent skip, `EPIC-021` cannot close it later.

**Independent Test**: attach a required gate to a transition, attempt the transition with the gate
unsatisfied, and assert three distinct outcomes exist — refused, exception-recorded, violation-
recorded — and that "passed" is not reachable among them.

**Acceptance Scenarios**:

1. **Given** a transition with an unsatisfied required gate, **When** it is attempted without an
   exception, **Then** it is refused and the unsatisfied gate is named.
2. **Given** the same transition, **When** it proceeds under an authorized exception, **Then** the
   transition record carries the exception, its authorizer and its reason — and reads as an
   exception, not as a satisfied gate.
3. **Given** a completed object, **When** its history is read, **Then** every exception taken during
   its loop is enumerable without opening each transition individually.

---

### User Story 5 - A Room can render loop progress without knowing how the loop works (Priority: P3)

A Room screen shows which loop stages are done, which is current, and which are pending — reading
one shared shape, not a per-Room translation of it.

**Why this priority**: `UX-0030` makes *Loop progress* one of the six required Room regions and
`UX-0035` forbids the three Rooms diverging in region vocabulary. Delivering the loop without a
readable progress projection would force each Room to invent one, which is the divergence `UX-0035`
exists to prevent. P3 because no Room exists yet to consume it.

**Independent Test**: request the loop-progress projection for an object of any declared workflow
type and assert it returns done/current/pending across the same stage vocabulary regardless of type.

**Acceptance Scenarios**:

1. **Given** an object mid-loop, **When** its progress projection is requested, **Then** every stage
   of its configured instance is returned with exactly one of done, current or pending.
2. **Given** objects of two different workflow types, **When** both projections are requested,
   **Then** the stage vocabulary is identical.

### Edge Cases

- **A loop instance is reconfigured while objects are mid-flight** — in-flight objects keep the
  configuration version they entered under (`FR-GEL-006`). Re-pointing a live object at a new
  configuration would rewrite the meaning of transitions already recorded against it.
- **A configured stage's implementation does not exist yet** — Decide belongs to `EPIC-031` and
  Evidence to `EPIC-032`. A loop instance naming a stage with no registered implementation is
  refused at configuration load, not at the moment an object reaches that stage in production.
- **Two workflow types want the same stage under different names** — not expressible. The stage
  vocabulary is fixed by the model (`FR-GEL-002`), which is `UX-0035` enforced one layer below the UI.
- **A workflow type genuinely needs a ninth stage** — the model changes for every instance or the
  need is met inside an existing stage. `ADR-0018`'s constraint runs the other way too: a shared
  engine must not collapse three governed surfaces into one, and a per-Room stage would do exactly
  that in reverse.
- **An event fires for an object that has been closed** — the trigger is recorded as not applicable
  rather than discarded, so a rule that fires against closed objects is visible as a
  misconfiguration instead of as silence.
- **The same event fires twice** — a transition is idempotent per (object, event, rule); the second
  firing records that it was a duplicate rather than moving the object twice.
- **An automated transition is configured onto a high-risk action** — the loop does not classify
  risk; it asks the Decide stage. Until `EPIC-031` is built, the seam's default is refuse, not
  allow. A substrate whose absent policy provider defaults to permit is the `ADR-0025` failure mode
  installed at the foundation.
- **The audit store is unavailable** — the transition is **refused** (`FR-GEL-041`). The alternative
  is a governed action with no record, which is worse than a refused one: a refusal is visible and a
  missing record is not *(clarified 2026-08-22)*.
- **Two actors transition the same object at the same moment** — the first to commit wins; the
  second is refused with a conflict naming the winner, and both outcomes are recorded
  (`FR-GEL-015`). Serializing the loser was rejected: it would queue a transition whose gates were
  evaluated against a stage that no longer exists *(clarified 2026-08-22)*.
- **A tenant wants a stage the programme model does not have** — not expressible (`FR-GEL-009`).
  Tenants configure authorities, gates and triggers; stages are programme-defined, or `UX-0035`
  holds per customer instead of per product *(clarified 2026-08-22)*.
- **Someone edits a loop configuration to remove a gate** — that edit is itself a high-band governed
  action requiring authorized human approval (`FR-GEL-016`). Otherwise the configuration is a way
  around every approval it defines, and the change appears in no decision record
  *(clarified 2026-08-22)*.

## Requirements *(mandatory)*

### Functional Requirements

*The loop model and its vocabulary.*

- **FR-GEL-001**: The system MUST define one Governed Engineering Loop model with exactly the eight stages `Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome`, from which the next Event may follow.
- **FR-GEL-002**: The stage vocabulary MUST be defined once and MUST NOT be extended, renamed or aliased by an individual workflow type.
- **FR-GEL-003**: A governed workflow type MUST be expressible as a **configuration** of the loop — which stages apply, entry and exit conditions, authorities and required gates — without new workflow-engine code.
- **FR-GEL-004**: Distinct workflow types MUST remain distinct governed surfaces with their own rules, states, permissions and decisions, while sharing one engine (`ADR-0018`).
- **FR-GEL-005**: A loop instance configuration MUST be versioned, reviewable repository-resident content, not database-only state.
- **FR-GEL-006**: An object in flight MUST retain the configuration version it entered under; reconfiguration MUST NOT alter the meaning of transitions already recorded.
- **FR-GEL-007**: A configuration naming a stage outside `FR-GEL-001`, or a stage whose implementation is not registered, MUST be refused at load time and MUST name what was wrong.
- **FR-GEL-008**: A workflow type MAY omit a stage that does not apply to it; the omission MUST be visible in the object's loop history rather than indistinguishable from a stage never reached.
- **FR-GEL-009**: **Workflow types and the stages they use MUST be programme-defined.** A tenant MUST be able to configure only authorities, required gates and trigger rules — never which stages exist, are named, or apply. This is what keeps `UX-0035` enforceable per product rather than per customer *(clarified 2026-08-22)*.

*Explicit, authorized, auditable state.*

- **FR-GEL-010**: Every change of an object's loop state MUST occur as an explicit named transition; direct state assignment MUST be refused.
- **FR-GEL-011**: A transition MUST execute under an authenticated identity holding the authority the configuration requires; an unauthorized attempt MUST be refused and MUST name the missing authority.
- **FR-GEL-012**: Every transition MUST produce an append-only record identifying actor, authority basis, object and object version, source stage, target stage, trigger, timestamp and result (`BR-0111`).
- **FR-GEL-013**: An object's loop history MUST be reconstructible from transition records alone, without reading current state.
- **FR-GEL-014**: A refused transition MUST be recorded as a refusal with its reason; a refusal that leaves no record is indistinguishable from an attempt never made.
- **FR-GEL-015**: Where two transitions are attempted concurrently on one object, **the first to commit MUST win and the second MUST be refused** with a conflict naming the transition that won. Both outcomes MUST be recorded. Two transitions MUST NOT both succeed against one source stage *(clarified 2026-08-22)*.
- **FR-GEL-016**: **Changing a loop instance configuration MUST itself be a governed action requiring authorized human approval, permanently in the high risk band.** No tenant policy MUST be able to lower it. A configuration that can lower its own gates is a route around every gate it defines *(clarified 2026-08-22)*.

*Gate seam — `BR-0060`, implemented by `EPIC-021`.*

- **FR-GEL-020**: A transition MUST be able to carry named required gates supplied by the review-gate mechanism this Epic does not implement.
- **FR-GEL-021**: A transition with an unsatisfied required gate MUST resolve to exactly one of: refused, proceeded-under-recorded-exception, or recorded-violation. **A silent pass MUST NOT be reachable.**
- **FR-GEL-022**: Exceptions and violations taken during an object's loop MUST be enumerable for that object without opening each transition individually.

*Automation triggers — `BR-0069`, `RULE-11`.*

- **FR-GEL-030**: A loop instance MAY declare transitions triggered by events, schedules or artifact changes.
- **FR-GEL-031**: Every automated transition MUST name the visible rule that fired it, the triggering event, and the configuration version that rule belongs to. A configuration declaring an automated transition with no citable rule MUST be refused at load time.
- **FR-GEL-032**: An automated transition MUST be distinguishable from a human-initiated one in its record, without inference.
- **FR-GEL-033**: A trigger MUST be idempotent per object, event and rule; a repeated firing MUST be recorded as a duplicate rather than advancing the object twice.

*Audit and inspection.*

- **FR-GEL-040**: Loop transition records MUST be append-only and tamper-evident, consistent with the workspace audit mechanism of `EPIC-004`.
- **FR-GEL-041**: **Where the audit store cannot accept a transition record, the transition MUST be refused.** The loop MUST fail closed rather than proceed unrecorded. An unrecorded transition is indistinguishable from one that never happened, so an outage would otherwise become an undetectable gap in the trail `BG-05` measures *(clarified 2026-08-22)*.

*Projections consumed by other Epics.*

- **FR-GEL-050**: The system MUST expose a loop-progress projection for any governed object, reporting each stage of its instance as exactly one of done, current or pending.
- **FR-GEL-051**: The progress projection MUST use the `FR-GEL-001` stage vocabulary for every workflow type, so no consumer needs a per-type translation (`UX-0035`).

*Boundary.*

- **FR-GEL-060**: This Epic MUST NOT implement risk classification or approval policy (`EPIC-031`), evidence typing or Evidence Contracts (`EPIC-032`), or any Room user experience (`EPIC-033`–`EPIC-035`). It MUST declare the seams those Epics fill.
- **FR-GEL-061**: The loop MUST contain no Room-specific or workflow-type-specific vocabulary. A stage, field or rule meaningful to exactly one workflow type belongs to that type's Epic.
- **FR-GEL-062**: Where the Decide stage's policy provider is not registered, the seam's default MUST be to refuse the transition, never to permit it.

### Key Entities

- **Loop Model**: the eight ordered stages and their meaning. Exactly one exists; it is not per-tenant, per-project or per-workflow-type.
- **Loop Instance Configuration**: a versioned declaration binding one workflow type to the model — applicable stages, entry and exit conditions, required authorities, required gates and trigger rules. Its **stages are programme-defined**; a tenant may configure only authorities, gates and triggers, and any change to it is a high-band governed action *(clarified 2026-08-22)*.
- **Loop Object State**: the current stage of one governed object, plus the configuration version it entered under. Derived from transitions; never written directly.
- **Transition**: one explicit, authorized movement between stages, carrying actor, authority basis, object version, trigger, gate outcomes and result. The only way state changes.
- **Gate Outcome**: the result of a required gate on a transition — satisfied, refused, exception, or violation. Never "passed by omission".
- **Trigger Rule**: the visible, versioned rule an automated transition cites. A transition with no rule does not exist.

### Specification status-transition adjudication *(added 2026-08-25 — Step C2A)*

*Authorised by the project owner's Step C2A instruction, discharging the two amendments Rev 3 §04
assigned to this Epic and never scheduled. **`EPIC-037` found the gap by trying to consume the
capability and stopping**: this Epic evaluates Governed Engineering Loop stages and exposed no
specification-lifecycle proposal intake at all.*

> **This is not a second lifecycle engine.** `EPIC-009` remains the authoritative validator and
> executor of specification lifecycle transitions. This Epic **adjudicates** a proposal — authority,
> gates, separation of duties, approval routing — and, only where application is authorised,
> **invokes `EPIC-009`** through an explicit port. Gate *outcomes* on specifications remain
> `EPIC-021`'s; authorisation remains `EPIC-024`'s.

- **FR-GEL-063**: The loop MUST accept a **specification status-transition proposal** as governed
  intake, carrying proposal and execution identity, target and target version or baseline, the
  **expected current** lifecycle status, the requested status, proposer and frozen agent identity,
  originating connector identity, evidence and reason references, correlation and causation
  identifiers, an idempotency key and a proposal timestamp.
- **FR-GEL-064**: Adjudication MUST use **specification lifecycle** types. A specification status
  MUST NOT be passed into an API typed as `LoopStage`, and no implicit mapping between the two
  vocabularies may exist. *The eight loop stages and the specification lifecycle are different
  vocabularies for different objects; conflating them would make one meaningless.*
- **FR-GEL-065**: Adjudication MUST validate the requested transition against **`EPIC-009`'s**
  authoritative lifecycle. This Epic MUST NOT hold its own table of permitted transitions.
- **FR-GEL-066**: Adjudication MUST evaluate **actor authority** and **declared gates**, consuming
  gate outcomes from the `GateProvider` port that `EPIC-021` supplies. This Epic MUST NOT re-run
  review roles or re-decide a gate a human has already decided.
- **FR-GEL-067**: Adjudication MUST enforce **separation of duties**. An AI agent or connector MUST
  NEVER approve its own proposal. Whether a **human** proposer may approve their own is tenant or
  project policy, defaulting to **a distinct approver required**. Identity MUST be evaluated from
  **frozen authoritative identity**, never from mutable display metadata.
- **FR-GEL-068**: Adjudication MUST return exactly one verdict from a **closed** set —
  `validated`, `applied`, `approval_required`, `refused`, `inconsistent`, `reconciliation_required`
  — and MUST NOT express an outcome as an ambiguous boolean.
- **FR-GEL-069**: A verdict of `applied` MUST NOT be returned until **`EPIC-009` has confirmed** the
  authoritative transition. Where the application outcome is unknown — timeout, crash, lost
  response — the verdict MUST be `reconciliation_required`, never `applied` and never `refused`.
- **FR-GEL-070**: Adjudication MUST use **optimistic concurrency** against the expected lifecycle
  state. Where observed state differs from the proposal's expectation, the verdict MUST be
  `inconsistent`, and no transition may be applied.
- **FR-GEL-071**: Adjudication MUST be **idempotent** per proposal and idempotency key. A retry MUST
  return the original verdict and MUST NOT produce a duplicate approval or a duplicate transition.
- **FR-GEL-072**: Every intake, evaluation, approval, refusal and application MUST produce
  **immutable adjudication evidence** linking proposal, verdict and — where applied — the resulting
  authoritative transition. Redaction MUST NOT destroy the adjudication chain.
- **FR-GEL-073**: The adjudication contract MUST be consumable **without importing this Epic's
  internals**, and no connector may invoke `EPIC-009` directly to bypass adjudication.

- **FR-GEL-074**: Adjudication MUST distinguish a **gate decision** from the **absence of one**.
  Only an authoritative evaluation that failed may produce `refused` /
  `gate_failed`. A required gate outcome that is unavailable, stale, or not yet complete MUST
  produce `reconciliation_required` carrying a structured cause — `gate_outcomes_unavailable`,
  `gate_outcomes_stale` or `gate_evaluation_incomplete` — and MUST NOT be reported as a refusal.
  *Infrastructure or evidence unavailability must never be represented as though a gate made a
  negative decision. `FR-ENH-016` (EPIC-021) is the distinct case where the gate **ran** and a role
  could not answer: that failure is authoritative and remains `gate_failed`.* *(added 2026-08-26,
  Step C2B)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-GEL-001**: A new governed workflow type can be introduced by configuration alone, with **zero** lines of new workflow-engine code — demonstrated by adding a workflow type this Epic's code does not name.
- **SC-GEL-002**: **100%** of governed loop state changes are represented by a transition record; a state change with no transition is not reachable, proven by a check that attempts one and is refused.
- **SC-GEL-003**: **100%** of transition records identify actor, authority basis, object version, source stage, target stage, trigger and result — no field optional, verified across every transition in the test corpus.
- **SC-GEL-004**: **Zero** automated transitions execute without naming a rule, enforced at configuration load rather than detected afterwards.
- **SC-GEL-005**: A complete loop history for any object is reconstructible from audit records alone, verified by rebuilding it with current state withheld.
- **SC-GEL-006**: For any governed object, the stage it is in and the time it has been there are answerable without opening the object — the measurement `BG-06` lead time depends on.
- **SC-GEL-007**: Two declared workflow types expose an identical stage vocabulary, verified by comparison rather than by review.
- **SC-GEL-008**: An unsatisfied required gate resolves to refused, exception or violation in **100%** of attempts; the check is mutation-tested by removing the refusal path and observing the suite fail.
- **SC-GEL-009**: When the audit store is unavailable, **100%** of transitions are refused and **zero** proceed unrecorded *(clarified 2026-08-22)*.
- **SC-GEL-010**: **Zero** loop configuration changes take effect without authorized human approval, under any tenant policy — verified by enumerating the tenant configuration surface rather than by inspecting defaults *(clarified 2026-08-22)*.
- **SC-GEL-011**: In a concurrent transition race, **zero** pairs both succeed; the loser is refused with a recorded conflict in **100%** of cases *(clarified 2026-08-22)*.

*Added 2026-08-25 (Step C2A) — measurable outcomes for specification status-transition
adjudication (`FR-GEL-063`–`FR-GEL-073`).*

- **SC-GEL-012**: Every proposal resolves to **exactly one** verdict from the closed set; **zero**
  resolve to an ambiguous boolean, to no verdict, or to a value outside the set — verified by
  exhausting the set in tests rather than by review.
- **SC-GEL-013**: **100%** of `applied` verdicts are matched by a confirmed authoritative
  transition recorded by `EPIC-009`; **zero** `applied` verdicts exist without one.
- **SC-GEL-014**: An application outcome that was never observed resolves to reconciliation in
  **100%** of cases; **zero** resolve to `applied` or `refused`, since both would assert something
  nobody witnessed.
- **SC-GEL-015**: A retried proposal returns the **original** verdict in **100%** of attempts, and
  produces **zero** duplicate approvals and **zero** duplicate transitions.
- **SC-GEL-016**: **Zero** AI agents or connectors approve their own proposal, under any tenant
  policy — the refusal is absolute and is not reachable by configuration.
- **SC-GEL-017**: **100%** of adjudications leave immutable evidence; **zero** adjudication records
  can be updated or deleted once written, enforced by the **database** rather than by application
  code, and verified against a database built from the committed migration.
- **SC-GEL-018**: Every refusal maps to **exactly one** `EPIC-037` event, selected from a typed
  stage rather than from prose; **zero** refusals are unmappable, and **zero** require a consumer
  to read the human-readable reason to choose *(added 2026-08-25, C2A closure `X1`)*.
- **SC-GEL-019**: **Zero** adjudications report an unobtainable, stale or incomplete gate outcome
  as a refusal; **100%** route to reconciliation with a structured cause. Enforced by the database,
  not only by the type *(added 2026-08-26, Step C2B)*.

## Assumptions

- **PMI-DOC-006 v1.0 was `PROPOSED` when this was written and is **APPROVED** as of 2026-08-24 (`D-44`); the exposure below is discharged.** `FR-GEL-050` and `FR-GEL-051` cite `UX-0030` and `UX-0035` from it. Both restate `BR-0064`, which *is* approved, so neither requirement depends on the proposed document for its authority — but the projection's exact shape does. **Back-fill owner: project owner**, through the PMI-DOC-006 approval that decision 6 of `brs-v2-reconciliation.md` §7 leaves outstanding. This is the same SRS-debt shape `EPIC-029` discharged and `EPIC-023`/`EPIC-025` carried.
- **`BR-0065`'s owner moved to this Epic on 2026-08-22, and two documents have not caught up.** The clarification session established that `EPIC-012` never cited it — zero occurrences — so the move takes no claim away. **The SRS edit is outstanding: PMI-DOC-004 v2.0 §6.7 and `brs-v2-reconciliation.md` §3.1/§4 must be changed to read `EPIC-030`. Back-fill owner: project owner**, because PMI-DOC-004 v2.0 is APPROVED and editing it carries a §17 revision-history obligation. Until then the SRS reads `EPIC-012` and, under Constitution II, **the SRS wins on the record** — this Epic builds the mechanism and cites the requirement either way, so nothing below depends on which document is read first.
- `ADR-0018` is **Open** and this Epic is expected to converge it. Its `Awaits` names the three Room epics; the Rooms are declared in the same Wave and depend on this Epic, so the ADR converges when this Epic and `EPIC-033` are both specified — not when all three Rooms are built.
- The eight stages are taken as given from `BR-0064` and `ADR-0018`. Renaming or re-cutting them is a PMI-DOC-004 revision under `RULE-15`, not an Epic decision.
- Audit persistence is `EPIC-004`'s (`BR-0111`); this Epic emits records into it rather than building a second audit store.
- Authentication and identity are `EPIC-005`'s (`BR-0002`); this Epic consumes an authenticated identity and does not establish one.
- The **Analyze** and **Execute** stages are seams in this Epic. Their implementations arrive with the Engineering Expert and execution Epics; this Epic requires only that a stage implementation can be registered and invoked.
- Transition throughput and latency targets are recorded in this Epic's plan (`PP-018`), not asserted as requirements here — the loop is on the critical path of every governed action, which `ADR-0025` names as a real product concern.
- This Epic delivers **no user-facing journey**. Loop progress becomes visible when a Room renders it (`EPIC-033`–`035`). Constitution XI Tier 2 therefore does not apply; Tier 1 does, unconditionally.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for the loop-configuration outputs, a passing executable conformance check that reads the configuration and fails when it drifts (Constitution V)
- [ ] A workflow type unknown to this Epic's code has been driven through a full loop by configuration alone (`SC-GEL-001`)
- [ ] The silent-pass path of `FR-GEL-021` has been **mutation-tested**: the refusal removed, and the suite observed failing. A gate check that cannot fail is decoration (Constitution V)
- [ ] **Constitution XI Tier 1** — a test drives a loop transition through its **real entry point** against the composed module graph, not a hand-assembled one. A mocked collaborator provably cannot satisfy this
- [ ] **Constitution XI Tier 2** — **not applicable**: this Epic delivers no user-facing journey. Recorded here rather than omitted, because an exit list silent on XI can be closed while violating a NON-NEGOTIABLE principle (the `EPIC-029` `F1` precedent)
- [ ] **`FR-GEL-041` is mutation-tested**: the audit store is made unavailable and the transition observed being refused rather than proceeding unrecorded (`SC-GEL-009`)
- [ ] **`FR-GEL-016` is mutation-tested**: a tenant-reachable path that changes a loop configuration without authorized human approval is added, and the suite observed failing (`SC-GEL-010`)
- [ ] `ADR-0018` has been converged — moved to Accepted, or its remaining `Awaits` restated against what actually remains
- [x] The `BR-0065` ownership question is settled — **decided 2026-08-22**: it moves to this Epic (see Clarifications)
- [ ] **The `BR-0065` SRS edit has landed** — PMI-DOC-004 v2.0 §6.7 and `brs-v2-reconciliation.md` §3.1/§4 read `EPIC-030`, with a §17 revision-history entry. Owned by the project owner; until it lands the SRS and this spec disagree, and Constitution II says the SRS wins
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/030-governed-engineering-loop/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)

---

## Frozen principal identity in adjudication *(added 2026-08-27, Step C3B)*

*EPIC-030 consumes the public frozen-principal contract. Lifecycle, gate and application ownership
are unchanged.*

- **FR-GEL-075**: Separation of duties MUST evaluate **resolved, frozen** principal identity, not
  identifiers supplied on the request.
- **FR-GEL-076**: The sponsoring human of a non-human proposer MUST be treated as part of the
  **proposer side** where policy requires a distinct approver. Otherwise "an agent may not approve
  its own proposal" is satisfied by the agent handing the approval to the one person accountable for
  it.
- **FR-GEL-077**: An agent, service or connector principal MUST NEVER approve a transition.
  Reporting and proposing are permitted; approval is a human act.
- **FR-GEL-078**: Historical adjudication MUST retain the identity frozen at the time. Suspension or
  revocation MUST NOT alter a past decision, and a retry MUST use the same governed identity rather
  than substituting another snapshot.

- **SC-GEL-020**: **Zero** proposals are approved by their proposer's sponsoring human where a
  distinct approver is required.
- **SC-GEL-021**: **Zero** non-human principals record an approval, under any tenant policy.
