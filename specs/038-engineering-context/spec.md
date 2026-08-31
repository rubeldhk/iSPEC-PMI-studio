# Feature Specification: Engineering Context

**Feature Branch**: `epic/038-engineering-context`

**Epic**: `EPIC-038` — Engineering Context

**Created**: 2026-08-25 (ownership declared) · **Specified**: 2026-08-31

**Status**: Draft

**Input**: User description: `038`

> **This document supersedes the ownership declaration of 2026-08-25**, which stated
> *"OWNERSHIP DECLARED — not specified, not scheduled"* and named its own exit:
> *"`/speckit-specify` against PMI-DOC-004 v2.0 §6.10, producing a real `spec.md` that supersedes
> this declaration."* Its scheduling condition — *deferred until after Requirement Room S4
> (`EPIC-033`)* — is satisfied. The project owner's authorisation of 2026-08-25 (Execution
> Governance Remediation Rev 3, §07 and §03) carries forward unchanged: ownership was to be
> established for every application area even where implementation is deferred.
>
> **Scope was derived from the named source, not supplied with the command.** The invocation
> carried only `038`. Every requirement below traces to `BR-0091`–`BR-0096`; nothing was invented
> to fill a gap, and the four judgement calls that were made are listed under **Assumptions**.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0091` — Semantic retrieval | FR-CTX-010 to FR-CTX-014 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0092` — Live state | FR-CTX-020 to FR-CTX-023 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0093` — Context curation | FR-CTX-030 to FR-CTX-037 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0094` — Context provenance | FR-CTX-040 to FR-CTX-044 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0095` — Context isolation | FR-CTX-050 to FR-CTX-054 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0096` — Context inspection | FR-CTX-060 to FR-CTX-065 |
| `SRS/PMI-DOC-006` | §4.1 — the **Context** application area | The area this Epic claims |
| `.specify/memory/constitution.md` | XII — Execution Registration | FR-CTX-061, FR-CTX-062 |

**Requirements not yet covered by SRS**: none. `FR-CTX-070`–`FR-CTX-074` (the Room surface) derive
from the shared Room pattern (`UX-0030`, `UX-0035`) rather than from §6.10, and are marked as such.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | This document precedes any Context Package implementation |
| PP-002 | Single Source of Truth | Satisfied | `FR-CTX-041` — a package item points at its source and never restates it |
| PP-003 | Human-in-the-Loop | Satisfied | `FR-CTX-060` — a reviewer inspects what was actually supplied |
| PP-004 | End-to-End Traceability | Satisfied | `FR-CTX-062` — a package binds to the execution it fed, through `EPIC-037` |
| PP-005 | Modular Architecture | Satisfied | Retrieval, live state and access are ports; none is implemented here |
| PP-006 | Engine Independence | Satisfied | `FR-CTX-013` — no retrieval provider is named in this Epic's model |
| PP-007 | API & MCP First | Satisfied | Every capability is callable without the Room |
| PP-008 | Security by Design | Satisfied | `BR-0095` is the Epic's sharpest requirement — see `FR-CTX-050`–`FR-CTX-054` |
| PP-009 | Quality by Design | Satisfied | `SC-CTX-003` mutation-tests the isolation boundary |
| PP-010 | Observability by Default | Partial | Package assembly emits counts and refusals; retrieval latency telemetry → `EPIC-023` |
| PP-011 | Documentation as Code | Satisfied | The provenance vocabulary is configuration, not prose |
| PP-012 | Everything Versioned | Satisfied | `FR-CTX-042` — authoritative/version status is per item, and `FR-CTX-063` retains the package |
| PP-013 | Knowledge-Driven Engineering | Satisfied | This Epic *is* `PP-013`'s retrieval half; `EPIC-037` deferred it here |
| PP-014 | Configuration over Customization | Satisfied | Budget policy and source classes are configuration (`FR-CTX-036`) |
| PP-015 | Open Standards | Partial | Attestation reuses `EPIC-032`'s in-toto shape; no retrieval standard is adopted |
| PP-016 | Explainable AI | Satisfied | `FR-CTX-064` — *why each item was included* is part of the record |
| PP-017 | Cost-Aware AI | Satisfied | `FR-CTX-035` — the budget is an input, and exceeding it refuses rather than truncating silently |
| PP-018 | Scalability First | Deferred | Retrieval corpus scale targets land in `plan.md` `R-038-*`, as `EPIC-035` did |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Context-quality feedback is `BR-0163`, capability area `U-19`, **unowned** |
| PP-020 | Customer Value | Satisfied | `SC-CTX-006` — a reviewer answers *"what did it see?"* without asking anyone |

**Deferral count**: 2 — `PP-018` (owned, lands in this Epic's plan) and `PP-019` (**unowned**,
`BR-0163`/`U-19`, restated in the closing report rather than silently carried).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A governed AI session is given a package somebody can account for (Priority: P1)

**`BR-0093`.** Before a governed execution runs, the platform assembles a task-specific Context
Package from the objective, the actor's role and permissions, the security classification of each
candidate source, relevance, and a token/cost budget.

**Why this is P1 and the MVP**: every other story is a property *of* the package. Without
assembly there is nothing to give provenance to, isolate, or inspect.

**Independent test**: assemble a package for a stated objective and actor, and confirm the six
inputs are all consulted and recorded.

**Acceptance scenarios**

1. **Given** an objective, an actor with a role, and a set of approved sources, **When** a package
   is assembled, **Then** it contains only items the actor may read, and records the objective it
   was assembled for.
2. **Given** candidate items whose total exceeds the budget, **When** the package is assembled,
   **Then** the package states that it is bounded, names what was excluded and why — and does
   **not** silently truncate.
3. **Given** a source the assembler cannot classify, **When** the package is assembled, **Then**
   the item is **excluded and the exclusion recorded**, never included on the assumption that an
   unclassified source is safe.

### User Story 2 - Every item says where it came from and whether it is still true (Priority: P1)

**`BR-0094`.** Each item identifies its source and its authoritative/version status.

**Why P1**: a superseded requirement quoted as current is worse than one not quoted at all — the
model and the reviewer both treat it as authoritative, and nothing in the output says otherwise.

**Independent test**: assemble a package containing a superseded baseline and confirm the item is
marked superseded, naming what supersedes it.

**Acceptance scenarios**

1. **Given** an item drawn from an approved baseline, **When** the package is inspected, **Then**
   the item names the artifact, its version, and that the version is current.
2. **Given** an item whose source has since been superseded, **When** the package is inspected,
   **Then** the item is marked superseded and names its successor.
3. **Given** an item whose authoritative status cannot be determined, **When** the package is
   assembled, **Then** the status reads *undetermined with a reason* — never *current*.

### User Story 3 - Context does not cross a boundary it was not authorised to cross (Priority: P1)

**`BR-0095`.** Context from one tenant or project MUST NOT leak into another unless an explicitly
authorised reusable knowledge source permits it.

**Why P1**: it is the one failure in this Epic that cannot be walked back. A wrong classification
is corrected; a leaked package has already been read.

**Independent test**: assemble a package in one workspace against a corpus containing another
workspace's material, and confirm nothing crosses.

**Acceptance scenarios**

1. **Given** sources in two workspaces, **When** a package is assembled for one, **Then** no item
   originates in the other.
2. **Given** a source explicitly marked as a reusable knowledge source, **When** a package is
   assembled in a permitted workspace, **Then** the item is included **and marked as cross-boundary
   by authorisation**, naming the authorisation.
3. **Given** a reusable knowledge source with no recorded authorisation, **When** a package is
   assembled, **Then** it is excluded — the absence of a prohibition is not a permission.

### User Story 4 - A reviewer can see what the model was actually given (Priority: P2)

**`BR-0096`.** A user or reviewer can inspect the material context supplied to a consequential AI
session.

**Independent test**: run a consequential session, then inspect its context from the record alone.

**Acceptance scenarios**

1. **Given** a completed consequential session, **When** a reviewer opens its context, **Then**
   they see the package **as supplied**, not a package re-assembled now.
2. **Given** a package whose sources have changed since, **When** it is inspected, **Then** the
   retained package is shown and the drift is stated.
3. **Given** a session that was refused a package, **When** it is inspected, **Then** the refusal
   and its reason are visible — a session that ran without context is a fact, not a blank.

### User Story 5 - Approved sources can be found by meaning, not only by name (Priority: P2)

**`BR-0091`.** Semantic retrieval over approved project engineering sources, provided or integrated.

**Independent test**: retrieve for an objective whose wording matches no source verbatim.

**Acceptance scenarios**

1. **Given** an objective, **When** retrieval runs, **Then** candidates are ranked by relevance and
   each carries the score that ranked it.
2. **Given** no retrieval provider is bound, **When** assembly runs, **Then** it **refuses** and
   names the unbound capability — an unranked package is not a degraded package, it is a different
   one.
3. **Given** a source outside the approved set, **When** retrieval runs, **Then** it is never a
   candidate.

### User Story 6 - Live engineering state can be part of the picture (Priority: P3)

**`BR-0092`.** Repository, branch/PR, workflow, build, test, deployment and incident state, subject
to permissions.

**Independent test**: assemble a package requesting live state with a reader that is unavailable.

**Acceptance scenarios**

1. **Given** live state is requested and available, **When** the package is assembled, **Then**
   each element carries the instant it was read.
2. **Given** a live-state reader is unavailable, **When** the package is assembled, **Then** the
   package records *state unavailable with a reason* — distinct from *state read and empty*.
3. **Given** an actor without permission for a state element, **When** the package is assembled,
   **Then** the element is absent and its exclusion is recorded.

### Edge Cases

- **The budget admits nothing.** Assembly refuses rather than returning an empty package, because
  an empty package and a package nobody could afford are different facts.
- **Every candidate is excluded by permission.** The package is empty **and says so with counts** —
  `n` candidates, `n` excluded, and why.
- **A source is deleted between assembly and inspection.** The retained package still shows the
  item; the drift note says the source no longer resolves.
- **A retrieval provider returns items outside the approved set.** They are dropped and the event
  recorded — the boundary is enforced here, not trusted from the provider.
- **A consequential session is registered but never ran.** Inspection shows the package that was
  prepared for it, and that nothing consumed it.

## Requirements *(mandatory)*

### Functional Requirements

**Retrieval (`BR-0091`)**

- **FR-CTX-010**: The platform MUST retrieve candidate context by semantic relevance over the
  approved source set.
- **FR-CTX-011**: Retrieval MUST be reachable through a port with **no implementation in this
  Epic**, so a provider can be integrated rather than rebuilt.
- **FR-CTX-012**: Where no retrieval capability is bound, assembly MUST **refuse** and name the
  unbound capability. It MUST NOT assemble an unranked package.
- **FR-CTX-013**: No retrieval provider MAY be named in this Epic's data model (`PP-006`).
- **FR-CTX-014**: Retrieved candidates MUST carry the relevance score that ranked them.

**Live state (`BR-0092`)**

- **FR-CTX-020**: A package MAY include repository, branch/PR, workflow, build, test, deployment
  and incident state.
- **FR-CTX-021**: Every live-state element MUST carry the instant it was read.
- **FR-CTX-022**: Where a live-state reader is unavailable, the package MUST record *unavailable
  with a reason*, distinguishable from *read and empty*.
- **FR-CTX-023**: Live state MUST be filtered by the actor's permissions, and each exclusion
  recorded.

**Curation (`BR-0093`)**

- **FR-CTX-030**: A Context Package MUST be assembled **before** governed AI execution.
- **FR-CTX-031**: Assembly MUST take the objective, the actor's role, the actor's permissions, the
  security classification of each candidate, relevance, and a token/cost budget.
- **FR-CTX-032**: A package MUST record the objective it was assembled for.
- **FR-CTX-033**: An item the actor may not read MUST be excluded, and the exclusion recorded.
- **FR-CTX-034**: A candidate whose security classification cannot be determined MUST be
  **excluded**, never included by default.
- **FR-CTX-035**: Where candidates exceed the budget, the package MUST state that it is bounded and
  name what was excluded. Silent truncation is prohibited.
- **FR-CTX-036**: Budget policy and source classes MUST be configuration, not code.
- **FR-CTX-037**: Where the budget admits nothing, assembly MUST refuse rather than return an empty
  package.

**Provenance (`BR-0094`)**

- **FR-CTX-040**: Every package item MUST identify its source.
- **FR-CTX-041**: An item MUST reference its source rather than restating it (`PP-002`).
- **FR-CTX-042**: Every item MUST carry an authoritative/version status.
- **FR-CTX-043**: A superseded item MUST be marked superseded and name its successor.
- **FR-CTX-044**: Where authoritative status cannot be determined, the status MUST read
  *undetermined with a reason*. It MUST NOT read *current*.

**Isolation (`BR-0095`)**

- **FR-CTX-050**: Context from one tenant or project MUST NOT appear in another's package.
- **FR-CTX-051**: The only exception is a source explicitly authorised as reusable knowledge.
- **FR-CTX-052**: A cross-boundary item MUST be marked as such and name its authorisation.
- **FR-CTX-053**: A reusable source with no recorded authorisation MUST be excluded — absence of a
  prohibition is not a permission.
- **FR-CTX-054**: Authorisation MUST be adjudicated by `EPIC-024`'s existing model. This Epic MUST
  NOT implement a second access model.

**Inspection (`BR-0096`)**

- **FR-CTX-060**: A user or reviewer MUST be able to inspect the material context supplied to a
  consequential AI session.
- **FR-CTX-061**: *Consequential* MUST be derived from the session's registration (Constitution
  XII, `EPIC-037`), not decided here.
- **FR-CTX-062**: A package MUST bind to the execution it fed.
- **FR-CTX-063**: Inspection MUST show the package **as supplied**. Re-assembly at read time is
  prohibited.
- **FR-CTX-064**: Each item MUST carry **why it was included** — the objective term or rule that
  selected it (`PP-016`).
- **FR-CTX-065**: A refused package MUST be inspectable, showing the refusal and its reason.

**The Room surface** *(from the shared Room pattern, not §6.10)*

- **FR-CTX-070**: The Context surface MUST present its regions through the shared `RoomShell`.
- **FR-CTX-071**: Region names MUST match the shared pattern (`UX-0035`).
- **FR-CTX-072**: Retrieved-and-ranked material MUST be visually distinguishable from recorded fact
  (`UX-0031`).
- **FR-CTX-073**: What excluded an item MUST be visible without opening another screen (`UX-0032`).
- **FR-CTX-074**: State, provenance and exclusions MUST remain visible at a 360px viewport
  (`UX-0040`).

### Key Entities

- **Context Package** — the assembled material for one objective and actor. Retained, never
  recomputed. Binds to an execution.
- **Package Item** — one included piece of material: its source reference, authoritative/version
  status, inclusion reason, relevance score, and boundary marking.
- **Exclusion Record** — a candidate that did **not** make it, and why: permission, classification,
  budget, or boundary. **The Epic's most load-bearing entity** — without it an empty package and a
  filtered one are indistinguishable.
- **Source Class** — configuration describing a class of approved source and its security
  classification.
- **Reusable Knowledge Authorisation** — the explicit permission that allows one named source to
  cross a tenant or project boundary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-CTX-001**: **100%** of packages record the objective, actor and budget they were assembled
  under.
- **SC-CTX-002**: **100%** of package items carry a source and an authoritative/version status;
  **zero** read *current* without having been determined.
- **SC-CTX-003**: **Zero** items cross a tenant or project boundary without a named authorisation —
  mutation-tested by removing the boundary check and observing the suite fail.
- **SC-CTX-004**: **Zero** packages are silently truncated: every bounded package names what it
  excluded.
- **SC-CTX-005**: **100%** of consequential sessions have an inspectable package or an inspectable
  refusal.
- **SC-CTX-006**: A reviewer can answer *"what material did this session see?"* from the record
  alone, without asking the person who ran it.
- **SC-CTX-007**: **Zero** unclassified sources are included by default.
- **SC-CTX-008**: Assembly refuses, rather than degrading, whenever a required capability is
  unbound — measured as **zero** packages assembled with an unbound retrieval capability.

## Assumptions

Four judgement calls were made rather than asked, because the command carried only `038` and each
has a defensible default in this repository's established pattern. Each is listed so
`/speckit-clarify` can overturn it cheaply.

1. **`BR-0091` is satisfied by integration, not by building a retrieval engine.** The requirement
   says *"provide or integrate"*. This programme's consistent pattern — `EPIC-035`'s
   `TestExecution`, `EPIC-034`'s `ImpactSource` — is a port with no implementation and a refusal
   when unbound. Building an embedding and vector-search stack inside this Epic would be the
   largest unreviewed scope decision in the programme.
2. **Isolation is adjudicated by `EPIC-024`, not re-implemented** (`FR-CTX-054`). A second access
   model is a second thing that can be wrong, and `EPIC-032` already refuses to read around
   artifact access for the same reason.
3. **"Consequential" is `EPIC-037`'s determination** (`FR-CTX-061`). Defining it here would put two
   definitions of a governed session in the programme.
4. **The Room surface is included in scope.** `FR-CTX-060` requires a person to inspect a package;
   the three sibling Rooms establish the pattern, and an inspection capability reachable only by
   API would satisfy the letter of `BR-0096` and not its purpose.

**Dependencies**: `EPIC-024` (access), `EPIC-032` (evidence and attestation shape), `EPIC-033`
(`room-contract`, `RoomShell`), `EPIC-037` (execution registration), `EPIC-019` (steering
constraints — the nearest existing owner, which governs constraints but not assembly).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/038-engineering-context/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`FR-CTX-050` is mutation-tested**: the tenant/project boundary check is removed, and the
      suite observed failing (`SC-CTX-003`). This is the one failure in this Epic that cannot be
      walked back
- [ ] **`FR-CTX-035` is mutation-tested**: silent truncation is introduced, and the suite observed
      failing (`SC-CTX-004`). A package that quietly dropped material is the failure mode a reader
      cannot detect from the package itself
