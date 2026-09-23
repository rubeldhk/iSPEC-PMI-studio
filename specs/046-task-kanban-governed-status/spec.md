# Feature Specification: Task Kanban with Governed Auto-Status

**Feature Branch**: `epic/046-task-kanban-governed-status`

**Epic**: `EPIC-046` — Task Kanban with Governed Auto-Status

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Task Kanban — tasks are parsed from each Epic's `tasks.md` on sync,
shown on a board in the Plan & Tasks area, moved automatically by implement progress and completion
events, and moved manually only through a status-transition proposal that PMI Studio adjudicates."
*(PMI-DOC-007 §7, verbatim)*

> **This is the sixth and last Epic of the local-first replan** (`D-7`, PMI-DOC-007) and the whole
> of milestone **M4 — the board moves itself**. Since `EPIC-042` the finish hook of `/speckit-tasks`
> and `/speckit-implement` has called `pmi.tasks.sync` with the Epic's `tasks.md` in its arguments,
> and `speckit.pmi.progress` has appended one `progress-reported` event per task ticked since
> registration — and the platform answers *not available until `EPIC-046`*, so the markdown is
> discarded and the events land on an execution nobody joins to a task. `EPIC-045` now stores
> `tasks.md` as an immutable artifact version, so a stakeholder can **read** it; nobody can **work**
> it. The product's own verdict on this is `O-10` ❌: a `<ul>` with a three-value `<select>`,
> reachable only by typing a URL, whose only writer is a human `PATCH` (PMI-DOC-004B §2).
>
> This Epic makes the reserved tool live. A sync **parses** `tasks.md` under a stated grammar into
> **task rows** bound to the execution and, through it, to the Epic; a line that does not parse is
> **reported, never dropped**. A **Kanban board** in the Plan & Tasks area shows those rows and
> moves them as `progress-reported` and completion events arrive. **Percent complete** is derived
> per Epic and per project. A person may move a card — and that move is a **proposal with a reason**
> that PMI Studio adjudicates; it **never writes `tasks.md`**, because the file is the authority for
> what is done (PMI-DOC-007 §2.3) and PMI Studio is the record of everything else. Where the file
> and the board disagree, the board **surfaces the disagreement** rather than resolving it.
>
> **The parser is small; the rules are the work** (PMI-DOC-007 §10). **Nine judgement calls** were
> made in writing this document, each listed under **Assumptions** with the reasoning and the
> alternative. No `[NEEDS CLARIFICATION]` marker is used: every call has a defensible default and
> none changes whether the Epic should exist. **Five decisions were put to the requester on
> 2026-09-06 and all five recommendations were accepted**; they are recorded below and applied
> throughout.

## Clarifications

### Session 2026-09-06

Five questions were put to the requester in one round (Constitution X). **All five recommendations
were accepted.** Three confirmed judgement calls already recorded under **Assumptions**; two —
`Q4` and `Q5` — changed the document and are marked where they landed.

- Q: When `tasks.md` syncs for an Epic whose `spec.md` has never synced, what happens to the task
  rows? → A: **Tasks belong to the Epic; the link from a task to a specification becomes optional
  and is filled in when one exists.** No placeholder specification is created and no sync is
  refused for want of one. *(Confirms Assumption 6; `FR-KAN-030`, `FR-KAN-032`, Key Entities.)*
- Q: Should *In progress* and *Blocked* exist as columns, and may the platform ever put a card in
  one of them on its own? → A: **Four columns; *In progress* and *Blocked* come only from a
  person's move; nothing is inferred.** *(Confirms Assumption 3; `FR-KAN-041`, `FR-KAN-051`.)*
- Q: Should the proposal requirement apply to every task in the product, or only to tasks parsed
  from a `tasks.md`? → A: **Only synced tasks; engine-generated tasks keep the direct status
  update `EPIC-012` already offers.** *(Confirms Assumption 5; `FR-KAN-017`.)*
- Q: When a project member moves a card and gives a reason, does the card move straight away or
  wait for a second person? → A: **It applies immediately for a member holding the move
  permission — the proposal, its reason and an automatic verdict are recorded as evidence; a
  second person is required only where the project's policy says so; an agent principal never
  approves its own proposal.** *(Changes `FR-KAN-013` to `FR-KAN-016`, `US4`, `SC-KAN-005`.)*
- Q: What happens to the `tasks.md` of a governed command that ran while PMI Studio was
  unreachable and was recorded provisionally? → A: **No tasks are synced for a provisional run;
  the next governed command's sync brings the board level, and the board states when its latest
  parse is older than the Epic's latest execution.** Replay of provisional task syncs waits for
  `EPIC-037`'s provisional intake. *(Adds `FR-KAN-048`, an edge case and an out-of-scope line.)*

### Session 2026-09-06 — analysis remediation

Two further rulings, put to the requester after `/speckit-analyze` raised them as findings `F1` and
`C3`. Both recommendations were accepted.

- Q: `FR-KAN-013` requires adjudication *through the existing adjudication contract*, but
  `EPIC-030`'s `AdjudicationProposal` is hard-typed to a specification and cannot express a task
  target. Does *contract* mean its rules or its interface? → A: **Its rules and verdict
  vocabulary.** Widening the interface to a generic target is `EPIC-030`'s follow-up, not this
  Epic's work. *(Amends `FR-KAN-013`; `R-046-5`.)*
- Q: `FR-KAN-005` requires the parse to record the repository paths a description names, and nothing
  in the design captured them. Capture, or drop the clause? → A: **Capture them** — `DS-1` exists so
  a task can be read against what it changes. *(Adds `sourcePaths` to the data model and the card;
  tasks `T1776`, `T1777`.)*

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §7 `EPIC-046` brief (`US1`, `US2`, `US3`, `FR-KAN-001`, `FR-KAN-010`, `FR-KAN-020`) | every `FR-KAN-` below |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §2.2 step 8 — `tasks.md` parsed into `Task` rows and shown on the Kanban; `implement` emits `progress-reported` as tasks are checked and cards move automatically; a human moving a card creates a `status-transition-proposed` event, never a silent file edit | FR-KAN-001, FR-KAN-010, FR-KAN-040, FR-KAN-050 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §2.3 source-of-truth boundaries — *task status authoritative in `tasks.md` checkboxes **as observed** by sync and implement events; mirrored in PMI `Task.status`; the PMI UI writes only a **proposal*** | FR-KAN-010, FR-KAN-020 to FR-KAN-027, FR-KAN-041 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §3 domain model — `Task`: `+ epicId?`, `+ sourceLine Int?`, `+ sourceDigest` (the `tasks.md` digest the row was parsed from); `PrismaTaskStore` wired (discharged by `EPIC-041` `T1325`) | FR-KAN-030 to FR-KAN-036, Key Entities |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §4.1 `pmi.tasks.sync` (write; parse `tasks.md` into task rows bound to an execution; **returns the diff**; idempotency key; refusals with `structuredContent`) · §4.2 `POST /v1/projects/{id}/tasks/sync` | FR-KAN-030, FR-KAN-037, FR-KAN-060 to FR-KAN-063 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §5.2 hook map — `after_tasks` and `after_implement` call `pmi.tasks.sync`; `speckit.pmi.progress` appends one `progress-reported` per newly ticked task · §5 `R-07` there is no in-flight hook | FR-KAN-040 to FR-KAN-046, FR-KAN-064 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §6 surfaces — **Task Kanban**: columns Not started / In progress / Done (and Blocked), cards from `tasks.md`, live movement from implement events, manual move → proposal with reason, in the **Plan & Tasks** area (`O-10`); every table filtered; every screen states its four states | FR-KAN-050 to FR-KAN-059 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §8 milestone `M4 — the board moves itself` | SC-KAN-003 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §9.3 `LR-10` — tasks MUST be shown on a board that moves automatically from execution events, with manual moves recorded as proposals | FR-KAN-010, FR-KAN-040, FR-KAN-050 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §11 `R-05` — `tasks.md` hand-edited between syncs: digest per sync, conflicts surfaced, never auto-resolved (`FR-EXR-012` pattern) · `R-07` board updates late rather than live | FR-KAN-020 to FR-KAN-027, FR-KAN-036, FR-KAN-046 |
| `SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` | §12 `D-5` — **Kanban manual moves are proposal-gated** (approved with the document, `D-47`) | FR-KAN-010 to FR-KAN-018 |
| `SRS/PMI-DOC-004B_…Objective_Verification_and_Replan_v0.1.md` | §1 `O-10` and §2 its verdict ❌ — no board, `Task.status` written only by a human `PATCH`, tasks in `InMemoryTaskStore`, `/speckit-implement` never invoked by the platform | FR-KAN-011, FR-KAN-030, FR-KAN-050 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6 `BR-0050` — specifications MUST decompose into ordered, dependency-aware tasks with **progress visible per epic and per project** | FR-KAN-005, FR-KAN-055 to FR-KAN-058 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6 `BR-0013` health model (health derived from progress, not declared) · `BR-0035` engine provenance on generated artifacts · `RULE-10` every artifact versioned and traceable | FR-KAN-034, FR-KAN-056, FR-KAN-072 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0003` authorization — board and proposals role- and policy-controlled | FR-KAN-070, FR-KAN-071 |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md` · `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | the four states of every surface; every table filtered; the **Plan & Tasks** area the board lands in | FR-KAN-053, FR-KAN-059 |
| `governance/document-structure.md` | `DS-1` — *one task, one checkbox, one file path*: `- [ ] T### [P?] Description with an explicit path` · `DS-2` — task identifiers are **globally unique and invariant**, never reused, never renumbered; a `(unit test: T0nn)` reference may point into a sibling Epic | FR-KAN-001 to FR-KAN-004, FR-KAN-031, FR-KAN-035 |
| `specs/042-pmi-spec-kit-extension/spec.md` · `contracts/extension-and-hooks.md` §5, §6 | `FR-EXT-006` `speckit.pmi.progress` — one `progress-reported` `{ taskId }` per newly `[X]` task, keyed `<executionId>:<taskId>` · `FR-EXT-015` `partially-completed` when unchecked tasks remain · `FR-EXT-016` `not_available_until` is printed once and the run continues · `FR-EXT-010` the strict and provisional offline postures, under which a run is recorded in the directory and calls no sync | FR-KAN-040 to FR-KAN-046, FR-KAN-048, FR-KAN-064 |
| `specs/043-pmi-integration-contract/spec.md` · `contracts/mcp-tool-surface.md` §3, §4 | `FR-PIC-002`, `FR-PIC-045` — `pmi.tasks.sync` is listed, schema-validated and refuses by name; its argument shape is the one this Epic must accept; the refusal vocabulary a client already handles | FR-KAN-060, FR-KAN-061, FR-KAN-066 |
| `specs/044-epic-model-journey-board/spec.md` | `FR-EPB-008` an unbound execution is listed, never attached · `FR-EPB-026` Epic resolution from the execution's binding · `FR-EPB-063` a connector read is scoped to one project and refuses as absence | FR-KAN-032, FR-KAN-033, FR-KAN-070 |
| `specs/045-artifact-sync-markdown-viewer/spec.md` | `FR-ART-002` `tasks.md` is in the artifact set and is stored by digest · `FR-ART-014` a file absent from the latest sync stays listed, marked · `FR-ART-030` the Epic's specification is created by sync | FR-KAN-030, FR-KAN-036, FR-KAN-038, FR-KAN-039 |
| `specs/037-governed-execution-registry/contracts/event-vocabulary.md` · `state-machines.md` | `progress-reported` (intermediate progress, carries no outcome) · `status-transition-proposed` (records the request only, **never a verdict**) · the terminal outcomes `completed` / `partially-completed` | FR-KAN-012, FR-KAN-040, FR-KAN-045 |
| `specs/030-governed-engineering-loop/spec.md` | `FR-GEL-063`–`FR-GEL-073` — a connector proposes, `EPIC-030` adjudicates, the applier applies; adjudication leaves immutable evidence and cannot be bypassed | FR-KAN-013 to FR-KAN-016 |
| `specs/_shared/platform-spec.md` (`FR-020`, `FR-022`) · `specs/012-workflow-tasks/spec.md` (`US4`, `SC-003`) | the task entity `EPIC-012` owns — its three statuses, engine identity stamped per row, the project progress aggregate, and *every task resolves back through its specification to a requirement* — extended here, never replaced | FR-KAN-011, FR-KAN-017, FR-KAN-030, FR-KAN-057 |
| `.specify/memory/constitution.md` | XII — Execution Registration (contract, never the database) · **XII.6 no AI self-approval** · IV, V | FR-KAN-013, FR-KAN-030, FR-KAN-060 |

**Requirements not yet covered by SRS**: none by document — every requirement traces to
PMI-DOC-007, which lives in `SRS/`. **One carries a provisional identifier** (`LR-10`) that receives
a `BR-` number only in PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before the
platform release gate and is restated under Assumptions (the `D-46` pattern, as `EPIC-041` to
`EPIC-045`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | The board shows what `tasks.md` says; PMI Studio adds no task and invents no status (`FR-KAN-004`, `FR-KAN-041`) |
| PP-002 | Single Source of Truth | Satisfied | `tasks.md` is authoritative for done/not-done; the row is its mirror keyed by the digest it was parsed from (`FR-KAN-020`, `FR-KAN-036`); PMI Studio is authoritative for proposals, verdicts and audit |
| PP-003 | Human-in-the-Loop | Satisfied | A manual move is a proposal with a required reason and a recorded verdict, never a write to the file (`FR-KAN-010` to `FR-KAN-016`); a permitted member's own move applies at once and a project policy may still require an approver; Constitution XII.6 holds — an agent never approves its own proposal (`FR-KAN-013`) |
| PP-004 | End-to-End Traceability | Satisfied | Requirement → Epic → execution → `tasks.md` digest → task row → status event is one chain (`FR-KAN-030`, `FR-KAN-034`, `FR-KAN-072`) |
| PP-005 | Modular Architecture | Satisfied | The grammar is one parser with no platform knowledge; the sync, the board and the proposal path are separate seams over the existing task entity (`FR-KAN-001`, `FR-KAN-030`) |
| PP-006 | Engine Independence | Satisfied | The grammar is `DS-1`, read as configuration; no platform code names a toolkit or a command set (`FR-KAN-002`) |
| PP-007 | API & MCP First | Satisfied | The sync is the reserved MCP tool made live and its REST binding; the board reads routes (`FR-KAN-060` to `FR-KAN-063`) |
| PP-008 | Security by Design | Satisfied | A sync is scoped to the credential's project (`FR-KAN-070`); a connector may write tasks and never adjudicate (`FR-KAN-013`, `FR-KAN-071`); credential-shaped text in a task description is refused (`FR-KAN-073`) |
| PP-009 | Quality by Design | Satisfied | The grammar has a fixture corpus of accepted and rejected lines; identifier invariance and no-file-write are mutation-tested (`SC-KAN-002`, `SC-KAN-006`) |
| PP-010 | Observability by Default | Satisfied | Every sync is audited with the execution, the digest and the diff (`FR-KAN-072`); the board states what the last sync saw, what it no longer sees and where it disagrees (`FR-KAN-024`, `FR-KAN-052`) |
| PP-011 | Documentation as Code | Satisfied | `tasks.md` stays the document; the rows are derived from it and never written back (`FR-KAN-010`) |
| PP-012 | Everything Versioned | Satisfied | Every sync keeps its manifest with the file digest; a task that disappears is marked, never deleted (`FR-KAN-034`, `FR-KAN-036`, `FR-KAN-038`) |
| PP-013 | Knowledge-Driven Engineering | Deferred | Retrieval over tasks and artifacts is `EPIC-038`'s (held, PMI-DOC-007 §9.4); this Epic supplies structured rows, not retrieval |
| PP-014 | Configuration over Customization | Satisfied | The grammar, the column set and the identifier pattern are configuration with stated defaults (`FR-KAN-002`, `FR-KAN-051`) |
| PP-015 | Open Standards | Satisfied | GitHub-flavoured markdown task lists; SHA-256 digests; MCP for the tool (`D-2`) |
| PP-016 | Explainable AI | Satisfied | Every card names the line it was parsed from, the execution that synced it and the event that last moved it (`FR-KAN-054`) |
| PP-017 | Cost-Aware AI | Not applicable | No model call is made by this Epic; it parses, stores and displays |
| PP-018 | Scalability First | Satisfied | A sync is one parse and one bounded diff; the board reads a projection and never loads file content (`FR-KAN-037`, `FR-KAN-058`) |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Throughput, cycle time and task churn are `EPIC-040` Metrics & Reporting's (held per §9.4, awaiting exactly this Epic's data); nothing is derived here beyond percent complete |
| PP-020 | Customer Value | Satisfied | `SC-KAN-003` — a person watching PMI Studio during `/speckit-implement` sees the Epic's cards reach *Done* and the percentage rise, without a checkout |

**Deferral count**: 2 — `PP-013`, owner `EPIC-038` (held); `PP-019`, owner `EPIC-040` (held);
both reviewed at this Epic's convergence gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Epic's tasks become rows, and nothing is silently lost (Priority: P1)

As a developer who has just run `/speckit-tasks`, I open the Epic in PMI Studio and see every task
of its `tasks.md` as a card — its identifier, its description, whether it is parallel-safe, and the
file line it came from. Any line the parser could not read is listed too, as a refused line with
its text and its number, so I can see that the board is the whole file and not a convenient subset.

**Why this priority**: it is the precondition for every other story. Until `tasks.md` becomes rows,
there is nothing to move, nothing to count and nothing to propose about. It is also the half of
`O-10` that the existing task list cannot supply, because the composed application has never parsed
a `tasks.md` at all (PMI-DOC-004B §2, `O-10`).

**Independent Test**: run `/speckit-tasks` for one Epic against a local stack; open the Epic's board:
every `- [ ] T###` line of the file appears once as a card in *Not started*, every `- [X] T###` line
appears in *Done*, and a deliberately malformed line appears in the *Refused lines* list with its
line number — with the totals stated as *parsed / refused / total lines considered*.

**Acceptance Scenarios**:

1. **Given** an Epic whose `/speckit-tasks` execution completed with the finish hook, **When** a
   member opens the Epic's board, **Then** each task line of `tasks.md` is one card carrying its
   identifier, description, parallel marker and source line, and the board names the execution and
   the file digest it was parsed from.
2. **Given** a `tasks.md` containing a heading, prose, a table row, a nested bullet and a
   `(unit test: T0nn)` cross-reference, **When** it is synced, **Then** none of them becomes a task
   and none of them is reported as refused — only lines that begin a task list item are considered.
3. **Given** a `tasks.md` containing a task-shaped line whose identifier is missing or malformed,
   **When** it is synced, **Then** the line is reported as refused with its number, its text and a
   coded reason, is visible on the board and on the execution, and the other lines are stored.
4. **Given** two lines in one file declaring the same identifier, **When** it is synced, **Then**
   the first is stored, the second is reported as a duplicate identifier with both line numbers, and
   the sync succeeds.
5. **Given** an Epic with no synced `tasks.md`, **When** the board is opened, **Then** it states
   that no `tasks.md` has been synced yet and names `/speckit-tasks` as the command that produces
   one.
6. **Given** the board is loading, has failed, or loaded partly, **When** it renders, **Then** it
   states that state in words and the rest of the Epic's surfaces stand.

---

### User Story 2 - I watch cards move while `/speckit-implement` runs (Priority: P1)

As a developer running `/speckit-implement` in my own terminal, I keep PMI Studio open on the Epic's
board and watch cards arrive in *Done* as the run ticks them off, ending with the board matching the
file and the run's outcome recorded beside it — including `partially-completed` when tasks remain.

**Why this priority**: it is the objective (`O-10`, *status updated automatically*) and the whole of
milestone `M4`. It is the first moment the product moves by itself rather than by someone clicking.

**Independent Test**: register an `implement` execution for an Epic whose tasks are synced, append
`progress-reported` events naming three task identifiers, then complete it; the three cards are in
*Done* with the event and time that moved each, the percentage has risen, and no card was moved by a
person.

**Acceptance Scenarios**:

1. **Given** an Epic whose tasks are synced and an `implement` execution registered against it,
   **When** a `progress-reported` event naming a task identifier is appended, **Then** that task's
   card is in *Done*, attributed to that event, that execution and its time — with no human action.
2. **Given** the same execution, **When** it completes, **Then** the sync the finish hook performs
   reconciles the board to the file, and the board shows the outcome (`completed` or
   `partially-completed`) with the count of tasks still unchecked.
3. **Given** the board is open, **When** the run progresses, **Then** the board reflects the new
   state on its next load without a manual refresh control being required, and states plainly that
   movement is *observed, not live-pushed* while the toolkit offers no in-flight hook (`R-07`).
4. **Given** a `progress-reported` event naming an identifier the Epic has no task for, **When** it
   is processed, **Then** nothing is created or guessed, and the event is listed as an unmatched
   progress report on the Epic with its identifier.
5. **Given** two `progress-reported` events naming the same task, **When** both are processed,
   **Then** the card is in *Done* once and the second changes nothing.

---

### User Story 3 - Percent complete, per Epic and per project (Priority: P1)

As a project owner I see, for each Epic, how many of its tasks are done and what proportion that is,
and for the project as a whole the same figure — one number that everyone sees, derived from the
same rows the board shows and stated with the moment it was derived from.

**Why this priority**: it is `US2` of the brief and `BR-0050`'s *progress visible per epic and per
project*. It is the only number a sponsor asks for, and today it is computed over an in-memory store
the composed application never fills (PMI-DOC-004B §2.1).

**Independent Test**: with two Epics synced — one with 10 tasks of which 4 are done, one with 5 of
which 5 are done — the Epic figures read 40% and 100%, the project figure reads 60%, and the same
figures appear on the board, on the Epic card and on the project surface without being recomputed
differently anywhere.

**Acceptance Scenarios**:

1. **Given** an Epic with tasks in several statuses, **When** progress is read, **Then** it states
   total, done, in progress, not started, blocked and a whole-number percentage, and the percentage
   is 0 — never absent and never a non-number — for an Epic with no tasks.
2. **Given** a project with several Epics, **When** project progress is read, **Then** it is the
   aggregate over the same rows, and every surface that shows it shows the same value.
3. **Given** tasks that came from a sync and tasks that came from engine generation in the same
   project, **When** progress is read, **Then** both are counted, and the Epic's figure counts only
   the Epic's tasks.
4. **Given** a task marked *not in the latest parse*, **When** progress is computed, **Then** it is
   excluded from the denominator and the exclusion is stated on the surface.

---

### User Story 4 - I move a card, and PMI records a proposal with my reason (Priority: P2)

As a developer who knows something the file does not — this task is blocked on an external answer, or
I have started it but not finished it — I move its card and give a reason. The card moves at once,
and PMI Studio has recorded a status-transition proposal, its reason and its verdict as evidence. My
`tasks.md` is not touched. Where my project's policy says a task move needs an approver, the card
waits and says so instead.

**Why this priority**: it is `US3` of the brief and decision `D-5`. It is P2 because the board is
already useful and honest without it; it is not P3 because without it the board is read-only and the
in-progress and blocked columns can never be occupied.

**Independent Test**: move one card to *In progress* with a reason; the card is in *In progress* and
a proposal exists with the mover, the from- and to-status, the reason and the verdict that applied
it; the Epic's `tasks.md` on disk and its latest artifact version are byte-identical to before; the
card's position reflects the verdict, not the request.

**Acceptance Scenarios**:

1. **Given** a synced task in *Not started* and a member holding the move permission, **When** they
   move it to *In progress* with a reason, **Then** a proposal is recorded with who, when, from, to
   and the reason, a `status-transition-proposed` event is appended to the Epic's relevant
   execution, and a verdict is recorded immediately.
2. **Given** that verdict applies the move, **When** the board is read, **Then** the card is in
   *In progress* attributed to the proposal and its verdict, and **no** write is made to `tasks.md`,
   to any artifact version, or to any file on disk.
3. **Given** a project whose policy requires an approver for a task move, **When** a member moves a
   card, **Then** the card stays where it was, states the requested status, the requester, the
   reason and the time, and moves only when a second person's verdict applies it.
4. **Given** a move submitted without a reason, **When** it is submitted, **Then** it is refused with
   a message naming the reason as required, and no proposal exists.
5. **Given** a proposal that is refused or inconsistent, **When** the verdict is recorded, **Then**
   the card stays where it was, the verdict and its stage are shown on the card, and the proposal
   remains readable.
6. **Given** a connector credential, **When** it attempts to adjudicate a proposal or to apply a task
   status directly, **Then** it is refused; a connector may propose and may sync, never approve
   (Constitution XII.6).
7. **Given** two members move the same card at the same moment, **When** both are submitted, **Then**
   both proposals are recorded, at most one is applied, and the other's verdict states that the task
   had moved.

---

### User Story 5 - The board surfaces disagreement rather than hiding it (Priority: P2)

As a reviewer I want to know when the board and the file no longer agree — because someone hand-edited
`tasks.md`, or a proposal moved a card the file still shows as unchecked, or a task vanished from the
file between syncs. I want to see the disagreement stated, with both sides and both times, and I want
to be sure the platform did not quietly pick a winner.

**Why this priority**: it is `FR-KAN-020` and risk `R-05`. It is the difference between a board that
is trustworthy and a board that is merely tidy; `EPIC-045`'s *reported-versus-synced* finding set the
pattern this Epic follows.

**Independent Test**: sync a `tasks.md`; move a card to *In progress* by proposal; hand-edit the file
to tick that same task and re-sync. The board shows the task in *Done*, states that a manual
in-progress proposal was superseded by the file, names both digests and both times, and no proposal
record is deleted.

**Acceptance Scenarios**:

1. **Given** a task whose file line is unchecked and whose board status was set by an applied
   proposal to *In progress* or *Blocked*, **When** a sync of an unchanged line runs, **Then** the
   board keeps the proposed status, marks the task as *ahead of the file*, and states both.
2. **Given** the same task, **When** a sync arrives whose line is now checked, **Then** the file
   wins, the card moves to *Done*, and the card states that a manual status was superseded by the
   file, naming the proposal and the digest.
3. **Given** a task present in an earlier parse and absent from the latest, **When** the board
   renders, **Then** the task stays listed, marked *not in the latest parse*, with the digest and
   execution of the parse that last contained it; it is never deleted.
4. **Given** a task whose description changed in the file under the same identifier, **When** it is
   synced, **Then** the row keeps its identifier and history, the description is updated, and the
   change is listed in the sync diff as a description change with both texts.
5. **Given** two syncs of the same `tasks.md` digest, **When** the second runs, **Then** it creates
   no change, reports an empty diff, and is recorded as a sync that observed the same file.

---

### Edge Cases

- **A `tasks.md` with zero task lines** (a placeholder, or a file that is all prose). The sync
  succeeds, reports zero tasks parsed, and the board states that the file contains no task lines —
  distinct from *no file synced*.
- **A sync for an execution bound to no Epic** (`FR-EPB-008`). The tasks are stored under the project
  as unbound, listed with the board's unbound group, never attached to a guessed Epic.
- **A `progress-reported` event arrives before the sync that creates its task row.** The event is
  retained and matched when the row appears; until then it is listed as unmatched. Nothing is
  created from an event.
- **A cross-reference inside a description** — `(unit test: T0nn)`, which `DS-2` says may point into
  a sibling Epic. It is description text, never a second task, and never a status change.
- **The same identifier in two different Epics' files.** Identity is scoped to the Epic; both exist;
  neither overwrites the other. `DS-2` asks for global uniqueness of *this repository's* identifiers
  and cannot bind a customer's project.
- **A line whose identifier repeats within one file.** First wins, second reported as a duplicate;
  neither is silently merged.
- **A hand-edit that removes a task and adds another with the same number.** The identifier is the
  identity: the row survives with a description change recorded in the diff, and the diff is where a
  reviewer sees what a hand-edit did (`R-05`).
- **A checkbox in an unexpected case or spacing** — `- [x]`, `- [X]`, `-  [ ]`, `* [ ]`. The grammar
  states exactly which are accepted; anything else is a refused line with its reason, never a
  guess.
- **A task description containing a credential shape** (`pmi_ct_…`, `Bearer …`, `sk-…`). The line is
  refused with a coded reason and not stored; the refusal is visible on the execution (`R-04`).
- **A `tasks.md` above the size limit, or a file with more task lines than the limit.** Refused as a
  whole with a coded reason naming the limit — a partial task list is worse than none, unlike the
  artifact set where files are independent.
- **`implement` ends `partially-completed`.** The board shows the outcome and the remaining count;
  no card is moved on account of the outcome itself.
- **A member without permission to move a card.** The board renders read-only for them, states why,
  and shows no move control (`BR-0003`).
- **A governed command that ran while PMI Studio was unreachable.** It is recorded provisionally and
  syncs no tasks; the board keeps the parse it has, states that its parse is older than the Epic's
  latest execution, and is brought level by the next governed command's sync (`FR-KAN-048`).
- **An Epic whose `tasks.md` synced before its `spec.md` ever did** — an adopted directory, or a run
  out of order. The tasks belong to the Epic and are shown; the specification link stays empty until
  one exists, and attaches to the same rows when it arrives (`FR-KAN-030`).
- **The connector credential of another project syncs tasks.** Refused as absence — the same rule
  every connector call applies (`FR-EPB-063`).

## Requirements *(mandatory)*

### Functional Requirements

**The grammar and the parse**

- **FR-KAN-001**: The `tasks.md` **grammar MUST be stated** as the specification of this Epic and
  MUST be the repository's own `DS-1`: a task line is a markdown task-list item of the form
  `- [ ] T### [P] Description` — a `-` bullet, a checkbox that is exactly `[ ]` (open) or `[x]`/`[X]`
  (checked), an identifier matching the configured pattern (default `T` followed by one or more
  digits), an optional `[P]` parallel marker, and a non-empty description. Only lines that begin a
  task-list item at the start of a line are considered; everything else in the file is ignored
  without being reported.
- **FR-KAN-002**: The grammar's identifier pattern, checkbox forms, parallel marker and the maximum
  description length MUST be **configuration with stated defaults**, read by the parser; no platform
  code path may hard-code a toolkit's task syntax.
- **FR-KAN-003**: A line that is a task-list item but does not satisfy the grammar MUST be
  **reported, never dropped**: its line number, its text and a coded reason MUST be recorded on the
  sync, shown on the board and countable, and the remaining lines MUST still be stored.
- **FR-KAN-004**: The parse MUST NOT invent, complete or correct a task: no identifier is generated,
  no description is rewritten, no status is inferred from position, section, ordering or prose.
- **FR-KAN-005**: The parse MUST record, per task, the **identifier**, the **description**, the
  **parallel marker**, the **checkbox state**, the **source line number**, and — where the
  description names one or more repository paths (`DS-1`) — those paths, so that a task can be read
  against what it changes.
- **FR-KAN-006**: The parse MUST record, per sync, the counts it saw: task lines parsed, task lines
  refused, duplicate identifiers, and the total lines considered; these counts MUST be shown wherever
  the parse is shown.
- **FR-KAN-007**: A duplicate identifier within one file MUST keep the first occurrence and report
  the second with both line numbers; the sync MUST NOT fail on account of it.
- **FR-KAN-008**: The grammar MUST be proved against a **fixture corpus in the repository** of
  accepted and rejected lines — including headings, prose, tables, nested bullets, cross-references
  inside descriptions, unusual spacing and both checkbox cases — and the corpus MUST be the
  specification's worked examples, not an afterthought of the tests.
- **FR-KAN-009**: The parse MUST be a pure function of the markdown and the configuration: given the
  same file and configuration it MUST produce the same result, with no reference to stored state.

**Manual movement is a proposal, never a file edit**

- **FR-KAN-010**: A manual move **MUST NEVER write `tasks.md`**, any artifact version, or any file in
  the project directory. No route, tool or screen delivered by this Epic may edit a file, and the
  absence MUST be asserted rather than assumed.
- **FR-KAN-011**: Moving a card MUST create a **status-transition proposal** carrying who moved it,
  when, the from-status, the to-status and a **required reason**; a move without a reason MUST be
  refused before a proposal exists.
- **FR-KAN-012**: Each proposal MUST append a `status-transition-proposed` event to the Epic's
  execution record, recording the request only and never a verdict, in the vocabulary `EPIC-037`
  already defines.
- **FR-KAN-013**: A proposal MUST be **adjudicated** through the existing adjudication contract. For
  this Epic, *contract* means the adjudication **rules and verdict vocabulary** `EPIC-030` publishes
  — the verdict set, separation of duties, immutable evidence, optimistic concurrency — and not its
  specification-typed proposal interface, which cannot express a task target; widening that interface
  to a generic target is recorded as `EPIC-030`'s follow-up (`R-046-5`). For
  a project member holding the move permission the verdict MUST be **immediate** and the move MUST
  apply, so that a person recording what they are doing is not made to wait for a colleague; where
  the project's policy requires an approver, the card MUST wait for one. An **agent principal MUST
  NOT approve its own proposal** and MUST NOT apply a task status by any other route (Constitution
  XII.6). Every verdict — immediate or not — MUST be recorded as evidence and MUST NOT be editable.
- **FR-KAN-014**: Where a verdict is not immediate, the board MUST show a task's **proposed** state
  distinctly from its applied state: a card awaiting approval states the requested status, the
  requester, the reason and the time, and stays in its current column until a verdict applies the
  move. A card whose verdict was immediate MUST show the applied status with the proposal that
  produced it.
- **FR-KAN-015**: A refused proposal, a proposal awaiting approval and an inconsistent proposal MUST
  each leave the card where it was and state the verdict and its stage on the card; the proposal MUST
  remain readable afterwards.
- **FR-KAN-016**: Two proposals for the same task MUST both be recorded; at most one MUST be applied,
  and the other's verdict MUST state that the task had already moved.
- **FR-KAN-017**: Proposal gating MUST apply to **synced tasks** — those carrying a source line and a
  source digest. A task with no file behind it MUST keep the direct status update the product already
  offers, and the two paths MUST be distinguishable on the surface and in the audit record.
- **FR-KAN-018**: Every surface that can move a card MUST state, in words, that the project directory
  is authoritative for what is done and that a move here is a proposal about the record, not an edit
  of the file.

**Reconciliation when the file and the board disagree**

- **FR-KAN-020**: The board MUST **reconcile** on every sync and MUST **surface a conflict rather than
  resolve it silently**: where the file's checkbox and the board's status disagree, both MUST be
  shown, with the digest and time of each side, and the rule that decided the outcome MUST be named
  on the surface.
- **FR-KAN-021**: The reconciliation rule MUST be: the file wins for the two states it can express.
  A line checked in the latest parse MUST make the task **Done**; a line unchecked MUST make a task
  that was Done **Not started**, and MUST leave a task whose *In progress* or *Blocked* status came
  from an applied proposal where it is, marked **ahead of the file**.
- **FR-KAN-022**: Where the file supersedes an applied proposal, the task MUST state that a manual
  status was superseded, naming the proposal, the verdict and the superseding digest; **no proposal
  record MUST be deleted or amended**.
- **FR-KAN-023**: A `tasks.md` whose digest differs from the digest of the last sync while no governed
  command ran between them MUST be recorded as an **out-of-band edit** on the sync, and the board MUST
  say so; the content MUST still be accepted, because the file is authoritative (`R-05`).
- **FR-KAN-024**: The board MUST list, for the Epic, the open disagreements: tasks ahead of the file,
  tasks not in the latest parse, unmatched progress reports, and refused lines — each with the
  execution and digest it relates to.
- **FR-KAN-025**: A task present in an earlier parse and absent from the latest MUST be kept, marked
  **not in the latest parse**, with the digest and execution of the parse that last contained it;
  nothing parsed is ever deleted.
- **FR-KAN-026**: Reconciliation MUST be **idempotent**: re-running a sync of the same digest MUST
  produce no change and an empty diff, and MUST still be recorded as an observation of that file.
- **FR-KAN-027**: No reconciliation outcome may be produced by a background process without a
  record: every status change MUST name its cause — a parse, a progress event, a completion or an
  applied proposal.

**The sync**

- **FR-KAN-030**: `pmi.tasks.sync` MUST accept the Epic's `tasks.md` as text with the execution it
  belongs to, parse it under `FR-KAN-001`, and create or update **task rows** bound to that
  execution and, through the execution's binding, to its **Epic**; the tool MUST NOT accept an Epic
  directly and the Epic MUST NOT be inferred from a path. A synced task's home is its **Epic**: the
  link from a task to a specification MUST be **optional**, so a sync MUST NOT be refused, deferred
  or satisfied with a placeholder because the Epic's `spec.md` has not synced; where the Epic has a
  specification the task MUST also name it, and a specification arriving later MUST attach to the
  Epic's existing tasks without creating new rows.
- **FR-KAN-031**: A task's **identity** MUST be its identifier within its Epic. A re-sync MUST update
  the existing row for an identifier rather than creating a second one, preserving the row's history,
  its status and its proposals (`DS-2`).
- **FR-KAN-032**: A sync for an execution bound to no Epic MUST store its tasks under the project as
  **unbound**, listed with the board's unbound group, and MUST NOT attach them to an Epic by
  inference (`FR-EPB-008`).
- **FR-KAN-033**: A sync naming an unknown execution, an execution of another project, or an
  execution whose command is neither `tasks` nor `implement` MUST be refused by name with a coded
  reason.
- **FR-KAN-034**: Every sync MUST produce a **task sync record** — the execution, who synced, when,
  the idempotency key, the **digest of the `tasks.md` it parsed**, the counts of `FR-KAN-006` and the
  diff — so that *what a given execution saw* is answerable even when nothing changed.
- **FR-KAN-035**: Every **synced** task row MUST carry the **source line** and the **source digest**
  it was last parsed from, so a card can be traced to a line of a specific version of the file. An
  engine-generated task has neither, and that absence is what `FR-KAN-017` distinguishes it by.
- **FR-KAN-036**: The digest a sync records MUST be the digest of the same bytes the artifact sync
  stored for `tasks.md` in that execution where both ran, so the board and the viewer cannot disagree
  about which version of the file is in view; a mismatch MUST be reported as a finding, never
  repaired.
- **FR-KAN-037**: A sync MUST **return the diff**: tasks added, tasks whose description changed, tasks
  whose checkbox changed, tasks unchanged, tasks no longer present, and the refused lines with their
  reasons — in a shape a client can print without interpreting prose.
- **FR-KAN-038**: A sync MUST be **idempotent under retry and under concurrency**: the same request
  twice, or two syncs of the same file at the same moment, MUST leave one row per identifier and MUST
  both succeed; an idempotency key MUST be accepted and recorded on the sync record.
- **FR-KAN-039**: A sync MUST refuse, with a coded reason, a `tasks.md` above the size limit, a file
  whose task-line count exceeds the limit, content that is not UTF-8 text, and a line whose
  description contains credential-shaped text; the limits MUST be configuration with stated defaults
  (1 MiB per file, 1000 task lines per sync).

**Automatic movement from execution events**

- **FR-KAN-040**: A `progress-reported` event carrying a task identifier for an execution bound to an
  Epic MUST move that Epic's task to **Done**, attributed to that event, that execution and its time.
  This is the meaning `speckit.pmi.progress` already gives the event: one event per task newly
  checked.
- **FR-KAN-041**: No status other than Done MUST be inferred from an execution event. *In progress*
  and *Blocked* MUST arise only from an applied proposal; the platform MUST NOT guess which task an
  agent is working on.
- **FR-KAN-042**: A `progress-reported` event naming an identifier with no task row MUST be retained
  as an **unmatched progress report**, matched if that identifier is later parsed, and MUST NOT create
  a task.
- **FR-KAN-043**: Repeated `progress-reported` events for one task MUST be idempotent: the card is
  Done once and the later events change nothing.
- **FR-KAN-044**: An execution's completion MUST be shown against the Epic's board with its outcome
  and, for `implement`, the count of tasks still unchecked in the file it synced.
- **FR-KAN-045**: A terminal outcome MUST NOT itself move a card. `completed`, `partially-completed`,
  `failed`, `cancelled`, `timed-out` and `blocked` are facts about the run; the file and the events
  are the facts about the tasks.
- **FR-KAN-046**: The board MUST state that movement is **observed on sync and on event, not pushed
  live**, while the toolkit offers no in-flight hook (`R-07`), and MUST reflect the current state on
  its next load without requiring a control beyond reloading.
- **FR-KAN-047**: Automatic movement MUST be replay-safe: reprocessing an execution's event history
  MUST produce the same board state.
- **FR-KAN-048**: A governed command recorded **provisionally** — PMI Studio unreachable, the run
  kept in the project directory under `EPIC-042`'s offline policy — MUST sync no tasks and MUST NOT
  cause a partial or guessed board. The board MUST state when its latest parse is **older than the
  Epic's latest execution**, naming both times, so a stale board is never mistaken for a current
  one; the next governed command's sync MUST bring it level. Replay of a provisional run's task sync
  is `EPIC-037`'s provisional intake and is not delivered here.

**The board and progress**

- **FR-KAN-050**: The **Task Kanban** MUST show an Epic's tasks as cards in columns and MUST live in
  the **Plan & Tasks** area, reachable from the Epic and from the Spec Journey Board's card.
- **FR-KAN-051**: The columns MUST be **Not started**, **In progress**, **Done** and **Blocked**, in
  that order; the column set MUST be configuration, and every task MUST be in exactly one column.
- **FR-KAN-052**: The board MUST show, above the columns, what it is a view of: the Epic, the
  execution and digest of the latest parse, its time, and the counts of `FR-KAN-006` — plus the open
  disagreements of `FR-KAN-024` as a stated, countable list.
- **FR-KAN-053**: The board MUST be **filterable** — at least by status, by parallel marker, by
  whether the task is ahead of the file or not in the latest parse, and by free text over identifier
  and description (PMI-DOC-005: every table gets a filter).
- **FR-KAN-054**: Each card MUST show the identifier, the description, the parallel marker, the
  source line, the status, and **what last moved it** — a parse, a progress event, a completion or an
  applied proposal — with the time and the actor.
- **FR-KAN-055**: The board MUST show the Epic's **progress**: total, done, in progress, not started,
  blocked, and a whole-number percentage.
- **FR-KAN-056**: Progress MUST be **derived** from the task rows on read, never stored as a
  declared figure, and every surface that shows an Epic's or a project's progress MUST show the same
  value from the same derivation.
- **FR-KAN-057**: **Project progress** MUST aggregate the same rows across the project's Epics and
  MUST include tasks with no Epic; an empty project MUST read 0%, never absent and never a non-number.
- **FR-KAN-058**: Tasks marked *not in the latest parse* MUST be excluded from progress denominators,
  and the exclusion MUST be stated where progress is shown.
- **FR-KAN-059**: The board MUST state its four states — loading, empty, error, partial
  (`FR-SHL-060`); an empty board MUST name the command that produces the first task; a failure MUST
  leave the Epic's other surfaces standing.

**The contract**

- **FR-KAN-060**: `pmi.tasks.sync` MUST become **live** in the `pmi-studio` tool surface with the
  argument shape `EPIC-043` already validates, MUST leave the tool count unchanged (one tool moves
  from reserved to live), and MUST be reachable by a connector credential holding the task-sync
  scope.
- **FR-KAN-061**: The finish hook MUST NOT be edited by this Epic. The tool MUST accept exactly what
  `speckit.pmi.finish` already sends, and the hook's behaviour before and after this Epic MUST differ
  only in that the refusal becomes a result.
- **FR-KAN-062**: `POST /v1/projects/{id}/tasks/sync` MUST be the REST binding of the same operation,
  behind the connector guard, with the same refusals and the same diff.
- **FR-KAN-063**: The board, the progress figures and the proposal path MUST be served by routes the
  screens read; the board's reads MUST be **session** reads for project members.
- **FR-KAN-064**: A client calling the tool before this Epic's deployment MUST continue to receive
  the reserved refusal, and after it MUST receive a result; no other refusal code changes meaning
  (`FR-EXT-016`).
- **FR-KAN-065**: The reserved-tool list, the tool-surface contract document and the connector scope
  list MUST be updated in the same change that makes the tool live, so no document claims a tool is
  reserved when it is not.
- **FR-KAN-066**: The tool MUST refuse with the existing vocabulary — `invalid_connector_credential`,
  `scope_required`, `unsupported_contract_version`, `credential_in_argument` and the registry's own
  codes — and MUST add no refusal code a client cannot already handle beyond those this Epic names in
  its contract.

**Security, tenancy and audit**

- **FR-KAN-070**: A sync MUST be scoped to the credential's project and MUST refuse a task sync for
  another project **as absence**, disclosing nothing about it.
- **FR-KAN-071**: A connector credential MUST be able to **write** tasks through the sync and MUST
  NOT be able to adjudicate a proposal, apply a status, or read another project's board.
- **FR-KAN-072**: Every sync, every applied status change and every proposal verdict MUST be audited
  with the actor, the execution, the digest and the counts, and the audit record MUST be immutable.
- **FR-KAN-073**: Credential-shaped text in a task description MUST be refused at intake with a coded
  reason naming the shape, MUST NOT be stored, and MUST be visible on the execution (`R-04`,
  `FR-EXR-022`).
- **FR-KAN-074**: Task rows, sync records, proposals and progress MUST be workspace-scoped, and a
  cross-workspace read or write MUST be refused as absence.
- **FR-KAN-075**: Nothing in this Epic MUST be reachable without authentication, and every surface
  MUST respect the project's existing role and policy checks (`BR-0003`).

### Key Entities *(include if feature involves data)*

- **Task row**: a task parsed from an Epic's `tasks.md` — identifier, description, parallel marker,
  status, source line, source digest, the Epic it belongs to (or unbound), the Epic's specification
  where one exists (optional), the execution that last parsed it, and whether it is present in the
  latest parse.
- **Task identifier**: the identity of a task within its Epic, taken from the file and never
  generated; invariant across syncs, so history and proposals survive a re-parse (`DS-2`).
- **Task sync record**: one sync — the execution, the credential, the time, the idempotency key, the
  `tasks.md` digest parsed, the counts, the diff, and every refused line with its reason.
- **Task sync diff**: added, description-changed, checkbox-changed, unchanged, no-longer-present, and
  refused — the shape the tool returns and the board lists.
- **Refused line**: a task-shaped line the grammar rejected — line number, text, coded reason;
  countable and visible, never silently absent.
- **Task status proposal**: a requested move — who, when, from, to, the required reason, the
  `status-transition-proposed` event it raised, the verdict recorded against it, and whether that
  verdict was immediate or waited for an approver the project's policy required.
- **Board column**: a status a card can occupy — Not started, In progress, Done, Blocked;
  configuration.
- **Progress**: a projection over task rows for an Epic or a project — total, done, in progress, not
  started, blocked, percentage; never stored.
- **Disagreement finding**: a projection on read — a task ahead of the file, a task not in the latest
  parse, an unmatched progress report, an out-of-band edit, or a digest mismatch against the artifact
  version of the same `tasks.md`.
- **Grammar fixture corpus**: the repository's set of accepted and rejected task lines that is the
  worked specification of `FR-KAN-001`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-KAN-001**: After `/speckit-tasks` completes with the finish hook, **100%** of the task lines
  of the Epic's `tasks.md` appear as cards on the next load of the board, and **100%** of the lines
  the grammar rejected appear in the refused list — the two counts summing to every task-list item
  in the file, with **zero** lines unaccounted for.
- **SC-KAN-002**: Against the grammar fixture corpus, the parser's verdict matches the corpus in
  **100%** of cases; the corpus is mutation-tested — loosening the identifier pattern or accepting an
  arbitrary checkbox form is observed to fail the tests.
- **SC-KAN-003**: **Milestone M4**: on the reference-local stack, a person watching the board during a
  `/speckit-implement` run that ticks five tasks sees all five cards reach *Done* and the percentage
  rise, with **zero** manual moves, recorded as a transcript.
- **SC-KAN-004**: **Zero** writes to `tasks.md` or to any file in the project directory are made by
  any route, tool or screen of this Epic — asserted by byte-comparison of the Epic's directory before
  and after a full board session including a proposal, and mutation-tested by introducing a write and
  observing the test fail.
- **SC-KAN-005**: **100%** of manual moves produce a proposal with a reason, an event and a recorded
  verdict; **zero** manual moves change a status without a recorded verdict; **zero** proposals
  raised by an agent principal are approved by that principal; and in a project whose policy requires
  an approver, **100%** of moves wait for one.
- **SC-KAN-006**: **Zero** duplicate task rows: syncing the same file twice, or two syncs at the same
  moment, yields exactly one row per identifier per Epic and both syncs succeed — mutation-tested by
  removing the identifier-keyed uniqueness and observing the tests fail.
- **SC-KAN-007**: For an Epic of 100 tasks with 20 syncs, the board lists in under **2 seconds** and
  progress is derived in under **1 second** on the reference-local stack; a 1 MiB `tasks.md` parses in
  under **2 seconds**.
- **SC-KAN-008**: In **100%** of cases where the file and the board disagree, the disagreement is
  listed with both sides and both digests; **zero** disagreements are resolved without the surface
  naming the rule that resolved them.
- **SC-KAN-009**: The Epic's percentage and the project's percentage read the same value on **100%**
  of the surfaces that show them, and an Epic or project with no tasks reads **0%** rather than an
  empty or non-numeric value.

## Assumptions

Nine judgement calls, each with the alternative that lost. **Three were put to the requester on
2026-09-06 and all three confirmed** (Assumptions 3, 5 and 6); the other six stand as recorded. The
reasoning is kept because it describes the risk each confirmation accepts. Two further decisions
taken in the same round — that a permitted member's own move applies immediately, and that a
provisional run syncs no tasks — are recorded under **Clarifications** and land in `FR-KAN-013` and
`FR-KAN-048`. None is put as a `[NEEDS CLARIFICATION]` marker: each has a defensible default.

1. **A task's identity is its `T###` within its Epic, not its line and not a row id**
   (`FR-KAN-031`). `DS-2` says identifiers are globally unique and invariant, never reused and never
   renumbered, precisely so that citations survive; identity by line breaks on the first reorder and
   identity by text breaks on the first typo fix. The alternative — identity by (line, text) — makes
   every edit look like a delete and an add, and loses every proposal attached to the row. The risk
   accepted: a customer project that renumbers its tasks will see rows disappear and reappear, which
   the diff makes visible rather than hiding.
2. **The Epic is resolved from the execution's binding, never from the path or an argument**
   (`FR-KAN-030`, `FR-KAN-032`). This is `EPIC-044`'s decision and `EPIC-045`'s rule, restated so the
   two syncs cannot disagree about which Epic a directory belongs to. The alternative — parse
   `specs/046-…` into Epic 46 — breaks the moment a directory is hand-made or a slug changes.
3. **A fourth status, `Blocked`, is added, and neither it nor `In progress` can ever come from the
   file** — **confirmed** (`FR-KAN-041`, `FR-KAN-051`). PMI-DOC-007 §6 names the column; the grammar has two
   checkbox states and no third, so the only honest source for the other two is an adjudicated
   proposal. The alternative — infer *in progress* from the position of the last reported task —
   invents a fact the file does not contain, which is exactly what this Epic exists to stop. The
   consequence accepted: during an `implement` run cards jump from *Not started* to *Done*, and the
   board says so.
4. **The file wins for the two states it can express; a proposal-set status survives only while the
   file is silent** (`FR-KAN-021`). PMI-DOC-007 §2.3 makes the checkboxes *as observed* authoritative
   for task status and the PMI row a mirror. The alternative — the most recent write wins, whichever
   side it came from — makes the board authoritative for a field the source-of-truth table says it
   mirrors, and would let a click override a developer's own file.
5. **Proposal gating applies to synced tasks; a task with no file behind it keeps the direct status
   update the product already offers** — **confirmed** (`FR-KAN-017`). `D-5` gates *Kanban manual moves*, and the
   reason a move must be a proposal is that a file elsewhere is authoritative. An engine-generated
   task has no such file, and gating it would break `EPIC-012`'s flow to protect nothing. The
   alternative — gate every task everywhere — is simpler to describe and stops a working path for
   no gain; it stays available as a configuration change if the requester prefers uniformity.
6. **A synced task's home is its Epic, and its link to a specification is optional** —
   **confirmed** (`FR-KAN-030`). This keeps one task entity rather than two and reuses the progress
   aggregation and the Rooms; where the Epic has a specification-by-sync (`EPIC-045` `FR-ART-030`)
   the task names it, and a specification arriving later attaches to the rows that already exist.
   The alternatives — a placeholder specification created on the first task sync, or refusing the
   sync until `spec.md` has synced — invent an entity nobody asked for, or make an adopted
   directory unusable. A second, parallel task entity for synced tasks was rejected for the same
   reason: it duplicates every consumer and gives the product two meanings of *task*. The risk
   accepted: the existing task entity's required link to a specification is widened, so every
   consumer that reads it must tolerate its absence.
7. **The parse reads the markdown the tool delivered, and records its digest; it does not read the
   stored artifact version** (`FR-KAN-030`, `FR-KAN-036`). The two syncs are independent calls in one
   hook sequence, and coupling this Epic's write path to `EPIC-045`'s store would make either failing
   break both. The alternative — parse the stored version — is tidier and creates a dependency the
   hook's ordering does not guarantee. The digest cross-check (`FR-KAN-036`) gives the coupling's
   benefit without the dependency.
8. **A whole `tasks.md` is refused as a whole when the file breaks a limit, unlike the artifact set
   where files are refused one by one** (`FR-KAN-039`). A half-parsed task list is a board that lies
   about a denominator; a half-synced artifact set is nine readable files and one refused. The
   alternative — parse what fits — produces a percentage nobody can trust.
9. **Connector credentials sync tasks but do not read the board** (`FR-KAN-071`). The agent holds the
   file; a read scope would widen the credential for no consumer, exactly as `EPIC-045` decided for
   artifacts. The alternative — a connector read of the board for diffing — is unnecessary while the
   tool returns the diff, and is the follow-up if a hook ever needs it.

**Provisional identifier**: `LR-10` (PMI-DOC-007 §9.3) receives a `BR-` number only in PMI-DOC-004
v2.1; the back-fill is owed by the Project Owner before the platform release gate.

**Dependencies**: `EPIC-044` complete (Epics, Epic resolution from an execution's binding, the
board's unbound group, the Spec Journey Board the Kanban is reached from); `EPIC-045` complete
(`tasks.md` synced as an artifact version whose digest this Epic cross-checks, the Epic's
specification-by-sync, the Epic detail the board sits beside); `EPIC-043` complete (the `pmi-studio`
server, the reserved tool's schema, the connector guard, scopes and refusal vocabulary); `EPIC-042`
complete (`speckit.pmi.finish` calls `pmi.tasks.sync` after `tasks` and `implement`;
`speckit.pmi.progress` appends the progress events); `EPIC-041` complete (`PrismaTaskStore` wired,
`T1325`); `EPIC-037`'s execution records, events and status-proposal path; `EPIC-030`'s adjudication
contract; `EPIC-012`'s task entity and project progress.

**Out of scope**: editing `tasks.md` or any file from PMI Studio, in any form; generating or
regenerating tasks (`EPIC-012`); dependency ordering, scheduling, estimation or assignment of tasks;
cycle-time, throughput or DORA metrics over the rows (`EPIC-040`, held); retrieval or search over
tasks (`EPIC-038`, held); a live push transport — the board reflects state on load while `R-07`
stands; an in-flight hook for `/speckit-implement`, which is the toolkit's to offer; **replaying the
task sync of a run recorded provisionally**, which waits for `EPIC-037`'s provisional intake
(`FR-KAN-048`); changing the hooks, the extension or the execution tools beyond making the reserved
tool live; the managed-sandbox execution path.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs,
      a passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/046-task-kanban-governed-status/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next
      task named as a concrete Spec Kit command (Constitution IX)
