/**
 * `T1344` (EPIC-041) — the local initialiser runs Spec Kit at the pinned tag, in
 * the project directory, for WHATEVER integration the project recorded.
 *
 * `R-041-8`, `FR-LPW-006`, `FR-LPW-008`. The command is exactly
 * `uvx --from git+https://github.com/github/spec-kit.git@<tag> specify init --here --force --integration <i> --script <s>`
 * with the directory as cwd; no integration is special-cased; a missing `uv` is
 * `initialiser_unavailable`, distinguishable from a failed init; the extension
 * is copied and the structure verified after.
 *
 * Written to FAIL before `T1345` exists.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalSpecKitInitialiser, buildInitCommand } from '../../src/local-init.js';

let dir: string;
let extension: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pmi-init-'));
  extension = mkdtempSync(join(tmpdir(), 'pmi-ext-'));
  writeFileSync(join(extension, 'extension.yml'), 'extension:\n  id: "pmi"\n  version: "0.1.0"\nprovides:\n  commands: []\nhooks: {}\n');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(extension, { recursive: true, force: true });
});

const input = () => ({
  directory: dir,
  agentIntegration: 'claude',
  scriptType: 'sh' as const,
  engineTag: 'v0.16.4',
  bundleVersion: '0.1.0',
  extensionDir: extension,
});

/** An exec that behaves like `specify init` succeeded: it lays down `.specify/`. */
function successfulExec() {
  return vi.fn(async (_command: string, _args: readonly string[], cwd: string) => {
    for (const d of ['memory', 'templates', 'scripts']) mkdirSync(join(cwd, '.specify', d), { recursive: true });
    writeFileSync(join(cwd, '.specify', 'memory', 'constitution.md'), '# Constitution\n');
    return { code: 0, stdout: '', stderr: '' };
  });
}

describe('T1344 · buildInitCommand', () => {
  it('builds exactly the documented uvx invocation', () => {
    expect(buildInitCommand({ engineTag: 'v0.16.4', agentIntegration: 'claude', scriptType: 'sh' })).toEqual({
      command: 'uvx',
      args: ['--from', 'git+https://github.com/github/spec-kit.git@v0.16.4', 'specify', 'init', '--here', '--force', '--integration', 'claude', '--script', 'sh'],
    });
  });

  it('passes the integration through untouched — no integration is special-cased (FR-LPW-006)', () => {
    for (const integration of ['copilot', 'gemini', 'codebuddy']) {
      expect(buildInitCommand({ engineTag: 'v0.16.4', agentIntegration: integration, scriptType: 'ps' }).args).toContain(integration);
    }
  });

  it('does not pass --ignore-agent-tools: on the user\'s machine the check is useful information', () => {
    expect(buildInitCommand({ engineTag: 'v0.16.4', agentIntegration: 'claude', scriptType: 'sh' }).args).not.toContain('--ignore-agent-tools');
  });
});

describe('T1344 · LocalSpecKitInitialiser', () => {
  it('runs init in the directory, copies the extension, registers hooks, verifies, and reports the four steps', async () => {
    const exec = successfulExec();
    const result = await new LocalSpecKitInitialiser({ exec }).initialise(input());
    expect(exec).toHaveBeenCalledWith('uvx', expect.arrayContaining(['specify', 'init', '--here']), dir);
    expect(result).toMatchObject({
      ok: true,
      stepsCompleted: ['run_engine_init', 'copy_extension', 'register_hooks', 'verify_structure'],
    });
    expect(existsSync(join(dir, '.specify', 'extensions', 'pmi', 'extension.yml'))).toBe(true);
    expect(readFileSync(join(dir, '.specify', 'extensions.yml'), 'utf8')).toMatch(/hooks:/);
    if (result.ok) expect(result.filesWritten).toContain('.specify/extensions/pmi/extension.yml');
  });

  it('reports a missing uv as initialiser_unavailable, not as a failed init', async () => {
    const exec = vi.fn(async () => {
      const e = new Error('spawn uvx ENOENT') as NodeJS.ErrnoException;
      e.code = 'ENOENT';
      throw e;
    });
    const result = await new LocalSpecKitInitialiser({ exec }).initialise(input());
    expect(result).toMatchObject({ ok: false, failedStep: 'run_engine_init', reason: expect.stringMatching(/initialiser_unavailable/) });
  });

  it('reports a non-zero exit as a failed init naming the step, with stderr sanitised of the directory', async () => {
    const exec = vi.fn(async () => ({ code: 2, stdout: '', stderr: `error in ${dir}: template fetch refused` }));
    const result = await new LocalSpecKitInitialiser({ exec }).initialise(input());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedStep).toBe('run_engine_init');
      expect(result.reason).not.toContain(dir);
      expect(result.reason).toMatch(/template fetch refused/);
    }
  });

  it('merges an existing extensions.yml rather than replacing it', async () => {
    mkdirSync(join(dir, '.specify'), { recursive: true });
    writeFileSync(join(dir, '.specify', 'extensions.yml'), 'hooks:\n  after_tasks:\n    - extension: jira\n      command: speckit.jira.sync\n');
    const result = await new LocalSpecKitInitialiser({ exec: successfulExec() }).initialise(input());
    expect(result.ok).toBe(true);
    const text = readFileSync(join(dir, '.specify', 'extensions.yml'), 'utf8');
    expect(text).toContain('speckit.jira.sync');
  });

  it('fails verify_structure by name when init left no .specify', async () => {
    const exec = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }));
    const result = await new LocalSpecKitInitialiser({ exec }).initialise(input());
    expect(result).toMatchObject({ ok: false, failedStep: 'verify_structure' });
  });
});
