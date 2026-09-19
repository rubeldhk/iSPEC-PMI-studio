# Contract (DRAFT TARGET): AI Agent Gateway

**Epic**: `EPIC-027` | **Date**: 2026-08-13 | **Status**: 🟡 **DRAFT TARGET — not built, not agreed**

**Source**: Native Spec-Kit §2, §3, §7; Plan Amendment §6
**Decision that adopts or rejects it**: `D-20`
**Research it depends on**: `R-AI-001`, `R-AI-002`, `R-AI-005`, `R-AI-008`

> **This contract is not implemented and must not be.** `FR-AMD-016` bounds EPIC-027 to analysis.
> It exists so that `D-20` is a decision about something concrete rather than about a direction, and
> so the impact report's §18.13 section has a design to describe.
>
> Native §7 says plainly: *"Do not prematurely finalize method names if research indicates a better
> contract."* Method names below are illustrative. **The boundary is the deliverable; the signatures
> are a sketch.**

---

## Why this contract exists separately from `SpecificationEngine`

Native §3 states it as a prohibition and then gives the reason:

> *"Do NOT merge SpecificationEngine and AgentExecutor. They represent different abstractions.
> SpecificationEngine answers: 'How does PMI Studio perform specification-driven engineering?'
> AgentExecutor answers: 'Which AI execution capability performs the reasoning/work?'"*

And the configurations that must become expressible:

```text
SpecKitEngine    → Claude        SpecKitEngine    → Cursor
SpecKitEngine    → Codex         NativePMIEngine  → Claude
NativePMIEngine  → enterprise internal agent
```

**None of these is expressible today.** `engine-adapters/speckit/src/speckit.adapter.ts` names
`claude` as a command in four places and takes one `aiProviderToken`. Choosing a different agent
means editing the Spec Kit engine. That is the merge §3 forbids, already present.

## Position in the dependency graph

```text
Application (backend)  ──►  packages/engine-contract      ✅  (existing)
Application (backend)  ──►  packages/agent-contract       ✅  NEW — permitted
Application (backend)  ──►  agent-adapters/*              ❌  NEW — FORBIDDEN, mirrors the engine rule
Engine adapter         ──►  packages/agent-contract       ✅  NEW — engines request an agent
Engine adapter         ──►  a named provider identifier   ❌  NEW — no 'claude' outside an agent adapter
Agent adapter          ──►  backend                       ❌  NEW — mirrors the engine rule
Worker composition root ──►  agent-adapters/*             ✅  NEW — injection point
```

Enforced by `backend/tests/architecture/agent-independence.spec.ts`, the third member of a family
whose first two members already fail the build when violated.

---

## Interface sketch

```ts
/** What an agent can do, discovered before assignment (Native §6). */
export interface AgentDescriptor {
  readonly provider: string;              // 'claude' | 'cursor' | 'codex' | 'fixture'
  readonly model: string;
  readonly agentVersion?: string;
  readonly executionType: 'headless' | 'interactive';
  readonly capabilities: readonly AgentCapability[];
  readonly contextLimitTokens: number;
  readonly toolCapabilities: readonly string[];
  readonly supportsMcp: boolean;
  readonly repositoryCapabilities: readonly ('read' | 'commit' | 'push' | 'pull-request')[];
  readonly costMetadata?: { inputPerMTok?: number; outputPerMTok?: number; currency: string };
  readonly securityClassification: 'internal' | 'external' | 'byok';
  readonly supportsUnattended: boolean;
  /** How this agent is named to Spec Kit's `--integration` flag, where applicable. */
  readonly specKitIntegrationName?: string;
}

export type AgentCapability =
  | 'execute-task' | 'analyze' | 'generate' | 'review' | 'test';

/** A request for authorized work (Native §2). */
export interface AgentExecutionRequest {
  readonly projectId: string;
  readonly workspaceId: string;
  readonly epicId?: string;
  readonly taskId?: string;
  readonly role: string;
  readonly requestedCapabilities: readonly AgentCapability[];
  readonly contextScope: ContextScopeRef;      // Native §11 — never "the whole project"
  readonly permissions: readonly string[];
  readonly executionPolicy: ExecutionPolicyRef;
  readonly timeoutMs: number;
  readonly resourceLimits: ResourceLimits;
  readonly providerPreference?: string;        // preference, never a requirement
}

export interface AgentGateway {
  readonly descriptor: AgentDescriptor;

  getCapabilities(): AgentDescriptor;
  healthCheck(): Promise<AgentResult<HealthStatus>>;

  execute(
    request: AgentExecutionRequest,
    ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>>;
}

export interface AgentContext {
  readonly correlationId: string;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly onProgress?: (stage: string) => void;
}
```

## Non-negotiables in this contract

These are not style preferences. Each one closes a defect this programme has already shipped, or a
prohibition the amendment states in normative language.

### 1 · Typed failures, never thrown exceptions

Mirrors `engineFail(reason, detail)`. The failure taxonomy must be **enumerated in the contract**, so
that classification is a compile-time surface rather than a per-adapter convention.

The EPIC-003 conformance suite found three defects in this exact area, and all three were
*misclassification*, not crashes:

| Defect found | What it looked like to an operator |
|---|---|
| Bad correlation id reported as `engine_unavailable` | A wiring defect disguised as an outage — sent someone to check the runtime |
| Adapter waited for a hung step instead of self-terminating | A wedged agent held a job open past its own wall-clock limit |
| `addEventListener('abort')` never fires on an already-aborted signal | **A cancellation was reported as a timeout** |

**The third is the one that matters most here.** `T045a` was written in EPIC-001 specifically to
prevent that confusion, and it recurred anyway in a different component. An agent layer that repeats
it will do so under autonomous execution, where nobody is watching.

### 2 · Cancellation and timeout are contract-level, and their conformance cases are mandatory

Native §20 requires runs to be *"cancellable, timeout-controlled, restart-safe where feasible,
idempotent where required, observable, correlated end-to-end."* Two cases go into the conformance
suite from the first day, not after the first incident:

- **Already-aborted signal** — a signal aborted before `execute()` is called must produce
  `cancelled`, not `timeout` and not a hang.
- **Hung step** — an adapter must self-terminate at its wall clock rather than waiting on a step
  that will not return.

### 3 · A fixture agent adapter ships with the contract

`ADR-0001`'s reasoning transfers verbatim: *"without the fixture there is no way to prove the
contract is engine-neutral rather than Spec-Kit-shaped."* Without a fixture agent, there is no way to
prove this contract is agent-neutral rather than Claude-shaped — and Claude is the only agent anyone
here has ever invoked.

The fixture is also what makes agent-dependent logic testable without spending money or waiting on a
model, which is the same argument that made the engine fixture worth its cost.

### 4 · Capability negotiation happens **before** assignment

Native §6: the platform determines available agents, models, capabilities, context limits, tool
permissions, execution environment, cost, security classification and task suitability *"before
assignment."*

The built engine registry already refuses an adapter declaring two of three capabilities, **naming
the missing one** — verified as quickstart `V11` step 5. The agent registry copies that behaviour.

### 5 · No prompt or model output in operational logs

Native §7: *"Never log prompts/output containing sensitive project information through unrestricted
operational logs. Follow existing PC-3 telemetry constraints."*

This is not a new control. `PC-3` already excludes engine output and credentials from logs, asserted
by `T157`. The contract restates it because a new component is the moment such a rule gets forgotten.

### 6 · Provider preference is a preference

`providerPreference` must never become a requirement. Native §2: *"PMI Studio workflows MUST NOT
contain provider-specific implementation logic."* An orchestrator that fails when a preferred
provider is unavailable has made the preference load-bearing.

---

## What this contract does **not** cover

| Not here | Where it belongs |
|---|---|
| Where the agent runs | [project-execution-environment.md](./project-execution-environment.md) — deliberately a separate seam |
| Which context the agent receives | ContextScope — Context Engine, held |
| Which credentials it holds | `ScopedCredential` — `D-27`, and the largest new security surface |
| Model-level routing, failover, cost optimisation | Beneath this contract. `D-30` splits the layer: agent-level native, model-level integrable |
| Whether governance gates run inside or around an agent run | `R-AI-004` — unresearched, and it changes the contract if the answer is "inside" |

---

## Open questions this contract cannot settle

1. **Does `execute()` need to be resumable?** If an agent run suspends for human approval mid-flight
   (Native §20 `waiting_for_input`), the contract needs a continuation concept. `D-25` places the
   state machine in the database, which *may* keep the contract single-shot — but only if approval
   always falls on a segment boundary. **Unresolved, and it changes the interface.**
2. **Is `AgentCapability` an open or closed enumeration?** Closed gives compile-time safety and is
   consistent with the engine contract. Open permits provider-specific features through capability
   negotiation, which Native §6 explicitly allows. The engine contract chose closed; this one
   probably cannot.
3. **Does a Cursor adapter exist at all?** `R-AI-005` is uninvestigated. If Cursor offers no
   server-side execution surface, the second adapter proving neutrality has to be Codex or the
   fixture — which weakens the neutrality claim, because a fixture proves the contract is
   *implementable*, not that it is *provider-shaped correctly*.
