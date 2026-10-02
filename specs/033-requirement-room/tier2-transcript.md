# Constitution XI Tier 2 — the journey, walked

**Task**: `T1209` (supersedes `T1174`'s run) · **Run**: 2026-08-30T05:42:46.350Z
**Application**: `http://localhost:3000` · **Build under test**: container built from the Phase 11,
`EPIC-031` `T1196`–`T1200` and `EPIC-032` `T1201`–`T1204` slices
**Generated**, not authored — each line below carries the clock time the step returned at.

Quickstart [Scenario 13](./quickstart.md): *unstructured intent → approved baseline*, against a
running application.

**Outcome: the journey completes.** A baseline exists in PostgreSQL, approved by the signed-in user,
freezing a requirement version that this walk created.

---

## The walk, with the times each step returned

| At | Step | Observed |
|---|---|---|
| 2026-08-30T05:42:46.350Z | sign-in | `200`, session cookie set |
| 2026-08-30T05:42:46.412Z | **intake** | Room `8025aa73-4c10-4979-80b4-2edee0556bd3` opened; 1 candidate extracted, labelled `fact` |
| 2026-08-30T05:42:47.953Z | criteria | *"The declined options are readable on the recorded decision."* — `201` |
| 2026-08-30T05:42:48.942Z | promote | frozen as requirement version `4c5716f1-b323-4f83-8904-bc5475a32e6a` |
| 2026-08-30T05:42:49.938Z | decision | recorded; basis *"no classification rule matches `requirement-room.decide` at /org, so it takes the most restrictive band…"* |
| 2026-08-30T05:42:50.959Z | readiness | `ready=true`, `blockers=0` |
| 2026-08-30T05:43:22.101Z | **baseline** | `201 approved` — `ea15c366-357a-4106-9712-6772a4931a8a`, **version 2** |

The intent submitted was *"Every approval decision shall be retained with the options that were
declined."* — chosen because the journey that records it is the one being walked.

### The six regions, observed on the Room screen

`objectState`, `loopProgress`, `aiAnalysis`, `decision`, `evidence` and `activityTimeline` all
rendered, with `Execute` and `Verify` shown in loop progress as *"not used by this workflow"* rather
than absent (`FR-GEL-008`, `R-033-6`).

### What the baseline carries

```
id       ea15c366-357a-4106-9712-6772a4931a8a
version  2
members  ["4c5716f1-b323-4f83-8904-bc5475a32e6a"]
setHash  544204d14f232f1beeae26a97f6bae35a7293a3d…
```

`S1` acceptance scenario 2 asks a baseline to carry its approver, rationale, timestamp and version.
It does, and the approver came from the **session** rather than the request body — the rule
`DEF-033-001` was raised over. Version **2** because an earlier walk through the UI produced version
1; the counter reads the highest version rather than counting rows (`T1182`).

## What this walk found

**`promote` had never been called.** `RequirementRegister.promote` and `.freeze` existed since
`T338d` and nothing in the application invoked either, so a candidate could be labelled, given
criteria and decided and still had no requirement version for a baseline to freeze. Closed by
`T1206`/`T1207`. The same class as `X20`: built, tested, reachable from nowhere.

**The Room and the API were asking different questions.** `roomReadiness` did not send
`evidenceContractRef`, so the server could not evaluate the Contract and answered *"unevaluated"* —
the Room displayed a blocker the same call with the ref did not have.

**Two corrections the system made to me**, both recorded because they are the system working:

- the first promotion sent `priority: 'should'` and was refused — `EPIC-007`'s vocabulary is
  `p1 | p2 | p3`, and the Room does not get to invent the register's terms;
- the first scripted baseline sent the decision's `decisionId` where the foreign key wants its `id`,
  and was refused.

## What is NOT discharged

**The keyboard half of `SC-RQR-008` is not proved by this run.** The steps above were driven through
the API and the DOM, so this evidences that the journey **completes** — not that it completes using
only a keyboard.

The structural preconditions were measured in the earlier run and still hold: Tab reaches every
control in document order, focus is visible (`outline: solid 1.6px rgb(96, 165, 250)`,
`:focus-visible` matched), there is no positive `tabindex`, and every control is a native
`<button>`, `<input>` or `<textarea>` inside a real `<form>`, so Enter submits without a key handler.
What no driver here can evidence is a keypress **activating** a control: synthetic key events arrive
as `{"key":"Enter","code":"","which":0}` and no browser synthesises a click from those. A pointer
click on the same control works, which is what separates *the tool cannot press Enter* from *the
application cannot be operated by keyboard*.

**A person pressing Tab and Enter through these seven steps is what remains.** It is now a walk that
ends in an approved baseline rather than one that stops at a read-only screen.

## Findings recorded, not fixed

1. **The UI does not confirm the approval** (`T1208`). After a successful baseline the region still
   reads *"Nothing is outstanding"* and still offers **Approve baseline** — readiness is unchanged by
   approval and nothing renders the baseline that now exists. Invisible to 4890 tests; obvious in a
   browser in one click.
2. **The Evidence Contract is a constant.** `EVIDENCE_CONTRACT_REF = 'ev_room'` is named in
   `RequirementRoom.tsx` because nothing attaches a Contract to a Room — `FR-EVS-021` wants one
   attached at creation of the work it governs, and that is the rest of `EPIC-032`.
3. **The index labels Rooms by raw UUID**, carried from the earlier run. It needs a decision about
   what a Room should be called, which is a product question rather than a defect.
