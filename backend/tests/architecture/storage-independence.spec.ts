/**
 * T432 — storage independence enforcement (SC-011, contract rule S3),
 * mirroring T047 for engines.
 *
 * Nothing in `backend/src` may name a storage provider SDK, package, or
 * provider string. Providers are supplied on the PROVIDER_REGISTRY token at
 * the composition root. Without a build-failing test this boundary erodes
 * under delivery pressure exactly as engine independence would have
 * (RAID R-05).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
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

describe('storage independence (SC-011, S3)', () => {
  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never imports a storage adapter package', () => {
    const offenders = files.filter((f) => /@pmi\/storage-adapter-/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never imports across the storage-adapters directory boundary', () => {
    const offenders = files.filter((f) => /from\s+['"][^'"]*storage-adapters\//.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never names a storage provider SDK, package, or provider string', () => {
    // The names a real integration would inevitably introduce. Widened as
    // providers are considered; the FIXTURE name is allowed — it is the
    // contract's own test double, and even that may only be WIRED, never
    // imported (the two tests above).
    const providerNames =
      /google[\s_-]?drive|googleapis|dropbox|onedrive|sharepoint|aws[\s_-]?s3|aws-sdk|amazonaws|azure[\s_-]?blob|backblaze|box\.com/i;
    const offenders = files.filter((f) => providerNames.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never dynamically imports a storage adapter', () => {
    const offenders = files.filter((f) => /import\s*\(\s*['"][^'"]*storage-adapter/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('DOES depend on the storage contract — the boundary is a seam, not a wall', () => {
    const usesContract = files.some((f) => /@pmi\/storage-contract/.test(f.body));
    expect(usesContract).toBe(true);
  });
});
