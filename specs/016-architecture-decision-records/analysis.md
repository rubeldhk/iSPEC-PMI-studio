# Analysis: Architecture Decision Records

**Epic**: `EPIC-016` · **Session**: 2026-08-19

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

## Findings

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| F1 | Coverage Gap | MEDIUM | 1 feature sections and none names the requirements it satisfies | Add the requirement reference to each `F-<epic>.<n>` framing note (`traceability-convention.md`, mandatory link) |
| F2 | Underspecification | MEDIUM | No dated clarification session is recorded in `spec.md` | Run `/speckit-clarify`. Until then the register holds this Epic at `Specified` however far its plan and tasks have gone — `FR-ESK-018` derives the stage from a recorded session, never from the absence of markers |

**Blocking findings (CRITICAL or HIGH): 0.** `DOR-09` is satisfied.

## Coverage

| Measure | Value |
|---|---|
| Requirements owned | 1 — `FR-034` |
| Owned requirements cited by a task or feature note | 1 of 1 |
| Tasks listed | 12 |
| Feature sections | 1 |
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

## Remediation — 2026-08-19

Findings from this session were acted on the same day by EPIC-026 `T686` and `T687`:

- **Task-count drift** — the count in `tasks.md` was corrected against a recount, and `plan.md`'s
  duplicate was **removed** rather than synchronised. A number restated in two documents is the
  PP-002 fault itself; only `tasks.md` now carries it, marked *counted, not quoted*.
- **Feature → requirement links** — the mandatory citation now sits in the `F-<epic>.<n>` framing
  notes (`traceability-convention.md`).
- **No clarification session** — unremediated. It needs `/speckit-clarify` to actually run, and
  writing the session without running it would fabricate the evidence `FR-ESK-017` exists to
  guarantee.

The findings above are left as recorded. They state what the pass returned on the day it ran; a
later fix does not change what was found.
