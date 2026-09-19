---

description: "Task list for EPIC-015 — QA & Validation"
---

# Tasks: QA & Validation

**Epic**: `EPIC-015` | **Module**: M-12 | **Tasks**: 9

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (APPROVED; scope ruling
> T-106). The prior hold (decision D-10) is discharged; this epic implements **BR-0080**.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-12.1 · End-to-end validation

- [X] T145 [P] Implement Playwright end-to-end journey covering quickstart V1–V12 **including V11a observability** in `e2e/tests/full-journey.spec.ts`

## F-12.2 · Engine smoke and performance

- [X] T146 [P] Add nightly real-engine smoke test (quickstart V13) in `.github/workflows/nightly-engine.yml`
- [X] T147 [P] Add performance check asserting listing, search, and traceability views return in **under 1 second at the 95th percentile** with 500 specifications in one project (**SC-009**, quantified 2026-08-07), in `backend/tests/integration/scale.spec.ts`
- [X] T147a [P] Add a generation job outcome-rate measurement asserting SC-011 — 95% of requests complete or report a named failure within the configured wall-clock limit, **10 minutes by default** (FR-025, quantified 2026-08-07) — in `backend/tests/integration/job-outcome-rate.spec.ts`

## F-12.3 · Test completeness

- [X] T148 [P] Close every unit-test gap enumerated by the per-epic `/speckit-converge` runs (T154), and add an assertion that no implementation task across the 15 epics lacks a paired unit-test task, in `backend/tests/unit/` (Constitution V) — complete only when that assertion passes, not when the list "looks done"

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/015-qa-validation/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T217 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/015-qa-validation/closure.md`
- [X] T218 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/015-qa-validation/closure.md`
- [X] T219 Triage `specs/015-qa-validation/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/015-qa-validation/closure.md`
- [X] T220 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/015-qa-validation/closure.md`
