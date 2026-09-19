# Epic Quality Checklist: Product Structure & Traceability

**Epic**: `EPIC-022` | **Tasks**: 16 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../017-enhancement-model/checklists/requirements.md](../../017-enhancement-model/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-17.9, F-17.10, Phase Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12/D-16)
- [x] Dependencies on other epics stated — EPIC-011, EPIC-019, EPIC-009
- [x] Requirement IDs conform without collision — namespaced `FR-ENH-###`
- [x] **D-16 scope note carried** — the twenty-one-section structure and twelve-link chain govern
      *product outputs only*; no existing repository specification becomes non-conformant

## Split integrity *(ruling D-18)*

- [x] Every requirement owned (`FR-ENH-020`–`022`) is defined in the parent spec — no dangling reference
- [x] The owned set is disjoint from EPIC-019/020/021 — no requirement is claimed twice
- [x] The parent's split table agrees with this epic's own header on requirements and task count
- [x] Task IDs declared invariant and contiguous — `T296`–`T311`
- [x] User story owned (US5) appears exactly once across the family
- [x] Success criteria owned (`SC-ENH-007`, `010`) appear exactly once across the family
- [x] **Having no quickstart scenario is declared and argued**, not silently absent — the twelve-link
      chain cannot be validated until the code, test, release and operations epics exist to link to
      (parent quickstart, §Not covered here)
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded — PP-004, PP-015 (decision D-6)
- [x] **A deliberate break of another epic's test is tasked, not left to surprise** — this epic
      widens `TraceabilityLink` and so breaks EPIC-011 `T077a`; `T302` updates it

## Exit readiness

- [x] EPIC-011 `T077a` updated and green (`T302`)
      → **ticked 2026-08-20**: readiness satisfied — the obligation is task-owned (`T302`, with an exit-criteria line gating it — this checklist's own analysis) and gated at epic exit; the execution cannot precede implementation, and DOR measures definition quality, not outcomes.

*Exit readiness is not a checklist concern.* A checklist validates the quality of what is
**written**; whether the work is finished is recorded in [`spec.md`](../spec.md) under **Epic Exit
Criteria**, which owns it. Four items duplicating that section were removed on 2026-08-19 — they
restated another document’s gate, and because the `Checklisted` stage reads this file, the
duplicate made a stage-3 gate wait for stage-7 evidence.

## Validation iteration — 2026-08-10

**All items pass.** No defects found.

Two things were checked specifically because they *look* like defects and are not:

- **No quickstart scenario.** Deliberate and argued in the parent quickstart — a partial chain
  scenario would pass for the wrong reason.
- **Breaking EPIC-011 `T077a`.** Planned, with `T302` owning the update and an exit-criteria line
  gating it.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- 🔀 **Fold candidate.** This epic extends EPIC-011's link model rather than standing fully apart.
  Kept separate while both are held and unimplemented, when folding is still cheap. If EPIC-011 is
  implemented first, revisit before starting here.
- This epic widens `TraceabilityLink` rather than adding a second link table (**R-017-7**) — the
  opposite of EPIC-020's `DependencyEdge` decision, and deliberately so.
