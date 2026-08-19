/**
 * T090 — ephemeral workspace provisioning and teardown.
 *
 * Contract rule E8: leave no process, container, or temporary file behind on
 * ANY terminal outcome — success, failure, timeout, or cancellation. The last
 * three are the ones that leak in practice, because they are the paths nobody
 * exercises by hand.
 *
 * Teardown is therefore structural, not a call the caller must remember:
 * `withEphemeralWorkspace` owns the lifetime and releases it in `finally`.
 * There is deliberately no public "provision" that returns an unmanaged handle.
 *
 * Framework-free and filesystem-injected (PC-1), so every terminal path is
 * unit-testable without touching a real disk or a container runtime.
 */

export interface WorkspaceFileSystem {
  /** Create a uniquely named directory under the given prefix; returns its path. */
  makeTempDirectory(prefix: string): Promise<string>;
  /** Remove a directory and everything under it. Must be idempotent. */
  removeDirectory(path: string): Promise<void>;
}

export interface EphemeralWorkspace {
  readonly path: string;
}

export interface WorkspaceOptions {
  /** Prefix for the temp directory. Namespaced so stray directories are attributable. */
  prefix?: string;
  /** Called when teardown fails. Never throws into the caller's result. */
  onTeardownFailure?: (path: string, error: unknown) => void;
}

export const WORKSPACE_PREFIX = 'pmi-speckit-';

/**
 * Run `work` against a fresh workspace, destroying it afterwards no matter how
 * `work` ends.
 *
 * Teardown failure never masks the original outcome. If the work threw, that
 * error propagates; a cleanup problem is reported through `onTeardownFailure`
 * instead. Swapping them would replace a real engine failure with an unrelated
 * filesystem message and send whoever is debugging to the wrong place.
 */
export async function withEphemeralWorkspace<T>(
  fs: WorkspaceFileSystem,
  work: (workspace: EphemeralWorkspace) => Promise<T>,
  options: WorkspaceOptions = {},
): Promise<T> {
  const prefix = options.prefix ?? WORKSPACE_PREFIX;
  const path = await fs.makeTempDirectory(prefix);
  let released = false;

  const release = async (): Promise<void> => {
    // Exactly once: a double remove on a shared temp root is how one job
    // deletes another job's workspace.
    if (released) return;
    released = true;
    try {
      await fs.removeDirectory(path);
    } catch (error) {
      options.onTeardownFailure?.(path, error);
    }
  };

  try {
    return await work({ path });
  } finally {
    await release();
  }
}

/**
 * A Node filesystem implementation.
 *
 * Kept separate from the logic above so the teardown guarantee is testable
 * without a disk, and so the adapter can be driven against a fake in the
 * conformance suite.
 */
export function nodeWorkspaceFileSystem(deps: {
  mkdtemp: (prefix: string) => Promise<string>;
  rm: (path: string, options: { recursive: true; force: true }) => Promise<void>;
}): WorkspaceFileSystem {
  return {
    makeTempDirectory: (prefix) => deps.mkdtemp(prefix),
    removeDirectory: (path) => deps.rm(path, { recursive: true, force: true }),
  };
}
