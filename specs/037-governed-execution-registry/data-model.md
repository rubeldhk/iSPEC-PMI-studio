# Data Model — Governed Execution Registry (`EPIC-037`)

**Date**: 2026-08-25 · Phase 1 of [plan.md](./plan.md)

**Migration posture: additive only** (`R-037-6`). Ten new tables; two existing tables gain one
optional nullable column each. No column is dropped, renamed or retyped. No data is moved.

---

## 1. The authority boundary

```text
AUTHORITATIVE            execution_events        append-only, DB-enforced
                         execution_comments      append-only, DB-enforced

IDENTITY (immutable      executions              root identity + summary
after insert)            status_transition_proposals
                         agent_identity_snapshots

DERIVED (rebuildable,    execution_state         projection over accepted events
never authoritative)     status_transition_state projection over governance events
```

Anything in **DERIVED** may be dropped and rebuilt by replay without loss.

**Anything in AUTHORITATIVE must have a trigger ATTACHED by this Epic's migration.** The
`reject_mutation()` *function* already exists and is reused (`R-037-2`); the *triggers* do not exist
until `T1026` creates them. Two `CREATE TRIGGER` statements are required —
`execution_events_immutable` and `execution_comments_immutable` — each
`BEFORE UPDATE OR DELETE … FOR EACH ROW EXECUTE FUNCTION reject_mutation()`. Until then the tables
are ordinary and mutable, and any claim otherwise is false.

---

## 2. Entities

### `executions` — stable root identity

| Field | Notes |
|---|---|
| `id` | uuid, client-generatable for provisional records (`FR-EXR-011`) |
| `correlationId` | threads a multi-command workflow |
| `idempotencyKey` | **unique per `(workspaceId, idempotencyKey)`** (`R-037-8`) |
| `organizationId` · `workspaceId` · `projectId` | scope; authorisation boundary (`FR-EXR-008`) |
| `command` | normalized Spec Kit command enum |
| `argsSanitized` | JSON, secrets redacted at the connector (`FR-EXR-022`) |
| `initiatorType` · `initiatorId` | user or service principal |
| `surface` | sandbox \| mcp \| ide \| cli \| ci \| fixture |
| `environment` | free-form environment descriptor |
| `governanceState` | `provisional` \| `pending_sync` \| `governed` — **projected**, not written directly |
| `parentExecutionId` | set on a re-run; never overwrites the parent (`FR-EXR-018`) |
| `contractVersion` | negotiated at registration; unsupported is refused |
| `registeredAt` | server clock |

### `execution_events` — the authority

| Field | Notes |
|---|---|
| `id` · `executionId` | |
| `sequence` | **server-assigned, gapless per execution** (`FR-EXR-017`) |
| `localSequence` | connector-assigned; null when connected; retained after reconciliation |
| `class` | `lifecycle` \| `content` \| `registration` \| `governance` |
| `type` | one of 29 (see [event-vocabulary.md](./contracts/event-vocabulary.md)) |
| `payload` | JSON, type-specific |
| `occurredAt` | **source clock — evidence, never the sequencing key** (`R-037-3`) |
| `recordedAt` | server clock |
| `emittedBy` | principal |
| `integrityHash` | over the event's content and its predecessor |

**Constraints**: `UNIQUE (executionId, sequence)` · `reject_mutation()` on UPDATE and DELETE ·
insert refused when a terminal lifecycle event already exists **and** the incoming event is
`class = 'lifecycle'` (`FR-EXR-018`).

### `execution_state` — projection

`executionId` · `lifecycleState` · `governanceState` · `projectedThroughSequence` · `updatedAt`.
Rebuildable; `projectedThroughSequence` makes staleness visible rather than invisible.

### `agent_identity_snapshots` — frozen identity

`executionId` · `descriptorId` (live reference, EPIC-028) · frozen `provider` · `model` · `adapter`
· `agentVersion` · `capabilities`. **Renaming a descriptor later must not alter history**
(`AC-EXR-14`).

### `execution_target_bindings` — phase-aware traceability

`executionId` · `phase` (`input` \| `output`) · `targetType` · `targetId` · `targetVersion` ·
`baselineId` · `repositoryId` · `branch` · `worktree` · `commitSha` · `artifactDigest`.

Required at registration for `phase='input'`; required at successful completion for `phase='output'`.
A failed or cancelled execution legitimately has no `output` row (`AC-EXR-17d`).

### `execution_artifacts`

`executionId` · `role` (`affected` \| `generated`) · `reference` · `digest` · `evidenceId`
(EPIC-032).

### `execution_comments` — append-only thread

`id` · `executionId` · `authorId` · `authorType` · `agentIdentitySnapshotId` · `commentType`
(`completion` \| `clarification` \| `review` \| `decision` \| `system` \| `decomposition-decision` — the
last admitted 2026-09-05 by `EPIC-044` `DEF-044-002` for the `EPIC-042` decision record) · `body` ·
`parentCommentId` · `visibilityScope` · `mentions[]` · `attachments[]` · `evidenceRefs[]` ·
`actionRequired` · `decisionRequired` · `supersedesCommentId` · `createdAt` · `integrityHash` ·
`redactionState` · `redactedBy` · `redactedAt` · `redactionReason`.

`reject_mutation()` applies. A correction is a **new** comment pointing at its predecessor. A
redaction is an event plus a state flag; the body is never overwritten in place (`R-037-9`).

### `status_transition_proposals` — immutable request, no verdict

`id` · `executionId` · `targetRef` · `targetVersion` · `proposedState` · `rationale` · `proposedBy`
· `proposedAt`. **No adjudication column** (`R-037-5`).

### `status_transition_state` — projection

`proposalId` · `state` (`pending` \| `validating` \| `approval_required` \| `applied` \| `refused` \|
`inconsistent` \| `reconciliation_required`) · `projectedThroughSequence`.

### `execution_outbox` — connector-side

`id` · `executionId` · `payload` · `localSequence` · `occurredAt` · `attempts` · `lastError` ·
`syncedAt`. Lives with the connector; mirrored server-side only for reconciliation reporting.

---

## 3. Existing tables — the only two touched

| Table | Change | Why |
|---|---|---|
| `audit_entries` | `+ executionId` nullable FK | Audit and execution history **join rather than diverge** (`R-037-6`) |
| `runs` | `+` inverse relation only | An unattended run may contain executions; **EPIC-023 keeps run semantics** and no column changes meaning |

Nothing else is altered. `generation_jobs` is deliberately untouched pending the implementation-level
audit the project owner held provisional in Rev 2 §17.

---

## 4. The three state machines, as persisted

| Machine | Where it lives | Terminates? |
|---|---|---|
| **Execution lifecycle** | `execution_state.lifecycleState`, projected from `class='lifecycle'` events | **Yes** — and no further lifecycle event may follow |
| **Status-transition governance** | `status_transition_state.state`, projected from `class='governance'` events | No — continues after the execution terminates |
| **Execution registration/governance** | `executions.governanceState`, projected from `class='registration'` events | Ends at `governed`; only offline executions start elsewhere |

Full transition tables: [contracts/state-machines.md](./contracts/state-machines.md).

---

## 5. Validation rules that live in the model, not in a service

- `UNIQUE (workspaceId, idempotencyKey)` — a retry cannot create a second execution (`AC-EXR-05`).
- `UNIQUE (executionId, sequence)` — two concurrent appends cannot claim one slot (`FR-EXR-017`).
- `reject_mutation()` on both append-only tables — immutability survives any future code path.
- `FK` from every binding, artifact, comment and proposal to its execution — an orphan is
  unrepresentable.
- **Not** enforced in the database, because it is policy rather than shape: which transitions are
  approval-gated, and who may approve. That is EPIC-030's, consumed here.
