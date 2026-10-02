# Contract — Task sync and task status proposals

**Epic**: `EPIC-046` · **Date**: 2026-09-06 · **Binds**: PMI-DOC-007 §4.1 (`pmi.tasks.sync`), §4.2
(`POST /v1/projects/{id}/tasks/sync`) · **Data model**: [data-model.md](../data-model.md)

## §1 · The connector operation (`FR-KAN-030`, `FR-KAN-060`, `FR-KAN-062`)

| | |
|---|---|
| **MCP tool** | `pmi.tasks.sync` — live as of this Epic; moves out of `RESERVED_TOOLS` |
| **REST** | `POST /v1/projects/{projectId}/tasks/sync` → `201` |
| **Auth** | `Authorization: Bearer <connector token>`; `ConnectorAuthGuard`; scope **`tasks.sync`** (the fifteenth) |
| **Arguments** | `{ contractVersion?: string, executionId: string, tasksMarkdown: string }` — **exactly what `runFinish` already sends** (`FR-KAN-061`) |
| **Idempotency** | Derived by the platform: `tasks-sync:<executionId>:<sha256(tasksMarkdown)>` (`R-046-8`) |

**Response** (`structuredContent` on MCP; body on REST):

```jsonc
{
  "syncId": "…", "epicId": "…|null", "tasksDigest": "…",
  "counts":  { "linesConsidered": 68, "parsed": 66, "refused": 1, "duplicates": 1 },
  "diff":    { "added": [ { "taskKey": "T1701", "line": 51 } ],
               "descriptionChanged": [ { "taskKey": "T1702", "from": "…", "to": "…" } ],
               "checkboxChanged":    [ { "taskKey": "T1703", "from": "not_started", "to": "done" } ],
               "unchanged": 62,
               "noLongerPresent":    [ { "taskKey": "T1699" } ] },
  "refusedLines": [ { "line": 57, "code": "malformed_identifier", "text": "- [ ] Tidy up" } ],
  "markers": { "aheadOfFile": ["T1704"], "supersededByFile": ["T1705"] },
  "outOfBandEdit": false
}
```

The diff is a **shape a client can print without interpreting prose** (`FR-KAN-037`): every entry is
a key and a value, never a sentence.

## §2 · Refusals (`FR-KAN-033`, `FR-KAN-039`, `FR-KAN-066`)

Existing vocabulary only — `invalid_connector_credential`, `scope_required`,
`unsupported_contract_version`, `credential_in_argument`, plus `EPIC-037`'s registry codes passed
through. This Epic adds **no new top-level refusal code**; the file- and line-level codes of
[data-model.md](../data-model.md) §7 travel inside `structuredContent`, as `EPIC-045`'s do.

| Situation | Answer |
|---|---|
| Unknown execution, or one of another project | Refused by name; nothing about the other project disclosed (`FR-KAN-070`) |
| Execution whose command is neither `tasks` nor `implement` | Refused by name (`FR-KAN-033`) |
| File over `PMI_TASKS_MAX_BYTES`, over `PMI_TASKS_MAX_LINES`, or not UTF-8 | Whole sync refused with the code (`FR-KAN-039`) |
| A line failing the grammar | The line is refused; the sync succeeds (`FR-KAN-003`) |
| A description containing a credential shape | That line refused, never stored, visible on the execution (`FR-KAN-073`) |
| Replay of the same execution and digest | `201` with the stored manifest (`FR-KAN-026`, `FR-KAN-038`) |
| Two simultaneous syncs of one Epic | Both `201`; one row per `(epicId, taskKey)` (`SC-KAN-006`) |
| Execution bound to no Epic | `201`, stored unbound (`FR-KAN-032`) |
| A provisional run | The hook makes no call at all; the board states its staleness (`FR-KAN-048`) |

## §3 · Session routes for the board (`FR-KAN-063`)

Read by the screens, authenticated as a project member. **No connector read exists** — `tasks.sync`
is a write scope with nothing beside it (`FR-KAN-071`), the same posture `EPIC-045` took for
artifacts.

```text
GET  /v1/epics/{epicId}/tasks                board rows, markers, latest-parse header   200
GET  /v1/epics/{epicId}/tasks/progress       total · done · in progress · not started · blocked · % 200
GET  /v1/projects/{projectId}/tasks/progress project aggregate over the same derivation 200
GET  /v1/epics/{epicId}/tasks/disagreements  ahead-of-file · not-in-latest-parse · unmatched
                                             reports · refused lines · out-of-band edit  200
POST /v1/tasks/{taskId}/status-proposals     { expectedCurrentStatus, requestedStatus, reason } 201
GET  /v1/tasks/{taskId}/status-proposals     the request rows with their folded verdicts 200
```

## §4 · The proposal operation (`FR-KAN-011` to `FR-KAN-016`)

`POST /v1/tasks/{taskId}/status-proposals` records the request, appends
`status-transition-proposed` to the task's `lastParsedExecutionId`, adjudicates, and returns the
verdict in one round trip.

| Condition | Verdict | Card |
|---|---|---|
| Member holds the move permission; no policy requires approval | `applied` | Moves at once (`R-046-6`) |
| `projects.taskMoveRequiresApproval` is set | `approval_required` | Stays; states requester, reason, time |
| `expectedCurrentStatus` no longer holds | `inconsistent` | Stays; verdict says the task had moved (`FR-KAN-016`) |
| Principal lacks the move permission | `refused` | Stays; stage on the card |
| Principal is an **agent** approving its own proposal | `refused` | Constitution XII.6 (`FR-KAN-013`) |
| Reason absent or empty | **`400` before a proposal exists** (`FR-KAN-011`) | Nothing recorded |
| Task has no `sourceLine`/`sourceDigest` (engine-generated) | Not this route — the existing `PATCH` still applies (`FR-KAN-017`) | — |

A verdict, immediate or not, is recorded as evidence and is never editable.

**Idempotency.** The request carries no key; the platform derives
`task-proposal:<taskId>:<proposerId>:<expectedCurrentStatus>:<requestedStatus>`, unique with
`workspaceId`. A double-submitted move therefore returns the original verdict rather than raising a
second proposal — the same posture as the sync's derived key (`R-046-8`). A genuine second move after
the first applied differs in `expectedCurrentStatus`, so it gets its own row.

## §5 · What changes elsewhere (`FR-KAN-065`, `R-046-13`)

| File | Change |
|---|---|
| `backend/src/modules/connector/connector-scope.ts` | `registerConnectorScope('tasks.sync')` — the fifteenth |
| `packages/mcp-server/src/tools/reserved.ts` | `pmi.tasks.sync` removed; **one** reserved tool remains |
| `packages/mcp-server/src/tools/tasks.ts` | New — the live tool |
| `packages/mcp-server/src/server.ts` | Registers `TASK_TOOLS` as live |
| `specs/043-…/contracts/mcp-tool-surface.md` §3 | Dated note: live as of `EPIC-046`; one reserved row; surface unchanged at fifteen; hook unedited |
| `backend/src/app.module.ts` | `+ TaskSyncModule` |
| `.env.example` · `README.md` §Setup · `docs/operator-setup.md` | The four settings of `R-046-9` |

## §6 · Tests that hold this contract

- **Contract**: `backend/tests/contract/tasks-api.spec.ts` — the six routes' shapes; the diff shape
  printable without prose; `mcp-tool-surface.spec.ts` with **one** reserved row.
- **Integration** (Testcontainers, composed `AppModule`, real `pmi-studio` server): the sync driven
  through the shipped `runFinish`; **two simultaneous syncs and a replay written first**
  (`DEF-045-002`'s lesson); a refused line beside stored ones; an unbound sync; a cross-project
  credential refused as absence; a whole-file refusal leaving no rows.
- **Unit**: the grammar corpus; the reconciliation truth table; the adjudicator's six verdicts;
  the derived idempotency key.
- **Architecture**: `connector-boundary.spec.ts` at fifteen scopes; `durable-stores.spec.ts`
  gains `TASK_SYNC_STORE`; `engine-independence` and `agent-independence` unchanged.
