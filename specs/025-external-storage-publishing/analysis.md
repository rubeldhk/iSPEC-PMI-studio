# Analysis: External Storage Publishing

**Epic**: `EPIC-025` · **Session**: 2026-08-19 (second pass)

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

> **Two sessions ran on this date.** The first was the programme-wide sweep recorded below under
> *Session 2026-08-19 (first pass)*. This second pass was triggered by the parent's third
> clarification session, which narrowed `FR-032` and added `SC-017` after EPIC-023 and EPIC-024 were
> re-tasked and EPIC-025 was not. Both records are kept: the first states what the sweep returned,
> this one states what a targeted read of the same three documents returned.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
|---|---|---|---|---|---|
| A1 | Coverage Gap | CRITICAL | tasks.md `T391`, `T388` | **`FR-034` has no asserting unit test.** `T391` implements FR-032 and FR-034 and cites `T384` as its unit test; `T384` asserts the publish **failure taxonomy** and nothing about the publish record. `T388` defines `PublishRecord` citing `T382` (connection states) and `T387` (no loss on switch). Nothing asserts that a publish records what, when, by whom and where it landed | Add a failing unit test for the publish record's contents, then repoint `T391`. Constitution V is NON-NEGOTIABLE, and `plan.md` currently claims "PASS — 0 gaps" |
| A2 | Coverage Gap | HIGH | spec.md "Requirements owned"; tasks.md `T391` | **`FR-032`'s 2026-08-19 narrowing is untasked.** The parent now forbids offering an artifact subset, so that `FR-036`'s added/replaced/left-alone preview always runs against a whole-project baseline. `T391` predates the change and neither implements nor tests the prohibition | Add a task and a failing test asserting no subset-selection path exists on the publish surface |
| A3 | Coverage Gap | HIGH | spec.md "Success criteria owned" | **`SC-017` is neither owned nor tasked.** The parent's new ceiling is 200 questions per review session **and 500 artifacts per publish**. EPIC-023 took the review half (`T810`); the publish half was left with no owner | Declare `SC-017` owned here and add a publish-scale integration test at 500 artifacts |
| A4 | Coverage Gap | HIGH | spec.md "Success criteria owned"; tasks.md | **`SC-012` is declared owned but has zero tasks.** No task asserts that deleting or altering a published file at the provider leaves the platform artifact untouched. `T387` covers switching and `T451` covers disconnection retention — neither covers external deletion | Add a failing unit test for provider-side deletion against a fixture provider (`T396`), which already supports injectable failures |
| A5 | Duplication | HIGH | plan.md:32-34, :68, :172 | **The task count is restated three times in `plan.md`, all three wrong.** The Scope table sums to **33** (26+2+5), Constitution Check III says **32**, Definition of done says **32**. `tasks.md` lists **37** (30+2+5). The previous analysis recorded this as remediated — "`plan.md`'s duplicate was **removed** rather than synchronised" — but only the header line was removed | Remove all three restatements, as `T686` intended. The header already links `tasks.md` as the counted source |
| A6 | Inconsistency | MEDIUM | spec.md "Clarifications" | **The clarification session records *Performance* as "answered nowhere in that chain".** The parent answered it the same day with `SC-017`. The child's session and the parent's edit are both dated 2026-08-19 | Update the Outstanding list to point at `SC-017`, or re-run `/speckit-clarify` for this Epic |
| A7 | Inconsistency | MEDIUM | plan.md G-025.2 | **G-025.2 is recorded "⚠️ open" on a ground that no longer holds.** Its stated complaint is "Not recorded in this epic's `Depends on`" — both `spec.md` and `tasks.md` now list EPIC-024 there. The underlying sequencing risk is real and unchanged (EPIC-024 is also HELD), but the recorded reason is stale | Restate G-025.2 as the sequencing risk it is, or close it and let the `Depends on` entry carry it |
| A8 | Inconsistency | MEDIUM | tasks.md:56-70 | **The "Credentials and disconnection" subsection contains eleven tasks that are neither.** It is headed *added 2026-08-08 — FR-029a, FR-029b, FR-038, SC-014* and holds `T447`–`T451`, but `T396` (fixture provider), `T421`–`T426` (controllers), `T429`–`T432` (concurrency, conformance, architecture) sit under it too | Move the unrelated eleven back under `F-02.6`, or split the subsection heading |
| A9 | Inconsistency | MEDIUM | plan.md G-02F.1 | **The success-criteria identifier collision widened and the record was not updated.** G-02F.1 states the family range as `SC-001 … SC-013`; the parent's third session extended it to `SC-018`, against the platform's `SC-001 … SC-012` | Note the widened range under G-02F.1. The fix belongs to decision **D-1**, not to this Epic |
| A10 | Inconsistency | LOW | plan.md:68 | Constitution Check III reads "2 functions"; `tasks.md` carries three sections — `F-02.6`, `F-025.UI`, `F-025.Z` | Correct to 3, or drop the count with the task count in A5 |
| A11 | Underspecification | LOW | tasks.md `T395` | `T395` ends with two trailing parentheticals — `(unit test: T387) (unit test: T451)` | Merge into one `(unit tests: T387, T451)` |
| A12 | Underspecification | LOW | tasks.md | `SC-009` and `SC-010` are covered by content (`T384`/`T393`/`T425` and `T387`/`T395`) but cited by no task | Add the citations, per `traceability-convention.md` |

**Blocking findings (CRITICAL or HIGH): 5** — A1, A2, A3, A4, A5. `DOR-09` is **not** satisfied.

## Coverage

| Requirement | Has task? | Task IDs |
|---|---|---|
| FR-029 | yes | T390, T382, T447, T449, T450 |
| FR-029a | yes | T447, T448 |
| FR-029b | yes | T449, T450 |
| FR-030 | yes | T389, T383 |
| FR-031 | yes | T390, T382, T447 |
| FR-032 | **partial** | T391, T384 — the 2026-08-19 narrowing is uncovered (A2) |
| FR-033 | yes | T392, T385 |
| FR-034 | **implementation only** | T391 — no asserting test (A1) |
| FR-035 | yes | T393, T384, T425 |
| FR-036 | yes | T394, T386, T424 |
| FR-037 | yes | T395, T387 |
| FR-038 | yes | T395, T387, T451 |
| FR-039 | yes | T389, T383 |
| FR-040 | yes | T394, T386, T429 |
| SC-009 | yes, uncited | T384, T393, T425 (A12) |
| SC-010 | yes, uncited | T387, T395 (A12) |
| SC-011 | yes | T432 |
| SC-012 | **no** | — (A4) |
| SC-014 | yes | T449, T450 |
| SC-017 | **no, and not owned** | — (A3) |

| Measure | Value |
|---|---|
| Requirements owned (FR) | 14 |
| Success criteria owned (SC) | 5 declared, 6 with `SC-017` |
| Owned keys with ≥1 task | 18 of 20 |
| Coverage | 90% |
| Tasks listed | 37 |
| Feature sections | 3 |
| Unresolved placeholders | 0 |
| `[NEEDS CLARIFICATION` markers | 0 |
| Ambiguity count | 0 |
| Duplication count | 1 class, 3 instances (A5) |
| Critical issues | 1 |
| Constitution-mandated sections present | 3 of 3 |
| `defects/` present (Constitution VI) | yes, empty |
| Clarification session recorded | yes — 2026-08-19 |

## Method

A targeted read of `spec.md`, `plan.md` and `tasks.md`, plus the parent design the three inherit
from. Requirement-to-task mapping was computed by matching each owned `FR-`/`SC-` identifier against
task text; task counts were recounted per section rather than read from any header. Where a task
cites a unit test, the cited test's own description was checked against what the task implements —
which is how A1 surfaced, and is the check the first pass did not run.

**What this does and does not buy.** Every finding cites the lines it was drawn from and can be
reproduced. This pass reads what the documents say about themselves; it does not verify the subject
matter against a provider's actual API, and no code exists yet to check any claim against.

## Remediation — 2026-08-19

Applied the same day, at the user's direction, after this record was written. **The findings above
are left exactly as recorded** — they state what the pass returned, and a later fix does not change
what was found. That convention is inherited from the first pass, which A5 shows is worth keeping:
a remediation described as complete had only partly run, and only the original finding made that
visible.

| Finding | Status | What was done |
|---|---|---|
| A1 | ✅ Closed | `T817` added asserting the publish record's contents. `T391` repointed from `T384` (which asserts the failure taxonomy) to `T817`/`T818`; `T388` also cites `T817`. `plan.md` gate V restated from "PASS — 0 gaps" to ⚠️ **PASS WITH GAP** naming the finding |
| A2 | ✅ Closed | `T818` and `T819` added for whole-project publish scope; `T425` extended to assert the endpoint accepts no artifact-subset parameter |
| A3 | ✅ Closed | `SC-017` declared owned in `spec.md`; `T820` added at 500 artifacts, the counterpart of EPIC-023's `T810` |
| A4 | ✅ Closed | `T821` added for provider-side deletion, using `T396`'s fixture |
| A5 | ✅ Closed | All three restatements removed from `plan.md` rather than corrected — the Scope table's `Tasks` column dropped, gate III and Definition of done now link `tasks.md`. **A10 closed in passing** ("2 functions" → 3) |
| A6 | ✅ Closed in passing | The *Performance* entry in `spec.md`'s clarification session now points at `SC-017` instead of reading Outstanding |
| A7 | ✅ Closed | G-025.2 restated: the "not recorded in `Depends on`" half is discharged, and what remains is named as the sequencing risk it is — EPIC-024 is also HELD, so `T392` must not pass on a green test with no grants to exclude by |
| A8 | ✅ Closed | The eleven regrouped under a new `### API surface, fixture and conformance` heading. They sat under the credentials heading because they were appended after it, not because they belonged to it |
| A9 | ✅ Closed | G-02F.1's range widened to `SC-001 … SC-018`. The fix remains decision **D-1**'s to make; only the record is corrected here |
| A11 | ✅ Closed | `T395`'s two trailing parentheticals merged into `(unit tests: T387, T451)` |
| A12 | ✅ Closed | `SC-009` cited by `T384` and `T393`; `SC-010` by `T387` and `T395` |

**Task count**: 37 → **42**. Synced across `tasks.md`, `spec.md`, this epic's checklist, the parent's
child-ownership table, and the parent's `plan.md` — family total 118 → **123**.

### Task identifiers renumbered — 2026-08-19

The 22 tasks added across EPIC-023, EPIC-024 and EPIC-025 in this session were first allocated
`T701`–`T722`, from a scan that showed `T700` as the repository maximum. That scan was correct when
it ran. EPIC-028 then took `T701`–`T710` concurrently on the active branch, and the collision was
caught by the post-write duplicate check rather than by the pre-write scan.

**Ours moved, theirs left alone** — EPIC-028's are in flight on the branch in front of them, and
editing another session's uncommitted file to make room for a HELD epic is the wrong way round. The
block is now `T800`–`T821`, which leaves the whole 700-range to EPIC-028:

| Epic | Was | Now |
|---|---|---|
| EPIC-023 | `T701`–`T711` | `T800`–`T810` |
| EPIC-024 | `T712`–`T717` | `T811`–`T816` |
| EPIC-025 | `T718`–`T722` | `T817`–`T821` |

64 references were rewritten across 8 files. Nothing collided at commit time, so this is a near miss
rather than a defect — but it is the same shape as `DEF-028-014`, and the lesson is that a maximum-ID
scan is not a reservation. Two sessions on one checkout can both read `T700` and both act on it.

**Blocking findings remaining: 0.** `DOR-09` is satisfied. **All twelve findings are closed** — A1–A6 on the first remediation pass, A7–A12 on the second, both 2026-08-19.

---

## Session 2026-08-19 (first pass)

Retained verbatim. Produced by the programme-wide sweep before the parent's third clarification
session ran.

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| F1 | Inconsistency | MEDIUM | `plan.md` states **32** tasks; `tasks.md` lists **37** | Correct `plan.md`, or link the task list instead of restating a number that drifts |
| F2 | Underspecification | MEDIUM | No dated clarification session is recorded in `spec.md` | Run `/speckit-clarify`. Until then the register holds this Epic at `Specified` however far its plan and tasks have gone — `FR-ESK-018` derives the stage from a recorded session, never from the absence of markers |

**Blocking findings (CRITICAL or HIGH): 0.** `DOR-09` was satisfied on that pass.

**F2 is now resolved** — `spec.md` carries a dated session. **F1 is not**, and is re-raised as A5
with evidence that the remediation recorded against it was only partly applied.

### Remediation recorded on the first pass

Findings from that session were acted on the same day by EPIC-026 `T686` and `T687`:

- **Task-count drift** — the count in `tasks.md` was corrected against a recount, and `plan.md`'s
  duplicate was **removed** rather than synchronised. A number restated in two documents is the
  PP-002 fault itself; only `tasks.md` now carries it, marked *counted, not quoted*.
- **Feature → requirement links** — the mandatory citation now sits in the `F-<epic>.<n>` framing
  notes (`traceability-convention.md`).
- **No clarification session** — unremediated. It needs `/speckit-clarify` to actually run, and
  writing the session without running it would fabricate the evidence `FR-ESK-017` exists to
  guarantee.

The findings above are left as recorded. They state what the pass returned on the day it ran; a
later fix does not change what was found.
