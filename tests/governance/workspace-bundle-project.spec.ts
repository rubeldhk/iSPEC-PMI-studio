/**
 * `T1471` (EPIC-042) — the workspace bundle is a tested project at `0.2.0`.
 *
 * `EPIC-041` registered the `workspace-bundle` Vitest project and mapped it;
 * this Epic fills the bundle with content (the extension's commands and
 * hooks, the full setup skill, the invariant constitution text) and bumps it
 * to `0.2.0`. Read as configuration, not executed: the conformance check
 * Constitution V asks for a package manifest and a test-project registration.
 * Written to FAIL before `T1472`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '../..');
const PKG_DIR = join(REPO_ROOT, 'packages', 'workspace-bundle');

function manifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) as Record<string, unknown>;
}

describe('T1471 · packages/workspace-bundle is the tested bundle the plan describes', () => {
  it('is @pmi/workspace-bundle at 0.2.0 with a test script', () => {
    expect(manifest()['name']).toBe('@pmi/workspace-bundle');
    expect(manifest()['version']).toBe('0.2.0');
    const scripts = (manifest()['scripts'] as Record<string, string> | undefined) ?? {};
    expect(scripts['test']).toMatch(/vitest/);
  });

  it('exports BUNDLE_VERSION equal to the manifest version', () => {
    const index = readFileSync(join(PKG_DIR, 'src', 'index.ts'), 'utf8');
    expect(index).toMatch(/export const BUNDLE_VERSION = '0\.2\.0'/);
  });

  it('carries the three halves: skills, extension, constitution', () => {
    expect(existsSync(join(PKG_DIR, 'skills', 'setup-PMIStudio', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(PKG_DIR, 'extension', 'extension.yml'))).toBe(true);
    expect(existsSync(join(PKG_DIR, 'constitution', 'governed-execution.md'))).toBe(true);
  });

  it('is a vitest project named workspace-bundle, listed in test:unit and mapped by vitest-projects', () => {
    const workspace = readFileSync(join(REPO_ROOT, 'vitest.workspace.ts'), 'utf8');
    expect(workspace).toMatch(/name:\s*'workspace-bundle'/);
    expect(workspace).toMatch(/root:\s*'\.\/packages\/workspace-bundle'/);
    const root = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(root.scripts['test:unit']).toContain('--project workspace-bundle');
    const mapping = readFileSync(join(here, 'vitest-projects.spec.ts'), 'utf8');
    expect(mapping).toContain("'workspace-bundle': 'packages/workspace-bundle'");
  });

  it('adds no runtime dependency — the bundle is content, read by the platform and the agent', () => {
    expect(manifest()['dependencies'] ?? {}).toEqual({});
  });
});
