# Implementation Plan: Design System

**Branch**: `epic/029-design-system` (not yet created) | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-029` | **SRS References**: `SRS/PMI-DOC-005_Design_System_and_UX_Standards_v0.1.md` §6.1–§6.5; `SRS/PMI-DOC-004` §2 BG-01/05/06

**Input**: Feature specification from `/specs/029-design-system/spec.md`

## Summary

Deliver the token layer, the Phase 1 component inventory, and the checks that keep both honest —
so that thirteen Epics carrying thirty-nine UI tasks build one product rather than thirteen.

The approach is deliberately layered, because the layers have different gates: **tokens** depend on
nothing and can start immediately; the **lint rule** and **accessibility harness** depend only on
tokens; the **component layer** waits on decision `D-42` (build vs adopt); **restyling** waits on
components. That ordering means `D-42` blocks roughly a third of the Epic rather than all of it.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18 (existing frontend)

**Primary Dependencies**: React 18, Vite 6, Vitest 2, @testing-library/react, jsdom — all present.
**New**: `axe-core` for automated accessibility checks (see research). Component library: **NOT
CHOSEN** — decision `D-42`, per `PMI-DOC-005` `RULE-05`.

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

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | PASS |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | PASS — `PMI-DOC-005` §6.1–§6.5; four clarification-sourced requirements flagged for back-fill |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | PASS |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | PASS |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | PASS — tokens are configuration and get a conformance check (`F-29.1`); the lint rule is mutation-verified against a literal value |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | PASS |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | PASS |
| VIII | Session/clone is labelled with the working Epic (`EPIC-### <name>`), or the first command | ⚠️ PARTIAL — see Complexity Tracking |
| IX | Every stop in this run ends with an executable next action; full stops close with a Work Completed + Recommended Next Task report | PASS |
| X | Decision-phase questions were batched into one questionnaire with recommended defaults; execution phases run without confirmation pauses | PASS — clarify asked four questions in one batch (2026-08-20) |
| — | Repository was synced from GitHub before this work started | PASS |
| — | No other Claude session is active on this checkout (else: work in a separate clone) | ⚠️ FAIL — see Complexity Tracking |

**Post-Phase-1 re-check**: unchanged. The design adds no new provider, no new runtime dependency
beyond `axe-core` (dev-only), and no persistence.

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
