# Feature Specification: PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Feature Branch**: `epic/042-pmi-spec-kit-extension`

**Epic**: `EPIC-042` — PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "PMI Spec Kit Extension — the `pmi` Spec Kit extension with
`speckit.pmi.begin`, `finish` and `progress` commands hooked before and after every governed
command; the `/setup-PMIStudio` skill; the Constraints screen; the generated constitution; the
decomposition policy and the first-run decomposition of requirements into one specification per
Epic." *(PMI-DOC-007 §7, verbatim)*

> **This is the third Epic of the local-first replan** (`D-47`, PMI-DOC-007 v1.0) and the one that
> reaches milestone **M2 — governed first run**: *requirements and constraints from PMI Studio; one
> specification per Epic; the constitution generated*. `EPIC-041` gave a project a directory on the
> user's machine, a credential that opens exactly that project, and an installation mechanism for
> a Spec Kit extension that deliberately carried **no commands and no hooks**. `EPIC-043` gave the
> user's agent a `pmi-studio` server: the execution tools, the reads a first run needs, and two
> tools — `pmi.constitution.get` and `pmi.project.decompose` — **reserved by name** with a refusal
> that says *`EPIC-042` supplies this*. This Epic supplies it. It writes the extension's content so
> that every governed command in a provisioned directory is registered before it starts and
> completed after it ends without the user doing anything; it replaces the hand-off half of
> `/setup-PMIStudio` with the full toolchain check; it gives a project owner a Constraints screen
> whose output is the project's constitution file, generated and drift-detected; and it turns the
> first `/speckit-specify` from a blank page into one specification per Epic under a stored
> decomposition policy with human-confirmed splits.
>
> **Six judgement calls were made in writing this document**, each listed under **Assumptions**
> with the reasoning and the alternative, so that `/speckit-clarify` can confirm or overturn them
> with the requester. No `[NEEDS CLARIFICATION]` marker is used: every call has a defensible
> default and none changes whether the Epic should exist.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §7 `EPIC-042` brief (`US1`–`US4`, `FR-EXT-001`, `FR-EXT-010`, `FR-EXT-020`) | every `FR-EXT-` below |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §5.1 why an extension · §5.2 hook map · §11 `R-02`, `R-07`, `R-08` · §12 `D-8` | FR-EXT-001 to FR-EXT-019 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §5.4 the generated constitution · §2.3 source-of-truth boundaries · §9.2 constitution 1.6.1 · §12 `D-3` | FR-EXT-020 to FR-EXT-029, FR-EXT-071 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §5.3 `/setup-PMIStudio` · §2.2 step 4 · §11 `R-04` | FR-EXT-030 to FR-EXT-039 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §5.5 first-run decomposition · §2.2 step 5 · §12 `D-4` | FR-EXT-040 to FR-EXT-049 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §3 domain model — `DecompositionPolicy`, `ProjectConstraint`, `ConstitutionRender` · §4.1 the two `(042)` tools · §4.2 the two `(042)` routes | FR-EXT-020, FR-EXT-040, FR-EXT-060 to FR-EXT-064 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §6 surfaces — Constraints editor, constitution preview, *file differs* warning | FR-EXT-065 to FR-EXT-068 |
| `SRS/PMI-DOC-007_Local_First_Replan_v1.0` | §9.3 `LR-04`, `LR-05`, `LR-06` | FR-EXT-020, FR-EXT-030, FR-EXT-040 |
| `SRS/PMI-DOC-004B_…Objective_Verification_and_Replan_v0.1` | §5.2 `O-3`, `O-5`, `O-6` | FR-EXT-020, FR-EXT-030, FR-EXT-040 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.22 `BR-0196` universal registration · `BR-0198` phase-aware binding · `BR-0201` contract not database · `BR-0202` strict and provisional | FR-EXT-010 to FR-EXT-016, FR-EXT-050 to FR-EXT-056 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.8 `BR-0070` hierarchical steering · `BR-0072` constraint types | FR-EXT-021, FR-EXT-023, FR-EXT-060 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.4 `BR-0037` extension governance · §6.13 `BR-0122` MCP support | FR-EXT-002, FR-EXT-003, FR-EXT-011 |
| `specs/041-local-project-workspace/spec.md` | `FR-LPW-002`, `FR-LPW-005`, `FR-LPW-006`, `FR-LPW-010`, `FR-LPW-024` — provisioning, the bundle version, no engine named, pending initialisation, no credential under the root | FR-EXT-002, FR-EXT-030 to FR-EXT-036 |
| `specs/043-pmi-integration-contract/spec.md` | `FR-PIC-002`, `FR-PIC-007`, `FR-PIC-027`, `FR-PIC-034`, `FR-PIC-040` to `FR-PIC-046` — the reserved tools, environment-only credential, structured refusals, reserved sync, the reads, `pmi.health` | FR-EXT-012 to FR-EXT-016, FR-EXT-037, FR-EXT-047, FR-EXT-050, FR-EXT-060 to FR-EXT-062 |
| `specs/037-governed-execution-registry/contracts/execution-contract.md` | registration, events, completion with output binding, `partially-completed`, provisional intake (`US4`, reserved) | FR-EXT-012 to FR-EXT-016, FR-EXT-050 to FR-EXT-056 |
| `specs/019-steering-engine/` | steering documents resolved per scope, ordered broadest to narrowest (contract rule `S3`) | FR-EXT-023 |
| `.specify/memory/constitution.md` | I — Spec Kit Command Gate (stock skills are governance files, never application code) · XII — Execution Registration, in particular XII.1 strict and provisional | FR-EXT-001, FR-EXT-010, FR-EXT-020, FR-EXT-050 |
| `adr/ADR-0030` | local-first execution: PMI Studio supplies requirements, constitution and policy through a contract | FR-EXT-020, FR-EXT-040, FR-EXT-070 |

**Requirements not yet covered by SRS**: none by document — every requirement traces to
PMI-DOC-007, which lives in `SRS/`. **Three carry provisional identifiers** (`LR-04`, `LR-05`,
`LR-06`) that receive `BR-` numbers only in PMI-DOC-004 v2.1; the back-fill is owed by the Project
Owner before the platform release gate and is restated under Assumptions (the `D-46` pattern, as
`EPIC-041` and `EPIC-043`).

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | The first run of the agent starts from PMI Studio's requirements, not a blank prompt (`FR-EXT-040`); this document precedes the extension |
| PP-002 | Single Source of Truth | Satisfied | Constraints, policy and steering live in PMI Studio; the constitution file is a **render** with a digest, never a second source (`FR-EXT-020`, `FR-EXT-024`, `D-3`) |
| PP-003 | Human-in-the-Loop | Satisfied | A split above the ceiling is proposed by the agent and confirmed by a person (`FR-EXT-043`); a drifted constitution is never overwritten silently (`FR-EXT-026`) |
| PP-004 | End-to-End Traceability | Satisfied | Every governed command becomes an execution with input binding at registration and output digests at completion (`FR-EXT-012`, `FR-EXT-014`) |
| PP-005 | Modular Architecture | Satisfied | The extension is a separate, versioned bundle half; the stock skills are untouched (`FR-EXT-001`); policy and constraints are their own records |
| PP-006 | Engine Independence | Satisfied | The extension's *installation* names no agent (`EPIC-041`); the hook commands call `pmi-studio` tools and have no shell of their own (`R-03`); the setup skill reads the integration from `.pmi/project.json` (`FR-EXT-031`) |
| PP-007 | API & MCP First | Satisfied | The two new reads are tools **and** routes with one content (`FR-EXT-060`, `FR-EXT-061`); the Constraints screen calls the same services |
| PP-008 | Security by Design | Satisfied | No credential value is asked for, printed or written by the skill or any hook (`FR-EXT-036`); `.mcp.json` entries carry `${VAR}` references only (`FR-EXT-034`); mutation-tested (`SC-EXT-005`) |
| PP-009 | Quality by Design | Satisfied | Stock-skill immutability is checked by digest (`SC-EXT-001`); the rendered constitution is checked against the invariant text (`SC-EXT-009`); both mutation-tested |
| PP-010 | Observability by Default | Satisfied | Every hook outcome — registered, completed, refused, queued — is an execution event or a structured refusal the user sees (`FR-EXT-017`); the setup skill ends with a table on every run (`FR-EXT-038`) |
| PP-011 | Documentation as Code | Satisfied | The extension manifest, the three commands and the setup skill **are** documents, versioned in the bundle and checked by executable conformance tests (`FR-EXT-003`) |
| PP-012 | Everything Versioned | Satisfied | Constraints, the policy and every constitution render carry a version and a digest (`FR-EXT-024`); the extension declares the toolkit version it requires (`FR-EXT-004`) |
| PP-013 | Knowledge-Driven Engineering | Not applicable | No retrieval concern; `EPIC-038` is held (§9.4) |
| PP-014 | Configuration over Customization | Satisfied | Offline mode, the ceiling and one-spec-per-Epic are policy values with defaults, not code paths (`FR-EXT-040`, `FR-EXT-051`) |
| PP-015 | Open Standards | Satisfied | Spec Kit's own extension and hook system, unmodified; MCP for every call (`D-8`) |
| PP-016 | Explainable AI | Satisfied | A proposed split states the seam and the estimate per child so a person can judge it (`FR-EXT-043`) |
| PP-017 | Cost-Aware AI | Partial | The first run asks the agent for **one estimate per Epic before writing anything** (`FR-EXT-042`), which bounds the work; token accounting itself is `EPIC-040`'s (held) |
| PP-018 | Scalability First | Satisfied | A first run over *N* Epics is *N* independent executions; a project with one Epic pays nothing for the loop |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Command durations and provisional-sync rates are inputs to `EPIC-040` Metrics & Reporting (held per §9.4); nothing is derived here |
| PP-020 | Customer Value | Satisfied | `SC-EXT-008` — milestone `M2`: constraints and requirements entered in PMI Studio become a generated constitution and one registered specification per Epic in a single session |

**Deferral count**: 1 — `PP-019`, owner `EPIC-040` (held), reviewed at this Epic's convergence
gate. `PP-017` is partial with its discharging requirement named (`FR-EXT-042`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every command I run is governed without my doing anything (Priority: P1)

As a developer working in a directory PMI Studio provisioned, I run any `/speckit-*` command the
way I always have. Before it starts, PMI Studio has registered it; after it ends, PMI Studio has
its outcome, the digests of the files it produced and a completion comment. I typed nothing extra,
and no stock Spec Kit file was changed to make this happen.

**Why this priority**: this is the mechanism milestone `M2` rests on and the thing `EPIC-041`'s
empty extension manifest promised. Constitution XII says every governed command **must** be
recorded; until the hooks exist, recording depends on the agent remembering an instruction in the
constitution, which is a hope and not a control. It is P1 because every other story in this Epic
(first-run decomposition, constitution refresh, provisional mode) runs *inside* these hooks.

**Independent Test**: in a provisioned directory with a valid credential and a reachable platform,
run `/speckit-plan` for an existing Epic; the project's execution timeline shows one execution
with command `plan`, surface `mcp-client`, an input binding naming the Epic and the `spec.md`
digest, events for begin and finish, a completion with the `plan.md` digest and a comment; then
compute the digests of the ten stock skill files and confirm they equal the pinned manifest.

**Acceptance Scenarios**:

1. **Given** a provisioned directory whose extension carries this Epic's content, **When** any
   governed command begins, **Then** its `before_*` hook registers an execution naming the command,
   the Epic where one is known, and the input binding (repository, branch, the digests of the
   Epic's current files) — and the stock command runs only after registration succeeds.
2. **Given** a registered execution, **When** the stock command ends, **Then** the `after_*` hook
   completes it with outcome, the digests of the Epic's files as generated artifacts, and a
   completion comment stating what changed; `/speckit-implement` completes as
   `partially-completed` when unchecked tasks remain.
3. **Given** the ten stock skill files pinned in the integration manifest, **When** the extension is
   installed or any hook runs, **Then** every stock file's digest is unchanged — the extension adds
   files and registers hooks, and edits nothing upstream owns.
4. **Given** `pmi.artifacts.sync` and `pmi.tasks.sync` are still reserved (`EPIC-045`, `EPIC-046`),
   **When** the finish hook calls them, **Then** their *not available until* refusal is reported
   once as information, the execution is still completed with its digests, and nothing is retried.
5. **Given** the platform is unreachable and the project's offline mode is **strict**, **When** a
   governed command begins, **Then** the hook refuses with a message naming the platform address
   and the mode, and the stock command does not run.

---

### User Story 2 - My first specify produces one specification per Epic (Priority: P1)

As a developer running `/speckit-specify` for the first time in a provisioned project, I am shown
a plan — one specification per Epic, each with its requirement bundle and an estimate — with any
Epic whose estimate exceeds the ceiling shown beside a proposed split awaiting my confirmation.
When I confirm, the stock specify flow runs once per Epic with that Epic's requirements as its
input, and every run is its own registered execution.

**Why this priority**: it is objective `O-6` and the reason the reads `EPIC-043` built exist. It is
how PMI Studio's requirements become the agent's input rather than a document the user pastes. It
is P1 because milestone `M2` names it.

**Independent Test**: against a project with three Epics — two under the ceiling and one whose
requirement bundle produces an estimate above it — run `/speckit-specify`; the plan lists three
Epics and one proposed split; after confirming the split into two, the timeline shows four
`specify` executions, the directory holds four specification directories, and the first-run
marker is gone; a second `/speckit-specify` is a single-Epic run.

**Acceptance Scenarios**:

1. **Given** a provisioned project in first-run state, **When** `/speckit-specify` begins, **Then**
   the hook calls `pmi.project.decompose` and shows one line per Epic: number, name, requirement
   count and the agent's estimate — before any file is written.
2. **Given** an Epic whose estimate exceeds the ceiling, **When** the plan is shown, **Then** it
   carries a proposed split into two or more children along functional seams with an estimate
   each, and nothing proceeds for that Epic until a person confirms, edits or rejects the split.
3. **Given** a confirmed plan, **When** the loop runs, **Then** the stock specify flow runs once per
   delivery Epic with that Epic's requirement bundle as its input, each run registered and
   completed as its own execution bound to the Epic.
4. **Given** the loop completed, **When** the first-run marker is removed and PMI Studio has
   recorded the decomposition, **Then** a later `/speckit-specify` takes one Epic from its argument
   or the feature file and registers one execution.
5. **Given** a project with **no** Epic and **no** baselined or approved requirement, **When**
   `/speckit-specify` begins for the first time, **Then** the hook says so, names where
   requirements are entered, and runs nothing.

---

### User Story 3 - The constitution is what I wrote in PMI Studio (Priority: P1)

As a project owner, I write the project's principles, constraints and non-goals on a Constraints
screen in PMI Studio, see the constitution that will be generated with its digest, and know that
the project directory's constitution file is regenerated from it — and that if someone edits the
file by hand, PMI Studio shows me *file differs* rather than pretending.

**Why this priority**: objective `O-3` and decision `D-3` — *PMI is the source; the file is
generated*. Without it, the constitution is a hand-maintained file the platform cannot see, and
every governed command is run against rules the platform never approved. It is P1 because `M2`
names *constitution generated*.

**Independent Test**: enter two principles, one constraint and one non-goal; the preview shows
them under the headings in order with the invariant Governed Execution section; run
`/setup-PMIStudio` in the directory; the file matches the preview's digest; edit the file by hand;
the next governed command reports drift and PMI Studio shows *file differs*; change a constraint in
PMI Studio; the next governed command regenerates the file after confirmation and the warning
clears.

**Acceptance Scenarios**:

1. **Given** the Constraints screen, **When** an owner adds, edits, reorders or retires an entry of
   kind principle, constraint or non-goal, **Then** the entry is versioned and the constitution
   preview and its digest update.
2. **Given** a render, **When** it is read through `pmi.constitution.get` or its route, **Then** it
   is the same content and digest the preview shows, with a header naming the project, the
   constitution version and the digest, and the Governed Execution section byte-identical to the
   platform's invariant text.
3. **Given** a provisioned directory, **When** `/setup-PMIStudio` or the begin hook of any governed
   command runs, **Then** the on-disk file is compared by digest with the last render: if it
   matches an older render it is refreshed; if it matches no render it is **drift** and is not
   overwritten until the person confirms.
4. **Given** drift reported by a hook or by `pmi.health`, **When** the project screen or the
   Constraints screen is opened, **Then** it shows *file differs* with the render version it last
   matched, until a later report says the file matches again.
5. **Given** steering documents resolved for the project (`EPIC-019`), **When** the constitution is
   rendered, **Then** its Steering section carries them in resolution order and nothing else.

---

### User Story 4 - `/setup-PMIStudio` leaves me green or tells me exactly what to do (Priority: P1)

As a developer who has just opened a provisioned directory in my agent, I run
`/setup-PMIStudio` and end with a table: one row per check, each green or carrying the precise
instruction that makes it green — and the last row proves the credential opens this project.

**Why this priority**: it is objective `O-5`, the front half of milestone `M1` that `EPIC-041`
shipped as a hand-off, and what stands between a provisioned directory and the first governed
command. It is P1 because every other story assumes a working toolchain and a verified credential.

**Independent Test**: on a machine with `uv` absent, run the skill: the table has a red `uv` row
with the platform-specific instruction and the later rows marked *skipped*; install `uv`, rerun:
the toolkit is installed at the pinned version after the command is shown, the extension is
verified against the version PMI Studio reports, `.mcp.json` gains the missing entries with
`${VAR}` references only, and the last row shows `pmi.health` succeeded with the project id — and
the workstation panel in PMI Studio shows the connection.

**Acceptance Scenarios**:

1. **Given** a directory without `.pmi/project.json`, **When** the skill runs, **Then** it stops at
   the first row and explains that a project is created in PMI Studio first.
2. **Given** a toolkit missing or at a version other than the one `.pmi/project.json` pins,
   **When** the skill runs, **Then** it shows the install command, runs it, and verifies the version
   — and for `uv`, Node and Docker it guides and never installs.
3. **Given** the extension absent or older than the version `pmi.project.context` reports, **When**
   the skill runs, **Then** it re-copies the extension at the reported version and merges its hook
   fragment without touching another extension's entries.
4. **Given** `PMI_STUDIO_TOKEN` unset, **When** the skill runs, **Then** it says where a credential
   is minted and how to export it, never asks for the value, and marks the health row *skipped*.
5. **Given** every check green, **When** the skill ends, **Then** `pmi.health` has been called, the
   table's last row carries the project id, contract version and API version it returned, and PMI
   Studio's workstation panel shows the connection with the extension and toolkit versions.

---

### User Story 5 - When PMI Studio is unreachable, I know exactly where I stand (Priority: P2)

As a developer whose project policy permits provisional operation, I run a governed command while
PMI Studio is unreachable: a durable provisional record is created before the command runs, its
events are kept locally, it is marked as queued for sync, and everything that shows it — the
hook's output, the record itself — says **not yet governed**. When the platform is reachable
again, the queue is offered for reconciliation.

**Why this priority**: `BR-0202` and Constitution XII.1 name provisional mode as the only lawful
alternative to blocking. It is P2 because strict mode (US1 scenario 5) is the default and is
complete without it; the *producing* side is this Epic's, while the *accepting* side stays
`EPIC-037`'s reserved intake (`FR-PIC-034`).

**Independent Test**: set the project's offline mode to provisional; make the platform
unreachable; run `/speckit-clarify`; a provisional record exists under the project's PMI directory
with a client-generated execution id, correlation id, idempotency key, a queued-for-sync event and
the label *not governed*; restore the platform; the next hook offers the queue to
`pmi.execution.sync` and reports its *not available until `EPIC-037`* refusal without losing the
record.

**Acceptance Scenarios**:

1. **Given** offline mode **provisional** and the platform unreachable, **When** a governed command
   begins, **Then** a durable provisional record is written before the command runs, carrying a
   client-generated execution id, correlation id and idempotency key, and an immutable
   `execution-sync-queued` event.
2. **Given** a provisional record, **When** the command ends, **Then** its completion is appended
   locally in the same event shape the contract defines, and nothing about it claims to be governed.
3. **Given** queued records and a reachable platform, **When** the next governed command begins,
   **Then** the hook submits the queue to `pmi.execution.sync` before registering the new command;
   an acceptance removes the record; a *not available until* refusal keeps it and is reported once.
4. **Given** offline mode **strict** (the default), **When** the platform is unreachable, **Then** no
   provisional record is written and the command does not run (US1 scenario 5).

---

### Edge Cases

- **The credential is valid but the toolkit is not installed.** The setup skill's rows are ordered so
  the toolkit row comes before any row that needs it; later rows are *skipped*, not red.
- **`.mcp.json` exists and does not parse.** The skill leaves it exactly as it is, says so, and marks
  the row red with the file path; it never rewrites a file it could not read (`EPIC-041`'s rule).
- **The stock command fails or is interrupted after registration.** The finish hook never runs; the
  execution stays registered and non-terminal on the timeline. The next begin hook in the same
  directory finds it, reports it, and offers to complete it as `failed` with a comment before
  registering the new command. It never completes it silently.
- **A hook runs in a directory that is a PMI project but whose credential is for another project.**
  The one refusal `EPIC-043` defines; the hook shows it and stops; it does not fall back to
  provisional mode, because *refused* is not *unreachable*.
- **The constitution file is missing.** Not drift — it is written from the current render and
  reported as *restored*.
- **Two governed commands run concurrently in one directory** (two agent sessions). Each registers
  its own execution with its own idempotency key; the constitution refresh is idempotent; the
  first-run loop refuses to start while another first-run execution is non-terminal.
- **The decomposition ceiling is changed while a first run is in progress.** The plan shown was
  computed against the policy version it names; a later Epic in the loop is not re-estimated
  against the new ceiling; the completion comment records the policy version used.
- **A split is rejected.** The Epic stays whole and is specified whole; the rejection is recorded
  with the estimate so the next `/speckit-tasks` can surface the ceiling again.
- **An Epic's estimate is exactly the ceiling.** Not above; no split is proposed.
- **The Governed Execution section is edited by hand in PMI Studio's own constraint entries** (an
  owner writes a principle with that heading). The render keeps the invariant section as its own,
  places the owner's entry under Core Principles, and the preview says why.
- **Provisional mode is permitted but the disk is not writable.** The hook refuses as strict mode
  would, naming the path; a provisional record that cannot be made durable is not a record.

## Requirements *(mandatory)*

### Functional Requirements

**The extension**

- **FR-EXT-001**: The extension MUST NOT modify any stock Spec Kit skill file: installation and every
  hook run MUST leave the ten pinned skill files byte-identical to the integration manifest, and
  MUST be asserted by an executable check that computes their digests (`D-8`, `R-08`, Constitution I).
- **FR-EXT-002**: The extension MUST ship as the content half of the workspace bundle `EPIC-041`
  installs — manifest, three command files, hook fragment — at one bundle version recorded on the
  provisioning record and reported by `pmi.project.context` (`FR-LPW-005`, `FR-LPW-008`, `BR-0037`).
- **FR-EXT-003**: The manifest, the three commands and the hook fragment MUST be checked by
  executable conformance tests: every hook in the map names a command the extension provides; every
  command names only `pmi-studio` tools that exist in `EPIC-043`'s surface; no command carries a
  shell of its own (`R-03`).
- **FR-EXT-004**: The extension MUST declare the toolkit version range it requires; the setup skill
  MUST verify the pinned toolkit tag satisfies it and say so when it does not (`R-02`).
- **FR-EXT-005**: The extension MUST register hooks for every governed command the hook map names —
  `specify`, `clarify`, `checklist`, `plan`, `tasks`, `analyze`, `implement`, `converge`,
  `constitution` — with `speckit.pmi.begin` before and `speckit.pmi.finish` after, and MUST register
  nothing for a command the map does not name.
- **FR-EXT-006**: Where the toolkit offers no in-flight hook for `/speckit-implement`,
  `speckit.pmi.progress` MUST be provided as a command the finish hook invokes to emit one
  `progress-reported` event per task ticked since registration, derived from the `tasks.md` diff;
  the limitation MUST be recorded in the extension's documentation and the closure record (`R-07`).

**Registration through the hooks**

- **FR-EXT-010**: Every hook MUST degrade to a clear refusal when PMI Studio is unreachable in
  strict mode: the refusal names the platform address, the mode and where the mode is changed, and
  the stock command MUST NOT run (`BR-0202`, Constitution XII.1).
- **FR-EXT-011**: Every hook MUST call PMI Studio only through the `pmi-studio` tools, MUST supply
  no credential in any argument, and MUST read the credential from nowhere (`FR-PIC-007`,
  `FR-PIC-026`, `BR-0201`).
- **FR-EXT-012**: `speckit.pmi.begin` MUST register the command before it runs with: the command
  name, the Epic where one is known, a correlation id, an idempotency key, and the input binding —
  repository, branch, worktree, the commit before, and the digests of the Epic's current artifact
  files (`BR-0198`, XII.3).
- **FR-EXT-013**: `speckit.pmi.begin` MUST, before registering, refresh the constitution
  (`FR-EXT-025`), report constitution drift where found (`FR-EXT-026`), submit any provisional queue
  (`FR-EXT-055`), and report any non-terminal execution left in the directory (Edge Cases).
- **FR-EXT-014**: `speckit.pmi.finish` MUST complete the execution with the outcome, the output
  binding — the commit after where one exists and the digests of the Epic's artifact files as
  generated artifacts — and a completion comment stating which files changed (XII.4).
- **FR-EXT-015**: For `/speckit-implement`, `speckit.pmi.finish` MUST complete as
  `partially-completed` when unchecked tasks remain and `completed` otherwise, after emitting the
  progress events of `FR-EXT-006`.
- **FR-EXT-016**: `speckit.pmi.finish` MUST call `pmi.artifacts.sync` and, after `/speckit-tasks`
  and `/speckit-implement`, `pmi.tasks.sync`; while either is reserved, its *not available until*
  refusal MUST be reported once as information, MUST NOT fail the completion, and MUST NOT be
  retried (`FR-PIC-002`, `FR-PIC-045`).
- **FR-EXT-017**: Every hook outcome — registered, completed, refused, queued, drift, restored —
  MUST be shown to the user in the agent's output in one line naming the execution id where one
  exists, so the transcript is evidence (Constitution XI).
- **FR-EXT-018**: A begin hook that finds a registered, non-terminal execution for the same
  directory from an earlier run MUST report it and offer to complete it as `failed` with a comment
  before registering; it MUST NOT complete it silently and MUST NOT register over it.

**The generated constitution**

- **FR-EXT-020**: The constitution's *Governed Execution* section MUST be invariant text owned by
  PMI Studio, rendered byte-identical into every project constitution, carrying Constitution XII's
  intent — register before, complete after, never write to the database, never approve your own
  transition, stop when unreachable unless policy permits provisional records — and MUST NOT be
  editable from the Constraints screen (`LR-04`, `D-3`).
- **FR-EXT-021**: A project owner MUST be able to author project constraints of kind **principle**,
  **constraint** and **non-goal**, each with a title, a body and an order, versioned on every
  change and retirable, through the Constraints screen and the platform API (`BR-0072`).
- **FR-EXT-022**: The render MUST have the shape PMI-DOC-007 §5.4 gives: a generated-file header
  naming the project, the constitution version and the digest, and the sections Core Principles,
  Constraints, Non-goals, Decomposition Policy, Governed Execution and Steering, in that order.
- **FR-EXT-023**: The Steering section MUST carry the steering documents `EPIC-019` resolves for
  the project, in resolution order, broadest to narrowest, and nothing else (`BR-0070`).
- **FR-EXT-024**: Every render MUST be recorded — project, constitution version, digest, time,
  content — so that a file on disk can be matched to the render that produced it, or to none.
- **FR-EXT-025**: `/setup-PMIStudio` and `speckit.pmi.begin` MUST compare the on-disk file's digest
  with the recorded renders: a match with the current render is *current*; a match with an older
  render is *stale* and MUST be refreshed; a missing file MUST be written and reported *restored*.
- **FR-EXT-026**: A file whose digest matches no recorded render is **drift**: it MUST NOT be
  overwritten until the person confirms, the difference MUST be shown, and the drift MUST be
  reported to PMI Studio with the digest, so the screens can show it (`FR-EXT-067`).
- **FR-EXT-027**: The Decomposition Policy section MUST be rendered from the stored policy
  (`FR-EXT-040`), and the Governed Execution section MUST state the project's offline mode
  (`FR-EXT-051`), so the agent reads its rules from the file it already reads.
- **FR-EXT-028**: Provisioning (`EPIC-041`) MUST write the current render into a new project
  directory; a project with no constraint yet MUST still receive a valid constitution carrying the
  invariant sections.

**The setup skill**

- **FR-EXT-030**: `/setup-PMIStudio` MUST replace the hand-off half `EPIC-041` shipped, in place and
  at the bundle version, and MUST be idempotent: a second run on a green machine changes nothing
  and reports the same table (`LR-05`).
- **FR-EXT-031**: The skill MUST perform the ten checks PMI-DOC-007 §5.3 lists, in that order, each
  as *check → install or guide → verify*, reading the agent integration, script type, toolkit tag
  and bundle version from `.pmi/project.json` and never guessing a value it does not carry.
- **FR-EXT-032**: The skill MUST install only the toolkit, the extension and configuration files;
  for `uv`, Node, Docker and any system setting it MUST guide with the platform-specific command
  and MUST NOT run an installer (`PP-008`).
- **FR-EXT-033**: The skill MUST show every command before running it and MUST write no file
  outside the project directory.
- **FR-EXT-034**: The skill MUST ensure `.mcp.json` lists the `pmi-studio`, `context7` and `github`
  servers, adding only missing entries, keeping every other entry, and writing credentials as
  `${VAR}` references only (`FR-LPW-024`, `R-04`).
- **FR-EXT-035**: The skill MUST verify the extension is present at the version
  `pmi.project.context` reports and its hooks are registered, re-copying and merging the hook
  fragment when not, without touching another extension's entries.
- **FR-EXT-036**: The skill MUST check only that `PMI_STUDIO_TOKEN` is set, MUST never ask for its
  value, MUST never print it, and MUST never write it to any file — asserted by a test that scans
  the skill's text and mutation-tested (`SC-EXT-005`).
- **FR-EXT-037**: The skill's final check MUST call `pmi.health` and report the project id,
  contract version and API version it returns, or the structured refusal's code, so that PMI
  Studio records the workstation as connected (`FR-PIC-044`, `FR-PIC-046`).
- **FR-EXT-038**: The skill MUST end with a table on every run, including runs that stop early: one
  row per check with state `ok`, `pending`, `missing`, `refused`, `unreachable` or `skipped` and the
  exact next action, or `—`.

**First-run decomposition**

- **FR-EXT-040**: A project MUST hold a decomposition policy — one specification per Epic (default
  on), a task ceiling (default 50), split requires confirmation (default on) — versioned, editable
  by an owner, and rendered into the constitution (`LR-06`, `D-4`).
- **FR-EXT-041**: `pmi.project.decompose` and `GET /v1/projects/{id}/decomposition` MUST return the
  plan for a first run: per Epic its number, slug, name and requirement bundle (reference,
  description, type, priority, baseline state), the policy and its version, and whether the
  project is in first-run state — and nothing from any other project (`FR-PIC-042`).
- **FR-EXT-042**: Before any file is written, the begin hook MUST ask the agent for one task
  estimate per Epic from the requirement bundle alone and MUST show the plan — Epic, requirement
  count, estimate — to the person.
- **FR-EXT-043**: For every Epic whose estimate exceeds the ceiling, the hook MUST present a
  proposed split into two or more children along functional seams, each with its estimate and the
  requirements it takes, and MUST wait for the person to confirm, edit or reject it; an Epic at or
  under the ceiling is never split.
- **FR-EXT-044**: The hook MUST run the stock specify flow once per delivery Epic with that Epic's
  requirement bundle as its input, registering and completing each run as its own execution bound
  to the Epic, and MUST NOT change the stock rule of one feature per invocation (`R-08`).
- **FR-EXT-045**: A confirmed, edited or rejected split MUST be recorded in PMI Studio with the
  estimates, the seams and who decided, bound to the execution, so that `EPIC-044` can create the
  child Epics as product entities from the record; until `EPIC-044`, the children MUST be
  specified as their own specification directories named by the parent's number and a suffix.
- **FR-EXT-046**: First-run state MUST be determined by the marker provisioning writes; the hook
  MUST remove it when the loop completes; a marker present in a project that already has a completed
  `specify` execution MUST be treated as stale and removed without a loop.
- **FR-EXT-047**: After the first run, `/speckit-specify` MUST take one Epic from its argument or the
  feature file and register one execution; the decompose tool MUST report *not first run* and the
  hook MUST NOT show a plan.
- **FR-EXT-048**: A project with no Epic and no baselined or approved requirement MUST be reported
  as *nothing to decompose*, naming where requirements are entered, and no file MUST be written.

**Provisional operation**

- **FR-EXT-050**: Where the platform is unreachable and the project's offline mode permits it,
  `speckit.pmi.begin` MUST create a durable provisional record **before** the command runs, with a
  client-generated execution id, correlation id and idempotency key, and an immutable
  `execution-sync-queued` event; where the record cannot be made durable, the hook MUST refuse as
  strict mode does (`BR-0202`, XII.1).
- **FR-EXT-051**: A project MUST hold an offline mode — **strict** (default) or **provisional** —
  editable by an owner, rendered into the constitution's Governed Execution section, and read by the
  hook from the file it already reads, never from the platform it cannot reach.
- **FR-EXT-052**: A provisional record MUST live under the project's PMI directory, one file per
  execution, in the contract's event shape, so that reconciliation needs no translation.
- **FR-EXT-053**: `speckit.pmi.finish` MUST append the completion to the provisional record in the
  same shape it would send, and every line the hooks print about a provisional execution MUST say
  *not governed*.
- **FR-EXT-054**: A provisional execution MUST NEVER be presented as governed by the hooks, the
  record or the setup skill; it becomes governed only when PMI Studio accepts and reconciles it
  (`BR-0202`).
- **FR-EXT-055**: When the platform is reachable, the next begin hook MUST submit every queued
  record to `pmi.execution.sync` before registering; an acceptance MUST remove the record; a *not
  available until* refusal MUST keep it and be reported once (`FR-PIC-034`).
- **FR-EXT-056**: *Unreachable* and *refused* MUST be distinguished: a credential refusal or a
  forbidden refusal MUST never start provisional operation.

**The reads, the screens and the records**

- **FR-EXT-060**: `pmi.constitution.get` and `GET /v1/projects/{id}/constitution` MUST become live
  with one content — the current render and its digest, version and time — under a connector scope
  added to the registry `EPIC-043` left extensible; the reserved refusal MUST disappear from the
  surface for these two tools only (`FR-PIC-002`).
- **FR-EXT-061**: `pmi.project.decompose` and its route MUST become live likewise, under their own
  scope; `pmi.artifacts.sync` and `pmi.tasks.sync` MUST remain reserved unchanged.
- **FR-EXT-062**: The tool surface contract `EPIC-043` owns MUST be updated for the two live tools
  and its conformance test MUST pass against the running server.
- **FR-EXT-063**: Every constraint change, policy change, render, drift report and decomposition
  decision MUST write an audit entry naming actor, project, operation and outcome (`EPIC-004`).
- **FR-EXT-064**: The constraints, the policy and the renders MUST be scoped by workspace and
  project as every product record is; a cross-project read MUST return nothing.
- **FR-EXT-065**: The Governance area MUST deliver a **Constraints** screen: per project, the
  entries by kind in order with add, edit, reorder and retire; the decomposition policy and the
  offline mode; and a constitution preview with its version and digest.
- **FR-EXT-066**: The Constraints screen MUST render the Governed Execution section read-only and
  say that it is owned by PMI Studio.
- **FR-EXT-067**: The project screen and the Constraints screen MUST show a *file differs* warning
  while the last report from a workstation named drift, with the render version it last matched,
  and MUST clear it on a later report that matches.
- **FR-EXT-068**: Every table on these screens MUST have a filter and every screen MUST state its
  four states (loading, empty, error, partial — `FR-SHL-060`, PMI-DOC-005).

**Governance records**

- **FR-EXT-070**: `ADR-0030` MUST record the extension as the mechanism for PMI-aware commands
  (`D-8`) and the constitution as generated content (`D-3`), at the plan step.
- **FR-EXT-071**: The repository constitution MUST gain the directory-contract note PMI-DOC-007 §9.2
  names — a PMI-managed project's constitution file is generated and not hand-edited — as a PATCH
  amendment made through `/speckit-constitution` at the plan step (Constitution I).

### Key Entities

- **PMI extension**: the content half of the workspace bundle — manifest, the commands `begin`,
  `finish` and `progress`, the hook fragment; versioned with the bundle; installed by provisioning
  and verified by the setup skill.
- **Hook run**: one invocation of a PMI command before or after a stock command; produces a
  registration, a completion, a refusal, a queued record or a drift report — always one visible
  line.
- **Project constraint**: an owner-authored entry of kind principle, constraint or non-goal with
  title, body, order, version and status; the source the constitution is rendered from.
- **Decomposition policy**: one per project — one specification per Epic, task ceiling, split
  requires confirmation — versioned; rendered into the constitution and returned by the decompose
  tool.
- **Offline mode**: one per project — strict or provisional — versioned; rendered into the
  constitution; read by the hooks from the file.
- **Constitution render**: what was written — project, version, digest, time, content; the record a
  file on disk is matched against.
- **Decomposition plan**: the first-run output — per Epic its bundle, estimate and any split
  proposal; the decision recorded with who decided.
- **Provisional execution record**: a durable local file in the contract's event shape with a
  client-generated identity and a queued-for-sync event; never governed until reconciled.
- **Setup report**: the table the skill ends with — one row per check, a state and a next action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-EXT-001**: **100%** of the ten stock skill files are byte-identical to the integration
  manifest after installation and after every hook run — mutation-tested by making a hook append
  one line to a stock skill and observing the check fail.
- **SC-EXT-002**: **100%** of governed commands run in a provisioned directory with a reachable
  platform produce one registered and one completed execution on the project's timeline; **zero**
  run without registration; **zero** require the user to type anything beyond the command.
- **SC-EXT-003**: A first run over *N* Epics produces exactly *N* specification directories and
  *N* `specify` executions when no Epic exceeds the ceiling, and *N + k − 1* per confirmed split
  into *k* children; **zero** Epics above the ceiling proceed without a recorded human decision.
- **SC-EXT-004**: **100%** of constraint changes are visible in the preview with a new digest
  before the next governed command, and **100%** of hand edits to the file are reported as drift
  by the next hook — mutation-tested by editing the file and observing *file differs*.
- **SC-EXT-005**: **Zero** credential values in the skill's text, its output, any hook's output,
  any file under the project directory or any audit entry — mutation-tested by making the skill
  print the variable and observing the scan fail.
- **SC-EXT-006**: In strict mode with the platform unreachable, **zero** governed commands run past
  the begin hook and **zero** files change; the refusal names the address and the mode.
- **SC-EXT-007**: In provisional mode, **100%** of provisional records carry the queued-for-sync
  event and the *not governed* label before the command runs; **zero** are ever shown as governed.
- **SC-EXT-008**: **Milestone M2**: from entering constraints and requirements in PMI Studio to one
  registered specification per Epic on the project timeline, with the generated constitution on
  disk matching the preview's digest, in **one session** on the reference-local stack, recorded as
  a transcript.
- **SC-EXT-009**: The Governed Execution section is byte-identical to the platform's invariant text
  in **100%** of renders — mutation-tested by altering the invariant in one render and observing the
  conformance check fail.
- **SC-EXT-010**: `/setup-PMIStudio` ends with the table on **100%** of runs, including runs that
  stop at the first row, and a second run on a green machine changes **zero** files.

## Assumptions

Six judgement calls, each with the alternative that lost. They are listed so `/speckit-clarify`
can put them to the requester; the reasoning is kept because it describes the risk each default
accepts.

1. **Provisional operation is produced here and accepted by `EPIC-037`'s reserved intake**
   (`FR-EXT-050`–`FR-EXT-056`). The hooks write durable provisional records and submit them to
   `pmi.execution.sync`, which `EPIC-043` reserved with a refusal naming `EPIC-037`. Until that
   intake ships, the queue persists and the refusal is reported once. The alternative — build the
   intake here — moves `EPIC-037`'s `US4` into this Epic, which is mostly markdown and templates
   (PMI-DOC-007 §10) and should stay so. The risk accepted: provisional records accumulate until
   `EPIC-037`'s intake is delivered; the closure record names it.
2. **Drift is never overwritten silently** (`FR-EXT-026`). When the on-disk constitution matches no
   render, the hook shows the difference and waits for the person; PMI Studio shows *file differs*.
   The alternative — regenerate on every governed command, as the §5.4 header could be read —
   loses a hand edit the moment the next command runs, which is exactly the silent file edit the
   replan refuses elsewhere (`R-05`). A stale file (matching an older render) is refreshed without
   asking, because nothing is lost.
3. **The offline mode is a project policy value stored beside the decomposition policy and read by
   the hooks from the constitution file** (`FR-EXT-051`). The hook cannot ask the platform which
   mode applies when the platform is unreachable, so the mode must already be on disk; the
   constitution is the one file the agent already reads. The alternative — a separate policy file
   under the PMI directory — is a second generated file with its own drift story. The default is
   strict, as `BR-0202` and XII.1 name it.
4. **A confirmed split is recorded, and child Epics become product entities in `EPIC-044`**
   (`FR-EXT-045`). Epic is not yet a product entity; this Epic cannot create one. The record —
   estimates, seams, who decided — is what `EPIC-044` will consume; until then the children are
   specification directories named by the parent's number and a suffix, the shape rulings `D-18`
   and `D-19` used by hand. The alternative — wait for `EPIC-044` — puts `M2` after `M3`, which
   inverts the roadmap.
5. **First-run state is a marker provisioning writes, with the platform's record as tie-breaker**
   (`FR-EXT-046`). PMI-DOC-007 §5.2 names `.pmi/first-run`; provisioning does not yet write it, so
   `EPIC-041`'s project files gain one more entry. The platform's *no completed specify execution*
   fact resolves a stale marker. The alternative — derive first-run purely from the platform —
   fails when the platform is unreachable and leaves the hook unable to tell a first run from a
   provisional one.
6. **The Constraints screen is the first delivered screen of the Governance area** (`FR-EXT-065`).
   PMI-DOC-007 §6 places it in Governance, which the shell declares but has not delivered; this Epic
   delivers the area with that one screen, scoped to a project. The alternative — a panel on the
   project screen — keeps the area undelivered and puts owner-level governance beside developer
   status. The workstation status surface §6 also assigns to this Epic was delivered by `EPIC-043`
   (`FR-PIC-053`) and is only *extended* here with the drift warning.

**Provisional identifiers**: `LR-04`, `LR-05` and `LR-06` (PMI-DOC-007 §9.3) receive `BR-` numbers
only in PMI-DOC-004 v2.1; the back-fill is owed by the Project Owner before the platform release
gate.

**Dependencies**: `EPIC-041` complete (directory, credential, bundle installation, `.mcp.json`,
pending-initialisation hand-off); `EPIC-043` complete (the server, the reads, the reserved tools,
`pmi.health`, the workstation record, the extensible scope registry); `EPIC-019`'s steering
resolution; `EPIC-037`'s contract and its reserved provisional intake.
**Out of scope**: the MCP server itself and any change to the execution tools (`EPIC-043`);
accepting and reconciling provisional records (`EPIC-037` `US4`); Epic as a product entity and the
journey board (`EPIC-044`); artifact and task sync content (`EPIC-045`, `EPIC-046`); the Kanban
(`EPIC-046`); applying this extension to this repository's own checkout (it is not a PMI-managed
project); any agent integration other than the one the bundle maps.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/042-pmi-spec-kit-extension/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`SC-EXT-001`, `SC-EXT-004`, `SC-EXT-005` and `SC-EXT-009` are mutation-tested** and the suite
      observed failing under each mutation
- [ ] **`FR-EXT-003` holds**: the extension conformance tests are green, and were observed red by
      inversion (a hook naming a command the extension does not provide)
- [ ] **Constitution XI Tier 2**: a transcript of User Story 1, User Story 2 and User Story 3 against
      the running application is recorded (`SC-EXT-002`, `SC-EXT-003`, `SC-EXT-008`)
- [ ] `ADR-0030` is amended and the repository constitution carries the 1.6.1 note, both at the plan
      step (`FR-EXT-070`, `FR-EXT-071`)
- [ ] The two live tools are in `EPIC-043`'s contract document and its conformance test is green
      (`FR-EXT-062`)
- [ ] The bundle version is bumped and recorded, and the setup skill in the bundle is the full
      skill, not the hand-off (`FR-EXT-002`, `FR-EXT-030`)
