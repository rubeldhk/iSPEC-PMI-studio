# Epic Quality Checklist: Review Gates & Roles

**Epic**: `EPIC-021` | **Tasks**: 23 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../017-enhancement-model/checklists/requirements.md](../../017-enhancement-model/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-17.7, F-17.8, F-17.11, F-17.12, Phase Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12/D-16)
- [x] Dependencies on other epics stated — EPIC-019, EPIC-009, EPIC-003
- [x] Requirement IDs conform without collision — namespaced `FR-ENH-###`

## Split integrity *(ruling D-18)*

- [x] Every requirement owned (`FR-ENH-012`–`016`, `023`, `024`) is defined in the parent spec
- [x] The owned set is disjoint from EPIC-019/020/022 — no requirement is claimed twice
- [x] The parent's split table agrees with this epic's own header on requirements and task count
- [x] Task IDs declared invariant and contiguous — `T273`–`T295`
- [x] User story owned (US4) appears exactly once across the family
- [x] Success criteria owned (`SC-ENH-004`, `005`) appear exactly once across the family
- [x] **`F-17.12` is a function this epic added after the split** and is now reflected in the parent's
      split table — a child may extend the function set, but the parent must say so
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded — PP-003, PP-016, PP-017 (decision D-6)
- [x] The deferred principle (PP-017) names an owner and a concrete containment task, not an intention
- [x] The inherited **A1** ambiguity is resolved — `FR-011` enumerates eight permitted transitions
      across six endpoints, so `T277` can assert refusal by name

## Exit readiness

- [ ] RAID **R-02** re-scored against the twelve-role profile (`T291`)
- [ ] Conformance cases **C-17** to **C-20** green

*Exit readiness is not a checklist concern.* A checklist validates the quality of what is
**written**; whether the work is finished is recorded in [`spec.md`](../spec.md) under **Epic Exit
Criteria**, which owns it. Four items duplicating that section were removed on 2026-08-19 — they
restated another document’s gate, and because the `Checklisted` stage reads this file, the
duplicate made a stage-3 gate wait for stage-7 evidence.

## Validation iteration — 2026-08-10

One item failed and was fixed:

1. **`F-17.12` existed in this epic's `plan.md` and `tasks.md` but in neither of the parent's two
   function tables.** A child that adds a function without the parent recording it makes the parent's
   split table wrong. Added to `017/plan.md` and `017/spec.md`.

Everything else passes. Notably, the R-02 re-scoring obligation this epic inherits **is** discharged
by a real task (`T291`) rather than left as an exit-criteria sentence with no owner.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- ⚠️ **This epic carries the whole PP-017 cost exposure of the family.** Twelve roles per gate is
  twelve model invocations, with M-07's optimisation controls deferred. **Twelve is the maximum, not
  the default** — gates should name only the roles a transition actually needs.
- An unavailable role **fails** the gate. Unavailability is a named outcome, never a silent pass.
