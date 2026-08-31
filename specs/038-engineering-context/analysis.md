# Cross-Artifact Analysis: Engineering Context (`EPIC-038`)

**Session**: 2026-08-31 · **Command**: `/speckit-analyze` · `FR-ESK-019`

Analysed `spec.md`, `plan.md` and `tasks.md` against each other and against the constitution.
Coverage was computed by extraction rather than by reading — the requirement inventory and the task
mapping were derived mechanically, because a human reading of one's own artifacts finds what it
expects to find.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| E1 ✅ | Coverage gap | **HIGH** | `spec.md` `FR-CTX-064`; `data-model.md` §2 `inclusionReason` | `PP-016` Explainable AI has a column and no task. *"Why each item was included"* is required and the field exists in the data model, but no task writes or tests it — neither the identifier nor the concept appears in `tasks.md` | Add a test-first pair in Phase 3, where inclusion is decided |
| E2 | Coverage gap | MEDIUM | `spec.md` `FR-CTX-014`; `data-model.md` §2 `relevanceScore` | Retrieved candidates must carry the score that ranked them. Same shape as E1 — the column exists, no task asserts it | Fold into `T1279`; assert in `T1282` |
| E3 ✅ | Traceability | MEDIUM | `tasks.md`, 13 requirements | `FR-CTX-010`, `FR-CTX-011`, `FR-CTX-016`, `FR-CTX-020`, `FR-CTX-060`, `SC-CTX-001`, `SC-CTX-002`, `SC-CTX-005`, `SC-CTX-006`, `SC-CTX-007`, `SC-CTX-008`, `SC-CTX-009`, `SC-CTX-010` are **covered but not cited by identifier** — legible to a reader, invisible to extraction | Cite each where it is proved |
| E4 | Underspecification | MEDIUM | `spec.md` `SC-CTX-006`; `tasks.md` `T1301` | The only success criterion phrased as a person's ability is dischargeable solely by the Tier 2 journey, which is already recorded as blocked because `EmbeddingPort` has no owner | Accept; state in the closing report that `SC-CTX-006` is unverifiable this Epic |
| E5 | Constitution | MEDIUM | `plan.md` Gate XII | Gate XII is PARTIAL — the commands producing these artifacts are unregistered because `EPIC-037` has not shipped | Not CRITICAL: the constitution itself carries *"Principle XII is enforceable in full only once EPIC-037 exists"*. Already in Complexity Tracking |

## Remediation (2026-08-31, same session)

`E1` and `E3` were fixed on the requester's explicit approval. `/speckit-analyze` is read-only by
contract, so the edits were made after the record was written and are noted here rather than by
rewriting the findings above — the findings were true when found, and a record that edits its own
history is the artifact `FR-DFR-025` refuses one Epic over.

**Resolved rows carry `✅` in the ID cell**, which is the convention `DOR-09` reads
(`analysis-record.ts`): the finding and its severity stay in the table, and it stops blocking. A
resolved finding is history, not a blocker.

| Finding | What changed |
|---|---|
| `E1` | `T1306` (failing test) and `T1307` (implementation) appended to Phase 3 for `FR-CTX-064`. They sit after `T1246` rather than in numeric sequence, because identifiers are never renumbered |
| `E3` | Thirteen requirement identifiers cited in the tasks that already prove them — `T1237`, `T1239`, `T1244`, `T1247`, `T1263`, `T1264`, `T1275`, `T1276`, `T1277`, `T1279`, `T1286`, `T1301` |

**`E2` remains open** and was not in the approved scope. It is the same class as `E1` —
`FR-CTX-014`'s `relevanceScore` is a field with no task — but the `E3` pass happened to cite
`FR-CTX-014` on `T1279`, so it is now *mentioned* by a task without being *tested* by one. That is
a weaker state than before in one specific way: a reader scanning for uncited requirements will no
longer find it. It is recorded here so the gap stays visible.

`E4` and `E5` remain open by design: `E4` is a success criterion nothing can verify until an
embedding provider exists, and `E5` is consistent with the constitution's own caveat.

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
- **Unmapped tasks**: none. All tasks cite a requirement, success criterion, research decision
  or constitution principle.
- **Entity consistency**: `spec.md`'s six Key Entities match `data-model.md`'s six tables. *(This
  was raised as a suspected inconsistency during analysis and disproved by extraction — the spec
  does carry `Index Entry`.)*
- **Research coverage**: all eleven `R-038-*` decisions are cited by at least one task.
- **Task ordering**: no phase depends on a later one; Phase 2 blocks every story, as declared.
- **Identifiers**: `T1220`–`T1305` at analysis, `T1220`–`T1307` after remediation; verified unique against 1,825 corpus identifiers (`G-26-15`).

## Metrics

| | |
|---|---|
| Total requirements | **55** — 45 `FR-CTX`, 10 `SC-CTX` |
| Total tasks | **86** at analysis · **88** after remediation |
| Research decisions | 11, all cited |
| Coverage | **96%** at analysis — 53 of 55 · **98%** after remediation — 54 of 55, `FR-CTX-014` (`E2`) the remaining gap |
| Requirements uncited by identifier | **13** at analysis · **1** after remediation (`FR-CTX-014`, and it is cited without being tested — see Remediation) |
| Ambiguity count | 0 |
| Duplication count | 0 |
| **Critical issues** | **0** |

## Next actions

No CRITICAL findings. `/speckit-implement 038` may proceed.

**`E1` and `E3` were fixed in this session** — see Remediation above. Finding `E1` here rather than
at convergence is the difference this step exists to make: the two prior instances of its class
were both found after the code was written.

`E3` had recurred three times across three Epics (`EPIC-033`'s `A1`, `EPIC-035`'s `SC-DFR-005`, and
here), which suggests the habit of citing a requirement where it is proved is not reliable and the
check for it should be **mechanical rather than remembered**. Fixing the instance does not fix
that; a governance check comparing declared requirements against those cited in `tasks.md` would,
and it belongs to `EPIC-026` rather than here.

**`E2` remains open** and is the one gap left: `FR-CTX-014` now has a citation and still has no
test.
