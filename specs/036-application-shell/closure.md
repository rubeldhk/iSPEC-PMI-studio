# Closure record: EPIC-036 Application Shell & Dashboard

**Date**: 2026-08-24 · **Task**: `T441o`, rewritten by `T442k` · **Session**: `/speckit-implement`
and four `/speckit-converge` passes, executed in the worktree
`.claude/worktrees/epic-036-application-shell` (concurrent-session rule, `T436a`)
· **Released by**: PMI-DOC-006 v1.0 (APPROVED, `D-44`) · PMI-DOC-004 v2.0 `BR-0190`

> **Rewritten 2026-08-24 (`T442k`).** The first version of this record was accurate for about an
> hour. It reported 75 of 77 tasks, ended at Phase 8, and quoted the frontend suite at 508 — before
> three convergence passes added fifteen tasks and changed four source files. Constitution IX asks
> for a report of *what was done*; that one described what had been done by lunchtime.

## Work completed

**95 of 97 tasks, across twelve phases.** The two outstanding are a person's, not this session's,
and are named below.

| Phase | Tasks | Outcome |
|---|---|---|
| 1 Setup | `T436a`–`T436e` | Worktree, `D-13` raised 6.x → 7.x, the register's first conformance check, React Router installed |
| 2 Foundational | `T436f`–`T436n` | Area registry, navigation model, derived route tree, not-found, six-prohibition architecture check |
| 3 US1 — one navigation, real addresses | `T437a`–`T437q` | `AppShell`, `Navigation`, the view union removed, `FR-SHL-016` driven through the real `App` and mutation-verified |
| 4 US2 — explicit scope | `T438a`–`T438i` | `ContextBar`, breadcrumb, `ShellContext`, the no-project state |
| 5 US3 — Home | `T439a`–`T439l` | `HomeModel`'s required three sources, the one real source, two that say why they are absent |
| 6 US4 — 360px and keyboard | `T440a`–`T440i` | Drawer, focus order, group landmarks, axe over six addresses |
| 7 US5 — the Room pattern | `T441a`–`T441e` | Adoption asserted as absence: no second region vocabulary anywhere in the shell |
| 8 Polish | `T441f`–`T441p` | p95 measured, Tier 2 transcript, two handovers |
| **9 Convergence** | `T441q`–`T441w` | Deep-link project sync, the Room seam, loading-vs-empty, empty-state next steps, two claims corrected |
| **10 Convergence** | `T442a`–`T442f` | The failed project set, the Room seam **rendered**, address-scoped breadcrumb, a dead export removed |
| **11 Convergence** | `T442g`–`T442j` | `SC-SHL-009` handover, the no-identity set, six requirements cited |
| **12 Convergence** | `T442k`–`T442m` | The reference stack defined, the analysis record corrected, this rewrite |

**Artifacts.**

- `frontend/src/shell/` — 14 files: `areas.ts`, `area-views.tsx`, `navigation-model.ts`,
  `routes.tsx`, `AppShell.tsx`, `Navigation.tsx`, `NavigationDrawer.tsx`, `ContextBar.tsx`,
  `shell-context.tsx`, `Home.tsx`, `home-model.ts`, `home-sources.ts`, `NotFound.tsx`, `shell.css`
- `frontend/src/main.tsx` — **modified**: the `useState<View>` union removed, `BrowserRouter`
  mounted, the project selection synced from the address
- `frontend/tests/unit/shell/` — **18 spec files**, 1 harness
- `tests/governance/dependency-register.spec.ts` — **new**, `TS-001`'s first check
- `specs/_shared/dependencies.md` — `D-13` raised to 7.x, with a "D-13 in detail" section
- `docs/accessibility/EPIC-036-shell-transcript.md` — Constitution XI Tier 2
- `specs/036-application-shell/handovers.md` — **three** handovers: `UX-0003`'s remainder
  (`T441p`), the identifier decision (`T441n`), and the workspace/`SC-SHL-009` gaps (`T441w`,
  `T442g`)
- `frontend/tests/unit/shell-page-routes.spec.tsx` — **deleted**, superseded (`R-036-5`);
  `EPIC-010` `T200e` records it
- `frontend/tests/unit/shell-traceability-route.spec.tsx` — **rewritten** for the router; every
  assertion preserved, the wrong-shaped `me` stub corrected (`DEF-029-006`'s lesson)
- `frontend/tests/unit/a11y/shell.spec.tsx`, `design/app-root.spec.tsx`,
  `design/prototype-parity.spec.tsx` — **modified**: `App` requires a Router in every branch now

**Suites.** `frontend` **535 of 535** in 59 files. `test:unit` **2630 of 2630** in 291 files.
`architecture` **84 of 84**. `governance` **893 of 895** — the two failures are `T884`, red **by
design** until a person runs the manual accessibility pass. Typecheck clean.

## What four convergence passes found, and what that says

**7 findings → 4 → 3 → 3.** Passes 10, 11 and 12 introduced none; pass 12 found no code gap at all.

**Passes 9 and 10 each found faults created by the pass before.** That is the part worth keeping:

1. **`T441v` split *loading* from *empty*** on the project selector and left **failed** collapsed
   into empty — so a rejected request read as *"this workspace has no projects"*. `FR-SHL-062`
   calls that a defect, not a fallback, in as many words.
2. **`T441s` added `hostRoom`** because nothing imported the Room contract — and then nothing
   called `hostRoom` either. `T441t` asserted the *import*, which was the previous fault and not
   that one.

The pattern in both: **the fix was asserted at the level the previous fault was found at, and the
new fault sat one level up.** The state ended as a three-variant union rather than flags precisely
because two attempts with booleans were each wrong in a different way.

## Two load-sensitive tests of my own

Both passed in isolation and failed under the full suite, which is the only reason either was found:

- `fireEvent.change` naming a value the `<select>` does not yet carry is **silently ignored** — the
  set arrives asynchronously.
- **Holding a DOM node across a state change** leaves the reference detached while the live element
  updates.

`DEF-030-002` is the same shape one Epic over. Every query re-runs now, and `test:unit` has been
clean four consecutive times.

## What is NOT done, and why

| Task | Why |
|---|---|
| `T441g` — `SC-SHL-009`, *"answer in under five seconds"* | **A human measure**, recorded as such at plan time. The testable half — the scope is on screen at every address without opening a menu — is asserted by `ContextBar.spec.tsx`. On two addresses it is **carried, not satisfied**: `/runs/:id` and `/specifications/:id` say *"Scoped by this link"* because the review response carries no project. Owner `EPIC-023`, in `handovers.md` |
| `T441k` — the keyboard and screen-reader pass | **A person's, not an agent's.** `EPIC-029` `T885` records the standard and the reason. `T884` stays red until it is done, which is the correct state and not a defect of this Epic |

Neither blocks `/speckit-converge`; both block the Epic Exit Criteria, and the Exit Criteria say so.

**Open analysis findings**: `I2` (the three derived views are named differently in `data-model.md`
§5 and in code) and `D1` (two umbrella requirements restate their own children). Both LOW-impact,
`D1`'s own recommendation was to leave it. Eight of ten are resolved.

## What this Epic must not be read as having proved

- **That an unauthorized user cannot see an area.** `FR-SHL-014` is deferred to `EPIC-024` and
  `PP-008` is this Epic's one deferral. Every delivered area is visible to any signed-in identity.
- **That deep links work in production.** They work against the dev server. **Nothing in this
  repository serves the built client at all** (`R-036-3`), and that gap has no owner.
- **That project health is anywhere.** `BR-0013` left this Epic at clarification, owner `U-03`.
- **That the drawer re-renders on a live window resize.** The transcript records that a viewport
  change applied mid-session by the automation harness did not, and that a reload at 360px does. A
  genuine window resize was **not** tested.
- **That nine areas are navigable.** **Five** are. Four are specified, owned and unbuilt, and nine
  are undeclared — `handovers.md` names who owes each.

## Recommended next task

```
/speckit-converge 036
```

A fifth pass should return `converged`: pass 12 found no code gap and its three findings were all
records, which this run corrected. After that, the specified scope is closed apart from the two
human items, and the Epic goes to its exit gate.

Then, in order of what unblocks most: the four Epics in [handovers.md](./handovers.md) each clear
their `UX-0003` remainder with a registry edit and a binding, `EPIC-023` gives the review response
a project, and **`EPIC-026` still owes the task-identifier decision** — 999 of 999 prefixes are
allocated, this Epic changed its identifier block twice mid-flight, and a four-digit id remains
silently unchecked by all three governance checks until the widening lands.
