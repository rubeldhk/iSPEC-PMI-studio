# Epic Specification: Evidence Store & Evidence Contracts

**Epic**: `EPIC-032` | **Module**: Evidence — the **Evidence** stage of the Governed Engineering Loop, and the completion gate that reads it

**Feature Branch**: `epic/032-evidence-store-contracts`

**Created**: 2026-08-22

**Status**: Draft

**Authorised by**: PMI-DOC-004 v2.0 **APPROVED 2026-08-22**, which makes `BR-0140`–`BR-0142`,
`BR-0144` and `BR-0146` first-class requirements under `BG-08`; Wave 1 of PMI-DOC-004A §13.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — nothing holds this Epic. `ADR-0022` had its **PMI-DOC-004 dependency
> discharged on 2026-08-22**; what keeps it Open is an owning epic for the Specification Compliance
> Agent (`U-09`), **which is not this Epic**. This Epic builds the substrate that agent will consume.
> Readiness still runs through the Definition-of-Ready gate, not by declaration (EPIC-026).

**Input**: User description: "Build the evidence store, the Evidence Contract mechanism and the
completion gate that enforces it. This is the Evidence stage of the Governed Engineering Loop and
the foundation of the product's stated differentiator: completion is evidence-driven rather than
assertion-driven."

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.15 `BR-0140` — Evidence types | FR-EVS-001 to FR-EVS-006 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.15 `BR-0141` — Evidence provenance | FR-EVS-010 to FR-EVS-016 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.15 `BR-0142` — Evidence Contract | FR-EVS-020 to FR-EVS-026 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.15 `BR-0144` — "Done" is not proof | FR-EVS-030 to FR-EVS-034 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.15 `BR-0146` — External review integration | FR-EVS-040 to FR-EVS-043 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §7 `RULE-05` *Evidence over assertion*; §2 `BG-08` | FR-EVS-030, SC-EVS-001 |
| [`adr/ADR-0022-specification-compliance-and-evidence.md`](../../adr/ADR-0022-specification-compliance-and-evidence.md) | Decided half — generic deep code review is an **integration**, not a build | FR-EVS-040, FR-EVS-050 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §6.1 Room **Evidence** region — typed evidence plus the unmet items of its Contract | FR-EVS-027 |

**Requirements not yet covered by SRS**: **None.** Every requirement traces to an approved `BR-` in
PMI-DOC-004 v2.0 or to the decided half of `ADR-0022`. `FR-EVS-027` additionally cites PMI-DOC-006
v1.0, which is **PROPOSED, not approved** — the back-fill owner is named under Assumptions.

### Ownership notes — read before planning

**This Epic owns five requirements**: `BR-0140`, `BR-0141`, `BR-0142`, `BR-0144`, `BR-0146` — exactly
capability area `U-08` as [`brs-v2-reconciliation.md`](../brs-v2-reconciliation.md) §4 defines it.

Four are cited and **none is claimed**:

| Cited | Owner | Why it appears here |
|---|---|---|
| `BR-0143` Compliance verdict | **unowned** (`U-09`) | the verdict *consumes* this store. `ADR-0022` is Open awaiting `U-09`, and this Epic is not it |
| `BR-0036` Spec/code convergence | **unowned** (`U-09`) | same area, same non-owner |
| `BR-0080` QA validation | `EPIC-015` | validation against acceptance criteria before promotion. This Epic **extends, never duplicates** — see the `U-08`/`EPIC-015` question below |
| `BR-0125` External evidence | **unowned** (`U-13` Capability Hub) | external tools reach this store *through the adapter registry*; this Epic defines the typed evidence they contribute, not the registry |

#### A discrepancy in the gap register, recorded rather than resolved

PMI-DOC-004 v2.0 §13 lists `BR-0140`–`BR-0144` in its *Evidence & compliance* row **and** `BR-0143`
again in its *Specification compliance verdict* row. `BR-0143` therefore appears twice in that
summary. `brs-v2-reconciliation.md` §4 is precise where §13 is loose: `U-08` is
`BR-0140`–`BR-0142`, `BR-0144`, `BR-0146` — `BR-0143` deliberately excluded — and `U-09` is
`BR-0036`, `BR-0143`.

**§4 wins**, on PMI-DOC-004's own instruction: *"That document is authoritative for Wave 0; this
section states only the summary."* This Epic therefore does **not** own `BR-0143`. Recorded here so
that a later reader reconciling the two does not conclude the omission was an oversight.

#### The `U-08` versus `EPIC-015` question

`brs-v2-reconciliation.md` §4 records `U-08`'s assignment as *"new epic, **or** `EPIC-015`
extension"* — the only capability area in the register whose home is stated as an alternative. This
Epic is declared as the new epic; whether it should instead have been an `EPIC-015` extension is a
live question and is listed under Assumptions with a named owner and in Epic Exit Criteria. It is
not settled by the act of declaring this Epic, and this spec does not pretend it was.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | the Evidence Contract is declared **before** work runs (`FR-EVS-020`); a contract written after the fact is a description, not a gate |
| PP-002 | Single Source of Truth | Satisfied | one evidence store; `FR-EVS-050` forbids a second built beside `EPIC-015`'s validation |
| PP-003 | Human-in-the-Loop | Satisfied | `BR-0144` is the requirement this Epic owns most literally — a human or agent saying "done" does not substitute for proof |
| PP-004 | End-to-End Traceability | Satisfied | evidence links to artifact and version (`FR-EVS-011`); it is an edge in the `BR-0040` chain |
| PP-005 | Modular Architecture | Satisfied | store, contract and gate are three layers consumed one way |
| PP-006 | Engine Independence | Satisfied | evidence is typed by what it proves, not by which tool produced it (`FR-EVS-003`) |
| PP-007 | API & MCP First | Partial | evidence contribution and retrieval are API surfaces; MCP exposure lands with `EPIC-013` `BR-0122` |
| PP-008 | Security by Design | Satisfied | evidence carries integrity and provenance metadata (`FR-EVS-013`); `FR-EVS-015` requires a referenced artifact's access rules be honoured on read, so evidence cannot become a side channel around `BR-0062` |
| PP-009 | Quality by Design | Satisfied | this Epic *is* the quality principle made mechanical; `FR-EVS-030` is required to be mutation-tested at exit |
| PP-010 | Observability by Default | Satisfied | unmet Contract items are queryable in aggregate, which is what makes `BG-08`'s success measure computable rather than anecdotal |
| PP-011 | Documentation as Code | Satisfied | Evidence Contracts are versioned, reviewable content, not database-only state |
| PP-012 | Everything Versioned | Satisfied | evidence names the artifact **version** it attests, and a superseded version's evidence stays readable (`FR-EVS-012`) |
| PP-013 | Knowledge-Driven Engineering | Satisfied | the typed evidence vocabulary is reusable across every workflow rather than re-invented per Room |
| PP-014 | Configuration over Customization | Satisfied | an Evidence Contract is configuration of the required set, not a fork of the gate |
| PP-015 | Open Standards | Partial | attestation and provenance formats are candidates for an open standard rather than a bespoke one; the choice is this Epic's plan, recorded not pre-empted |
| PP-016 | Explainable AI | Satisfied | a refused completion names the unmet Contract items (`FR-EVS-032`), so "not done" is never an opaque verdict |
| PP-017 | Cost-Aware AI | Not applicable | the store invokes no model |
| PP-018 | Scalability First | Partial | evidence volume grows with every run, and `FR-EVS-005` prefers reference over copy for exactly that reason. Retention and volume targets are recorded in this Epic's plan |
| PP-019 | Continuous Improvement | Satisfied | Contract satisfaction rate over time is a direct `BG-08` measure |
| PP-020 | Customer Value | Satisfied | `BG-08` — evidence-driven completion is the product's stated differentiator (`ADR-0022`) |

**Deferral count**: **0.** Three principles are Partial and each names where its remainder lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declaring completion does not complete anything (Priority: P1)

An agent finishes a task and reports done. Its Evidence Contract has an unmet item. The work is not
accepted, and the response names what is missing.

**Why this priority**: `BR-0144` and `RULE-05`. `ADR-0022` quotes the source document in five words —
*"An agent reporting 'done' is not sufficient."* This is the requirement the whole differentiator
rests on; every other requirement in this Epic exists to make it enforceable rather than aspirational.

**Independent Test**: attach a Contract with one unmet item, submit a completion declaration, and
assert refusal naming that item. Testable with no Room, no compliance agent and no external tool.

**Acceptance Scenarios**:

1. **Given** governed work with an unmet Evidence Contract, **When** an agent or user declares
   completion, **Then** completion is refused and the unmet items are named.
2. **Given** the same work, **When** the missing evidence arrives and is valid, **Then** completion
   succeeds without the declaration being repeated by hand.
3. **Given** work whose Contract is fully met, **When** completion is declared, **Then** it succeeds
   and the satisfying evidence is retrievable from the completed object.
4. **Given** a completion attempt, **When** it is refused, **Then** the refusal is recorded — a
   refusal that leaves no trace is indistinguishable from an attempt never made.

---

### User Story 2 - Work knows what it must prove before it starts (Priority: P1)

A tech lead declares, for a class of governed work, the minimum evidence required for successful
completion. Work of that class carries the Contract from the moment it is created, and its unmet
items are visible throughout.

**Why this priority**: `BR-0142`. A required-evidence set decided at closure is decided by whoever is
closing, which is the assertion-driven model wearing a checklist. Declared up front, it is a gate.

**Independent Test**: declare a Contract for a work class, create work of that class, and assert the
Contract is attached at creation with every item unmet and enumerable.

**Acceptance Scenarios**:

1. **Given** a declared Evidence Contract for a class of work, **When** work of that class is
   created, **Then** it carries that Contract with all items unmet.
2. **Given** work in flight, **When** its unmet items are requested, **Then** they are returned
   without opening each piece of evidence.
3. **Given** a Contract that changes after work started, **When** the work completes, **Then** it is
   judged against the Contract version it began under, and the newer version applies to work started
   after the change.
4. **Given** an attempt to weaken a Contract on work already in flight, **When** it is made, **Then**
   it is refused — a gate that can be lowered by whoever is standing at it is not a gate.

---

### User Story 3 - Every piece of evidence answers where it came from (Priority: P1)

A reviewer opens a test result recorded six weeks ago and can tell which run produced it, when,
against which artifact and which version, and whether it has been tampered with.

**Why this priority**: `BR-0141`. Evidence whose provenance is unknown is a claim with better
formatting. `ADR-0022` positions evidence as the differentiator, and an untraceable differentiator is
worth what an assertion is worth.

**Independent Test**: record evidence of each supported type and assert every one carries source,
time, artifact, version and integrity metadata — with the check failing when any field is absent.

**Acceptance Scenarios**:

1. **Given** any stored or referenced evidence, **When** it is read, **Then** it identifies its
   source, time, the artifact it attests and that artifact's version.
2. **Given** evidence with integrity metadata, **When** the underlying content has changed, **Then**
   the mismatch is detectable rather than silent.
3. **Given** evidence attached to a superseded artifact version, **When** the current version is
   inspected, **Then** the old evidence is visibly *not* evidence for the current version.
4. **Given** referenced rather than stored evidence, **When** the external system no longer holds it,
   **Then** the reference reads as unresolvable rather than as satisfied.

---

### User Story 4 - Specialist tools contribute evidence and PMI Studio does not rebuild them (Priority: P2)

A CI run, a security scanner and an external code-review product each contribute findings and
results. They land as typed evidence against the right artifact and version. PMI Studio recreates
none of their analysis.

**Why this priority**: `BR-0146` and the **decided** half of `ADR-0022`: *"generic deep code review
is an integration, consuming external evidence. PMI Studio does not build a review engine."* That
decision's stated positive is that *"the boundary decision alone prevents a large and unnecessary
build"* — which is only collected if this Epic honours it.

**Independent Test**: contribute evidence from a simulated external tool through the typed
contribution path and assert it satisfies a Contract item without any analysis being performed by
PMI Studio.

**Acceptance Scenarios**:

1. **Given** an authorized external tool, **When** it contributes a typed result, **Then** it is
   stored or referenced as evidence against the named artifact and version.
2. **Given** contributed external evidence, **When** it is read, **Then** it names the contributing
   tool and its version alongside the ordinary provenance fields.
3. **Given** an external contribution that names no artifact version, **When** it is submitted,
   **Then** it is refused rather than attached to whatever version is current.

---

### User Story 5 - Nine kinds of proof behave like one kind of thing (Priority: P2)

Tests, scans, build results, approvals, screenshots, transcripts, review findings, deployment results
and external tool outputs are all queryable, attachable and gate-satisfying through one mechanism.

**Why this priority**: `BR-0140` enumerates them, and a per-type mechanism would give the completion
gate nine code paths and nine ways to be wrong. P2 because the gate (`Story 1`) is provable against
one type before all nine exist.

**Independent Test**: for each type in `BR-0140`, record it, attach it to a Contract item, and assert
the gate treats it identically.

**Acceptance Scenarios**:

1. **Given** each evidence type `BR-0140` names, **When** it is recorded, **Then** it is storable or
   referenceable through the same typed mechanism.
2. **Given** a Contract item satisfiable by more than one type, **When** any of them is supplied,
   **Then** the item is met.
3. **Given** evidence of a type the Contract item does not accept, **When** it is attached, **Then**
   the item stays unmet and says why.

### Edge Cases

- **Evidence is referenced, not stored, and the external system deletes it** — the reference reads as
  unresolvable. An unresolvable reference is not a satisfied item; the alternative silently converts
  a deletion into a passed gate.
- **Evidence attests a version that has since been superseded** — it stays readable and stays
  attached to the version it attested. It is not evidence for the new version.
- **A Contract is edited while work is in flight** — the work is judged against the version it began
  under (`FR-EVS-023`), and weakening in flight is refused (`FR-EVS-024`).
- **All Contract items are met but by evidence that fails its integrity check** — unmet. Presence is
  not validity.
- **An external tool contributes evidence for an artifact in another workspace** — refused. Evidence
  must not become a path around tenant isolation (`BR-0001`).
- **A Contract has zero items** — permitted only where policy explicitly declares the work class
  needs none, and the emptiness is visible. A silently empty Contract is a gate that always passes.
- **Evidence volume for one object grows very large** — reference over copy (`FR-EVS-005`), with
  retention recorded in this Epic's plan rather than assumed.
- **`EPIC-015` already validates an Epic against acceptance criteria** — this Epic supplies the
  store and the gate; it must not build a second validation path (`FR-EVS-050`).

## Requirements *(mandatory)*

### Functional Requirements

*Evidence types — `BR-0140`.*

- **FR-EVS-001**: Tests, scans, build results, approvals, screenshots and transcripts, review findings, deployment results and external tool outputs MUST all be storable or referenceable as typed evidence.
- **FR-EVS-002**: Every evidence type MUST be attachable, queryable and gate-satisfying through one mechanism, not a mechanism per type.
- **FR-EVS-003**: Evidence MUST be typed by **what it proves**, not by which tool produced it.
- **FR-EVS-004**: An evidence item MUST be attachable to an artifact, a task, a decision or an outcome.
- **FR-EVS-005**: Evidence MAY be stored or referenced; large artifacts SHOULD be referenced rather than copied.
- **FR-EVS-006**: Evidence MUST be queryable in aggregate — "which items are unmet across this scope" MUST be answerable without opening each object.

*Provenance — `BR-0141`.*

- **FR-EVS-010**: Every evidence item MUST identify its source and the time it was produced.
- **FR-EVS-011**: Every evidence item MUST identify the artifact it attests **and that artifact's version**.
- **FR-EVS-012**: Evidence attached to a superseded version MUST remain readable and MUST NOT read as evidence for the current version.
- **FR-EVS-013**: Every evidence item MUST carry integrity and provenance metadata sufficient to detect tampering or substitution.
- **FR-EVS-014**: A referenced item whose target no longer resolves MUST read as unresolvable, never as satisfied.
- **FR-EVS-015**: Reading evidence MUST honour the access rules of the artifact it attests, so evidence cannot become a side channel around artifact access control (`BR-0062`).
- **FR-EVS-016**: Evidence MUST NOT cross a workspace boundary (`BR-0001`).

*Evidence Contract — `BR-0142`.*

- **FR-EVS-020**: Governed work MUST be able to declare the minimum evidence required for successful completion, **before** the work runs.
- **FR-EVS-021**: A Contract MUST be attached at creation of the work it governs, with every item initially unmet.
- **FR-EVS-022**: The unmet items of a Contract MUST be enumerable without opening each evidence item.
- **FR-EVS-023**: Work MUST be judged against the Contract **version** it began under.
- **FR-EVS-024**: Weakening a Contract on work already in flight MUST be refused.
- **FR-EVS-025**: A Contract item MUST state which evidence types satisfy it; evidence of another type MUST leave the item unmet and say why.
- **FR-EVS-026**: A Contract with zero items MUST be permitted only where policy explicitly declares the work class requires none, and that emptiness MUST be visible.
- **FR-EVS-027**: The system MUST expose, for one object, its attached typed evidence and the unmet items of its Contract, as the projection a Room's Evidence region renders.

*Completion gate — `BR-0144`, `RULE-05`.*

- **FR-EVS-030**: A declaration of completion by an agent or a user MUST NOT substitute for required evidence. **Completion with an unmet Contract MUST NOT be reachable.**
- **FR-EVS-031**: Completion MUST be re-evaluated when evidence arrives, without the declaration being repeated by hand.
- **FR-EVS-032**: A refused completion MUST name the unmet items.
- **FR-EVS-033**: A refused completion MUST be recorded.
- **FR-EVS-034**: An item satisfied by evidence that fails its integrity check MUST count as unmet. Presence is not validity.

*External contribution — `BR-0146`, `ADR-0022` decided boundary.*

- **FR-EVS-040**: Authorized external tools MUST be able to contribute typed evidence, reaching this store through the adapter mechanism (`BR-0125`, `EPIC-013`/`U-13`) rather than a bespoke path per tool.
- **FR-EVS-041**: Contributed evidence MUST name the contributing tool and its version in addition to ordinary provenance.
- **FR-EVS-042**: A contribution naming no artifact version MUST be refused rather than attached to whatever version is current.
- **FR-EVS-043**: PMI Studio MUST NOT recreate the specialist analysis of generic code-review, security or testing products; it consumes their findings as evidence.

*Boundary.*

- **FR-EVS-050**: This Epic MUST NOT build a second validation path beside `EPIC-015`'s `BR-0080` QA validation. Where the two meet, this Epic supplies the store and the gate, and `EPIC-015` supplies the validation it already owns.
- **FR-EVS-051**: This Epic MUST NOT implement the compliance verdict (`BR-0143`) or spec/code convergence (`BR-0036`); both are `U-09` and remain unowned.
- **FR-EVS-052**: This Epic MUST NOT implement the Governed Engineering Loop (`EPIC-030`), risk and approval policy (`EPIC-031`), the capability adapter registry (`U-13`), or any Room user experience (`EPIC-033`–`EPIC-035`).

### Key Entities

- **Evidence Item**: one typed piece of proof, with source, time, attested artifact and version, integrity metadata, and either stored content or a reference.
- **Evidence Type**: what a piece of evidence proves — test result, scan, build, approval, transcript, review finding, deployment result, external output. Not the tool that made it.
- **Evidence Contract**: the versioned minimum set of evidence a class of governed work must produce before completion is accepted.
- **Contract Item**: one required element of a Contract, with the evidence types that satisfy it, and a met/unmet state that is derived, never set.
- **Completion Gate**: the evaluation of a Contract at the moment completion is declared. Its only outcomes are accepted and refused-with-unmet-items.
- **Contribution**: an external tool's typed submission, carrying the tool and version alongside ordinary provenance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-EVS-001**: **Zero** governed work items complete with an unmet Evidence Contract — enforced, not reported, and mutation-tested by adding a bypass and observing the suite fail.
- **SC-EVS-002**: **100%** of evidence items identify source, time, attested artifact and version, and carry integrity metadata; a missing field fails a check rather than reading as blank.
- **SC-EVS-003**: The unmet items of any Contract are answerable in **one** query, without opening individual evidence.
- **SC-EVS-004**: Every evidence type named by `BR-0140` is satisfiable through the same mechanism — verified by exercising all of them against one gate.
- **SC-EVS-005**: An external tool can satisfy a Contract item with **zero** analysis performed by PMI Studio.
- **SC-EVS-006**: A reference whose target has been removed reports unresolvable in **100%** of reads, and never satisfies an item.
- **SC-EVS-007**: Evidence attached to a superseded artifact version never satisfies a Contract item for the current version.
- **SC-EVS-008**: Contract satisfaction rate is reportable per project — the `BG-08` measure *"% of completed work with a satisfied Evidence Contract"* computed from the store rather than estimated.

## Assumptions

- **PMI-DOC-006 v1.0 is `PROPOSED`, not approved.** `FR-EVS-027` cites its Room Evidence region. The requirement it serves — `BR-0140`–`BR-0142` — is approved, so only the projection's shape depends on the proposed document. **Back-fill owner: project owner**, through the PMI-DOC-006 approval outstanding as decision 6 in `brs-v2-reconciliation.md` §7.
- **Whether `U-08` should be an `EPIC-015` extension rather than this new Epic is unsettled.** `brs-v2-reconciliation.md` §4 records the home as *"new epic, or `EPIC-015` extension"* — the only area whose assignment is an alternative. This Epic is declared as the new epic because the store, the Contract mechanism and the gate are substrate for **every** governed workflow, not only for Epic-level QA validation; but the call belongs to the **product owner** and is listed in Epic Exit Criteria. `FR-EVS-050` keeps the two from duplicating whichever way it goes.
- **`BR-0143` and `BR-0036` are `U-09` and stay unowned.** `ADR-0022` remains Open on exactly that. Declaring this Epic does not converge that ADR and must not be reported as doing so.
- Depends on `EPIC-030` for the loop's **Evidence** stage seam. The dependency is one-directional.
- Depends on `EPIC-031` only where a Contract item is itself gated by policy; the medium band's *evidence gates* are expressed against this Epic's Contract, and neither Epic builds the other's half.
- External tools reach this store through the adapter registry (`BR-0125`, `U-13`), which is unowned. Until `U-13` is declared, contribution is specified against the adapter contract `EPIC-013` already carries for engines, and **no bespoke per-tool path is built** (`FR-EVS-040`).
- Artifact access control is `EPIC-024`'s (`BR-0062`); tenant isolation is `EPIC-001`/`EPIC-004`'s (`BR-0001`). This Epic honours both and builds neither.
- Attestation and provenance format selection is this Epic's plan (`PP-015`), as are retention and volume targets (`PP-018`).
- **This Epic delivers no standalone user-facing journey.** It supplies the Evidence region projection a Room renders (`FR-EVS-027`); the *Evidence & Compliance* navigation area of PMI-DOC-006 §4.1 needs the compliance half too, so under `UX-0060` it cannot be built until `U-09` is also declared. Constitution XI Tier 2 therefore does not apply to this Epic; Tier 1 does.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX, XI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for Evidence Contract definitions and other non-code outputs, a passing executable conformance check that reads the artifact and fails when it drifts (Constitution V)
- [ ] **`FR-EVS-030` is mutation-tested**: a bypass permitting completion with an unmet Contract is added, and the suite observed failing (`SC-EVS-001`). This is the Epic's load-bearing requirement and the one most costly to have as decoration
- [ ] The **`U-08` versus `EPIC-015` extension** question is decided and recorded by the product owner, with the consequence for `EPIC-015` stated
- [ ] Every evidence type named by `BR-0140` has been exercised against one gate (`SC-EVS-004`) — nine types, one mechanism, demonstrated rather than asserted
- [ ] **Constitution XI Tier 1** — a test drives evidence contribution and the completion gate through their **real entry points** against the composed module graph. A mocked evidence store provably cannot satisfy this
- [ ] **Constitution XI Tier 2** — **not applicable**: this Epic delivers no standalone journey, and the *Evidence & Compliance* area cannot be built until `U-09` is declared (`UX-0060`). Recorded rather than omitted, per the `EPIC-029` `F1` precedent
- [ ] `ADR-0022` is **not** reported as converged by this Epic — it remains Open awaiting `U-09`, and the closing report says so
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/032-evidence-store-contracts/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)
