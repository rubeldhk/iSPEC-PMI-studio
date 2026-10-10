# Data Model: Engineering Experts

**Epic**: `EPIC-047` · **Date**: 2026-10-09 · **Research**: [research.md](./research.md)

Six new tables, all workspace-scoped, plus one additive field in each of two contract packages.
Universal columns (`createdAt`, `updatedAt` where mutable) follow the repository convention.

## 1. `engineering_experts` — `EngineeringExpert`

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | Stable identity, independent of model or provider (`FR-EXP-003`) |
| `workspaceId` | text | Isolation (`FR-EXP-008`); every query is scoped by it |
| `key` | text | Human key (`test-engineer`); unique per workspace |
| `name` | text | Display name |
| `status` | `active` \| `retired` | Retired accepts no runs or assignments (`FR-EXP-006`) |
| `registeredBy`, `registeredAt` | text, timestamptz | `FR-EXP-007` |
| `retiredBy?`, `retiredAt?` | | Set once |

Unique: `(workspaceId, key)`.

## 2. `expert_contract_versions` — `ExpertContractVersion`

Immutable after insert except `decisionId`, written once on submission (`R-047-14`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `expertId` | | FK to the Expert in the same workspace |
| `version` | int ≥ 1 | Unique per Expert; next = max + 1 |
| `rolePurpose` | text | Required |
| `models` | jsonb `{preferred: string, fallbacks: string[]}` | Model names only (`FR-EXP-023`) |
| `capabilities` | text[] | ⊆ `AGENT_CAPABILITIES` |
| `allowedTools` | text[] | |
| `contextPolicy` | jsonb | `{budgetTokens, budgetCost, includeLiveState, essentialSources?}` (`R-047-10`) |
| `workspaceRequirements` | jsonb | e.g. `{repositoryAccess: [...], executionType}` |
| `permissions` | jsonb `[{artifactType, action}]` | `R-047-9` |
| `prohibitedActions` | text[] | Take precedence over allowances (`FR-EXP-013`) |
| `riskClass` | `low` \| `medium` \| `high` | `RiskBand` (`R-047-6`) |
| `budget` | jsonb `{timeMs, tokens?, cost?, resource?}` + per-limit `onUnenforceable: refuse \| proceed` | Defaults per `FR-EXP-043`; `resource` = maximum tool calls (`FR-EXP-040`) |
| `memoryPolicy` | `none` \| `governed-knowledge` | `FR-EXP-020`; `governed-knowledge` by amendment `A-047-1` (learning through `EPIC-048`, knowledge only through context, no private memory). `CHECK` replaced by `20261009110000_epic047_memory_governed_knowledge` |
| `expectedOutputs` | jsonb `[{kind, required}]` | Checked at run end (`FR-EXP-021`) |
| `evidenceContract` | jsonb `{workClass, contractVersion}` | `R-047-11` |
| `delegatesTo` | text[] (Expert keys) | Empty = may not delegate |
| `decisionId?` | text | `EPIC-031` decision; written once |
| `createdBy`, `createdAt` | | |

**Status is derived, never stored** (`R-047-5`): `draft` (no decision) → `submitted` (decision
pending) → `approved` (decision `approved` or `auto-executed`) or `refused`. A version is
**effective** if it is the highest approved version of an active Expert.

**Validation** (`FR-EXP-011`, `FR-EXP-022`): every one of the twelve elements present; every
missing element named; `evidenceContract` resolvable; every `delegatesTo` key an Expert in the
workspace; `models.preferred` not repeated in `fallbacks`.

## 3. `expert_delegation_policies` — `DelegationPolicy`

One row per workspace (absent → delegation refused).

| Field | Type | Rule |
|---|---|---|
| `workspaceId` | text PK | |
| `maxDepth` | int, default 3 | `FR-EXP-033` |
| `maxFanOut` | int, default 5 | Per session |
| `allowedPairs` | jsonb `[{from, to}]` | Expert keys; `*` permitted for `to` |
| `maxUnattendedBand` | `low` \| `medium` \| `high` | Assignment risk gate (`FR-EXP-054`) |
| `updatedBy`, `updatedAt` | | |

## 4. `expert_sessions` — `ExpertSession`

One row per Expert run, keyed by `EPIC-037`'s execution (`R-047-3`).

| Field | Type | Rule |
|---|---|---|
| `executionId` | text PK | `EPIC-037` execution, registered before the run |
| `workspaceId`, `expertId`, `contractVersionId` | | The version it **started** under (`FR-EXP-062`) |
| `delegatedFromExecutionId?` | text | Delegation parent — **not** `EPIC-037`'s re-run parent |
| `actorId` | text | The actor who started the **root** run; a delegate inherits it (`FR-EXP-034`, `T2005`, migration `20261009100000_epic047_session_actor`) |
| `depth` | int | 0 for a root |
| `model` | text | The model actually used |
| `usedFallback` | bool + `fallbackReason?` | `FR-EXP-017` |
| `effectiveAuthority` | jsonb | Capabilities, tools, permissions after intersection (`FR-EXP-034`) |
| `toolObservation` | `observed` \| `unobserved` | `FR-EXP-024` |
| `unattended` | bool | Set at dispatch |
| `reviewRequired` | bool | True whenever `unattended`; completion is proposed, never applied (`FR-EXP-063`) |
| `outcome?` | `succeeded` \| `incomplete` \| `failed` \| `stopped-by-limit` \| `stopped-by-parent` | |
| `startedAt`, `endedAt?` | | |

Cycle rule (`FR-EXP-035`): an Expert may not appear twice on one ancestor chain.

## 5. `expert_session_limits` — `SessionLimit`

| Field | Type | Rule |
|---|---|---|
| `executionId`, `limit` | PK (`time` \| `resource` \| `tokens` \| `cost`) | |
| `value` | numeric | After narrowing to the contract (`FR-EXP-044`) |
| `requested?` | numeric | What the request asked, when narrowed |
| `enforcement` | `enforced` \| `unenforceable` | Never `enforced` without the provider control (`FR-EXP-042`) |
| `consumed?` | numeric | Null = not reported; `consumedReason` says why (`FR-EXP-045`) |
| `reached` | `no` \| `stopped` \| `detected-late` | `FR-EXP-041`, `FR-EXP-046` |
| `detectedAt?` | timestamptz | |

## 6. `task_assignments` — `Assignment`

Append-only; current = latest row with `supersededAt` null and state `standing` (`R-047-12`).

| Field | Type | Rule |
|---|---|---|
| `id` | uuid PK | |
| `workspaceId`, `taskId` | | FK `tasks.id` (`EPIC-046`'s store, `FR-EXP-056`) |
| `assigneeKind` | `person` \| `expert` | |
| `assigneeId` | text | User id or Expert id |
| `rule` | text | The rule that permitted it (`FR-EXP-052`) |
| `state` | `standing` \| `pending-decision` \| `refused` | `FR-EXP-054` |
| `decisionId?` | text | When the risk gate applied |
| `assignedBy`, `assignedAt` | | |
| `supersededAt?`, `supersededBy?` | | Set once, on reassignment (`FR-EXP-055`) |

A standing assignment whose Expert is **retired** is reported as `assignee-retired` and the task as
needing reassignment; the row itself is not changed (spec Edge Cases).

## Contract-package changes (additive)

- `packages/agent-contract` — `AgentDescriptor.enforceableLimits?` (`R-047-1`).
- `packages/execution-registry-contract` — event type `expert-governance-recorded` with a `kind`
  payload union (`R-047-4`).
