# DEF-032-004 — a FAILED test result satisfied "automated tests pass"

**Epic**: `EPIC-032` | **Raised**: 2026-10-07 | **Status**: DEFERRED to `EPIC-039` (residual only)
**Originating task**: `T860e` · found while writing the `EPIC-015` producer
**Severity**: HIGH — it undid `BR-0144` for the most common item there is

## Finding

The spec matches a Contract item by `predicateType` alone (`FR-EVS-003`, `FR-EVS-025`). A type says
what *kind* of proof a document is, not what it proved: an in-toto `test-result` whose `result` is
`FAILED` is genuine evidence that tests failed, and it met an item reading *"automated tests pass"*.

## Rule — implemented, and **ratified 2026-10-08** as `FR-EVS-036`

`declaresFailure` in `packages/evidence-contract/src/predicates.ts`: evidence whose **standard**
predicate declares failure does not satisfy an item. Deliberately narrow — only in-toto
`test-result`, only its `result` field, `WARNED` counting as a pass. Tested in `predicates.spec.ts`,
`evidence-contract-status.spec.ts` and end to end in `evidence-from-qa-suite.spec.ts`.

The Project Owner ratified it on 2026-10-08 (`T1799`); `spec.md` now states it as `FR-EVS-036`,
with the decision recorded under *Clarifications — Session 2026-10-08*.

## Residual, deferred

A **referenced** test result's predicate cannot be read back (`storage-contract` `S4`), so its
outcome is unknown and it is not checked. Carrying a verified outcome with a referenced attestation
belongs to the adapter registry that external tools arrive through — `EPIC-039` (`U-13`).
