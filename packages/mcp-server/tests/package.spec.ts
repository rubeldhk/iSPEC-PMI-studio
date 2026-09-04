/**
 * `T1399` (EPIC-043) — the package is what `.mcp.json` runs.
 *
 * `T537` requires every `test:unit` project to collect at least one test from
 * its first commit; this is that test. It reads the manifest the way the
 * agent's package runner will, and the `bin` the way `npx` will.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
  name: string;
  bin: Record<string, string>;
  dependencies: Record<string, string>;
};

describe('T1399 · @pmi/mcp-server manifest', () => {
  it('is the package name EPIC-041 writes into .mcp.json', () => {
    expect(manifest.name).toBe('@pmi/mcp-server');
  });

  it('runs as pmi-studio', () => {
    expect(existsSync(join(here, '..', manifest.bin['pmi-studio'] as string))).toBe(true);
  });

  it('depends on the protocol SDK 1.x line (R-043-2)', () => {
    expect(manifest.dependencies['@modelcontextprotocol/sdk']).toMatch(/^\^1\./);
  });
});
