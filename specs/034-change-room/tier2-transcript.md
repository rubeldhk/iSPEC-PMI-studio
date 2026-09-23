# Constitution XI Tier 2 — the journey, walked

**Task**: `T995k` Scenario 14 · **Run**: 2026-08-31T04:15:36.233Z
**Application**: `http://localhost:3000` · **Build under test**: container rebuilt from the
EPIC-034 Phase 3–8 slices (`961cbd4`…`d73e2c1`)
**Generated**, not authored — each line carries the clock time the step returned at.

Quickstart [Scenario 14](./quickstart.md): a change carried from request through impact, options,
decision and re-baseline, against a running application.

## Outcome: the journey completes as far as this Epic owns, and stops where it says it will

A change request and its eight-area impact view exist in PostgreSQL, raised by the signed-in user.
The journey then **stops at three named seams** — `EPIC-031`, `EPIC-033`'s baseline writer, and
`EPIC-032` — each refusing with the Epic that owes it.

**That is the designed outcome, not a shortfall of the walk.** Five of this Room's six ports refuse
when unbound (`CHANGE_ROOM_PORTS`, `FR-GEL-062`), because a default that permits is invisible at
every call site. A transcript showing the journey completing today would mean one of those defaults
had been quietly made permissive.

---

## The walk, with the times each step returned

| At | Step | Observed |
|---|---|---|
| 2026-08-31T04:15:36.233Z | sign-in | `200`, session cookie set |
| 2026-08-31T04:15:36.264Z | projects | `200`, using project `b9286bb8-8a54-42a0-b238-a93c564b7f83` |
| 2026-08-31T04:15:36.271Z | **raise** | `201` — change request `019b7ccd-86e7-4f10-9e8f-96d5c19d53b0` against `b_tier2_1788149736264` v1, state `open`, urgency `critical` |
| 2026-08-31T04:15:36.277Z | list open against the baseline | `200`, 1 open |
| 2026-08-31T04:15:36.284Z | impact before computing | `404` — *"No impact view has been computed for this change request yet."* |
| 2026-08-31T04:15:36.314Z | **impact** | `201` — 8 areas, 8 `unknown`; violation check `not-run` |
| 2026-08-31T04:15:36.320Z | **options** | `201` — available `false`, options `null`, kind `gateway-unbound` |
| 2026-08-31T04:15:36.327Z | **decide** | `400` — *"no policy provider is bound (EPIC-031 supplies it), so nobody has authorised this decision — it is refused rather than recorded"* |
| 2026-08-31T04:15:36.337Z | **apply** | `400` — *"no decision has been recorded for 019b7ccd…, and a baseline does not move without one (FR-CHR-050)"* |
| 2026-08-31T04:15:36.346Z | **close** | `400` — *"no Evidence Contract source is bound (EPIC-032 supplies it), so nothing has proved this change — closure is refused rather than recorded (FR-CHR-071)"* |
| 2026-08-31T04:15:36.352Z | re-read the change request | `200` — state `open`, urgency `critical`, origin `direct` |
| 2026-08-31T04:15:36.361Z | re-read the impact view | `200` — id `d6f8d99a-6b12-4905-a0e7-c057a4c51122`, retained `false` |

---

## What the walk establishes

**`RULE-02` has a destination.** `POST /rooms/change/requests` — the route
`InPlaceEditRefusedError` has been advertising since `EPIC-033` — answered `201` and produced a
change request against the baseline it named.

**Urgency is recorded and changed nothing.** The request was raised `critical`. It is `open`, it
was refused at `decide` for the same reason a `normal` one would be, and the blocker list a screen
would render is identical. `FR-CHR-021`, observed rather than asserted.

**Eight areas, all `unknown`, each with a reason.** `EPIC-020`'s impact source is unbound, and the
view says so on every row rather than reporting a clean blast radius. `FR-CHR-032`, `SC-CHR-002`.

**The architecture panel states that `BR-0073` has not run** rather than showing no warnings.
`FR-CHR-034`.

**Options degraded rather than being invented.** `available: false`, `options: null` — not a
manufactured pair to satisfy `FR-CHR-040`'s count.

**Each refusal names the Epic that owes the seam.** A person reading these three messages knows
what is missing and who supplies it, which is what `UX-0032` asks of a blocker.

---

## Verified in PostgreSQL, not only in the responses

```
$ psql -c "SELECT id, targetBaselineId, urgency, state, origin FROM change_requests WHERE id = '019b7ccd…'"
 019b7ccd-86e7-4f10-9e8f-96d5c19d53b0 | b_tier2_1788149736264 | critical | open | direct

$ psql -c "SELECT count(*) FROM change_impact_areas WHERE impactViewId = 'd6f8d99a…'"
 8
```

Eight area rows, written individually so `change_impact_areas_unknown_states_say_why` had to hold
for each: an `unknown` area with no reason cannot be stored at all.

---

## What this transcript does NOT establish

Stated plainly, because a transcript that implies more than it walked is worse than none.

- **No decision was taken**, so no baseline moved and nothing closed. `FR-CHR-050`–`FR-CHR-054`,
  `FR-CHR-060`–`FR-CHR-063` and `FR-CHR-070`–`FR-CHR-073` are exercised by unit and integration
  tests against bound stubs, not by this walk.
- **No screen was driven.** The Room page is asserted by component tests (`T994r`–`T994w`); this
  walk is the API journey. A browser walk of the Change Room is not yet recorded, and `T1210`'s
  keyboard pass remains a human task.
- **The three seams are unbound in this deployment**, so the refusals are the honest state of the
  build under test — not a claim that the paths behind them work.

A second Tier 2 walk will be owed when `EPIC-031`, `EPIC-032` and the baseline writer bind, because
that is the run in which the journey completes.
