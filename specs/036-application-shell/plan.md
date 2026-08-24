# Implementation Plan: Application Shell & Dashboard

**Branch**: `036-application-shell` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-036` | **SRS References**: `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md`
§4–§9 · `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` `BR-0190`, `BR-0191`,
`BR-0192`, `BR-0193`, `BR-0001` · `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md`

**Input**: Feature specification from `/specs/036-application-shell/spec.md`

## Summary

Build the shell that makes eighteen areas one product: a persistent grouped navigation derived from
a committed area registry, addressable areas that survive a refresh, an explicit workspace/project
context, and a Home that shows what is waiting.

`BR-0190` — *"Core lifecycle capabilities MUST be navigable as one coherent application"* — is a
**MUST** that no Epic has owned. The technical approach is small on purpose: **React Router v7 in
declarative mode** (`R-036-1`) over **one registry that navigation, routes and the reachability
check all read** (`R-036-2`), so adding a declared area is a data change rather than a shell change.
Home ships the attention items whose sources exist and **says so** about the two whose sources do
not (`R-036-4`).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3.1 (ES2023 target, `tsconfig.base.json`)

**Primary Dependencies**: React 18.3.1 · **React Router 7.x — NEW, `D-30`, registered before install**
(`R-036-1`, Context7 `/remix-run/react-router`) · `@pmi/room-contract` (workspace) ·
`frontend/src/design/` component layer (`EPIC-029`, consumed unchanged)

**Storage**: none. The shell persists no user data. Workspace/project selection is session state;
the area registry is committed source.

**Testing**: Vitest `frontend` project — `frontend/tests/unit/**/*.spec.{ts,tsx}` — with
`@testing-library/react` and jsdom; `axe-core` for the accessibility assertions. Constitution XI
Tier 2 evidence is a run-generated transcript against the running application.

**Target Platform**: modern browsers, 360px viewport floor (`UX-0040`)

**Project Type**: web application — frontend only. **No backend work.** Every endpoint Home reads
already exists (`R-036-4`).

**Performance Goals**: navigation responds to a selection in under 1s at p95 on the reference local
stack (`SC-SHL-006`). Deliberately scoped to a named stack — `DEF-030-002` records a p95 assertion
that fails under suite load and passes alone, and an unscoped target inherits that ambiguity.

**Constraints**: 360px floor · WCAG 2.2 AA via PMI-DOC-005 · no second authorization model
(`FR-SHL-003`, `FR-SHL-014` deferred) · no Home store and no shell-only aggregation endpoint
(`FR-SHL-034`) · nine declared areas in scope, nine unowned areas MUST NOT appear (`UX-0060`)

**Scale/Scope**: 18 areas specified, **9 declared and in scope**; 4 navigation groups; 1 new area
delivered (Home); ~6 existing areas re-hosted from `EPIC-010` `T200e`'s buttons

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — `/speckit-specify`, `/speckit-clarify` and `/speckit-plan` produced everything so far; implementation runs through `/speckit-implement` |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS** — and, for the first time in this family, **against an APPROVED document**. `PMI-DOC-006` was signed 2026-08-24 (`D-44`); `EPIC-030`–`EPIC-035` each carried its `PROPOSED` status as a named risk. `BR-0013` left scope at clarification and its row is marked out-of-scope rather than deleted |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-036`, `specs/036-application-shell/`, registered in `repository-layout.md` (`G-05d`) |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code outputs are the **area registry** and the **`D-30` register entry**; the registry's check is `FR-SHL-016`, and `TS-001`'s own check covers the register row |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — exists, tracked via `.gitkeep` (`G-26-13`) |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS for what exists** — local first. **`dev`, `stage` and `prod` do not exist**: no Dockerfiles, and `EPIC-014` `T156` presupposes a deployable artifact no Epic owns. Recorded in Complexity Tracking; this Epic cannot discharge a pipeline it does not own |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | **PASS** — label this session `EPIC-036 Application Shell` |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report | **PASS** — this plan ends with `/speckit-tasks` |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | **PASS** — five questions in one round, 2026-08-24; implementation runs without pausing |
| XI | **Tier 1 (always)** — every user-facing capability has a planned test driving it through its **real entry point** against the composed module graph. **Tier 2 (Epics delivering a journey)** — a **run-generated** transcript against a running application | **PASS** — Tier 1: `FR-SHL-016` drives the real `App` and asserts every declared area is reachable, mutation-verified by removing one route. Tier 2: this Epic delivers a journey (sign-in → navigate → Home), so a driven transcript against the running stack is planned closure evidence. `EPIC-029`'s reachability transcript is the precedent |
| — | Repository was synced from GitHub before this work started | **PASS** — remote `origin` is `github.com/rubeldhk/iSPEC-PMI-studio`; this checkout is `main` with every Wave 1 branch merged 2026-08-23 |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | **FAIL at planning — discharged by the first task.** This plan was written on `main`. Implementation MUST run in a dedicated worktree at `.claude/worktrees/epic-036-application-shell`, which is `EPIC-030`–`EPIC-035`'s established pattern and this Epic's `T1` |

Any FAIL blocks Phase 0. The one FAIL is the concurrent-session gate, discharged by the first task
exactly as `EPIC-033` `T337a` discharged it — recorded rather than waived.

## Project Structure

### Documentation (this feature)

```text
specs/036-application-shell/
├── plan.md              # This file
├── research.md          # Phase 0 output — six decisions
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── shell-contract.md   # Phase 1 output — registry shape, routes, regions
├── checklists/
│   └── requirements.md  # Spec quality, re-validated after clarification
├── defects/             # MANDATORY per-Epic defect records (Constitution VI)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── shell/                    # NEW — this Epic owns this directory and no other
│   │   ├── areas.ts              # the area registry (R-036-2) — the one list
│   │   ├── AppShell.tsx          # frame: navigation + context + outlet
│   │   ├── Navigation.tsx        # four groups, derived from areas.ts
│   │   ├── NavigationDrawer.tsx  # FR-SHL-054, below the narrow breakpoint
│   │   ├── ContextBar.tsx        # workspace / project / breadcrumb (FR-SHL-020–025)
│   │   ├── routes.tsx            # BrowserRouter tree, derived from areas.ts
│   │   └── Home.tsx              # FR-SHL-030–034, attention items
│   ├── design/                   # EPIC-029 — CONSUMED, not modified
│   ├── rooms/                    # EPIC-033 — CONSUMED, not modified
│   ├── pages/                    # existing areas — re-hosted, content unchanged
│   ├── services/api.ts           # existing client — read only
│   └── main.tsx                  # MODIFIED — the view union is replaced by routes
└── tests/
    └── unit/
        ├── shell/                # NEW — navigation, drawer, context, Home, routes
        └── design/page-reachability.spec.ts   # EPIC-010 T200a — KEPT (R-036-5)

specs/_shared/dependencies.md     # MODIFIED — D-30, before the install (TS-001)
```

**Structure Decision**: frontend-only, in a new `frontend/src/shell/` directory (`R-036-6`).
`design/` and `rooms/` are consumed unchanged — putting navigation in `design/` would put screens in
a token standard, which is the merge `G-30` created PMI-DOC-006 to prevent. `pages/` keeps its
content; only its hosting changes. **No backend work**: every source Home reads already exists.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **A new runtime dependency (`D-30`, React Router 7.x)** | `FR-SHL-017` needs addresses that survive a refresh, support back/forward, and answer not-found for undeclared areas. The product has no routing at all | Hand-rolling is history push/pop, `popstate`, path matching with params, nested layouts, scroll restoration and the not-found case — a router with none of a router's test suite behind it, owned by an Epic that did not set out to write one (`PP-014` inverted) |
| **Gate VII cannot be fully satisfied** | Promotion beyond `local` requires `dev`/`stage`/`prod`, and none exist | Nothing simpler exists to reject. **No Epic owns building a deployable artifact**; `EPIC-014` `T156` presupposes one. This Epic records the gap rather than inventing a pipeline it does not own |
| **Deep links depend on a server that has no owner** (`R-036-3`) | A client-side router needs the server to return the app for unknown paths. Vite's dev server does; nothing serves the built client at all | A hash router (`#/areas/runs`) needs no server support — rejected because it makes every address worse to route around a deployment gap that is organisational, not technical |
| **Home degrades on two of its three sources** (`R-036-4`) | `FR-SHL-032` names approvals, policy blocks and missing evidence. `EPIC-031` (0/92) and `EPIC-032` (0/83) supply the last two | Delaying Home blocks `BR-0192`'s only surface on two unstarted Epics; stubbing the sources fabricates governance state, which is worse than an absent one. Visible degradation is `EPIC-033`'s posture for its unbound gateway, applied here |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/shell-contract.md`, `quickstart.md`):

- **Gate II** — still PASS. Phase 1 added no requirement without an SRS source; the contract's route
  table maps every path to an area and every area to a `UX-` or `BR-` citation.
- **Gate V** — still PASS, and sharper: the registry is a configuration output and
  `FR-SHL-016` is the executable check that can fail for it, mutation-verified.
- **Gate XI** — still PASS. The contract names `App` as the real entry point for Tier 1, and
  `quickstart.md` §7 is the Tier 2 transcript.
- **No new violations.** The four in Complexity Tracking are unchanged; none was introduced by the
  design, and each has an owner or a stated reason.
