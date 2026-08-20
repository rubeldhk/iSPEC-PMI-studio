# Closure record: EPIC-013 Engine API & Selection

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-013` (Constitution VIII label;
branch `main` via `epic/017-enhancement-model` checkout, stated here) · **Released by**:
PMI-DOC-004 v1.0 (**BR-0030**), scope ruling T-106, 2026-08-20.

The smallest epic in the programme — split from EPIC-003 purely because it touched the held
product surface — closed the same day that surface arrived.

## `T209` — every implementation task has a passing unit test (Constitution V)

**9 of 9 tasks complete; new tests observed RED first** (both files failed to collect before
`engines.controller.ts` / `EngineSelector.tsx` existed).

| Implementation task | Paired test | Result |
|---|---|---|
| T140 `/engines` listing endpoint | T139a `engines.controller.spec.ts` (5 tests) | pass |
| T141 engine selection control | T140a `EngineSelector.spec.tsx` (7 tests) | pass |
| T138 per-project selection endpoint | T135 `engine-selection.spec.ts` + `projects.service.spec.ts` ("stores an engine selection, null = inherit") + `projects.spec.ts` contract (PATCH route) | pass |

Suites at closure: `pnpm test:unit` **871 passed** (82 files) · contract 35 · arch 22 ·
governance 767 · typecheck and lint clean.

## `T138` — the C-29 routing decision, taken

The routing note left one decision open: does the selection endpoint land on
`projects.controller.ts` (EPIC-006's file) or as a project-scoped route on
`engines.controller.ts`? **Decided: `projects.controller.ts`, because the contract already
decided it** — `contracts/platform-api.md` §Engines routes selection through
`PATCH /projects/{id}` ("Selecting a project's engine (see Projects)"). EPIC-006 built exactly
that endpoint (`engineName` on the PATCH body; null = inherit, the resolver's T035 contract) and
`ProjectEngineSelection` implements the port the resolver reads. No second endpoint was added —
a duplicate selection route would have been two writers to one column.

**G-13.1 (plan) is closed by the same fact**: T138 moved here (C-29, 2026-08-17), EPIC-003's row
is struck, and the split criterion now reads consistently.

## `T210` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**

- **FR-019** — register additional engines and select one per project: registration is
  composition-time (FR-021 refusal at startup, EPIC-003); listing with capabilities is T140;
  per-project selection is the PATCH route + `ProjectEngineSelection` port. Two projects in one
  workspace can select different engines — asserted at the service layer.
- **SC-008** — a second engine with no change outside the adapter layer: demonstrated by
  EPIC-003's `engine-swap.spec.ts` (in CI) and untouched by this epic — this epic added a READ
  surface only, and T139a's read-only assertion keeps it that way.
- **Definition of done**: `/engines` returns capabilities, not only names — T139a's headline
  assertion; G-13.1 decided (above).
- **Composition seam** (shared with every closed epic): the API-side registry starts empty by
  design — engines are supplied at the worker's composition root. `GET /engines` on a composed
  deployment lists what that deployment accepted. Owner: EPIC-014 F-11.2, already recorded
  programme-wide.

## `T211` — defect triage

`specs/013-engine-api-selection/defects/` contains no records (only `.gitkeep`). **0 open.**

## `T212` — closing report

### Work Completed

- `backend/src/modules/engines/engines.controller.ts` — `GET /engines` with name, version,
  capabilities, and the default marked; read-only by asserted design; registered in
  `engines.module.ts`.
- `frontend/src/components/EngineSelector.tsx` — per-project selection control saving through
  `PATCH /projects/{id}`, "inherit default" as a first-class choice, capabilities shown for the
  chosen engine; `ApiClient.listEngines()` added; wired into the shell's project view.
- T138 discharged by decision + evidence rather than new code (above) — the behaviour existed;
  the decision it waited on is now taken and recorded.

### Not verified

- No live HTTP request has hit `/v1/engines` — the same composition seam as every sibling epic;
  all layers below are verified.
- The shell passes `value={null}` to the selector (initial display only — saving is correct
  regardless); the project-aware initial value belongs to EPIC-010's real interface.

### Deferred (owners per D-6)

| Item | Owner | Awaiting |
|---|---|---|
| Composed `GET /engines` showing a real deployment's accepted set | EPIC-014 F-11.2 | first composed environment |
| Selection control fed the project's current engine in the shell | EPIC-010 | the specification interface |

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T209)
- [x] Convergence reports no unbuilt work in scope (T210)
- [x] `defects/` contains no open records (T211)
- [x] Principle deltas hold (none declared); deferrals have valid owners (T212)
- [x] Closure recorded — this document; **EPIC-013 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

**`/speckit-implement EPIC-008`** — Specification Authoring & Generation. With EPIC-013 closed,
the generation wave's parallel track is done early; EPIC-008 is the widest unlock and every
dependency it names is delivered.
