# Implementation Plan: Design System

**Branch**: `epic/029-design-system` (not yet created) | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Revised 2026-08-20** — re-planned against constitution **v1.5.0** (Principle XI, the reachability
gate, is new and **changes this Epic's exit conditions**) and against decision **`D-42`**, which is
no longer open. Phase 0 research now has no unresolved question.

**Epic**: `EPIC-029` | **SRS References**: `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v1.0.md` §6.1–§6.5; `SRS/PMI-DOC-004` §2 BG-01/05/06

**Input**: Feature specification from `/specs/029-design-system/spec.md`

## Summary

Deliver the token layer, the Phase 1 component inventory, and the checks that keep both honest —
so that thirteen Epics carrying thirty-nine UI tasks build one product rather than thirteen.

The approach is deliberately layered, because the layers build on one another: **tokens** depend on
nothing and can start immediately; the **lint rule** and **accessibility harness** depend only on
tokens; the **component layer** depends on tokens; **restyling** depends on components.

That layering was originally chosen so decision `D-42` blocked roughly a third of the Epic rather
than all of it. **`D-42` is now decided** — components are **built on native HTML elements, with no
component-library dependency** — so the ordering is no longer a hedge, just the dependency order.
All 42 tasks are runnable.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18 (existing frontend)

**Primary Dependencies**: React 18, Vite 6, Vitest 2, @testing-library/react, jsdom — all present.
**New**: `axe-core` for automated accessibility checks (see research) — **dev-only, and the Epic's
only new dependency**. Component library: **none, by decision `D-42`** (2026-08-20). Components are
built on native HTML elements — `<button>`, `<input>`, `<select>`, `<dialog>` — every one of which
is available across the whole `UI-0006` browser floor. `PP-008` (security review of a third-party
UI dependency) is therefore **not triggered by this Epic**, and no third-party component code
reaches a user's browser.

**Storage**: N/A — presentation layer only

**Testing**: Vitest `frontend` project (jsdom), plus a token-conformance check in the `governance`
project and a lint rule in `eslint.config.js`

**Target Platform**: Browsers — last two versions of Chrome, Edge, Firefox, Safari (`FR-DS-006`)

**Project Type**: Web frontend, cross-cutting

**Performance Goals**: No runtime budget is set. The token layer is static CSS custom properties;
component count, not bytes, is the thing to keep small in Phase 1.

**Constraints**: WCAG 2.2 Level AA (`FR-DS-030`, inherited from EPIC-010 and stated once);
zero literal visual values outside the token file (`FR-DS-051`); both themes complete (`FR-DS-010`)

**Scale/Scope**: 15 components, ~60 tokens, 2 themes, 4 pages and 2 components restyled

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Evaluated against constitution v1.5.0.** The previous run of this plan was checked against
v1.4.0, before Principle XI existed.

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | PASS |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | PASS — `PMI-DOC-005` §6.1–§6.5; the four clarification-sourced requirements were **back-filled into PMI-DOC-005 v1.0 at its approval**, 2026-08-20 |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | PASS |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | PASS |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | ⚠️ **CONDITIONAL** — true of all 42 existing tasks (tokens get a conformance check; the lint rule is mutation-verified). But `D-42`'s native-element obligation, created after these tasks were written, has no check. See below |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | PASS |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | PASS |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | ⚠️ PARTIAL — see Complexity Tracking |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report | PASS |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | PASS — clarify asked four questions in one batch (2026-08-20) |
| XI | Every user-facing capability is exercised through its **real entry point** against the composed graph (Tier 1); Epics delivering a **journey** additionally record a run-generated transcript against a running application (Tier 2) | ⚠️ **CONDITIONAL — two tasks missing.** See below |
| — | Repository was synced from GitHub before this work started | PASS |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | ⚠️ FAIL — see Complexity Tracking |

### Principle XI — what this Epic must add

Principle XI was ratified **after** `tasks.md` was written, so the existing 42 tasks were never
checked against it. They half-satisfy it, and the half they miss is the half that matters.

**Tier 1 — partially satisfied, one task missing.** `T866a` already asserts that `main.tsx` imports
both stylesheets, and it exists for exactly XI's reason: components tested in isolation all pass
while the running application renders unstyled. That check was written from the pattern before the
principle existed, which is the encouraging part. But it is a **source assertion**, not an exercise
— it reads `main.tsx` rather than mounting it. `T883` renders each delivered page, but renders the
page component directly, not through the application root. **Neither drives the real entry point.**

> **Required**: a test that mounts the application at its root and asserts a delivered page renders
> from the token layer — failing if the stylesheets are absent, not merely if the import line is.

**Tier 2 — not satisfied.** This Epic restyles four delivered pages, so it plainly delivers a
user-facing journey and Tier 2 applies. Today `quickstart.md` `V5` is *a person opening
`localhost:5173` and looking*. That is neither recorded nor run-generated, and Principle XI is
explicit that a transcript must be produced by the run rather than written by hand.

> **Required**: a task that drives the restyled journey against the **running application** and
> emits a transcript as its output. The local UAT stack is up and verified as of 2026-08-20, so
> this is runnable now rather than blocked on environment.

**Neither gap blocks starting.** Both block *closing*, and they are additions to `tasks.md`, which
this command does not write — see the Completion Report for the command that does.

### `D-42` needs an assertion too (Constitution V)

Settling `D-42` created an obligation nothing currently checks: components must be built on the
**native element** their row names, and every existing scenario passes just as happily on a
div-based reimplementation. Leaving that to review would satisfy nothing — Constitution V is
explicit that **manual review does not discharge a check**.

> **Required**: extend the state-coverage check (`T886`), which already parses
> `contracts/components.md`, to assert each component renders the element its row names. It is the
> natural home — the file is already open and already the source of truth for the row.

That makes **three** additions to `tasks.md`, not two.

**Post-Phase-1 re-check**: the design adds no new provider, no new runtime dependency beyond
`axe-core` (dev-only), and no persistence. `D-42` removed the one open decision rather than adding
anything. **Changed since the last re-check**: Principle XI, whose two obligations are recorded
above and carried into Complexity Tracking so they cannot be lost between here and closure.

## Project Structure

### Documentation (this feature)

```text
specs/029-design-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — token, component, theme
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — token and component contracts
├── defects/             # MANDATORY per-Epic defect records (Constitution VI)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── design/                  # NEW — the system
│   │   ├── tokens.css           # the single definition (FR-DS-002)
│   │   ├── themes.css           # light + dark token values (FR-DS-010)
│   │   └── components/          # the Phase 1 inventory (FR-DS-023)
│   ├── components/              # existing: EngineSelector, RequirementEditor — restyled
│   └── pages/                   # existing: SignIn, Projects, Requirements, Traceability — restyled
└── tests/
    └── unit/
        ├── design/              # component + state tests, axe checks
        └── a11y/                # per-page accessibility checks

tests/governance/
└── design-tokens.spec.ts        # token conformance: both themes complete, contrast computed

eslint.config.js                 # NEW rule: no literal visual values outside tokens.css
docs/accessibility/
└── EPIC-029-manual-pass.md      # the committed transcript (FR-DS-034)
```

**Structure Decision**: the system lives at `frontend/src/design/`, **not** in a `packages/`
workspace module. Rationale in [research.md](./research.md) `R-029-1` — one consumer exists, and a
package boundary now would be a guess about a second one.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **Constitution VIII / concurrent-session isolation** — this Epic was specified and planned on a checkout where another session is working EPIC-008/011, on branch `epic/017-enhancement-model` rather than an EPIC-029 branch | The design work is document-only so far (spec, plan, research); no application file has been touched by it | Working in a separate clone is the correct answer and is **required before implementation begins** — recorded here rather than discovered later. `D-39`'s branch-vs-epic check would flag this if it existed |
| **`axe-core` as a new dependency** | `FR-DS-031` requires automated accessibility checks in CI; nothing in the repository can perform them | Hand-written assertions per rule would be a partial, unmaintained reimplementation of a standard — and would not fail on rules nobody remembered to write |
| **Constitution XI — `tasks.md` predates the principle** and lacks a real-entry-point test (Tier 1) and a run-generated running-application transcript (Tier 2) | XI was ratified 2026-08-20, after this Epic's tasks were generated. The Epic delivers a user-facing journey, so both tiers apply | Closing the Epic on the existing 42 tasks was rejected: that is precisely the "built, tested, called by nothing" shape XI exists to stop, and this Epic — which restyles the four pages a user actually sees — is the worst possible one to grant an exemption to. Both tasks are added via `/speckit-tasks` before closure |
