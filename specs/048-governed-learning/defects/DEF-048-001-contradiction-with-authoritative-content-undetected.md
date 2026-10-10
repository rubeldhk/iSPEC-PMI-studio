# DEF-048-001 — knowledge that contradicts an approved specification or steering rule is not detected

**Epic**: `EPIC-048` | **Raised**: 2026-10-09 | **Status**: OPEN — deferred with a named owner and
condition

**Originating finding**: `/speckit-analyze` finding `C1` (HIGH) — spec Edge Case *"Approved knowledge
contradicts an approved specification or steering rule"* has no task, no detection and no reviewer
surfacing.
**Severity**: MEDIUM once deferred — a safety half holds today (below); the reporting half does not
exist.
**Owner**: `EPIC-048` (this Epic). **Discharge task**: `T2420` (failing test) → `T2421`
(implementation), both **⛔ BLOCKED on `EPIC-039`'s `Embed` capability reaching `main`**.

## Expected

Spec Edge Case: *"Knowledge never overrides authoritative content: context marks knowledge as
approved knowledge, distinct from the authoritative specification, and the conflict is reported to
the reviewer."*

That is two obligations:

1. **Distinction** — a knowledge item is never mistaken for authoritative content.
2. **Report** — when a candidate (or an approved entry) contradicts an approved specification,
   requirement or steering rule, the reviewer is told, naming the authoritative item.

## Actual

1. **Distinction holds by design**, not by this defect's fix: `FR-LRN-052` — `EPIC-038` labels every
   `knowledge-entry` item *approved knowledge, not authoritative*, and its `inclusionReason` begins
   `approved knowledge —` (`R-048-11` item 5; `T2398`, itself blocked on the `EPIC-038` merge).
2. **Report does not exist.** Conflict detection in this Epic is an exact `subjectKey` match against
   approved **knowledge** (`R-048-15`, `FR-LRN-036`). A specification or a steering rule has no
   `subjectKey`, so an exact match can never find the contradiction. Any check that could is a
   semantic comparison between a statement and authoritative text.

## Why it is deferred rather than built now

The only honest detector is semantic: compare the candidate's statement with the authoritative
specification and steering text closest to it. That needs an embedding model, and **no embedding
provider exists on `main`** — `EPIC-038`'s `EmbeddingPort` is bound refusing and unowned
(`RK-2`, `R-048-13`). `EPIC-039` (Integration Hub) is adding one as its `Embed` capability.

A cheaper structural check was considered and rejected:
- *Category equals a steering subject* — a learning category is a workspace's own vocabulary, so
  equality says nothing about contradiction; flagging on it would be noise presented as a finding.
- *Keyword overlap* — a check that fires on shared words reports agreement and contradiction alike.

A check that cannot tell contradiction from agreement would make the reviewer's conflict indicator
meaningless, which is worse than its honest absence.

## Condition to discharge

`EPIC-039`'s `Embed` capability is merged to `main` and bound in the composed application. Then:

- `T2420`: failing tests — a candidate whose statement is semantically opposed to an approved
  specification or steering document in its workspace carries `contradictsAuthoritative: [{type, id,
  version, similarity}]` in `GET /learning/candidates/:id`, is ineligible for automatic approval, and
  the Inbox detail shows the authoritative item side by side; an unbound `Embed` reads *contradiction
  check unavailable*, never *no contradiction*.
- `T2421`: implement it through `EPIC-038`'s retrieval over authoritative source types, not a second
  index.

## Exit-gate effect

The Epic Exit Criteria require `defects/` to hold no open record. This one stays open until
`T2421` lands, so `EPIC-048` cannot be declared complete without either the `Embed` capability or a
Project Owner decision to re-scope the Edge Case.
