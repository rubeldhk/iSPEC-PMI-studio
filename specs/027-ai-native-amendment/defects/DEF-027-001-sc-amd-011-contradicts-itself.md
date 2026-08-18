# DEF-027-001 — `SC-AMD-011` contradicts itself in one sentence

**Epic**: `EPIC-027` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T658` / `D-42` (the Cosmos amendment widening 17 areas to 20)
**Found by**: `T618`, writing the `G-27-13` check
**Severity**: MEDIUM — the success criterion states two different counts, and the check written to
prevent exactly this drift had not been written yet

## Expected

`SC-AMD-011` is the criterion that fixes the capability-area count so the spec and the plan cannot
disagree. Its own text says so: *"the count is asserted by `G-27-13`, so the criterion and the table
cannot drift apart again."*

## Actual

```markdown
- **SC-AMD-011**: A reader can determine, for any of the **seventeen** capability areas the amendment
  introduces, whether it is new, an enhancement, or already covered — and which epic owns it — from a
  single document. The twenty are enumerated in the plan's capability-area table; the count is
  asserted by `G-27-13`, so the criterion and the table cannot drift apart again.
```

**Seventeen in the first clause, twenty in the third.** One sentence, two counts.

Everything else in the epic says twenty: `spec.md` lines 41 and 490, `plan.md` D.1 and F-27.3, and
`srs-alignment.md` Part 10, which records the change as *"Capability areas 17 → 20"*. The D.1 table
has exactly 20 data rows.

## Root cause

`D-42` folded the Augment/Cosmos amendment into this epic on 2026-08-14 and raised the count from
seventeen to twenty — Governed Engineering Loops, Governed Learning and the Specification Compliance
Agent. The **second half** of the sentence was updated and the **first half** was not.

The sentence even names the mechanism that would have caught it. `G-27-13` was specified on
2026-08-13 and written today; between those dates the criterion drifted from itself, which is the
precise failure it exists to prevent.

## Why this matters more than a typo

`SC-AMD-011` is the criterion a reader uses to check whether the reconciliation covered everything.
A reader who trusts the first number looks for seventeen areas, finds twenty, and cannot tell
whether three are surplus or the criterion is stale. **The count is the whole content of the
criterion** — there is nothing else in it to be right about.

It is also the fifth instance this week of one shape: a control that names the right condition and
is not yet able to observe it. `DEF-001-001`, `DEF-018-001`, `DEF-028-001`, `DEF-028-003` — and now
a criterion that specifies its own guard and drifted before the guard existed.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Correct the first clause to twenty and have `G-27-13` assert the figure in `spec.md` matches the table | The criterion becomes self-consistent and stays so. **Recommended** |
| **B** | Correct the number only | Fixes today's text; the next amendment drifts it again, which is what just happened |
| **C** | Remove the number from the criterion | Removes the drift by removing the content; a criterion with no count asserts nothing |

## Resolution

**Option A.** `SC-AMD-011` now reads **twenty** in both places, and `G-27-13` asserts three things
together: the table has exactly 20 rows, every row carries a verdict, a named home and a posture,
and **the figure quoted in `spec.md` matches the row count**. The last assertion is the one that
makes the criterion self-enforcing rather than merely correct today.

**Status**: CLOSED 2026-08-17.

## Traceability

- Criterion: **SC-AMD-011** · Requirement: **FR-AMD-004**, **FR-AMD-012**
- Introduced by: `D-42` (2026-08-14) · Found by: `T618` · Fixed by: `T618`, `T620`
- Related: the four defects of 2026-08-17, same shape, recorded in
  [EPIC-028's closure](../../028-agent-execution-seam/closure.md)
