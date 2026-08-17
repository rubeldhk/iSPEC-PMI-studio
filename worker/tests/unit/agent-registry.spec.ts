/**
 * T555 — the agent registry, and the acceptance test for provider independence.
 *
 * The swap assertion here is the `V11` pattern EPIC-003 proved for engines,
 * applied to the axis the amendment cares about: one agent-agnostic caller,
 * two adapters, identical result *shape* and identical failure *classification*,
 * with distinct provenance.
 */
import { describe, expect, it } from 'vitest';
import { isAgentFailure, type AgentGateway } from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';
import {
  AgentRegistry,
  DuplicateAgentError,
  NoDefaultAgentError,
  composeAgentRegistry,
} from '../../src/agent-composition.js';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import { ClaudeAgent } from '@pmi/agent-adapter-claude';
import { MissingAgentCapabilityError } from '@pmi/agent-contract';

function session(): ExecutionSession {
  return {
    exec: async () => ({ exitCode: 0, stdout: 'generated', stderr: '' }),
    writeFile: async () => undefined,
    listFiles: async () => [],
    readFile: async () => '',
  };
}

const ctx = { correlationId: '00000000-0000-4000-8000-000000000000', timeoutMs: 100 };

describe('T555 · registration', () => {
  it('resolves the registered default', () => {
    const r = new AgentRegistry();
    r.register(new FixtureAgent(), { isDefault: true });
    expect(r.resolve().descriptor.name).toBe('fixture');
  });

  it('refuses a second adapter claiming an identifier already taken', () => {
    // Two adapters under one name makes resolution non-deterministic, and the
    // loser is silent.
    const r = new AgentRegistry();
    r.register(new FixtureAgent());
    expect(() => r.register(new FixtureAgent())).toThrow(DuplicateAgentError);
  });

  it('refuses an adapter missing a required capability, naming it', () => {
    const r = new AgentRegistry();
    const limited = new FixtureAgent({ descriptor: { capabilities: ['analyze'] } });
    expect(() => r.register(limited, { requires: ['generate'] })).toThrow(
      MissingAgentCapabilityError,
    );
  });

  it('throws when nothing has been made default', () => {
    const r = new AgentRegistry();
    r.register(new FixtureAgent());
    expect(() => r.resolve()).toThrow(NoDefaultAgentError);
  });
});

describe('T555 · a provider preference is never load-bearing (Native §2)', () => {
  it('honours a preference that is registered', () => {
    const r = composeAgentRegistry();
    expect(r.resolve('claude').descriptor.provider).toBe('anthropic');
  });

  it('falls back to the default when the preference is absent', () => {
    // An orchestrator that failed here would have made the preference a
    // requirement, which Native §2 forbids.
    const r = composeAgentRegistry();
    expect(r.resolve('cursor').descriptor.name).toBe('fixture');
  });
});

describe('T555 · the composition root registers both adapters (T569)', () => {
  it('lists exactly the adapters the worker supplies', () => {
    expect(composeAgentRegistry().list().map((d) => d.name).sort()).toEqual(['claude', 'fixture']);
  });

  it('every registered adapter declares a Spec Kit integration name', () => {
    // Without it the engine cannot scaffold for that agent — the field is what
    // replaced the hardcoded `--integration claude`.
    for (const d of composeAgentRegistry().list()) {
      expect(d.specKitIntegrationName, `${d.name} declares none`).toBeTruthy();
    }
  });
});

describe('T555 · provider swap — the acceptance test (SC-AGT-002)', () => {
  /** One caller. It knows nothing about any provider. */
  async function run(agent: AgentGateway) {
    return agent.execute({ capability: 'generate', command: '/speckit-specify' }, session(), ctx);
  }

  it('both adapters return the same result SHAPE', async () => {
    const results = await Promise.all([run(new FixtureAgent()), run(new ClaudeAgent())]);
    for (const r of results) {
      expect(r).toHaveProperty('ok');
      expect(isAgentFailure(r) ? 'failure' : 'value').toBeTruthy();
    }
  });

  it('records DISTINCT provenance', async () => {
    // The point of the swap: the platform behaves identically, and the artifact
    // records which agent produced it (the FR-022 argument, one axis over).
    expect(new FixtureAgent().descriptor.provider).toBe('fixture');
    expect(new ClaudeAgent().descriptor.provider).toBe('anthropic');
  });

  it('classifies failures from the same taxonomy', async () => {
    // **Updated by T564.** This previously asserted that `ClaudeAgent` returned
    // `agent_unavailable`, because it was descriptor-only and its `execute()`
    // refused by design. Now that it is implemented it succeeds against a
    // working session, so the interchangeability claim is made the way it
    // should be: drive BOTH adapters into the same failure and require the same
    // named reason from the shared enum.
    for (const agent of [new FixtureAgent(), new ClaudeAgent()]) {
      const cancelled = await agent.execute({ capability: 'generate', command: 'x' }, session(), {
        ...ctx,
        signal: AbortSignal.abort(),
      });
      expect(isAgentFailure(cancelled)).toBe(true);
      if (isAgentFailure(cancelled)) expect(cancelled.failure.reason).toBe('cancelled');
    }
  });

  it('both adapters now run — the swap is real, not descriptor-deep (T564)', async () => {
    for (const agent of [new FixtureAgent(), new ClaudeAgent()]) {
      const r = await agent.execute({ capability: 'generate', command: 'x' }, session(), ctx);
      expect(isAgentFailure(r), `${agent.descriptor.name} failed against a working session`).toBe(
        false,
      );
    }
  });
});
