# DEF-026-007 — the register tells a parent design to generate tasks it must never have

**Epic**: `EPIC-026` (owns the register's `Next` column) · affects **EPIC-017**, **EPIC-002**
**Raised**: 2026-08-20 | **Status**: **RESOLVED 2026-08-20** — by T851–T853 exactly as this record suggested: `nextAppliesTo` (the T683 `appliesTo` shape) on `Planned`/`Tasked`/`Analyzed`/`Ready`, `deriveStage` given the `kind` parameter DOR evaluation already receives, `—` as the honest answer. Verifying check: `tests/governance/epic-stage/next-command-kind.spec.ts` (observed red first: 3 failures — derivation twice, committed register once). Register regenerated (T854): EPIC-017 reads `—`; EPIC-002 keeps `/speckit-checklist` at `Clarified` as judged correct; no delivery row changed
**Found by**: a `/speckit-tasks 017` invocation made *because the register recommended it*
**Severity**: MEDIUM — no wrong artifact was produced, but the register instructed one to be

## What was reported

`governance/epic-stage-register.md` renders EPIC-017 as:

```text
| EPIC-017 | Enhancement Model … | parent-design | Planned | — | n/a | `/speckit-tasks` |
```

The row is internally contradictory. It reads **`parent-design`** in the Kind column and **n/a** in
Readiness — both correct — and then names **`/speckit-tasks`** as the next command. `FR-ESK-024`
defines a parent design as carrying no tasks, which is why Readiness is `n/a` in the first place.
The register recommends the one command this kind of Epic must never run.

EPIC-002 shows the same defect at a different stage: `parent-design | Clarified | stalled | n/a |
/speckit-checklist`. Less harmful — a checklist is not forbidden — but produced by the same
derivation, and equally unaware of what it is looking at.

## What is actually true

Both Epics say so themselves, in prose the register does not read:

- `specs/017-enhancement-model/spec.md` — *"**Status**: **PARENT DESIGN** — split into four delivery
  epics; carries no tasks of its own"*, and *"EPIC-017 itself has no `tasks.md` and no `Phase Z`
  closure."*
- `specs/002-team-review-access-storage/plan.md` — *"**Tasks**: none — split into EPIC-023/024/025 by
  ruling **D-19**"*.

And the machine-readable declaration already carries the fact:
`governance/epic-declarations.json` declares `kind: "parent-design"` with a `children` array for
both. The information the derivation needs is present and structured; it simply is not consulted.

**The cause is a missing input, not a wrong rule.** The next-command derivation is a pure function of
**stage**: stage 4 `Planned` → `/speckit-tasks`, stage 2 `Clarified` → `/speckit-checklist`, per the
`stages` table in `governance/epic-stage.config.json`. Epic **kind** is not a parameter.

```console
$ grep -rn "parent-design" tests/governance/epic-stage/derive.ts tests/governance/epic-stage/build.ts
$ # no matches
```

Kind reaches DOR evaluation — `evaluateDor(ctx, kind)` takes it, and `T683` added `appliesTo` so
`DOR-07` and `DOR-08` report *not applicable* rather than failing a parent design forever. That
precedent is exactly right, and it stopped one step short: readiness learned about kind, the next
command did not.

## Why this is worth a record rather than a shrug

The register's stated purpose is that *"a person never writes a stage, and a machine never infers
intent"* — and its own README calls the `Next` column the thing a reader acts on. A reader who trusts
it here generates a `tasks.md` in a parent design, which re-creates the duplication rulings **D-18**
and **D-19** exist to prevent: 128 task IDs already owned by EPIC-023/024/025, and 88 by
EPIC-019–022, would acquire a second home.

That is the same failure class as **G-02.1** in EPIC-002's plan — two task records for one body of
work, discovered only after both had drifted.

The near miss is the evidence: the `/speckit-tasks 017` run on 2026-08-20 was made *because the
register recommended it*, and was stopped by reading the spec's own status line, not by any check.

## Suggested resolution

Give the next-command derivation the same `kind` parameter DOR evaluation already receives, and
declare per stage which kinds a command reaches — reusing the `appliesTo` shape `T683` introduced,
rather than inventing a second mechanism:

- **parent-design** — never a task-generating or implementation command. A parent design's real next
  action is about its children, so `—` (as Readiness already renders) is more honest than a command
  that would damage it.
- **delivery** — unchanged.

Two further points for whoever takes this:

- **A `—` is a legitimate answer.** Constitution IX's honesty rule already forbids reporting an unrun
  check as passing; naming a command that must not run is the same error in the opposite direction.
- **Add the regression as a governance check.** No test asserts anything about the `Next` column for
  a parent design, which is why 28 rows rendered and no one noticed. A check in
  `tests/governance/epic-stage/` asserting that no `parent-design` row names a task-generating
  command would have caught this at the moment the column was introduced.

## What was done instead, on the day

Nothing was generated in EPIC-017. The family was audited from the parent's requirement set, which
found eight requirements owned by children but cited by no task; seven were already covered by
existing tasks and are now cited, and `SC-ENH-010` gained **`T827`** in EPIC-022 — a human
walkthrough, since it claims a *person* produces a conforming specification unaided.

`FR-ENH-017`–`FR-ENH-019` and `SC-ENH-008` were confirmed **deliberately vacant**, awaiting the
Phase 2 knowledge epic (**M-10**) that does not yet exist. They are not gaps and must not be tasked
here.
