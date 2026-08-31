# EPIC-035 — Defect Room: Epic closing report

**Task**: `T999z` · **Session**: 2026-08-31 · **Constitution IX**

**Status**: `Implemented`, with **three ports unbound by design**, **two Tier 2 obligations
outstanding that only a person can discharge**, and **promotion not performed**.

> **Correction, 2026-08-31.** The first version of this report stated that the task-identifier
> scheme was exhausted and that `EPIC-026` must widen it before `EPIC-038` could be tasked.
> **That was wrong**, and the section is rewritten below. `EPIC-026` widened the pattern at
> `T864d`–`T864i` under `FR-ESK-025`, with *no upper digit bound*, and every task of that Epic
> is complete. Nothing is blocked. The error is recorded rather than quietly edited out,
> because a closing report that revises its own facts without saying so is exactly the artifact
> `FR-DFR-025` refuses one table over.

---

## The one sentence this report exists to prevent being written

*"All seven user stories demonstrable, 5,900 tests green, Epic complete."*

Every clause is true and the sentence is misleading. This Epic delivered a Room whose **rules**
are demonstrated and whose **principal paths refuse** — because the collaborators they need do
not exist as callable surfaces. Every refusal is tested, named, and traceable to the Epic that
owes the binding. That is the correct outcome given what exists. It is not a working Room, and
the difference is the whole of `FR-DFR-063`: *a declaration of completion is not evidence*.

---

## What the Epic delivered

`BR-0051`–`BR-0058`, `BR-0144` — capability area `U-05`, defect management. The governing rule is
`ADR-0016`: **a defect must prove that the implementation violates an already-approved
expectation before any fix is authorised.**

**53 of 54 tasks complete.** The one open is `T999t`, named under *Work not done*.

| Phase | Tasks | What it established |
|---|---|---|
| 1–2 Setup & Foundational | `T997`–`T997z` | Three guarantees as **types**: a total `Record` so an outcome cannot be unrouted, a non-optional `firstObservedFailingAt` so a test that never failed cannot pose as one, a required `EvidenceCheckPath` so no path is taken by omission |
| 3 US1 | `T998`–`T998f` | The expectation-verification gate. *"No approved behaviour exists"* and *"I could not look"* held apart |
| 4 US2 | `T998g`–`T998n` | Test-first repair, guarded three ways — type, loop configuration, database trigger — each refusing independently |
| 5 US3 | `T998o`–`T998t` | Transfer to `EPIC-034`, gap routing to `EPIC-033`, both stating why |
| 6 US4 | `T998u`–`T998x` | `ADR-0016`'s named failure mode made **unrepresentable**: no edge from a passing run to a classification |
| 6b US8 | `T998y`–`T998z` | Six regions through the imported `RoomShell`, compared against the contract rather than reviewed |
| 7 US5 | `T999`–`T999c` | Six origins; the unlinkable defect **held with its missing link named**, not refused and not swallowed |
| 8 US6 | `T999d`–`T999f` | Escape analytics that state what they cannot see |
| 9 US7 | `T999g`–`T999k` | Repair work as `EPIC-012` tasks, with a provenance sentinel that cannot pass for an engine name |
| N Polish | `T999l`–`T999q` | Four mutation proofs, five measured figures, five boundary confirmations, seventeen scenarios |
| Z Closure | `T999r`–`T999z` | This report, `ADR-0016` converged, both destinations bound |

---

## The four mutation observations (`SC-DFR-001`, `SC-DFR-004`, Exit Criteria)

Full record: [mutation-proofs.md](./mutation-proofs.md). **Two of the four found holes in the
tests rather than in the code being protected**, which is the entire reason the exercise is
ordered mutation-first.

| Proof | The guard held | The test did not |
|---|---|---|
| `FR-DFR-041` | yes — 5 tests failed | `T998i` cannot see a service bypass, **by design**: it exercises the three guards by going *around* the service |
| `FR-DFR-044` | configuration yes | `T998u` asserted nothing was **written**, not that nothing was **answered** |
| `FR-DFR-077` | — | neither test had tried a **null** destination, only a wrong one |
| Constitution XI Tier 1 | yes — 5 tests failed | — |

Three assertions were added, each written **while its mutation stood** and each observed failing
before the revert. An assertion added afterwards restates what the code already does.

One detail worth carrying forward: the `FR-DFR-041` bypass **would not compile**, because
`FixAcceptance`'s accepted arm carries the `DefectTest`. It had to fabricate one with
`reference: 'no test recorded'`. The type did not prevent the bypass — it forced whoever writes
one to state a falsehood explicitly, where a reviewer can see it.

---

## The measured performance figures (`R-035-9`, `T999o`)

| Target | Measured p95 | Excludes |
|---|---|---|
| Triage classification < 1.5 s | **0.1 ms** | model time **and storage latency** |
| Reproduction evidence write < 800 ms | **0.0 ms** | the `EPIC-032` call **and storage latency** |
| Escape aggregation over 5,000 closed defects < 2 s | **14.3 ms** | nothing — end to end over HTTP against PostgreSQL |
| Close path < 300 ms | **0.1 ms** | the test run **and storage latency** |
| Room load < 1.2 s | inherited | `EPIC-033`'s figure, unchanged; the shell is the same one (`T999p` asserts all three Epics state it) |

**Three of the four exclude storage latency, which `R-035-9` did not grant.** They run in process
against the in-memory store because the HTTP paths return `400` with `BaselineReader`,
`EvidenceStore` and `TestExecution` unbound — timing a refusal is not timing the work. The
aggregation figure is the only end-to-end one, which is why it is the only one in whole
milliseconds.

The seed for that measurement was **refused by the database**:
`defect_records_fix_needs_a_failing_test` rejected 5,000 defects moved to `closed` with no test
on record. The guard was right and the setup was wrong.

---

## Work not done, and why

### `T999t` — Constitution XI Tier 2, and `SC-DFR-009` with it

**Not run. Nothing was written in its place.**

Two independent reasons, either sufficient:

1. **Only a person can do it.** Keyboard-only navigation with visible focus is a claim about what
   a human operating a browser experiences. Driving the services directly would produce a file
   that satisfies the conformance check while demonstrating none of what the scenario is about —
   and quickstart states the rule in its own words: *"Hand-written evidence is a constitution
   violation of the first order."*
2. **The journey cannot complete in this deployment.** Steps 5–7 — repair tasks, verify, close —
   all refuse, because `RepairTaskPort` and `TestExecution` are unbound. A seven-step transcript
   cannot presently be generated **by anyone**, and one showing seven successes would be evidence
   of something that did not happen.

`T999u`'s conformance check is committed and **fails red**, which is deliberate: the failure is
the record that the obligation is owed. `T884`'s accessibility check has stood red for the same
reason since `EPIC-029`, and it is the reason anybody knows that record is outstanding.

### Promotion `local → dev` (`T999z`, Constitution VII)

**Not performed.** The standing instruction for this session is *do not push; do not publish; do
not open a pull request*, and promoting to a shared environment is a publish. It needs explicit
authorisation naming the environment. Nothing was skipped in the sequence — nothing was
attempted.

---

## Unowned dependencies (`T999x`)

Restated in full, because compression here costs content rather than legibility.

### (a) `BR-0080` product-side test execution — **no owner anywhere in the programme**

`FR-DFR-062` says test execution MUST be requested from `EPIC-015`. `EPIC-015` built a **gate on
promotion**, not a callable surface: its own specification records *"None directly"* under
requirements owned and *"None — no user-facing behaviour originates here"* under user stories.
Its closure lists six artifacts, every one a test **about this repository**.

`brs-v2-reconciliation.md` maps `BR-0080` → `EPIC-015` and has **no `U-` capability area** for
on-demand execution, so nothing currently records it as missing. This report is that record.

**Consequence**: every closure in this Room refuses. `R-035-1` states why that is right rather
than unfortunate — *"we could not run the tests" must never resolve to "the tests passed"*.

### (b) `BR-0163` operational feedback — `U-19`, unowned

Telemetry-originated defect linkage is not built. **This Room's delivery must not be read as
having closed the telemetry loop.** Every origin distribution carries a completeness note saying
so, typed `complete: false` with no `true` arm, so a caller cannot construct a complete
distribution and a renderer cannot skip the note.

### (c) `BR-0151` task provenance — `U-12`, unowned

`TaskRecord` has no provenance field, and `engineName`/`engineVersion` are not optional. A repair
task has no engine, so it carries `(none — authored from a defect)` — a sentinel whose shape is
asserted by `T999i` precisely so a later tidy-up cannot turn it into something that reads like
data. **This is a handover, not a fix.**

**Found during this Epic and added to the list**: `TASK_STORE` is bound in `tasks.module.ts` to
`InMemoryTaskStore`. That is why `RepairTaskPort` is unbound here — wiring to it would create
repair tasks that vanish on restart, `T1178`'s failure landing in the one record whose purpose is
to show somebody was asked to fix something.

### (d) `EPIC-033`'s Requirement-Gap inbound route — **RESOLVED, and now bound**

This line was expected to report a gap. `T338u` and `T338v` are both **complete**:
`POST /rooms/requirement/gap-intake` exists. `EPIC-034`'s `fromDefectTransfer` exists with it.

Both were left unbound in this Room's module through Phase 9 — the comment said the routes were
real and unwired, which by closure was **no longer honest, only untouched**. `T999v` bound both.
**Exit Criterion 5 now holds**: all three outcomes route end to end, and the integration tests
assert the change request lands in `EPIC-034`'s table naming the defect it came from.

---

## Convergence (`T999y`)

`/speckit-converge` assessed 59 requirements, 11 plan decisions and 7 constitution principles.
**0 contradicts, 0 unrequested**, two findings:

- **`SC-DFR-005`** — satisfied and **not citable**: the guarantee was built and proved, and the
  identifier appeared in no source or test. Legible to a reader, invisible to extraction, which
  is `EPIC-033`'s `A1` failure exactly. Cited at convergence.
- **`SC-DFR-009`** — correctly uncovered; carried by `T999t` above.

**No Convergence phase was appended, and that is itself a finding** — see below.

`specs/035-defect-room/defects/` is **empty**. No defect was raised against this Epic during
implementation. (`DEF-034-001` was raised against `EPIC-034` and is closed there.)

---

## The task-identifier scheme — **not** exhausted (corrected)

**999 of 999 three-digit prefixes are in use after this Epic.** That part is true: `T999z` is the
maximum identifier, `T999` carries every suffix `a`–`z`, and no three-digit base remains.

**What does not follow — and what the first version of this report claimed — is that anything is
blocked.** `EPIC-026` had already widened the pattern:

| Where | What |
|---|---|
| `governance/epic-stage.config.json` | `taskIdentifierPattern` is `^T\d{3,}[a-z]?$` — **three or more** digits |
| `T864d` | added it with **no upper digit bound**, deliberately: *"because a cap is the same fault one order of magnitude later"* |
| `T864e`, `T864i` | one shared reader, and an `unrecognisedIdentifiers` failure so a token that looks like an id but is not valid **fails the build** rather than being skipped |

Verified by running it: `T1000`, `T1000a` and `T10000` are all valid; `T99` is recognised and
rejected. `tests/governance/epic-stage/task-id-format.spec.ts` — 38 passed.

**So `/speckit-converge` could have appended `T1000` during `T999y`.** It did not, because I
checked the identifier against the pattern quoted in this Epic's own `tasks.md` narrative
(`T\d{3}[a-z]?`) instead of against `governance/epic-stage.config.json`, which is where
`FR-ESK-015` says the pattern lives and `FR-ESK-025` says it is defined. The prose was written
before `T864d` landed; the configuration was current. **I read the recollection and not the
source** — `DEF-034-001`'s lesson, committed by the person quoting it.

The two convergence findings stand as reported: `SC-DFR-005` cited, `SC-DFR-009` carried by
`T999t`. Neither needed a new task, so the `converged` outcome was correct for the right reason
even though the reason given alongside it was wrong.

**What remains true and worth carrying**: `EPIC-034`'s `T995y` raised the exhaustion of
three-digit bases, and it is now complete. A future Epic tasked as `T1000`+ is valid and checked;
what it loses is the *adjacency* meaning the suffix carried, since `T1000a` no longer sits
visually beside `T999z`. That is a legibility change, not a blocker, and no requirement asks for
it to be preserved.

## Recommended next command

```bash
/speckit-specify 038
```

**Not blocked.** The identifier pattern admits `T1000` and beyond, and `EPIC-026` is complete
(114 tasks, none open).

What is genuinely outstanding is unchanged and belongs to people rather than to a command:
`T999t`'s keyboard journey, `T884`'s accessibility transcript, and the promotion `local → dev`
that needs explicit authorisation naming the environment.

**Delivery Board**: not refreshed. It is stale as of this session with respect to `EPIC-035`,
which it will show as in progress.
