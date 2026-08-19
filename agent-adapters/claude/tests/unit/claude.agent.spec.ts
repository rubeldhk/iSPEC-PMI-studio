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
    // T693/DEF-028-004 — the CLI is still driven headlessly with `-p`; what
    // changed is that the credential it reads is bound first.
    const argv = invocationFor('/speckit-specify');
    expect(argv[2] ?? '').toContain('claude --model "$1" -p "$2"');
    expect(argv).toContain('/speckit-specify');
  });

  it('requests the model the descriptor names (T694)', () => {
    // DEF-028-005. The descriptor advertised `claude-opus-5` and the invocation
    // never passed `--model`, so the CLI used its own pinned default —
    // `claude-sonnet-4-20250514`, long retired, which the API answers with 404.
    //
    // The 404 is the smaller half. FR-022 requires the model to be recorded on
    // every artifact, and a descriptor that names one model while the run
    // requests another makes every provenance record wrong in a way nothing
    // could detect: both halves are internally consistent and disagree only with
    // reality.
    const argv = invocationFor('/x', 'claude-opus-5');
    // Positionally, like the command: the model is data, not script text.
    expect(argv[2] ?? '').toContain('--model "$1"');
    expect(argv[4]).toBe('claude-opus-5');
  });

  it('asks for the model by full name, never by a moving alias', () => {
    // Verified against the image: `--model opus` resolves inside the pinned CLI
    // to `claude-opus-4-20250514` and 404s, while the full name succeeds. An
    // alias also makes the provenance record unfalsifiable — "opus" names
    // whatever was latest on the day, which is not a fact anyone can check later.
    expect(invocationFor('/x', 'claude-opus-5').join(' ')).not.toMatch(/--model (opus|sonnet)\b/);
  });

  it('records the same model it requested, so provenance is not a claim', async () => {
    const s = session();
    const agent = new ClaudeAgent();
    await agent.execute({ capability: 'generate', command: '/speckit-tasks' }, s, ctx());
    expect(s.commands[0]?.[4]).toBe(agent.descriptor.model);
  });

  it('binds ANTHROPIC_API_KEY from the token the sandbox already holds (T693)', () => {
    // The sandbox sets AI_PROVIDER_TOKEN and nothing else; Claude Code reads
    // ANTHROPIC_API_KEY. Nothing mapped between them, so the CLI exited 1 with
    // "Invalid API key" on every real run (DEF-028-004).
    //
    // The rename happens HERE, in the vendor-specific adapter, and not in
    // `buildSandboxEnvironment` — a provider-neutral sandbox that knows an
    // Anthropic variable name is a sandbox coupled to one vendor, which Native
    // §30 and FR-AGT-004 exist to prevent.
    const argv = invocationFor('/speckit-specify');
    expect(argv.join(' ')).toContain('ANTHROPIC_API_KEY="$AI_PROVIDER_TOKEN"');
  });

  it('never puts the credential VALUE on the command line', () => {
    // Only the variable NAME is written. The value is dereferenced inside the
    // container, so it cannot reach a process list, a log or a diagnostic.
    const argv = invocationFor('/speckit-specify');
    expect(argv.join(' ')).not.toMatch(/AI_PROVIDER_TOKEN=[^"$]/);
  });

  it('passes the command as an argument, never interpolated into the script', () => {
    // The command carries customer text. Interpolating it into a shell script
    // would make `"; rm -rf / #` a command rather than a string, so it is passed
    // positionally and referenced as "$1".
    const hostile = '/speckit-specify "; touch /tmp/pwned #';
    const argv = invocationFor(hostile);
    const script = argv[2] ?? '';
    expect(script).not.toContain('touch /tmp/pwned');
    expect(script).toContain('"$1"');
    expect(argv.at(-1)).toBe(hostile);
  });

  it('hands the session exactly that, and nothing else', async () => {
    // Asserted against `invocationFor` rather than a literal argv. The literal
    // was a second copy of the invocation, and when `T693` bound the credential
    // it was this test that disagreed — not the seam it was guarding. What
    // matters is that the session receives the adapter's invocation unchanged
    // and receives it once.
    const s = session();
    await new ClaudeAgent().execute({ capability: 'generate', command: '/speckit-tasks' }, s, ctx());
    expect(s.commands).toEqual([invocationFor('/speckit-tasks')]);
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
