---

description: "Task list for EPIC-029 — Design System"
---

# Tasks: Design System

**Epic**: `EPIC-029` | **Module**: cross-cutting | **Tasks**: counted in this file, never restated elsewhere (`T686`, PP-002)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

> ▶ **PROCEEDING** — authorised 2026-08-20 by `D-41`. Implements `PMI-DOC-005` (`UI-0001`–`UI-0042`).

**Session label**: `EPIC-029 Design System` (Constitution VIII).
⚠️ **This Epic must be implemented in a separate clone or worktree.** Another session is working
EPIC-008/011 on this checkout, and `plan.md` Complexity Tracking records the deviation. The
document phases (spec, plan, tasks) were document-only; **implementation is not.**

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first. Tasks producing **configuration or documents** —
tokens, themes, the lint rule, the accessibility record — carry an **executable conformance check**
instead, and each such check is mutation-verified: a check that cannot fail is decoration.

**Task IDs**: `T865`–`T904`, plus `T866a`, `T888a` added by the analyse pass of 2026-08-20, and `T886a`, `T899a`, `T900a`, `T900b`, `T901a` added by the re-plan of 2026-08-20 (corpus max was `T864`; the `a`-suffix convention keeps a later addition adjacent to what it pairs with — the `T549a`/`T576a` precedent). **47 tasks.**

**Re-planned 2026-08-20** against **constitution v1.5.0** and the now-settled `D-42`. Principle XI (the reachability gate) is new and **changes this Epic's exit conditions**; the original 42 tasks were never checked against it because it did not exist. Five tasks were added:

| Task | Why it did not exist before |
|---|---|
| `T886a` | `T886` gained a native-element assertion (`D-42`), and a newly written check has never been observed failing |
| `T899a` | **XI Tier 1** — `T866a` reads `main.tsx` for an import line; `T883` renders pages directly. Neither mounts the app at its root, so neither would catch a real render failure |
| `T900a` | **XI Tier 2** — `V5` was a person looking at a screen; XI requires a run-generated transcript |
| `T900b` | `T900a` produces a document, so Constitution V requires a conformance check that can fail |
| `T901a` | Phase Z confirms Constitution V (`T901`); XI now needs the same treatment at closure |

**Amended 2026-08-20** by `/speckit-analyze`, which found one Constitution V violation and five further issues — see [analysis.md](./analysis.md). Fixes are marked inline: `T866a` (the stylesheet import had no check), `T879` (its backlog was empty by construction), `T888a` (`FR-DS-042` had no task), `T890` (moved ahead of the tests it shapes), `T884` (own file), and ID citations across seven tasks.

**Both original gates are discharged** (`spec.md` Exit Criteria):

- ~~`PMI-DOC-005` is **v0.1 Draft**~~ — **approved v1.0 on 2026-08-20**.
- ~~Decision **`D-42`** gates Phase 5 onward~~ — **decided 2026-08-20**: components are built on
  native HTML elements, no library dependency. Nothing in this Epic waits on a decision.

**A new gate replaced them, at the other end.** Constitution XI (v1.5.0) means this Epic cannot
*close* until the restyled application has been exercised through its real entry point and against
a running instance — `T899a`, `T900a`, `T900b`, confirmed by `T901a`. Phases 1–4 remain the
recommended MVP; the new gate binds at closure, not at start.

**Before starting**: sync from GitHub; confirm no other session is on this checkout (if one is,
work in a separate clone).

**Before finishing**: close with a report — what was done (artifacts by path, plus anything in
scope that was not done and why) and the recommended next task as a concrete Spec Kit command
(Constitution IX). If the work changed anything the Delivery Board displays, refresh it or declare
it stale and name what changed (Constitution IX, v1.4.0).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: make the design system buildable and its checks runnable. No visual decision here.

- [ ] T865 Add `axe-core` as a dev dependency of `frontend/` and record the resolved version in `frontend/package.json`, per `plan.md` Complexity Tracking (the one new dependency this Epic takes)
- [ ] T866 Create the directory structure `frontend/src/design/` with `tokens.css`, `themes.css` and `components/`, and import the stylesheets once at the application root in `frontend/src/main.tsx` — one import point, so no page can forget it (conformance check: T866a)
- [ ] T866a [P] Write the conformance check asserting `frontend/src/main.tsx` imports **both** `design/tokens.css` and `design/themes.css`, in `frontend/tests/unit/design/stylesheet-installed.spec.tsx`, and **mutation-verify it** by removing an import. Per analysis `D1`: without this, dropping the import renders every page unstyled while every component test still passes, because components are tested in isolation — the sixth built-tested-called-by-nothing in this programme. `T662`'s `main.ts` source assertion is the precedent
- [ ] T867 [P] Register a `design` test area in the existing `frontend` Vitest project so `frontend/tests/unit/design/**` and `frontend/tests/unit/a11y/**` are collected, and assert the glob matches at least one file (the `T537` anti-vacuity precedent — a project that collects nothing passes silently)

**Checkpoint**: `pnpm --filter frontend build` succeeds with the stylesheets imported and empty.

---

## Phase 2: Foundational — the token layer (BLOCKING)

**Purpose**: the single definition every later phase consumes. **Nothing else may start until this
is complete**, because a component written before tokens exist will contain literals.

**⚠️ CRITICAL**: this phase blocks Phases 3–6.

- [ ] T868 [P] Write the failing conformance check for the token layer in `tests/governance/design-tokens.spec.ts`: every token declared **exactly once** (`FR-DS-002`); category and naming shape per [contracts/tokens.md](./contracts/tokens.md); the `space` scale is a fixed ratio (`FR-DS-003`); the `type` scale has **at most seven** steps, each with size, line height and weight (`FR-DS-004`)
- [ ] T869 Define the token set in `frontend/src/design/tokens.css` — colour roles (never hues), space, type, radius, elevation, motion — as a **neutral system palette** this Epic derives, making no brand claim (`FR-DS-005`; conformance check: T868)
- [ ] T870 Extend `tests/governance/design-tokens.spec.ts` to assert **theme completeness**: every themed token has a value in light AND dark, failing with the token name (`FR-DS-010`). Confirm it fails before T871 by omitting one token from dark
- [ ] T871 Define light and dark theme values in `frontend/src/design/themes.css`, with `prefers-color-scheme` as the default and a persistent explicit override (`FR-DS-011`, `SC-DS-005`; conformance check: T870)
- [ ] T872 Extend `tests/governance/design-tokens.spec.ts` to **compute WCAG 2.2 AA contrast from the token values** for every declared text-on-surface pair, in both themes, failing with the pair and its computed ratio (`SC-DS-007`). Per research `R-029-3` this is computed, **not** asked of axe — jsdom has no layout, so axe's `color-contrast` rule returns *incomplete*, never pass or fail
- [ ] T873 [P] Write the failing unit test for theme selection in `frontend/tests/unit/design/theme.spec.tsx`: OS preference followed by default, explicit override wins and persists, clearing the override returns to the OS (`FR-DS-011`)
- [ ] T874 Implement theme selection and persistence in `frontend/src/design/theme.ts` (unit test: T873)
- [ ] T875 [P] Assert `prefers-reduced-motion: reduce` resolves motion durations to zero **without changing layout**, in `frontend/tests/unit/design/motion.spec.tsx` (spec Edge Cases)

**Checkpoint**: `pnpm vitest run --project governance tests/governance/design-tokens.spec.ts` passes — quickstart **V1**. Both themes complete, contrast proven, no component written yet.

---

## Phase 3: User Story 2 - Every screen looks like the same product (Priority: P1) 🎯 MVP

**Goal**: make "no literal visual values" mechanical rather than a matter of review.

**Independent Test**: quickstart **V2** — `pnpm lint` is clean, and adding `color: #ff0000` to any
component makes it fail, naming the file and the value.

**Why this story is the MVP**: it is the guarantee every other Epic consumes. Without the rule,
`FR-DS-052` ("each Epic styles its own work") is a promise; with it, it is enforced.

### Tests for User Story 2 (MANDATORY - Constitution V) ⚠️

- [ ] T876 [P] [US2] Write failing tests for the literal-value rule in `tests/governance/eslint-design-tokens.spec.ts`: it flags hex colours, `rgb()`/`hsl()`, and length units outside the allowlist (`0`, `1px`, `100%`, `100vh`, `auto`, `currentColor`), in stylesheets **and** inline `style=` props, and does **not** flag `tokens.css`/`themes.css` — per `FR-DS-001`, `FR-DS-051`, `SC-DS-003` and research `R-029-5`
- [ ] T877 [P] [US2] Write the **mutation test** for the rule: a fixture containing a literal MUST produce a violation. The rule is itself a check, and a check that cannot fail is decoration (Constitution V)

### Implementation for User Story 2

- [ ] T878 [US2] Implement the literal-value ESLint rule in `eslint.config.js`, following the dependency-boundary rule precedent (`T541`) (unit tests: T876, T877)
- [ ] T879 [US2] Derive the Phase 6 restyling backlog from the **component inventory each delivered page needs** — which components, which states — and record it in this file under Phase 6. Per analysis `U1`: the four pages and two components contain **zero styles and zero literals** (verified in source: no `className`, no `style=`, no hex, no px), so a lint run yields an empty list. The work is *adding* styling where none exists, not *replacing* literals (`FR-DS-050`, `SC-DS-003`)

**Checkpoint**: quickstart **V2** passes; the rule is proven able to fail.

---

## Phase 4: User Story 1 - Operable by keyboard and screen reader (Priority: P1)

**Goal**: the accessibility bar becomes a check that runs, not a claim.

**Independent Test**: quickstart **V3** (automated) and **V4** (the manual pass, recorded).

**⚠️ The trap this phase exists to avoid** (research `R-029-2`, verified against current axe-core
documentation): there is **no aggregate WCAG tag**, and `wcag22aa` contains exactly one rule —
`target-size` — which ships **disabled**. The intuitive `runOnly: ['wcag22aa']` runs zero checks
and reports green: a suite claiming conformance to a standard it never tested. That is
`DEF-028-003` and `DEF-001-004` in a third costume.

### Tests for User Story 1 (MANDATORY - Constitution V) ⚠️

- [ ] T880 [P] [US1] Write the accessibility harness in `frontend/tests/unit/a11y/axe.ts`, configured for `FR-DS-030` with **all five tags** — `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` — and `axe.configure()` **explicitly enabling `target-size`**, without which the WCAG 2.2 delta is untested (research `R-029-2`)
- [ ] T881 [US1] Write the **meta-test** proving the harness detects a known violation — an unlabelled input — in `frontend/tests/unit/a11y/harness.spec.tsx`. Without this the harness can silently stop working and every suite below it stays green (test: T880)

### Implementation for User Story 1

- [ ] T882 [P] [US1] Add a focus-visible treatment driven by tokens in `frontend/src/design/tokens.css` and assert its contrast meets AA against every surface, in `tests/governance/design-tokens.spec.ts` (`FR-DS-033`)
- [ ] T883 [US1] Run the harness over each delivered page in `frontend/tests/unit/a11y/pages.spec.tsx` — SignIn, Projects, Requirements, Traceability — asserting zero violations (`FR-DS-030`, `FR-DS-031`, `SC-DS-001`; test harness: T880)
- [ ] T884 [P] [US1] Write the conformance check for the manual accessibility record in `tests/governance/accessibility-record.spec.ts` (its own file — analysis `I1`: a check about a markdown transcript does not belong in a file named for tokens): `docs/accessibility/EPIC-029-manual-pass.md` exists and names a **screen reader, its version, and at least one journey**. A file saying only "passed" MUST fail — that is the difference between a transcript and a tick (`FR-DS-034`, `SC-DS-008`)
- [ ] T885 [US1] **MANUAL** — walk sign-in → create project → capture requirement using only a keyboard and a screen reader; commit the transcript to `docs/accessibility/EPIC-029-manual-pass.md` naming tool, version and journeys (`FR-DS-032`; conformance check: T884). Automation cannot see focus *order* or whether an announcement is *meaningful*, which is why this task exists and cannot be delegated to CI

**Checkpoint**: quickstart **V3** and **V4** pass. `SC-DS-001` and `SC-DS-002` are evidenced.

---

## Phase 5: User Story 3 - Every asynchronous surface explains itself (Priority: P2)

**Goal**: the fifteen components of [contracts/components.md](./contracts/components.md), each with
every state its row declares.

**⚠️ GATED ON DECISION `D-42`** — build vs adopt (`PMI-DOC-005` `RULE-05`). Research `R-029-6` has
the inputs. If a library is adopted, `PP-008` requires security review **before** T887.

**Independent Test**: quickstart **V3** — one assertion per declared state, for all fifteen.

### Decision first (analysis `O1`)

- [ ] T890 [US3] Record decision **`D-42`** (build vs adopt) in `specs/_shared/decisions/D-42-component-library-build-vs-adopt.md`, with security review recorded if a dependency is adopted (`PP-008`, `PMI-DOC-005` `RULE-05`). **Moved to the head of this phase**: it is a decision record, not implementation, and writing the component tests before it risks reworking their APIs if a library is adopted

### Tests for User Story 3 (MANDATORY - Constitution V) ⚠️

- [ ] T886 [P] [US3] Write the **state-and-element coverage check** in `frontend/tests/unit/design/state-coverage.spec.tsx`: read the tables from `contracts/components.md` and assert (a) every component has a test for every state its row declares (`FR-DS-020`, `FR-DS-023`, `SC-DS-004`), and (b) **every component renders the native element its row names** (`D-42`). This is the check that makes a *missing* state a failure rather than an omission nobody notices — and (b) is the only thing standing between `D-42` and a div-based reimplementation, which every other check in this Epic passes happily (mutation check: T886a)
- [ ] T886a [P] [US3] **Mutation-verify T886 on both dimensions** in `frontend/tests/unit/design/state-coverage.spec.tsx`: a component missing a declared state MUST fail it, and a component rendering `<div>` where its row names `<button>` MUST fail it. Two fixtures, two failures observed. Per Constitution V a check that cannot fail is decoration — and (b) is newly written, so it has never been seen to fail at all
- [ ] T887 [P] [US3] Write failing component tests for the form family — Button, TextInput, Select, Checkbox, Radio, FormField — covering each declared state, in `frontend/tests/unit/design/forms.spec.tsx`
- [ ] T888a [P] [US3] Assert the **testable half of `FR-DS-042`**: every control's label states what happens, and its confirmation states what happened — a `Save` button pairs with a `Saved` confirmation, not a generic `Success` — in `frontend/tests/unit/design/microcopy.spec.tsx`. Per analysis `C1`. The other half ("name things as users recognise them") is **not mechanically testable**, so it moves to `PMI-DOC-005` as a standing convention rather than a requirement this Epic claims to satisfy — review does not satisfy Constitution V
- [ ] T888 [P] [US3] Write failing component tests for the feedback family — EmptyState, ErrorState, LoadingIndicator, Toast — asserting an empty state explains **why** it is empty and an error says what to do next without exposing internal detail (`FR-DS-021`, `FR-DS-022`), in `frontend/tests/unit/design/feedback.spec.tsx`
- [ ] T889 [P] [US3] Write failing component tests for the structure family — Table, Modal, Navigation, PageHeader, StatusPill — asserting the Table offers filtering (`FR-DS-041`), the Modal traps and restores focus and closes on Escape, and StatusPill carries status by text or icon as well as colour (`FR-DS-012`), in `frontend/tests/unit/design/structure.spec.tsx`

### Implementation for User Story 3

- [ ] T891 [P] [US3] Implement the form family in `frontend/src/design/components/` (unit tests: T887)
- [ ] T892 [P] [US3] Implement the feedback family in `frontend/src/design/components/` (unit tests: T888)
- [ ] T893 [P] [US3] Implement the structure family in `frontend/src/design/components/` (unit tests: T889)
- [ ] T894 [US3] Run the accessibility harness over every component in `frontend/tests/unit/a11y/components.spec.tsx` (harness: T880)

**Checkpoint**: fifteen components, every declared state asserted, zero axe violations.

---

## Phase 6: Restyle what exists today

**Purpose**: `FR-DS-050` — and **only** what exists (`FR-DS-052`). Every future Epic styles its own
work, which T878's rule now enforces automatically.

- [ ] T895 [P] Restyle `frontend/src/pages/SignIn.tsx` onto tokens and components (accessibility conformance check: T883)
- [ ] T896 [P] Restyle `frontend/src/pages/Projects.tsx` onto tokens and components (accessibility conformance check: T883)
- [ ] T897 [P] Restyle `frontend/src/pages/Requirements.tsx` onto tokens and components (accessibility conformance check: T883)
- [ ] T898 [P] Restyle `frontend/src/pages/Traceability.tsx` onto tokens and components (accessibility conformance check: T883)
- [ ] T899 [P] Restyle `frontend/src/components/EngineSelector.tsx` and `frontend/src/components/RequirementEditor.tsx` onto tokens and components (accessibility conformance check: T894)
- [ ] T899a **Constitution XI Tier 1** — write the real-entry-point test in `frontend/tests/unit/design/app-root.spec.tsx`: **mount the application at its root** (the composed tree `main.tsx` builds, not a page component in isolation) and assert a delivered page renders with token-derived styling resolved. **Mutation-verify by removing a stylesheet import** — the test MUST fail. `T866a` asserts the import *line exists* by reading the source; this asserts the app *actually renders styled*, which is the difference Principle XI was written for. Neither `T866a` nor `T883` drives the real entry point (unit test: this task is itself the test)
- [ ] T900 Verify the restyled pages at the **minimum viewport (360×640)** and at **200% text zoom** with no clipping or overflow, and record the result in [quickstart.md](./quickstart.md) `V5` (`FR-DS-006`, `FR-DS-040`, `SC-DS-006`, research `R-029-4`)
- [ ] T900a **Constitution XI Tier 2** — drive the restyled journey against the **running application** (sign-in → projects → requirements, both themes, 360×640 and 200% zoom) and emit a **run-generated transcript** to `docs/accessibility/EPIC-029-reachability-transcript.md`. The transcript MUST be produced by the run and name what was exercised; **hand-writing or editing it is a constitution violation**, the rule `G-28-02` enforced against `T709`'s first attempt. The local stack is up and verified as of 2026-08-20, so this needs no new environment (conformance check: T900b)
- [ ] T900b [P] Write the conformance check for the reachability transcript in `tests/governance/reachability-transcript.spec.ts`: the file exists, names each page exercised and both themes, and carries evidence it was machine-generated. **A file saying only "passed" MUST fail** — the same standard `T884` holds the manual accessibility record to (`SC-DS-006`, Constitution XI Tier 2)

**Checkpoint**: quickstart **V5** — every delivered page renders from tokens alone, in both themes,
**proven against the running application** rather than asserted.

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, V, VI, IX)

- [ ] T901 Confirm every implementation task has a passing unit test, and every configuration or document task a passing conformance check that was **observed failing first** (Constitution V)
- [ ] T901a Confirm **Constitution XI** is satisfied on both tiers: Tier 1 — `T899a` mounts the application at its root and was observed failing with a stylesheet import removed; Tier 2 — `T900a`'s transcript exists, is machine-generated, and passes `T900b`. This Epic restyles the four pages a user actually sees, so it is the worst possible candidate for a reachability waiver
- [X] T902 Confirm `PMI-DOC-005` has been **approved** and the clarification-sourced requirements back-filled — **done 2026-08-20 at approval**: v1.0 carries `UI-0005` (palette), `UI-0006` (browser floor), `UI-0035` (accessibility evidence) and `RULE-04` (restyle ownership). Back-filling at approval rather than at closure means the approved document is the complete one (Constitution II)
- [ ] T903 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T904 Triage `specs/029-design-system/defects/`; close every record or defer to a named Epic, then publish the Epic closing report — work completed, work deferred, recommended next command (Constitution IX)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — **BLOCKS everything else**. A component written before tokens exist contains literals by necessity
- **US2 (Phase 3)**: needs Phase 2 — the rule needs a token file to exempt
- **US1 (Phase 4)**: needs Phase 2; independent of US2 and runs in parallel with it
- **US3 (Phase 5)**: needs Phase 2. (`D-42` was a gate here; it is **decided** and no longer one)
- **Restyle (Phase 6)**: needs Phase 5. `T899a` and `T900a` need the restyles finished — they prove the *restyled* app renders, so running them earlier proves nothing
- **Phase Z**: needs all, plus `PMI-DOC-005` approval (done, `T902`)

### `D-42` — decided, blocking nothing

**Decided 2026-08-20**: components are **built on native HTML elements**, no library dependency
([`D-42`](../_shared/decisions/D-42-component-library-build-vs-adopt.md)). `PP-008` is not
triggered.

The layering above was chosen so an open decision gated roughly half the Epic rather than all of
it. That hedge has paid out and is now simply the dependency order — **all 47 tasks are runnable**.
What the decision leaves behind is an obligation, not a block: every component is built on the
native element its row names, and `T886`(b) is the only check that can see a violation.

### Parallel Opportunities

- `T867` runs alongside `T865`/`T866`
- `T868` and `T873`/`T875` are independent within Phase 2
- **US1 (Phase 4) and US2 (Phase 3) run fully in parallel** once Phase 2 lands
- `T887`–`T889` are three independent test files; `T891`–`T893` likewise
- `T886a` runs alongside `T886`'s siblings — its fixtures touch no shared state
- The six restyles `T895`–`T899` are all `[P]` — six files, no shared state
- **`T899a`, `T900` and `T900a` are NOT `[P]`** — each needs every restyle finished, and `T900a` additionally needs a running stack, which is one shared resource. `T900b` is `[P]`: it is a check about a file, not a run

---

## Implementation Strategy

### MVP (Phases 1–4)

1. Setup, then the token layer with both themes and proven contrast
2. The literal-value lint rule, mutation-verified
3. The accessibility harness with all five tags, `target-size` enabled, and its meta-test
4. **STOP and VALIDATE**: quickstarts V1, V2, V3, V4 all pass

At that point the platform has a design system, an enforced rule, and a real accessibility gate —
while every UI Epic that follows is automatically held to it. That is a genuine increment on its
own, which is why the Epic was layered this way while `D-42` was still open.

### Then

5. Build the components on native elements per `D-42` (Phase 5)
6. Restyle what exists, then **prove it against the running application** — `T899a` at the app
   root, `T900a` against the live stack (Phase 6)
7. Close (Phase Z), including the `T901a` reachability confirmation

**Note on step 6**: it is not optional polish. Constitution XI makes it the gate this Epic closes
through, and every one of the six defects that principle exists to catch was found by a person
opening a browser *after* an Epic had been declared done.

---

## Notes

- Tokens are configuration: their tasks pair with conformance checks, not unit tests (Constitution V)
- Every check in this Epic is mutation-verified — `T877` and `T881` exist solely to prove two checks
  can fail, because three defects this week were checks that could not
- `[P]` = different files, no dependency
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks
- Implementation happens in a **separate clone** — see the session-label warning at the top
