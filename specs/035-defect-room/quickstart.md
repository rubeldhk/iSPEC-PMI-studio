# Quickstart: Defect Room

**Epic**: `EPIC-035` · **Date**: 2026-08-23 · **Plan**: [plan.md](./plan.md)

Eighteen runnable scenarios. Each names what it proves and what a wrong result would mean — a
scenario that only says "expect 200" cannot tell a reader whether the guarantee held or the check
was weak.

## Prerequisites

```bash
pnpm install
pnpm --filter backend prisma migrate deploy
pnpm --filter backend prisma generate
```

**Hard prerequisite**: `EPIC-033` Phase 2 must be built — `packages/room-contract` and
`frontend/src/rooms/RoomShell.tsx` are **imported**, not derived (`R-035-3` of `EPIC-034`, and this
Epic's Assumptions).

**Known-absent collaborators**, and each must *refuse* rather than degrade:

- `TestExecution` — **nobody owns it** (`R-035-1`). Scenarios 3, 7 and 8 assert refusal, not a pass.
- `RequirementIntake` — `EPIC-033` has no inbound route yet (`R-035-4`). Scenario 11 asserts refusal
  until it does.

---

### Scenario 1 — A defect is judged against approved behaviour, not an opinion

Submit a report contesting behaviour that matches an approved baseline. Triage.

**Expect**: the approved expected behaviour is identified and linked; the outcome is **not**
`confirmed-defect`. `FR-DFR-020`, `FR-DFR-021`, `SC-DFR-002`.

**A wrong result** — confirmation without a baseline link — is the unbudgeted change channel
`ADR-0016` exists to close.

---

### Scenario 2 — No approved behaviour at all is a Requirement Gap, not a defect and not a change

Submit a report contesting behaviour no baseline covers.

**Expect**: `outcome = 'requirement-gap'`, `absenceRecorded = true`, `approvedBehaviourRef` null,
`destination = 'requirement-room'`. `FR-DFR-022`, `ADR-0016`.

**Then assert the third outcome cannot be dropped**: remove `'requirement-gap'` from
`CLASSIFICATION_OUTCOMES` and confirm the build fails on `DESTINATIONS` (`R-035-5`). Two outcomes is
the shape this Epic is most likely to ship by accident.

---

### Scenario 3 — No fix is accepted without a failing test

Confirm an automatable defect. Submit a fix with no `DefectTest` on record.

**Expect**: `409`, `FixAcceptance.accepted = false`, `reason = 'no-failing-test'`, and the affordance
to record one. `FR-DFR-041`, `SC-DFR-001`.

**Then bypass the service and insert the acceptance directly**: the database `CHECK` must reject it
too (`R-035-8`). The type, the loop configuration and the constraint are three guards, and this
scenario exercises the two that survive a caller going around the first.

---

### Scenario 4 — A defect that cannot be automated says so, and says why

Record a reproduction with `reproducible = 'not-automatable'` and no reason.

**Expect**: refused. Supply the reason; the defect proceeds and appears in the enumeration of
exceptions. `FR-DFR-043`.

**Why enumerable matters**: `BR-0054` says *"where automatable"*, and an unstated exception is
indistinguishable from a skipped rule.

---

### Scenario 5 — A passing reproduction test goes to an evidence check, never to a Change Request

Record a `DefectTest` whose run passes.

**Expect**: the defect moves to an evidence check offering **three** paths. **No classification
changed.** `FR-DFR-044`, `SC-DFR-004`, `ADR-0016`.

Resolve it as `investigate`; assert the path taken is recorded.

**Then attempt the transition the configuration does not have**: drive PASS → `change-request`
directly and assert the loop refuses. There is no edge (`R-035-6`).

---

### Scenario 6 — One passing run neither closes nor reclassifies an intermittent defect

Set `reproducible = 'intermittent'`. Record one passing run.

**Expect**: still open, still classified as it was. `FR-DFR-031`.

---

### Scenario 7 — Applicable regression scope is not bounded by the defect's own Epic

Fix a defect in Epic A whose change breaks a test in Epic B. Attempt closure.

**Expect**: refused, naming the failing regression. `FR-DFR-060`, `FR-DFR-061`, `SC-DFR-007`.

**With `TestExecution` absent**: closure is refused with `503` — **not** allowed through on the
grounds that no failure was observed (`R-035-1`).

---

### Scenario 8 — A declaration of completion is not evidence

Close a defect by asserting the tests pass, with no run evidence.

**Expect**: refused. `FR-DFR-063`, `BR-0144`.

---

### Scenario 9 — A transfer to the Change Room states why it is offered

Construct an item whose reproduction test passes against approved behaviour and whose request would
alter intent. Complete triage.

**Expect**: transfer offered, `offeredReason` present and non-empty; on acceptance the Change
Request carries the context and evidence **by reference** and shows the origin. `FR-DFR-070`,
`FR-DFR-071`, `FR-DFR-072`, `UX-0034`, `SC-DFR-003`.

**Then assert it cannot be fixed as a defect** (`FR-DFR-075`), and **assert `offeredReason` cannot be
empty** — an unexplained transfer button is a reclassification nobody decided.

---

### Scenario 10 — A declined transfer, and one the Change Room refuses

Decline an offered transfer. **Expect**: both the offer and the decline retained; the defect
continues as a defect. `FR-DFR-073`.

Accept a transfer the Change Room then refuses. **Expect**: the item **returns** with the refusal
attached. It does not vanish between two Rooms. `FR-DFR-074`, exercised jointly with `EPIC-034`
`FR-CHR-012`.

---

### Scenario 11 — A Requirement Gap reaches the Requirement Room as new intent

Route the Scenario 2 item.

**Expect**: it arrives at `EPIC-033` as new intent carrying reproduction context and evidence; the
defect record is **retained and marked reclassified**, never deleted. `FR-DFR-076`, `SC-DFR-010`,
`FR-DFR-025`.

**Until `EPIC-033` has an inbound route** (`R-035-4`) this scenario asserts **refusal** — the item
stays visibly unrouted rather than being marked routed to a destination that never received it.
That is the honest failing state, and it is what makes the handover visible instead of theoretical.

---

### Scenario 12 — Repair work is `EPIC-012` tasks, and not before classification

Confirm a defect. Convert it.

**Expect**: `EPIC-012` `TaskRecord` rows, each reachable from the defect and its test through
`RepairLink` and `EPIC-011`'s chain. `FR-DFR-050`, `FR-DFR-051`, `SC-DFR-012`.

Attempt conversion on an **unclassified** defect. **Expect**: refused. `FR-DFR-052`.

**Then assert the two banned imports**: `GenerateTasksService` and `TaskRegenerationService` must not
be reachable from this module (`R-035-2`).

---

### Scenario 13 — A reclassified defect keeps its record, and its tasks are not orphaned silently

Reclassify a defect after repair tasks exist.

**Expect**: the original classification row **retained** with `reclassifiedAt` set, a new
classification row, and the `RepairLink` rows marked `orphanedByClassificationId` — **both** the
tasks and the reclassification visible. `FR-DFR-025`, `SC-DFR-005`, `US7` scenario 4.

---

### Scenario 14 — Defects arrive from six origins and always link to an Epic

Submit one defect from each origin: automated test, manual report, monitoring, review tool,
production incident, agent.

**Expect**: all six accepted with origin recorded and an Epic and project link. `FR-DFR-010`,
`FR-DFR-011`, `FR-DFR-013`, `SC-DFR-006`.

Submit one that cannot be linked. **Expect**: `held-for-triage` with the missing link **named** —
not silently accepted unlinked. `FR-DFR-012`.

Assert an **agent-filed** defect is accepted as an origin and still cannot be confirmed by the agent
(`FR-DFR-023`).

---

### Scenario 15 — Escape analytics aggregate, and say what they cannot see

Close several defects. Request quality analysis.

**Expect**: escape point and origin aggregated **without opening individual records**, and the
origin distribution **carries a completeness note** stating that telemetry-originated linkage is
`BR-0163`, `U-19`, unowned. `FR-DFR-080`–`FR-DFR-083`, `SC-DFR-008`.

**A distribution that omits a source it cannot see is a chart that lies by arithmetic** — the same
rule `EPIC-034` applied to an impact area it could not determine.

---

### Scenario 16 — The Room cannot diverge from its siblings

Render the Room.

**Expect**: six regions from the **imported** `RoomShell`; region names compared programmatically
against `packages/room-contract` and `EPIC-033`'s. `FR-DFR-090`, `FR-DFR-091`, `UX-0035`.

**Then assert workflow-type isolation**: a Defect Room object must not transition under another
Room's stages, authorities or gates. `FR-DFR-001`, `SC-DFR-011`, via `EPIC-030` `T944a`.

---

### Scenario 17 — Constitution XI Tier 1: the Room is wired

Drive the Room through its **real HTTP routes** against the composed module graph, importing the
real `AppModule`.

**Then remove `DefectRoomModule` from `app.module.ts`** and confirm the test fails. A reachability
test that passes when the module is unregistered proves nothing.

---

### Scenario 18 — Constitution XI Tier 2: the journey, keyboard-only, against a running application

```bash
pnpm --filter backend start &
pnpm --filter frontend dev &
```

Carry one defect **report → triage → reproduce → failing test → repair tasks → verify → close**
against the running application, **using only a keyboard, with focus visible at every step**.

**Commit a run-generated transcript.** `SC-DFR-009` (`BR-0193`, `EPIC-029`) is exercised **inside**
this run rather than as a separate pass (`R-035-10`) — two runs could disagree, one cannot.

**Hand-written evidence is a constitution violation of the first order.** The conformance check
asserts the transcript names its run, covers all seven steps, and was generated rather than authored.
