# EPIC-034 — Quickstart results

**Task**: `T995k` · **Session**: 2026-08-31 (Phase N)

Each [quickstart.md](./quickstart.md) scenario, run individually and recorded with the check that
carries it. Scenarios 1–13 run in the suite; Scenario 14 was walked against a running application
and is recorded in [tier2-transcript.md](./tier2-transcript.md).

The fourteen were run together as a group: **14 files, 175 tests, all passing.**

| # | Scenario | Carried by | Result |
|---|---|---|---|
| 1 | Nothing changes an approved baseline except through this Room | `change-room-baseline-gate.spec.ts` (`T996e`) | **pass** — 7 tests |
| 2 | All eight impact areas present, unknown among them | `change-room-impact-areas.spec.ts` (`T996j`), `change-room-impact-unknown.spec.ts` (`T996l`) | **pass** — 12 + 14 |
| 3 | The impact view is composed, never rebuilt | `change-room-polish.spec.ts` (`T995j`), `change-room-independence.spec.ts` (`T406l`) | **pass** — 11 |
| 4 | Options carry all six dimensions, including security | `change-room-options.spec.ts` (`T996r`) | **pass** — 23 |
| 5 | Baseline change stays human-approved under every policy | `change-room-high-band.spec.ts` (`T994c`) | **pass** — 11 |
| 6 | An approved change re-baselines, the old baseline untouched | `change-room-rebaseline.spec.ts` (`T994d`) | **pass** — 14 |
| 7 | Re-plan is recorded, and nothing is destroyed | `change-room-replan-safety.spec.ts` (`T994l`) | **pass** — 6 |
| 8 | A change against a superseded baseline is rebased, explicitly | `change-room-rebase.spec.ts` (`T994h`) | **pass** — 14 |
| 9 | Closure answers four questions from its own record | `change-room-closure.spec.ts` (`T994o`) | **pass** — 22 |
| 10 | An emergency change has fewer minutes, not fewer gates | `change-room-urgency.spec.ts` (`T996c`) | **pass** — 13 |
| 11 | A Defect Room transfer arrives whole, and can go back | `change-room-transfer.spec.ts` (`T994x`) | **pass** — 14 |
| 12 | The Room cannot diverge from its siblings | `change-room-type-isolation.spec.ts` (`T994z`), `ChangeRoom.vocabulary.spec.tsx` (`T994t`) | **pass** — 7 + 9 |
| 13 | Constitution XI Tier 1: the Room is wired | `change-room-reachability.spec.ts` (`T406u`) | **pass** — 7 |
| 14 | Constitution XI Tier 2: the journey | [tier2-transcript.md](./tier2-transcript.md), run 2026-08-31T04:15:36Z | **partial — stops at three named seams** |

## Scenario 13's second half

The scenario asks for the check to be re-run with `ChangeRoomModule` removed from `AppModule`, and
to fail. Done as `T995d` and recorded in [mutation-proofs.md](./mutation-proofs.md): four of
`T406u`'s seven cases failed while the module was out, and all seven passed on revert.

## Scenario 14, honestly

The journey **completes as far as this Epic owns** and then stops at `EPIC-031` (no policy
provider, no Decision Inbox), `EPIC-033`'s baseline writer, and `EPIC-032` (no Evidence Contract
source). Each refusal names the Epic that owes the seam.

That is the designed behaviour: five of six ports refuse when unbound, and a walk that completed
today would mean one of those defaults had been made permissive. The transcript records what was
established and, separately, what it does **not** establish — no decision was taken, no baseline
moved, nothing closed, and no screen was driven.

---

# `R-034-8` performance targets, measured (`T995e`, `T995f`)

Measured by `backend/tests/integration/change-room-performance.spec.ts`, 30 samples each, p95
computed as `loop-performance.spec.ts` computes it so the figures are comparable across Epics.

| Target | Budget | Measured | Result |
|---|---|---|---|
| Impact view assembly, depth 25, 500 artifacts | p95 < 3 s | **0.203 ms** | pass |
| Baseline delta, 200 members | p95 < 500 ms | **0.689 ms** | pass |
| Change closure, excluding the `EPIC-032` call | p95 < 200 ms | **0.082 ms** | pass |
| Room load, six regions populated | p95 < 1.2 s | *`EPIC-033`'s figure — 0.13 ms, measured once* | inherited |

## What these numbers are, and are not

**Against in-memory stores and stubbed ports.** `EPIC-020`'s traversal, `EPIC-028`'s provider and
`EPIC-032`'s Contract evaluation are unbound in this Epic, so what is measured is this Room's own
composition, diffing and validation work — not PostgreSQL, and not the dependencies' latency.
`EPIC-033` recorded its figures on the same basis and said so. A figure presented as production
latency when it is not is worse than none, because it becomes the number people quote.

The closure target says *excluding the `EPIC-032` call* in as many words, so for that row the stub
is what the requirement asks for rather than a limitation.

**The delta figure was wrong on the first run, and a control caught it.** The fixture kept the old
version ids in the new set, so every "version change" was really a plain addition and the diff did
less work than the target describes. The anti-vacuity case — *"the delta it computed is the real
one, not an empty answer"* — failed, the fixture was corrected, and the figure above is from the
corrected run. A performance number measured on work that did not happen is the easiest kind of
number to publish.

**`T995f` — the Room-load figure is `EPIC-033`'s, not a second one.** A shared shell with two
different performance targets would be two shells. The check reads both Epics' `research.md` and
asserts the two targets are the same string; the shell's render cost is measured once, in
`EPIC-033`, and this Room inherits the component and its budget together.
