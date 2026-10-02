# Feature Specification: Local Project Workspace

**Feature Branch**: `epic/041-local-project-workspace`

**Epic**: `EPIC-041` — Local Project Workspace

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Local Project Workspace — a PMI Studio project becomes a real
directory on the developer's machine. Provisioning creates the directory, runs `specify init` for
the chosen agent integration, installs the PMI Spec Kit extension and the setup skill, writes
`.pmi/project.json` and `.mcp.json`, and mints a project-scoped connector token. Adds
controlled-local as a Workspace Fabric mode (`BR-0132`, `BR-0133`) and repairs the four severed
wiring points recorded in PMI-DOC-004B §2.1 as its Foundational phase." *(PMI-DOC-007 §7, verbatim)*

> **This is the first Epic of the local-first replan** approved on 2026-09-03 (`D-47`,
> PMI-DOC-007 v1.0). It exists because verification found that a project in PMI Studio is a
> database row and nothing else: the only workspace any run ever had was a memory-backed scratch
> area inside a disposable container, destroyed when the run ended (PMI-DOC-004B §2, `O-1`). Every
> later Epic of the replan — the integration contract, the extension, the journey board, the
> artifact viewer, the task board — assumes a directory exists for the user's own agent to work in.
> This Epic makes that directory exist, makes it the user's, and gives the user's agent a credential
> to speak to PMI Studio with.
>
> **Six judgement calls were made in writing this document**, because the brief settles *what* and
> not every *how*. Each is listed under **Assumptions** with the reasoning and the alternative, so
> that `/speckit-clarify` can confirm or overturn them with the requester rather than an author's
> preference standing in for a decision. No `[NEEDS CLARIFICATION]` marker is used: every call has a
> defensible default and none changes whether the Epic should exist.

## Clarifications

### Session 2026-09-03

Five of the six judgement calls were put to the requester in one round (Constitution X); the
sixth (a git repository is initialised where none exists, with no remote) was low-impact and
reversible at the plan step, and stands as recorded. **All five recommendations were accepted.**

- Q: Which machine creates the project directory when a project is created in PMI Studio? → A:
  **The platform, on the machine PMI Studio runs on, under a configured projects root** mounted
  into the container. Remote PMI Studio with a directory elsewhere is out of scope here
  (`BR-0131`, a later Epic). *(Confirms Assumption 1; `FR-LPW-001`, `FR-LPW-005`, `FR-LPW-007`.)*
- Q: May a project be provisioned into a directory that already contains files? → A: **No — only
  an empty directory or an empty git repository.** Anything else is refused by name; brownfield
  adoption is its own Epic. *(Confirms Assumption 2; `FR-LPW-012`.)*
- Q: What should happen when the Spec Kit installer is not available on the machine that
  provisions? → A: **Complete every other step and record the project as *initialisation
  pending*;** the `EPIC-042` setup skill completes it on the user's machine. The application image
  is not required to carry Spec Kit. *(Confirms Assumption 3; `FR-LPW-010`.)*
- Q: Should a connector credential expire on its own, or only when someone revokes it? → A:
  **Only on revocation, in this Epic.** Last use is visible; an expiry window becomes a tenant
  setting alongside `EPIC-030`'s policy classes in a later Epic. *(Confirms Assumption 4; adds
  `FR-LPW-028`.)*
- Q: Should this Epic also make a sandbox generation startable from the project screen, or only
  make results persist? → A: **All three repairs as specified** — worker persistence, durable
  task/run/job stores, and a generation startable from the project screen — as `D-47` approved for
  milestone `M0`. *(Confirms Assumption 6; `FR-LPW-040`–`FR-LPW-042`.)*

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §7 `EPIC-041` brief | every `FR-LPW-` below |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §2.3 source-of-truth boundaries · §2.4 security model | FR-LPW-010 to FR-LPW-013, FR-LPW-020 to FR-LPW-028 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §3 domain model · §9.3 `LR-01`, `LR-02`, `LR-11` | FR-LPW-001, FR-LPW-020, FR-LPW-034 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.14 `BR-0132` — Controlled local connector | FR-LPW-030 to FR-LPW-035 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.14 `BR-0133` — Uniform governance | FR-LPW-031, FR-LPW-033 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.14 `BR-0135` — Credential isolation | FR-LPW-021, FR-LPW-024 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0201` — Integration contract, not the database · `BR-0202` — Strict and provisional execution | FR-LPW-025, FR-LPW-032 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.2 `BR-0010` — Project lifecycle | FR-LPW-001 to FR-LPW-004, FR-LPW-050 |
| `SRS/PMI-DOC-004B_…_v0.1.md` | §2.1 — the four severed places | FR-LPW-040 to FR-LPW-044 |
| `.specify/memory/constitution.md` | XII — Execution Registration | FR-LPW-031, FR-LPW-032 |
| `adr/ADR-0024` · `adr/ADR-0009` | Workspace Fabric modes · persistent project state | FR-LPW-030, FR-LPW-034; amended at plan step per PMI-DOC-007 §9.2 |

**Requirements not yet covered by SRS**: none by document — every requirement traces to
PMI-DOC-007, which lives in `SRS/`. **Three carry provisional identifiers** (`LR-01`, `LR-02`,
`LR-11`) that receive `BR-` numbers only in PMI-DOC-004 v2.1; the back-fill is owed by the Project
Owner before the platform release gate and is restated under Assumptions (the `D-46` pattern).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | This document precedes any provisioning code; the replan it implements was approved before it was written |
| PP-002 | Single Source of Truth | Satisfied | `FR-LPW-011` — the directory is authoritative for content, PMI Studio for status; neither restates the other (PMI-DOC-007 §2.3) |
| PP-003 | Human-in-the-Loop | Satisfied | A person chooses the path, the agent integration and the script type; a person mints and revokes a credential (`FR-LPW-020`, `FR-LPW-023`) |
| PP-004 | End-to-End Traceability | Satisfied | `FR-LPW-004` — every provisioning action is an audit entry naming actor, path and outcome |
| PP-005 | Modular Architecture | Satisfied | Provisioning is a service behind the projects module; the fabric mode is a contract change, not a backend import (`FR-LPW-030`) |
| PP-006 | Engine Independence | Satisfied | `FR-LPW-006` — the agent integration is a **parameter** of provisioning; `specify init` is invoked through the engine adapter's boundary and never from `backend/` |
| PP-007 | API & MCP First | Satisfied | Every capability here is an API operation first; the screens of `FR-LPW-050`–`FR-LPW-053` call them and add nothing |
| PP-008 | Security by Design | Satisfied | The Epic's sharpest requirements — `FR-LPW-021`–`FR-LPW-025`: hashed at rest, shown once, never in the directory, scoped to one project, revocable |
| PP-009 | Quality by Design | Satisfied | `SC-LPW-003` and `SC-LPW-006` are mutation-tested; Constitution V applies to every task |
| PP-010 | Observability by Default | Partial | Provisioning steps emit structured events with a correlation id; **workstation health telemetry** lands in `EPIC-043` (`pmi.health`) |
| PP-011 | Documentation as Code | Satisfied | `.pmi/project.json` and `.mcp.json` are generated from configuration and checked by a conformance test (`FR-LPW-009`) |
| PP-012 | Everything Versioned | Satisfied | `FR-LPW-008` — the provisioning record carries the Spec Kit tag and extension version it wrote |
| PP-013 | Knowledge-Driven Engineering | Not applicable | No retrieval or knowledge concern in this Epic |
| PP-014 | Configuration over Customization | Satisfied | Projects root, pinned Spec Kit tag, default agent and script type are configuration (`FR-LPW-005`) |
| PP-015 | Open Standards | Satisfied | The directory is a stock Spec Kit project; `.mcp.json` is the agent's own documented format; nothing proprietary is written |
| PP-016 | Explainable AI | Not applicable | No AI decision is made here |
| PP-017 | Cost-Aware AI | Not applicable | No AI execution is initiated here |
| PP-018 | Scalability First | Satisfied | One directory per project on one machine; nothing here has a scale dimension beyond a file system |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Provisioning time and setup-failure counts are inputs to `EPIC-040` Metrics & Reporting (held); no metric is derived here |
| PP-020 | Customer Value | Satisfied | `SC-LPW-001` — from *create project* to *a directory my agent can open* in one screen and under two minutes |

**Deferral count**: 1 — `PP-019`, owner `EPIC-040` (held per PMI-DOC-007 §9.4), reviewed at this
Epic's convergence gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A project becomes a directory I can open (Priority: P1)

**`LR-01`, `BR-0010`.** A project owner creates a project in PMI Studio, gives it a root path,
picks the agent integration and script type, and gets back a directory on disk that is a complete
Spec Kit project: `.specify/` initialised, the PMI extension registered, the setup skill present,
`.pmi/project.json` and `.mcp.json` written. Opening that directory in the agent is the next thing
they do, and nothing about PMI Studio stands in the way.

**Why this is P1 and the MVP**: every objective of the replan assumes this directory exists. Without
it there is nowhere for the user's agent to run a command, nothing to register, nothing to sync.

**Independent test**: create a project with a path under the configured projects root; assert the
directory exists, contains a valid Spec Kit structure for the chosen integration, and that PMI
Studio records it as provisioned with the same path.

**Acceptance scenarios**

1. **Given** a signed-in owner and a path under the projects root that does not exist, **When** the
   project is created with an agent integration and script type, **Then** the directory exists, is a
   valid Spec Kit project for that integration, holds the PMI extension, the setup skill,
   `.pmi/project.json` and `.mcp.json`, and the project shows as **provisioned** with that path.
2. **Given** a path that exists and is **not empty**, **When** provisioning is requested, **Then** it
   is **refused naming the path**, no file is written, and the project is recorded as **not
   provisioned** with that reason.
3. **Given** a path **outside** the configured projects root, **When** provisioning is requested,
   **Then** it is refused naming the root, and no file is written anywhere.
4. **Given** a provisioned project, **When** provisioning is requested again, **Then** it completes
   with **zero files changed** and the record says so.
5. **Given** provisioning that fails part-way (the Spec Kit initialiser is unavailable), **When** the
   failure is recorded, **Then** the project reads **provisioned — initialisation pending** with the
   step that failed, files written so far are listed, and the setup skill can complete it later.

---

### User Story 2 - My agent has a credential that opens exactly one project (Priority: P1)

**`LR-02`, `BR-0135`, `BR-0201`.** At provisioning, and again on demand, the owner mints a
connector credential for the project. It is shown once. It is stored only as a hash. It lets an
agent speak to PMI Studio about this project and no other, and the owner can revoke it at any time
and see when it was last used.

**Why this is P1**: `EPIC-043` mounts the execution registry behind this credential; `EPIC-042`'s
setup skill verifies it. Neither can be specified honestly until the credential exists.

**Independent test**: mint a credential, present it against the project's own resources and
against another project's; observe acceptance and a non-disclosing refusal respectively; revoke it;
observe refusal on the project it used to open.

**Acceptance scenarios**

1. **Given** a provisioned project, **When** a credential is minted, **Then** its value is returned
   **exactly once**, the stored form is a hash, and the record carries label, creator and time.
2. **Given** a minted credential, **When** it is presented for another project in the same
   workspace, **Then** the request is refused **without disclosing** whether that project exists.
3. **Given** a minted credential, **When** it is revoked, **Then** every subsequent use is refused,
   the revocation is audited, and the record shows revoker and time.
4. **Given** any provisioned directory, **When** every file under it is read, **Then** the
   credential value appears in **none** of them — `.mcp.json` names an environment variable, never a
   value.
5. **Given** a lost credential, **When** the owner mints a new one, **Then** the old one continues to
   work until revoked; PMI Studio never re-displays a value it has already shown.

---

### User Story 3 - Work done on my machine counts as governed work (Priority: P1)

**`BR-0132`, `BR-0133`, Constitution XII.** The platform recognises a third place a governed
command can run: the developer's own machine. An execution that arrives from there is recorded like
any other, carries the surface it came from, and carries an **assurance** value that says honestly
that it ran outside a managed environment.

**Why this is P1**: `ADR-0024` admits this mode as optional and `ADR-0009` forbids persistent
workspaces; until the contract names the mode, `EPIC-043` cannot register an execution from it
without lying about where it ran.

**Independent test**: describe an execution environment of kind *controlled local* through the
execution contract; assert it is accepted, that its lifecycle is *persistent*, and that a
registration from it records surface and assurance.

**Acceptance scenarios**

1. **Given** the execution contract, **When** an environment of kind **controlled local** with a
   **persistent** workspace binding is described, **Then** it is accepted and the managed provider's
   refusal of persistence is confined to the managed provider.
2. **Given** an execution registered from a local surface, **When** its record is read, **Then** it
   carries `surface` (`local-cli` or `mcp-client`) and `assurance: local`; an execution from the
   managed sandbox carries `assurance: managed`.
3. **Given** an execution from any surface, **When** governance is applied, **Then** the same
   identity, permission, audit, evidence and completion rules apply (`BR-0133`) — assurance is
   recorded, never used to relax a rule.

---

### User Story 4 - What the platform already does, it now keeps (Priority: P1)

**PMI-DOC-004B §2.1.** Four things were built and never wired, and nothing local can be
demonstrated across them: the worker throws on every attempt to persist a generation; tasks, runs
and generation jobs live in memory and vanish on restart; the screens cannot start a generation or a
run; the execution registry has no way in. This Epic closes the first three as its Foundational
phase. The fourth is `EPIC-043`'s.

**Why this is P1**: `M0` in PMI-DOC-007 §8. A platform that loses every task on restart cannot show
a Kanban that moves, whatever the execution model.

**Independent test**: submit a generation through the real API, restart the application, and read
the specification, its tasks and its job record back.

**Acceptance scenarios**

1. **Given** a generation submitted through the API, **When** the worker completes it, **Then** the
   specification, version and links are persisted and readable after a restart.
2. **Given** tasks generated for a specification, **When** the application restarts, **Then** every
   task and its status is still there.
3. **Given** a project with selectable requirements, **When** the user is on the project screen,
   **Then** a generation can be started from the screen and its progress read there.
4. **Given** the composed application, **When** its module graph is inspected, **Then** no
   store for tasks, runs or generation jobs is an in-memory implementation.

---

### User Story 5 - I can see and manage what was provisioned (Priority: P2)

**`BR-0010`.** The project screen shows whether the project is provisioned, where, for which
integration, at which Spec Kit version, and what went wrong if anything did. The credentials list
shows every connector credential with its label, creation, last use and revocation, and lets an
authorised person mint or revoke.

**Independent test**: provision a project, mint two credentials, revoke one, and read all of it
back on the two screens.

**Acceptance scenarios**

1. **Given** a provisioned project, **When** its screen is opened, **Then** path, integration,
   script type, Spec Kit tag, extension version and provisioning state are shown, with the failed
   step named where one failed.
2. **Given** credentials for a project, **When** the credentials list is opened, **Then** each shows
   label, creator, created, last used and revoked; the value is shown nowhere.
3. **Given** a signed-in identity without the owner grant, **When** minting is attempted, **Then** it
   is refused and the refusal audited.

### Edge Cases

- **The projects root is not mounted** into the running application. Provisioning refuses with
  *projects root unavailable* before touching anything, rather than creating a directory inside the
  container that nobody can open.
- **Two projects, one path.** The second is refused naming the first — a path is unique across the
  workspace, not merely across a project.
- **The path is valid on the platform's host but not on the user's.** The record stores the path as
  given and the screen shows it verbatim; PMI Studio does not translate paths. *(See Assumption 1.)*
- **A Windows path with a drive letter, a POSIX path, a path with spaces.** All three are accepted
  and round-trip unchanged; the script type is chosen by the user, not inferred from the path.
- **The Spec Kit initialiser is absent or the wrong version** on the host that provisions. The
  project is recorded *initialisation pending* with the expected tag; nothing is written on its
  behalf that would later be overwritten.
- **A credential is presented after revocation but within a clock skew window.** Refused: revocation
  is a stored fact, not a time comparison.
- **The `.mcp.json` the user's agent expects already exists** in an adopted empty repository. It is
  not overwritten; provisioning merges the `pmi-studio` entry and reports that it did.
- **A provisioning run is interrupted** (process killed). On the next request the record shows
  which steps completed; the run resumes from the first incomplete step and never repeats a
  destructive one.

## Requirements *(mandatory)*

### Functional Requirements

**Provisioning (`LR-01`, `BR-0010`)**

- **FR-LPW-001**: A project MUST be able to own a **root path**: a directory on a file system the
  platform can write to, recorded on the project.
- **FR-LPW-002**: Provisioning MUST create the directory, initialise it as a Spec Kit project for
  the chosen **agent integration** and **script type**, install the PMI Spec Kit extension and
  register its hooks, install the `setup-PMIStudio` skill, and write `.pmi/project.json` and
  `.mcp.json`.
- **FR-LPW-003**: Provisioning MUST be **idempotent**: a second run against a provisioned project
  changes nothing and reports zero changes.
- **FR-LPW-004**: Every provisioning attempt MUST produce an audit entry naming actor, path,
  integration, outcome and — on failure — the step that failed.
- **FR-LPW-005**: The **projects root**, the pinned Spec Kit tag, the extension version, and the
  default agent integration and script type MUST be configuration, not code. Provisioning writes
  **on the machine the platform runs on**, under that root *(clarified 2026-09-03)*; where the
  platform runs containerised, the root is a directory mounted into it, and an unmounted root is
  refused before anything is written.
- **FR-LPW-006**: The agent integration MUST be a parameter. Nothing in provisioning MAY name one
  integration as the only possibility (`PP-006`).
- **FR-LPW-007**: A path outside the projects root, a non-empty directory, or a path already owned
  by another project MUST be **refused naming the reason**, with no file written.
- **FR-LPW-008**: The provisioning record MUST carry the Spec Kit tag and extension version written,
  so a later drift is a comparison and not a guess (`PP-012`).
- **FR-LPW-009**: `.pmi/project.json` MUST carry the project identity, the platform address and the
  provisioning versions, and MUST NOT carry a credential. `.mcp.json` MUST reference the credential
  by environment-variable name only. Both MUST be checked by an executable conformance test.
- **FR-LPW-010**: Where the Spec Kit initialiser is unavailable on the provisioning host,
  provisioning MUST complete every other step and record the project as **initialisation pending**,
  never as provisioned *(clarified 2026-09-03)*. The application image is **not** required to carry
  the initialiser; completing a pending initialisation on the user's machine is `EPIC-042`'s setup
  skill's job.
- **FR-LPW-011**: The directory is **authoritative for artifact content** and PMI Studio for status,
  decisions and evidence (PMI-DOC-007 §2.3). Provisioning MUST NOT create a second copy of anything
  PMI Studio already holds, and nothing in PMI Studio MAY be written back into the directory by this
  Epic except the files `FR-LPW-002` names.
- **FR-LPW-012**: An **empty existing git repository** MAY be adopted as a root path. Any
  directory containing files — with or without Spec Kit in it — MUST be refused in this Epic
  *(clarified 2026-09-03)*; brownfield adoption is a later Epic's.
- **FR-LPW-013**: Where no git repository exists at the root path, provisioning MUST initialise one,
  so the directory has the durable substrate `ADR-0009` names. No remote is configured.

**Connector credential (`LR-02`, `BR-0135`, `BR-0201`)**

- **FR-LPW-020**: An authorised person MUST be able to mint a **connector credential** scoped to
  exactly one project, at provisioning and on demand.
- **FR-LPW-021**: The credential value MUST be shown **once**, and stored only as a hash. PMI Studio
  MUST NOT be able to re-display it.
- **FR-LPW-022**: Every credential MUST carry a label, creator, creation time, last-used time and
  revocation time.
- **FR-LPW-023**: A credential MUST be revocable by an authorised person; revocation MUST be
  immediate, audited and irreversible.
- **FR-LPW-024**: The credential value MUST NOT be written into any file under the root path, by
  provisioning or by any later PMI Studio action.
- **FR-LPW-025**: A credential presented for a project other than its own MUST be refused **without
  disclosing** that project's existence (the `EPIC-004` non-disclosure rule).
- **FR-LPW-026**: A credential MUST authorise only the operations later Epics bind to it
  (`EPIC-043`'s contract, artifact and task sync). It MUST NOT authorise reading a Room, approving a
  transition, or administering the workspace.
- **FR-LPW-027**: Minting MUST require the owner grant on the project; any other identity MUST be
  refused and the refusal audited.
- **FR-LPW-028**: A credential MUST NOT expire on its own in this Epic; it ends only by revocation
  *(clarified 2026-09-03)*. An expiry window is a tenant policy setting for a later Epic, alongside
  the policy classes `EPIC-030` reads, and MUST NOT be introduced here as a second policy model.

**Controlled-local execution mode (`BR-0132`, `BR-0133`, Constitution XII)**

- **FR-LPW-030**: The execution contract MUST admit an environment kind **controlled local** whose
  workspace binding is **persistent** and names a root path.
- **FR-LPW-031**: The governance contract MUST apply identically to a controlled-local execution
  and a managed one (`BR-0133`). No rule MAY be relaxed on the basis of mode.
- **FR-LPW-032**: A controlled-local execution MUST be registrable through the universal execution
  contract with surface `local-cli` or `mcp-client` (`BR-0132`, `BR-0202`); the connector that does
  so is `EPIC-043`'s to build.
- **FR-LPW-033**: The managed provider's refusal of persistent bindings MUST remain in force **for
  the managed provider** and MUST NOT be generalised to the contract.
- **FR-LPW-034**: Every execution MUST carry an **assurance** value — `managed` or `local` —
  derived from its environment kind and never supplied by the caller (`LR-11`).
- **FR-LPW-035**: Controlled-local MUST be the **default** mode for a project with a root path;
  managed isolated remains available and unchanged (`ADR-0024` as amended by PMI-DOC-007 §9.2).

**Foundational wiring repairs (PMI-DOC-004B §2.1)**

- **FR-LPW-040**: The worker MUST persist a completed generation — specification, version and
  traceability links — through the platform's real store. The failing placeholder MUST be removed.
- **FR-LPW-041**: Tasks, runs and generation jobs MUST be held in durable stores in the composed
  application; the in-memory implementations MAY remain only for tests.
- **FR-LPW-042**: A generation and a run MUST be startable from the project screen, and their
  progress readable there, through the real entry points (Constitution XI, Tier 1). Retained in
  scope *(clarified 2026-09-03)* as `D-47`'s milestone `M0`, even though the managed sandbox it
  serves is an optional mode after the replan.
- **FR-LPW-043**: The composed module graph MUST be checked by an architecture test that fails when
  a task, run or job store is an in-memory implementation.
- **FR-LPW-044**: The six built-but-unmounted components recorded in PMI-DOC-004B §2.1 (version
  history, version diff, validation findings, job progress, lifecycle controls, access grants) MUST
  either be reachable from a screen or be recorded as a named deferral in this Epic's closing
  report. Reachability is not assumed from existence.

**Screens (`BR-0010`; PMI-DOC-006 areas *Projects* and *Workspace & Administration*)**

- **FR-LPW-050**: The create-project form MUST take root path, agent integration and script type,
  with defaults from configuration, and MUST show the credential value once on success.
- **FR-LPW-051**: The project screen MUST show provisioning state, path, integration, script type,
  Spec Kit tag, extension version, and the failed step where one exists, in the four states
  `FR-SHL-060` requires.
- **FR-LPW-052**: A credentials list under *Workspace & Administration* MUST show every credential
  with `FR-LPW-022`'s fields, filterable (`PMI-DOC-005`), with mint and revoke actions gated by
  `FR-LPW-027`.
- **FR-LPW-053**: The value of a credential MUST appear on no screen after the one that showed it.

### Key Entities

- **Project Workspace** — the root path, agent integration, script type and provisioning state of a
  project; one per project; the path unique within the workspace.
- **Provisioning Record** — one attempt: actor, time, steps completed, step failed, versions
  written. Append-only; the project's state is the latest record's outcome.
- **Connector Credential** — a project-scoped secret held as a hash: label, creator, created, last
  used, revoked. Authorises the integration contract for one project and nothing else.
- **Execution Environment Kind** — `managed-isolated` (existing) or `controlled-local` (new), with
  the lifecycle and workspace binding each admits.
- **Assurance** — a value on every execution, `managed` or `local`, derived from the environment
  kind. Recorded so a reviewer knows what a piece of evidence rests on; never a switch that changes
  a rule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-LPW-001**: A first-time user goes from *create project* to *a directory open in their
  agent* in **under two minutes**, on one screen, with no step outside PMI Studio except opening the
  folder.
- **SC-LPW-002**: **100%** of provisioned directories pass a structural check for the chosen
  integration: `.specify/` present, extension hooks registered, setup skill present,
  `.pmi/project.json` and `.mcp.json` conformant.
- **SC-LPW-003**: **Zero** files under any root path contain a credential value — mutation-tested by
  making provisioning write the value into `.mcp.json` and observing the suite fail.
- **SC-LPW-004**: A second provisioning of a provisioned project changes **zero** files, every time.
- **SC-LPW-005**: **100%** of refusals name their reason — path outside root, non-empty, owned by
  another project, root unavailable — and **zero** refusals leave a file behind.
- **SC-LPW-006**: A credential opens **exactly one** project — mutation-tested by removing the
  project-scope check and observing the suite fail.
- **SC-LPW-007**: After an application restart, **100%** of tasks, runs and generation jobs created
  before it are still readable.
- **SC-LPW-008**: A generation submitted from the project screen is persisted and its result
  readable there, through the real route, with **zero** hand-assembled composition in the test.
- **SC-LPW-009**: **100%** of executions carry an assurance value, and **zero** were supplied by the
  caller.
- **SC-LPW-010**: A running-application transcript of User Story 1 and User Story 2 is recorded
  before closure (Constitution XI, Tier 2).

## Assumptions

Six judgement calls, each with the alternative that lost. **Five were put to the requester on
2026-09-03 and all five confirmed**; the sixth (5) was not asked, being low-impact and reversible
at the plan step, and stands as recorded. The reasoning is kept because it describes the risk each
confirmation accepts.

1. **Provisioning is performed by the platform, on the host it runs on, under a configured projects
   root** (`FR-LPW-005`, `FR-LPW-007`) — **confirmed**. In the reference-local stack that is the developer's own
   file system; in the containerised stack it is a directory mounted into the application. The
   alternative — provisioning performed on the user's machine by the setup skill, with PMI Studio
   only recording the path — keeps PMI Studio free of file-system writes but makes *create project*
   a two-machine act and leaves PMI Studio unable to say whether the directory exists. **Remote PMI
   Studio with a directory on a different machine is out of scope** here; it is the customer-cloud
   mode (`BR-0131`) and a later Epic.
2. **Greenfield only, plus adoption of an empty git repository** (`FR-LPW-012`) — **confirmed**.
   Adopting an
   existing, populated repository (brownfield) is genuinely useful and genuinely different: it needs
   a merge strategy for an existing `.specify/`, existing skills and an existing `.mcp.json`. It is
   deferred rather than half-done; the one merge this Epic does perform is the `.mcp.json` entry
   (edge case above), because an adopted empty repository may already carry one.
3. **The Spec Kit initialiser may be absent on the provisioning host, and that is a recorded state,
   not a failure** (`FR-LPW-010`) — **confirmed**. The containerised application image does not
   carry Spec Kit today; the engine image does. Rather than make provisioning depend on an image
   change, the record says *initialisation pending* and `EPIC-042`'s setup skill completes it on
   the user's machine. The alternative — bake the initialiser into the application image — was
   put to the requester and **declined**: the image is not required to carry it.
4. **Credentials do not expire by default; they are revocable and their last use is visible**
   (`FR-LPW-022`, `FR-LPW-023`, `FR-LPW-028`) — **confirmed**. An expiry policy is a tenant setting that belongs with the other
   policy classes `EPIC-030` reads; adding one here would put a second policy model in the
   platform. The alternative — a fixed ninety-day expiry — is safer and more annoying; it can be
   added as configuration without changing this Epic's contract.
5. **A git repository is initialised where none exists, with no remote** (`FR-LPW-013`) — **not
   asked; stands as recorded**.
   `ADR-0009` names git as the durable substrate, and PMI-DOC-007 §2.3 keeps that for local mode.
   Configuring a remote is a credentials question and a hosting question — `EPIC-039`'s. The
   alternative — no git at all — leaves the user with a directory that Spec Kit can use and
   nothing that versions it.
6. **The Foundational wiring repairs are in scope** (`FR-LPW-040`–`FR-LPW-044`) — **confirmed**,
   including the screen control for a sandbox generation, even though they predate the replan. `D-47` places them here because *nothing local is demonstrable while the
   worker throws on persistence*. The alternative — a separate repair Epic — would put the first
   demonstrable milestone behind two Epics instead of one.

**Back-fill owed**: `LR-01`, `LR-02`, `LR-11` receive `BR-` identifiers in PMI-DOC-004 v2.1, owner
Project Owner, before the platform release gate.

**Dependencies**: `EPIC-004` (workspace scoping and the non-disclosure rule `FR-LPW-025` reuses),
`EPIC-006` (the project the workspace belongs to), `EPIC-024` (the owner grant `FR-LPW-027` checks),
`EPIC-028` (the execution contract `FR-LPW-030` extends), `EPIC-036` (the shell the screens are
areas of), `EPIC-037` (the registration `FR-LPW-032` names; the connector itself is `EPIC-043`).
**Depended on by**: `EPIC-043`, `EPIC-042`, and through them `EPIC-044`–`EPIC-046`.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/041-local-project-workspace/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`FR-LPW-024` is mutation-tested**: provisioning is made to write the credential value into
      a file under the root path, and the suite observed failing (`SC-LPW-003`). A credential in a
      directory the user will commit is the one failure this Epic cannot walk back
- [ ] **`FR-LPW-025` is mutation-tested**: the project-scope check is removed, and the suite
      observed failing (`SC-LPW-006`)
- [ ] **`FR-LPW-043` holds**: the architecture test that refuses an in-memory task, run or job store
      in the composed application is green
- [ ] **Constitution XI Tier 2**: a generated transcript of User Story 1 and User Story 2 against
      the running application is recorded (`SC-LPW-010`)
- [ ] `ADR-0030` is written and `ADR-0009`, `ADR-0024` amended as PMI-DOC-007 §9.2 requires, at the
      plan step; `ADR-0017` is closed at this Epic's closure
