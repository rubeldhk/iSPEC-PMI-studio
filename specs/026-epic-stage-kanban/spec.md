# Feature Specification: Epic Stage Register & Definition of Ready

**Feature Branch**: `026-epic-stage-kanban`

**Epic**: `EPIC-026` — Epic Stage Register & Definition of Ready *(process, not product)*

**Created**: 2026-08-09

**Status**: Draft — ready for clarification

**Input**: User description: "add a new spec for additional requirement where i will update features
regularly. first one: each epic will have record of the stage. like when added as new spec it will
mark as Specified and expected Clarify, Clarified expected Checklist. So it is a Kanban of spec
journey until ready to Implement. definition of ready (DOR)"

**Parent product spec**: none. **This epic produces no product capability.** It governs how *this
repository* moves an Epic through the Spec Kit chain — the same category as `.specify/`,
`governance/`, and the constitution.

**Sibling epic**: [EPIC-018 Repository Governance Process](../018-repository-governance/) — which
established `governance/**`, the conformance-check pattern, and the process/product seam this epic
reuses. EPIC-018 answered *"where does an artifact live?"*; this epic answers *"how far along is
this Epic, and is it allowed to start?"*

**Not to be confused with**: [EPIC-009 Specification Lifecycle & Versioning](../009-spec-lifecycle-versioning/)
— the *product's* six-state lifecycle (`draft → review → approved → baselined → implemented →
archived`) for specifications authored **inside** PMI Studio by its customers. That is product
surface and remains held. This epic tracks **this repository's own Epics** through **Spec Kit
commands**. The two share the word "lifecycle" and nothing else.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING.** Buildable now. Nothing here depends on `PMI-DOC-004` or on approved business
> scope, because nothing here is product surface. Same seam that made EPIC-018 buildable while
> EPIC-017 stayed held.

## Purpose

This repository holds 25 Epics. Their positions in the Spec Kit chain differ, and today that position
is recorded only as **hand-maintained prose** — in `specs/README.md`, in each `plan.md` header, and
in each `spec.md`'s delivery-posture paragraph. Nothing derives it, and nothing checks it. Three
consequences are already measurable in the tree:

- **EPIC-018's task count is recorded three times and disagrees with itself.** Its own `plan.md`
  says **31** tasks (in two places), `specs/README.md` says **32**, and `tasks.md` actually holds
  **34**. No reader can tell which is right without counting, and nothing fails when they diverge.
- **EPIC-009** and **EPIC-012** are held pending `PMI-DOC-004`, but that fact lives in prose inside
  each `spec.md`, so it cannot be listed, counted, or checked — only read, one file at a time.
- **EPIC-002** and **EPIC-017** are parent designs that deliberately carry no tasks. That is
  correctly documented in `specs/README.md`, which is exactly the point: the information exists, but
  only as a sentence someone typed and someone else must keep true.

The Epic Stage Register makes that position an explicit, checkable artifact: for every Epic, which
stage of the Spec Kit journey it has reached, which Spec Kit command is expected next, and — at the
end of the journey — whether it satisfies a **Definition of Ready (DOR)** that permits
`/speckit-implement` to begin.

The value is the same argument PP-011 "Documentation as Code" makes, applied to programme state:
what is currently inferred from a directory listing and remembered by whoever is at the keyboard
becomes written, versioned, and inspectable.

**This epic is the standing home for repository process requirements of this kind.** The stage
register and DOR are its first feature; further process requirements arrive as additional
prioritised user stories appended to this spec, each independently testable. The scope specified
below is the stage register and DOR only — nothing here is open-ended.

## Clarifications

### Session 2026-08-09

- Q: The analysis step prints its findings and leaves no file behind — how should the register know it happened and passed? → A: **A — analysis writes a dated findings file into the epic folder**, which both the stage derivation and the DOR read. Chosen because every other stage in the journey already leaves an artifact; making this one the sole hand-declared exception would carve a hole in FR-ESK-003 on the day it is written. Adds **FR-ESK-019**; requires an ordinary edit to `.claude/skills/speckit-analyze/`, which Constitution I exempts.

- Q: May an Epic start implementation while failing a DOR condition, and who may authorise that? → A: **B — a recorded waiver against one named condition**, owned by one of the three programme roles, carrying a reason and an expiry; the Epic then reads **Ready (waived)** and never plain Ready, and an expired waiver fails the build. Chosen over "no waivers ever" because a gate with no legitimate exception path is the kind that gets edited rather than obeyed — the realistic response to one unresolvable condition would be to weaken the check silently, which is precisely the failure this register exists to prevent. Reuses the ownership model EPIC-018 settled (tech lead, product owner, project owner). Adds **FR-ESK-022** and **FR-ESK-023**.

- Q: Should the register be a committed file, or produced on demand by the check? → A: **A — a generated file, committed, with the check failing when the committed copy disagrees with the repository.** This is what reconciles SC-ESK-001 (readable in one document) with SC-ESK-004 (no drift): the file is readable in pull requests and on GitHub, and a stale copy cannot survive a CI run. It follows `governance/template-conformance.md`, already a committed record of a computed result. Option B was rejected because a board nobody can see without running a command is not the board that was asked for. Adds **FR-ESK-021**; the drift check is blocking, extending FR-ESK-016.

- Q: What posture kinds may be recorded against a stopped Epic, and which block readiness? → A: **A — three kinds, all blocking**: **Held** (awaiting a named input), **Blocked** (awaiting another Epic), **Superseded** (replaced by another Epic). Matches what the repository already writes in prose — EPIC-009 and EPIC-012 read "⏸ HELD pending `PMI-DOC-004`" — and keeping every kind blocking means a recorded stop always means not Ready, so no reader must remember which kinds are which. Option B's non-blocking **Deferred** was rejected: an Epic that is simultaneously postponed and Ready is a contradiction the register would have to explain every time it was read. Adds **FR-ESK-020**; the kind list is configuration under FR-ESK-015.

- Q: The clarify step may finish by asking nothing and writing nothing — how does such an Epic ever leave **Specified**? → A: **A — clarify always records a dated session**, stating "no questions required" when it asks none. Same ruling as the analysis question above, and the two together produce the general rule now stated as **FR-ESK-017**: an artifact records that a step *ran*, not that it found something. Rejecting option B matters — deriving Clarified from the absence of `[NEEDS CLARIFICATION]` markers would mark every freshly written spec as clarified before the step ever ran. Adds **FR-ESK-018**; requires an ordinary edit to `.claude/skills/speckit-clarify/`.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `.specify/memory/constitution.md` | Principle I — Spec Kit Command Gate; the eight named commands that form the journey | FR-ESK-001, FR-ESK-002 |
| `.specify/memory/constitution.md` | Principle III — Epic-Driven Delivery; `EPIC-###` identity and one directory per Epic | FR-ESK-001, FR-ESK-003 |
| `.specify/memory/constitution.md` | Principle IV — Convergence Gate Per Epic; Principle V — Mandatory Task-Level Unit Tests | FR-ESK-009, FR-ESK-010 |
| `.specify/memory/constitution.md` | §Development Workflow — the fixed Epic → Feature → Task loop and its quality gates in order | FR-ESK-002, FR-ESK-008 to FR-ESK-012 |
| `.specify/memory/constitution.md` | Principle IX — Mandatory Closing Report; the honesty rule that unrun checks are never reported as passing | FR-ESK-006, FR-ESK-014, FR-ESK-017 to FR-ESK-019 |
| `.specify/memory/constitution.md` | Principle I — `.claude/skills/speckit-*/**` exempt from the command gate, which is what permits the FR-ESK-018 and FR-ESK-019 changes | FR-ESK-018, FR-ESK-019 |
| `governance/README.md` | Governance index; the Constitution I exemption column; `pnpm test:governance` check catalogue | FR-ESK-013, FR-ESK-016 |
| `governance/traceability-convention.md` | Which artifact links are mandatory | FR-ESK-011 |
| `governance/governance.config.json` | Configuration-not-principle pattern for check thresholds and enumerations; the three-role `owners` list reused for waiver ownership | FR-ESK-015, FR-ESK-020, FR-ESK-022 |
| `governance/template-conformance.md` | Precedent for a committed record of a computed result | FR-ESK-021 |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-011 Documentation as Code; PP-012 Everything Versioned; PP-019 Continuous Improvement | FR-ESK-003, FR-ESK-014 |
| `specs/srs-alignment.md` | **D-10** delivery-posture lanes (proceed / held) — the posture overlay this register must represent | FR-ESK-004, FR-ESK-005, FR-ESK-020 |

**Requirements not yet covered by SRS**: **all of FR-ESK-001 to FR-ESK-016**. This epic is
owner-originated: it derives from the constitution and from the project owner's stated operating
rule, not from a document in `SRS/`. It follows the precedent set by EPIC-018's FR-RGP-014 and
FR-RGP-015, which likewise encoded constitutional duties as repository artifacts with no SRS source.

Back-fill owner: **project owner** — to be reflected in `PMI-DOC-000` (or a successor process
standard) if and when the standard is amended to cover programme-state tracking.

## Principle Conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md). This epic
records only where it differs or is the place a principle is satisfied.

| Principle | Status in this epic |
|---|---|
| PP-011 Documentation as Code | ✅ **Satisfied here for programme state.** Epic position becomes versioned repository text rather than a directory listing plus recall |
| PP-012 Everything Versioned | ✅ Satisfied here for stage history — every stage transition is attributable through repository history |
| PP-019 Continuous Improvement | ✅ **Satisfied here.** Stage and DOR data are the first programme-level measurement this repository can take of its own flow |
| PP-002 Single Source of Truth | ⚠️ **At risk, and this epic must not make it worse.** A hand-maintained stage column is a second source of truth that will disagree with the file tree. FR-ESK-003 requires derivation over declaration for everything derivable |
| PP-004 End-to-End Traceability | 🔶 Unchanged. This epic traces *process* state, not requirement-to-code linkage — that stays EPIC-011's and EPIC-022's |
| PP-003 Human-in-the-Loop | ✅ Reinforced. DOR is the gate a human passes an Epic through before automated implementation may start |

No other principle's platform status changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every Epic's stage is recorded and can be read at a glance (Priority: P1)

The project owner opens one register and sees, for all 25+ Epics, which stage of the Spec Kit
journey each has reached — without opening 25 directories or remembering which ones are held.

**Why this priority**: This is the requirement as stated. Every other story here refines, gates, or
checks the register; this one creates it. It also has immediate standalone value: the register is
useful the moment it exists, before any DOR gate is defined.

**Independent Test**: Produce the register for the repository as it stands today and confirm that
EPIC-002 and EPIC-017 (no `tasks.md`) show a different stage from EPIC-004 (spec, plan, tasks,
checklists), and that EPIC-003 and EPIC-018 (closure recorded) are distinguishable from both.

**Acceptance Scenarios**:

1. **Given** an Epic directory containing only `spec.md`, **When** the register is produced,
   **Then** that Epic reads **Specified** and names `/speckit-clarify` as the expected next command.
2. **Given** an Epic whose `spec.md` carries a dated Clarifications session, **When** the register is
   produced, **Then** it reads **Clarified** and names `/speckit-checklist` as expected next —
   including when that session records that no questions were required.
3. **Given** an Epic with a fully resolved requirements checklist, **When** the register is produced,
   **Then** it reads **Checklisted** and names `/speckit-plan` as expected next.
4. **Given** an Epic with `plan.md`, **When** the register is produced, **Then** it reads **Planned**
   and names `/speckit-tasks` as expected next.
5. **Given** an Epic with `tasks.md`, **When** the register is produced, **Then** it reads **Tasked**
   and names `/speckit-analyze` as expected next.
6. **Given** an Epic carrying a recorded analysis findings file, **When** the register is produced,
   **Then** it reads **Analyzed** and the DOR is the next thing evaluated.
7. **Given** any Epic in the repository, **When** the register is produced, **Then** exactly one
   stage applies to it — no Epic is unstaged, and no Epic carries two stages.
8. **Given** the register, **When** a reader asks what to do next for any Epic, **Then** the answer
   is a concrete Spec Kit command with its argument, not a description of an activity.

---

### User Story 2 - The stage is derived from artifacts, so it cannot lie (Priority: P1)

The stage shown for an Epic is computed from what is actually in that Epic's directory. Nobody
edits a stage field by hand, so the register cannot drift out of agreement with the repository.

**Why this priority**: P1 and inseparable from Story 1 in value, though separately testable. A
hand-maintained Kanban column is exactly the second source of truth that PP-002 forbids and that
EPIC-018 spent an entire success criterion preventing. If the register can disagree with the tree,
it will, and then it is worse than nothing because it is still trusted.

**Independent Test**: Add `tasks.md` to an Epic that previously lacked it, re-produce the register
with no other edit, and confirm the stage advanced on its own.

**Acceptance Scenarios**:

1. **Given** an Epic gains a new artifact, **When** the register is re-produced, **Then** the stage
   advances with no hand edit to any stage field.
2. **Given** the register is produced twice with no repository change between, **When** the outputs
   are compared, **Then** they are identical — the stage is a function of the tree, not of when it
   was asked.
3. **Given** an Epic gains an artifact but the committed register is not regenerated, **When** the
   checks run, **Then** the build fails naming the disagreement — a stale board cannot survive a
   CI run.
4. **Given** someone edits the committed register by hand, **When** the checks run, **Then** the
   edit is overwritten by regeneration and reported, never adopted.
5. **Given** anyone attempts to record a stage that contradicts the Epic's artifacts, **When** the
   register is checked, **Then** the contradiction is reported and the derived value wins.
6. **Given** a new Epic directory is created, **When** the register is produced, **Then** it appears
   automatically — no registration step, and no Epic can be silently absent.

---

### User Story 3 - Deliberate holds are visible as holds, not as stalled progress (Priority: P1)

An Epic that has stopped on purpose reads differently from one that has stopped by neglect. EPIC-009
and EPIC-012 are held pending `PMI-DOC-004`; EPIC-002 and EPIC-017 have no `tasks.md`. A reader can
tell which of those is a decision and which is an omission, and for every hold can see what input
would release it.

**Why this priority**: P1 because without it the register actively misleads. Four Epics today sit at
a stage they will not leave for reasons already decided; a board showing them as merely behind
converts a governance decision into apparent failure and invites someone to "fix" it.

**Independent Test**: Mark one Epic held with a named releasing input, produce the register, and
confirm it is distinguishable from an Epic stalled at the same stage without a posture.

**Acceptance Scenarios**:

1. **Given** an Epic is deliberately stopped, **When** the register is produced, **Then** its posture
   is shown alongside its stage as one of **Held**, **Blocked**, or **Superseded**, together with the
   specific input, Epic, or replacement that accounts for it.
2. **Given** a held Epic, **When** a reader asks why, **Then** the reason names a document, decision,
   or Epic — never "pending" without an object.
3. **Given** a posture is declared with no releasing input named, **When** the register is checked,
   **Then** that posture is reported as incomplete.
4. **Given** an Epic stalled with no declared posture, **When** the register is produced, **Then** it
   is shown as stalled rather than as held — absence of a posture is never read as a decision.
5. **Given** an Epic declared a parent design, **When** the register is produced, **Then** it reads
   as complete at **Planned**, names its child Epics, and is never shown as stalled for lacking a
   task list it is not meant to have.
6. **Given** a held Epic receives its releasing input, **When** the posture is cleared, **Then** the
   Epic resumes at its derived stage with no stage information lost.

---

### User Story 4 - An Epic cannot be declared Ready without meeting the Definition of Ready (Priority: P1)

Before `/speckit-implement` runs against an Epic, a written Definition of Ready is evaluated against
it. Every DOR condition is mechanically checkable, and an Epic that fails any of them cannot show as
Ready.

**Why this priority**: P1 because this is the half of the request that has teeth. The stage register
describes; the DOR decides. Without it, "Ready to Implement" is an opinion, and the constitution's
quality gates — clarifications resolved, Constitution V test pairing, clean analysis — are re-argued
per Epic instead of being settled once.

**Independent Test**: Take an Epic that satisfies every DOR condition but one, evaluate the DOR, and
confirm it is not Ready and that the report names the single failing condition.

**Acceptance Scenarios**:

1. **Given** an Epic meeting every DOR condition, **When** the DOR is evaluated, **Then** it reads
   **Ready** and names `/speckit-implement` as expected next.
2. **Given** an Epic whose `spec.md` still contains a `[NEEDS CLARIFICATION]` marker, **When** the
   DOR is evaluated, **Then** it is not Ready and the marker is named as the reason.
3. **Given** an Epic with an implementation task carrying no paired test or conformance-check task,
   **When** the DOR is evaluated, **Then** it is not Ready and Constitution V is cited as the
   failing condition.
4. **Given** an Epic that fails several conditions, **When** the DOR is evaluated, **Then** **all**
   failing conditions are listed — not the first one found — so one pass tells the reader everything
   still to do.
5. **Given** a DOR condition that cannot be evaluated mechanically, **When** the DOR is defined,
   **Then** that condition is rejected from the DOR rather than admitted as a manual review step.
6. **Given** an Epic under a blocking posture, **When** the DOR is evaluated, **Then** it is not
   Ready regardless of how complete its artifacts are.
7. **Given** an Epic failing one condition that carries a valid waiver, **When** the DOR is
   evaluated, **Then** it reads **Ready (waived)** — never plain Ready — and the waiver's condition,
   owner, reason, and expiry are shown alongside it.
8. **Given** a waiver has passed its expiry date, **When** the checks run, **Then** the build fails
   and the Epic is no longer Ready by any reading.
9. **Given** a waiver naming no owning programme role, or naming more than one condition, **When**
   it is checked, **Then** it is reported as invalid and grants nothing.

---

### User Story 5 - The journey ends where implementation begins (Priority: P2)

The register covers the specification journey only — from an Epic first being specified up to the
point it is Ready to Implement. What happens after implementation starts is tracked by the
constitution's existing convergence and closure machinery, and the register does not duplicate it.

**Why this priority**: P2 because it is a scope boundary rather than a capability, and getting it
wrong costs more than getting it late. The repository already has convergence (Principle IV),
defect folders (Principle VI), and `closure.md` files; a second progress tracker overlapping those
would be the PP-002 violation this epic is most likely to commit.

**Independent Test**: Confirm the register reports on an Epic that has been implemented and closed
without asserting anything about its implementation, convergence, or promotion state beyond the
fact that the journey concluded.

**Acceptance Scenarios**:

1. **Given** an Epic has passed the DOR and implementation has begun, **When** the register is
   produced, **Then** it records that the journey concluded and does not track implementation
   progress.
2. **Given** an Epic with a recorded closure, **When** the register is produced, **Then** its closure
   is referenced rather than restated.
3. **Given** convergence or promotion state is wanted, **When** a reader consults the register,
   **Then** it points to the existing constitutional artifacts rather than carrying its own copy.

---

### User Story 6 - Stage and DOR are checked automatically, not by inspection (Priority: P2)

The register and the DOR are verified by executable checks that run in CI alongside the existing
governance checks, so a register that has drifted from the repository is reported rather than
discovered.

**Why this priority**: P2 because the register delivers value the day it is written, before any
check exists. But Constitution V makes this mandatory for the epic to close: a document that no
check reads is a document that silently rots, and a rotted register is worse than none because it
is still trusted.

**Independent Test**: Introduce a deliberate disagreement between the register and the repository,
run the checks, and confirm the disagreement is reported with the Epic and condition named.

**Acceptance Scenarios**:

1. **Given** the checks exist, **When** they run, **Then** they read the repository and need no
   database, server, or fixture — the same posture as the existing governance checks.
2. **Given** a declared value contradicts a derived one, **When** the checks run, **Then** the
   contradiction fails.
3. **Given** an Epic shows Ready but fails a DOR condition, **When** the checks run, **Then** the
   build fails — a false Ready is the one failure here that is silent and compounding.
4. **Given** an Epic is merely stalled or a posture is missing, **When** the checks run, **Then**
   the finding is reported without failing the build.
5. **Given** a check is added, **When** it is written, **Then** it is capable of failing — a check
   that cannot fail is decoration.

### Edge Cases

- **A hand-recorded stage disagrees with the Epic's artifacts**: the derived value wins and the
  disagreement is reported. There is no scenario where a declared stage overrides the file tree.
- **An Epic's artifacts appear out of order** — `tasks.md` present but `plan.md` absent: the register
  reports the gap rather than inferring the higher stage, because the sequence is the constitution's
  Development Workflow and skipping it is the condition worth surfacing.
- **`_shared/` is not an Epic** — it holds `plan.md` and `checklists/` but has no `EPIC-###` identity.
  It must be excluded explicitly, not by accident of matching or failing to match a pattern.
- **A held Epic is fully specified**: posture beats completeness. EPIC-009 and EPIC-012 have complete,
  reviewed, Constitution V-compliant tasks and are still not Ready.
- **A posture is recorded with a kind outside the three defined**: reported as invalid rather than
  accepted as free text, or the fixed vocabulary decays into prose and the register can no longer
  group or count stops.
- **A Superseded Epic still has open artifacts**: it stays not Ready and names its replacement.
  Superseded is a stop, not a closure — closure remains Constitution IV and VI's to record.
- **A parent design is confused with a stalled Epic**: the two look identical on disk — spec and plan
  present, no task list. Only a declaration distinguishes them, which is why FR-ESK-024 makes it a
  declared kind rather than something the derivation guesses at.
- **A parent design carries a task list anyway**: reported as a contradiction. Either it is not a
  parent design or the tasks belong to a child.
- **A parent design names no child Epics**: reported as incomplete, by the same rule that requires a
  posture to name its releasing input — a container with nothing in it is a stall wearing a label.
- **A DOR condition that only a human can judge** — "the design is sound": rejected from the DOR,
  because Constitution V already ruled that manual review does not satisfy a gate. It may live in a
  `/speckit-checklist`, which is itself a DOR condition.
- **A waiver is used to route around a condition permanently** by renewing it on expiry: each
  renewal is a fresh dated record with a named owner, so the pattern is visible in history rather
  than silent. Visibility is the control here — the register does not prevent renewal, it prevents
  renewal going unnoticed.
- **Every failing condition on an Epic is waived**: the Epic reads **Ready (waived)**, never plain
  Ready. There is no combination of waivers that produces an unqualified Ready, which is what stops
  waivers from becoming a second, weaker DOR.
- **A waiver outlives the condition it covers** — the condition is removed from the DOR while the
  waiver stands: the waiver names nothing and is reported as invalid rather than silently ignored.
- **An Epic passes the DOR, then its spec is amended**: the DOR is a function of current state, so it
  re-evaluates. Readiness is never a durable stamp.
- **Two Epics claim the same `EPIC-###`**: reported as a Principle III violation — identity must be
  stable and unique for the register to be addressable at all.
- **A new Spec Kit command is added, or the journey changes shape**: the stage sequence is
  configuration, so extending it is an ordinary edit rather than a spec change. If that command
  leaves no artifact, FR-ESK-017 applies to it too — a stage with no evidence cannot join the
  journey.
- **An analysis was run but its findings file is absent**: the Epic reads **Tasked**, not
  **Analyzed**. An unrecorded run is indistinguishable from no run, which is the Constitution IX
  honesty rule applied to stage evidence.
- **A spec is written with no `[NEEDS CLARIFICATION]` markers at all**: it reads **Specified**, not
  Clarified. Absence of questions is not evidence that questions were asked, and the opposite
  reading would let every new spec skip the step by construction.
- **A clarification session runs and asks nothing**: it reads **Clarified**, because the recorded
  session is evidence the step ran. This and the case above are the same distinction seen from
  either side — what advances the stage is the run, not the findings.
- **An analysis findings file exists but records blocking violations**: the Epic reads **Analyzed**
  — the stage is reached — but fails the DOR. Reaching a stage and passing a gate are different
  claims, and conflating them would let a failed analysis read as readiness.
- **A findings file is stale** — recorded, then the spec, plan, or tasks changed underneath it: the
  analysis no longer describes the Epic, so readiness must not rest on it.
- **The register itself is an Epic artifact under `specs/`** and would appear in its own output —
  its treatment must be stated rather than left to chance.

## Requirements *(mandatory)*

> **Identifier scheme**: `FR-ESK-###` / `SC-ESK-###`. Namespaced to avoid conflict **C-01** and to
> keep process requirements visibly distinct from product requirements, following EPIC-018's
> `FR-RGP-###` precedent.

### Functional Requirements

#### The stage model

- **FR-ESK-001**: Repository MUST define a single ordered sequence of stages describing an Epic's
  journey from first specification to Ready to Implement, with every stage named and defined by the
  artifact evidence that places an Epic in it.
- **FR-ESK-002**: Every stage MUST name the Spec Kit command expected next, as a concrete invocation
  with its argument — never as an activity description.
- **FR-ESK-003**: An Epic's stage MUST be derived from the artifacts in its directory. Any value that
  can be derived MUST NOT be hand-declared.
- **FR-ESK-004**: Repository MUST allow a **posture** to be declared for an Epic — the reason it is
  not progressing when that reason is a decision rather than an omission — as an overlay on the
  derived stage, never as a replacement for it.
- **FR-ESK-024**: An Epic MUST be declarable as a **parent design** — an Epic that holds requirements
  and design for child Epics and deliberately carries no tasks, as EPIC-002 and EPIC-017 do. A parent
  design's journey MUST end at **Planned**, where it reads as complete rather than stalled, and the
  DOR MUST NOT be evaluated against it. This is a kind of Epic, not a posture: it describes what the
  Epic *is*, not that it has stopped, and it MUST NOT be recorded as one of the three posture kinds.
  Every parent design MUST name its child Epics (added during planning, 2026-08-09).
- **FR-ESK-020**: Posture MUST be one of exactly three kinds — **Held** (awaiting a named input),
  **Blocked** (awaiting another Epic), or **Superseded** (replaced by another Epic). All three MUST
  prevent readiness. A posture outside this set MUST be reported as invalid, and the set MUST be
  held as configuration under FR-ESK-015 (clarified 2026-08-09).
- **FR-ESK-005**: Every declared posture MUST name the specific input, decision, or Epic that would
  release it. A posture with no named releasing input MUST be reported as incomplete.
- **FR-ESK-006**: An Epic that has stopped without a declared posture MUST be shown as stalled, not
  as held. Absence of a posture MUST NOT be presented as a decision.
- **FR-ESK-017**: Every stage in the journey MUST be evidenced by an artifact in the Epic's
  directory. Where a Spec Kit command in the journey leaves no artifact, that command MUST be changed
  to record one. **An artifact MUST record that the step ran, not only that it found something** — a
  step that completes without findings MUST still leave evidence, or a clean run is
  indistinguishable from no run (clarified 2026-08-09).
- **FR-ESK-018**: The clarification step MUST record a dated session for every run, stating
  explicitly when no questions were required. The **Clarified** stage MUST be derived from that
  session's presence, never from the absence of `[NEEDS CLARIFICATION]` markers — a spec written
  without markers has not been clarified, it has merely not been questioned (clarified 2026-08-09).
- **FR-ESK-019**: The analysis step MUST write a dated findings record naming each finding and its
  severity, so that both the **Analyzed** stage and the DOR's analysis condition are derived rather
  than declared (clarified 2026-08-09).

#### The register

- **FR-ESK-007**: Repository MUST publish a single register listing every Epic with its current
  stage, declared posture if any, and expected next Spec Kit command.
- **FR-ESK-021**: The register MUST be generated from the repository and committed to it, so it is
  readable without running anything — in a pull request, in the file tree, and in history. The
  committed copy MUST be regenerable, and a copy that disagrees with the repository MUST fail the
  build. The register MUST NOT be hand-edited (clarified 2026-08-09).
- **FR-ESK-008**: Every Epic directory under `specs/` MUST appear in the register with no
  registration step, and every non-Epic directory — `specs/_shared/` among them — MUST be excluded by
  an explicit stated rule.
- **FR-ESK-009**: The register MUST cover the journey up to and including Ready to Implement, and MUST
  NOT duplicate convergence, defect, closure, or promotion state, which Constitution IV, VI and VII
  already govern. Where that state is relevant, the register MUST reference the existing artifact.

#### Definition of Ready

- **FR-ESK-010**: Repository MUST define a written Definition of Ready — the complete set of
  conditions an Epic MUST satisfy before `/speckit-implement` may run against it.
- **FR-ESK-011**: Every DOR condition MUST be mechanically checkable. A condition that requires human
  judgement MUST NOT be admitted to the DOR; it belongs in a checklist, and the checklist's
  resolution is itself a DOR condition.
- **FR-ESK-012**: The DOR MUST include, at minimum: no unresolved `[NEEDS CLARIFICATION]` markers;
  a populated SRS traceability table with every uncovered requirement carrying a named back-fill
  owner; a completed principle-conformance position; a fully resolved requirements checklist; a plan
  whose Constitution Check gate passed; a task list in which every implementation task is paired
  with a test or executable conformance check (Constitution V); a **recorded** analysis whose
  findings file shows zero blocking constitution violations (FR-ESK-017); a stated Epic Exit
  Criteria section; an existing `defects/` folder (Constitution VI); and no blocking posture.
- **FR-ESK-013**: DOR evaluation MUST report **every** failing condition for an Epic, not the first
  encountered.
- **FR-ESK-014**: An Epic MUST NOT be shown as Ready unless every DOR condition passes, or every
  failing condition carries a valid waiver (FR-ESK-022). A condition that was not evaluated MUST NOT
  be reported as passing (Constitution IX honesty rule).
- **FR-ESK-022**: A DOR condition MAY be waived for one Epic. Every waiver MUST name the single
  condition it covers, an owning programme role — tech lead, product owner, or project owner — a
  reason, and an expiry date. A waiver MUST NOT be recorded against the DOR as a whole, against more
  than one condition, or without an expiry (clarified 2026-08-09).
- **FR-ESK-023**: An Epic carrying any waiver MUST read **Ready (waived)** and MUST NOT read plain
  Ready. The register MUST list every active waiver with its condition, owner, reason, and expiry.
  An expired waiver MUST fail the build, and a waiver naming no valid owning role MUST be reported
  as invalid (clarified 2026-08-09).

#### Verification and configuration

- **FR-ESK-015**: The stage sequence, the artifact evidence for each stage, the DOR condition set,
  the posture kinds, the Epic kinds, the roles permitted to own a waiver, and the Epic-directory
  exclusion rule MUST
  be held as configuration, so extending the journey is an ordinary edit and not a specification
  change. What a gate *means* remains a constitution amendment.
- **FR-ESK-016**: Repository MUST verify the register and the DOR with executable checks that read
  the repository and run in CI. An Epic shown as Ready that fails a DOR condition MUST fail the
  build, and so MUST a committed register that disagrees with the repository (FR-ESK-021); stalled
  Epics, missing postures, and out-of-order artifacts MUST be reported without failing it. Manual
  review MUST NOT satisfy this requirement.

### Key Entities

- **Epic Stage**: One named position in the journey. Attributes: name, order, artifact evidence that
  places an Epic in it, expected next Spec Kit command.
- **Stage Record**: One Epic's current position. Attributes: Epic identifier, derived stage, declared
  posture if any, expected next command, DOR result. Derived — not authored.
- **Posture**: A declared reason an Epic is not progressing. Attributes: Epic identifier, posture
  kind — **Held**, **Blocked**, or **Superseded** — reason, and the named releasing input, Epic, or
  replacing Epic. All three kinds block readiness, so blocking is a property of the concept rather
  than a per-record flag.
- **Epic Kind**: What an Epic *is*, as distinct from whether it has stopped. Either a **delivery**
  Epic, whose journey runs to Ready, or a **parent design**, whose journey completes at Planned and
  which names the child Epics it holds design for.
- **DOR Condition**: One checkable precondition for implementation. Attributes: identifier,
  statement, evidence read, severity, governing constitution principle.
- **Analysis Record**: The recorded outcome of one analysis run against one Epic (FR-ESK-017).
  Attributes: Epic identifier, date recorded, findings, per-finding severity, count of blocking
  constitution violations.
- **DOR Waiver**: A recorded, owned, expiring exception covering exactly one DOR condition for one
  Epic. Attributes: Epic identifier, waived condition, owning programme role, reason, expiry date.
- **DOR Evaluation**: The result of applying every condition to one Epic. Attributes: Epic
  identifier, per-condition pass or fail, failing conditions listed, waivers applied, overall
  readiness — passing, waived, or not ready.
- **Stage Register**: The published list of all Stage Records — generated, committed, and never
  hand-edited. Attributes: generation basis, Epic coverage, exclusion rule, agreement with the
  repository at last check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-ESK-001**: A reader can name the current stage and the next command for any Epic in the
  repository by consulting one document, without opening that Epic's directory.
- **SC-ESK-002**: 100% of Epic directories under `specs/` appear in the register; zero Epics are
  absent, and every excluded directory is excluded by a stated rule rather than by omission.
- **SC-ESK-003**: Every Epic in the register carries exactly one stage — zero Epics are unstaged and
  zero carry two.
- **SC-ESK-004**: Zero stage values are hand-maintained. Every value that can be derived from
  artifacts is derived, and re-producing the register with no repository change yields an identical
  result.
- **SC-ESK-013**: The committed register is readable without running anything, and zero committed
  copies that disagree with the repository reach the default branch.
- **SC-ESK-005**: Every Epic that has stopped is distinguishable as deliberately stopped or merely
  stalled; 100% of declared postures use one of the three defined kinds and name what accounts for
  them; and zero Epics carrying a posture are shown as Ready.
- **SC-ESK-006**: Every DOR condition is mechanically checkable; zero conditions rest on manual
  review.
- **SC-ESK-007**: An Epic failing any DOR condition is never shown as Ready, and a single DOR
  evaluation lists every failing condition, so zero repeat evaluations are needed to learn what
  remains.
- **SC-ESK-014**: Every DOR exception is visible: 100% of waivers name one condition, one owning
  role, a reason, and an expiry; zero Epics carrying a waiver read as plain Ready; and zero expired
  waivers reach the default branch.
- **SC-ESK-008**: Zero register content duplicates convergence, defect, closure, or promotion state
  already governed by the constitution — every such reference is a link.
- **SC-ESK-009**: The register and DOR are verified by executable checks in CI; a deliberately
  introduced disagreement between the register and the repository is reported within one check run.
- **SC-ESK-010**: The register agrees with the repository where hand-maintained prose does not:
  EPIC-018's task count reconciles to one number, EPIC-009 and EPIC-012 show as held with their
  releasing input, and EPIC-002 and EPIC-017 show as parent designs rather than as stalled.
- **SC-ESK-011**: Every stage in the journey is evidenced by an artifact; zero stages are reachable
  only by assertion, and a step that was run but not recorded advances no Epic.
- **SC-ESK-012**: Every journey step leaves evidence that it ran, including when it finds nothing;
  zero Epics are held back at a stage for having had no issues to record.

## Assumptions

- **This epic changes no application code.** Its outputs are governance artifacts and executable
  conformance checks. That is what makes it buildable while the product surface is held, and it is
  the same basis on which EPIC-018 proceeded.
- **This is a repository process epic, not a product feature.** The request names Spec Kit commands
  — Specify, Clarify, Checklist, Implement — and *"each epic"*, which are this repository's own
  constructs. Nothing here appears in PMI Studio's product surface. A Kanban view *inside the
  product* is separately recorded as not covered in `specs/srs-alignment.md` and would be product
  scope belonging to EPIC-012 Workflow & Tasks.
- **The journey is the Spec Kit chain the constitution already mandates**: specify → clarify →
  checklist → plan → tasks → analyze → ready. This epic names and records that sequence; it does not
  invent a new one, and it does not change the Development Workflow.
- **Stage is derived, posture is declared.** Everything computable from the file tree is computed;
  only the *reason* an Epic has deliberately stopped is authored, because no artifact can express
  intent. This split is the reason the register can be trusted, and it is how the repository already
  behaves — the D-10 delivery posture is written prose in each `spec.md` today, and this epic gives
  it a checkable home.
- **Constitution V is satisfied by executable conformance checks**, ratified programme-wide in
  constitution **v1.2.0** (2026-08-05). The checks are the tests for this epic's document outputs.
- **Checks run alongside the existing governance checks** and follow their established posture: they
  read the file tree, need no database or server, and are severity-split.
- **Severity follows EPIC-018's rule** — block on what is silent and compounding, report on what is
  visible on inspection. A false **Ready** blocks the build, because it authorises implementation on
  an Epic that has not passed its gates and nothing downstream would catch it. Stalled Epics, missing
  postures, and out-of-order artifacts report only, because they are apparent to any reader and a
  blocking check on an omission would halt unrelated work across every held Epic.
- **The DOR is evaluated fresh, never stamped.** Readiness is a function of current state, so
  amending a spec after the DOR passed withdraws readiness automatically.
- **Waivers are a pressure valve, not a shortcut** (clarified 2026-08-09). Every waiver is owned,
  reasoned, scoped to one condition, and expires; an Epic carrying one never reads plain Ready. The
  design assumption is that the realistic alternative to a recorded exception is an unrecorded one —
  someone weakening a check rather than admitting they skipped it — and a visible waiver is strictly
  better than a quietly softened gate.
- **Waiver ownership reuses the three programme roles** — tech lead, product owner, project owner —
  settled by EPIC-018's clarification of 2026-08-05. This epic does not introduce a second ownership
  model.
- **Two Spec Kit commands will be changed to record that they ran** (clarified 2026-08-09):
  analysis writes its findings (FR-ESK-019) and clarification writes a dated session even when it
  asks nothing (FR-ESK-018). Both sit under `.claude/skills/speckit-*/`, which Constitution I
  exempts, so these are ordinary edits and not a second epic. Both changes are additive — each
  command keeps reporting to the operator and additionally leaves evidence.
- **No existing Epic is retroactively demoted.** Epics analysed or clarified before this epic lands
  have no such evidence and read at the last stage they can prove, until the step is re-run. That is
  the honest reading rather than a regression, and it is the Constitution IX rule that an unrun
  check is never reported as passing, applied to history.
- **The stage sequence and DOR condition set are configuration, not principles**, following the
  `governance.config.json` precedent. Adding a stage is an ordinary edit; changing what a gate
  *means* remains a constitution amendment.
- **The DOR does not supersede the Epic Exit Criteria.** DOR gates the *entry* to implementation;
  Exit Criteria gate the exit from the Epic. They are different gates at different ends and neither
  replaces the other.
- **`governance/**` is exempt from the Spec Kit command gate** but `governance/README.md` and the
  checks are recorded as *not exempt* in the governance index; this epic's artifacts inherit whatever
  status the index assigns them, decided explicitly rather than assumed.
- **This epic must not weaken PP-002.** A stage register that restates what the file tree already
  says, in a form that can disagree with it, is the failure mode this epic is most likely to cause —
  which is why FR-ESK-003 forbids declaring anything derivable.

## Dependencies

- **EPIC-018 Repository Governance Process** — *soft, and already discharged in the parts that
  matter*. This epic reuses its `governance/` location, its governance index, its
  configuration-not-principles pattern, and its CI check harness. EPIC-018's own closure is recorded;
  nothing here waits on it.
- **`.claude/skills/speckit-analyze/` and `.claude/skills/speckit-clarify/`** — *in scope for this
  epic, not dependencies on another*. FR-ESK-019 requires the analysis step to record its findings;
  FR-ESK-018 requires the clarification step to record every session. Both paths are Constitution I
  exempt, so the changes are ordinary edits made under this epic's own tasks.
- **None blocking.** This epic depends on no held epic and on no unwritten SRS document.
- **Advisory**: decision **D-13** (the deferred 18-module re-cut) would change Epic identities and
  therefore every row of the register. It does not block this epic, but the register must not
  pre-empt it, and `plan.md` should record the dependency the way `governance/repository-layout.md`
  already does.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every artifact task has a **passing executable conformance check** — which satisfies
      Constitution V for documentation outputs (constitution v1.2.0). Manual review does not count
- [ ] The register covers 100% of Epic directories, and every exclusion is by a stated rule
- [ ] Zero stage values are hand-maintained; the register is reproducible from the repository alone
- [ ] Every DOR condition is mechanically checkable; zero rest on manual review
- [ ] Every journey step leaves evidence that it ran, including when it finds nothing — the
      clarification and analysis commands both record their runs (FR-ESK-018, FR-ESK-019)
- [ ] Zero active waivers are unowned, unexpiring, or scoped to more than one condition; zero
      waived Epics read as plain Ready
- [ ] PP-002 verified — zero register content duplicates convergence, defect, closure, or promotion
      state already governed by the constitution
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/026-epic-stage-kanban/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] Epic closure recorded in `closure.md`
