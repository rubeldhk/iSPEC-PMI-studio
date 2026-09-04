/**
 * `T1334` (EPIC-041) — the projects root is the unit of trust.
 *
 * `FR-LPW-005`, `FR-LPW-007`, `R-041-2`. The API in a container cannot write to
 * an arbitrary host path and cannot know what a host path *means*. So the root
 * is configured twice — once as the API sees it (`PMI_PROJECTS_ROOT`, the
 * mount) and once as the developer's machine sees it (`PMI_PROJECTS_ROOT_HOST`,
 * what a project's `rootPath` stores and every screen shows) — and a requested
 * path is accepted only if it resolves under the host root. "Outside the root"
 * is then a string comparison after normalisation, decidable before any write.
 *
 * Windows hosts are first-class: a drive-letter root switches the resolver to
 * `path.win32` semantics and case-insensitive comparison, which is how that
 * file system compares.
 *
 * Framework-free (PC-1). Unit test: `backend/tests/unit/projects/projects-root.spec.ts`.
 */
import { access, constants, stat } from 'node:fs/promises';
import { posix, win32 } from 'node:path';
import { PlatformError, ValidationFailedError } from '../../core/errors.js';

export interface ProjectsRootConfig {
  /** Where the API writes. Undefined when unset — provisioning refuses, nothing guesses. */
  readonly root: string | undefined;
  /** The same directory as the developer's machine sees it. */
  readonly hostRoot: string | undefined;
  /** The address the developer's machine reaches this PMI Studio at (analysis `U2`). */
  readonly publicUrl: string;
  readonly engineTag: string;
  readonly mcpServerVersion: string;
  /** How long a prepared project waits for a worker before reading *initialisation pending*. */
  readonly initialiseWaitMs: number;
}

export function readProjectsRootConfig(env: Record<string, string | undefined>): ProjectsRootConfig {
  const wait = Number.parseInt(env['PMI_INITIALISE_WAIT_MS'] ?? '', 10);
  return {
    root: env['PMI_PROJECTS_ROOT'] || undefined,
    hostRoot: env['PMI_PROJECTS_ROOT_HOST'] || undefined,
    publicUrl: env['PMI_PUBLIC_URL'] || 'http://localhost:3000',
    engineTag: env['PMI_ENGINE_TAG'] || 'v0.16.4',
    mcpServerVersion: env['PMI_MCP_SERVER_VERSION'] || '0.1.0',
    initialiseWaitMs: Number.isFinite(wait) && wait > 0 ? wait : 30_000,
  };
}

/** 503: the platform exists and cannot currently write a directory. Never a write attempt. */
export class ProjectsRootUnavailableError extends PlatformError {
  readonly code = 'projects_root_unavailable' as const;
}

export interface ResolvedRoot {
  /** Relative to both roots, normalised to forward slashes. */
  readonly relative: string;
  /** What `Project.rootPath` stores and screens show. */
  readonly hostPath: string;
  /** Where the API writes. */
  readonly writePath: string;
}

const WINDOWS_ROOT = /^[A-Za-z]:[\\/]/;

function refuse(reason: string): never {
  throw new ValidationFailedError(`The project directory cannot be used: ${reason}.`, {
    fields: [{ field: 'rootPath', reason }],
  });
}

/**
 * Accept a relative name, or an absolute host path under the host root. Refuse
 * — naming the reason — anything that resolves outside it, the root itself,
 * and an empty value.
 */
export function resolveRootPath(config: ProjectsRootConfig, requested: string): ResolvedRoot {
  if (config.hostRoot === undefined || config.root === undefined) {
    throw new ProjectsRootUnavailableError(
      'Projects root unavailable: PMI_PROJECTS_ROOT and PMI_PROJECTS_ROOT_HOST are not configured.',
    );
  }
  const trimmed = requested.trim();
  if (trimmed === '') refuse('required');

  const isWindows = WINDOWS_ROOT.test(config.hostRoot);
  const p = isWindows ? win32 : posix;
  const fold = (s: string): string => (isWindows ? s.toLowerCase() : s);

  const hostRoot = p.resolve(config.hostRoot);
  const absolute = p.isAbsolute(trimmed) ? p.resolve(trimmed) : p.resolve(hostRoot, trimmed);
  const relative = p.relative(hostRoot, absolute);

  if (relative === '' || fold(absolute) === fold(hostRoot)) {
    refuse(`must be a directory under the projects root, not the root itself (${config.hostRoot})`);
  }
  if (relative.startsWith('..') || p.isAbsolute(relative)) {
    refuse(`outside the projects root (${config.hostRoot})`);
  }
  // Windows compares case-insensitively; `relative` already reflects that
  // when the drive letters differ only in case, but a different drive is
  // absolute and caught above.
  if (isWindows && fold(absolute).slice(0, hostRoot.length) !== fold(hostRoot)) {
    refuse(`outside the projects root (${config.hostRoot})`);
  }

  const relativePosix = relative.split(p.sep).join('/');
  const writeRoot = WINDOWS_ROOT.test(config.root) ? win32 : posix;
  return {
    relative: relativePosix,
    hostPath: p.join(hostRoot, relative),
    writePath: writeRoot.join(writeRoot.resolve(config.root), ...relativePosix.split('/')),
  };
}

/**
 * The root must exist and be writable — checked at start and again per
 * request, so *projects root unavailable* precedes any write. An unmounted
 * volume looks exactly like a missing directory, which is the point.
 */
export async function assertRootAvailable(config: ProjectsRootConfig): Promise<void> {
  if (config.root === undefined) {
    throw new ProjectsRootUnavailableError('Projects root unavailable: PMI_PROJECTS_ROOT is not configured.');
  }
  try {
    const s = await stat(config.root);
    if (!s.isDirectory()) throw new Error('not a directory');
    await access(config.root, constants.W_OK);
  } catch {
    throw new ProjectsRootUnavailableError(
      `Projects root unavailable: ${config.root} does not exist or is not writable. In the containerised stack this means the PMI_PROJECTS_ROOT_HOST mount is missing.`,
    );
  }
}
