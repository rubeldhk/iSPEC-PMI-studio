# EPIC-039 — defect intake

**Constitution VI.** This directory is the **only** place a defect found while building or validating
the Integration Hub is recorded. A defect found in a check (a mutation proof that cannot be observed
failing, a canary hit, a difference between the two adapter runs of the caller-level suite) is
recorded here **before** its fix, so the record exists even if the fix never lands.

Tracked in Git so `DOR-11` can read it; nothing about a defect lives only in a conversation.

## Record format

One file per defect: `DEF-039-NNN-<slug>.md`, numbered from `001`, never renumbered.

```text
# DEF-039-NNN — <one line>

**Status**: open | fixed | deferred (to <Epic>) · **Severity**: CRITICAL | HIGH | MEDIUM | LOW
**Found**: <date>, by <task or check> · **Requirement**: <FR-HUB-…/SC-HUB-…>

## Observed
## Expected
## Cause
## Fix (or why deferred, and to whom)
## Evidence (the test that failed, then passed)
```

`T2236` confirms at closure that no record here is `open`.
