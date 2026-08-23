# PMI Studio — Product Screen Inventory for Figma

**Companion to** [PMI-Studio-Figma-Brief.md](./PMI-Studio-Figma-Brief.md), which carries the visual
language — tokens, type, spacing, components. **This file carries the product**: every screen the
requirements call for, what belongs on it, and which requirements it satisfies.

**Generated**: 2026-08-21 from **230 requirements across 14 Epics**.
**Use both**: this says *what to draw*; the brief says *what it should look like*.

---

## 0. Read this first — the state of the product is not what it looks like

Nine page components exist in the codebase. **Four are reachable.** Five are built, tested, and
imported by nothing — `Specification`, `SpecificationList`, `Tasks`, `ReviewSession`,
`StorageConnections`. Recorded as `DEF-010-001`.

That matters here more than in any other document, because it changes what a mock is *for*:

| Category | Screens | What a mock does |
|---|---|---|
| **Reachable and styled** | Sign in, Projects, Project/Requirements, Traceability | Refines something real |
| **Built but unreachable** | Specification, Specification list, Tasks, Review session, Storage connections | Shows what the navigation should have led to — and is worth drawing *because* the routing decision was never made |
| **Specified, not built** | Steering, review gates, access grants, publishing, impact analysis, ADRs | Designs capability that exists only as backend and requirements |

**The third category is where Figma earns most**, and it is entirely absent from the design-system
brief, which was scoped to what EPIC-029 restyles.

---

## 1. The product in one paragraph

A team captures **requirements**, generates **specifications** from them with AI assistance,
versions those specifications through a **lifecycle** with **review gates**, tracks
**traceability** between every artifact, and runs **unattended generation runs** that pause to ask
questions a **reviewer** answers later. **Steering** shapes what the AI produces. **Access grants**
control who sees what. Finished artifacts **publish** to external storage. Everything is
**workspace-scoped** and audited.

---

## 2. Screens that exist and are reachable

### 2.1 Sign in · `FR-DS-050`
App bar. Centred card: title, Email, Password, "Sign in". Error on failure.
**States**: default · submitting · error.

### 2.2 Projects · EPIC-006
App bar. Title. Create-project form (name → Create). List of projects.
**States**: loading · empty ("no projects yet" + how to make one) · populated · error.

### 2.3 Project detail + Requirements · EPIC-006, EPIC-007
The densest existing screen. Back link · project title · Archive · Rename form · **Engine selector**
· Traceability link.
**Requirements table**: Reference (`REQ-001`), Description, Type, Priority, Status — with **Type /
Priority / Status filters** (`FR-DS-041`).
**New requirement form**: Description, Type, Priority, Save.

- **Type**: business · functional · non_functional · constraint
- **Priority**: p1 · p2 · p3 · **Status**: active · retired

**States**: loading · empty-with-filters ("No requirements match." / "Nothing in this project fits
the filters above — clear one to widen the search.") · empty-unfiltered · populated · row editing ·
error.

### 2.4 Traceability · EPIC-011, EPIC-022
Coverage between requirements and specifications: uncovered requirements, specifications without
tasks. `FR-ENH-021` defines a **twelve-link chain**; `FR-ENH-022` requires reporting **the first
missing link, never a silently shortened chain** — so the design needs a way to show *where* a chain
breaks, not merely that it did.

---

## 3. Screens built but unreachable — `DEF-010-001`

Worth drawing precisely **because** nobody decided how to reach them.

### 3.1 Specification list · EPIC-008
Specifications in a project: title, version, lifecycle state, last change. Filter and sort.

### 3.2 Specification detail · EPIC-008, EPIC-009
The heaviest screen in the product. Needs to hold:

- Specification content, versioned
- **Lifecycle controls** — six transitions; `FR-ENH-014` requires **an explicit human decision** to advance
- **Version history** and **version diff** (components exist: `VersionHistory`, `VersionDiff`)
- **Validation findings** (`ValidationFindings`) — `FR-ENH-013`: each finding identifies **its location and the role that raised it**
- **Generation job progress** (`JobProgress`)
- Linked requirements

**A specification version is immutable** (an append-only trigger enforces it) — the design must make
"create a new version" obviously distinct from "edit".

### 3.3 Tasks · EPIC-012
Tasks generated from a specification, with progress (total / done / in progress / not started /
percent complete). **Generation is gated on approval** — the UI must show *why* it is unavailable
rather than simply disabling a control.

### 3.4 Review session · EPIC-023 · `FR-RUN-009`–`FR-RUN-020`
The most interesting screen in the product, and the one least like anything already drawn.

An unattended run **stops and asks questions**. A reviewer answers them later, possibly alongside
other reviewers:

- Questions recorded during the run, each with context (`FR-RUN-007`)
- **Draft answers** saved before submission (`FR-RUN-011`)
- **Conflict detection** when two reviewers answer the same question (`FR-RUN-012`)
- **Every competing answer retained with its author**; resolution by the project owner or run initiator (`FR-RUN-013a`)
- **Atomic submission** — all-or-none (`FR-RUN-015`), restricted to owner or initiator (`FR-RUN-015a`)
- **Stale answers asked again as fresh questions**, never silently applied (`FR-RUN-019a`)
- A **provisional** marking for answers accepted by explicit recorded override (`FR-RUN-005a`–`c`)

**Design problems worth solving in the mock**: how a conflict reads without implying one answer is
right; how "provisional" is visible at a glance without colour alone (`FR-DS-012`); how a
long question list stays navigable.

### 3.5 Storage connections · EPIC-025 · `FR-PUB-029`–`FR-PUB-040`
- Connect a provider; **connection health reported distinctly** from other states (`FR-PUB-031`)
- **More than one provider type behind one boundary** (`FR-PUB-030`)
- **A stored token is never exposed** (`FR-PUB-029b`) — the design must never offer to reveal it
- Publish preview before republishing (`FR-PUB-036`)
- **No two concurrent publishes of one project** (`FR-PUB-040`) — needs a visible in-progress state
- Publish failures **name a specific reason** (`FR-PUB-035`)
- Artifacts the publisher cannot access are **excluded, and the exclusion reported** (`FR-PUB-033`)

---

## 4. Specified with no screen at all

Backend and requirements exist; nothing has been drawn. Highest design value.

### 4.1 Steering · EPIC-019 · `FR-ENH-001`–`FR-ENH-005`
- **Four scopes with inheritance**; **narrower scope wins and the override is recorded** (`FR-ENH-005`)
- **Ten steering subjects**
- Create / edit / **version** / retire steering content
- **Provenance**: every generation records which steering applied (`FR-ENH-004`)

**Design problem**: showing which of four inherited scopes actually won, and why — inheritance is
invisible unless drawn.

### 4.2 Review gates · EPIC-021 · `FR-ENH-012`–`FR-ENH-016`, `FR-ENH-023`
- Gates configurable **on lifecycle transitions**
- **Twelve reviewing and authoring roles**
- An **explicit human decision** required to advance (`FR-ENH-014`)
- **Every outcome recorded, including overrides** (`FR-ENH-015`)
- **An unavailable or malformed role fails the gate** (`FR-ENH-016`) — a failure state that must read as a gate problem, not a user error

### 4.3 Access grants · EPIC-024 · `FR-ACC-021`–`FR-ACC-028a`
A component exists (`AccessGrants`) with no screen.
- Grant and revoke **read or edit per artifact**
- **Hide rather than show as inaccessible** (`FR-ACC-024`) — the interface must not reveal that something exists
- **A derived artifact is at least as restricted as its source** (`FR-ACC-025`)
- **No artifact may reach a state with no user holding edit access** (`FR-ACC-027`) — the UI must refuse the last revocation and say why
- Access is evaluated against **grants in force when a run started** (`FR-ACC-028`), and when a **review session was opened** (`FR-ACC-028a`)

### 4.4 Impact analysis · EPIC-020 · `FR-ENH-006`–`FR-ENH-011`
- A specification **marked not current** when an upstream artifact changes (`FR-ENH-006`)
- Impact returns **every direct and indirect dependent**, each **carrying its path** (`FR-ENH-009`, `010`)
- **Bounded results say so** — a truncated graph must announce its truncation
- **Cycles detected and refused, including multi-hop** (`FR-ENH-011`)

**Design problem**: a dependency graph that stays readable at 360px. Consider a path list rather
than a node diagram.

### 4.5 Architecture decision records · EPIC-016
ADRs linked to specifications; status and supersession.

### 4.6 Unattended run setup and monitoring · EPIC-023 · `FR-RUN-001`–`FR-RUN-008a`
- Start a run in unattended mode with a **user-selected stop point**
- The run **stops at the range selected and reports that it did** (`FR-RUN-008a`)
- Progress, and the questions accumulating for review

---

## 5. Cross-cutting rules for every screen

From the design system, restated because they apply to screens not yet drawn:

1. **App bar on every screen**, carrying the theme control.
2. **Both themes**, both complete.
3. **360 × 640 minimum**, and survives **200% text zoom**.
4. **Never colour alone** — status, health, conflict, provisional, staleness all need text or icon.
5. **Every async surface** defines loading, empty **and** error. Empty says *why* and *what next*; error says what went wrong and what to do, and **exposes no internal detail**.
6. **Every table offers filtering.**
7. **Controls say what happens; confirmations say what happened** — `Save` → `Saved`, never `Success`.
8. **WCAG 2.2 AA**: 4.5:1 text, 3:1 focus indicators, keyboard-operable throughout.

## 6. Recurring design problems worth solving once

These appear across several unbuilt screens; solving each once is worth more than solving it five times.

| Problem | Appears in |
|---|---|
| Showing **why** something is unavailable rather than just disabling it | Tasks (gated on approval), review gates, publishing |
| **Provenance** — which rule, scope or grant produced this outcome | Steering, access, review gates |
| **Conflict between people**, presented without implying a winner | Review sessions |
| **A chain that breaks partway**, showing the first missing link | Traceability, impact analysis |
| **Something deliberately hidden**, not shown as forbidden | Access control (`FR-ACC-024`) |
| **A secret that must never be revealed**, only replaced | Storage tokens (`FR-PUB-029b`) |

## 7. What not to draw

- **Tabs, accordion, date picker, combobox, tooltip, drawer, pagination** — deliberately outside the Phase 1 component inventory. Needing one is a component request, not a drawing decision.
- **Any visual value not in the brief's token tables** — the build fails on a literal colour, size, space, radius or duration. A new value is a **token request**.
- **Mobile-first layouts.** 360px is a floor, not a target; this is desk work.
