# Feature Specification: Repository Governance Process

**Feature Branch**: `018-repository-governance`

**Epic**: `EPIC-018` — Repository Governance Process *(process, not product)*

**Created**: 2026-08-04

**Status**: Draft — ready for planning

**Input**: The repository-process half of
`SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx`, split out of EPIC-017 by the
clarification of 2026-08-04 (Q1 → C).

**Parent product spec**: none. **This epic produces no product capability.** Its artifacts govern how
*this repository* specifies, plans, and builds — the same category as `.specify/` and
`.specify/memory/constitution.md`.

**Sibling epic**: [EPIC-017 Enhancement Model](../017-enhancement-model/) — the *product* half,
which remains held.

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING.** Buildable now. Nothing here depends on `PMI-DOC-004` or on approved business
> scope, because nothing here is product surface. This is the same product/process seam that split
> EPIC-013 out of EPIC-003.

## Purpose

The source document recommends a repository shape — steering files, a directory layout, a Spec Kit
folder mapping, internal templates, and governance artifacts — that this programme does not yet have.
EPIC-018 adopts that shape for **this repository**, and only for this repository.

The value is concrete: today the standards that govern generation in this repo live in a constitution,
a set of templates, and the working memory of whoever is at the keyboard. Steering files make them
explicit, versioned, and inspectable — which is exactly the argument PP-011 "Documentation as Code"
makes, applied to the programme itself.

## Clarifications

### Session 2026-08-05

- Q: When a task's only output is a markdown document rather than running code, what satisfies Constitution V's non-negotiable requirement for a paired test? → A: **A — an executable conformance check satisfies Constitution V**, ratified as a constitution amendment so it applies programme-wide rather than as a per-epic exemption. This also settles the same open question in EPIC-003 (`T088`/`T089`), EPIC-014 (`T149`) and EPIC-016.

- Q: Should the governance files this epic creates be exempt from Constitution I's rule that code may only be changed via a Spec Kit command? → A: **A — exempt `governance/**`**, recorded explicitly in the governance index alongside `.specify/**` and `specs/**`. Standards are cheap to revise; governance is not, so the constitution itself stays non-exempt.

- Q: When a governance conformance check fails, should it block the build for everyone, or report without stopping work? → A: **C — split.** The duplication check (`SC-RGP-003`, PP-002) **blocks** the build; coverage and conformance checks **report** without failing CI. Duplication is the one failure here that is silent and compounding; omissions are visible on inspection. Mirrors `pnpm test:arch`, which blocks on exactly one invisibly-eroding property.

- Q: Who owns a steering file, and what happens when nobody is named? → A: **B — the existing three programme roles**: tech lead, product owner, project owner, one assigned per subject. Reuses the ownership model the principle register and SRS back-fill obligations already use, rather than inventing a second one. A file naming no role fails its conformance check.
  Assignment: **tech lead** — architecture, technology-stack, coding-standards, security, ai-governance. **Product owner** — product, business-rules, ui-standards. **Project owner** — organization, workspace.

- Q: What stops a steering file from going stale — current in form, but no longer true in practice? → A: **A — a `last_reviewed` date in front matter**, with a check reporting files not reviewed within the interval. Interval set at **90 days** (quarterly); the check **reports**, it does not block, per the severity split above. Chosen because it is the only mechanically checkable option, which is what every other criterion in this epic demands of itself.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Steering Files — ten named files | FR-RGP-001 to FR-RGP-004 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Recommended Repository — `docs/specs/architecture/planning/tasks/tests/apis/database/knowledge/adr/governance/prompts/agents/automation/` | FR-RGP-005 to FR-RGP-007 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Spec Kit Mapping — `/specs/{vision,requirements,capabilities,features,architecture,planning,implementation,testing,deployment,operations,knowledge,steering}` | FR-RGP-006, FR-RGP-008 |
| `SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` | Guiding Principles — specification-first; everything versioned, traceable, reviewable | FR-RGP-009, FR-RGP-013; SC-RGP-001 to SC-RGP-008 |
| `SRS/PMI-DOC-000_Product_Documentation_and_Specification_Standard_v1.0.docx` | §3 Requirement Identifiers; §4 Standard Document Structure (13 sections); §5 Traceability Rules; §9 ADRs | FR-RGP-010 to FR-RGP-013 — **governing authority for this epic (D-16)** |
| `SRS/PMI-DOC-003_Product_Principles_v1.0.docx` | PP-011 Documentation as Code; PP-012 Everything Versioned | FR-RGP-003, FR-RGP-009 |
| `.specify/memory/constitution.md` | Principles I, II, III, VIII, IX; §Repository & Environment Governance | FR-RGP-009, FR-RGP-014, FR-RGP-015 |
| `specs/srs-alignment.md` | **D-16** authority layering; **D-2**, **D-4**, **D-13** open | FR-RGP-010, FR-RGP-011, FR-RGP-013 |

**Requirements not yet covered by SRS**: FR-RGP-014 and FR-RGP-015 encode the constitution's own
session-labelling and closing-report duties (Principles VIII and IX, added in constitution v1.1.0) as
repository artifacts. They derive from the constitution rather than from `SRS/`.

**FR-RGP-016** (steering-file currency) derives from **neither** — it came from the clarification
session of 2026-08-05, which found that every check in this epic verified a file's *form* and none
verified its *accuracy*. Declared here rather than left implicit.

Back-fill owner for all three: project owner — to be reflected in `PMI-DOC-000` if the standard is
amended.

## Principle Conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md). This epic
records only where it differs or is the place a principle is satisfied.

| Principle | Status in this epic |
|---|---|
| PP-011 Documentation as Code | ✅ **Satisfied here for the programme.** Steering, templates, and governance artifacts become versioned repository text rather than convention |
| PP-012 Everything Versioned | ✅ Satisfied here for governance artifacts — steering files are versioned with the repository they govern |
| PP-002 Single Source of Truth | ⚠️ **At risk, and this epic must not make it worse.** Steering files can restate what the constitution and templates already say. FR-RGP-004 requires reference over duplication |
| PP-013 Knowledge-Driven Engineering | 🔶 Deferred — unchanged. The `knowledge/` directory in the recommended layout is a *location*, not the M-10 capability |

No other principle's platform status changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standards that govern generation are written down (Priority: P1)

An engineer records this repository's standards — architecture posture, coding standards, security
expectations, technology stack, AI governance rules — as steering files. From then on, anyone (human
or agent) running a Spec Kit command in this repository works from the same written standards instead
of from convention and memory.

**Why this priority**: Every other story here organises or references standards. This one creates
them. It is also the story with immediate value: the programme already has implicit standards, and
writing them down costs a session, not an epic.

**Independent Test**: Record a steering file stating one standard, run a Spec Kit command that would
otherwise violate it, and confirm the standard is honoured or the violation is visible.

**Acceptance Scenarios**:

1. **Given** the steering directory exists, **When** an engineer looks for the repository's coding
   standards, **Then** they find them in a single named file rather than inferring them from code.
2. **Given** a steering file changes, **When** the change is committed, **Then** its history shows
   who changed which standard and when.
3. **Given** a steering file contradicts the constitution, **When** the contradiction is found,
   **Then** the constitution wins and the steering file is corrected — steering never overrides
   governance.
4. **Given** a steering file would restate content already in the constitution or a template,
   **When** it is authored, **Then** it references the source instead of copying it.

---

### User Story 2 - Every artifact type has one obvious home (Priority: P1)

Anyone joining the programme — or any agent working in it — can determine where an artifact belongs
without asking: specifications, architecture, planning, tasks, tests, API definitions, database
design, decision records, governance, prompts, agents, and automation each have one location, and the
mapping is written down.

**Why this priority**: The programme already has 65 tracked files under `specs/` plus `adr/`,
`.specify/`, and four code trees, and the `_shared/` convention had to be documented in a README
"Known limitation" section because tooling could not find it. A written layout is what stops that
recurring.

**Independent Test**: Name six artifact types and have a newcomer place each correctly using only the
written layout.

**Acceptance Scenarios**:

1. **Given** the layout is defined, **When** someone needs to add an artifact of a known type,
   **Then** exactly one location is correct and the document says which.
2. **Given** an artifact exists outside its defined location, **When** the layout is checked, **Then**
   the exception is reported.
3. **Given** the existing `specs/<epic>/` structure, **When** the new layout is adopted, **Then**
   existing paths either remain valid or their migration is explicitly recorded — no path breaks
   silently.

---

### User Story 3 - Internal templates match the standard that governs them (Priority: P2)

The repository's own specification, plan, and task templates conform to `PMI-DOC-000`, so a document
produced by a Spec Kit command is conformant by construction rather than by review.

**Why this priority**: P2 because templates already exist and work. This story makes them conformant,
which matters once anyone audits the repository against `PMI-DOC-000` — but nothing is blocked
meanwhile.

**Scope note (D-16)**: these templates follow **`PMI-DOC-000`**, not the enhancement document's
twenty-one-section structure. That structure governs PMI Studio's product outputs and is EPIC-017's.
Whether the internal templates move to `PMI-DOC-000`'s thirteen sections is **decision D-4**, which
this epic surfaces but does not pre-empt.

**Independent Test**: Generate a document from each template and check it against the governing
standard's required sections.

**Acceptance Scenarios**:

1. **Given** a template, **When** it is checked against `PMI-DOC-000`, **Then** every required
   section is present or its absence is recorded as a known deviation with a reason.
2. **Given** a document generated from a template, **When** it is audited, **Then** it conforms
   without hand-editing.
3. **Given** `PMI-DOC-000` is amended, **When** the templates are re-checked, **Then** the divergence
   is reported rather than discovered later.

---

### User Story 4 - Repository traceability is a stated convention (Priority: P2)

How artifacts in this repository link to one another — requirement to specification, specification to
task, task to code, decision to specification — is written down as a convention that can be checked,
rather than being an emergent property of how people happen to cross-reference.

**Why this priority**: P2 because the existing chain works and is exercised daily. The value is
making it checkable — the `/speckit-analyze` pass of 2026-08-03 found cross-epic references that
were correct but invisible to per-epic convergence.

**Scope note (D-16)**: repository traceability stays governed by `PMI-DOC-000` and the eventual
resolution of decision **D-2**. The enhancement document's twelve-link chain is a *product*
capability and belongs to EPIC-017.

**Independent Test**: Pick an artifact, follow the documented convention to its neighbours, and
confirm the links resolve.

**Acceptance Scenarios**:

1. **Given** the convention is written, **When** an artifact is created, **Then** the links it must
   carry are unambiguous.
2. **Given** an artifact missing a required link, **When** the convention is checked, **Then** the
   gap is reported naming the missing link type.
3. **Given** a link that crosses an epic boundary, **When** it is recorded, **Then** the crossing is
   explicit rather than implied.

---

### User Story 5 - The governance surface is itself an artifact (Priority: P3)

The programme's governance — constitution, templates, steering, layout, conventions — is discoverable
from one place, versioned, and reviewable, in the way `.specify/` already is for Spec Kit's own
scaffolding.

**Why this priority**: P3 because the pieces exist and function; this consolidates them. Real value,
but nothing waits on it.

**Independent Test**: From the repository root, locate every governance artifact and its current
version without searching the file tree.

**Acceptance Scenarios**:

1. **Given** the governance surface is defined, **When** someone asks what governs this repository,
   **Then** one document answers, and it links to each artifact.
2. **Given** a governance artifact changes, **When** the change lands, **Then** it is versioned and
   attributed.

### Edge Cases

- **Steering file contradicts the constitution**: the constitution wins; steering is corrected. There
  is no scenario where a steering file overrides Constitution governance.
- **The recommended layout conflicts with the existing `specs/` structure**: the conflict is recorded
  and decided, not resolved by moving files silently — 65 tracked files depend on current paths.
- **The layout conflicts with decision D-13's deferred module re-cut**: adoption must not pre-empt
  D-13; a layout change and a taxonomy re-cut touching the same paths should happen in one pass.
- **A steering file duplicates a template section**: reference wins over copy, or the two drift and
  PP-002 is violated by the very epic meant to strengthen it.
- **A newly created artifact type has no defined home**: reported as a gap in the layout rather than
  placed by guess.
- **Constitution I forbids editing application code outside a Spec Kit command**, but exempts
  `.specify/**` and `specs/**`. Artifacts this epic creates **outside** those paths need their
  exemption status decided explicitly.

## Requirements *(mandatory)*

> **Identifier scheme**: `FR-RGP-###` / `SC-RGP-###`. Namespaced to avoid conflict **C-01** and to
> keep process requirements visibly distinct from product requirements.

### Functional Requirements

#### Steering files

- **FR-RGP-001**: Repository MUST define steering files covering the subjects named by the source
  document: organization, workspace, product, architecture, coding standards, security, UI standards,
  business rules, technology stack, and AI governance.
- **FR-RGP-002**: Each steering file MUST state the standards it governs in terms that can be checked
  against an artifact, not as aspiration.
- **FR-RGP-003**: Steering files MUST be versioned with the repository, with authorship and change
  history retained.
- **FR-RGP-004**: Steering files MUST reference the constitution, templates, or SRS where content
  already exists there, and MUST NOT duplicate it.
- **FR-RGP-005**: Where a steering file and the constitution conflict, the constitution MUST win, and
  the steering file MUST be corrected.

#### Repository layout and mapping

- **FR-RGP-006**: Repository MUST define one documented location for each artifact type it holds.
- **FR-RGP-007**: The layout MUST record how it relates to the existing `specs/<epic>/` and
  `specs/_shared/` structure, including any path that must migrate.
- **FR-RGP-008**: The layout MUST NOT pre-empt decision **D-13** (the deferred 18-module re-cut);
  where the two touch the same paths, the layout MUST record the dependency.
- **FR-RGP-009**: Repository MUST publish a single governance index naming every governance artifact,
  its purpose, its current version, and **whether its path is exempt from the Spec Kit command gate**
  (Constitution I).

#### Internal templates and conventions

- **FR-RGP-010**: Repository templates MUST be checked against `PMI-DOC-000`, with every required
  section present or its absence recorded as a deviation with a reason.
- **FR-RGP-011**: Repository templates MUST follow `PMI-DOC-000`, **not** the enhancement document's
  twenty-one-section structure (**D-16**).
- **FR-RGP-012**: Repository MUST define its planning and task-document structure, so a plan or task
  list is conformant by construction.
- **FR-RGP-013**: Repository MUST state its internal traceability convention — which artifact types
  link to which, and which links are required — governed by `PMI-DOC-000` and the resolution of
  decision **D-2**.

#### Constitutional process artifacts

- **FR-RGP-014**: Repository MUST define the session-labelling convention required by Constitution
  VIII, including the label format and where it is applied.
- **FR-RGP-015**: Repository MUST define the closing-report format required by Constitution IX,
  including its two mandatory sections and the honesty rule that unrun checks are never reported as
  passing.

#### Currency

- **FR-RGP-016**: Every steering file MUST record when it was last reviewed, and the repository MUST
  report files not reviewed within 90 days. Reporting only — a stale file is not a build failure
  (clarified 2026-08-05).

### Key Entities

- **Steering File**: One versioned statement of repository standards. Attributes: subject, scope,
  content, version, author, last changed.
- **Artifact Location**: The defined home for one artifact type. Attributes: artifact type, path,
  governing standard, migration note.
- **Governance Index**: The single document naming every governance artifact. Attributes: artifact,
  purpose, path, version.
- **Traceability Convention**: One stated link rule. Attributes: source type, target type, required
  flag, governing standard.
- **Template Conformance Record**: The check of one template against its standard. Attributes:
  template, standard, required sections present, recorded deviations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-RGP-001**: Someone new to the programme can name the repository's coding, security, and
  architecture standards by reading one file each, without asking anyone.
- **SC-RGP-002**: 100% of the ten steering subjects named by the source document have a corresponding
  file, or a recorded reason for absence.
- **SC-RGP-003**: Zero steering content duplicates the constitution or a template — every overlap is
  a reference. **This check fails the build**; it is the only governance check that does (clarified
  2026-08-05).
- **SC-RGP-004**: Every artifact type in the repository has exactly one documented location; zero
  types are undefined.
- **SC-RGP-005**: Zero existing paths break on layout adoption — every migration is recorded before
  it happens.
- **SC-RGP-006**: Every repository template is checked against `PMI-DOC-000`, with each deviation
  recorded and reasoned; zero unexamined templates.
- **SC-RGP-007**: A reader can determine what governs this repository from a single index.
- **SC-RGP-008**: Every required inter-artifact link is stated as a checkable rule; zero links exist
  only by convention.
- **SC-RGP-009**: Every steering file records a review date, and zero files pass their 90-day
  interval without being reported.

## Assumptions

- **This epic changes no application code.** Its outputs are governance and documentation artifacts.
  That is what makes it buildable while the product surface is held.
- **Constitution V is satisfied by executable conformance checks**, not unit tests (clarified
  2026-08-05). A governance document that no check reads is a document that silently rots, so the
  check is the test. Checks run under `pnpm test:governance` in CI — manual review does not
  satisfy the gate. Ratified programme-wide in constitution **v1.2.0**
  (2026-08-05).
- **Steering files govern this repository only.** PMI Studio's product Steering Engine is EPIC-017's
  FR-ENH-001 to FR-ENH-005 and is a different thing that happens to share a name.
- **The layout is adopted incrementally.** The recommended directories are created and populated as
  artifacts arrive; the epic does not require a big-bang move of 65 tracked files.
- **`PMI-DOC-000` governs, per D-16** — and whether the internal templates move to its thirteen
  sections remains **decision D-4**, which this epic surfaces rather than settles.
- **`governance/**` is exempt from the Spec Kit command gate** (clarified 2026-08-05), joining
  `.specify/**` and `specs/**`. The exemption is recorded in the governance index, not assumed. The
  **constitution itself remains non-exempt** — amending governance still requires
  `/speckit-constitution`. `governance/**` was added to Constitution I's exempt list in
  **v1.2.0** (2026-08-05), alongside the Constitution V ruling above.
- **Governance checks are split by severity** (clarified 2026-08-05): the duplication check blocks
  CI; coverage, layout, template-conformance and process checks report without failing it. A
  blocking check on an *omission* would halt unrelated work across every held epic for a missing
  document; a non-blocking check on *duplication* would let two sources of truth diverge unseen.
- **The review interval is 90 days**, chosen as a quarterly cadence long enough not to become
  noise. It is configuration, not a principle — changing it should not require a spec change.
- **This epic must not weaken PP-002.** Written standards that restate other written standards create
  two sources of truth, which is the failure mode this epic is most likely to cause.

## Dependencies

- **None blocking.** This epic depends on no held epic and on no unwritten SRS document.
- **Advisory**: decision **D-4** (template structure) and **D-13** (module re-cut) both touch this
  epic's outputs. Neither blocks it; both should be recorded as dependencies in `plan.md`.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every artifact task has a **passing executable conformance check** — which satisfies
      Constitution V for documentation outputs (clarified 2026-08-05). Manual review does not count
- [x] The Constitution V amendment ratifying conformance checks has been made — constitution
      **v1.2.0**, 2026-08-05. This epic rests on governance, not on a reading
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/018-repository-governance/defects/` contains no open defect records
- [ ] Principle deltas above still hold; PP-002 verified — zero steering content duplicates the
      constitution or a template
- [ ] Every layout migration recorded before execution; zero silently broken paths
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] Epic closure recorded in `closure.md` (Phase Z); this epic is **release-eligible**
- [ ] Platform promotion `local → dev → stage → prod` is gated separately by [EPIC-014 F-11.2](../014-devops-release/tasks.md) — it is **not** this epic's to discharge
