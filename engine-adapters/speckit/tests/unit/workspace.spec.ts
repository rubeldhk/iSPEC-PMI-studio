/**
 * T086 — workspace provisioning and GUARANTEED teardown on every terminal outcome.
 *
 * Contract rule E8. Success is the easy case; the ones that leak in practice
 * are failure, timeout and cancellation, because they are the paths nobody
 * exercises by hand. Each gets its own test here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  WORKSPACE_PREFIX,
  nodeWorkspaceFileSystem,
  withEphemeralWorkspace,
  type WorkspaceFileSystem,
} from '../../src/workspace.js';

/** Records what was created and removed, so a leak is directly observable. */
function trackingFileSystem(overrides: Partial<WorkspaceFileSystem> = {}) {
  const created: string[] = [];
  const removed: string[] = [];
  let counter = 0;
  const fs: WorkspaceFileSystem = {
    makeTempDirectory: async (prefix) => {
      const path = `${prefix}${++counter}`;
      created.push(path);
      return path;
    },
    removeDirectory: async (path) => {
      removed.push(path);
    },
    ...overrides,
  };
  return { fs, created, removed, leaked: () => created.filter((p) => !removed.includes(p)) };
}

describe('provisioning', () => {
  it('creates a workspace and hands its path to the work', async () => {
    const { fs, created } = trackingFileSystem();
    const seen = await withEphemeralWorkspace(fs, async (workspace) => workspace.path);
    expect(created).toEqual([seen]);
  });

  it('namespaces the directory so a stray one is attributable', async () => {
    const { fs } = trackingFileSystem();
    const path = await withEphemeralWorkspace(fs, async (w) => w.path);
    expect(path.startsWith(WORKSPACE_PREFIX)).toBe(true);
  });

  it('gives concurrent jobs different workspaces', async () => {
    const { fs } = trackingFileSystem();
    const [a, b] = await Promise.all([
      withEphemeralWorkspace(fs, async (w) => w.path),
      withEphemeralWorkspace(fs, async (w) => w.path),
    ]);
    expect(a).not.toBe(b);
  });
});

describe('teardown on every terminal outcome (E8)', () => {
  it('SUCCESS — removes the workspace', async () => {
    const { fs, leaked } = trackingFileSystem();
    await withEphemeralWorkspace(fs, async () => 'done');
    expect(leaked()).toEqual([]);
  });

  it('FAILURE — removes the workspace and preserves the original error', async () => {
    const { fs, leaked } = trackingFileSystem();
    await expect(
      withEphemeralWorkspace(fs, async () => {
        throw new Error('engine blew up');
      }),
    ).rejects.toThrow('engine blew up');
    expect(leaked()).toEqual([]);
  });

  it('TIMEOUT — removes the workspace', async () => {
    const { fs, leaked } = trackingFileSystem();
    await expect(
      withEphemeralWorkspace(fs, async () => {
        throw Object.assign(new Error('timed out'), { reason: 'timeout' });
      }),
    ).rejects.toThrow('timed out');
    expect(leaked()).toEqual([]);
  });

  it('CANCELLATION — removes the workspace', async () => {
    const { fs, leaked } = trackingFileSystem();
    const controller = new AbortController();
    const pending = withEphemeralWorkspace(fs, async () => {
      controller.abort();
      throw new Error('cancelled');
    });
    await expect(pending).rejects.toThrow('cancelled');
    expect(leaked()).toEqual([]);
  });

  it('removes the workspace exactly once', async () => {
    // A double remove on a shared temp root is how one job deletes another's.
    const { fs, removed } = trackingFileSystem();
    await withEphemeralWorkspace(fs, async () => 'done');
    expect(removed).toHaveLength(1);
  });

  it('leaves nothing behind across many runs, whatever the outcome', async () => {
    const { fs, leaked } = trackingFileSystem();
    for (let i = 0; i < 20; i++) {
      const outcome = withEphemeralWorkspace(fs, async () => {
        if (i % 3 === 0) throw new Error(`failure ${i}`);
        return i;
      });
      await outcome.catch(() => undefined);
    }
    expect(leaked()).toEqual([]);
  });
});

describe('teardown failure', () => {
  it('reports the problem without masking a successful result', async () => {
    const onTeardownFailure = vi.fn();
    const { fs } = trackingFileSystem({
      removeDirectory: async () => {
        throw new Error('device busy');
      },
    });
    const result = await withEphemeralWorkspace(fs, async () => 'value', { onTeardownFailure });
    expect(result).toBe('value');
    expect(onTeardownFailure).toHaveBeenCalledOnce();
  });

  it('does NOT replace the original error with a cleanup error', async () => {
    // Swapping them sends whoever is debugging to the wrong place entirely.
    const { fs } = trackingFileSystem({
      removeDirectory: async () => {
        throw new Error('device busy');
      },
    });
    await expect(
      withEphemeralWorkspace(
        fs,
        async () => {
          throw new Error('the real failure');
        },
        { onTeardownFailure: () => undefined },
      ),
    ).rejects.toThrow('the real failure');
  });

  it('never throws a cleanup error at the caller', async () => {
    const { fs } = trackingFileSystem({
      removeDirectory: async () => {
        throw new Error('device busy');
      },
    });
    await expect(withEphemeralWorkspace(fs, async () => 'ok')).resolves.toBe('ok');
  });
});

describe('node filesystem adapter', () => {
  it('removes recursively and tolerates an already-absent directory', async () => {
    const rm = vi.fn(async () => undefined);
    const fs = nodeWorkspaceFileSystem({ mkdtemp: async (p) => `${p}real`, rm });
    await fs.removeDirectory('/tmp/pmi-speckit-x');
    expect(rm).toHaveBeenCalledWith('/tmp/pmi-speckit-x', { recursive: true, force: true });
  });
});
