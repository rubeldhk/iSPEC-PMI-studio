# Specification Analysis: EPIC-045 — Artifact Sync and Markdown Viewer

**Session**: 2026-09-05

**Inputs**: [spec.md](./spec.md) (clarified 2026-09-05) · [plan.md](./plan.md) · [tasks.md](./tasks.md)
(`T1620`–`T1681`) · `.specify/memory/constitution.md` v1.6.1

**Method**: requirements inventory (44 `FR-ART-`, 8 `SC-ART-`), user-story and edge-case inventory,
task-to-requirement mapping by identifier and key phrase, six detection passes (duplication,
ambiguity, underspecification, constitution alignment, coverage, inconsistency), plus a check of
every file path a task names against the repository and of every implementation task against the
pairing detector `T148` and the ticked-path check `G-26-14` that judge tasks at implement time.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| U1 | Underspecification | HIGH | plan.md (Source Code), tasks.md T1660, T1661 | The specification detail is named `frontend/src/pages/SpecificationDetail.tsx` with test `frontend/tests/unit/pages/specification-detail.spec.tsx`; the real files are `frontend/src/pages/Specification.tsx` and `frontend/tests/unit/pages/Specification.spec.tsx`. Ticking T1660/T1661 as written fails `G-26-14`, and the work would target a file that does not exist | Rename the paths in T1660, T1661 and the plan's source tree |
| U2 | Underspecification | MEDIUM | tasks.md T1668 | Names `packages/workspace-bundle/tests/hook-sequences.spec.ts (or finish.spec.ts)`; neither exists (`first-run.spec.ts` and `extension-conformance.spec.ts` do). Its "adjust only the line text in `hook-sequences.ts`" clause would add a success line the finish prompt does not specify (`finish.md` prints only refusals and the completion), drifting the harness from the prompt against `FR-ART-046` | Point T1668 at `first-run.spec.ts`; restrict it to asserting that `runFinish` completes on the live answer and adds no new line |
| U3 | Underspecification | MEDIUM | tasks.md T1645, T1665 | Hedged paths: `tests/governance/env-example.spec.ts if present` and `frontend/tests/architecture/no-raw-html.spec.ts (or extend …)`. Neither `frontend/tests/architecture/` nor `env-example.spec.ts` exists; a ticked task naming an absent path fails `G-26-14` (`DEF-001-003`) | Name one real target each: `tests/governance/readme-conformance.spec.ts` for T1645; a new `frontend/tests/unit/design/no-raw-html.spec.ts` for T1665 |
| K1 | Constitution V | MEDIUM | tasks.md T1673 | Registers `frontend/src/pages/EpicFiles.tsx` and the corpus in the layout with only "(layout check)"; `T148`'s pairing detector accepts `unit test`, `contract test`, `integration test`, `architecture test`, `conformance check`, `conformance: T…`, `test: T…` or a `tests/` path — none present, so the task reads as source-writing without a test and `T148` goes red at implement | Pair it: "(conformance: `tests/governance/layout.spec.ts`)" |
| C1 | Coverage | MEDIUM | spec.md FR-ART-007; tasks.md Phases 3–4 | The backend read for unbound syncs is built and tested (T1641, T1644) but no task shows the files of unbound executions "with the board's unbound executions" on the board | Add a task extending `frontend/src/pages/JourneyBoard.tsx` and `frontend/tests/unit/pages/journey-board.spec.tsx` (a file count and link per unbound execution) |
| C2 | Coverage | MEDIUM | spec.md FR-ART-035; tasks.md T1650, T1654 | No task expects the tree to note when the Epic's slug differs from a synced directory name | Add the expectation to T1654 and its implementation to T1655 |
| I1 | Inconsistency | MEDIUM | spec.md §Edge Cases (two executions within the same second); data-model.md §5 | The spec says the current version is the one whose execution *completed later*; the data model says the *newest sync*. A sync precedes its completion, so the two agree in practice, but they read as two rules | State in data-model.md §5 that *current* is by sync time and why that satisfies the spec's wording |
| I2 | Inconsistency | LOW | data-model.md §2, §5 | The tree shows command, outcome and time per version, but `artifact_syncs` stores only the execution id; the join to `executions`/`execution_events` is unstated | Note the executions join in the tree query (`R-045-7`) |
| C3 | Coverage | LOW | spec.md SC-ART-006 (render half) | Tree timing is measured (T1656); rendering a 500 KiB file under 2 s on the stack is measured by no task | Add the measurement to T1667's transcript and T1670's results |
| A1 | Ambiguity | LOW | spec.md FR-ART-006; research.md R-045-8 | The spec says an idempotency key "MUST be accepted and recorded"; only the plan says one is derived when the hook sends none | Acceptable as a plan decision; record it in the closure |
| T1 | Terminology | LOW | spec.md Key Entities; PMI-DOC-007 §3; data-model.md §1 | *Artifact version* (spec) / `ArtifactFile` (replan) / `ArtifactVersion` (plan) | One line in data-model.md §1 noting the rename from the replan's sketch |

No duplication finding is actionable. No constitution MUST is violated; `K1` is a Constitution V
pairing the repository's own check would catch.

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
|---|---|---|---|
| FR-ART-001 | Yes | T1623, T1624, T1632, T1633 | |
| FR-ART-002 | Yes | T1629, T1631 | |
| FR-ART-003 | Yes | T1632, T1634 | |
| FR-ART-004 | Yes | T1630, T1631, T1633 | |
| FR-ART-005 | Yes | T1623, T1632 | |
| FR-ART-006 | Yes | T1623, T1632, T1633 | concurrent + retried, written first |
| FR-ART-007 | Partial | T1641, T1644 | board UI missing — C1 |
| FR-ART-008 | Yes | T1629, T1630, T1631, T1645 | |
| FR-ART-009 | Yes | T1641, T1642, T1654 | |
| FR-ART-010 | Yes | T1650 | |
| FR-ART-011 | Yes | T1650, T1651, T1652, T1653 | |
| FR-ART-012 | Yes | T1642, T1650 | |
| FR-ART-013 | Yes | T1654, T1655 | |
| FR-ART-014 | Yes | T1642, T1654, T1656 | |
| FR-ART-015 | Yes | T1650, T1652 | |
| FR-ART-016 | Yes | T1654 | |
| FR-ART-017 | Yes | T1646, T1647 | |
| FR-ART-018 | Yes | T1647, T1650 | |
| FR-ART-019 | Yes | T1660, T1661 | paths wrong — U1 |
| FR-ART-020 to FR-ART-023 | Yes | T1663, T1664 | |
| FR-ART-024 | Yes | T1662, T1663, T1678 | |
| FR-ART-025 | Yes | T1646, T1647 | |
| FR-ART-030 to FR-ART-034 | Yes | T1635, T1636, T1658, T1659 | |
| FR-ART-035 | No | — | C2 |
| FR-ART-040 | Yes | T1639, T1640 | |
| FR-ART-041 | Yes | T1637, T1638 | |
| FR-ART-042 | Yes | T1637, T1644 | |
| FR-ART-043 | Yes | T1637 | |
| FR-ART-044 | Yes | T1632, T1633, T1641 | |
| FR-ART-045 | Yes | T1640, T1671 | |
| FR-ART-046 | Yes | T1633, T1668 | T1668 — U2 |
| FR-ART-050 | Yes | T1633, T1637 | |
| FR-ART-051 | Yes | T1637, T1644 | |
| FR-ART-052 | Yes | T1632 | |
| FR-ART-053 | Yes | T1630, T1641, T1678 | |
| FR-ART-060 | Yes | T1628, T1647, T1673, T1681 | T1673 — K1 |
| FR-ART-061 | Yes | T1627, T1628, T1665, T1666 | |
| SC-ART-001 | Yes | T1633 | |
| SC-ART-002 | Yes | T1623, T1633, T1678 | |
| SC-ART-003 | Yes | T1667, T1677 | |
| SC-ART-004 | Yes | T1663, T1678 | |
| SC-ART-005 | Yes | T1656 | |
| SC-ART-006 | Partial | T1656 | render half — C3 |
| SC-ART-007 | Yes | T1658 | |
| SC-ART-008 | Yes | T1650 | |

**Constitution Alignment Issues**: none at the MUST level.

**Unmapped Tasks**: none (T1670 and T1674 are record-keeping tasks mapped to the closure phase).

## Metrics

- Total requirements: 52 (44 `FR-ART-`, 8 `SC-ART-`)
- Total tasks: 62
- Coverage: 50 of 52 have at least one task (96%); two partial (`FR-ART-007`, `SC-ART-006`), one
  absent (`FR-ART-035`)
- Ambiguity count: 1 (`A1`, LOW)
- Duplication count: 0
- Critical issues: 0 · HIGH: 1 · MEDIUM: 6 · LOW: 4

## Next Actions

No CRITICAL finding blocks `/speckit-implement`. The HIGH finding (`U1`) and the four MEDIUM
task-text findings (`U2`, `U3`, `K1`, and the two coverage gaps `C1`, `C2`) are corrections to
`tasks.md` and `plan.md`/`data-model.md` text that cost minutes now and a red governance run
later. Recommended: apply the remediation, then run `/speckit-implement for EPIC-045`.
