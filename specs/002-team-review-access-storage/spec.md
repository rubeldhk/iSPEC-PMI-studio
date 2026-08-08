# Feature Specification: Unattended Runs with Team Review, Artifact Access Control & External Storage Integration

**Feature Branch**: `002-team-review-access-storage`

**Epic**: `EPIC-002` — Team Review, Access Control & External Storage

**Created**: 2026-08-02

**Status**: Clarified — 5 questions answered in the 2026-08-02 session; zero `[NEEDS CLARIFICATION]` markers remain. Tasked 2026-08-05. **Not yet planned** — no `plan.md`

**Input**: User description: "1. executing command should have option to set run all and keep
qustions and suggesions recordet all togather for the team to disscus and select ans and submit.
2. set access of project management file 3.manage project management files integration with file
manager third pary solution like google drive, dropbox, s3 etc"

> ## ⚠️ This is a parent design, not a delivery epic
>
> **Split 2026-08-07 by ruling D-19.** The three capability areas specified here are delivered by
> three child epics, one per module. This document — with [plan.md](./plan.md),
> [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/) and
> [quickstart.md](./quickstart.md) — is the **shared design** they reference, the same pattern
> `_shared/` serves for the platform and EPIC-017 serves for EPIC-019–022.
>
> | Child epic | Module | Requirements owned | Tasks |
> |---|---|---|---|
> | [EPIC-023 Unattended Runs & Team Review](../023-unattended-runs-review/) | M-06 Workflow | FR-001–FR-020, FR-005a–c, FR-015a | 43 |
> | [EPIC-024 Artifact Access Control](../024-artifact-access-control/) | M-13 Security & Governance | FR-021–FR-028 | 21 |
> | [EPIC-025 External Storage Publishing](../025-external-storage-publishing/) | M-11 DevOps | FR-029–FR-040 | 32 |
>
> **Why split**: this epic spanned **three modules**, and MPS Volume 6 §1 places epics *below*
> modules. An epic covering three inverts the hierarchy — the same defect D-15 corrected when
> EPIC-001 spanned ten. Recorded as gap **G-02.6** in [plan.md](./plan.md).
>
> **EPIC-002 itself now has no `tasks.md` and no closure of its own.** It is closed when all three
> children are. Requirements, clarifications, SRS traceability and the principle register are defined
> **once** here; each child declares what it owns.
>
> All 87 task IDs were preserved unchanged; 9 closure tasks were added so each child can converge
> independently (Constitution IV).
**Depends on**: `EPIC-001` — PMI Studio Phase 1 Platform Core. This Epic extends the projects,
requirements, specifications, tasks, and generation jobs that EPIC-001 establishes.

## Depends on

- EPIC-001 — platform foundation: job orchestration, failure taxonomy, observability
- EPIC-004 — tenancy and audit, which the per-artifact access grants extend
- EPIC-008 — generation, which unattended runs drive
- EPIC-009 — the specification lifecycle that provisional approval overrides

## Clarifications

### Session 2026-08-02

- Q: When someone chooses "run all", should the platform carry the work through the entire chain in
  one unattended pass, or batch questions within a single step only? → A: **C — User picks the
  range.** The person starting the run chooses where it stops (for example, after specification, or
  carrying on through tasks). The run then proceeds unattended to that stop point.
- Q: Should edits made to published files at the external provider flow back into the platform, or
  is publishing a one-way copy out? → A: **A — One-way publish.** Files are copied out for reading
  and sharing only. External edits never return, and the platform remains the authoritative source.
  Confirmed as a permanent boundary, not a staged simplification.
- Q: The SRS roadmap places governance in Phase 3, but this request asks for artifact access control
  now — how much should this Epic deliver? → A: **B — Per-user grants only.** Read/edit access
  granted directly to named users on individual artifacts. Roles, groups, inherited organisational
  permissions, and SSO remain Phase 3. The roadmap is not amended; this is a deliberate, bounded
  advance of the minimum needed to make shared review sessions safe.
- Q: Can a specification still marked provisional be approved, and can tasks be generated from it?
  → A: **B — Warn and require explicit override.** Approval is permitted, but the approver is shown
  every provisional item and must explicitly accept them, and the override is recorded against the
  approval. Task generation then follows EPIC-001's normal approval gate.
- Q: Who may submit a review session once the team has agreed the answers? → A: **B — Project owner
  or the person who started the run.** Answering and noting stay open to everyone with access;
  committing the batch is limited to those two roles.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Core Principles — "Specification First, AI Second" | FR-001, FR-004 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Core Principles — "Every artifact is versioned and traceable" | FR-020, FR-026, FR-034 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Workflow Engine | FR-001, FR-002, FR-006, FR-008 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Security & Governance | FR-021, FR-022, FR-023, FR-025, FR-026 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Administration | FR-021, FR-022, FR-029, FR-038 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules — Git Integration (nearest existing external-system integration) | FR-029, FR-032, FR-034 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | High-Level Architecture — Engine Adapters; adapter layer pattern | FR-030, FR-038, FR-039 |
| `SRS/PMI_Studio_Enterprise_Master_Blueprint.docx` | Roadmap — Phase 2 "Workflow orchestration"; Phase 3 "Governance, Enterprise administration" | Scope boundary (see Clarifications) |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 11 Security — RBAC.md, Authorization.md, Audit_Log.md, Data_Privacy.md | FR-021 to FR-028 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 03 Architecture — Plugin_Architecture.md, Adapter_Architecture.md | FR-030, FR-039 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 06 Specification Engine — Specification_Lifecycle.md, Constraint_Resolution.md | FR-005, FR-017, FR-019 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 12 DevOps — Infrastructure.md, Disaster_Recovery.md | FR-031, FR-037 |
| `SRS/PMI_Studio_Reference_Documents_for_SpecKit.docx` | 13 Product Management — Sprint_Guide.md (team collaboration cadence) | FR-007, FR-009, FR-010 |
| `SRS/raw study.docx` | "Spec Kit becomes the first implementation, not the core dependency" — adapter pattern applied to external systems | FR-030, FR-038, FR-039 |
| `SRS/raw study.docx` | "Parallel development by multiple AI agents" | FR-001, FR-003 |
| `SRS/PMI_Studio_Module_Based_Requirements_and_Epics.docx` | Security & Governance → *RBAC/ABAC* | FR-021 to FR-028 |
| `SRS/PMI-DOC-002_Product_Charter.docx` | Governance — Change Control Process; Architecture Review Board | FR-009 to FR-020 (team review as a change-control surface) |
| `SRS/PMI-DOC-000_Product_Documentation_and_Specification_Standard_v1.0.docx` | §3 Requirement Identifiers; §5 Traceability Rules | ⚠️ **This spec does not yet conform** — see [srs-alignment.md](../srs-alignment.md) C-01 to C-03 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | **PP-003 Human-in-the-Loop** — "Critical decisions require human approval before implementation" | FR-005a to FR-005c, FR-015a |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | Architecture Implications — "Treat AI agents as governed services, not autonomous authorities" | FR-004, FR-005 (provisional marking of every unattended-run artifact) |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-008 Security by Design | FR-021 to FR-028 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-015 Open Standards / no vendor lock-in | FR-030, FR-038, FR-039 (interchangeable storage providers) |

**Requirements not yet covered by SRS**: Two whole capability areas in this Epic have no SRS
source and are drawn from the feature request alone:

1. **Unattended runs with batched team review** (FR-001 to FR-020). The SRS names a Workflow Engine
   module but never describes an unattended execution mode, provisional answers, or a deferred,
   team-resolved question queue.
2. **Third-party file storage integration** (FR-029 to FR-040). The SRS names Git Integration and
   an Infrastructure layer, but no cloud file-storage provider integration (Google Drive, Dropbox,
   S3) appears in any of the 24 modules or 20 volumes.

**Re-verified 2026-08-02** against the five new SRS documents. The Module-Based catalog (16 modules,
~82 epics) and the Enterprise Product Backlog (12 groups, ~67 epics) contain **neither** capability.
The back-fill obligation stands and is now better evidenced, not resolved.

Access control (FR-021 to FR-028) *is* SRS-backed — Security & Governance is module #22 and
Volume 10 — but the SRS roadmap places it in Phase 3, not here. That is a sequencing conflict, not
a coverage gap. Resolved by clarification: a bounded advance of per-user grants only, with roles,
groups, inheritance, and SSO left in Phase 3 and the roadmap unamended.

Back-fill owner: project owner. These require new SRS entries — suggested homes are a
`Workflow_Engine.md` under 06 Specification Engine, and a `Storage_Integration.md` under 12 DevOps
— before this Epic is approved, per Constitution Principle II.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

Principles bind the programme, not each Epic individually. This Epic's position on all twenty.
**A deferral is a debt reviewed at the convergence gate, not permission to skip.**

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | ✅ Satisfied | Constitution I |
| PP-002 | Single Source of Truth | ✅ Satisfied | Constitution II. **Two capability areas have no SRS source** — declared above with back-fill owner |
| PP-003 | Human-in-the-Loop | ✅✅ **Central** | The Epic's organising principle. Unattended runs never decide — they record a question, apply a marked *provisional* answer, and require a human batch decision (FR-009–FR-020). Approval of provisional work needs an explicit, attributed override (FR-005a–c); submission is restricted (FR-015a) |
| PP-004 | End-to-End Traceability | ⚠️ Partial | Answers attributable to person and time (FR-012, FR-020); publish records retained (FR-034). Code/test/release links pending D-2 |
| PP-005 | Modular Architecture | ✅ Satisfied | Storage providers behind one integration boundary (FR-030) |
| PP-006 | Engine Independence | ✅ Satisfied | Inherits EPIC-001's contract; adds no engine coupling |
| PP-007 | API & MCP First | 🔶 **Deferred** | → catalog module M-09 (Phase 3), consistent with EPIC-001. Owner: tech lead |
| PP-008 | Security by Design | ✅ Satisfied | Per-artifact access grants (FR-021–FR-028); derived artifacts inherit restriction (FR-025); refusals audited (FR-023, FR-026) |
| PP-009 | Quality by Design | ✅ Satisfied | Constitution V; acceptance scenarios on all 7 stories; 14 measurable criteria |
| PP-010 | Observability by Default | ⚠️ Partial | Access and publish auditing specified (FR-026, FR-034). Logging/metrics/tracing inherit EPIC-001's position — decision D-7 |
| PP-011 | Documentation as Code | ⚠️ Partial | Specs are Markdown in git; `SRS/` is `.docx` — decision D-5 |
| PP-012 | Everything Versioned | ✅ Satisfied | Review sessions retained permanently (FR-020); published artifact versions recorded |
| PP-013 | Knowledge-Driven Engineering | 🔶 **Deferred** | → M-10 Knowledge Platform (Phase 2). Owner: product owner |
| PP-014 | Configuration over Customization | ✅ Satisfied | Provider connections are configuration, not per-tenant code |
| PP-015 | Open Standards | ✅✅ Satisfied | FR-030 and FR-038 require provider interchangeability and loss-free switching — no storage vendor lock-in |
| PP-016 | Explainable AI | ✅✅ **Central** | Every deferred question records the options considered and the suggested answer with its context (FR-003, FR-007), so an AI suggestion is reviewable before it becomes a decision |
| PP-017 | Cost-Aware AI | 🔶 **Deferred** | → M-07 AI Platform. Unattended runs *increase* AI spend, so RAID **R-02** applies with more force here than in EPIC-001. Owner: tech lead |
| PP-018 | Scalability First | ⚠️ Partial | Workspace-scoped throughout; concurrent publish prevented (FR-040). Review sessions at scale untested |
| PP-019 | Continuous Improvement (DORA/SPACE) | 🔶 **Deferred** | → M-14 Reporting. Owner: product owner |
| PP-020 | Customer Value | ✅ Satisfied | 14 measurable criteria, including a 20-question review inside 60 minutes (SC-003) |

**Deferral count**: 4 (PP-007, PP-013, PP-017, PP-019) — each with an owner and a discharging module.

**Note**: this Epic is the strongest expression of **PP-003 Human-in-the-Loop** and **PP-016
Explainable AI** in the programme so far. Both were designed in before PMI-DOC-003 existed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start an unattended run that does not stop to ask questions (Priority: P1)

A project lead starts a run over a body of work and chooses "run all". The platform proceeds
through the whole chain without pausing. Whenever it would normally stop to ask something, it
records the question — along with its own suggested answer and the options it considered — and
keeps going with a clearly marked provisional answer. The lead walks away and comes back to a
finished run plus a list of everything that needs deciding.

**Why this priority**: This is the core of the request. Today a run halts at the first question and
waits for one person; a team that meets twice a week loses days to that. Running to completion and
banking the questions converts a stop-start process into one pass plus one review.

**Independent Test**: Start a run over work known to raise several questions, walk away, and
confirm it completes without pausing and that every question it would have asked is recorded with
its suggested answer.

**Acceptance Scenarios**:

1. **Given** work that would raise questions, **When** the lead starts a run in "run all" mode and
   selects how far it should go, **Then** the run proceeds to that stop point without pausing for
   input.
2. **Given** a run in "run all" mode encounters a decision point, **When** it proceeds, **Then** the
   question, the options considered, and the platform's suggested answer are all recorded.
3. **Given** a run proceeded on a provisional answer, **When** the results are viewed, **Then**
   every artifact derived from a provisional answer is marked as provisional.
4. **Given** the same work, **When** the lead starts a run in normal mode instead, **Then** the run
   pauses and asks each question as it arises, as it does today.
5. **Given** a run in "run all" mode, **When** it hits a problem it cannot proceed past at all,
   **Then** it stops, records why, and preserves everything completed up to that point.
6. **Given** a run set to stop after specification, **When** it reaches that point, **Then** it
   reports reaching the selected stop point rather than failing, and can be continued through task
   generation later.
7. **Given** a specification carrying provisional markings, **When** a user attempts to approve it,
   **Then** every provisional item and its governing question is shown and must be explicitly
   accepted before approval proceeds.
8. **Given** a provisional specification was approved by override, **When** the approval is viewed
   later, **Then** it names who accepted the provisional items, which items, and when.

---

### User Story 2 - Review all questions together as a team and submit answers in one go (Priority: P1)

The team opens the run's review list in their weekly session. Every question sits in one place with
its context, the options, and the platform's suggestion. They discuss, pick answers — sometimes the
suggestion, sometimes their own — leave notes on the ones that were contentious, and submit the
whole set together.

**Why this priority**: Recording questions is only half the value; the point is a single collective
decision session. This is the story that makes the feature worth building, and it delivers value on
its own even before re-runs exist — the answers and their rationale become a durable record.

**Independent Test**: Open a completed run's review list, answer every question, add a note to one,
submit the batch, and confirm all answers and notes are stored against the run.

**Acceptance Scenarios**:

1. **Given** a completed run with recorded questions, **When** a team member opens the review,
   **Then** they see every question with its context, options, and suggested answer.
2. **Given** an open review, **When** a member selects an answer or writes their own, **Then** the
   selection is saved as a draft without submitting the batch.
3. **Given** a partly answered review, **When** another member opens it, **Then** they see the
   answers recorded so far and who recorded them.
4. **Given** a review where every question is answered, **When** a member submits, **Then** all
   answers are committed together and the review is closed to further edits.
5. **Given** a review with unanswered questions, **When** a member attempts to submit, **Then** the
   submission is refused and the unanswered questions are named.
6. **Given** two members answer the same question differently, **When** the second answer is
   recorded, **Then** the conflict is shown and must be resolved before submission.
7. **Given** a submitted review, **When** anyone views it later, **Then** they see each answer, who
   chose it, when, and any note attached.
8. **Given** a fully answered review, **When** a member who is neither the project owner nor the
   person who started the run attempts to submit, **Then** the submission is refused with the
   reason and their answers remain saved as drafts.

---

### User Story 3 - Re-run with the team's answers applied (Priority: P1)

With answers submitted, the lead re-runs. This time the platform uses the team's decisions instead
of its provisional guesses, and the provisional markings clear. Anything the team did not change
keeps its existing result rather than being needlessly redone.

**Why this priority**: Without this the answers are just notes. This closes the loop and is what
turns the batch review into a working process.

**Independent Test**: Submit answers that differ from the suggestions, re-run, and confirm the
outputs reflect the team's answers and no longer carry provisional markings.

**Acceptance Scenarios**:

1. **Given** a submitted review, **When** the lead re-runs, **Then** the team's answers are applied
   in place of the provisional ones.
2. **Given** a re-run completes, **When** the results are viewed, **Then** no artifact derived from
   a now-answered question is still marked provisional.
3. **Given** an answer that matches the original suggestion, **When** the re-run executes, **Then**
   the affected work is not needlessly repeated.
4. **Given** a re-run raises new questions, **When** it completes, **Then** those are recorded in a
   new review rather than reopening the submitted one.
5. **Given** the underlying work changed after answers were submitted, **When** the lead re-runs,
   **Then** they are warned which answers may no longer apply.

---

### User Story 4 - Control who can see and change each project artifact (Priority: P1)

A project owner sets access on the project's artifacts — requirements, specifications, tasks,
review sessions, and attached files. Some are open to everyone on the project, some are restricted
to named people, and some are read-only for most and editable by a few. Anyone without access
cannot see the artifact at all, and every access decision is recorded.

**Why this priority**: A batch review is a collaborative surface, and collaboration without access
control is a liability the moment a project contains anything commercially sensitive. It is also a
prerequisite for the external storage stories — pushing files somewhere else is unsafe if the
platform itself has no notion of who may see them.

**Independent Test**: Restrict an artifact to one user, sign in as another, and confirm it is
neither visible nor reachable, and that the attempt was recorded.

**Acceptance Scenarios**:

1. **Given** a project artifact, **When** the owner grants a user read access, **Then** that user
   can view it but not change it.
2. **Given** a project artifact, **When** the owner grants a user edit access, **Then** that user
   can view and change it.
3. **Given** a user with no grant, **When** they attempt to view a restricted artifact, **Then**
   access is refused and the attempt is recorded.
4. **Given** a user with read access, **When** they attempt to change the artifact, **Then** the
   change is refused with the reason.
5. **Given** access is revoked while a user has the artifact open, **When** they next act on it,
   **Then** the action is refused.
6. **Given** an artifact derived from a restricted artifact, **When** access is evaluated, **Then**
   the derived artifact is at least as restricted as its source.
7. **Given** any access change, **When** it is made, **Then** it is recorded with who changed it,
   what changed, and when.

---

### User Story 5 - Connect an external file storage provider (Priority: P2)

An administrator connects the workspace to the team's existing file storage — Google Drive,
Dropbox, or S3 — by authorising the connection once and choosing a destination folder or bucket.
The connection's health is visible, and it can be disconnected without harming anything in the
platform.

**Why this priority**: Prerequisite for publishing files anywhere. P2 rather than P1 because the
platform is fully usable with its own storage; external storage is an integration convenience and a
continuity measure.

**Independent Test**: Connect a provider, confirm it reports healthy and names its destination,
disconnect it, and confirm no platform artifact was lost.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they connect a supported provider and authorise it, **Then**
   the connection is saved against the workspace and reports its status.
2. **Given** a connected provider, **When** the administrator selects a destination folder or
   bucket, **Then** it is stored and shown as the publish target.
3. **Given** authorisation is refused or withdrawn at the provider, **When** the platform next uses
   it, **Then** the connection is shown as needing re-authorisation and the reason is stated.
4. **Given** a connected provider, **When** the administrator disconnects it, **Then** all platform
   artifacts remain intact and available.
5. **Given** a provider that is unreachable, **When** its status is checked, **Then** it is reported
   as unavailable rather than shown as healthy.

---

### User Story 6 - Publish project files to connected storage (Priority: P2)

A project member publishes the project's artifacts as files to the connected storage, so people
outside the platform can read them in tools they already use. Published files are organised by
project, and the member can see what was published, when, and where it landed.

**Why this priority**: This is the point of connecting a provider. P2 alongside US5 because it
depends on it and because the platform delivers value without it.

**Independent Test**: Publish a project to a connected provider, confirm the files appear at the
destination organised by project, and confirm the platform records what was published and where.

**Acceptance Scenarios**:

1. **Given** a connected provider and a project, **When** a member publishes, **Then** the project's
   artifacts appear at the destination as files, organised by project.
2. **Given** a publish completes, **When** the member views the project, **Then** they see what was
   published, when, and a way to reach it at the destination.
3. **Given** a publish fails partway, **When** it ends, **Then** the failure is reported with a
   reason and the platform states what was and was not published.
4. **Given** an artifact the member cannot access, **When** they publish, **Then** that artifact is
   excluded and the exclusion is reported.
5. **Given** a destination that is full or over quota, **When** a publish is attempted, **Then** it
   fails with that specific reason.
6. **Given** a published file is later deleted at the provider, **When** the platform is viewed,
   **Then** the platform's own copy of the artifact is unaffected.
7. **Given** a previously published project, **When** the member publishes again, **Then** they are
   told what will be added, replaced, or left alone before it happens.

---

### User Story 7 - Swap storage providers without losing anything (Priority: P3)

An administrator moves the workspace from one storage provider to another. Nothing in the platform
changes, publishing continues to work, and no artifact is lost in the move.

**Why this priority**: This is the acceptance test for treating storage providers as interchangeable
adapters — the same pattern the SRS mandates for specification engines. P3 because a single provider
is enough to deliver value, but without this the integration hardens into a dependency.

**Independent Test**: Publish to one provider, connect a second, switch to it, publish again, and
confirm both publishes succeeded and no platform artifact changed.

**Acceptance Scenarios**:

1. **Given** a workspace using one provider, **When** the administrator connects and switches to a
   different one, **Then** publishing continues to work against the new destination.
2. **Given** a provider switch, **When** it completes, **Then** records of what was previously
   published remain viewable.
3. **Given** platform behaviour outside the storage integration layer, **When** the provider
   changes, **Then** that behaviour is unchanged.
4. **Given** a provider that cannot support a required capability, **When** it is connected,
   **Then** the connection is refused naming the missing capability.

---

### Edge Cases

**Unattended runs and review**

- **Run raises an unusually large number of questions**: the review lists them grouped and remains
  usable; the run does not fail because of the volume.
- **Run raises no questions at all**: no review is created, and the run is reported as complete
  with nothing to decide.
- **Two questions contradict each other**: both are recorded and the contradiction is shown so the
  team resolves them together.
- **Reviewer answers, then changes their mind before submission**: the latest draft answer wins and
  the change is visible.
- **Neither the project owner nor the run's starter is available to submit**: the session stays open
  with answers preserved as drafts; ownership must change for it to be submitted.
- **Two reviewers answer the same question differently**: shown as a conflict; submission is blocked
  until resolved.
- **Someone tries to edit a submitted review**: refused; a new review must be opened instead.
- **Provisional specification approved by override, then the question is answered later**: the
  provisional marking clears and the recorded override remains as history.
- **Approver has no access to an artifact a provisional item concerns**: the item is shown as
  restricted, and approval by override is refused until someone with access accepts it.
- **Run is cancelled while in flight**: questions recorded so far are preserved.
- **Underlying work changes between submission and re-run**: the affected answers are flagged as
  possibly stale.

**Access control**

- **Last person with edit access is removed**: refused, or the project owner is retained, so no
  artifact becomes unmanageable.
- **Access is revoked mid-edit**: the in-progress change is refused on save.
- **A restricted artifact is cited by an artifact someone can see**: the citation is shown as
  present but its content is withheld.
- **Access changes during a run**: the run uses the access in force when it started and reports
  anything it could not use.
- **Reviewer lacks access to an artifact a question concerns**: the question is hidden from them
  and shown as restricted rather than silently omitted.

**External storage**

- **Provider authorisation expires mid-publish**: publish stops, reports re-authorisation is
  needed, and states what was published.
- **Provider is unreachable when publish starts**: reported as unavailable before anything is sent.
- **Provider rate-limits the platform**: publish slows or defers rather than failing outright.
- **Destination folder is deleted or renamed externally**: reported as missing on next publish.
- **Two publishes of the same project run at once**: one proceeds; the other is told a publish is
  already running.
- **File exceeds the provider's size limit**: that file is skipped and reported; the rest continue.
- **Provider is disconnected while a publish is running**: the publish stops cleanly and is reported.
- **Artifact name is invalid at the destination**: the name is adapted and the adaptation reported.

## Requirements *(mandatory)*

### Functional Requirements

#### Unattended run mode

- **FR-001**: Users MUST be able to start a run in an unattended mode that proceeds without pausing
  for input, and MUST choose, when starting it, how far the run should go before stopping — at
  minimum: stop after specification, or continue through task generation.
- **FR-002**: Users MUST be able to start a run in the normal interactive mode, which pauses at
  each decision point.
- **FR-003**: System MUST, in unattended mode, record every question it would otherwise have asked,
  together with the options considered and its own suggested answer.
- **FR-004**: System MUST, in unattended mode, proceed past each recorded question using its
  suggested answer as a provisional answer.
- **FR-005**: System MUST mark every artifact produced from a provisional answer as provisional,
  and MUST identify which question made it so.
- **FR-005a**: System MUST, when a user attempts to approve a specification carrying provisional
  markings, show every provisional item and the question governing it, and MUST require the approver
  to explicitly accept them before approval proceeds.
- **FR-005b**: System MUST record a provisional-approval override against the approval, naming the
  approver, the time, and the specific provisional items accepted.
- **FR-005c**: System MUST NOT otherwise block approval or task generation on provisional markings;
  task generation continues to follow the approval gate established in EPIC-001.
- **FR-006**: System MUST group all questions raised by one run into a single review session
  belonging to that run.
- **FR-007**: System MUST record, for each question, enough context for someone who did not start
  the run to understand what is being asked.
- **FR-008**: System MUST stop an unattended run and preserve all completed work when it encounters
  a condition it cannot proceed past, recording the reason.
- **FR-008a**: System MUST stop an unattended run at the range the user selected, report that it
  reached the selected stop point rather than failed, and allow the run to be continued further
  from that point.

#### Team review and answer submission

- **FR-009**: Users with access MUST be able to view every question in a review session in one place.
- **FR-010**: Users MUST be able to select a suggested answer, or provide their own, for each
  question, and MUST be able to attach a note.
- **FR-011**: System MUST save answers as drafts as they are made, without committing the session.
- **FR-012**: System MUST record who provided each answer and when.
- **FR-013**: System MUST show a conflict when two users record different answers to the same
  question, and MUST block submission until it is resolved.
- **FR-014**: System MUST refuse submission of a review session with unanswered questions, naming
  them.
- **FR-015**: System MUST commit all answers in a session together as one submission, after which
  the session is closed to further edits.
- **FR-015a**: System MUST restrict submission of a review session to the project owner or the user
  who started the run, and MUST refuse submission by anyone else with a stated reason. Answering
  and noting remain open to every user with access to the session.
- **FR-016**: Users MUST be able to re-run using a submitted session's answers in place of the
  provisional ones.
- **FR-017**: System MUST clear the provisional marking from artifacts whose governing question has
  been answered.
- **FR-018**: System MUST record new questions raised by a re-run in a new review session rather
  than reopening a submitted one.
- **FR-019**: System MUST warn, when re-running, if the underlying work changed after answers were
  submitted, naming the answers that may no longer apply.
- **FR-020**: System MUST retain submitted review sessions as a permanent record of what was
  decided, by whom, and why.

#### Artifact access control

- **FR-021**: Project owners MUST be able to grant a user read or edit access to a project artifact.
- **FR-022**: Project owners MUST be able to revoke a previously granted access.
- **FR-023**: System MUST refuse any view or change for which the acting user holds no sufficient
  grant, and MUST record the refused attempt.
- **FR-024**: System MUST hide artifacts a user cannot access rather than showing them as
  inaccessible placeholders in listings.
- **FR-025**: System MUST ensure an artifact derived from a restricted artifact is at least as
  restricted as its source.
- **FR-026**: System MUST record every access grant and revocation with the actor, the change, and
  the time.
- **FR-027**: System MUST prevent an artifact from reaching a state where no user holds edit access
  to it.
- **FR-028**: System MUST evaluate access using the grants in force when a run started, and MUST
  report anything a run could not use because of access.

#### External storage integration

- **FR-029**: Administrators MUST be able to connect a workspace to an external file storage
  provider and select a destination within it.
- **FR-030**: System MUST support more than one provider type, and MUST allow a new provider type
  to be added without changing platform behaviour outside the storage integration layer.
- **FR-031**: System MUST report the status of each connection, distinguishing healthy, needing
  re-authorisation, and unavailable.
- **FR-032**: Users MUST be able to publish a project's artifacts as files to the connected
  destination, organised by project.
- **FR-033**: System MUST exclude from a publish any artifact the publishing user cannot access,
  and MUST report the exclusion.
- **FR-034**: System MUST record, for each publish, what was published, when, by whom, and where it
  landed.
- **FR-035**: System MUST report publish failures with a specific named reason, distinguishing at
  minimum: provider unavailable, authorisation expired, quota exceeded, size limit exceeded, and
  destination missing.
- **FR-036**: System MUST state, when republishing, what will be added, replaced, or left alone
  before making any change.
- **FR-037**: System MUST keep platform artifacts intact and available regardless of any change,
  deletion, or disconnection at the provider.
- **FR-038**: Administrators MUST be able to disconnect or switch providers without loss of any
  platform artifact or publish history.
- **FR-039**: System MUST refuse to connect a provider that cannot support a required capability,
  naming the missing capability.
- **FR-040**: System MUST prevent two concurrent publishes of the same project.

### Key Entities

- **Run**: One execution over a body of work. Attributes: identifier, project, mode (interactive /
  unattended), state, initiating user, started and ended times, access snapshot, outcome.
- **Recorded Question**: A decision point deferred by an unattended run. Attributes: identifier,
  run, context, options considered, suggested answer, provisional answer applied, affected
  artifacts, restricted flag.
- **Review Session**: The collection of questions from one run. Attributes: identifier, run, state
  (open / submitted), opened and submitted times, participants.
- **Answer**: A team decision on one question. Attributes: question, selected or written value,
  author, timestamp, note, draft or committed state, conflict flag.
- **Provisional Marking**: The link between an artifact and the unanswered question that governs
  it. Attributes: artifact, question, cleared timestamp.
- **Provisional Approval Override**: A record that an approver knowingly accepted provisional items.
  Attributes: approval, approver, timestamp, provisional items accepted.
- **Access Grant**: Permission for one user over one artifact. Attributes: artifact, user, level
  (read / edit), granted by, granted at, revoked at.
- **Access Attempt Record**: A refused access. Attributes: user, artifact, action, time, reason.
- **Storage Connection**: A workspace's link to an external provider. Attributes: identifier,
  workspace, provider type, destination, status, authorised by, last checked.
- **Storage Provider Type**: A supported kind of external storage. Attributes: name, capabilities
  provided, limits.
- **Publish Record**: One publish operation. Attributes: identifier, project, connection, initiating
  user, artifacts included, artifacts excluded with reasons, state, failure reason, destination
  locations, time.
- **Published File Reference**: The link between a platform artifact and its published copy.
  Attributes: artifact, connection, destination location, published version, published at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A run in unattended mode completes without any human input, regardless of how many
  questions it raises.
- **SC-002**: 100% of questions raised during an unattended run appear in exactly one review
  session; none are lost or duplicated.
- **SC-003**: A team can review and submit answers to 20 questions in a single sitting of under 60
  minutes, without leaving the review.
- **SC-004**: 100% of artifacts derived from an unanswered question are visibly marked provisional,
  and the marking clears once that question is answered.
- **SC-005**: Zero review sessions can be submitted with an unanswered question or an unresolved
  conflict.
- **SC-005a**: Zero specifications carrying provisional markings are approved without a recorded,
  attributable override naming the accepted items.
- **SC-006**: Every submitted answer is permanently attributable to a person and a time.
- **SC-007**: Zero artifacts are visible to a user holding no grant over them; every refused attempt
  is recorded.
- **SC-008**: Zero artifacts can reach a state with no user able to edit them.
- **SC-009**: Every publish failure reports a specific named reason; zero generic failures reach the
  user.
- **SC-010**: A workspace can switch storage providers with zero loss of platform artifacts and zero
  loss of publish history.
- **SC-011**: An additional storage provider type can be supported with zero changes to platform
  behaviour outside the storage integration layer.
- **SC-012**: Deleting or altering published files at the provider has zero effect on the platform's
  own artifacts.
- **SC-013**: Every access grant, revocation, and refusal appears in the audit record.

## Out of Scope

- **Two-way synchronisation** with external providers — edits made to a published file at the
  provider never flow back into the platform. Confirmed by clarification: publishing is one-way and
  the platform is authoritative. This includes import-back of individual files.
- **Full enterprise role-based access control, roles, groups, and SSO** — this Epic covers direct
  per-user grants on artifacts. Role hierarchies, inherited organisational permissions, and
  single sign-on remain Phase 3 per the SRS roadmap, confirmed by clarification.
- **External collaborators without a platform account** — all grants are to existing users.
- **Storage provider marketplace or user-installable provider plugins** — the MCP marketplace and
  plugin framework remain Phase 3.
- **Encryption key management for published files**, retention policies, and legal hold.
- **Editing artifacts inside the external provider's own interface.**
- **Automatic scheduled publishing** — publishing is user-initiated in this Epic.
- **Deferred contract capabilities from EPIC-001** (improve specification, generate acceptance
  criteria, estimate complexity, analyze dependencies) remain out of scope.

## Assumptions

- "Executing command" in the request refers to running the platform's generation chain over a body
  of work; "run all" is the unattended mode that carries it through to a user-selected stop point.
- The selectable run range is bounded by the stages EPIC-001 delivers — specification generation
  and task generation. Additional stop points arrive with the stages that introduce them.
- "Project management files" refers to the project's artifacts established in EPIC-001 —
  requirements, specifications, specification versions, tasks, architecture decision records — plus
  the review sessions this Epic adds.
- Provisional answers let a run finish and produce reviewable output. They are explicitly not
  treated as decisions, and everything derived from one is marked until a person confirms it.
- A review session belongs to the run that produced it. Re-runs create new sessions rather than
  reopening old ones, so the record of what was decided when stays intact.
- Storage providers are treated as interchangeable adapters behind one integration boundary — the
  same pattern the SRS mandates for specification engines. Google Drive, Dropbox, and S3 are the
  named examples, not an exhaustive list.
- Publishing is a copy operation. The platform's own storage remains authoritative, so nothing at
  the provider can damage a platform artifact.
- Access grants are per artifact and per user, at read or edit level. Anything richer is Phase 3.
- Access is evaluated against a snapshot taken when a run starts, so a long run cannot half-apply a
  mid-flight permission change.
- No technology stack, storage engine, authentication mechanism, provider SDK, or user interface
  framework is chosen here; all are deferred to `/speckit-plan`.
- The SRS is the requirement authority. Where this specification and the SRS disagree, the SRS wins
  and this document is corrected (Constitution Principle II).

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/002-team-review-access-storage/defects/` contains no open defect records
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
- [ ] SRS back-fill completed for unattended runs and storage integration (Constitution II)
