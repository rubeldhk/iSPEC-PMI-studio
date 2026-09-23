# DEF-034-001 — the eighth impact area is `security`, and `BR-0044` never named it

**Epic**: `EPIC-034` (owns `backend/src/modules/change-room/`) · affects **US2**
**Raised**: 2026-08-30 | **Status**: **CLOSED — FIXED 2026-08-30** (`T996j`–`T996k`, Phase 4)
**Found by**: reading `BR-0044` while writing the Phase 4 tests, because the task line for `T996j`
and the constant disagreed about a word
**Severity**: **HIGH** — `SC-CHR-002` requires 100% of impact views to span all eight `BR-0044`
areas. As built, **none of them did**, and none ever could

## What it does

`IMPACT_AREAS` in [impact.types.ts](../../../backend/src/modules/change-room/impact.types.ts)
was written as:

```
requirements, specifications, architecture, tasks, code, tests, release, security
```

`BR-0044` and `FR-CHR-030` both name:

```
requirements, specifications, architecture, tasks, code, tests, release scope,
known operational effects
```

`security` is not one of the eight. `known operational effects` is, and was absent.

The same wrong list is baked into the `change_impact_areas_area_is_known` CHECK constraint in
`20260830120000_epic034_change_room`, so the database would have rejected a correct view and
accepted an incorrect one.

**Four sites in all**, which is what a vocabulary error looks like once it has had one commit to
spread: the constant, the CHECK constraint, `T406f`'s literal list, and `T406t`'s fixture, which
inserted an area literally named `security`. The last of these was found by the repaired constraint
rejecting it — the fix locating its own remaining traces, which is the argument for repairing the
database rather than only the code.

## Why it survived Foundational

**The type-level guarantee is what hid it.** `ImpactView.areas` is a
`Readonly<Record<ImpactAreaName, ImpactArea>>`, so a view with seven areas does not compile — that
was `T406g`'s whole point and it works. But a `Record` over a union guarantees the view carries
*every member of the union*. It cannot guarantee the union has the right members. The stronger the
completeness guarantee, the more confidently a wrong vocabulary propagates: every consumer was
required to handle all eight, so all eight looked deliberate.

**And a test did check it.** `T406f`'s `change-room-impact-type.spec.ts` carries a case titled
*"names them, and they are the ones `BR-0044` lists"*, which restates all eight as literals rather
than importing the constant — the right method, applied deliberately. It listed `security` too.

That is the part worth keeping. Restating a list from memory catches a typo and nothing else: the
constant and the test were written in one sitting from one misreading, so the test agreed with the
code and both were wrong. A guard is only independent if its *source* is independent, and a second
recollection is not a second source.

Two governance checks that might plausibly have caught it did not, and correctly so. `DOR-08` reads
task lines, not constants. `universal-columns.spec.ts` checks that migrations carry `workspaceId`
and `createdAt`; it has no opinion on what a CHECK constraint enumerates.

## Where security legitimately does appear

`TRADEOFF_DIMENSIONS` in `option.types.ts` includes `security`, and that is **correct** —
`FR-CHR-041` names schedule, cost, quality, security, compatibility and delivery. `PP-008` makes
security a first-class trade-off dimension. The likeliest origin of this defect is the two lists
being written in the same sitting.

## Consequence had it shipped

An impact view would have omitted operational effects entirely — the class covering what a change
does to a running system. A reviewer scanning eight populated areas would have had no signal that a
ninth concern existed, because `FR-CHR-032`'s `unknown` state only marks areas the view *knows to
ask about*. An area absent from the vocabulary is not `unknown`; it is invisible, which is the exact
failure `T406g`'s header says the `Record` exists to prevent.

## Fix

1. `IMPACT_AREAS`'s eighth member becomes `operations`, documented as `BR-0044`'s "known operational
   effects" — the same shortening already applied to `release` for "release scope".
2. `20260830140000_epic034_impact_area_vocabulary_repair` drops and recreates the CHECK constraint,
   following `20260827150000_epic030_refusal_vocabulary_repair` rather than editing a committed
   migration in place.
3. `change-room-impact-areas.spec.ts` (`T996j`) reads `FR-CHR-030`'s sentence out of `spec.md` and
   derives the eight area names from it. Not a restatement — `T406f` already tried that and
   inherited the same error. The authority is the specification file, so the test fails if the
   constant drifts from it in either direction.
4. `T406f`'s literal list is corrected, with a note saying why restating was not enough.

## Guard against recurrence

Two rules, and the second is the one this defect actually teaches.

**A completeness guarantee over a vocabulary does not validate the vocabulary.** A `Record` over a
union proves every member is handled. It says nothing about whether the union is right, and it makes
the wrong union look more deliberate the more thoroughly it is enforced.

**A second recollection is not a second source.** Restating a list in a test — rather than importing
the constant — is the standard remedy, and it failed here, because the test and the constant were
written minutes apart from the same misreading. Where a constant claims to enumerate a numbered
requirement's list, the guard must **read the requirement**: parse it from the specification file
and derive the expectation. That is the only version an author's mistaken belief cannot travel into.

Applies wherever this repository pins a vocabulary against a numbered requirement — at least
`TRADEOFF_DIMENSIONS`/`FR-CHR-041`, `REPLAN_STATES`, `IMPACT_STATES` and `URGENCY_LEVELS`. Those
were **not** audited by this fix; only `IMPACT_AREAS` was, because only it was implicated. Reading
each against its requirement is worth a task of its own.
