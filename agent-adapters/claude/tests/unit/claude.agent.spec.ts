/**
 * T557 — `ClaudeAgent` descriptor, invocation and failure mapping.
 *
 * The shared conformance suite (T565) proves this adapter obeys the contract.
 * These are the claims specific to *this* adapter: what it declares, what it
 * actually hands the session, and the two failure distinctions that a generic
 * suite cannot check because they depend on the invocation.
 */
import { describe, expect, it } from 'vitest';
import { isAgentFailure, type AgentContext } from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';
import { ClaudeAgent, CLAUDE_DESCRIPTOR, invocationFor } from '../../src/index.js';

const ctx = (over: Partial<AgentContext> = {}): AgentContext => ({
  correlationId: '00000000-0000-4000-8000-000000000000',
  timeoutMs: 100,
  ...over,
});

function session(
  over: { exitCode?: number; stdout?: string; stderr?: string } = {},
): ExecutionSession & { commands: string[][] } {
  const commands: string[][] = [];
  return {
    commands,
    exec: async (command) => {
      commands.push([...command]);
      return {
        exitCode: over.exitCode ?? 0,
        stdout: over.stdout ?? '# Specification\n',
        stderr: over.stderr ?? '',
      };
    },
    writeFile: async () => undefined,
    listFiles: async () => [],
    readFile: async () => '',
  };
}

describe('T557 · the descriptor (FR-AGT-002)', () => {
  it('names the provider and the model separately', () => {
    // `provider` is who is billed and who is trusted; `model` is what ran.
    // Collapsing them is what makes multi-model routing (D-30) impossible later.
    expect(CLAUDE_DESCRIPTOR.provider).toBe('anthropic');
    expect(CLAUDE_DESCRIPTOR.model).toBe('claude-opus-5');
  });

  it('carries the Spec Kit integration name, which is what removes the string from the engine', () => {
    expect(CLAUDE_DESCRIPTOR.specKitIntegrationName).toBe('claude');
  });

  it('declares an external security classification', () => {
    // It sends project content to a third party. Anything else would be false,
    // and this field is what a tenant policy will read.
    expect(CLAUDE_DESCRIPTOR.securityClassification).toBe('external');
  });

  it('declares every field Native §7 names', () => {
    for (const field of [
      'name',
      'provider',
      'model',
      'executionType',
      'capabilities',
      'contextLimitTokens',
      'toolCapabilities',
      'supportsMcp',
      'repositoryCapabilities',
      'securityClassification',
      'supportsUnattended',
    ] as const) {
      expect(CLAUDE_DESCRIPTOR[field], `descriptor is missing ${field}`).toBeDefined();
    }
  });

  it('can be overridden for testing without mutating the exported constant', () => {
    const limited = new ClaudeAgent({ descriptor: { capabilities: ['analyze'] } });
    expect(limited.descriptor.capabilities).toEqual(['analyze']);
    expect(CLAUDE_DESCRIPTOR.capabilities).toHaveLength(5);
  });
});

describe('T557 · the invocation', () => {
  it('runs the command headlessly through `claude -p`', () => {
    expect(invocationFor('/speckit-specify')).toEqual(['claude', '-p', '/speckit-specify']);
  });

  it('hands the session exactly that, and nothing else', async () => {
    const s = session();
    await new ClaudeAgent().execute({ capability: 'generate', command: '/speckit-tasks' }, s, ctx());
    expect(s.commands).toEqual([['claude', '-p', '/speckit-tasks']]);
  });

  it('returns the agent as the producer, so provenance names who reasoned', async () => {
    const r = await new ClaudeAgent().execute(
      { capability: 'generate', command: 'x' },
      session(),
      ctx(),
    );
    expect(isAgentFailure(r)).toBe(false);
    if (!isAgentFailure(r)) {
      expect(r.producedBy.provider).toBe('anthropic');
      expect(r.producedBy.model).toBe('claude-opus-5');
    }
  });
});

describe('T557 · failure mapping', () => {
  it('a non-zero exit is agent_error — the agent ran and failed', async () => {
    const r = await new ClaudeAgent().execute(
      { capability: 'generate', command: 'x' },
      session({ exitCode: 2 }),
      ctx(),
    );
    expect(isAgentFailure(r) && r.failure.reason).toBe('agent_error');
  });

  it('distinguishes empty output from a failed run', async () => {
    // Exit 0 with nothing produced is a different problem with a different fix
    // from a non-zero exit, and collapsing them hides which one happened.
    const r = await new ClaudeAgent().execute(
      { capability: 'generate', command: 'x' },
      session({ stdout: '   \n  ' }),
      ctx(),
    );
    expect(isAgentFailure(r) && r.failure.reason).toBe('empty_output');
  });

  it('keeps stderr in diagnostics and out of the user-facing message (PC-3)', async () => {
    const r = await new ClaudeAgent().execute(
      { capability: 'generate', command: 'x' },
      session({ exitCode: 1, stderr: 'AI_PROVIDER_TOKEN=sk-live-not-a-real-key' }),
      ctx(),
    );

    expect(isAgentFailure(r)).toBe(true);
    if (isAgentFailure(r)) {
      expect(r.failure.message).not.toContain('sk-live-not-a-real-key');
      expect(r.failure.diagnostics).toContain('sk-live-not-a-real-key');
    }
  });

  it('healthCheck does not claim reachability it cannot observe', async () => {
    // The agent runs inside a container that has not started. Any confident
    // answer from here would be a guess presented as a fact.
    const r = await new ClaudeAgent().healthCheck();
    expect(isAgentFailure(r)).toBe(false);
    if (!isAgentFailure(r)) expect(r.value.detail).toMatch(/R-028-5|execution session/i);
  });
});
