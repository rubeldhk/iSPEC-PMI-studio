# DEF-028-007 — the same task identifier declared twice

**Epic**: `EPIC-028`
**Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Found by**: reading `tasks.md` while answering "where are we"
**Severity**: LOW — caught within the hour, no downstream artifact consumed it

## What happened

`T696` was declared twice in `specs/028-agent-execution-seam/tasks.md`:

```
- [ ] T696 Grant the headless agent the tools `/speckit-specify` needs …   ← placeholder, appended earlier
- [X] T696 Grant the headless agent `Bash` and `Write` at the narrowest … ← the work, appended after it was done
```

Both mine, appended about ninety minutes apart. The first was written when the tool grant was still
a decision for the owner; the second when the grant had been made and implemented. Neither line is
wrong on its own, which is exactly why it survived: the file read correctly in both places.

Every `tasks.md` here states that **task IDs are global and invariant**, and cross-Epic references
like `(unit test: T011a)` depend on it — a reference resolves to one line or to nothing useful. With
`T696` declared twice, the same identifier was simultaneously done and not done, and
`/speckit-implement` reading the file would have found work that no longer existed.

## Two process notes, recorded rather than smoothed over

**Constitution VI was inverted.** The rule is that a defect is recorded before it is fixed. Here the
duplicate was removed and then written up, because it was noticed mid-sentence while composing a
status answer and removing it took one line. The order was wrong; the record exists, and saying so
is cheaper than pretending the sequence was clean.

**It was found by eye, not by a check.** Nothing in 742 governance assertions looked at task
identifier uniqueness, in a repository whose task documents declare that property in their own
headers. A stated invariant with no check is a convention, and conventions decay silently.

## The fix

The placeholder line is removed; the completed line stands. No checkbox state changed, because the
work was done.

## The guard

`G-26-15` asserts every task identifier is declared exactly once across the whole corpus, with an
anti-vacuity floor so a regex that matched nothing could not pass, and a direct assertion that the
detection keys on the **identifier** rather than the line — the two duplicates differed in both
checkbox state and wording, so a whole-line comparison would have reported nothing.

Mutation-tested: reintroducing a second `T696` turns it red and names both lines.
