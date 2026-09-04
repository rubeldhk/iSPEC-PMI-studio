/**
 * `T1333` (EPIC-041) — the projects root is the unit of trust.
 *
 * `FR-LPW-005`, `FR-LPW-007`, `R-041-2`. A relative name resolves under the
 * root; an absolute host path is accepted only under `PMI_PROJECTS_ROOT_HOST`
 * and maps to the container-side write path; `..`, a path outside the root, a
 * Windows drive-letter path outside the root, and an empty value each refuse
 * **naming the reason**; a path with spaces inside the root is fine; an
 * unmounted root is detected before any write.
 *
 * Written to FAIL before `T1334` exists.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ProjectsRootUnavailableError,
  assertRootAvailable,
  readProjectsRootConfig,
  resolveRootPath,
} from '../../../src/modules/projects/projects-root.js';

const posix = readProjectsRootConfig({
  PMI_PROJECTS_ROOT: '/projects',
  PMI_PROJECTS_ROOT_HOST: '/home/dev/pmi-projects',
  PMI_PUBLIC_URL: 'http://localhost:3000',
  PMI_SPECKIT_TAG: 'v0.16.4',
  PMI_MCP_SERVER_VERSION: '0.1.0',
  PMI_INITIALISE_WAIT_MS: '30000',
});

const windows = readProjectsRootConfig({
  PMI_PROJECTS_ROOT: 'C:\\Users\\dev\\pmi-projects',
  PMI_PROJECTS_ROOT_HOST: 'C:\\Users\\dev\\pmi-projects',
  PMI_PUBLIC_URL: 'http://localhost:3000',
});

describe('T1333 · configuration', () => {
  it('reads the six variables with their defaults', () => {
    const c = readProjectsRootConfig({ PMI_PROJECTS_ROOT: '/p', PMI_PROJECTS_ROOT_HOST: '/p' });
    expect(c).toMatchObject({
      root: '/p',
      hostRoot: '/p',
      publicUrl: 'http://localhost:3000',
      specKitTag: 'v0.16.4',
      mcpServerVersion: '0.1.0',
      initialiseWaitMs: 30000,
    });
  });

  it('leaves the roots undefined when unset — provisioning refuses, nothing guesses', () => {
    const c = readProjectsRootConfig({});
    expect(c.root).toBeUndefined();
    expect(c.hostRoot).toBeUndefined();
  });
});

describe('T1333 · resolveRootPath (posix host)', () => {
  it('resolves a relative name under both roots', () => {
    expect(resolveRootPath(posix, 'alpha')).toEqual({
      relative: 'alpha',
      hostPath: '/home/dev/pmi-projects/alpha',
      writePath: '/projects/alpha',
    });
  });

  it('accepts an absolute host path under the host root and maps it to the write path', () => {
    expect(resolveRootPath(posix, '/home/dev/pmi-projects/team/beta')).toEqual({
      relative: 'team/beta',
      hostPath: '/home/dev/pmi-projects/team/beta',
      writePath: '/projects/team/beta',
    });
  });

  it('keeps spaces', () => {
    expect(resolveRootPath(posix, 'my project').hostPath).toBe('/home/dev/pmi-projects/my project');
  });

  it.each([
    ['../escape', /outside the projects root/],
    ['/tmp/elsewhere', /outside the projects root/],
    ['/home/dev/pmi-projects-other/x', /outside the projects root/],
    ['', /required/],
    ['   ', /required/],
    ['a/../../b', /outside the projects root/],
  ])('refuses %j naming the reason', (input, reason) => {
    expect(() => resolveRootPath(posix, input)).toThrow(reason);
  });

  it('refuses the root itself — a project is a directory under it, not the root', () => {
    expect(() => resolveRootPath(posix, '/home/dev/pmi-projects')).toThrow(/under the projects root/);
  });
});

describe('T1333 · resolveRootPath (Windows host)', () => {
  it('accepts a drive-letter path under the root, either separator', () => {
    expect(resolveRootPath(windows, 'C:\\Users\\dev\\pmi-projects\\gamma').relative).toBe('gamma');
    expect(resolveRootPath(windows, 'C:/Users/dev/pmi-projects/gamma').relative).toBe('gamma');
  });

  it('refuses a drive-letter path outside the root', () => {
    expect(() => resolveRootPath(windows, 'D:\\other\\gamma')).toThrow(/outside the projects root/);
    expect(() => resolveRootPath(windows, 'C:\\Users\\other\\gamma')).toThrow(/outside the projects root/);
  });

  it('is case-insensitive about the drive and the root, as the file system is', () => {
    expect(resolveRootPath(windows, 'c:\\users\\DEV\\pmi-projects\\delta').relative).toBe('delta');
  });
});

describe('T1333 · assertRootAvailable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pmi-root-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('passes for an existing writable directory', async () => {
    await expect(assertRootAvailable({ ...posix, root: dir })).resolves.toBeUndefined();
  });

  it('refuses before any write when the root is unset', async () => {
    await expect(assertRootAvailable({ ...posix, root: undefined })).rejects.toBeInstanceOf(ProjectsRootUnavailableError);
  });

  it('refuses when the root does not exist — an unmounted volume looks exactly like this', async () => {
    await expect(assertRootAvailable({ ...posix, root: join(dir, 'not-mounted') })).rejects.toThrow(/projects root unavailable/i);
  });
});
