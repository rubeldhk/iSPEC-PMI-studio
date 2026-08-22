/**
 * T900c (EPIC-029) — token SUFFICIENCY, as distinct from token correctness:
 * T868 proves the tokens that exist are well-formed; it cannot notice that
 * the set is incomplete, because a token nobody defined is a token it never
 * reads. This is the only check that fails when the scale has a hole in it —
 * SC-DS-006: a new page can be built without introducing a visual value that
 * is not already a token (quickstart V6; analysis F3).
 *
 * Three assertions over fixtures/NewPage.tsx:
 *  (a) the literal-value rule reports ZERO violations on it — driven through
 *      the ESLint API the way T876/T877 drive it, because the rule's shipped
 *      scope is frontend/src/** and the fixture deliberately sits outside it;
 *  (b) it declares no new custom property;
 *  (c) every var(--…) it references — and every one the component stylesheet
 *      it consumes references — resolves to a token defined in tokens.css,
 *      an unresolved reference failing BY NAME. Mutation-verified with
 *      var(--color-does-not-exist) below.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NewPage } from './fixtures/NewPage';
// The repository's own config — what `pnpm lint` enforces is what runs here.
import rootConfig from '../../../../eslint.config.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../..');

const fixtureSource = readFileSync(join(here, 'fixtures/NewPage.tsx'), 'utf8');
const tokensCss = readFileSync(join(ROOT, 'frontend/src/design/tokens.css'), 'utf8');
const componentsCss = readFileSync(
  join(ROOT, 'frontend/src/design/components/components.css'),
  'utf8',
);

const declaredTokens = new Set(
  [...tokensCss.matchAll(/(--[a-z][a-z0-9-]*)\s*:/g)].map((m) => m[1] as string),
);

/** var(--…) references in a source that do not resolve to a declared token. */
export function unresolvedReferences(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)]
    .map((m) => m[1] as string)
    .filter((name, i, all) => all.indexOf(name) === i)
    .filter((name) => !declaredTokens.has(name));
}

afterEach(cleanup);

describe('T900c · the fixture is a real page', () => {
  it('renders its page header, field, table, pill and empty state', () => {
    render(<NewPage />);
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeDefined();
    expect(screen.getByLabelText('Reviewer')).toBeDefined();
    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByText('waiting')).toBeDefined();
    expect(screen.getByText('No closed reviews yet')).toBeDefined();
  });
});

describe('T900c · (a) zero literal-value violations, via the ESLint API', () => {
  it('the shipped rule passes the fixture as if it lived in frontend/src', async () => {
    const eslint = new ESLint({
      cwd: ROOT,
      overrideConfigFile: true,
      overrideConfig: rootConfig as never,
    });
    // A virtual path inside the rule's scope — the fixture's own path is
    // outside it by design, so scope placement is explicit here.
    const [result] = await eslint.lintText(fixtureSource, {
      filePath: join(ROOT, 'frontend/src/design/__new-page-fixture__.tsx'),
    });
    const violations = (result?.messages ?? []).filter(
      (m) => m.ruleId === 'design/no-literal-visual-values',
    );
    expect(violations.map((m) => m.message)).toEqual([]);
  });
});

describe('T900c · (b) no new custom property', () => {
  it('the fixture declares none', () => {
    expect([...fixtureSource.matchAll(/(--[a-z0-9-]+)\s*:(?!\/)/g)].filter(
      // a var(--x) REFERENCE is not a declaration; declarations set a value
      (m) => !fixtureSource.slice(Math.max(0, (m.index ?? 0) - 4), m.index ?? 0).includes('var('),
    ).map((m) => m[1])).toEqual([]);
  });
});

describe('T900c · (c) every token reference resolves', () => {
  it('the fixture reaches only tokens tokens.css defines', () => {
    expect(unresolvedReferences(fixtureSource)).toEqual([]);
  });

  it('so does the component stylesheet the new page consumes', () => {
    expect(unresolvedReferences(componentsCss)).toEqual([]);
  });

  it('MUTATION — var(--color-does-not-exist) fails, naming the reference', () => {
    const mutated = fixtureSource.replace('var(--space-6)', 'var(--color-does-not-exist)');
    expect(unresolvedReferences(mutated)).toEqual(['--color-does-not-exist']);
  });
});
