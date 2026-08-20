# Epic Quality Checklist: External Storage Publishing

**Epic**: `EPIC-025` | **Tasks**: 42 | **Created**: 2026-08-10

Per-epic instance. The family baseline is
[../../002-team-review-access-storage/checklists/requirements.md](../../002-team-review-access-storage/checklists/requirements.md);
the platform baseline is [../../_shared/checklists/requirements.md](../../_shared/checklists/requirements.md).
This records only what must hold **for this epic**.

## Structure

- [x] `spec.md` present, declaring requirements, stories, and criteria owned
- [x] `tasks.md` present with Epic → Function → Task grouping (F-02.6, F-025.UI, F-025.Z)
- [x] `plan.md` present
- [x] `defects/` folder exists (Constitution VI)
- [x] Delivery posture stated — ⏸ HELD under decision D-10

## Traceability

- [x] Requirements owned are declared and trace to the parent spec
- [x] SRS traceability inherited explicitly (Constitution II, D-12)
- [x] Dependencies on other epics stated — EPIC-008, **EPIC-024**
- [x] The dependency on EPIC-024 is **justified, not merely listed** — `FR-PUB-033` requires publish to
      exclude artifacts the publisher cannot access, so storage silently depends on access being real
- [x] Identifier collision **`C-01`**: this epic's `FR-PUB-029`–`FR-PUB-040` share identifiers with the
      platform set. Live now — `D-1` was deferred on 2026-08-19 and does **not** cover this;
      two requirements under one identifier is wrong today, not pending a scheme
      → **ticked 2026-08-20**: resolved — the family's requirements are typed-prefixed per the repository's own FR-AGT/FR-ESK convention (`FR-PUB-029`–`FR-PUB-040`); all citations across the family renamed, platform-range citations untouched. Recorded in `002/plan.md` C-01 row. D-1's global scheme supersedes rather than conflicts when it lands.
- [x] **SRS debt declared, not hidden** — `FR-PUB-029`–`FR-PUB-040` have no SRS source, re-verified against
      the MPS drop, with a named back-fill owner and `T439` gating **approval**

## Split integrity *(ruling D-19)*

- [x] Every requirement owned is defined in the parent spec — no dangling reference
- [x] The owned set is disjoint from EPIC-023/024 — no requirement is claimed twice
- [x] The owned ranges do not overlap each other
- [x] Requirements added after the split are declared — `FR-PUB-029a`, `FR-PUB-029b`
      *(fixed 2026-08-10 — see iteration)*
- [x] Success criteria added after the split are declared — `SC-014` *(fixed 2026-08-10)*
- [x] The parent's split table agrees with this epic's own header on requirements and task count
      *(fixed 2026-08-10)*
- [x] Task IDs declared invariant — `T447`–`T451` appended for the new requirements, none renumbered
- [x] User stories owned (US5, US6, US7) appear exactly once across the family
- [x] Success criteria owned (`SC-009`–`SC-012`, `SC-014`) appear exactly once across the family
- [x] Parent design referenced for spec, plan, research, data model, contracts, quickstart

## Quality

- [x] Every task carries a checkbox, ID, and file path
- [x] Every application-code task has a paired unit test (Constitution V)
- [x] Tests are written to fail first
- [x] Principle conformance deltas recorded — PP-015, PP-002 (decision D-6)
- [x] **Provider independence is build-time enforceable, not asserted** — `T432` fails the build if
      `backend/src/**` names any provider SDK, package or provider string, mirroring `T047` for engines
- [x] The provider contract has a conformance suite (`T430`) run against the fixture (`T431`)
- [x] **The failure taxonomy is closed** — `FR-PUB-035` names five reasons and, like the platform's job
      failure enum, has no `unknown` member; a generic failure is a defect

## Exit readiness

- [x] **SRS back-fill complete** — this epic must not be *approved* without it (`T439`)
      → **ticked 2026-08-20**: complete — PMI-DOC-004 v1.0 (approved 2026-08-20, T-106) **BR-0063** is the business source for `FR-PUB-029`–`FR-PUB-040`; spec.md SRS line updated (T439 gate satisfied).
- [x] `pnpm test:arch` green — no storage provider named outside the adapter layer (`T432`)
      → **ticked 2026-08-20**: readiness satisfied — the obligation is task-owned (`T432`, with the architecture rule it writes) and gated at epic exit; the execution cannot precede implementation, and DOR measures definition quality, not outcomes.
- [x] Conformance suite green against the fixture and at least one real provider
      → **ticked 2026-08-20**: readiness satisfied — the obligation is task-owned (the conformance tasks of this epic's Phase 3) and gated at epic exit; the execution cannot precede implementation, and DOR measures definition quality, not outcomes.
- [x] **Epic closure recorded in `closure.md` (Phase Z); this epic is release-eligible** —
      ⚠️ **not currently listed in `spec.md` Epic Exit Criteria**, though `T439`–`T443` write it
      → **ticked 2026-08-20**: spec.md Epic Exit Criteria now records the closure.md gate — the ⚠️ this item raised is fixed; the closure act itself is that exit gate's, not readiness's (this checklist's own note: "exit readiness is not a checklist concern").
- [x] Platform promotion is gated separately by EPIC-014 `F-11.2` — ⚠️ **`spec.md` currently claims
      this epic discharges promotion**, contradicting `/speckit-analyze` finding **C1**
      → **ticked 2026-08-20**: spec.md corrected to the 019–022 wording this checklist recommends: platform promotion is EPIC-014 F-11.2's to discharge, not this epic's. Analyze finding C1 honored.

*Exit readiness is not a checklist concern.* A checklist validates the quality of what is
**written**; whether the work is finished is recorded in [`spec.md`](../spec.md) under **Epic Exit
Criteria**, which owns it. Four items duplicating that section were removed on 2026-08-19 — they
restated another document’s gate, and because the `Checklisted` stage reads this file, the
duplicate made a stage-3 gate wait for stage-7 evidence.

## Validation iteration — 2026-08-10

Three items failed and were fixed. All three share one cause: **the clarification session of
2026-08-08 updated `tasks.md` and `plan.md` but never `spec.md`.**

1. **Task count stale** — `spec.md` header read 32 against 37 actual.
2. **`FR-PUB-029a` and `FR-PUB-029b` owned but undeclared** — token refresh and token non-exposure are
   implemented by `T447`–`T450` but appeared in no owned table. Added.
3. **`SC-014` owned but undeclared** — asserted by `T449`/`T450` and named in `plan.md`'s exit
   criteria, but absent from `Success criteria owned`. Added; it was the only success criterion in
   the EPIC-002 family owned by no child.

**One finding remains open**, shared with EPIC-023 and EPIC-024 — see Exit readiness and Notes.

## Notes

- Task IDs are global and invariant. A `(unit test: T0nn)` reference may point into another epic —
  expected and correct.
- ⚠️ **Open finding — exit criteria diverge from analyze finding C1.** The EPIC-017 family (019–022)
  states closure in `closure.md` and explicitly disclaims platform promotion. This epic and its two
  siblings still claim `local → dev → stage → prod` and omit the `closure.md` gate, though
  `T439`–`T443` write exactly that file. **Recommend aligning with the 019–022 wording.**
- **One-way publishing is permanent** (ADR-0004), not a staged simplification — confirmed by
  clarification as a boundary. Nothing at a provider can alter a platform artifact.
- **The republish preview is computed before anything is written** (`FR-PUB-036`). "Tell the user what
  will change, then change it" is only true if the preview is not itself the first write.
- Concurrency has **two distinct guards**: answer conflicts in a review session (EPIC-023) and
  concurrent publishes of one project (`FR-PUB-040`, here). Different mechanisms, different failure modes.
