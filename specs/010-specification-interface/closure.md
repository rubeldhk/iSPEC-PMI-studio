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
- [ ] **WCAG 2.2 AA — automated half DELIVERED, manual half open.** EPIC-015 (same day)
  delivered `frontend/tests/unit/a11y/components-axe.spec.tsx`: axe-core over all 8
  EPIC-010/012 surfaces, zero violations, running in the per-commit suite CI executes. What
  remains is the **manual keyboard and screen-reader pass** — human work that cannot be
  automated honestly; owner: the user (or a QA session with a real browser and screen reader).
  The criterion's box stays unchecked until that pass is recorded.
- [x] Principle deltas hold; deferrals have valid owners (T200)
- [x] Closure recorded — **EPIC-010 is CLOSED except the WCAG criterion above**; release
  eligibility carries that named condition
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-015` — it owns the two open conditions here (WCAG automation, and the
QA harness the SC-001 e2e run needs).

---

## Phase C — `DEF-010-001`, closed 2026-08-23

**The defect**: nine page components existed and `main.tsx` imported four.
`Specification`, `SpecificationList`, `Tasks`, `ReviewSession` and
`StorageConnections` were imported by nothing, anywhere in `frontend/src/` —
five delivered capabilities a user could not reach at all. The eighth
built-but-never-wired defect in this programme, and the largest.

**The decision (`T200b`)**: route all five. Four chain off the existing project
view, which already holds the ids they need. `ReviewSession` needed a `runId`
and nothing produced one, so the run list was built (`T200d`) rather than having
the shell invent an id.

**`T200c` — mutation observation, recorded as required by Constitution V.**
`T200a` (`frontend/tests/unit/design/page-reachability.spec.ts`) was verified by
removing the `RunsPage` import from `frontend/src/main.tsx` and re-running it:

```
× T200a · every delivered page is reachable from the application root
    → expected [ 'pages/Runs.tsx' ] to deeply equal []
```

The check failed, and named exactly the page whose route was removed — not a
generic failure, and not a false pass. The import was restored and the check
returned to green (4 of 4). Observed 2026-08-23.

**What `T200a` still does not cover, stated so the closure is not read as more
than it is**: reachability of a **route**. A page imported and rendered inside a
view state that no control ever sets would pass it. Proving that needs a driven
browser run enumerating the navigation graph — `T900a`'s tier.
`shell-page-routes.spec.ts` (`T200e`) closes part of the gap by clicking the
real controls, but only for the routes it knows to click.
