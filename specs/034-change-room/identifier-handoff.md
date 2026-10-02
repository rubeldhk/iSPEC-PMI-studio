# `T995y` — the task-identifier hand-off to `EPIC-026`

**Session**: 2026-08-31 · Phase Z

## The task asked for a blocker. The evidence says it is already discharged.

`T995y` reads:

> Hand the task-identifier exhaustion to `EPIC-026` as a blocker on `EPIC-035`, not a warning. 992
> of 999 prefixes are in use; **three remain** after this Epic … So the fix is one of two, and
> `EPIC-026` must choose: widen `T\d{3}[a-z]?` to four digits in `task-ids.spec.ts`, `dor.ts` and
> `task-paths.spec.ts`, or retire the adjacency meaning of the suffix and say so where the
> convention is written down.

**Both** of those were done, before this Epic reached Phase Z. Escalating it now would put a
resolved issue in front of `EPIC-026` as live work, which costs them a triage and misrepresents the
state of the repository. So this record closes the hand-off with evidence instead.

## What is actually true, measured 2026-08-31

Scanning every `specs/*/tasks.md`:

| | |
|---|---|
| Distinct `T` prefixes in use | **1209** |
| Highest | **T1214** |
| Unused prefixes below 1000 | **0** |
| Four-digit identifiers already allocated | **210** (`T1000`–`T1214`) |

The three-digit space is not nearly exhausted — it is **fully** exhausted, and has been for some
time. Work carried on because four-digit identifiers were already being allocated and already being
recognised.

## Option one was taken: the pattern is widened, and centralised

`governance/epic-stage.config.json`:

```json
"taskIdentifierPattern": "^T\\d{3,}[a-z]?$",
"taskIdentifierRecogniser": "^T\\d+[a-z]*$"
```

Three-or-**more** digits, with **no upper bound** — the config note gives the reason in its own
words: *"a cap is a second exhaustion date."*

The task named three files to edit. That is no longer the shape of the fix: `EPIC-026`'s `T864d`/
`T864e` moved the pattern out of the checks entirely, because it *"was hand-copied into six sites
across three files and widening it by hand meant editing six correctly with nothing to notice a
miss."* `tests/governance/epic-stage/task-id-format.ts` now reads it from configuration, and
`T864a` fails any source that writes the shape by hand.

That check is live. It fired during this very phase, on an ISO 8601 timestamp regex in
`change-room-transcript.spec.ts` — `T` followed by digits, which it cannot distinguish from a task
id and correctly refuses to try. The transcript check was rewritten to split on the table cell
instead.

## Option two was also taken: the adjacency meaning is retired

From the same config note:

> A trailing letter is a SHAPE and carries NO adjacency claim — it does not mean "added next to the
> task it shares a prefix with". That meaning is retired (`R-026-9`): `EPIC-014` allocated
> `T150a`–`T153h` and `EPIC-036` allocated `T442a`–`T442v` as ordinary blocks adjacent to nothing.

So the concern `T995y` raises — that reusing suffixes under someone else's prefix *"would pass the
check and break what the suffix means"* — no longer applies, because the suffix no longer means
that. It is written down where the convention is written down, which is what the task asked for.

## What `EPIC-026` is NOT being asked to do

Nothing. There is no blocker here, and `EPIC-035` is not blocked on identifiers: it may allocate a
four-digit prefix block and every check will recognise it.

## What remains worth their attention, as a note rather than a blocker

`EPIC-036`'s `T441n` recorded the failure mode that made this urgent: a four-digit id was
*"invisible to all three [checks] … silently unchecked, **which is worse than a collision**"*. The
recogniser/pattern split exists to prevent exactly that, and its anti-tautology case —
*"`WOULD CATCH` the shapes it exists to catch, so it cannot pass vacuously"* — is present and
passing.

The one thing this record cannot establish is whether every historical three-digit allocation is
still unique across all 1209 prefixes; `G-26-15` asserts uniqueness and passes, so the answer is
yes as of this run.

## Verification

- `pnpm test:governance` → `task-id-format.spec.ts`: **38 passed**
- Prefix census: script in the Phase Z session, reproducible against `specs/*/tasks.md`
