/**
 * T570 — the Docker provider against a MOCKED daemon.
 *
 * Everything here runs in CI. RAID **R-04** blocks container-in-container, so
 * the only part of this provider that cannot be tested here is the part where a
 * real container actually starts — which is `T646b`, split out deliberately.
 *
 * EPIC-003 shipped 65 passing tests and an engine that could not start, and its
 * closure report says *"No real container has ever started."* These assertions
 * are written to be honest about which half they are: they prove the **request
 * the provider constructs** is the one `ADR-0002` specifies. They prove nothing
 * about whether Docker accepts it.
 */
import { describe, expect, it, vi } from 'vitest';
import { ExecutionProviderError, type ExecutionRequest } from '@pmi/execution-contract';
import { DockerExecutionEnvironment, DOCKER_DESCRIPTOR, type DockerEngineApi } from '../../src/index.js';

/** A daemon that records what it was asked and answers plausibly. */
function daemon(over: Partial<DockerEngineApi> = {}): DockerEngineApi & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    createContainer: vi.fn(async (config) => {
      calls.push({ op: 'create', config });
      return { id: 'container-1' };
    }),
    startContainer: vi.fn(async (id) => {
      calls.push({ op: 'start', id });
    }),
    exec: vi.fn(async (id, command) => {
      calls.push({ op: 'exec', id, command });
      return { exitCode: 0, stdout: '', stderr: '' };
    }),
    removeContainer: vi.fn(async (id) => {
      calls.push({ op: 'remove', id });
    }),
    ...over,
  };
}

const REQUEST: ExecutionRequest = {
  lifecycle: 'ephemeral',
  image: 'pmi-studio/speckit-engine@sha256:abc',
  env: { PMI_CORRELATION_ID: '00000000-0000-4000-8000-000000000000' },
  workspace: { kind: 'ephemeral', scratchPath: '/workspace' },
  egressProfile: {
    name: 'generation',
    allowedDestinations: ['api.anthropic.com:443'],
    enforcement: 'network-policy',
  },
  credentials: [],
  resourceLimits: { cpus: 1, memoryMb: 2048, pids: 256, wallClockMs: 600_000 },
  timeoutMs: 600_000,
};

function createdConfig(d: ReturnType<typeof daemon>): Record<string, never> {
  const create = d.calls.find((c) => (c as { op: string }).op === 'create') as {
    config: Record<string, never>;
  };
  return create.config;
}

describe('T570 · the descriptor (FR-AGT-007)', () => {
  it('declares docker as the provider', () => {
    expect(DOCKER_DESCRIPTOR.provider).toBe('docker');
  });

  it('supports network policy, so it may accept an egress profile', () => {
    // A provider declaring false cannot accept ANY profile (T579). Docker can
    // enforce one, so it must say so or the generation profile is unusable.
    expect(DOCKER_DESCRIPTOR.supportsNetworkPolicy).toBe(true);
  });

  it('declares ephemeral only, and no persistent state', () => {
    expect(DOCKER_DESCRIPTOR.supportedLifecycles).toEqual(['ephemeral']);
    expect(DOCKER_DESCRIPTOR.supportsPersistentState).toBe(false);
  });
});

describe('T570 · every ADR-0002 control appears in the create request', () => {
  it('runs as a non-root user', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    // sandbox.json: uid 10001, gid 10001, nonRoot true.
    expect(createdConfig(d)).toMatchObject({ User: '10001:10001' });
  });

  it('mounts the root filesystem read-only', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    expect(createdConfig(d)).toMatchObject({ HostConfig: { ReadonlyRootfs: true } });
  });

  it('gives exactly one writable path, and it is a tmpfs', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    const config = createdConfig(d) as unknown as { HostConfig: { Tmpfs: Record<string, string> } };
    expect(Object.keys(config.HostConfig.Tmpfs)).toEqual(['/workspace']);
  });

  it('caps cpu, memory and pids', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    expect(createdConfig(d)).toMatchObject({
      HostConfig: {
        // Docker expresses CPU as billionths.
        NanoCpus: 1_000_000_000,
        Memory: 2048 * 1024 * 1024,
        PidsLimit: 256,
      },
    });
  });

  it('drops every capability and adds none', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    expect(createdConfig(d)).toMatchObject({ HostConfig: { CapDrop: ['ALL'], CapAdd: [] } });
  });

  it('forbids new privileges and refuses privileged mode', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    const config = createdConfig(d) as unknown as {
      HostConfig: { SecurityOpt: string[]; Privileged: boolean };
    };
    expect(config.HostConfig.SecurityOpt).toContain('no-new-privileges');
    expect(config.HostConfig.Privileged).toBe(false);
  });

  it('passes the request keys plus ONLY the proxy plumbing the profile requires', async () => {
    // sandbox.json calls its allowed list exhaustive: "whatever is not listed
    // does not exist inside the container". That list governs what the REQUEST
    // may carry, and the request still adds nothing. The three proxy variables
    // are the egress control's own plumbing (D-28): derived from the profile
    // at the provider seam, carrying an internal DNS name and no secret — the
    // network policy stating where it is enforced. Asserted exhaustively so a
    // fourth variable cannot arrive unreviewed.
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    const config = createdConfig(d) as unknown as { Env: string[] };
    expect(config.Env).toEqual([
      'PMI_CORRELATION_ID=00000000-0000-4000-8000-000000000000',
      'HTTP_PROXY=http://pmi-egress-proxy-generation:8888',
      'HTTPS_PROXY=http://pmi-egress-proxy-generation:8888',
      'NO_PROXY=localhost,127.0.0.1',
    ]);
  });

  it('applies the egress profile rather than leaving the network open', async () => {
    const d = daemon();
    await new DockerExecutionEnvironment(d).start(REQUEST);
    const config = createdConfig(d) as unknown as { HostConfig: { NetworkMode: string } };
    // Phase 1: the profile is carried to a named network the operator defines.
    // `bridge` or `host` here would silently give the agent the open internet.
    expect(config.HostConfig.NetworkMode).toBe('pmi-egress-generation');
  });

  it('refuses a request whose profile the descriptor cannot enforce', async () => {
    const d = daemon();
    const noPolicy = new DockerExecutionEnvironment(d, {
      descriptor: { ...DOCKER_DESCRIPTOR, supportsNetworkPolicy: false },
    });
    await expect(noPolicy.start(REQUEST)).rejects.toThrow(ExecutionProviderError);
    expect(d.calls, 'a refused request must not reach the daemon').toEqual([]);
  });
});

describe('T570 · failures are classified, not lumped together', () => {
  it('an unreachable daemon is provider_unavailable', async () => {
    const d = daemon({
      createContainer: async () => {
        throw Object.assign(new Error('connect ENOENT /var/run/docker.sock'), { code: 'ENOENT' });
      },
    });
    await expect(new DockerExecutionEnvironment(d).start(REQUEST)).rejects.toMatchObject({
      reason: 'provider_unavailable',
    });
  });

  it('a missing image is image_unavailable, not provider_unavailable', async () => {
    // One is "fix your infrastructure", the other is "build the image". Sending
    // an operator to the wrong one costs an outage's worth of time.
    const d = daemon({
      createContainer: async () => {
        throw Object.assign(new Error('no such image'), { statusCode: 404 });
      },
    });
    await expect(new DockerExecutionEnvironment(d).start(REQUEST)).rejects.toMatchObject({
      reason: 'image_unavailable',
    });
  });

  it('any other daemon error is provider_error', async () => {
    const d = daemon({
      createContainer: async () => {
        throw Object.assign(new Error('conflict'), { statusCode: 409 });
      },
    });
    await expect(new DockerExecutionEnvironment(d).start(REQUEST)).rejects.toMatchObject({
      reason: 'provider_error',
    });
  });

  it('keeps daemon detail in diagnostics, never in the user-facing message (PC-3)', async () => {
    const d = daemon({
      createContainer: async () => {
        throw new Error('AI_PROVIDER_TOKEN=sk-live-not-a-real-key rejected');
      },
    });
    try {
      await new DockerExecutionEnvironment(d).start(REQUEST);
      expect.unreachable('start should have thrown');
    } catch (e) {
      expect((e as ExecutionProviderError).message).not.toContain('sk-live-not-a-real-key');
    }
  });
});

describe('T570 · cancellation and teardown', () => {
  it('refuses an already-aborted request before touching the daemon', async () => {
    // The C1 rule, one layer down: a doomed run must not cost a container.
    const d = daemon();
    await expect(
      new DockerExecutionEnvironment(d).start({ ...REQUEST, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ reason: 'cancelled' });
    expect(d.calls).toEqual([]);
  });

  it('removes the container on stop', async () => {
    const d = daemon();
    const provider = new DockerExecutionEnvironment(d);
    const session = await provider.start(REQUEST);
    await provider.stop(session);
    expect(d.calls.filter((c) => (c as { op: string }).op === 'remove')).toHaveLength(1);
  });

  it('stop is idempotent — a second call is a no-op, not an error', async () => {
    // E8: the container goes whatever happened, and teardown runs in a `finally`
    // that may execute after an earlier failure already removed it.
    const d = daemon();
    const provider = new DockerExecutionEnvironment(d);
    const session = await provider.start(REQUEST);
    await provider.stop(session);
    await expect(provider.stop(session)).resolves.toBeUndefined();
    expect(d.calls.filter((c) => (c as { op: string }).op === 'remove')).toHaveLength(1);
  });

  it('stop never throws, even when the daemon rejects', async () => {
    const d = daemon({
      removeContainer: async () => {
        throw new Error('daemon gone');
      },
    });
    const provider = new DockerExecutionEnvironment(d);
    const session = await provider.start(REQUEST);
    await expect(provider.stop(session)).resolves.toBeUndefined();
  });

  it('removes the container if start fails after creating it', async () => {
    // Otherwise a failed start leaks a container per attempt.
    const d = daemon({
      startContainer: async () => {
        throw new Error('boom');
      },
    });
    await expect(new DockerExecutionEnvironment(d).start(REQUEST)).rejects.toThrow();
    expect(d.calls.filter((c) => (c as { op: string }).op === 'remove')).toHaveLength(1);
  });
});

describe('T570 · the session speaks the ExecutionSession contract', () => {
  it('exec runs the command inside the container', async () => {
    const d = daemon();
    const session = await new DockerExecutionEnvironment(d).start(REQUEST);
    await session.exec(['git', 'init']);
    expect(d.calls).toContainEqual({ op: 'exec', id: 'container-1', command: ['git', 'init'] });
  });

  it('writeFile does not interpolate content into a shell command', async () => {
    // Content is a customer requirement and may contain quotes, newlines, and
    // `$(...)`. Interpolating it is a command-injection bug with the agent's
    // own privileges.
    const d = daemon();
    const session = await new DockerExecutionEnvironment(d).start(REQUEST);
    await session.writeFile('pmi-input.md', "it's $(whoami)\n`id`");

    const exec = d.calls.find(
      (c) => (c as { op: string; command?: string[] }).op === 'exec' &&
        (c as { command: string[] }).command.join(' ').includes('base64'),
    );
    expect(exec, 'content must be transported encoded, not interpolated').toBeDefined();
    expect(JSON.stringify(exec)).not.toContain('$(whoami)');
  });

  it('readFile returns what the container printed', async () => {
    const d = daemon({
      exec: async () => ({ exitCode: 0, stdout: '# Spec\n', stderr: '' }),
    });
    const session = await new DockerExecutionEnvironment(d).start(REQUEST);
    expect(await session.readFile('spec.md')).toBe('# Spec\n');
  });

  it('listFiles parses one path per line and drops blanks', async () => {
    const d = daemon({
      exec: async () => ({ exitCode: 0, stdout: './a.md\n./b/c.md\n\n', stderr: '' }),
    });
    const session = await new DockerExecutionEnvironment(d).start(REQUEST);
    expect(await session.listFiles()).toEqual(['./a.md', './b/c.md']);
  });
});
