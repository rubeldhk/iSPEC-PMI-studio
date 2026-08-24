# Closure record: EPIC-036 Application Shell & Dashboard

**Date**: 2026-08-24 · **Task**: `T441o`, rewritten by `T442k`, corrected by `T442o`, `T442q`, `T442u`/`T442v` and `T442z` ·
**Session**: `/speckit-implement` and **ten** `/speckit-converge` passes (counted 2026-08-24), executed in the worktree
`.claude/worktrees/epic-036-application-shell` (concurrent-session rule, `T436a`)
· **Released by**: PMI-DOC-006 v1.0 (APPROVED, `D-44`) · PMI-DOC-004 v2.0 `BR-0190`

> **Corrected 2026-08-24 (`T442z`).** The Date line above credited **`T442w`**, a task that existed
> nowhere in `tasks.md` — Phase 17's correction was `T442u`/`T442v`. The pass that made the
> correction wrote the wrong id into the record of it. `T442y` now asserts that every task this
> Epic's records cite is a task `tasks.md` defines, **and that check would not have caught this
> one**: `T442w` was allocated by Phase 18, so the reference resolved the moment it was wrong in a
> new way. An existence check catches a dangling id, never a wrong one. Reading the sentence is
> still somebody's job, and this line is the standing example of why.

> **Rewritten 2026-08-24 (`T442k`).** The first version of this record was accurate for about an
> hour. It reported 75 of 77 tasks, ended at Phase 8, and quoted the frontend suite at 508 — before
> five convergence passes added twenty-two tasks and changed four source files. Constitution IX asks
> for a report of *what was done*; that one described what had been done by lunchtime. **This
> version has itself been corrected once** (`T442o`), for the same fault in miniature.

## Work completed

**108 of 110 tasks, across eighteen phases — counted 2026-08-24.** The two outstanding are a
person's, not this session's, and are named below.

> **The date is the point** (`T442q`). This line has been wrong twice, both times because a
> convergence pass appended after it was written. A count in a snapshot document is stale the moment
> the next pass runs; **dating it makes that visible instead of misleading.** The Suites table below
> carries a date for the same reason, and for the same reason it should not be trusted undated
> either.

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
| **14 Convergence** | `T442p`–`T442q` | A discharged handover still recorded as owed, and three documents disagreeing on how many handovers there are |
| **15 Convergence** | `T442r` | `research.md` and `plan.md` still calling the dependency new, and naming a `D-30` that never existed |
| **16 Convergence** | `T442s`–`T442t` | Six documents describing six delivered areas when there are five, and the check that now disagrees |
| **17 Convergence** | `T442u`–`T442v` | Two numbers the new check did not read, and the assertion that makes a part impossible to get wrong alone |
| **18 Convergence** | `T442w`–`T442z` | Two set-level claims resting on hand-maintained lists — the surfaces `SC-SHL-005` counts, and the documents the count check reads |

**Artifacts.**

- `frontend/src/shell/` — 14 files: `areas.ts`, `area-views.tsx`, `navigation-model.ts`,
  `routes.tsx`, `AppShell.tsx`, `Navigation.tsx`, `NavigationDrawer.tsx`, `ContextBar.tsx`,
  `shell-context.tsx`, `Home.tsx`, `home-model.ts`, `home-sources.ts`, `NotFound.tsx`, `shell.css`
- `frontend/src/main.tsx` — **modified**: the `useState<View>` union removed, `BrowserRouter`
  mounted, the project selection synced from the address
- `frontend/tests/unit/shell/` — **20 spec files**, 1 harness
- `tests/governance/dependency-register.spec.ts` — **new**, `TS-001`'s first check
- `specs/_shared/dependencies.md` — `D-13` raised to 7.x, with a "D-13 in detail" section
- `docs/accessibility/EPIC-036-shell-transcript.md` — Constitution XI Tier 2
- `specs/036-application-shell/handovers.md` — **four** obligations, each with an owner:
  `UX-0003`'s remainder (`EPIC-012`, `EPIC-014`/`015`, `EPIC-016`, `EPIC-019`/`021`/`024`), the
  workspace half of `FR-SHL-020` (`EPIC-004`), `SC-SHL-009` on two addresses (`EPIC-023`), and the
  task-identifier decision (`EPIC-026`). A fifth entry is marked ✅ and owed by nobody
- `frontend/tests/unit/shell-page-routes.spec.tsx` — **deleted**, superseded (`R-036-5`);
  `EPIC-010` `T200e` records it
- `frontend/tests/unit/shell-traceability-route.spec.tsx` — **rewritten** for the router; every
  assertion preserved, the wrong-shaped `me` stub corrected (`DEF-029-006`'s lesson)
- `frontend/tests/unit/a11y/shell.spec.tsx`, `design/app-root.spec.tsx`,
  `design/prototype-parity.spec.tsx` — **modified**: `App` requires a Router in every branch now

**Suites, measured 2026-08-24** — every figure taken on that date, none carried forward:

| Suite | Result |
|---|---|
| `frontend` | **576 of 576** in 61 files |
| `test:unit` | **2669 of 2669** in 293 files |
| `test:arch` | **84 of 84** in 8 files |
| `test:contract` | **170 of 170** in 16 files |
| `test:integration` | **1 failed on the first run, 0 on the second** — 209 in 32 files, no code changed between them; see below |
| `governance` | **893 of 895** in 69 files — the two are `T884` |
| `typecheck` | clean |

**One red, not this Epic's, named rather than omitted — and one that flickered inside a single session.**

- **`governance` ×2 — `T884`**, red **by design** until a person runs the manual accessibility pass
  (`T441k`). It is the correct state, not a defect.
- **`test:integration` failed once and passed once, minutes apart, with no change between them.**
  Phase 13 measured `T147`'s p95 search assertion in `backend/tests/integration/scale.spec.ts` at
  1247 ms against a 1000 ms target; Phase 18 saw 1 failure and then 207 of 207 clean, the second
  run showing that same search assertion taking 23.8 s of wall clock. **That is `DEF-030-002`
  behaving exactly as filed** — load-sensitive, green in isolation, red when the machine is busy,
  and this run was measured with the UAT stack and its containers running. **Both observations are
  recorded because reporting only the green one is the same selective reading this Epic keeps
  catching** — though the failing assertion's name was not captured in the red run, so it is named
  here as the known candidate rather than as a confirmed identification. A green run is not a fix.
  The defect stays open against `EPIC-030`, which owns it; this Epic changed no backend code.

> **The first version of this paragraph reported `frontend` at 535 and listed four suites.** It was
> 537, and had been since Phase 11; `test:contract` and `test:integration` had **never been run** in
> this Epic at all. `T442k` rewrote this document *because its figures were stale* and copied one
> forward without re-measuring — which is how `T442o` came to exist. Every number above was measured
> fresh, and the integration red was found by measuring rather than assumed absent.

Typecheck clean.

## What ten convergence passes found, and what that says

**7 findings → 4 → 3 → 3 → 2 → 2 → 1 → 2 → 2 → 4.** The trajectory went **up** at the eighth, held
at the ninth and **doubled at the tenth** — and every time it should have. *"No code gap"* was true
six passes running: first while six documents described a product with one more navigable area than
the one built, then while the check written to catch that read two of its four numbers, and finally
while **two set-level claims rested on lists somebody maintained by hand** — the surfaces
`SC-SHL-005` counts, and the documents the count check reads. **A rising count late in an Epic is
not a regression; it is the checks getting sharp enough to see what was always there.**

**Five of the nine passes found faults created by the pass before**, and the eighth found one
created eight phases earlier that every pass since had walked past:

- `C1`'s remediation set *six delivered, three awaiting an owner* across every artifact. `N1` then
  moved `Plan & Tasks` to `declared-not-delivered` **during the Phase 2 implementation**, and only
  `areas.ts`, `handovers.md`, `closure.md` and the tests followed. **Six specification documents did
  not**, including the contract's route table, which went on presenting `/specifications/:id/tasks`
  as a delivered area — the exact shape `N1` ruled out, in the document an implementer would build
  from.
- Every earlier pass checked `data-model.md` for the **existence** of the `status` union. The union
  was there. **Nobody read the number beside it**, three passes running.

`T442t` is the answer and the one worth carrying forward: `T436f` checked the registry's invariants
and nothing checked that the documents *defining* it said what it said. Constitution V asks a
non-code output to carry an executable check that can fail — **the registry had one, its
specification did not.** That is the part worth keeping.

**And the ninth pass found the same shape inside that answer.** `T442t` read `delivered` and
`declared-not-delivered` and stopped, so `undeclared` and the non-delivered total were unguarded —
and one of them was the wrong number, in `data-model.md`, four lines below a heading `T442s` had
just corrected. A check that reads two of four numbers reports agreement about the two it reads.

**And the tenth pass found the shape a second time, in a different noun.** `SC-SHL-005` sets its
target at *100% of shell-owned surfaces* and says how to verify it — **"by driving each state, not
by inspection."** What verified it was `T441h`: a completed task naming **three** surfaces in its
own description. The `ContextBar` project selector was not among them, and one pass later `T441v`
and `T442b` found that surface rendering a failed fetch as an empty one. **The list was already
wrong when it was ticked, and being a list is why nothing said so.** `T442w` now drives every state
of every surface through the real `App` and asserts the enumeration covers the directory — and it
caught an undeclared module on its first run.

The through-line of passes eight to ten: **wherever a claim was about a *set*, the set was
maintained by a person and checked by nobody.** Areas, then states, then surfaces, then documents.
Each fix closed one instance and left the next standing, because they were not variants of one bug
— they were the same design decision made four times.

This did not stop when the work moved from code into paperwork:

1. **`T441v` split *loading* from *empty*** on the project selector and left **failed** collapsed
   into empty — so a rejected request read as *"this workspace has no projects"*. `FR-SHL-062`
   calls that a defect, not a fallback, in as many words.
2. **`T441s` added `hostRoom`** because nothing imported the Room contract — and then nothing
   called `hostRoom` either. `T441t` asserted the *import*, which was the previous fault and not
   that one.

3. **`T442t` checked two of the registry's four counts** — written specifically because six
   documents had drifted from the registry, and green while one of them still had. `T442v`'s
   answer is the assertion that the three counts **sum to eighteen**: a total cannot be right
   while a part is wrong, which is the first assertion in this Epic that closes the shape instead
   of moving it one step sideways.

4. **`T442k` rewrote this document because its figures were stale** — and copied `frontend`'s
   figure forward from two phases earlier without re-measuring. `T442m` marked `C4` resolved in
   `analysis.md` and left the metrics table above it reading the pre-`C4` number, so that document
   stated both figures at once.

The pattern in the first three: **the fix was asserted at the level the previous fault was found
at, and the new fault sat one level up.** Three times, and the third was in the check written to
end the second. The state ended as a three-variant union rather than flags precisely because two
attempts with booleans were each wrong in a different way.

5. **`T441w` handed over a gap** — a failed project fetch with no state of its own — and the next
   pass refused the framing: `FR-SHL-062` is a MUST, and recording a MUST is not discharging one.
   `T442b` closed it in four lines of JSX and one union variant. The handover entry then sat for
   three more phases still saying *"Not fixed here"* and still naming a variable that had been
   deleted, until `T442p`.

The pattern in the fourth is plainer, and worse for being obvious: **a document about stale numbers
was written without measuring the numbers.** `T442o` re-measured every suite, which is how
`DEF-030-002` came to be in this record at all — `test:integration` had never been run in this Epic.

The pattern in the fifth is the one to carry into the next Epic: **a handover is a claim that
something cannot be done here, and it should be tested like any other claim.** One of the four was
false, and the cost of finding out was smaller than the cost of writing it down.

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

An **eleventh** pass. This record has twice predicted `converged` and been wrong twice, so it
predicts nothing: the last **four** passes found no gap in the code and every one found a gap in
the records or the checks — including in this document, and twice inside a check written to close
the previous pass's finding.

What is different this time, stated narrowly enough to be checked rather than hoped for: the four
set-level claims this Epic makes — which areas exist, which states they are in, which surfaces the
shell owns, and which documents describe them — are now **all four derived and asserted**, none
left to a list. **Every count that
describes the registry is now asserted against the registry, and the three are asserted to sum to
eighteen** — so a document can no longer be right about two states and wrong about the third, which
is the failure the last two passes both found. **What remains unguarded is stated rather than
implied**: free-prose totals are not machine-checked, the reason is written in
`registry-documented.spec.ts`'s header, and the two that were wrong were corrected by hand at
`T442u`. Every figure above was measured on 2026-08-24, none carried forward, and the integration
suite was re-run rather than quoted — which is why its line changed.

Then, in order of what unblocks most: the four Epics in [handovers.md](./handovers.md) each clear
their `UX-0003` remainder with a registry edit and a binding, `EPIC-023` gives the review response
a project, and **`EPIC-026` still owes the task-identifier decision** — 999 of 999 prefixes are
allocated, this Epic changed its identifier block twice mid-flight, and a four-digit id remains
silently unchecked by all three governance checks until the widening lands.
