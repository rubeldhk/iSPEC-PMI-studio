# DEF-026-008 — `DOR-09` cannot see the findings it reads

**Epic**: `EPIC-026` (owns the DOR) · affects **every Epic that has ever been analysed**
**Raised**: 2026-08-20 | **Status**: **CLOSED — FIXED 2026-08-20**
**Found by**: the second `/speckit-analyze` run on EPIC-029, when a record carrying a **CRITICAL**
finding was reported by the gate as having none
**Severity**: **HIGH** — the readiness gate for analysis findings has never fired

## What it does

`DOR-09` decides whether an analysis record carries blocking findings:

```ts
const blocking = analysis
  .split(/\r?\n/)
  .filter((row) => /^\|\s*F\d+\s*\|/.test(row))
  .filter((row) => /\|\s*(CRITICAL|HIGH)\s*\|/.test(row));
```

It counts only rows whose first cell is `F` followed by digits. But `/speckit-analyze`, in the same
repository, instructs the opposite:

> *"(Add one row per finding; generate stable IDs prefixed by **category initial**.)"*

and its worked example uses `A1` for a Duplication finding. Following the command as written
produces `A1`, `D1`, `C1`, `U1`, `O1`, `I1` — **none of which the gate matches**.

`validateAnalysisRecord` shares the same assumption: it checks the severity vocabulary only on rows
matching `/^\|\s*F\d+\s*\|/`, so a record using category-initial IDs is never checked for a valid
severity either. Both halves of the contract are unenforced together.

## Reproduction

1. `specs/029-design-system/analysis.md`, first run (2026-08-20), recorded six findings with IDs
   `D1`, `C1`, `U1`, `O1`, `I1`, `C2`.
2. `D1` was rated **CRITICAL** and described a Constitution V violation — `T866` changing
   `main.tsx` with no paired check.
3. `DOR-09` reported `analysis recorded, no blocking findings`.
4. EPIC-029 was `Ready`, with next command `/speckit-implement`.

## Expected vs actual

| | |
|---|---|
| **Expected** | An analysis record containing a CRITICAL or HIGH finding holds its Epic out of `Ready` |
| **Actual** | The record is read, the finding is parsed by nobody, and the gate reports zero blocking findings |

## Why it survived

The same shape as `DEF-026-006`, and for the same underlying reason: **a DOR condition hand-rolls a
regex against prose, and the prose it expects is written by a different document that was never
checked against it.** `DEF-026-006` read a field label instead of its value; this one reads an ID
format nothing produces.

It is invisible from either side alone. Reading `dor.ts`, the pattern looks deliberate. Reading
`/speckit-analyze`, the ID guidance looks harmless. Only holding both open at once shows they
disagree — and nothing in the repository holds them open at once, because no check reads the command
definitions.

**This is the ninth defect of one shape in this Epic** — see `D-43`.

## Blast radius

Every `analysis.md` in the repository. Any Epic whose analysis found blocking issues could reach
`Ready` regardless. EPIC-029's first run is the confirmed instance; others are likely and should be
swept as part of the fix.

## Remaining work

- Reconcile gate and command. Widening the gate's pattern is the smaller change and does not
  invalidate records already written; changing the template would require rewriting every existing
  record.
- **Mutation-verify**: a record carrying a CRITICAL row MUST fail `DOR-09`. The condition has never
  been observed failing, so it has never been shown to work.
- Apply the same pattern to `validateAnalysisRecord`, which shares the assumption.
- Sweep existing `analysis.md` records for findings the gate has been ignoring.
- **No code was changed by the analysis run that found this.** Fixes re-enter as tasks
  (Constitution VI).

## Links

- [`D-43`](../../_shared/decisions/D-43-dor-conditions-parse-prose-by-hand.md) — the recurring shape
- [`DEF-026-006`](./DEF-026-006-dor-03-reads-the-label-not-the-answer.md) — nearest predecessor
- [`DEF-026-009`](./DEF-026-009-dor-06-cannot-see-a-marked-fail.md) — found in the same session
- `specs/029-design-system/analysis.md` — finding `F4`, the report this record came from

## Resolution (2026-08-20) — **CLOSED, FIXED**

Resolved by `T905`–`T907`. The reader was widened rather than the template changed, so every record
already written stays valid.

**The defect had four gaps, not one.** Only the first was visible from the report; the rest were
found by fixing it — which is the honest account of how this went:

| | Gap | Found by |
|---|---|---|
| 1 | `FINDING_ROW` matched `F\d+`, so category-initial IDs were invisible | the report |
| 2 | Widening it made **resolved** findings block forever — EPIC-026, closed since 2026-08-18, flipped to `Not ready` on two findings fixed that day | running the fix |
| 3 | The severity matcher could not see `\| **CRITICAL** \|`. EPIC-029's `D1` was hidden **twice over** — wrong ID prefix *and* bolded severity. Either alone sufficed | the sweep |
| 4 | Widening reached **remediation** tables, which reuse the same IDs with different columns; EPIC-023's seven entries became seven invalid severities | the regression it caused |

**Fixes**, all in `tests/governance/epic-stage/analysis-record.ts`, shared with `DOR-09` rather than
duplicated — two readers of one table should not each carry their own idea of its shape:

- `FINDING_ROW` accepts any letter prefix followed by digits;
- `RESOLVED_FINDING` — a trailing `✅` marks a finding closed. Declared here rather than left to
  each author. Before it existed, `| D1 ✅ |` *happened* not to match, so resolved rows were skipped
  for the right outcome by the wrong mechanism, and their severities went unvalidated as a result;
- `findingSeverity()` reads through bold, italic and code emphasis;
- `findingRows()` scopes to the `## Findings` section — **an identifier shape is not a table
  identity**.

**Mutation-verified** (`T905`): 25 assertions, each observed failing first. The section-scoping fix
was additionally mutation-checked by disabling the scope and confirming two assertions fail.

## Sweep (`T907`)

Findings the gate had been ignoring, now visible:

| Epic | Blocking rows | Status |
|---|---|---|
| EPIC-023 | 6 | **genuinely open** — "Recommendation" column, no resolution recorded |
| EPIC-024 | 5 | **genuinely open** |
| EPIC-025 | 5 | **genuinely open** |
| EPIC-026 | 2 | resolved 2026-08-18; marked `✅` |
| EPIC-029 | 2 open + 6 resolved | first-run findings marked `✅`; `F4`/`F5` were this defect and `DEF-026-009` |

### Three Epics changed readiness — `Ready` → `Not ready`

**EPIC-023, EPIC-024 and EPIC-025 were sitting at `Ready`, next command `/speckit-implement`, each
carrying open CRITICAL or HIGH analysis findings that `DOR-09` could not see.** Sixteen of them
between the three. Every one fails on `DOR-09` **alone** — no other condition was holding them
back, so the invisible findings were the *only* thing between those Epics and implementation, and
the gate meant to stop them reported clean.

| Epic | Open blocking findings | Only failing condition |
|---|---|---|
| EPIC-023 | 6 (one CRITICAL) | `DOR-09` |
| EPIC-024 | 5 | `DOR-09` |
| EPIC-025 | 5 | `DOR-09` |

EPIC-026 and EPIC-029 did not change: EPIC-026's two were resolved and are now marked `✅`, and
EPIC-029 was already held by `DOR-06` (`DEF-026-009`).

> **Correction.** An earlier draft of this record stated *"No Epic changed readiness."* That was
> wrong, and wrong in the direction that flatters the fix: the comparison was made against a
> register already regenerated under the new behaviour, so the baseline had moved before it was
> read. The committed register is the honest baseline, and it shows all three at `Ready`. Recorded
> rather than quietly amended, because a sweep that under-reports its own blast radius is the same
> failure mode as the defect it is closing.

## Links

- [`D-43`](../../_shared/decisions/D-43-dor-conditions-parse-prose-by-hand.md) — the recurring shape, still open
