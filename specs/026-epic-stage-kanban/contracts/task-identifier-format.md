# Contract: the task-identifier format

**Epic**: `EPIC-026` · **Phase**: 1 · **Date**: 2026-08-25 · **Plan**: [../plan.md](../plan.md)

What a task identifier may look like, where that rule lives, and what happens to one that does not
fit. Requirement: `FR-ESK-025`. Decisions: [../research.md](../research.md) `R-026-8`–`R-026-10`.

---

## 1. One definition, three consumers

```jsonc
// governance/epic-stage.config.json
{
  "taskIdentifierPattern": "^T\\d{3,}[a-z]?$",
  "_taskIdentifierNote": "FR-ESK-025. A trailing letter is a SHAPE, not a claim — it does NOT mean 'added adjacent to the task it shares a prefix with'. That meaning is retired: see R-026-9.",
  "taskIdentifierRecogniser": "^T\\d+[a-z]*$"
}
```

| Consumer | Reads it for |
|---|---|
| `tests/governance/epic-stage/task-ids.spec.ts` | corpus-wide uniqueness (`G-26-15`) |
| `tests/governance/epic-stage/dor.ts` | pairing (`T148`-style), completion, and `covers` references |
| `tests/governance/epic-stage/task-paths.spec.ts` | completed tasks naming existing paths (`G-26-14`) |

**None of the three writes a pattern of its own.** The rule is one string; three checks read it.
`epicDirectoryPattern` is already held this way in the same file, so this is the established shape
rather than a new one — and `FR-ESK-015` now names it.

---

## 2. What the pattern admits, and what it does not

| Identifier | Verdict | Why |
|---|---|---|
| `T001`, `T864`, `T999` | valid | three digits, the historical corpus |
| `T150a`, `T442v`, `T900c` | valid | a trailing letter is a shape and always was |
| **`T1000`, `T4096`** | **valid — this is the change** | four or more digits |
| `T1000a` | valid | both together |
| `T99` | **unrecognised — fails** | fewer than three digits |
| `T150ab` | **unrecognised — fails** | at most one letter |
| `T150A` | **unrecognised — fails** | lowercase only |
| `TASK-150` | not an identifier | does not match the recogniser; ignored, not failed |

**`{3,}` has no upper bound on purpose** (`R-026-8`). A four-digit cap is a second exhaustion date,
and this corpus consumed 999 identifiers in about a year.

---

## 3. Unrecognised is a failure, not a skip

Two patterns, because a checker is asking two questions:

```
token matches recogniser ^T\d+[a-z]*$ ?
  no  → not a task identifier. Ignore it.
  yes → does it match taskIdentifierPattern ?
          yes → check it normally
          no  → UNRECOGNISED. Fail the build, naming the token and the file.
```

**A single narrow pattern cannot report what it does not match**, because not matching *is* how it
says "this is not a task id". That is the whole of the hazard `T441n` named:

> *"a four-digit id is currently **invisible** to all three [checks]… silently unchecked, **which is
> worse than a collision**."*

**The recogniser MUST stay broader than the pattern**, and that relationship is asserted directly:
every identifier the pattern admits must also match the recogniser. A recogniser that drifted
narrower would restore the silent skip while every other assertion stayed green.

---

## 4. What this contract must never contain

- **No second copy of the pattern.** Six hand-copied regexes across three files is the fault this
  requirement exists to remove; re-introducing one anywhere defeats it.
- **No adjacency meaning for the letter.** `EPIC-014` allocated `T150a`–`T150z` and `T153a`–`T153h`
  as ordinary blocks, and `EPIC-036` allocated `T442a`–`T442v` the same way. The convention
  described something two Epics no longer do (`R-026-9`).
- **No rewriting of another Epic's record.** `specs/029-design-system/tasks.md` states the old
  meaning as of when it was written. It is **annotated** with a pointer to `FR-ESK-025`, never
  edited to agree.
- **No permissive fallback.** A pattern loose enough that nothing is ever unrecognised is not a
  check.

---

## 5. What this does NOT decide

| Not decided | Where it belongs |
|---|---|
| How an Epic **chooses** its next identifier block | Not a rule this repository has ever written down, and it does not need one: uniqueness is checked, allocation is not |
| Whether existing three-digit ids are renumbered | **They are not.** Renumbering would break every cross-reference in the corpus, and the pattern admits them unchanged |
| Defect identifiers (`DEF-###-###`) | Their own shape, checked separately in `task-ids.spec.ts`; untouched here |
| `EPIC-###` identity | `FR-ESK-008` and the Principle III edge case; a different identifier entirely |
