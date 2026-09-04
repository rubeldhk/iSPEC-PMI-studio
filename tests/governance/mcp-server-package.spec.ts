/**
 * `T1398` (EPIC-043) — the `@pmi/mcp-server` package exists as the plan says, and
 * nothing more: a stdio server that depends on the protocol SDK, its schema
 * peer, and the contract package — never on the backend (`R-043-1`).
 *
 * Read as configuration, not executed: this is the conformance check
 * Constitution V asks for a package manifest and a test-project registration.
 * Written to FAIL before `T1399`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '../..');
const PKG_DIR = join(REPO_ROOT, 'packages', 'mcp-server');
const ALLOWED_RUNTIME_DEPS = ['@modelcontextprotocol/sdk', '@pmi/execution-registry-contract', 'zod'];

function manifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) as Record<string, unknown>;
}

describe('T1398 · packages/mcp-server is the package the plan describes', () => {
  it('exists with the name .mcp.json refers to', () => {
    expect(existsSync(join(PKG_DIR, 'package.json'))).toBe(true);
    expect(manifest()['name']).toBe('@pmi/mcp-server');
  });

  it('exposes a bin named pmi-studio', () => {
    const bin = manifest()['bin'] as Record<string, string> | string | undefined;
    expect(bin, 'package.json has no bin').toBeDefined();
    const entries = typeof bin === 'string' ? { 'pmi-studio': bin } : (bin ?? {});
    expect(Object.keys(entries)).toContain('pmi-studio');
    expect(existsSync(join(PKG_DIR, entries['pmi-studio'] as string))).toBe(true);
  });

  it('depends at runtime on exactly the SDK, zod and the contract package (R-043-1)', () => {
    const deps = Object.keys((manifest()['dependencies'] as Record<string, string> | undefined) ?? {}).sort();
    expect(deps).toEqual([...ALLOWED_RUNTIME_DEPS].sort());
  });

  it('pins the SDK to the 1.x line (R-043-2)', () => {
    const deps = manifest()['dependencies'] as Record<string, string>;
    expect(deps['@modelcontextprotocol/sdk']).toMatch(/^\^1\./);
    expect(deps['zod']).toMatch(/^\^3\./);
  });

  it('has a tsconfig and a main entry', () => {
    expect(existsSync(join(PKG_DIR, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(PKG_DIR, 'src', 'main.ts'))).toBe(true);
  });

  it('is a vitest project named mcp-server, listed in test:unit and mapped by vitest-projects', () => {
    const workspace = readFileSync(join(REPO_ROOT, 'vitest.workspace.ts'), 'utf8');
    expect(workspace).toMatch(/name:\s*'mcp-server'/);
    expect(workspace).toMatch(/root:\s*'\.\/packages\/mcp-server'/);
    const root = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(root.scripts['test:unit']).toContain('--project mcp-server');
    const mapping = readFileSync(join(here, 'vitest-projects.spec.ts'), 'utf8');
    expect(mapping).toContain("'mcp-server': 'packages/mcp-server'");
  });
});
