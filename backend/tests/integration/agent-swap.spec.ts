/**
 * T561 — one agent-agnostic caller, two adapters, identical behaviour.
 *
 * The acceptance test for User Story 1 and for `SC-AGT-002`. It is the `V11`
 * pattern EPIC-003 proved for engines, applied to the axis the amendment cares
 * about: *"PMI Studio SHALL NOT depend architecturally on a single AI
 * provider"* (Plan Amendment §4).
 *
 * The caller here is `SpecKitEngine` — genuinely agent-agnostic since `T566`.
 * It is constructed once per adapter with everything else identical, so any
 * difference in the results is attributable to the agent and nothing else.
 *
 * **Why this file may import adapters.** `backend/**` must never reference a
 * concrete engine or agent (FR-017, FR-AGT-004, ADR-0001), enforced by ESLint
 * and by `agent-independence.spec.ts`. This file is the single scoped exception,
 * exactly as `engine-swap.spec.ts` is for engines: a test that proves provider
 * independence cannot be written without touching two providers, and proving it
 * is the opposite of breaching it.
 */
import { describe, expect, it } from 'vitest';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import { ClaudeAgent } from '@pmi/agent-adapter-claude';
import type { AgentExecutionRecord, AgentGateway } from '@pmi/agent-contract';
import {
  SpecKitEngine,
  type ContainerRuntime,
  type SandboxSession,
} from '@pmi/engine-adapter-speckit';

const SPEC = ['# Feature Specification: Apollo', '', '## Requirements', '', '- **FR-001**: MUST x', ''].join('\n');

function runtime(exitCode = 0): ContainerRuntime & { commands: string[][] } {
  const commands: string[][] = [];
  const session: SandboxSession = {
    exec: async (command) => {
      commands.push([...command]);
      // Only the AGENT's own invocation is failed, so the five engine steps
      // still run and the two adapters are compared on the same ground.
      const isAgentCommand = command[0] !== 'git' && command[0] !== 'specify';
      return { exitCode: isAgentCommand ? exitCode : 0, stdout: SPEC, stderr: 'diagnostic detail' };
    },
    writeFile: async () => undefined,
    listFiles: async () => ['specs/001-apollo/spec.md'],
    readFile: async () => SPEC,
  };
  return { commands, start: async () => session, stop: async () => undefined };
}

const fileSystem = {
  makeTempDirectory: async () => '/tmp/pmi-agent-swap',
  removeDirectory: async () => undefined,
};

const ctx = () => ({
  correlationId: '00000000-0000-4000-8000-000000000000',
  signal: new AbortController().signal,
  timeoutMs: 5_000,
});

const input = {
  projectName: 'Apollo',
  requirements: [{ reference: 'FR-001', type: 'functional', priority: 'must', description: 'x' }],
};

function engineWith(agent: AgentGateway, exitCode = 0) {
  const records: AgentExecutionRecord[] = [];
  const rt = runtime(exitCode);
  const engine = new SpecKitEngine({
    descriptor: {
      name: 'speckit',
      version: '1.0.0',
      capabilities: ['generate_specification', 'generate_tasks', 'validate_specification'],
    },
    runtime: rt,
    agent,
    fileSystem,
    aiProviderToken: 'sk-test-not-real',
    onAgentRun: (r) => records.push(r),
  });
  return { engine, records, runtime: rt };
}

/** The two adapters, driven identically. */
const ADAPTERS: readonly [string, () => AgentGateway, string][] = [
  ['fixture', () => new FixtureAgent(), 'fixture'],
  ['claude', () => new ClaudeAgent(), 'anthropic'],
];

describe('T561 · the same caller runs against both adapters (SC-AGT-002)', () => {
  it.each(ADAPTERS)('%s produces a specification', async (_name, make) => {
    const { engine } = engineWith(make());
    const result = await engine.generateSpecification(input as never, ctx());

    expect(result.ok, 'the engine failed for this adapter').toBe(true);
    if (result.ok) expect(result.value.title).toContain('Apollo');
  });

  it('produces the identical result SHAPE from both', async () => {
    const [a, b] = await Promise.all(
      ADAPTERS.map(async ([, make]) => {
        const { engine } = engineWith(make());
        return engine.generateSpecification(input as never, ctx());
      }),
    );

    expect(a?.ok).toBe(b?.ok);
    if (a?.ok && b?.ok) {
      expect(Object.keys(a.value).sort()).toEqual(Object.keys(b.value).sort());
      // The engine's own provenance is unchanged by which agent reasoned:
      // the engine is still Spec Kit.
      expect(a.producedBy).toEqual(b.producedBy);
    }
  });

  it('records DISTINCT provenance — which is the whole point', async () => {
    for (const [, make, expectedProvider] of ADAPTERS) {
      const { engine, records } = engineWith(make());
      await engine.generateSpecification(input as never, ctx());

      expect(records).toHaveLength(1);
      expect(records[0]?.provider).toBe(expectedProvider);
    }
  });

  it('classifies an identical failure identically', async () => {
    // Same session condition, same engine, different agent. A difference here
    // would mean the taxonomy is adapter-specific, which makes it useless for
    // routing or for metrics.
    const reasons: string[] = [];
    for (const [, make] of ADAPTERS) {
      const { engine } = engineWith(make(), 7);
      const result = await engine.generateSpecification(input as never, ctx());
      expect(result.ok).toBe(false);
      if (!result.ok) reasons.push(result.failure.reason);
    }
    expect(new Set(reasons).size, `adapters disagreed: ${reasons.join(' vs ')}`).toBe(1);
  });

  it('scaffolds Spec Kit with each agent\'s own integration name', async () => {
    // `--integration` used to be the literal `claude`. It now comes from the
    // descriptor, so it differs per adapter — the observable proof the string
    // left the engine.
    const names: (string | undefined)[] = [];
    for (const [, make] of ADAPTERS) {
      const { engine, runtime: rt } = engineWith(make());
      await engine.generateSpecification(input as never, ctx());
      const init = rt.commands.find((c) => c[0] === 'specify');
      names.push(init?.[init.indexOf('--integration') + 1]);
    }
    expect(names).toEqual(['fixture', 'claude']);
  });
});

describe('T561 · swapping the agent requires no change to the caller', () => {
  it('constructs both engines from the same options but for the agent', async () => {
    // If this test ever needs an `if (agent.name === ...)` branch, provider
    // independence has been lost and the epic's premise with it.
    const source = engineWith.toString();
    expect(source).not.toMatch(/claude|anthropic|fixture/i);
  });
});
