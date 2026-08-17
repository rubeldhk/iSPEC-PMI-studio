/**
 * T558 — `SpecKitEngine` takes an injected agent and names no provider.
 *
 * This is the seam `C-19` recorded as CRITICAL: the adapter hardcoded `claude`
 * in four places, so *"swapping the AI provider and swapping the specification
 * engine were the same edit"* — the merge Native §3 forbids.
 *
 * `agent-independence.spec.ts` (T560) asserts the string is gone by scanning the
 * tree. These assertions are about BEHAVIOUR: that the engine actually asks the
 * agent, and asks it in a way that works for an agent nobody has written yet.
 */
import { describe, expect, it, vi } from 'vitest';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import type { AgentGateway } from '@pmi/agent-contract';
import { SpecKitEngine, type ContainerRuntime, type SandboxSession } from '../../src/speckit.adapter.js';
import type { WorkspaceFileSystem } from '../../src/workspace.js';

/**
 * T575 — the engine now takes a ProjectExecutionEnvironment, which carries a
 * descriptor. Fakes declare one so the port is honoured rather than cast away.
 */
const ENV_DESCRIPTOR = {
  provider: 'fake',
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 900_000,
} as const;

const DESCRIPTOR = {
  name: 'speckit',
  version: '1.0.0',
  capabilities: ['generate_specification', 'generate_tasks', 'validate_specification'] as const,
};

const SPEC = ['# Feature Specification: Apollo', '', '## Requirements', '', '- **FR-001**: MUST x', ''].join('\n');

/** Records every command the engine runs, and serves a readable spec back. */
function environment(): ContainerRuntime & { commands: string[][] } {
  const commands: string[][] = [];
  const session: SandboxSession = {
    exec: async (command) => {
      commands.push([...command]);
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    writeFile: async () => undefined,
    listFiles: async () => ['specs/001-apollo/spec.md'],
    readFile: async () => SPEC,
  };
  return {
    commands,
    descriptor: ENV_DESCRIPTOR,
    start: async () => session,
    stop: async () => undefined,
  };
}

const fileSystem: WorkspaceFileSystem = {
  makeTempDirectory: async () => '/tmp/pmi-test',
  removeDirectory: async () => undefined,
};

function engine(agent: AgentGateway, onAgentRun?: (r: unknown) => void) {
  return new SpecKitEngine({
    descriptor: { ...DESCRIPTOR, capabilities: [...DESCRIPTOR.capabilities] },
    environment: environment(),
    agent,
    fileSystem,
    aiProviderToken: 'sk-test-not-real',
    ...(onAgentRun ? { onAgentRun: onAgentRun as never } : {}),
  });
}

const ctx = () => ({
  correlationId: '00000000-0000-4000-8000-000000000000',
  signal: new AbortController().signal,
  timeoutMs: 5_000,
});

const input = {
  projectName: 'Apollo',
  requirements: [{ reference: 'FR-001', type: 'functional', priority: 'must', description: 'x' }],
};

describe('T558 · the engine delegates reasoning to the injected agent', () => {
  it('calls the agent rather than running a provider command itself', async () => {
    const agent = new FixtureAgent();
    const spy = vi.spyOn(agent, 'execute');

    await engine(agent).generateSpecification(input as never, ctx());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0].capability).toBe('generate');
  });

  it('passes the same session the engine started, not one of its own', async () => {
    // The agent does NOT create environments — that separation is the whole
    // reason the two contracts exist.
    const agent = new FixtureAgent();
    const spy = vi.spyOn(agent, 'execute');

    await engine(agent).generateSpecification(input as never, ctx());

    expect(spy.mock.calls[0]?.[1]).toHaveProperty('exec');
  });

  it('carries the correlation id across the agent boundary (PC-3)', async () => {
    const agent = new FixtureAgent();
    const spy = vi.spyOn(agent, 'execute');

    await engine(agent).generateSpecification(input as never, ctx());

    expect(spy.mock.calls[0]?.[2].correlationId).toBe('00000000-0000-4000-8000-000000000000');
  });
});

describe('T558 · the Spec Kit integration name comes from the agent', () => {
  it('scaffolds with the agent-supplied name, never a literal', async () => {
    const rt = environment();
    const agent = new FixtureAgent();
    await new SpecKitEngine({
      descriptor: { ...DESCRIPTOR, capabilities: [...DESCRIPTOR.capabilities] },
      environment: rt,
      agent,
      fileSystem,
      aiProviderToken: 'sk-test-not-real',
    }).generateSpecification(input as never, ctx());

    const init = rt.commands.find((c) => c[0] === 'specify');
    expect(init).toBeDefined();
    expect(init).toContain('--integration');
    // The fixture declares `fixture`. If this were hardcoded it would say claude.
    expect(init?.[init.indexOf('--integration') + 1]).toBe('fixture');
  });

  it('changes with the agent — the acceptance criterion for provider independence', async () => {
    const rt = environment();
    const renamed = new FixtureAgent({ descriptor: { specKitIntegrationName: 'somethingelse' } });
    await new SpecKitEngine({
      descriptor: { ...DESCRIPTOR, capabilities: [...DESCRIPTOR.capabilities] },
      environment: rt,
      agent: renamed,
      fileSystem,
      aiProviderToken: 'sk-test-not-real',
    }).generateSpecification(input as never, ctx());

    const init = rt.commands.find((c) => c[0] === 'specify');
    expect(init?.[init.indexOf('--integration') + 1]).toBe('somethingelse');
  });

  it('refuses an agent that declares no integration name, naming the agent', async () => {
    // Better than silently passing `undefined` into a CLI flag, which would
    // fail deep inside the container with an unrelated message.
    const nameless = new FixtureAgent({ descriptor: { specKitIntegrationName: undefined } });
    const r = await engine(nameless).generateSpecification(input as never, ctx());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.reason).toBe('engine_error');
  });
});

describe('T558 · the agent failure taxonomy maps onto the engine taxonomy', () => {
  it.each([
    ['cancelled', 'cancelled'],
    ['timeout', 'timeout'],
    ['malformed_output', 'malformed_output'],
    ['empty_output', 'empty_output'],
    ['agent_unavailable', 'engine_unavailable'],
    ['agent_error', 'engine_error'],
    ['capability_unsupported', 'engine_error'],
  ] as const)('agent %s becomes engine %s', async (agentReason, engineReason) => {
    // Cancellation and timeout are carried across UNCHANGED. Collapsing them is
    // the defect EPIC-001 shipped, where systemic timeouts were counted as
    // ordinary user cancellations.
    //
    // Driven by a stub rather than the fixture: the mapping under test is the
    // ENGINE's, and the fixture deliberately routes `agent_unavailable` through
    // `healthCheck` only, so it cannot produce every reason from `execute`.
    const failing: AgentGateway = {
      descriptor: new FixtureAgent().descriptor,
      getCapabilities: () => new FixtureAgent().descriptor,
      healthCheck: async () => ({ ok: true, value: { reachable: true }, producedBy: new FixtureAgent().descriptor }),
      execute: async () => ({
        ok: false,
        failure: { reason: agentReason, message: `injected ${agentReason}` },
      }),
    };
    const r = await engine(failing).generateSpecification(input as never, ctx());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.reason).toBe(engineReason);
  });
});
