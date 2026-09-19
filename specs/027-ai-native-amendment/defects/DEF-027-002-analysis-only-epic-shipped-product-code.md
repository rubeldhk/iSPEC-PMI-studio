# DEF-027-002 — the analysis-only epic shipped a product source file

**Epic**: `EPIC-027` | **Raised**: 2026-08-17 | **Status**: CLOSED
**Originating commit**: `f356ba3` *"docs(EPIC-027): specify and plan the AI-native amendment
reconciliation"* (2026-08-13)
**Found by**: `T632`, writing the `G-27-09` check
**Severity**: MEDIUM — the constraint the epic names as its own boundary was breached by the epic's
first commit, and nothing could see it for four days

## Expected

`FR-AMD-016`: *"This epic MUST be **analysis only**. It MUST NOT implement product capability,
rewrite existing specifications in place, or generate implementation tasks."*

The commit's own message says it twice: *"Analysis-only epic (FR-AMD-016). Ships no product
capability."*

`G-27-09` exists to enforce it, and the epic's blocking policy singles it out: it is one of only two
checks that **block CI**, because *"a reporting-only check on either would leave the boundary
defended by good intentions."*

## Actual

`f356ba3` created **`engine-adapters/fixture/src/fixture.adapter.ts`** — a new, 149-line product
source file.

```
$ git show f356ba3 --name-only | grep engine-adapters
engine-adapters/fixture/src/fixture.adapter.ts
```

It is the only product file any EPIC-027 commit has ever touched. Every other commit in the epic
writes to `specs/027-*/`, `tests/governance/`, `scripts/` or `adr/`.

## What actually happened

The file itself is **legitimate work that belongs to a different epic**. EPIC-003's convergence task
`T465` reads:

> *Reconcile the fixture adapter path: `T037` names `engine-adapters/fixture/src/fixture.adapter.ts`,
> the code lives at `src/index.ts` — correct the record or move the file.*

So the change was correct and needed. It was **committed under an EPIC-027 message**, which made an
analysis-only epic the author of product code.

This is a **misattribution**, not a rogue implementation — the same shape as `C-29`, where `T138` sat
in an epic that did not own its requirement. Both come from the same gap: nothing checks that a
change belongs to the epic claiming it.

## Why nothing caught it

`G-27-09` was **specified on 2026-08-13 and written on 2026-08-17**. The violation happened inside
that window, in the very commit that specified the check.

That is now the sixth instance this week of one shape — `DEF-001-001`, `DEF-018-001`,
`DEF-028-001`, `DEF-028-003`, `DEF-027-001` and this. **A control that names the right condition and
cannot yet observe it.** Here the gap was purely temporal: the constraint was written, the enforcement
was not, and four days passed.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Record the exception explicitly in the check, with the reason and the owning task | The violation stays visible forever and the boundary is enforced from here. **Recommended** |
| **B** | Revert the file | Breaks EPIC-003's `T465`, which is closed and correct. The work is right; only its attribution was wrong |
| **C** | Scope `G-27-09` to commits after the check existed | Enforces the boundary going forward and makes the one historical breach invisible, which is the thing this repository keeps getting wrong |
| **D** | Ignore it | The epic's own closing report would claim `SC-AMD-009` while a product file sits in its history |

## Resolution

**Option A.** `G-27-09` carries a single named exception — commit `f356ba3`, file
`engine-adapters/fixture/src/fixture.adapter.ts`, owning task EPIC-003 `T465` — recorded in the check
itself rather than in a comment somewhere else. Any *other* product file in any EPIC-027 commit fails
the check and blocks CI.

An allowlist with one entry and a stated reason is honest. A scoped date range is not, because it
hides the thing it excludes.

**`SC-AMD-009` is reported as satisfied-with-one-recorded-exception**, never as clean.

**Status**: CLOSED 2026-08-17.

## Traceability

- Requirement: **FR-AMD-016** · Criterion: **SC-AMD-009** · Check: `G-27-09` (blocks CI)
- Originating commit: `f356ba3` · Owning task for the file: EPIC-003 `T465`
- Found by: `T632` · Related: `C-29` (same misattribution shape), and the five defects of 2026-08-17
