# Research: Application Shell & Dashboard

**Epic**: `EPIC-036` · **Phase**: 0 · **Date**: 2026-08-24 · **Plan**: [plan.md](./plan.md)

Six decisions. Two were left to this phase by the clarification session; four were found by reading
the tree rather than the specification.

---

## `R-036-1` — Routing: React Router v7, in declarative (library) mode

**Decision**: adopt **React Router v7** as a runtime dependency of `frontend/`, used in its
**declarative** mode — `BrowserRouter` + `Routes` + `Route` + `Outlet` — and **not** its framework
mode.

**Rationale**: `FR-SHL-017` requires every area and key sub-view to have an address that survives a
refresh, supports back/forward, and answers as not-found when it names an undeclared area. The
product has **no URL routing at all** today: navigation is a `useState` union in
`frontend/src/main.tsx` and the address bar never leaves `/`.

Hand-rolling that is not a small job. It is history push/pop and `popstate`, path matching with
parameters, nested layouts, scroll restoration, and the not-found case — each individually modest
and collectively a router with none of a router's testing behind it. `EPIC-036` would then own a
routing library it did not intend to write, which is `PP-014` (configuration over customization)
inverted.

`main.tsx`'s own comment has anticipated this since `T003`: *"a router arrives with EPIC-010's full
specification interface."* It did not arrive; this is where it does.

**Declarative mode specifically.** React Router v7 can be adopted as a *framework* (its own build,
file-system routes, loaders, server rendering). That would replace Vite's role and reach far outside
this Epic's scope. Declarative mode is the library: a component tree, no build change, no data layer,
and nothing this Epic does not need. Version 7 bridges React 18 to 19, so the current React 18.3.1
pin is unaffected.

**Alternatives considered**:

- **Hand-rolled routing** — rejected above. Would also have to be tested to the same standard, and
  `SC-SHL-010` asks for 100% of areas resolving after refresh, which is a router's own test suite.
- **TanStack Router** — stronger type-safety story, but a smaller ecosystem here and no precedent in
  this repository. Nothing in the requirements needs what it adds over the alternative.
- **Keep state-based navigation** — rejected at clarification (2026-08-24). It was the status quo,
  and it is what makes *"send me the link"* unanswerable.

**`TS-001` obligation**: a register entry precedes the dependency entering a `package.json`. This
adds **`D-30` — React Router, 7.x, MIT** to `specs/_shared/dependencies.md`, and `EPIC-030`'s
`T993d` sets the precedent for how a new row is justified. **The register entry is a task in this
Epic, ordered before the install.**

> ### ⚠ Corrected at implementation — this paragraph's premise was false (`T442r`)
>
> **React Router was already in the register.** `D-13` has carried it since the platform
> specification, declared at **6.x** for *"Client routing"* that nobody built — which is the same
> reason this Epic exists. So `T436b` **raised `D-13` from 6.x to 7.x** and added a *"D-13 in
> detail"* section to `specs/_shared/dependencies.md`. It did **not** add a `D-30`, and `D-30` is
> not this Epic's identifier for anything.
>
> **`T993d` is the precedent, but for the opposite lesson.** `EPIC-030` read *"supertest is absent
> from `backend/package.json`"* as *"supertest is absent from the register"* and nearly added a
> `D-30` beside the `D-22` that already carried it. This paragraph made the identical mistake six
> Epics later, and `dependencies.md` now records both.
>
> **Why the note rather than a rewrite.** The decision is unchanged and correct: React Router 7, in
> declarative mode, for `FR-SHL-017`. What was wrong is the premise that the dependency was new, and
> a research record that quietly became right would hide the thing worth learning — *the register is
> ahead of the code more often than anyone expects, and `TS-001` asks about the register.*
> `tests/governance/dependency-register.spec.ts` (`T436c`) is the check that now answers the
> question instead of the reader.

**Docs consulted**: Context7 `/remix-run/react-router` — *declarative mode setup in an existing Vite
React 18 SPA; `BrowserRouter`/`Routes`/`Route`; `Outlet` for nested routes*. Confirmed current: v7
imports from `react-router` (not `react-router-dom`), and `BrowserRouter` is the declarative entry
point.

---

## `R-036-2` — The area registry is data, and the check reads the same data

**Decision**: areas are declared in a single committed module — an ordered list of
`{ id, group, label, path, epic, declared }` — imported by navigation, by the router, and by
`FR-SHL-016`'s check.

> **`declared` became `status` at implementation** (`C1`, and corrected here by `T442r` while
> nearby). A boolean could not hold the state four areas were in: their Epic **is** declared and no
> screen exists, so `declared: true` demanded an `element` nothing could supply while `FR-SHL-003`
> forbade the shell supplying one. The field is now
> `status: 'delivered' | 'declared-not-delivered' | 'undeclared'`, and `data-model.md` §1 carries the
> reasoning. **The decision this section records — one committed list, three consumers — is
> unchanged**; only the shape of one field is.

**Rationale**: `FR-SHL-002` requires a delivered area to reach navigation with **no shell code
change**, and `SC-SHL-004` measures that at zero. That is only true if navigation, routes and the
reachability check are all *derived* from one list. Three hand-maintained lists that must agree is
the shape `DEF-010-001` already took once — nine pages, four imported, and every check green.

**Data, not configuration-file.** A TypeScript module rather than JSON: the group names are a closed
set (PMI-DOC-006 §4.1), and a typo in a group belongs at compile time rather than at render.

**Alternatives considered**: deriving areas from the filesystem (`pages/*.tsx`) — rejected, because
a page file is not the same claim as a *declared area*; `UX-0060` turns on whether an **Epic** is
declared, which no filename records. `T200a` already checks the file-level property, and the two
checks answer different questions.

---

## `R-036-3` — Deep links need a server fallback, and one of the two servers does not have it

**Decision**: `FR-SHL-017` is satisfied in development by Vite's dev server, which already serves
`index.html` for unknown paths. **Production serving is an open dependency, not a task in this
Epic.**

**Rationale**: a client-side router only works if the server returns the application for
`/areas/runs` rather than 404. Vite's dev server does this by default. Nothing else in this
repository serves the built client at all — there are no Dockerfiles, `docker-compose.yml` defines
only `postgres` and `valkey`, and `EPIC-029`'s UAT run had to serve `dist/` from a scratchpad
static server with a hand-rolled `/v1` proxy because *"`vite.config.ts` declares `server.proxy`
(dev only) and no `preview.proxy`"*.

So deep links will work for every developer and every UAT run done the documented way, and the
production case belongs to whoever owns serving the client — which today is **nobody**. Recorded
here rather than assumed, and named in the plan's Complexity Tracking.

**Alternatives considered**: adding `preview.proxy` and a fallback to `vite.config.ts` — tempting
and out of scope; that file is `EPIC-029`'s and the gap is `EPIC-014`'s. A hash router (`#/areas/runs`)
would need no server support at all and was rejected: it makes every address uglier to work around
a deployment gap that has an owner-shaped hole rather than a technical one.

---

## `R-036-4` — Home has one real source today, and must show that it has one

**Decision**: Home renders attention items from the sources that **exist**, and reports the sources
that do not exist as *unavailable* rather than contributing silence.

**Rationale**: `FR-SHL-032` names three kinds — pending approvals, policy blocks, missing evidence.
Reading the API surface rather than the specification:

| Kind | Source | Status |
|---|---|---|
| Pending approvals | `GET /projects/:projectId/runs` (state `awaiting_review`) → `GET /runs/:id/review` (unanswered questions) | **exists** — `EPIC-023`, built |
| Policy blocks | `EPIC-031`'s decision engine | **does not exist** — 0 of 92 tasks |
| Missing evidence | `EPIC-032`'s evidence contracts | **does not exist** — 0 of 83 tasks |

Two of the three have no endpoint to call. `FR-SHL-062` already forbids rendering a failure as an
empty state, and this is the same rule applied to an *absent* source: a Home that quietly showed
one section would read as *"nothing is blocked"*, which is the confident-blank-screen failure this
Epic exists to stop repeating.

This is the same posture `EPIC-033` took for its `AgentGateway`: **degrade visibly, and say so in
the payload**. It is not a defect and must not be filed as one.

**Alternatives considered**: delay Home until `EPIC-031`/`EPIC-032` land — rejected; it would block
the only surface `BR-0192` has on two Epics that have not started, and the approvals half is real
today. Stub the two missing sources — rejected outright; a fabricated policy block is worse than an
absent one.

---

## `R-036-5` — `T200a` is kept and joined, not replaced

**Decision**: `frontend/tests/unit/design/page-reachability.spec.ts` (`EPIC-010` `T200a`) stays as
it is. `FR-SHL-016` adds a **second** check over the area registry, and the two are not merged.

**Rationale**: they answer different questions. `T200a` asks *"is every delivered page module
imported and rendered from the application root?"* — a static import-graph property. `FR-SHL-016`
asks *"is every **delivered area** reachable from primary navigation in the built application?"* —
`G-UX-01`'s navigation half, which `T200a`'s own header says it cannot see.

Merging them would produce one check that half-answers both. `EPIC-010`'s `T200e` routing — the four
buttons on the project view — **is** superseded by navigation and is removed by this Epic; its test
`shell-page-routes.spec.tsx` is replaced by the shell's own. `T200a` is not.

---

## `R-036-6` — The shell lives beside the design system, not inside it

**Decision**: `frontend/src/shell/` — the shell, navigation, the area registry and Home.
`frontend/src/design/` is untouched.

**Rationale**: `PMI-DOC-005` is screen-agnostic and `EPIC-029` owns `design/`; putting product
navigation there would put screens in a token standard, which is the exact merge `G-30` created
PMI-DOC-006 to prevent. `frontend/src/rooms/` (the Room shell) is `EPIC-033`'s and is likewise
consumed, not moved.

**Alternatives considered**: `frontend/src/app/` — no precedent in this tree; `src/pages/` — the
shell is not a page and would then be checked by `T200a` as one.

---

## Summary — what this phase settled

| Question | Decision |
|---|---|
| How are areas addressable? | `R-036-1` — React Router v7, declarative mode; **`D-13` raised 6.x → 7.x** before the install (`T442r` — this table said `D-30 registered first`, and the row already existed) |
| How does an area reach navigation without a code change? | `R-036-2` — one committed registry, read by nav, routes and the check |
| Do deep links survive a refresh in production? | `R-036-3` — in dev yes; production serving has no owner and is named, not assumed |
| What can Home actually show? | `R-036-4` — approvals today; policy and evidence degrade visibly until `EPIC-031`/`032` |
| What happens to `T200a` and `T200e`? | `R-036-5` — `T200a` kept and joined; `T200e`'s buttons superseded |
| Where does the shell live? | `R-036-6` — `frontend/src/shell/` |

**No `NEEDS CLARIFICATION` remains.**
