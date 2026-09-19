# DEF-026-001 — `DOR-08` is broader than Constitution V, and this epic fails its own gate

**Epic**: `EPIC-026` | **Raised**: 2026-08-18 | **Status**: **CLOSED — DEFERRED 2026-08-18**
**Originating task**: `T508` (implementation) · found by `T531` running the DOR against EPIC-026 itself
**Severity**: MEDIUM — no requirement fails, but the condition reports twelve false positives on its author

## What it is

`T531` pointed this epic's own Definition of Ready at `specs/026-epic-stage-kanban/`. Ten of twelve
conditions pass. `DOR-08` reports:

```text
DOR-08 FAIL — 12 implementation task(s) pair with no test or check (Constitution V)
```

The twelve are:

| Task | What it does | Why it has no paired test |
|---|---|---|
| `T466` | registers a path in `governance/repository-layout.md` | verified by EPIC-018's existing `G-05d`, which the task text does not name |
| `T467` | adds a `package.json` script | exercised every time the register is rebuilt |
| `T468` | creates `fixtures.ts` | imported by nine specs; a fixture with its own fixture is a regress |
| `T527`–`T529` | run scenarios, fill gaps, correct counts | polish tasks that produce no behaviour |
| `T531`–`T536` | Phase Z closure | a closure task's evidence is `closure.md` |

## The actual fault

Constitution V requires a unit test for **"every task producing or changing application code."**
`DOR-08` treats every `- [ ] Tnnn` line as such a task. Registering a path in a markdown document,
adding a script, and publishing a closing report produce no application code, and requiring each to
name a test would make the condition unsatisfiable for every epic's Phase Z — including the four
already closed.

**So the condition is wider than the principle it enforces**, and the twelve are false positives.

## Why this is not being fixed in place

Narrowing a DOR condition at the exact moment it fails **my own epic**, in the closing phase, is the
shape of the failure the waiver mechanism was designed to prevent: *"a gate with no legitimate
exception path is the kind that gets edited rather than obeyed."* The edit might be correct and the
process would still be wrong — and every future reader would see a gate that was narrowed by whoever
it first inconvenienced.

## Options

| | Option | Consequence |
|---|---|---|
| **A** | Narrow `DOR-08` to tasks naming a source file under a code path | Matches Constitution V's wording. Risk: a heuristic that decides what "code" means, wrong in a new way |
| **B** | Exclude Phase Z and Setup/Polish phases by name | Simple and legible. Risk: a real implementation task hidden in a Polish phase escapes |
| **C** | Take a **waiver** on `DOR-08` for EPIC-026, owned and expiring, and fix the condition in a follow-up epic | Uses the mechanism as designed; the exception is visible in the register and expires. Cost: EPIC-026 reads `Ready (waived)`, never plain `Ready` |
| **D** | Leave it failing and record it | Honest, costs nothing, and leaves a known false positive firing on every future epic |

## Recommended resolution

**Option C, then A.** The waiver is what makes the exception owned, dated and visible today; the
narrowing is a change to a governance condition that deserves its own task and its own red test,
not a closing-phase edit. **The waiver requires an owner from the three programme roles, which is a
decision for the project owner — not for this session.**

Until it is taken, EPIC-026 reads `Not ready` against its own DOR, and the closing report says so.

## Traceability

- Condition: `DOR-08`, defined in `governance/epic-stage.config.json`
- Implementation: `tests/governance/epic-stage/dor.ts`
- Requirement: `FR-ESK-011` (mechanically checkable), `FR-ESK-012` (the minimum condition set)
- Found by: `T531`

---

## Resolution — 2026-08-18

**Option C taken, by the project owner: a waiver now, the narrowing as follow-up work.**

```json
{
  "epic": "026-epic-stage-kanban",
  "condition": "DOR-08",
  "owner": "project-owner",
  "reason": "DEF-026-001 — DOR-08 is broader than Constitution V …",
  "expires": "2026-11-16"
}
```

Declared in `governance/epic-declarations.json`, visible in the register's **Active waivers** section,
and expiring in 90 days — the same interval `governance.config.json` uses for steering review. On
that date it **fails the build** unless renewed as a fresh dated record or the condition is fixed.

**EPIC-026 therefore reads `Ready (waived)`, never plain `Ready`.** That is the cost of the
exception and the reason it is safe to take: the epic carries a permanent, visible mark saying it
did not pass cleanly.

**Deferred work, owner: EPIC-026 follow-up or EPIC-018.** Narrow `DOR-08` to match Constitution V's
wording — *"every task producing or changing application code"* — with its own red test proving the
narrowed condition still catches a real unpaired implementation task. That is a change to a
governance condition and deserves a task, not a closing-phase edit.

**Closed as deferred, not as fixed.** The condition is still broader than the principle. What
changed is that the exception is owned, dated, expiring and visible, rather than the gate being
quietly narrowed by the epic it first inconvenienced.

---

## Follow-up completed — 2026-08-19 (`T678`–`T680`)

`DOR-08` now applies to Constitution V's actual scope: tasks naming a source file under an
application-code root (`backend/`, `worker/`, `packages/`, `engine-adapters/`, `agent-adapters/`,
`execution-providers/`, `frontend/`, `scripts/`) with a code extension, excluding files that are
themselves tests.

**The waiver is retired**, one day into its ninety. EPIC-026 passes all twelve conditions cleanly and
reads plain `Ready`. The exception is gone because the reason for it is.

**Measured across all 28 Epics rather than against its author alone**: `DOR-08` went from 0 of 28
passing to 23 of 28. Five detector faults surfaced during that measurement — the plural
`unit tests:`, a task whose own artifact is a `.spec.ts`, a pairing declared on the sibling
(`covers T674`), a pairing after an em dash, and `(conformance: T556)` — each a real line from this
repository, each fixed with a red test first.

**Five Epics still fail and were deliberately not tuned away.** EPIC-002 and EPIC-017 are parent
designs carrying no tasks; their readiness is `n/a` and the verdict is unused. EPIC-001, EPIC-003 and
EPIC-028 hold **eight tasks between them that write application code and name no verification in any
form** — candidate Constitution V gaps in already-closed epics, now visible and reported.

That is the condition doing its job. A narrowing that had left zero failures would have been a
narrowing that removed the gate.