/**
 * T1094 (EPIC-030 Phase C2A) — the adjudication boundary.
 *
 * `FR-GEL-073`. Two properties, both enforced by the module graph rather than
 * by review:
 *
 * 1. **A consumer can use the adjudication contract without importing this
 *    Epic's internals.** `EPIC-037` depends on `@pmi/loop-contract`; if it had
 *    to reach into `backend/src/modules/loop/**` the boundary would exist only
 *    on paper.
 * 2. **No connector can invoke EPIC-009's lifecycle service directly** to
 *    bypass adjudication. A governed transition that skips the adjudicator is
 *    exactly the hole Principle XII closes.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// backend/tests/architecture -> repository root is four levels up.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Every TypeScript source under a directory, excluding build output. */
function sourcesUnder(dir: string, found: string[] = []): string[] {
  if (!existsSync(dir)) return found;
  const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage']);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourcesUnder(full, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(relative(ROOT, full).split(sep).join('/'));
  }
  return found;
}

/** Source with comments stripped — what actually imports. */
function liveCode(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const CONTRACT = sourcesUnder(join(ROOT, 'packages', 'loop-contract', 'src'));

describe('T1094 · the contract package reaches nothing it should not', () => {
  it('reads a real set of contract sources, or this proves nothing', () => {
    expect(CONTRACT.length, 'no loop-contract sources were walked').toBeGreaterThan(3);
    expect(CONTRACT, 'adjudication.ts is missing from the contract package').toContain(
      'packages/loop-contract/src/adjudication.ts',
    );
  });

  it('imports no backend module, no store and no Prisma client', () => {
    const offenders: string[] = [];
    for (const rel of CONTRACT) {
      const live = liveCode(readFileSync(join(ROOT, rel), 'utf8'));
      for (const banned of ['backend/src', '@prisma/client', '.store', 'nestjs']) {
        if (new RegExp(`from\\s+['"][^'"]*${banned.replace('/', '\\/')}`, 'i').test(live)) {
          offenders.push(`${rel} -> ${banned}`);
        }
      }
    }
    expect(
      offenders,
      `the contract package reaches into an implementation:\n  ${offenders.join('\n  ')}\n` +
        'EPIC-037 depends on this package; anything it can reach, EPIC-037 can reach.',
    ).toEqual([]);
  });
});

describe('T1094 · nothing bypasses adjudication to reach EPIC-009', () => {
  /**
   * Paths that are permitted to call the specification lifecycle service.
   *
   * `EPIC-009` owns it, and this Epic's adapter is the one governed caller.
   * Anything else invoking `transition()` is a bypass, whatever its intent.
   */
  const PERMITTED = [
    'backend/src/modules/specifications/',
    'backend/src/modules/loop/lifecycle-application.adapter.ts',
  ];

  const CANDIDATES = [
    ...sourcesUnder(join(ROOT, 'packages')),
    ...sourcesUnder(join(ROOT, 'backend', 'src')),
  ].filter((rel) => !PERMITTED.some((p) => rel.startsWith(p)));

  it('finds sources to check, or this proves nothing', () => {
    expect(CANDIDATES.length, 'no candidate sources were walked').toBeGreaterThan(50);
  });

  it('no connector or package calls SpecificationLifecycleService.transition directly', () => {
    const offenders: string[] = [];
    for (const rel of CANDIDATES) {
      const live = liveCode(readFileSync(join(ROOT, rel), 'utf8'));
      if (/SpecificationLifecycleService|lifecycle-api\.service/.test(live)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `a path outside EPIC-009 and the governed adapter reaches the lifecycle service:\n  ` +
        `${offenders.join('\n  ')}\n` +
        'A transition that skips adjudication is the hole Principle XII closes.',
    ).toEqual([]);
  });

  it('the permitted adapter really does call it — or the rule above guards nothing', () => {
    // Anti-vacuity from the other side. If no path called the lifecycle
    // service at all, the assertion above would pass over an empty world.
    const adapter = readFileSync(
      join(ROOT, 'backend/src/modules/loop/lifecycle-application.adapter.ts'),
      'utf8',
    );
    expect(adapter, 'the governed adapter does not reach EPIC-009 at all').toMatch(
      /transition\(/,
    );
  });
});
