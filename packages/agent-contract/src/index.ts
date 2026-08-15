/**
 * AI Agent Gateway Contract — EPIC-028 (T551, T553).
 *
 * Declared once here and NOWHERE else. `backend/` may import this package; it
 * may never import `agent-adapters/*`. Adapters are supplied at the WORKER's
 * composition root, exactly as engine adapters are.
 *
 * WHY THIS IS SEPARATE FROM `SpecificationEngine` — Native §3 states it as a
 * prohibition: *"Do NOT merge SpecificationEngine and AgentExecutor. They
 * represent different abstractions."* The engine answers *how PMI Studio does
 * specification-driven engineering*; this answers *which AI capability does the
 * reasoning*. Before this package existed, `speckit.adapter.ts` named `claude`
 * in four places, so swapping the provider and swapping the engine were the
 * same edit.
 *
 * The dependency runs agent → execution and NEVER back: an agent runs inside an
 * environment; the environment knows nothing about agents. Asserted by
 * `agent-independence.spec.ts`.
 *
 * See specs/028-agent-execution-seam/contracts/agent-contract.md
 */
import type { ExecutionSession } from '@pmi/execution-contract';

// ---------------------------------------------------------------- capabilities

export const AGENT_CAPABILITIES = ['execute', 'analyze', 'generate', 'review', 'test'] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export interface AgentDescriptor {
  /** Registry key. Unique across registered adapters. */
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  readonly agentVersion?: string;
  readonly executionType: 'headless' | 'interactive';
  readonly capabilities: readonly AgentCapability[];
  readonly contextLimitTokens: number;
  readonly toolCapabilities: readonly string[];
  readonly supportsMcp: boolean;
  readonly repositoryCapabilities: readonly ('read' | 'commit' | 'push' | 'pull-request')[];
  /** Unused by this epic. Present so M-07 can attribute cost retrospectively. */
  readonly costMetadata?: {
    readonly inputPerMTok?: number;
    readonly outputPerMTok?: number;
    readonly currency: string;
  };
  readonly securityClassification: 'internal' | 'external' | 'byok';
  readonly supportsUnattended: boolean;
  /**
   * What Spec Kit's `--integration` flag calls this agent.
   *
   * This single field is what removes `--integration claude` from the engine
   * adapter. It lives on the AGENT because only the agent knows what Spec Kit
   * calls it; any other placement puts an engine detail in the agent or an
   * agent detail in the engine.
   */
  readonly specKitIntegrationName?: string;
}

// ---------------------------------------------------------------- failures

/** No `unknown` member. A generic failure is a defect, not a fallback. */
export const AGENT_FAILURE_REASONS = [
  'agent_unavailable',
  'agent_error',
  'malformed_output',
  'empty_output',
  'timeout',
  'cancelled',
  'capability_unsupported',
  'context_limit_exceeded',
] as const;

export type AgentFailureReason = (typeof AGENT_FAILURE_REASONS)[number];

export interface AgentFailure {
  readonly reason: AgentFailureReason;
  /** Safe to show a user. Never a raw stack trace. */
  readonly message: string;
  /** Operator-facing only. Never returned to a user, never logged (PC-3). */
  readonly diagnostics?: string;
}

export type AgentResult<T> =
  | { readonly ok: true; readonly value: T; readonly producedBy: AgentDescriptor }
  | { readonly ok: false; readonly failure: AgentFailure };

export function agentOk<T>(value: T, producedBy: AgentDescriptor): AgentResult<T> {
  return { ok: true, value, producedBy };
}

export function agentFail<T>(
  reason: AgentFailureReason,
  message: string,
  diagnostics?: string,
): AgentResult<T> {
  return {
    ok: false,
    failure: diagnostics ? { reason, message, diagnostics } : { reason, message },
  };
}

export function isAgentFailure<T>(r: AgentResult<T>): r is Extract<AgentResult<T>, { ok: false }> {
  return r.ok === false;
}

// ---------------------------------------------------------------- invocation

export interface AgentInvocation {
  readonly capability: AgentCapability;
  /** The command or prompt the agent runs. Opaque to the engine. */
  readonly command: string;
  readonly estimatedInputTokens?: number;
}

export interface AgentContext {
  readonly correlationId: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly onProgress?: (stage: string) => void;
}

export interface AgentExecutionOutcome {
  readonly exitCode: number;
  readonly stdout: string;
}

/** Native §7's audit list. Never carries a prompt or model output (PC-3). */
export interface AgentExecutionRecord {
  readonly provider: string;
  readonly model: string;
  readonly agentVersion?: string;
  readonly executionId: string;
  readonly correlationId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly status: 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  readonly failureReason?: AgentFailureReason;
  readonly costMetadata?: { readonly inputTokens?: number; readonly outputTokens?: number };
}

// ---------------------------------------------------------------- the contract

export interface HealthStatus {
  readonly reachable: boolean;
  readonly detail?: string;
}

export interface AgentGateway {
  readonly descriptor: AgentDescriptor;

  getCapabilities(): AgentDescriptor;

  healthCheck(): Promise<AgentResult<HealthStatus>>;

  /**
   * Run inside an already-started session.
   *
   * The agent does NOT create environments — that is the whole separation.
   */
  execute(
    invocation: AgentInvocation,
    session: ExecutionSession,
    ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>>;
}

// ---------------------------------------------------------------- registry

export class MissingAgentCapabilityError extends Error {
  constructor(
    readonly agentName: string,
    readonly missing: readonly AgentCapability[],
  ) {
    super(
      `Agent "${agentName}" cannot be assigned: missing required capability ` +
        `${missing.join(', ')}.`,
    );
    this.name = 'MissingAgentCapabilityError';
  }
}

export class ContextLimitExceededError extends Error {
  constructor(
    readonly agentName: string,
    readonly requested: number,
    readonly limit: number,
  ) {
    super(
      `Agent "${agentName}" has a context limit of ${limit} tokens; ${requested} were requested.`,
    );
    this.name = 'ContextLimitExceededError';
  }
}

/**
 * FR-AGT-003: negotiation happens BEFORE assignment, and a refusal names every
 * missing capability — the same behaviour `assertPhase1Capabilities` already
 * proves for engines in quickstart V11 step 5.
 */
export function assertAgentCapabilities(
  descriptor: AgentDescriptor,
  required: readonly AgentCapability[],
): void {
  const missing = required.filter((c) => !descriptor.capabilities.includes(c));
  if (missing.length > 0) {
    throw new MissingAgentCapabilityError(descriptor.name, missing);
  }
}

/** A pre-flight refusal (the `E7` family): a doomed run is never billed. */
export function assertContextFits(descriptor: AgentDescriptor, estimatedTokens: number): void {
  if (estimatedTokens > descriptor.contextLimitTokens) {
    throw new ContextLimitExceededError(
      descriptor.name,
      estimatedTokens,
      descriptor.contextLimitTokens,
    );
  }
}
