/**
 * `T2592` (EPIC-047) — the API takes its agent runtime from a composition root.
 * `DEF-047-002`, option A, Constitution XI Tier 1.
 *
 * `backend/src` may name no agent adapter or execution provider, so the runtime
 * an Expert run executes in is composed outside it — by `@pmi/api-launcher` —
 * and handed to `createApi`. These cases hold the seam both ways through the
 * composed application:
 *
 * - **No runtime handed in** — every existing composition of `AppModule`, and
 *   `main.ts` — still refuses, naming `DEF-047-002`. Nothing became permissive
 *   by default.
 * - **A runtime handed in** binds `ExpertGateways` to exactly its gateways, by
 *   the model each declares.
 *
 * No database: composition, not persistence.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { agentOk, type AgentDescriptor, type AgentGateway } from '@pmi/agent-contract';
import { GENERATION_EGRESS_PROFILE, type ExecutionSession, type ProjectExecutionEnvironment } from '@pmi/execution-contract';
import { createApi } from '../../src/api.js';
import { ExpertAgentRuntimeModule } from '../../src/composition/expert-agent-runtime.js';
import { ExpertsModule } from '../../src/modules/experts/experts.module.js';
import { EXPERT_PORTS, type ExpertPorts } from '../../src/modules/experts/experts.tokens.js';
import type { AgentRuntime } from '../../src/modules/experts/adapters/runners.adapter.js';

const descriptor = (name: string, model: string): AgentDescriptor => ({
  name,
  provider: 'composed',
  model,
  executionType: 'headless',
  capabilities: ['execute', 'test'],
  contextLimitTokens: 100_000,
  toolCapabilities: [],
  supportsMcp: false,
  repositoryCapabilities: ['read'],
  securityClassification: 'internal',
  supportsUnattended: true,
});

const gateway = (d: AgentDescriptor): AgentGateway => ({
  descriptor: d,
  getCapabilities: () => d,
  healthCheck: async () => agentOk({ reachable: true }, d) as never,
  execute: async () => agentOk({ exitCode: 0, stdout: '' }, d),
});

const environment: ProjectExecutionEnvironment = {
  descriptor: {
    provider: 'composed-env',
    kind: 'managed-isolated',
    supportedLifecycles: ['ephemeral'],
    supportsPersistentState: false,
    supportsNetworkPolicy: true,
    maxWallClockMs: 900_000,
  },
  start: async () => ({}) as ExecutionSession,
  stop: async () => undefined,
};

const runtime: AgentRuntime = {
  gateways: [gateway(descriptor('a1', 'model-x')), gateway(descriptor('b1', 'model-y')), gateway(descriptor('a2', 'model-x'))],
  environment,
  session: {
    lifecycle: 'ephemeral',
    image: 'composed-image',
    env: {},
    workspace: { kind: 'ephemeral', scratchPath: '/workspace' },
    egressProfile: GENERATION_EGRESS_PROFILE,
    credentials: [],
    resourceLimits: { cpus: 1, memoryMb: 1024, pids: 128, wallClockMs: 600_000 },
  },
};

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
}, 60_000);

const ports = (a: INestApplication): ExpertPorts => a.select(ExpertsModule).get<ExpertPorts>(EXPERT_PORTS, { strict: false });

describe('T2592 · the API takes its agent runtime from a composition root (DEF-047-002)', () => {
  it('with no runtime handed in, ExpertGateways still refuses, naming DEF-047-002', async () => {
    app = await createApi();
    await app.init();
    await expect(ports(app).gateways.gatewaysFor('model-x')).rejects.toThrow(/ExpertGateways is not bound.*DEF-047-002/);
  }, 300_000);

  it("with a runtime handed in, ExpertGateways offers exactly that runtime's gateways, by model", async () => {
    app = await createApi({ expertAgentRuntime: runtime });
    await app.init();
    const gateways = ports(app).gateways;
    expect((await gateways.gatewaysFor('model-x')).map((r) => r.descriptor.name)).toEqual(['a1', 'a2']);
    expect((await gateways.gatewaysFor('model-y')).map((r) => r.descriptor.name)).toEqual(['b1']);
    expect(await gateways.gatewaysFor('model-z')).toEqual([]);
  }, 300_000);

  it('the module that supplies it is global, so ExpertsModule sees it without importing it', () => {
    const supplied = ExpertAgentRuntimeModule.forRoot(runtime);
    expect(supplied.global).toBe(true);
    expect(supplied.module).toBe(ExpertAgentRuntimeModule);
  });
});
