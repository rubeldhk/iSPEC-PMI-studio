# Analysis: Artifact Access Control

**Epic**: `EPIC-024` · **Session**: 2026-08-19 (second pass)

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

> **Two sessions ran on this date.** The first was the programme-wide sweep recorded below under
> *Session 2026-08-19 (first pass)*. This second pass ran after the parent's third clarification
> session added `FR-ACC-028a` and `SC-018`, tasked here as `T811`–`T816`. Both records are kept.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
|---|---|---|---|---|---|
| C1 | Coverage Gap | CRITICAL | tasks.md `T374`, `T379` | **`FR-ACC-025`'s decisive clause is untested.** The 2026-08-08 clarification made it *most-restrictive-wins across **every** source* — the reading that stops derivation laundering access. `T374` still asserts the pre-clarification singular case, "a derived artifact is at least as restricted as **its source**". Nothing exercises two sources carrying different grants, which is the only case the clarification was called to settle | Extend `T374` to assert that a user must hold a grant on **every** source, using one open and one restricted source — the parent's own worked example |
| C2 | Coverage Gap | HIGH | tasks.md `T377` | **`FR-ACC-026` has no asserting test.** `T377` implements grant and revoke with audit, citing `T372`, which asserts that grants permit exactly their level. `T373` covers the *refusal* half of the audit trail; nothing asserts that a grant or a revocation is recorded with actor, change and time | Add a failing test for grant/revocation audit records, then repoint `T377`. `SC-013` rests on this |
| C3 | Inconsistency | HIGH | spec.md:3 | **The spec header reads `Tasks: 21`; `tasks.md` lists 27.** Stale since the 2026-08-19 tasking pass | Remove the count from the spec header — `tasks.md` is the counted source (`T686`, PP-002) |
| C4 | Coverage Gap | HIGH | spec.md "Requirements owned" / "Success criteria owned" | **`FR-ACC-028a` and `SC-018` are not declared owned**, though `T811`–`T816` satisfy them and the parent's child table assigns `FR-ACC-028a` here | Add both |
| C5 | Duplication | HIGH | plan.md:30-34, :68, :163 | **The task count is restated three times, all stale**: the Scope table sums to 21, gate III says "2 functions, 21 tasks", Definition of done says "21 tasks complete". Actual: **27** across **4** sections | Remove all three, as `T686` intended. This also corrects "2 functions" |
| C6 | Inconsistency | MEDIUM | plan.md G-024.1 | **G-024.1's supporting claim is now false in one particular.** It reads *"EPIC-023 does not depend on this epic. Nothing across its 43 tasks references access or grants."* EPIC-023 now has 55 tasks, and `FR-ACC-028a` ties this epic's `T815` to the review session EPIC-023 owns | Restate the evidence. **The conclusion still holds** — the corrected order EPIC-023 → EPIC-024 → EPIC-025 is unaffected, and EPIC-023's plan is the one that contradicts it (see EPIC-023 finding B2) |
| C7 | Inconsistency | MEDIUM | plan.md G-02F.1 | The success-criteria collision range reads `SC-001 … SC-013`; the parent's third session extended it to `SC-018` | Update the range. The fix belongs to decision **D-1** |
| C8 | Underspecification | LOW | tasks.md `T381` | `T381` cites `T372` as its unit test, which asserts grant levels rather than snapshot semantics. `T812` now asserts the snapshot's scope, so the substance is covered | Repoint `T381` from `T372` to `T812` |

**Blocking findings (CRITICAL or HIGH): 5** — C1–C5. `DOR-09` is **not** satisfied.

## Coverage

| Requirement | Has task? | Notes |
|---|---|---|
| FR-ACC-021, FR-ACC-022 | yes | `T377`, `T372` |
| FR-ACC-023, FR-ACC-024 | yes | `T378`, `T373`, `T427` |
| FR-ACC-025 | **partial** | `T379` implements; `T374` asserts only the single-source case (C1) |
| FR-ACC-026 | **implementation only** | `T377` — no asserting test (C2) |
| FR-ACC-027 | yes | `T380`, `T375`, `T428` |
| FR-ACC-028 | yes | `T381`, `T814`, `T812` |
| FR-ACC-028a | yes | `T811`–`T816` — **not declared owned** (C4) |

| Measure | Value |
|---|---|
| Requirements owned | 9 (incl. `FR-ACC-028a`) |
| Requirements with ≥1 task | 9 of 9 |
| Requirements with an **asserting** test | 7 of 9 |
| Success criteria satisfied here | `SC-007`, `SC-008`, `SC-013`, `SC-018` |
| Tasks listed | 27 |
| Feature sections | 4 |
| Unresolved placeholders | 0 |
| `[NEEDS CLARIFICATION` markers | 0 |
| Ambiguity count | 0 |
| Duplication count | 1 class, 3 instances (C5) |
| Critical issues | 1 |
| `defects/` present (Constitution VI) | yes |
| Clarification session recorded | yes — 2026-08-19 |

**Constitution alignment**: one issue. **Principle V (NON-NEGOTIABLE)** is not met in substance for
`FR-ACC-025` and `FR-ACC-026` (C1, C2), against a gate V reading "PASS — 0 gaps". Gate II passes outright
here — this is the one child of the three with real SRS backing.

**Unmapped tasks**: none.

## Method

A targeted read of `spec.md`, `plan.md` and `tasks.md` plus the parent design they inherit from.
Requirement-to-task mapping was computed by identifier match. **Where a task cites a unit test, the
cited test's own description was checked against what the task implements** — the check that produced
C1 and C2. C1 additionally compared each test's wording against the *clarified* requirement text
rather than the original, which is how a test that was correct when written showed up as stale.

**What this does and does not buy.** Every finding cites the lines it was drawn from. This pass reads
what the documents say about themselves; no code exists yet to check any claim against.

## Remediation — 2026-08-19

Applied the same day, at the user's direction. **The findings above are left as recorded.**

| Finding | Status | What was done |
|---|---|---|
| C1 | ✅ Closed | `T374` rewritten to assert most-restrictive-wins across **every** source, naming the parent's worked example — one open and one restricted requirement, hidden from anyone lacking a grant on the restricted one |
| C2 | ✅ Closed | `T826` added asserting every grant and revocation reaches the audit record with actor, change and time, in the same transaction; `T377` repointed. Gate V restated to ⚠️ **PASS WITH GAP** |
| C3 | ✅ Closed | The spec header's task count removed; it now links `tasks.md` |
| C4 | ✅ Closed | `FR-ACC-028a` and `SC-018` declared owned |
| C5 | ✅ Closed | All three restatements removed. The Scope table lost its `Tasks` column and gained the missing `F-024.6` section |
| C8 | ✅ Closed — **corrected 2026-08-19** | `T381` was first repointed to `T812`, which asserts *open-time session visibility*, not snapshot scope. The re-task sweep caught it; `T381` now cites **`T811`**, the snapshot-scope test. The original citation (`T372`) and the first correction were both wrong |
| C6, C7 | ○ Open | Not in the approved scope. Neither blocks `DOR-09`; C6's conclusion was already sound |

**Task count**: 27 → **28**. Synced to the parent's child table, the parent plan, and this epic's checklist.

**Blocking findings remaining: 0.** `DOR-09` is satisfied. Two stay open at MEDIUM.

---

## Session 2026-08-19 (first pass)

Retained. The programme-wide sweep recorded task-count drift and coverage measures; its figures were
correct for the 21-task state that preceded the 2026-08-19 clarification and tasking passes.
