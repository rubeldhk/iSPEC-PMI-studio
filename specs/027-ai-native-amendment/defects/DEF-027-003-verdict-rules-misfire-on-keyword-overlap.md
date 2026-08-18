# DEF-027-003 — two verdict rules misfire on keyword overlap

**Epic**: `EPIC-027` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating task**: `T613` (verdict assignment by ordered rules)
**Found by**: `T644` — the ten-clause read, which is the one thing the checks cannot do
**Severity**: MEDIUM — two of ten sampled clauses carry reasoning that does not fit them; every
conformance check passes on both

## Expected

`T644` exists because the checks verify the register is **complete and internally consistent**, never
that a clause marked *already covered* is genuinely covered. Its own note sets the bar:

> *"If nine of ten hold, the register is trustworthy. If three of ten are wrong, it is **worse than
> nothing** — its completeness checks will all still be green."*

## Actual

**Eight of ten survive reading. One is wrong and one is weak.**

### `CLA-268` — wrong

> *"AI agents MUST NOT autonomously change authoritative business intent."* (Native §12)

Assigned **`conflicting` / owner `EPIC-009`**, with `C-23`'s reasoning: *"the same specification would
exist as a PostgreSQL row and as tracked markdown… `D-29` resolved it — Postgres authoritative,
markdown a one-way projection."*

That is a **different subject**. `C-23` is about *where the truth lives*; this clause is about *who is
allowed to change intent*. The rule matched on the single word **"authoritative"** and applied
source-of-truth reasoning to a governance-authority clause.

Correct verdict: **`needs-enhancement` / `PP-003`** — the human-in-the-loop principle, whose
prohibition half this clause states. `ADR-0015` is its ADR.

### `CLA-489` — weak

> *"Incorporate this into the Master Specification as a unified Requirement-Defect-Change Governance
> Architecture, rather than implementing the three modules independently."* (Defect Management §12)

Assigned `conflicting` with reasoning *"Part of the Defect Room workflow."* The **verdict** is
defensible — the three Rooms do not exist — but the clause is a **documentation instruction about how
to record all three**, not a step in the Defect Room's workflow. It matched the bare word `defect`.

## Root cause

Rule **ordering and breadth** in the ordered-rules approach `T613` uses.

1. The `authoritative|source of truth` rule sits **before** the `ai agents must not|shall not
   autonomously` rule, so any clause containing "authoritative" is claimed by source-of-truth first.
2. The defect rule matches a bare `defect`, which appears in documentation instructions as readily as
   in workflow steps.

The approach itself is right — 599 hand-authored judgements would produce 599 chances to classify one
concept two ways, which is the PP-002 failure `spec.md` names. **Ordered rules trade that risk for
this one**, and this is the risk showing up: a rule that is correct for its subject firing on a clause
that merely shares a word.

## Why no check caught it

Every check passes on both rows. `G-27-01` sees one verdict, `G-27-02` sees a non-empty owner,
`G-27-03` sees no unjustified identifier. **The register is complete and internally consistent and
two rows are wrong**, which is precisely the gap `T644` was written to cover and the reason it is a
human read rather than an assertion.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Reorder the two rules, narrow the over-broad patterns, re-run and re-sample | Fixes the class, not just the two rows. **Recommended** |
| **B** | Hand-correct the two rows | Leaves every other clause matching those patterns wrong, and there are more than two |
| **C** | Accept 8/10 | Above `T644`'s stated floor, and the note says a register whose completeness checks are green while its content is wrong is worse than nothing |

## Resolution

**Option A.** The governance-authority rule now precedes the source-of-truth rule, the source-of-truth
pattern excludes clauses about agents changing intent, and a rule for documentation instructions
precedes the defect rule.

**Re-sampled after the fix: 10 of 10 survive reading.**

**Status**: CLOSED 2026-08-17.

## Traceability

- Requirement: **FR-AMD-002**, **FR-AMD-005** · Criterion: **SC-AMD-001**, **SC-AMD-002**
- Originating task: `T613` · Found by: `T644` · Fixed by: `T613` rule reordering
- Related: this is **not** the "check that cannot observe its condition" pattern. It is the opposite —
  a check that observes exactly what it claims to, and a human read finding what it never claimed to
  cover.
