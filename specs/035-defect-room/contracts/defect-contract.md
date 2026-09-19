# Contract: the Defect Room surface

**Epic**: `EPIC-035` · **Phase**: 1 · **Date**: 2026-08-23 · **Plan**: [plan.md](./plan.md)

The third Room, and the one that publishes **no package**. `EPIC-033` published
`packages/room-contract`; this Room imports it, as `EPIC-034` did. A second Room pattern is how
`UX-0035` would be broken, and `EPIC-033` made the six regions required named props so that breaking
it does not compile.

---

## 1. Imported, not defined

| From | What | Why not here |
|---|---|---|
| `packages/room-contract` | `RoomShellProps` (six required named regions), `Epistemic`/`Labelled<T>`, `RoomObjectRef` | `UX-0035` — three Rooms, one pattern. `EPIC-033` owns it |
| `frontend/src/rooms/RoomShell.tsx` | the `UX-0041` breakpoints and the `UX-0040` 360px floor | one component honouring it beats three agreeing to |
| `packages/loop-contract` | `LOOP_STAGES`, `GateResult`, transition results | `EPIC-030` owns the loop |
| `packages/evidence-contract` | `Attestation`, `EvidenceContract`, `ContractStatus`, `ItemState` | `EPIC-032` owns evidence — **and its `AccessPolicy` port already refuses to read around artifact access**, which is `FR-DFR-033` (`R-035-7`) |

`workflowType` is `'defect-room'` — a **string**, because `room-contract` deliberately does not close
the union over its three consumers.

---

## 2. Classification — three outcomes, three destinations, total

```ts
export const CLASSIFICATION_OUTCOMES = [
  'confirmed-defect',
  'change-request',
  'requirement-gap',
] as const;
export type ClassificationOutcome = (typeof CLASSIFICATION_OUTCOMES)[number];

export type Destination = 'repair' | 'change-room' | 'requirement-room';

/** Total by construction — FR-DFR-077. A new outcome without a destination does not compile. */
export const DESTINATIONS: Record<ClassificationOutcome, Destination> = {
  'confirmed-defect': 'repair',
  'change-request': 'change-room',
  'requirement-gap': 'requirement-room',
};
```

**A `Record`, not a `switch` with a `default`.** `default` is where a third outcome goes to die
quietly, and this Epic's exit criteria call shipping two outcomes *"the shape this Epic is most
likely to ship by accident."*

`approvedBehaviourRef` is required **except** for `requirement-gap`, where its absence is the
finding. `FR-DFR-021` requires the absence to be *recorded*, so it is a field and not a null.

---

## 3. The passing reproduction test — no edge to a classification

```ts
export type EvidenceCheckPath = 'refine-test' | 'investigate' | 'reclassify';

export interface EvidenceCheck {
  readonly path: EvidenceCheckPath;   // required — no default, no optional variant
  readonly rationale: string;
  readonly resolvedBy: ActorRef;
}
```

`ADR-0016`: *"Do NOT blindly classify every passing reproduction test as a Change Request."*

The loop configuration has **no transition from a passing reproduction run to a classification**.
The only edge is to the evidence check, and the check's path is a required discriminant a person
sets. `FR-DFR-044` and `SC-DFR-004` are then properties of the configuration rather than of a code
path somebody has to remember not to add.

`FR-DFR-031` sits beside it: a single passing run on an `intermittent` reproduction neither closes
nor reclassifies.

---

## 4. Test-first — the failing test as a precondition, in three places

```ts
export interface DefectTest {
  readonly testRef: string;
  readonly contestedBehaviourRef: string;
  readonly firstObservedFailingAt: Date;   // non-optional — a test that never failed is not this
  readonly lastRunOutcome: 'fail' | 'pass' | 'not-run';
}

export type FixAcceptance =
  | { readonly accepted: true; readonly provenBy: DefectTest }
  | { readonly accepted: false; readonly reason: 'no-failing-test' | 'not-automatable-unevidenced' | 'regression-failed' };
```

`FR-DFR-041` is guarded at three levels, deliberately:

1. **the type** — `accepted: true` cannot be constructed without a `DefectTest`;
2. **the loop configuration** — no transition into `repairing` without one;
3. **a database `CHECK`** — `FR-DFR-041`, because a caller can bypass a service (`R-035-8`).

`SC-DFR-001`'s mutation test exists to prove all three notice.

---

## 5. Ports this Room consumes

| Port | Filled by | Absent behaviour |
|---|---|---|
| `LoopEngine` | `EPIC-030` | refuse |
| `PolicyProvider` | `EPIC-031` | **refuse** — an undecided decision is not an approval |
| `EvidenceStore` | `EPIC-032` | **refuse** — closure cannot complete on unevaluated evidence |
| `BaselineReader` | `EPIC-033` | **refuse** — without it, *"no approved behaviour found"* and *"could not look"* are indistinguishable, and the first is a Requirement Gap |
| `ChangeIntake` | `EPIC-034` `POST …/transfer-intake` | refuse — an item must not be marked transferred to somewhere it did not arrive |
| `RequirementIntake` | `EPIC-033` — **route does not yet exist** (`R-035-4`) | refuse |
| `TestExecution` | **nobody** (`R-035-1`) | **refuse** |
| `RepairTaskPort` | `EPIC-012` `TaskStore.createMany` + `EPIC-011` `LinkWriterService` | refuse |
| `AgentGateway` | `EPIC-028`, capability `analyze` | **degrade, do not refuse** |

**`AgentGateway` is the only port that degrades**, and it is the third time this Wave has drawn that
line in the same place. An absent *analysis* provider means the AI could not help triage; a person
can still identify the contested behaviour and classify by hand, and refusing would make the
governed path depend on a model being reachable — `RULE-03` inverted.

**`TestExecution` refusing is the load-bearing one.** *"We could not run the tests"* must never
resolve to *"the tests passed"* — `BR-0144`, `FR-DFR-063`. It is also the port with no
implementation anywhere in the programme, which is why it is named rather than assumed.

---

## 6. HTTP surface — the real entry points

| Method | Route | Requirement |
|---|---|---|
| `POST` | `/rooms/defect/reports` | intake from any of six origins (`FR-DFR-010`, `FR-DFR-013`) |
| `POST` | `/rooms/defect/:id/triage` | classify against approved behaviour (`FR-DFR-020`–`FR-DFR-022`) |
| `POST` | `/rooms/defect/:id/reproduction` | reproducibility, environment, evidence (`FR-DFR-030`) |
| `POST` | `/rooms/defect/:id/test` | link the failing test (`FR-DFR-040`, `FR-DFR-042`) |
| `POST` | `/rooms/defect/:id/evidence-check` | the three paths from a passing run (`FR-DFR-044`) |
| `POST` | `/rooms/defect/:id/repair-tasks` | convert to `EPIC-012` tasks (`FR-DFR-050`) |
| `POST` | `/rooms/defect/:id/verify` | request a run; consume the result as evidence (`FR-DFR-060`, `FR-DFR-062`) |
| `POST` | `/rooms/defect/:id/close` | closure gated on test **and** regression evidence (`FR-DFR-060`, `FR-DFR-063`) |
| `POST` | `/rooms/defect/:id/transfer` | offer, with the stated reason (`FR-DFR-070`, `FR-DFR-072`) |
| `POST` | `/rooms/defect/:id/transfer-return` | an item the Change Room refused (`FR-DFR-074`) |
| `POST` | `/rooms/defect/:id/route-gap` | Requirement Gap → Requirement Room as new intent (`FR-DFR-076`) |
| `GET` | `/rooms/defect/:id/blockers` | what is blocking, without another screen (`FR-DFR-093`) |
| `GET` | `/rooms/defect/analytics` | escape point and origin in aggregate (`FR-DFR-080`, `FR-DFR-081`) |

`403` when policy refuses, carrying the `EPIC-031` decision id so the Room renders the refusing
policy (`FR-DFR-094`, `UX-0033`).

`409` on a fix submitted with no failing test on record (`FR-DFR-041`), carrying the affordance to
record one — the Room's counterpart of `EPIC-033`'s `409` on an in-place edit.

`503` when `TestExecution` is absent, and **never `200` with an assumed pass** (`R-035-1`).

---

## 7. What this Room must never contain

Asserted by `backend/tests/architecture/defect-room-independence.spec.ts`:

- **no test runner, executor, scheduler or CI adapter** — `FR-DFR-002`, `FR-DFR-062`, `R-035-1`.
  This is the boundary this Epic is most likely to cross, because the port it needs is the one
  nobody built;
- **no import of `GenerateTasksService` or `TaskRegenerationService`** — `R-035-2`. The first
  derives tasks from specification text through an engine and stamps an engine's name on them; the
  second replaces a task list. Both are named for what this Room wants and do something else;
- no region vocabulary of this Room's own — `FR-DFR-091`, `UX-0035`;
- no Room-local attachment or access-check path — `FR-DFR-032`, `FR-DFR-033`, `R-035-7`;
- no requirement text, specification text or baseline storage — `EPIC-033`'s;
- no Change Room vocabulary beyond the transfer's own fields — `EPIC-034`'s;
- no loop stage names, risk bands or evidence types — `EPIC-030`, `EPIC-031`, `EPIC-032`.
