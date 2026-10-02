/**
 * `T1377` (EPIC-041) — every component under `frontend/src/components/` is
 * imported by at least one page or area view (`FR-LPW-044`; the inverse of
 * `DEF-010-001`).
 *
 * `R-041-11` counted six components that were built, tested, and reachable
 * from nowhere: `AccessGrants`, `JobProgress`, `LifecycleControls`,
 * `ValidationFindings`, `VersionDiff`, `VersionHistory`. A component nobody
 * mounts is a claim in a closure report, not a feature. Written to FAIL today
 * for the six; `T1376` mounts five, `T1381` the sixth.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

const components = readdirSync(join(SRC, 'components'))
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => basename(f, '.tsx'));

/** Pages and area views — the surfaces a user reaches. Tests and the components themselves do not count. */
const mounters = [...walk(join(SRC, 'pages')), ...walk(join(SRC, 'shell'))].map((p) => readFileSync(p, 'utf8'));

describe('T1377 · every component is mounted by a page or an area view', () => {
  it('has components and mounters to check', () => {
    expect(components.length).toBeGreaterThanOrEqual(8);
    expect(mounters.length).toBeGreaterThan(0);
  });

  it.each(components)('%s is imported by at least one page or area view', (name) => {
    const pattern = new RegExp(`from\\s+['"][^'"]*components/${name}['"]`);
    expect(mounters.some((source) => pattern.test(source)), `${name} is built but mounted nowhere`).toBe(true);
  });
});
