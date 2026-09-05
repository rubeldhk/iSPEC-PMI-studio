# Feature Specification: Epic Model and Spec Journey Board

**Feature Branch**: `epic/044-epic-model-journey-board`

**Epic**: `EPIC-044` — Epic Model and Spec Journey Board

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Epic Model and Spec Journey Board — Epic becomes a product entity
that groups requirements and owns specifications; each Epic's stage is derived from its execution
records using the EPIC-026 stage configuration (extracted to a shared package) extended with
Implementing and Converged; the Specifications area shows a board of Epics by stage with last and
next command." *(PMI-DOC-007 §7, verbatim)*

> **This is the fourth Epic of the local-first replan** (`D-7`, PMI-DOC-007) and the first half of
> milestone **M3 — the journey visible**. Until now *Epic* has existed in the product only as a
> directory convention of this repository and as a derivation `EPIC-043` returns with the label
> *unavailable until `EPIC-044`*: `pmi.project.context` lists no Epics, every requirement is
> *unassigned*, and the first run `EPIC-042` built registers nothing because the platform has no
> Epics to decompose into. This Epic makes Epic a product entity a project owner creates and
> assigns requirements to, gives every specification an Epic that owns it, and derives each Epic's
> Spec Kit stage from the execution records the hooks already write — never from a field a person
> sets. It shows that stage on a **Spec Journey Board** in the Specifications area: one card per
> Epic in the column of its stage, with the command that put it there and the command expected
> next. The stage vocabulary and the derivation rule are the ones this repository's own governance
> register has used since `EPIC-026`, moved into a shared package and extended with *Implementing*
> and *Converged*, so the register and the product cannot disagree about what a stage means
> (`R-06`).
>
> **Eight judgement calls were made in writing this document**, each listed under **Assumptions**
> with the reasoning and the alternative, so that `/speckit-clarify` can confirm or overturn them
> with the requester. No `[NEEDS CLARIFICATION]` marker is used: every call has a defensible
> default and none changes whether the Epic should exist.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §7 `EPIC-044` brief (`US1`–`US3`, `FR-EPB-001`, `FR-EPB-010`) | every `FR-EPB-` below |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §2.2 steps 2 and 6 — Epics group requirements; the board at *Specified* after the first run | FR-EPB-020 to FR-EPB-029, FR-EPB-040 to FR-EPB-049 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §3 domain model — `Epic` (new), `Requirement + epicId`, `Specification + epicId`, `EpicStage` (projection) | FR-EPB-020 to FR-EPB-029, FR-EPB-001 to FR-EPB-009 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §4.1 `pmi.project.context` epic list · `pmi.requirements.list` grouped by Epic · §4.2 `GET /v1/epics/{id}/stage` | FR-EPB-060 to FR-EPB-069 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §6 surfaces — Epic list and detail; Spec Journey Board; Specification list gains stage and Epic columns | FR-EPB-040 to FR-EPB-059 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §8 milestone `M3` · §11 `R-06` two boards drift · §13 the stage model reused | FR-EPB-001, FR-EPB-010, FR-EPB-011 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §9.3 `LR-03`, `LR-07` | FR-EPB-020, FR-EPB-001 |
| `SRS/PMI-DOC-004B_…Objective_Verification_and_Replan_v0.1.md` | §5.2 `O-2`, `O-7` and their verdicts (no `Epic` entity; no command stage anywhere) | FR-EPB-020, FR-EPB-001, FR-EPB-040 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.2 `BR-0041` product hierarchy explicit and queryable · §6.16 `BR-0050` progress visible per epic · §6.21 `BR-0113` derived readiness, never declared by hand | FR-EPB-020, FR-EPB-001, FR-EPB-040 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0196` universal registration · `BR-0198` phase-aware binding — the records the stage is derived from | FR-EPB-002, FR-EPB-005 |
| `specs/026-epic-stage-register/spec.md` | `FR-ESK-001` seven stages · `FR-ESK-003` derived, never declared · `FR-ESK-015` the stage model is configuration · `FR-ESK-017`–`FR-ESK-019` a step's artifact records that it ran | FR-EPB-001 to FR-EPB-011 |
| `specs/043-pmi-integration-contract/spec.md` | `FR-PIC-041` to `FR-PIC-043` — the reads return the Epic list and its derivation so this Epic replaces the source without changing the shape | FR-EPB-060 to FR-EPB-063 |
| `specs/042-pmi-spec-kit-extension/spec.md` | `FR-EXT-041`, `FR-EXT-044` to `FR-EXT-047` — the first run over Epics; a recorded split is what this Epic consumes | FR-EPB-026, FR-EPB-064 |
| `specs/037-governed-execution-registry/contracts/execution-contract.md` | registration with input binding, events, completion with outcome — the execution records per Epic | FR-EPB-002 to FR-EPB-008 |
| `specs/033-requirement-room/spec.md` | the Requirement Room, baselines and the requirement lifecycle the Epic list sits beside | FR-EPB-024, FR-EPB-041 |
| `.specify/memory/constitution.md` | XII — Execution Registration (only registered executions are evidence) · IV — convergence gate · V — tests per task | FR-EPB-002, FR-EPB-007 |
| `governance/epic-stage.config.json` · `tests/governance/epic-stage/derive.ts` | the stage sequence, evidence rules and next commands this Epic extracts | FR-EPB-010, FR-EPB-011 |

**Requirements not yet covered by SRS**: none by document — every requirement traces to
PMI-DOC-007, which lives in `SRS/`. **Two carry provisional identifiers** (`LR-03`, `LR-07`) that
receive `BR-` numbers only in PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before
the platform release gate and is restated under Assumptions (the `D-46` pattern, as `EPIC-041`,
`EPIC-043` and `EPIC-042`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | Epics and their requirement bundles are authored in PMI Studio before any agent runs; the first run decomposes them (`FR-EPB-064`) |
| PP-002 | Single Source of Truth | Satisfied | An Epic's stage has exactly one source — its execution records — and is never stored (`FR-EPB-001`); one derivation package serves the register and the product (`FR-EPB-010`) |
| PP-003 | Human-in-the-Loop | Satisfied | Epics are created, closed and assigned by a person (`FR-EPB-020`, `FR-EPB-024`); a stage is a fact about what ran, not an approval — readiness stays a separate claim (`FR-EPB-045`) |
| PP-004 | End-to-End Traceability | Satisfied | Every card names the execution that moved it (`FR-EPB-042`); requirement → Epic → specification → execution is one queryable chain (`FR-EPB-023`, `FR-EPB-025`) |
| PP-005 | Modular Architecture | Satisfied | The derivation is a package with no dependency on the platform or on this repository's tests (`FR-EPB-010`); Epic records are their own module beside requirements |
| PP-006 | Engine Independence | Satisfied | The stage vocabulary names Spec Kit commands as configuration the package reads (`FR-EPB-011`); the platform code names no toolkit (`EPIC-041`'s rule stands) |
| PP-007 | API & MCP First | Satisfied | The Epic list and the stage are routes the screens read and the connector reads `EPIC-043` already exposes now return real Epics (`FR-EPB-060` to `FR-EPB-063`) |
| PP-008 | Security by Design | Satisfied | Epic writes require the owner grant the Constraints screen uses (`FR-EPB-027`); every read is scoped by workspace and project; a connector credential sees only its project's Epics (`FR-EPB-063`) |
| PP-009 | Quality by Design | Satisfied | The extraction is proved by the register's existing tests passing unchanged against the package (`SC-EPB-002`); the derivation is mutation-tested (`SC-EPB-001`) |
| PP-010 | Observability by Default | Satisfied | The board is observability: what ran, when, and what is next, for every Epic (`FR-EPB-040`); every Epic write is audited (`FR-EPB-028`) |
| PP-011 | Documentation as Code | Satisfied | The stage model stays a configuration document with its evidence rules and next commands, versioned with the package (`FR-EPB-011`) |
| PP-012 | Everything Versioned | Satisfied | Epic changes are audited with before and after (`FR-EPB-028`); the package carries a version the register and the platform both record (`FR-EPB-012`) |
| PP-013 | Knowledge-Driven Engineering | Not applicable | No retrieval concern; `EPIC-038` is held (§9.4) |
| PP-014 | Configuration over Customization | Satisfied | Stages, their evidence and their next commands are configuration, not code paths (`FR-EPB-011`); readiness conditions for customer projects are an empty, extensible set (`FR-EPB-046`) |
| PP-015 | Open Standards | Satisfied | Spec Kit's command vocabulary, unmodified; MCP for the connector reads (`D-2`) |
| PP-016 | Explainable AI | Satisfied | A card states which execution put the Epic in its stage and why the next command is what it is (`FR-EPB-042`, `FR-EPB-043`) |
| PP-017 | Cost-Aware AI | Not applicable | No model call is made by this Epic; the board reads records |
| PP-018 | Scalability First | Satisfied | Stage derivation is a projection over each Epic's executions, computed on read and bounded by the project (`FR-EPB-006`); a project with one Epic pays for one |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Time-in-stage and stage-regression counts are inputs to `EPIC-040` Metrics & Reporting (held per §9.4); nothing is derived here |
| PP-020 | Customer Value | Satisfied | `SC-EPB-003` — after a first run, every Epic is visible at *Specified* with `/speckit-clarify` as its next command, in one session, without anyone typing a status |

**Deferral count**: 1 — `PP-019`, owner `EPIC-040` (held), reviewed at this Epic's convergence
gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Epics group my requirements (Priority: P1)

As a project owner, I create Epics for my project — each with a number the platform allocates, a
short name and a description — and assign requirements to them from the Requirement Room. A
requirement belongs to at most one Epic; requirements I have not assigned are shown to me as
*unassigned*, so nothing is silently left out of the first run.

**Why this priority**: it is objective `O-2` and `LR-03`, and the precondition for everything
else in the local-first replan: `EPIC-042`'s first run decomposes *Epics*, `EPIC-045` files
artifacts *under an Epic*, `EPIC-046` shows tasks *per Epic*. Today the product has no Epic
entity at all (PMI-DOC-004B §5.2, `O-2`). It is P1 because without it the first run over the
composed application registers nothing, as `EPIC-042`'s closure records.

**Independent Test**: create three Epics; assign four requirements to two of them; the Epic list
shows three Epics with their requirement counts and one *unassigned* group holding the remaining
requirements; `pmi.project.context` returns the three Epics with numbers and slugs and states the
source as the Epic entity; `pmi.requirements.list` grouped by Epic returns the same grouping.

**Acceptance Scenarios**:

1. **Given** a project with no Epic, **When** an owner creates one with a title and a description,
   **Then** it receives the next free number in that project, a slug derived from the title, and
   appears in the Epic list at stage *Not started* with `/speckit-specify` as the expected next
   command.
2. **Given** an Epic and an active requirement, **When** the owner assigns the requirement,
   **Then** the requirement shows the Epic on its row, the Epic's requirement count rises by one,
   and the change is audited with who did it and when.
3. **Given** a requirement assigned to Epic 3, **When** the owner assigns it to Epic 5, **Then**
   it leaves Epic 3 and joins Epic 5 — a requirement is never in two Epics.
4. **Given** requirements no one has assigned, **When** anyone opens the Epic list or the
   connector reads the grouping, **Then** they are listed as *unassigned*, never omitted.
5. **Given** an Epic with requirements, **When** the owner closes it, **Then** it keeps its
   requirements and its history, accepts no new assignment, and is shown as closed on the board.
6. **Given** a workspace member without the owner grant, **When** they open the Epic list,
   **Then** they can read everything and change nothing, and the screen says why.

---

### User Story 2 - I see every Epic's stage on the board (Priority: P1)

As anyone on the project, I open the Specifications area and see the **Spec Journey Board**: one
card per Epic in the column of its stage — *Not started*, *Specified*, *Clarified*,
*Checklisted*, *Planned*, *Tasked*, *Analyzed*, *Ready*, *Implementing*, *Converged* — with the
command that put it there, when it ran, and the command expected next. Nobody set any of it: it
is derived from the executions the hooks registered and completed.

**Why this priority**: it is objective `O-7`, `LR-07`, milestone `M3`'s visible half and the
reason `EPIC-037` and `EPIC-043` insisted that every command be registered. PMI-DOC-004B found
that no per-Epic command stage exists anywhere in the product (`O-7`, ❌). It is P1 because it is
the screen the Owner described first.

**Independent Test**: against a project with three Epics, run a governed `specify` for two of
them and a `plan` for one (through the hooks or the sequence harness); the board shows one card at
*Not started* with next `/speckit-specify`, one at *Specified* with next `/speckit-clarify`, one
at *Planned* with next `/speckit-tasks`, each naming its last execution and its time; the
register's own tests still pass against the extracted package.

**Acceptance Scenarios**:

1. **Given** an Epic with a completed `specify` execution, **When** the board is opened, **Then**
   its card is in *Specified*, names that execution and its completion time, and shows
   `/speckit-clarify` as next.
2. **Given** an Epic whose latest execution is a registered but unfinished `implement`, **When**
   the board is opened, **Then** the card is in *Implementing* and says the execution is still
   running.
3. **Given** an Epic whose `converge` execution completed reporting no remaining work, **When**
   the board is opened, **Then** the card is in *Converged* with no next command; a later
   `implement` moves it back to *Implementing*.
4. **Given** an Epic with executions but none completed, **When** the board is opened, **Then**
   the card is in *Not started* and names the open execution rather than pretending a stage.
5. **Given** a failed `plan` execution after a completed `clarify`, **When** the board is opened,
   **Then** the card stays in *Clarified*, shows the failure as its last execution, and keeps
   `/speckit-checklist` as next — a failure never advances a stage.
6. **Given** a provisional execution record not yet reconciled (`EPIC-042` `US5`), **When** the
   board is opened, **Then** it moves nothing: only governed executions are evidence.
7. **Given** the board, **When** a person filters by stage or by Epic title, **Then** the columns
   show matching cards only; the screen states its loading, empty, error and partial states.

---

### User Story 3 - Reaching a stage and being ready are different claims (Priority: P2)

As a reviewer, I see beside each Epic's stage whether its readiness conditions pass, so that
*Analyzed* is not mistaken for *ready to implement* — the distinction this repository's own stage
register draws between a stage and the Definition of Ready. For customer projects no readiness
condition is defined yet; the board says so rather than showing a green tick nobody earned.

**Why this priority**: PMI-DOC-007 §7 names it as `US3`; `BR-0113` says readiness is derived,
never declared. It is P2 because the readiness conditions for customer projects are out of scope
(§7, *later*), so this Epic delivers the **place** and the **rule** with an empty condition set,
not the conditions.

**Independent Test**: open an Epic at *Analyzed*; the card shows *Ready* only when every
configured readiness condition passes; with no condition configured it shows *Ready — no
readiness conditions configured*; the register's own DOR results for this repository are
unchanged.

**Acceptance Scenarios**:

1. **Given** an Epic at *Analyzed* and an empty readiness condition set, **When** the board is
   opened, **Then** the card reads *Ready* with the note *no readiness conditions configured* and
   `/speckit-implement` as next.
2. **Given** the same Epic, **When** a person looks for a control that marks it ready, **Then**
   there is none: readiness is derived, and the screen says where conditions will be configured.
3. **Given** this repository's own register, **When** it is regenerated after the extraction,
   **Then** its stage, DOR and readiness results are byte-identical to before.

---

### User Story 4 - The first run runs over my real Epics (Priority: P2)

As a developer running the first `/speckit-specify` in a provisioned directory, the plan the hook
shows me lists the Epics my project owner created, each with its requirement bundle; when a split
is confirmed, the children become Epics in PMI Studio, so the board shows them from their first
execution on.

**Why this priority**: `EPIC-042` built the loop and proved it against a stub because the
platform had no Epics (`FR-PIC-043`, `EPIC-042` closure assumption 8). Replacing the source is
what turns that proof into the product. It is P2 because `US1` and `US2` are demonstrable
without a first run.

**Independent Test**: with three Epics and their requirements in PMI Studio, run the first-run
sequence against the composed application: three `specify` executions are registered and
completed, each bound to its Epic; confirm a split of one Epic into two: the two children exist
as Epics with their own numbers, a parent link and the requirements the decision gave them, and
the board shows five Epics with the parent marked *split*.

**Acceptance Scenarios**:

1. **Given** Epics and assigned requirements, **When** the decompose read is called, **Then** it
   returns the Epics with numbers, slugs, names and their requirement bundles, states the source
   as the Epic entity, and lists unassigned requirements separately.
2. **Given** a confirmed or edited split recorded as a `decomposition-decision`
   (`FR-EXT-045`), **When** PMI Studio processes it, **Then** one child Epic per recorded child
   exists with the next free numbers, the recorded slug and requirements, a link to the parent,
   and the parent is marked *split* and accepts no new requirements.
3. **Given** a rejected split, **When** it is recorded, **Then** no Epic is created and the parent
   is unchanged.
4. **Given** the same decision recorded twice (a retried hook), **When** PMI Studio processes it,
   **Then** the children exist once.

---

### User Story 5 - The specification list tells me which Epic and which stage (Priority: P3)

As anyone browsing specifications, I see each specification's Epic and its stage as columns in
the list, so the list and the board never disagree.

**Why this priority**: PMI-DOC-007 §6 names it for `O-7`; it is P3 because the board carries the
same information and the list is an existing screen gaining two columns.

**Independent Test**: a specification bound to Epic 2 shows *Epic 2 · <title>* and the same stage
its card shows on the board; a specification with no Epic shows *no Epic*; both columns filter.

**Acceptance Scenarios**:

1. **Given** a specification produced by an execution bound to Epic 2, **When** the list is
   opened, **Then** its row shows Epic 2 and the Epic's current stage.
2. **Given** a specification created before this Epic with no Epic, **When** the list is opened,
   **Then** the Epic column reads *no Epic* and the stage column is empty, and an owner can
   assign it to an Epic.

---

### Edge Cases

- **Two Epics are created concurrently.** Numbers are allocated by the platform in one step; the
  second creation receives the next number, never the same one.
- **An Epic is closed while an execution bound to it is running.** The execution completes as it
  would have; the card shows *closed* and its final stage; the next command is empty.
- **An execution's target names an Epic number that does not exist** (a hook in a directory whose
  `specs/` folder outran PMI Studio). The execution is kept and listed under *unbound
  executions* on the board, never dropped and never attached to a guessed Epic.
- **A command completes out of order** — a `plan` completes for an Epic with no completed
  `specify` (the directory was hand-made). The stage is the highest reached whose predecessors
  have all completed at least once; the gap is shown on the card as *missing: specify*.
- **A stage is reached, then its artifact is removed on disk.** The board does not know: it reads
  executions, not files. `EPIC-045`'s artifact sync will say what is on disk; until then the card
  says *derived from executions*.
- **The stage configuration changes** (a stage renamed or added). The register and the product
  read the same file from the same package version; a card whose executions name a command the
  configuration no longer lists shows *unrecognised command* rather than a wrong stage.
- **A requirement is retired while assigned.** It stays counted in the Epic's history and is
  excluded from the bundle the decompose read returns, as `EPIC-042` already does for retired
  requirements.
- **The decomposition decision names a child whose slug collides with an existing Epic's.** The
  child is created with the recorded slug suffixed by its number; the collision is shown on the
  Epic.
- **Many executions per Epic** (hundreds). The derivation reads the latest execution per command
  and the completion order, not every event; the board still answers within the target below.
- **A connector credential for another project asks for Epics.** It receives nothing from this
  project — the same rule every connector read applies.

## Requirements *(mandatory)*

### Functional Requirements

**The derived stage**

- **FR-EPB-001**: An Epic's stage MUST be derived on read from the governed executions bound to
  it and MUST NEVER be written by a person, an agent or the platform: no field, route, tool or
  screen control sets a stage (`LR-07`, `BR-0113`, `D-3`'s spirit).
- **FR-EPB-002**: Only **governed** executions count as evidence — registered with PMI Studio and
  bound to the Epic by their input binding; provisional records not yet reconciled MUST move no
  stage (Constitution XII, `EPIC-042` `FR-EXT-054`).
- **FR-EPB-003**: The stage sequence MUST be the one `governance/epic-stage.config.json` defines —
  *Specified, Clarified, Checklisted, Planned, Tasked, Analyzed, Ready* — **extended** with
  *Implementing* and *Converged*, and preceded by *Not started* for an Epic with no completed
  execution.
- **FR-EPB-004**: A command's stage MUST be reached only by a **completed** execution of that
  command (`completed`, or for `implement` also `partially-completed`); `failed`, `cancelled`,
  `timed-out` and non-terminal executions MUST NOT advance a stage and MUST be shown as the last
  execution where they are the latest.
- **FR-EPB-005**: *Implementing* MUST be the stage while the latest `implement` execution is
  non-terminal or completed `partially-completed`; *Converged* MUST be the stage when the latest
  `converge` execution completed reporting no remaining work and no `implement` has been
  registered since; a later `implement` MUST return the Epic to *Implementing*.
- **FR-EPB-006**: The stage MUST be the highest reached whose predecessor stages have each been
  reached at least once; where a predecessor is missing, the card MUST name it (*missing:
  specify*) rather than skip or invent it.
- **FR-EPB-007**: For every Epic the derivation MUST also yield the **last command** — its
  execution id, outcome and completion (or registration) time — and the **next command** the
  configuration names for the stage, empty for *Converged* and for a closed Epic.
- **FR-EPB-008**: An execution whose binding names an Epic that does not exist in the project MUST
  be listed as *unbound* on the board and MUST NOT be attached to any Epic by inference.
- **FR-EPB-009**: The derivation MUST answer for a project's Epics in one read and MUST be
  deterministic: the same executions in any arrival order yield the same stages.

**One derivation, two consumers**

- **FR-EPB-010**: The stage derivation MUST be the same code this repository's governance register
  uses, extracted from `tests/governance/epic-stage/` into a shared package (`packages/epic-stage`)
  the register **and** the product import; neither MAY carry a second copy of a stage rule
  (`R-06`).
- **FR-EPB-011**: The stage configuration — stages, evidence rules, next commands, applicability —
  MUST stay a configuration document the package reads, and the extension with *Implementing* and
  *Converged* MUST be made in that document, not in code (`FR-ESK-015`).
- **FR-EPB-012**: The package MUST carry a version; the register MUST record which version produced
  it and the board MUST state which version it reads, so a drift between the two is visible before
  it is a disagreement.
- **FR-EPB-013**: The register's existing tests MUST pass unchanged against the package, and the
  register produced after the extraction MUST be byte-identical to the one produced before it, for
  this repository's `specs/`.
- **FR-EPB-014**: The package MUST have no dependency on the platform, on this repository's tests
  or on any toolkit adapter; the platform code that consumes it MUST name no toolkit (`EPIC-041`'s
  rule, enforced by the existing scans).

**The Epic entity**

- **FR-EPB-020**: A project owner MUST be able to create an Epic with a title and a description;
  the platform MUST allocate its **number** — the next free integer in the project, unique per
  project, never reused — and derive a **slug** from the title (`LR-03`, `BR-0041`).
- **FR-EPB-021**: An Epic MUST have a status — *active*, *split* or *closed* — and an owner MUST
  be able to close it; a closed or split Epic MUST accept no new requirement assignment and MUST
  keep its requirements, specifications and history.
- **FR-EPB-022**: An owner MUST be able to edit an Epic's title and description; its number MUST
  never change; a slug change MUST NOT rename anything on disk (that is `EPIC-045`'s concern) and
  MUST be recorded.
- **FR-EPB-023**: A requirement MUST belong to at most one Epic; assignment and unassignment MUST
  be owner actions on the Requirement Room's requirement rows and on the Epic detail, each
  recorded with who and when.
- **FR-EPB-024**: Requirements with no Epic MUST be visible as an *unassigned* group everywhere
  Epics are listed — the Epic list, the Epic detail's sibling view, and the connector reads — and
  MUST never be omitted from a count.
- **FR-EPB-025**: A specification MUST belong to at most one Epic; a specification produced by an
  execution bound to an Epic MUST be bound to that Epic, and an owner MUST be able to assign a
  specification with no Epic to one.
- **FR-EPB-026**: A recorded `decomposition-decision` (`FR-EXT-045`) whose decision is
  *confirmed* or *edited* MUST create one child Epic per recorded child — next free numbers, the
  recorded slug, the recorded requirements moved from the parent, a link to the parent — and MUST
  mark the parent *split*; a *rejected* decision MUST create nothing; processing the same decision
  twice MUST create nothing the second time.
- **FR-EPB-027**: Creating, editing, closing, assigning and splitting MUST require the project
  owner grant the Constraints screen uses; reading MUST be open to every workspace member with
  access to the project.
- **FR-EPB-028**: Every Epic write MUST produce an audit entry naming the actor, the project, the
  Epic, the operation and the outcome, with the before and after values for edits and
  assignments.
- **FR-EPB-029**: Epics, assignments and stages MUST be scoped by workspace and project as every
  product record is; a cross-project read MUST return nothing.

**The Spec Journey Board and the Epic screens**

- **FR-EPB-040**: The Specifications area MUST deliver the **Spec Journey Board** for a chosen
  project: one column per stage in sequence, one card per Epic in the column of its derived stage,
  and an *unbound executions* group where `FR-EPB-008` applies.
- **FR-EPB-041**: The Requirement Room MUST deliver the **Epic list** — number, title, status,
  requirement count, stage — and an **Epic detail** — description, its requirements with
  assign/unassign, its specifications, its stage with last and next command, and a link to its
  executions on the project's timeline.
- **FR-EPB-042**: Every card MUST show the Epic's number and title, its stage, the last command
  with its outcome and time, and the execution that produced it as a link to the timeline.
- **FR-EPB-043**: Every card MUST show the next command and, where the configuration limits it by
  Epic kind or the stage is terminal, MUST say why there is none.
- **FR-EPB-044**: A card for a closed Epic MUST say *closed*; for a split Epic *split into …*
  naming its children; for a running execution *running since …*.
- **FR-EPB-045**: Beside the stage, every card at *Analyzed* or later MUST show the readiness
  verdict as a separate claim — pass, fail with the failing conditions, or *no readiness conditions
  configured* — never merged into the stage name.
- **FR-EPB-046**: Readiness conditions for customer projects MUST be an empty, configurable set in
  this Epic; an empty set MUST evaluate as passing with the note of `FR-EPB-045`, and the screen
  MUST say where conditions will be configured.
- **FR-EPB-047**: The board MUST be filterable by Epic title and by stage, and MUST state its four
  states — loading, empty, error, partial (`FR-SHL-060`, PMI-DOC-005); the Epic list is a table with
  a filter.
- **FR-EPB-048**: The board MUST reflect a completed execution on its next load; no manual refresh
  control is required beyond reloading, and no live push is promised here (`EPIC-046` owns live
  movement for tasks).
- **FR-EPB-049**: The board MUST state that stages are *derived from executions* and MUST state
  the derivation package version it reads (`FR-EPB-012`).
- **FR-EPB-050**: The specification list MUST gain an **Epic** column and a **Stage** column, both
  filterable; a specification with no Epic MUST read *no Epic* with an empty stage.

**The reads**

- **FR-EPB-060**: `pmi.project.context` MUST return the project's active and split Epics with
  number, slug and name from the Epic entity and MUST state the source as the entity, replacing the
  *unavailable until `EPIC-044`* derivation without changing the shape (`FR-PIC-043`).
- **FR-EPB-061**: `pmi.requirements.list` grouped by Epic MUST group by the entity, one group per
  Epic in number order plus *unassigned*, and MUST state the source as the entity.
- **FR-EPB-062**: `pmi.project.decompose` MUST return the Epic entity's bundles so that
  `EPIC-042`'s first run registers one execution per Epic against the composed application; the
  stub-proved loop (`EPIC-042` closure assumption 8) MUST be re-proved against real Epics.
- **FR-EPB-063**: `GET /v1/epics/{id}/stage` MUST return one Epic's derived stage, last command,
  next command and readiness verdict; a project-level read MUST return the same for every Epic in
  one call; both MUST be session routes scoped to the caller's workspace, and the connector
  credential's reads MUST return nothing for another project.
- **FR-EPB-064**: The platform MUST process `decomposition-decision` comments as they are recorded
  (`FR-EPB-026`) and MUST expose on the Epic detail which decision created a child.

**Governance records**

- **FR-EPB-070**: `governance/repository-layout.md` MUST register `packages/epic-stage/` and this
  Epic's directory; the governance register's generator MUST import the package, and
  `ADR-0030` MUST gain an amendment recording that the register and the product share one stage
  derivation (`R-06`), at the plan step.

### Key Entities

- **Epic**: a product entity of a project — number (allocated, unique, never reused), slug,
  title, description, status (*active*, *split*, *closed*), optional parent, created by and when;
  groups requirements and owns specifications.
- **Requirement assignment**: the at-most-one Epic a requirement belongs to; changes are audited
  with before and after.
- **Specification ownership**: the at-most-one Epic a specification belongs to; set from the
  execution that produced it or by an owner.
- **Epic stage**: a projection, never stored — stage, last command (execution, outcome, time),
  next command, missing predecessors, readiness verdict — derived from the Epic's governed
  executions by the shared package.
- **Stage configuration**: the stage sequence with evidence rules, next commands and
  applicability, extended with *Implementing* and *Converged*; a versioned document in the shared
  package.
- **Readiness condition set**: the conditions evaluated at *Analyzed* and later for a project's
  Epics; empty for customer projects in this Epic; the repository's own DOR set for the register.
- **Decomposition decision**: `EPIC-042`'s recorded split; here the input that creates child Epics
  once.
- **Unbound execution**: a governed execution whose binding names no existing Epic of the
  project; listed, never attached.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-EPB-001**: **Zero** routes, tools, fields or controls write a stage; the derivation is
  mutation-tested — making a completed `plan` count without a completed `specify` is observed to
  fail the derivation tests, and making a `failed` execution advance a stage is observed to fail
  them.
- **SC-EPB-002**: The governance register produced after the extraction is **byte-identical** to
  the one produced before it for this repository, and **100%** of the register's existing tests
  pass against the package unchanged.
- **SC-EPB-003**: **Milestone M3, first half**: from creating Epics and assigning requirements in
  PMI Studio to every Epic visible on the board at *Specified* with `/speckit-clarify` as next,
  after a first run on the reference-local stack, in **one session**, recorded as a transcript.
- **SC-EPB-004**: **100%** of a project's requirements appear either under an Epic or under
  *unassigned* on the Epic list and in the connector grouping; **zero** are omitted.
- **SC-EPB-005**: A completed execution is reflected on the board on its next load in **100%** of
  cases; the project-level stage read for a project with 50 Epics and 500 executions answers in
  under **2 seconds**.
- **SC-EPB-006**: A confirmed split recorded once or twice yields exactly the recorded number of
  child Epics — **zero** duplicates — mutation-tested by removing the idempotence rule.
- **SC-EPB-007**: **Zero** provisional records move a stage — observed with a queued provisional
  execution for an Epic whose card stays where its governed executions put it.
- **SC-EPB-008**: The board and the Epic list end in one of the four states on **100%** of loads,
  and every table on the new screens has a filter.

## Assumptions

Eight judgement calls, each with the alternative that lost, for `/speckit-clarify` to confirm or
overturn.

1. **Readiness for customer projects is an empty, passing condition set, shown as such**
   (`FR-EPB-045`, `FR-EPB-046`). PMI-DOC-007 §7 puts DOR conditions for customer projects out of
   scope (*later*); the board still needs a *Ready* column and a place for the verdict. The
   alternative — omit *Ready* until conditions exist — makes the product's stage sequence differ
   from the register's, which is exactly the drift `R-06` forbids. The risk accepted: *Ready* reads
   as vacuous until conditions arrive; the note on the card says so.
2. **Children of a recorded split become Epics with their own next numbers and a parent link**
   (`FR-EPB-026`). `EPIC-042` named the children's *directories* by the parent's number and a suffix
   (`FR-EXT-045`); an Epic's number is an integer, so children cannot carry `7a` as a number. The
   alternative — suffixed identifiers on the Epic — changes the Epic's identity shape for every
   consumer for the sake of the first split. The link to the parent and the recorded slug keep the
   directory and the entity matched; `EPIC-045`'s sync binds the directory by execution.
3. **Provisional executions move no stage** (`FR-EPB-002`). A provisional record is *not governed*
   until reconciled (`EPIC-042` `FR-EXT-054`); showing a stage from it would present an
   unreconciled claim as evidence. The alternative — show a dashed provisional stage — was rejected
   as the same overstatement PMI-DOC-004B faulted.
4. **The derivation is extracted into `packages/epic-stage` and the register imports it in this
   Epic** (`FR-EPB-010`, `FR-EPB-013`). PMI-DOC-007 §10 names *package extraction* as this Epic's
   work and §11 `R-06` as its reason. The alternative — copy the rule into the platform — is the
   drift. The register's byte-identity is the proof the extraction changed nothing.
5. **The Epic list and detail live in the Requirement Room; the board in Specifications**
   (`FR-EPB-040`, `FR-EPB-041`). PMI-DOC-007 §6 offers *Requirement Room / Projects* for the list;
   requirements are assigned where requirements are, so the Room wins; the board is where §6 puts
   it. The alternative — both on the Projects screen — puts owner-level grouping beside developer
   status, the objection `EPIC-042` raised for the Constraints screen.
6. ***Converged* means the latest `converge` completed reporting no remaining work**
   (`FR-EPB-005`). A `converge` that appended tasks leaves the Epic at its prior stage with
   `/speckit-implement` next; how the completion states *no remaining work* is the plan's (the
   finish hook's completion comment and the unchanged `tasks.md` digest are the candidates). The
   alternative — every completed `converge` is *Converged* — would mark an Epic converged the
   moment it received new work.
7. **A stage is the highest reached with every predecessor reached once** (`FR-EPB-006`). Hand-made
   directories and interrupted runs produce gaps; naming the gap on the card is more honest than
   either the highest command alone or the lowest gap. The alternative — the lowest unreached
   stage — hides that a `plan` ran.
8. **Epic writes need the owner grant; reads are open to the project's members** (`FR-EPB-027`).
   The Constraints screen set this precedent for project-level governance; requirements
   themselves are wider-writable in the Room, but grouping them into Epics shapes the first run and
   is an owner's decision. The alternative — any Room writer may assign — is reversible at the plan
   step if the requester prefers it.

**Provisional identifiers**: `LR-03` and `LR-07` (PMI-DOC-007 §9.3) receive `BR-` numbers only in
PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before the platform release gate.

**Dependencies**: `EPIC-043` complete (the connector reads, `pmi.health`, the execution tools);
`EPIC-042` complete (the first-run loop, the `decomposition-decision` record, the timeline reads
by command); `EPIC-037`'s execution records with input bindings; `EPIC-026`'s stage configuration
and derivation; `EPIC-033`'s Requirement Room. **Out of scope**: readiness conditions for customer
projects (later); artifact viewing and the file tree under an Epic (`EPIC-045`); the Task Kanban
and live movement (`EPIC-046`); renaming directories on disk after a slug change; any change to
the execution tools or the hooks beyond consuming what they record.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/044-epic-model-journey-board/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`SC-EPB-001` and `SC-EPB-006` are mutation-tested** and the suite observed failing under
      each mutation
- [ ] **`SC-EPB-002` holds**: the register is byte-identical before and after the extraction and
      its tests pass against the package unchanged
- [ ] **Constitution XI Tier 2**: a transcript of User Story 1, User Story 2 and User Story 4
      against the running application is recorded (`SC-EPB-003`)
- [ ] `ADR-0030` is amended for the shared derivation and `governance/repository-layout.md`
      registers the package (`FR-EPB-070`)
- [ ] The connector reads return real Epics and state the entity as their source (`FR-EPB-060` to
      `FR-EPB-062`), and `EPIC-043`'s tool-surface contract test is green
