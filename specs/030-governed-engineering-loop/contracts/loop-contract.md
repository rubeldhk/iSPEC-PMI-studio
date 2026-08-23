# Contract: `packages/loop-contract`

**Epic**: `EPIC-030` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

The vendor-neutral surface three Room Epics and two substrate Epics build against. Follows the
precedent of `packages/engine-contract`, `packages/agent-contract` and
`packages/execution-contract`: the contract is a package, the implementation is a backend module,
and an architecture test asserts nothing crosses back.

---

## 1. The stage vocabulary — `FR-GEL-001`, `FR-GEL-002`

```ts
export const LOOP_STAGES = [
  'Event', 'Context', 'Analyze', 'Decide',
  'Execute', 'Verify', 'Evidence', 'Outcome',
] as const;

export type LoopStage = (typeof LOOP_STAGES)[number];
```

**One definition, exported by reference.** A consumer that writes a stage name as a string literal
fails the lint boundary rather than review. This is `UX-0035` enforced one layer below the interface:
a Room cannot render a region name the contract does not have.

---

## 2. Ports the loop requires

Every seam this Epic declares but does not fill. Each is a token-injected interface, and an absent
implementation is a load-time refusal, never a runtime default.

### `StageHandler` — `FR-GEL-007`, `R-030-5`

```ts
export interface StageHandler {
  readonly stage: LoopStage;
  enter(ctx: TransitionContext): Promise<StageResult>;
}
```

A configuration naming a stage with no registered handler **fails to load** (`FR-GEL-007`). There is
no no-op default: a no-op `Decide` handler is an auto-approval wearing a placeholder's name.

### `PolicyProvider` — the **Decide** seam, filled by `EPIC-031`

```ts
export interface PolicyProvider {
  decide(request: DecisionRequest): Promise<DecisionResult>;
}
```

**Absent ⇒ refuse** (`FR-GEL-062`). Stated as a contract obligation rather than an implementation
choice, because a substrate whose missing policy provider defaults to permit installs the `ADR-0025`
failure mode at the foundation.

`EPIC-031` additionally owns whether a *configuration change* is permitted (`FR-GEL-016`); until it
exists, `R-030-7`'s reviewed-commit gate stands in, and the contract requires `approvedBy` and
`approvalRef` either way.

### `EvidenceProvider` — the **Evidence** seam, filled by `EPIC-032`

```ts
export interface EvidenceProvider {
  contractFor(objectRef: LoopObjectRef): Promise<EvidenceContractView>;
}
```

Returns the unmet items a Room's Evidence region renders. Absent ⇒ the Evidence stage cannot be
configured into a workflow type.

### `GateProvider` — filled by `EPIC-021`

```ts
export interface GateProvider {
  evaluate(gateId: string, ctx: TransitionContext): Promise<GateOutcome>;
}
```

`GateOutcome.result` is `satisfied | refused | exception | violation`. **The type has no fifth
member and no default**, which is how `FR-GEL-021`'s *"a silent pass MUST NOT be reachable"* becomes
a compile error rather than a code review.

### `AuditSink` — filled by `EPIC-004`

```ts
export interface AuditSink {
  record(entry: TransitionAuditEntry, tx: TransactionHandle): Promise<void>;
}
```

The `tx` parameter is **not optional here**, unlike the existing `AuditService.record(input, tx?)`.
`FR-GEL-041` requires the transition and its audit record to be atomic (`R-030-2`), and an optional
handle permits the non-atomic call the requirement forbids.

---

## 3. The operations the loop offers

### `declareObject`

Creates a `LoopObject` at `Event`, pinning `configVersion` (`FR-GEL-006`).

### `transition`

```ts
transition(input: {
  objectId: string;
  toStage: LoopStage;
  expectedVersion: number;      // the OCC token — R-030-1
  actor: ActorRef;
  trigger?: { ruleId: string; eventId: string };   // required for automation — FR-GEL-031
}): Promise<TransitionResult>;
```

`TransitionResult.outcome` is `accepted | refused | conflict | exception | violation`. **There is no
`throw` path for a governed refusal** — a refusal is a result that gets recorded (`FR-GEL-014`), not
an exception that might be swallowed by a caller's `catch`.

### `history`

Returns every transition for an object, in order, sufficient to reconstruct its whole loop without
reading current state (`FR-GEL-013`).

### `progress`

Returns the `LoopProgress` projection of `data-model.md §7` — `done | current | pending` per stage,
in the same vocabulary for every workflow type (`FR-GEL-050`, `FR-GEL-051`).

### `exceptions`

Every exception and violation taken during an object's loop, without opening each transition
(`FR-GEL-022`).

---

## 4. HTTP surface — the real entry point

The routes Constitution XI Tier 1 drives through. Listed because *"the entry point MUST be the real
one"*, and a contract that names only service methods gives a reachability test nothing to reach.

| Method | Route | Requirement |
|---|---|---|
| `POST` | `/loop/objects` | `declareObject` |
| `POST` | `/loop/objects/:id/transitions` | `transition` — `FR-GEL-010` |
| `GET` | `/loop/objects/:id/history` | `FR-GEL-013` |
| `GET` | `/loop/objects/:id/progress` | `FR-GEL-050` |
| `GET` | `/loop/objects/:id/exceptions` | `FR-GEL-022` |

All are workspace-scoped and require an authenticated identity (`BR-0001`, `BR-0002`). A refused
transition returns **`409 Conflict`** for a lost OCC race and **`403 Forbidden`** for missing
authority — both with the recorded transition id, so the caller can read the refusal rather than
infer it.

---

## 5. Configuration file schema — `FR-GEL-004`, `FR-GEL-005`, `FR-GEL-009`

`packages/loop-contract/workflows/<workflowType>.json`:

```json
{
  "schemaVersion": 1,
  "workflowType": "requirement-room",
  "stages": ["Event", "Context", "Analyze", "Decide", "Evidence", "Outcome"],
  "transitions": [
    {
      "from": "Analyze",
      "to": "Decide",
      "requiredGates": ["requirement-baseline-review"],
      "trigger": null
    }
  ]
}
```

**`stages` is programme-defined** (`FR-GEL-009`); the tenant row carries authorities, gates and
trigger rules only. A file declaring a stage outside `LOOP_STAGES`, or a `trigger` with no rule id,
fails the conformance check in `backend/tests/architecture/` — which is the **executable conformance
check** Constitution V requires for a non-code output, and it can fail.

**Omitted stages are legal and visible.** The example omits `Execute` and `Verify`; `FR-GEL-008`
requires that to appear in the progress projection as `omitted`, not as absent.

---

## 6. What the contract must never contain

Asserted by `backend/tests/architecture/loop-independence.spec.ts`, modelled on the existing
`engine-independence.spec.ts`:

- no import from any Room module (`FR-GEL-060`);
- no Room vocabulary — `requirement`, `change`, `defect`, `baseline`, `triage` — in a type, field or
  stage name (`FR-GEL-061`). `workflowType: "requirement-room"` is *data in a tenant's file*, which
  is the distinction: the contract may carry the string, and may not name the concept;
- no risk, policy or band type (`EPIC-031`);
- no evidence type or contract shape beyond the `EvidenceProvider` port (`EPIC-032`).
