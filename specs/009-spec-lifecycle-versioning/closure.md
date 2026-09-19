# Closure record: EPIC-009 Specification Lifecycle & Versioning

**Date**: 2026-08-20 · **Session**: `/speckit-implement EPIC-009 EPIC-011 EPIC-016`, executed in
the isolated worktree branch `epic/009-011-016-lifecycle-wave` (concurrent-session rule; built in
two stages around EPIC-008's landing, integrated by merges in both directions) · **Released by**:
PMI-DOC-004 v1.0, scope ruling T-106.

## `T193` — every implementation task has a passing unit test (Constitution V)

**28 of 28 tasks complete.** Stage 1 (the pure core) was written test-first with an observed
import-failure red across 6 files before any implementation existed; Stage 2 (the
EPIC-008-gated remainder) likewise — the four endpoint test files failed to collect before
`lifecycle-api.service.ts` and the controller class were written.

| Implementation task | Paired test | Result |
|---|---|---|
| T099/T111 lifecycle machine + actor/time recording | T095 (gate, 8 tests) + T106 (guard, 8 tests incl. all 30 refused pairings) | pass |
| T099b baseline fork + archive | T099a `baseline-archive.spec.ts` (8) | pass |
| T110 append-only versioning | T105 `versioning.spec.ts` (7) | pass |
| T112 version diff | T107 `version-diff.spec.ts` (6) | pass |
| T109 `LifecycleTransition` model + migration | T106 + `schema-constraints`/`universal-columns` (updated) + **T459 executed** | pass |
| T460 `specification_versions_immutable` + `lifecycle_transitions_immutable` triggers + permitted-transition CHECK | **T459 `specification-version-immutability.spec.ts` — 7/7 on real PostgreSQL** | pass |
| T121 validation orchestration | T117 `validation-findings.spec.ts` (4) | pass |
| T122 approval surfacing findings | T118 `approval-findings.spec.ts` (4) | pass |
| T120 `ValidationFinding` model + migration | T117 + schema guards + migration CHECK (location non-empty) | pass |
| T113 six transitions + version endpoints | T112a `lifecycle.controller.spec.ts` (8) + **T108 contract (14)** | pass |
| T123 validation endpoints | T122a `validation.controller.spec.ts` (3) + **T119 contract (4)** | pass |

Suites at closure (integrated tree): 695 unit+frontend (79 files) · 100 contract · 22 arch ·
**65 integration on real PostgreSQL** · 777 governance · typecheck + lint clean.

## Design notes that will matter later

- **State moves through ONE write path.** EPIC-008's `updateSpecification` deliberately excludes
  `lifecycleState` and its PATCH strips it; `setLifecycleState` (added here to the store
  interface, both implementations) is the only writer, and it is reached only through the
  transition endpoints where the permitted set and the FR-014 record are enforced. The store's
  old two-argument test helper of the same name was absorbed into the real path.
- **The permitted set is enforced twice** — `assertTransition` in code and the
  `lifecycle_permitted_transition` CHECK in the migration — and **proven twice**: T106 walks all
  30 forbidden pairings in code; T459 shows the database refusing `approved → draft` raw.
- **A baselined edit is a fork, not a transition** (FR-011a): no transition row is written —
  the CHECK would refuse `baselined → draft`, and that refusal is the design, asserted by T099a.
- **Validate rides the same job machinery as generation** (`JobsValidationSubmission` over
  `JobsService` + `EngineResolverService`); the worker-side execution of `validate_specification`
  jobs consuming T121 is the generation worker's seam, same owner as generation execution.

## `T194` — convergence

Performed within this run per the `speckit-converge` method. **No unbuilt work found in scope.**
The one recorded seam is the platform-wide composition root (Prisma-backed stores + recorder), the
same deferral every closed epic carries — owner **EPIC-014 F-11.2**.

## `T195` — defect triage

`specs/009-spec-lifecycle-versioning/defects/` contains no records. **0 open.**

## `T196` — closing report

**Work completed**: `lifecycle.machine.ts`, `baseline.service.ts`, `version.service.ts`,
`version-diff.service.ts`, `validate-specification.service.ts`, `approval.service.ts`,
`lifecycle-api.service.ts`, the `SpecificationLifecycleController`
(in `specifications.controller.ts`, at the seam EPIC-008's header reserved by name), the
`LifecycleTransition`/`ValidationFinding` models, migration
`20260820130000_epic009_lifecycle_findings_adr_links`, and module wiring. **Deferred with
owners**: composition-root swap and worker-side validate execution → EPIC-014 F-11.2 / the
generation worker seam; frontend lifecycle surface → EPIC-010.

### Epic Exit Criteria

- [x] Every implementation task has a passing unit test (T193)
- [x] Convergence reports no unbuilt work in scope (T194)
- [x] `defects/` contains no open records (T195)
- [x] Principle deltas hold; deferrals have valid owners (T196)
- [x] Closure recorded — **EPIC-009 is CLOSED and release-eligible**
- [ ] Platform promotion — EPIC-014 F-11.2's

### Recommended Next Task

`/speckit-implement EPIC-010 EPIC-012` — the surface wave; both need this epic and it now exists.
