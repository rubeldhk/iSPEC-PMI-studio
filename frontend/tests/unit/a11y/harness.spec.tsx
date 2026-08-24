/**
 * T881 (EPIC-029) — the meta-test: the harness can still see.
 *
 * Every suite below the harness asserts zero violations, which is
 * indistinguishable from a harness that stopped detecting anything. This
 * file renders a KNOWN violation — an unlabelled input — and requires the
 * harness to report it. If this fails, no green result elsewhere means
 * anything (Constitution V: a check that cannot fail is decoration).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { runWcag, WCAG_TAGS } from './axe';

afterEach(cleanup);

describe('T881 · the harness detects a known violation', () => {
  it('reports an unlabelled input', async () => {
    render(
      <main>
        <h1>Probe</h1>
        <input type="text" />
      </main>,
    );
    const results = await runWcag(document.body);
    expect(results.violations.map((v) => v.id)).toContain('label');
  });

  it('runs all five WCAG tags — 2.2 AA is five tags, not one (R-029-2)', () => {
    expect([...WCAG_TAGS]).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  });

  it('target-size actually runs — the one rule wcag22aa contains, shipped disabled', async () => {
    render(
      <main>
        <h1>Probe</h1>
        <button type="button">Press</button>
      </main>,
    );
    const results = await runWcag(document.body);
    const everywhere = [
      ...results.violations,
      ...results.passes,
      ...results.incomplete,
      ...results.inapplicable,
    ].map((r) => r.id);
    // A disabled rule appears in NO result bucket. Present in any bucket
    // proves the harness enabled it; which bucket is jsdom's business.
    expect(everywhere).toContain('target-size');
  });
});
