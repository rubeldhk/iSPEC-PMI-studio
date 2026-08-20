<!--
SYNC IMPACT REPORT
==================
Version change: 1.3.0 → 1.4.0
Bump rationale: MINOR — Principle IX materially expanded with a Delivery Board synchronization
obligation, per the project owner's 2026-08-20 instruction: the published Delivery Board artifact
must be refreshed whenever completed work changes what it displays.

Modified principles:
  - IX. Mandatory Closing Report — gains "Delivery Board synchronization": stops whose Work
    Completed changes anything the board displays MUST refresh the board artifact at its
    recorded URL (same URL, never a new one), with counts derived from the repository; a
    session that cannot reach the artifact must declare the board stale and name what changed

Added principles: none
Added sections: none
Removed sections: none

Templates requiring updates:
  ✅ .specify/templates/tasks-template.md  — Before-finishing extended with the board refresh
  ✅ .specify/templates/plan-template.md   — gate IX row extended to cover the board
  ✅ .specify/templates/spec-template.md   — reviewed; no change required
  ✅ .claude/skills/speckit-*/SKILL.md     — reviewed; closing-report guidance is generic and
     inherits IX from the constitution; no contrary hard-coded behavior

Follow-up TODOs: none

--- previous report (v1.3.0) ---
Version change: 1.2.0 → 1.3.0
Bump rationale: MINOR — one new principle added (X. Interaction Discipline by Phase) and one
existing principle materially expanded (IX now governs EVERY stop, not only command/session
ends). Nothing removed, renamed, or redefined incompatibly; every prior obligation still holds.
Both amendments respond to the project owner's 2026-08-19 ruling: development sessions were
too lengthy, with too many mid-run interruptions and stops that ended without a clear next
action.

Modified principles:
  - IX. Mandatory Closing Report — scope widened from "command run / session end" to every
    stop, including mid-work blocks; the next action must now be immediately executable (a
    concrete command, or a question with quick-select options and a recommended default)

Added principles:
  - X. Interaction Discipline by Phase (NON-NEGOTIABLE) — decision phases batch ALL questions
    into one consolidated questionnaire; execution phases run autonomously and, when genuinely
    blocked, present quick-select options with a recommended default (or proceed on the default
    when the choice is low-risk and reversible, recording the assumption)

Added sections: none
Removed sections: none

MIGRATION NOTE (required — Principle X is NON-NEGOTIABLE):
No artifact becomes non-compliant; the principle governs agent conduct, not delivered work.
  • In-flight epics: no spec.md/plan.md/tasks.md change is required.
  • Command behavior that hard-coded the old style is corrected in this propagation:
    speckit-clarify no longer asks one question at a time (batched questionnaire), and
    speckit-implement no longer halts on incomplete checklists (recommended-default flow).
  • Sessions already open on the old rules simply adopt the new interaction budget from
    their next stop onward.

Templates requiring updates:
  ✅ .specify/templates/plan-template.md   — Constitution Check gains gate X row; IX row rewritten
  ✅ .specify/templates/tasks-template.md  — Before-finishing/Notes extended with Principle X budget
  ✅ .specify/templates/spec-template.md   — reviewed; no change required (exit criteria unaffected)
  ✅ .claude/skills/speckit-clarify/SKILL.md   — sequential questioning replaced with batched
     questionnaire per Principle X
  ✅ .claude/skills/speckit-implement/SKILL.md — checklist STOP-and-wait replaced with
     recommended-default quick-select per Principle X
  ✅ .claude/skills/speckit-* (others)     — reviewed; no contrary hard-coded behavior found;
     Principle X binds them via the constitution they load

Follow-up TODOs: none

--- previous report (v1.2.0) ---
MINOR — two existing principles materially expanded, ratifying the EPIC-018 clarification
session of 2026-08-05: I. Spec Kit Command Gate (`governance/**` exempt; constitution itself
NOT exempt) and V. Mandatory Task-Level Unit Tests (extended to non-code outputs via
executable conformance checks). Propagated to all three templates.

--- previous report (v1.1.0) ---
MINOR — two new principles added governing agent session conduct: VIII Session Labelling by
Working Epic, and IX Mandatory Closing Report (NON-NEGOTIABLE). No principle removed or
redefined. Propagated to all three templates.

--- previous report (v1.0.0) ---
Initial ratification. All placeholder tokens replaced with concrete governance derived from
the project owner's stated operating rules. Principles I–VII established; sections
"Repository & Environment Governance" and "Development Workflow" added.
-->

# iSPEC PMI Studio Constitution

## Core Principles

### I. Spec Kit Command Gate (NON-NEGOTIABLE)

All application code MUST be created, modified, or deleted only as the output of a Spec Kit
command (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`,
`/speckit-converge`, `/speckit-analyze`, `/speckit-checklist`, `/speckit-taskstoissues`).
Ad-hoc, direct edits to source files outside a Spec Kit command are PROHIBITED, including
"quick fixes" and one-line changes.

Exempt from this gate — these MAY be edited directly:

- Spec Kit's own governance and scaffolding files: `.specify/**`, `.claude/skills/speckit-*/**`,
  and generated artifacts under `specs/**` (`spec.md`, `plan.md`, `tasks.md`, checklists).
- Repository governance artifacts under `governance/**` — steering files, the repository layout,
  the governance index, and the process conventions that accompany them.
- Requirement source material under `SRS/**`.
- Repository metadata that is not application code: `README*`, `.gitignore`, CI configuration.

**This document is NOT exempt.** Amending the constitution requires `/speckit-constitution`.
The distinction is deliberate: standards change often and governance rarely, so steering content
must be cheap to correct while the rules that bind it stay expensive to change.

If a needed change has no covering task, the correct response is to run the Spec Kit command
that produces one — never to edit the code first.

**Rationale**: The specification chain is the audit trail. Code that appears without a spec,
plan, and task has no traceable requirement and cannot be reviewed, tested, or converged against
intent.

### II. SRS as Requirement Source of Truth

Every specification MUST cite the `SRS/` document(s) that justify it. Requirements that exist in
a spec but not in the SRS MUST be recorded in the spec's Assumptions section and flagged for SRS
back-fill. Where a spec and the SRS disagree, the SRS wins and the spec MUST be corrected.

`SRS/` is the permanent, incrementally-consumed enterprise documentation repository. Spec Kit
reads from it; Spec Kit does not silently invent requirements outside it.

**Rationale**: A single authoritative requirement source prevents specification drift across
hundreds of features and keeps the delivered product answerable to documented intent.

### III. Epic-Driven Delivery

Work MUST be decomposed as Epic → Feature → Task before implementation begins. An Epic is the
unit of planning, convergence, and defect tracking; a Feature is an independently testable slice
of an Epic; a Task is the smallest unit that produces a verifiable code change.

Every Epic MUST have a stable identifier (`EPIC-###`) and its own directory under `specs/`.
No Task may exist without a parent Feature, and no Feature without a parent Epic.

**Rationale**: Epic boundaries make convergence, defect containment, and promotion decisions
possible at a meaningful granularity rather than per-commit.

### IV. Convergence Gate Per Epic (NON-NEGOTIABLE)

`/speckit-converge` MUST be run at the end of every Epic implementation, before that Epic is
declared complete and before promotion beyond the local repository. An Epic is complete only
when convergence reports no unbuilt work remaining, or when every remaining item has been
explicitly deferred into a named follow-up Epic.

Declaring an Epic done without a passing convergence run is a constitution violation.

**Rationale**: Convergence is the only mechanism that detects work that was specified but never
built. Skipping it lets partially-implemented Epics reach downstream environments.

### V. Mandatory Task-Level Unit Tests (NON-NEGOTIABLE)

Every Task that produces or changes application code MUST have at least one accompanying unit
test task. Unit tests are NOT optional in this project, and `/speckit-tasks` MUST emit them for
every implementation task it generates.

- Tests MUST be written and MUST fail before the implementing code is written.
- A Task is not complete until its tests pass.
- A Feature is not complete until every Task's tests pass together.

**Non-code outputs are covered too.** A Task whose output is a document, a configuration file, or
any other non-executable artifact MUST be paired with an **executable conformance check** — a test
that reads the artifact and fails when it drifts from the standard governing it. The check is the
test; it satisfies this principle in full.

- The check MUST be executable and MUST run in CI. **Manual review does not satisfy this
  principle**, and neither does a checklist item a person ticks.
- A conformance check MUST be able to fail. A check that cannot fail is decoration.
- Whether a failing check blocks the build or only reports is a per-epic decision, recorded in
  that epic's spec. Reporting is acceptable; having no check is not.

**Rationale**: Task-scoped tests keep the failure blast radius small and make convergence and
defect triage evidence-based rather than opinion-based. Extending that to documents closes the
loophole where an epic delivers governance nobody verifies: a specification, standard, or layout
that no check reads is a document that silently rots, and rotted governance is worse than none
because it is still trusted.

### VI. Defect Traceability Per Epic

Each Epic MUST maintain a `defects/` folder at `specs/<epic-id>/defects/`. Every defect found in
that Epic MUST be recorded there as its own file before any fix is attempted, capturing: defect
ID, originating Task, reproduction steps, expected vs. actual behavior, and resolution status.

Defect fixes MUST re-enter the workflow as new Tasks (see Development Workflow); they MUST NOT be
applied as untracked edits.

**Rationale**: Defects are requirement feedback. Recording them per Epic keeps the fix loop
inside the specification chain instead of routing around it.

### VII. Promotion Pipeline Discipline

Code enters the system exclusively through the local Claude working repository. Promotion MUST
follow the fixed order:

```text
local (Claude working repo) → dev → stage → prod
```

- No environment may be skipped, and no promotion may run backward.
- Promotion out of `local` REQUIRES a passing Epic convergence (Principle IV) and green unit
  tests (Principle V).
- Direct commits or pushes to `dev`, `stage`, or `prod` that did not originate from `local` are
  PROHIBITED.

**Rationale**: A single entry point with a one-way pipeline guarantees that everything running
in a downstream environment passed the same gates.

### VIII. Session Labelling by Working Epic

Every working session SHOULD be labelled with what it is working on, so that concurrent sessions
(Repository & Environment Governance) are distinguishable at a glance. The label is chosen in this
order of preference:

1. The Epic currently being worked (`EPIC-### <short epic name>`).
2. If no Epic is active yet, the first Spec Kit command invoked in the session
   (e.g. `speckit-constitution`).

The label MUST be applied wherever the environment supports it — terminal/session title, worktree
or clone directory name, and branch name — and MUST be stated in the session's closing report
(Principle IX) when it cannot be applied to the terminal itself. Relabel when the session switches
to a different Epic.

This principle is SHOULD rather than MUST because terminal title control is environment-dependent;
the naming *convention* is mandatory, its mechanical application is best-effort.

**Rationale**: Concurrent sessions are explicitly permitted in this project (via separate clones).
Unlabelled sessions make it impossible to tell which agent owns which Epic, which is exactly the
condition that produces interleaved edits and corrupted task state.

### IX. Mandatory Closing Report (NON-NEGOTIABLE)

**Every stop MUST end with a clear next action.** This applies to every Spec Kit command run,
every working session, AND every intermediate halt — a mid-work block, an error, a pause awaiting
input. The agent is PROHIBITED from stopping with analysis, findings, or narrative alone.

A full stop (command end, session end) MUST produce a closing report containing both of these
sections — never one without the other:

- **Work Completed** — what was actually done, listing the artifacts created or modified by path,
  and explicitly naming anything in scope that was NOT done and why.
- **Recommended Next Task** — the single next action, named as a concrete Spec Kit command with its
  argument (e.g. ``/speckit-plan for EPIC-004``), plus any lower-priority alternatives.

An intermediate stop (blocked, awaiting input) MUST end with the exact thing the user should do
next, in immediately executable form:

- the concrete command to run, OR
- the question(s) to answer — presented with numbered/lettered quick-select options and a
  **Recommended:** default, so a one-word reply resumes the work.

The report MUST distinguish verified outcomes from unverified ones: a test suite that was not run
MUST NOT be reported as passing, and deferred work MUST NOT be reported as complete.

**Delivery Board synchronization (added v1.4.0).** The programme publishes its status as the
**PMI Studio Delivery Board** artifact at
`https://claude.ai/code/artifact/6c7e9b43-721b-4847-b612-1e43378cec0f`. Whenever a stop's Work
Completed changes anything the board displays — a task completed, an Epic's stage or readiness
changed, a blocker or decision opened or resolved, task counts moved — the closing report MUST
include refreshing the board:

- Republish to that SAME artifact URL, never a new one; the board's identity is its address.
- Counts and stages on the board are DERIVED from the repository (task lists, stage register,
  defect folders), never hand-quoted — the same rule the board's own footer states.
- A session that cannot reach the artifact (offline, headless, unauthenticated) MUST state in its
  closing report that the board is stale and name exactly what changed, so the next session can
  refresh it without re-deriving the delta.

A board contradicting the repository is treated exactly like a stale defect record (Principle VI's
reasoning): worse than no board, because it is trusted.

**Rationale**: The Epic → Feature → Task → Defect loop is long-running and is resumed across many
sessions. A closing report is the handoff record that makes the next session's entry point
unambiguous. A stop without a next action forces the user to reverse-engineer what to type next —
that reconstruction cost, multiplied across hundreds of stops, is a dominant tax on delivery speed.
The board extends the same handoff to people who read status without opening the repository; it is
the closing report's public face, and it rots by the identical mechanism.

### X. Interaction Discipline by Phase (NON-NEGOTIABLE)

Spec Kit commands divide into two interaction modes with different interruption budgets. The goal
is fixed: minimize round trips without hiding decisions.

**Decision phases** — `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`,
`/speckit-checklist`, `/speckit-constitution` — where Product Owner / Project Manager / Tech Lead
judgment shapes scope:

- All questions for the phase MUST be gathered first and presented as ONE consolidated
  questionnaire: every question numbered, each with lettered options and a
  **Recommended:** default, answerable in a single reply (e.g. `1A 2B 3-recommended`).
- One-question-at-a-time round trips are PROHIBITED.
- At most ONE follow-up round is permitted, and only for answers that were ambiguous or that
  genuinely spawned a new decision — never for questions that could have been asked in round one.

**Execution phases** — `/speckit-implement`, `/speckit-converge`, `/speckit-analyze`,
`/speckit-taskstoissues` — where the decisions were already made upstream:

- The command MUST run autonomously from start to finish. Pausing for confirmation, permission,
  or progress acknowledgment is PROHIBITED — including on warnings, incomplete checklists, or
  non-blocking findings, which are reported in the closing report instead.
- If genuinely blocked (a missing input that materially changes the outcome), present a quick
  multiple-choice option set with a **Recommended:** default so one keystroke resumes the work,
  then continue immediately on the answer.
- If the blocking choice is low-risk and reversible, do NOT stop: proceed on the recommended
  default and record the assumption in the affected artifact's Assumptions section and in the
  closing report.

**Universal rules, both modes:**

- Every pause MUST state its reason. A pause with no stated blocking reason is a violation.
- "Shall I continue?", "Do you want me to proceed?", and equivalent permission-seeking questions
  are PROHIBITED. The default is always to continue.

**Rationale**: Round trips, not compute, dominate wall-clock delivery time in this project.
Batching converts N interruptions into one sitting where the PO/PM/TL answers everything with
full context; recommended defaults keep execution moving at machine speed while every assumption
stays on the audit trail.

## Repository & Environment Governance

**Hosting**: The canonical remote is GitHub — `https://github.com/rubeldhk/iSPEC-PMI-studio.git`.
GitHub is authoritative for branches, history, and the promotion trail.

**Sync before work (MANDATORY)**: Every new Task, Feature, or Epic MUST begin by updating the
working repository from the remote (fetch and fast-forward/rebase onto the current upstream
branch). Starting work on a stale checkout is a constitution violation.

**Concurrent session isolation (MANDATORY)**: If another Claude session is already active in the
working repository, a new session MUST NOT implement or change code in that repository. It MUST
first create a separate clone (or dedicated worktree) and perform all implementation there,
merging back through the normal Spec Kit and promotion flow.

Rationale: two concurrent agents editing one checkout corrupts task state, produces interleaved
partial edits, and breaks convergence accounting.

**Session labelling (Principle VIII)**: each session, clone, or worktree carries the label of the
Epic it is working — `EPIC-### <short name>`, or the first Spec Kit command invoked if no Epic is
yet active.

**Directory contract**:

```text
SRS/                          # Requirement source of truth (read-mostly)
specs/<epic-id>/              # One directory per Epic
  spec.md  plan.md  tasks.md
  defects/                    # Mandatory per-Epic defect records
.specify/                     # Spec Kit governance, templates, scripts
```

## Development Workflow

The delivery loop is fixed and cyclic:

```text
Epic → Feature → Task → Defect → Changes → Task → Defect → …
```

1. **Epic** — Define scope from `SRS/`. Create `specs/<epic-id>/` and its `defects/` folder.
   Produce `spec.md` via `/speckit-specify`.
2. **Feature** — Decompose the Epic into independently testable Features. Produce `plan.md` via
   `/speckit-plan`.
3. **Task** — Produce `tasks.md` via `/speckit-tasks`, with a mandatory unit-test task attached
   to every implementation task. Execute via `/speckit-implement`.
4. **Defect** — Record every defect in `specs/<epic-id>/defects/` before fixing it.
5. **Changes** — Translate each recorded defect into scoped change requirements.
6. **Task (re-entry)** — Regenerate/extend tasks for those changes and implement them through
   `/speckit-implement`. Never patch code directly.
7. **Defect (re-verify)** — Re-test; close the defect record or loop again from step 4.

**Epic exit gate**: run `/speckit-converge`. Only a clean convergence plus green unit tests
permits promotion from `local` to `dev`.

**Quality gates in order**: unit tests green → convergence clean → Epic defect folder has no open
records → promote.

**Every step above closes with a report** (Principle IX): what was done, and the recommended next
task named as a concrete Spec Kit command. This applies to each step individually, not only to the
Epic exit gate.

**Interaction budget per step** (Principle X): steps 1–3 before implementation are decision
phases — all PO/PM/TL questions are batched into one questionnaire with options and recommended
defaults. Steps 3 (execution via `/speckit-implement`) through 7 are execution phases — they run
without pausing; a genuine block surfaces as a quick-select question, and low-risk reversible
choices proceed on the recommended default with the assumption recorded.

## Governance

This constitution supersedes all other development practices, conventions, and habits in this
repository. Where any template, skill file, tool default, or prior practice conflicts with it,
this document wins and the conflicting artifact MUST be corrected.

**Amendment procedure**: Amendments are made only through `/speckit-constitution`. Each amendment
MUST record the version change, the rationale, and the propagation status of every dependent
template in the Sync Impact Report at the top of this file. Amendments that change a
NON-NEGOTIABLE principle additionally require an explicit migration note describing how in-flight
Epics comply.

**Versioning policy** (semantic):

- **MAJOR** — a principle is removed or redefined in a backward-incompatible way.
- **MINOR** — a new principle or section is added, or existing guidance is materially expanded.
- **PATCH** — clarifications, wording, and non-semantic refinements.

**Compliance review**: Every `/speckit-plan` MUST complete its Constitution Check gate before
Phase 0 research and re-check it after Phase 1 design. Every `/speckit-analyze` MUST report
constitution violations as blocking findings. Every Epic convergence MUST confirm Principles I,
IV, V, VI, and VII were honored. Every command run MUST end with the closing report required by
Principle IX and MUST honor the interaction budget of Principle X for its phase. Complexity or
deviation MUST be justified in the plan's Complexity Tracking table, or the work MUST be
simplified.

**Version**: 1.4.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-20
