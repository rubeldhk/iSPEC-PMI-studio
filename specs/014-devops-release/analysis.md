# Analysis: DevOps & Release

**Epic**: `EPIC-014` · **Session**: 2026-08-19

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

## Findings

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| F1 | Inconsistency | MEDIUM | `plan.md` states **17** tasks; `tasks.md` lists **18** | Correct `plan.md`, or link the task list instead of restating a number that drifts |
| F2 | Underspecification | MEDIUM | No dated clarification session is recorded in `spec.md` | Run `/speckit-clarify`. Until then the register holds this Epic at `Specified` however far its plan and tasks have gone — `FR-ESK-018` derives the stage from a recorded session, never from the absence of markers |

**Blocking findings (CRITICAL or HIGH): 0.** `DOR-09` is satisfied.

## Coverage

| Measure | Value |
|---|---|
| Requirements owned | 0 |
| Owned requirements cited by a task or feature note | 0 of 0 |
| Tasks listed | 18 |
| Feature sections | 2 |
| Vague terms (config list) | 0 |
| Unresolved placeholders | 0 |
| `[NEEDS CLARIFICATION` markers | 0 |
| Constitution-mandated sections present | 3 of 3 |
| Clarification session recorded | no |

## Method

Run by `/speckit-analyze` as one pass across every Epic carrying a `tasks.md`, on 2026-08-19.
The detection passes this record reports are **measured**, not judged: requirement ownership and
citation, task counts against those the documents state, the vague-term list in
[`governance.config.json`](../../governance/governance.config.json), unresolved placeholders and
`[NEEDS CLARIFICATION` markers outside inline code, the constitution-mandated sections, and the
plan's Constitution Check gate.

**What that does and does not buy.** Every finding below is reproducible and cites what was counted.
A systematic pass will not catch what only a careful human read of this Epic's subject matter would —
EPIC-027's own closure records exactly that limit, where eight of ten sampled clause verdicts held
and two were wrong in ways no completeness check could see. This record claims the passes ran and
what they returned; it does not claim a domain expert read the specification.

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

# Analysis: DevOps & Release — F-11.3

**Epic**: `EPIC-014` · **Session**: 2026-08-24

Produced by `/speckit-analyze` against `spec.md`, `plan.md` and `tasks.md`.

**Why a second session, appended rather than replacing the first.** The 2026-08-19 record above ends
*"The findings above are left as recorded… a later fix does not change what was found."* Overwriting
it would destroy the only evidence that the earlier pass ran, which is the whole reason
`FR-ESK-019` makes this command write a dated artifact at all. Two sessions, two dates, both
readable.

**Scope of this pass**: the `F-11.3 Containerised local deployment` function, added the same day by
[`D-45`](./decisions/D-45-containerised-local-deployment-lands-in-epic-014.md), together with the
plan and task changes that came with it. The release gate (F-11.1, F-11.2) was re-read but is
unchanged since 2026-08-19 except where noted in `I1`.

## Findings

| ID | Category | Severity | Summary | Recommendation |
|---|---|---|---|---|
| I1 ✅ | Inconsistency | HIGH | `plan.md`'s Scope table says F-11.1 has **3** tasks; `tasks.md` lists **4** — `T452` was added and the count was not. **This is `F1` from the 2026-08-19 session recurring**: that finding was closed by `T686` deleting the *total* from `plan.md` while leaving the *per-function* counts, so the same class of drift reopened in the same table | Delete the `Tasks` column from the Scope table rather than resynchronising it. A number restated in two documents is the PP-002 fault itself, and `T686` already established that only `tasks.md` carries counts |
| C1 ✅ | Constitution | HIGH | `spec.md`'s new SRS traceability note records the containerisation back-fill owner as **`unassigned`**. Constitution II is the gate and the spec template asks for *"list + back-fill owner"*. `EPIC-036`'s `handovers.md` discipline exists precisely because owner-less debt is this programme's recurring failure mode | Name an owner, or record explicitly that the programme accepts containerisation as SRS-unsourced and why. **`unassigned` is neither of those things** — it is the absence of a decision wearing the shape of one |
| D1 ✅ | Duplication | MEDIUM | `plan.md`'s header states *"counted there, never restated here (`T686`, PP-002)"* and its Scope table three lines below restates three counts. The document contradicts itself about whether it restates counts — which is how `I1` happened | Same fix as `I1`. The header is correct; the table is the violation |
| U1 ✅ | Underspecification | MEDIUM | `T150i` asks to *extend* `.dockerignore` so the build context excludes `.env`, `node_modules`, `.git`, `dist` and `specs/`. **All of them are already excluded**, along with `.env.*`, `SRS/`, `adr/`, `coverage/`, `*.log` and `Dockerfile*`. As written the task is a no-op that will be marked `[X]` having changed nothing | Rewrite as *verify and assert* — the exclusions become an assertion in `T150a` rather than an edit nobody needs to make |
| U2 ✅ | Underspecification | MEDIUM | `T150n` cites *"(conformance: `T452`, extended to cover the container path)"*, but **`T452` is marked `[X]`**. Extending a completed task's check has no task of its own, so the extension has no owner and no fail-first evidence | Give the extension its own identifier, or state that `T150n` edits `tests/governance/readme-conformance.spec.ts` directly and carries the check itself |
| I2 ✅ | Inconsistency | MEDIUM | `plan.md` Gate V names **three** checks needing mutations — credential, history-fallback and **dev-entry-point**. `T150m`'s three mutations are credential, history-fallback and **unreachable-database**. The dev-entry-point check has no mutation; the database mutation belongs to no check Gate V names | Either add the fourth mutation, or state in Gate V that `T150b`'s **fail-first ordering is** its mutation evidence — it must go red on the unfixed `dev` script before `T150f` runs, which is the same guarantee arrived at differently |
| L1 ✅ | Inconsistency | LOW | The 2026-08-19 Remediation section above records `F2` as *"unremediated — it needs `/speckit-clarify` to actually run"*, but `spec.md` now carries `### Session 2026-08-19` with a taxonomy scan. The note is stale, most probably because clarify ran later that same day | Recorded here rather than by editing the earlier session. **`F2` is discharged**: the spec has its dated session |
| L2 ✅ | Terminology | LOW | *"Containerised local deployment"* (spec, plan) · *"the containerised local stack"* (contract, quickstart) · *"container stack"* (the transcript filename in `T150l`) | Pick one form. No reader will be misled; recorded for completeness rather than because it costs anything |

**Blocking findings when this pass ran (CRITICAL or HIGH): 2** — `I1` and `C1`. **All eight are now
marked ✅ and remediated** the same day; see *Remediation* below. `DOR-09` reads the ✅ marker and
skips resolved rows, so the Definition-of-Ready gate is no longer held by this record.

**The findings above are left as recorded**, the way the 2026-08-19 session left its own. They state
what the pass returned on the day it ran; the ✅ says what happened next, and neither erases the
other.

## Coverage

`EPIC-014` owns **no numbered `FR-###` or `SC-###`** — stated in `spec.md`, and correct for an
infrastructure Epic. Coverage is therefore measured against its **nine Exit Criteria**, the only
requirement-shaped inventory it has.

| Exit criterion | Has task? | Task IDs |
|---|---|---|
| Every task has a unit test or an executable conformance check | ✅ | `T150a`–`T150d`, `T213` |
| Container stack starts from a clean checkout; one origin; `/v1`; a routed address is not a 404 | ✅ | `T150l` (Scenarios 1–3) |
| No image contains a credential, asserted executably | ✅ | `T150a`, `T150m` |
| The reference local stack still runs; documentation states which stack is which | ✅ | `T150l` (Scenario 7), `T150n` |
| `/speckit-converge` reports no unbuilt work | ✅ | `T214` |
| `defects/` contains no open records | ✅ | `T215` |
| Principle deltas still hold | ✅ | `T216` |
| Closure recorded; Epic release-eligible | ✅ | Phase Z |
| Release gate: fifteen `closure.md` records, then promotion | ✅ | `T151`–`T156` |

**Coverage: 9 of 9.** No unmapped tasks — every one of the fifteen F-11.3 tasks traces to an Exit
Criterion or to a decision in [research.md](./research.md).

## Metrics

- Numbered requirements owned: **0** (by design) · Exit Criteria used as the inventory: **9**
- Total tasks: **33** — 4 complete, 29 open · F-11.3: **15**
- Coverage: **100%** of Exit Criteria carry at least one task
- Ambiguity: **0** · Duplication: **1** · **CRITICAL: 0** · HIGH: **2** · MEDIUM: **4** · LOW: **2**

## Method, and what this pass cannot see

Six detection passes ran: duplication, ambiguity, underspecification, constitution alignment,
coverage gaps and inconsistency. Counts were verified by recounting `tasks.md` rather than by reading
what any document claimed. `.dockerignore` was read rather than assumed, which is how `U1` was found.

**What it did not check.** Nobody has run `docker compose up` — the design is analysed, not
executed, and `T150l`/`T150m` are where it meets reality. Whether `@nestjs/serve-static`'s `exclude`
behaves as `R-014-1` expects against this particular route table is a claim from documentation, not
an observation. And, as the 2026-08-19 session recorded of itself, a systematic pass does not
substitute for a domain expert reading the specification.

## Remediation — 2026-08-24

Applied the same day, on explicit authorisation, after the read-only pass above. Six findings needed
an edit; two needed a disposition and got one.

| Finding | What changed |
|---|---|
| `I1`, `D1` | **The `Tasks` column is deleted from `plan.md`'s Scope table**, not resynchronised. The header four lines above it has said *"counted there, never restated here"* since `T686`; the table was a contradiction of its own document, and re-syncing a number is what produced the drift twice. `tasks.md` is now the only place tasks are counted, per function as well as in total |
| `C1` | **`spec.md` names the owner and the venue.** The back-fill question — *should containerisation be a `BR-####` in `PMI-DOC-004`?* — is the **project owner's**, taken the way `D-44` and `D-45` were taken, and raised at this Epic's convergence gate (`T214`). Both admissible answers are written down so the question cannot be closed by drift. Until then F-11.3 proceeds as SRS-unsourced infrastructure, **the same standing `T149` and `T150` have had since 2026-08-03** |
| `U1` | **`T150i` is now an assertion, not an edit.** It extends `T150a`'s check to cover the `.dockerignore` exclusions and verifies no edit is needed. Every exclusion it asked for was already present — the task would have been ticked having changed nothing. *What was missing was never the exclusions; it was anything that would notice if they disappeared* |
| `U2` | **`T150p` created** to carry the README check's extension. `T150n` now cites it instead of `T452`, which is `[X]` complete — a finished task cannot own new work, and the extension had no fail-first evidence while it hung off one |
| `I2` | **Gate V now lists four checks and four pieces of fail-first evidence**, in a table. Three are mutations; `T150b`'s is **fail-first ordering** — it must go red on the unfixed `dev` script before `T150f` runs, which is `T200c`'s standard reached against the real fault rather than an injected one |
| `L1` | **No edit.** `F2` from 2026-08-19 is discharged — `spec.md` carries its dated session — and that is recorded here rather than by editing the earlier session, which says its findings stand as returned |
| `L2` | **Accepted, not fixed.** *"Containerised local deployment"* is the **function**; *"the containerised local stack"* is the **thing it delivers**. Rewriting four files to collapse a distinction that is arguably correct would be churn for a finding whose own summary says no reader will be misled |

**What this remediation did not touch.** No code, no test, no `Dockerfile` — none of those exist
yet. Every edit was to `spec.md`, `plan.md` or `tasks.md`, which is the correct blast radius for
findings about specification documents.

**Two of the six were faults I introduced hours earlier in this same session** — `C1`'s
`unassigned` owner was written during `/speckit-specify`, and `U1`'s no-op task during
`/speckit-tasks`. That is the value of running the analysis before implementing rather than after:
`U1` in particular would have been marked `[X]` by whoever picked it up, having changed nothing, and
nothing downstream would have disagreed.
