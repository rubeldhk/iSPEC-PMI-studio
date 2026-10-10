/**
 * `T2303` (EPIC-048) — the contract package exists, type-checks, exports its
 * vocabulary, and runs as its own Vitest project (`R-048-2`).
 *
 * The project registration is asserted because a package whose tests no project
 * collects is a package whose tests never run — the T537/T539 rule: a project is
 * registered in the same change as the first spec that fills it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as contract from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const REPO = resolve(ROOT, '..', '..');

describe('T2303 · @pmi/learning-contract', () => {
  it('exports CANDIDATE_STATES from its entry point', () => {
    expect(contract.CANDIDATE_STATES).toBeDefined();
  });

  it('is a workspace package named @pmi/learning-contract', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { name: string; main: string };
    expect(pkg.name).toBe('@pmi/learning-contract');
    expect(pkg.main).toBe('./src/index.ts');
  });

  it('runs as its own `learning-contract` project in vitest.workspace.ts', () => {
    const workspace = readFileSync(resolve(REPO, 'vitest.workspace.ts'), 'utf8');
    expect(workspace).toMatch(/name:\s*'learning-contract',\s*\n\s*root:\s*'\.\/packages\/learning-contract'/);
  });

  it('type-checks on its own (tsc --noEmit)', () => {
    const tsc = resolve(REPO, 'node_modules', 'typescript', 'bin', 'tsc');
    expect(() =>
      execFileSync(process.execPath, [tsc, '--noEmit', '-p', resolve(ROOT, 'tsconfig.json')], { stdio: 'pipe' }),
    ).not.toThrow();
  }, 120_000);
});
