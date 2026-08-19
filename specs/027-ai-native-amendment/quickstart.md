# Quickstart: AI-Native Amendment Reconciliation

**Epic**: `EPIC-027` | **Date**: 2026-08-13 | **Plan**: [plan.md](./plan.md)

How to validate that this epic actually did what it claims. Fourteen scenarios, all executable, all
able to fail.

**The distinction this document exists to enforce**: a reconciliation is easy to *appear* to
complete. Twenty-five section headings with plausible prose under each looks identical to a finished
report until someone checks whether every clause was actually read. These scenarios are that check.

---

## Prerequisites

```bash
pnpm install                       # already required by the repository
node --version                     # 22 LTS
```

No database, no Redis, no Docker. This epic's outputs are documents and their checks — which is why
it can proceed while the product surface is held.

## Running the checks

```bash
pnpm test:governance               # runs EPIC-018's 159 checks + EPIC-027's G-27-*
pnpm test:governance -- -t "G-27"  # this epic only
```

Checks live under `tests/governance/`, alongside EPIC-018's. **Same harness, no new machinery** —
that was the point of EPIC-018 landing first.

---

## Validation scenarios

### V1 · Every clause carries exactly one verdict

```bash
pnpm test:governance -- -t "G-27-01"
```

**Expected**: pass, with the clause count reported (~470 expected across five documents).

**Prove it can fail** — the mutation that must turn it red:

```bash
# remove one verdict row from register/verdicts.md, regenerate, re-run
```

Expected: fails naming the orphaned `CLA-###`. **A check that stays green after this is decoration**,
and the run is not valid evidence until this mutation has been performed at least once.

### V2 · No verdict is unattributed

```bash
pnpm test:governance -- -t "G-27-02"
```

**Expected**: pass. Every verdict names an existing requirement/epic **or** the explicit
`NO-EXISTING-COVERAGE` sentinel.

**Why the sentinel matters**: an empty owner field is indistinguishable from an unfinished row. The
sentinel is a claim someone can disagree with.

### V3 · No identifier invented where one already exists

```bash
pnpm test:governance -- -t "G-27-03"
```

**Expected**: pass — every `new_identifier` carries a `necessity`.

**Manual companion check** (`FR-AMD-003` cannot be fully automated): spot-check five verdicts that
created new identifiers and confirm each necessity statement survives reading. The check proves a
justification *exists*; only a human can judge whether it is a good one.

### V4 · Every capability is classified, and nothing was removed for being external

```bash
pnpm test:governance -- -t "G-27-04"
```

**Expected**: pass. Three assertions in one: ownership present; `integrated`/`hybrid` rows name an
abstraction boundary; `removed_because_external` is false throughout.

**Spot-check the five §2 names** — source control, CI/CD, AI coding engines, requirement approval,
traceability — and confirm the first three classify `integrated` and the last two `native`. If
requirement approval reads `integrated`, the classification has misunderstood the amendment
completely, and no automated check will catch that.

### V5 · Finding A is evidenced, not asserted

```bash
pnpm test:governance -- -t "G-27-05"
```

Then reproduce the evidence directly:

```bash
grep -ril "change room"       specs/ --include=spec.md | wc -l   # expect 0
grep -ril "defect room"       specs/ --include=spec.md | wc -l   # expect 0
grep -ril "requirement room"  specs/ --include=spec.md | wc -l   # expect 0
grep -ril "agent gateway"     specs/ --include=spec.md | wc -l   # expect 0
```

**Expected**: zero for all four, and `premises.md` recording the same counts with the same queries.

**This is the scenario worth running by hand even when CI is green.** The entire sizing of the
programme turns on whether the amendment's "existing Change Room" exists, and a claim of that
consequence should be verifiable in ten seconds by anyone who doubts it.

### V6 · The impact report is complete

```bash
pnpm test:governance -- -t "G-27-06"
```

**Expected**: exactly 25 sections; zero `TODO`/`TBD`/`[…]` placeholders; every empty section carries
`explicitly_empty` **and** a reason.

### V7 · Twelve ADR subjects registered

```bash
pnpm test:governance -- -t "G-27-07"
```

**Expected**: all twelve Native §27 subjects present; every `open` names what it awaits; every
`supersedes` carries reasoning.

**Manual companion**: confirm `ADR-0001` through `ADR-0005` still exist and none was silently
replaced. `ADR-0002` is the live case — it should read *extended* (`D-36`), never *superseded*.

### V8 · Research registered, and no decision resolved past an unanswered item

```bash
pnpm test:governance -- -t "G-27-08"
```

**Expected**: all fourteen `R-AI-*` items present with `blocks`; **zero decisions marked `decided`
while `blocking_research` remains unanswered.**

That second assertion is Native §26 made executable: *"Do not make unsupported assumptions where
research is required."* It is the check most likely to fail *usefully* — under delivery pressure, a
blocked decision quietly becoming "decided" is exactly what happens.

### V9 · Zero product code changed — the analysis-only boundary

```bash
pnpm test:governance -- -t "G-27-09"
git diff --name-only main...HEAD -- backend/ worker/ packages/ engine-adapters/ frontend/
```

**Expected**: empty. **This check blocks CI**, unlike the other eleven.

`FR-AMD-016` and `SC-AMD-009` are the project owner's scope-creep concern expressed as a boundary.
This is where the boundary is enforced rather than promised — an analysis epic that has quietly
started implementing is the failure mode, and it is detectable.

### V10 · Every conflict is a decision with options

```bash
pnpm test:governance -- -t "G-27-10"
```

**Expected**: pass — every decision has ≥2 options, a consequence per option, and a named owner.

**Manual companion**: confirm no conflict was resolved *inside* the reconciliation. `SC-AMD-012`
requires conflicts to be presented, not settled. The three Rooms (`D-32`) and EPIC-007 (`D-33`) are
the two that would be most tempting to quietly settle.

### V11 · The projection matches its sources

```bash
pnpm test:governance -- -t "G-27-11"
```

**Expected**: every `generated_from` digest matches its file.

**Prove it can fail**: edit one word in `register/clauses.md` without regenerating. Must go red.
Regeneration is the step people skip, and a stale projection makes every check above test a fiction.

### V12 · Preserved elements changed only with the full five-field record

```bash
pnpm test:governance -- -t "G-27-12"
```

**Expected**: every row carries all five §28 fields — reason, affected requirement, migration impact,
compatibility impact, alternative considered.

**Expected occupants**: the `ContainerRuntime` widening (`D-21`), the egress extension (`D-28`), and
the `TraceabilityLink` edge-type expansion. If that table is empty, either nothing touches the
sixteen preserved elements — which would contradict the plan — or the rows were not written.

### V13 · The twenty capability areas are enumerated and counted

```bash
pnpm test:governance -- -t "G-27-13"
```

**Expected**: exactly 20 rows, each with a verdict, a named home and a posture — and the count
matching the figure quoted in `spec.md`.

**Why the count is asserted rather than trusted**: `SC-AMD-011` is a countable criterion, and the
spec said *fifteen* while the plan's table listed *seventeen* until the analyse pass of 2026-08-13
caught it. A criterion whose denominator drifts is unfalsifiable. This check is the reason it cannot
drift again.

### V14 · No epic's posture changed without a recorded reason

```bash
pnpm test:governance -- -t "G-27-14"
git diff --name-only main...HEAD -- 'specs/*/spec.md' | grep -v 027-ai-native
```

**Expected**: the `git diff` returns nothing, and the check passes with an empty
`epic_status_changes` array. **This check blocks CI.**

`FR-AMD-017` says work already in flight continues unless a named clause conflicts with it. The
normal state of this table is therefore *empty*, and an empty table is the passing case — but the
check is not vacuous, because it fails the moment another epic's **Delivery posture** line moves
without a matching row naming the `CLA-###` responsible.

**Prove it can fail**: change any held epic's posture line to `PROCEEDING` without adding a row. Must
go red, and must block.

---

## The one thing these scenarios cannot check

**Whether the verdicts are right.**

Every check above verifies that the reconciliation is *complete and internally consistent*. None
verifies that a clause marked `already-covered` is genuinely covered by the requirement it names.
That is a reading task, and it belongs to the project owner.

**Suggested sampling**: ten clauses spanning all five documents — the Independent Test named in
User Story 1. If nine of ten hold, the register is trustworthy. If three of ten are wrong, the
register is worse than nothing, because its completeness checks will all still be green.

Stated here rather than discovered later: the checks make the register *auditable*, not *correct*.

---

## Not yet runnable

| Scenario | Blocked by |
|---|---|
| All fourteen | `/speckit-tasks` has not run; the register files do not exist yet |
| V5's `premises.md` half | Same — though the `grep` half runs today and returns zero |
| V14's `git diff` half | Runs today and returns nothing, which is the expected state |

The `grep` commands in **V5 are runnable right now** and are the fastest way to sanity-check the
single most consequential finding in this epic before committing to any of it.
