<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — two new principles added governing agent session conduct
(session labelling and a mandatory closing report). No existing principle was removed,
renamed, or redefined; all prior guidance remains valid unchanged.

Modified principles: none renamed or redefined

Added principles:
  - VIII. Session Labelling by Working Epic
  - IX. Mandatory Closing Report (NON-NEGOTIABLE)

Added sections: none
Removed sections: none

Templates requiring updates:
  ✅ .specify/templates/plan-template.md   — Constitution Check gained gate rows VIII, IX
  ✅ .specify/templates/tasks-template.md  — session labelling in "Before starting"; closing
                                             report added to Notes and Epic Closure phase
  ✅ .specify/templates/spec-template.md   — Epic Exit Criteria gained a closing-report item
  ✅ .claude/skills/speckit-*/SKILL.md     — reviewed; generic guidance, no outdated refs
  ✅ readme.txt                            — reviewed; no principle references to update

Follow-up TODOs: none

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
- Requirement source material under `SRS/**`.
- Repository metadata that is not application code: `README*`, `.gitignore`, CI configuration.

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

**Rationale**: Task-scoped tests keep the failure blast radius small and make convergence and
defect triage evidence-based rather than opinion-based.

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

Every Spec Kit command run, and every working session, MUST end with a closing report containing
both of these sections — never one without the other:

- **Work Completed** — what was actually done, listing the artifacts created or modified by path,
  and explicitly naming anything in scope that was NOT done and why.
- **Recommended Next Task** — the single next action, named as a concrete Spec Kit command with its
  argument (e.g. ``/speckit-plan for EPIC-004``), plus any lower-priority alternatives.

The report MUST distinguish verified outcomes from unverified ones: a test suite that was not run
MUST NOT be reported as passing, and deferred work MUST NOT be reported as complete.

**Rationale**: The Epic → Feature → Task → Defect loop is long-running and is resumed across many
sessions. A closing report is the handoff record that makes the next session's entry point
unambiguous, and the honest statement of what was skipped is what keeps convergence trustworthy.

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
Principle IX. Complexity or deviation MUST be justified in the plan's Complexity Tracking table,
or the work MUST be simplified.

**Version**: 1.1.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-03
