# DEF-026-006 — `DOR-03` read the label and never the answer beside it

**Epic**: `EPIC-026` (owns the DOR) · holds **EPIC-027** and **EPIC-028** out of `Ready`
**Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Found by**: asking why three non-held Epics were `Analyzed` and not `Ready`
**Severity**: **HIGH** — two delivery Epics were refused readiness for declaring full coverage

## What it did

`DOR-03` asks whether SRS traceability is populated, and whether uncovered requirements name a
back-fill owner. It decided by:

```ts
const uncovered = /not yet covered by SRS/i.test(spec);
const owned = /back-fill owner/i.test(spec);
const passed = !uncovered || owned;
```

The regex matches the **field label**. It never reads the **value**. So a specification saying

> **Requirements not yet covered by SRS**: none.

was scored exactly like one saying

> **Requirements not yet covered by SRS**: all of FR-ESK-001 to FR-ESK-016

with no owner named. Both set `uncovered = true`.

## Who it hit, and who it did not

| Epic | Declares | Names an owner | Before | Correct |
|---|---|---|---|---|
| EPIC-002 | two uncovered capability areas | yes | pass | pass |
| EPIC-018 | `FR-RGP-014`, `FR-RGP-015` | yes | pass | pass |
| EPIC-026 | all of `FR-ESK-001`–`016` | yes | pass | pass |
| EPIC-017 | **none** | no — nothing to own | **fail** | pass |
| EPIC-027 | **none** | no — nothing to own | **fail** | pass |
| EPIC-028 | **none** | no — nothing to own | **fail** | pass |

The three it judged correctly are the three with a real gap. The three it judged wrongly are the
three with none. **The check punished the more complete specification** — an Epic that omits the
line entirely passed, while one that answers the question honestly with "none" failed. The incentive
ran backwards: the cheapest way to satisfy `DOR-03` was to delete the sentence.

EPIC-017 was hit too and nobody noticed, because it is a parent design whose readiness reads `n/a`.
The fault needed a *delivery* Epic to reach `Analyzed` with full coverage before it could be seen —
which happened when EPIC-027 and EPIC-028 completed.

## The class

**A check that names the right condition and cannot observe it** — the thirteenth recorded here. The
condition is exactly right: uncovered requirements must name a back-fill owner. What it observed was
whether the *topic* appeared, not what was *said about it*.

## Why the tests did not catch it

`fixtures.ts` carried `SPEC_UNCOVERED_NO_OWNER` (fails, correctly) and `SPEC_UNCOVERED_WITH_OWNER`
(passes, correctly). There was **no fixture that declares "none"**. The two cases present both
contain a real gap, so both agree with the buggy implementation, and the case that would have
exposed it was the one nobody wrote. A branch with no fixture is a branch with no opinion.

## The fix

Parse the value after the label and decide on that:

```ts
const declared = /not yet covered by SRS\**\s*:\s*(.*)/i.exec(spec);
const declaresNone = /^\**\s*(none|n\/a)\b/i.test(declared?.[1]?.trim() ?? '');
const uncovered = declared !== null && !declaresNone;
```

**Deliberately unchanged**: a spec with an SRS Traceability heading and *no* coverage declaration at
all still passes, as before. Silence is arguably worse than an honest "none" — but requiring the
sentence is a new obligation on every Epic, not a bug fix, and it belongs to a decision rather than
to this record.

## The guard

`SPEC_COVERAGE_DECLARED_NONE` joins the fixtures, and `dor-spec-side.spec.ts` asserts all three
branches: **none** passes, uncovered-without-owner fails, uncovered-with-owner passes. Mutation-
tested — restoring the label-matching predicate turns the first red while the other two stay green,
which is precisely the signature the original tests could not produce.
