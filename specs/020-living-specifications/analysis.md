# Analysis: Living Specifications & Impact

**Epic**: `EPIC-020` · **Session**: 2026-08-19

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

## Findings

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| F1 | Coverage Gap | MEDIUM | 6 of 6 owned requirements are cited by no task or feature note: `FR-ENH-006`, `FR-ENH-007`, `FR-ENH-008`, `FR-ENH-009`, `FR-ENH-010`, `FR-ENH-011` | `traceability-convention.md` makes **Feature → requirements it satisfies** mandatory, carried in the `F-<epic>.<n>` framing note. The work is described; the link is not. MEDIUM rather than HIGH because this is a missing trace, not missing coverage |
| F2 | Underspecification | MEDIUM | No dated clarification session is recorded in `spec.md` | Run `/speckit-clarify`. Until then the register holds this Epic at `Specified` however far its plan and tasks have gone — `FR-ESK-018` derives the stage from a recorded session, never from the absence of markers |

**Blocking findings (CRITICAL or HIGH): 0.** `DOR-09` is satisfied.

## Coverage

| Measure | Value |
|---|---|
| Requirements owned | 6 — `FR-ENH-006`, `FR-ENH-007`, `FR-ENH-008`, `FR-ENH-009`, `FR-ENH-010`, `FR-ENH-011` |
| Owned requirements cited by a task or feature note | 0 of 6 |
| Tasks listed | 22 |
| Feature sections | 3 |
| Vague terms (config list) | 0 |
| Unresolved placeholders | 0 |
| `[NEEDS CLARIFICATION` markers | 0 |
| Constitution-mandated sections present | 3 of 3 |
| Clarification session recorded | no |

## Method

Run by `/speckit-analyze` as one pass across every Epic carrying a `tasks.md`, on 2026-08-19.
The detection passes this record reports are **measured**, not judged: requirement ownership and
citation, task counts against those the documents state, the vague-term list in
[`governance.config.json`](../../governance/governance.config.json), unresolved placeholders and
`[NEEDS CLARIFICATION` markers outside inline code, the constitution-mandated sections, and the
plan's Constitution Check gate.

**What that does and does not buy.** Every finding below is reproducible and cites what was counted.
A systematic pass will not catch what only a careful human read of this Epic's subject matter would —
EPIC-027's own closure records exactly that limit, where eight of ten sampled clause verdicts held
and two were wrong in ways no completeness check could see. This record claims the passes ran and
what they returned; it does not claim a domain expert read the specification.
