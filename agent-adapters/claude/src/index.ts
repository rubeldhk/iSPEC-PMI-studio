/**
 * The Claude reference agent adapter — descriptor only.
 *
 * `T564` implements `execute()`. It is deliberately NOT implemented here,
 * because `R-028-5` / `R-AI-001` / `R-AI-002` are **uninvestigated**: nobody has
 * verified that `claude -p <command>` inside a container is a supported
 * server-side execution model. The descriptor is safe to declare — it is what
 * the orchestrator negotiates against — while the invocation is exactly the
 * thing `T646b` exists to discover by running a real container.
 *
 * Failing loudly is the honest behaviour. An adapter that silently returned
 * empty output would look healthy while producing nothing.
 */
import {
  agentFail,
  agentOk,
  type AgentContext,
  type AgentDescriptor,
  type AgentExecutionOutcome,
  type AgentGateway,
  type AgentInvocation,
  type AgentResult,
  type HealthStatus,
} from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';

export const CLAUDE_DESCRIPTOR: AgentDescriptor = {
  name: 'claude',
  provider: 'anthropic',
  model: 'claude-opus-5',
  executionType: 'headless',
  capabilities: ['execute', 'analyze', 'generate', 'review', 'test'],
  contextLimitTokens: 200_000,
  toolCapabilities: ['bash', 'read', 'write'],
  supportsMcp: true,
  repositoryCapabilities: ['read', 'commit'],
  securityClassification: 'external',
  supportsUnattended: true,
  /** The field that removes `--integration claude` from the engine adapter. */
  specKitIntegrationName: 'claude',
};

export class ClaudeAgent implements AgentGateway {
  readonly descriptor: AgentDescriptor = CLAUDE_DESCRIPTOR;

  getCapabilities(): AgentDescriptor {
    return this.descriptor;
  }

  async healthCheck(): Promise<AgentResult<HealthStatus>> {
    return agentOk(
      { reachable: false, detail: 'Not implemented — awaiting T564 and research R-028-5.' },
      this.descriptor,
    );
  }

  async execute(
    _invocation: AgentInvocation,
    _session: ExecutionSession,
    _ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>> {
    return agentFail(
      'agent_unavailable',
      'The Claude adapter is not implemented (EPIC-028 T564). R-028-5 is uninvestigated: ' +
        'whether `claude -p <command>` in a container is a supported server-side execution ' +
        'model has never been verified.',
    );
  }
}
