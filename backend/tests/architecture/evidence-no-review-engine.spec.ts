/**
 * T860f — this Epic performs no analysis of its own. `FR-EVS-043`, `FR-EVS-050`,
 * `ADR-0022`.
 *
 * PMI Studio consumes the findings of code-review, security and testing
 * products as evidence; it does not recreate their analysis, and it does not run
 * a second validation path beside `EPIC-015`. The evidence module therefore:
 *
 * - spawns no process and runs no test runner, scanner or linter;
 * - imports no analysis library;
 * - reads no source file to judge it.
 *
 * The one file read it is allowed is its own Contract definitions.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOTS = [resolve(here, '../../src/modules/evidence'), resolve(here, '../../../packages/evidence-contract/src')];

const files = ROOTS.flatMap((root) =>
  readdirSync(root)
    .filter((n) => n.endsWith('.ts'))
    .map((n) => ({ name: n, body: readFileSync(join(root, n), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '') })),
);

describe('T860f · FR-EVS-043 — no review, scanning or testing engine in this Epic', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('spawns no process', () => {
    const offenders = files.filter((f) => /node:child_process|\bexeca\b|\bspawn\(|\bexecFile\(|\bexec\(/.test(f.body));
    expect(offenders.map((f) => f.name)).toEqual([]);
  });

  it('imports no test runner, linter, scanner or static-analysis library', () => {
    const offenders = files.filter((f) =>
      /from\s+['"](vitest|jest|mocha|@playwright|playwright|eslint|typescript|@typescript-eslint|semgrep|snyk|trivy|sonar|@babel|acorn|esprima)/.test(
        f.body,
      ),
    );
    expect(offenders.map((f) => f.name)).toEqual([]);
  });

  it('reads files only to load its own Contract definitions', () => {
    const readers = files.filter((f) => /readFileSync|readFile\(|createReadStream/.test(f.body)).map((f) => f.name);
    expect(readers).toEqual(['contract.loader.ts']);
  });

  it('would notice a spawned scanner if one were added — the check checks itself', () => {
    expect(/node:child_process/.test("import { spawn } from 'node:child_process';")).toBe(true);
  });
});
