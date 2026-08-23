/**
 * T868/T870/T872/T882 (EPIC-029) — the token layer's conformance check.
 *
 * Tokens are configuration, so Constitution V pairs them with a check that can
 * fail rather than a unit test (spec `FR-DS-002`, `FR-DS-010`, `SC-DS-007`).
 * Three things are asserted, each failing with the offending name:
 *
 *  - shape: every token declared exactly once, named `--<category>-<scale>`
 *    per contracts/tokens.md; the space scale a fixed ratio; the type scale
 *    at most seven steps, each with size, line and weight (T868);
 *  - completeness: every themed token valued in light AND dark, in all three
 *    theme blocks, with no drift between the attribute and media dark blocks
 *    (T870);
 *  - contrast: WCAG 2.2 AA computed from the values for every declared
 *    text-on-surface pair in both themes (T872), and the focus indicator at
 *    3:1 against every surface (T882). Computed, never asked of axe — jsdom
 *    has no layout, so axe's color-contrast rule returns `incomplete`
 *    (research R-029-3).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');

const tokensCss = readFileSync(join(ROOT, 'frontend/src/design/tokens.css'), 'utf8');
const themesCss = readFileSync(join(ROOT, 'frontend/src/design/themes.css'), 'utf8');

// ---------------------------------------------------------------------------
// A regex-scale CSS reader. The two files are owned by this Epic and written
// in a fixed shape (custom properties inside simple blocks), so a parser
// dependency would be surface without safety.
// ---------------------------------------------------------------------------

/** Return the body of the block opened by `selector`, brace-balanced. */
function blockBody(css: string, selector: string): string | null {
  const at = css.indexOf(selector);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  if (open === -1) return null;
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

/** All `--token: value` declarations in a block body, in order. */
function declarations(body: string): Array<[string, string]> {
  return [...body.matchAll(/(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);/g)].map((m) => [
    m[1] as string,
    (m[2] as string).trim(),
  ]);
}

/** tokens.css outside its @media blocks — the base :root declarations. */
const tokensBase = ((): string => {
  const withoutMedia = tokensCss.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
  return blockBody(withoutMedia, ':root') ?? '';
})();

const baseDecls = declarations(tokensBase);
const baseNames = baseDecls.map(([name]) => name);
const baseValues = new Map(baseDecls);

const CATEGORIES = ['color', 'space', 'type', 'radius', 'elevation', 'motion'] as const;
/** Themed categories per contracts/tokens.md: color always, elevation for dark shadows. */
const themedTokens = baseNames.filter((n) => n.startsWith('--color-') || n.startsWith('--elevation-'));

// Theme blocks. Light and dark attribute blocks are the explicit override;
// the media block is the OS default for users who never chose (FR-DS-011).
const lightBlock = blockBody(themesCss, ":root[data-theme='light']");
const darkAttrBlock = blockBody(themesCss, ":root[data-theme='dark']");
const darkMediaBlock = ((): string | null => {
  const media = blockBody(themesCss, '@media (prefers-color-scheme: dark)');
  return media ? blockBody(media, ":root:not([data-theme='light'])") : null;
})();

const lightValues = new Map(lightBlock ? declarations(lightBlock) : []);
const darkValues = new Map(darkAttrBlock ? declarations(darkAttrBlock) : []);
const darkMediaValues = new Map(darkMediaBlock ? declarations(darkMediaBlock) : []);

// ---------------------------------------------------------------------------
// T868 — shape
// ---------------------------------------------------------------------------

describe('T868 · every token is declared exactly once, in contract shape', () => {
  it('the token layer is not empty', () => {
    expect(baseNames.length, 'tokens.css declares no tokens').toBeGreaterThan(0);
  });

  it('no token is declared twice (FR-DS-002)', () => {
    const seen = new Set<string>();
    const dupes = baseNames.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    expect(dupes, 'declared more than once in tokens.css').toEqual([]);
  });

  it('every token belongs to a contract category, in contract shape', () => {
    const SHAPES: Record<string, RegExp> = {
      color: /^--color-[a-z]+(-[a-z]+)*$/,
      space: /^--space-[0-8]$/,
      type: /^--type-[1-7]-(size|line|weight)$/,
      radius: /^--radius-(sm|md|lg|full)$/,
      elevation: /^--elevation-[0-3]$/,
      motion: /^--motion-(fast|base|slow)$/,
    };
    const misshapen = baseNames.filter((n) => {
      const category = CATEGORIES.find((c) => n.startsWith(`--${c}-`));
      return !category || !SHAPES[category]!.test(n);
    });
    expect(misshapen, 'not `--<category>-<scale>` per contracts/tokens.md').toEqual([]);
  });

  it('the space scale is a fixed ratio (FR-DS-003)', () => {
    expect(baseValues.get('--space-0'), '--space-0 anchors the scale at zero').toBe('0');
    const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const v = baseValues.get(`--space-${i}`);
      expect(v, `--space-${i} is missing`).toBeDefined();
      return Number.parseFloat(v as string);
    });
    const ratio = steps[1]! / steps[0]!;
    for (let i = 2; i < steps.length; i += 1) {
      expect(
        steps[i]! / steps[i - 1]!,
        `--space-${i + 1} breaks the fixed ratio ${ratio}`,
      ).toBeCloseTo(ratio, 6);
    }
  });

  it('the type scale has at most seven steps, each complete (FR-DS-004)', () => {
    const steps = new Set(
      baseNames
        .filter((n) => n.startsWith('--type-'))
        .map((n) => /^--type-(\d)-/.exec(n)?.[1])
        .filter((s): s is string => s !== undefined),
    );
    expect(steps.size, 'the type scale is empty').toBeGreaterThan(0);
    expect(steps.size, 'more than seven type steps (seven is a ceiling)').toBeLessThanOrEqual(7);
    for (const step of steps) {
      for (const part of ['size', 'line', 'weight']) {
        expect(
          baseValues.has(`--type-${step}-${part}`),
          `--type-${step}-${part} is missing — every step carries size, line and weight`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// T870 — theme completeness
// ---------------------------------------------------------------------------

describe('T870 · every themed token has a value in light AND dark (FR-DS-010)', () => {
  it('themes.css carries all three theme blocks', () => {
    expect(lightBlock, ":root[data-theme='light'] block missing").not.toBeNull();
    expect(darkAttrBlock, ":root[data-theme='dark'] block missing").not.toBeNull();
    expect(
      darkMediaBlock,
      "@media (prefers-color-scheme: dark) :root:not([data-theme='light']) block missing — the OS default (FR-DS-011)",
    ).not.toBeNull();
  });

  it('there is at least one themed token to complete', () => {
    expect(themedTokens.length).toBeGreaterThan(0);
  });

  it('no themed token is missing from a theme', () => {
    const missing: string[] = [];
    for (const token of themedTokens) {
      if (!lightValues.has(token)) missing.push(`${token} (light)`);
      if (!darkValues.has(token)) missing.push(`${token} (dark)`);
      if (!darkMediaValues.has(token)) missing.push(`${token} (dark, OS default)`);
    }
    expect(missing, 'themed token without a value in every theme block').toEqual([]);
  });

  it('the two dark blocks agree exactly — the OS default cannot drift from the override', () => {
    const drifted = themedTokens.filter(
      (t) => darkValues.get(t) !== darkMediaValues.get(t),
    );
    expect(drifted, 'different value in the attribute and media dark blocks').toEqual([]);
  });

  it('the base declaration IS the light value — one source, not two', () => {
    const drifted = themedTokens.filter((t) => baseValues.get(t) !== lightValues.get(t));
    expect(drifted, 'tokens.css default differs from the explicit light theme').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T872/T882 — contrast, computed from the values (research R-029-3)
// ---------------------------------------------------------------------------

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: '${hex}' — contrast is computed, so colour tokens are hex`);
  const channel = (offset: number): number => {
    const c = Number.parseInt(m[1]!.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(fg: string, bg: string): number {
  const [l1, l2] = [luminance(fg), luminance(bg)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * The declared text-on-surface pairs (SC-DS-007). Adding a colour token that
 * text will sit on a surface means adding its pair here — the check knows
 * only what is declared, which is why the pair list lives in the check.
 */
const TEXT_ON_SURFACE: Array<[fg: string, bg: string]> = [
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-surface-raised'],
  ['--color-text-muted', '--color-surface'],
  ['--color-text-muted', '--color-surface-raised'],
  ['--color-accent', '--color-surface'],
  ['--color-accent', '--color-surface-raised'],
  ['--color-danger', '--color-surface'],
  ['--color-danger', '--color-surface-raised'],
  ['--color-success', '--color-surface'],
  ['--color-success', '--color-surface-raised'],
  ['--color-warning', '--color-surface'],
  ['--color-warning', '--color-surface-raised'],
  ['--color-on-accent', '--color-accent'],

  // T925 (Phase 9) — the canvas the prototype puts behind its surfaces
  // (parity row 1). A page ground is a surface text sits on, so it earns the
  // same pairs the others carry.
  ['--color-text', '--color-canvas'],
  ['--color-text-muted', '--color-canvas'],
  ['--color-accent', '--color-canvas'],
  ['--color-danger', '--color-canvas'],
  ['--color-success', '--color-canvas'],
  ['--color-warning', '--color-canvas'],

  // T925 — the tinted grounds (parity row 2). Each tone sits on its own tint;
  // that pair is the whole point of the token, so it is the pair checked.
  ['--color-accent', '--color-accent-subtle'],
  ['--color-success', '--color-success-subtle'],
  ['--color-warning', '--color-warning-subtle'],
  ['--color-danger', '--color-danger-subtle'],
  ['--color-text', '--color-accent-subtle'],
];

const THEMES: Array<[name: string, values: Map<string, string>]> = [
  ['light', lightValues],
  ['dark', darkValues],
];

describe('T872 · every declared text-on-surface pair meets WCAG 2.2 AA in both themes', () => {
  it.each(THEMES)('%s theme: every pair ≥ 4.5:1', (theme, values) => {
    const failures: string[] = [];
    for (const [fg, bg] of TEXT_ON_SURFACE) {
      const [fgv, bgv] = [values.get(fg), values.get(bg)];
      if (!fgv || !bgv) {
        failures.push(`${fg} on ${bg} (${theme}): token missing`);
        continue;
      }
      const ratio = contrast(fgv, bgv);
      if (ratio < 4.5) failures.push(`${fg} on ${bg} (${theme}): ${ratio.toFixed(2)}:1 < 4.5:1`);
    }
    expect(failures, 'pairs below WCAG 2.2 AA, with computed ratios').toEqual([]);
  });
});

describe('T882 · the focus indicator meets 3:1 against every surface (FR-DS-033)', () => {
  it('tokens.css carries a :focus-visible treatment driven by --color-focus', () => {
    const focusRule = blockBody(tokensCss, ':focus-visible');
    expect(focusRule, 'no :focus-visible rule in tokens.css').not.toBeNull();
    expect(focusRule).toContain('var(--color-focus)');
  });

  it.each(THEMES)('%s theme: --color-focus ≥ 3:1 on every surface', (theme, values) => {
    const failures: string[] = [];
    const focus = values.get('--color-focus');
    expect(focus, `--color-focus has no ${theme} value`).toBeDefined();
    // T925 — canvas and the accent tint are surfaces a focusable control sits
    // on (the page ground, and the current navigation item), so the indicator
    // has to clear 3:1 on them too.
    for (const surface of [
      '--color-surface',
      '--color-surface-raised',
      '--color-canvas',
      '--color-accent-subtle',
    ]) {
      const bg = values.get(surface);
      if (!bg) {
        failures.push(`${surface} (${theme}): token missing`);
        continue;
      }
      const ratio = contrast(focus as string, bg);
      if (ratio < 3) failures.push(`--color-focus on ${surface} (${theme}): ${ratio.toFixed(2)}:1 < 3:1`);
    }
    expect(failures).toEqual([]);
  });
});
