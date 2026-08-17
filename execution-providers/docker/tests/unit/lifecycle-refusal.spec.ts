/**
 * T571 — the provider refuses a `persistent` binding, and names why.
 *
 * Native §5: *"No sandbox state may implicitly become authoritative project
 * state."* The `WorkspaceBinding` union makes the dangerous shape
 * unrepresentable at compile time (T545), and this is the runtime half: a
 * caller that constructs a persistent binding — from configuration, from JSON,
 * from a future provider that supports one — must be refused by the provider
 * that cannot honour it.
 *
 * Refusing is the whole contribution. `D-22` decided the git remote is the
 * durable substrate and volumes are cache; a Docker provider that quietly
 * accepted a persistent binding would be the exact mechanism by which a
 * container's scratch directory became a project's source of truth.
 */
import { describe, expect, it, vi } from 'vitest';
import { ExecutionProviderError, type ExecutionRequest } from '@pmi/execution-contract';
import { DockerExecutionEnvironment, DOCKER_DESCRIPTOR, type DockerEngineApi } from '../../src/index.js';

function daemon(): DockerEngineApi & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    createContainer: vi.fn(async () => {
      calls.push('create');
      return { id: 'c1' };
    }),
    startContainer: vi.fn(async () => {
      calls.push('start');
    }),
    exec: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    removeContainer: vi.fn(async () => {
      calls.push('remove');
    }),
  };
}

const PERSISTENT: ExecutionRequest = {
  lifecycle: 'persistent',
  image: 'pmi-studio/speckit-engine',
  env: {},
  workspace: {
    kind: 'persistent',
    projectRef: 'github.com/rubeldhk/iSPEC-PMI-studio',
    mode: 'read-write',
    branch: 'epic/028-agent-execution-seam',
  },
  egressProfile: {
    name: 'generation',
    allowedDestinations: ['api.anthropic.com:443'],
    enforcement: 'network-policy',
  },
  credentials: [],
  resourceLimits: { cpus: 1, memoryMb: 2048, pids: 256, wallClockMs: 600_000 },
  timeoutMs: 600_000,
};

describe('T571 · a persistent binding is refused', () => {
  it('declares only the ephemeral lifecycle', () => {
    expect(DOCKER_DESCRIPTOR.supportedLifecycles).toEqual(['ephemeral']);
  });

  it('throws rather than silently downgrading to ephemeral', async () => {
    // Silently downgrading is the dangerous option: the run would succeed, the
    // caller would believe state persisted, and the loss would surface later as
    // missing work rather than as an error.
    await expect(new DockerExecutionEnvironment(daemon()).start(PERSISTENT)).rejects.toThrow(
      ExecutionProviderError,
    );
  });

  it('refuses with policy_refused, not provider_error', async () => {
    // The request is well-formed and the daemon is healthy. This is a policy
    // decision, and classifying it as an error would send someone debugging.
    await expect(new DockerExecutionEnvironment(daemon()).start(PERSISTENT)).rejects.toMatchObject({
      reason: 'policy_refused',
    });
  });

  it('names the lifecycle it cannot honour and what it does support', async () => {
    try {
      await new DockerExecutionEnvironment(daemon()).start(PERSISTENT);
      expect.unreachable('start should have refused');
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain('persistent');
      expect(message).toContain('ephemeral');
    }
  });

  it('costs nothing — no container is created', async () => {
    const d = daemon();
    await expect(new DockerExecutionEnvironment(d).start(PERSISTENT)).rejects.toThrow();
    expect(d.calls, 'a refused request must not reach the daemon').toEqual([]);
  });

  it('refuses a persistent WORKSPACE even when the lifecycle field says ephemeral', async () => {
    // The two fields can disagree. The binding is the one that decides whether
    // state outlives the container, so the binding is what must be checked.
    const d = daemon();
    await expect(
      new DockerExecutionEnvironment(d).start({ ...PERSISTENT, lifecycle: 'ephemeral' }),
    ).rejects.toMatchObject({ reason: 'policy_refused' });
    expect(d.calls).toEqual([]);
  });
});
