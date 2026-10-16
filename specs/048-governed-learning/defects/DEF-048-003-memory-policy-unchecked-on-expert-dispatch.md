# DEF-048-003 — an Expert declaring `memoryPolicy: none` can be supplied knowledge through dispatch

**Epic**: `EPIC-048` | **Raised**: 2026-10-16 | **Status**: OPEN — awaiting the Project Owner's choice of fix

**Originating finding**: `/speckit-converge` (`T2414`, Phase 11) — recorded by `T2678`.
**Requirements**: `FR-LRN-055` (an Expert receives knowledge only when its contract version declares
`governed-knowledge`), `FR-LRN-056`, `SC-LRN-009`.
**Severity**: HIGH by requirement, **latent in every deployment today** (below).
**Owner**: `EPIC-048`. **Discharge tasks**: `T2679` (failing test through `EPIC-047`'s
`DispatchService`) → `T2680` (the chosen fix), both **⛔ BLOCKED on the Project Owner's decision**.

## Expected

`FR-LRN-055`: a package assembled for an Expert session whose contract version declares
`memoryPolicy: none` contains no knowledge item; one declaring `governed-knowledge` may.

## Actual

`KnowledgeGate` (`backend/src/modules/learning/supply.ts`, `memoryVerdict`) asks
`ExpertProvenance.forExecution(workspaceId, executionId)` — **only when the assembly names an
`executionId`**, and the answer comes from `EPIC-047`'s `expert_sessions` row.

`EPIC-047`'s dispatch (`backend/src/modules/experts/dispatch.service.ts`) does neither in time:

- it calls `ports.context.assemble({ workspaceId, projectId, objective, actorId, actorRole, policy })`
  **without `executionId`** (line ~284), binding the package to the execution only afterwards
  (`ports.context.bind`, line ~292);
- it writes the session row (`store.addSession`, line ~318) **after** assembling.

So on that path the gate has no execution to ask about and admits knowledge as it would for a
person's assembly. The Tier 1 suite's Q25 passes because it assembles *with* the execution id of a
session that already exists — the composition the dispatch path does not use.

## Why it is latent

Every assembly in every deployment answers `503` while `EmbeddingPort` has no owner (`R-048-13`,
`FR-CTX-013`), so no package with any knowledge in it is produced on any path today. The hole opens the
day an embedding provider is bound.

## Why this Epic did not just fix it

Each fix crosses another Epic's boundary, so it is the Project Owner's choice (Constitution II):

| Option | Change | Owner touched | Trade-off |
|---|---|---|---|
| **A — recommended** | Dispatch writes the session row, then assembles **with** `executionId` (`AssembleInput.executionId` already exists, `FR-CTX-062`) | `EPIC-047` (dispatch order) | Smallest; the gate already handles it. A dispatch that fails after `addSession` must still close the session, which `EPIC-047`'s stop path does |
| B | Dispatch passes the contract's `memoryPolicy` in the assembly input, and the gate reads it when present | `EPIC-038` (`AssembleInput`), `EPIC-047` | Works without the session row, but adds an Expert-specific field to a generic input |
| C | Fail closed inside `EPIC-048`: the gate excludes knowledge from every assembly that names no `executionId` | `EPIC-048` only | No cross-Epic change, but no person's assembly from the Context screen would ever receive knowledge — contradicts `FR-LRN-050` |

## Condition to discharge

The Project Owner picks an option; `T2679` is written through the real `DispatchService` and observed
red; `T2680` makes it pass; this record is closed with the run.
