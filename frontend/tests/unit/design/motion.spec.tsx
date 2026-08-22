/**
 * T875 (EPIC-029) — `prefers-reduced-motion: reduce` zeroes motion without
 * touching layout (spec Edge Cases).
 *
 * jsdom cannot evaluate the media query, so this is a source conformance
 * assertion over tokens.css: the reduced-motion block must zero every motion
 * token and declare NOTHING else — a block that also set a size or a margin
 * would be the "changing layout" failure this test names.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(here, '../../../src/design/tokens.css'), 'utf8');

function mediaBlock(css: string, query: string): string | null {
  const at = css.indexOf(query);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  let depth = 1;
  for (let i = open + 1; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

describe('T875 · reduced motion zeroes durations and only durations', () => {
  const block = mediaBlock(tokensCss, '@media (prefers-reduced-motion: reduce)');

  it('tokens.css carries a prefers-reduced-motion block', () => {
    expect(block, 'no @media (prefers-reduced-motion: reduce) in tokens.css').not.toBeNull();
  });

  it('every motion token resolves to zero under it', () => {
    const motionTokens = [...tokensCss.matchAll(/(--motion-[a-z]+)\s*:/g)]
      .map((m) => m[1] as string)
      .filter((name, i, all) => all.indexOf(name) === i);
    expect(motionTokens.length, 'no motion tokens declared at all').toBeGreaterThan(0);

    const unzeroed = motionTokens.filter(
      (name) => !new RegExp(`${name}\\s*:\\s*0m?s\\s*;`).test(block ?? ''),
    );
    expect(unzeroed, 'motion tokens not zeroed under reduced motion').toEqual([]);
  });

  it('the block declares nothing but motion tokens — layout untouched', () => {
    const decls = [...(block ?? '').matchAll(/([a-z-]*--?[a-z][a-z0-9-]*)\s*:/g)].map(
      (m) => m[1] as string,
    );
    const nonMotion = decls.filter((d) => !d.startsWith('--motion-'));
    expect(nonMotion, 'reduced motion must change durations, never layout').toEqual([]);
  });
});
