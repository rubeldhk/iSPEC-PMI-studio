---

description: "Task list for EPIC-015 — QA & Validation"
---

# Tasks: QA & Validation

**Epic**: `EPIC-015` | **Module**: M-12 | **Tasks**: 5

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification
> and approved business scope (PMI-TASK-001 T-101, T-106). Held is not cancelled — these
> tasks are complete, reviewed, and Constitution V compliant. They await an input.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-12.1 · End-to-end validation

- [ ] T145 [P] Implement Playwright end-to-end journey covering quickstart V1–V12 **including V11a observability** in `e2e/tests/full-journey.spec.ts`

## F-12.2 · Engine smoke and performance

- [ ] T146 [P] Add nightly real-engine smoke test (quickstart V13) in `.github/workflows/nightly-engine.yml`
- [ ] T147 [P] Add performance check for 500 specifications per project in `backend/tests/integration/scale.spec.ts`
- [ ] T147a [P] Add a generation job outcome-rate measurement asserting SC-011 — 95% of requests complete or report a named failure within the time limit — in `backend/tests/integration/job-outcome-rate.spec.ts`

## F-12.3 · Test completeness

- [ ] T148 [P] Fill remaining unit-test gaps in `backend/tests/unit/` (Constitution V)
