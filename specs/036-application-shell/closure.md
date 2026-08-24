# Closure record: EPIC-036 Application Shell & Dashboard

**Date**: 2026-08-24 · **Task**: `T441o` · **Session**: `/speckit-implement`, executed in the
worktree `.claude/worktrees/epic-036-application-shell` (concurrent-session rule, `T436a`)
· **Released by**: PMI-DOC-006 v1.0 (APPROVED, `D-44`) · PMI-DOC-004 v2.0 `BR-0190`

## Work completed

**75 of 77 tasks.** The two outstanding are a person's, not this session's, and are named below.

| Phase | Tasks | Outcome |
|---|---|---|
| 1 Setup | `T436a`–`T436e` | Worktree, `D-13` raised 6.x → 7.x, the register's first conformance check, React Router installed |
| 2 Foundational | `T436f`–`T436n` | Area registry, navigation model, derived route tree, not-found, six-prohibition architecture check |
| 3 US1 — one navigation, real addresses | `T437a`–`T437q` | `AppShell`, `Navigation`, the view union removed, `FR-SHL-016` driven through the real `App` and mutation-verified |
| 4 US2 — explicit scope | `T438a`–`T438i` | `ContextBar`, breadcrumb, `ShellContext`, the no-project state |
| 5 US3 — Home | `T439a`–`T439l` | `HomeModel`'s required three sources, the one real source, two that say why they are absent |
| 6 US4 — 360px and keyboard | `T440a`–`T440i` | Drawer, focus order, group landmarks, axe over six addresses |
| 7 US5 — the Room pattern | `T441a`–`T441e` | Adoption asserted as **absence**: no second region vocabulary anywhere in the shell |
| 8 Polish | `T441f`–`T441p` | p95 measured, Tier 2 transcript, two handovers, this record |

**Artifacts.**

- `frontend/src/shell/` — 12 files: `areas.ts` (the registry), `area-views.tsx`,
  `navigation-model.ts`, `routes.tsx`, `AppShell.tsx`, `Navigation.tsx`, `NavigationDrawer.tsx`,
  `ContextBar.tsx`, `shell-context.tsx`, `Home.tsx`, `home-model.ts`, `home-sources.ts`,
  `NotFound.tsx`, `shell.css`
- `frontend/src/main.tsx` — **modified**: the `useState<View>` union removed, `BrowserRouter` mounted
- `frontend/tests/unit/shell/` — 14 spec files, 1 harness
- `tests/governance/dependency-register.spec.ts` — **new**, `TS-001`'s first check
- `specs/_shared/dependencies.md` — `D-13` raised to 7.x, with a "D-13 in detail" section
- `docs/accessibility/EPIC-036-shell-transcript.md` — Constitution XI Tier 2
- `specs/036-application-shell/handovers.md` — `T441n`, `T441p`
- `frontend/tests/unit/shell-page-routes.spec.tsx` — **deleted**, superseded (`R-036-5`);
  `EPIC-010` `T200e` records it
- `frontend/tests/unit/shell-traceability-route.spec.tsx` — **rewritten** for the router; every
  assertion preserved, the wrong-shaped `me` stub corrected (`DEF-029-006`'s lesson)
- `frontend/tests/unit/a11y/shell.spec.tsx` — one assertion updated (`T930`), strengthened rather
  than relaxed

**Suites.** `frontend` **508 of 508** pass in 59 files. `governance` **893 of 895** — the two
failures are `T884`, red **by design** until a person runs the manual accessibility pass. Typecheck
clean.

## What was found while building, and not papered over

1. **React Router was already registered.** `D-13` has carried it at 6.x since the platform
   specification. This Epic's plan and `research.md` `R-036-1` both call it new and name it `D-30`.
   `EPIC-030` `T993d` made the identical mistake with `supertest` six Epics ago. `T436b` raised the
   existing row rather than adding a second, and `T436c` is now the check that catches it next time
   — **the register had never had one**.
2. **Nested `<main>` landmarks.** Six delivered pages carry their own and four do not; the old
   `main.tsx` wrapped some views by hand and not others. The frame is a `div`, the bindings supply
   what is missing, and `T440e` asserts exactly one at every address. It found a second case while
   being written: `/storage` with no project selected had **none at all**.
3. **`T864`'s Traceability control survived `T437g`** while `T200e`'s three did not. PMI-DOC-006
   names no Traceability area, so it has no navigation entry to inherit; removing the link would
   have put `EPIC-011`'s whole US7 back where convergence found it.
4. **`N1` settled**: `Plan & Tasks` is `declared-not-delivered` against `EPIC-012`. Its screen
   exists and is specification-scoped, so its only address is `/specifications/:id/tasks` —
   navigation renders a link to `Area.path` and `:id` is not an address. Five delivered areas, not
   six. Recorded in `handovers.md`.

## What is NOT done, and why

| Task | Why |
|---|---|
| `T441g` — `SC-SHL-009`, *"answer in under five seconds"* | **A human measure.** `checklists/requirements.md` recorded this at plan time. The testable half — the scope is on screen at every address, without opening a menu — is asserted by `ContextBar.spec.tsx` and shown in the transcript. Five seconds needs a person with a stopwatch |
| `T441k` — the keyboard and screen-reader pass | **A person's, not an agent's.** `EPIC-029` `T885` records the standard and the reason. `T884` stays red until it is done, which is the correct state and not a defect of this Epic |

Neither blocks `/speckit-converge`; both block the Epic Exit Criteria, and the Exit Criteria say so.

## What this Epic must not be read as having proved

- **That an unauthorized user cannot see an area.** `FR-SHL-014` is deferred to `EPIC-024` and
  `PP-008` is this Epic's one deferral. Every delivered area is visible to any signed-in identity.
- **That deep links work in production.** They work against the dev server, which serves
  `index.html` for unknown paths. **Nothing in this repository serves the built client at all**
  (`R-036-3`), and that gap has no owner.
- **That project health is anywhere.** `BR-0013` left this Epic at clarification, owner `U-03`.
- **That the drawer re-renders on a live window resize.** The transcript records that a viewport
  change applied mid-session by the automation harness did not, and that a reload at 360px does.
  A genuine window resize was **not** tested.

## Recommended next task

```
/speckit-converge 036
```

Then, in order of what unblocks most: the four Epics named in
[handovers.md](./handovers.md) each clear their `UX-0003` remainder with a one-line registry edit,
and **`EPIC-026` still owes the task-identifier decision** — 999 of 999 prefixes are allocated, and
a four-digit id is silently unchecked by all three governance checks until the widening lands.
