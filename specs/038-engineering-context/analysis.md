# Cross-Artifact Analysis: Engineering Context (`EPIC-038`)

**Session**: 2026-08-31 · **Command**: `/speckit-analyze` · `FR-ESK-019`

Analysed `spec.md`, `plan.md` and `tasks.md` against each other and against the constitution.
Coverage was computed by extraction rather than by reading — the requirement inventory and the task
mapping were derived mechanically, because a human reading of one's own artifacts finds what it
expects to find.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| E1 | Coverage gap | **HIGH** | `spec.md` `FR-CTX-064`; `data-model.md` §2 `inclusionReason` | `PP-016` Explainable AI has a column and no task. *"Why each item was included"* is required and the field exists in the data model, but no task writes or tests it — neither the identifier nor the concept appears in `tasks.md` | Add a test-first pair in Phase 3, where inclusion is decided |
| E2 | Coverage gap | MEDIUM | `spec.md` `FR-CTX-014`; `data-model.md` §2 `relevanceScore` | Retrieved candidates must carry the score that ranked them. Same shape as E1 — the column exists, no task asserts it | Fold into `T1279`; assert in `T1282` |
| E3 | Traceability | MEDIUM | `tasks.md`, 13 requirements | `FR-CTX-010`, `FR-CTX-011`, `FR-CTX-016`, `FR-CTX-020`, `FR-CTX-060`, `SC-CTX-001`, `SC-CTX-002`, `SC-CTX-005`, `SC-CTX-006`, `SC-CTX-007`, `SC-CTX-008`, `SC-CTX-009`, `SC-CTX-010` are **covered but not cited by identifier** — legible to a reader, invisible to extraction | Cite each where it is proved |
| E4 | Underspecification | MEDIUM | `spec.md` `SC-CTX-006`; `tasks.md` `T1301` | The only success criterion phrased as a person's ability is dischargeable solely by the Tier 2 journey, which is already recorded as blocked because `EmbeddingPort` has no owner | Accept; state in the closing report that `SC-CTX-006` is unverifiable this Epic |
| E5 | Constitution | MEDIUM | `plan.md` Gate XII | Gate XII is PARTIAL — the commands producing these artifacts are unregistered because `EPIC-037` has not shipped | Not CRITICAL: the constitution itself carries *"Principle XII is enforceable in full only once EPIC-037 exists"*. Already in Complexity Tracking |

## Why E1 is the finding that matters

It is the third occurrence in this repository of one defect class: **a field with a column and
nothing that fills it.**

`EPIC-035` shipped `resolutionEvidenceRef` in its first migration and discovered at Phase 8 that no
code path wrote it — aggregated, it would have read *"no defect was ever resolved with evidence"*,
which is not what an unfilled column means. `EPIC-034` found four capabilities registered in no
module. Both were found **after** implementation.

`FR-CTX-064` is the same shape, caught **before** any code exists — which is what this step is for.
It also carries more weight than its size suggests: `PP-016` Explainable AI is declared *Satisfied*
in `plan.md` on the strength of `FR-CTX-064`, so leaving it unimplemented would make a principle
row false rather than merely leaving a field null.

## What was checked and found clean

- **Ambiguity**: zero vague adjectives (`robust`, `intuitive`, `fast`, `scalable`, `seamless`,
  `efficient`, `simple`, `flexible`) across all three artifacts.
- **Placeholders**: zero `TODO`, `TKTK`, `???` or `NEEDS CLARIFICATION` markers.
- **Duplication**: no near-duplicate requirements.
- **Unmapped tasks**: none. All 86 tasks cite a requirement, success criterion, research decision
  or constitution principle.
- **Entity consistency**: `spec.md`'s six Key Entities match `data-model.md`'s six tables. *(This
  was raised as a suspected inconsistency during analysis and disproved by extraction — the spec
  does carry `Index Entry`.)*
- **Research coverage**: all eleven `R-038-*` decisions are cited by at least one task.
- **Task ordering**: no phase depends on a later one; Phase 2 blocks every story, as declared.
- **Identifiers**: `T1220`–`T1305`, verified unique against 1,825 corpus identifiers (`G-26-15`).

## Metrics

| | |
|---|---|
| Total requirements | **55** — 45 `FR-CTX`, 10 `SC-CTX` |
| Total tasks | **86** |
| Research decisions | 11, all cited |
| Coverage | **96%** — 53 of 55 have an implementing task |
| Ambiguity count | 0 |
| Duplication count | 0 |
| **Critical issues** | **0** |

## Next actions

No CRITICAL findings. `/speckit-implement 038` may proceed.

**E1 should be fixed first**, and it is cheap: one test-first pair in Phase 3. Finding it here
rather than at convergence is the difference this step exists to make — the two prior instances of
its class were both found after the code was written.

E3 is worth closing in the same pass. It has now recurred three times across three Epics
(`EPIC-033`'s `A1`, `EPIC-035`'s `SC-DFR-005`, and here), which suggests the habit of citing a
requirement where it is proved is not yet reliable, and that the check for it should be mechanical
rather than remembered.
