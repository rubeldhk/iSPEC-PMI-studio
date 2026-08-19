/**
 * T556 — the fixture agent against the shared conformance suite.
 *
 * The suite itself moved to `@pmi/agent-contract/conformance` under `T565`, so
 * that `ClaudeAgent` runs the identical cases. A suite that lives inside one
 * adapter and is driven by that adapter's constructor options can only ever
 * test that adapter — which is the opposite of what a conformance suite is for.
 *
 * Fixture-specific behaviour that is NOT part of the contract — the injected
 * `failWith` knob — is asserted below the suite call.
 */
import { describe, expect, it } from 'vitest';
import { runAgentConformanceSuite } from '@pmi/agent-contract/conformance';
import { AGENT_CAPABILITIES, isAgentFailure } from '@pmi/agent-contract';
import { FixtureAgent } from '../src/index.js';

runAgentConformanceSuite({
  name: 'fixture',
  create: (descriptor) => new FixtureAgent(descriptor ? { descriptor } : {}),
  // The fixture passes the command straight through.
  expectedSessionCommand: (command) => [command],
});

describe('the fixture proves the contract is agent-neutral', () => {
  it('declares every capability, so it can stand in for any adapter', () => {
    expect([...new FixtureAgent().descriptor.capabilities].sort()).toEqual(
      [...AGENT_CAPABILITIES].sort(),
    );
  });

  it('can be driven to every failure reason without a network call or a bill', async () => {
    const s = {
      exec: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      writeFile: async () => undefined,
      listFiles: async () => [],
      readFile: async () => '',
    };
    const r = await new FixtureAgent({ failWith: 'malformed_output' }).execute(
      { capability: 'generate', command: 'x' },
      s,
      { correlationId: '00000000-0000-4000-8000-000000000000', timeoutMs: 50 },
    );
    expect(isAgentFailure(r) && r.failure.reason).toBe('malformed_output');
  });
});
