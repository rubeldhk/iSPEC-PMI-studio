/**
 * T556 — the agent conformance suite.
 *
 * Four cases, and THREE of them are defects this repository has already shipped
 * (`R-028-4`). They are not hypothetical edge cases; they are the exact bugs the
 * EPIC-003 engine conformance suite found in its own author's adapter:
 *
 *   1. "addEventListener('abort') never fires on an already-aborted signal, so a
 *      cancellation arriving in a narrow window was missed — and the run then
 *      reported a TIMEOUT for what was a CANCELLATION."
 *   2. "The adapter waited for a hung step instead of self-terminating."
 *   3. "A bad correlation id was reported as engine_unavailable, disguising a
 *      wiring defect as an outage."
 *
 * `T045a` was written in EPIC-001 to prevent (1), and it recurred anyway in a
 * different component. This suite runs against EVERY registered adapter.
 */
import { describe, expect, it, vi } from 'vitest';
import { AGENT_CAPABILITIES, isAgentFailure, type AgentGateway } from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';
import { FixtureAgent } from '../src/index.js';

/** A session that records what it was asked to run. */
function session(exitCode = 0): ExecutionSession & { commands: string[][] } {
  const commands: string[][] = [];
  return {
    commands,
    exec: async (command) => {
      commands.push([...command]);
      return { exitCode, stdout: 'generated', stderr: '' };
    },
    writeFile: async () => undefined,
    listFiles: async () => [],
    readFile: async () => '',
  };
}

const ctx = (over: Partial<Parameters<AgentGateway['execute']>[2]> = {}) => ({
  correlationId: '00000000-0000-4000-8000-000000000000',
  timeoutMs: 50,
  ...over,
});

describe('agent conformance · the happy path', () => {
  it('runs the invocation and returns provenance', async () => {
    const s = session();
    const r = await new FixtureAgent().execute(
      { capability: 'generate', command: '/speckit-specify' },
      s,
      ctx(),
    );

    expect(isAgentFailure(r)).toBe(false);
    if (!isAgentFailure(r)) expect(r.producedBy.provider).toBe('fixture');
    expect(s.commands).toEqual([['/speckit-specify']]);
  });

  it('reports progress without blocking the caller', async () => {
    const onProgress = vi.fn();
    await new FixtureAgent().execute(
      { capability: 'generate', command: 'x' },
      session(),
      ctx({ onProgress }),
    );
    expect(onProgress.mock.calls.map((c) => c[0])).toEqual(['agent_started', 'agent_finished']);
  });
});

describe('agent conformance · C1 — an already-aborted signal is CANCELLED, never TIMEOUT', () => {
  it('refuses before starting', async () => {
    // The defect T045a was written to prevent, which recurred in EPIC-003.
    const r = await new FixtureAgent().execute(
      { capability: 'generate', command: 'x' },
      session(),
      ctx({ signal: AbortSignal.abort() }),
    );

    expect(isAgentFailure(r)).toBe(true);
    if (isAgentFailure(r)) expect(r.failure.reason).toBe('cancelled');
  });

  it('does no session work at all', async () => {
    const s = session();
    await new FixtureAgent().execute(
      { capability: 'generate', command: 'x' },
      s,
      ctx({ signal: AbortSignal.abort() }),
    );
    expect(s.commands).toEqual([]);
  });
});

describe('agent conformance · C2 — a hung step self-terminates at the wall clock', () => {
  it('produces timeout rather than waiting forever', async () => {
    const r = await new FixtureAgent({ hang: true }).execute(
      { capability: 'generate', command: 'x' },
      session(),
      ctx({ timeoutMs: 20 }),
    );

    expect(isAgentFailure(r)).toBe(true);
    if (isAgentFailure(r)) expect(r.failure.reason).toBe('timeout');
  });

  it('a cancellation DURING a hung step is still cancelled, not timeout', async () => {
    const controller = new AbortController();
    const promise = new FixtureAgent({ hang: true }).execute(
      { capability: 'generate', command: 'x' },
      session(),
      ctx({ timeoutMs: 5_000, signal: controller.signal }),
    );
    controller.abort();
    const r = await promise;

    expect(isAgentFailure(r) && r.failure.reason).toBe('cancelled');
  });
});

describe('agent conformance · C3 — failures are classified, not lumped together', () => {
  it('a non-zero exit is agent_error, not agent_unavailable', async () => {
    // Reporting a code fault as an outage sends an operator to check the
    // runtime for a bug that is in the adapter.
    const r = await new FixtureAgent().execute(
      { capability: 'generate', command: 'x' },
      session(3),
      ctx(),
    );
    expect(isAgentFailure(r) && r.failure.reason).toBe('agent_error');
  });

  it('keeps stderr in diagnostics, never in the user-facing message (PC-3)', async () => {
    const r = await new FixtureAgent().execute(
      { capability: 'generate', command: 'x' },
      session(3),
      ctx(),
    );
    if (isAgentFailure(r)) expect(r.failure.message).not.toContain('stderr');
  });

  it('an unreachable agent is agent_unavailable', async () => {
    const r = await new FixtureAgent({ failWith: 'agent_unavailable' }).healthCheck();
    expect(isAgentFailure(r) && r.failure.reason).toBe('agent_unavailable');
  });
});

describe('agent conformance · C4 — capability and context are refused pre-flight (E7)', () => {
  it('refuses a capability the agent does not declare, naming it', async () => {
    const limited = new FixtureAgent({ descriptor: { capabilities: ['analyze'] } });
    const s = session();
    const r = await limited.execute({ capability: 'generate', command: 'x' }, s, ctx());

    expect(isAgentFailure(r) && r.failure.reason).toBe('capability_unsupported');
    if (isAgentFailure(r)) expect(r.failure.message).toContain('generate');
    expect(s.commands, 'a refused run must cost nothing').toEqual([]);
  });

  it('refuses an over-limit context before any session work', async () => {
    const small = new FixtureAgent({ descriptor: { contextLimitTokens: 10 } });
    const s = session();
    const r = await small.execute(
      { capability: 'generate', command: 'x', estimatedInputTokens: 5_000 },
      s,
      ctx(),
    );

    expect(isAgentFailure(r) && r.failure.reason).toBe('context_limit_exceeded');
    expect(s.commands).toEqual([]);
  });
});

describe('agent conformance · the fixture proves the contract is agent-neutral', () => {
  it('declares every capability, so it can stand in for any adapter', () => {
    expect([...new FixtureAgent().descriptor.capabilities].sort()).toEqual(
      [...AGENT_CAPABILITIES].sort(),
    );
  });

  it('carries specKitIntegrationName — the field that de-hardcodes the engine', () => {
    expect(new FixtureAgent().descriptor.specKitIntegrationName).toBe('fixture');
  });
});
