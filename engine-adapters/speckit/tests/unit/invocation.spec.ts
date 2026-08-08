/**
 * T090a — the five-step invocation against a mocked container runtime.
 *
 * Asserts ordering, and that a failure at ANY step yields the right failure
 * reason. Both matter: the ordering is what research R-001 established (specify
 * scaffolds, an agent generates), and the reason is what the whole failure
 * taxonomy rests on.
 *
 * No Docker. Building a container in CI is RAID R-04, so every step, every
 * ordering guarantee, and every failure path is exercised through the injected
 * runtime port instead.
 */
import { describe, it, expect, vi } from 'vitest';
import type { EngineContext } from '@pmi/engine-contract';
import { buildEngineDescriptor } from '../../src/descriptor.js';
import {
  INVOCATION_STEPS,
  SPECKIT_INPUT_CEILING,
  SpecKitEngine,
  redact,
  type ContainerRuntime,
  type ExecResult,
  type SandboxSession,
} from '../../src/speckit.adapter.js';
import type { WorkspaceFileSystem } from '../../src/workspace.js';

const CORRELATION_ID = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const TOKEN = 'sk-testProviderToken0123456789';

const descriptor = buildEngineDescriptor({
  specifyVersion: '0.0.17',
  agentCliVersion: '1.0.0',
  agentModel: 'claude-opus-5',
});

const GENERATED_SPEC = '# Specification: Acme\n\n## Overview\n\nBody text.\n';

interface Harness {
  engine: SpecKitEngine;
  commands: string[][];
  written: { path: string; content: string }[];
  started: number;
  stopped: number;
  removed: string[];
}

function harness(
  options: {
    execImpl?: (command: readonly string[]) => Promise<ExecResult>;
    files?: Record<string, string>;
    startThrows?: unknown;
    ceiling?: number;
  } = {},
): Harness {
  const commands: string[][] = [];
  const written: { path: string; content: string }[] = [];
  const removed: string[] = [];
  const files = options.files ?? { 'specs/001-acme/spec.md': GENERATED_SPEC };
  const counters = { started: 0, stopped: 0 };

  const session: SandboxSession = {
    exec: async (command) => {
      commands.push([...command]);
      return options.execImpl
        ? options.execImpl(command)
        : { exitCode: 0, stdout: '', stderr: '' };
    },
    writeFile: async (path, content) => {
      written.push({ path, content });
    },
    listFiles: async () => Object.keys(files),
    readFile: async (path) => files[path] ?? '',
  };

  const runtime: ContainerRuntime = {
    start: async () => {
      counters.started++;
      if (options.startThrows) throw options.startThrows;
      return session;
    },
    stop: async () => {
      counters.stopped++;
    },
  };

  const fileSystem: WorkspaceFileSystem = {
    makeTempDirectory: async (prefix) => `${prefix}job`,
    removeDirectory: async (path) => {
      removed.push(path);
    },
  };

  const engine = new SpecKitEngine({
    descriptor,
    runtime,
    fileSystem,
    aiProviderToken: TOKEN,
    ...(options.ceiling !== undefined ? { inputCeiling: options.ceiling } : {}),
  });

  return {
    engine,
    commands,
    written,
    removed,
    get started() {
      return counters.started;
    },
    get stopped() {
      return counters.stopped;
    },
  };
}

function ctx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    signal: new AbortController().signal,
    timeoutMs: 5_000,
    correlationId: CORRELATION_ID,
    ...overrides,
  };
}

const input = {
  projectName: 'Acme',
  requirements: [
    { reference: 'FR-001', description: 'Issue invoices', type: 'functional' as const, priority: 'p1' as const },
  ],
};

describe('the five steps, in order (R-001)', () => {
  it('succeeds against a healthy runtime', async () => {
    const h = harness();
    const result = await h.engine.generateSpecification(input, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Specification: Acme');
      expect(result.producedBy.version).toContain('claude-opus-5');
    }
  });

  it('runs git init BEFORE specify init', async () => {
    const h = harness();
    await h.engine.generateSpecification(input, ctx());
    const gitIndex = h.commands.findIndex((c) => c[0] === 'git');
    const specifyIndex = h.commands.findIndex((c) => c[0] === 'specify');
    expect(gitIndex).toBeGreaterThanOrEqual(0);
    expect(specifyIndex).toBeGreaterThan(gitIndex);
  });

  it('scaffolds with the exact documented flags', async () => {
    const h = harness();
    await h.engine.generateSpecification(input, ctx());
    const specify = h.commands.find((c) => c[0] === 'specify');
    expect(specify).toEqual([
      'specify',
      'init',
      '--here',
      '--force',
      '--integration',
      'claude',
      '--script',
      'sh',
      '--ignore-agent-tools',
    ]);
  });

  it('writes the requirement input BEFORE running the agent', async () => {
    // specify only scaffolds. If the agent runs before the input exists it
    // generates from nothing, and the output looks plausible.
    const h = harness();
    await h.engine.generateSpecification(input, ctx());
    expect(h.written).toHaveLength(1);
    expect(h.written[0]?.content).toContain('FR-001');
    const agentIndex = h.commands.findIndex((c) => c[0] === 'claude');
    const specifyIndex = h.commands.findIndex((c) => c[0] === 'specify');
    expect(agentIndex).toBeGreaterThan(specifyIndex);
  });

  it('invokes the AI agent, not specify, to generate', async () => {
    const h = harness();
    await h.engine.generateSpecification(input, ctx());
    const agent = h.commands.find((c) => c[0] === 'claude');
    expect(agent?.join(' ')).toContain('/speckit-specify');
  });

  it('exposes its step names for ordering assertions', () => {
    expect([...INVOCATION_STEPS]).toEqual([
      'git_init',
      'specify_init',
      'write_input',
      'agent_run',
      'read_back',
    ]);
  });

  it('reports progress between the phases a user waits on', async () => {
    const onProgress = vi.fn();
    const h = harness();
    await h.engine.generateSpecification(input, ctx({ onProgress }));
    expect(onProgress).toHaveBeenCalled();
  });
});

describe('a failure at ANY step yields the right reason', () => {
  it.each([
    ['git', 'git_init'],
    ['specify', 'specify_init'],
    ['claude', 'agent_run'],
  ])('a non-zero exit from %s is engine_error naming the step', async (failing, step) => {
    const h = harness({
      execImpl: async (command) =>
        command[0] === failing
          ? { exitCode: 1, stdout: '', stderr: 'boom' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    const result = await h.engine.generateSpecification(input, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('engine_error');
      expect(result.failure.diagnostics).toContain(step);
    }
  });

  it('a container that will not start is engine_unavailable, NOT engine_error', async () => {
    // Retryable versus a defect: reporting them the same way makes an outage
    // indistinguishable from a bug.
    const h = harness({ startThrows: new Error('no runtime socket') });
    const result = await h.engine.generateSpecification(input, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('engine_unavailable');
  });

  it('no specification written back is empty_output', async () => {
    const h = harness({ files: { 'README.md': 'nothing useful' } });
    const result = await h.engine.generateSpecification(input, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('empty_output');
  });

  it('unreadable output is malformed_output', async () => {
    const h = harness({ files: { 'specs/001-acme/spec.md': 'agent chatter, no document' } });
    const result = await h.engine.generateSpecification(input, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('malformed_output');
  });

  it('never returns a value alongside any failure (E3)', async () => {
    const h = harness({ startThrows: new Error('down') });
    const result = await h.engine.generateSpecification(input, ctx());
    expect('value' in result).toBe(false);
  });
});

describe('refused before a container starts (E7)', () => {
  it('an empty selection starts NO container', async () => {
    const h = harness();
    const result = await h.engine.generateSpecification(
      { projectName: 'Acme', requirements: [] },
      ctx(),
    );
    if (!result.ok) expect(result.failure.reason).toBe('empty_selection');
    expect(h.started).toBe(0);
  });

  it('oversized input starts NO container', async () => {
    // The point of E7: a doomed run is never billed.
    const h = harness({ ceiling: 2 });
    const oversized = Array.from({ length: 3 }, (_, i) => ({ ...input.requirements[0]!, reference: `FR-${i}` }));
    const result = await h.engine.generateSpecification(
      { projectName: 'Acme', requirements: oversized },
      ctx(),
    );
    if (!result.ok) expect(result.failure.reason).toBe('input_too_large');
    expect(h.started).toBe(0);
  });

  it('uses the documented default ceiling', () => {
    expect(SPECKIT_INPUT_CEILING).toBe(500);
  });
});

describe('cancellation and timeout are never confused', () => {
  it('an already-aborted signal is cancelled, and starts no container', async () => {
    const controller = new AbortController();
    controller.abort();
    const h = harness();
    const result = await h.engine.generateSpecification(input, ctx({ signal: controller.signal }));
    if (!result.ok) expect(result.failure.reason).toBe('cancelled');
    expect(h.started).toBe(0);
  });

  it('exceeding the wall clock is timeout, NOT cancelled', async () => {
    // EPIC-001 shipped this bug once: aborting a shared controller on timeout
    // made the engine report `cancelled`, so a systemic timeout looked like
    // ordinary user behaviour in every metric.
    const h = harness({
      execImpl: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return { exitCode: 1, stdout: '', stderr: '' };
      },
    });
    const result = await h.engine.generateSpecification(input, ctx({ timeoutMs: 10 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('timeout');
      expect(result.failure.reason).not.toBe('cancelled');
    }
  });
});

describe('teardown on every terminal outcome (E8)', () => {
  it.each([
    ['success', {}],
    ['step failure', { execImpl: async () => ({ exitCode: 1, stdout: '', stderr: 'x' }) }],
    ['malformed output', { files: { 'specs/001-acme/spec.md': 'chatter' } }],
  ])('stops the container and removes the workspace after %s', async (_label, options) => {
    const h = harness(options as Parameters<typeof harness>[0]);
    await h.engine.generateSpecification(input, ctx());
    expect(h.stopped).toBe(1);
    expect(h.removed).toHaveLength(1);
  });

  it('removes the workspace even when the container could not start', async () => {
    const h = harness({ startThrows: new Error('down') });
    await h.engine.generateSpecification(input, ctx());
    expect(h.removed).toHaveLength(1);
  });
});

describe('the sandbox receives exactly two environment values (PC-3)', () => {
  it('passes the correlation id in and no platform credential', async () => {
    let captured: Record<string, string> = {};
    const session: SandboxSession = {
      exec: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      writeFile: async () => undefined,
      listFiles: async () => ['specs/001-acme/spec.md'],
      readFile: async () => GENERATED_SPEC,
    };
    const engine = new SpecKitEngine({
      descriptor,
      aiProviderToken: TOKEN,
      runtime: {
        start: async ({ env }) => {
          captured = env;
          return session;
        },
        stop: async () => undefined,
      },
      fileSystem: {
        makeTempDirectory: async (p) => `${p}job`,
        removeDirectory: async () => undefined,
      },
    });

    await engine.generateSpecification(input, ctx());
    expect(Object.keys(captured).sort()).toEqual(['AI_PROVIDER_TOKEN', 'PMI_CORRELATION_ID']);
    expect(captured['PMI_CORRELATION_ID']).toBe(CORRELATION_ID);
  });
});

describe('no credential reaches diagnostics (E9)', () => {
  it('redacts provider tokens', () => {
    expect(redact(new Error(`failed with ${TOKEN}`))).not.toContain(TOKEN);
    expect(redact(new Error(`failed with ${TOKEN}`))).toContain('[redacted]');
  });

  it.each([
    'AI_PROVIDER_TOKEN=abc123secret',
    'DATABASE_URL=postgresql://u:p@h/db',
    'Bearer abcdef1234567890',
    'password: hunter2hunter2',
  ])('redacts %s', (leak) => {
    const redacted = redact(new Error(`boom ${leak}`));
    expect(redacted).toContain('[redacted]');
    expect(redacted).not.toContain('hunter2hunter2');
  });

  it('keeps the token out of a real failure result', async () => {
    const h = harness({ startThrows: new Error(`connect failed using ${TOKEN}`) });
    const result = await h.engine.generateSpecification(input, ctx());
    if (!result.ok) {
      expect(result.failure.diagnostics ?? '').not.toContain(TOKEN);
      expect(result.failure.message).not.toContain(TOKEN);
    }
  });
});

describe('validation findings carry a location (FR-023)', () => {
  it('parses findings from agent output', async () => {
    const h = harness({
      execImpl: async (command) =>
        command[0] === 'claude'
          ? { exitCode: 0, stdout: 'Section 2 | error | Requirement has no acceptance criterion\n', stderr: '' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    const result = await h.engine.validateSpecification(
      { specificationTitle: 'S', specificationContent: 'body' },
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.location).toBe('Section 2');
      expect(result.value[0]?.severity).toBe('error');
    }
  });

  it('reports malformed_output when a finding has no location', async () => {
    const h = harness({
      execImpl: async (command) =>
        command[0] === 'claude'
          ? { exitCode: 0, stdout: ' | error | Something is wrong somewhere\n', stderr: '' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    const result = await h.engine.validateSpecification(
      { specificationTitle: 'S', specificationContent: 'body' },
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('malformed_output');
  });
});
