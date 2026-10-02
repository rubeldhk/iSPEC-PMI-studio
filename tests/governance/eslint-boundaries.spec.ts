/**
 * T540 — the dependency-boundary rule covers the two new adapter families.
 *
 * `ADR-0001` established that a boundary claim decays silently unless something
 * fails when it stops being true. ESLint catches it in the editor; the
 * architecture test fails the build. Both must know about `agent-adapters/*`
 * and `execution-providers/*`, or the new seams are enforced by nobody.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const config = readFileSync(join(ROOT, 'eslint.config.js'), 'utf8');

/** The `no-restricted-imports` block that applies to `backend/**`. */
const backendRule = config.slice(config.indexOf('no-restricted-imports'));

describe('T540 · backend may not import an adapter or a provider', () => {
  it.each([
    ['engine adapters', '@pmi/engine-adapter-*', 'engine-adapters/*'],
    ['agent adapters', '@pmi/agent-adapter-*', 'agent-adapters/*'],
    ['execution providers', '@pmi/execution-provider-*', 'execution-providers/*'],
  ])('forbids %s', (_label, pkgPattern, pathPattern) => {
    expect(backendRule, `${pkgPattern} is not restricted`).toContain(pkgPattern);
    expect(backendRule, `${pathPattern} is not restricted`).toContain(pathPattern);
  });

  it('permits the three contracts — the boundary is a seam, not a wall', () => {
    for (const contract of [
      '@pmi/engine-contract',
      '@pmi/agent-contract',
      '@pmi/execution-contract',
    ]) {
      // A restricted *contract* would mean backend could not depend on the
      // abstraction at all, which is the opposite of what ADR-0001 wants.
      expect(backendRule).not.toContain(`'${contract}'`);
    }
  });
});

describe('T540 · the rule carries its reason', () => {
  it('names the requirement each restriction defends', () => {
    // A rule whose message is "not allowed" teaches nobody why.
    expect(config).toMatch(/FR-017|ADR-0001/);
    expect(config).toMatch(/Native §3|agent-contract/);
  });
});

/**
 * `T1322` (EPIC-041) — the one permitted worker → backend edge, and only that one.
 *
 * `R-041-6`. The worker reaches the platform's persistence through a narrow,
 * exported barrel — `@pmi/backend/worker-api` — so a generation it completes is
 * committed by the same code the API uses. Every other worker → backend import
 * stays forbidden, and backend → worker stays forbidden entirely: the edge points
 * one way, and it is two exports wide.
 */
describe('T1322 · worker may import exactly @pmi/backend/worker-api', () => {
  /** The `no-restricted-imports` block that applies to `worker/**`. */
  const workerRule = (() => {
    const at = config.indexOf("files: ['worker/**/*.ts']");
    expect(at, 'eslint.config.js has no worker/** rule').toBeGreaterThan(-1);
    return config.slice(at, config.indexOf('files:', at + 10) === -1 ? undefined : config.indexOf('files:', at + 10));
  })();

  it('forbids every other backend path', () => {
    expect(workerRule).toContain('@pmi/backend/*');
    expect(workerRule).toContain('**/backend/*');
  });

  it('exempts the barrel by name', () => {
    expect(workerRule).toContain("'!@pmi/backend/worker-api'");
  });

  it('and backend never imports the worker', () => {
    expect(backendRule).toContain('@pmi/worker');
    expect(backendRule).toContain('**/worker/*');
  });

  it('names the decision the edge rests on', () => {
    expect(config).toMatch(/R-041-6|worker-api/);
  });
});

/**
 * `T1401` (EPIC-043, `R-043-1`) — the `pmi-studio` server may reach the platform
 * only over HTTP. The lint rule is the editor-time half of
 * `backend/tests/architecture/mcp-server-boundary.spec.ts`.
 */
describe('T1401 · packages/mcp-server may import only the SDK, zod and the contract packages', () => {
  const rule = (() => {
    const at = config.indexOf("files: ['packages/mcp-server/**/*.ts']");
    expect(at, 'eslint.config.js has no packages/mcp-server rule').toBeGreaterThan(-1);
    return config.slice(at, config.indexOf('files:', at + 10) === -1 ? undefined : config.indexOf('files:', at + 10));
  })();

  it.each(['@pmi/backend', '@pmi/worker', '@prisma/client', '**/persistence/*', '**/engine-adapters/*', '**/execution-providers/*'])(
    'forbids %s',
    (group) => {
      expect(rule).toContain(`'${group}'`);
    },
  );

  it('names the reason', () => {
    expect(rule).toContain('REST client');
  });
});
