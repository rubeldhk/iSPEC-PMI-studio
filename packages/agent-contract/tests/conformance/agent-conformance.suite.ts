/**
 * T556 / T565 — the shared agent conformance suite.
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
 * different component. This suite runs against EVERY registered adapter, which
 * is the whole reason it is a shared function rather than a spec file.
 *
 * **Why it moved here (T565).** It was written inside `agent-adapters/fixture`
 * and driven by `FixtureAgent`'s constructor options — `{ hang: true }`,
 * `{ failWith }`. `ClaudeAgent` has no such knobs, so the suite could not run
 * against the one adapter that talks to a real provider. Mirrors
 * `@pmi/engine-contract/conformance`.
 *
 * **The hang case now hangs for real.** The old version simulated it with a
 * constructor flag, which proved an adapter *could* report a timeout, not that
 * it *does* when a step wedges. The session below genuinely never resolves.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionSession } from '@pmi/execution-contract';
import {
  AGENT_CAPABILITIES,
  isAgentFailure,
  type AgentCapability,
  type AgentDescriptor,
  type AgentGateway,
} from '../../src/index.js';

export interface AgentConformanceTarget {
  /** Names the describe blocks, so a failure says which adapter broke. */
  readonly name: string;
  /**
   * Build the adapter, optionally overriding its descriptor.
   *
   * The override exists for the capability and context-limit cases (C4). An
   * adapter that cannot be built with a restricted descriptor cannot be proven
   * to refuse pre-flight, so this is required rather than optional.
   */
  create(descriptor?: Partial<AgentDescriptor>): AgentGateway;
  /** What the adapter is expected to hand the session for a given command. */
  expectedSessionCommand(command: string): string[];
}

/** A session that records what it was asked to run. */
export function recordingSession(
  exitCode = 0,
  stderr = 'boom: sk-live-secret',
): ExecutionSession & { commands: string[][] } {
  const commands: string[][] = [];
  return {
    commands,
    exec: async (command) => {
      commands.push([...command]);
      return { exitCode, stdout: 'generated', stderr };
    },
    writeFile: async () => undefined,
    listFiles: async () => [],
    readFile: async () => '',
  };
}

/** A session whose `exec` never settles. The real hung-step condition. */
export function hangingSession(): ExecutionSession & { commands: string[][] } {
  const commands: string[][] = [];
  return {
    commands,
    exec: async (command) => {
      commands.push([...command]);
      return new Promise(() => {
        /* never resolves — this is the point */
      });
    },
    writeFile: async () => undefined,
    listFiles: async () => [],
    readFile: async () => '',
  };
}

export function runAgentConformanceSuite(target: AgentConformanceTarget): void {
  const ctx = (over: Partial<Parameters<AgentGateway['execute']>[2]> = {}) => ({
    correlationId: '00000000-0000-4000-8000-000000000000',
    timeoutMs: 50,
    ...over,
  });

  describe(`agent conformance [${target.name}] · the happy path`, () => {
    it('runs the invocation and returns provenance', async () => {
      const s = recordingSession();
      const r = await target
        .create()
        .execute({ capability: 'generate', command: '/speckit-specify' }, s, ctx());

      expect(isAgentFailure(r)).toBe(false);
      if (!isAgentFailure(r)) expect(r.producedBy.provider).toBeTruthy();
      expect(s.commands).toEqual([target.expectedSessionCommand('/speckit-specify')]);
    });

    it('reports progress without blocking the caller', async () => {
      const onProgress = vi.fn();
      await target
        .create()
        .execute({ capability: 'generate', command: 'x' }, recordingSession(), ctx({ onProgress }));
      expect(onProgress.mock.calls.map((c) => c[0])).toEqual(['agent_started', 'agent_finished']);
    });
  });

  describe(`agent conformance [${target.name}] · C1 — an already-aborted signal is CANCELLED, never TIMEOUT`, () => {
    it('refuses before starting', async () => {
      // The defect T045a was written to prevent, which recurred in EPIC-003.
      const r = await target
        .create()
        .execute({ capability: 'generate', command: 'x' }, recordingSession(), ctx({
          signal: AbortSignal.abort(),
        }));

      expect(isAgentFailure(r)).toBe(true);
      if (isAgentFailure(r)) expect(r.failure.reason).toBe('cancelled');
    });

    it('does no session work at all', async () => {
      const s = recordingSession();
      await target
        .create()
        .execute({ capability: 'generate', command: 'x' }, s, ctx({ signal: AbortSignal.abort() }));
      expect(s.commands).toEqual([]);
    });
  });

  describe(`agent conformance [${target.name}] · C2 — a hung step self-terminates at the wall clock`, () => {
    it('produces timeout rather than waiting forever', async () => {
      // A session that genuinely never resolves. An adapter that awaits it
      // directly hangs the whole job past its own limit.
      const r = await target
        .create()
        .execute({ capability: 'generate', command: 'x' }, hangingSession(), ctx({ timeoutMs: 20 }));

      expect(isAgentFailure(r)).toBe(true);
      if (isAgentFailure(r)) expect(r.failure.reason).toBe('timeout');
    });

    it('a cancellation DURING a hung step is still cancelled, not timeout', async () => {
      const controller = new AbortController();
      const promise = target
        .create()
        .execute({ capability: 'generate', command: 'x' }, hangingSession(), ctx({
          timeoutMs: 5_000,
          signal: controller.signal,
        }));
      controller.abort();

      const r = await promise;
      expect(isAgentFailure(r) && r.failure.reason).toBe('cancelled');
    });
  });

  describe(`agent conformance [${target.name}] · C3 — failures are classified, not lumped together`, () => {
    it('a non-zero exit is agent_error, not agent_unavailable', async () => {
      // Reporting a code fault as an outage sends an operator to check the
      // runtime for a bug that is in the adapter.
      const r = await target
        .create()
        .execute({ capability: 'generate', command: 'x' }, recordingSession(3), ctx());
      expect(isAgentFailure(r) && r.failure.reason).toBe('agent_error');
    });

    it('keeps stderr out of the user-facing message (PC-3)', async () => {
      const r = await target
        .create()
        .execute({ capability: 'generate', command: 'x' }, recordingSession(3), ctx());
      // The recording session's stderr carries a credential-shaped string on
      // purpose: this asserts it cannot reach a user-facing field.
      if (isAgentFailure(r)) expect(r.failure.message).not.toContain('sk-live-secret');
    });
  });

  describe(`agent conformance [${target.name}] · C4 — capability and context are refused pre-flight (E7)`, () => {
    it('refuses a capability the agent does not declare, naming it', async () => {
      const limited = target.create({ capabilities: ['analyze'] });
      const s = recordingSession();
      const r = await limited.execute({ capability: 'generate', command: 'x' }, s, ctx());

      expect(isAgentFailure(r) && r.failure.reason).toBe('capability_unsupported');
      if (isAgentFailure(r)) expect(r.failure.message).toContain('generate');
      expect(s.commands, 'a refused run must cost nothing').toEqual([]);
    });

    it('refuses an over-limit context before any session work', async () => {
      const small = target.create({ contextLimitTokens: 10 });
      const s = recordingSession();
      const r = await small.execute(
        { capability: 'generate', command: 'x', estimatedInputTokens: 5_000 },
        s,
        ctx(),
      );

      expect(isAgentFailure(r) && r.failure.reason).toBe('context_limit_exceeded');
      expect(s.commands).toEqual([]);
    });
  });

  describe(`agent conformance [${target.name}] · the descriptor is complete (FR-AGT-002)`, () => {
    it('declares a capability set drawn from the contract', () => {
      const caps: readonly AgentCapability[] = target.create().descriptor.capabilities;
      expect(caps.length).toBeGreaterThan(0);
      for (const c of caps) expect(AGENT_CAPABILITIES).toContain(c);
    });

    it('names its provider, model and execution type', () => {
      const d = target.create().descriptor;
      expect(d.provider).toBeTruthy();
      expect(d.model).toBeTruthy();
      expect(['headless', 'interactive']).toContain(d.executionType);
    });
  });
}
