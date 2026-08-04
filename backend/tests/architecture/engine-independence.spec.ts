/**
 * T047 + T142a — architecture enforcement.
 *
 * These are the tests that turn two claims into build failures:
 *
 *   FR-017 / SC-008 / ADR-0001 — nothing in `backend/src` may reference Spec
 *   Kit or any concrete engine adapter. Adapters are supplied at the WORKER's
 *   composition root.
 *
 *   PC-1 — services must be callable without HTTP, so an MCP transport can be
 *   added in Phase 3 without redesign.
 *
 * A claim like "the platform is engine-independent" decays silently unless
 * something fails when it stops being true. This is that something.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = walk(SRC).map((p) => ({ path: p, rel: relative(SRC, p), body: readFileSync(p, 'utf8') }));

describe('engine independence (FR-017, ADR-0001)', () => {
  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never imports an engine adapter package', () => {
    const offenders = files.filter((f) => /@pmi\/engine-adapter-/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never imports across the adapter directory boundary', () => {
    const offenders = files.filter((f) => /from\s+['"][^'"]*engine-adapters\//.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never names Spec Kit — not even as a string identifier', () => {
    // T142a widened this from imports to string identifiers and dynamic
    // imports, because `await import('...speckit')` would slip past an
    // import-only check.
    const offenders = files.filter((f) => /spec[\s_-]?kit/i.test(f.body) || /speckit/i.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never dynamically imports an adapter', () => {
    const offenders = files.filter((f) => /import\s*\(\s*['"][^'"]*engine-adapter/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('DOES depend on the engine contract — the boundary is a seam, not a wall', () => {
    // A false pass would be a backend that touches no engine concept at all.
    const usesContract = files.some((f) => /@pmi\/engine-contract/.test(f.body));
    expect(usesContract).toBe(true);
  });
});

describe('service / transport separation (PC-1)', () => {
  const services = files.filter(
    (f) => f.rel.endsWith('.service.ts') || f.rel.startsWith(`core${sep}`),
  );
  const TRANSPORT_ALLOWED = /\.(filter|guard|controller|module)\.ts$/;

  it('has services to check', () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it('services never import HTTP types', () => {
    const offenders = services
      .filter((f) => !TRANSPORT_ALLOWED.test(f.rel))
      .filter((f) => /from\s+['"](@nestjs\/common|@nestjs\/core|express)['"]/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('controllers exist and DO use the transport layer', () => {
    // Otherwise this suite would pass on a codebase with no transport at all.
    const controllers = files.filter((f) => f.rel.endsWith('.controller.ts'));
    expect(controllers.length).toBeGreaterThan(0);
    expect(controllers.some((c) => /@nestjs\/common/.test(c.body))).toBe(true);
  });
});
