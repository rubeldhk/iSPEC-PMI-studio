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

- [ ] T436a Create the worktree `.claude/worktrees/epic-036-application-shell` from `main`, and label the session `EPIC-036 Application Shell`. Discharges the concurrent-session gate: this plan was written on `main`, so exclusivity did not hold at planning and only the worktree restores it. `EPIC-033` `T337a` is the precedent
- [ ] T436b [P] Add **`D-30` — React Router, 7.x, MIT** to the *Runtime dependencies — frontend* table in `specs/_shared/dependencies.md`, with the purpose (`FR-SHL-017` addressable areas), the Context7 library id `/remix-run/react-router` recorded in `research.md` `R-036-1`, and a risk position. **Before any `package.json` change** (`TS-001`); `EPIC-030` `T993d` is the precedent for how a new row is justified (conformance check: T436c)
- [ ] T436c [P] Write a failing conformance check in `tests/governance/dependency-register.spec.ts` asserting every runtime dependency declared in `frontend/package.json`, `backend/package.json` and `worker/package.json` has a row in `specs/_shared/dependencies.md`. **Nothing checks this today** — the register is maintained by discipline alone, which is why `TS-001` can be satisfied in prose and missed in fact. Include an anti-vacuity assertion that the scan reads a substantial number of packages
- [ ] T436d Install `react-router@^7` as a runtime dependency of `frontend/package.json` and update `pnpm-lock.yaml`. Runs only after `T436b` and `T436c` are green
- [ ] T436e [P] Extend `tests/governance/dependency-register.spec.ts` to assert the installed router resolves to `7.x` **and React remains pinned at `18.3.1`** (covers T436d). `R-036-1` claims v7 bridges React 18 to 19 rather than requiring 19; a silent React bump would falsify that claim without failing anything

---

## Phase 2: Foundational — the one list, and the checks that read it

**Blocking prerequisite for every user story.** `SC-SHL-004` measures shell code changes at zero
when a delivered area is added, and that is only true if navigation, the route tree and the
reachability check are all derived from one declaration (`R-036-2`).

- [ ] T436f [P] Write failing tests for the area registry's invariants in `frontend/tests/unit/shell/areas.spec.ts` — every `id` unique, every `path` unique and leading `/`, no area in two groups, **`status: 'delivered'` implies an `element` and the other two statuses imply none**, every `declared-not-delivered` area names an owning `epic`, and all four groups present in PMI-DOC-006 §4.1 order
- [ ] T436g Create the area registry in `frontend/src/shell/areas.ts` — the `Area` interface, the closed `AreaGroup` and `AreaStatus` unions, and the `AREAS` list carrying **all eighteen** areas of PMI-DOC-006 §4.1: **six `delivered`** (Home, Projects, Specifications, Plan & Tasks, Runs, Workspace & Administration), **three `declared-not-delivered`** (QA & Releases → `EPIC-014`/`EPIC-015`, Architecture & Decisions → `EPIC-016`, Governance → `EPIC-019`/`EPIC-021`/`EPIC-024`), and **nine `undeclared`**, per [contracts/shell-contract.md](./contracts/shell-contract.md) §1 (unit test: T436f)
- [ ] T436h [P] Write failing tests for navigation derivation in `frontend/tests/unit/shell/navigation-model.spec.ts` — delivered areas only, grouped in registry order, and a group with no delivered area omitted entirely rather than rendered as an empty heading (`FR-SHL-015`)
- [ ] T436i Implement `navigationModel()` in `frontend/src/shell/navigation-model.ts`, derived from `AREAS` and nothing else (unit test: T436h)
- [ ] T436j [P] Write failing tests for route-tree derivation in `frontend/tests/unit/shell/routes.spec.ts` — one route per delivered area, no hand-written route, and `*` resolving to not-found
- [ ] T436k Implement the derived route tree in `frontend/src/shell/routes.tsx` using `BrowserRouter`/`Routes`/`Route`/`Outlet` imported from `react-router` — **not `react-router-dom`**, which v7 supersedes (`R-036-1`, Context7 `/remix-run/react-router`) (unit test: T436j)
- [ ] T436l Implement the not-found element in `frontend/src/shell/NotFound.tsx` — a real not-found, never a blank area inside working chrome. `DEF-001-006` is `EPIC-001`'s open defect and must not be made worse (unit test: T436j)
- [ ] T436m [P] Write a failing architecture check in `frontend/tests/unit/shell/shell-boundaries.spec.ts` asserting **all six** prohibitions of [contracts/shell-contract.md](./contracts/shell-contract.md) §6 over `frontend/src/shell/` — **no area content: the shell hosts screens and implements none** (`FR-SHL-003`, the clause the `C1` finding put under pressure), no permission or role model, no second region vocabulary, no workspace/project selection rules, no persisted state, no design token values. Strip comments and string literals before scanning, as `EPIC-033` `T337s` established after a check failed on prose rather than on code
- [ ] T436n [P] Add the anti-vacuity companion to `frontend/tests/unit/shell/shell-boundaries.spec.ts` (covers T436m) — a check that cannot fail is decoration, and this one scans a directory that starts nearly empty

---

## Phase 3: User Story 1 — Every delivered area is reachable from one navigation (P1) 🎯 MVP

**Goal**: `BR-0190` — the MUST no Epic has owned. One persistent grouped navigation, every declared
area reachable from anywhere, every area addressable.

**Independent test**: sign in and reach all **six delivered** areas from navigation without using
browser history or typing a URL; then open one area's address in a new tab and refresh it.

- [ ] T437a [P] [US1] Write failing tests for primary navigation in `frontend/tests/unit/shell/Navigation.spec.tsx` — four groups in §4.1 order, delivered areas only, the current area marked, and navigation still present after selecting an area (`FR-SHL-010`, `FR-SHL-012`, `FR-SHL-013`)
- [ ] T437b [US1] Implement `frontend/src/shell/Navigation.tsx`, rendering `navigationModel()` with `EPIC-029`'s components consumed unchanged (unit test: T437a)
- [ ] T437c [P] [US1] Write failing tests for the shell frame in `frontend/tests/unit/shell/AppShell.spec.tsx` — navigation, context bar and `<Outlet />` composed, and the frame surviving an area change
- [ ] T437d [US1] Implement `frontend/src/shell/AppShell.tsx` (unit test: T437c)
- [ ] T437e [P] [US1] Write failing tests in `frontend/tests/unit/shell/app-entry.spec.tsx` asserting the application root mounts the router and that **no `useState` view union remains** — the shape `main.tsx` has carried since `T003`
- [ ] T437f [US1] Replace the view union in `frontend/src/main.tsx` with the router, removing `View`, `LOCATION` and the six view kinds `DEF-010-001`'s remediation added (unit test: T437e)
- [ ] T437g [US1] Remove `T200e`'s four navigation buttons from the project view in `frontend/src/pages/`, superseded by primary navigation (`R-036-5`) (unit test: T437e)
- [ ] T437h [P] [US1] Write the failing `FR-SHL-016` reachability check in `frontend/tests/unit/shell/area-reachability.spec.tsx` — drive the **real** `App` through its real entry point and assert every `status: 'delivered'` area is reachable from primary navigation by clicking. Constitution XI Tier 1; `G-UX-01`'s navigation half
- [ ] T437i [US1] Make `T437h` pass, and record in its header what it does **not** answer — the import-graph question belongs to `T200a`, which is kept and joined rather than replaced (`R-036-5`)
- [ ] T437j [US1] Mutation-verify `T437h` by removing one delivered area's route and observing the check fail **naming that area**, then restore. `SC-SHL-001` states this as a number and `T200c` is the standard. The guard `DEF-010-001` did not have
- [ ] T437k [P] [US1] Write a failing test asserting **zero** areas that are not `delivered` appear in navigation — not disabled, not greyed, not a placeholder — covering the nine `undeclared` (`UX-0060`) **and** the three `declared-not-delivered` alike (`SC-SHL-002`) — in `frontend/tests/unit/shell/Navigation.spec.tsx`
- [ ] T437l [P] [US1] Write failing tests for addressability in `frontend/tests/unit/shell/addresses.spec.tsx` — every delivered area resolves from its own address, a re-mount at that address lands in the same area, and back returns to the previous location (`SC-SHL-010`)
- [ ] T437m [US1] Implement per-area addresses and key sub-view routes in `frontend/src/shell/routes.tsx` per the route table in [contracts/shell-contract.md](./contracts/shell-contract.md) §2 (unit test: T437l)
- [ ] T437n [P] [US1] Write a failing test asserting an address naming an area that is not `delivered` answers not-found rather than an empty area — asserted for **both** remaining statuses, since *"forbidden to build"* and *"not built yet"* must give a user the same answer (`SC-SHL-011`, `FR-SHL-017`) — in `frontend/tests/unit/shell/addresses.spec.tsx`
- [ ] T437o [US1] Replace `frontend/tests/unit/shell-page-routes.spec.tsx` with the shell's own route coverage, and **keep `frontend/tests/unit/design/page-reachability.spec.ts` untouched** — `T200a` answers a different question (`R-036-5`)
- [ ] T437p [P] [US1] Write a check asserting any delivered area is reachable from any other in **at most two actions** (`SC-SHL-003`) in `frontend/tests/unit/shell/area-reachability.spec.tsx`
- [ ] T437q [P] [US1] Write the `SC-SHL-004` check in `frontend/tests/unit/shell/registry-extensibility.spec.ts` — moving an area to `delivered` in `AREAS` puts it in navigation and gives it a route **with no other file changed**, which is exactly what `EPIC-014`, `EPIC-016` and `EPIC-019` will each do. Assert it by construction over a synthetic registry, not by reading a diff

---

## Phase 4: User Story 2 — Workspace and project are explicit, never inferred (P1)

**Goal**: `BR-0001`. The failure mode is silent — a user acting on the wrong project sees a
plausible screen.

**Independent test**: switch project from inside an area; the area stays and its content re-scopes.

- [ ] T438a [P] [US2] Write failing tests for the context bar in `frontend/tests/unit/shell/ContextBar.spec.tsx` — workspace and project visible without opening a menu, on every data-bearing screen (`FR-SHL-020`, `FR-SHL-021`)
- [ ] T438b [US2] Implement `frontend/src/shell/ContextBar.tsx`, reading the signed-in identity's workspace from `GET /v1/auth/me` via the existing `frontend/src/services/api.ts` client (unit test: T438a)
- [ ] T438c [P] [US2] Write failing tests for the breadcrumb reading `workspace / project / area` (`FR-SHL-023`, `UX-0012`) in `frontend/tests/unit/shell/ContextBar.spec.tsx`
- [ ] T438d [US2] Implement the breadcrumb in `frontend/src/shell/ContextBar.tsx`, deriving the area from the matched route — **never from state held beside the URL** (`data-model.md` §3) (unit test: T438c)
- [ ] T438e [P] [US2] Write failing tests in `frontend/tests/unit/shell/shell-context.spec.tsx` — switching project keeps the current area and re-scopes its content (`FR-SHL-022`)
- [ ] T438f [US2] Implement `ShellContext` in `frontend/src/shell/shell-context.tsx` carrying `workspaceId` and `projectId` only, with `areaId` derived from the address (unit test: T438e)
- [ ] T438g [P] [US2] Write a failing test for an area entered with no project selected — it says so and offers the next step, rather than rendering empty (`FR-SHL-024`). `DEF-007-001` is the same class one layer down
- [ ] T438h [US2] Implement the no-project state in `frontend/src/shell/AppShell.tsx` (unit test: T438g)
- [ ] T438i [P] [US2] Extend `frontend/tests/unit/shell/shell-boundaries.spec.ts` to assert the shell **renders** the workspace/project selector and defines no selectable set or scoping rule — `EPIC-004`'s, consumed (`FR-SHL-025`). `prototype-parity.md` declines this control to the shell precisely because *"the shell may not invent its selector"*

---

## Phase 5: User Story 3 — Home tells a user what needs them (P2)

**Goal**: `BR-0192`, which has no surface today.

**Independent test**: leave a run's review unsubmitted, open Home, and see it listed with a route to
the review — **and** see the other two sections state that their sources do not exist.

> **The scenario most likely to be "fixed" wrongly.** Two of Home's three sources are unbuilt
> (`R-036-4`): `EPIC-031` is 0 of 92 and `EPIC-032` is 0 of 83. A Home that rendered one section and
> nothing else would read as *"nothing is blocked"*. Stubbing them is rejected outright — a
> fabricated policy block is worse than an absent one.

- [ ] T439a [P] [US3] Write failing tests for the Home model in `frontend/tests/unit/shell/home-model.spec.ts` — `sources` **always carries three entries and is not optional**, and a model carrying only `items` does not type-check
- [ ] T439b [US3] Implement `HomeModel`, `AttentionItem` and `SourceStatus` in `frontend/src/shell/home-model.ts` per [contracts/shell-contract.md](./contracts/shell-contract.md) §4 (unit test: T439a)
- [ ] T439c [P] [US3] Write failing tests for the pending-approvals source in `frontend/tests/unit/shell/home-sources.spec.ts` — `GET /v1/projects/:projectId/runs` filtered to `awaiting_review`, then `GET /v1/runs/:id/review` for unanswered questions
- [ ] T439d [US3] Implement the approvals source in `frontend/src/shell/home-sources.ts` against the existing `EPIC-023` endpoints. **No new endpoint** — `FR-SHL-034` forbids an aggregation endpoint no other client can call (unit test: T439c)
- [ ] T439e [P] [US3] Write failing tests asserting the policy-block and missing-evidence sources report `unavailable` **naming `EPIC-031` and `EPIC-032`**, and that neither contributes a fabricated item, in `frontend/tests/unit/shell/home-sources.spec.ts`
- [ ] T439f [US3] Implement the two unavailable sources in `frontend/src/shell/home-sources.ts` — degrade visibly and say so in the payload, the posture `EPIC-033`'s unbound `AgentGateway` takes (unit test: T439e)
- [ ] T439g [P] [US3] Write failing tests for Home's four states in `frontend/tests/unit/shell/Home.spec.tsx` — loading, empty, error and partial distinguishable from one another by driving each state, not by inspection (`FR-SHL-060`, `SC-SHL-005`)
- [ ] T439h [US3] Implement `frontend/src/shell/Home.tsx` (unit test: T439g)
- [ ] T439i [P] [US3] Mutation-verify `FR-SHL-062` — make a failing section render as an empty state and confirm the suite fails; then restore. Recorded in `frontend/tests/unit/shell/Home.spec.tsx`
- [ ] T439j [P] [US3] Write failing tests asserting each attention item names what it is, which project it belongs to, and an `href` that is an `Area.path` rather than an invented route (`FR-SHL-031`)
- [ ] T439k [US3] Implement item rendering in `frontend/src/shell/Home.tsx`, carrying **the policy that produced** a policy block rather than merely that something is blocked (`FR-SHL-033`, `BR-0174`) (unit test: T439j)
- [ ] T439l [P] [US3] Extend `frontend/tests/unit/shell/shell-boundaries.spec.ts` to assert Home introduces no store of its own and no shell-only endpoint (`FR-SHL-034`, `PP-007`)

---

## Phase 6: User Story 4 — The shell holds at 360px and on a keyboard (P2)

**Goal**: `BR-0193` and `UX-0040`, both MUSTs. Navigation that collapses into unreachability at
360px fails `BR-0190` on the device it fails on.

**Independent test**: at a 360px viewport, reach three areas in different groups using only the
keyboard.

- [ ] T440a [P] [US4] Write failing tests for the drawer in `frontend/tests/unit/shell/NavigationDrawer.spec.tsx` — below the narrow breakpoint navigation collapses into a drawer opened by a persistent control, carrying the **full grouped list**, with every delivered area reachable (`FR-SHL-054`)
- [ ] T440b [US4] Implement `frontend/src/shell/NavigationDrawer.tsx` — one navigation model at every width, so there is one thing to build, test and describe (unit test: T440a)
- [ ] T440c [P] [US4] Write failing tests asserting focus order follows visible order with a visible indicator throughout, drawer included (`FR-SHL-052`), in `frontend/tests/unit/shell/shell-a11y.spec.tsx`
- [ ] T440d [US4] Implement focus management across `frontend/src/shell/AppShell.tsx` and `frontend/src/shell/NavigationDrawer.tsx` (unit test: T440c)
- [ ] T440e [P] [US4] Write failing tests asserting groups are announced as groups and the current area as current (`FR-SHL-053`) in `frontend/tests/unit/shell/shell-a11y.spec.tsx`
- [ ] T440f [US4] Implement the navigation landmark and grouping semantics in `frontend/src/shell/Navigation.tsx` using native elements and ARIA per PMI-DOC-005 (unit test: T440e)
- [ ] T440g [P] [US4] Add an `axe-core` assertion of **zero violations on the shell in both themes** (`SC-SHL-008`) to `frontend/tests/unit/shell/shell-a11y.spec.tsx`
- [ ] T440h [P] [US4] Write a check asserting the shell sets **no minimum viewport above 360px** (`FR-SHL-051`, `G-UX-03`) in `frontend/tests/unit/shell/shell-boundaries.spec.ts`
- [ ] T440i [P] [US4] Write the `SC-SHL-007` check — every `delivered` area reachable by keyboard alone at a 360px viewport, with all eighteen areas set to `delivered` in a synthetic registry so the drawer is exercised at its worst case

---

## Phase 7: User Story 5 — The Room pattern belongs to the shell, not to each Room (P3)

**Goal**: `BR-0191`, a SHOULD. `EPIC-033` already built the shared contract; this Epic **adopts** it.

**Independent test**: render a Room inside the shell and compare its region vocabulary against
`packages/room-contract` by comparison, not by review.

- [ ] T441a [P] [US5] Write failing tests in `frontend/tests/unit/shell/room-hosting.spec.tsx` — a Room rendered inside the shell presents the six regions of `ROOM_REGIONS` and cannot present a seventh (`FR-SHL-040`, `FR-SHL-041`)
- [ ] T441b [US5] Implement Room hosting in `frontend/src/shell/routes.tsx`, supplying the frame and letting the Room supply the regions — neither restating the other (unit test: T441a)
- [ ] T441c [P] [US5] Add a conformance check comparing any region name declared under `frontend/src/shell/` against `ROOM_REGIONS` **by comparison rather than review**. `EPIC-034` `T994t` and `EPIC-035` `T998y` compare against the same vocabulary; a seventh region declared here would make their comparisons pass against a vocabulary that had quietly grown
- [ ] T441d [P] [US5] Write a failing test in `frontend/tests/unit/shell/room-hosting.spec.tsx` asserting `@pmi/room-contract` is imported rather than re-derived, and that `frontend/src/rooms/` is consumed unmodified (`FR-SHL-042`, `FR-SHL-043`)
- [ ] T441e [US5] Adopt `RoomShellProps` in `frontend/src/shell/AppShell.tsx` (unit test: T441d)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T441f [P] Measure `SC-SHL-006` — navigation responds to a selection in under 1s at p95 **on the reference local stack**, asserted in isolation and recorded with the stack named. `DEF-030-002` records a p95 assertion that fails under suite load and passes alone; scope this one or inherit that ambiguity
- [ ] T441g [P] Verify `SC-SHL-009` — a user can answer *"which workspace and project am I in?"* from the screen in under 5 seconds without opening a menu, recorded in the quickstart run
- [ ] T441h [P] Verify `SC-SHL-005` across **every** shell-owned surface — Home, the no-project state, the drawer and the not-found route each render loading, empty, error and partial distinguishably
- [ ] T441i Run [quickstart.md](./quickstart.md) scenarios 1–6 against the running stack, including both required mutation checks, and record the outcomes
- [ ] T441j Produce the Constitution XI Tier 2 **driven transcript** — sign in → Home → each of the six delivered areas → back → switch project → one address naming a declared-but-unbuilt area, observing not-found — verbatim to `docs/accessibility/EPIC-036-shell-transcript.md`. `EPIC-029`'s reachability transcript is the precedent and the format
- [ ] T441k Human keyboard and screen-reader pass over the shell, recorded to `docs/accessibility/EPIC-036-shell-transcript.md`. **A person's, not an agent's** — `EPIC-029` `T885` records the standard and why an agent cannot meet it, and `T884` stays red until it is done
- [ ] T441l Rebuild `governance/epic-stage-register.md` with `pnpm register:update`. It runs twice and the first run still exits non-zero; the residual is `T884`, red by design until `T441k`
- [ ] T441m Write `specs/036-application-shell/analysis.md` — the `/speckit-analyze` record `DOR-09` reads, with finding ids and severities
- [ ] T441n **Hand the task-identifier decision back to `EPIC-026` as a blocker on `EPIC-037`, not a warning.** Update the measurement in `specs/026-*/` : **999 of 999 prefixes are allocated** — `T995y` measured 992 and there are now none. State what this Epic did (block allocation under `T436`–`T441`, retiring the suffix's adjacency meaning for that block) and what it did **not** do: choose between `T995y`'s two options. The four-digit widening of `T\d{3}[a-z]?` in `tests/governance/epic-stage/task-ids.spec.ts`, `tests/governance/epic-stage/dor.ts` and `tests/governance/epic-stage/task-paths.spec.ts` remains the durable fix and remains `EPIC-026`'s
- [ ] T441p **Hand the remainder of `UX-0003` to the three Epics that owe it.** `QA & Releases`, `Architecture & Decisions` and `Governance` are reachable from nothing because no screen exists. Record the obligation against `EPIC-014`/`EPIC-015`, `EPIC-016` and `EPIC-019`/`EPIC-021`/`EPIC-024` — each discharges it with a one-line `areas.ts` edit moving its area to `delivered` (`SC-SHL-004`), which is the claim `T437q` proves. Without this the three are invisible: absent from navigation by design and absent from every backlog by accident
- [ ] T441o Write `specs/036-application-shell/closure.md` — artifacts by path, anything in scope not done and why, and the recommended next command. Then run `/speckit-converge` as the Epic exit gate (Constitution IV)

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
