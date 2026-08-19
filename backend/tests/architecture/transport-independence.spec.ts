/**
 * T142a — service / transport separation (PC-1).
 *
 * Services must be callable without HTTP, so an MCP transport can be added in
 * Phase 3 without redesign. If application logic only exists behind a route,
 * the worker has to talk to its own process over a socket and every test needs
 * a server.
 *
 * Split out of `engine-independence.spec.ts` by EPIC-003. The two files enforce
 * different constraints — one is about WHICH engine, the other about WHETHER
 * HTTP is required — and holding both in a file named for the first is how the
 * second gets lost. This also resolves a three-way disagreement about where
 * T142a lived, between tasks.md, plan.md, and the code.
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

const files = walk(SRC).map((p) => ({ rel: relative(SRC, p), body: readFileSync(p, 'utf8') }));

const services = files.filter(
  (f) => f.rel.endsWith('.service.ts') || f.rel.startsWith(`core${sep}`),
);

/** The transport layer is allowed — and expected — to know about HTTP. */
const TRANSPORT_ALLOWED = /\.(filter|guard|controller|module)\.ts$/;

const HTTP_IMPORT = /from\s+['"](@nestjs\/common|@nestjs\/core|express|fastify)['"]/;

describe('service / transport separation (PC-1)', () => {
  it('has services to check', () => {
    // Without this the suite would pass on an empty tree, which is the failure
    // mode of every architecture test nobody notices has stopped running.
    expect(services.length).toBeGreaterThan(0);
  });

  it('services never import HTTP types', () => {
    const offenders = services
      .filter((f) => !TRANSPORT_ALLOWED.test(f.rel))
      .filter((f) => HTTP_IMPORT.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('services never reference a request or response object', () => {
    const offenders = services
      .filter((f) => !TRANSPORT_ALLOWED.test(f.rel))
      .filter((f) => /\b(Request|Response|@Req\(|@Res\()\b/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('services never read an HTTP status code', () => {
    // A service choosing a status code has taken a transport decision, and the
    // next transport will need a different one.
    const offenders = services
      .filter((f) => !TRANSPORT_ALLOWED.test(f.rel))
      .filter((f) => /\bHttpStatus\b|\bstatusCode\b/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('controllers exist and DO use the transport layer', () => {
    // Otherwise this suite would pass on a codebase with no transport at all.
    const controllers = files.filter((f) => f.rel.endsWith('.controller.ts'));
    expect(controllers.length).toBeGreaterThan(0);
    expect(controllers.some((c) => /@nestjs\/common/.test(c.body))).toBe(true);
  });

  it('the engine registry and resolver are callable without HTTP', () => {
    // EPIC-003's own contribution to backend/src, asserted explicitly: these
    // are what the worker calls, and the worker has no HTTP layer at all.
    // The module file is excluded on purpose: wiring is the transport layer's
    // job, and it is exactly BECAUSE engines.module.ts holds the Nest
    // decorators that the services themselves need none.
    const engines = files
      .filter((f) => f.rel.startsWith(`modules${sep}engines${sep}`))
      .filter((f) => !TRANSPORT_ALLOWED.test(f.rel));
    expect(engines.length).toBeGreaterThan(0);
    for (const file of engines) {
      expect(HTTP_IMPORT.test(file.body), `${file.rel} imports an HTTP type`).toBe(false);
    }
  });
});
