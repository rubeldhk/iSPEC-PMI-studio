# Contract: AI Agent Gateway

**Epic**: `EPIC-028` | **Date**: 2026-08-14 | **Status**: ✅ **IMPLEMENTATION CONTRACT**

**Package**: `packages/agent-contract` | **Adapters**: `agent-adapters/{fixture,claude}`

**Supersedes**: [`027-ai-native-amendment/contracts/agent-gateway.md`](../../027-ai-native-amendment/contracts/agent-gateway.md)
— that was a draft target for decision `D-20`. This is what gets built. Keeping both authoritative
would be a **PP-002** violation.

**Source**: Native Spec-Kit §2, §3, §7; Plan Amendment §6 | **Requirements**: `FR-AGT-001`–`005`, `012`

---

## The rule this package exists to enforce

```text
backend/**            ──►  @pmi/agent-contract          ✅
backend/**            ──►  agent-adapters/*             ❌  build fails
engine-adapters/**    ──►  @pmi/agent-contract          ✅  engines request an agent
engine-adapters/**    ──►  a named provider identifier  ❌  build fails
agent-adapters/**     ──►  backend/**                   ❌  build fails
worker composition    ──►  agent-adapters/*             ✅  the only place providers are named
```

Enforced by `backend/tests/architecture/agent-independence.spec.ts`, modelled on
`engine-independence.spec.ts` — which already checks imports, cross-directory imports, **string
identifiers**, and dynamic imports, because `await import('...speckit')` slips past an import-only
check (`T142a`).

The string-identifier check is the one that matters here: today's violation is `'claude'` as a
command-line argument, not as an import.

## Interface

```ts
export const AGENT_CAPABILITIES = ['execute', 'analyze', 'generate', 'review', 'test'] as const;
export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export interface AgentDescriptor {
  readonly name: string;                    // registry key, unique
  readonly provider: string;
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
  /** What Spec Kit's `--integration` flag calls this agent. Removes `claude` from the engine. */
  readonly specKitIntegrationName?: string;
}

export const AGENT_FAILURE_REASONS = [
  'agent_unavailable', 'agent_error', 'malformed_output', 'empty_output',
  'timeout', 'cancelled', 'capability_unsupported', 'context_limit_exceeded',
] as const;
// No `unknown` member — a generic failure is a defect, not a fallback.

export interface AgentInvocation {
  readonly capability: AgentCapability;
  /** The command or prompt the agent runs. Opaque to the engine. */
  readonly command: string;
  readonly estimatedInputTokens?: number;
}

export interface AgentContext {
  readonly correlationId: string;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly onProgress?: (note: string) => void;
}

export interface AgentGateway {
  readonly descriptor: AgentDescriptor;
  getCapabilities(): AgentDescriptor;
  healthCheck(): Promise<AgentResult<HealthStatus>>;
  /** Runs inside an already-started session. The agent does not create environments. */
  execute(
    invocation: AgentInvocation,
    session: ExecutionSession,        // from @pmi/execution-contract
    ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>>;
}
```

**`execute` takes a session it did not create.** That is the whole separation: the agent answers
*who reasons*, the environment answers *where it runs*, and the engine answers *how specification-
driven engineering happens*. The dependency runs agent → execution and never back.

## Non-negotiables

### 1 · Capability negotiation before assignment

`assertAgentCapabilities(descriptor, required)` throws `MissingCapabilityError` naming every missing
capability — the same function shape as `assertPhase1Capabilities`, and the same behaviour the engine
registry already proves in quickstart `V11` step 5: *"an adapter declaring two of three capabilities
is refused, naming the missing one."*

`context_limit_exceeded` is a **pre-flight refusal**, not a runtime failure. It joins `empty_selection`
and `input_too_large` in the `E7` family: refused before a container starts, so a doomed run is never
billed.

### 2 · Provider preference is never load-bearing

`AgentExecutionRequest.providerPreference` is a *preference*. An orchestrator that fails when the
preferred provider is unavailable has made it a requirement, and Native §2 forbids workflows
containing provider-specific logic. Asserted: a request naming an absent provider resolves to an
available agent and succeeds.

### 3 · Four conformance cases, from day one

Not hypothetical — three are defects this repository has already shipped (`R-028-4`).

| Case | Must produce |
|---|---|
| Signal already aborted before `execute()` | `cancelled` — **never** `timeout`, never a hang |
| Step hangs past the wall clock | Self-termination at `timeoutMs` |
| Misconfiguration (bad correlation id) | A wiring failure, **not** `agent_unavailable` |
| Capability absent | Refusal naming the gap, before any container work |

The suite runs against **every registered adapter** and **must be mutation-tested** — breaking a
fixture assertion must turn it red. EPIC-003 proved its engine suite this way, and its conformance
suite then *"found three real defects in my own adapter"*.

### 4 · A fixture agent ships with the contract

`ADR-0001`'s reasoning, transferred verbatim: *"without the fixture there is no way to prove the
contract is engine-neutral rather than Spec-Kit-shaped."* Without a fixture agent there is no way to
prove this contract is agent-neutral rather than Claude-shaped — and Claude is the only agent anyone
here has invoked.

### 5 · No prompt or output in operational logs

`FR-AGT-012`, PC-3. Already asserted for engine output by `T157`; restated because a new component is
where such a rule gets forgotten. `diagnostics` is operator-facing only and never returned to a user.

## Open — and why it does not block

**`R-028-5` / `R-AI-001` / `R-AI-002` are uninvestigated**: nobody has verified that
`claude -p <command>` in a container is a supported server-side model.

This contract does not depend on the answer. `AgentInvocation.command` is opaque, and how an adapter
executes it is the adapter's business. What the answer changes is **the Claude adapter's capability**,
and therefore `SC-AGT-001`.

**`AgentCapability` is a closed enum, unlike the draft's open question.** Native §6 permits
provider-specific features through capability negotiation, but `toolCapabilities: string[]` already
carries open-ended capability, and a closed enum gives the compile-time guarantee that made the
engine contract worth its cost. If a provider needs a genuinely new *kind* of capability, widening
the enum is a contract change — which is correct, because it is one.
