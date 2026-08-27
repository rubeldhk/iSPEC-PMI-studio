# Contract — Event Vocabulary (`EPIC-037`)

**29 events, four classes, one unambiguous meaning each.** The count is **not fixed**: the
vocabulary extends by amendment when a real decision has no event to record it. What is fixed is
that no two events may mean the same thing, and no event may mean two things.

Three names from an earlier draft were **withdrawn** because they were ambiguous about outcome, and
the withdrawal is recorded here so they are not reintroduced:

| Withdrawn | Why | Replaced by |
|---|---|---|
| `validation-completed` | Could not distinguish pass from fail — the distinction the whole adjudication turns on | `validation-passed` · `validation-failed` |
| `status-proposed` | Ambiguous between "a proposal exists" and "a status changed" | `status-transition-proposed` |
| `reconciled` | Conflated two different domains | the four `execution-reconciliation-*` and three `transition-reconciliation-*` events |

---

## Class 1 — Lifecycle (9)

**Terminality applies to this class only.** After a terminal lifecycle event, no further lifecycle
event may be appended; every other class may continue (`FR-EXR-018`).

| Event | Means | Payload carries | Terminal |
|---|---|---|---|
| `registered` | Root identity accepted; input binding recorded | contract version, input target bindings | no |
| `started` | Command execution began | agent identity snapshot | no |
| `progress-reported` | Intermediate progress; carries no outcome | free-form progress | no |
| `completed` | Succeeded; output binding required | outcome, output bindings | **yes** |
| `partially-completed` | Some work done, some not — a first-class outcome, not a caveated success | what was done, what remains | **yes** |
| `failed` | Ran and failed | error classification, no secret text | **yes** |
| `cancelled` | Stopped on request | who cancelled, when | **yes** |
| `timed-out` | Exceeded its bound | the bound that was exceeded | **yes** |
| `blocked` | Could not proceed; distinct from failure | what blocked it | **yes** |

*An execution with no terminal event is **incomplete** — distinguishable from both `running` and
`failed`. A process killed mid-run produces exactly this, and reporting it as `failed` would assert
something nobody observed.*

## Class 2 — Content (4)

Permitted **before and after** a terminal lifecycle event.

| Event | Means | Payload carries |
|---|---|---|
| `artifact-produced` | An artifact was affected or generated | role, reference, digest |
| `evidence-attached` | Evidence bound to this execution | evidence reference (EPIC-032) |
| `comment-added` | Agent or human comment appended | comment id, type, author |
| `comment-redacted` | Authorised redaction applied | actor, reason, timestamp — **never the redacted body** |

## Class 3 — Execution registration reconciliation (4)

Governs `executions.governanceState`. Applies to offline-originated executions only.

| Event | Means |
|---|---|
| `execution-sync-queued` | A provisional execution is queued locally; state becomes `pending_sync`. **This is what makes `pending_sync` derivable rather than a mutable flag** |
| `execution-reconciliation-requested` | The connector has offered the queued stream for intake |
| `execution-reconciliation-accepted` | The platform accepted it; state becomes `governed` |
| `execution-reconciliation-conflicted` | Intake could not be applied; a human must resolve it. **Never auto-resolved** (`FR-EXR-012`) |

## Class 4 — Status-transition governance (12)

Governs `status_transition_state`. Permitted **after** a terminal lifecycle event — approval days
later is the normal case, not the exception.

| Event | Means |
|---|---|
| `status-transition-proposed` | An agent requested a transition. Records the request only — **never a verdict** |
| `validation-passed` | Named validations succeeded. **Does not imply application** |
| `validation-failed` | Named validations failed, with reason |
| `approval-requested` | Routed to a human or role |
| `approval-granted` | Approver, basis, timestamp |
| `approval-refused` | Approver, reason |
| `transition-applied` | The transition took effect; names the platform authority that applied it |
| `transition-refused` | Policy forbade it, with reason |
| `transition-inconsistent` | The proposal contradicts current state |
| `transition-reconciliation-requested` | An inconsistent proposal needs resolution |
| `transition-reconciliation-resolved` | Resolved; re-adjudication may follow |
| `transition-reconciliation-refused` | Resolution refused, with reason |

---

## Rules that bind every event

1. **Immutable.** No update, no delete. Enforced by the database (`R-037-2`).
2. **Sequenced.** `sequence` is server-assigned and gapless per execution. A gap is a reconciliation
   fault, reported — never silently accepted (`AC-EXR-13`).
3. **Two clocks, one authority.** `occurredAt` is the source clock and is **evidence**; `recordedAt`
   is the server clock. Neither is the ordering key — `localSequence` orders within an execution
   offline, server `sequence` orders across it.
4. **Class decides terminality.** Only `lifecycle` is closed by a terminal event.
5. **No event carries a secret.** Arguments and error text are sanitised at the connector; the
   registry additionally refuses recognisable credential material (`FR-EXR-022`).
6. **Adjudication is never a field.** Every verdict is an event in class 4. There is no
   `adjudication` column anywhere in this model (`R-037-5`).

---

## Refusal mapping *(added 2026-08-27, Step C3A §1B)*

EPIC-030's `refused` verdict was not injective onto this vocabulary: it could mean any of three
class-4 events, and the verdict carried only prose to tell them apart. That was finding `X1`, closed
in the C2A closure by splitting refusal into two orthogonal typed concepts.

**Event selection reads the stage. Never the prose.**

| `refusalStage` | event |
|---|---|
| `validation` | `validation-failed` |
| `approval` | `approval-refused` |
| `transition` | `transition-refused` |

Total over the stage, so selection is a lookup:

```ts
import { refusalEventFor, REFUSAL_EVENT_OF } from '@pmi/loop-contract';
const event = refusalEventFor(verdict.refusalStage);
```

`refusalReasonCode` says **why** and never selects an event. `reason` is human-readable
supplementary evidence and **must not be parsed** — a consumer that reads it to decide behaviour has
reintroduced `X1` with extra steps.

The stage is **derived** from the reason code inside EPIC-030 (`REFUSAL_STAGE_OF`) rather than
carried alongside it, so the two cannot disagree.

## Reconciliation causes *(Step C3A §1C)*

`reconciliation_required` carries a structured `cause`. **All six must be handled**, and none of them
is a refusal:

| Cause | Means |
|---|---|
| `gate_outcomes_unavailable` | EPIC-021 cannot report outcomes at all |
| `gate_outcomes_stale` | An outcome exists, bound to a version or gate-set that has since moved |
| `gate_evaluation_incomplete` | Gates ran; the mandatory human decision is not yet recorded |
| `application_outcome_unknown` | Timeout, crash or lost response — nobody observed the outcome |
| `application_state_unconfirmed` | EPIC-009 answered, with a state other than the one requested |
| `application_transition_unidentified` | The state changed but no durable transition identity came back |

**Unavailable, stale, pending and unknown are not refusals.** Emitting `validation-failed` for an
unreadable gate outcome would assert that a gate examined this proposal and turned it down — a
decision nobody made. This is the correction the project owner directed in C2B, and it is why
`gate_outcomes_unavailable` was removed from the refusal vocabulary in both the contract and the
database.
