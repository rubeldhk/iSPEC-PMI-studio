/**
 * T880 (EPIC-029) — the accessibility harness (FR-DS-030, research R-029-2).
 *
 * The trap this file exists to defuse, verified against current axe-core
 * documentation: there is NO aggregate WCAG tag — "WCAG 2.2 AA" is five
 * distinct tags, because 2.2 ⊃ 2.1 ⊃ 2.0 — and `wcag22aa` contains exactly
 * one rule, `target-size`, which ships `"enabled": false`. The intuitive
 * `runOnly: ['wcag22aa']` therefore runs one disabled rule: zero checks and a
 * green report claiming conformance to a standard it never tested. That is
 * DEF-028-003 and DEF-001-004 in a third costume.
 *
 * So: all five tags, `target-size` explicitly enabled — in `axe.configure`
 * AND per-run, belt and braces — and a meta-test (harness.spec.tsx, T881)
 * proving the harness still detects a known violation, so it cannot silently
 * stop working.
 */
import axe from 'axe-core';
import { expect } from 'vitest';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

axe.configure({ rules: [{ id: 'target-size', enabled: true }] });

export async function runWcag(target: Element = document.body): Promise<axe.AxeResults> {
  return axe.run(target, {
    runOnly: { type: 'tag', values: [...WCAG_TAGS] },
    rules: {
      // The WCAG 2.2 delta — without this line it is untested (R-029-2).
      'target-size': { enabled: true },
      // Needs a real rendering engine; jsdom computes no layout, so axe would
      // return `incomplete`, never pass or fail. Disabled EXPLICITLY so the
      // claim is honest — contrast is COMPUTED from the token values instead,
      // in tests/governance/design-tokens.spec.ts (T872, R-029-3).
      'color-contrast': { enabled: false },
    },
  });
}

export async function expectNoViolations(target: Element = document.body): Promise<void> {
  const results = await runWcag(target);
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`),
  ).toEqual([]);
}
