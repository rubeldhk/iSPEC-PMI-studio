# UI UAT Checklist — after EPIC-029 (Design System)

**Run this after** EPIC-029's 48 tasks are implemented and its suites are green.
**Created**: 2026-08-21 · **Applies to**: `EPIC-029` · **Standard**: `PMI-DOC-005`, `UI-0001`–`UI-0043`

This checklist deliberately does **not** re-test what the automated suite already proves. Its whole
value is the set of things a test in `jsdom` **cannot** see, and it says so at each step.

---

## 0. Read this before reporting anything

### Half the application will still look unstyled. That is correct.

`FR-DS-050` restyles **four pages and two components**. `FR-DS-052` states that every other Epic
styles its own UI work. The frontend currently holds **nine pages and eight components**, so after
EPIC-029 lands:

| In EPIC-029's scope — expect fully styled | Out of scope — expect browser-default, and **do not raise a defect** |
|---|---|
| `SignIn` | `Specification`, `SpecificationList`, `Tasks` |
| `Projects` | `ReviewSession`, `StorageConnections` *(landed 21 Aug, after EPIC-029's scope was set)* |
| `Requirements` | `JobProgress`, `LifecycleControls`, `ValidationFindings` |
| `Traceability` | `VersionDiff`, `VersionHistory`, `AccessGrants` |
| `EngineSelector`, `RequirementEditor` | |

**An unstyled `ReviewSession` is a pass, not a fail.** Raising it wastes a defect record and
contradicts the requirement. What *would* be a defect is an out-of-scope page that **breaks** —
unreadable text, invisible focus, or a literal value that slipped past the lint rule.

### What the automated suite already covers — do not duplicate

| Already proven | By |
|---|---|
| Zero axe violations on four pages and fifteen components | `T883`, `T894` |
| Every component implements every declared state | `T886` |
| Contrast ratios computed from token values, both themes | `T872` |
| No literal visual value anywhere under `frontend/src` | `T878` |
| The app mounts at its root and renders styled | `T899a` |

### What only this checklist can find

`jsdom` **has no layout engine**. It cannot see a rendered pixel, so it cannot catch: text that
overlaps, a focus ring clipped by a parent, a colour that computes correctly and *reads* badly, a
layout that reflows wrongly at 200% zoom, or a theme that flips one element and not its neighbour.
Every item below exists because automation is blind to it.

---

## 1. Prerequisites

```bash
pnpm install
docker compose up -d
cd backend && DATABASE_URL="postgresql://pmi:pmi_local_dev@localhost:5432/pmi_studio_uat" pnpm exec prisma migrate deploy
```

Then start the API and the frontend, and sign in as `uat@pmi.test`.

Record, before starting: **commit SHA**, **browser and version**, **OS theme setting**.
Without those the run is not reproducible and the transcript is worth little.

---

## 2. Token layer and themes — `SC-DS-005`, `FR-DS-010`, `FR-DS-011`

- [ ] **2.1** Each of the four in-scope pages renders with real typography and spacing — not
      browser-default Times New Roman. *(This is the baseline the first UAT session failed: the
      frontend had zero CSS files.)*
- [ ] **2.2** Switch the OS to dark. Every in-scope page re-themes **without a reload**.
- [ ] **2.3** In dark, no text sits on a same-coloured surface, and nothing renders as an
      unstyled fallback — the signature of a token defined in one theme only.
- [ ] **2.4** Set an explicit theme override, reload, and confirm it **persists** and still beats
      the OS setting (`FR-DS-011`).
- [ ] **2.5** Clear the override; the page returns to following the OS.
- [ ] **2.6** Enable `prefers-reduced-motion`. Animation stops and **layout does not shift**
      — the second half is what a naive implementation breaks.

## 3. Keyboard and focus — `SC-DS-002`, `FR-DS-033`

Automation asserts a focus indicator *exists*. Only a person can judge whether focus is
**findable** and whether the order makes sense.

- [ ] **3.1** Complete sign-in → create a project → capture a requirement using **only the
      keyboard**. No mouse, at any point.
- [ ] **3.2** Focus is visible at **every** step, including against every surface colour it
      crosses. A ring that vanishes on one panel is a defect.
- [ ] **3.3** Tab order follows reading order. Note any control reached out of sequence, and any
      focus trap that is not a modal.
- [ ] **3.4** Open a modal: focus moves into it, `Escape` closes it, and focus **returns to the
      control that opened it**.
- [ ] **3.5** Nothing is reachable by mouse but not by keyboard.

## 4. Asynchronous states — `FR-DS-021`, `FR-DS-022`, `SC-DS-004`

The first UAT session met *"An unexpected error occurred"* with no recovery path. That is the bar
these must clear.

- [ ] **4.1** **Empty**: a project with no requirements explains *why* it is empty and what to do
      next. A blank area is a defect.
- [ ] **4.2** **Loading**: trigger a slow operation. A loading state appears and does **not** block
      unrelated interaction.
- [ ] **4.3** **Error**: stop the API, then act. The error says what went wrong and what to do —
      and **exposes no internal detail** (no stack, no SQL, no connection string).
- [ ] **4.4** Restart the API and confirm the page recovers without a hard reload.

## 5. Layout, viewport and zoom — `FR-DS-040`, `SC-DS-006`, research `R-029-4`

- [ ] **5.1** At **360 × 640**: no horizontal page scroll, nothing clipped, nothing overlapping.
- [ ] **5.2** At **200% text zoom**: layouts reflow, no clipping, no overlap (WCAG 1.4.4).
- [ ] **5.3** Wide content — the Requirements table — scrolls **within its own container**, not by
      scrolling the page sideways.
- [ ] **5.4** Every data table offers filtering (`FR-DS-041`), and the filters still work at 360px.

## 6. Meaning not carried by colour alone — `FR-DS-012`

- [ ] **6.1** Every status pill carries **text or an icon** as well as colour.
- [ ] **6.2** The current navigation item is distinguishable without colour.
- [ ] **6.3** With a greyscale filter applied, every status remains readable.

## 7. Consistency across pages — `SC-DS-003`, the reason the Epic exists

- [ ] **7.1** Move between the four in-scope pages. Type scale, spacing rhythm, button shape and
      error presentation are the **same** on each.
- [ ] **7.2** `EngineSelector` and `RequirementEditor` match the system wherever they appear.
- [ ] **7.3** No page introduces a visual decision the others do not share.

## 8. Browser floor — `FR-DS-006`

`UI-0006` sets the floor at the **last two versions of Chrome, Edge, Firefox and Safari**, and the
token layer is permitted to use CSS nesting, `:has()` and container queries because of it.

- [ ] **8.1** Repeat sections 2 and 5 in a **second** browser from the floor.
- [ ] **8.2** Record both browsers and versions. A single-browser pass does not discharge
      `FR-DS-006`.

## 9. Regression — the styling must not have broken behaviour

- [ ] **9.1** Sign-in, project creation and requirement capture still **work**, not merely look right.
- [ ] **9.2** The out-of-scope pages still function, unstyled (see §0).
- [ ] **9.3** No new console errors on any in-scope page.

---

## Recording the result

Constitution XI Tier 2 requires a **run-generated** transcript for this Epic (`T900a`, checked by
`T900b`). **This checklist does not replace it** — that transcript is emitted by the run; this is
the human judgement alongside it.

Record here: commit SHA, browsers and versions, OS theme, date, and **every item's outcome**
including passes. A checklist recording only failures cannot be distinguished from one nobody ran.

**Any defect goes to `specs/029-design-system/defects/` before it is fixed** (Constitution VI), and
its fix re-enters as a task — never as a direct patch (Constitution I).

**A file that says only "passed" fails its own check.** That is the standard `T884` holds the manual
accessibility record to, and this record is held to it too.
