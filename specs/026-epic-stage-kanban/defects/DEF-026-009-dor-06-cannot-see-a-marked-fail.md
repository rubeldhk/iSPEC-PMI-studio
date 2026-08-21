# DEF-026-009 — `DOR-06` cannot see a FAIL that carries a marker

**Epic**: `EPIC-026` (owns the DOR) · affects **every Epic whose plan records a qualified gate**
**Raised**: 2026-08-20 | **Status**: **CLOSED — FIXED 2026-08-20**
**Found by**: tracing why EPIC-029 was `Not ready`, and discovering the reason was **not** the FAIL
its own plan records
**Severity**: **HIGH** — an Epic can reach `Ready` while its plan records a failed Constitution Check

## What it does

`DOR-06` asks whether a plan's Constitution Check records a FAIL:

```ts
// A QUALIFIED gate is a recorded deviation, not a failure. Conflating them
// would block every Epic honest enough to write one down.
const failed = /\|\s*(?:❌\s*)?FAIL\b/i.test(plan);
```

The pattern allows exactly one marker before `FAIL` — `❌`. `\s*` does not match `⚠️`, so a row
written

```markdown
| — | No other Claude session is active on this checkout | ⚠️ FAIL — see Complexity Tracking |
```

does not match, and the plan is scored **"Constitution Check clean"**.

## Reproduction

1. `specs/029-design-system/plan.md:77` records the row above — a genuine, unresolved failure:
   another session is active on the checkout, and the plan's own Complexity Tracking says
   *"Working in a separate clone is the correct answer and is **required before implementation
   begins**."*
2. `DOR-06` returns `passed: true`, detail `Constitution Check clean`.
3. EPIC-029 reached `Ready` with next command `/speckit-implement` — against the instruction in the
   very document `DOR-06` had just read.

## Expected vs actual

| | |
|---|---|
| **Expected** | A plan recording a FAIL holds its Epic out of `Ready`, whatever decoration precedes the word |
| **Actual** | Only bare `FAIL` and `❌ FAIL` are seen; `⚠️ FAIL` passes as clean |

## The real defect is an open vocabulary

The code comment draws a genuine distinction — a **QUALIFIED** gate is a recorded deviation, not a
failure — and that distinction is right. What is missing is that **nobody defined the words**.

`⚠️ FAIL` is a contradiction on its face: the marker says "qualified", the word says "failed". A
plan author writing it in good faith cannot know which the gate will take, because no document says.
And the default for an unrecognised status is **pass**, which is the wrong default for a term nobody
defined — the identical reasoning `DOR-09`'s own severity vocabulary was given, one condition away
in the same file.

Fixing only the regex would leave `⚠️ QUALIFIED`, `PARTIAL`, `N/A`, and `TBD` equally undefined and
equally passing. EPIC-029's plan already contains `⚠️ PARTIAL` and `⚠️ CONDITIONAL`.

## Blast radius

Every `plan.md` with a Constitution Check table. Any FAIL written with a marker other than `❌` has
been invisible since the condition was written.

## Remaining work

- Define the closed status vocabulary — `PASS`, `FAIL`, `QUALIFIED` — and where it is documented.
- Make `DOR-06` reject a status outside the vocabulary rather than pass it, so an undefined word
  fails loudly instead of silently.
- **Mutation-verify** on `⚠️ FAIL`, on bare `FAIL`, and on an undefined status word. The condition
  has never been observed failing on a marked FAIL.
- Sweep existing plans for FAIL rows the gate has been ignoring, and for statuses outside the new
  vocabulary.
- **No code was changed by the analysis run that found this.** Fixes re-enter as tasks
  (Constitution VI).

## Links

- [`D-43`](../../_shared/decisions/D-43-dor-conditions-parse-prose-by-hand.md) — the recurring shape
- [`DEF-026-008`](./DEF-026-008-dor-09-cannot-see-the-findings-it-reads.md) — found in the same session
- `specs/029-design-system/analysis.md` — finding `F5`, the report this record came from
- `specs/029-design-system/plan.md:77` — the row the gate could not see

## Resolution (2026-08-20) — **CLOSED, FIXED**

Resolved by `T908`–`T911`. `DOR-06` now reads the **status cell** of each Constitution Check row —
last cell, decoration stripped, leading word taken — and fails when that word is `FAIL`, whatever
precedes it.

Reading the cell rather than the row matters in both directions: `⚠️ FAIL — mitigated, see
Complexity Tracking` fails, and `PASS — no FAIL conditions remain` does not. A row-wide match could
not tell those apart.

**Mutation-verified** (`T908`): 18 assertions, five observed failing first — including the exact
EPIC-029 row.

## The closed vocabulary was NOT taken — and why

This record's "Remaining work" proposed a closed vocabulary of `PASS`, `FAIL`, `QUALIFIED`, with
anything else failing. **`T909` gathered the evidence and the proposal did not survive it.**

Seventeen distinct status phrasings exist across 28 plans:

| Count | Status |
|---|---|
| 334 | `PASS` |
| 15 | `CANNOT ASSERT` |
| 4 | `PASS WITH DEBT` |
| 3 | `PASS WITH GAP` |
| 3 | `UNRESOLVED AND NOW WIDER` |
| 2 each | `INFRASTRUCTURE EPIC`, `NOT VERIFIED`, `CONDITIONAL` |
| 1 each | `RESOLVED`, `QUALIFIED`, `DEVIATION`, `PARTIAL`, `FAIL`, and four longer phrasings |

Rejecting everything outside a three-word set would fail roughly **forty rows at once** and move
several Epics out of `Ready`. Worse, it carries a real judgement nobody has made: `CANNOT ASSERT`
and `NOT VERIFIED` may well *be* failures, and deciding that is not a regex change.

That is [`D-43`](../../_shared/decisions/D-43-dor-conditions-parse-prose-by-hand.md) option (c),
whose cost the decision record already anticipated — *"every artifact not matching the expected
shape starts failing at once, including old ones."* Taking it as a side effect of fixing one regex
is precisely the conflation `D-43` exists to prevent, so the scope was narrowed **mid-implementation
on the evidence**, and `T908` pins the undeclared statuses down with explicit assertions so the
narrower scope is deliberate rather than forgotten.

## Sweep (`T911`)

Every `plan.md` re-evaluated under the fixed condition. **One hidden FAIL, and it was the known
one**: EPIC-029's concurrent-session row. No other plan records a FAIL the old gate was missing, and
no Epic changed readiness — EPIC-029 was already `Not ready`.

## Links

- [`D-43`](../../_shared/decisions/D-43-dor-conditions-parse-prose-by-hand.md) — the closed-vocabulary question, still open and now with evidence
