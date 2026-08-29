# Quickstart: Application Shell & Dashboard

**Epic**: `EPIC-036` · **Phase**: 1 · **Date**: 2026-08-24 · **Plan**: [plan.md](./plan.md)

How to prove this Epic works without reading its code. Every scenario maps to a success criterion.

Details are linked, not repeated: entities in [data-model.md](./data-model.md), interfaces in
[contracts/shell-contract.md](./contracts/shell-contract.md), decisions in
[research.md](./research.md).

---

## Prerequisites

Follow `README.md`. In short:

```bash
pnpm install
docker compose up -d postgres valkey
pnpm --filter backend prisma migrate dev
SEED_USER_EMAIL=dev@pmi.local SEED_USER_PASSWORD='choose-something' pnpm --filter backend seed
pnpm --filter backend dev            # api  :3000
pnpm --filter frontend dev           # web  :5173
```

**The seed is not optional.** A migrated database holds no workspace and no user, so sign-in is
impossible without it — and every scenario below starts by signing in.

**Work in a worktree.** `T436a` is the discharge of the concurrent-session gate:
`.claude/worktrees/epic-036-application-shell`.

### The reference local stack — what `SC-SHL-006` measures on

**Task `T442l`.** `SC-SHL-006` sets navigation response at **under 1s at p95 on the reference local
stack**, `plan.md` repeats the phrase, and until now **nothing said what it was**. A criterion whose
scope is named but undefined is the ambiguity it was written to avoid: `DEF-030-002` records a p95
assertion that fails under suite load and passes alone, and *"the reference local stack"* was
scoped in wording only.

It is this, and a measurement on anything else is a different number:

| | |
|---|---|
| **Client** | Vite dev server, `pnpm --filter frontend dev`, one origin proxying `/v1` |
| **API** | `pnpm --filter backend dev` on `:3000` — a dev process, **not** a production build |
| **Data stores** | `postgres` and `valkey` from `docker-compose.yml`, on the same machine |
| **Data volume** | one workspace, **one project**, zero runs — the seeded state, not a populated one |
| **Browser** | Chromium at 1280×720, no throttling |
| **Machine** | a developer workstation, otherwise idle |
| **What is timed** | click on a primary-navigation control → the breadcrumb naming the destination. The breadcrumb is derived from the address, so it cannot report arrival early |
| **Sample** | at least 40 navigations across every delivered area, measured in isolation — **not** during a test run |

**Measured 2026-08-24: p95 = 20.5 ms**, min 3.0, median 9.7, max 37.5, over 40 samples. Recorded in
[../../docs/accessibility/EPIC-036-shell-transcript.md](../../docs/accessibility/EPIC-036-shell-transcript.md) §7.

**What this stack deliberately is not**: a production build, a populated database, or a cold start.
`SC-SHL-006` asks about the shell's response to a navigation selection, and a number from a
different stack answers a different question.

---

## Scenario 1 — Every delivered area is reachable from one navigation 🎯 MVP

**Proves**: `SC-SHL-001`, `SC-SHL-003`, `FR-SHL-010`–`FR-SHL-013`.

Sign in. Without using browser history or typing a URL, reach each of the **four delivered** and **two partly-delivered** areas
from primary navigation: Home, Projects, Specifications, Runs, Workspace & Administration.

**Expected**: all six reachable — four delivered, two partly delivered; presented in the four groups of PMI-DOC-006 §4.1; no area in two
groups; the current area marked. **None of the other twelve appears at all** — not disabled, not
greyed, not a placeholder. That is zero undeclared areas (`UX-0060`) **and** four that are
declared with no screen built: `Plan & Tasks`, `QA & Releases`, `Architecture & Decisions` and
`Governance` ([analysis.md](./analysis.md) `C1`, `N1`).

> **Mutation check, required at exit.** Remove one delivered area's route and `FR-SHL-016` must fail
> naming that area. This is `G-UX-01`'s navigation half and the guard `DEF-010-001` did not have.

---

## Scenario 2 — An area added to the registry needs no shell change

**Proves**: `SC-SHL-004`, `FR-SHL-002`.

Add an area to `frontend/src/shell/areas.ts` with `status: 'delivered'` and an element — or move
one of the twelve `declared-not-delivered` areas to `delivered`, which is what their owning Epics will
do. Add the binding that `element` points at in `frontend/src/shell/area-views.tsx`. Change nothing
else.

**Expected**: it appears in navigation, in its group, with a working route. **Zero shell logic
changed** — `git diff --name-only` shows exactly those **two** data files and nothing else: no
change to `Navigation.tsx`, `routes.tsx`, `navigation-model.ts` or `AppShell.tsx`.

> **Corrected 2026-08-24 (`T441w`, convergence `F6`).** This read *"one path"*. It is two: an entry
> in the registry and the binding its `element` points at, because a page needs workspace and
> project handed to it from somewhere. `SC-SHL-004` measures **shell code changes** and those are
> still zero — but the check as written was a claim about `git diff`, and `git diff` disagreed.

> This is the criterion that makes eighteen areas over four releases bearable. If it fails, each
> future area is a shell change, and the shell becomes the bottleneck the registry exists to remove.

---

## Scenario 3 — An area has an address that survives a refresh

**Proves**: `SC-SHL-010`, `SC-SHL-011`, `FR-SHL-017`.

Navigate to Runs. Copy the address. Open it in a new tab. Press refresh. Press back.

**Expected**: the address changed when you navigated; the new tab lands on Runs; refresh stays on
Runs; back returns to where you were. Then request an address naming an area the shell does not
host — an undeclared one (`/change-room`) and a declared-but-unbuilt one (`/governance`):
**not found** for both, never an empty area inside working chrome.

> **Today the address bar never leaves `/`** — the product has no routing at all. That is the state
> this scenario is written against.

---

## Scenario 4 — Workspace and project are visible, and switching keeps your place

**Proves**: `SC-SHL-009`, `FR-SHL-020`–`FR-SHL-025`.

Note the workspace and project shown. Enter an area. Switch project.

**Expected**: the breadcrumb reads `workspace / project / area` throughout; you remain in the same
area and its content re-scopes; the answer to *"which workspace and project am I in?"* is on screen
in under five seconds without opening a menu.

Then enter an area needing a project with none selected: it **says so and offers the next step**,
rather than rendering empty.

---

## Scenario 5 — Home shows what is waiting, and admits what it cannot see

**Proves**: `SC-SHL-005`, `FR-SHL-030`–`FR-SHL-034`, `BR-0192`.

Start a run and leave its review unsubmitted. Open Home.

**Expected**: the run appears as a pending approval, naming its project and linking to the review.
**And the other two sections state that their sources do not exist**, naming `EPIC-031` and
`EPIC-032`.

> **This is the scenario most likely to be "fixed" wrongly.** Two of Home's three sources are
> unbuilt (`R-036-4`). A Home that rendered one section and nothing else would read as *"nothing is
> blocked"* — the confident blank screen. Empty because there is nothing, empty because it is still
> loading, and empty because the source does not exist must look different from each other.
>
> **Mutation check, required at exit.** Make a failing section render as empty; the suite must fail
> (`FR-SHL-062`).

---

## Scenario 6 — The shell holds at 360px and on a keyboard

**Proves**: `SC-SHL-007`, `SC-SHL-008`, `FR-SHL-050`–`FR-SHL-054`.

At a 360px viewport, reach three areas in different groups using only the keyboard.

**Expected**: navigation collapses into a drawer carrying the **full grouped list**; every area is
reachable; focus order follows visible order with a visible indicator throughout; groups are
announced as groups and the current area as current; zero axe violations in both themes.

---

## Scenario 7 — Constitution XI Tier 2: the driven transcript

**Proves**: Constitution XI Tier 2, and it is **closure evidence**, not a test.

Against the running stack, drive: sign in → Home → each of the four delivered and two partly-delivered areas → back → switch
project → one address naming a declared-but-unbuilt area, observing not-found. Record the verbatim
transcript to `docs/accessibility/EPIC-036-shell-transcript.md`.

**Expected**: every step observed, with what was seen beside what was expected. `EPIC-029`'s
reachability transcript is the precedent and the format.

> **What a machine cannot do here.** Whether focus order *makes sense* and whether an announcement
> is *meaningful* are human judgements — `EPIC-029` `T885` records the standard and why an agent
> cannot meet it. The keyboard and screen-reader pass in the Exit Criteria is a person's.

---

## What this Epic does not prove, and must not claim to

- **That an unauthorized user cannot see an area.** `FR-SHL-014` is deferred to `EPIC-024`; the
  shell gates nothing and every delivered area is visible to any signed-in identity.
- **That deep links work in production.** They work against the dev server, which serves
  `index.html` for unknown paths. Nothing in this repository serves the built client at all
  (`R-036-3`).
- **That project health is anywhere.** `BR-0013` left this Epic at clarification, owner `U-03`.
- **That `UX-0003` is satisfied for every area with a declared owner.** It is satisfied for the five reachable
  delivered ones. `Plan & Tasks`, `QA & Releases`, `Architecture & Decisions` and `Governance` have
  owners and no navigable screen; the remainder lands with `EPIC-012`, `EPIC-014`/`015`, `EPIC-016`
  and `EPIC-019`/`021`/`024`.
