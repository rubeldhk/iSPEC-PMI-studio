# Contract — The Three State Machines (`EPIC-037`)

Three machines over one event stream. Conflating them was the error corrected in Rev 3: **execution
lifecycle terminates; governance does not; registration state is orthogonal to both.**

---

## Machine 1 — Execution lifecycle

Projected from `class = 'lifecycle'` events. **Terminates.**

```text
  registered ──► started ──┬──► completed              ┐
                           ├──► partially-completed    │
                           ├──► failed                 ├─ TERMINAL
                           ├──► cancelled              │  no further
                           ├──► timed-out              │  LIFECYCLE event
                           └──► blocked                ┘

  progress-reported: permitted between started and terminal, any number of times
  incomplete:        registered or started, with no terminal event — a real state,
                     distinct from running and from failed
```

| From | Event | To | Refused when |
|---|---|---|---|
| — | `registered` | `registered` | input version identity missing (`AC-EXR-17a`) |
| `registered` | `started` | `running` | — |
| `running` | `progress-reported` | `running` | — |
| `running` | any terminal | that terminal state | `completed` without output binding (`AC-EXR-17c`) |
| *terminal* | any lifecycle event | — | **always refused** (`AC-EXR-19`) |

**A terminal execution is never reopened.** A re-run creates a new execution with
`parentExecutionId` set; the parent's stream is byte-identical afterwards (`AC-EXR-09`).

---

## Machine 2 — Status-transition governance

Projected from `class = 'governance'` events. **Does not terminate with the execution** — it may
begin, continue and conclude after the lifecycle machine has reached a terminal state
(`AC-EXR-18`).

```text
  proposed ──► validating ──┬──► validation_failed ──► refused
                            │
                            ├──► approval_required ──┬──► applied
                            │                        └──► refused
                            │
                            └──► applied         (only where policy authorises auto-apply)

  proposed ──► inconsistent ──► reconciliation_required ──┬──► resolved ──► (re-adjudicated)
                                                          └──► refused
```

| State | Reached by | Settled? |
|---|---|---|
| `pending` | `status-transition-proposed` | no |
| `validating` | validation begun | **no — intermediate** |
| `approval_required` | `approval-requested` | no |
| `applied` | `transition-applied` | **yes** |
| `refused` | `transition-refused` or `approval-refused` | **yes** |
| `inconsistent` | `transition-inconsistent` | no |
| `reconciliation_required` | `transition-reconciliation-requested` | no |

**`validation-passed` does not imply application** (Rev 3 correction 4, `AC-EXR-20`). A passed
validation moves to `approval_required` **or** `applied` *according to policy* — and policy is
EPIC-030's, consumed here, never re-implemented.

**Authority**: only the platform's governed workflow effects a transition. A connector attempting to
apply one directly is refused as a contract violation (`AC-EXR-16`). An AI agent may never approve
its own approval-gated transition; a human initiator's self-approval is tenant policy, not a
platform constant (`AC-EXR-08`).

---

## Machine 3 — Execution registration / governance state

Projected from `class = 'registration'` events. Connected registrations enter at `governed`
directly and never visit the other states.

```text
  CONNECTED:   ──────────────────────────────────► governed

  OFFLINE:     provisional ──(execution-sync-queued)──► pending_sync
                    │                                       │
                    │              (execution-reconciliation-requested)
                    │                                       ▼
                    │        ┌── execution-reconciliation-accepted ──► governed
                    │        └── execution-reconciliation-conflicted ──► conflicted
                    │                                                        │
                    └────────────── human resolution required ───────────────┘
```

| State | Means | Presented as governed? |
|---|---|---|
| `provisional` | Durable local record created before execution | **No** |
| `pending_sync` | Queued for synchronisation | **No** |
| `conflicted` | Intake could not be applied; awaiting a human | **No** |
| `governed` | Accepted and reconciled by the platform | **Yes** |

**`pending_sync` is derived, never a mutable flag.** It is reached only by appending an immutable
`execution-sync-queued` event (Rev 3 correction 2), so the offline path leaves the same audit trail
as every other path.

**Strict-governance mode never enters this machine at all**: the command is blocked and no execution
exists (`AC-EXR-06`).

---

## How the three interact

| Question | Answered by |
|---|---|
| Did the command finish, and how? | Machine 1 |
| Did the specification's status change, and on whose authority? | Machine 2 |
| Is this execution part of the governed record yet? | Machine 3 |

A single execution can legitimately be **`completed` (M1) · `approval_required` (M2) · `governed`
(M3)** at the same moment: the command finished, its proposed transition awaits a human, and the
record is trustworthy. **One machine could not express that**, which is why there are three.
