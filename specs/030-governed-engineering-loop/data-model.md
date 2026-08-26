# Data Model: Governed Engineering Loop

**Epic**: `EPIC-030` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Five persisted entities and two derived views. The organising rule, from `FR-GEL-010`: **state is
derived from transitions, never written directly.** Every table below either records a transition or
is a projection of them; there is no row a caller can set to move an object.

---

## 0. The one structural idea

```text
   PROGRAMME-DEFINED (repository files)        TENANT-CONFIGURED (database)
   ────────────────────────────────────        ────────────────────────────
   Loop Model — the 8 stages          ─┐    ┌─  authorities per transition
   Workflow Type — which stages apply ─┼──► │   required gates
   Stage handler bindings             ─┘    └─  trigger rules

                          ▼ both resolve into ▼
                    Loop Instance Configuration (versioned)
                                   │
                                   ▼
              Transition (append-only)  ──derives──►  Loop Object State
```

`FR-GEL-009` is the line down the middle: a tenant may cross into the right column and never into
the left. Stages are not tenant data.

---

## 1. `LoopModel` — not a table

The eight stages of `FR-GEL-001` are a **compile-time constant** in
`packages/loop-contract/src/stages.ts`, not a row anywhere:

```text
Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome
```

**Why not a table.** `FR-GEL-002` says the vocabulary is defined once and cannot be extended,
renamed or aliased. A table is editable; a constant that three packages import is not. Making this
data would put the one thing `UX-0035` depends on inside the thing tenants configure.

---

## 2. `LoopInstanceConfiguration`

The versioned binding of one workflow type to the model. Programme-defined half lives in
`packages/loop-contract/workflows/<type>.json`; the tenant-configured half is a database row keyed
to it.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | |
| `workspaceId` | uuid | `BR-0001` — every row is workspace-scoped |
| `workflowType` | string | must match a file in `workflows/`; unknown type refused at load (`FR-GEL-007`) |
| `configVersion` | int | monotonic per `(workspaceId, workflowType)`; never reused |
| `stages` | string[] | **derived from the programme file, not writable by a tenant** (`FR-GEL-009`) |
| `authorities` | json | per transition: which authority may perform it |
| `requiredGates` | json | per transition: named gates supplied by `EPIC-021` |
| `triggerRules` | json | per transition: the visible rule, or absent (`FR-GEL-031`) |
| `approvedBy` | string | actor identity; absent ⇒ configuration refused at load (`FR-GEL-016`, `R-030-7`) |
| `approvalRef` | string | the reviewed commit now; the policy decision id once `EPIC-031` lands |
| `approvedAt` | timestamptz | |
| `supersededBy` | int? | the `configVersion` that replaced this one; null while current |

**Uniqueness**: `(workspaceId, workflowType, configVersion)`.

**Validation**
- Every entry in `stages` is one of the eight (`FR-GEL-007`).
- Every named stage has a registered `StageHandler` (`FR-GEL-007`, `R-030-5`).
- Every `triggerRules` entry names a rule; an automated transition with none is refused
  (`FR-GEL-031`).
- `approvedBy` and `approvalRef` are both present or the configuration does not load (`FR-GEL-016`).

**Immutability**: a configuration row is **never updated**. A change writes a new `configVersion`
and sets `supersededBy` on the prior one, so `FR-GEL-006` holds by construction — an in-flight
object's `configVersion` still resolves to the bytes it started under.

---

## 3. `LoopObject`

The governed object under a loop. This Epic does not own what the object *is* — a requirement set, a
change request, a defect — only its position.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | |
| `workspaceId` | uuid | `BR-0001` |
| `projectId` | uuid | |
| `workflowType` | string | |
| `configVersion` | int | **fixed at creation**; never rewritten (`FR-GEL-006`) |
| `subjectType` | string | opaque to this Epic — the Room's own type name |
| `subjectId` | uuid | opaque to this Epic |
| `currentStage` | string | **derived**; see `§6` |
| `version` | int | the OCC token of `R-030-1`; incremented by every accepted transition |
| `closedAt` | timestamptz? | set when the object reaches a terminal Outcome |

**`subjectType` and `subjectId` are deliberately opaque.** `FR-GEL-061` forbids Room-specific
vocabulary in the loop; a foreign key to a requirements table would be exactly that. The Room owns
the join.

**Index**: `(workspaceId, workflowType, currentStage)` — serves `SC-GEL-006`, *which stage is it in
and how long has it been there*, without a scan.

---

## 4. `LoopTransition` — the append-only core

Every state change. There is no other writer of `LoopObject.currentStage`.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | |
| `workspaceId` | uuid | `BR-0001` |
| `objectId` | uuid | → `LoopObject` |
| `objectVersion` | int | the OCC token the attempt was made against (`FR-GEL-012`) |
| `fromStage` | string? | null only for the initial Event |
| `toStage` | string | |
| `outcome` | enum | `accepted` · `refused` · `conflict` · `exception` · `violation` |
| `refusalReason` | string? | required when `outcome ≠ accepted` (`FR-GEL-014`) |
| `wonBy` | uuid? | on `conflict`, the transition that won (`FR-GEL-015`) |
| `actorId` | string | authenticated identity (`FR-GEL-011`) |
| `actorKind` | enum | `human` · `automation` — `FR-GEL-032`, distinguishable without inference |
| `authorityBasis` | string | which authority permitted it; the refused authority when refused |
| `triggerRuleId` | string? | **required when `actorKind = automation`** (`FR-GEL-031`) |
| `triggerEventId` | string? | the event that fired the rule |
| `configVersion` | int | the configuration in force for this transition |
| `gateOutcomes` | json | one entry per required gate; see `§5` |
| `occurredAt` | timestamptz | |

**Append-only**: no `UPDATE`, no `DELETE`. Enforced the way `EPIC-004` already enforces audit
immutability — `backend/tests/integration/audit-immutability.spec.ts` is the precedent to follow, not
to duplicate.

**Constraints**
- `outcome = 'accepted'` ⇒ `refusalReason IS NULL`; otherwise it is `NOT NULL` (`FR-GEL-014`).
- `actorKind = 'automation'` ⇒ `triggerRuleId IS NOT NULL` (`FR-GEL-031`). A database constraint, not
  a service check, because this is the one `RULE-11` turns on.
- **Partial unique index** on `(objectId, triggerEventId, triggerRuleId) WHERE outcome = 'accepted'`
  — `FR-GEL-033` idempotency: one rule, one event, one advance.
- Written **in the same transaction as its audit record** (`R-030-2`, `FR-GEL-041`).

---

## 5. `GateOutcome` — embedded, not a table

One entry per required gate on a transition, stored as `LoopTransition.gateOutcomes`.

| Field | Values |
|---|---|
| `gateId` | the gate `EPIC-021` names |
| `result` | `satisfied` · `refused` · `exception` · `violation` |
| `exceptionAuthorizedBy` | actor, when `result = exception` |
| `exceptionReason` | required when `result = exception` |

**`satisfied` is not reachable by omission.** `FR-GEL-021` requires exactly one of four results for
every gate the configuration declares; a gate with no entry makes the transition invalid rather than
passed. This is the constraint whose mutation test is an Epic Exit Criterion — remove the
completeness check and the suite must fail.

**Why embedded**: a gate outcome has no life independent of the transition that produced it, and
`FR-GEL-022` (enumerate an object's exceptions and violations) is a query over transitions either
way. A separate table would add a join and a second thing to keep append-only.

---

## 6. `LoopObjectState` — derived view

`LoopObject.currentStage` is maintained **only** by the accepted-transition write, inside the same
`updateMany` that carries the OCC guard:

```text
UPDATE LoopObject
   SET currentStage = :toStage, version = version + 1
 WHERE id = :objectId AND version = :expectedVersion
```

`count = 0` ⇒ another transition won ⇒ this attempt is written as `outcome = 'conflict'` with `wonBy`
set, and refused (`FR-GEL-015`, `R-030-1`).

**Reconstructible**: `FR-GEL-013` requires the whole history to be rebuildable from transitions with
current state withheld. `currentStage` is therefore a cache of `last accepted transition's toStage`,
and the quickstart includes the check that proves the two agree.

---

## 7. `LoopProgress` — derived projection

`FR-GEL-050`/`FR-GEL-051`. Computed, never stored.

| Field | Derivation |
|---|---|
| `stage` | each stage in the instance's `stages`, in model order |
| `status` | `done` if an accepted transition left it · `current` if it equals `currentStage` · `pending` otherwise |
| `omitted` | true when the workflow type does not use the stage (`FR-GEL-008`) — **visible, not absent** |

Every workflow type returns the same stage vocabulary (`FR-GEL-051`), so a consumer needs no
per-type translation. `omitted` exists because `FR-GEL-008` distinguishes *configured not to apply*
from *not reached*, and a missing row would conflate them.

---

## 8. `AdjudicationRecord` — immutable evidence of a decision

*Added 2026-08-25 (Step C2A). `FR-GEL-072`. Table: `adjudication_records`.*

One row per adjudicated proposal. **Append-only, enforced by the database** — the migration binds
`reject_mutation()` to the table with a `CREATE TRIGGER`. The distinction this Epic had to correct:
the function already existed and protected fourteen other tables, and protected this one not at all
until a trigger was attached. A reusable function is not protection.

| Field | Type | Notes |
|---|---|---|
| `id` | text | primary key |
| `workspaceId` | text | tenant scope (`BR-0001`); FK to `workspaces` |
| `proposalId` | text | the proposal adjudicated |
| `executionId` | text | the execution that raised it — the `EPIC-037` link |
| `specificationId` | text | the object whose status was proposed |
| `idempotencyKey` | text | with `workspaceId` + `proposalId`, **unique** (`FR-GEL-071`) |
| `expectedStatus` | text | what the proposer believed (`FR-GEL-070`) |
| `requestedStatus` | text | what was asked for |
| `verdict` | text | one of the six (`FR-GEL-068`) |
| `reason` | text | why, in terms an auditor reads |
| `proposerId`, `proposerType`, `proposerSnapshotId` | text | **frozen** identity (`FR-GEL-067`) |
| `approverId`, `approverSnapshotId` | text? | present only where an approval was attempted |
| `appliedTransitionId` | text? | present **only** for `applied` — the `EPIC-009` transition |
| `correlationId`, `causationId` | text | causal chain |
| `decidedAt` | timestamp | the decision time, which **may be source-supplied** |
| `createdAt` | timestamp | **server-assigned** row creation |

**Why two timestamps.** Constitution XII holds that a source timestamp is evidence, never
sequencing authority. `decidedAt` can carry what the proposer asserted; `createdAt` is what this
system observed. Collapsing them would let a connector's clock rewrite the audit order.

**A correction is a new row.** There is no update path. A superseding decision is written with a
new idempotency key and both rows survive — the history is the pair, not the latest value.

## 9. What this Epic deliberately does not model

| Not here | Owner |
|---|---|
| Risk class, policy, approval bands | `EPIC-031` — the loop stores `authorityBasis`, not the policy that produced it |
| Evidence items and Evidence Contracts | `EPIC-032` — the Evidence stage is a seam, not a table here |
| Gate definitions and approvers | `EPIC-021` — the loop stores outcomes, not the gates |
| Requirement, change and defect records | `EPIC-033`–`035` — `subjectType`/`subjectId` stay opaque |
| Task records | `EPIC-012` |

`FR-GEL-060` and `FR-GEL-061` are the requirements this table enforces. An architecture test asserts
that `packages/loop-contract` imports nothing from a Room module and contains no Room vocabulary —
the same shape as the existing `engine-independence.spec.ts`.
