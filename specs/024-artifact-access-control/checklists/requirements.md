# Epic Quality Checklist: Artifact Access Control

**Epic**: `EPIC-024` | **Tasks**: 21 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../002-team-review-access-storage/checklists/requirements.md](../../002-team-review-access-storage/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-02.5, F-024.UI, F-024.Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12)
- [x] Dependencies on other epics stated — EPIC-004, EPIC-008, **EPIC-023**
- [x] The dependency on EPIC-023 is **justified, not merely listed** — `FR-028` snapshots access at
      run start, and a snapshot cannot be taken against a `Run` that does not exist
- [ ] Requirement IDs conform to PMI-DOC-000 §3 — **blocked on decision D-1** (conflict **C-01**;
      `FR-021`–`FR-028` collide with the platform set)
- [x] No SRS debt — unlike its siblings, this capability area is traced

## Split integrity *(ruling D-19)*

- [x] Every requirement owned (`FR-021`–`FR-028`) is defined in the parent spec — no dangling reference
- [x] The owned set is disjoint from EPIC-023/025 — no requirement is claimed twice
- [x] The owned range is contiguous with no internal overlap
- [x] The parent's split table agrees with this epic's own header on requirements and task count
- [x] Task IDs declared invariant — a `(unit test: T0nn)` reference may point at a sibling epic
- [x] User story owned (US4) appears exactly once across the family
- [x] Success criteria owned (`SC-007`, `SC-008`, `SC-013`) appear exactly once across the family
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance delta recorded — PP-008 (decision D-6)
- [x] **Database-level claims are tested against a real database, not a mock** — `SC-007` and
      `FR-027` are claims about what a real query returns, so `T427`/`T428` use Testcontainers
      (gap G-02.5). A mocked repository passes while the real query leaks
- [x] The controller carries both a unit test (`T418`) and a contract test (`T419`)

## Exit readiness

- [ ] **Epic closure recorded in `closure.md` (Phase Z); this epic is release-eligible** —
      ⚠️ **not currently listed in `spec.md` Epic Exit Criteria**, though `T435`–`T438` write it
- [ ] Platform promotion is gated separately by EPIC-014 `F-11.2` — ⚠️ **`spec.md` currently claims
      this epic discharges promotion**, contradicting `/speckit-analyze` finding **C1**

*Exit readiness is not a checklist concern.* A checklist validates the quality of what is
**written**; whether the work is finished is recorded in [`spec.md`](../spec.md) under **Epic Exit
Criteria**, which owns it. Four items duplicating that section were removed on 2026-08-19 — they
restated another document’s gate, and because the `Checklisted` stage reads this file, the
duplicate made a stage-3 gate wait for stage-7 evidence.

## Validation iteration — 2026-08-10

**All ownership, traceability and quality items pass.** No defects found in this epic's declarations.

**One finding remains open**, shared with EPIC-023 and EPIC-025 — see Exit readiness and Notes. It is
recorded rather than silently corrected, because it changes an exit gate.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- ⚠️ **Open finding — exit criteria diverge from analyze finding C1.** The EPIC-017 family (019–022)
  states closure in `closure.md` and explicitly disclaims platform promotion, per finding **C1**.
  This epic and its two siblings still claim `local → dev → stage → prod` and omit the `closure.md`
  gate, though `T435`–`T438` write exactly that file. **Recommend aligning with the 019–022 wording.**
- **Hiding is not the same as refusing.** `FR-024` requires an inaccessible artifact to be *absent*
  from listings, not shown as a locked placeholder — a placeholder discloses existence, which is the
  same reasoning behind EPIC-004's 404-not-403 rule.
- **The last-editor guarantee is a system invariant, not a validation.** `FR-027` must hold under
  concurrent revocation, so it is enforced inside the revoke transaction rather than pre-checked.
- ⚠️ This is a **deliberate, bounded advance** on the SRS roadmap, which places governance in
  Phase 3. Roles, groups, inherited organisational permissions and SSO stay there.
