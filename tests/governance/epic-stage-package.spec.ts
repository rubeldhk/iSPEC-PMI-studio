/**
 * `T1549` (EPIC-044) — the stage derivation is a tested package with one home.
 *
 * `R-06` (PMI-DOC-007 §11): the repository's governance register and the
 * product's Spec Journey Board must not drift in what a stage means, so the
 * rule lives in `packages/epic-stage` and both import it. Read as
 * configuration, not executed: a package manifest with no runtime dependency,
 * a Vitest project registration, the `vitest-projects` mapping and the
 * repository layout entry (`G-05d`). Written to FAIL before `T1550`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '../..');
const PKG_DIR = join(REPO_ROOT, 'packages', 'epic-stage');

function manifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) as Record<string, unknown>;
}

describe('T1549 · packages/epic-stage is the shared derivation package the plan describes', () => {
  it('is @pmi/epic-stage at 0.1.0, private, with test and typecheck scripts', () => {
    expect(manifest()['name']).toBe('@pmi/epic-stage');
    expect(manifest()['version']).toBe('0.1.0');
    expect(manifest()['private']).toBe(true);
    const scripts = (manifest()['scripts'] as Record<string, string> | undefined) ?? {};
    expect(scripts['test']).toMatch(/vitest/);
    expect(scripts['typecheck']).toMatch(/tsc/);
  });

  it('adds no runtime dependency — one rule, importable by the register and the platform alike (FR-EPB-014)', () => {
    expect(manifest()['dependencies'] ?? {}).toEqual({});
  });

  it('carries its own configuration document and an index', () => {
    expect(existsSync(join(PKG_DIR, 'epic-stage.config.json'))).toBe(true);
    expect(existsSync(join(PKG_DIR, 'src', 'index.ts'))).toBe(true);
  });

  it('is a vitest project named epic-stage, listed in test:unit and mapped by vitest-projects', () => {
    const workspace = readFileSync(join(REPO_ROOT, 'vitest.workspace.ts'), 'utf8');
    expect(workspace).toMatch(/name:\s*'epic-stage'/);
    expect(workspace).toMatch(/root:\s*'\.\/packages\/epic-stage'/);
    const root = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(root.scripts['test:unit']).toContain('--project epic-stage');
    const mapping = readFileSync(join(here, 'vitest-projects.spec.ts'), 'utf8');
    expect(mapping).toContain("'epic-stage': 'packages/epic-stage'");
  });

  it('is registered in the repository layout (G-05d)', () => {
    const layout = readFileSync(join(REPO_ROOT, 'governance', 'repository-layout.md'), 'utf8');
    expect(layout).toContain('`packages/epic-stage/`');
  });
});
