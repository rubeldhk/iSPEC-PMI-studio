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
