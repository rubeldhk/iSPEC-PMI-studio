# Epic Quality Checklist: Steering Engine

**Epic**: `EPIC-019` | **Tasks**: 27 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../017-enhancement-model/checklists/requirements.md](../../017-enhancement-model/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-17.1 – F-17.3, Phase Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12/D-16)
- [x] Dependencies on other epics stated — EPIC-004, EPIC-008, EPIC-003
- [x] Requirement IDs conform without collision — namespaced `FR-ENH-###`, so **conflict C-01 is
      avoided** and decision D-1 does not block this epic

## Split integrity *(ruling D-18)*

- [x] Every requirement owned (`FR-ENH-001`–`005`) is defined in the parent spec — no dangling reference
- [x] The owned set is disjoint from EPIC-020/021/022 — no requirement is claimed twice
- [x] The parent's split table agrees with this epic's own header on requirements and task count
- [x] Task IDs declared invariant and contiguous — `T225`–`T250`, plus `T246a`
- [x] User story owned (US1) appears exactly once across the family
- [x] Success criterion owned (`SC-ENH-001`) appears exactly once across the family
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded — PP-001, PP-006, PP-014 (decision D-6)
- [x] The PP-006 defence names a check that can actually detect the regression it guards

## Exit readiness

- [ ] Conformance cases **C-14** to **C-16** green against both adapters
- [ ] `pnpm test:arch` green including `T246a`

*Exit readiness is not a checklist concern.* A checklist validates the quality of what is
**written**; whether the work is finished is recorded in [`spec.md`](../spec.md) under **Epic Exit
Criteria**, which owns it. Four items duplicating that section were removed on 2026-08-19 — they
restated another document’s gate, and because the `Checklisted` stage reads this file, the
duplicate made a stage-3 gate wait for stage-7 evidence.

## Validation iteration — 2026-08-10

Three items failed and were fixed:

1. **PP-006 defended by a check that could not detect the breach.** `spec.md` and `tasks.md` both
   named `T047`/`T142` as the backstop against steering being formatted into a prompt. Those tests
   match engine *names*; a prompt assembled from steering text names no engine and passes them.
   **`T246a` added** to fail the build on steering-to-prompt assembly, and both claims corrected.
2. **Task count stale** — 26 recorded in four places against 27 actual. Corrected.
3. **Parent split table** did not carry `T246a`. Corrected in `017/plan.md` and `017/spec.md`.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- ⚠️ **This epic must land first in the family.** `F-17.1` adds a tenancy scope above workspace —
  a column while no workspace rows exist, a data migration afterwards (research **R-017-1**).
- Steering is **additive**: a project with no steering must behave exactly as the platform does today.
