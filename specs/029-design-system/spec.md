# Epic Specification: Design System

**Epic**: `EPIC-029` | **Module**: cross-cutting (every module with a user interface)

**Created**: 2026-08-20

**Status**: Draft

**Authorised by**: decision [`D-41`](../_shared/decisions/D-41-the-design-system-waits-on-a-volume-that-does-not-exist.md)

**Delivery posture** (decision D-10):

> ▶ **PROCEEDING** — authorised 2026-08-20 by `D-41`, which found that the deferral to *SRS
> Volume 8* pointed at a document that was never written. This Epic implements **`PMI-DOC-005`
> Design System & UX Standards** (`UI-0001`–`UI-0042`). Readiness still runs through the
> Definition-of-Ready gate, not by declaration (EPIC-026).

## Clarifications

### Session 2026-08-20

- Q: PMI-DOC-005 puts brand identity out of scope, but the token layer needs concrete colour and
  type values — where do they come from? → A: **This Epic derives a neutral system palette
  itself** — restrained neutrals plus one accent, chosen to pass WCAG 2.2 AA in both themes. It
  makes no brand claim and is replaceable by swapping token values, which is what the token layer
  exists for. The alternative — waiting on brand input — would block the first thing this Epic
  builds on a decision nobody has scheduled.
- Q: Which browsers must the design system support? → A: **Modern evergreen only** — last two
  versions of Chrome, Edge, Firefox and Safari. This permits CSS nesting, `:has()`, container
  queries and modern colour functions, which keeps the token layer simple and the tooling thin.
  Recorded because *nothing in the programme stated a target*, so every component would otherwise
  have picked its own floor or none — the same gap the WCAG clarification closed for accessibility.
- Q: Twelve other Epics carry 39 UI tasks — who restyles those when they land? → A: **Each Epic
  styles its own work; EPIC-029 restyles only what exists today.** This Epic delivers the tokens,
  components and lint rule, then restyles the four pages and two components that exist now. Every
  future UI task builds on the system from the start, and the lint rule (`FR-DS-051`) makes that
  automatic rather than a promise. The alternative — one Epic owning all restyling — could not
  close until every other UI Epic had landed.
- Q: What counts as the recorded manual keyboard and screen-reader pass? → A: **A committed
  transcript naming the tool, its version, and each journey walked**, following this repository's
  own precedent (`v6-transcript.md`, the `T666` walkthrough record). A governance check can assert
  it exists and names a screen reader; a ticked checklist cannot fail on its own, which
  Constitution V calls decoration.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v0.1.md` | §6.1 Tokens | FR-DS-001 to FR-DS-004 |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v0.1.md` | §6.2 Themes | FR-DS-010 to FR-DS-012 |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v0.1.md` | §6.3 Components | FR-DS-020 to FR-DS-023 |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v0.1.md` | §6.4 Accessibility | FR-DS-030 to FR-DS-033 |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v0.1.md` | §6.5 Layout & content | FR-DS-040 to FR-DS-042 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v1.0.md` | §2 BG-01, BG-05, BG-06 | the business goals `PMI-DOC-005` serves |
| *(this Epic's clarification session, 2026-08-20)* | Clarifications | FR-DS-005, FR-DS-006, FR-DS-034, FR-DS-052 — decisions no upstream document had taken |

**Requirements not yet covered by SRS**: `FR-DS-005`, `FR-DS-006`, `FR-DS-034` and `FR-DS-052` were settled by this Epic's clarification session because **no upstream document had taken them** — the palette source, the browser floor, the accessibility evidence format, and restyle ownership. They are recorded here and flagged for `PMI-DOC-005` back-fill at its approval (owner: project owner). `PMI-DOC-005` is at **v0.1 Draft** — this Epic must
not be *approved* for implementation until it is approved, the same gate EPIC-023 and EPIC-025
carry for their SRS debt.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | `PMI-DOC-005` precedes any component |
| PP-002 | Single Source of Truth | Satisfied | the token file is the single definition (`FR-DS-002`) |
| PP-003 | Human-in-the-Loop | Satisfied | `D-42` (build vs adopt) is a human decision gating the component layer |
| PP-004 | End-to-End Traceability | Satisfied | BG → UI-xxxx → FR-DS-xxx → task |
| PP-005 | Modular Architecture | Satisfied | tokens, components and pages are three layers, consumed one way |
| PP-006 | Engine Independence | Not applicable | no engine surface |
| PP-007 | API & MCP First | Not applicable | presentation layer only |
| PP-008 | Security by Design | Partial | any third-party UI dependency needs security review before adoption (`D-42`) |
| PP-009 | Quality by Design | Satisfied | every requirement is testable by lint, automated check, or recorded manual pass |
| PP-010 | Observability by Default | Not applicable | no new telemetry surface |
| PP-011 | Documentation as Code | Satisfied | tokens and component contracts live in the repository |
| PP-012 | Everything Versioned | Satisfied | `PMI-DOC-005` is versioned; tokens are code |
| PP-013 | Knowledge-Driven Engineering | Satisfied | the component inventory is reusable organisational knowledge |
| PP-014 | Configuration over Customization | Satisfied | themes are token sets, not forks |
| PP-015 | Open Standards | Satisfied | WCAG 2.2 AA |
| PP-016 | Explainable AI | Not applicable | no AI surface |
| PP-017 | Cost-Aware AI | Not applicable | no model invocation |
| PP-018 | Scalability First | Not applicable | no runtime scaling concern |
| PP-019 | Continuous Improvement | Satisfied | accessibility checks in CI produce a trend |
| PP-020 | Customer Value | Satisfied | accessibility is contractual for enterprise customers |

**Deferral count**: 1 — `PP-008`, owned by decision `D-42`, discharged before the component layer
is implemented.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A person using the platform can operate it by keyboard and screen reader (Priority: P1)

Someone who does not use a mouse signs in, creates a project, and captures a requirement — reaching
every control by keyboard, seeing where focus is at all times, and hearing each control announced
with a meaningful name.

**Why this priority**: accessibility is the one standard this programme already ratified (EPIC-010,
2026-08-19), it is frequently contractual for enterprise customers, and it is the requirement most
expensive to retrofit once dozens of screens exist.

**Independent Test**: run the automated accessibility suite over every delivered page, then perform
the recorded manual keyboard and screen-reader pass. Both must pass with no mouse used.

**Acceptance Scenarios**:

1. **Given** any delivered page, **When** a user tabs through it, **Then** every interactive
   element is reachable in a sensible order and shows a visible focus indicator.
2. **Given** any delivered page, **When** the automated accessibility check runs in CI, **Then** it
   reports zero WCAG 2.2 Level AA violations.
3. **Given** a form with an invalid field, **When** it is submitted, **Then** the error is announced
   to assistive technology and identifies which field and what to correct.
4. **Given** a status shown with colour, **When** the page is viewed without colour perception,
   **Then** the same status is still distinguishable by text, icon, or shape.

---

### User Story 2 - Every screen in the platform looks like the same product (Priority: P1)

A user moves between sign-in, projects, requirements and traceability without encountering
different type scales, spacing rhythms, button shapes, or error presentations.

**Why this priority**: 39 UI tasks across 13 Epics are the reason this Epic exists. Without a shared
token layer each Epic invents its own, and the second Epic pays for the first Epic's absence of a
standard (BG-06).

**Independent Test**: a lint rule fails the build on any literal colour, size, space, radius or
duration outside the token file; the four delivered pages render from tokens alone.

**Acceptance Scenarios**:

1. **Given** a component with a hard-coded colour or spacing value, **When** the build runs,
   **Then** it fails and names the file and value.
2. **Given** the delivered pages, **When** a reviewer inspects them, **Then** every visual value
   resolves to a token defined once.
3. **Given** a new page written against the system, **When** it is built, **Then** it needs no new
   visual decisions beyond composing existing tokens and components.

---

### User Story 3 - Every asynchronous surface tells the user what is happening (Priority: P2)

A user who triggers a slow operation, opens an empty list, or hits an error sees a state that
explains itself and offers a way forward.

**Why this priority**: the first local UAT session met *"An unexpected error occurred"* with no
recovery path — permitted by no requirement, and prevented by none either. Loading, empty and error
are the three states most often omitted and most often encountered.

**Independent Test**: each component in the inventory demonstrates its loading, empty and error
presentations; each is asserted by a component test.

**Acceptance Scenarios**:

1. **Given** a list with no rows, **When** it renders, **Then** it explains why it is empty and what
   the user can do next — never a blank area.
2. **Given** a request in flight, **When** the user waits, **Then** a loading state is shown without
   blocking unrelated interaction.
3. **Given** a failed request, **When** the error renders, **Then** it says what went wrong and what
   to do next, and exposes no internal detail.

### Edge Cases

- **A user's operating system requests dark mode** — both themes are complete, so no token is
  undefined and no text lands on a same-coloured surface.
- **A user's system requests reduced motion** — animation is suppressed without breaking layout.
- **Text is enlarged to 200%** — layouts reflow without clipping or overlap (WCAG 1.4.4).
- **A component is used before its state is defined** — the lint rule and component tests fail
  rather than shipping a control with no focus or disabled appearance.
- **A brand identity arrives later** — token values are swapped; no component changes, because no component holds a literal value (`FR-DS-001`).
- **A future component library is adopted** — it must meet these requirements; it does not get to
  redefine them (`PMI-DOC-005` UI-0030).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-DS-001**: Every colour, type size, space, radius and duration in the interface MUST be a token.
- **FR-DS-002**: Tokens MUST be defined once, in one place, and consumed by reference.
- **FR-DS-003**: The space scale MUST be a fixed ratio scale rather than ad-hoc values.
- **FR-DS-004**: The type scale MUST define at most seven sizes with line heights and weights.
- **FR-DS-010**: Light and dark themes MUST both define every token.
- **FR-DS-011**: Theme selection MUST follow the operating-system preference by default and allow a persistent override.
- **FR-DS-012**: Colour MUST NOT be the sole carrier of meaning.
- **FR-DS-020**: Every component MUST implement each state that applies to it: default, hover, focus, active, disabled, loading, error, empty.
- **FR-DS-021**: Every asynchronous surface MUST define loading, empty and error presentations.
- **FR-DS-022**: Error presentations MUST state what went wrong and what to do next, and MUST NOT expose internal detail.
- **FR-DS-023**: The Phase 1 component inventory MUST exist: button, text input, select, checkbox, radio, form field with label and error, table, empty state, error state, loading indicator, modal, toast, navigation, page header, status pill.
- **FR-DS-030**: The interface MUST meet **WCAG 2.2 Level AA** — inherited from EPIC-010's clarification of 2026-08-19, not redefined here.
- **FR-DS-031**: Automated accessibility checks MUST run in CI over every page and component.
- **FR-DS-032**: A manual keyboard and screen-reader pass MUST be recorded at this Epic's exit.
- **FR-DS-033**: Every interactive element MUST be keyboard-operable with a visible focus indicator meeting contrast requirements.
- **FR-DS-040**: Layouts MUST be responsive to a stated minimum viewport, recorded in this Epic's plan.
- **FR-DS-041**: Every data table MUST offer filtering.
- **FR-DS-042**: Microcopy MUST name things as users recognise them; controls MUST state what happens and confirmations what happened.
- **FR-DS-050**: The four delivered pages (`SignIn`, `Projects`, `Requirements`, `Traceability`) and two components (`EngineSelector`, `RequirementEditor`) MUST be restyled onto the system.
- **FR-DS-051**: A lint rule MUST fail the build on any literal visual value outside the token definition file.
- **FR-DS-005**: The token values MUST be a **neutral system palette** derived by this Epic — restrained neutrals plus one accent — making no brand claim and replaceable by swapping token values *(clarified 2026-08-20)*.
- **FR-DS-006**: The system MUST support the last two versions of Chrome, Edge, Firefox and Safari, and MAY use CSS features available across that set *(clarified 2026-08-20)*.
- **FR-DS-034**: The manual keyboard and screen-reader pass MUST be recorded as a committed transcript naming the tool, its version, and each journey walked — not as a ticked checklist item *(clarified 2026-08-20)*.
- **FR-DS-052**: Restyling by this Epic covers **only the pages and components that exist at its start**. Every other Epic styles its own UI work against the system, enforced by `FR-DS-051` rather than by promise *(clarified 2026-08-20)*.

### Key Entities

- **Token**: a named visual decision with exactly one definition and a value per theme.
- **Component**: a reusable element with a contract and a defined set of states.
- **Theme**: a complete set of token values; two are required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-DS-001**: Zero WCAG 2.2 Level AA violations reported by the automated suite across every page and component.
- **SC-DS-002**: A person can complete sign-in, project creation and requirement capture using only a keyboard, with focus visible at every step.
- **SC-DS-003**: Zero literal visual values outside the token definition file, enforced by a check that fails the build.
- **SC-DS-004**: Every component in the Phase 1 inventory demonstrates each state that applies to it, each asserted by a test.
- **SC-DS-005**: Both themes render every delivered page with no undefined token and no text on a same-coloured surface.
- **SC-DS-006**: A new page can be built without introducing a visual value that is not already a token.
- **SC-DS-007**: Every token colour pair used for text meets WCAG 2.2 AA contrast in **both** themes, verified by an automated check rather than by inspection *(clarified 2026-08-20)*.
- **SC-DS-008**: The committed accessibility transcript names the screen reader, its version, and every journey walked *(clarified 2026-08-20)*.

## Assumptions

- `PMI-DOC-005` is approved before implementation begins; this Epic must not be *approved* while it is Draft (the EPIC-023/025 precedent).
- The component-library build-vs-adopt choice is **not** made here — `PMI-DOC-005` `RULE-05` requires it be recorded as decision **`D-42`** before the component layer is implemented. The token layer, lint rule and accessibility work do not depend on it and may proceed first.
- The frontend has **zero CSS files today**, so this Epic starts from nothing rather than migrating an existing style layer.
- React 18 is the frontend; no component library is currently a dependency, deliberately.
- The 39 existing UI tasks in other Epics are not blocked by this Epic — they ship plain and are restyled by `FR-DS-050` (`D-41`).
- The minimum supported viewport is recorded in this Epic's plan, not assumed per screen (`FR-DS-040`).
- The palette this Epic derives is **not** a brand identity and does not pre-empt one; a future brand replaces token values without touching a component (`FR-DS-005`).
- Browser support is stated once here (`FR-DS-006`) so component authors do not each pick a floor.
- Where the design system lives in the workspace — a `packages/` module or inside `frontend/` — is a structural decision for this Epic's plan, not a requirement.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

- [ ] Every implementation task has a passing unit test — or, for token/configuration outputs, a passing executable conformance check (Constitution V)
- [ ] `PMI-DOC-005` is approved (it is v0.1 Draft today) — this Epic may not be approved before it is
- [ ] Decision `D-42` (component library build vs adopt) is recorded, with security review if a dependency is adopted
- [ ] Automated accessibility checks pass in CI, and the manual keyboard and screen-reader pass is recorded (`FR-DS-032`)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/029-design-system/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task named as a concrete Spec Kit command (Constitution IX)
