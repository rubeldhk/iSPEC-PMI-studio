# Epic Quality Checklist: Living Specifications & Impact

**Epic**: `EPIC-020` | **Tasks**: 22 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../017-enhancement-model/checklists/requirements.md](../../017-enhancement-model/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-17.4 – F-17.6, Phase Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12/D-16)
- [x] Dependencies on other epics stated — EPIC-019, EPIC-008, EPIC-009
- [x] Requirement IDs conform without collision — namespaced `FR-ENH-###`

## Split integrity *(ruling D-18)*

- [x] Every requirement owned (`FR-ENH-006`–`011`) is defined in the parent spec — no dangling reference
- [x] The owned set is disjoint from EPIC-019/021/022 — no requirement is claimed twice
- [x] The parent's split table agrees with this epic's own header on requirements and task count
- [x] Task IDs declared invariant and contiguous — `T251`–`T272`
- [x] User stories owned (US2, US3) appear exactly once across the family
- [x] Success criteria owned (`SC-ENH-002`, `003`, `006`, `009`) appear exactly once across the family
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded — PP-002, PP-018 (decision D-6)
- [x] The one partial principle (PP-018) states its own measurable bound — 500 specifications per
      project, `SC-ENH-003` — rather than asserting scalability generally

## Exit readiness

- [ ] All tasks complete with tests passing
- [ ] `/speckit-converge` reports no unbuilt work for this epic
- [ ] `defects/` has no open records
- [ ] Principle deltas still hold; deferrals retain valid owners

## Validation iteration — 2026-08-10

**All items pass.** No defects found. This epic's declarations, counts, ownership and exit criteria
were each verified against the parent and its siblings, and none diverged.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- **`currency_status` generalises FR-032, it does not duplicate it.** One field with a wider trigger;
  two independent staleness flags would eventually disagree.
- **`DependencyEdge` is deliberately a separate table from `TraceabilityLink`** (**R-017-3**).
  EPIC-022 reaches the *opposite* conclusion for the twelve-link chain, also deliberately — the two
  are not in conflict and neither should be "corrected" to match the other.
- ⚠️ Depends on EPIC-019 landing first for the organization tier.
