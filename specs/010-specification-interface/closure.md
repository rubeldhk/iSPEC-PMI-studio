# Closure record: EPIC-010 Specification Interface

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-010 EPIC-012`, executed in the
isolated worktree branch `epic/009-011-016-lifecycle-wave` (concurrent-session rule) · **Released
by**: PMI-DOC-004 v1.0.

## `T197` — every implementation task has a passing unit test (Constitution V)

**15 of 15 implementation tasks complete**, every component written test-first with an observed
red (all 7 spec files failed collection on unresolved component imports before any component
existed).

| Implementation task | Paired test | Result |
|---|---|---|
| T083d specification list page (FR-012, FR-032 flag in list) | T083c `SpecificationList.spec.tsx` (4) | pass |
| T084 specification detail — engine, version, out-of-date (FR-022/FR-032) | T083e `Specification.spec.tsx` (4) | pass |
| T085 inline job progress — polls, stops at terminal, never a dialog (FR-026/FR-028) | T084a `JobProgress.spec.tsx` (4, fake timers) | pass |
| T114 version history, newest first (FR-013) | T113a `VersionHistory.spec.tsx` (3) | pass |
| T115 version diff — direction machine-readable via `data-change` (FR-014) | T114a `VersionDiff.spec.tsx` (2) | pass |
| T116 lifecycle controls — M08 §8 map mirrored, invalid transitions **not offered** | T115a `LifecycleControls.spec.tsx` (6, all six states walked) | pass |
| T124 findings panel — location + severity per finding, `data-severity` (FR-017/FR-018) | T123a `ValidationFindings.spec.tsx` (3) | pass |
| api client extension (types + 13 methods, `Page<T>` shape) | exercised by every component spec above | pass |

**T124a (SC-001 e2e)**: `e2e/tests/sc-001-journey.spec.ts` is **authored, not yet measured**. No
e2e infrastructure existed; this run added the `e2e` workspace package (`playwright.config.ts`,
`@playwright/test`). The journey requires a running stack (PostgreSQL, backend, frontend, an
engine); the exact run steps are recorded at the top of the spec file. Per Constitution IX an
unrun measurement is not reported as a measurement — **SC-001 remains open until that command
passes**.

Suites at closure: frontend 71 (15 files) · backend-unit + contract + architecture 805 (89
files) · governance re-run after register refresh · frontend and backend typecheck clean.

## Design notes that will matter later

- **The permitted-transition map exists twice by design** — `assertTransition` server-side and
  `PERMITTED` in `LifecycleControls.tsx`. They must change together; T115a walks all six states
  and counts the buttons, so a divergence fails the suite.
- **Out-of-date is a flag, never an auto-correction** (FR-032): the list shows it per row, the
  detail view exposes it as `role="status"`, and nothing in the UI regenerates without a human.
- **JobProgress is the only poller.** It stops itself at terminal states; anything else that
  needs job completion listens to its `onSettled`, rather than polling again.

## `T198` — convergence

Performed within this run per the `speckit-converge` method, bounded to the artifacts named in
spec/plan/tasks. **No unbuilt work found in scope.** The frontend has no app shell/router
(`main.tsx` only); neither plan.md nor tasks.md names one, so page composition is the frontend
half of the platform composition seam — owner **EPIC-014 F-11.2**, the same deferral every
closed epic carries for the backend composition root.

## `T199` — defect triage

`specs/010-specification-interface/defects/` contains no records. **0 open.**

## `T200` — closing report

**Work completed**: `frontend/src/pages/SpecificationList.tsx`, `frontend/src/pages/Specification.tsx`,
`frontend/src/components/JobProgress.tsx`, `VersionHistory.tsx`, `VersionDiff.tsx`,
`LifecycleControls.tsx`, `ValidationFindings.tsx`, the api-client extension in
`frontend/src/services/api.ts`, their 7 test files, and the new `e2e` package with
`sc-001-journey.spec.ts`. **Not done, recorded honestly**: SC-001 execution (see T197) and the
WCAG 2.2 AA exit criterion below.

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T197)
- [x] Convergence reports no unbuilt work in scope (T198)
- [x] `defects/` contains no open records (T199)
- [ ] **WCAG 2.2 AA — NOT DISCHARGED.** No automated accessibility checks exist in CI and no
  manual keyboard/screen-reader pass has been performed. Deferred with owner **EPIC-015
  (QA & validation)** as the natural home for automated a11y gates, subject to the user's
  standing smoke-gate ruling. The components were built with the primitives that pass depends
  on (semantic roles, `role="status"`/`role="alert"` live regions, labels on every control,
  `data-*` state not color-only) — but building for the audit is not the audit.
- [x] Principle deltas hold; deferrals have valid owners (T200)
- [x] Closure recorded — **EPIC-010 is CLOSED except the WCAG criterion above**; release
  eligibility carries that named condition
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-015` — it owns the two open conditions here (WCAG automation, and the
QA harness the SC-001 e2e run needs).
