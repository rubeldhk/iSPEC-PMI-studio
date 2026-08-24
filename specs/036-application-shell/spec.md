# Feature Specification: Application Shell & Dashboard

**Feature Branch**: `036-application-shell`

**Epic**: `EPIC-036` — Application Shell & Dashboard

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Application Shell & Dashboard — the Epic that owns `U-20` (`BR-0191`).
Implements PMI-DOC-006 v1.0 (APPROVED 2026-08-24 under `D-44`): §4 navigation architecture, §5
cross-cutting surfaces, §6 the Room pattern, §7 shell layout and the 360px floor, §8 screen-level
state requirements. Also delivers the Home/dashboard area, which no Epic owns today."

> **Why this Epic exists.** `BR-0190` — *"Core lifecycle capabilities MUST be navigable as one
> coherent application"* — is a **MUST**, and no Epic has ever owned it. Every screen Epic built its
> own page correctly; nothing owned assembling them. The consequence was `DEF-010-001`: nine page
> components existed and four were reachable, for five months, while every gate stayed green.
> `EPIC-010` `T200a`–`T200e` routed the five, and that fix is a corridor of buttons on a project
> page — the smallest thing that made them reachable, and visibly not a product. **This Epic owns
> the composition itself.**

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0190` — Unified application | `FR-SHL-001`, `FR-SHL-010`–`FR-SHL-016` |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0001` — Tenant isolation; `BR-0003` — Authorization | `FR-SHL-020`–`FR-SHL-024`, `FR-SHL-014` |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0010` — Project lifecycle; `BR-0013` — Health model | `FR-SHL-030`–`FR-SHL-034` |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0192` — Decision visibility; `BR-0174` — Policy explainability | `FR-SHL-032`, `FR-SHL-033` |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0191` — Room pattern *(SHOULD)* | `FR-SHL-040`–`FR-SHL-043` |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | `BR-0193` — Accessible interface | `FR-SHL-050`–`FR-SHL-053`, `FR-SHL-060`–`FR-SHL-062` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §4.1 `UX-0001`–`UX-0003` — navigation structure | `FR-SHL-010`–`FR-SHL-016` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §4.2 `UX-0010`–`UX-0012` — persistent context | `FR-SHL-020`–`FR-SHL-024` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §5 — cross-cutting surfaces | `FR-SHL-030`–`FR-SHL-034` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §6 — the Room pattern | `FR-SHL-040`–`FR-SHL-043` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §7 — shell layout, breakpoints, `UX-0040` 360px floor | `FR-SHL-050`–`FR-SHL-053` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §8 — screen-level state requirements | `FR-SHL-060`–`FR-SHL-062` |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §9 `UX-0060` — ownership | `FR-SHL-002`, `FR-SHL-003` |
| `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md` | the whole document | every visual and accessibility requirement, consumed and never restated |

**Requirements not yet covered by SRS**: **none.**

> **This Epic is the first of the shell family to start with an approved document behind it.**
> `EPIC-030`–`EPIC-035` each recorded *"PMI-DOC-006 v1.0 is PROPOSED, not approved"* as a named
> risk. `D-44` discharged it on 2026-08-24, and `UX-0003` was scoped to **declared** areas in the
> same act — which is the requirement this Epic is built on, so it matters that it now says what it
> means.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | the shell renders what the Epics specified; it originates no product capability of its own |
| PP-002 | Single Source of Truth | Satisfied | the area registry (`FR-SHL-002`) is the one place an area's existence is declared; navigation is derived from it, never hand-listed |
| PP-003 | Human-in-the-Loop | Satisfied | the shell surfaces what needs a human — pending approvals, policy blocks, missing evidence (`BR-0192`) — and decides nothing |
| PP-004 | End-to-End Traceability | Satisfied | `FR-SHL-021` keeps workspace and project visible on every data-bearing screen, so what a user is looking at is never inferred |
| PP-005 | Modular Architecture | Satisfied | the shell owns composition and **no screen's content**. `FR-SHL-003` forbids it implementing an area |
| PP-006 | Engine Independence | Not applicable | no engine is reachable from the shell |
| PP-007 | API & MCP First | Satisfied | the dashboard reads existing endpoints; `FR-SHL-034` forbids a shell-only aggregation endpoint that no other client can call |
| PP-008 | Security by Design | Satisfied | `FR-SHL-014` — an area the identity cannot act in is hidden or disabled with a reason, and never present-and-failing on click (`BR-0003`) |
| PP-009 | Quality by Design | Satisfied | `FR-SHL-060`–`FR-SHL-062` make loading, empty, error and partial states requirements rather than afterthoughts — the distinction `DEF-010-001`'s five blank pages did not have |
| PP-010 | Observability by Default | Partial | the shell emits navigation and context-switch events through `EPIC-001`'s existing instrumentation; **no shell-specific telemetry is added**. Remainder lands with `EPIC-001` if a shell metric is ever needed |
| PP-011 | Documentation as Code | Satisfied | the area registry is committed configuration, and `FR-SHL-016`'s check reads it |
| PP-012 | Everything Versioned | Satisfied | nothing here persists user data; the registry is versioned with the repository |
| PP-013 | Knowledge-Driven Engineering | Satisfied | the dashboard's attention list is derived from existing records, never a second store (`FR-SHL-034`) |
| PP-014 | Configuration over Customization | Satisfied | declaring an area is a registry entry, not a code change in the shell (`FR-SHL-002`) — which is what makes eighteen areas arriving over four releases bearable |
| PP-015 | Open Standards | Satisfied | native elements and ARIA per PMI-DOC-005; no proprietary navigation model |
| PP-016 | Explainable AI | Not applicable | the shell hosts no AI surface. `UX-0024`'s contextual assistant is a **Room** surface, specified by the Room Epics |
| PP-017 | Cost-Aware AI | Not applicable | as above |
| PP-018 | Scalability First | Partial | `SC-SHL-006` bounds first-paint and navigation response; **no load target is set for the dashboard's aggregation**, because the number of concurrent users is `U-11` territory and unowned. Remainder lands with `EPIC-015` |
| PP-019 | Continuous Improvement | Satisfied | `FR-SHL-016`'s reachability check is the DORA-style guard that would have caught `DEF-010-001` |
| PP-020 | Customer Value | Satisfied | `BR-0190` is the requirement a user experiences as *"this is one product"*, and it is the one this Epic exists to satisfy |

**Deferral count**: **0.** Two principles are Partial and each names where its remainder lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every declared area is reachable from one navigation (Priority: P1) 🎯 MVP

A signed-in user sees a single persistent navigation listing every area the product currently has,
grouped so that eighteen destinations stay legible. They can reach any of them from anywhere,
without returning to a project page to find a button.

**Why this priority**: it is `BR-0190`, the MUST that no Epic has owned, and it is the whole reason
`DEF-010-001` was possible. Everything else in this Epic is an improvement on a shell; this **is**
the shell.

**Independent Test**: sign in, and reach every declared area from the navigation without using
browser history or a URL. Delivers the coherent application `BR-0190` requires.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the application, **Then** primary navigation
   presents every declared area in the four groups of PMI-DOC-006 §4.1, and no area appears twice.
2. **Given** any area, **When** the user selects it, **Then** that area renders and the navigation
   remains present and marks where they are.
3. **Given** an area whose Epic is **not** declared, **When** navigation renders, **Then** the area
   is absent — not disabled, not a placeholder (`UX-0060`).
4. **Given** a newly declared area, **When** it is added to the registry, **Then** it appears in
   navigation **without a change to the shell's code**.

---

### User Story 2 - Workspace and project are explicit, and never inferred (Priority: P1)

A user always knows which workspace and project they are looking at, can switch either without
losing the area they are in, and never has to deduce scope from the contents of a list.

**Why this priority**: `BR-0001` is tenant isolation, and the failure mode is silent — a user acting
on the wrong project sees a plausible screen. `DEF-007-001` records the same class one layer down: a
project-scoped list that cannot tell *"no such project"* from *"this project is empty"*.

**Independent Test**: switch project while inside an area; confirm the area stays and its content
changes. Confirm every data-bearing screen names its scope.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** any screen renders, **Then** the current workspace and
   project are visible without opening a menu.
2. **Given** a user inside an area, **When** they switch project, **Then** they remain in that area
   and its content re-scopes.
3. **Given** a breadcrumb, **When** it renders, **Then** it reads `workspace / project / area`
   (`UX-0012`).
4. **Given** a workspace with no projects, **When** an area needing a project renders, **Then** it
   says so and offers to create one — it does not render empty.

---

### User Story 3 - Home tells a user what needs them (Priority: P2)

A user opens the product and sees what is waiting: pending approvals, policy blocks, missing
evidence, and the health of the projects they own — without visiting each area to find out.

**Why this priority**: `BR-0192` requires decision visibility and `BR-0013` requires derived project
health. Both exist as requirements today with no surface. It is P2 rather than P1 because a
navigable product without a dashboard is usable, and a dashboard without navigation is not.

**Independent Test**: create a pending approval and an unmet evidence item; confirm both appear on
Home with a route to the thing that needs the action.

**Acceptance Scenarios**:

1. **Given** items awaiting the user, **When** Home renders, **Then** each is listed with what it
   is, which project it belongs to, and a way to reach it.
2. **Given** nothing awaiting the user, **When** Home renders, **Then** it says so — distinctly from
   still loading and from failing to load.
3. **Given** project health, **When** it renders, **Then** it is **derived** from current scope,
   decisions, risks and progress (`BR-0013`), and no health value is stored.
4. **Given** an area whose Epic is undeclared, **When** Home aggregates, **Then** it contributes
   nothing rather than an empty section.

---

### User Story 4 - The shell holds at 360px and on a keyboard (Priority: P2)

A user on a narrow viewport, or using only a keyboard and a screen reader, can reach every area and
knows where they are.

**Why this priority**: `BR-0193` and `UX-0040` are MUSTs, and a navigation that collapses into
unreachability at 360px fails `BR-0190` on the device it fails on.

**Independent Test**: at 360px, reach three areas in different groups using only the keyboard.

**Acceptance Scenarios**:

1. **Given** a 360px viewport, **When** the shell renders, **Then** navigation remains reachable and
   the current area's state, decision and evidence regions stay visible (`UX-0040`).
2. **Given** keyboard-only operation, **When** the user tabs, **Then** focus order follows the
   visible order and every focused control shows a visible indicator.
3. **Given** a screen reader, **When** navigation renders, **Then** groups are announced as groups
   and the current area as current.

---

### User Story 5 - The Room pattern belongs to the shell, not to each Room (Priority: P3)

The Requirement, Change and Defect Rooms present one interaction model, because they compose one
shell region set rather than three that resemble each other.

**Why this priority**: `BR-0191` is a *SHOULD*, and `EPIC-033` already built the shared contract
(`packages/room-contract`, `frontend/src/rooms/RoomShell.tsx`) that `EPIC-034` and `EPIC-035` import.
This Epic **adopts** that work rather than replacing it — which is why it is P3 and not P1.

**Independent Test**: render two Rooms and compare their region vocabulary against
`packages/room-contract`'s by comparison, not by review.

**Acceptance Scenarios**:

1. **Given** any Room, **When** it renders inside the shell, **Then** it presents the six regions of
   `ROOM_REGIONS` and no seventh.
2. **Given** a Room, **When** the shell hosts it, **Then** the shell supplies the frame and the Room
   supplies the regions — neither restates the other's vocabulary.

---

### Edge Cases

- **An area is declared mid-release.** Navigation must gain it from the registry alone. If the shell
  needs a code change per area, `FR-SHL-002` has failed and eighteen areas over four releases become
  eighteen shell changes.
- **A user can act in no area of a group.** The group must not render as an empty heading.
- **A deep link into an undeclared area.** Must answer as not-found, not as an empty area — the
  distinction `DEF-001-006` currently gets wrong platform-wide, and this Epic must not add to it.
- **A user's permissions change while they are in an area.** The area must not silently continue;
  the shell re-evaluates on the next navigation at minimum.
- **The dashboard's source is unavailable.** Home must report a failed section as failed, not as
  empty — `FR-SHL-062`.
- **Navigation at 360px with all eighteen areas declared.** The collapse behaviour must still reach
  every area; "scroll a long list" is an answer, "hide the fourth group" is not.

## Requirements *(mandatory)*

### Functional Requirements

*Scope and ownership — `UX-0060`, `BR-0190`.*

- **FR-SHL-001**: The shell MUST present the product as one coherent application: every declared area
  reachable from one persistent navigation (`BR-0190`).
- **FR-SHL-002**: Areas MUST be declared in a **committed registry**, and navigation MUST be derived
  from it. Adding a declared area MUST NOT require a change to the shell's own code.
- **FR-SHL-003**: The shell MUST NOT implement the content of any area. An area whose Epic is not
  declared MUST NOT appear (`UX-0060`), and the shell MUST NOT render a placeholder for it.

*Navigation — PMI-DOC-006 §4.1.*

- **FR-SHL-010**: Primary navigation MUST be a single persistent surface presenting areas in the four
  groups of §4.1 (`UX-0001`).
- **FR-SHL-011**: An area MUST NOT appear in two groups.
- **FR-SHL-012**: Navigation MUST mark the current area, and MUST remain present while an area is
  open.
- **FR-SHL-013**: Every area whose Epic is declared MUST be reachable from primary navigation
  (`UX-0003`, as scoped by `D-44`).
- **FR-SHL-014**: Navigation MUST be role-aware: an area the current identity cannot act in is hidden
  or visibly disabled **with a reason**, never present-and-failing on click (`UX-0002`, `BR-0003`,
  `BR-0174`).
- **FR-SHL-015**: A group in which the identity can act in no area MUST NOT render as an empty
  heading.
- **FR-SHL-016**: An executable check MUST assert `FR-SHL-013` against the built application and MUST
  be mutation-verified by removing one area's route (`G-UX-01`).

*Persistent context — PMI-DOC-006 §4.2.*

- **FR-SHL-020**: The shell MUST maintain an explicit workspace and project selection, visible at all
  times (`UX-0010`, `BR-0001`).
- **FR-SHL-021**: Every data-bearing screen MUST scope its content to that selection and MUST make
  the scoping **visible rather than implied** (`UX-0011`).
- **FR-SHL-022**: Switching workspace or project MUST NOT lose the current area (`UX-0010`).
- **FR-SHL-023**: A breadcrumb MUST show `workspace / project / area` (`UX-0012`).
- **FR-SHL-024**: An area requiring a project, entered with none selected, MUST say so and offer the
  next step — never render empty.

*Home and cross-cutting surfaces — PMI-DOC-006 §5.*

- **FR-SHL-030**: The shell MUST provide a **Home** area presenting what awaits the current identity.
- **FR-SHL-031**: Each item on Home MUST name what it is, which project it belongs to, and a route to
  the thing needing action.
- **FR-SHL-032**: Pending approvals, policy blocks and missing evidence MUST be visible from Home
  without opening each area (`BR-0192`).
- **FR-SHL-033**: A policy block shown on Home MUST carry the policy that produced it (`BR-0174`).
- **FR-SHL-034**: Home MUST derive its content from existing records and endpoints. It MUST NOT
  introduce a store of its own, and MUST NOT introduce an aggregation endpoint no other client can
  call (`BR-0013`, `PP-007`).

*The Room pattern — PMI-DOC-006 §6.*

- **FR-SHL-040**: The shell MUST host Rooms as a frame around the six regions of
  `packages/room-contract`, and MUST NOT define a second region vocabulary (`BR-0191`).
- **FR-SHL-041**: A Room MUST NOT be able to present a seventh region.
- **FR-SHL-042**: The shared Room artifacts `EPIC-033` delivered MUST be **adopted**, not re-derived.
- **FR-SHL-043**: Where a Room and the shell disagree on a region's meaning, the shared contract
  wins.

*Shell layout and viewport — PMI-DOC-006 §7.*

- **FR-SHL-050**: The shell MUST remain usable at a 360px viewport, with every area reachable
  (`UX-0040`, `BR-0193`).
- **FR-SHL-051**: The shell MUST NOT set a minimum viewport above 360px (`G-UX-03`).
- **FR-SHL-052**: The shell MUST be operable by keyboard alone, with a visible focus indicator
  throughout (`BR-0193`).
- **FR-SHL-053**: Navigation groups MUST be announced as groups, and the current area as current, to
  assistive technology.

*Screen-level states — PMI-DOC-006 §8.*

- **FR-SHL-060**: Every shell-owned surface MUST distinguish **loading**, **empty**, **error** and
  **partial** states from one another.
- **FR-SHL-061**: An empty state MUST say what is absent and what to do next.
- **FR-SHL-062**: A failed section MUST report as failed. Rendering a failure as an empty state is a
  defect, not a fallback.

### Key Entities

- **Area**: a navigable destination. Carries its identifier, group, label, the Epic that owns it, and
  whether that Epic is declared. Owned by the registry; the shell reads it.
- **Area registry**: the committed declaration of which areas exist and which are declared. The
  single source `FR-SHL-002` and `FR-SHL-016` both read.
- **Shell context**: the current workspace and project selection, and the current area. Persisted
  across navigation, not across identities.
- **Attention item**: something awaiting the current identity — a pending approval, a policy block, a
  missing evidence item. **Derived**, never stored (`FR-SHL-034`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-SHL-001**: **100%** of areas whose Epic is declared are reachable from primary navigation —
  mutation-verified by removing one route and observing the check fail.
- **SC-SHL-002**: **Zero** areas whose Epic is undeclared appear in navigation, as a placeholder or
  otherwise.
- **SC-SHL-003**: A user can reach any declared area from any other in **at most two actions**.
- **SC-SHL-004**: **Zero** shell code changes are required to add a declared area to navigation.
- **SC-SHL-005**: **100%** of shell-owned surfaces render loading, empty, error and partial states
  distinguishably — verified by driving each state, not by inspection.
- **SC-SHL-006**: Navigation responds to a selection in **under 1 second** at the 95th percentile on
  the reference local stack.
- **SC-SHL-007**: Every area is reachable by keyboard alone at a **360px** viewport.
- **SC-SHL-008**: **Zero** axe violations on the shell in both themes.
- **SC-SHL-009**: A user asked *"which workspace and project am I in?"* can answer from the screen in
  **under 5 seconds**, without opening a menu.

## Assumptions

- **The eighteen areas of PMI-DOC-006 §4.1 are the target set**, of which **nine are declared** today
  (Home, Projects, Specifications, Plan & Tasks, Runs, QA & Releases, Architecture & Decisions,
  Governance, Workspace & Administration). Nine are unowned and out of scope until declared.
- **Home is delivered by this Epic** because no Epic owns it and `BR-0192` and `BR-0013` have no
  surface without it. If a Portfolio & Project Health Epic (`U-03`) is later declared, the health
  half moves there and this Epic keeps the shell half.
- **`EPIC-029`'s design system is consumed, never extended.** Any component the shell needs that
  `components.md` does not have is built **against that contract**, per the clause
  `prototype-parity.md` §"What a future Epic inherits" reserves for exactly this.
- **The prototype is illustrative, not normative.** `docs/design/PMI-Studio-V2-Application-Prototype.html`
  settles structure; its token values, focus ring and type face were declined by
  `prototype-parity.md` and remain declined.
- **`EPIC-010`'s `T200e` routing is superseded, not preserved.** The four buttons on the project page
  were `DEF-010-001`'s remediation and are replaced by navigation; `T200a` survives as the check.
- **No routing library is assumed.** `main.tsx` records that *"a router arrives with EPIC-010"*;
  whether one is adopted is a plan decision, and adding a runtime dependency is a plan change rather
  than a task decision (`specs/_shared/dependencies.md`).
- **Role awareness reads `EPIC-024`'s access model.** This Epic defines no permissions of its own.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs, a
      passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/036-application-shell/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] **`FR-SHL-016` is mutation-tested**: one area's route is removed and the reachability check
      observed failing (`SC-SHL-001`). This is `G-UX-01`'s navigation half, and the guard that would
      have caught `DEF-010-001`
- [ ] **`FR-SHL-002` is proven by adding an area**: a declared area reaches navigation with no shell
      code change (`SC-SHL-004`)
- [ ] **`FR-SHL-062` is mutation-tested**: a failing section is made to render as empty and the suite
      observed failing
- [ ] The keyboard and screen-reader pass is recorded by a **person** — `EPIC-029` `T885`'s standard,
      and for the same reason: an agent cannot hear a screen reader
