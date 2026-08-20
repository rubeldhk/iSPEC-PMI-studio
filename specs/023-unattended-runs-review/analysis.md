# Analysis: Unattended Runs & Team Review

**Epic**: `EPIC-023` · **Session**: 2026-08-19 (second pass)

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

> **Two sessions ran on this date.** The first was the programme-wide sweep recorded below under
> *Session 2026-08-19 (first pass)*. This second pass ran after the parent's third clarification
> session added `FR-RUN-013a`, `FR-RUN-019a` and `SC-015`–`SC-017`, and after the re-task pass added `T822`.
> Both records are kept.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
|---|---|---|---|---|---|
| B1 | Coverage Gap | CRITICAL | tasks.md `T347`, `T361`, `T363` | **Three requirements are implemented against unit tests that assert something else.** `T347` implements `FR-RUN-008` (stop and preserve all completed work, recording the reason) citing `T340`, which asserts only that a run does not pause and stops at the selected range. `T361` implements `FR-RUN-015` (commit all answers as one submission, then close the session to edits) citing `T355`, which asserts only refusal when questions are unanswered — neither atomicity nor closure. `T363` implements `FR-RUN-020` (retain submitted sessions permanently) citing `T352`, which asserts only that a session groups a run's questions | Add failing tests for each, then repoint. `plan.md` gate V claims "PASS — 0 gaps" and G-023.2 claims "every implementation task pairs with a test" — true by pairing, false by assertion |
| B2 | Inconsistency | HIGH | plan.md G-023.2, build order | **This plan carries the sequencing that EPIC-024's plan explicitly corrected and this one did not.** G-023.2 says `T381` "builds run-time access snapshotting" here and that "EPIC-024 should land before this epic's `F-02.1` completes". `T381` lives in **EPIC-024**, and EPIC-024's `G-024.1` corrected the direction on 2026-08-08: *"EPIC-023 does not depend on this epic… Corrected order: EPIC-023 → EPIC-024 → EPIC-025"* | Replace G-023.2 and the build-order warning with `G-024.1`'s corrected direction. Two sibling plans currently state opposite build orders |
| B3 | Inconsistency | HIGH | spec.md:3 | **The spec header reads `Tasks: 43`; `tasks.md` lists 55.** Stale since the 2026-08-19 tasking and re-task passes | Remove the count from the spec header — `tasks.md` is the counted source (`T686`, PP-002) |
| B4 | Coverage Gap | HIGH | spec.md "Requirements owned" | **`FR-RUN-013a` and `FR-RUN-019a` are not declared owned**, though `T800`–`T809` satisfy them and the parent's child table assigns them here | Add both rows |
| B5 | Coverage Gap | HIGH | spec.md "Success criteria owned" | **`SC-005a`, `SC-015`, `SC-016` and the review half of `SC-017` are not declared owned**, though `T348`/`T349`, `T801`, `T806`/`T807` and `T810` satisfy them | Add them |
| B6 | Duplication | HIGH | plan.md:31-38, :68, :93, :173 | **The task count is restated four times, all stale**: the Scope table sums to 43, gate III says "5 functions, 43 tasks", G-023.1 says "43 tasks across five functions", Definition of done says "43 tasks complete". Actual: **55** across **9** sections. The header line already declares counts are "never restated here" | Remove all four, as `T686` intended |
| B7 | Inconsistency | MEDIUM | plan.md Technical Context (R-002-6) | **"Conflicts are surfaced, not resolved"** now reads against `FR-RUN-013a`, which requires the project owner or run initiator to select the winning answer. The research intent — no silent last-write-wins — survives; the wording does not | Restate as "conflicts are never auto-resolved; a named human selects, and the losing answer is retained" |
| B8 | Coverage Gap | MEDIUM | tasks.md `T345`, `T359` | Two requirements are partly asserted. `FR-RUN-007` requires each question to carry "enough context for someone who did not start the run"; `T341` asserts options and the suggested answer, not context. `FR-RUN-010` requires attaching a note; `T353` asserts drafts and attribution, not notes | Extend `T341` and `T353` rather than adding tasks |
| B9 | Inconsistency | MEDIUM | plan.md G-02F.1 | The success-criteria collision range reads `SC-001 … SC-013`; the parent's third session extended it to `SC-018` | Update the range. The fix belongs to decision **D-1** |
| B10 | Inconsistency | MEDIUM | spec.md "Clarifications" | *Performance* is recorded as answered nowhere in the chain. The parent answered it the same day with `SC-017`, whose review half this epic owns and `T810` tests | Point the entry at `SC-017` |
| B11 | Inconsistency | LOW | plan.md:68 vs Scope table | Gate III says "5 functions"; the Scope table lists 6 rows and `tasks.md` now carries 9 sections | Drop the count with B6 |

**Blocking findings (CRITICAL or HIGH): 6** — B1–B6. `DOR-09` is **not** satisfied.

## Coverage

Owned requirements, against `tasks.md`:

| Requirement | Has task? | Notes |
|---|---|---|
| FR-RUN-001, FR-RUN-002, FR-RUN-008a | yes | `T344`, `T340` |
| FR-RUN-003, FR-RUN-004 | yes | `T345`, `T341` |
| FR-RUN-005, FR-RUN-017 | yes | `T346`, `T342` |
| FR-RUN-005a – FR-RUN-005c | yes | `T351`, `T348`, `T349` |
| FR-RUN-006, FR-RUN-009 | yes | `T358`, `T352` |
| FR-RUN-007 | **partial** | `T345` implements; `T341` does not assert context (B8) |
| FR-RUN-008 | **implementation only** | `T347` — cited test asserts something else (B1) |
| FR-RUN-010 | **partial** | `T359` implements; `T353` does not assert notes (B8) |
| FR-RUN-011, FR-RUN-012 | yes | `T359`, `T353` |
| FR-RUN-013 | yes | `T360`, `T354` |
| FR-RUN-013a | yes | `T800`–`T805` — **not declared owned** (B4) |
| FR-RUN-014 | yes | `T361`, `T355` |
| FR-RUN-015 | **implementation only** | `T361` — cited test asserts refusal only (B1) |
| FR-RUN-015a | yes | `T362`, `T356` |
| FR-RUN-016, FR-RUN-018, FR-RUN-019 | yes | `T369`–`T371`, `T366`–`T368` |
| FR-RUN-019a | yes | `T806`–`T809` — **not declared owned** (B4) |
| FR-RUN-020 | **implementation only** | `T363` — cited test asserts grouping only (B1) |

| Measure | Value |
|---|---|
| Requirements owned | 25 (incl. `FR-RUN-013a`, `FR-RUN-019a`) |
| Requirements with ≥1 task | 25 of 25 |
| Requirements with an **asserting** test | 22 of 25 |
| Success criteria satisfied here | `SC-001`–`SC-006`, `SC-015`–`SC-017` |
| Tasks listed | 55 |
| Feature sections | 9 |
| Unresolved placeholders | 0 |
| `[NEEDS CLARIFICATION` markers | 0 |
| Ambiguity count | 0 |
| Duplication count | 1 class, 4 instances (B6) |
| Critical issues | 1 |
| `defects/` present (Constitution VI) | yes |
| Clarification session recorded | yes — 2026-08-19 |

**Constitution alignment**: one issue. **Principle V (NON-NEGOTIABLE)** is not met in substance for
`FR-RUN-008`, `FR-RUN-015` and `FR-RUN-020` (B1). Gate II's SRS debt is correctly declared and gated at `T404`,
so it is not a finding.

**Unmapped tasks**: none.

## Method

A targeted read of `spec.md`, `plan.md` and `tasks.md` plus the parent design they inherit from.
Requirement-to-task mapping was computed by identifier match. **Where a task cites a unit test, the
cited test's own description was checked against what the task implements** — the check that produced
B1, and the one a citation-level sweep cannot run.

**What this does and does not buy.** Every finding cites the lines it was drawn from. This pass reads
what the documents say about themselves; no code exists yet to check any claim against.

## Remediation — 2026-08-19

Applied the same day, at the user's direction. **The findings above are left as recorded** — they
state what the pass returned; a later fix does not change what was found.

| Finding | Status | What was done |
|---|---|---|
| B1 | ✅ Closed | `T823` (FR-RUN-008 stop preserves work), `T824` (FR-RUN-015 all-or-none + closure) and `T825` (FR-RUN-020 permanent retention) added; `T347`, `T361`, `T363` repointed. Gate V restated from "PASS — 0 gaps" to ⚠️ **PASS WITH GAP** |
| B2 | ✅ Closed | G-023.2 rewritten to EPIC-024's corrected direction — `T381` lives in EPIC-024, `Run` is defined here by `T343`, order is EPIC-023 → 024 → 025. The build-order diagram's warning replaced and the three new sections added to it |
| B3 | ✅ Closed | The spec header's task count removed rather than corrected; it now links `tasks.md` |
| B4 | ✅ Closed | `FR-RUN-013a` and `FR-RUN-019a` declared owned |
| B5 | ✅ Closed | `SC-005a`, `SC-015`, `SC-016`, `SC-017` declared owned |
| B6 | ✅ Closed | All four restatements removed. The Scope table lost its `Tasks` column and **gained the three sections it was missing** (`F-023.5`–`F-023.7`). **B11 closed in passing** |
| B8 | ✅ Closed 2026-08-19 (re-task pass) | `T341` extended to assert `FR-RUN-007`'s context requirement and `FR-RUN-004`'s use of the suggested answer as a *provisional* one; `T353` extended to assert `FR-RUN-010`'s note attachment |
| B7, B9, B10 | ○ Open | Documentation wording. None blocks `DOR-09` |

**Task count**: 55 → **58**. Synced to the parent's child table, the parent plan, and this epic's checklist.

**Blocking findings remaining: 0.** `DOR-09` is satisfied. Four stay open at MEDIUM.

---

## Session 2026-08-19 (first pass)

Retained. The programme-wide sweep recorded task-count drift and coverage measures; its figures were
correct for the 43-task state that preceded the 2026-08-19 clarification, tasking and re-task passes.
