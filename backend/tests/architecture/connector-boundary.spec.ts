/**
 * `T1364` (EPIC-041) — the connector module can only ever authenticate and
 * scope (`FR-LPW-026`), and the converse for assurance (`FR-LPW-031`).
 *
 * No file under `backend/src/modules/connector/` imports a Room, a review
 * gate, or the access-grant service's mutation surface. And under
 * `backend/src/modules/{loop,policy,decisions,reviews}` the identifier
 * `assurance` does not appear — it is recorded by the registry and read by its
 * projection, and consulted by no rule (analysis `C3`).
 *
 * Written to FAIL before the module exists (the directory must have files).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const connector = walk(join(SRC, 'modules', 'connector')).map((p) => ({ rel: relative(SRC, p), body: readFileSync(p, 'utf8') }));

describe('T1364 · the connector module authenticates and scopes, nothing else (FR-LPW-026)', () => {
  it('exists and has source files to check', () => {
    expect(connector.length).toBeGreaterThan(0);
  });

  it('never imports a Room, a review gate, the loop, policy or decisions', () => {
    const forbidden = /from\s+['"][^'"]*\/(requirement-room|change-room|defect-room|rooms?|review|reviews|loop|policy|decisions)\//;
    const offenders = connector.filter((f) => forbidden.test(f.body)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('never reaches the access-grant service\'s mutation surface — grant() and revoke() on grants are not the connector\'s to call', () => {
    // The module may READ grants (the owner-grant check, FR-LPW-027) through a
    // narrow port. It may not import the enforcement or inheritance services,
    // and nothing in it calls grant()/revoke() on an access-grant service.
    const importsMutation = connector.filter((f) => /access-enforcement|access-inheritance|principal-delegation/.test(f.body)).map((f) => f.rel);
    expect(importsMutation).toEqual([]);
    const callsMutation = connector.filter((f) => /\b(grants|accessGrants|grantService)\.(grant|revoke)\(/.test(f.body)).map((f) => f.rel);
    expect(callsMutation).toEqual([]);
  });

  it('exposes exactly one connector scope in this Epic', () => {
    const scope = connector.find((f) => f.rel.endsWith('connector-scope.ts'));
    expect(scope, 'connector-scope.ts is the registry').toBeDefined();
    const registered = [...(scope?.body ?? '').matchAll(/registerConnectorScope\(\s*'([^']+)'/g)].map((m) => m[1]);
    expect(registered).toEqual(['connector.whoami']);
  });
});

describe('T1364 · assurance is recorded, never consulted by a rule (FR-LPW-031)', () => {
  it.each(['loop', 'policy', 'decisions', 'reviews'])('backend/src/modules/%s never names assurance', (module) => {
    const files = walk(join(SRC, 'modules', module));
    const offenders = files.filter((p) => /\bassurance\b/i.test(readFileSync(p, 'utf8'))).map((p) => relative(SRC, p));
    expect(offenders).toEqual([]);
  });
});
