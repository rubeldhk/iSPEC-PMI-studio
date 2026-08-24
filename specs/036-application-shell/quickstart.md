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

**Work in a worktree.** The plan records the concurrent-session gate as **FAIL** and `T1` is its
discharge: `.claude/worktrees/epic-036-application-shell`.

---

## Scenario 1 — Every declared area is reachable from one navigation 🎯 MVP

**Proves**: `SC-SHL-001`, `SC-SHL-003`, `FR-SHL-010`–`FR-SHL-013`.

Sign in. Without using browser history or typing a URL, reach each of the nine declared areas from
primary navigation.

**Expected**: all nine reachable; presented in the four groups of PMI-DOC-006 §4.1; no area in two
groups; the current area marked. **None of the nine undeclared areas appears at all** — not
disabled, not greyed, not a placeholder (`UX-0060`).

> **Mutation check, required at exit.** Remove one declared area's route and `FR-SHL-016` must fail
> naming that area. This is `G-UX-01`'s navigation half and the guard `DEF-010-001` did not have.

---

## Scenario 2 — An area added to the registry needs no shell change

**Proves**: `SC-SHL-004`, `FR-SHL-002`.

Add an area to `frontend/src/shell/areas.ts` with `declared: true` and an element. Change nothing
else.

**Expected**: it appears in navigation, in its group, with a working route. **Zero** other files
edited — `git diff --name-only` shows one path.

> This is the criterion that makes eighteen areas over four releases bearable. If it fails, each
> future area is a shell change, and the shell becomes the bottleneck the registry exists to remove.

---

## Scenario 3 — An area has an address that survives a refresh

**Proves**: `SC-SHL-010`, `SC-SHL-011`, `FR-SHL-017`.

Navigate to Runs. Copy the address. Open it in a new tab. Press refresh. Press back.

**Expected**: the address changed when you navigated; the new tab lands on Runs; refresh stays on
Runs; back returns to where you were. Then request an address naming an **undeclared** area
(`/change-room`): **not found**, never an empty area inside working chrome.

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

Against the running stack, drive: sign in → Home → each of the nine declared areas → back → switch
project. Record the verbatim transcript to `docs/accessibility/EPIC-036-shell-transcript.md`.

**Expected**: every step observed, with what was seen beside what was expected. `EPIC-029`'s
reachability transcript is the precedent and the format.

> **What a machine cannot do here.** Whether focus order *makes sense* and whether an announcement
> is *meaningful* are human judgements — `EPIC-029` `T885` records the standard and why an agent
> cannot meet it. The keyboard and screen-reader pass in the Exit Criteria is a person's.

---

## What this Epic does not prove, and must not claim to

- **That an unauthorized user cannot see an area.** `FR-SHL-014` is deferred to `EPIC-024`; the
  shell gates nothing and every declared area is visible to any signed-in identity.
- **That deep links work in production.** They work against the dev server, which serves
  `index.html` for unknown paths. Nothing in this repository serves the built client at all
  (`R-036-3`).
- **That project health is anywhere.** `BR-0013` left this Epic at clarification, owner `U-03`.
