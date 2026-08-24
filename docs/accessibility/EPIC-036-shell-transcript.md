# EPIC-036 — Application Shell: driven transcript

**Constitution XI Tier 2** — a run-generated transcript against a **running application**, not a
test double. `EPIC-029`'s reachability transcript is the precedent and the format.

**Date**: 2026-08-24 · **Task**: `T441j` · **Quickstart**: [../../specs/036-application-shell/quickstart.md](../../specs/036-application-shell/quickstart.md) §7

## The stack this ran against

| Part | What |
|---|---|
| Database | `pmi-postgres` (docker compose), migrated, shared with the `main` checkout |
| Cache/queue | `pmi-valkey` (docker compose) |
| API | `http://localhost:3000` — the already-running backend |
| Client | `http://localhost:5174` — **this worktree's** frontend (`vite --port 5174`), so the shell under test is the one this Epic built, not `main`'s |
| Identity | `uat-036@pmi.local`, seeded locally for this run; workspace `ws_default` |
| Data | one project, **UAT Walkthrough**; **no runs**, **no review sessions** |

The empty data is worth stating: it means every "nothing here" below is a **real** empty state
reached by a real request, not a fixture arranged to produce one.

---

## 1 — Sign in → Home

```
URL       /
Breadcrumb  Workspace ws_default / No project selected / Home
Landmarks   nav "Breadcrumb", nav "Overview", nav "Intent & Control",
            nav "Delivery", nav "Platform", main ×1
Navigation  Home · Projects | Specifications | Runs | Workspace & Administration
```

**Expected**: four groups in PMI-DOC-006 §4.1 order, five delivered areas, exactly one `main`.
**Observed**: as above. ✅

**None of the other twelve areas appears** — not disabled, not greyed, not a placeholder
(`UX-0060`, `SC-SHL-002`). ✅

## 2 — Home, with a project selected

Selected **UAT Walkthrough** in the shell's project control.

```
Home
What is waiting for you.

Showing 1 of 3 sources. The rest say why below.

Waiting for your approval
  Nothing waiting for your approval
  This section is working and has nothing to show for the current project.

Blocked by policy      [Not available]
  The decision policy engine is not built yet (EPIC-031). Policy blocks cannot be shown.

Missing evidence       [Not available]
  Evidence contracts are not built yet (EPIC-032). Missing evidence cannot be shown.
```

**Expected** (`R-036-4`, `FR-SHL-062`): one working source, two that say why they are absent, and
the three told apart on screen.
**Observed**: as above. ✅

> **This is the scenario the Epic exists for.** *"Working and has nothing to show"* and *"not
> available, EPIC-031"* are different sentences in different components. A Home that rendered one
> section and stopped would have read as *"nothing is blocked"* — and it would have looked correct.

## 3 — Every delivered area, by clicking navigation

Each row is one click on primary navigation. `mains` is the count of `<main>` landmarks;
`navGroups` the count of group navigations still present.

| Click | URL | Breadcrumb | mains | navGroups |
|---|---|---|---|---|
| Home | `/` | `ws_default / UAT Walkthrough / Home` | 1 | 4 |
| Projects | `/projects` | `… / Projects` | 1 | 4 |
| Specifications | `/specifications` | `… / Specifications` | 1 | 4 |
| Runs | `/runs` | `… / Runs` | 1 | 4 |
| Workspace & Administration | `/storage` | `… / Workspace & Administration` | 1 | 4 |

**Expected**: `FR-SHL-013` — every delivered area reachable from navigation; `FR-SHL-012` —
navigation stays present; `FR-SHL-017` — the address changes.
**Observed**: all five reached, address changed every time, navigation never left. ✅

**The address bar left `/` for the first time in this product's history.** Before this Epic it never
did (`R-036-1`).

## 4 — The browser's back control

```
from  /storage   (Workspace & Administration)
back  →  /runs   Breadcrumb: … / Runs
```

**Expected**: back returns to the previous location (`SC-SHL-010`).
**Observed**: as above. ✅

## 5 — Addresses the shell does not host

| Address | Kind | What the page said |
|---|---|---|
| `/governance` | declared, not delivered | **Not found** — *"Governance is not available yet · Governance, steering and access are specified and not built yet. **Owner: EPIC-019 · EPIC-021 · EPIC-024.**"* |
| `/change-room` | undeclared (`UX-0060`) | **Not found** — *"Change Room is not available yet · This area is specified but not built."* |
| `/no-such-place` | nothing at all | **Not found** — *"Nothing at /no-such-place · Check the address, or start from Home."* |

**Expected** (`SC-SHL-011`): not found in every case, **never an empty area inside working chrome**,
and the specified-but-unbuilt case distinguishable from a typo.
**Observed**: as above; the frame, the breadcrumb and a way back are present in all three. ✅

`DEF-001-006` — the API answering `500` for unmatched paths — is untouched and was not made worse.

## 6 — 360px (`UX-0040`), loaded at that width

```
loaded at 360px, drawer closed
  control          "Menu"   aria-expanded=false
  areas in tab order   (none)          ← closed drawer leaves nothing behind an invisible surface
  horizontal overflow  false

drawer opened
  aria-expanded    true
  groups           Overview · Intent & Control · Delivery · Platform
  areas            Home · Projects · Specifications · Runs · Workspace & Administration
  horizontal overflow  false

chose Specifications from the drawer
  URL              /specifications
  Breadcrumb       Workspace ws_default / No project selected / Specifications
  drawer           closed again
```

**Expected** (`FR-SHL-054`, `SC-SHL-007`): a drawer opened by a persistent control, carrying the
**full grouped list**, every area reachable, closing itself after a selection.
**Observed**: as above. ✅

### ⚠ One thing this run did NOT prove

**A mid-session viewport change did not re-render the shell.** Applying 360px through the automation
harness *after* the page had loaded left the sidebar in place, even though
`matchMedia('(max-width: 767px)').matches` had become `true`. Reloading at 360px produced the drawer
correctly, which is what the table above records.

The likely cause is that the harness's viewport override does not dispatch the `MediaQueryList`
`change` event that `useIsNarrow` listens for; a real browser window resize does. **That is a
hypothesis, not a result** — this run did not test a genuine window resize, and nothing here should
be read as having verified one. Recorded rather than explained away.

## 7 — `SC-SHL-006`: navigation responds in under 1s at p95

**Task `T441f`.** 40 samples: eight rounds over the five delivered areas, each measured from the
click to the breadcrumb naming the destination. The breadcrumb is derived from the address, so it
changes only once the route has resolved and painted — it cannot report arrival early.

| | ms |
|---|---|
| min | 3.0 |
| p50 | 9.7 |
| **p95** | **20.5** |
| max | 37.5 |

**Target**: under **1000 ms** at p95. **Observed**: 20.5 ms — inside the target by a factor of ~49. ✅

**The stack is named, deliberately.** `DEF-030-002` records a p95 assertion that fails under suite
load and passes alone, and an unscoped target inherits that ambiguity. This one is: Vite dev server
on `localhost:5174`, API on `localhost:3000`, Postgres and Valkey in docker compose, one project,
no runs, Chrome at 1280×720, machine otherwise idle. A different stack is a different number and
this figure should not be quoted for one.

**What it does not measure**: a production build (this is the dev server), a populated database
(one project, zero runs), or a cold start. It measures what `SC-SHL-006` asks about — the shell's
response to a navigation selection — and nothing else.

## What a machine could not do here

`EPIC-029` `T885` records the standard and why an agent cannot meet it, and it applies unchanged:

- **Whether focus order makes sense**, as opposed to matching DOM order. The mechanical half is
  asserted in `frontend/tests/unit/shell/shell-a11y.spec.tsx`; the judgement is a person's.
- **Whether the announcements are meaningful.** Four navigation landmarks named after their groups
  is the right *structure*; whether a screen-reader user experiences it as four groups rather than
  four unrelated menus is a listening test.
- **`SC-SHL-009`** — *"answer 'which workspace and project am I in?' in under five seconds"*. The
  breadcrumb is on screen without a menu at every address above, which is the testable half. Five
  seconds is a person with a stopwatch.

**`T441k` remains open**, and `T884` stays red until it is done.
