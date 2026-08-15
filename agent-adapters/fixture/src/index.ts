/**
 * T563 — the fixture agent.
 *
 * `ADR-0001`'s reasoning, transferred verbatim: *"without the fixture there is
 * no way to prove the contract is engine-neutral rather than Spec-Kit-shaped."*
 * Without a fixture agent there is no way to prove this contract is
 * agent-neutral rather than Claude-shaped — and Claude is the only agent anyone
 * in this programme has ever invoked.
 *
 * Deliberately trivial, and deliberately capable of failing on demand: the
 * conformance suite needs to drive every reason in the taxonomy without a
 * network call, a container, or a bill.
 */
import {
  agentFail,
  agentOk,
  assertAgentCapabilities,
  assertContextFits,
  type AgentContext,
  type AgentDescriptor,
  type AgentExecutionOutcome,
  type AgentGateway,
  type AgentInvocation,
  type AgentFailureReason,
  type AgentResult,
  type HealthStatus,
} from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';

export interface FixtureAgentOptions {
  readonly descriptor?: Partial<AgentDescriptor>;
  /** Injected failure, so every taxonomy member is reachable in a test. */
  readonly failWith?: AgentFailureReason;
  /** Simulates a step that never returns, for the hung-step conformance case. */
  readonly hang?: boolean;
  readonly stdout?: string;
}

const BASE: AgentDescriptor = {
  name: 'fixture',
  provider: 'fixture',
  model: 'fixture-1',
  executionType: 'headless',
  capabilities: ['execute', 'analyze', 'generate', 'review', 'test'],
  contextLimitTokens: 100_000,
  toolCapabilities: [],
  supportsMcp: false,
  repositoryCapabilities: ['read'],
  securityClassification: 'internal',
  supportsUnattended: true,
  specKitIntegrationName: 'fixture',
};

export class FixtureAgent implements AgentGateway {
  readonly descriptor: AgentDescriptor;

  constructor(private readonly options: FixtureAgentOptions = {}) {
    this.descriptor = { ...BASE, ...options.descriptor };
  }

  getCapabilities(): AgentDescriptor {
    return this.descriptor;
  }

  async healthCheck(): Promise<AgentResult<HealthStatus>> {
    if (this.options.failWith === 'agent_unavailable') {
      return agentFail('agent_unavailable', 'The fixture agent was configured as unreachable.');
    }
    return agentOk({ reachable: true }, this.descriptor);
  }

  async execute(
    invocation: AgentInvocation,
    session: ExecutionSession,
    ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>> {
    // E7 — both refusals happen BEFORE any session work, so a doomed run costs
    // nothing. Pre-flight refusal is the same pattern `empty_selection` and
    // `input_too_large` already follow on the engine side.
    try {
      assertAgentCapabilities(this.descriptor, [invocation.capability]);
    } catch (e) {
      return agentFail('capability_unsupported', (e as Error).message);
    }
    if (invocation.estimatedInputTokens !== undefined) {
      try {
        assertContextFits(this.descriptor, invocation.estimatedInputTokens);
      } catch (e) {
        return agentFail('context_limit_exceeded', (e as Error).message);
      }
    }

    // Checked BEFORE the listener is attached: `addEventListener('abort')` never
    // fires on an already-aborted signal, and missing that is what made a
    // cancellation report as a timeout in EPIC-003.
    if (ctx.signal?.aborted) {
      return agentFail('cancelled', 'Cancelled before the agent started.');
    }

    if (this.options.failWith && this.options.failWith !== 'agent_unavailable') {
      return agentFail(this.options.failWith, `Injected failure: ${this.options.failWith}.`);
    }

    if (this.options.hang) {
      // Self-terminate at the wall clock rather than waiting for a step that
      // will not return — the second defect the EPIC-003 suite caught.
      return new Promise((resolve) => {
        const timer = setTimeout(
          () => resolve(agentFail('timeout', 'The agent exceeded its wall-clock limit.')),
          ctx.timeoutMs,
        );
        ctx.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve(agentFail('cancelled', 'Cancelled while running.'));
          },
          { once: true },
        );
      });
    }

    ctx.onProgress?.('agent_started');
    const result = await session.exec([invocation.command]);
    ctx.onProgress?.('agent_finished');

    if (result.exitCode !== 0) {
      return agentFail('agent_error', `The agent exited ${result.exitCode}.`, result.stderr);
    }
    return agentOk(
      { exitCode: result.exitCode, stdout: this.options.stdout ?? result.stdout },
      this.descriptor,
    );
  }
}
