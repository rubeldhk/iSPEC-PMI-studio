# Contract: Engineering Experts API

**Epic**: `EPIC-047` · **Date**: 2026-10-09

All routes are workspace-scoped through the existing authenticated workspace context. Errors use
the platform classes: `400 ValidationFailedError`, `404 NotFoundError`, `409 ConflictError`,
`503 GovernanceSeamUnboundError` (a port is unbound — the body names it).

## Registry and contracts (`BR-0101`, `BR-0102`)

| Method | Route | Purpose | Notes |
|---|---|---|---|
| `POST` | `/experts` | Register an Expert with its first contract version (draft) | `400` lists **every** missing element (`FR-EXP-011`) and every dangling reference (`FR-EXP-022`); `409` on a duplicate key |
| `GET` | `/experts` | List: key, name, role, risk class, effective version, status | |
| `GET` | `/experts/:id` | One Expert: effective contract, versions with derived status | |
| `POST` | `/experts/:id/contract-versions` | New draft version (full contract; never a patch) | Approved versions are immutable (`FR-EXP-004`) |
| `POST` | `/experts/:id/contract-versions/:version/submit` | Submit to `EPIC-031` | `503` naming `ContractApprovals` while unbound; `409` if already submitted |
| `GET` | `/experts/:id/contract-versions/compare?from=&to=` | Element-by-element difference | `FR-EXP-072` |
| `POST` | `/experts/:id/retire` | Retire | Idempotent; history unchanged (`FR-EXP-006`) |

## Delegation policy (`BR-0105`)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/experts/delegation-policy` | The workspace's policy, or `404` (no policy = no delegation) |
| `PUT` | `/experts/delegation-policy` | Replace it; recorded with actor and instant |

## Dispatch and sessions (`BR-0102`, `BR-0105`, `BR-0106`)

`POST /experts/:id/dispatch`

```text
{ command,              // a GOVERNED_COMMANDS member (R-047-3)
  objective, projectId,
  taskId?,              // must be assigned to this Expert when given
  capabilities[], tools[], targets[{artifactType, artifactId, action}],
  limits?{timeMs, tokens, cost, resource},
  delegatedFromExecutionId? }
```

- **`201`** `{executionId, contractVersion, model, usedFallback, limits[], toolObservation,
  contextPackageId}` — the execution was registered **before** the gateway was called.
- **Refusals** — each recorded as an `expert-governance-recorded` event of kind
  `dispatch-refused` (or `delegation-refused` on the parent) on an execution registered for the
  attempt, and returned with its `executionId`:
  - `400` — capability/tool outside the contract; prohibited action; target the contract or the
    actor may not touch; workspace requirement unmet; no declared model available; token/cost limit
    unenforceable under a `refuse` posture; retired Expert; no effective (approved) version;
    delegation not permitted, too deep, too wide, or cyclic.
  - `503` — `ExpertGateways`, `ContractApprovals`, `ContextAssembler` or `EvidenceContracts` unbound.

`GET /experts/sessions/:executionId` — the session, its limits with enforcement and consumption,
its events, and its **delegation tree** (ancestors to the root, descendants to the leaves).

`GET /experts/:id/sessions?limit=` — recent runs for the screen.

## Assignment (`BR-0152`)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/tasks/:taskId/assignment` | `{assigneeKind, assigneeId}` → `201 {state, rule, decisionId?}`; `400` naming the missing capability (`FR-EXP-051`); `state: pending-decision` when the risk gate applies |
| `GET` | `/tasks/:taskId/assignments` | Full history, current first (`FR-EXP-055`) |

Assignment never dispatches (`FR-EXP-053`).
