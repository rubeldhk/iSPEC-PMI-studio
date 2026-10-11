/**
 * `T2565` (EPIC-047) — `ExpertGateways` over `EPIC-028`'s agent and execution
 * seam. `DEF-047-001`, `R-047-2`.
 *
 * A runner is a composed `AgentGateway` plus the session it runs in: the
 * binding that offers a gateway owns provisioning its environment, so dispatch
 * never touches an `ExecutionSession`. Everything here is written against
 * `@pmi/agent-contract` and `@pmi/execution-contract` only — `backend/` names no
 * adapter, provider or model (`agent-independence.spec.ts`), so the gateways
 * and the environment are composed elsewhere and handed in.
 *
 * What a runner reports is only what it observed. The contract's execute
 * result carries an exit code and output, not tool calls or consumption, so
 * those are left **unreported** — recorded downstream as unobserved and not
 * reported, never as zero (`FR-EXP-024`, `FR-EXP-045`).
 */
import { describe, expect, it } from 'vitest';
import {
  agentFail,
  agentOk,
  type AgentDescriptor,
  type AgentFailureReason,
  type AgentGateway,
} from '@pmi/agent-contract';
import {
  ExecutionProviderError,
  GENERATION_EGRESS_PROFILE,
  type ExecutionRequest,
  type ExecutionSession,
  type ProjectExecutionEnvironment,
} from '@pmi/execution-contract';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { agentRunners, unboundRuntime, type AgentRuntime } from '../../src/modules/experts/adapters/runners.adapter.js';

const descriptor = (over: Partial<AgentDescriptor> = {}): AgentDescriptor => ({
  name: 'agent-a',
  provider: 'provider-a',
  model: 'model-a',
  executionType: 'headless',
  capabilities: ['execute', 'test'],
  contextLimitTokens: 100_000,
  toolCapabilities: [],
  supportsMcp: false,
  repositoryCapabilities: ['read'],
  securityClassification: 'internal',
  supportsUnattended: true,
  ...over,
});

function gateway(d: AgentDescriptor, result: () => ReturnType<AgentGateway['execute']>, ran: string[] = []): AgentGateway {
  return {
    descriptor: d,
    getCapabilities: () => d,
    healthCheck: async () => agentOk({ reachable: true }, d) as never,
    async execute(invocation, session) {
      ran.push(`${d.name}: ${invocation.command} in ${(session as { id?: string }).id}`);
      return result();
    },
  };
}

function environment(options: { failStart?: ExecutionProviderError } = {}) {
  const started: ExecutionRequest[] = [];
  const stopped: string[] = [];
  let n = 0;
  const env: ProjectExecutionEnvironment = {
    descriptor: {
      provider: 'env-a',
      kind: 'managed-isolated',
      supportedLifecycles: ['ephemeral'],
      supportsPersistentState: false,
      supportsNetworkPolicy: true,
      maxWallClockMs: 900_000,
    },
    async start(request) {
      if (options.failStart) throw options.failStart;
      started.push(request);
      return { id: `session_${++n}` } as unknown as ExecutionSession;
    },
    async stop(session) {
      stopped.push((session as unknown as { id: string }).id);
    },
  };
  return { env, started, stopped };
}

const sessionTemplate: AgentRuntime['session'] = {
  lifecycle: 'ephemeral',
  image: 'image-a',
  env: {},
  workspace: { kind: 'ephemeral', scratchPath: '/workspace' },
  egressProfile: GENERATION_EGRESS_PROFILE,
  credentials: [],
  resourceLimits: { cpus: 1, memoryMb: 1024, pids: 128, wallClockMs: 600_000 },
};

const invocation = { capability: 'test' as const, command: 'implement: write the tests' };
const ctx = (over: Partial<{ timeoutMs: number; signal: AbortSignal }> = {}) => ({
  correlationId: 'exe_1',
  timeoutMs: 60_000,
  ...over,
});

describe('T2565 · gatewaysFor selects composed gateways by the model they declare', () => {
  it('returns a runner for each gateway naming the model, and none for another model', async () => {
    const { env } = environment();
    const runners = agentRunners({
      gateways: [
        gateway(descriptor({ name: 'a1', model: 'model-a' }), async () => agentOk({ exitCode: 0, stdout: '' }, descriptor())),
        gateway(descriptor({ name: 'b1', model: 'model-b' }), async () => agentOk({ exitCode: 0, stdout: '' }, descriptor())),
        gateway(descriptor({ name: 'a2', model: 'model-a' }), async () => agentOk({ exitCode: 0, stdout: '' }, descriptor())),
      ],
      environment: env,
      session: sessionTemplate,
    });
    expect((await runners.gatewaysFor('model-a')).map((r) => r.descriptor.name)).toEqual(['a1', 'a2']);
    expect((await runners.gatewaysFor('model-b')).map((r) => r.descriptor.name)).toEqual(['b1']);
    expect(await runners.gatewaysFor('model-c')).toEqual([]);
  });

  it("a runner's descriptor is the gateway's own — dispatch selects on what the provider declares", async () => {
    const d = descriptor({ enforceableLimits: ['time', 'tokens'] });
    const { env } = environment();
    const [runner] = await agentRunners({ gateways: [gateway(d, async () => agentOk({ exitCode: 0, stdout: '' }, descriptor()))], environment: env, session: sessionTemplate }).gatewaysFor('model-a');
    expect(runner!.descriptor).toBe(d);
  });
});

describe('T2565 · a run starts a session, executes in it, and always stops it', () => {
  it('starts an ephemeral session from the template with the run\'s timeout and signal, executes, and stops it', async () => {
    const { env, started, stopped } = environment();
    const ran: string[] = [];
    const signal = new AbortController().signal;
    const [runner] = await agentRunners({
      gateways: [gateway(descriptor(), async () => agentOk({ exitCode: 0, stdout: 'done' }, descriptor()), ran)],
      environment: env,
      session: sessionTemplate,
    }).gatewaysFor('model-a');
    const report = await runner!.run(invocation, ctx({ timeoutMs: 30_000, signal }));
    expect(started).toEqual([{ ...sessionTemplate, timeoutMs: 30_000, signal }]);
    expect(ran).toEqual(['agent-a: implement: write the tests in session_1']);
    expect(stopped).toEqual(['session_1']);
    expect(report.status).toBe('succeeded');
  });

  it('stops the session when execute throws, and the throw reaches the caller', async () => {
    const { env, stopped } = environment();
    const [runner] = await agentRunners({
      gateways: [gateway(descriptor(), async () => { throw new Error('gateway crashed'); })],
      environment: env,
      session: sessionTemplate,
    }).gatewaysFor('model-a');
    await expect(runner!.run(invocation, ctx())).rejects.toThrow(/gateway crashed/);
    expect(stopped).toEqual(['session_1']);
  });

  it('a session that cannot start is a fault naming the provider and why — nothing ran, so nothing reports', async () => {
    const { env } = environment({ failStart: new ExecutionProviderError('policy_refused', 'egress network missing') });
    const ran: string[] = [];
    const [runner] = await agentRunners({
      gateways: [gateway(descriptor(), async () => agentOk({ exitCode: 0, stdout: '' }, descriptor()), ran)],
      environment: env,
      session: sessionTemplate,
    }).gatewaysFor('model-a');
    await expect(runner!.run(invocation, ctx())).rejects.toThrow(/env-a.*policy_refused.*egress network missing/);
    expect(ran).toEqual([]);
  });
});

describe('T2565 · what a run reports', () => {
  const reportFor = async (outcome: () => ReturnType<AgentGateway['execute']>) => {
    const { env } = environment();
    const [runner] = await agentRunners({ gateways: [gateway(descriptor(), outcome)], environment: env, session: sessionTemplate }).gatewaysFor('model-a');
    return runner!.run(invocation, ctx());
  };

  it.each<[AgentFailureReason, string]>([
    ['timeout', 'timed_out'],
    ['cancelled', 'cancelled'],
    ['agent_error', 'failed'],
    ['empty_output', 'failed'],
    ['agent_unavailable', 'failed'],
  ])('a %s failure is %s', async (reason, status) => {
    expect((await reportFor(async () => agentFail(reason, 'no'))).status).toBe(status);
  });

  it('leaves tool calls and consumption unreported, never zero', async () => {
    const report = await reportFor(async () => agentOk({ exitCode: 0, stdout: 'done' }, descriptor()));
    expect(report).not.toHaveProperty('toolCalls');
    expect(report).not.toHaveProperty('consumption');
    expect(report.outputs).toEqual([]);
  });
});

describe('T2565 · with no runtime composed, gateways refuse naming why', () => {
  it('refuses 503 naming ExpertGateways and DEF-047-002', async () => {
    const refusing = unboundRuntime();
    await expect(refusing.gatewaysFor('model-a')).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    await expect(refusing.gatewaysFor('model-a')).rejects.toThrow(/ExpertGateways is not bound.*DEF-047-002/);
  });
});
