# Analysis: Epic Stage Register & Definition of Ready

**Epic**: `EPIC-026` · **Session**: 2026-08-18

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

> **Why this record is dated after the analysis ran.** The analysis was performed before `T486`
> amended `speckit-analyze` to write a record, so the command was strictly read-only and left
> nothing behind. That is precisely the gap `FR-ESK-019` exists to close — *"every other stage in
> the journey already leaves an artifact; making this one the sole hand-declared exception would
> carve a hole in FR-ESK-003 on the day it is written."* The findings below are the ones reported
> at the time, with their current status appended.

## Findings

**Zero outstanding findings.** Every finding raised by this analysis has been resolved or decided.

The table below carries **outstanding** severity — a resolved finding has none, which is why it sits
in the second table under a different identifier. `DOR-09` reads the first table to decide whether
findings are blocking, so "severity" there must mean *severity now*, not *severity when found*.

| ID | Category | Severity | Summary |
|---|---|---|---|
| — | — | — | none outstanding |

### Resolved during implementation

| ID | Category | Severity when found | Summary | Resolution |
|---|---|---|---|---|
| R1 ✅ | Inconsistency | HIGH | `T529` hard-coded the drift it existed to fix — quoting 31 / 32 / 34 when the real numbers had become 31 / 37 / 38 | `T529` corrected both prose sources to **38** with its composition recorded; `T517` removed the README copy entirely |
| R2 ✅ | Coverage Gap | HIGH | `T535` requires promotion `local → dev → stage → prod`, but Gate VII records *"this epic ships no runtime artifact"* | **Decided by the project owner, 2026-08-18**: Constitution VII is **not applicable**, following the EPIC-027 precedent. Recorded in `closure.md` |
| R3 | Coverage Gap | MEDIUM | `SC-ESK-003` was named nowhere outside its own definition | Asserted by `G-26-03` *"gives every row a stage — no Epic is unstaged"* and by `render.spec.ts` |
| R4 | Coverage Gap | MEDIUM | `FR-ESK-017` had zero task references | Named in `T486`/`T487`'s skill amendments and asserted by `G-26-06` |
| R5 | Underspecification | MEDIUM | `FR-ESK-019` unimplemented, so no Epic could reach `Analyzed` | `T486` landed; **this record is the first `analysis.md` in the repository** |
| R6 | Inconsistency | LOW | `spec.md` says "25 Epics"; there are 28 | Superseded — `FR-ESK-008` makes the register self-populating, so the prose count is redundant rather than maintained |
| R7 | Inconsistency | LOW | `plan.md` header read `**Tasks**: to be generated` | Corrected to `71 (T466–T536)` |
| R8 | Inconsistency | LOW | Gate VIII recorded as QUALIFIED for a branch no longer in use | This session ran on `epic/026-epic-stage-kanban`; `G-10` reports nothing |

**Zero CRITICAL findings were raised at any point.**

## Coverage

- Functional requirements: **24**, all referenced by at least one task (`FR-ESK-017` indirectly — see F4)
- Success criteria: **14**, 13 exercised by quickstart scenarios `V26-1`–`V26-8`, `SC-ESK-003` by check
- Tasks: **71**
- Ambiguity findings: **0** — no vague adjectives, no unresolved placeholders in any artifact
- Duplication findings: **0**

## Remediation — 2026-08-19

Findings from this session were acted on the same day by EPIC-026 `T686` and `T687`:

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

---

# Analysis: Epic Stage Register & Definition of Ready — F-26.9

**Epic**: `EPIC-026` · **Session**: 2026-08-25

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

**Appended, not replacing.** The 2026-08-18 session above records what that pass returned and why it
was written down late; overwriting it would destroy the only evidence that it ran, which is the
whole reason `FR-ESK-019` makes this command write a dated artifact.

**Scope of this pass**: the `F-26.9` task-identifier format — `FR-ESK-025`, clarified the same day,
plus the plan, contract, quickstart scenario and twelve tasks that came with it. The rest of the
Epic was re-read and is unchanged.

## Findings

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| A1 ✅ | Inconsistency | HIGH | `plan.md:71` states *"Task figures are **estimates** — `/speckit-tasks` has not run."* **It has run**: `tasks.md` holds **105** tasks, **93 complete**. Line 85 states *"Estimated total: **~42** tasks"*. **This is a task count restated in a second document — inside the Epic whose own `T686` remediation removed exactly that from eleven other plans**, and whose Purpose section cites `EPIC-018`'s 31 / 32 / 34 drift as its motivating evidence | **Delete the `Est. tasks` column and the total**, as `T686` did elsewhere — do not resynchronise them. `tasks.md` is where tasks are counted, and a number stated in one place does not drift |
| A2 ✅ | Coverage Gap | MEDIUM | **`FR-ESK-025` has no success criterion.** All fourteen `SC-ESK-*` predate it and **none mentions identifiers, patterns or uniqueness** (verified: zero matches). Every other `FR-ESK-*` maps to a measurable outcome; this one's definition of done lives only in a `plan.md` bullet, which is a plan-level statement rather than a spec-level target | Add `SC-ESK-015`: **zero** inline identifier patterns across the three checks, and **100%** of unrecognised identifiers reported rather than skipped. Both are countable, which is what `FR-ESK-011` asks of every condition |
| A3 ✅ | Underspecification | LOW | `data-model.md` has **zero** mention of the identifier format, while `contracts/task-identifier-format.md` now exists with no counterpart in the model. A format rule is arguably not an entity — but the plan's Phase 1 outputs describe the model as *"the artifact model … and the derivation rules that join them"*, and this is a derivation rule | Either add a one-line pointer, or record in the plan that a format rule is deliberately **not** modelled as an entity. Silence leaves the next reader to guess which |

**Blocking findings when this pass ran (CRITICAL or HIGH): 1** — `A1`. **All three are now marked ✅
and remediated** the same day; see *Remediation* below. `DOR-09` reads the ✅ marker and skips
resolved rows, so the Definition-of-Ready gate is no longer held by this record.

**The findings above are left as recorded**, the way the 2026-08-18 session left its own. They
state what the pass returned; the ✅ says what happened next.

## Coverage

| Requirement | Has task? | Task IDs |
|---|---|---|
| `FR-ESK-025` *(new)* | ✅ | `T864a`–`T864l` — twelve tasks, checks ordered before the things they check |
| `FR-ESK-015` *(amended: the pattern is configuration)* | ✅ | `T864d`, `T864e` |
| `FR-ESK-001`–`FR-ESK-024` | ✅ | `T466`–`T536`, `T851`–`T854`, all 93 complete |
| `SC-ESK-001`–`SC-ESK-014` | ✅ | unchanged |
| **`SC-ESK-015`** | ❌ | **does not exist** — see `A2` |

**Coverage: 100% of functional requirements carry at least one task.** No unmapped tasks: all twelve
trace to `FR-ESK-025`, to `FR-ESK-015`, or to a decision in `research.md`.

## Metrics

- Requirements: **39** — 25 `FR-ESK-*`, 14 `SC-ESK-*`
- Tasks: **105** — 93 complete, 12 open
- Coverage: **100%** of FRs · **97%** of requirements overall (`FR-ESK-025` lacks an SC)
- Ambiguity: **0** · Duplication: **1** · **CRITICAL: 0** · HIGH: **1** · MEDIUM: **1** · LOW: **1**
- Terminology: consistent — `recogniser` 17, `recognizer` 0

## Method, and what this pass cannot see

Six detection passes ran: duplication, ambiguity, underspecification, constitution alignment,
coverage gaps and inconsistency. **Counts were verified by recounting** `tasks.md` rather than by
reading what any document claimed — which is how `A1` was found. The success-criteria gap was found
by searching all fourteen `SC-ESK-*` for identifier vocabulary and getting zero.

**Constitution: no violations.** Gate V is satisfied twice for `F-26.9` — `T864a` covers
`epic-stage.config.json` as a non-code output, and `T864c` covers the absence claim that nothing is
silently skipped. Gate III's recursion — a function *about* identifiers whose own tasks need
identifiers — is resolved, and the task block header states why the last free prefix was spent here.

**What it did not check.** Nothing has been run: `taskIdentifierPattern` does not exist yet, the six
inline patterns are still in place, and whether the widened check surfaces malformed identifiers in
other Epics is `T864k`'s question, not this pass's. Whether `^T\d{3,}[a-z]?$` is the *right* shape
is a judgement recorded in `R-026-8`, not a fact this pass verified.

## Remediation — 2026-08-25

Applied the same day, on explicit authorisation, after the read-only pass above.

| Finding | What changed |
|---|---|
| `A1` | **The `Est. tasks` column and the `~42` total are deleted from `plan.md`**, not resynchronised, along with the sentence claiming `/speckit-tasks` had not run. `tasks.md` is now the only place tasks are counted — which is what this Epic's own `T686` established for eleven other plans, and what its Purpose section cites `EPIC-018`'s 31 / 32 / 34 drift to justify. Resynchronising would have set up the third count |
| `A2` | **`SC-ESK-015` added**: zero inline identifier patterns, and 100% of unrecognised identifiers reported rather than skipped. Both halves countable, per `FR-ESK-011`. The second half is the one that matters — *"zero failures"* and *"zero examinations"* are indistinguishable from outside, which is exactly why `T441n` called a silent skip worse than a collision |
| `A3` | **Recorded rather than modelled.** `plan.md`'s Phase 1 outputs now state that `FR-ESK-025` is a **format rule, not an entity**: it constrains the shape of an identifier the model already refers to and adds no attribute, relationship or state transition. `data-model.md` is unchanged, and the omission is now a decision a reader can see rather than one they must infer |

**What this remediation did not touch.** No task, no check, no configuration — `taskIdentifierPattern`
still does not exist and the six inline patterns are still in place. That is `T864a`–`T864l`'s work.
Every edit here was to `spec.md` or `plan.md`, which is the correct blast radius for findings about
specification documents.

**`A1` was this Epic's own fault, in its own subject.** `EPIC-026` exists because task counts drift
when two documents restate them; its plan restated one, and had since before this session opened it.
The Epic that owns the requirement was breaking it.
