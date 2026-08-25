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
