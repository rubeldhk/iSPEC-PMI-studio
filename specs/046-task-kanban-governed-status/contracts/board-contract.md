# Contract — The Task Kanban surface

**Epic**: `EPIC-046` · **Date**: 2026-09-06 · **Binds**: PMI-DOC-007 §6 (Task Kanban, Plan & Tasks,
`O-10`) · PMI-DOC-005 (every table filtered; four states) · PMI-DOC-006 §4.1

## §1 · Where it lives (`FR-KAN-050`, `R-046-11`)

| Address | Shows |
|---|---|
| `/plan` | The project's Epics, each with its board summary and percentage — **the landing view the `plan-and-tasks` area has never had** |
| `/plan/epics/:epicId` | One Epic's Kanban |
| Spec Journey Board card → *Open tasks* | Links to the same Epic board |
| `/specifications/:id/tasks` | Unchanged. `EPIC-012`'s specification-scoped list stays; `FR-KAN-017` keeps its write rule separate |

`frontend/src/shell/areas.ts` moves `plan-and-tasks` from `declared-not-delivered` to delivered and
drops the `N1` note. `EPIC-012`'s `T441p` is **superseded**, recorded in `R-046-11`.

## §2 · The header, above the columns (`FR-KAN-052`)

The Epic; the execution, command and digest of the **latest parse** and its time; the counts —
*lines considered / parsed / refused / duplicates*; the diff summary of that parse; and the open
disagreements as a countable list. When the latest parse is older than the Epic's latest execution,
the header says so with both times (`FR-KAN-048`).

## §2a · Refused lines (`FR-KAN-003`)

Below the header, a **Refused lines** list: for each, the line number, the line's text and the coded
reason. It is countable and is part of the header's counts. Empty state: *every task line of the
latest parse was read*. A refused line is never silently absent — that is the whole point of
reporting rather than dropping.

## §3 · The columns and the cards (`FR-KAN-051`, `FR-KAN-054`)

Columns, in order: **Not started · In progress · Done · Blocked**. Configuration; every row in
exactly one.

A card shows the identifier, the description, the `[P]` marker, the source line, the repository
paths the description names (none, shown as *no path named*), and **what last moved it** — a parse,
a progress event, a completion or an applied proposal — with the time and the actor. Markers render as words beside the card: *ahead of the file*, *not in the latest parse*,
*superseded by the file*.

## §4 · Moving a card (`FR-KAN-010`, `FR-KAN-011`, `FR-KAN-018`)

Two affordances, one path: a labelled **status control** on every card (keyboard-operable, the
primary route, `BR-0193`) and native HTML5 drag onto a column as an enhancement. Both open the same
dialog, which **requires a reason** and states, in words, that the project directory is authoritative
for what is done and that this move is a proposal about the record, not an edit of the file.

No control anywhere on this surface edits, uploads, renames or deletes a file. A member without the
move permission sees the board read-only with the reason stated, and no move control at all.

## §5 · Progress (`FR-KAN-055` to `FR-KAN-058`)

Shown on the Epic board, on the `/plan` landing per Epic, and for the project — the same value from
the same derivation in all three (`FR-KAN-056`). Rows marked *not in the latest parse* are excluded
from the denominator and the exclusion is stated. An Epic or project with no tasks reads **0%**.

## §6 · Filters (`FR-KAN-053`)

Status · parallel marker · *ahead of the file* · *not in the latest parse* · free text over
identifier and description. PMI-DOC-005: every table gets a filter.

## §7 · The four states (`FR-KAN-059`)

| State | What the board says |
|---|---|
| Loading | Stated in words; the header frame holds |
| Empty — no `tasks.md` synced | *No `tasks.md` has been synced for this Epic yet*, naming `/speckit-tasks` |
| Empty — a file with no task lines | *The synced `tasks.md` contains no task lines*, with the digest — deliberately distinct from the above (`US1` scenario 5) |
| Error | Stated in words; the Epic's other surfaces stand |
| Partial | The columns render and the disagreement list states what could not be loaded |

## §8 · Movement is observed, not pushed (`FR-KAN-046`)

The board states that movement is **observed on sync and on event, not pushed live**, while the
toolkit offers no in-flight hook (`R-07`). It reflects current state on its next load; no control
beyond reloading is promised, and no live transport is implied.

## §9 · Tests that hold this contract

- `frontend/tests/unit/pages/task-board.spec.tsx` — columns, card metadata, markers, the four states,
  the two empty states distinguished, filters.
- `frontend/tests/unit/pages/plan-landing.spec.tsx` — the `/plan` landing and its per-Epic
  percentages.
- `frontend/tests/unit/pages/task-move-dialog.spec.tsx` — reason required; the authoritative-file
  statement present; no edit affordance anywhere; read-only for a member without permission.
- `frontend/tests/unit/shell/areas.spec.ts` — `plan-and-tasks` is delivered and has a reachable path.
- `tests/governance/…` — layout registration for the new pages.
- `e2e/tests/epic-046-m4.spec.ts` — the `M4` transcript (`SC-KAN-003`).
