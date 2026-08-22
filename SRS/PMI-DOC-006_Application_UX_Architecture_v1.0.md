# PMI-DOC-006 — Application UX Architecture

**Document ID**: PMI-DOC-006 · **Version**: 1.0 · **Status**: PROPOSED — REQUIRES PROJECT OWNER APPROVAL
**Owner**: Project Owner (Product) · **Date**: 2026-08-21
**Depends on**: PMI-DOC-000 (structure, identifiers), PMI-DOC-004 v2.0 (business requirements),
PMI-DOC-005 (design system and UX standards)
**Actions**: PMI-DOC-004A Amendment G and gap `G-30`; decision 6 of PMI-DOC-004A §14

> **PMI-DOC-005 stays screen-agnostic.** It is the design-system standard: tokens, type, spacing,
> components, states, accessibility. It says what things look like and how they behave. This
> document says **what screens exist, how they are organized, and how a user moves between them.**
> The two must not merge — `G-30` records that expanding DOC-005 into screen definitions would
> pollute a token standard with product decisions that change at a different rate.

---

## 1. Why this document exists

PMI-DOC-004A `G-30` identified a missing artifact rather than a defect: PMI-DOC-005 explicitly
declares screens out of scope, and nothing else defined them. The consequence was visible in the
product — nine page components exist in the codebase and **four are reachable**
(`docs/design/PMI-Studio-Product-Screens.md` §0, recorded as `DEF-010-001`). Five screens were
built, tested, and imported by nothing, because no document owned the question of what the
application's navigation is.

That is the gap this fills. Where PMI-DOC-005 governs the *appearance* of a component and
`docs/design/PMI-Studio-Product-Screens.md` inventories *what has been drawn*, this document governs
the **information architecture**: the navigation contract, the shell, the shared Room pattern, and
the cross-cutting surfaces every screen inherits.

`G-32` is the second reason. PMI-DOC-005 delegates viewport decisions to each Epic, which means
every Epic can choose a different minimum width independently. §7 sets one application-shell policy
so they do not have to.

---

## 2. Scope

**In scope** — navigation structure and hierarchy · the application shell · the Room interaction
pattern · cross-cutting surfaces (search, Decision Inbox, timeline, notifications, assistant) ·
breakpoint and minimum-viewport policy for the shell · screen-level state requirements · which
requirement each area satisfies.

**Out of scope** — visual tokens, type scale, spacing, color, component appearance and component
states (all PMI-DOC-005) · per-screen field-level layout (each Epic's spec) · the visual mockups
themselves (`docs/design/`).

**Authority.** Where this document and PMI-DOC-005 disagree on appearance, **PMI-DOC-005 wins**.
Where they disagree on structure, this document wins. Where either disagrees with PMI-DOC-004,
**PMI-DOC-004 wins** (Constitution II).

---

## 3. Reference prototype

[`docs/design/PMI-Studio-V2-Application-Prototype.html`](../docs/design/PMI-Studio-V2-Application-Prototype.html)
is a working single-file demonstration of the architecture in this document: the shell, the
navigation groups of §4, the Room pattern of §6 and the cross-cutting surfaces of §5.

**It is a reference, not a specification, and it is not the design system.** Three limits apply:

1. **Its token set is illustrative only.** PMI-DOC-005 and the implemented EPIC-029 token layer — 46
   tokens, verified in-browser with zero contrast failures across both themes — are authoritative.
   PMI-DOC-004A `G-31` says exactly this: the prototype *demonstrates* a neutral accessible token
   set; the design Epic *implements* the real one. Any color, radius or spacing value in the
   prototype that disagrees with PMI-DOC-005 is wrong by definition.
2. **Its data is fictional.** Counts, names, metrics and statuses are placeholders.
3. **It is not a build target.** Screens in it whose requirements are unowned (§9) must not be
   implemented ahead of the Epic that owns them — that would invert the specification-first rule
   (`RULE-01`).

What the prototype *is* good for: settling structural arguments quickly, and showing that the
seventeen navigation areas of §4 fit in one coherent shell without a second-level menu.

---

## 4. Navigation architecture

### 4.1 Structure

Primary navigation is a single persistent sidebar with four labeled groups. Grouping is what keeps
seventeen areas navigable; a flat seventeen-item list is not.

| Group | Areas | Satisfies |
|---|---|---|
| **Overview** | Home · Projects · Decision Inbox | `BR-0010`, `BR-0013`, `BR-0068`, `BR-0192` |
| **Intent & Control** | Requirement Room · Specifications · Change Room · Defect Room · Architecture & Decisions | `BR-0020`–`BR-0027`, `BR-0030`–`BR-0037`, `BR-0042`–`BR-0048`, `BR-0051`–`BR-0058`, `BR-0100`, `BR-0073` |
| **Delivery** | Plan & Tasks · Engineering Experts · Runs · Evidence & Compliance · QA & Releases | `BR-0050`, `BR-0101`–`BR-0106`, `BR-0061`, `BR-0140`–`BR-0146`, `BR-0080`, `BR-0090`, `BR-0161`–`BR-0164` |
| **Platform** | Context · Integrations · Reports · Governance · Workspace & Administration | `BR-0091`–`BR-0096`, `BR-0120`–`BR-0126`, `BR-0180`–`BR-0184`, `BR-0060`–`BR-0072`, `BR-0001`–`BR-0005` |

`UX-0001` — Primary navigation MUST present these areas in these four groups. An area MUST NOT
appear in two groups.

`UX-0002` — Navigation MUST be role-aware: an area the current identity cannot act in is hidden or
visibly disabled with a reason, never present-and-failing on click (`BR-0003`, `BR-0174`).

`UX-0003` — Every area listed in §4.1 MUST be reachable from primary navigation. A built screen that
nothing links to is a defect, not an unfinished feature — this is the rule `DEF-010-001` exists
because nobody had written.

### 4.2 Persistent context

`UX-0010` — The shell MUST maintain an explicit **workspace** and **project** selection, visible at
all times and switchable without losing the current area (`BR-0001`, `BR-0190`).

`UX-0011` — Every data-bearing screen MUST scope its content to the selected workspace and project,
and MUST make that scoping visible rather than implied.

`UX-0012` — A breadcrumb MUST show `workspace / project / area` so the answer to "what am I looking
at" never requires inference.

---

## 5. Cross-cutting surfaces

These belong to the shell, not to any one area. Specifying them once is what stops each Epic
inventing its own.

| Surface | Requirement | Behavior |
|---|---|---|
| **Global search / command palette** | `UX-0020` | Reachable by keyboard from anywhere; searches artifacts and navigates to areas. Scoped to the current workspace by default, with tenant isolation enforced server-side (`BR-0001`) |
| **Decision Inbox / My Work** | `UX-0021` | Role-aware queue of approvals, review requests, escalations and blocked work. Reachable in one action from every screen (`BR-0068`, `BR-0192`) |
| **Activity & evidence timeline** | `UX-0022` | A single human-readable chronology joining decisions, AI actions, tool calls and evidence for the object in view. This is `G-34` — audit records exist, but a person cannot currently read one story from them (`BR-0111`, `BR-0171`, `BR-0141`) |
| **Notifications** | `UX-0023` | Per-user preferences; every notification links to the object and the action it concerns |
| **Contextual AI assistant** | `UX-0024` | Available within a Room, operating on that Room's Context Package, and MUST label output as fact, inference, recommendation or open question (`BR-0022`, `BR-0093`) |
| **Theme control** | `UX-0025` | Light / dark / system, per PMI-DOC-005 (`BR-0194`) |
| **Workspace & project switcher** | `UX-0026` | See `UX-0010` |

`UX-0027` — A consequential AI session MUST expose an affordance to inspect the material context it
was given (`BR-0096`). Context that cannot be inspected cannot be reviewed.

---

## 6. The Room pattern

The Requirement, Change and Defect Rooms are three instances of one interaction model, because they
are three instances of one workflow abstraction — the Governed Engineering Loop (`ADR-0018`,
`BR-0064`). `BR-0191` requires the shared pattern; this section defines it.

### 6.1 Required regions

`UX-0030` — A Room MUST present these six regions. Their arrangement may vary; their presence may not.

| Region | Contents | Requirement |
|---|---|---|
| **Object state** | Identity, version, baseline status, current loop stage | `BR-0026`, `BR-0065` |
| **Loop progress** | The `Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome` stages, showing which are done, current and pending | `BR-0064` |
| **AI analysis** | Clarifications, options, trade-offs, risks — each labeled by epistemic status | `BR-0022`, `BR-0023`, `BR-0045` |
| **Decision** | The authorized decision, its actor, authority basis, object version and rationale | `BR-0005`, `BR-0025`, `BR-0046` |
| **Evidence** | Typed evidence attached to this object, and the unmet items of its Evidence Contract | `BR-0140`–`BR-0142` |
| **Activity timeline** | The chronology of `UX-0022`, scoped to this object | `BR-0111` |

### 6.2 Rules

`UX-0031` — **AI output MUST be visually distinguishable from recorded fact and from human
decision.** A recommendation that renders identically to an approved decision is a governance
failure expressed as a styling choice (`RULE-03`).

`UX-0032` — A Room MUST show what is blocking progress — missing evidence, a pending approval, a
policy block — without the user opening another screen (`BR-0192`).

`UX-0033` — Where an action is refused by policy, the Room MUST show the policy or risk decision
that refused it (`BR-0174`).

`UX-0034` — The Defect Room MUST make the transfer-to-Change-Room action available with context and
evidence preserved, and MUST state why the transfer is being offered (`BR-0057`).

`UX-0035` — The three Rooms MUST NOT diverge in region vocabulary. If one Room needs a seventh
region, the pattern changes for all three or the need is met inside an existing region.

---

## 7. Shell layout, breakpoints and viewport

This section closes `G-32`. PMI-DOC-005 delegates viewport to each Epic; without a shell-level
policy every Epic picks independently and the application fragments.

`UX-0040` — **Minimum supported viewport for the application shell is 360px wide.** This matches the
verified EPIC-029 baseline (360px clean at 100% and 200% zoom) and MUST NOT be raised by an
individual Epic.

`UX-0041` — Three shell breakpoints, and Epics MUST NOT introduce a fourth for shell-level layout:

| Breakpoint | Shell behavior |
|---|---|
| **≥ 1050px** — desk | Sidebar persistent; Room main and side columns side by side; multi-column metric grids |
| **768–1049px** — narrow desk / tablet | Sidebar narrowed but persistent; Room collapses to a single column with side content below; metric grids reduce column count |
| **< 768px** — handheld | Sidebar becomes an overlay behind an explicit control; single column throughout; global search collapses to the command palette |

`UX-0042` — PMI Studio is **desk work**: dense information, long sessions, high legibility
(`docs/design/PMI-Studio-Figma-Brief.md` §1). Handheld support means *usable for review and
approval*, not feature parity. A Room MUST remain able to show state, decision and evidence at
360px; authoring workflows MAY require a wider viewport, provided they say so rather than failing
silently.

`UX-0043` — Content wider than the viewport — tables, graphs, timelines, code — MUST scroll inside
its own container. The page body MUST NOT scroll horizontally.

---

## 8. Screen-level requirements inherited by every area

`UX-0050` — Every list or table view MUST provide filtering. This restates the PMI-DOC-005 rule
(`FR-DS-041`) that `G-33` confirmed as already covered, and extends it: **search, sort and column
density are added where a functional spec needs them, not by default.** An unfiltered table is a
table that stops working at the second page of data.

`UX-0051` — Every data-bearing screen MUST define four states: **loading · empty · populated ·
error**. An empty state MUST say how to create the first item; an error state MUST say what happened
and offer a recovery path without exposing internals (`BR-0195`).

`UX-0052` — Every destructive or consequential action MUST be confirmable and MUST state its
consequence, including which baseline or approval it affects.

`UX-0053` — All screens MUST meet PMI-DOC-005 accessibility requirements: WCAG 2.2 AA, full keyboard
operation, visible focus, and the required component states (`BR-0193`).

---

## 9. Ownership

Most of this document specifies areas whose requirements have **no declared Epic**
(`specs/brs-v2-reconciliation.md` §4). That is intentional and is what `UX-0003` is for: navigation
must be designed as a whole even when it is delivered in slices, or the product acquires
unreachable screens one Epic at a time — which is precisely what `DEF-010-001` records having
already happened.

| Area | Epic | Status |
|---|---|---|
| Shell, theme, tokens, accessibility, states | `EPIC-029` | declared |
| Projects, Requirements, Specifications, Traceability | `EPIC-006`–`EPIC-011` | declared |
| Plan & Tasks | `EPIC-012` | declared |
| Runs | `EPIC-023` | declared |
| QA & Releases | `EPIC-014`, `EPIC-015` | declared |
| Architecture & Decisions | `EPIC-016` | declared |
| Governance, steering, access | `EPIC-019`, `EPIC-021`, `EPIC-024` | declared |
| Decision Inbox, Requirement Room, Change Room, Defect Room | — | **unowned** (`U-01`, `U-04`, `U-05`, `U-07`) |
| Engineering Experts, Context, Evidence & Compliance | — | **unowned** (`U-08`, `U-10`, `U-11`) |
| Integrations | — | **unowned** (`U-13`) |
| Reports | — | **unowned** (`U-16`) |

`UX-0060` — An area in the unowned rows MUST NOT be implemented before its Epic is declared. This
document defines where it will go, not permission to build it.

---

## 10. Validation

| Check | Asserts |
|---|---|
| `G-UX-01` | Every area in §4.1 is reachable from primary navigation in the built application — the automated form of `UX-0003` and the check that would have caught `DEF-010-001` |
| `G-UX-02` | Every `UX-` requirement in this document cites at least one `BR-` from PMI-DOC-004 v2.0 |
| `G-UX-03` | No screen sets a minimum viewport above 360px (`UX-0040`) |

Recorded as required. None runs in CI yet.

---

## 11. Related documents

- [PMI-DOC-004 v2.0](./PMI-DOC-004_Business_Requirement_Specification_v2.0.md) — the requirements this serves
- [PMI-DOC-004A v1.1](./PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md) — Amendment G, gaps `G-30`, `G-31`, `G-32`, `G-33`, `G-34`
- [PMI-DOC-005](./PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md) — authoritative for all visual and accessibility standards
- [`docs/design/PMI-Studio-V2-Application-Prototype.html`](../docs/design/PMI-Studio-V2-Application-Prototype.html) — reference prototype (§3)
- [`docs/design/PMI-Studio-Product-Screens.md`](../docs/design/PMI-Studio-Product-Screens.md) — inventory of screens as they exist today
- [`docs/design/PMI-Studio-Figma-Brief.md`](../docs/design/PMI-Studio-Figma-Brief.md) — implemented visual language
- [`ADR-0028`](../adr/ADR-0028-application-ux-architecture.md) — the decision to separate this document from PMI-DOC-005
- [`specs/brs-v2-reconciliation.md`](../specs/brs-v2-reconciliation.md) — ownership gaps

---

## 12. Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-21 | Created under PMI-DOC-004A Amendment G / `G-30`. Defines navigation architecture, shell, Room pattern, cross-cutting surfaces, and the shell viewport policy closing `G-32`. Keeps PMI-DOC-005 screen-agnostic |
