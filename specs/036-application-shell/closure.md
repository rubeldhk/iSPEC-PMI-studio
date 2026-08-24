# Closure record: EPIC-036 Application Shell & Dashboard

**Date**: 2026-08-24 · **Task**: `T441o`, rewritten by `T442k`, corrected by `T442o` ·
**Session**: `/speckit-implement` and **five** `/speckit-converge` passes, executed in the worktree
`.claude/worktrees/epic-036-application-shell` (concurrent-session rule, `T436a`)
· **Released by**: PMI-DOC-006 v1.0 (APPROVED, `D-44`) · PMI-DOC-004 v2.0 `BR-0190`

> **Rewritten 2026-08-24 (`T442k`).** The first version of this record was accurate for about an
> hour. It reported 75 of 77 tasks, ended at Phase 8, and quoted the frontend suite at 508 — before
> five convergence passes added twenty-two tasks and changed four source files. Constitution IX asks
> for a report of *what was done*; that one described what had been done by lunchtime. **This
> version has itself been corrected once** (`T442o`), for the same fault in miniature.

## Work completed

**97 of 99 tasks, across thirteen phases.** The two outstanding are a person's, not this session's,
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
| **13 Convergence** | `T442n`–`T442o` | Two figures Phase 12 left wrong — the coverage table and this Suites paragraph |

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

**Suites, measured 2026-08-24** — every figure taken on that date, none carried forward:

| Suite | Result |
|---|---|
| `frontend` | **537 of 537** in 59 files |
| `test:unit` | **2630 of 2630** in 291 files |
| `test:arch` | **84 of 84** in 8 files |
| `test:contract` | **170 of 170** in 16 files |
| `test:integration` | **208 passed, 1 failed, 2 skipped** of 209 in 32 files — see below |
| `governance` | **893 of 895** in 69 files — the two are `T884` |
| `typecheck` | clean |

**Two reds, neither this Epic's, both named rather than omitted.**

- **`governance` ×2 — `T884`**, red **by design** until a person runs the manual accessibility pass
  (`T441k`). It is the correct state, not a defect.
- **`test:integration` ×1 — `T147`'s p95 search assertion** in `backend/tests/integration/scale.spec.ts`,
  at 1247 ms against a 1000 ms target. **It passes alone** — 4 of 4, verified the same day — and
  fails only under full-suite load. That is `DEF-030-002`, filed against `EPIC-030` and owned there.
  This Epic changed no backend code.

> **The first version of this paragraph reported `frontend` at 535 and listed four suites.** It was
> 537, and had been since Phase 11; `test:contract` and `test:integration` had **never been run** in
> this Epic at all. `T442k` rewrote this document *because its figures were stale* and copied one
> forward without re-measuring — which is how `T442o` came to exist. Every number above was measured
> fresh, and the integration red was found by measuring rather than assumed absent.

Typecheck clean.

## What five convergence passes found, and what that says

**7 findings → 4 → 3 → 3 → 2.** The last two passes found **no code gap at all**; every finding in
them was a record disagreeing with the code.

**Three of the five passes found faults created by the pass before.** That is the part worth
keeping, and it did not stop when the work moved from code into paperwork:

1. **`T441v` split *loading* from *empty*** on the project selector and left **failed** collapsed
   into empty — so a rejected request read as *"this workspace has no projects"*. `FR-SHL-062`
   calls that a defect, not a fallback, in as many words.
2. **`T441s` added `hostRoom`** because nothing imported the Room contract — and then nothing
   called `hostRoom` either. `T441t` asserted the *import*, which was the previous fault and not
   that one.

3. **`T442k` rewrote this document because its figures were stale** — and copied `frontend`'s
   figure forward from two phases earlier without re-measuring. `T442m` marked `C4` resolved in
   `analysis.md` and left the metrics table above it reading the pre-`C4` number, so that document
   stated both figures at once.

The pattern in the first two: **the fix was asserted at the level the previous fault was found at,
and the new fault sat one level up.** The state ended as a three-variant union rather than flags
precisely because two attempts with booleans were each wrong in a different way.

The pattern in the third is plainer, and worse for being obvious: **a document about stale numbers
was written without measuring the numbers.** `T442o` re-measured every suite, which is how the
`test:integration` red above came to be in this record at all — it had never been run in this
Epic.

## Three load-sensitive tests of my own

All three passed in isolation and failed under the full suite, which is the only reason any was
found:

- `fireEvent.change` naming a value the `<select>` does not yet carry is **silently ignored** — the
  set arrives asynchronously.
- **Holding a DOM node across a state change** leaves the reference detached while the live element
  updates — twice, in `ContextBar` and then in `NavigationDrawer`.

`DEF-030-002` is the same shape one Epic over, and it is the `test:integration` red in the table
above. After the third occurrence the fix moved from the test to the harness: `clickByName`
re-queries at click time, with the reason written on it, so the next test does not reinvent the
mistake.

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

A **sixth** pass. The fifth was predicted to return `converged` and did not — it found the two
figures this phase has just corrected. That prediction has now been wrong twice, so this record
makes none: the last two passes found no gap in the **code**, and both found one in the **records**,
including in this document.

What would make a clean pass credible rather than hoped for: every figure here was measured on
2026-08-24 rather than carried forward, `analysis.md`'s coverage table was re-measured the same way,
and the suites that had never been run in this Epic — `test:contract` and `test:integration` — now
have been.

Then, in order of what unblocks most: the four Epics in [handovers.md](./handovers.md) each clear
their `UX-0003` remainder with a registry edit and a binding, `EPIC-023` gives the review response
a project, and **`EPIC-026` still owes the task-identifier decision** — 999 of 999 prefixes are
allocated, this Epic changed its identifier block twice mid-flight, and a four-digit id remains
silently unchecked by all three governance checks until the widening lands.
