# Tasks: Application Shell & Dashboard

**Epic**: `EPIC-036`

**Input**: Design documents from `/specs/036-application-shell/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/shell-contract.md](./contracts/shell-contract.md), [quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task that produces or changes application code carries
at least one accompanying unit-test task. Unit tests are written FIRST and MUST fail before the
implementing code is written. A task is not complete until its tests pass. **Non-code outputs count
too** (Constitution V v1.2.0): the area registry and the `D-30` register row are documents, and each
is paired with an executable conformance check that reads the artifact and can fail.

**Organization**: grouped by user story, so each story is independently implementable and testable.

**Before starting**: sync from GitHub, confirm no other Claude session is active on this checkout,
and label the session `EPIC-036 Application Shell` (Constitution VIII). `T436a` is the discharge of
the concurrent-session gate that [plan.md](./plan.md) records as discharged — and the only thing
that discharges it.

**Before finishing**: close with a Work Completed + Recommended Next Task report (Constitution IX).

**Task IDs**: the block `T436`–`T441`, one base identifier per phase, suffixed within it —
`EPIC-032`'s pattern, stated in its own header as *"83 tasks on the block `T855`–`T864`, one base
identifier per phase, suffixed within it"*. **77 tasks** — `T441p` was added by the remediation of
[analysis.md](./analysis.md) `C1` on 2026-08-24.

> ### Why the identifiers look like this, and what it hands to `EPIC-026`
>
> **999 of 999 three-digit prefixes are now allocated.** `EPIC-034` `T995y` — still open — measured
> this at 992 and handed `EPIC-026` a choice between two fixes. Neither has been made, and this
> Epic is the first to need identifiers with no free prefix at all.
>
> `T995y` states the distinction exactly: **the identifier space is not exhausted** — `G-26-15`
> requires unique *identifiers* and there are 182 unused ones in `T436`–`T442` alone — **the
> prefix-block convention is**. So this Epic takes the second of `T995y`'s two options: it uses
> letter suffixes under prefixes whose bare identifiers belong to `EPIC-024` and `EPIC-025`, and
> **no lettered identifier under `T436`–`T441` appears anywhere in the corpus**, verified by scan
> before allocation.
>
> **What that costs.** `EPIC-029` records the suffix as meaning *"a later addition adjacent to what
> it pairs with"*. `T437c` is not an addition to `EPIC-024`'s `T437`. That reading is now retired
> for this block, which is a real loss of legibility and the reason `T441n` hands the standing
> decision back to `EPIC-026` with the measurement updated — as a blocker on `EPIC-037`, not a
> warning. **This Epic did not choose between `T995y`'s two options; it worked around needing to.**
> The four-digit widening is still the durable fix and is still `EPIC-026`'s.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: which user story the task serves (`US1`–`US5`)
- Exact file paths are in the descriptions

---

## Phase 1: Setup

**Ordering is load-bearing here.** `TS-001` requires the register row before the install, so `T436b`
and its check precede `T436d`. Recording a dependency after adopting it makes the register a
transcript rather than a gate.

- [X] T436a Create the worktree `.claude/worktrees/epic-036-application-shell` from `main`, and label the session `EPIC-036 Application Shell`. Discharges the concurrent-session gate: this plan was written on `main`, so exclusivity did not hold at planning and only the worktree restores it. `EPIC-033` `T337a` is the precedent
- [X] T436b [P] Add **`D-30` — React Router, 7.x, MIT** to the *Runtime dependencies — frontend* table in `specs/_shared/dependencies.md`, with the purpose (`FR-SHL-017` addressable areas), the Context7 library id `/remix-run/react-router` recorded in `research.md` `R-036-1`, and a risk position. **Before any `package.json` change** (`TS-001`); `EPIC-030` `T993d` is the precedent for how a new row is justified (conformance check: T436c)
- [X] T436c [P] Write a failing conformance check in `tests/governance/dependency-register.spec.ts` asserting every runtime dependency declared in `frontend/package.json`, `backend/package.json` and `worker/package.json` has a row in `specs/_shared/dependencies.md`. **Nothing checks this today** — the register is maintained by discipline alone, which is why `TS-001` can be satisfied in prose and missed in fact. Include an anti-vacuity assertion that the scan reads a substantial number of packages
- [X] T436d Install `react-router@^7` as a runtime dependency of `frontend/package.json` and update `pnpm-lock.yaml`. Runs only after `T436b` and `T436c` are green
- [X] T436e [P] Extend `tests/governance/dependency-register.spec.ts` to assert the installed router resolves to `7.x` **and React remains pinned at `18.3.1`** (covers T436d). `R-036-1` claims v7 bridges React 18 to 19 rather than requiring 19; a silent React bump would falsify that claim without failing anything

---

## Phase 2: Foundational — the one list, and the checks that read it

**Blocking prerequisite for every user story.** `SC-SHL-004` measures shell code changes at zero
when a delivered area is added, and that is only true if navigation, the route tree and the
reachability check are all derived from one declaration (`R-036-2`).

- [X] T436f [P] Write failing tests for the area registry's invariants in `frontend/tests/unit/shell/areas.spec.ts` — every `id` unique, every `path` unique and leading `/`, no area in two groups (`FR-SHL-011`), **`status: 'delivered'` implies an `element` and the other two statuses imply none**, every `declared-not-delivered` area names an owning `epic`, and all four groups present in PMI-DOC-006 §4.1 order
- [X] T436g Create the area registry in `frontend/src/shell/areas.ts` — the `Area` interface, the closed `AreaGroup` and `AreaStatus` unions, and the `AREAS` list (`FR-SHL-002` — the committed registry navigation is derived from) carrying **all eighteen** areas of PMI-DOC-006 §4.1: **six `delivered`** (Home, Projects, Specifications, Plan & Tasks, Runs, Workspace & Administration), **three `declared-not-delivered`** (QA & Releases → `EPIC-014`/`EPIC-015`, Architecture & Decisions → `EPIC-016`, Governance → `EPIC-019`/`EPIC-021`/`EPIC-024`), and **nine `undeclared`**, per [contracts/shell-contract.md](./contracts/shell-contract.md) §1 (unit test: T436f)
- [X] T436h [P] Write failing tests for navigation derivation in `frontend/tests/unit/shell/navigation-model.spec.ts` — delivered areas only, grouped in registry order, and a group with no delivered area omitted entirely rather than rendered as an empty heading (`FR-SHL-015`)
- [X] T436i Implement `navigationModel()` in `frontend/src/shell/navigation-model.ts`, derived from `AREAS` and nothing else (unit test: T436h)
- [X] T436j [P] Write failing tests for route-tree derivation in `frontend/tests/unit/shell/routes.spec.tsx` — one route per delivered area, no hand-written route, and `*` resolving to not-found
- [X] T436k Implement the derived route tree in `frontend/src/shell/routes.tsx` using `BrowserRouter`/`Routes`/`Route`/`Outlet` imported from `react-router` — **not `react-router-dom`**, which v7 supersedes (`R-036-1`, Context7 `/remix-run/react-router`) (unit test: T436j)
- [X] T436l Implement the not-found element in `frontend/src/shell/NotFound.tsx` — a real not-found, never a blank area inside working chrome. `DEF-001-006` is `EPIC-001`'s open defect and must not be made worse (unit test: T436j)
- [X] T436m [P] Write a failing architecture check in `frontend/tests/unit/shell/shell-boundaries.spec.ts` asserting **all six** prohibitions of [contracts/shell-contract.md](./contracts/shell-contract.md) §6 over `frontend/src/shell/` — **no area content: the shell hosts screens and implements none** (`FR-SHL-003`, the clause the `C1` finding put under pressure), no permission or role model, no second region vocabulary, no workspace/project selection rules, no persisted state, no design token values. Strip comments and string literals before scanning, as `EPIC-033` `T337s` established after a check failed on prose rather than on code
- [X] T436n [P] Add the anti-vacuity companion to `frontend/tests/unit/shell/shell-boundaries.spec.ts` (covers T436m) — a check that cannot fail is decoration, and this one scans a directory that starts nearly empty

---

## Phase 3: User Story 1 — Every delivered area is reachable from one navigation (P1) 🎯 MVP

**Goal**: `BR-0190` — the MUST no Epic has owned. One persistent grouped navigation, every declared
area reachable from anywhere, every area addressable.

**Independent test**: sign in and reach all **six delivered** areas from navigation without using
browser history or typing a URL; then open one area's address in a new tab and refresh it.

- [X] T437a [P] [US1] Write failing tests for primary navigation in `frontend/tests/unit/shell/Navigation.spec.tsx` — four groups in §4.1 order, delivered areas only, the current area marked, and navigation still present after selecting an area (`FR-SHL-010`, `FR-SHL-012`, `FR-SHL-013`)
- [X] T437b [US1] Implement `frontend/src/shell/Navigation.tsx` — the one persistent navigation `FR-SHL-001` requires — rendering `navigationModel()` with `EPIC-029`'s components consumed unchanged (unit test: T437a)
- [X] T437c [P] [US1] Write failing tests for the shell frame in `frontend/tests/unit/shell/AppShell.spec.tsx` — navigation, context bar and `<Outlet />` composed, and the frame surviving an area change
- [X] T437d [US1] Implement `frontend/src/shell/AppShell.tsx` (unit test: T437c)
- [X] T437e [P] [US1] Write failing tests in `frontend/tests/unit/shell/app-entry.spec.tsx` asserting the application root mounts the router and that **no `useState` view union remains** — the shape `main.tsx` has carried since `T003`
- [X] T437f [US1] Replace the view union in `frontend/src/main.tsx` with the router, removing `View`, `LOCATION` and the six view kinds `DEF-010-001`'s remediation added (unit test: T437e)
- [X] T437g [US1] Remove `T200e`'s four navigation buttons from the project view in `frontend/src/pages/`, superseded by primary navigation (`R-036-5`) (unit test: T437e)
- [X] T437h [P] [US1] Write the failing `FR-SHL-016` reachability check in `frontend/tests/unit/shell/area-reachability.spec.tsx` — drive the **real** `App` through its real entry point and assert every `status: 'delivered'` area is reachable from primary navigation by clicking. Constitution XI Tier 1; `G-UX-01`'s navigation half
- [X] T437i [US1] Make `T437h` pass, and record in its header what it does **not** answer — the import-graph question belongs to `T200a`, which is kept and joined rather than replaced (`R-036-5`)
- [X] T437j [US1] Mutation-verify `T437h` by removing one delivered area's route and observing the check fail **naming that area**, then restore. `SC-SHL-001` states this as a number and `T200c` is the standard. The guard `DEF-010-001` did not have
- [X] T437k [P] [US1] Write a failing test asserting **zero** areas that are not `delivered` appear in navigation — not disabled, not greyed, not a placeholder — covering the nine `undeclared` (`UX-0060`) **and** the three `declared-not-delivered` alike (`SC-SHL-002`) — in `frontend/tests/unit/shell/Navigation.spec.tsx`
- [X] T437l [P] [US1] Write failing tests for addressability in `frontend/tests/unit/shell/addresses.spec.tsx` — every delivered area resolves from its own address, a re-mount at that address lands in the same area, and back returns to the previous location (`SC-SHL-010`)
- [X] T437m [US1] Implement per-area addresses and key sub-view routes in `frontend/src/shell/routes.tsx` per the route table in [contracts/shell-contract.md](./contracts/shell-contract.md) §2 (unit test: T437l)
- [X] T437n [P] [US1] Write a failing test asserting an address naming an area that is not `delivered` answers not-found rather than an empty area — asserted for **both** remaining statuses, since *"forbidden to build"* and *"not built yet"* must give a user the same answer (`SC-SHL-011`, `FR-SHL-017`) — in `frontend/tests/unit/shell/addresses.spec.tsx`
- [X] T437o [US1] Replace `T200e`'s route spec with the shell's own coverage in `frontend/tests/unit/shell/area-reachability.spec.tsx` and `frontend/tests/unit/shell/addresses.spec.tsx`, and **keep `frontend/tests/unit/design/page-reachability.spec.ts` untouched** — `T200a` answers a different question (`R-036-5`). `EPIC-010`'s `T200e` line records the supersession, because `G-26-14` reads it and a ticked task may not name a file that is gone
- [X] T437p [P] [US1] Write a check asserting any delivered area is reachable from any other in **at most two actions** (`SC-SHL-003`) in `frontend/tests/unit/shell/area-reachability.spec.tsx`
- [X] T437q [P] [US1] Write the `SC-SHL-004` check in `frontend/tests/unit/shell/registry-extensibility.spec.ts` — moving an area to `delivered` in `AREAS` puts it in navigation and gives it a route **with no other file changed**, which is exactly what `EPIC-014`, `EPIC-016` and `EPIC-019` will each do. Assert it by construction over a synthetic registry, not by reading a diff

---

## Phase 4: User Story 2 — Workspace and project are explicit, never inferred (P1)

**Goal**: `BR-0001`. The failure mode is silent — a user acting on the wrong project sees a
plausible screen.

**Independent test**: switch project from inside an area; the area stays and its content re-scopes.

- [X] T438a [P] [US2] Write failing tests for the context bar in `frontend/tests/unit/shell/ContextBar.spec.tsx` — workspace and project visible without opening a menu, on every data-bearing screen (`FR-SHL-020`, `FR-SHL-021`)
- [X] T438b [US2] Implement `frontend/src/shell/ContextBar.tsx`, reading the signed-in identity's workspace from `GET /v1/auth/me` via the existing `frontend/src/services/api.ts` client (unit test: T438a)
- [X] T438c [P] [US2] Write failing tests for the breadcrumb reading `workspace / project / area` (`FR-SHL-023`, `UX-0012`) in `frontend/tests/unit/shell/ContextBar.spec.tsx`
- [X] T438d [US2] Implement the breadcrumb in `frontend/src/shell/ContextBar.tsx`, deriving the area from the matched route — **never from state held beside the URL** (`data-model.md` §3) (unit test: T438c)
- [X] T438e [P] [US2] Write failing tests in `frontend/tests/unit/shell/shell-context.spec.tsx` — switching project keeps the current area and re-scopes its content (`FR-SHL-022`)
- [X] T438f [US2] Implement `ShellContext` in `frontend/src/shell/shell-context.tsx` carrying `workspaceId` and `projectId` only, with `areaId` derived from the address (unit test: T438e)
- [X] T438g [P] [US2] Write a failing test for an area entered with no project selected — it says so and offers the next step, rather than rendering empty (`FR-SHL-024`). `DEF-007-001` is the same class one layer down
- [X] T438h [US2] Implement the no-project state in `frontend/src/shell/AppShell.tsx` (unit test: T438g)
- [X] T438i [P] [US2] Extend `frontend/tests/unit/shell/shell-boundaries.spec.ts` to assert the shell **renders** the workspace/project selector and defines no selectable set or scoping rule — `EPIC-004`'s, consumed (`FR-SHL-025`). `prototype-parity.md` declines this control to the shell precisely because *"the shell may not invent its selector"*

---

## Phase 5: User Story 3 — Home tells a user what needs them (P2)

**Goal**: `BR-0192`, which has no surface today.

**Independent test**: leave a run's review unsubmitted, open Home, and see it listed with a route to
the review — **and** see the other two sections state that their sources do not exist.

> **The scenario most likely to be "fixed" wrongly.** Two of Home's three sources are unbuilt
> (`R-036-4`): `EPIC-031` is 0 of 92 and `EPIC-032` is 0 of 83. A Home that rendered one section and
> nothing else would read as *"nothing is blocked"*. Stubbing them is rejected outright — a
> fabricated policy block is worse than an absent one.

- [X] T439a [P] [US3] Write failing tests for the Home model in `frontend/tests/unit/shell/home-model.spec.ts` — `sources` **always carries three entries and is not optional**, and a model carrying only `items` does not type-check
- [X] T439b [US3] Implement `HomeModel`, `AttentionItem` and `SourceStatus` — the three kinds `FR-SHL-032` requires visible from Home — in `frontend/src/shell/home-model.ts` per [contracts/shell-contract.md](./contracts/shell-contract.md) §4 (unit test: T439a)
- [X] T439c [P] [US3] Write failing tests for the pending-approvals source in `frontend/tests/unit/shell/home-sources.spec.ts` — `GET /v1/projects/:projectId/runs` filtered to `awaiting_review`, then `GET /v1/runs/:id/review` for unanswered questions
- [X] T439d [US3] Implement the approvals source in `frontend/src/shell/home-sources.ts` against the existing `EPIC-023` endpoints. **No new endpoint** — `FR-SHL-034` forbids an aggregation endpoint no other client can call (unit test: T439c)
- [X] T439e [P] [US3] Write failing tests asserting the policy-block and missing-evidence sources report `unavailable` **naming `EPIC-031` and `EPIC-032`**, and that neither contributes a fabricated item, in `frontend/tests/unit/shell/home-sources.spec.ts`
- [X] T439f [US3] Implement the two unavailable sources in `frontend/src/shell/home-sources.ts` — degrade visibly and say so in the payload, the posture `EPIC-033`'s unbound `AgentGateway` takes (unit test: T439e)
- [X] T439g [P] [US3] Write failing tests for Home's four states in `frontend/tests/unit/shell/Home.spec.tsx` — loading, empty, error and partial distinguishable from one another by driving each state, not by inspection (`FR-SHL-060`, `SC-SHL-005`)
- [X] T439h [US3] Implement the Home area `FR-SHL-030` requires, in `frontend/src/shell/Home.tsx` (unit test: T439g)
- [X] T439i [P] [US3] Mutation-verify `FR-SHL-062` — make a failing section render as an empty state and confirm the suite fails; then restore. Recorded in `frontend/tests/unit/shell/Home.spec.tsx`
- [X] T439j [P] [US3] Write failing tests asserting each attention item names what it is, which project it belongs to, and an `href` that is an `Area.path` rather than an invented route (`FR-SHL-031`)
- [X] T439k [US3] Implement item rendering in `frontend/src/shell/Home.tsx`, carrying **the policy that produced** a policy block rather than merely that something is blocked (`FR-SHL-033`, `BR-0174`) (unit test: T439j)
- [X] T439l [P] [US3] Extend `frontend/tests/unit/shell/shell-boundaries.spec.ts` to assert Home introduces no store of its own and no shell-only endpoint (`FR-SHL-034`, `PP-007`)

---

## Phase 6: User Story 4 — The shell holds at 360px and on a keyboard (P2)

**Goal**: `BR-0193` and `UX-0040`, both MUSTs. Navigation that collapses into unreachability at
360px fails `BR-0190` on the device it fails on.

**Independent test**: at a 360px viewport, reach three areas in different groups using only the
keyboard.

- [X] T440a [P] [US4] Write failing tests for the drawer in `frontend/tests/unit/shell/NavigationDrawer.spec.tsx` — below the narrow breakpoint navigation collapses into a drawer opened by a persistent control, carrying the **full grouped list**, with every delivered area reachable (`FR-SHL-054`)
- [X] T440b [US4] Implement `frontend/src/shell/NavigationDrawer.tsx` — one navigation model at every width, so there is one thing to build, test and describe (unit test: T440a)
- [X] T440c [P] [US4] Write failing tests asserting focus order follows visible order with a visible indicator throughout, drawer included (`FR-SHL-052`), in `frontend/tests/unit/shell/shell-a11y.spec.tsx`
- [X] T440d [US4] Implement focus management across `frontend/src/shell/AppShell.tsx` and `frontend/src/shell/NavigationDrawer.tsx` (unit test: T440c)
- [X] T440e [P] [US4] Write failing tests asserting groups are announced as groups and the current area as current (`FR-SHL-053`) in `frontend/tests/unit/shell/shell-a11y.spec.tsx`
- [X] T440f [US4] Implement the navigation landmark and grouping semantics in `frontend/src/shell/Navigation.tsx` using native elements and ARIA per PMI-DOC-005 (unit test: T440e)
- [X] T440g [P] [US4] Add an `axe-core` assertion of **zero violations on the shell in both themes** (`SC-SHL-008`) to `frontend/tests/unit/shell/shell-a11y.spec.tsx`
- [X] T440h [P] [US4] Write a check asserting the shell sets **no minimum viewport above 360px** (`FR-SHL-051`, `G-UX-03`) in `frontend/tests/unit/shell/shell-boundaries.spec.ts`
- [X] T440i [P] [US4] Write the `SC-SHL-007` check — `FR-SHL-050`'s measure — every `delivered` area reachable by keyboard alone at a 360px viewport, with all eighteen areas set to `delivered` in a synthetic registry so the drawer is exercised at its worst case

---

## Phase 7: User Story 5 — The Room pattern belongs to the shell, not to each Room (P3)

**Goal**: `BR-0191`, a SHOULD. `EPIC-033` already built the shared contract; this Epic **adopts** it.

**Independent test**: render a Room inside the shell and compare its region vocabulary against
`packages/room-contract` by comparison, not by review.

- [X] T441a [P] [US5] Write failing tests in `frontend/tests/unit/shell/room-hosting.spec.tsx` — a Room rendered inside the shell presents the six regions of `ROOM_REGIONS` and cannot present a seventh (`FR-SHL-040`, `FR-SHL-041`)
- [X] T441b [US5] Implement Room hosting in `frontend/src/shell/routes.tsx`, supplying the frame and letting the Room supply the regions — neither restating the other (unit test: T441a)
- [X] T441c [P] [US5] Add a conformance check comparing any region name declared under `frontend/src/shell/` against `ROOM_REGIONS` **by comparison rather than review**. `EPIC-034` `T994t` and `EPIC-035` `T998y` compare against the same vocabulary; a seventh region declared here would make their comparisons pass against a vocabulary that had quietly grown
- [X] T441d [P] [US5] Write a failing test in `frontend/tests/unit/shell/room-hosting.spec.tsx` asserting `@pmi/room-contract` is imported rather than re-derived, and that `frontend/src/rooms/` is consumed unmodified (`FR-SHL-042`, `FR-SHL-043`)
- [X] T441e [US5] Adopt `RoomShellProps` in `frontend/src/shell/AppShell.tsx` (unit test: T441d)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T441f [P] Measure `SC-SHL-006` — navigation responds to a selection in under 1s at p95 **on the reference local stack**, asserted in isolation and recorded with the stack named. `DEF-030-002` records a p95 assertion that fails under suite load and passes alone; scope this one or inherit that ambiguity
- [ ] T441g [P] Verify `SC-SHL-009` — a user can answer *"which workspace and project am I in?"* from the screen in under 5 seconds without opening a menu, recorded in the quickstart run
- [X] T441h [P] Verify `SC-SHL-005` across **every** shell-owned surface — Home (`frontend/tests/unit/shell/Home.spec.tsx` drives all four), the no-project state (`frontend/tests/unit/shell/shell-context.spec.tsx`) and the not-found route (`frontend/tests/unit/shell/addresses.spec.tsx`) each render their states distinguishably, driven rather than inspected
- [X] T441i Run [quickstart.md](./quickstart.md) scenarios 1–6 against the running stack, including both required mutation checks, and record the outcomes
- [X] T441j Produce the Constitution XI Tier 2 **driven transcript** — sign in → Home → each of the six delivered areas → back → switch project → one address naming a declared-but-unbuilt area, observing not-found — verbatim to `docs/accessibility/EPIC-036-shell-transcript.md`. `EPIC-029`'s reachability transcript is the precedent and the format
- [ ] T441k Human keyboard and screen-reader pass over the shell, recorded to `docs/accessibility/EPIC-036-shell-transcript.md`. **A person's, not an agent's** — `EPIC-029` `T885` records the standard and why an agent cannot meet it, and `T884` stays red until it is done
- [X] T441l Rebuild `governance/epic-stage-register.md` with `pnpm register:update`. It runs twice and the first run still exits non-zero; the residual is `T884`, red by design until `T441k`
- [X] T441m Write `specs/036-application-shell/analysis.md` — the `/speckit-analyze` record `DOR-09` reads, with finding ids and severities
- [X] T441n **Hand the task-identifier decision back to `EPIC-026` as a blocker on `EPIC-037`, not a warning**, recorded in `specs/036-application-shell/handovers.md`. **999 of 999 prefixes are allocated** — `T995y` measured 992 and there are now none. It states what this Epic did (block allocation under `T436`–`T441`) and what it did **not** do: choose between `T995y`'s two options. It also records the fact that makes option 1 urgent — a four-digit id matches **none** of `task-ids.spec.ts`, `dor.ts` or `task-paths.spec.ts` today, so until the widening lands such an id is silently unchecked rather than rejected
- [X] T441p **Hand the remainder of `UX-0003` to the four Epics that owe it**, recorded in `specs/036-application-shell/handovers.md`. `Plan & Tasks` (`EPIC-012`, added by the `N1` finding), `QA & Releases` (`EPIC-014`/`EPIC-015`), `Architecture & Decisions` (`EPIC-016`) and `Governance` (`EPIC-019`/`EPIC-021`/`EPIC-024`) are reachable from nothing because no navigable screen exists. Each discharges it with a one-line `frontend/src/shell/areas.ts` edit moving its area to `delivered` (`SC-SHL-004`) — asserted by construction over a synthetic registry, using Governance as the worked example (conformance: T437q, `frontend/tests/unit/shell/registry-extensibility.spec.ts`). Without this the four are invisible: absent from navigation by design and absent from every backlog by accident
- [X] T441o Write `specs/036-application-shell/closure.md` — artifacts by path, anything in scope not done and why, and the recommended next command. Then run `/speckit-converge` as the Epic exit gate (Constitution IV)

---

## Dependencies

```text
Phase 1 Setup  ──►  Phase 2 Foundational  ──┬──►  US1 (P1)  ──┬──►  US2 (P1)
   T436b ► T436d      registry, routes,     │     T437*      │     T438*
   (TS-001 order)     boundary checks       │                │
                                            ├──►  US3 (P2) ──┤     US4 (P2)
                                            │     T439*      │     T440*
                                            └──►  US5 (P3) ──┘     T441a–e
                                                                        │
                                                              Phase 8 ──┘
```

**Hard edges, and only these:**

| From | To | Why |
|---|---|---|
| `T436b`, `T436c` | `T436d` | `TS-001` — the register row precedes the install, or the register is a transcript |
| `T436g` (registry) | every story | one list, three consumers (`R-036-2`) |
| `T436k` (routes) | `US1`, `US3`, `US5` | Home and Rooms are hosted by the route tree |
| `T437d` (`AppShell`) | `US2`, `US4`, `US5` | the context bar, the drawer and Room hosting all compose the frame |
| `T437h`/`T437i` | `T437j` | a mutation check needs something to mutate |
| `T441k` (human pass) | `T441l` | `T884` cannot go green before a person has run it |

**Story independence.** `US2`, `US3`, `US4` and `US5` each depend on Phase 2 and on `US1`'s frame,
and on **nothing from each other** — Home does not need the drawer, and the drawer does not need
Home. After `US1` they can proceed in any order or together.

## Parallel Execution

**Phase 2** — `T436f`, `T436h`, `T436j`, `T436m` are four failing test files with no shared source:
write all four, watch all four fail, then implement `T436g`/`T436i`/`T436k`/`T436l` against them.

**Phase 3** — `T437a`, `T437c`, `T437e`, `T437h`, `T437k`, `T437l`, `T437n`, `T437p`, `T437q` are
independent spec files. The implementations they drive (`T437b`, `T437d`, `T437f`, `T437m`) are
**not** parallel with each other: `T437f` rewrites `main.tsx` and `T437m` rewrites `routes.tsx`.

**Phase 5 and Phase 6 in parallel** — different files, different requirements, no shared source.
`frontend/src/shell/Home.tsx` and `frontend/src/shell/NavigationDrawer.tsx` never meet.

**Not parallel, and worth naming:** `T438i`, `T439l`, `T440h` all extend
`frontend/tests/unit/shell/shell-boundaries.spec.ts`. Three parallel writers to one file is a merge
conflict, not a speed-up.

## Implementation Strategy

**MVP is Phase 1 + Phase 2 + US1** — 31 tasks. That is the whole of `BR-0190`: a signed-in user
reaches every delivered area from one navigation, and every area has an address that survives a
refresh. It is shippable on its own, and it is the state `DEF-010-001` proved the product has never
been in.

**Then US2** (also P1) — `BR-0001` tenant isolation, whose failure mode is a plausible wrong screen.

**Then US3 and US4 together** (both P2) — Home and the 360px/keyboard pass touch disjoint files.

**US5 last** (P3) — `BR-0191` is a SHOULD and `EPIC-033` already built the contract this adopts.

### Independent test criteria

| Story | Passes when |
|---|---|
| US1 | all six delivered areas reached from navigation without history or a typed URL; the other twelve absent; one area's address opened fresh and refreshed; `T437j`'s mutation observed failing |
| US2 | project switched from inside an area, area retained, content re-scoped; breadcrumb reads `workspace / project / area` throughout |
| US3 | an unsubmitted review appears on Home with a route to it, **and** the other two sections name `EPIC-031` and `EPIC-032` as absent |
| US4 | three areas in different groups reached at 360px by keyboard alone; zero axe violations in both themes |
| US5 | a Room rendered in the shell presents exactly `ROOM_REGIONS`; `T441c` compares rather than reviews |

### What this Epic must not claim to have proved

- **That an unauthorized user cannot see an area.** `FR-SHL-014` is deferred to `EPIC-024`; the
  shell gates nothing, and `PP-008` is the Epic's one deferral.
- **That deep links work in production.** They work against Vite's dev server. Nothing in this
  repository serves the built client at all, and that gap has no owner (`R-036-3`).
- **That project health is anywhere.** `BR-0013` left this Epic at clarification, owner `U-03`.

---

## Phase 9: Convergence

Appended by `/speckit-converge 036` on 2026-08-24, after `/speckit-implement` closed 75 of 77
tasks. Findings are what the **code** does not yet satisfy, read against `spec.md`, `plan.md` and
this file. Nothing above was renumbered, reworded or removed.

> **Identifiers continue the block rather than the number.** The append contract says
> `T{M+1:03d}`, which would be `T442` — and `T442` is already declared elsewhere in the corpus.
> `T441q`–`T441w` were verified unused before allocation. This is the same exhaustion `T441n` hands
> to `EPIC-026`, met again three commands later.

- [X] T441q Set `ShellContext.projectId` from the address when a project sub-view is opened directly, in `frontend/src/shell/shell-context.tsx` and `frontend/src/shell/area-views.tsx` per `FR-SHL-021` (contradicts) — `ProjectDetailView` reads the project from `useParams`, and nothing calls `selectProject` from the address, so a deep link to `/projects/:projectId` renders that project while the breadcrumb reads *"No project selected"*. `FR-SHL-017` created that entry path and `UX-0011` requires the scope **visible rather than implied**; a breadcrumb that contradicts the content is worse than one that is merely absent, and `BR-0001`'s failure mode is exactly a plausible screen (unit test: T441r)
- [X] T441r Write a failing test in `frontend/tests/unit/shell/shell-context.spec.tsx` asserting that every sub-view address carrying a project identifier leaves the breadcrumb naming that project, per `FR-SHL-021` (missing) — covers T441q. Drive it through the real `App` at `/projects/:projectId`, not through the provider in isolation, because the fault is in the composition
- [X] T441s Adopt `RoomShellProps` from `@pmi/room-contract` in `frontend/src/shell/AppShell.tsx` per `FR-SHL-042` (missing) — **nothing under `frontend/src/shell/` imports the contract at all**; only a comment mentions it. `T441e` claims this and `T441d` does not check it: that test asserts the shell does not **re-derive** the Room types, which is true and is a different claim from adopting them. The gap is latent today because no Room area is delivered, and it stops being latent the moment one is (conformance: T441t)
- [X] T441t Extend `frontend/tests/unit/shell/room-hosting.spec.tsx` to assert the shell **imports** `@pmi/room-contract` rather than only that it declares no vocabulary of its own, per `FR-SHL-042` (partial) — covers T441s. An absence-only assertion passes just as well over a shell that has never heard of the contract, which is the state it is in
- [X] T441u Pass `loading` to the project `Select` in `frontend/src/shell/ContextBar.tsx` while `listProjects()` is in flight, per `FR-SHL-060` (partial) — the control renders `emptyMessage` *"No projects in this workspace"* during the request, so **loading is indistinguishable from empty** on a shell-owned surface. `DEF-007-001` is this class one layer down, and `EPIC-029`'s `Select` already supports the state (unit test: T441v)
- [X] T441v Write a failing test in `frontend/tests/unit/shell/ContextBar.spec.tsx` asserting the project selector says it is loading while the set is in flight and says it is empty only once it is not, per `FR-SHL-060` (missing) — covers T441u
- [X] T441w Give every shell-owned empty state a next step, and record the two scope gaps this run found, per `FR-SHL-061` (partial) — three parts, none of them code-heavy. (a) Home's empty sections and the no-workspace state in `frontend/src/shell/area-views.tsx` say what is absent and offer nothing; `EmptyState` takes `actionLabel`/`onAction` and neither uses them. (b) **The workspace half of `FR-SHL-020`/`FR-SHL-022` is silently absent** — the shell shows the workspace and offers no way to switch it, and no endpoint enumerates workspaces, so record the missing selectable set with its owner the way Home records `EPIC-031` and `EPIC-032` rather than leaving the absence unexplained. (c) `quickstart.md` §2 claims `git diff --name-only` shows **one** path when an area is delivered; it shows **two**, because `element` must come from a binding in `area-views.tsx` — reconcile the claim with the code, and correct the same overstatement in `handovers.md` (unit test: T441v)

---

## Phase 10: Convergence

Appended by the second `/speckit-converge 036` on 2026-08-24. Phase 9 closed seven findings; this
pass found four more, **two of them created by Phase 9's own fixes**. Nothing above was renumbered,
reworded or removed.

> **The identifier block moved again.** `T441` has three letters left and this phase needs six, so
> it starts at `T442a` — `T442` bare is declared elsewhere, as `T442` the number would have been.
> That is the **fourth** time in this session, and the second time it has changed a decision rather
> than merely a label. `T441n` hands it to `EPIC-026`; `handovers.md` carries the measurement.

- [X] T442a Write a failing test in `frontend/tests/unit/shell/ContextBar.spec.tsx` asserting the project selector reports a **failed** set as failed rather than as empty, per `FR-SHL-062` (missing) — drive `listProjects()` to reject and assert the control does not read *"No projects in this workspace"*. `T441v` separated loading from empty and left the third state undriven, which is how it stayed absent
- [X] T442b Give the project selector a failed state in `frontend/src/main.tsx` and `frontend/src/shell/ContextBar.tsx`, per `FR-SHL-062` (contradicts) — a rejected `listProjects()` currently lands in `.catch` (list emptied) and `.finally` (load recorded), so **a request that failed renders as a workspace with no projects**. `FR-SHL-062` says a failed section reports as failed and that rendering a failure as an empty state is *"a defect, not a fallback"*; this is that sentence, in code, on a control visible from every address. `handovers.md` records it as deferred — recording a MUST is not discharging one (unit test: T442a)
- [X] T442c Render a Room through `hostRoom` and assert the six regions in `frontend/tests/unit/shell/room-hosting.spec.tsx`, per `FR-SHL-040` (partial) — `frontend/src/shell/AppShell.tsx` exports `hostRoom` and **nothing calls or renders it**, in `src` or in any test. `T441t` asserts the contract is *imported*, which is the fault it was written for and not this one: a seam that has never been rendered is the same built-but-unexercised shape `F2` was, one level up. Assert `ROOM_REGIONS` all appear and that a seventh is not representable
- [X] T442d Write a failing test in `frontend/tests/unit/shell/shell-context.spec.tsx` asserting `/specifications/:specificationId` and `/runs/:runId` either name their project in the breadcrumb or say they cannot, per `FR-SHL-021` (missing) — covers T442e
- [X] T442e Decide and implement what `/specifications/:specificationId` and `/runs/:runId` say about scope, in `frontend/src/shell/area-views.tsx`, per `FR-SHL-021` (partial) — both render data-bearing screens with **no project scope at all**, so a deep link shows a review session under *"No project selected"*. `T441q` fixed this for `/projects/:projectId`, where the address carries the project; these two carry an identifier the shell cannot resolve without fetching, and `FR-SHL-003` says the shell does not fetch domain data. **Either** wrap them in `RequireProject` as `TasksView` already does, **or** state the limit where a user sees it. Do not leave the third option, which is what is there now: a breadcrumb that quietly says nothing (unit test: T442d)
- [X] T442f Remove `areaByPath` from `frontend/src/shell/areas.ts`, or give it the caller it was written for, per `tasks: T436g` (unrequested) — the export is referenced nowhere in `src` or `tests`. `areaForPathname` in `shell-context.tsx` does the resolution the shell actually needs, including sub-views; this one matches an exact path and nothing wanted that. Dead exports are how a registry grows a second lookup with different semantics (unit test: T436f)

---

## Phase 11: Convergence

Appended by the third `/speckit-converge 036` on 2026-08-24. Phase 10 closed six findings and — for
the first time in this Epic — **introduced none**. Three remain, one MEDIUM and two LOW. Nothing
above was renumbered, reworded or removed.

> The identifier block continues at `T442g`; twenty letters remain under `T442`. `T441n` and
> `handovers.md` carry the standing handover to `EPIC-026`.

- [X] T442g Record the `SC-SHL-009` gap on address-scoped views in `specs/036-application-shell/handovers.md`, per `SC-SHL-009` (partial) — on `/runs/:runId` and `/specifications/:specificationId` the breadcrumb reads *"Scoped by this link"*, so a user **cannot** answer *"which project am I in?"* from the screen. `T442e` chose that over guessing or over `RequireProject`, and it is the honest answer — but honest is not the same as satisfied, and `SC-SHL-009` says under five seconds without opening a menu. The shell cannot close this alone: `GET /v1/runs/:id/review` returns `{ id, runId, state, openedAt, submittedAt, questions }` and **no project**. Record it against `EPIC-023` on the same terms as the workspace gap — the criterion is satisfied on seven of nine addresses and carried, with an owner, on two
- [X] T442h [P] Write a failing test in `frontend/tests/unit/shell/ContextBar.spec.tsx` asserting the project set is **not** `ready` with an empty list while no identity is signed in, per `FR-SHL-062` (missing) — covers T442i
- [X] T442i Stop claiming a ready, empty project set when there is no identity, in `frontend/src/main.tsx`, per `FR-SHL-062` (contradicts) — the signed-out branch sets `{ kind: 'ready', projects: [] }`, which says *"we asked, and this workspace has none"* about a workspace that does not exist and a request never made. **Latent today** — `App` renders `SignIn` in the same pass, so `ContextBar` never sees it — and latent is exactly what the loading and failed states were before each became live. The union's whole claim is that no variant can be a lie; this one is (unit test: T442h)
- [X] T442j [P] Add the six requirement identifiers to the task lines that already satisfy them, per `analysis.md C4` (partial) — `FR-SHL-001`, `FR-SHL-002`, `FR-SHL-011`, `FR-SHL-030`, `FR-SHL-032` and `FR-SHL-050` are covered in substance and cited by nothing, so traced coverage reads **84.4%** against 97.8% actual. `FR-SHL-011` is asserted verbatim by `T436f` (*"no area in two groups"*) without naming the requirement; `FR-SHL-002` is measured through `SC-SHL-004` by `T437q`. `FR-SHL-014` stays uncited on purpose — it is a declared deferral and a task for it would be wrong

---

## Phase 12: Convergence

Appended by the fourth `/speckit-converge 036` on 2026-08-24. **No code gap was found.** All 34
functional requirements, 11 success criteria, 20 acceptance scenarios, 7 edge cases and 6 plan
decisions are satisfied by code that a test drives. The three findings below are all about the
Epic's **records** disagreeing with its state — which is a different failure from the previous
three passes, and worth saying plainly rather than rounding to "converged".

- [X] T442k Rewrite `specs/036-application-shell/closure.md` to describe the Epic as it now is, per `Constitution IX` (partial) — it reports **75 of 77 tasks**, ends at Phase 8, and quotes `frontend` at 508 of 508. There are now **94 tasks in 11 phases** and 535 frontend tests, and it mentions none of: the three convergence passes, the `ProjectSetState` union that replaced two booleans after each was wrong in turn, `hostRoom`, the address-scoped breadcrumb, or the third handover to `EPIC-023`. Constitution IX asks for a report of *what was done*; this one is a report of what had been done by lunchtime. Keep its two open items and its "must not be read as having proved" section — both are still exactly right
- [X] T442l Define what *"the reference local stack"* means for `SC-SHL-006`, in `specs/036-application-shell/quickstart.md`, per `analysis.md A1` (partial) — the criterion names it, `plan.md` repeats it, and **nothing says what it is**. `docs/accessibility/EPIC-036-shell-transcript.md` §7 names the stack the 20.5 ms p95 was measured on, so *that* measurement is scoped; the criterion still is not, and the next person to measure has the ambiguity back. `quickstart.md` rather than `spec.md`: it already has a Prerequisites section, it is where somebody about to measure would look, and it keeps the definition out of a document `/speckit-converge` may not touch. Point `SC-SHL-006`'s record at it from the transcript
- [X] T442m Mark the resolved findings resolved in `specs/036-application-shell/analysis.md`, per `FR-ESK-019` (partial) — `C3`, `C4` and `N1` read as open and are not. `C3` (empty states offer no next step) was closed by `T441w`; `C4` (six uncited requirements) by `T442j`, taking traced coverage to 44 of 45 — `FR-SHL-014` has none on purpose; `N1` (`Plan & Tasks` has no parameterless address) was settled by recording it `declared-not-delivered` against `EPIC-012`. `A1`, `I2` and `D1` stay open and `T442l` addresses the first. A record that reports closed work as outstanding is the same fault as one that reports outstanding work as closed, in the direction nobody checks

---

## Phase 13: Convergence

Appended by the fifth `/speckit-converge 036` on 2026-08-24. **No code gap, again** — the second
pass in a row to find none. Both findings are numbers in the Epic's own records, and **both were
left by Phase 12, the phase whose entire job was correcting numbers in the Epic's own records.**
That is worth recording rather than quietly patching: it is the same shape as Phases 9 and 10, which
each introduced a fault while fixing one, moved from code into paperwork.

- [X] T442n Correct the citation figures in `specs/036-application-shell/analysis.md`, per `FR-ESK-019` (contradicts) — the Coverage table reports **37 of 45 — 82.2%** cited *"(was 80.0% before `C2`'s fix)"*, while `C4` is marked ✅ six lines above it with a note stating the figure is now **44 of 45**. **The document contradicts itself**, and the stale half is the one a reader would quote. `T442j` (Phase 11) closed `C4`; `T442m` (Phase 12) marked it resolved and did not touch the metrics above it. The true figure is **44 of 45 (97.8%)** cited by a task that implements or asserts the requirement — `FR-SHL-014` has none on purpose, and a naive scan reads 45 only because `T442j` and `T442m` both name it while explaining why it should not be cited
- [X] T442o Correct the frontend suite figure in `specs/036-application-shell/closure.md`, per `Constitution IX` (partial) — it reports `frontend` **535 of 535 in 59 files**; the suite is **537 of 537 in 59 files** and has been since `T442h` added two assertions in Phase 11. `T442k` rewrote that document *specifically because its figures were stale*, and carried this one forward from Phase 10 without re-measuring. Re-measure every figure in the Suites paragraph rather than only this one, and state the date the measurement was taken so the next reader knows what it is a snapshot of

---

## Phase 14: Convergence

Appended by the sixth `/speckit-converge 036` on 2026-08-24. **No code gap** — the third pass in a
row. Both findings are in `handovers.md`, the one artifact in this Epic written **for other Epics to
act on**, and neither had been re-read since the phase that changed what it describes.

- [X] T442p Correct the *"A smaller one in the same place"* section of `specs/036-application-shell/handovers.md`, per `FR-SHL-062` (contradicts) — it records **a gap that has been closed for three phases**, in terms of code that no longer exists. It says `main.tsx` *"clears `projectsLoading` in a `finally`"* and that a failed request *"renders as No projects in this workspace"*; `projectsLoading` was replaced by the `ProjectSetState` union in `T442b`, a failed set now reads *"Projects could not be loaded"* on an `aria-invalid` control with a `role="alert"` giving the reason and the next step, and `T442a` drives it. **The section ends "Not fixed here"** — it was fixed, one phase later. Either delete it or mark it discharged with the task that discharged it; leaving it is an instruction to go looking for a variable that is gone
- [X] T442q Make the handover count agree with the handovers, in `specs/036-application-shell/handovers.md` and `specs/036-application-shell/closure.md`, per `Constitution IX` (partial) — the header says **"Two obligations this Epic cannot discharge"** and **"Both are recorded"** over **four** `##` sections, and its metadata names `T441n, T441p` while `T441w` and `T442g` added the other two. `closure.md` separately calls the same file *"three handovers"*. **Three documents, three counts, four obligations** — and this is the file `EPIC-012`, `EPIC-014`/`015`, `EPIC-016`, `EPIC-019`/`021`/`024`, `EPIC-004`, `EPIC-023` and `EPIC-026` are each meant to read to find what they owe. While there, refresh `closure.md`'s *"97 of 99 tasks, across thirteen phases"* for this phase and **date that line**, as its Suites paragraph already is: a count with no date is stale the moment the next convergence pass appends, which is how it went wrong twice

---

## Phase 15: Convergence

Appended by the seventh `/speckit-converge 036` on 2026-08-24. **No code gap** — the fourth pass in
a row. One finding, in the two artifacts a future Epic is most likely to read as a template.

- [X] T442r Correct the `D-30` premise in `specs/036-application-shell/research.md` and `specs/036-application-shell/plan.md`, per `TS-001` (contradicts) — `R-036-1` says the decision *"adds **`D-30` — React Router, 7.x, MIT** to `specs/_shared/dependencies.md`"* and the summary table repeats *"`D-30` registered first"*; `plan.md` says *"React Router 7.x — **NEW**, `D-30`, registered before install"* in three more places. **All of it is false.** `D-13` has carried React Router since the platform specification, declared at 6.x for routing nobody built, and `T436b` **raised that row to 7.x** rather than adding one. `specs/_shared/dependencies.md` records the correction under *"D-13 in detail"* — and records that `EPIC-030` `T993d` made the identical mistake with `supertest` six Epics earlier. **Twice is a pattern; the third time is invited by leaving the wrong version in the artifacts a later Epic copies.** Add a correction note to each rather than rewriting the decision: React Router 7 in declarative mode was and is the right call, and what was wrong was the premise that it was new. While in `closure.md`, refresh *"six `/speckit-converge` passes"* — that count goes stale the moment a pass appends, which is why the task count beside it is dated

---

## Phase 16: Convergence

Appended by the eighth `/speckit-converge 036` on 2026-08-24. **The largest record divergence in
this Epic, and it survived seven earlier passes** — because every one of them checked
`data-model.md` for the *existence* of the `status` union rather than for the *counts* under it.

- [X] T442s Correct the pre-`N1` area counts across **six artifacts**, per `FR-SHL-002` (contradicts) — `data-model.md`, `contracts/shell-contract.md`, `spec.md`, `plan.md`, `quickstart.md` and `checklists/requirements.md` all still say **six delivered, three declared-not-delivered**. The registry says **five, four and nine**: `C1`'s remediation set six/three across every document, then the `N1` decision moved `Plan & Tasks` to `declared-not-delivered` during the Phase 2 implementation and only `frontend/src/shell/areas.ts`, `handovers.md`, `closure.md` and the tests followed. **The worst site is `contracts/shell-contract.md` §2**, whose route table marks `/specifications/:id/tasks → Plan & Tasks` as `delivered` and says *"Six routed areas"* — a parameterised path presented as a navigable area, which is **precisely the bug `N1` ruled out**. An implementer working from that table rebuilds it. Sites: `data-model.md` 56, 57, 68, 77, 86 · `contracts/shell-contract.md` 39 and the §2 table · `spec.md` 235, 379, 398 · `plan.md` 50, 144 · `quickstart.md` 66, 171 · `checklists/requirements.md` 74. While in the contract, add the `note?: string` field the registry carries and reconcile `element?: () => ReactElement` with the implemented `ComponentType` (unit test: T442t)
- [X] T442t Write a conformance check in `frontend/tests/unit/shell/registry-documented.spec.ts` asserting the counts stated in `data-model.md` and `contracts/shell-contract.md` match `AREAS`, per `Constitution V` (missing) — covers T442s. **This is the durable half.** `T436f` checks the registry's internal invariants and nothing checks that the documents defining it say what it says, so a decision taken in code drifted silently through eight convergence passes. Constitution V requires a non-code output to carry an executable check that can fail; the area registry has one and its **specification** does not. Parse the counts out of both documents and compare against `AREAS`; assert the route table lists exactly the `delivered` paths; and include an anti-vacuity assertion that the parse found numbers at all, because a regex that silently matched nothing would report agreement forever

---

## Phase 17: Convergence

Appended by the ninth `/speckit-converge 036` on 2026-08-24. Two findings, in the same sentence and
in the check that was supposed to guard it. **`T442t` covers two of the four numbers**, and the two
it does not cover are the two still wrong.

- [X] T442u Correct the two stale numbers in `specs/036-application-shell/data-model.md` line 93, per `FR-SHL-002` (contradicts) — *"the analysis found it was not being applied to the other **three**"* is four now that `Plan & Tasks` joined them (`N1`), and *"When any of the **twelve** ships"* is thirteen: five delivered leaves thirteen, not twelve. The heading four lines above was corrected to *"the eighteen, the five, and the thirteen"* by `T442s` and this sentence was not, because `T442t` does not read it
- [X] T442v Extend `frontend/tests/unit/shell/registry-documented.spec.ts` to check the `undeclared` count and the **non-delivered total**, per `Constitution V` (partial) — covers T442u. It compares `delivered` and `declared-not-delivered` against `AREAS` and **stops there**, so *"nine undeclared"* and *"the twelve"* are unguarded — and *"the twelve"* is the one that is wrong. **This is the third time this exact shape has appeared in this Epic**: `T441v` split loading from empty and left *failed* undriven; `T441s` added `hostRoom` and nothing rendered it; `T442t` now checks two of four counts. Each fix was asserted at the level the previous fault sat, and the gap moved one step sideways. Add the two subjects, and add an assertion that the three state counts **sum to eighteen** — a total is the one claim that cannot be right while a part is wrong, so it closes the shape rather than moving it again. **Done with one deliberate difference, recorded in the file's header**: the `undeclared` subject and the sum-to-eighteen assertion are both in. The prose *non-delivered total* matcher is **not** — every phrasing wide enough to catch *"any of the twelve"* also caught *"the other two sections"* and *"for the other two there is nothing to point it at"*, neither about areas, and a check that fires on correct prose gets switched off. The sum stands in for it: three per-status counts that each match the registry **and** add to eighteen leave a prose total no arithmetic of its own to get wrong. `T442u`'s two numbers were corrected by hand

## Phase 18: Convergence

**Findings from the tenth convergence pass, 2026-08-24.** The ninth closed the *state* axis — three
counts that must sum to eighteen, so a document cannot be right about two states and wrong about the
third. This pass found the same shape on two axes it did not touch: **which documents** are read
(`analysis.md` is not, and it is the one that is wrong), and **which surfaces** are driven
(`SC-SHL-005` says *100%* and a hand-written list of three says which). In both, a set-level claim
rests on a list someone maintains by hand — which is `DEF-010-001` with the nouns changed.

- [X] T442w Enumerate the shell-owned surfaces in code and assert each drives loading, empty, error and partial, per `SC-SHL-005` (partial) — `SC-SHL-005` requires **100%** of shell-owned surfaces to distinguish the four states, **"verified by driving each state, not by inspection"**, and `FR-SHL-060` says *every*. What verifies it today is `T441h`, marked `[X]`, which **names three surfaces in its own description**: `Home.spec.tsx`, `shell-context.spec.tsx`, `addresses.spec.tsx`. Nothing in `frontend/tests/unit/shell/` enumerates the surfaces, so no test can fail when a fourth appears without its states. **That list was already incomplete when it was ticked** — the `ContextBar` project selector is absent from it, and `T441v`/`T442b` then found that surface rendering *failed* as *empty*, which `FR-SHL-062` calls a defect and not a fallback. A criterion whose method clause forbids inspection is currently met by inspection. Add `SHELL_OWNED_SURFACES` to `frontend/tests/unit/shell/` naming each surface and the states that apply to it, drive each one, and assert the enumeration covers every component in `frontend/src/shell/` that reads an async source — so omitting a surface fails rather than passing silently
- [X] T442x Correct the three live pre-`N1` claims in `specs/036-application-shell/analysis.md`, per `FR-SHL-002` (contradicts) — line 23, `I1`'s resolution note, states the route table as it stands **now**: *"six routed areas plus four sub-views and `*`"*. `contracts/shell-contract.md` §2 has **five routed areas and five sub-views**, and **`N1`'s note two rows below says *"Five delivered areas, not six."*** — the document contradicts itself across adjacent rows, on the number the last three passes have all been about. Line 116, under *"What was deliberately not changed"*, says `UX-0003` is *"satisfied for six areas and carried, with named owners, for three"* and names three Epics; it is **five and four**, and `handovers.md` carries `EPIC-012` as the fourth. Line 123 lists `Tasks.tsx` among *"the six remaining declared areas"* — the `N1` error preserved whole. **Leave line 108 alone**: the Remediation table is dated *"Applied 2026-08-24"* and records what that remediation did, which was true when it was written; annotate it rather than rewriting history (conformance: T442y)
- [X] T442y Derive `registry-documented.spec.ts`'s artifact list from the feature directory and require every omission to be declared, per `Constitution V` (partial) — covers T442x and T442z. `ARTIFACTS` is a hand-maintained list of **six** paths; the feature directory holds **eleven** markdown files. `analysis.md` is among the five omitted and is the one that is wrong, and adding it by hand would be the **fourth** time this Epic answered a gap at the level the last one sat at. Read the directory instead, and require each file to be either checked or present in an `EXEMPT` map **with a reason** — so a new document is covered by default and an omission is a recorded decision rather than an oversight. Expect exemptions with real reasons: `tasks.md` and `closure.md` quote superseded numbers by design, and `analysis.md` needs its dated Remediation section excluded the way `flat()` already excludes `Corrected` blockquotes. In the same file, assert that **every `T###`-shaped identifier cited in the Epic's records exists in `tasks.md`** — that is what catches T442z's dangling id
- [X] T442z Correct the task attribution in `specs/036-application-shell/closure.md` line 3, per `Constitution IX` (contradicts) — the Date line reads *"rewritten by `T442k`, corrected by `T442o`, `T442q` and **`T442w`**"*, and **`T442w` exists nowhere in `tasks.md`**. Phase 17's correction was `T442u`/`T442v`; the id was written into the record by the pass that made it. **Note the trap this sets for `T442y`'s id check**: `T442w` is allocated by *this* phase, so an existence check will go green on the reference while it still attributes the work to the wrong task. An existence check catches a **dangling** id, not a **wrong** one — so name `T442u` and `T442v` by hand and do not let the check's green stand in for the reading (conformance: T442y)

## Phase 19: Registry vocabulary — Constitution XII Step B *(appended 2026-08-25)*

**Authorised by the project owner 2026-08-25** as Step B of the Execution Governance Remediation
package, following the gap analysis that found the registry's own vocabulary was the reason two
published screen counts disagreed. `areas.ts` is application code, so the change enters through
`/speckit-implement` rather than a direct edit (Constitution I).

**The finding.** `AreaStatus` has three states and the product needs four. Home renders but carries
**one of the V2 prototype's three panels**; calling that `delivered` overstates the product and
calling it `declared-not-delivered` denies a screen a user can reach. Separately, five areas are
marked `undeclared` — *no Epic owns this* — while `EPIC-031`–`EPIC-035` own them with 201
requirements between them.

- [x] T1012 Add `partly-delivered` to `AreaStatus` in `frontend/src/shell/areas.ts` and separate *reachability* from *completeness*, per `Constitution XII` Step B (unit test: T1014) — routing, navigation and the not-found page all read `deliveredAreas()`, which filters `status === 'delivered'`. A partly-delivered area **is reachable**, so introduce a reachability predicate covering `delivered` **and** `partly-delivered`, and leave `deliveredAreas()` meaning strictly delivered so the reporting count stays honest. Update `frontend/src/shell/navigation-model.ts` and `frontend/src/shell/NotFound.tsx` to use reachability rather than delivery. **Relax the `element` invariant** from *"present ONLY when delivered"* to *"present when reachable"* — the current wording would strip Home and Projects of their routes the moment they are reclassified
- [x] T1013 Correct area ownership and status in `frontend/src/shell/areas.ts` to the approved matrix, per `Constitution XII` Step B (conformance: T1014) — `home` and `projects` to `partly-delivered`; `decision-inbox`→`EPIC-031`, `evidence-compliance`→`EPIC-032`, `requirement-room`→`EPIC-033`, `change-room`→`EPIC-034`, `defect-room`→`EPIC-035`, `engineering-experts`→`EPIC-028`, `context`→`EPIC-038`, `integrations`→`EPIC-039`, `reports`→`EPIC-040`, each `declared-not-delivered` with a user-facing `note`. **Do not mark any of them delivered.** `undeclared` keeps zero members and is retained deliberately, so a future area added before its Epic exists can still be recorded honestly
- [x] T1014 [P] Conformance check in `frontend/tests/unit/shell/areas.spec.ts` asserting the registry expresses the approved matrix, per `Constitution V` (covers T1012, T1013) — **2 delivered, 2 partly-delivered, 13 declared-not-delivered, 0 undeclared**, seventeen of which map to the V2 prototype's pages plus Workspace & Administration. Assert every non-`undeclared` area names an Epic, that every reachable area has an `element` and every unreachable one does not, and that a `partly-delivered` area is routable — the regression T1012 exists to prevent. Observe each assertion failing before it passes
- [x] T1015 Reconcile EPIC-036's own documents with the four-state registry, per `Constitution XII` Step B (conformance: T1016) — `T442t` correctly went red the moment `T1013` landed: `data-model.md`, `plan.md`, `quickstart.md`, `spec.md` and `analysis.md` claim *"five delivered, four awaiting their owners, nine undeclared"*, and the registry now reads **3 delivered · 2 partly delivered · 13 owed · 0 undeclared** across eighteen areas, of which the seventeen V2 prototype screens are **2 / 2 / 13 / 0**. State both denominators wherever a count appears — a figure that does not say what it counts is how the two published counts came to disagree. Annotate rather than silently overwrite, following `EPIC-003`'s strike-and-annotate precedent
- [x] T1016 [P] Update the coherence check in `frontend/tests/unit/shell/registry-documented.spec.ts` for four states, per `Constitution V` (covers T1015) — its anti-vacuity guard sums three states to eighteen and asserts **every** status has at least one member. Both are now wrong: `partly-delivered` is unsummed, and `undeclared` is deliberately **zero**. Sum all four, and assert `undeclared === 0` **with its reason** rather than requiring it to be non-empty — the state is retained for a future area declared before its Epic exists, and an assertion demanding members would force a false entry to satisfy it
