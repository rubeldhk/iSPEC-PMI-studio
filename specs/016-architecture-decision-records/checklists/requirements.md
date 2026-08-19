# Epic Quality Checklist: Architecture Decision Records

**Epic**: `EPIC-016` | **Tasks**: 2 | **Created**: 2026-08-03

Per-epic instance. The platform baseline is
[../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md); this records only
what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping
- [ ] `plan.md` present — **not yet planned**
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated (proceeding or held, decision D-10)

## Traceability

- [x] Requirements owned are declared and trace to the platform spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12)
- [x] Dependencies on other epics stated
- [ ] Requirement IDs conform to PMI-DOC-000 §3 — **blocked on decision D-1**

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded (decision D-6)

## Exit readiness

- [ ] All tasks complete with tests passing
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `defects/` has no open records
- [ ] Principle deltas still hold; deferrals retain valid owners

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- The one unchecked traceability item is **D-1** (typed four-digit identifiers), open by design and
  to be executed as one pass with D-9 and D-13.
