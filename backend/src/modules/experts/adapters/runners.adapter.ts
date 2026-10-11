/**
 * `T2566` (EPIC-047) — `ExpertGateways` over `EPIC-028`'s agent and execution
 * seam. `DEF-047-001`, `R-047-2`.
 *
 * A runner is a composed `AgentGateway` and the session it runs in. The binding
 * that offers a gateway owns provisioning its environment, so dispatch never
 * touches an `ExecutionSession`: start an ephemeral session, execute in it,
 * always stop it.
 *
 * ## What this file may name
 *
 * Only `@pmi/agent-contract` and `@pmi/execution-contract`. `backend/` names no
 * agent adapter, execution provider, container runtime or model
 * (`agent-independence.spec.ts`, `eslint.config.js`). The gateways, the
 * environment and the session template therefore arrive as an `AgentRuntime`
 * composed somewhere allowed to name them, through `EXPERT_AGENT_RUNTIME`.
 * Nothing composes one into the API process yet — `DEF-047-002` — so the port
 * refuses, naming that.
 *
 * ## What a run reports
 *
 * Only what it observed. The execute result carries an exit code and output,
 * not tool calls, consumption or output kinds, so those are left unreported:
 * downstream they read as *unobserved* and *not reported*, never as zero or as
 * nothing produced (`FR-EXP-024`, `FR-EXP-045`). An agent failure maps as the
 * engine adapter maps it — `timeout` → `timed_out`, `cancelled` → `cancelled`,
 * anything else `failed`. A session that cannot start never ran: that is a
 * fault, thrown naming the environment and its reason, and dispatch records it
 * as a failed run (`FR-EXP-061`).
 */
import type { AgentGateway } from '@pmi/agent-contract';
import {
  ExecutionProviderError,
  type ExecutionRequest,
  type ExecutionSession,
  type ProjectExecutionEnvironment,
} from '@pmi/execution-contract';
import { GovernanceSeamUnboundError } from '../../../core/errors.js';
import type { ExpertGateways, ExpertRunner, RunReport } from '../experts.tokens.js';

/** `T2566` — the composed runtime an Expert run executes in, when one is composed. */
export const EXPERT_AGENT_RUNTIME = Symbol('EXPERT_AGENT_RUNTIME');

export interface AgentRuntime {
  readonly gateways: readonly AgentGateway[];
  readonly environment: ProjectExecutionEnvironment;
  /** The session request, less what each run supplies: its timeout and its signal. */
  readonly session: Omit<ExecutionRequest, 'timeoutMs' | 'signal'>;
}

function runnerFor(gateway: AgentGateway, runtime: AgentRuntime): ExpertRunner {
  return {
    descriptor: gateway.descriptor,
    async run(invocation, ctx): Promise<RunReport> {
      let session: ExecutionSession;
      try {
        session = await runtime.environment.start({
          ...runtime.session,
          timeoutMs: ctx.timeoutMs,
          ...(ctx.signal !== undefined ? { signal: ctx.signal } : {}),
        });
      } catch (error) {
        const reason = error instanceof ExecutionProviderError ? error.reason : 'provider_error';
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `the ${runtime.environment.descriptor.provider} environment could not start a session for ` +
            `${gateway.descriptor.name}: ${reason} — ${message}`,
        );
      }
      try {
        const result = await gateway.execute(invocation, session, ctx);
        if (result.ok) return { status: 'succeeded', outputs: [] };
        const reason = result.failure.reason;
        return { status: reason === 'timeout' ? 'timed_out' : reason === 'cancelled' ? 'cancelled' : 'failed', outputs: [] };
      } finally {
        // Idempotent by contract, and never allowed to replace the run's own outcome.
        await runtime.environment.stop(session).catch(() => undefined);
      }
    },
  };
}

export function agentRunners(runtime: AgentRuntime): ExpertGateways {
  return {
    async gatewaysFor(model) {
      return runtime.gateways.filter((g) => g.descriptor.model === model).map((g) => runnerFor(g, runtime));
    },
  };
}

/** No runtime composed: refuse, naming the port and the defect that owes it. */
export function unboundRuntime(): ExpertGateways {
  return {
    async gatewaysFor(): Promise<never> {
      throw new GovernanceSeamUnboundError(
        'ExpertGateways is not bound — no agent runtime is composed into the API process (DEF-047-002). ' +
          'The adapter exists (EPIC-047 T2566); backend/ may name no agent adapter or execution provider, ' +
          'and the API has no composition root outside it. No Expert run can be dispatched until one supplies ' +
          'EXPERT_AGENT_RUNTIME (FR-EXP-017).',
      );
    },
  };
}

/** The binding: the composed runtime when there is one, a named refusal when there is not. */
export function expertGateways(runtime: AgentRuntime | null): ExpertGateways {
  return runtime === null ? unboundRuntime() : agentRunners(runtime);
}
