/**
 * `T1400` (EPIC-043, `R-043-1`) — the `pmi-studio` server is a REST client and
 * nothing else. It runs on the user's machine, where the API's process is not,
 * so it MUST NOT reach the backend, a store, a Prisma client or an engine
 * adapter in-process. If it could, "parity between the bindings" would be a
 * claim about discipline; because it cannot, it is a claim about structure.
 *
 * Two halves: the sources under `packages/mcp-server/src/` import only from an
 * allow-list, and `eslint.config.js` says the same thing at lint time so an
 * editor shows the refusal before this test does.
 *
 * Written to FAIL before `T1399`/`T1401` (the package and the rule are absent).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '../../..');
const SRC = join(REPO_ROOT, 'packages', 'mcp-server', 'src');

const ALLOWED = [
  /^@modelcontextprotocol\/sdk(\/|$)/,
  /^zod(\/|$)/,
  /^node:/,
  /^@pmi\/execution-registry-contract(\/|$)/,
  /^@pmi\/execution-contract(\/|$)/,
  /^\.\.?\//, // the package's own files
];

const FORBIDDEN = [
  /@pmi\/backend/,
  /@pmi\/worker/,
  /@prisma\/client/,
  /\/persistence\//,
  /\.store(\.js)?['"]/,
  /engine-adapters\//,
  /execution-providers\//,
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function imports(body: string): string[] {
  const found: string[] = [];
  const re = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) found.push(m[1] as string);
  return found;
}

describe('T1400 · packages/mcp-server never reaches the backend in-process (R-043-1)', () => {
  const files = walk(SRC).map((p) => ({ rel: relative(REPO_ROOT, p), body: readFileSync(p, 'utf8') }));

  it('has sources to check', () => {
    expect(files.length, 'packages/mcp-server/src holds no .ts files').toBeGreaterThan(0);
  });

  it('imports only the SDK, zod, node built-ins, the two contract packages and itself', () => {
    const offenders = files.flatMap((f) =>
      imports(f.body)
        .filter((spec) => !ALLOWED.some((rule) => rule.test(spec)))
        .map((spec) => `${f.rel} → ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it('names no backend, worker, Prisma, persistence, store or adapter path — not even in a string', () => {
    const offenders = files.filter((f) => FORBIDDEN.some((rule) => rule.test(f.body))).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('eslint.config.js restricts packages/mcp-server the same way (T1401)', () => {
    const config = readFileSync(join(REPO_ROOT, 'eslint.config.js'), 'utf8');
    const at = config.indexOf("files: ['packages/mcp-server/**/*.ts']");
    expect(at, 'eslint.config.js has no packages/mcp-server rule').toBeGreaterThan(-1);
    const block = config.slice(at, config.indexOf('files:', at + 10) === -1 ? undefined : config.indexOf('files:', at + 10));
    for (const group of ['@pmi/backend', '@pmi/worker', '@prisma/client', '**/persistence/*', '**/engine-adapters/*']) {
      expect(block, `rule does not forbid ${group}`).toContain(group);
    }
  });
});
