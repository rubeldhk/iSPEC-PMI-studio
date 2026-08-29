# EPIC-033 — Requirement Room: closing report

**Task**: `T405x` · **Written**: 2026-08-29 · **Head**: `5747a49` (plus this commit)
**Branch**: `checkpoint/constitution-xii-steps-a-b`, unmerged, not pushed

**Status**: **NOT CLOSED.** One task remains open and one success criterion is half-met. Both are
named below rather than rounded away.

---

## Work completed

| Phase | Tasks | What it delivered |
|---|---|---|
| 1–2 | Setup, foundational | `packages/room-contract`, the Room store, the register adapter |
| 3 (US1) | `T338a`–`T338v` | Intake → candidates → baseline, with in-place edit refused and offered as a Change Request |
| 4 (US2) | `T337*` | Epistemic labelling — four kinds, no unlabelled variant |
| 5 (US3) | `T339*` | The acceptance-criteria gate and its recorded exceptions |
| 6 (US4) | `T339m`–`T339s` | Options with trade-offs; decisions recorded with the options **not** chosen |
| 7 (US5) | `T403*` | Baseline → specification handoff, traceable both ways |
| 8 (US6) | `T403m`–`T1155` | The Room screen, six regions, and the `T1148`–`T1155` identity binding |
| 9 | `T1164`–`T1175` | **The journey.** Stage handlers, `POST /rooms/requirement`, the intake screen, the shared `RoomIndex`, the area landing, the Tier 2 run |
| N | `T405a`–`T405j` | Five mutation proofs, the `R-033-7` measurements, the quickstart run |
| Z | `T405m`–`T405x` | This report |

**Every completion claim below names its evidence.** A check that was not run is never reported as
passing, and deferred work is never reported as complete.

### Phase 9 is the part worth reading

`T405j` recorded quickstart Scenario 13 as *not run*. Investigating why found something stronger:
the journey could not be **attempted**. Nothing could create a Requirement Room object
(`declareObject` returned `500` for every workflow type, because no Room had registered stage
handlers); no screen submitted intent; and `/requirement-room` rendered nothing, so a Room was
reachable only by typing a URL containing an id a person had no way to obtain.

Four dependencies were found by trying to use capabilities that had never existed — the same way
`X7`, `X8` and `Y2` were found:

- **`X20`** — `LoopStore` could not list objects. Built as `EPIC-030` `T1176`–`T1177`.
- **`LoopModule.register()`** — no mechanism existed for a Room to supply stage handlers, although
  `loop.module.ts` documented the seam.
- **`DEF-033-001`** — the Room's approver, decider and actor kind were caller-supplied strings.
- **`DEF-030-003`** — `EPIC-030`'s transition caller supplied its own *authorities*.

## Work deferred — never reported as complete

### `T405o` — Constitution XI Tier 2 — **OPEN**

The transcript exists, is run-generated, and passes its conformance check
([tier2-transcript.md](./tier2-transcript.md), `T405p`). The journey completes against the
rebuilt container stack.

**It is not yet a keyboard transcript**, and `T405o` requires one. The run evidenced focus order,
focus visibility (`solid 1.6px rgb(96, 165, 250)`, `:focus-visible` matched), zero positive
`tabindex`, and native controls throughout — but could not evidence that a **keypress activates a
control**, because the driver's synthetic key events arrive as `{"key":"Enter","code":"","which":0}`
and a browser will not synthesise a click from those. A pointer click on the same button worked
immediately, which is what separates *the tool cannot press Enter* from *the application cannot be
operated by keyboard*. Only the first is true.

**Remaining**: a person walks the five screens and confirms Enter and Space activate what Tab
reaches. Everything structural that pass depends on is measured and committed.

### `SC-RQR-008` — half-met

Recorded in [quickstart-results.md](./quickstart-results.md) `T1175`. Same substance as above; it is
the criterion `T405o` serves.

### Promotion beyond `local` — not performed

Constitution VII requires `local → dev → stage → prod` with no environment skipped. This work
reaches **local only**. `EPIC-014`'s `T156` is *the only task in the programme that promotes
anything*, and it is open. Promotion is a deployment act, not a code change, and it is not this
Epic's to perform.

**Recorded rather than claimed** — the same posture `EPIC-030`'s `T992` took.

## The five mutation proofs

Each applied, the named test observed failing, reverted, the suite observed green again. Full detail
in [quickstart-results.md](./quickstart-results.md).

| Task | Mutation | Observed failing |
|---|---|---|
| `T405a` | `assertEditable` returns instead of refusing | **6 of 18** |
| `T405b` | `epistemic` made optional | **3 typecheck errors** — the runtime suite passed |
| `T405c` | the `decided_by_a_human` CHECK dropped | **5 of 7** |
| `T405d` | a region removed; then a seventh added | **5 of 19**, then **9 of 48** |
| `T405e` | `RequirementRoomModule` unregistered | **12 of 13**, after the check was repaired |

Two are worth reading twice. **`T405b` passed the runtime suite** — vitest transpiles without
typechecking, so a compile-time guarantee is invisible to it; its proof is `tsc`. **`T405e` found a
check that had quietly stopped working**: it asserted *"any platform error code means a handler
ran"*, which stopped discriminating when `DEF-001-006` made an unmatched path return `404
not_found`. Rebuilt on the message, it later caught a Phase 9 regression it would have missed.

Phase 9 added two more (`T1173`): removing the area `element` while leaving `status: 'delivered'`
fails 4 tests; unregistering `GET /rooms/requirement` fails the reachability loop by name.

## Measured performance — `R-033-7`

| Target | Measured p95 |
|---|---|
| Blocker query < 200 ms | **0.30 ms** |
| Room load < 1.2 s at 200 | **0.13 ms** |
| Baseline creation < 2 s at 200 | **0.43 ms** |

**Three orders of magnitude of headroom is itself the caveat**: the store is in-memory, so this
measures the projection and hashing, not PostgreSQL. Stated rather than presented as production
latency. Set-size degradation is roughly linear to 2000 (0.13 → 1.03 ms), so *500 is the designed
size and beyond it the cost grows proportionally* is a recorded limit, not a surprise.

## The shared Room pattern — handed over by name (`T405y`, `T405q`)

**`EPIC-034` (Change Room) and `EPIC-035` (Defect Room) MUST import these, not fork them:**

- **`packages/room-contract`** — `RoomShellProps`, `Epistemic`, `RoomObjectRef`, `ROOM_REGIONS`,
  `ROOM_PORTS`
- **`frontend/src/rooms/`** — `RoomShell`, and since `T1171` **`RoomIndex`**, which is parameterised
  by `RoomKind` and already driven through two Room kinds in test

**Verified genuinely shared (`T405q`), by inventory rather than by assertion.** Every exported name
in both locations is Room-neutral:

> `AbsentBehaviour EPISTEMIC_KINDS Epistemic Labelled ROOM_PORTS ROOM_REGIONS RoomObjectRef RoomPort
> RoomPortName RoomRegion RoomShellProps absentBehaviourOf isEpistemic isRoomRegion labelled` ·
> `Blocker BlockerKind Blockers BlockersProps EpistemicMark EpistemicMarkProps LoopProgress
> LoopProgressProps Readiness RoomIndex RoomIndexProps RoomKind RoomShell RoomSummary epistemicToken`

No `Requirement*` export in either. The string `RequirementRegister` appears once, as a **value** in
the `ROOM_PORTS` registry naming which Epic fills that seam (`EPIC-007`) — a port every Room needs,
not vocabulary to fork.

`T405d` proved the region contract is enforced in both directions: remove one and it fails; add a
seventh and it fails. That is the guarantee the other two Rooms inherit.

## Boundaries restated

- **`T405r` — `BR-0004`, external stakeholder access, remains `U-02`'s.** `FR-RQR-004` forbade
  building an interim path, and none was built. This Room serves workspace members; delivering it
  does **not** close `BR-0004`.
- **`T405s` — `BR-0106`, session cost limits, remain `U-11`'s.** This Room consumes `EPIC-028`'s
  `WallClockOutcome` and builds no budget mechanism. `R-033-7` deliberately withheld a second
  latency target for the AI round for the same reason: a target measured in the wrong Epic becomes
  the number people quote.
- **`T405t` — PMI-DOC-006 exposure: discharged.** Handed to the project owner 2026-08-24 and
  **approved** — PMI-DOC-006 v1.0 under
  [`D-44`](../_shared/decisions/D-44-application-ux-architecture-approved.md).

## `T405w` — the identifier hand-over, corrected

The task text says *"986 of 999 three-digit prefixes are in use; 13 remained before this Epic and 8
remain after"*. **That is stale, and the correction matters more than the hand-over.**

The authoritative record — `tests/governance/epic-stage/task-id-format.spec.ts` and `EPIC-026`
`T864` — is that **999 of 999 are allocated** and `T864` was the last free prefix. Measured again
during this closure: **999 of 999, zero free.**

So there is nothing to hand over. `EPIC-026` already solved it: `FR-ESK-025` created the four-digit
block, and **this Epic is a consumer of that solution** — `T1148`–`T1155` and `T1164`–`T1175` are
four-digit, as are `EPIC-030`'s `T1156`–`T1163` and `T1176`–`T1177`. 175 four-digit ids are now in
use across the programme, `T1000`–`T1177`.

`EPIC-034` and `EPIC-035` should allocate four-digit identifiers from the outset rather than hunting
for three-digit bases that do not exist.

## Convergence — `T405u`

Run against EPIC-033 on 2026-08-29. **38 of 38 functional requirements and 9 of 9 success criteria
are referenced by tasks.** All 13 open tasks are Phase Z itself.

**One finding**, `partial`, HIGH: `SC-RQR-008`'s keyboard-activation half. **No task was appended**,
deliberately — it is already tracked by open `T405o`, and the remaining work is a human walking a
keyboard, which `/speckit-implement` cannot complete. Appending it would have created a task no
implement pass could ever close.

Everything else assessed as satisfied, including `SC-RQR-006`'s bidirectional traceability
(`T403c`, `requirement-room-handoff-version.spec.ts`).

## Defects — `T405v`

One record, and it is closed.

- **[`DEF-033-001`](./defects/DEF-033-001-the-approver-and-the-actor-kind-are-caller-supplied.md)** —
  the Room's approver, decider and actor kind were caller-supplied. **CLOSED, FIXED 2026-08-28**
  (`T1148`–`T1155`).

Two defects were raised **against other Epics** during this Epic's work and remain theirs:

- **[`DEF-030-003`](../030-governed-engineering-loop/defects/DEF-030-003-the-caller-supplies-its-own-authorities.md)**
  — CLOSED, fixed by `EPIC-030` `T1156`–`T1163`.
- **`DEF-037-001`** — `EPIC-037`'s unauthenticated execution history. Not this Epic's.

## Constitution XI — `T405n`

**Tier 1 (always): PASS.** `T337x` drives the Room's real HTTP routes against the composed module
graph via the real `AppModule`. `T405e` proved it fails when the module is unregistered — 12 of 13,
after the discriminator was repaired.

**Tier 2 (journey Epics): PARTIAL.** See `T405o` above.

## Test results

Full suite, run serially against `5747a49`:

> **Test Files 1 failed | 478 passed | 1 skipped (480)**
> **Tests 2 failed | 4772 passed | 2 skipped (4776)**

The two failures are the **`T884` EPIC-029 accessibility pair** — a pending human record belonging to
another Epic, reported separately every time it appears. `T147`'s p95 assertion is load-sensitive and
passed in this serial run; it fails under parallel load and is the pattern `DEF-030-002` records.

Typecheck clean repository-wide. Lint clean on every changed file. `git diff --check` clean.

## The honesty rule

Every completion claim in this report names its evidence — a task id, a test file, a measured value,
or a commit. Where something was not run, this report says so rather than inferring it from a
neighbouring result. **An unrun check is never reported as passing, and deferred work is never
reported as complete.**

Two claims in this report were corrected during its writing rather than carried forward: `T405w`'s
prefix count, and `T405x`'s promotion step. Both were stated in the task text and both were wrong or
not this Epic's to perform.

## Delivery Board

**Stale.** `EPIC-033` is `Implemented` pending the Tier 2 keyboard confirmation and promotion;
neither is reflected on the board. Restated here rather than refreshed, because the board is not in
this repository.

## Recommended Next Task

**A person walks quickstart Scenario 13 by keyboard** against the running stack — the container is
built from `b1bae4e` and `docker compose up -d app` serves it at `http://localhost:3000`. Sign in,
reach the Requirement Room from the sidebar, start a Room, submit intent, and confirm Enter and
Space activate what Tab reaches. That single observation closes `T405o` and `SC-RQR-008`, and it is
the only thing between this Epic and closure.

After that:

```
/speckit-implement 034
```

`EPIC-034` (Change Room) inherits `RoomShell`, `RoomIndex` and the region contract, and should
allocate four-digit task identifiers from the start.
